import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { readBrain, brandSystemPrompt } from "@/lib/brain";

export const runtime = "nodejs";
export const maxDuration = 120;

type ProposeBody = {
  topic?: string;
  channel?: "linkedin" | "newsletter" | "blog";
};

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
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

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY not configured",
        proposals: [],
      },
      { status: 503 }
    );
  }

  try {
    const brain = await readBrain();
    const system = brandSystemPrompt(brain, channel);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2400,
      temperature: 0.85,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            `Produce 3 distinct ${channel} post proposals${
              topic ? ` about: ${topic}` : ""
            }.`,
            ``,
            `For each proposal, return:`,
            `- "headline": a scroll-stopping opening line (max 12 words)`,
            `- "body": the full post (short paragraphs, mobile-first, under 160 words). Use the "I can do this now" framework where it fits.`,
            `- "imagePrompt": a concrete visual brief for the image that accompanies the post. Industrial aesthetic. Hands, components in realistic context. Never CAD, never stock suits, never white-background product shots, never promotional badges.`,
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

      if (geminiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const imgRes = await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: [
              {
                role: "user",
                parts: [{ text: p.imagePrompt }],
              },
            ],
          });
          const parts = imgRes.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            const inline = (part as { inlineData?: { data?: string; mimeType?: string } })
              .inlineData;
            if (inline?.data) {
              const mime = inline.mimeType ?? "image/png";
              imageUrl = `data:${mime};base64,${inline.data}`;
              imageSource = "gemini";
              break;
            }
          }
        } catch {
          // keep fallback
        }
      }

      proposals.push({
        headline: p.headline ?? "",
        body: p.body ?? "",
        imagePrompt: p.imagePrompt ?? "",
        imageUrl,
        imageSource,
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