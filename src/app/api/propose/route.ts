import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { readLogs, saveCurrentBatch } from "@/lib/logs";
import {
  buildFilterInstructions,
  buildFeedbackBlock,
  type GenerationFilters,
} from "@/lib/filters";

export const runtime = "nodejs";
export const maxDuration = 120;

type ProposeBody = {
  topic?: string;
  channel?: "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
  filters?: GenerationFilters;
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
  const wantsImage = filters.wantsImage ?? (channel === "linkedin" || channel === "newsletter" || channel === "blog");
  const temperature = Math.max(0.2, Math.min(1, (filters.creativity ?? 70) / 100));

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured", proposals: [] },
      { status: 503 }
    );
  }

  try {
    const brain = await readBrain();
    const logs = await readLogs();
    const likes = logs.entries.filter((e) => e.type === "like").slice(0, 6);
    const dislikes = logs.entries.filter((e) => e.type === "dislike").slice(0, 6);
    const feedbackBlock = buildFeedbackBlock(logs.userDefaults, likes, dislikes);
    const filtersForBrief: GenerationFilters = { ...filters, wantsImage };
    const system =
      brandSystemPrompt(brain, channel) +
      buildFilterInstructions(filtersForBrief) +
      feedbackBlock;
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const imageRule = wantsImage
      ? `- "imagePrompt": a concrete visual brief for the image that accompanies the post. Industrial aesthetic, hands/tools/components in realistic context. Never CAD, never stock suits, never white-background product shots, never promotional badges.`
      : `- "imagePrompt": leave as an empty string.`;

    const channelExpectations: Record<string, string> = {
      linkedin:
        `Each "body" MUST be an actual LinkedIn post (80–160 words, 1–3 short paragraphs with blank lines between them, a scroll-stopping first line, a soft CTA, and 2–4 hashtags at the bottom).`,
      newsletter:
        `Each "body" MUST start with "Subject: ..." on line 1, "Preheader: ..." on line 2, then the email body (220–350 words, 2–4 short sections) ending with "— APSOparts".`,
      blog:
        `Each "body" MUST be a 600–900 word blog article in markdown: "# H1", then 2–3 sentence intro, then 3–5 "## Section" headings, with at least one bulleted list of specs or criteria.`,
      ad: `Each "body" MUST contain exactly three labelled lines: "HEADLINE: ...", "BODY: ...", "CTA: ...". No other text. Keep the total under 50 words.`,
      product:
        `Each "body" MUST be a full product page using markdown H2 sections in this order: Product Summary, Key Benefits, Typical Applications, Material Explanation, Technical Specifications (markdown table Property | Value | Unit), Selection Guidance, Variants / Dimensions.`,
      seo: `Each "body" MUST contain exactly four labelled blocks: "META TITLE: ...", "META DESCRIPTION: ...", "H1: ...", "INTRO PARAGRAPH: ...". Nothing else. Obey char limits from the system prompt.`,
    };
    const channelExpectation = channelExpectations[channel] ?? "";

    const langLead =
      filters.language === "DE"
        ? `ALLE Inhalte (Headline, Body, Image-Brief) MÜSSEN auf Deutsch sein. Kein Englisch. `
        : filters.language === "EN"
          ? `All content in English. `
          : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2800,
      temperature,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            `${langLead}Produce 3 distinct ${channel} proposals${topic ? ` about: ${topic}` : ""}.`,
            ``,
            channelExpectation ? `FORMAT (mandatory): ${channelExpectation}` : "",
            channelExpectation ? "" : "",
            `For each proposal, return:`,
            `- "headline": a scroll-stopping opening line (max 12 words)`,
            `- "body": the full ${channel} content, exactly in the format required above.`,
            imageRule,
            ``,
            `Return ONLY a JSON array of 3 objects with exactly these keys. No markdown, no commentary, no code fences. The "body" value is a plain string; when it contains markdown (blog, product) or labelled blocks (ad, seo, newsletter), keep it inside the JSON string with \\n line breaks. Example:`,
            `[{"headline":"...","body":"...","imagePrompt":"..."}, ...]`,
          ]
            .filter((l) => l !== "")
            .join("\n"),
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    const json = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    let parsed: { headline: string; body: string; imagePrompt: string }[] = [];
    try {
      parsed = JSON.parse(json);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: text },
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

    return NextResponse.json({ proposals });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Proposal generation failed", details: message },
      { status: 500 }
    );
  }
}