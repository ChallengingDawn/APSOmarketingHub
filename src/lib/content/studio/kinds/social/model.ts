// SOCIAL POST - THE STUDIO'S DOCUMENT (08.11.2026; SARCLA: "social media - improve a lot what we have today").
// Pure, shared with the browser and tests/studio-social.test.ts.
//
// One post, written for each network it goes to: LinkedIn, Instagram, Facebook - each its own text and length, where
// the feed cuts it ("…see more"), whether a link works there, how many hashtags it bears. Its media: one picture from
// the shop, a brand card (a picture made of words and a photo in the shop's look) or a carousel of slides. Nothing is
// posted from the hub: the text and the slides are made ready to copy and post by hand.

import { brandFlags, SHOP_PHOTOS } from "../banner/brand";
import { designText, emptyDesign, isFormat, normalizeDesign, pageIn, pageWords, type FormatKey, type SocialDesign } from "./design";

export const NETWORKS = ["linkedin", "instagram", "facebook"] as const;
export type Network = (typeof NETWORKS)[number];
export const isNetwork = (v: unknown): v is Network => typeof v === "string" && (NETWORKS as readonly string[]).includes(v);

export type NetworkSpec = {
  label: string;
  /** The most the network takes. */
  max: number;
  /** Where the feed cuts the text: after so many characters, or so many lines, whichever comes first. */
  fold: { chars: number; lines: number };
  more: string;
  /** Hashtags: beyond `soup` reads as hashtag soup; `max` is the network's own limit. */
  tags: { soup: number; max: number };
  /** A link in the text can be clicked there. */
  linkWorks: boolean;
};

export const NETWORK: Record<Network, NetworkSpec> = {
  linkedin: { label: "LinkedIn", max: 3000, fold: { chars: 210, lines: 3 }, more: "…see more", tags: { soup: 5, max: 30 }, linkWorks: true },
  instagram: { label: "Instagram", max: 2200, fold: { chars: 125, lines: 2 }, more: "… more", tags: { soup: 12, max: 30 }, linkWorks: false },
  facebook: { label: "Facebook", max: 63206, fold: { chars: 480, lines: 5 }, more: "… See more", tags: { soup: 3, max: 30 }, linkWorks: true },
};

export type Picture = { url: string; alt: string };
export const LAYOUTS = ["cover", "statement", "photo", "list", "end"] as const;
export type SlideLayout = (typeof LAYOUTS)[number];
export const LAYOUT_LABEL: Record<SlideLayout, string> = { cover: "Cover", statement: "Statement", photo: "Photo", list: "List", end: "Last slide" };
export const isLayout = (v: unknown): v is SlideLayout => typeof v === "string" && (LAYOUTS as readonly string[]).includes(v);

export type Slide = { id: string; layout: SlideLayout; eyebrow: string; headline: string; text: string; image: Picture | null };
export type MediaKind = "none" | "image" | "card" | "carousel";
export type SlideSize = "square" | "portrait";
export const SLIDE_SIZE: Record<SlideSize, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square 1080 × 1080" },
  portrait: { w: 1080, h: 1350, label: "Portrait 1080 × 1350" },
};
/** A brand card's size on each network: the link-post shape on LinkedIn and Facebook, the square on Instagram. */
export const CARD_SIZE: Record<Network, { w: number; h: number }> = { linkedin: { w: 1200, h: 627 }, facebook: { w: 1200, h: 630 }, instagram: { w: 1080, h: 1080 } };
export const MAX_SLIDES = 20;

export type NetworkPost = { on: boolean; text: string; tags: boolean };

/** The formats each network takes, the first its usual one (SARCLA 08.11.2026: "multiple formats for publishing"). */
export const NETWORK_FORMATS: Record<Network, FormatKey[]> = {
  linkedin: ["landscape", "square", "portrait"],
  instagram: ["square", "portrait", "story"],
  facebook: ["landscape", "square", "story"],
};

