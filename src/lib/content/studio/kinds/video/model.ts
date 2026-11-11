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
import { DEFAULT_PART, PART, isPart, partOf, type PartKey } from "./parts";
import { neverOnScreen, notInFacts } from "./guard";

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
/** The part a scene showed before the photos (an O-ring, a shaft seal) - kept for films made then; `part` wins. */
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
  /** The real part it shows (parts.ts - the shop's product photo, cut out), where it has no picture. */
  part?: PartKey;
  cut?: Cut;
  /** The APSOparts feature the scene tells (features.ts), and the icon it shows. */
  feature?: FeatureKey;
  icon?: IconKey;
};
export type EndCard = { line: string; cta: string; bars: number; part?: PartKey };

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
  /** How long the film should be, in seconds, when it is made (SARCLA 08.11.2026: "the controls are really hard"). */
  length?: FilmLength;
  /** Its language versions (cv16, 11.11.2026 - as the Page builder's: every language a tab of its own): the same scenes,
   *  pictures and timing, their own words. Keyed by the language's code (DE, FR ...), never the film's own. */
  langs?: Record<string, LangCopy>;
  /** cv17 (SARCLA 11.11.2026: "continue"): each export of a language for the render machine - when, which language, by
   *  whom, the file - newest first (at most MAX_EXPORTS). The library's card says "Exported · DE, FR"; the last step
   *  shows each language's last one. Not part of the film: never in what is exported. */
  exports?: ExportRecord[];
};

/** One export of the film in one language (its file for the render machine). */
export type ExportRecord = {
  /** when (ISO) */
  at: string;
  /** the language exported (EN, DE ...) */
  lang: string;
  /** who exported it (the hub's username) */
  by: string;
  /** the file it was saved as */
  file: string;
  format: Format;
  /** filmPrint() of what was exported - another print now: the film changed since */
  print?: string;
};
export const MAX_EXPORTS = 24;

/** A language version's words: each scene's by its id, the end card's; `from` = the film's own words it was made from. */
export type LangCopy = {
  scenes: Record<string, Partial<Record<CopyKey, string>>>;
  end: { line: string; cta: string };
  /** wordsPrint() of the film's own words when it was translated - another print now: they changed since */
  from?: string;
};

/** The lengths a film is made in, as the studio offers them. */
export const LENGTHS = [15, 20, 30] as const;
export type FilmLength = (typeof LENGTHS)[number];
export const isLength = (v: unknown): v is FilmLength => (LENGTHS as readonly number[]).includes(Number(v));

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
  return {
    id, kind, bars: info.bars.start, copy: {},
    ...(info.shape ? (kind === "product" ? { shape: "oring" as Shape, part: DEFAULT_PART } : { shape: "none" as Shape }) : {}),
    ...(info.icon ? { icon: "check" as IconKey } : {}),
  };
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
    if (info.shape) {
      out.shape = oneOf(s.shape, SHAPES, kind === "product" ? "oring" : "none");
      if (isPart(s.part)) out.part = s.part;
    }
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
    endCard: { line: str(e.line, 120), cta: str(e.cta, 60) || (isObj(d.endCard) ? "" : DEFAULT_CTA), bars: int(e.bars, 2, 3, 2), ...(isPart(e.part) ? { part: e.part } : {}) },
  };
  if (isLength(d.length)) doc.length = Number(d.length) as FilmLength;
  const notes = str(d.notes, 2000);
  if (notes) doc.notes = notes;
  const features = Array.isArray(d.features) ? [...new Set(d.features.filter(isFeature))].slice(0, 6) : [];
  if (features.length) doc.features = features;
  const langs = cleanLangs(d.langs, scenes, doc.language);
  if (langs) doc.langs = langs;
  const recorded = cleanExports(d.exports);
  if (recorded.length) doc.exports = recorded;
  return doc;
}

