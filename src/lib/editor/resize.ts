// RESIZING THE ARTBOARD (canvas list 26).
//
// One design has to become a LinkedIn post, a square, a story and a banner.
// Changing the canvas size used to call setCanvas and nothing else, so going
// from 1200x627 to 1080x1920 left the whole layout clustered in the top-left
// corner of a tall board - the design was not resized, it was stranded, and
// nothing said so.
//
// What a resize has to get right:
//
//   - TYPE MUST NOT DISTORT. Sizes scale by ONE factor, the smaller of the
//     two ratios, so a headline stays its own shape. Scaling x and y
//     separately is how you get type that is 40% too wide.
//   - A FULL-BLEED LAYER STAYS FULL BLEED. Every seeded layout has a scrim
//     over the whole board; scaled like an ordinary object it shrinks and
//     leaves a band of bare background down one side, which looks like a
//     rendering fault rather than a resize.
//   - THE COMPOSITION KEEPS ITS SPACING. One uniform factor for positions as
//     well as sizes, so the gap between a kicker and its headline is still
//     the same gap. Then the whole thing is re-centred on the new board,
//     which is the sanest starting point a person can adjust from.
//   - NOTHING ENDS UP OFF THE BOARD. An object outside the canvas cannot be
//     clicked, so it is invisible AND unfixable.

export type Box = { w: number; h: number };

export type Reflowable = {
  kind: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  strokeWidth?: number;
  letterSpacing?: number;
  cornerRadius?: number;
  blur?: number;
};

/** A layer that covered the old board, within a percent or so. */
export function isFullBleed(n: Reflowable, from: Box): boolean {
  const w = n.width ?? 0;
  const h = n.height ?? 0;
  if (!(w > 0 && h > 0)) return false;
  return (
    n.x <= from.w * 0.02 &&
    n.y <= from.h * 0.02 &&
    w >= from.w * 0.98 &&
    h >= from.h * 0.98
  );
}

/** The one factor everything is scaled by. */
export function scaleFor(from: Box, to: Box): number {
  if (!(from.w > 0 && from.h > 0 && to.w > 0 && to.h > 0)) return 1;
  return Math.min(to.w / from.w, to.h / from.h);
}

/**
 * Move a design onto a board of another size.
 *
 * Returns the SAME ARRAY when nothing would change, so a resize to the size
 * it already is does not land in the undo history as a step that did nothing.
 */
export function reflow<T extends Reflowable>(nodes: T[], from: Box, to: Box): T[] {
  if (!(from.w > 0 && from.h > 0 && to.w > 0 && to.h > 0)) return nodes;
  if (from.w === to.w && from.h === to.h) return nodes;
  if (nodes.length === 0) return nodes;

  const k = scaleFor(from, to);

  // The bounds of everything that is NOT full bleed - that is the
  // composition, and it is what gets centred. Including the scrim would make
  // the bounds the whole board every time and centre nothing.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (isFullBleed(n, from)) continue;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.width ?? 0));
    maxY = Math.max(maxY, n.y + (n.height ?? n.fontSize ?? 0));
  }
  const hasComposition = minX !== Infinity;
  // Where the scaled composition would sit, and the nudge that centres it.
  const shiftX = hasComposition ? (to.w - (maxX - minX) * k) / 2 - minX * k : 0;
  const shiftY = hasComposition ? (to.h - (maxY - minY) * k) / 2 - minY * k : 0;

  const scaleSize = (v: number | undefined) => (v === undefined ? undefined : v * k);

  return nodes.map((n) => {
    if (isFullBleed(n, from)) {
      // Re-stretched, not scaled: a scrim is the board, whatever size it is.
      return { ...n, x: 0, y: 0, width: to.w, height: to.h };
    }
    const width = scaleSize(n.width);
    const height = scaleSize(n.height);
    const x = n.x * k + shiftX;
    const y = n.y * k + shiftY;
    const out: T = {
      ...n,
      // Clamped so nothing lands off the board, where it could be neither
      // seen nor clicked. The clamp keeps at least a corner reachable.
      x: Math.min(Math.max(x, -(width ?? 0) * 0.5), to.w - Math.min(width ?? 0, to.w) * 0.5),
      y: Math.min(Math.max(y, -(height ?? 0) * 0.5), to.h - Math.min(height ?? 0, to.h) * 0.5),
    };
    if (width !== undefined) out.width = width;
    if (height !== undefined) out.height = height;
    // Round the type: a 23.4px font is a pointless number in a style panel.
    if (n.fontSize !== undefined) out.fontSize = Math.max(8, Math.round(n.fontSize * k));
    if (n.strokeWidth !== undefined) out.strokeWidth = n.strokeWidth * k;
    if (n.letterSpacing !== undefined) out.letterSpacing = n.letterSpacing * k;
    if (n.cornerRadius !== undefined) out.cornerRadius = n.cornerRadius * k;
    if (n.blur !== undefined) out.blur = n.blur * k;
    return out;
  });
}

/** "1200 × 627" - the one place that spelling is decided. */
export function sizeLabel(box: Box): string {
  return `${Math.round(box.w)} × ${Math.round(box.h)}`;
}
