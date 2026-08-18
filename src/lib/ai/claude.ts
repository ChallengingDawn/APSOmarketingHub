import Anthropic from "@anthropic-ai/sdk";

// Model is env-configurable so the AWS task definition can pin/upgrade without
// a code change. Default: current Opus tier.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey, maxRetries: 3 });
  return _client;
}

export type ChannelBudget = {
  // Hard output cap. On current models this covers thinking + response text,
  // so long-form channels need generous headroom.
  maxTokens: number;
  effort: "low" | "medium" | "high";
};

const BUDGETS: Record<string, ChannelBudget> = {
  blog: { maxTokens: 20000, effort: "high" },
  product: { maxTokens: 16000, effort: "high" },
  seo: { maxTokens: 6000, effort: "medium" },
  newsletter: { maxTokens: 8000, effort: "medium" },
  linkedin: { maxTokens: 6000, effort: "medium" },
  ad: { maxTokens: 4000, effort: "low" },
  studio: { maxTokens: 10000, effort: "medium" },
  freeform: { maxTokens: 10000, effort: "medium" },
};

export function channelBudget(channel: string): ChannelBudget {
  return BUDGETS[channel] ?? { maxTokens: 8000, effort: "medium" };
}

export type ClaudeFailure = { status: number; error: string };

/** Map SDK errors and non-end_turn stop reasons to actionable API responses. */
export function describeClaudeError(err: unknown): ClaudeFailure {
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, error: "Anthropic rate limit hit — wait a moment and retry." };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 503, error: "Anthropic API key is invalid or revoked." };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, error: "Could not reach the Anthropic API — network issue, retry." };
  }
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === "number" ? err.status : 500;
    return {
      status: status >= 500 ? 502 : status,
      error: `Anthropic API error (${status}): ${err.message}`,
    };
  }
  return { status: 500, error: "Generation failed" };
}

export type ClaudeTextResult =
  | { ok: true; text: string; usage: Anthropic.Usage; model: string }
  | { ok: false; failure: ClaudeFailure };

/**
 * One completion, streamed internally (avoids HTTP idle timeouts on long
 * generations) and assembled into the final text. Checks stop_reason so
 * truncation and refusals surface as clear errors instead of silent cuts.
 */
export async function claudeText(params: {
  client: Anthropic;
  system: Anthropic.TextBlockParam[];
  user: string;
  budget: ChannelBudget;
  outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
}): Promise<ClaudeTextResult> {
  const { client, system, user, budget, outputFormat } = params;
  try {
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: budget.maxTokens,
      output_config: outputFormat
        ? { effort: budget.effort, format: outputFormat }
        : { effort: budget.effort },
      system,
      messages: [{ role: "user", content: user }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "max_tokens") {
      return {
        ok: false,
        failure: {
          status: 502,
          error: `Output was truncated at ${budget.maxTokens} tokens — retry or shorten the request.`,
        },
      };
    }
    if (message.stop_reason === "refusal") {
      return {
        ok: false,
        failure: { status: 502, error: "The model declined this request. Rephrase and retry." },
      };
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { ok: true, text, usage: message.usage, model: message.model };
  } catch (err) {
    console.error("[claude] error", err);
    return { ok: false, failure: describeClaudeError(err) };
  }
}
