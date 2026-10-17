// CURVED TEXT (canvas list 21).
//
// A badge ("SINCE 1920", "MADE IN SWITZERLAND" round a seal), a sticker, the
// arch over a product shot: every one of them needs type on a curve, and the
// workaround without it is to set the words one at a time and rotate each by
// hand, which nobody does twice.
//
// The curve is described by its SAGITTA - how far the middle of the arc bows
// away from the straight line between its ends - as a percentage of half the
// width. That is the quantity a person is actually adjusting when they drag a
// curve slider, and unlike an angle it stays well-behaved as it approaches
// zero: a 0% bow is a straight line, not a circle of infinite radius that has
// to be special-cased out of a division.
//
// Canvas y grows DOWNWARD. A positive curve arches the text over the top,
// like a rainbow, so its middle sits at a NEGATIVE y.

export type Arc = {
  /** An SVG path for Konva's TextPath. */
  d: string;
  /** Where the middle of the arc sits, relative to the ends. Negative = up. */
  midY: number;
  /** The circle's radius. Infinity for a straight line. */
  r: number;
};

/** The usable range. Beyond this the ends meet and the text overlaps itself. */
export const CURVE_MIN = -100;
export const CURVE_MAX = 100;

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The path the glyphs sit on.
 *
 * curve is -100..100. 0 is a straight line; 100 bows the middle up by half
 * the width, which is a half circle.
 */
export function arcPath(width: number, curve: number): Arc {
  const w = Math.max(1, width);
  const c = Math.max(CURVE_MIN, Math.min(CURVE_MAX, curve || 0));

  // Treated as straight, because a 0.4% bow is a straight line that costs a
  // radius of eight thousand pixels to express.
  if (Math.abs(c) < 1) return { d: `M 0 0 L ${round(w)} 0`, midY: 0, r: Infinity };

  const half = w / 2;
  // The bow, in pixels. Negative y is up, and a positive curve arches up.
  const sagitta = (Math.abs(c) / 100) * half;
  const r = (sagitta * sagitta + half * half) / (2 * sagitta);

  // SVG's sweep flag decides which way round the circle the pen travels, and
  // with y pointing down, sweep 1 is clockwise: from the left end that climbs
  // over the top. Which is the arch.
  const sweep = c > 0 ? 1 : 0;
  const midY = c > 0 ? -sagitta : sagitta;
  // largeArc stays 0: the sagitta can only ever describe the minor arc of its
  // own circle, up to the half circle at 100 where the two are the same.
  return {
    d: `M 0 0 A ${round(r)} ${round(r)} 0 0 ${sweep} ${round(w)} 0`,
    midY: round(midY),
    r: round(r),
  };
}

/**
 * How much taller the curved text is than its straight self.
 *
 * Needed so an arched line does not silently overlap whatever sits above it:
 * the node keeps its y, and the box it occupies grows by this much.
 */
export function arcHeight(width: number, curve: number, fontSize: number): number {
  const { midY } = arcPath(width, curve);
  return Math.abs(midY) + fontSize * 1.2;
}