/** The exports kept (cv17): each with its when, language and file - newest first, at most MAX_EXPORTS. */
export function cleanExports(raw: unknown): ExportRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ExportRecord[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const at = typeof x.at === "string" && Number.isFinite(Date.parse(x.at)) ? x.at.slice(0, 40) : "";
    const lang = typeof x.lang === "string" && /^[a-z]{2}$/i.test(x.lang.trim()) ? x.lang.trim().toUpperCase() : "";
    if (!at || !/^[A-Z]{2}$/.test(lang)) continue;
    const print = str(x.print, 40);
    out.push({ at, lang, by: str(x.by, 255), file: str(x.file, 200), format: oneOf(x.format, FORMATS, "16:9"), ...(print ? { print } : {}) });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_EXPORTS);
}

/** The language versions kept: a code of two letters that is not the film's own, each scene's words by an id the film has. */
function cleanLangs(raw: unknown, scenes: Scene[], main: string): Record<string, LangCopy> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, LangCopy> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 8)) {
    const code = k.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || code === main.toUpperCase().slice(0, 2) || !isObj(v)) continue;
    const vs = isObj(v.scenes) ? v.scenes : {};
    const sc: LangCopy["scenes"] = {};
    for (const s of scenes) {
      const c = isObj(vs[s.id]) ? (vs[s.id] as Record<string, unknown>) : {};
      const copy: Partial<Record<CopyKey, string>> = {};
      for (const f of KIND_INFO[s.kind].fields) { const t = str(c[f.key], Math.max(f.chars * 2, 60)); if (t) copy[f.key] = t; }
      if (Object.keys(copy).length) sc[s.id] = copy;
    }
    const e = isObj(v.end) ? v.end : {};
    out[code] = { scenes: sc, end: { line: str(e.line, 120), cta: str(e.cta, 60) }, ...(typeof v.from === "string" && v.from ? { from: v.from.slice(0, 40) } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}

// ───────────────────────── its languages (cv16) ─────────────────────────

/** The film's languages: its own first, then its versions, in the order they were added. */
export const languagesOf = (doc: Pick<VideoDoc, "language" | "langs">): string[] => [doc.language, ...Object.keys(doc.langs ?? {})];

/**
 * The film in one of its languages: the same scenes, pictures and timing with that version's words - a line it has no
 * words for yet shows the film's own (untranslated() names them). The film's own language, or one it has no version of:
 * the film as it is. Never carries the versions (what plays and what is exported is one language).
 */
export function inLanguage(doc: VideoDoc, lang: string | null | undefined): VideoDoc {
  // cv17: its record of exports is not the film either
  const { langs, exports: _exports, ...rest } = doc;
  const code = String(lang ?? "").toUpperCase();
  const v = code && code !== doc.language ? langs?.[code] : undefined;
  if (!v) return rest;
  const words = (c: Partial<Record<CopyKey, string>> | undefined) => Object.fromEntries(Object.entries(c ?? {}).filter(([, t]) => !!t && !!plain(t)));
  return {
    ...rest, language: code,
    scenes: doc.scenes.map((s) => ({ ...s, copy: { ...s.copy, ...words(v.scenes[s.id]) } })),
    endCard: { ...doc.endCard, line: plain(v.end.line) ? v.end.line : doc.endCard.line, cta: plain(v.end.cta) ? v.end.cta : doc.endCard.cta },
  };
}

/** The film's own words, by id ("s.<scene id>.<field>", "end.line", "end.cta") - what a translation is made from. */
export function wordsToTranslate(doc: Pick<VideoDoc, "scenes" | "endCard">): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const s of doc.scenes) for (const f of KIND_INFO[s.kind].fields) { const t = s.copy[f.key] ?? ""; if (plain(t)) out.push({ id: `s.${s.id}.${f.key}`, text: t }); }
  if (plain(doc.endCard.line)) out.push({ id: "end.line", text: doc.endCard.line });
  if (plain(doc.endCard.cta)) out.push({ id: "end.cta", text: doc.endCard.cta });
  return out;
}

