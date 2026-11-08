// THE FILM ENGINE'S MOTION MATHS (08.11.2026) - ported from the team's own frame engine (black-friday-2026/video
// src/engine, compat-video src/anim.ts): a film is a pure function of the frame number, so every movement here is a
// pure function too. No dependency, no DOM - tests/studio-video.test.ts.

export type EasingFn = (t: number) => number;
type Extrapolate = "extend" | "clamp" | "identity";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Maps `input` from inputRange to outputRange piecewise (ranges ascending, same length). */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  opts: { extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate; easing?: EasingFn } = {},
): number {
  const { extrapolateLeft = "extend", extrapolateRight = "extend", easing = (t: number) => t } = opts;
  let seg = 0;
  while (seg < inputRange.length - 2 && input > inputRange[seg + 1]) seg++;
  const [inA, inB] = [inputRange[seg], inputRange[seg + 1]];
  const [outA, outB] = [outputRange[seg], outputRange[seg + 1]];
  let x = input;
  if (x < inA) {
    if (extrapolateLeft === "identity") return x;
    if (extrapolateLeft === "clamp") x = inA;
  }
  if (x > inB) {
    if (extrapolateRight === "identity") return x;
    if (extrapolateRight === "clamp") x = inB;
  }
  if (outA === outB) return outA;
  return outA + easing((x - inA) / (inB - inA)) * (outB - outA);
}

/** CSS-style cubic-bezier easing: solve x(t) = x for t, return y(t). */
export function bezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const poly = (a1: number, a2: number) => [3 * a1, 3 * a2 - 6 * a1, 1 - 3 * a2 + 3 * a1] as const;
  const [cx, bx, ax] = poly(x1, x2);
  const [cy, by, ay] = poly(y1, y2);
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = X(t) - x;
      if (Math.abs(err) < 1e-12) return t;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 100 && hi - lo > 1e-14; i++) {
      if (X(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  if (x1 === y1 && x2 === y2) return (x) => x;
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Y(solve(x)));
}

export const Easing = { linear: (t: number) => t, bezier };

/** The shop's own easing (--ease in site.css): fast out, long settle. */
export const EASE = bezier(0.22, 1, 0.36, 1);
/** In and out, for camera moves. */
export const EASE_IO = bezier(0.65, 0, 0.35, 1);
/** Gathering speed, for exits. */
export const EASE_IN = bezier(0.55, 0, 0.8, 0.2);
/** A hard landing (the BF26 film's outE). */
export const SNAP = bezier(0.16, 1, 0.3, 1);

/** Overshoot then settle: 0 -> 1 passing above 1 (s = how far). */
export const backOut = (x: number, s = 1.70158) => {
  const t = clamp(x) - 1;
  return 1 + (s + 1) * t * t * t + s * t * t;
};

/** 0..1 progress of `f` across [start, start + dur], eased. */
export const p = (f: number, start: number, dur: number, ease: EasingFn = EASE) =>
  dur <= 0 ? (f >= start ? 1 : 0) : ease(clamp((f - start) / dur));

/** Rises over [a, a + inDur], holds, falls over [b - outDur, b]. */
export const win = (f: number, a: number, b: number, inDur = 12, outDur = 10) =>
  Math.min(p(f, a, inDur), 1 - p(f, b - outDur, outDur, EASE_IN));

/**
 * Damped spring from 0 to 1, starting at rest at frame 0 (earlier frames return 0). Below critical damping it
 * oscillates; at or above it, it follows the critically damped curve (as the team's engine does).
 */
export function spring({ frame, fps, config = {} }: { frame: number; fps: number; config?: { damping?: number; stiffness?: number; mass?: number } }): number {
  const c = config.damping ?? 10;
  const k = config.stiffness ?? 100;
  const m = config.mass ?? 1;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const t = Math.max(0, frame) / fps;
  if (zeta < 1) {
    const w1 = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(w1 * t) + ((zeta * w0) / w1) * Math.sin(w1 * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** A spring starting at frame `start`, at 30 fps; damping 200 = no overshoot, 12-16 = playful. */
export const sp = (f: number, start: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}, fps = 30) =>
  spring({ frame: f - start, fps, config: { damping: 200, stiffness: 100, mass: 1, ...cfg } });

/** Keyframes of plain numbers: [frame, {key: value}] in order; between two, each key eased from one to the next. */
export function kf<T extends Record<string, number>>(f: number, keys: [number, T][], ease: EasingFn = EASE_IO): T {
  if (!keys.length) return {} as T;
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (f <= f1) {
      const t = ease(f1 === f0 ? 1 : (f - f0) / (f1 - f0));
      return Object.fromEntries(Object.keys(v0).map((k) => [k, lerp(v0[k], v1[k] ?? v0[k], t)])) as T;
    }
  }
  return keys[keys.length - 1][1];
}
