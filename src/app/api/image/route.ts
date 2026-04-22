import { NextRequest, NextResponse } from "next/server";
import { generateApsoImage, type ReferenceImage } from "@/lib/images";
import { readBrain } from "@/lib/brain";
import { buildImagePrompt, type ImagePromptInput } from "@/lib/imagePrompt";
import type { GenerationFilters } from "@/lib/filters";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  prompt: string;
  filters?: GenerationFilters;
  references?: ReferenceImage[];
  referenceNotes?: string;
  aspect?: ImagePromptInput["aspect"];
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const brief = body.prompt?.trim();
  if (!brief) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const brain = await readBrain();
  const fullPrompt = buildImagePrompt(brain, {
    brief,
    filters: body.filters,
    referenceNotes: body.referenceNotes,
    aspect: body.aspect,
  });

  const result = await generateApsoImage(geminiKey, fullPrompt, body.references ?? []);
  if (result.ok) {
    return NextResponse.json({
      imageUrl: result.dataUrl,
      imageSource: "gemini",
      imageBrief: brief,
    });
  }
  return NextResponse.json({
    imageSource: "fallback",
    imageError: result.error,
  });
}