/** A short fingerprint of the film's own words - a version made from other words is out of date. */
export function wordsPrint(doc: Pick<VideoDoc, "scenes" | "endCard">): string {
  const t = JSON.stringify(wordsToTranslate(doc));
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return `${t.length}:${h >>> 0}`;
}

/** The film's own lines a version has no words for yet (their ids). */
export function untranslated(doc: VideoDoc, lang: string): string[] {
  const v = doc.langs?.[lang.toUpperCase()];
  return wordsToTranslate(doc).filter((x) => {
    if (!v) return true;
    if (x.id === "end.line") return !plain(v.end.line);
    if (x.id === "end.cta") return !plain(v.end.cta);
    const [, id, key] = x.id.split(".");
    return !plain(v.scenes[id]?.[key as CopyKey] ?? "");
  }).map((x) => x.id);
}

/** A version's words laid from translated lines by id (an id the film has not is left out). */
export function versionFrom(doc: VideoDoc, items: readonly { id: string; text: string }[], from = wordsPrint(doc)): LangCopy {
  const scenes: LangCopy["scenes"] = {};
  const end = { line: "", cta: "" };
  const ids = new Set(wordsToTranslate(doc).map((x) => x.id));
  for (const it of items) {
    if (!ids.has(it.id) || !plain(it.text)) continue;
    if (it.id === "end.line") end.line = it.text;
    else if (it.id === "end.cta") end.cta = it.text;
    else { const [, id, key] = it.id.split("."); (scenes[id] ??= {})[key as CopyKey] = it.text; }
  }
  return { scenes, end, from };
}

/** One line typed in a language's tab: the version's words (made when the language has none yet). */
export function setLangLine(doc: VideoDoc, lang: string, sceneId: string, key: CopyKey | "line" | "cta", text: string): VideoDoc {
  const code = lang.toUpperCase();
  const cur: LangCopy = doc.langs?.[code] ?? { scenes: {}, end: { line: "", cta: "" } };
  const next: LangCopy = sceneId === "end"
    ? { ...cur, end: { ...cur.end, [key === "cta" ? "cta" : "line"]: text } }
    : { ...cur, scenes: { ...cur.scenes, [sceneId]: { ...cur.scenes[sceneId], [key]: text } } };
  return { ...doc, langs: { ...doc.langs, [code]: next } };
}

/** A language taken out of the film. */
export function dropLanguage(doc: VideoDoc, lang: string): VideoDoc {
  const { [lang.toUpperCase()]: _gone, ...rest } = doc.langs ?? {};
  const { langs: _l, ...d } = doc;
  return Object.keys(rest).length ? { ...d, langs: rest } : d;
}

// ───────────────────────── its exports (cv17) ─────────────────────────

/** A short fingerprint of the film as one language exports it (its scenes, words, pictures, timing, end card, format) -
 *  an export with another print was made before the film changed. */
export function filmPrint(doc: VideoDoc, lang: string | null | undefined, format?: Format): string {
  const f = inLanguage(cleanVideo(doc), lang);
  const t = JSON.stringify({ s: f.scenes, e: f.endCard, f: format ?? f.format, l: f.language });
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return `${t.length}:${h >>> 0}`;
}

/**
 * An export recorded in the document as it is being typed (the studio's own, its spaces kept; the bar's Download too): the
 * newest first, at most MAX_EXPORTS. Anything that is not a film document stays as it is.
 */
export function withExport<T>(raw: T, rec: ExportRecord): T {
  if (!isObj(raw) || raw.v !== 2 || !Array.isArray(raw.scenes)) return raw;
  const one = cleanExports([rec]);
  if (!one.length) return raw;
  return { ...raw, exports: [...one, ...cleanExports(raw.exports)].slice(0, MAX_EXPORTS) } as T;
}

