// THE CUTS (08.11.2026), always on a bar line: a WHIP (the old shot flies out left in a blur, the new one flies in from
// the right), a SWEEP (a petrol band with the red edge crosses the frame and the new shot is under it), a LIFT (the
// camera tilts: up and out, the new shot rises from below). The film's first shot opens calm instead.
// Pure - tests/studio-video.test.ts.

import { clamp, EASE, EASE_IN, EASE_IO, SNAP } from "../engine/math";
import type { Segment } from "../model";

export type Fx = { x: number; y: number; scale: number; blur: number; skew: number; opacity: number };
export const STILL: Fx = { x: 0, y: 0, scale: 1, blur: 0, skew: 0, opacity: 1 };

/** No "-0" in a transform. */
const z = (v: number) => (v === 0 ? 0 : v);
const tidy = (q: Fx): Fx => ({ x: z(q.x), y: z(q.y), scale: q.scale, blur: z(q.blur), skew: z(q.skew), opacity: q.opacity });

/** Frames each cut takes on either side of its bar line. */
export const CUT_FRAMES = { whipOut: 6, whipIn: 8, liftOut: 7, liftIn: 9, sweepHalf: 10, open: 16 } as const;

/** How a shot comes in, `local` frames after its bar line. */
export function enterFx(cut: Segment["cut"], local: number, W: number, H: number): Fx {
  return tidy(enterRaw(cut, local, W, H));
}
function enterRaw(cut: Segment["cut"], local: number, W: number, H: number): Fx {
  const C = CUT_FRAMES;
  if (cut === "open") {
    const u = clamp(local / C.open);
    return { ...STILL, opacity: EASE_IO(u), scale: 1.035 - 0.035 * EASE_IO(clamp(local / 40)), blur: (1 - u) * 6 };
  }
  if (cut === "whip") {
    const u = clamp(local / C.whipIn);
    const e = SNAP(u);
    return { ...STILL, x: (1 - e) * W * 0.5, blur: (1 - u) * 26, skew: (1 - u) * -9 };
  }
  if (cut === "lift") {
    const u = clamp(local / C.liftIn);
    const e = SNAP(u);
    return { ...STILL, y: (1 - e) * H * 0.42, blur: (1 - u) * 22, scale: 0.96 + 0.04 * e };
  }
  // sweep: under the band, the new shot settles from a little closer
  return { ...STILL, scale: 1.06 - 0.06 * SNAP(clamp(local / 16)) };
}

/** How a shot leaves, `local` frames into its `dur`, when the next one cuts in with `next`. */
export function exitFx(next: Segment["cut"] | null, local: number, dur: number, W: number, H: number): Fx {
  return tidy(exitRaw(next, local, dur, W, H));
}
function exitRaw(next: Segment["cut"] | null, local: number, dur: number, W: number, H: number): Fx {
  const C = CUT_FRAMES;
  if (next === "whip") {
    const u = clamp((local - (dur - C.whipOut)) / C.whipOut);
    const e = u * u;
    return { ...STILL, x: -e * W * 0.55, blur: e * 26, skew: e * -9 };
  }
  if (next === "lift") {
    const u = clamp((local - (dur - C.liftOut)) / C.liftOut);
    const e = u * u;
    return { ...STILL, y: -e * H * 0.5, blur: e * 22, scale: 1 + 0.03 * e };
  }
  if (next === "sweep") {
    const u = clamp((local - (dur - C.sweepHalf)) / C.sweepHalf);
    return { ...STILL, scale: 1 + 0.03 * u * u };
  }
  return STILL;
}

/** Two movements on one shot. */
export const combine = (a: Fx, b: Fx): Fx => ({ x: a.x + b.x, y: a.y + b.y, scale: a.scale * b.scale, blur: a.blur + b.blur, skew: a.skew + b.skew, opacity: a.opacity * b.opacity });

export const fxTransform = (q: Fx) => `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) skewX(${q.skew.toFixed(2)}deg) scale(${q.scale.toFixed(4)})`;

export type Band = { left: number; width: number; slant: number };

/**
 * The sweep's band at frame `f` for a cut on `at`, or null when it is off screen: a slanted band (its top `slant` px
 * ahead of its bottom) that rushes in, covers the whole frame from two frames before the bar line to two after -
 * so the cut under it is never seen - and rushes out.
 */
export function sweepBand(f: number, at: number, W: number, H: number): Band | null {
  const h = CUT_FRAMES.sweepHalf;
  if (f < at - h || f >= at + h) return null;
  const slant = H * 0.18;
  const width = 1.5 * W + slant;
  const from = -width - slant - 10;
  const a = 1.12 * W - width;
  const b = -slant - 0.12 * W;
  const to = W + 10;
  let left: number;
  if (f < at - 2) left = from + (a - from) * EASE(clamp((f - (at - h)) / (h - 2)));
  else if (f <= at + 2) left = a + (b - a) * ((f - (at - 2)) / 4);
  else left = b + (to - b) * EASE_IN(clamp((f - (at + 2)) / (h - 2)));
  return { left, width, slant };
}

/** The band hides the whole frame. */
export const covers = (b: Band | null, W: number) => !!b && b.left + b.slant <= 0 && b.left + b.width >= W;

/** The shot's movement at local frame `local`: how it came in, how it leaves. */
export function shotFx(seg: Segment, next: Segment | null, local: number, W: number, H: number): Fx {
  return combine(enterFx(seg.cut, local, W, H), exitFx(next ? next.cut : null, local, seg.dur, W, H));
}
