import { NextRequest, NextResponse } from "next/server";
import { generateApsoImage } from "@/lib/images";
import { updateCurrentBatchImage } from "@/lib/logs";
import { readBrain } from "@/lib/brain";
import { buildImagePrompt } from "@/lib/imagePrompt";
import type { GenerationFilters } from "@/lib/filters";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageBody = {
  index: number;
  imagePrompt: string;
  filters?: GenerationFilters;
};

export async function POST(req: NextRequest) {
  let body: ImageBody;
  try {
    body = (await req.json()) as ImageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { index, imagePrompt } = body;
  if (typeof index !== "number" || !imagePrompt?.trim()) {
    return NextResponse.json({ error: "Missing index or imagePrompt" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured", imagePending: false },
      { status: 503 }
    );
  }

  const brain = await readBrain();
  const fullPrompt = buildImagePrompt(brain, {
    brief: imagePrompt,
    filters: body.filters,
  });

  const result = await generateApsoImage(geminiKey, fullPrompt);

  if (result.ok) {
    await updateCurrentBatchImage(index, {
      imageUrl: result.dataUrl,
      imageSource: "gemini",
      imageError: undefined,
      imagePending: false,
    });
    return NextResponse.json({
      imageUrl: result.dataUrl,
      imageSource: "gemini",
      imagePending: false,
    });
  }

  await updateCurrentBatchImage(index, {
    imageError: result.error,
    imagePending: false,
  });
  return NextResponse.json({
    imageSource: "fallback",
    imageError: result.error,
    imagePending: false,
  });
}
