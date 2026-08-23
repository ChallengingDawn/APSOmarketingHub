import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { readLogs, saveCurrentBatch } from "@/lib/logs";
import {
  buildFilterInstructions,
  buildFeedbackBlock,
  type GenerationFilters,
} from "@/lib/filters";
import { getAnthropic, channelBudget, claudeText } from "@/lib/ai/claude";
import { saveContent } from "@/lib/content";
import { getOptionalUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 180;

type ProposeBody = {
  topic?: string;
  channel?: "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
  filters?: GenerationFilters;
  personaId?: string;
  personaIds?: string[];
};

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
  imagePending?: boolean;
};

const FALLBACK_IMAGES = ["/mood/oring.png", "/mood/no-surcharge.png", "/mood/oring.png"];

// Each of the three parallel proposals gets a distinct angle so they don't
// converge on the same idea (structured runs are near-deterministic).
const ANGLES = [
  `Angle for THIS proposal: problem-first. Open on a concrete pain, failure mode, or costly mistake the reader recognises from their own work, then resolve it.`,
  `Angle for THIS proposal: ease-first. Lead with a specific APSOparts shop capability that removes friction (DirectCUT, Quickorder, 48/72h delivery, no-surcharge) and what it changes in the reader's day.`,
  `Angle for THIS proposal: knowledge-first. Lead with a genuinely useful technical insight, rule of thumb, or comparison the reader will want to save — the brand appears only as the competent source.`,
];

const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Scroll-stopping opening line, max 12 words, in the requested language.",
    },
    body: {
      type: "string",
      description:
        "The full channel content, exactly in the mandated channel format, in the requested language.",
    },
    imagePrompt: {
      type: "string",
      description:
        "Concrete visual brief for an accompanying image, or empty string when no image is wanted.",
    },
  },
  required: ["headline", "body", "imagePrompt"],
  additionalProperties: false,
} as const;

const channelExpectations: Record<string, string> = {
  linkedin: `The "body" MUST be an actual LinkedIn post (80–160 words, 1–3 short paragraphs with blank lines between them, a scroll-stopping first line, a soft CTA, and 2–4 hashtags at the bottom).`,
  newsletter: `The "body" MUST start with "Subject: ..." on line 1, "Preheader: ..." on line 2, then the email body (220–350 words, 2–4 short sections) ending with "— APSOparts".`,
  blog: `The "body" MUST be a 600–900 word blog article in markdown: "# H1", then 2–3 sentence intro, then 3–5 "## Section" headings (each opening with a direct 1–2 sentence answer), at least one bulleted list of specs or criteria, a closing "## FAQ" section with 3–5 self-contained Q&As (40–60 words each), and a trailing \`\`\`json fenced block with schema.org Article + FAQPage JSON-LD built from the actual content.`,
  ad: `The "body" MUST contain exactly three labelled lines: "HEADLINE: ...", "BODY: ...", "CTA: ...". No other text. Keep the total under 50 words.`,
  product: `The "body" MUST be a full product page using markdown H2 sections in this order: Product Summary, Key Benefits, Typical Applications, Material Explanation, Technical Specifications (markdown table Property | Value | Unit), Selection Guidance, Variants / Dimensions.`,
  seo: `The "body" MUST contain exactly five labelled blocks: "META TITLE: ...", "META DESCRIPTION: ...", "H1: ...", "INTRO PARAGRAPH: ...", "FAQ: ..." (3 lines "Q: ... — A: ..."). Nothing else. Obey char limits from the system prompt.`,
};

