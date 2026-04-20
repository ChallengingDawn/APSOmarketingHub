import { GoogleGenAI } from "@google/genai";

type ImageResult =
  | { ok: true; dataUrl: string; model: string }
  | { ok: false; error: string };

const GEMINI_CANDIDATES = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.5-flash-image",
];

const IMAGEN_CANDIDATES = ["imagen-4.0-generate-preview-06-06", "imagen-3.0-generate-002"];

function extractInlineImage(parts: unknown[]): { data: string; mime: string } | null {
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (inline?.data) {
      return { data: inline.data, mime: inline.mimeType ?? "image/png" };
    }
  }
  return null;
}

export async function generateApsoImage(
  apiKey: string,
  prompt: string
): Promise<ImageResult> {
  const ai = new GoogleGenAI({ apiKey });
  const errors: string[] = [];

  for (const model of GEMINI_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });
      const parts = res.candidates?.[0]?.content?.parts ?? [];
      const found = extractInlineImage(parts);
      if (found) {
        return { ok: true, dataUrl: `data:${found.mime};base64,${found.data}`, model };
      }
      errors.push(`${model}: no image data returned`);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const model of IMAGEN_CANDIDATES) {
    try {
      const res = await (ai.models as unknown as {
        generateImages: (args: {
          model: string;
          prompt: string;
          config?: { numberOfImages?: number };
        }) => Promise<{
          generatedImages?: { image?: { imageBytes?: string; mimeType?: string } }[];
        }>;
      }).generateImages({
        model,
        prompt,
        config: { numberOfImages: 1 },
      });
      const first = res.generatedImages?.[0]?.image;
      if (first?.imageBytes) {
        const mime = first.mimeType ?? "image/png";
        return { ok: true, dataUrl: `data:${mime};base64,${first.imageBytes}`, model };
      }
      errors.push(`${model}: no image data returned`);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: false, error: errors.join(" | ") };
}