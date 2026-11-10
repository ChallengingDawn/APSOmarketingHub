// BANNER - THE STUDIO'S DOCUMENT (08.11.2026; SARCLA: "banners - like the newsletter banner the other session made").
// Pure, shared with the browser and tests/studio-banner.test.ts.
//
// One banner, one set of words, used in several PLACES at once (SARCLA 08.11.2026: "the banner can be in multiple
// places"): the shop's home band, a category band, a page hero, the home slot, a newsletter header, a LinkedIn card,
// Instagram square and portrait, a story, three display ads. Each place has its own room, so it can carry its own
// shorter words (`own`) over the banner's; each gives its own output - the shop's places a paste block for Magento's
// Page Builder, the others a PNG at their real size. Stored as `format` (the first place) + `sizes` (the others), the
// shape the first studio saved, so every banner made this morning opens as it was.

import { SHOP_PHOTOS, photoLabel } from "./brand";

export type PresetKey = "slider" | "band" | "cat" | "hero" | "home" | "mail" | "card" | "square" | "portrait" | "story" | "mrec" | "leader" | "sky";
/** The room for each piece of text in a size (characters). 0 = that size has no place for it. */
export type Limits = { eyebrow: number; headline: number; word: number; line: number; button: number };
/** Where a place is: the shop, an e-mail, social media, ads. */
export type PlaceGroup = "shop" | "mail" | "social" | "ads";
export const GROUPS: { key: PlaceGroup; label: string }[] = [
  { key: "shop", label: "On the shop" }, { key: "mail", label: "In an e-mail" }, { key: "social", label: "On social media" }, { key: "ads", label: "Display ads" },
];
export type Preset = {
  key: PresetKey; label: string; note: string;
  /** Its name where room is short (the place tiles). */
  short: string;
  group: PlaceGroup;
  /** Its size; h null = full width, as tall as its content (the bands). */
  w: number; h: number | null;
  /** html = a paste block for the shop (and a PNG where it has a size); image = a PNG only. */
  out: "html" | "image";
  /** Its headline's word changes and its photos crossfade (only on the shop, while on screen). */
  motion: boolean;
  logo: boolean;
  limits: Limits;
};

