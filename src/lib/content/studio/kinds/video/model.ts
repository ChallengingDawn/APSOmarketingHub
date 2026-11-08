// VIDEO - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser - tests/studio-video.test.ts.
//
// A film in our motion-graphics style (the Black Friday, compatibility and APSOhub films): a story of scenes, each a
// kind from our library (title, words, claim, steps, product, quote, and for a feature of the shop: feature, big
// number, before/after), each lasting whole bars of the 120 BPM beat, so
// every cut lands on a bar line; then the end card - APSOparts big, a line, the button. One story, three formats
// (16:9, 9:16, 1:1): the format only changes the layout.
//
// The rules it keeps (SARCLA): few words - a line is read in under two seconds; never a discount value; no prices on
// screen; nothing invented (a quote is only words someone gave us); a new scene every bar or two.
// Small on purpose: pictures are addresses, never the picture itself (the hub's firewall refuses a request over 8 KB).
// A film can be made around APSOparts' own features (features.ts - SARCLA 08.11.2026: "you should be able to select a
// feature or key winning point of APSO"): the picked ones are kept in `features`, and a scene that tells one carries it.

import { BAR, BPM, FPS, seconds, timecode } from "./engine/timeline";
import { plain, wordCount } from "./engine/text";
import { FEATURE, isFeature, isIcon, numberAllowed, type FeatureKey, type IconKey } from "./features";

export const FORMATS = ["16:9", "9:16", "1:1"] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_INFO: Record<Format, { w: number; h: number; label: string; use: string }> = {
  "16:9": { w: 1920, h: 1080, label: "16:9", use: "YouTube, the shop, Google Ads" },
  "9:16": { w: 1080, h: 1920, label: "9:16", use: "Stories, Shorts, Reels" },
  "1:1": { w: 1080, h: 1080, label: "1:1", use: "LinkedIn and Instagram feeds" },
};

export const SCENE_KINDS = ["title", "words", "claim", "feature", "number", "compare", "steps", "product", "quote"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];
/** How a scene cuts in on its bar line. "auto" takes turns: whip, sweep, lift. */
export const CUTS = ["auto", "whip", "sweep", "lift"] as const;
export type Cut = (typeof CUTS)[number];
/** A part drawn in the film when there is no picture (an O-ring, a shaft seal). */
export const SHAPES = ["none", "oring", "seal"] as const;
export type Shape = (typeof SHAPES)[number];

export const COPY_KEYS = ["kicker", "line1", "line2", "line3", "sub"] as const;
export type CopyKey = (typeof COPY_KEYS)[number];

export type Scene = {
  id: string;
  kind: SceneKind;
  /** Whole bars of two seconds: 1 to 4. */
  bars: number;
  copy: Partial<Record<CopyKey, string>>;
  /** A picture's address (product and feature scenes): the shop's or the hub's - never the picture itself. */
  image?: string;
  shape?: Shape;
  cut?: Cut;
  /** The APSOparts feature the scene tells (features.ts), and the icon it shows. */
  feature?: FeatureKey;
  icon?: IconKey;
};
export type EndCard = { line: string; cta: string; bars: number };

export type VideoDoc = {
  v: 2;
  format: Format;
  /** EN, DE, FR, IT, NL, PL, ES - the piece's language. */
  language: string;
  bpm: 120;
  scenes: Scene[];
  endCard: EndCard;
  music: "none";
  /** What the team noted for the film (the first studio's one field), kept. */
  notes?: string;
  /** The features the film is made around, in the order picked. */
  features?: FeatureKey[];
};

export const MAX_SCENES = 12;
export const MIN_BARS = 1;
export const MAX_BARS = 4;
export const DEFAULT_CTA = "apsoparts.com";
/** On-screen reading pace: words a second - short kinetic lines read faster than subtitles (~3); plus the entrance. */
export const READ_WPS = 4;

export type FieldDef = { key: CopyKey; label: string; words: number; chars: number; required?: boolean; placeholder?: string };

