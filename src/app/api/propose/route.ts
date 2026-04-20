import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { generateApsoImage } from "@/lib/images";
import { readLogs } from "@/lib/logs";

export const runtime = "nodejs";
export const maxDuration = 120;

type Filters = {
  contentType?: string;
  language?: string;
  framework?: string;
  audience?: string;
  category?: string;
  length?: string;
  creativity?: number;
  emphasizeTones?: string[];
  emphasizePhrases?: string[];
  wantsImage?: boolean;
};

type ProposeBody = {
  topic?: string;
  channel?: "linkedin" | "newsletter" | "blog" | "product" | "seo";
  filters?: Filters;
};

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
};

const FALLBACK_IMAGES = ["/mood/oring.png", "/mood/no-surcharge.png", "/mood/oring.png"];

function buildFilterInstructions(filters: Filters | undefined): string {
  if (!filters) return "";
  const lines: string[] = [];
  if (filters.language === "DE") {
    lines.push(
      `- LANGUAGE: Output language is GERMAN (Deutsch). Write EVERY field — headline, body, imagePrompt — in fluent industrial German. Do not mix English and German. Keep brand names (APSOparts, Angst+Pfister, DirectCUT, Quickorder) untranslated.`
    );
  } else if (filters.language === "EN") {
    lines.push(`- LANGUAGE: Output language is ENGLISH. All fields in English.`);
  }
  if (filters.framework && filters.framework !== "auto") {
    const fw =
      filters.framework === "ican"
        ? "Use the 'I can do this now' framework: recognize a situation → early warning signs → simple guidance → remove friction."
        : filters.framework === "ease"
          ? "Use the 'Ease / feature focus' framework: highlight a concrete shop feature (DirectCUT, Quickorder, no-surcharge, 48/72h delivery) that removes friction."
          : filters.framework === "recognition"
            ? "Use the 'We've already met' framework: recognition narrative — the customer already knows these parts and this situation."
            : "";
    if (fw) lines.push(`- Framework: ${fw}`);
  }
  if (filters.audience) lines.push(`- Audience: write for ${filters.audience}.`);
  if (filters.category) lines.push(`- Category focus: ${filters.category}. Every proposal should be relevant to this product family.`);
  if (filters.length) {
    const lenMap: Record<string, string> = {
      short: "Short — 80–120 words for posts, 2 sentences for headlines.",
      medium: "Medium — 140–220 words for posts, 1–2 paragraphs.",
      long: "Long — 300+ words, multiple short paragraphs with clear structure.",
    };
    lines.push(`- Length: ${lenMap[filters.length] ?? filters.length}`);
  }
  if (filters.emphasizeTones?.length) lines.push(`- Emphasize these tone adjectives: ${filters.emphasizeTones.join(", ")}.`);
  if (filters.emphasizePhrases?.length) {
    lines.push(
      `- Force-include (naturally, not forced) at least one of these signature phrases: ${filters.emphasizePhrases
        .map((p) => `"${p}"`)
        .join(" ; ")}.`
    );
  }
  return lines.length ? `\n\n# FILTERS\n${lines.join("\n")}` : "";
}

type SimpleLog = { headline?: string; body?: string; correction?: string };

function buildFeedbackBlock(userDefaults: string, likes: SimpleLog[], dislikes: SimpleLog[]): string {
  const parts: string[] = [];
  if (userDefaults?.trim()) {
    parts.push(`\n\n# USER DEFAULTS (always apply)\n${userDefaults.trim()}`);
  }
  if (likes.length) {
    const examples = likes
      .map((l, i) => `Example ${i + 1}:\n${l.headline ? `Headline: ${l.headline}\n` : ""}${l.body ?? ""}`)
      .join("\n\n---\n\n");
    parts.push(`\n\n# LIKED EXAMPLES (imitate style & framing)\n${examples}`);
  }
  if (dislikes.length) {
    const examples = dislikes
      .map((l, i) => {
        const sample = `${l.headline ? `Headline: ${l.headline}\n` : ""}${l.body ?? ""}`;
        const fix = l.correction ? `\nUser correction: ${l.correction}` : "";
        return `Example ${i + 1}:\n${sample}${fix}`;
      })
      .join("\n\n---\n\n");
    parts.push(`\n\n# DISLIKED EXAMPLES (avoid these patterns; apply corrections)\n${examples}`);
  }
  return parts.join("");
}

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
    const system = brandSystemPrompt(brain, channel) + buildFilterInstructions(filters) + feedbackBlock;
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const imageRule = wantsImage
      ? `- "imagePrompt": a concrete visual brief for the image that accompanies the post. Industrial aesthetic, hands/tools/components in realistic context. Never CAD, never stock suits, never white-background product shots, never promotional badges.`
      : `- "imagePrompt": leave as an empty string.`;

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
            `For each proposal, return:`,
            `- "headline": a scroll-stopping opening line (max 12 words)`,
            `- "body": the full ${channel} content, following the personality, framework, length and filters defined above.`,
            imageRule,
            ``,
            `Return ONLY a JSON array of 3 objects with exactly these keys. No markdown, no commentary, no code fences. Example:`,
            `[{"headline":"...","body":"...","imagePrompt":"..."}, ...]`,
          ].join("\n"),
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

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const proposals: Proposal[] = [];

    for (let i = 0; i < parsed.length && i < 3; i++) {
      const p = parsed[i];
      let imageUrl = FALLBACK_IMAGES[i % FALLBACK_IMAGES.length];
      let imageSource: Proposal["imageSource"] = "fallback";
      let imageError: string | undefined;

      if (wantsImage && geminiKey && p.imagePrompt) {
        const fullPrompt =
          `Create a photorealistic marketing image for APSOparts (industrial B2B e-commerce). ` +
          `${p.imagePrompt}. ` +
          `Clean industrial aesthetic, premium but not glossy. Realistic environments with hands, tools and components in context. ` +
          `No CAD, no schematics, no white-background isolated product shots, no promotional badges or text overlays, no stock photos of people in suits.`;
        const result = await generateApsoImage(geminiKey, fullPrompt);
        if (result.ok) {
          imageUrl = result.dataUrl;
          imageSource = "gemini";
        } else {
          imageError = result.error;
        }
      } else if (wantsImage && !geminiKey) {
        imageError = "GEMINI_API_KEY not configured";
      }

      proposals.push({
        headline: p.headline ?? "",
        body: p.body ?? "",
        imagePrompt: p.imagePrompt ?? "",
        imageUrl,
        imageSource,
        imageError,
      });
    }

    return NextResponse.json({ proposals });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Proposal generation failed", details: message },
      { status: 500 }
    );
  }
}