export const PRESETS: Preset[] = [
  // the shop's own banner (read off the live home page 10.11.2026: its slider's five slides are 1920 x 600 pictures, each
  // with a 1080 x 900 one for phones) - the home page's slider and the top of a page; on a page it goes in as the module
  // library's campaign banner, its picture this banner's (SARCLA 10.11.2026 point 11: "push the banner directly on a page")
  { key: "slider", group: "shop", label: "Shop banner", short: "Shop banner", note: "The shop's own banner: the home page's slider or the top of a page - 1920 × 600, and 1080 × 900 on phones", w: 1920, h: 600, out: "image", motion: false, logo: false, limits: { eyebrow: 30, headline: 64, word: 0, line: 150, button: 24 } },
  { key: "band", group: "shop", label: "Home band", short: "Home band", note: "Full width on the home page, like the newsletter band - stacks on phones", w: 1150, h: null, out: "html", motion: true, logo: false, limits: { eyebrow: 28, headline: 60, word: 30, line: 220, button: 24 } },
  { key: "cat", group: "shop", label: "Category band", short: "Category band", note: "A slim band over a category's products - stacks on phones", w: 1150, h: null, out: "html", motion: true, logo: false, limits: { eyebrow: 24, headline: 50, word: 26, line: 120, button: 22 } },
  { key: "hero", group: "shop", label: "Page hero", short: "Page hero", note: "The top of a landing page", w: 1092, h: 800, out: "html", motion: true, logo: false, limits: { eyebrow: 28, headline: 60, word: 28, line: 200, button: 24 } },
  { key: "home", group: "shop", label: "Home slot", short: "Home slot", note: "The home page's campaign slot", w: 756, h: 355, out: "html", motion: true, logo: false, limits: { eyebrow: 24, headline: 44, word: 26, line: 120, button: 22 } },
  { key: "mail", group: "mail", label: "Newsletter header", short: "Newsletter", note: "A picture at the top of an e-mail", w: 600, h: 200, out: "image", motion: false, logo: true, limits: { eyebrow: 24, headline: 42, word: 0, line: 70, button: 0 } },
  { key: "card", group: "social", label: "LinkedIn card", short: "LinkedIn card", note: "A picture for a post or an event", w: 1200, h: 627, out: "image", motion: false, logo: true, limits: { eyebrow: 28, headline: 60, word: 0, line: 120, button: 22 } },
  { key: "square", group: "social", label: "Instagram square", short: "Square", note: "A feed post on Instagram or LinkedIn", w: 1080, h: 1080, out: "image", motion: false, logo: true, limits: { eyebrow: 24, headline: 44, word: 0, line: 90, button: 20 } },
  { key: "portrait", group: "social", label: "Instagram portrait", short: "Portrait", note: "The tall feed post - the most room on a phone", w: 1080, h: 1350, out: "image", motion: false, logo: true, limits: { eyebrow: 24, headline: 52, word: 0, line: 110, button: 20 } },
  { key: "story", group: "social", label: "Story", short: "Story", note: "Instagram and LinkedIn stories - the words stay clear of the app's bars", w: 1080, h: 1920, out: "image", motion: false, logo: true, limits: { eyebrow: 24, headline: 48, word: 0, line: 100, button: 20 } },
  { key: "mrec", group: "ads", label: "Display 300×250", short: "300 × 250", note: "Medium rectangle ad", w: 300, h: 250, out: "image", motion: false, logo: true, limits: { eyebrow: 0, headline: 36, word: 0, line: 56, button: 16 } },
  { key: "leader", group: "ads", label: "Display 728×90", short: "728 × 90", note: "Leaderboard ad", w: 728, h: 90, out: "image", motion: false, logo: true, limits: { eyebrow: 0, headline: 40, word: 0, line: 0, button: 16 } },
  { key: "sky", group: "ads", label: "Display 160×600", short: "160 × 600", note: "Skyscraper ad", w: 160, h: 600, out: "image", motion: false, logo: true, limits: { eyebrow: 18, headline: 40, word: 0, line: 70, button: 14 } },
];
/** A place with a second picture for phones (the shop's slider: 1920 x 600, and 1080 x 900 on phones). */
export const PHONE: Partial<Record<PresetKey, { w: number; h: number }>> = { slider: { w: 1080, h: 900 } };
export const hasPhone = (k: PresetKey) => !!PHONE[k];
export const PRESET: Record<PresetKey, Preset> = Object.fromEntries(PRESETS.map((p) => [p.key, p])) as Record<PresetKey, Preset>;
export const isPreset = (k: unknown): k is PresetKey => typeof k === "string" && k in PRESET;
export const sizeLabel = (p: Preset) => (p.h ? `${p.w} × ${p.h}` : `up to ${p.w} wide`);
/** The full-width places (no fixed height): drawn as a band, never a PNG. */
export const isBand = (k: PresetKey) => PRESET[k].h === null;
/** The places a banner can be put into a page with (the shop's own). */
export const PAGE_PLACES: PresetKey[] = ["band", "cat", "hero", "home"];
/** The place a banner goes onto a shop page as (the module library's campaign banner, as one picture): the shop's own size. */
export const ON_PAGE: PresetKey = "slider";

/** The backgrounds - the newsletter band's (newsletter_block.py THEMES) and plain white. */
export type ThemeKey = "pale" | "white" | "grey" | "sand" | "petrol" | "ink" | "clouds" | "red";
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
  red: { name: "Red", bg: "#d80901", fg: "#ffffff", mut: "#ffffff", acc: "#ffffff", eb: "#ffffff", fb: "#d80901", card: "#b00700", dark: true },
};
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const isTheme = (k: unknown): k is ThemeKey => typeof k === "string" && k in THEMES;

/** A picture of the banner. `fit`: a scene photo fills its frame ("cover"); a product photo of the shop (the part on
 * white) stands free in it ("product") - on a light ground as it is, on a dark one on a light disc. */
export type Picture = { url: string; alt: string; label: string; fit?: "cover" | "product" };

/* ── its design (Content v7, SARCLA 10.11.2026 point 11: "improve a lot the banner page") ── */

/**
 * The finished designs a banner takes - each modelled on one of the shop's own best banners, and drawn the same way in
 * every place (the shop banner, the bands, social media, e-mail, ads): its ground, its type, its button, how the picture
 * stands. The colours each may take are its `themes` (the first is its own). "band" is the look every banner had before.
 */
