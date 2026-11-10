// PAGE - THE PAGE'S BLOCKS AS ONE LIST (Content v8, 10.11.2026). Pure: relative imports only (tests/studio-page-blocklist.test.ts).
//
// SARCLA 10.11.2026 (points 1-4): "on the left side leave only the blocks", "consider pages' blocks as existing blocks and
// allow block settings", "a module should be counted as a block - a normal block with editing options there". The Build
// pane is the page's BLOCKS, one row each, in their order on the page and numbered as on it - a new page's own blocks
// (hero, intro, the tiles, each text-and-picture...) and the modules of the library in between, alike; a page of the shop's
// own blocks (what the page holds, top to bottom), and the blocks and modules the hub put on it. Words are changed by a
// click on them in the page, a block's look in its settings; the list moves, duplicates and takes blocks out.
//
// A new page's module stands AFTER one of its blocks (fields.ts PageModule.after) - so the list's order is the blocks'
// order with each block's modules after it; a row dragged elsewhere is laid back that way (moveRow).

import { blockOrder, emptyPic, itemId, pinGrounds, removeBlock, withOrder, type Fields, type PageModule, type Section } from "./fields";
import { blocksOf, previewOf, type BlockInfo, type PartState } from "./outline";
import { kindOf, moduleGap, moduleId, moduleOfChange, type ModuleRef } from "./modules/model";
import type { PageChange } from "./model";
import { TILE_KEY, TILE_WORDS, shopTileWord, tileWordsOf, type TileWord } from "./modules/tilewords";

/** a block of the page itself, a module of the library, a page of the shop's own block, a block the hub put on it */
export type RowKind = "block" | "module" | "page" | "ours";
/** how far it is (a new page), or - a page of the shop - changed, as it is, hidden, held back by the check */
export type RowState = PartState | "changed" | "same" | "hidden" | "held";

export type BlockRow = {
  /** a new page: the block's key ("hero", "sections.ab12") or "np:<module id>"; a page of the shop: "p:<selector>" (its own
   * block) or "c:<change id>" (one the hub put) */
  key: string;
  /** its place on the page, from 1 - modules count, as blocks */
  num: number;
  kind: RowKind;
  name: string;
  /** one line of what it says */
  line: string;
  state: RowState;
  /** what it still needs ("Picture missing", "Choose its products") - "" when nothing */
  note: string;
  /** a module: its library type and name (the row's module mark) */
  module: { type: string; name: string } | null;
  /** may it be dragged or moved (the hero stays first; a page of the shop's own blocks keep their order) */
  movable: boolean;
  /** may it be duplicated (a text-and-picture block, a module) */
  copyable: boolean;
  /** a page of the shop: its element's selector (its own block), the change that put it (one the hub put) */
  selector?: string;
  change?: number;
  changeId?: string;
};

const words = (s: string, n = 70) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

/* ── a new page ───────────────────────────────────────────────────────── */

const NP = "np:";
export const isModuleKey = (key: string | null | undefined): boolean => !!key && key.startsWith(NP);
export const moduleKeyOf = (id: string) => `${NP}${id}`;

function blockRow(b: BlockInfo): Omit<BlockRow, "num"> {
  const note = b.missing ? (b.missing === 1 ? "Picture missing" : `${b.missing} pictures missing`) : b.key === "sections" ? "Not written yet" : "";
  return {
    key: b.key, kind: "block", name: b.name, line: b.key === "sections" ? "Text with a picture beside it" : b.line, state: b.state, note,
    module: null, movable: b.key !== "hero", copyable: b.kind === "text",
  };
}

function moduleRow(m: PageModule): Omit<BlockRow, "num"> {
  const k = kindOf(m.module.type);
  const gap = moduleGap(m.module);
  const n = m.module.settings.items.length;
  const what = k.takes === "products" ? `${n} product${n === 1 ? "" : "s"}` : k.takes === "categories" ? `${n} categor${n === 1 ? "y" : "ies"}` : "";
  return {
    key: moduleKeyOf(m.id), kind: "module", name: k.name, line: words(m.module.settings.title.replace(/==/g, "")) || what || k.note || "",
    state: gap ? "partly" : "written", note: gap, module: { type: k.id, name: k.name }, movable: true, copyable: true,
  };
}

