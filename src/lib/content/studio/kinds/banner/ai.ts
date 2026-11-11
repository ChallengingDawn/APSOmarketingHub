// BANNER - WHAT THE AI IS ASKED AND HOW ITS ANSWER IS KEPT (08.11.2026). Pure: tests/studio-banner.test.ts.
// The prompts and the call live in server.ts; here the answer's shape and the cleaning, so a model that runs long or
// answers for a size the banner is not made in cannot break the banner.

import { PRESET, roomiest, sizesOf, type BannerDoc, type OwnWords, type PresetKey } from "./model";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").replace(/^["'“”„«»]+|["'“”„«»]+$/g, "").trim().slice(0, max) : "");
// an answer a little over its room is kept (the studio shows it in red); one far over is cut
const room = (limit: number) => Math.max(8, Math.ceil(limit * 1.5));

export const COPY_SCHEMA = {
  type: "object",
  properties: {
    eyebrow: { type: "string", description: "Two to four words over the headline." },
    headline: { type: "string", description: "The headline. With changing words: only its fixed start, which each word completes." },
    rotatingWords: { type: "array", items: { type: "string" }, description: "Empty, or 3 to 6 endings of the headline, each completing it." },
    line: { type: "string", description: "One sentence of substance." },
    button: { type: "string", description: "The button: one to three words, an action." },
    sizes: {
      type: "array",
      description: "Shorter words for a size whose room is smaller - only the sizes listed in the question, only where needed.",
      items: {
        type: "object",
        properties: {
          size: { type: "string", enum: Object.keys(PRESET) },
          eyebrow: { type: "string" }, headline: { type: "string" }, line: { type: "string" }, button: { type: "string" },
        },
        required: ["size", "eyebrow", "headline", "line", "button"],
        additionalProperties: false,
      },
    },
  },
  required: ["eyebrow", "headline", "rotatingWords", "line", "button", "sizes"],
  additionalProperties: false,
} as const;

export type CopyAnswer = {
  content: { eyebrow: string; headline: string; rotatingWords: string[]; line: string; button: string }; own: Partial<Record<PresetKey, OwnWords>>;
  /** cv16: what the shop's word rules left out of the answer (./guard.ts) - said in the studio */
  said?: string[];
};

/** The answer as the banner can take it: the roomiest place's room, own words only for this banner's places and only where they differ. */
export function cleanCopy(raw: unknown, docRaw: BannerDoc): CopyAnswer {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const main = PRESET[roomiest(docRaw)].limits;
  const content = {
    eyebrow: str(r.eyebrow, room(main.eyebrow || 28)),
    headline: str(r.headline, room(main.headline)),
    rotatingWords: Array.isArray(r.rotatingWords) ? r.rotatingWords.map((w) => str(w, room(main.word || 30))).filter(Boolean).slice(0, 6) : [],
    line: str(r.line, room(main.line || 200)),
    button: str(r.button, room(main.button || 24)),
  };
  // one changing word is no change: it becomes part of the headline
  if (content.rotatingWords.length === 1) { content.headline = `${content.headline} ${content.rotatingWords[0]}`.trim(); content.rotatingWords = []; }
  const sizes = new Set(sizesOf(docRaw));
  const own: CopyAnswer["own"] = {};
  for (const x of Array.isArray(r.sizes) ? r.sizes : []) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const key = o.size as PresetKey;
    if (!PRESET[key] || !sizes.has(key)) continue;
    const l = PRESET[key].limits;
    const pick = (v: unknown, limit: number, master: string) => {
      const t = limit ? str(v, room(limit)) : "";
      return t && t !== master ? t : "";
    };
    const w: OwnWords = {
      eyebrow: pick(o.eyebrow, l.eyebrow, content.eyebrow), headline: pick(o.headline, l.headline, content.headline),
      line: pick(o.line, l.line, content.line), button: pick(o.button, l.button, content.button),
    };
    if (w.eyebrow || w.headline || w.line || w.button) own[key] = w;
  }
  return { content, own };
}

export const VARIANTS_SCHEMA = {
  type: "object",
  properties: {
    headlines: {
      type: "array",
      description: "Exactly three headlines, each from a different angle.",
      items: {
        type: "object",
        properties: { headline: { type: "string" }, angle: { type: "string", description: "The angle in three to six words." } },
        required: ["headline", "angle"],
        additionalProperties: false,
      },
    },
  },
  required: ["headlines"],
  additionalProperties: false,
} as const;

export type Variant = { headline: string; angle: string };
export function cleanVariants(raw: unknown, d: BannerDoc): { headlines: Variant[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const max = room(PRESET[roomiest(d)].limits.headline);
  const seen = new Set<string>();
  const headlines = (Array.isArray(r.headlines) ? r.headlines : []).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { headline: str(o.headline, max), angle: str(o.angle, 80) };
  }).filter((v) => v.headline && !seen.has(v.headline.toLowerCase()) && seen.add(v.headline.toLowerCase())).slice(0, 3);
  return { headlines };
}

/** The sizes and their room, as the model reads them. */
export function sizesBrief(d: BannerDoc): string {
  return sizesOf(d).map((k) => {
    const p = PRESET[k];
    const l = p.limits;
    const parts = [l.eyebrow ? `eyebrow ${l.eyebrow}` : "no eyebrow", `headline ${l.headline}`, l.word ? `changing words ${l.word} each` : "no changing words", l.line ? `line ${l.line}` : "no line", l.button ? `button ${l.button}` : "no button"];
    return `- ${k} (${p.label}${p.h ? `, ${p.w}x${p.h}` : ", full width"}${k === roomiest(d) ? ", the most room - the banner's own words" : ""}): ${parts.join(", ")} characters`;
  }).join("\n");
}

/** The parts of the banner whose words the AI writes. */
export type WordPart = "eyebrow" | "headline" | "line" | "button";
const EMPTY_OWN: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };

/**
 * The AI's words laid on the banner (09.11.2026; the flow standard: a part's ask changes that part only): all of them,
 * or - for one part - that part's words alone (the banner's and each place's own), everything else as it is now. The
 * headline brings its changing endings with it.
 */
export function applyCopy(d: BannerDoc, a: CopyAnswer, part: string | null): BannerDoc {
  const f = part === "eyebrow" || part === "headline" || part === "line" || part === "button" ? (part as WordPart) : null;
  if (!f) {
    return {
      ...d,
      content: { ...d.content, eyebrow: a.content.eyebrow, headline: a.content.headline, rotatingWords: a.content.rotatingWords, line: a.content.line, button: { ...d.content.button, label: a.content.button } },
      own: a.own,
    };
  }
  const content = f === "button"
    ? { ...d.content, button: { ...d.content.button, label: a.content.button } }
    : { ...d.content, [f]: a.content[f], ...(f === "headline" ? { rotatingWords: a.content.rotatingWords } : {}) };
  const own: BannerDoc["own"] = {};
  const keys = new Set([...Object.keys(d.own), ...Object.keys(a.own)] as PresetKey[]);
  for (const k of keys) {
    const next = { ...(d.own[k] ?? EMPTY_OWN), [f]: a.own[k]?.[f] ?? "" };
    if (next.eyebrow || next.headline || next.line || next.button) own[k] = next;
  }
  return { ...d, content, own };
}

/** One place's own words from the AI's answer (09.11.2026: "Shorter words for this place"), everything else as it is now. */
export function applyPlace(d: BannerDoc, a: CopyAnswer, k: PresetKey): BannerDoc {
  const w = a.own[k];
  if (!w) return d;
  return { ...d, own: { ...d.own, [k]: w } };
}
