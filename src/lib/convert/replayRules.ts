// The visit replay's rule, pure (tested): where the visitor was at a moment of a recorded page view.
// Moments: [ms since the page opened, kind, a, b] - 0 pointer (a = x in thousandths of the window, b = y on the page),
// 1 scroll (a = scrolled px, b = the page's height), 2 click (as the pointer). Sorted by time.

export type Moment = [number, 0 | 1 | 2, number, number];

/** Where the visitor was at time t: scrolled px, the page's height, the pointer (x in thousandths, y on the page). */
export function stateAt(ev: Moment[], t: number): { scroll: number; dh: number; px: number | null; py: number | null; clicks: { x: number; y: number; age: number }[] } {
  let scroll = 0, dh = 0, px: number | null = null, py: number | null = null;
  const clicks: { x: number; y: number; age: number }[] = [];
  for (const [mt, k, a, b] of ev) {
    if (mt > t) break;
    if (k === 1) { scroll = a; dh = b || dh; }
    else { px = a; py = b; if (k === 2 && t - mt < 700) clicks.push({ x: a, y: b, age: t - mt }); }
  }
  return { scroll, dh, px, py, clicks };
}
