import { GoogleGenAI } from "@google/genai";

type ImageResult =
  | { ok: true; dataUrl: string; model: string }
  | { ok: false; error: string };

// Preferred order: Nano Banana Pro (higher quality) -> flash (fallback).
// Users can override entirely by setting GEMINI_IMAGE_MODEL in env —
// that wins and no fallback is attempted so quota/errors are clear.
const DEFAULT_MODELS = [
  "gemini-3-pro-image-preview", // Nano Banana Pro
  "gemini-2.5-pro-image",
  "gemini-2.5-flash-image",
];

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

export type ReferenceImage = { dataUrl: string; note?: string };

/** The model's own picture shapes; a shape it lacks goes to the nearest (4:5 portrait -> 3:4). */
const MODEL_ASPECTS: Record<string, string> = { "1:1": "1:1", "4:5": "3:4", "3:4": "3:4", "2:3": "2:3", "3:2": "3:2", "4:3": "4:3", "16:9": "16:9", "9:16": "9:16", "21:9": "21:9" };

export async function generateApsoImage(
  apiKey: string,
  prompt: string,
  references: ReferenceImage[] = [],
  /** The picture's shape, as a setting - the words alone gave squares (08.11.2026: a "16:9" ask came back 1024 x 1024). */
  opts: { aspect?: string } = {},
): Promise<ImageResult> {
  const ai = new GoogleGenAI({ apiKey });
  const errors: string[] = [];

  const override = process.env.GEMINI_IMAGE_MODEL?.trim();
  const models = override ? [override] : DEFAULT_MODELS;

  // Build multimodal parts — text first, then optional reference images.
  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: prompt }];
  for (const ref of references) {
    // read after the comma, never by a regular expression over the picture: /(.+)$/ over megabytes of base64 (with line
    // breaks, or simply large) ended in "Maximum call stack size exceeded" in generatePicture (09.11.2026)
    const url = ref.dataUrl;
    const comma = url.indexOf(",");
    const head = comma > 5 && url.startsWith("data:") ? url.slice(5, comma) : "";
    if (!head.endsWith(";base64")) continue;
    parts.push({ inlineData: { mimeType: head.slice(0, -";base64".length) || "image/png", data: url.slice(comma + 1).replace(/\s+/g, "") } });
    if (ref.note?.trim()) {
      parts.push({ text: `Reference note: ${ref.note.trim()}` });
    }
  }

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(opts.aspect && MODEL_ASPECTS[opts.aspect]
            ? { imageConfig: { aspectRatio: MODEL_ASPECTS[opts.aspect], ...(model.includes("pro") ? { imageSize: "2K" } : {}) } }
            : {}),
        },
      });
      const responseParts = res.candidates?.[0]?.content?.parts ?? [];
      const found = extractInlineImage(responseParts);
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
