import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { readBrain, brandSystemPrompt } from "@/lib/brain";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  channel: "linkedin" | "newsletter" | "blog" | "product" | "seo" | "studio" | "freeform";
  prompt: string;
  model?: "claude" | "gemini";
  context?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channel, prompt, model = "claude", context } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  }

  const brain = await readBrain();
  const system = brandSystemPrompt(brain, channel);

  const userMessage = [
    `Channel: ${channel}`,
    context ? `Context: ${JSON.stringify(context)}` : null,
    ``,
    `Request: ${prompt}`,
    ``,
    `Produce content that matches the brand voice, respects the positioning guard, and reuses signature phrases naturally. If the channel is LinkedIn or newsletter, follow the post template. If the channel is product or SEO, follow the product content page structure.`,
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
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      });
      const content = result.text ?? "";
      return NextResponse.json({
        content,
        model: "gemini-2.5-flash",
        provider: "gemini",
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
      temperature: 0.7,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({
      content,
      model: "claude-sonnet-4-6",
      provider: "claude",
      usage: response.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Generation failed", details: message },
      { status: 500 }
    );
  }
}