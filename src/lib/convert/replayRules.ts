// The visit replay's rule, pure (tested): where the visitor was at a moment of a recorded page view.
// Moments: [ms since the page opened, kind, a, b] - 0 pointer (a = x in thousandths of the window, b = y on the page),
// 1 scroll (a = scrolled px, b = the page's height), 2 click (as the pointer). Sorted by time.
//
// THE CLICKS, SEEN (SARCLA 13.11.2026: "on video we still don't see where the customer clicks"): a click was a ring for
// 0.7 s of the recording - at 2x a third of a second, missed. Now every click of the page view is listed (when, where, the
// page scrolled how far), stays on the page as a numbered mark once the playback has passed it, and a recorded page view
// is put to its step of the visit played back (recordedSteps). What was clicked is read from the page as drawn
// (clickName) - the recording keeps only the position, never the element.

export type Moment = [number, 0 | 1 | 2, number, number];

/** Where the visitor was at time t: scrolled px, the page's height, the pointer (x in thousandths, y on the page) and the
 *  clicks of the last `ripple` ms (each with its age) - those are drawn as a ring. */
export function stateAt(ev: Moment[], t: number, ripple = 700): { scroll: number; dh: number; px: number | null; py: number | null; clicks: { x: number; y: number; age: number }[] } {
  let scroll = 0, dh = 0, px: number | null = null, py: number | null = null;
  const clicks: { x: number; y: number; age: number }[] = [];
  for (const [mt, k, a, b] of ev) {
    if (mt > t) break;
    if (k === 1) { scroll = a; dh = b || dh; }
    else { px = a; py = b; if (k === 2 && t - mt < ripple) clicks.push({ x: a, y: b, age: t - mt }); }
  }
  return { scroll, dh, px, py, clicks };
}

/** One click of a page view: its number (1, 2…), when (ms since the page opened), where (x in thousandths of the window,
 *  y on the page), how far the page was scrolled then, and `n` - 2 or more for a double click (one place, one moment). */
export type ReplayClick = { k: number; t: number; x: number; y: number; scroll: number; n: number };

/** Every click of a page view (moments sorted by time), a double click once with n 2. */
export function clicksOf(ev: Moment[]): ReplayClick[] {
  const out: ReplayClick[] = [];
  let scroll = 0;
  for (const [t, k, a, b] of ev) {
    if (k === 1) { scroll = a; continue; }
    if (k !== 2) continue;
    const last = out[out.length - 1];
    if (last && t - last.t <= 500 && Math.abs(a - last.x) <= 10 && Math.abs(b - last.y) <= 12) { last.n++; continue; }
    out.push({ k: out.length + 1, t, x: a, y: b, scroll, n: 1 });
  }
  return out;
}

/** Skipping the still parts (nothing moved for more than `gap` ms): the time the clock jumps to from t - half a second
 *  before the next moment, or the page view's `end` after its last moment - else t itself (the next moment is near). */
export function skipIdle(ev: Moment[], t: number, end = Infinity, gap = 2500): number {
  for (const [mt] of ev) {
    if (mt <= t) continue;
    return mt - t > gap ? mt - 500 : t;
  }
  return Number.isFinite(end) && end - t > gap ? end : t;
}

/** The smallest box holding the point (x, y), boxes in page px - the element a click landed on; -1 for none. */
export function smallestAt(boxes: { x: number; y: number; w: number; h: number }[], x: number, y: number): number {
  let best = -1, area = Infinity;
  boxes.forEach((b, i) => {
    if (!(b.w > 0 && b.h > 0) || x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return;
    const a = b.w * b.h;
    if (a < area) { area = a; best = i; }
  });
  return best;
}

const WHAT: Record<string, string> = {
  a: "Link", button: "Button", input: "Field", select: "Choice", textarea: "Text field", label: "Label", img: "Picture",
  h1: "Title", h2: "Heading", h3: "Heading", h4: "Heading", li: "List item", td: "Table cell", th: "Table header",
  span: "Text", p: "Text", svg: "Icon", path: "Icon", picture: "Picture", nav: "Menu", header: "Page header", footer: "Page footer",
};

/** What was clicked, in words: what the element is and its own words - "Link · “Dichtungen”", "Button · “In den Warenkorb”". */
export function clickName(el: { tag: string; type?: string | null; role?: string | null; aria?: string | null; alt?: string | null; title?: string | null; placeholder?: string | null; text?: string | null; imgAlt?: string | null }): string {
  const tag = (el.tag || "").toLowerCase();
  const what = el.role === "button" ? "Button" : tag === "input" && /^(submit|button|image)$/i.test(el.type ?? "") ? "Button" : WHAT[tag] ?? "On the page";
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  let words = clean(el.aria) || clean(el.alt) || clean(el.text) || clean(el.placeholder) || clean(el.title) || clean(el.imgAlt);
  if (words.length > 48) words = `${words.slice(0, 47).trimEnd()}…`;
  return words ? `${what} · “${words}”` : what;
}

/** A shop path as both sides write it: no query, no #, no closing slash (the home page stays "/"), small letters. */
const pathKey = (p: string) => {
  const s = p.split(/[?#]/)[0].toLowerCase();
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
};

/**
 * Which recorded page view belongs to which step of a visit: the same page, opened within `slackMs` of the step's
 * minute (the closest first; each page view to one step). Step index -> the page view.
 */
export function recordedSteps<R extends { pv: string; path: string; started_at: string }>(
  steps: { at: string; path: string | null }[], rows: R[], slackMs = 5 * 60_000,
): Map<number, R> {
  const pairs: { i: number; r: number; d: number }[] = [];
  steps.forEach((s, i) => {
    if (!s.path) return;
    const at = Date.parse(s.at);
    if (!Number.isFinite(at)) return;
    rows.forEach((row, r) => {
      if (pathKey(row.path) !== pathKey(s.path!)) return;
      const d = Math.abs(Date.parse(row.started_at) - at);
      if (Number.isFinite(d) && d <= slackMs) pairs.push({ i, r, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d || a.i - b.i);
  const out = new Map<number, R>(), used = new Set<number>();
  for (const p of pairs) {
    if (out.has(p.i) || used.has(p.r)) continue;
    out.set(p.i, rows[p.r]);
    used.add(p.r);
  }
  return out;
}
