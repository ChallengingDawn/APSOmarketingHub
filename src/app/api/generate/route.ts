import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { readLogs } from "@/lib/logs";
import { generateApsoImage } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  channel: "linkedin" | "newsletter" | "blog" | "product" | "seo" | "studio" | "freeform";
  prompt: string;
  model?: "claude" | "gemini";
  context?: Record<string, unknown>;
  withImage?: boolean;
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

  if (!wantImage) return { content, imagePayload: {} };

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

  const { channel, prompt, model = "claude", context, withImage = false } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  }

  const brain = await readBrain();
  const logs = await readLogs();
  const defaultsBlock = logs.userDefaults?.trim()
    ? `\n\n# USER DEFAULTS (always apply)\n${logs.userDefaults.trim()}`
    : "";
  const system = brandSystemPrompt(brain, channel) + defaultsBlock;
  const creativity = typeof (context as { creativity?: number } | undefined)?.creativity === "number"
    ? ((context as { creativity: number }).creativity)
    : 70;
  const temperature = Math.max(0.2, Math.min(1, creativity / 100));

  const userMessage = [
    `Channel: ${channel}`,
    context ? `Context: ${JSON.stringify(context)}` : null,
    ``,
    `Request: ${prompt}`,
    ``,
    `Produce content that matches the brand voice, respects the positioning guard, and reuses signature phrases naturally. If the channel is LinkedIn or newsletter, follow the post template. If the channel is product or SEO, follow the product content page structure.`,
    withImage
      ? `\nAt the very end, append a concrete image brief inside exactly this tag (on its own lines): <image-brief>...</image-brief>. The brief should describe a photorealistic industrial scene (hands, tools, components in context, no CAD, no stock suits, no white-bg product shots, no text overlays).`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    if (model === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY not configured" },
          { status: 503 }
        );
      }
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: system,
          temperature,
          maxOutputTokens: 2000,
        },
      });
      const rawContent = result.text ?? "";
      const { content, imagePayload } = await maybeGenerateImage(rawContent, withImage);
      return NextResponse.json({
        content,
        model: "gemini-2.5-flash",
        provider: "gemini",
        ...imagePayload,
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 }
      );
    }
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const rawContent = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    const { content, imagePayload } = await maybeGenerateImage(rawContent, withImage);

    return NextResponse.json({
      content,
      model: "claude-sonnet-4-6",
      provider: "claude",
      usage: response.usage,
      ...imagePayload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Generation failed", details: message },
      { status: 500 }
    );
  }
}