export const KIND_INFO: Record<SceneKind, { label: string; blurb: string; fields: FieldDef[]; bars: { min: number; max: number; start: number }; image?: boolean; shape?: boolean; icon?: boolean }> = {
  title: {
    label: "Title", blurb: "A headline that rises word by word; a part drops in beside it.",
    fields: [
      { key: "kicker", label: "Small line above", words: 5, chars: 40, placeholder: "APSOparts DirectCUT" },
      { key: "line1", label: "Headline", words: 4, chars: 28, required: true, placeholder: "Cut to *your* size" },
      { key: "line2", label: "Second line", words: 4, chars: 28 },
    ],
    bars: { min: 1, max: 2, start: 2 }, shape: true,
  },
  words: {
    label: "Words", blurb: "Two or three short lines, one slammed in on each beat.",
    fields: [
      { key: "line1", label: "Line 1", words: 3, chars: 22, required: true },
      { key: "line2", label: "Line 2", words: 3, chars: 22 },
      { key: "line3", label: "Line 3", words: 3, chars: 22 },
    ],
    bars: { min: 1, max: 2, start: 1 },
  },
  claim: {
    label: "Claim", blurb: "One statement, swept in, with a line under it.",
    fields: [
      { key: "line1", label: "Statement", words: 6, chars: 44, required: true },
      { key: "sub", label: "Under it", words: 7, chars: 56 },
    ],
    bars: { min: 1, max: 2, start: 2 },
  },
  feature: {
    label: "Feature", blurb: "A feature of the shop: its icon pops in, the claim rises, the proof under it - its picture beside it.",
    fields: [
      { key: "kicker", label: "Feature", words: 4, chars: 32, placeholder: "DirectCUT" },
      { key: "line1", label: "Claim", words: 6, chars: 40, required: true, placeholder: "Cut to *your* size" },
      { key: "sub", label: "Proof", words: 12, chars: 80, placeholder: "Configure plastics online" },
    ],
    bars: { min: 2, max: 3, start: 2 }, image: true, icon: true,
  },
  number: {
    label: "Big number", blurb: "One true figure slams in and counts up; what it means under it.",
    fields: [
      { key: "line1", label: "The figure", words: 2, chars: 10, required: true, placeholder: "48/72h" },
      { key: "line2", label: "What it is", words: 5, chars: 36, required: true, placeholder: "delivery across *Europe*" },
      { key: "sub", label: "Proof", words: 10, chars: 70 },
    ],
    bars: { min: 1, max: 2, start: 2 }, icon: true,
  },
  compare: {
    label: "Before / after", blurb: "The old way, crossed out - then the APSOparts way, in red.",
    fields: [
      { key: "kicker", label: "Heading", words: 4, chars: 32 },
      { key: "line1", label: "Before", words: 6, chars: 40, required: true, placeholder: "A thirty-line reorder" },
      { key: "line2", label: "After", words: 6, chars: 40, required: true, placeholder: "A *two-minute* review" },
    ],
    bars: { min: 2, max: 3, start: 2 },
  },
  steps: {
    label: "Steps", blurb: "Three steps building on the beat.",
    fields: [
      { key: "kicker", label: "Heading", words: 4, chars: 32 },
      { key: "line1", label: "Step 1", words: 4, chars: 30, required: true },
      { key: "line2", label: "Step 2", words: 4, chars: 30, required: true },
      { key: "line3", label: "Step 3", words: 4, chars: 30, required: true },
    ],
    bars: { min: 2, max: 3, start: 2 },
  },
  product: {
    label: "Product", blurb: "A part on its card, arriving like a real object.",
    fields: [
      { key: "kicker", label: "Product", words: 4, chars: 32, required: true, placeholder: "FKM O-ring" },
      { key: "line1", label: "What it does", words: 6, chars: 48 },
    ],
    bars: { min: 1, max: 3, start: 2 }, image: true, shape: true,
  },
  quote: {
    label: "Quote", blurb: "A customer's own words - only words someone gave us.",
    fields: [
      { key: "line1", label: "Their words", words: 16, chars: 120, required: true },
      { key: "sub", label: "Who said it", words: 6, chars: 48, required: true },
    ],
    bars: { min: 2, max: 4, start: 3 },
  },
};

export const END_FIELDS: { key: "line" | "cta"; label: string; words: number; chars: number; placeholder: string }[] = [
  { key: "line", label: "The line", words: 7, chars: 52, placeholder: "Sealing parts, *one click away*." },
  { key: "cta", label: "The button", words: 4, chars: 28, placeholder: DEFAULT_CTA },
];

// ───────────────────────── making and cleaning ─────────────────────────

