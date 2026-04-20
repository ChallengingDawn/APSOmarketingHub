import { GoogleGenAI } from "@google/genai";

type ImageResult =
  | { ok: true; dataUrl: string; model: string }
  | { ok: false; error: string };

const MODELS = ["gemini-2.5-flash-image"];

function summarizeError(raw: string): string {
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{")));
    const code = parsed?.error?.code ?? parsed?.error?.status;
    const msg = parsed?.error?.message ?? raw;
    if (code === 429 || parsed?.error?.status === "RESOURCE_EXHAUSTED") {
      return "Gemini free-tier quota exceeded. Upgrade the Google API project to a paid plan to enable image generation.";
    }
    if (code === 404) {
      return `Model not available on this API key: ${msg}`;
    }
    if (code === 403) {
      return "Gemini API key lacks permission for image generation. Check API key settings.";
    }
    return msg;
  } catch {
    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
      return "Gemini free-tier quota exceeded. Upgrade the Google API project to a paid plan.";
    }
    return raw;
  }
}

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

  for (const model of MODELS) {
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
      const raw = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${summarizeError(raw)}`);
    }
  }

  return { ok: false, error: errors.join(" | ") };
}
