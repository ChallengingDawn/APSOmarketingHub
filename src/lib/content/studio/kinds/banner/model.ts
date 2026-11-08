// BANNER - THE STUDIO'S DOCUMENT (08.11.2026; SARCLA: "banners - like the newsletter banner the other session made").
// Pure, shared with the browser and tests/studio-banner.test.ts.
//
// One banner, one set of words, made in several sizes: the shop's full-width band (like the newsletter band), the home
// page slot, a landing hero, a newsletter header, a LinkedIn card and three display ads. Each size has its own room, so
// a size can carry its own shorter words (`own`) over the banner's. The shop's sizes become a paste block for Magento's
// Page Builder; the others a PNG.

import { SHOP_PHOTOS, photoLabel } from "./brand";

export type PresetKey = "band" | "home" | "hero" | "mail" | "card" | "mrec" | "leader" | "sky";
/** The room for each piece of text in a size (characters). 0 = that size has no place for it. */
export type Limits = { eyebrow: number; headline: number; word: number; line: number; button: number };
export type Preset = {
  key: PresetKey; label: string; note: string;
  /** Its name where room is short (the size tiles). */
  short: string;
  /** Its size; h null = full width, as tall as its content (the band). */
  w: number; h: number | null;
  /** html = a paste block for the shop (and a PNG where it has a size); image = a PNG only. */
  out: "html" | "image";
  /** Its headline's word changes and its photos crossfade (only on the shop, while on screen). */
  motion: boolean;
  logo: boolean;
  limits: Limits;
};

export const PRESETS: Preset[] = [
  { key: "band", label: "Shop band", short: "Shop band", note: "Full width on the shop, like the newsletter band - stacks on phones", w: 1150, h: null, out: "html", motion: true, logo: false, limits: { eyebrow: 28, headline: 60, word: 30, line: 220, button: 24 } },
  { key: "home", label: "Home slot", short: "Home slot", note: "The home page's campaign slot", w: 756, h: 355, out: "html", motion: true, logo: false, limits: { eyebrow: 24, headline: 44, word: 26, line: 120, button: 22 } },
  { key: "hero", label: "Landing hero", short: "Landing hero", note: "The top of a landing page", w: 1092, h: 800, out: "html", motion: true, logo: false, limits: { eyebrow: 28, headline: 60, word: 28, line: 200, button: 24 } },
  { key: "mail", label: "Newsletter header", short: "E-mail header", note: "A picture at the top of an e-mail", w: 600, h: 200, out: "image", motion: false, logo: true, limits: { eyebrow: 24, headline: 42, word: 0, line: 70, button: 0 } },
  { key: "card", label: "LinkedIn card", short: "LinkedIn card", note: "A picture for a post or an event", w: 1200, h: 627, out: "image", motion: false, logo: true, limits: { eyebrow: 28, headline: 60, word: 0, line: 120, button: 22 } },
  { key: "mrec", label: "Display 300×250", short: "300 × 250", note: "Medium rectangle ad", w: 300, h: 250, out: "image", motion: false, logo: true, limits: { eyebrow: 0, headline: 36, word: 0, line: 56, button: 16 } },
  { key: "leader", label: "Display 728×90", short: "728 × 90", note: "Leaderboard ad", w: 728, h: 90, out: "image", motion: false, logo: true, limits: { eyebrow: 0, headline: 40, word: 0, line: 0, button: 16 } },
  { key: "sky", label: "Display 160×600", short: "160 × 600", note: "Skyscraper ad", w: 160, h: 600, out: "image", motion: false, logo: true, limits: { eyebrow: 18, headline: 40, word: 0, line: 70, button: 14 } },
];
export const PRESET: Record<PresetKey, Preset> = Object.fromEntries(PRESETS.map((p) => [p.key, p])) as Record<PresetKey, Preset>;
export const isPreset = (k: unknown): k is PresetKey => typeof k === "string" && k in PRESET;
export const sizeLabel = (p: Preset) => (p.h ? `${p.w} × ${p.h}` : `up to ${p.w} wide`);

