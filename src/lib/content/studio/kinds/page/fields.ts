// PAGE - A NEW PAGE'S FIELDS (08.11.2026). Pure, shared with the browser and the tests: relative imports only.
//
// SARCLA 08.11.2026: "the new page should allow many more fields and allow filling fields with AI". A new page is no
// longer one block of HTML the AI writes (it wrote "[Intro paragraph part 1 in German]" into it): it is these fields,
// each filled by hand or by the AI, and drawn by one renderer (./newpage.ts) in the shop's look - so what the preview
// shows is what Magento gets, and every element in the preview knows which field it is (a click selects it).
//
//   hero      eyebrow, title (the page's h1), sub line, picture, button
//   intro     a paragraph
//   benefits  a title and cards (title + text)
//   sections  text + picture, the picture left or right
//   links     product and category pages of the shop (picked from the shop's index - never an invented address)
//   faq       questions and answers
//   cta       the call to action at the end
//   seo       meta title, meta description, URL key
//   looks     per element: size, alignment, colour, background, button style
//
// A field's PATH names it everywhere (the preview's data-apx-f, the properties panel, the AI's single-field ask):
// "hero.title", "intro", "sections.<item id>.text", "faq.<item id>.a", "cta.button.label", "seo.description".

export type Pic = { url: string; alt: string; idea: string };
export type Btn = { label: string; url: string };
export type Benefit = { id: string; title: string; text: string };
export type Section = { id: string; title: string; text: string; picture: Pic; side: "left" | "right" };
export type LinkItem = { id: string; label: string; url: string; note: string };
export type Faq = { id: string; q: string; a: string };

export type TextSize = "s" | "m" | "l";
export type TextAlign = "left" | "center";
export type TextColor = "ink" | "petrol" | "red" | "muted";
export type BlockBg = "white" | "grey" | "petrol" | "sand";
export type ButtonLook = "red" | "petrol" | "outline";
export type Look = { size?: TextSize; align?: TextAlign; color?: TextColor; bg?: BlockBg; button?: ButtonLook };

export type Fields = {
  hero: { eyebrow: string; title: string; sub: string; picture: Pic; button: Btn };
  intro: string;
  benefitsTitle: string;
  benefits: Benefit[];
  sections: Section[];
  linksTitle: string;
  links: LinkItem[];
  faqTitle: string;
  faq: Faq[];
  cta: { title: string; text: string; button: Btn };
  seo: { title: string; description: string; urlKey: string };
  looks: Record<string, Look>;
  /** the blocks in their order on the page (Content v5, 09.11.2026 - ./fields.ts blockOrder); unset = the order every
   * page had before: hero, intro, tiles, the sections, links, questions, call to action */
  order?: string[];
};

export const LIST_KEYS = ["benefits", "sections", "links", "faq"] as const;
export type ListKey = (typeof LIST_KEYS)[number];

/** The limits a field is written to (characters) - the AI is told them, the fields count against them. */
export const LIMIT = {
  eyebrow: 40, heroTitle: 70, heroSub: 180, button: 28, intro: 700, blockTitle: 70, benefitTitle: 50, benefitText: 220,
  sectionTitle: 70, sectionText: 900, linkLabel: 60, linkNote: 120, faqQ: 140, faqA: 600, ctaTitle: 70, ctaText: 240,
  seoTitle: 60, seoDescription: 155, alt: 140,
} as const;

export const emptyPic = (): Pic => ({ url: "", alt: "", idea: "" });
export const emptyBtn = (): Btn => ({ label: "", url: "" });