/** A new page's rows in their order: each block, its modules after it (a module whose block is gone, at the end). */
export function newPageRows(f: Fields): BlockRow[] {
  const blocks = blocksOf(f).filter((b) => b.num);
  const order = blocks.map((b) => b.key);
  const mods = f.modules ?? [];
  const out: Omit<BlockRow, "num">[] = [];
  const after = (key: string) => mods.filter((m) => (key === "~end" ? m.after && !order.includes(m.after) : m.after === key)).forEach((m) => out.push(moduleRow(m)));
  after("");
  for (const b of blocks) { out.push(blockRow(b)); after(b.key); }
  after("~end");
  return out.map((r, i) => ({ ...r, num: i + 1 }));
}

/** What a click in the page selected, as the row it belongs to: "f:hero.title" -> "hero", "b:intro-block" -> "intro",
 * "b:benefits.x" -> "benefits", "np:m1" -> "np:m1". */
export function rowOfSelection(sel: string | null | undefined): string | null {
  if (!sel) return null;
  if (isModuleKey(sel)) return sel;
  if (!/^[fb]:/.test(sel)) return null;
  const p = sel.slice(2).split(".");
  if (p[0] === "sections") return p[1] ? `sections.${p[1]}` : "sections";
  const k = p[0] === "benefitsTitle" ? "benefits" : p[0] === "linksTitle" ? "links" : p[0] === "faqTitle" ? "faq" : p[0] === "intro-block" ? "intro" : p[0];
  return ["hero", "intro", "benefits", "links", "faq", "cta"].includes(k) ? k : null;
}

/** A row as the page selects it: a block by its preview key ("b:intro-block"), a module by its own ("np:<id>"). */
export function selectionOfRow(key: string): string {
  if (isModuleKey(key)) return key;
  return `b:${previewOf(key) ?? key}`;
}

/** The fields laid out as a sequence of rows says: the blocks' order, and each module after the block above it. */
function fromSequence(f: Fields, seq: string[]): Fields {
  const mods = f.modules ?? [];
  const byId = new Map(mods.map((m) => [moduleKeyOf(m.id), m]));
  const blocks: string[] = [];
  const nextMods: PageModule[] = [];
  let last = "";
  for (const key of seq) {
    const m = byId.get(key);
    if (m) { nextMods.push({ ...m, after: last }); continue; }
    blocks.push(key);
    last = key;
  }
  // the hero stays first: a module dragged above it stands at the top of the page
  const hero = blocks.indexOf("hero");
  if (hero > 0) {
    blocks.splice(hero, 1);
    blocks.unshift("hero");
    for (const m of nextMods) if (!blocks.includes(m.after) && m.after !== "") m.after = "";
  }
  // the sections' grounds kept as they show (Content v11: moving one block never turns another's ground)
  const out = withOrder(pinGrounds(f), blocks);
  return mods.length || nextMods.length ? { ...out, modules: nextMods } : out;
}

/** A row put at a place of the list (`to`: its index once moved). The hero stays first. */
export function moveRow(f: Fields, key: string, to: number): Fields {
  const seq = newPageRows(f).map((r) => r.key);
  const from = seq.indexOf(key);
  if (from < 0 || key === "hero") return f;
  seq.splice(from, 1);
  const at = Math.max(0, Math.min(seq.length, to));
  // nothing goes above the hero but a module
  const heroAt = seq.indexOf("hero");
  seq.splice(!isModuleKey(key) && heroAt >= 0 && at <= heroAt ? heroAt + 1 : at, 0, key);
  return fromSequence(f, seq);
}

/** A row moved by one place up or down. */
export function moveRowBy(f: Fields, key: string, by: -1 | 1): Fields {
  const seq = newPageRows(f).map((r) => r.key);
  const i = seq.indexOf(key);
  if (i < 0) return f;
  return moveRow(f, key, i + by);
}

