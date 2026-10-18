// CUTTING THE BACKGROUND OUT OF A PICTURE (canvas list 32).
//
// Two ways to get a part on a transparent background, and they are not
// interchangeable:
//
//   1. THIS. The photograph already has a flat backdrop - which product shots
//      almost always do - so the backdrop is removed arithmetically and the
//      subject's pixels are untouched. No service, no model, no cost, and the
//      part in the result is the part that was photographed.
//
//   2. Asking the assistant to redraw the subject without a background. That
//      works on a GENERATED picture, where redrawing is the point. It must
//      never be the default for a real article: an AI redraw of a seal is a
//      drawing of a seal, and putting it in a catalogue is a claim about a
//      product that nobody photographed.
//
// So this is the default and the model is the fallback.
//
// The method is a flood fill inward from the edges, not "delete every pixel
// near the corner colour". The difference matters: a part that is the same
// white as the backdrop keeps its own white, because the fill cannot reach
// inside it. Deleting by colour alone punches holes through the subject.

export type CutoutOptions = {
  /**
   * How different a pixel may be from the backdrop and still count as
   * backdrop, 0-255 over the squared RGB distance. 32 copes with the
   * vignetting and sensor noise of a real photo; much more starts eating
   * soft edges.
   */
  tolerance?: number;
};

export type CutoutResult = {
  /** How much of the picture was removed, 0-1. */
  removed: number;
  /** False when the edges are not one flat colour, so nothing was touched. */
  ok: boolean;
};

/** The four corners agreeing is what makes a backdrop a backdrop. */
function cornerColour(
  d: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } | null {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return { r: d[i], g: d[i + 1], b: d[i + 2] };
  };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const [first] = corners;
  for (const c of corners) {
    // Generous here on purpose: a photographed backdrop is lit unevenly, and
    // demanding four identical corners would refuse every real photograph.
    if (dist2(c, first) > 48 * 48) return null;
  }
  return {
    r: Math.round(corners.reduce((a, c) => a + c.r, 0) / 4),
    g: Math.round(corners.reduce((a, c) => a + c.g, 0) / 4),
    b: Math.round(corners.reduce((a, c) => a + c.b, 0) / 4),
  };
}

function dist2(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Make the flat backdrop transparent, in place.
 *
 * `data` is RGBA, four bytes per pixel, as a canvas gives it.
 */
export function cutoutBackdrop(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opts: CutoutOptions = {},
): CutoutResult {
  if (!(w > 0 && h > 0) || data.length < w * h * 4) return { ok: false, removed: 0 };
  const backdrop = cornerColour(data, w, h);
  if (!backdrop) return { ok: false, removed: 0 };

  const tol = opts.tolerance ?? 32;
  const tol2 = tol * tol;
  const seen = new Uint8Array(w * h);
  // An explicit stack of indices. Recursion blows up at about a megapixel,
  // and these are four-megapixel photographs.
  const stack: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    if (dist2({ r: data[p * 4], g: data[p * 4 + 1], b: data[p * 4 + 2] }, backdrop) > tol2) return;
    seen[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }

  let removed = 0;
  while (stack.length > 0) {
    const p = stack.pop() as number;
    data[p * 4 + 3] = 0;
    removed += 1;
    const x = p % w;
    const y = (p - x) / w;
    // Four-connected. Eight would creep through a one-pixel diagonal gap in
    // a thin part and hollow it out from the inside.
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  return { ok: true, removed: removed / (w * h) };
}

/**
 * Is the result worth offering?
 *
 * Nearly nothing removed means the backdrop was not flat after all; nearly
 * everything removed means the subject was the same colour as its backdrop
 * and has gone with it. Both are better reported than shown.
 */
export function cutoutVerdict(r: CutoutResult): { good: boolean; why: string } {
  if (!r.ok) {
    return { good: false, why: "The edges of this picture are not one flat colour, so there is no backdrop to remove." };
  }
  if (r.removed < 0.02) {
    return { good: false, why: "Almost nothing was removed — the background is not flat enough to cut out." };
  }
  if (r.removed > 0.97) {
    return { good: false, why: "That removed nearly the whole picture — the subject is the same colour as its background." };
  }
  return { good: true, why: `${Math.round(r.removed * 100)}% of the picture was background.` };
}

/**
 * The size to work at.
 *
 * The result is written back into the document as a PNG data URL, and a src
 * is capped at 8 MB by the schema. A cut-out from a 4000x3000 original
 * base64s to roughly 18 MB, so the design would fail to save AFTER somebody
 * had watched the cut-out work on screen - the worst shape a bug can take.
 * The same 8 MB is the request-body limit on /api/image, so an uncapped
 * reference comes back 413.
 *
 * 1600px on the longest edge keeps a PNG with alpha near 2 MB and is still
 * more resolution than a 1920px board can show. Smaller pictures are left
 * exactly as they are: this only ever scales down.
 */
export function fitWithin(w: number, h: number, maxEdge = 1600): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w: Math.round(w), h: Math.round(h) };
  const k = maxEdge / longest;
  // At least one pixel each way: a 4000x3 panorama must not round to zero.
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
