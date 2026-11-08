// THE FILM'S PIECES (08.11.2026), in the team's style: the light stage with its drifting blueprint grid (compat-video
// Blueprint), words rising out of their masks (BF26 RiseLine), words unblurring (compat Words), the shop's button,
// and our real parts - the shop's own product photos, cut out (parts.ts) - so a film has a real object to move even
// without a picture. CSS and pictures only: it plays in the studio and renders frame by frame on the render machine, the same.
import React from "react";
import { AbsoluteFill, Img } from "../engine/react";
import { clamp, EASE, EASE_IN, p, SNAP } from "../engine/math";
import { measure, type Block, type Line } from "../engine/text";
import { asset, B, BOLD, FONT, LOGO, LOGO_RATIO, REG } from "./theme";
import { DEFAULT_PART, PART, type PartKey } from "../parts";
import type { Layout } from "./layout";

// ───────────────────────── the stage ─────────────────────────

/** The shop's light grey with a blueprint grid that drifts with the camera; `shift` moves it on the cuts. */
export const Backdrop: React.FC<{ f: number; L: Layout; shift?: { x: number; y: number; blur: number }; tone?: number }> = ({ f, L, shift = { x: 0, y: 0, blur: 0 }, tone = 0 }) => {
  const ox = f * 0.35 + shift.x;
  const oy = f * 0.2 + shift.y;
  const gx = 50 + 18 * Math.sin(f / 90);
  const gy = 42 + 12 * Math.cos(f / 110);
  return (
    <AbsoluteFill style={{ background: B.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(39,78,100,.075) 1px, transparent 1px), linear-gradient(90deg, rgba(39,78,100,.075) 1px, transparent 1px), linear-gradient(rgba(39,78,100,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(39,78,100,.035) 1px, transparent 1px)`,
          backgroundSize: "200px 200px, 200px 200px, 40px 40px, 40px 40px",
          backgroundPosition: `${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px`,
          filter: shift.blur > 0.5 ? `blur(${shift.blur.toFixed(1)}px)` : undefined,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 62% at ${gx}% ${gy}%, rgba(255,255,255,.88), rgba(244,246,248,0) 70%)` }} />
      {tone > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 50% at 78% 60%, rgba(216,9,1,${0.05 * tone}), rgba(216,9,1,0) 70%)` }} />}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 80% at 50% 50%, transparent 62%, rgba(39,78,100,.10))` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: L.H * 0.04, background: "linear-gradient(transparent, rgba(39,78,100,.04))" }} />
    </AbsoluteFill>
  );
};

/** The APSOparts logo, black. */
export const Logo: React.FC<{ base: string; x: number; y: number; h: number; opacity?: number; style?: React.CSSProperties }> = ({ base, x, y, h, opacity = 1, style }) => (
  <Img src={asset(base, LOGO)} alt="APSOparts" style={{ position: "absolute", left: x, top: y, height: h, width: h * LOGO_RATIO, opacity, ...style }} />
);

// ───────────────────────── words ─────────────────────────

/** A word in its colour: the key word (*red*) in the campaign red, the rest in ink (or `color`). */
const tint = (red: boolean, color: string) => (red ? B.key : color);

/**
 * A block of lines, each word rising out of its own mask (the BF26 film's RiseLine). `t(i)` is word i's progress
 * 0..1, counted across the whole block.
 */
