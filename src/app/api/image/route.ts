import { NextRequest, NextResponse } from "next/server";
import { generateApsoImage } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { prompt: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const fullPrompt =
    `Create a photorealistic marketing image for APSOparts (industrial B2B e-commerce). ` +
    `${prompt}. ` +
    `Clean industrial aesthetic, premium but not glossy. Realistic environments with hands, tools and components in context. ` +
    `No CAD, no schematics, no white-background isolated product shots, no promotional badges or text overlays, no stock photos of people in suits.`;

  const result = await generateApsoImage(geminiKey, fullPrompt);
  if (result.ok) {
    return NextResponse.json({
      imageUrl: result.dataUrl,
      imageSource: "gemini",
    });
  }
  return NextResponse.json({
    imageSource: "fallback",
    imageError: result.error,
  });
}