/** A row taken out of the page (Undo brings it back). A block's modules stay where they stood (after the block above). */
export function removeRow(f: Fields, key: string): Fields {
  if (isModuleKey(key)) {
    const id = key.slice(NP.length);
    return { ...f, modules: (f.modules ?? []).filter((m) => m.id !== id) };
  }
  if (key === "hero") return f;
  const order = blockOrder(f);
  const i = order.indexOf(key);
  const prev = i > 0 ? order[i - 1] : "";
  // the other sections keep the grounds they show (Content v11)
  const out = removeBlock(key.startsWith("sections.") ? pinGrounds(f) : f, key);
  if (!f.modules?.some((m) => m.after === key)) return out;
  return { ...out, modules: (out.modules ?? f.modules).map((m) => (m.after === key ? { ...m, after: prev } : m)) };
}

/** A copy of a row right after it (a text-and-picture block, a module) - its key, to select it; null when a page has
 * only one of that block (the hero, the intro, the tiles...). */
export function duplicateRow(f0: Fields, key: string): { fields: Fields; key: string } | null {
  const f = key.startsWith("sections.") ? pinGrounds(f0) : f0;
  if (isModuleKey(key)) {
    const mods = f.modules ?? [];
    const i = mods.findIndex((m) => moduleKeyOf(m.id) === key);
    if (i < 0) return null;
    const m = mods[i];
    const id = moduleId();
    const copy: PageModule = { id, after: m.after, module: { ...m.module, settings: { ...m.module.settings, id: moduleId() } } };
    const next = [...mods];
    next.splice(i + 1, 0, copy);
    return { fields: { ...f, modules: next }, key: moduleKeyOf(id) };
  }
  if (!key.startsWith("sections.")) return null;
  const s = f.sections.find((x) => `sections.${x.id}` === key);
  if (!s) return null;
  const id = itemId();
  const copy: Section = { ...s, id, picture: { ...emptyPic(), ...s.picture } };
  const sections = [...f.sections];
  sections.splice(sections.indexOf(s) + 1, 0, copy);
  const order = blockOrder(f);
  order.splice(order.indexOf(key) + 1, 0, `sections.${id}`);
  // its look comes with it
  const looks = { ...f.looks };
  for (const [k, v] of Object.entries(f.looks)) if (k === key || k.startsWith(`${key}.`)) looks[`sections.${id}${k.slice(key.length)}`] = { ...v };
  return { fields: withOrder({ ...f, sections, looks }, order), key: `sections.${id}` };
}

/** The text fields of a block (its words' look set at once - "Align: centre" for the whole block) and its heading. */
export function blockTexts(f: Fields, key: string): { heading: string | null; texts: string[] } {
  if (key === "hero") return { heading: "hero.title", texts: ["hero.eyebrow", "hero.title", "hero.sub", "hero.button"] };
  if (key === "intro") return { heading: null, texts: ["intro"] };
  if (key === "benefits") return { heading: "benefitsTitle", texts: ["benefitsTitle", ...f.benefits.flatMap((b) => [`benefits.${b.id}.title`, `benefits.${b.id}.text`])] };
  if (key === "links") return { heading: "linksTitle", texts: ["linksTitle"] };
  if (key === "faq") return { heading: "faqTitle", texts: ["faqTitle"] };
  if (key === "cta") return { heading: "cta.title", texts: ["cta.title", "cta.text", "cta.button"] };
  if (key.startsWith("sections.")) return { heading: `${key}.title`, texts: [`${key}.title`, `${key}.text`] };
  return { heading: null, texts: [] };
}

/** The block's background key in the fields' looks ("intro-block" for the intro). */
export const bgPathOf = (key: string) => (key === "intro" ? "intro-block" : key);

/* ── a page of the shop ───────────────────────────────────────────────── */

/** One of a page of the shop's content blocks as the studio's frame sees it (top to bottom). */
export type FoundBlock = {
  /** a selector that finds it (its own blocks) */
  selector: string;
  tag: string;
  /** its first heading's words, its words (cut), what it holds */
  heading: string;
  text: string;
  pictures: number;
  /** what Magento's Page Builder calls it ("slider", "banner", "products"...), "" when not one */
  pb: string;
  /** put there by a change: that change's index in the list; or (drawn while it fills) its change id */
  change: number | null;
  changeId?: string;
  /** the changes working on it (its words, its look, hidden) */
  touched: number[];
  hidden: boolean;
};

const PB_NAME: Record<string, string> = {
  slider: "Slider", banner: "Banner", image: "Picture", tabs: "Tabs", products: "Product list", video: "Video", map: "Map", "block": "Block",
  "dynamic_block": "Block", "contact-form": "Form",
};

