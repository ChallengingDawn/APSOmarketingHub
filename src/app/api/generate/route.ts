import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { readLogs } from "@/lib/logs";
import { generateApsoImage } from "@/lib/images";
import {
  buildFilterInstructions,
  buildFeedbackBlock,
  type GenerationFilters,
} from "@/lib/filters";
import { getAnthropic, CLAUDE_MODEL, channelBudget, claudeText } from "@/lib/ai/claude";
import { validateChannelOutput } from "@/lib/ai/validate";
import { saveContent } from "@/lib/content";
import { getOptionalUser } from "@/lib/auth/guard";

/** Derive a library title from generated content: H1, Subject line, or first line. */
function deriveTitle(text: string): string {
  const h1 = text.match(/^# (.+)$/m)?.[1];
  const subject = text.match(/^subject:\s*(.+)$/im)?.[1];
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return (h1 ?? subject ?? firstLine).slice(0, 160);
}

/** Best-effort draft save — generation must never fail because the library write did. */
async function saveDraft(params: {
  channel: string;
  body: string;
  imageUrl?: string;
  filters: GenerationFilters;
}): Promise<number | undefined> {
  try {
    const user = await getOptionalUser();
    const item = await saveContent({
      channel: params.channel,
      title: deriveTitle(params.body),
      body: params.body,
      imageUrl: params.imageUrl ?? null,
      filters: params.filters as Record<string, unknown>,
      createdBy: user?.username ?? null,
    });
    return item.id;
  } catch (err) {
    console.error("[generate] draft save failed", err);
    return undefined;
  }
}

export const runtime = "nodejs";
export const maxDuration = 180;

type GenerateBody = {
  channel: "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo" | "studio" | "freeform";
  prompt: string;
  model?: "claude" | "gemini";
  context?: Record<string, unknown>;
  withImage?: boolean;
  // When true, ask the LLM to emit an <image-brief>...</image-brief> at the end
  // and return it as `imageBrief` in the response, but do NOT actually generate
  // the image. Lets the caller decouple image generation while still getting a
  // high-quality, content-aware brief. Default: false.
  wantBrief?: boolean;
  personaId?: string;
  personaIds?: string[];
};

const IMAGE_TAG = /<image-brief>([\s\S]*?)<\/image-brief>/i;

type ImagePayload = {
  imageUrl?: string;
  imageSource?: "gemini" | "fallback";
  imageError?: string;
  imageBrief?: string;
};

async function maybeGenerateImage(
  raw: string,
  wantImage: boolean
): Promise<{ content: string; imagePayload: ImagePayload }> {
  const tag = raw.match(IMAGE_TAG);
  const brief = tag?.[1]?.trim() ?? "";
  const content = raw.replace(IMAGE_TAG, "").trim();

  // Even when we don't generate the image, return the LLM-emitted brief so
  // the caller can render it for editing and fire /api/image separately.
  if (!wantImage) return { content, imagePayload: brief ? { imageBrief: brief } : {} };

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return {
      content,
      imagePayload: {
        imageSource: "fallback",
        imageUrl: "/mood/oring.png",
        imageError: "GEMINI_API_KEY not configured",
        imageBrief: brief,
      },
    };
  }

  const fullPrompt =
    `Create a photorealistic professional B2B industrial marketing photograph for APSOparts (sealing technology and polymer components). ` +
    `${brief || content.slice(0, 280)}. ` +
    `Composition: reserve generous clean negative space in the lower-left third of the frame — dark, out-of-focus or a plain uncluttered surface — for a text overlay. ` +
    `Palette: deep navy and petrol tones with cool greys, at most one small red accent. Soft directional light, shallow depth of field, premium editorial look. ` +
    `ONE single scene: no collage, no split frame, no CAD, no schematics, no white-background isolated product shots, no stock photos of people in suits. ` +
    `ABSOLUTELY NO text, letters, numbers, logos, watermarks, labels or UI anywhere in the image.`;

  const result = await generateApsoImage(geminiKey, fullPrompt);
  if (result.ok) {
    return {
      content,
      imagePayload: { imageUrl: result.dataUrl, imageSource: "gemini", imageBrief: brief },
    };
  }
  return {
    content,
    imagePayload: {
      imageSource: "fallback",
      imageUrl: "/mood/oring.png",
      imageError: result.error,
      imageBrief: brief,
    },
  };
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channel, prompt, model = "claude", context, withImage = false, wantBrief = false, personaId, personaIds } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  }

  const brain = await readBrain();
  const logs = await readLogs();
  const filters = (context ?? {}) as GenerationFilters;
  // Composer always asks for an image alongside text, so teach the image
  // brief to honour the active audience/category too.
  const filtersForBrief: GenerationFilters = { ...filters, wantsImage: withImage };

  // Stable block (cacheable — changes only when the brain or channel changes)
  const personaSelection = personaIds?.length ? personaIds : personaId;
  const stableSystem = brandSystemPrompt(brain, channel, personaSelection);
  // Volatile block: filters + the like/dislike learning loop, channel-matched.
  const likes = logs.entries
    .filter((e) => e.type === "like" && (!e.channel || e.channel === channel))
    .slice(0, 6);
  const dislikes = logs.entries
    .filter((e) => e.type === "dislike" && (!e.channel || e.channel === channel))
    .slice(0, 6);
  const volatileSystem =
    buildFilterInstructions(filtersForBrief) +
    buildFeedbackBlock(logs.userDefaults, likes, dislikes);

  const briefRequested = withImage || wantBrief;
  const userMessage = [
    `Channel: ${channel}`,
    ``,
    `Request: ${prompt}`,
    ``,
    `Write like a senior industrial copywriter who knows this audience personally. Specificity beats adjectives: every claim must be concrete — a number, a named shop feature, a material property, a situation the reader recognises from their own week — or it gets cut. The FIRST LINE of the content must work as a standalone visual headline: 8 words or fewer, concrete, no colon-splitting, readable on its own over an image. Respect the positioning guard and reuse signature phrases only where they land naturally, never forced. If the channel is LinkedIn or newsletter, follow the post template; if product or SEO, follow the product content page structure. Before returning, read the draft once as the target reader would — skeptical, technical, short on time — and tighten anything that sounds like marketing filler or that a competitor could claim word-for-word.`,
    briefRequested
      ? `\nAt the very end, append the image brief inside exactly this tag (on its own lines): <image-brief>...</image-brief>. The brief is 60-120 words of plain prose describing ONE photograph, and it MUST follow this recipe:\n` +
        `1. Subject: a photorealistic professional B2B industrial marketing photograph directly relevant to the topic — name the concrete subject (the specific sealing component, polymer part, machine, material or engineering situation this content is about), shot in a real industrial context. Never a generic workshop, never an abstract concept. Tie the setting to the persona's world when one is selected (workshop floor, R&D lab, procurement office, distributor warehouse) while keeping the named subject in focus.\n` +
        `2. Composition: say explicitly that the lower-left third of the frame is reserved as generous, clean negative space for a text overlay — dark, out-of-focus, or a plain uncluttered surface. The subject sits right of centre or in the upper half.\n` +
        `3. Palette: subtle and brand-compatible — deep navy and petrol tones with cool greys, at most one small red accent. No warm orange industrial glow, no saturated colour.\n` +
        `4. Light and lens: soft directional light, shallow depth of field, 35mm-like framing, premium editorial look — a photograph shot for an engineering trade cover.\n` +
        `5. State that the image contains ABSOLUTELY NO text, letters, numbers, logos, watermarks, labels, UI or screens — image models render these as gibberish.\n` +
        `6. ONE single scene: no collage, no split frame, no grid, no CAD render, no schematic, no white-background product shot, no stock-photo people in suits.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const budget = channelBudget(channel);

  try {
    if (model === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY not configured" },
          { status: 503 }
        );
      }
      const creativity = typeof filters.creativity === "number" ? filters.creativity : 70;
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: stableSystem + volatileSystem,
          temperature: Math.max(0.2, Math.min(1, creativity / 100)),
          maxOutputTokens: Math.min(budget.maxTokens, 8192),
        },
      });
      const rawContent = result.text ?? "";
      const { content, imagePayload } = await maybeGenerateImage(rawContent, withImage);
      const draftId = await saveDraft({
        channel,
        body: content,
        imageUrl: imagePayload.imageUrl,
        filters,
      });
      return NextResponse.json({
        content,
        model: "gemini-2.5-flash",
        provider: "gemini",
        draftId,
        ...imagePayload,
      });
    }

    const anthropic = getAnthropic();
    if (!anthropic) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 }
      );
    }

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: "text", text: stableSystem, cache_control: { type: "ephemeral" } },
      ...(volatileSystem.trim()
        ? [{ type: "text" as const, text: volatileSystem }]
        : []),
    ];

    const first = await claudeText({
      client: anthropic,
      system: systemBlocks,
      user: userMessage,
      budget,
    });
    if (!first.ok) {
      return NextResponse.json({ error: first.failure.error }, { status: first.failure.status });
    }

    // Deterministic contract check + at most ONE revise pass.
    let finalText = first.text;
    let usage = first.usage;
    let revised = false;
    const bodyOnly = finalText.replace(IMAGE_TAG, "").trim();
    const violations = validateChannelOutput(channel, bodyOnly);
    if (violations.length) {
      const revise = await claudeText({
        client: anthropic,
        system: systemBlocks,
        user:
          `Here is a draft you produced for the ${channel} channel:\n\n<draft>\n${finalText}\n</draft>\n\n` +
          `It violates these channel rules:\n${violations.map((v) => `- ${v}`).join("\n")}\n\n` +
          `Return the corrected content in full, fixing every violation while keeping the substance and voice. Output ONLY the corrected content${briefRequested ? " (keep the <image-brief> tag at the end)" : ""}.`,
        budget,
      });
      if (revise.ok) {
        finalText = revise.text;
        usage = revise.usage;
        revised = true;
      }
      // If the revise pass fails, ship the first draft rather than erroring.
    }

    const { content, imagePayload } = await maybeGenerateImage(finalText, withImage);
    const draftId = await saveDraft({
      channel,
      body: content,
      imageUrl: imagePayload.imageUrl,
      filters,
    });

    return NextResponse.json({
      content,
      model: CLAUDE_MODEL,
      provider: "claude",
      usage,
      draftId,
      quality: {
        violationsFound: violations,
        revised,
      },
      ...imagePayload,
    });
  } catch (err) {
    console.error("[generate] error", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}