export async function POST(req: NextRequest) {
  let body: ProposeBody = {};
  try {
    body = (await req.json()) as ProposeBody;
  } catch {
    // allow empty body
  }
  const channel = body.channel ?? "linkedin";
  const topic = body.topic?.trim() ?? "";
  const filters = body.filters ?? {};
  const wantsImage =
    filters.wantsImage ?? (channel === "linkedin" || channel === "newsletter" || channel === "blog");

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured", proposals: [] },
      { status: 503 }
    );
  }

  try {
    const brain = await readBrain();
    const logs = await readLogs();
    const likes = logs.entries
      .filter((e) => e.type === "like" && (!e.channel || e.channel === channel))
      .slice(0, 6);
    const dislikes = logs.entries
      .filter((e) => e.type === "dislike" && (!e.channel || e.channel === channel))
      .slice(0, 6);
    const filtersForBrief: GenerationFilters = { ...filters, wantsImage };

    // Stable, cacheable brand/channel block + volatile filters/feedback block.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: brandSystemPrompt(brain, channel, body.personaIds?.length ? body.personaIds : body.personaId),
        cache_control: { type: "ephemeral" },
      },
    ];
    const volatile =
      buildFilterInstructions(filtersForBrief) +
      buildFeedbackBlock(logs.userDefaults, likes, dislikes);
    if (volatile.trim()) systemBlocks.push({ type: "text", text: volatile });

    const imageRule = wantsImage
      ? `"imagePrompt": a concrete visual brief for the image that accompanies the post. Industrial aesthetic, hands/tools/components in realistic context. Never CAD, never stock suits, never white-background product shots, never promotional badges.`
      : `"imagePrompt": return an empty string.`;

    const budget = channelBudget(channel);
    const expectation = channelExpectations[channel] ?? "";

    // Three independent proposals in parallel — each gets its own token
    // budget (fixes the old single-call truncation on long channels) and a
    // guaranteed-valid JSON shape via structured outputs.
    const results = await Promise.all(
      ANGLES.map((angle) =>
        claudeText({
          client: anthropic,
          system: systemBlocks,
          user: [
            `Produce ONE ${channel} proposal${topic ? ` about: ${topic}` : ""}.`,
            ``,
            angle,
            ``,
            expectation ? `FORMAT (mandatory): ${expectation}` : ``,
            imageRule,
          ]
            .filter(Boolean)
            .join("\n"),
          budget,
          outputFormat: {
            type: "json_schema",
            schema: PROPOSAL_SCHEMA as unknown as Record<string, unknown>,
          },
        })
      )
    );

    const parsed: { headline: string; body: string; imagePrompt: string }[] = [];
    const errors: string[] = [];
    for (const r of results) {
      if (!r.ok) {
        errors.push(r.failure.error);
        continue;
      }
      try {
        parsed.push(JSON.parse(r.text));
      } catch {
        errors.push("Model returned unparseable JSON");
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: errors[0] ?? "Proposal generation failed", proposals: [] },
        { status: 502 }
      );
    }

    const proposals: Proposal[] = parsed.slice(0, 3).map((p, i) => ({
      headline: p.headline ?? "",
      body: p.body ?? "",
      imagePrompt: p.imagePrompt ?? "",
      imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
      imageSource: "fallback",
      imagePending: Boolean(wantsImage && (p.imagePrompt?.trim() ?? "").length > 0),
    }));

    // Persist the batch so it can be rehydrated on the client next visit.
    await saveCurrentBatch({
      channel,
      filters,
      proposals,
      generatedAt: new Date().toISOString(),
    });

    // Every proposal also lands in the library as a draft (best-effort).
    try {
      const user = await getOptionalUser();
      await Promise.all(
        proposals.map((p) =>
          saveContent({
            channel,
            title: p.headline.slice(0, 160) || null,
            body: p.body,
            filters: filters as Record<string, unknown>,
            createdBy: user?.username ?? null,
          })
        )
      );
    } catch (err) {
      console.error("[propose] draft save failed", err);
    }

    return NextResponse.json({ proposals, ...(errors.length ? { partialErrors: errors } : {}) });
  } catch (err) {
    console.error("[propose] error", err);
    return NextResponse.json({ error: "Proposal generation failed" }, { status: 500 });
  }
}