/** Where it went out, and who said so (nothing is posted from the hub - "mark as published"). */
export type Published = { at: string; by: string };
export type SocialDoc = {
  v: 2;
  networks: Record<Network, NetworkPost>;
  /** LinkedIn's first comment - where a link often goes, so the post itself is not pushed down. */
  firstComment: string;
  hashtags: string[];
  media: { kind: MediaKind; image: Picture; card: Slide; slides: Slide[]; size: SlideSize };
  link: { url: string; label: string; inComment: boolean };
  schedule: { date: string; time: string };
  notes: string;
  /** The design: its pages, in every format it goes out in (design.ts). */
  design: SocialDesign;
  /** Per network, the formats it is posted in. */
  formats: Record<Network, FormatKey[]>;
  published: Published | null;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const pic = (v: unknown): Picture | null => {
  if (!isObj(v)) return null;
  const url = str(v.url, 1000).trim();
  return url ? { url, alt: str(v.alt, 400) } : null;
};

export function newSlide(id: string, layout: SlideLayout = "statement", over: Partial<Slide> = {}): Slide {
  return { id, layout, eyebrow: "", headline: "", text: "", image: null, ...over };
}

function slide(v: unknown, i: number): Slide {
  const o = isObj(v) ? v : {};
  return {
    id: str(o.id, 40) || `s${i + 1}`,
    layout: isLayout(o.layout) ? o.layout : "statement",
    eyebrow: str(o.eyebrow, 120),
    headline: str(o.headline, 300),
    text: str(o.text, 1200),
    image: pic(o.image),
  };
}

/** A new post: LinkedIn alone for a LinkedIn post, the three networks for a social post; its date is the to-do's. */
export function emptySocial(o: { contentType?: string | null; dueDate?: string | null } = {}): SocialDoc {
  const all = o.contentType !== "linkedin-post";
  return {
    v: 2,
    networks: {
      linkedin: { on: true, text: "", tags: true },
      instagram: { on: all, text: "", tags: true },
      facebook: { on: all, text: "", tags: false },
    },
    firstComment: "",
    hashtags: [],
    media: {
      kind: "none",
      image: { url: "", alt: "" },
      card: newSlide("card", "cover", { image: { url: SHOP_PHOTOS[0].url, alt: "" } }),
      slides: [],
      size: "square",
    },
    link: { url: "", label: "", inComment: false },
    schedule: { date: /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate ?? "") ? (o.dueDate as string) : "", time: "" },
    notes: "",
    design: emptyDesign(),
    formats: { linkedin: ["square"], instagram: ["square"], facebook: ["square"] },
    published: null,
  };
}

/** Any stored post as a whole one (the first shape held notes only; saves set a removed key to null). */
export function normalizeSocial(raw: unknown): SocialDoc {
  const d = isObj(raw) ? raw : {};
  const base = emptySocial();
  const n = isObj(d.networks) ? d.networks : {};
  const networks = {} as SocialDoc["networks"];
  for (const k of NETWORKS) {
    const x = isObj(n[k]) ? n[k] : {};
    networks[k] = { on: typeof x.on === "boolean" ? x.on : base.networks[k].on, text: str(x.text, NETWORK[k].max + 2000), tags: typeof x.tags === "boolean" ? x.tags : base.networks[k].tags };
  }
  if (!NETWORKS.some((k) => networks[k].on)) networks.linkedin.on = true;
  const m = isObj(d.media) ? d.media : {};
  const l = isObj(d.link) ? d.link : {};
  const s = isObj(d.schedule) ? d.schedule : {};
  const kind = m.kind === "image" || m.kind === "card" || m.kind === "carousel" ? m.kind : "none";
  return {
    v: 2,
    networks,
    firstComment: str(d.firstComment, 1250),
    hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(cleanTag).filter((t, i, a) => t && a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i).slice(0, 30) : [],
    media: {
      kind,
      image: pic(m.image) ?? { url: "", alt: isObj(m.image) ? str(m.image.alt, 400) : "" },
      card: isObj(m.card) ? slide(m.card, 0) : base.media.card,
      slides: Array.isArray(m.slides) ? m.slides.slice(0, MAX_SLIDES).map(slide) : [],
      size: m.size === "portrait" ? "portrait" : "square",
    },
    link: { url: str(l.url, 1000).trim(), label: str(l.label, 120), inComment: l.inComment === true },
    schedule: { date: /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)) ? str(s.date) : "", time: /^\d{2}:\d{2}$/.test(str(s.time)) ? str(s.time) : "" },
    notes: str(d.notes, 20000),
    ...designParts(d),
  };
}