export type LookKey = "petrol" | "light" | "red" | "campaign" | "photo" | "band";
export type Look = { key: LookKey; name: string; note: string; themes: ThemeKey[]; from: string };
export const LOOKS: Look[] = [
  { key: "petrol", name: "Petrol", note: "Petrol, white words, the red button, the product on the right", themes: ["petrol", "ink"], from: "the shop's Evolast FFKM slide" },
  { key: "light", name: "Light photo", note: "A bright photo coming in from the right, the headline in red", themes: ["white", "grey", "pale", "sand"], from: "the shop's O-ring guide slide" },
  { key: "red", name: "Red block", note: "A red block on light grey, white words, a white button", themes: ["grey", "white"], from: "the shop's Variety Series slide" },
  { key: "campaign", name: "Campaign", note: "Light grey, a black headline with a word in red, the product standing free", themes: ["grey", "white", "sand"], from: "the Black Friday hero" },
  { key: "photo", name: "Photo behind", note: "The photo across the whole banner, the words on a dark veil", themes: ["ink", "petrol"], from: "" },
  { key: "band", name: "Newsletter band", note: "Pale petrol, the photo in a card with its label", themes: ["pale", "white", "grey", "sand", "petrol", "ink", "clouds"], from: "the newsletter band" },
];
export const LOOK: Record<LookKey, Look> = Object.fromEntries(LOOKS.map((l) => [l.key, l])) as Record<LookKey, Look>;
export const isLook = (k: unknown): k is LookKey => typeof k === "string" && k in LOOK;
/** The colour a look's headline takes, unless one is picked ("auto"). */
export type HeadColor = "auto" | "red" | "petrol" | "ink" | "white";
export const HEAD_COLORS: { key: HeadColor; label: string; hex: string }[] = [
  { key: "auto", label: "The design's", hex: "" }, { key: "red", label: "Red", hex: "#d80901" }, { key: "petrol", label: "Petrol", hex: "#274e64" },
  { key: "ink", label: "Black", hex: "#1d2326" }, { key: "white", label: "White", hex: "#ffffff" },
];
const isHeadColor = (k: unknown): k is HeadColor => HEAD_COLORS.some((c) => c.key === k);
/** The colour a look takes: the one kept when the look allows it, else the look's own. */
export const themeFor = (look: LookKey, theme: ThemeKey): ThemeKey => (LOOK[look].themes.includes(theme) ? theme : LOOK[look].themes[0]);
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
  /** its design (LOOKS); a banner made before 10.11.2026 has "band" */
  look: LookKey;
  /** the word(s) of the headline drawn in the shop's red (the Black Friday headline's "persönliches") - "" = none */
  accent: string;
  headColor: HeadColor;
  language: string;
  notes: string;
};

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const pic = (v: unknown): Picture => {
  const o = isObj(v) ? v : {};
  return { url: str(o.url, 1000), alt: str(o.alt, 300), label: str(o.label, 80), ...(o.fit === "product" ? { fit: "product" as const } : {}) };
};

/** A new banner (Content v7): the shop's own banner size, in the shop slider's petrol design, with the shop's first photo. */
export function emptyBanner(language?: string | null): BannerDoc {
  const lang = (language || "EN").toUpperCase();
  const first = SHOP_PHOTOS[0];
  return {
    v: 2, format: "slider", sizes: [],
    content: {
      eyebrow: "", headline: "", rotatingWords: [], line: "", button: { label: "", url: "" },
      image: { url: first.url, alt: "", label: photoLabel(first, lang) }, photos: [],
    },
    own: {}, theme: "petrol", look: "petrol", accent: "", headColor: "auto", language: lang, notes: "",
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
  // a banner kept before its design could be picked (it has words or a place, no look) opens as it was: the newsletter band
  const look: LookKey = isLook(d.look) ? d.look : isObj(d.content) || d.v === 1 || typeof d.format === "string" ? "band" : base.look;
  const format = isPreset(d.format) ? d.format : look === "band" ? "band" : base.format;
  const theme: ThemeKey = isTheme(d.theme) ? themeFor(look, d.theme) : look === "band" ? "pale" : LOOK[look].themes[0];
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
    theme,
    look,
    accent: str(d.accent, 60).trim(),
    headColor: isHeadColor(d.headColor) ? d.headColor : "auto",
    language: typeof d.language === "string" && d.language ? d.language.toUpperCase().slice(0, 5) : base.language,
    notes: str(d.notes, 20000),
  };
}

/** Every place this banner is used in, the first one first. */
export const sizesOf = (d: BannerDoc): PresetKey[] => [d.format, ...d.sizes.filter((k) => k !== d.format)];
export const placesOf = sizesOf;

/** The banner with these places, in the order given (one at least - when all would go, it keeps what it had). */
export function withPlaces(d: BannerDoc, keys: PresetKey[]): BannerDoc {
  const list = [...new Set(keys.filter(isPreset))];
  if (!list.length) return d;
  return { ...d, format: list[0], sizes: list.slice(1) };
}

/** A place added or taken out; the order of the others kept. */
export function togglePlace(d: BannerDoc, k: PresetKey): BannerDoc {
  const all = sizesOf(d);
  return withPlaces(d, all.includes(k) ? all.filter((x) => x !== k) : [...all, k]);
}

/** The place with the most room for words - the banner's own words are measured against it. */
export function roomiest(d: BannerDoc): PresetKey {
  const all = sizesOf(d);
  const room = (k: PresetKey) => PRESET[k].limits.headline + PRESET[k].limits.line;
  return all.reduce((best, k) => (room(k) > room(best) ? k : best), all[0]);
}

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
