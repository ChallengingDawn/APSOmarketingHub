// WHERE THINGS GO WITHOUT COVERING THE POST'S WORDS (night of 09.11.2026, the lead's review of the social studio):
//   placeLabel   the selected element's small label ("Headline · Ask AI · ×") sits where it covers no other element:
//                above the selection if there is room, else below, else inside its top-right corner
//   freeBand     the tallest stretch of the board no element takes - where new picture frames go
// Pure: tests/studio-social-canvas.test.ts.

export type Box = { x: number; y: number; w: number; h: number };

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Elements that are the page's background (a shape or picture over half the board) do not count as "covered". */
export function foreground(boxes: Box[], board: Box | null): Box[] {
  if (!board) return boxes;
  const area = board.w * board.h;
  return boxes.filter((b) => b.w * b.h < area * 0.5);
}

/**
 * The label's place for a selection `sel`, among the other elements' boxes, inside a view `viewW` x `viewH`; `w` is the
 * label's width, `h` its height. Above (left, then right aligned), below (left, then right), else inside top-right.
 */
export function placeLabel(sel: Box, others: Box[], board: Box | null, w: number, viewW: number, viewH: number, h = 26, gap = 6): { x: number; y: number } {
  const keep = foreground(others, board);
  const clampX = (x: number) => Math.max(4, Math.min(viewW - w - 4, x));
  const cands = [
    { x: clampX(sel.x), y: sel.y - h - gap },
    { x: clampX(sel.x + sel.w - w), y: sel.y - h - gap },
    { x: clampX(sel.x), y: sel.y + sel.h + gap },
    { x: clampX(sel.x + sel.w - w), y: sel.y + sel.h + gap },
  ];
  for (const c of cands) {
    if (c.y < 2 || c.y + h > viewH - 2) continue;
    const me = { x: c.x, y: c.y, w, h };
    if (!keep.some((b) => overlaps(me, b))) return c;
  }
  return { x: clampX(sel.x + sel.w - w - 4), y: Math.max(2, sel.y + 4) };
}

/**
 * The tallest horizontal stretch of a board `W` x `H` that no box takes, inside the margin `m` (null when none is at
 * least `min` high). Boxes over half the board (a background) do not count.
 */
export function freeBand(boxes: Box[], W: number, H: number, m: number, min: number): { y: number; h: number } | null {
  const board = { x: 0, y: 0, w: W, h: H };
  const spans = foreground(boxes, board).map((b) => [Math.max(m, b.y), Math.min(H - m, b.y + b.h)] as const).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let best: { y: number; h: number } | null = null;
  let at = m;
  for (const [a, b] of [...spans, [H - m, H - m] as const]) {
    if (a - at > (best?.h ?? 0)) best = { y: at, h: a - at };
    at = Math.max(at, b);
  }
  return best && best.h >= min ? best : null;
}