/** The design, the formats per network (each one the design has), and whether it went out. */
function designParts(d: Record<string, unknown>): Pick<SocialDoc, "design" | "formats" | "published"> {
  const design = normalizeDesign(d.design);
  const f = isObj(d.formats) ? d.formats : {};
  const formats = {} as SocialDoc["formats"];
  for (const n of NETWORKS) {
    const list = Array.isArray(f[n]) ? [...new Set((f[n] as unknown[]).filter(isFormat))].filter((x) => NETWORK_FORMATS[n].includes(x)) : [];
    formats[n] = list.length ? list : [design.formats.find((x) => NETWORK_FORMATS[n].includes(x)) ?? NETWORK_FORMATS[n][0]];
  }
  const p = isObj(d.published) ? d.published : null;
  const published = p && typeof p.at === "string" && p.at ? { at: p.at.slice(0, 40), by: str(p.by, 80) } : null;
  return { design, formats, published };
}

/** The formats the post goes out in, over the networks it goes to, in the design's order. */
export function formatsInUse(d: SocialDoc): FormatKey[] {
  const used = new Set(enabled(d).flatMap((n) => d.formats[n]));
  const ordered = d.design.formats.filter((f) => used.has(f));
  for (const f of used) if (!ordered.includes(f)) ordered.push(f);
  return ordered;
}

