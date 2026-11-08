// PHYSICAL ENTRANCES (08.11.2026): a part that drops and bounces, an O-ring that rolls in and rocks to rest, a button
// that hops on the bar. SARCLA's rule for our films: things arrive like real objects - roll, drop, spring - never a
// plain fade. Pure functions of the frame - tests/studio-video.test.ts.

import { clamp, EASE_IO } from "./math";

export type Drop = {
  /** Height above the floor, px (0 = on it). */
  y: number;
  /** How hard it just hit: 1 on the first impact, falling off fast - for squash and the shadow. */
  squash: number;
  /** It has touched the floor at least once. */
  landed: boolean;
};

/**
 * Dropped from `h0` px at frame `start`, it reaches the floor `fall` frames later and bounces with restitution `e`
 * (each bounce keeps that share of its speed), `bounces` times, then rests.
 */
export function drop(f: number, start: number, h0: number, fall: number, e = 0.38, bounces = 3): Drop {
  const t = f - start;
  if (t <= 0) return { y: h0, squash: 0, landed: false };
  const T0 = Math.max(1, fall);
  const g = (2 * h0) / (T0 * T0);
  const v0 = g * T0;
  if (t < T0) return { y: h0 - 0.5 * g * t * t, squash: 0, landed: false };
  let at = T0;
  let v = v0;
  let squash = Math.exp(-(t - T0) / 2.2);
  for (let b = 0; b < bounces; b++) {
    v *= e;
    const T = (2 * v) / g;
    if (t < at + T) {
      const u = t - at;
      return { y: Math.max(0, v * u - 0.5 * g * u * u), squash: Math.max(squash, 0), landed: true };
    }
    at += T;
    squash = Math.max(squash, (v / v0) * Math.exp(-(t - at) / 2.2));
  }
  return { y: 0, squash: squash < 0.01 ? 0 : squash, landed: true };
}

/**
 * Rolling in from `dist` px away (positive = from the right), slowing to a stop over `dur` frames like a wheel under
 * friction. `angle` is its turn in degrees for a radius of `r` px - it rolls, it does not slide.
 */
export function roll(f: number, start: number, dur: number, dist: number, r: number): { x: number; angle: number; moving: boolean } {
  const u = clamp((f - start) / Math.max(1, dur));
  const x = dist * (1 - u) * (1 - u);
  // rolling left it turns anticlockwise: its angle (CSS degrees, clockwise) falls to 0 as it comes to rest
  return { x, angle: (x / Math.max(1, r)) * (180 / Math.PI), moving: u < 1 };
}

/** A damped rock: `amp` at frame `start`, swinging every `period` frames, dying out over `decay` frames. */
export function wobble(f: number, start: number, amp: number, period = 14, decay = 10): number {
  const t = f - start;
  if (t < 0) return 0;
  return amp * Math.exp(-t / decay) * Math.sin((2 * Math.PI * t) / period);
}

/** A hop: up `h` px and down again over `dur` frames from `start`, then a small rebound. Positive = up. */
export function hop(f: number, start: number, dur: number, h: number): number {
  const t = f - start;
  if (t < 0) return 0;
  if (t <= dur) {
    const u = t / dur;
    return 4 * h * u * (1 - u);
  }
  const d = t - dur;
  return 0.14 * h * Math.exp(-d / 3) * Math.abs(Math.sin(d * 0.8));
}

/** Hops on every bar line from `from` on - the end card's button and part keep moving while it holds. */
export function barHop(f: number, from: number, bar: number, h: number, dur = 12): number {
  if (f < from) return 0;
  const k = Math.floor((f - from) / bar);
  return hop(f, from + k * bar, dur, h);
}

/** A camera that leans into a move: eased in and out, from a to b across [start, start + dur]. */
export const glide = (f: number, start: number, dur: number, a: number, b: number) => a + (b - a) * EASE_IO(clamp((f - start) / Math.max(1, dur)));