/** A page of the shop's own block, named as a person would: its heading, else what it is ("Slider", "Pictures"). */
function ownName(b: FoundBlock): string {
  if (b.heading) return words(b.heading, 48);
  if (b.pb && PB_NAME[b.pb]) return PB_NAME[b.pb];
  if (b.text) return words(b.text, 40);
  return b.pictures > 1 ? "Pictures" : b.pictures === 1 ? "Picture" : "Block";
}

/**
 * A page of the shop's rows: its own blocks as the frame found them (P - kept in their order, their words changed in the
 * page, their look and "hidden" in their settings) and what the hub put on it (a module, an AI block) - then what the hub
 * put that is not on the page (held back by the check, its place not found), at the end, so it is never lost.
 */
export function shopRows(found: FoundBlock[], changes: PageChange[]): BlockRow[] {
  const out: Omit<BlockRow, "num">[] = [];
  const shown = new Set<string>();
  const idOf = (i: number) => changes[i]?.id ?? `#${i}`;
  const oursRow = (i: number, b: FoundBlock | null): Omit<BlockRow, "num"> | null => {
    const c = changes[i];
    if (!c) return null;
    const id = idOf(i);
    if (shown.has(id)) return null;
    shown.add(id);
    const m = moduleOfChange(c);
    const off = (c as { off?: string }).off ?? "";
    const note = off ? (/^Looks wrong/.test(off) ? off : off.replace(/^Not filled yet: /, "")) : "";
    const line = b?.text ? words(b.heading ? `${b.heading} · ${b.text}` : b.text) : words(String((c as { note?: string }).note ?? ""));
    if (m) {
      const k = kindOf(m.type);
      return { key: `c:${id}`, kind: "module", name: k.name, line: words(m.settings.title) || line, state: off ? "held" : "written", note: note || moduleGap(m),
        module: { type: k.id, name: k.name }, movable: c.op === "insert", copyable: false, change: i, changeId: c.id };
    }
    return { key: `c:${id}`, kind: "ours", name: c.op === "replace" ? "A block in place of the shop's" : "A block", line, state: off ? "held" : "written", note,
      module: null, movable: c.op === "insert", copyable: false, change: i, changeId: c.id };
  };
  for (const b of found) {
    if (b.change !== null || b.changeId) {
      const i = b.change ?? changes.findIndex((c) => c.id === b.changeId);
      const r = i >= 0 ? oursRow(i, b) : null;
      if (r) out.push(r);
      continue;
    }
    const st: RowState = b.hidden ? "hidden" : b.touched.length ? "changed" : "same";
    out.push({ key: `p:${b.selector}`, kind: "page", name: ownName(b), line: b.heading && b.text ? words(b.text) : b.pictures && !b.text ? `${b.pictures} picture${b.pictures === 1 ? "" : "s"}` : b.heading ? "" : "", state: st, note: "",
      module: null, movable: false, copyable: false, selector: b.selector });
  }
  // what the hub put that is not on the page: listed at the end, with why
  changes.forEach((c, i) => {
    if (c.op !== "insert" && c.op !== "replace") return;
    if (shown.has(idOf(i))) return;
    const r = oursRow(i, null);
    if (r) out.push({ ...r, state: "held", note: r.note || "Not on the page - its place was not found" });
  });
  return out.map((r, i) => ({ ...r, num: i + 1 }));
}

/** The row a selection in a page of the shop belongs to: the change its element came from, else the own block it is in. */
export function shopRowOf(rows: BlockRow[], at: { change?: number | null; block?: string | null }): string | null {
  if (at.change !== null && at.change !== undefined) { const r = rows.find((x) => x.change === at.change); if (r) return r.key; }
  if (at.block) { const r = rows.find((x) => x.selector === at.block); if (r) return r.key; }
  return null;
}

/* ── a module's words, edited in the page ─────────────────────────────── */

/** The new words with the old ones' red marks kept where the marked words still stand. */
function keepRed(old: string, next: string): string {
  let out = next;
  for (const m of old.matchAll(/==([^=]{1,60})==/g)) {
    const w = m[1];
    if (out.includes(`==${w}==`)) continue;
    const i = out.indexOf(w);
    if (i >= 0) out = `${out.slice(0, i)}==${w}==${out.slice(i + w.length)}`;
  }
  return out;
}