export function emptyFields(): Fields {
  return {
    hero: { eyebrow: "", title: "", sub: "", picture: emptyPic(), button: emptyBtn() },
    intro: "", benefitsTitle: "", benefits: [], sections: [], linksTitle: "", links: [], faqTitle: "", faq: [],
    cta: { title: "", text: "", button: emptyBtn() },
    seo: { title: "", description: "", urlKey: "" },
    looks: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const idOf = (v: unknown, i: number) => (typeof v === "string" && /^[a-z0-9]{2,12}$/i.test(v) ? v : `i${i + 1}`);

/** A short random id for a new item (letters and digits - a document path key must stay short). */
export const itemId = () => Math.random().toString(36).slice(2, 9);

/** A picture's address may be the hub's own (/api/content/picture/...), the shop's media, or an https address. */
export function cleanUrl(v: unknown, max = 600): string {
  const s = str(v, max).trim();
  if (!s) return "";
  if (/^(javascript|vbscript|data):/i.test(s)) return "";
  if (/^\/api\/content\/picture\/[\w-]+$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/[^\s"'<>]*$/.test(s)) return s;
  if (/^#[\w-]*$/.test(s)) return s;
  if (/^mailto:[^\s"'<>]+$/i.test(s)) return s;
  return "";
}

const pic = (v: unknown): Pic => {
  const p = isObj(v) ? v : {};
  return { url: cleanUrl(p.url), alt: str(p.alt, 300), idea: str(p.idea, 600) };
};
const btn = (v: unknown): Btn => {
  const b = isObj(v) ? v : {};
  return { label: str(b.label, 120), url: cleanUrl(b.url, 400) };
};
const list = <T>(v: unknown, max: number, f: (o: Record<string, unknown>, i: number) => T): T[] =>
  Array.isArray(v) ? v.filter(isObj).slice(0, max).map(f) : [];

const SIZES: TextSize[] = ["s", "m", "l"];
const ALIGNS: TextAlign[] = ["left", "center"];
const COLORS: TextColor[] = ["ink", "petrol", "red", "muted"];
const BGS: BlockBg[] = ["white", "grey", "petrol", "sand"];
const BUTTONS: ButtonLook[] = ["red", "petrol", "outline"];
const pickOf = <T extends string>(v: unknown, all: T[]): T | undefined => (all.includes(v as T) ? (v as T) : undefined);

function look(v: unknown): Look | null {
  if (!isObj(v)) return null;
  const out: Look = {};
  const size = pickOf(v.size, SIZES); if (size) out.size = size;
  const align = pickOf(v.align, ALIGNS); if (align) out.align = align;
  const color = pickOf(v.color, COLORS); if (color) out.color = color;
  const bg = pickOf(v.bg, BGS); if (bg) out.bg = bg;
  const button = pickOf(v.button, BUTTONS); if (button) out.button = button;
  return Object.keys(out).length ? out : null;
}

/** Any stored value as fields: missing parts filled, unknown values left out. */
export function normalizeFields(raw: unknown): Fields {
  const d = isObj(raw) ? raw : {};
  const h = isObj(d.hero) ? d.hero : {};
  const c = isObj(d.cta) ? d.cta : {};
  const s = isObj(d.seo) ? d.seo : {};
  const looks: Record<string, Look> = {};
  if (isObj(d.looks)) for (const [k, v] of Object.entries(d.looks).slice(0, 200)) { const l = look(v); if (l && /^[\w.]{1,60}$/.test(k)) looks[k] = l; }
  return {
    hero: { eyebrow: str(h.eyebrow, 120), title: str(h.title, 200), sub: str(h.sub, 600), picture: pic(h.picture), button: btn(h.button) },
    intro: str(d.intro, 3000),
    benefitsTitle: str(d.benefitsTitle, 200),
    benefits: list(d.benefits, 8, (o, i) => ({ id: idOf(o.id, i), title: str(o.title, 200), text: str(o.text, 800) })),
    sections: list(d.sections, 10, (o, i) => ({ id: idOf(o.id, i), title: str(o.title, 200), text: str(o.text, 4000), picture: pic(o.picture), side: o.side === "left" ? "left" : "right" })),
    linksTitle: str(d.linksTitle, 200),
    links: list(d.links, 16, (o, i) => ({ id: idOf(o.id, i), label: str(o.label, 200), url: cleanUrl(o.url, 400), note: str(o.note, 400) })),
    faqTitle: str(d.faqTitle, 200),
    faq: list(d.faq, 14, (o, i) => ({ id: idOf(o.id, i), q: str(o.q, 400), a: str(o.a, 2000) })),
    cta: { title: str(c.title, 200), text: str(c.text, 800), button: btn(c.button) },
    seo: { title: str(s.title, 200), description: str(s.description, 400), urlKey: str(s.urlKey, 200) },
    looks,
    ...(Array.isArray(d.order) && d.order.length ? { order: d.order.filter((k): k is string => typeof k === "string" && /^[\w.]{1,40}$/.test(k)).slice(0, 40) } : {}),
  };
}

/* ── a field by its path ──────────────────────────────────────────────── */

const isList = (k: string): k is ListKey => (LIST_KEYS as readonly string[]).includes(k);

/** The value at a path ("hero.title", "sections.ab12.text", "hero.picture"), or undefined. */
export function getField(f: Fields, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = f;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    if (i === 1 && isList(parts[0]) && Array.isArray(cur)) { cur = (cur as { id: string }[]).find((x) => x.id === k); continue; }
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

/** The fields with one value set at a path (a list item by its id); an unknown path changes nothing. */
export function setField(f: Fields, path: string, value: unknown): Fields {
  const parts = path.split(".");
  const go = (cur: unknown, i: number): unknown => {
    if (i === parts.length) return value;
    const k = parts[i];
    if (i === 1 && isList(parts[0]) && Array.isArray(cur)) {
      return (cur as { id: string }[]).map((x) => (x.id === k ? go(x, i + 1) : x));
    }
    if (!isObj(cur) || (i < parts.length - 1 && !(k in cur))) return cur;
    return { ...cur, [k]: go(cur[k], i + 1) };
  };
  return go(f, 0) as Fields;
}

/** An element's look (size, alignment, colour, background, button) set or cleared - kept apart from the words. */
export function setLook(f: Fields, path: string, patch: Partial<Look>): Fields {
  const next = look({ ...(f.looks[path] ?? {}), ...patch }) ?? {};
  for (const k of Object.keys(patch) as (keyof Look)[]) if (patch[k] === undefined) delete next[k];
  const looks = { ...f.looks };
  if (Object.keys(next).length) looks[path] = next; else delete looks[path];
  return { ...f, looks };
}

/** What kind of element a path is - for the properties panel. */
export type FieldKind = "text" | "long" | "picture" | "button" | "block" | "link" | "item";
export function fieldKind(path: string): FieldKind {
  const p = path.split(".");
  const last = p[p.length - 1];
  if (last === "picture") return "picture";
  if (last === "button") return "button";
  if (p[0] === "links" && p.length === 2) return "link";
  if (isList(p[0]) && p.length === 2) return "item";
  if (["hero", "cta", "benefits", "sections", "faq", "links", "intro-block"].includes(path)) return "block";
  if (["intro", "text", "a", "sub", "description"].includes(last)) return "long";
  return "text";
}

/** A field's name for people: "Hero · title", "Section 2 · text". */
export function fieldLabel(f: Fields, path: string): string {
  const p = path.split(".");
  const NAMES: Record<string, string> = {
    hero: "Hero", intro: "Intro", benefitsTitle: "Proof tiles · heading", benefits: "Tile", sections: "Section", linksTitle: "Links · heading",
    links: "Link", faqTitle: "Questions · heading", faq: "Question", cta: "Call to action", seo: "Search engines",
  };
  const PART: Record<string, string> = {
    eyebrow: "small line above", title: "title", sub: "line under the title", picture: "picture", button: "button", label: "words", url: "link",
    text: "text", q: "question", a: "answer", note: "note", description: "description", urlKey: "URL key", alt: "picture text",
  };
  let name = NAMES[p[0]] ?? p[0];
  let rest = p.slice(1);
  if (isList(p[0]) && p[1]) {
    const items = (f[p[0]] as { id: string }[]);
    const n = items.findIndex((x) => x.id === p[1]);
    name = `${name} ${n >= 0 ? n + 1 : ""}`.trim();
    rest = p.slice(2);
  }
  return [name, ...rest.map((x) => PART[x] ?? x)].join(" · ");
}

/* ── the fields' words: for the AI, the checks and the translation ────── */

export type Item = { id: string; text: string };

/** Every text a visitor reads, by its path - pictures' alt texts too; addresses and picture ideas stay out. */
export function fieldStrings(f: Fields): Item[] {
  const out: Item[] = [];
  const add = (id: string, text: string) => { if (text.trim()) out.push({ id, text }); };
  add("hero.eyebrow", f.hero.eyebrow); add("hero.title", f.hero.title); add("hero.sub", f.hero.sub);
  add("hero.picture.alt", f.hero.picture.alt); add("hero.button.label", f.hero.button.label);
  add("intro", f.intro);
  add("benefitsTitle", f.benefitsTitle);
  for (const b of f.benefits) { add(`benefits.${b.id}.title`, b.title); add(`benefits.${b.id}.text`, b.text); }
  for (const s of f.sections) { add(`sections.${s.id}.title`, s.title); add(`sections.${s.id}.text`, s.text); add(`sections.${s.id}.picture.alt`, s.picture.alt); }
  add("linksTitle", f.linksTitle);
  for (const l of f.links) { add(`links.${l.id}.label`, l.label); add(`links.${l.id}.note`, l.note); }
  add("faqTitle", f.faqTitle);
  for (const q of f.faq) { add(`faq.${q.id}.q`, q.q); add(`faq.${q.id}.a`, q.a); }
  add("cta.title", f.cta.title); add("cta.text", f.cta.text); add("cta.button.label", f.cta.button.label);
  add("seo.title", f.seo.title); add("seo.description", f.seo.description);
  return out;
}

/** The fields with words put back by path (only paths that exist and are words - an address is never set this way). */
export function withFieldStrings(f: Fields, items: Item[]): Fields {
  const allowed = new Set(fieldStrings(f).map((x) => x.id));
  let out = f;
  for (const it of items) if (allowed.has(it.id) && typeof it.text === "string" && it.text.trim()) out = setField(out, it.id, it.text.trim());
  return out;
}

/** How many of the page's parts have words - 0 = an empty new page. */
export function filledCount(f: Fields): number {
  return [
    f.hero.title, f.hero.sub, f.intro, f.benefits.length ? "x" : "", f.sections.length ? "x" : "", f.links.length ? "x" : "",
    f.faq.length ? "x" : "", f.cta.title, f.seo.title,
  ].filter((x) => x.trim()).length;
}

/** The pictures the page shows, by path - for the hand-over to Magento. */
export function fieldPictures(f: Fields): { path: string; pic: Pic }[] {
  const out: { path: string; pic: Pic }[] = [];
  if (f.hero.picture.url) out.push({ path: "hero.picture", pic: f.hero.picture });
  for (const s of f.sections) if (s.picture.url) out.push({ path: `sections.${s.id}.picture`, pic: s.picture });
  return out;
}

/** A list with one item more (an empty one, or the one given), or one item moved or removed. */
export function addItem(f: Fields, key: ListKey, at?: number): { fields: Fields; id: string } {
  const id = itemId();
  const blank = key === "benefits" ? { id, title: "", text: "" }
    : key === "sections" ? { id, title: "", text: "", picture: emptyPic(), side: (f.sections.length % 2 ? "left" : "right") as "left" | "right" }
      : key === "links" ? { id, label: "", url: "", note: "" }
        : { id, q: "", a: "" };
  const items = [...(f[key] as unknown[])];
  items.splice(at === undefined ? items.length : Math.max(0, Math.min(items.length, at)), 0, blank);
  return { fields: { ...f, [key]: items } as Fields, id };
}
export function moveItem(f: Fields, key: ListKey, id: string, by: -1 | 1): Fields {
  const items = [...(f[key] as { id: string }[])];
  const i = items.findIndex((x) => x.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= items.length) return f;
  [items[i], items[j]] = [items[j], items[i]];
  return { ...f, [key]: items } as Fields;
}
export function removeItem(f: Fields, key: ListKey, id: string): Fields {
  const looks = Object.fromEntries(Object.entries(f.looks).filter(([k]) => !k.startsWith(`${key}.${id}`)));
  return { ...f, [key]: (f[key] as { id: string }[]).filter((x) => x.id !== id), looks } as Fields;
}
/** An item put at a place in its list (dragged there). */
export function moveItemTo(f: Fields, key: ListKey, id: string, to: number): Fields {
  const items = [...(f[key] as { id: string }[])];
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return f;
  const [it] = items.splice(i, 1);
  items.splice(Math.max(0, Math.min(items.length, to)), 0, it);
  return { ...f, [key]: items } as Fields;
}

/* ── the blocks and their order on the page (Content v5, 09.11.2026) ───── */
//
// SARCLA 09.11.2026: "each block should be a section" and "I should be able to add more elements by + next to sections, or
// in the photo". A page is its blocks in an order: the hero first (always), then any of intro, proof tiles, links,
// questions, call to action - once each - and as many text-and-picture sections as it needs, each its own block
// ("sections.<id>"). "sections" alone is the empty slot where sections go while the page has none (a page from before
// shows it there). A page saved before the order existed keeps exactly the order it had (DEFAULT_ORDER).

export const SINGLE_BLOCKS = ["intro", "benefits", "links", "faq", "cta"] as const;
export type SingleBlock = (typeof SINGLE_BLOCKS)[number];
/** What the + adds: a text-and-picture section, or one of the single blocks (moved there when the page has it). */
export type NewBlock = "text" | SingleBlock;
export const DEFAULT_ORDER = ["hero", "intro", "benefits", "sections", "links", "faq", "cta"] as const;

const isSingle = (k: string): k is SingleBlock => (SINGLE_BLOCKS as readonly string[]).includes(k);

/** The page's blocks in their order: the stored order put right - unknown and gone blocks out, sections not placed yet
 * in (where the empty slot was, else after the last section, else before the links), the hero first. */
export function blockOrder(f: Fields): string[] {
  const raw = Array.isArray(f.order) && f.order.length ? f.order : [...DEFAULT_ORDER];
  const ids = new Set(f.sections.map((s) => s.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    if (seen.has(k)) continue;
    if (!(k === "hero" || k === "sections" || isSingle(k) || (k.startsWith("sections.") && ids.has(k.slice(9))))) continue;
    seen.add(k);
    out.push(k);
  }
  const missing = f.sections.map((s) => `sections.${s.id}`).filter((k) => !seen.has(k));
  if (missing.length) {
    let at = out.indexOf("sections");
    if (at < 0) {
      let last = -1;
      out.forEach((k, i) => { if (k.startsWith("sections.")) last = i; });
      at = last >= 0 ? last + 1 : -1;
    }
    if (at < 0) { const next = out.findIndex((k) => k === "links" || k === "faq" || k === "cta"); at = next >= 0 ? next : out.length; }
    out.splice(at, 0, ...missing);
  }
  if (f.sections.length) { const p = out.indexOf("sections"); if (p >= 0) out.splice(p, 1); }
  const h = out.indexOf("hero");
  if (h > 0) out.splice(h, 1);
  if (h !== 0) out.unshift("hero");
  return out;
}

/** The fields with this order kept - the sections' list put in the same order (their numbers follow the page). */
export function withOrder(f: Fields, order: string[]): Fields {
  const at = (id: string) => { const i = order.indexOf(`sections.${id}`); return i < 0 ? 1e6 : i; };
  const sections = [...f.sections].sort((a, b) => at(a.id) - at(b.id));
  return { ...f, sections, order: blockOrder({ ...f, sections, order }) };
}

/** A block added at a place of the order (1 = right after the hero): a new section, or a single block - moved there when
 * the page has it already. Its key comes back, to select it. */
export function addBlock(f: Fields, kind: NewBlock, at: number): { fields: Fields; key: string } {
  const order = blockOrder(f);
  const pos = Math.max(1, Math.min(order.length, Math.round(at)));
  if (kind === "text") {
    const before = order.slice(0, pos).reverse().find((k) => k.startsWith("sections."));
    const prev = before ? f.sections.find((s) => `sections.${s.id}` === before) : undefined;
    const r = addItem(f, "sections");
    const side: Section["side"] = prev ? (prev.side === "right" ? "left" : "right") : "right";
    const fields = setField(r.fields, `sections.${r.id}.side`, side);
    const key = `sections.${r.id}`;
    const slot = order.indexOf("sections");
    const next = order.filter((k) => k !== "sections");
    next.splice(slot >= 0 && slot < pos ? pos - 1 : pos, 0, key);
    return { fields: withOrder(fields, next), key };
  }
  const cur = order.indexOf(kind);
  const next = order.filter((k) => k !== kind);
  next.splice(cur >= 0 && cur < pos ? pos - 1 : pos, 0, kind);
  return { fields: withOrder(f, next), key: kind };
}

/** A block moved by one place (never above the hero). */
export function moveBlock(f: Fields, key: string, by: -1 | 1): Fields {
  const order = blockOrder(f);
  const i = order.indexOf(key);
  const j = i + by;
  if (i < 1 || j < 1 || j >= order.length) return f;
  [order[i], order[j]] = [order[j], order[i]];
  return withOrder(f, order);
}

/** A block put at a place (dragged there): `to` is its index in the order after the move. */
export function moveBlockTo(f: Fields, key: string, to: number): Fields {
  const order = blockOrder(f);
  const i = order.indexOf(key);
  if (i < 1) return f;
  order.splice(i, 1);
  order.splice(Math.max(1, Math.min(order.length, to)), 0, key);
  return withOrder(f, order);
}

/** A block taken out of the page, its words with it (Undo brings them back). The hero stays. */
export function removeBlock(f: Fields, key: string): Fields {
  const order = blockOrder(f).filter((k) => k !== key);
  if (key === "hero") return f;
  const drop = (...prefixes: string[]) => Object.fromEntries(Object.entries(f.looks).filter(([k]) => !prefixes.some((p) => k === p || k.startsWith(`${p}.`))));
  let out: Fields = f;
  if (key.startsWith("sections.")) out = removeItem(f, "sections", key.slice(9));
  else if (key === "intro") out = { ...f, intro: "", looks: drop("intro", "intro-block") };
  else if (key === "benefits") out = { ...f, benefits: [], benefitsTitle: "", looks: drop("benefits", "benefitsTitle") };
  else if (key === "links") out = { ...f, links: [], linksTitle: "", looks: drop("links", "linksTitle") };
  else if (key === "faq") out = { ...f, faq: [], faqTitle: "", looks: drop("faq", "faqTitle") };
  else if (key === "cta") out = { ...f, cta: { title: "", text: "", button: emptyBtn() }, looks: drop("cta") };
  return withOrder(out, order);
}

/** The words the AI wrote for blocks the page does not have, left out - a block taken out stays out ("Write it all
 * again" writes the page as it is now). `order` = the page's order before the AI wrote. */
export function onlyOnPage(f: Fields, order: string[]): Fields {
  const out: Fields = { ...f };
  if (!order.includes("intro")) out.intro = "";
  if (!order.includes("benefits")) { out.benefits = []; out.benefitsTitle = ""; }
  if (!order.includes("links")) { out.links = []; out.linksTitle = ""; }
  if (!order.includes("faq")) { out.faq = []; out.faqTitle = ""; }
  if (!order.includes("cta")) out.cta = { title: "", text: "", button: emptyBtn() };
  if (!order.some((k) => k === "sections" || k.startsWith("sections."))) out.sections = [];
  return out;
}