export const emptyVideo = (o: { language?: string | null; format?: Format } = {}): VideoDoc => ({
  v: 2, format: o.format ?? "16:9", language: (o.language || "EN").toUpperCase().slice(0, 4), bpm: BPM,
  scenes: [], endCard: { line: "", cta: DEFAULT_CTA, bars: 2 }, music: "none",
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : dflt);

/** A picture's address we keep: http(s) or a path on the hub - never data: (it would be the picture itself). */
export function cleanImage(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s.length > 600) return undefined;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/[^\s"'<>]*$/.test(s) && !s.startsWith("//")) return s;
  return undefined;
}

/** A short id for a new scene. */
export const sceneId = () => Math.random().toString(36).slice(2, 10);

export function newScene(kind: SceneKind, id = sceneId()): Scene {
  const info = KIND_INFO[kind];
  return { id, kind, bars: info.bars.start, copy: {}, ...(info.shape ? { shape: kind === "product" ? "oring" : "none" } : {}), ...(info.icon ? { icon: "check" as IconKey } : {}) };
}

/** A scene that tells a feature, written from the feature's own claim and proof (features.ts) - the person's to edit. */
export function featureScene(key: FeatureKey, kind?: SceneKind, id = sceneId()): Scene {
  const f = FEATURE[key];
  const k = kind ?? f.scenes[0];
  const s = newScene(k, id);
  s.feature = key;
  if (KIND_INFO[k].icon) s.icon = f.icon;
  if (k === "feature") s.copy = { kicker: f.name, line1: f.claim, sub: f.proof };
  else if (k === "number") s.copy = { line1: f.numbers[0] ?? "", line2: f.figure ?? f.claim, sub: f.proof };
  else if (k === "claim") s.copy = { line1: f.claim, sub: f.proof };
  else if (k === "words") s.copy = { line1: f.claim };
  else if (k === "compare") s.copy = { kicker: f.name, line1: "", line2: f.claim };
  else if (k === "steps") s.copy = { kicker: f.name };
  else if (k === "product") s.copy = { kicker: f.name, line1: f.claim };
  return s;
}

/** Anything (a stored document, the first studio's {notes}, an AI's answer) as a document the film can play. */
export function cleanVideo(raw: unknown, dflt: { language?: string | null } = {}): VideoDoc {
  const d = isObj(raw) ? raw : {};
  const base = emptyVideo({ language: typeof d.language === "string" && d.language ? d.language : dflt.language });
  const seen = new Set<string>();
  const scenes: Scene[] = (Array.isArray(d.scenes) ? d.scenes : []).filter(isObj).slice(0, MAX_SCENES).map((s, i) => {
    const kind = oneOf(s.kind, SCENE_KINDS, "words");
    const info = KIND_INFO[kind];
    let id = str(s.id, 24).replace(/[^\w-]/g, "") || `s${i + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const c = isObj(s.copy) ? s.copy : {};
    const copy: Partial<Record<CopyKey, string>> = {};
    for (const f of info.fields) {
      const v = str(c[f.key], Math.max(f.chars * 2, 60));
      if (v) copy[f.key] = v;
    }
    const out: Scene = { id, kind, bars: int(s.bars, MIN_BARS, MAX_BARS, info.bars.start), copy };
    if (info.image) { const img = cleanImage(s.image); if (img) out.image = img; }
    if (info.shape) out.shape = oneOf(s.shape, SHAPES, kind === "product" ? "oring" : "none");
    const cut = oneOf(s.cut, CUTS, "auto");
    if (cut !== "auto") out.cut = cut;
    if (isFeature(s.feature)) out.feature = s.feature;
    if (info.icon) out.icon = isIcon(s.icon) ? s.icon : out.feature ? FEATURE[out.feature].icon : "check";
    return out;
  });
  const e = isObj(d.endCard) ? d.endCard : {};
  const doc: VideoDoc = {
    ...base,
    format: oneOf(d.format, FORMATS, "16:9"),
    scenes,
    endCard: { line: str(e.line, 120), cta: str(e.cta, 60) || (isObj(d.endCard) ? "" : DEFAULT_CTA), bars: int(e.bars, 2, 3, 2) },
  };
  const notes = str(d.notes, 2000);
  if (notes) doc.notes = notes;
  const features = Array.isArray(d.features) ? [...new Set(d.features.filter(isFeature))].slice(0, 6) : [];
  if (features.length) doc.features = features;
  return doc;
}

// ───────────────────────── timing ─────────────────────────

export type Segment = {
  /** The scene's place in the story; -1 = the end card. */
  index: number;
  id: string;
  kind: SceneKind | "end";
  /** First frame, always on a bar line. */
  start: number;
  /** Frames it lasts (whole bars). */
  dur: number;
  bars: number;
  /** How it cuts in: "open" for the film's first shot. */
  cut: "open" | "whip" | "sweep" | "lift";
};

const AUTO: ("whip" | "sweep" | "lift")[] = ["whip", "sweep", "lift"];

/** The film's scenes and its end card, each on its bar lines, in order. */
export function segments(doc: Pick<VideoDoc, "scenes" | "endCard">): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  doc.scenes.forEach((s, i) => {
    const bars = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(s.bars) || 1));
    out.push({ index: i, id: s.id, kind: s.kind, start: at, dur: bars * BAR, bars, cut: i === 0 ? "open" : s.cut && s.cut !== "auto" ? s.cut : AUTO[(i - 1) % AUTO.length] });
    at += bars * BAR;
  });
  const eb = Math.max(2, Math.min(3, Math.round(doc.endCard.bars) || 2));
  const n = doc.scenes.length;
  out.push({ index: -1, id: "end", kind: "end", start: at, dur: eb * BAR, bars: eb, cut: n === 0 ? "open" : AUTO[(n - 1) % AUTO.length] });
  return out;
}

export const totalBars = (doc: Pick<VideoDoc, "scenes" | "endCard">) => segments(doc).reduce((n, s) => n + s.bars, 0);
export const totalFrames = (doc: Pick<VideoDoc, "scenes" | "endCard">) => totalBars(doc) * BAR;
/** The segment showing at `frame` (the last one past the end). */
export function segmentAt(segs: Segment[], frame: number): Segment {
  for (const s of segs) if (frame < s.start + s.dur) return s;
  return segs[segs.length - 1];
}

// ───────────────────────── the rules ─────────────────────────

export type Issue = { scene: number | "end" | "film"; field?: string; level: "warn" | "stop"; text: string };

const DISCOUNT = /\d\s*%|%\s*\d|\b\d+([.,]\d+)?\s*(percent|per cent|prozent|pour ?cent|per ?cento|procent|por ?ciento)\b/i;
const PRICE = /(chf|eur|€|\$|£|zł|pln|usd)\s*\d|\d\s*(chf|eur|euro|€|zł|pln|usd|franken|francs?)(?![a-z])/i;

/** Why a line must not be in the film, or null. */
export function forbidden(text: string): string | null {
  const t = plain(text);
  if (DISCOUNT.test(t)) return "Never a discount value in the film.";
  if (PRICE.test(t)) return "No prices on screen - a price is only ever shown blurred.";
  return null;
}

/** Seconds a scene needs to be read: its words at our pace, plus its entrance. */
export function readSeconds(s: Pick<Scene, "kind" | "copy">): number {
  const n = KIND_INFO[s.kind].fields.reduce((k, f) => k + wordCount(s.copy[f.key] ?? ""), 0);
  return n / READ_WPS + 0.3;
}

/** What to look at before the film goes out: "stop" blocks the export, "warn" is advice. */
export function validate(doc: VideoDoc): Issue[] {
  const out: Issue[] = [];
  if (!doc.scenes.length) out.push({ scene: "film", level: "warn", text: "No scenes yet - add one, or let the assistant write the storyboard." });
  doc.scenes.forEach((s, i) => {
    const info = KIND_INFO[s.kind];
    for (const f of info.fields) {
      const v = s.copy[f.key] ?? "";
      const bad = v && forbidden(v);
      if (bad) out.push({ scene: i, field: f.key, level: "stop", text: bad });
      if (f.required && !plain(v)) out.push({ scene: i, field: f.key, level: "warn", text: `${f.label} is empty.` });
      const n = wordCount(v);
      if (n > f.words) out.push({ scene: i, field: f.key, level: "warn", text: `${f.label}: ${n} words - keep it to ${f.words}, it is read in under two seconds.` });
      else if (plain(v).length > f.chars) out.push({ scene: i, field: f.key, level: "warn", text: `${f.label}: long words - it will be set smaller.` });
    }
    if (s.bars > info.bars.max) out.push({ scene: i, level: "warn", text: `${s.bars} bars is long for a ${info.label.toLowerCase()} - a new scene every bar or two keeps it moving.` });
    if (s.bars < info.bars.min) out.push({ scene: i, level: "warn", text: `A ${info.label.toLowerCase()} needs at least ${info.bars.min} bars.` });
    const need = readSeconds(s);
    if (need > (s.bars * BAR) / FPS + 0.01) out.push({ scene: i, level: "warn", text: `Needs about ${Math.ceil(need)} s to read and lasts ${(s.bars * BAR) / FPS} s - cut words or give it a bar more.` });
    if (s.image && !cleanImage(s.image)) out.push({ scene: i, field: "image", level: "stop", text: "A picture's address (https://...), never the picture itself." });
    // a figure on screen is a fact: it must be one the shop already states (features.ts)
    if (s.kind === "number" && plain(s.copy.line1 ?? "") && !numberAllowed(plain(s.copy.line1 ?? ""), s.feature ? [s.feature] : (doc.features ?? []))) {
      out.push({ scene: i, field: "line1", level: "warn", text: s.feature ? `"${plain(s.copy.line1 ?? "")}" is not a figure ${FEATURE[s.feature].name} states - use its own, or check it is true.` : "A figure on screen must be true - tie the scene to a feature, or check where the figure comes from." });
    }
  });
  const e = doc.endCard;
  for (const k of ["line", "cta"] as const) {
    const bad = e[k] && forbidden(e[k]);
    if (bad) out.push({ scene: "end", field: k, level: "stop", text: bad });
  }
  if (!plain(e.cta)) out.push({ scene: "end", field: "cta", level: "warn", text: "The end card has no button." });
  if (wordCount(e.line) > END_FIELDS[0].words) out.push({ scene: "end", field: "line", level: "warn", text: `The line: ${wordCount(e.line)} words - keep it to ${END_FIELDS[0].words}.` });
  const secs = totalFrames(doc) / FPS;
  if (doc.scenes.length && secs > 40) out.push({ scene: "film", level: "warn", text: `${seconds(totalFrames(doc))} s is long for an ad - 15 to 30 s is where they work.` });
  return out;
}

// ───────────────────────── its text ─────────────────────────

/** The script: what the library, the search and the exports read. */
export function videoText(raw: unknown): string {
  const doc = cleanVideo(raw);
  const segs = segments(doc);
  const head = `Video · ${doc.format} · ${doc.language} · ${seconds(totalFrames(doc))} s (${totalBars(doc)} bars)${doc.features?.length ? ` · about ${doc.features.map((k) => FEATURE[k].name).join(", ")}` : ""}`;
  const lines = doc.scenes.map((s, i) => {
    const words = KIND_INFO[s.kind].fields.map((f) => plain(s.copy[f.key] ?? "")).filter(Boolean).join(" / ");
    const pic = s.image ? ` [picture: ${s.image}]` : s.shape && s.shape !== "none" ? ` [${s.shape === "oring" ? "O-ring" : "shaft seal"}]` : "";
    const feat = s.feature ? ` [feature: ${FEATURE[s.feature].name}]` : "";
    return `${i + 1}. ${KIND_INFO[s.kind].label} · ${s.bars} bar${s.bars > 1 ? "s" : ""} · ${timecode(segs[i].start)} - ${words || "(no words yet)"}${pic}${feat}`;
  });
  const end = segs[segs.length - 1];
  lines.push(`End card · ${end.bars} bars · ${timecode(end.start)} - APSOparts / ${plain(doc.endCard.line) || "(no line)"} / [${plain(doc.endCard.cta) || "no button"}]`);
  return [head, ...lines, ...(doc.notes ? ["", `Notes: ${doc.notes}`] : [])].join("\n");
}

// ───────────────────────── for the render machine ─────────────────────────

export const SPEC_KIND = "apsohub-video";
export const SPEC_VERSION = 1;

export type VideoSpec = {
  kind: typeof SPEC_KIND;
  v: typeof SPEC_VERSION;
  title: string;
  pieceId: number | null;
  exportedAt: string;
  fps: number;
  frames: number;
  width: number;
  height: number;
  doc: VideoDoc;
};

/** What "Export for rendering" hands the render machine: the story, cleaned, with its size and length. */
export function toSpec(raw: unknown, meta: { title: string; pieceId: number | null; at: string; format?: Format }): VideoSpec {
  const doc = cleanVideo(raw);
  if (meta.format) doc.format = meta.format;
  const size = FORMAT_INFO[doc.format];
  return { kind: SPEC_KIND, v: SPEC_VERSION, title: meta.title, pieceId: meta.pieceId, exportedAt: meta.at, fps: FPS, frames: totalFrames(doc), width: size.w, height: size.h, doc };
}

/** A spec read back (the render script, the render page): the document inside it, or null. */
export function fromSpec(raw: unknown): VideoSpec | null {
  if (!isObj(raw) || raw.kind !== SPEC_KIND || !isObj(raw.doc)) return null;
  const doc = cleanVideo(raw.doc);
  const size = FORMAT_INFO[doc.format];
  return {
    kind: SPEC_KIND, v: SPEC_VERSION, title: str(raw.title, 200), pieceId: typeof raw.pieceId === "number" ? raw.pieceId : null,
    exportedAt: str(raw.exportedAt, 40), fps: FPS, frames: totalFrames(doc), width: size.w, height: size.h, doc,
  };
}
