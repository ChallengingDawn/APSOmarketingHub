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
    `Create a photorealistic marketing image for APSOparts (industrial B2B e-commerce). ` +
    `${brief || content.slice(0, 280)}. ` +
    `Clean industrial aesthetic, premium but not glossy. Realistic environments with hands, tools and components in context. ` +
    `No CAD, no schematics, no white-background isolated product shots, no promotional badges or text overlays, no stock photos of people in suits.`;

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
    `Produce content that matches the brand voice, respects the positioning guard, and reuses signature phrases naturally. If the channel is LinkedIn or newsletter, follow the post template. If the channel is product or SEO, follow the product content page structure.`,
    briefRequested
      ? `\nAt the very end, append a concrete image brief inside exactly this tag (on its own lines): <image-brief>...</image-brief>. The brief must be 60-120 words and must reference the SPECIFIC scene the body of the content describes — not a generic workshop. Tie the image to the persona's day (workshop floor for P5/P6, R&D lab for P7, SAP/Ariba office for P1, Italian SME shop floor for P3, owner-on-shop-floor for P4, growth-stage open office for P2, distributor warehouse for P8). Include: subject + setting + lighting + camera angle + 35mm-like depth-of-field. No CAD, no stock suits, no white-bg product shots, no text overlays, no logos.`
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