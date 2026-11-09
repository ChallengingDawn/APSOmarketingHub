// PAGE - A PAGE OF THE SHOP AS PARTS (09.11.2026). Pure: tests/studio-page-shopparts.test.ts.
//
// SARCLA's night list: a page of the shop gets a parts outline too, not only the change list - the page's own sections,
// each with its changes and its state, as a new page has Hero, Intro, Sections... The sections come from the outline the
// server reads of the page (the headings and what is under them, lines "selector · text"); where each change landed comes
// from the preview, which marks the elements a change put in or works on (data-apx-c / data-apx-x) - so a change is
// listed under the section it really changed, not guessed from its selector.

import type { Change } from "../../../../convert/versions";
import type { PageOutline } from "./model";

export type ShopLine = { depth: number; sel: string; tag: string; text: string };

/** One line of the outline: "    h2.title · Some words" -> its depth, selector, tag and words. */
export function parseLine(l: string): ShopLine | null {
  const m = /^( *)(\S+) · (.*)$/.exec(l);
  if (!m) return null;
  const sel = m[2];
  const tag = (/^[a-z][a-z0-9]*/i.exec(sel)?.[0] ?? "").toLowerCase();
  return { depth: Math.floor(m[1].length / 2), sel, tag, text: m[3].trim() };
}

/** The heading levels a page is cut into: h1 and h2 - and h3 too when the page has fewer than two of those. */
export function sectionLevels(tags: string[]): Set<string> {
  const top = tags.filter((t) => t === "h1" || t === "h2").length;
  return new Set(top >= 2 ? ["h1", "h2"] : ["h1", "h2", "h3"]);
}

/** A heading's words, made comparable (case, spaces, the outline's cut). */
export const headKey = (s: string) => s.replace(/…$/, "").replace(/\s+/g, "").toLowerCase().slice(0, 80);

export type ShopPart = {
  id: string;
  /** the heading's words (or "Top of the page" for what comes before the first) */
  name: string;
  tag: string;
  /** the heading's selector in the outline, and its words - to find it in the preview */
  selector: string;
  heading: string;
  /** one line of what it says under the heading */
  summary: string;
  /** the outline's lines in it */
  size: number;
  /** the changes that landed in it (their index in the change list) */
  changes: number[];
};

/** Where the preview found the changes: each section heading's words, and the changes between it and the next one. */
export type Located = { heading: string; changes: number[] }[];

/** Words cut to `n` at a word, with "…". */
const words = (s: string, n = 64) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  let cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  if (sp > n * 0.6) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,;:–-]+$/u, "")}…`;
};

/**
 * The page's sections, from its outline, each with the changes the preview located in it. `whole`: the changes that are
 * the page's as a whole (a stylesheet) - `elsewhere`: those the preview found outside every section, or did not find.
 */
export function shopPartsOf(outline: PageOutline | null, changes: Change[], located: Located | null, max = 14): { parts: ShopPart[]; whole: number[]; elsewhere: number[] } {
  // a heading listed by its id (#page-title-heading) is known as the h1 by its words (the outline keeps the h1s apart)
  const h1s = new Set((outline?.h1 ?? []).map(headKey));
  const lines = (outline?.lines ?? []).map(parseLine).filter((l): l is ShopLine => !!l)
    .map((l) => (l.sel.startsWith("#") && h1s.has(headKey(l.text)) ? { ...l, tag: "h1" } : l));
  const levels = sectionLevels(lines.map((l) => l.tag));
  const parts: ShopPart[] = [];
  let cur: ShopPart | null = null;
  for (const l of lines) {
    const isHead = levels.has(l.tag) && l.text.length > 1;
    if (isHead && parts.length < max) {
      cur = { id: `s${parts.length}`, name: words(l.text, 52), tag: l.tag, selector: l.sel, heading: l.text, summary: "", size: 1, changes: [] };
      parts.push(cur);
      continue;
    }
    if (!cur) {
      cur = { id: "top", name: "Top of the page", tag: "top", selector: "", heading: "", summary: "", size: 0, changes: [] };
      parts.push(cur);
    }
    cur.size++;
    if (!cur.summary && l.text && !/^\[(picture|field):/.test(l.text) && l.text.length > 2) cur.summary = words(l.text, 90);
  }
  // a "top" with nothing worth showing is no part
  if (parts[0]?.id === "top" && !parts[0].summary) parts.shift();

  const whole: number[] = [];
  const placed = new Set<number>();
  changes.forEach((c, i) => { if (c.op === "css") { whole.push(i); placed.add(i); } });
  if (located) {
    const byKey = new Map(parts.map((p) => [headKey(p.heading), p]));
    for (const loc of located) {
      const p = byKey.get(headKey(loc.heading)) ?? parts.find((x) => x.heading && headKey(loc.heading).startsWith(headKey(x.heading).slice(0, 40)));
      if (!p) continue;
      for (const i of loc.changes) if (i >= 0 && i < changes.length && !placed.has(i)) { p.changes.push(i); placed.add(i); }
    }
    for (const p of parts) p.changes.sort((a, b) => a - b);
  }
  const elsewhere = located ? changes.map((_, i) => i).filter((i) => !placed.has(i)) : [];
  return { parts, whole, elsewhere };
}
