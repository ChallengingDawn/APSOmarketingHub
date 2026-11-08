// SOCIAL POST - THE AI'S ANSWERS, AND HOW THEY ARE KEPT (08.11.2026). Pure: tests/studio-social.test.ts.
// The prompts and the call live in server.ts. Here the answers' shapes and their cleaning: a text cut to its network's
// limit, hashtags out of the texts and into their own list (never hashtag soup), slides that fit on a slide, photos only
// from the shop's own.

import { SHOP_PHOTOS } from "../banner/brand";
import { LAYOUTS, NETWORK, NETWORKS, cleanTag, isLayout, isNetwork, splitTags, type Network, type Slide } from "./model";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Hashtags kept: written the way people write them, no duplicates, `max` at most. */
export function cleanTags(raw: unknown, max = 5): string[] {
  const out: string[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    const c = cleanTag(t);
    if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
  }
  return out.slice(0, max);
}

/** A network's text from a model: hashtags it wrote at the end moved out, cut to the network's length, no markdown bold. */
export function cleanPostText(raw: unknown, n: Network): { text: string; tags: string[] } {
  const t = str(raw, NETWORK[n].max * 2).replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
  const s = splitTags(t);
  return { text: s.text.slice(0, NETWORK[n].max), tags: s.tags };
}

export const WRITE_SCHEMA = {
  type: "object",
  properties: {
    linkedin: {
      type: "object",
      properties: { text: { type: "string" }, firstComment: { type: "string", description: "Empty, or a short first comment that adds one useful thing." } },
      required: ["text", "firstComment"], additionalProperties: false,
    },
    instagram: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    facebook: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    hashtags: { type: "array", items: { type: "string" }, description: "3 to 5 hashtags people really use, without spaces." },
  },
  required: ["linkedin", "instagram", "facebook", "hashtags"],
  additionalProperties: false,
} as const;

export type WriteAnswer = { texts: Partial<Record<Network, string>>; firstComment: string; hashtags: string[] };

/** The post for the networks asked for (the others are left as they are). */
export function cleanWrite(raw: unknown, asked: Network[]): WriteAnswer {
  const r = obj(raw);
  const texts: WriteAnswer["texts"] = {};
  const found: string[] = [];
  for (const n of NETWORKS) {
    if (!asked.includes(n)) continue;
    const c = cleanPostText(obj(r[n]).text, n);
    if (!c.text) continue;
    texts[n] = c.text;
    found.push(...c.tags);
  }
  return {
    texts,
    firstComment: asked.includes("linkedin") ? str(obj(r.linkedin).firstComment, 1250) : "",
    hashtags: cleanTags([...(Array.isArray(r.hashtags) ? r.hashtags : []), ...found]),
  };
}

export const TEXT_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
} as const;

export function cleanText(raw: unknown, n: Network): { text: string; hashtags: string[] } {
  const c = cleanPostText(obj(raw).text, n);
  return { text: c.text, hashtags: cleanTags(c.tags) };
}

export const HASHTAG_SCHEMA = {
  type: "object",
  properties: { hashtags: { type: "array", items: { type: "string" }, description: "3 to 5 real hashtags, most specific first." } },
  required: ["hashtags"],
  additionalProperties: false,
} as const;

const PHOTO_KEYS = [...SHOP_PHOTOS.map((p) => p.key), "none"];

export const CAROUSEL_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      description: "5 to 8 slides: a cover first, one idea per slide, a last slide that asks or points somewhere.",
      items: {
        type: "object",
        properties: {
          layout: { type: "string", enum: [...LAYOUTS] },
          eyebrow: { type: "string", description: "One to three words, or empty." },
          headline: { type: "string", description: "The slide's point, at most about 8 words." },
          text: { type: "string", description: "At most two short sentences; for a list, one point per line." },
          photo: { type: "string", enum: PHOTO_KEYS, description: "One of the shop's photos where a picture helps (the cover, a photo slide), else none." },
        },
        required: ["layout", "eyebrow", "headline", "text", "photo"],
        additionalProperties: false,
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
} as const;

/** Slides from a model: 3 to 10, a cover first, few words each, photos only the shop's. Ids are the caller's to give. */
export function cleanCarousel(raw: unknown): { slides: Slide[] } {
  const list = Array.isArray(obj(raw).slides) ? (obj(raw).slides as unknown[]) : [];
  const slides: Slide[] = list.slice(0, 10).map((x, i) => {
    const o = obj(x);
    const photo = SHOP_PHOTOS.find((p) => p.key === o.photo);
    return {
      id: `ai${i + 1}`,
      layout: isLayout(o.layout) ? o.layout : "statement",
      eyebrow: str(o.eyebrow, 40),
      headline: str(o.headline, 90),
      text: str(o.text, 320),
      image: photo ? { url: photo.url, alt: "" } : null,
    };
  }).filter((s) => s.headline || s.text);
  if (slides.length && slides[0].layout !== "cover") slides[0] = { ...slides[0], layout: "cover" };
  return { slides };
}

/** Which networks to write for: those asked that are networks, else the post's own. */
export const askedNetworks = (input: unknown, fallback: Network[]): Network[] => {
  const v = obj(input).networks;
  const list = Array.isArray(v) ? v.filter(isNetwork) : [];
  return list.length ? [...new Set(list)] : fallback;
};
