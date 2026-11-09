// APSOconvert > the CLICK MAP's rules (./clicks.ts reads the shop's gateway), pure so they are tested. SARCLA 08.11.2026:
// "visualize the journey of the customer here, click like Microsoft Clarity" - asked Clarity or our own: "our own click
// map". The gateway counts, per page and day, which element was clicked (a short selector) and where inside it (in
// tenths, 0-9 across and down), desktop or phone - no person, no text. Here: those counts made into one heat item per
// element for the Preview frame to draw, and the element named in words a person reads.

import { createHash } from "node:crypto";

/** One count as the gateway answers it: the element, the tenth inside it, desktop (d) or phone (m), how many. */
export type ClickRow = { s: string; x: number; y: number; dev: "d" | "m"; n: number };
/** One element's clicks, for the frame: its selector, how many, and the 100 tenths (row by row) - c[y * 10 + x]. */
export type HeatItem = { s: string; n: number; c: number[]; label: string };
export type Heat = { list: HeatItem[]; max: number; total: number; desktop: number; phone: number };
export type Dev = "all" | "d" | "m";

/** How long a click map counts when a person switches it on, and the longest look back. */
export const CLICKMAP = { days: 30, maxItems: 40, lookBack: 90 } as const;

/** One map per page and host, under an id the gateway takes (letters, digits, - and _): the same page, the same id. */
export function mapIdFor(host: string, path: string): string {
  return "p-" + createHash("sha1").update(`${host.toLowerCase()}|${path}`).digest("hex").slice(0, 20);
}

/** The counts made into heat: an item per element (the most clicked first, 40 at most), for desktop, phone or both. */
export function heatOf(rows: ClickRow[], dev: Dev = "all"): Heat {
  const by = new Map<string, HeatItem>();
  let desktop = 0, phone = 0;
  for (const r of rows) {
    if (!r || typeof r.s !== "string" || !Number.isFinite(r.n) || r.n <= 0) continue;
    if (r.dev === "m") phone += r.n; else desktop += r.n;
    if (dev !== "all" && r.dev !== dev) continue;
    const x = Math.trunc(r.x), y = Math.trunc(r.y);
    if (x < 0 || x > 9 || y < 0 || y > 9) continue;
    let it = by.get(r.s);
    if (!it) { it = { s: r.s, n: 0, c: new Array(100).fill(0), label: elementLabel(r.s) }; by.set(r.s, it); }
    it.n += r.n;
    it.c[y * 10 + x] += r.n;
  }
  const all = [...by.values()].sort((a, b) => b.n - a.n || a.s.localeCompare(b.s));
  const total = all.reduce((t, i) => t + i.n, 0);
  const list = all.slice(0, CLICKMAP.maxItems);
  return { list, max: list[0]?.n ?? 0, total, desktop, phone };
}

const TAG_WORD: Record<string, string> = {
  a: "Link", button: "Button", input: "Field", select: "Choice", textarea: "Text field", label: "Label", img: "Picture",
  h1: "Title", h2: "Heading", h3: "Heading", h4: "Heading", li: "List item", td: "Table cell", th: "Table header",
  span: "Text", p: "Text", div: "Block", section: "Section", nav: "Menu", header: "Page header", footer: "Page footer",
  form: "Form", table: "Table", tr: "Table row", ul: "List", main: "Main column", svg: "Icon", picture: "Picture",
};
const words = (s: string) => s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** An element in words: what it is (a button, a link…) and its own name - "Button · product addtocart button". */
export function elementLabel(sel: string): string {
  const parts = sel.split(" > ").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? sel;
  const id = /#([A-Za-z][\w-]*)/.exec(last)?.[1];
  const tag = /^([a-z][a-z0-9-]*)/.exec(last)?.[1] ?? "";
  const classes = [...last.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  const what = TAG_WORD[tag] ?? (tag ? tag : "Element");
  // an id names the element best; else its first class (the rest are the theme's: "ui-menu-item-wrapper"); else the block
  // it sits in
  const name = id ? words(id) : classes.length ? words(classes[0]) : parts.length > 1 ? words((/[#.]([A-Za-z_][\w-]*)/.exec(parts[parts.length - 2]) ?? [])[1] ?? "") : "";
  return name ? `${what} · ${name}` : what;
}

/** The days to read: the last `days` Swiss days up to `today` (YYYY-MM-DD), 1-90. */
export function dayRange(today: string, days: number): { from: string; to: string } {
  const n = Math.max(1, Math.min(CLICKMAP.lookBack, Math.trunc(days) || CLICKMAP.days));
  const t = Date.parse(`${today}T12:00:00Z`);
  const from = new Date(t - (n - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to: today };
}

/** The day a map switched on today stops counting (the Swiss day, `days` from today). */
export function untilDay(today: string, days: number = CLICKMAP.days): string {
  return new Date(Date.parse(`${today}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