/** The backgrounds - the newsletter band's (newsletter_block.py THEMES) and plain white. */
export type ThemeKey = "pale" | "white" | "grey" | "sand" | "petrol" | "ink" | "clouds";
export type Theme = { name: string; bg: string; fg: string; mut: string; acc: string; eb: string; fb: string; card: string; dark: boolean };
export const THEMES: Record<ThemeKey, Theme> = {
  pale: { name: "Pale petrol", bg: "#e6eef2", fg: "#1d2326", mut: "#4a5257", acc: "#274e64", eb: "#4a5257", fb: "#c9d7df", card: "#e9ebed", dark: false },
  white: { name: "White", bg: "#ffffff", fg: "#1d2326", mut: "#4a5257", acc: "#274e64", eb: "#4a5257", fb: "#d3dbe0", card: "#eef1f3", dark: false },
  grey: { name: "Light grey", bg: "#eef1f3", fg: "#1d2326", mut: "#4a5257", acc: "#274e64", eb: "#4a5257", fb: "#d3dbe0", card: "#e2e6e9", dark: false },
  sand: { name: "Sand", bg: "#f3eee6", fg: "#1d2326", mut: "#4f4a43", acc: "#274e64", eb: "#5c564e", fb: "#ddd3c4", card: "#e9e3d9", dark: false },
  petrol: { name: "Petrol", bg: "#274e64", fg: "#ffffff", mut: "#cddbe3", acc: "#ffffff", eb: "#b9cfdb", fb: "#274e64", card: "#1f4052", dark: true },
  ink: { name: "Deep ink", bg: "#1d2326", fg: "#ffffff", mut: "#b8c0c5", acc: "#ffffff", eb: "#9aa4aa", fb: "#1d2326", card: "#2a3236", dark: true },
  clouds: {
    name: "Soft clouds", bg: "radial-gradient(42% 95% at 8% 15%,rgba(39,78,100,.16),transparent 70%),radial-gradient(38% 90% at 92% 85%,rgba(216,9,1,.10),transparent 70%),#f7f8f9",
    fg: "#1d2326", mut: "#4a5257", acc: "#274e64", eb: "#4a5257", fb: "#d3dbe0", card: "#e9ebed", dark: false,
  },
};
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const isTheme = (k: unknown): k is ThemeKey => typeof k === "string" && k in THEMES;

export type Picture = { url: string; alt: string; label: string };
/** Words one size carries instead of the banner's (empty = the banner's). */
export type OwnWords = { eyebrow: string; headline: string; line: string; button: string };

export type BannerDoc = {
  v: 2;
  /** The main size; `sizes` are the others made with it. */
  format: PresetKey;
  sizes: PresetKey[];
  content: {
    eyebrow: string;
    /** The fixed start of the headline; with rotating words it reads "<headline> <word>" ("Want to know more about" + "sealing technology?"). */
    headline: string;
    rotatingWords: string[];
    line: string;
    button: { label: string; url: string };
    /** The card's picture; with `photos` (two or more) the card crossfades them, in step with the words. */
    image: Picture;
    photos: Picture[];
  };
  own: Partial<Record<PresetKey, OwnWords>>;
  theme: ThemeKey;
  language: string;
  notes: string;
};

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const pic = (v: unknown): Picture => {
  const o = isObj(v) ? v : {};
  return { url: str(o.url, 1000), alt: str(o.alt, 300), label: str(o.label, 80) };
};

/** A new banner: the band of the shop, in pale petrol, with the shop's first photo - the newsletter band's look. */
export function emptyBanner(language?: string | null): BannerDoc {
  const lang = (language || "EN").toUpperCase();
  const first = SHOP_PHOTOS[0];
  return {
    v: 2, format: "band", sizes: [],
    content: {
      eyebrow: "", headline: "", rotatingWords: [], line: "", button: { label: "", url: "" },
      image: { url: first.url, alt: "", label: photoLabel(first, lang) }, photos: [],
    },
    own: {}, theme: "pale", language: lang, notes: "",
  };
}

/**
 * Any stored banner as a whole one. The studio's saves set a removed key to null (studio/doc.ts), the first shape held
 * only notes, and a model's answer may miss fields - none of that may break a render.
 */