export const Rise: React.FC<{ block: Block; weight?: number; color?: string; lh?: number; t: (i: number) => number; align?: "left" | "center" }> = ({ block, weight = BOLD, color = B.ink, lh = 1.06, t, align = "left" }) => {
  let k = 0;
  const fs = block.fs;
  // the gap between words is the font's own space, as measured when the block was fitted
  const gap = measure(" ", weight);
  return (
    <div style={{ font: `${weight} ${fs}px/${lh} ${FONT}`, letterSpacing: "-0.01em", color, textAlign: align }}>
      {block.lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {line.map((w, wi) => {
            const u = clamp(t(k++));
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: fs * 0.1, marginBottom: -fs * 0.1, marginRight: w.space && wi < line.length - 1 ? `${gap.toFixed(3)}em` : 0 }}>
                <span style={{ display: "inline-block", color: tint(w.red, color), transform: `translateY(${((1 - u) * 112).toFixed(2)}%) rotate(${((1 - u) * 7).toFixed(2)}deg)`, transformOrigin: "0 100%" }}>{w.t}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Words of a line, each coming up out of a blur (the compatibility film's Words), for longer text. */
export const Unblur: React.FC<{ block: Block; weight?: number; color?: string; lh?: number; t: (i: number) => number }> = ({ block, weight = REG, color = B.ink, lh = 1.22, t }) => {
  let k = 0;
  return (
    <div style={{ font: `${weight} ${block.fs}px/${lh} ${FONT}`, color }}>
      {block.lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {line.map((w, wi) => {
            const u = clamp(t(k++));
            return (
              <React.Fragment key={wi}>
                <span style={{ display: "inline-block", color: tint(w.red, color), opacity: u, transform: `translateY(${((1 - u) * 0.4).toFixed(3)}em)`, filter: u < 1 ? `blur(${((1 - u) * 9).toFixed(1)}px)` : undefined }}>{w.t}</span>
                {w.space && wi < line.length - 1 ? " " : null}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** One line in its colours, still (the end card moves whole lines). */
export const Colored: React.FC<{ line: Line; color?: string }> = ({ line, color = B.ink }) => (
  <>
    {line.map((w, i) => (
      <span key={i} style={{ color: tint(w.red, color) }}>
        {w.t}
        {w.space && i < line.length - 1 ? " " : ""}
      </span>
    ))}
  </>
);

/** A small line over a headline: a red bar that grows, then the words slide in. Never letter-spaced capitals. */
export const Kicker: React.FC<{ text: string; fs: number; f: number; at: number; color?: string }> = ({ text, fs, f, at, color = B.petrol }) => {
  const bar = p(f, at, 12, SNAP);
  const words = p(f, at + 4, 14);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: fs * 0.45, height: fs * 1.3 }}>
      <span style={{ width: fs * 1.25 * bar, height: Math.max(4, fs * 0.13), background: B.red, borderRadius: 2, flex: "none" }} />
      <span style={{ font: `${REG} ${fs}px/1 ${FONT}`, color, whiteSpace: "nowrap", opacity: words, transform: `translateX(${((1 - words) * -fs * 0.8).toFixed(1)}px)`, display: "inline-block", clipPath: `inset(-20% ${((1 - words) * 100).toFixed(1)}% -20% 0)` }}>{text}</span>
    </div>
  );
};

// ───────────────────────── the button ─────────────────────────

const Arrow: React.FC<{ s: number }> = ({ s }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** The shop's red button. `pulse` 0..1 pushes it and rings it; `nudge` moves the arrow. */
export const Button: React.FC<{ text: string; h: number; fs: number; pulse?: number; nudge?: number; style?: React.CSSProperties }> = ({ text, h, fs, pulse = 0, nudge = 0, style }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: fs * 0.45, height: h, padding: `0 ${fs * 0.9}px`, borderRadius: h * 0.12, background: B.red, color: B.white,
    font: `${BOLD} ${fs}px/1 ${FONT}`, whiteSpace: "nowrap", boxShadow: `0 ${fs * 0.3}px ${fs * 0.9}px -${fs * 0.3}px rgba(216,9,1,.5), 0 0 0 ${(pulse * fs * 0.45).toFixed(1)}px rgba(216,9,1,${(0.28 * pulse).toFixed(3)})`, ...style,
  }}>
    {text}
    <span style={{ display: "inline-flex", transform: `translateX(${(nudge * fs * 0.3).toFixed(1)}px)` }}><Arrow s={fs * 0.95} /></span>
  </div>
);

// ───────────────────────── our parts, real ─────────────────────────

/**
 * One of our parts standing on the floor - the shop's own product photo, cut out (parts.ts; SARCLA 08.11.2026: "O-ring
 * is not realistic on video" - nothing is drawn any more). Centred on (cx, cy) with half-height r, lifted `y` px, moved
 * `x` px, squashed by `squash` on impact (from its foot), turned `turn` degrees on its own axis, tilted `tilt`; its
 * shadow on the floor (the light from the top left, as in the shop's photos) shrinks and fades as it rises.
 */
export const Part: React.FC<{ part: PartKey; base: string; cx: number; cy: number; r: number; x?: number; y?: number; squash?: number; tilt?: number; turn?: number; opacity?: number }> = ({ part, base, cx, cy, r, x = 0, y = 0, squash = 0, tilt = 0, turn = 0, opacity = 1 }) => {
  const P = PART[part] ?? PART[DEFAULT_PART];
  const h = 2 * r;
  const w = h * P.ratio;
  const sx = 1 + 0.1 * squash;
  const sy = 1 - 0.12 * squash;
  const lift = clamp(y / (r * 2.2));
  const sw = w * 1.15;
  return (
    <>
      <div style={{ position: "absolute", left: cx - sw / 2 + w * 0.16 + x, top: cy + r - r * 0.09, width: sw, height: r * 0.2, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(29,42,51,.30), rgba(29,42,51,.10) 60%, rgba(29,42,51,0))", transform: `scale(${(1 - 0.5 * lift).toFixed(3)})`, opacity: opacity * (1 - 0.65 * lift) }} />
      <div style={{ position: "absolute", left: cx - w / 2 + x, top: cy - r - y, width: w, height: h, transformOrigin: "50% 100%", transform: `perspective(${(h * 4).toFixed(0)}px) rotate(${tilt.toFixed(2)}deg) rotateY(${turn.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`, opacity }}>
        <Img src={asset(base, P.cut)} alt={P.name} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    </>
  );
};

/** A ring drawn as a faint outline, turning slowly behind a scene - depth without noise. */
export const GhostRing: React.FC<{ cx: number; cy: number; r: number; f: number; opacity?: number }> = ({ cx, cy, r, f, opacity = 1 }) => (
  <svg width={2 * r} height={2 * r} viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} style={{ position: "absolute", left: cx - r, top: cy - r, opacity, transform: `rotate(${(f * 0.25).toFixed(2)}deg)` }}>
    <circle r={r * 0.88} fill="none" stroke="rgba(39,78,100,.09)" strokeWidth={r * 0.2} />
    <circle r={r * 0.88} fill="none" stroke="rgba(39,78,100,.14)" strokeWidth={2} strokeDasharray={`${r * 0.05} ${r * 0.09}`} />
  </svg>
);

/** A white card in the shop's style, with its shadow. */
export const card: React.CSSProperties = { background: B.white, borderRadius: 22, boxShadow: "0 1px 2px rgba(29,42,51,.06), 0 30px 60px -30px rgba(29,42,51,.35)" };

/** A light sweep across the frame (a gloss on the beat). */
export const Gloss: React.FC<{ f: number; at: number; dur?: number; strength?: number }> = ({ f, at: start, dur = 20, strength = 0.5 }) => {
  const t = clamp((f - start) / dur);
  if (t <= 0 || t >= 1) return null;
  const x = -30 + 160 * EASE(t);
  return <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${x - 16}%, rgba(255,255,255,${strength}) ${x}%, transparent ${x + 16}%)`, pointerEvents: "none" }} />;
};

/** Fades a shot's last frames when nothing else covers its exit. */
export const fadeOut = (f: number, dur: number, n = 8) => 1 - p(f, dur - n, n, EASE_IN);