/** Each language's last export, by its code (a language never exported has none). */
export function lastExports(doc: Pick<VideoDoc, "exports">): Record<string, ExportRecord> {
  const out: Record<string, ExportRecord> = {};
  for (const x of cleanExports(doc.exports)) if (!out[x.lang]) out[x.lang] = x;
  return out;
}

/** The languages the film was exported in, the film's own first then its versions' order (one no longer a version last),
 *  with the newest export's when and who - null when it never was. What the library's card says: "Exported · DE, FR". */
export function exportedSummary(doc: Pick<VideoDoc, "exports" | "language" | "langs">): { langs: string[]; at: string; by: string } | null {
  const list = cleanExports(doc.exports);
  if (!list.length) return null;
  const order = languagesOf({ language: doc.language, langs: doc.langs });
  const done = [...new Set(list.map((x) => x.lang))].sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
  return { langs: done, at: list[0].at, by: list[0].by };
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
  return neverOnScreen(t);
}

/** What the film may state (a delivery time, a certificate): the words of the features it tells - ./features.ts. */
export function filmFacts(doc: Pick<VideoDoc, "features" | "scenes">): string {
  const keys = [...new Set([...(doc.features ?? []), ...doc.scenes.map((s) => s.feature).filter((k): k is FeatureKey => !!k)])];
  return keys.map((k) => { const f = FEATURE[k]; return [f.name, f.claim, f.proof, f.figure ?? "", ...f.facts, ...f.numbers].join(" · "); }).join("\n");
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
  const facts = filmFacts(doc);
  doc.scenes.forEach((s, i) => {
    const info = KIND_INFO[s.kind];
    for (const f of info.fields) {
      const v = s.copy[f.key] ?? "";
      const bad = v && forbidden(v);
      if (bad) out.push({ scene: i, field: f.key, level: "stop", text: bad });
      const unsaid = !bad && v ? notInFacts(v, facts) : null;
      if (unsaid) out.push({ scene: i, field: f.key, level: "warn", text: `${unsaid} Say it only when it is so - tie the scene to the feature that states it.` });
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
    const unsaid = !bad && e[k] ? notInFacts(e[k], facts) : null;
    if (unsaid) out.push({ scene: "end", field: k, level: "warn", text: unsaid });
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
  const head = `Video · ${doc.format} · ${languagesOf(doc).join(", ")} · ${seconds(totalFrames(doc))} s (${totalBars(doc)} bars)${doc.features?.length ? ` · about ${doc.features.map((k) => FEATURE[k].name).join(", ")}` : ""}`;
  const lines = doc.scenes.map((s, i) => {
    const words = KIND_INFO[s.kind].fields.map((f) => plain(s.copy[f.key] ?? "")).filter(Boolean).join(" / ");
    const part = partOf(s);
    const pic = s.image ? ` [picture: ${s.image}]` : part ? ` [${PART[part].name}]` : "";
    const feat = s.feature ? ` [feature: ${FEATURE[s.feature].name}]` : "";
    return `${i + 1}. ${KIND_INFO[s.kind].label} · ${s.bars} bar${s.bars > 1 ? "s" : ""} · ${timecode(segs[i].start)} - ${words || "(no words yet)"}${pic}${feat}`;
  });
  const end = segs[segs.length - 1];
  lines.push(`End card · ${end.bars} bars · ${timecode(end.start)} - APSOparts / ${plain(doc.endCard.line) || "(no line)"} / [${plain(doc.endCard.cta) || "no button"}] / ${PART[partOf(doc.endCard) ?? DEFAULT_PART].name}`);
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
export function toSpec(raw: unknown, meta: { title: string; pieceId: number | null; at: string; format?: Format; lang?: string | null }): VideoSpec {
  // one language a file (cv16): that version's words on the film's scenes - the render machine reads it as before
  const doc = inLanguage(cleanVideo(raw), meta.lang);
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