export function normalizeBanner(raw: unknown): BannerDoc {
  const d = isObj(raw) ? raw : {};
  const base = emptyBanner(typeof d.language === "string" ? d.language : undefined);
  const c = isObj(d.content) ? d.content : {};
  const b = isObj(c.button) ? c.button : {};
  const own: BannerDoc["own"] = {};
  if (isObj(d.own)) {
    for (const [k, v] of Object.entries(d.own)) {
      if (!isPreset(k) || !isObj(v)) continue;
      own[k] = { eyebrow: str(v.eyebrow, 200), headline: str(v.headline, 300), line: str(v.line, 600), button: str(v.button, 120) };
    }
  }
  const format = isPreset(d.format) ? d.format : base.format;
  return {
    v: 2,
    format,
    sizes: Array.isArray(d.sizes) ? [...new Set(d.sizes.filter(isPreset))].filter((k) => k !== format) : [],
    content: {
      eyebrow: str(c.eyebrow, 200),
      headline: str(c.headline, 300),
      rotatingWords: Array.isArray(c.rotatingWords) ? c.rotatingWords.map((w) => str(w, 120)).filter((w) => w.trim()).slice(0, 8) : [],
      line: str(c.line, 600),
      button: { label: str(b.label, 120), url: str(b.url, 1000) },
      image: c.image === undefined ? base.content.image : pic(c.image),
      photos: Array.isArray(c.photos) ? c.photos.map(pic).filter((p) => p.url).slice(0, 8) : [],
    },
    own,
    theme: isTheme(d.theme) ? d.theme : base.theme,
    language: typeof d.language === "string" && d.language ? d.language.toUpperCase().slice(0, 5) : base.language,
    notes: str(d.notes, 20000),
  };
}

/** Every size this banner is made in, the main one first. */
export const sizesOf = (d: BannerDoc): PresetKey[] => [d.format, ...d.sizes.filter((k) => k !== d.format)];

export type Words = { eyebrow: string; headline: string; words: string[]; line: string; button: string; url: string };

/** The words a size shows: its own where it has them, else the banner's; nothing where the size has no room for it. */
export function wordsFor(d: BannerDoc, key: PresetKey): Words {
  const p = PRESET[key];
  const o = d.own[key];
  const pick = (own: string | undefined, master: string) => (own && own.trim() ? own : master).trim();
  const words = p.limits.word ? d.content.rotatingWords.map((w) => w.trim()).filter(Boolean) : [];
  // a size without room for the changing word shows the headline with the first word, as one line
  const headline = pick(o?.headline, d.content.headline);
  const staticHead = !p.limits.word && d.content.rotatingWords[0] && !(o?.headline && o.headline.trim())
    ? `${headline} ${d.content.rotatingWords[0].trim()}`.trim()
    : headline;
  return {
    eyebrow: p.limits.eyebrow ? pick(o?.eyebrow, d.content.eyebrow) : "",
    headline: staticHead,
    words,
    line: p.limits.line ? pick(o?.line, d.content.line) : "",
    button: p.limits.button ? pick(o?.button, d.content.button.label) : "",
    url: d.content.button.url.trim(),
  };
}

export type Over = { field: keyof Limits; size: PresetKey; by: number };
/** Where a size's words are longer than its room. */
export function overLimits(d: BannerDoc, key: PresetKey): Over[] {
  const p = PRESET[key];
  const w = wordsFor(d, key);
  const out: Over[] = [];
  const check = (field: keyof Limits, text: string) => {
    const max = p.limits[field];
    if (max && text.length > max) out.push({ field, size: key, by: text.length - max });
  };
  check("eyebrow", w.eyebrow);
  check("headline", w.headline);
  for (const x of w.words) check("word", x);
  check("line", w.line);
  check("button", w.button);
  return out;
}

/** The banner's words as text - for the versions, the library and the search. */
export function bannerText(doc: unknown): string {
  const d = normalizeBanner(doc);
  const c = d.content;
  const lines = [
    c.eyebrow,
    [c.headline, c.rotatingWords.length ? `[${c.rotatingWords.join(" / ")}]` : ""].filter(Boolean).join(" "),
    c.line,
    c.button.label ? `${c.button.label}${c.button.url ? ` -> ${c.button.url}` : ""}` : "",
  ].filter((x) => x.trim());
  for (const [k, o] of Object.entries(d.own)) {
    const own = [o?.eyebrow, o?.headline, o?.line, o?.button].filter((x) => x && x.trim());
    if (own.length) lines.push(`${PRESET[k as PresetKey].label}: ${own.join(" | ")}`);
  }
  if (d.notes.trim()) lines.push("", d.notes.trim());
  return lines.join("\n");
}
