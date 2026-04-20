import { NextRequest, NextResponse } from "next/server";
import { generateApsoImage } from "@/lib/images";
import { updateCurrentBatchImage } from "@/lib/logs";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageBody = {
  index: number;
  imagePrompt: string;
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

  const fullPrompt =
    `Create a photorealistic marketing image for APSOparts (industrial B2B e-commerce). ` +
    `${imagePrompt}. ` +
    `Clean industrial aesthetic, premium but not glossy. Realistic environments with hands, tools and components in context. ` +
    `No CAD, no schematics, no white-background isolated product shots, no promotional badges or text overlays, no stock photos of people in suits.`;

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