/** "sealing technology", "#sealing-technology" -> "#SealingTechnology"; "" when nothing is left. */
export function cleanTag(raw: unknown): string {
  const words = String(raw ?? "").replace(/^#+/, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return "";
  const joined = words.length === 1 ? words[0] : words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return /^\p{N}+$/u.test(joined) ? "" : `#${joined.slice(0, 60)}`;
}

/** Hashtags written into a text (a model's habit) taken out of it: the text without them, and the tags found. */
export function splitTags(text: string): { text: string; tags: string[] } {
  const lines = text.replace(/\s+$/, "").split("\n");
  const tags: string[] = [];
  // only a closing line made of hashtags alone is taken - a hashtag inside a sentence stays where it was written
  while (lines.length && /^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(lines[lines.length - 1])) {
    tags.unshift(...(lines.pop()!.match(/#[\p{L}\p{N}_]+/gu) ?? []));
  }
  return { text: lines.join("\n").replace(/\s+$/, ""), tags: tags.map(cleanTag).filter(Boolean) };
}

/** Where the feed cuts a text: what shows before "…see more", and what hides behind it. */
export function fold(text: string, n: Network): { shown: string; hidden: string; cut: boolean } {
  const { chars, lines } = NETWORK[n].fold;
  const t = text.replace(/\s+$/, "");
  let end = t.length;
  let nl = -1;
  for (let i = 0; i < lines; i++) { nl = t.indexOf("\n", nl + 1); if (nl < 0) break; }
  if (nl >= 0) end = Math.min(end, nl);
  if (end > chars) {
    const space = t.lastIndexOf(" ", chars);
    end = space > chars * 0.6 ? space : chars;
  }
  if (end >= t.length) return { shown: t, hidden: "", cut: false };
  return { shown: t.slice(0, end).replace(/\s+$/, ""), hidden: t.slice(end), cut: true };
}

/** The address with its label, as a text carries it. */
const linkLine = (l: SocialDoc["link"]) => (l.url ? (l.label.trim() ? `${l.label.trim()} ${l.url}` : l.url) : "");

/** The text as it is posted on a network: the words, the link where it works there, the hashtags where they are on. */
export function composed(d: SocialDoc, n: Network): string {
  const p = d.networks[n];
  const parts = [p.text.replace(/\s+$/, "")];
  const linkHere = NETWORK[n].linkWorks && d.link.url && !(n === "linkedin" && d.link.inComment) && !p.text.includes(d.link.url);
  if (linkHere) parts.push(linkLine(d.link));
  if (p.tags && d.hashtags.length) parts.push(d.hashtags.join(" "));
  return parts.filter((x) => x.trim()).join("\n\n");
}

/** LinkedIn's first comment as posted: the comment, with the link when it goes there. */
export function composedComment(d: SocialDoc): string {
  const parts = [d.firstComment.trim()];
  if (d.link.url && d.link.inComment && !d.firstComment.includes(d.link.url)) parts.push(linkLine(d.link));
  return parts.filter(Boolean).join("\n\n");
}

export const enabled = (d: SocialDoc): Network[] => NETWORKS.filter((k) => d.networks[k].on);

/** The slides the post shows: the carousel's, or the one brand card. */
export const slidesOf = (d: SocialDoc): Slide[] => (d.media.kind === "carousel" ? d.media.slides : d.media.kind === "card" ? [d.media.card] : []);

/** Everything worth a look before it is posted, per network, in plain sentences. */
export function checks(d: SocialDoc): { network: Network | null; text: string }[] {
  const out: { network: Network | null; text: string }[] = [];
  for (const n of enabled(d)) {
    const spec = NETWORK[n];
    const p = d.networks[n];
    const full = composed(d, n);
    if (!p.text.trim()) { out.push({ network: n, text: `${spec.label}: no text yet.` }); continue; }
    if (full.length > spec.max) out.push({ network: n, text: `${spec.label}: ${full.length - spec.max} characters over its ${spec.max.toLocaleString("en-GB")}.` });
    const tags = p.tags ? d.hashtags.length : 0;
    if (tags > spec.tags.max) out.push({ network: n, text: `${spec.label} takes ${spec.tags.max} hashtags at most - this has ${tags}.` });
    else if (tags > spec.tags.soup) out.push({ network: n, text: `${spec.label}: ${tags} hashtags read as hashtag soup - keep ${spec.tags.soup} or fewer.` });
    if (n === "instagram" && /https?:\/\/|www\./i.test(p.text)) out.push({ network: n, text: "Instagram: a link in the caption cannot be clicked - say where to find it instead." });
    const f = fold(p.text, n);
    if (n === "linkedin" && f.cut && f.shown.length < 40) out.push({ network: n, text: "LinkedIn: the first line is very short - the hook has to work before \"…see more\"." });
    for (const flag of brandFlags(full)) out.push({ network: n, text: `${spec.label}: ${flag}` });
  }
  if (d.networks.linkedin.on) for (const flag of brandFlags(d.firstComment)) out.push({ network: "linkedin", text: `First comment: ${flag}` });
  const pages = d.design.pages;
  for (const [i, p] of pages.entries()) {
    const words = pageWords(pageIn(d.design, p, d.design.formats[0])).join("\n");
    for (const flag of brandFlags(words)) out.push({ network: null, text: `${pages.length > 1 ? `Page ${i + 1}` : "The design"}: ${flag}` });
  }
  if (pages.length > 10 && d.networks.instagram.on) out.push({ network: "instagram", text: "Instagram shows 20 pages at most; past 10, few people swipe on." });
  const slides = pages.length ? [] : slidesOf(d);
  for (const [i, s] of slides.entries()) {
    const where = d.media.kind === "card" ? "The card" : `Slide ${i + 1}`;
    if (!s.headline.trim() && s.layout !== "photo") out.push({ network: null, text: `${where} has no headline.` });
    for (const flag of brandFlags(`${s.eyebrow}\n${s.headline}\n${s.text}`)) out.push({ network: null, text: `${where}: ${flag}` });
  }
  if (d.media.kind === "carousel" && slides.length === 1) out.push({ network: null, text: "A carousel of one slide - add slides, or make it a brand card." });
  if (d.media.kind === "carousel" && slides.length > 10 && d.networks.instagram.on) out.push({ network: "instagram", text: "Instagram shows 20 slides at most; past 10, few people swipe on." });
  if (d.media.kind === "image" && !d.media.image.url) out.push({ network: null, text: "No picture chosen yet." });
  if (d.media.kind === "image" && d.media.image.url && !d.media.image.alt.trim()) out.push({ network: null, text: "The picture has no description (alt text) for people who cannot see it." });
  if (d.media.kind === "none" && !pages.length && d.networks.instagram.on) out.push({ network: "instagram", text: "Instagram needs a picture - choose one, a brand card or a carousel." });
  return out;
}

/** The post as text - for the versions, the library and the search. */
export function socialText(doc: unknown): string {
  const d = normalizeSocial(doc);
  const blocks: string[] = [];
  for (const n of enabled(d)) {
    const t = composed(d, n);
    if (t.trim()) blocks.push(`${NETWORK[n].label}\n${t}`);
  }
  if (d.networks.linkedin.on && composedComment(d)) blocks.push(`LinkedIn - first comment\n${composedComment(d)}`);
  const words = designText(d.design);
  if (words) blocks.push(words);
  const slides = d.design.pages.length ? [] : slidesOf(d);
  if (slides.length) blocks.push(slides.map((s, i) => `${d.media.kind === "card" ? "Card" : `Slide ${i + 1}`}: ${[s.eyebrow, s.headline, s.text].filter((x) => x.trim()).join(" - ")}`).join("\n"));
  if (d.notes.trim()) blocks.push(d.notes.trim());
  return blocks.join("\n\n");
}

/** Everything someone posting by hand needs, in one text: each network's post, the comment, the media, the date. */
export function exportPack(doc: unknown, title = ""): string {
  const d = normalizeSocial(doc);
  const out: string[] = [];
  if (title) out.push(title, "=".repeat(Math.min(60, title.length)), "");
  if (d.schedule.date) out.push(`To post on ${d.schedule.date}${d.schedule.time ? ` at ${d.schedule.time}` : ""}`, "");
  for (const n of enabled(d)) {
    out.push(`--- ${NETWORK[n].label} ---`, composed(d, n) || "(no text)", "");
    if (n === "linkedin" && composedComment(d)) out.push("--- LinkedIn, first comment ---", composedComment(d), "");
    if (n === "instagram" && d.link.url) out.push(`(Instagram: the link goes in the bio - ${d.link.url})`, "");
  }
  if (d.media.kind === "image" && d.media.image.url) out.push("--- Picture ---", d.media.image.url, d.media.image.alt ? `Alt text: ${d.media.image.alt}` : "", "");
  if (d.design.pages.length) {
    out.push(`--- The design: ${d.design.pages.length} page${d.design.pages.length > 1 ? "s" : ""}, in ${formatsInUse(d).join(", ")} ---`, designText(d.design), "");
  }
  const slides = d.design.pages.length ? [] : slidesOf(d);
  if (slides.length) {
    out.push(d.media.kind === "card" ? "--- Brand card ---" : `--- Carousel, ${slides.length} slides (${SLIDE_SIZE[d.media.size].label}) ---`);
    slides.forEach((s, i) => out.push(`${i + 1}. ${[s.eyebrow, s.headline, s.text.replace(/\n/g, " / ")].filter((x) => x.trim()).join(" | ")}`));
    out.push("");
  }
  return out.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}