/**
 * Words as a click reads them and as a setting holds them, made comparable (Content v12, SARCLA 10.11.2026: "on some bento
 * I cannot edit the button"): the red marks out, a hyphen the module never breaks (U+2011 - the library's part 2 draws
 * "O‑Ring" so) a hyphen, a no-break space a space, one space between words.
 */
export const wordsKey = (t: string) => t.replace(/==/g, "").replace(/[‐‑]/g, "-").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
/** The same words? Also when the page shows them in capitals (a small line above is `text-transform: uppercase` - the
 * browser's innerText gives "DICHTUNGSTECHNIK") or in two lines ("06.12." over "2026"). */
export function sameWords(clicked: string, held: string): boolean {
  const a = wordsKey(clicked);
  const b = wordsKey(held);
  if (!a || !b) return false;
  if (a === b || a.toLowerCase() === b.toLowerCase()) return true;
  return a.replace(/\s/g, "").toLowerCase() === b.replace(/\s/g, "").toLowerCase();
}
/** A link's page without its host and store view ("https://www.apsoparts.com/de-CH/eur/x.html" -> "x.html"). */
const pageOfLink = (u: string) => String(u ?? "").trim().replace(/^https:\/\/(www|acc)\.apsoparts\.com/i, "").replace(/^\/[a-z]{2}-[a-z]{2,3}(\/(eur|chf))?(?=\/|$)/i, "").replace(/^\/+/, "").replace(/[?#].*$/, "");

/** A module's setting a click on the page hit: which one, and the words it holds now (plain, without its red marks). */
export type ModuleHit = { field: string; words: string };

/**
 * Which of a module's settings holds the words clicked on the page - null when they are none of its own (a product's or
 * a category's name comes from the shop). `href`: the link the click was inside, when it was - a button with the words
 * of the module's own button but another page is a TILE's (the big tile's "Alle anzeigen" while the module's link says
 * "Alle anzeigen" too, its page empty: Content v12), and its words are the tile's (./modules/tilewords.ts).
 */
export function moduleWordsAt(m: ModuleRef, was: string, href?: string | null): ModuleHit | null {
  if (!wordsKey(was)) return null;
  const s = m.settings;
  const hit = (field: string, words: string): ModuleHit => ({ field, words: words.replace(/==/g, "").trim() });
  for (const k of ["title", "eyebrow", "text"] as const) if (sameWords(was, s[k])) return hit(k, s[k]);
  // a button of the module: its words, and (a click inside a link) its page
  const isIts = (l: { label: string; url: string }) => sameWords(was, l.label) && (href === undefined || href === null || (!!l.url && pageOfLink(href) === pageOfLink(l.url)));
  if (isIts(s.link)) return hit("link", s.link.label);
  if (isIts(s.link2)) return hit("link2", s.link2.label);
  for (let i = 0; i < s.points.length; i++) {
    const p = s.points[i];
    if (sameWords(was, p.title)) return hit(`points.${i}.title`, p.title);
    if (sameWords(was, p.text)) return hit(`points.${i}.text`, p.text);
  }
  for (let i = 0; i < s.faq.length; i++) {
    const q = s.faq[i];
    if (sameWords(was, q.q)) return hit(`faq.${i}.q`, q.q);
    if (sameWords(was, q.a)) return hit(`faq.${i}.a`, q.a);
  }
  // its short settings (a date, a badge's words) - never a look, a split or a tile's words kept there
  for (const [k, v] of Object.entries(s.extra)) if (v && !/^(look-|btn-|w-|open$|split$)/.test(k) && sameWords(was, v)) return hit(`extra.${k}`, v);
  // a tile's button ("Alle anzeigen", "Zum Produkt") - the module's own words for it, or the shop's
  const tiles = tileWordsOf(s.store, s.extra);
  for (const k of TILE_WORDS) if (tiles[k] && sameWords(was, tiles[k])) return hit(`words.${k}`, tiles[k]);
  // the module's own button words while its page is not one the click was in (a button drawn without its page)
  if (sameWords(was, s.link.label)) return hit("link", s.link.label);
  if (sameWords(was, s.link2.label)) return hit("link2", s.link2.label);
  return null;
}

/** A module's setting given new words (what moduleWordsAt found). */
export function moduleFieldEdit(m: ModuleRef, field: string, now: string): ModuleRef | null {
  const next = now.replace(/\s+\n/g, "\n").trim();
  const s = m.settings;
  const set = (settings: ModuleRef["settings"]): ModuleRef => ({ ...m, settings });
  const tw = /^words\.(\w+)$/.exec(field);
  if (tw && (TILE_WORDS as readonly string[]).includes(tw[1])) {
    const k = tw[1] as TileWord;
    const extra = { ...s.extra };
    // empty, or the shop's own words again: the module says the shop's (in its language) once more
    if (!next || next === shopTileWord(s.store, k)) delete extra[TILE_KEY(k)]; else extra[TILE_KEY(k)] = next.slice(0, 40);
    return set({ ...s, extra });
  }
  if (!next) return null;
  if (field === "title" || field === "eyebrow" || field === "text") return set({ ...s, [field]: keepRed(s[field], next) });
  if (field === "link" || field === "link2") return set({ ...s, [field]: { ...s[field], label: next.slice(0, 60) } });
  const pt = /^points\.(\d+)\.(title|text)$/.exec(field);
  if (pt) { const i = Number(pt[1]); if (!s.points[i]) return null; return set({ ...s, points: s.points.map((x, j) => (j === i ? { ...x, [pt[2]]: next.slice(0, pt[2] === "title" ? 80 : 240) } : x)) }); }
  const fq = /^faq\.(\d+)\.(q|a)$/.exec(field);
  if (fq) { const i = Number(fq[1]); if (!s.faq[i]) return null; return set({ ...s, faq: s.faq.map((x, j) => (j === i ? { ...x, [fq[2]]: next.slice(0, fq[2] === "q" ? 300 : 1500) } : x)) }); }
  const ex = /^extra\.([\w-]+)$/.exec(field);
  if (ex) return set({ ...s, extra: { ...s.extra, [ex[1]]: next.slice(0, 600) } });
  return null;
}

/** What a module's setting is called, for the popup that opens on it ("Headline", "Ends (e.g. 06.12.2026)"). */
export function moduleFieldLabel(m: ModuleRef, field: string): string {
  const d = kindOf(m.type);
  const spec = (kind: string) => d.fields.find((f) => f.kind === kind) as { label?: string; item?: { title: string; text: string } } | undefined;
  if (field === "title") return spec("title")?.label ?? "Title";
  if (field === "eyebrow") return spec("eyebrow")?.label ?? "Small line above";
  if (field === "text") return spec("text")?.label ?? "Line under it";
  if (field === "link") return spec("link")?.label ?? "Button";
  if (field === "link2") return spec("link2")?.label ?? "Second button";
  const pt = /^points\.(\d+)\.(title|text)$/.exec(field);
  if (pt) { const p = spec("points"); return `${p?.label ?? "Point"} ${Number(pt[1]) + 1} · ${(pt[2] === "title" ? p?.item?.title : p?.item?.text) ?? (pt[2] === "title" ? "title" : "text")}`; }
  const fq = /^faq\.(\d+)\.(q|a)$/.exec(field);
  if (fq) return `Question ${Number(fq[1]) + 1} · ${fq[2] === "q" ? "the question" : "the answer"}`;
  const ex = /^extra\.([\w-]+)$/.exec(field);
  if (ex) return (d.fields.find((f) => f.kind === "extra" && f.key === ex[1]) as { label?: string } | undefined)?.label ?? "The module's words";
  const tw = /^words\.(\w+)$/.exec(field);
  if (tw) return "The tiles' button";
  return "The module's words";
}

/**
 * A module's text clicked and changed in the page (Content v8, point 4: "their texts by clicking them on the page"): the
 * setting that holds those words takes the new ones, so the module is drawn again from its settings and stays editable
 * there. null when the words are not the module's own (a product's or a category's name comes from the shop).
 */
export function moduleWordsEdit(m: ModuleRef, was: string, now: string, href?: string | null): { module: ModuleRef; field: string } | null {
  const at = moduleWordsAt(m, was, href);
  if (!at) return null;
  const module = moduleFieldEdit(m, at.field, now);
  return module ? { module, field: at.field } : null;
}
