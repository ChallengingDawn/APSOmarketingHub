// THE SCENE LIBRARY (08.11.2026) - our kinds of shot, in the team's motion style: a camera that always moves (push,
// pull, orbit, pan), words that rise out of masks or slam in on the beat, parts that roll, drop and hop like real
// objects, a gloss on the bar line. Each kind lays itself out per format (layout.ts). CSS and SVG only.
//   title    a headline rising word by word; an O-ring or shaft seal rolls in beside it and rocks to rest
//   words    two or three short lines, one slammed in on each beat, the camera kicking with each
//   claim    one statement swept in: a bar grows, the words rise, a red line sweeps under them, a gloss crosses
//   steps    three cards dropping on the beats 1-2-3, a line drawing between them; ticked on the next bar
//   product  a card that spins in on a spring, a picture or a drawn part dropping onto it, a turntable after
//   quote    a customer's own words, word by word at reading pace, the mark dropping in
//   feature, number, compare   a feature of the shop, a true figure, before / after (featureScenes.tsx)
//   end      APSOparts big (the corner logo grows into it - Film.tsx), the line, the button pulsing on every beat
//            and hopping every two, the part hopping between - it keeps moving while it holds
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "../engine/react";
import { backOut, clamp, EASE, EASE_IO, lerp, p, SNAP, spring } from "../engine/math";
import { barHop, drop, roll, wobble } from "../engine/physics";
import { BAR, BEAT, beatPulse, FPS } from "../engine/timeline";
import { fitBlock, fitFlow, fitFs, lineW, parse, plain, type Block } from "../engine/text";
import type { Scene, VideoDoc } from "../model";
import type { Layout } from "./layout";
import { Button, card, Colored, GhostRing, Gloss, Kicker, Part, Rise, Unblur } from "./parts";
import { B, BOLD, FONT, REG } from "./theme";
import { CompareScene, FeatureScene, NumberScene } from "./featureScenes";

export type SceneProps = { s: Scene; L: Layout; dur: number; uid: string; base: string; lang?: string };

/** The scene's camera: it pushes, pulls, turns and pans the whole shot. */
const Camera: React.FC<{ z?: number; rx?: number; ry?: number; rz?: number; x?: number; y?: number; children: React.ReactNode }> = ({ z = 1, rx = 0, ry = 0, rz = 0, x = 0, y = 0, children }) => (
  <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: "50% 50%" }}>
    <AbsoluteFill style={{ transformOrigin: "50% 50%", transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${z.toFixed(4)})` }}>
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

const blockH = (b: Block, lh: number) => b.lines.length * b.fs * lh;
const shapeOf = (s: Scene): "oring" | "seal" | null => (s.shape === "oring" || s.shape === "seal" ? s.shape : null);
const lines = (...v: (string | undefined)[]) => v.filter((x): x is string => !!x && !!plain(x));

/** A red line drawn under a line of text from its left, `t` 0..1. */
const Underline: React.FC<{ x: number; y: number; w: number; fs: number; t: number }> = ({ x, y, w, fs, t }) =>
  t > 0 ? <div style={{ position: "absolute", left: x, top: y, width: w * t, height: Math.max(5, fs * 0.075), background: B.red, borderRadius: 3 }} /> : null;

// ───────────────────────── title ─────────────────────────

export const TitleScene: React.FC<SceneProps> = ({ s, L, dur, uid }) => {
  const f = useCurrentFrame();
  const T = L.title;
  const shape = shapeOf(s);
  const box = shape || L.fmt !== "16:9" ? T.text : { ...T.text, w: L.safe.w };
  const kicker = plain(s.copy.kicker ?? "");
  const kfs = kicker ? fitFs([kicker], REG, L.fs.kicker, box.w - L.fs.kicker * 1.8) : 0;
  const lh = 1.04;
  const block = fitBlock(lines(s.copy.line1, s.copy.line2), BOLD, L.fs.head, { w: box.w, h: box.h - (kicker ? kfs * 2.2 : 0) }, { lh, breakable: L.fmt !== "16:9", maxLines: 4 });
  const first = kicker ? 12 : 6;
  const u = clamp(f / dur);
  // calm: a slow push in and a turn of the head
  const cam = { z: 1 + 0.045 * EASE_IO(u), ry: lerp(-4, 2, EASE_IO(u)), rx: lerp(3, 0, EASE(u)) };
  // the part rolls in from beyond the right edge, rocks to rest; on a second bar it hops
  const P = T.part;
  const rl = roll(f, 6, 36, L.W - P.cx + P.r * 1.3, P.r);
  const rock = wobble(f, 42, 8, 20, 14);
  const up = dur > BAR ? barHop(f, BAR, BAR, P.r * 0.3, 14) : 0;
  return (
    <>
      <Camera {...cam}>
        {shape && <GhostRing cx={P.cx} cy={P.cy} r={P.r * 1.55} f={f} opacity={p(f, 0, 30)} />}
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", justifyContent: "center", gap: kfs * 0.7 }}>
          {kicker && <Kicker text={kicker} fs={kfs} f={f} at={2} />}
          <Rise block={block} lh={lh} t={(i) => p(f, first + i * 3, 16, SNAP)} />
        </div>
        {shape && <Part shape={shape} cx={P.cx} cy={P.cy} r={P.r} x={rl.x + (rock * Math.PI * P.r) / 180} y={up} mark={-40 + rl.angle + rock} uid={`${uid}-part`} opacity={f >= 6 ? 1 : 0} />}
      </Camera>
      {dur > BAR && <Gloss f={f} at={BAR} strength={0.45} />}
    </>
  );
};

// ───────────────────────── words ─────────────────────────

export const WordsScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const box = L.words.text;
  const lh = 1.0;
  const block = fitBlock(lines(s.copy.line1, s.copy.line2, s.copy.line3), BOLD, L.fs.words, box, { lh, breakable: L.fmt !== "16:9", maxLines: 6 });
  const n = block.lines.length;
  // one line on each beat, all in within the first bar
  const step = n > 1 ? Math.min(BEAT, Math.floor((Math.min(dur, BAR) - 22) / (n - 1))) : BEAT;
  const at = (j: number) => 2 + j * step;
  const kick = block.lines.reduce((m, _, j) => m + (f >= at(j) + 5 ? 0.03 * Math.exp(-(f - at(j) - 5) / 4) : 0), 0);
  const u = clamp(f / dur);
  const reframe = dur > BAR ? p(f, BAR, 26, EASE_IO) : 0;
  const top = box.y + (box.h - blockH(block, lh)) / 2;
  const last = block.lines[n - 1];
  return (
    <>
      <GhostRing cx={L.W * (L.fmt === "9:16" ? 0.78 : 0.84)} cy={L.H * (L.fmt === "9:16" ? 0.74 : 0.56)} r={Math.min(L.W, L.H) * 0.42} f={f + 200} opacity={0.9} />
      <Camera z={1 + 0.04 * u + kick - 0.05 * reframe} rz={lerp(-1.2, 0.5, EASE_IO(u))} y={-reframe * box.h * 0.05}>
        <div style={{ position: "absolute", left: box.x, top, width: box.w, font: `${BOLD} ${block.fs}px/${lh} ${FONT}`, letterSpacing: "-0.012em", color: B.ink }}>
          {block.lines.map((ln, j) => {
            const v = p(f, at(j), 9, SNAP);
            return (
              <div key={j} style={{ whiteSpace: "nowrap", transformOrigin: "0 60%", opacity: clamp(v * 2.5), transform: `translateY(${((1 - v) * -0.22).toFixed(3)}em) scale(${lerp(1.45, 1, v).toFixed(4)})`, filter: v < 1 ? `blur(${((1 - v) * 14).toFixed(1)}px)` : undefined }}>
                <Colored line={ln} />
              </div>
            );
          })}
        </div>
        {last && dur > BAR && <Underline x={box.x} y={top + blockH(block, lh) + block.fs * 0.02} w={lineW(last, BOLD, block.fs)} fs={block.fs} t={p(f, BAR + 4, 16, SNAP)} />}
      </Camera>
    </>
  );
};

// ───────────────────────── claim ─────────────────────────

export const ClaimScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const box = L.claim.text;
  const sub = plain(s.copy.sub ?? "");
  const indent = Math.max(28, L.fs.claim * 0.36);
  const subFs = sub ? fitFs([sub], REG, L.fs.body, box.w - indent) : 0;
  const lh = 1.06;
  const block = fitBlock(lines(s.copy.line1), BOLD, L.fs.claim, { w: box.w - indent, h: box.h - (sub ? subFs * 2.6 : 0) }, { lh, breakable: true, maxLines: 3 });
  const bh = blockH(block, lh);
  const total = bh + (sub ? subFs * 2.2 : 0);
  const top = box.y + (box.h - total) / 2;
  const u = clamp(f / dur);
  const words = block.lines.reduce((n, l) => n + l.length, 0);
  const last = block.lines[block.lines.length - 1];
  const sweepAt = 6 + words * 2.5;
  return (
    <>
      <Camera z={lerp(1.08, 1, EASE(u))} rx={lerp(7, 0, EASE(u))} x={lerp(24, -12, EASE_IO(u))}>
        <div style={{ position: "absolute", left: box.x, top, width: 10, height: total, background: B.petrol, borderRadius: 5, transformOrigin: "50% 0", transform: `scaleY(${p(f, 0, 16, SNAP).toFixed(4)})` }} />
        <div style={{ position: "absolute", left: box.x + indent, top, width: box.w - indent }}>
          <Rise block={block} lh={lh} t={(i) => p(f, 4 + i * 2.5, 15, SNAP)} />
          {sub && (
            <div style={{ marginTop: subFs * 1.0, font: `${REG} ${subFs}px/1.2 ${FONT}`, color: B.mute, whiteSpace: "nowrap", opacity: p(f, sweepAt + 8, 14), transform: `translateY(${((1 - p(f, sweepAt + 8, 16)) * subFs * 0.8).toFixed(1)}px)` }}>{sub}</div>
          )}
        </div>
        {last && <Underline x={box.x + indent} y={top + bh + block.fs * 0.02} w={lineW(last, BOLD, block.fs)} fs={block.fs} t={p(f, sweepAt, 14, SNAP)} />}
      </Camera>
      <Gloss f={f} at={sweepAt + 2} strength={0.5} />
      {dur > BAR && <Gloss f={f} at={BAR + 4} strength={0.35} />}
    </>
  );
};

// ───────────────────────── steps ─────────────────────────

const Check: React.FC<{ size: number; t: number }> = ({ size, t }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", transform: `scale(${(0.6 + 0.4 * backOut(clamp(t * 1.6), 2.2)).toFixed(3)})`, opacity: clamp(t * 4) }}>
    <circle cx="24" cy="24" r="22" fill={B.red} />
    <path d="M14 25 l7 7 l13 -15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clamp(t * 1.4 - 0.2)} />
  </svg>
);

export const StepsScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const S = L.steps;
  const head = plain(s.copy.kicker ?? "");
  const steps = [s.copy.line1, s.copy.line2, s.copy.line3].map((x) => x ?? "");
  const u = clamp(f / dur);
  const land = (i: number) => BEAT * (i + 1);
  const kick = [0, 1, 2].reduce((m, i) => m + (f >= land(i) ? 0.018 * Math.exp(-(f - land(i)) / 4) : 0), 0);
  const cam = S.row ? { x: lerp(40, -40, EASE_IO(u)), z: 1 + 0.03 * u + kick } : { y: lerp(50, -30, EASE_IO(u)), z: 1 + 0.03 * u + kick };
  const c0 = S.cards[0];
  const numFs = S.row ? c0.h * 0.32 : c0.h * 0.46;
  const pad = S.row ? c0.h * 0.12 : c0.h * 0.16;
  const textBox = S.row ? { w: c0.w - pad * 2, h: c0.h - pad * 2 - numFs * 1.15 } : { w: c0.w - pad * 3 - numFs * 0.8, h: c0.h - pad * 2 };
  // one size for all three, so they read as a set
  const fitted = steps.map((x) => fitBlock([x], BOLD, L.fs.step, textBox, { lh: 1.1, breakable: true, maxLines: 2 }));
  const sfs = Math.min(...fitted.map((b) => (b.lines.length ? b.fs : L.fs.step)));
  const blocks = steps.map((x) => fitBlock([x], BOLD, sfs, textBox, { lh: 1.1, breakable: true, maxLines: 2 }));
  const kfs = head ? fitFs([head], REG, L.fs.kicker, S.head.w - L.fs.kicker * 1.8) : 0;
  const line = p(f, land(0), land(2) - land(0), (x) => x);
  return (
    <Camera {...cam}>
      {head && <div style={{ position: "absolute", left: S.head.x, top: S.head.y + (S.head.h - kfs * 1.3) / 2 }}><Kicker text={head} fs={kfs} f={f} at={0} /></div>}
      {S.row
        ? <div style={{ position: "absolute", left: c0.x + c0.w / 2, top: c0.y + c0.h / 2 - 3, width: (S.cards[2].x - c0.x) * line, height: 6, background: B.line, borderRadius: 3 }} />
        : <div style={{ position: "absolute", left: c0.x + pad + numFs * 0.4 - 3, top: c0.y + c0.h / 2, width: 6, height: (S.cards[2].y - c0.y) * line, background: B.line, borderRadius: 3 }} />}
      {S.cards.map((c, i) => {
        const d = drop(f, land(i) - 10, Math.min(220, L.H * 0.16), 10, 0.3, 2);
        const shown = f >= land(i) - 10;
        const tickT = dur > BAR ? clamp((f - (BAR + i * BEAT)) / 12) : 0;
        const b = blocks[i];
        return shown ? (
          <div key={i} style={{ ...card, position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, boxSizing: "border-box", padding: pad, display: "flex", flexDirection: S.row ? "column" : "row", alignItems: S.row ? "flex-start" : "center", justifyContent: S.row ? "space-between" : "flex-start", gap: S.row ? numFs * 0.15 : pad,
            transformOrigin: "50% 100%", opacity: clamp((f - (land(i) - 10)) / 3), transform: `translateY(${(-d.y).toFixed(1)}px) rotate(${((1 - p(f, land(i) - 10, 16)) * (i % 2 ? 5 : -5)).toFixed(2)}deg) scale(${(1 + 0.05 * d.squash).toFixed(3)}, ${(1 - 0.06 * d.squash).toFixed(3)})` }}>
            <div style={{ font: `${BOLD} ${numFs}px/1 ${FONT}`, color: B.red, minWidth: numFs * 0.8 }}>{i + 1}</div>
            <div style={{ font: `${BOLD} ${b.fs}px/1.1 ${FONT}`, color: B.ink }}>
              {b.lines.map((ln, k) => <div key={k} style={{ whiteSpace: "nowrap" }}><Colored line={ln} /></div>)}
            </div>
            {tickT > 0 && <div style={{ position: "absolute", right: pad * 0.8, top: pad * 0.8 }}><Check size={Math.min(c.h * 0.24, 70)} t={tickT} /></div>}
          </div>
        ) : null;
      })}
    </Camera>
  );
};

// ───────────────────────── product ─────────────────────────

export const ProductScene: React.FC<SceneProps> = ({ s, L, dur, uid }) => {
  const f = useCurrentFrame();
  const C = L.product.card;
  const Tb = L.product.text;
  const what = plain(s.copy.line1 ?? "");
  const u = clamp(f / dur);
  const lh = 1.04;
  const whatFs = what ? fitFs([what], REG, L.fs.body, Tb.w) : 0;
  const nameBlock = fitBlock(lines(s.copy.kicker), BOLD, L.fs.claim, { w: Tb.w, h: Tb.h - (what ? whatFs * 2.4 : 0) }, { lh, breakable: true, maxLines: 3 });
  const textH = blockH(nameBlock, lh) + (what ? whatFs * 2 : 0);
  const k = spring({ frame: f - 2, fps: FPS, config: { damping: 13, stiffness: 120, mass: 1 } });
  const turn = 6 * Math.sin((f - 20) / 28) * p(f, 18, 24);
  const up = dur > BAR ? barHop(f, BAR, BAR, 34, 14) : 0;
  const shape = shapeOf(s) ?? "oring";
  const pr = Math.min(C.w, C.h) * 0.3;
  const d = drop(f, 10, C.h * 0.42, 14, 0.36, 3);
  const rock = wobble(f, 24, 7, 18, 12);
  const name0 = 12;
  const h0 = C.h * 0.42;
  return (
    <>
      <GhostRing cx={C.x + C.w / 2} cy={C.y + C.h / 2} r={Math.max(C.w, C.h) * 0.62} f={f} opacity={p(f, 0, 30) * 0.8} />
      <Camera z={1 + 0.035 * EASE_IO(u)} ry={lerp(-3, 3, EASE_IO(u))}>
        <div style={{ position: "absolute", left: Tb.x, top: Tb.y + (Tb.h - textH) / 2, width: Tb.w }}>
          <Rise block={nameBlock} lh={lh} t={(i) => p(f, name0 + i * 3, 16, SNAP)} />
          {what && <div style={{ marginTop: whatFs * 0.8, font: `${REG} ${whatFs}px/1.2 ${FONT}`, color: B.mute, whiteSpace: "nowrap", opacity: p(f, 26, 14), transform: `translateY(${((1 - p(f, 26, 16)) * whatFs * 0.8).toFixed(1)}px)` }}>{what}</div>}
        </div>
        <div style={{ position: "absolute", left: C.x, top: C.y, width: C.w, height: C.h, perspective: 1600 }}>
          <div style={{ ...card, position: "absolute", inset: 0, overflow: "hidden", opacity: clamp(f / 4), transformOrigin: "50% 60%",
            transform: `translate(${((1 - k) * L.W * 0.3).toFixed(1)}px, ${(-up).toFixed(1)}px) rotateY(${((1 - k) * 75 + turn).toFixed(2)}deg) rotateZ(${((1 - k) * 6).toFixed(2)}deg)` }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 40%, #ffffff, #eef1f4)" }} />
            {s.image ? (
              <div style={{ position: "absolute", left: "9%", top: "9%", right: "9%", bottom: "9%", transform: `translateY(${(Math.sin(f / 20) * 6).toFixed(1)}px)` }}>
                <Img src={s.image} alt="" onError={(e) => { e.currentTarget.style.opacity = "0"; }} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <Part shape={shape} cx={C.w / 2} cy={C.h * 0.5} r={pr} y={d.y} squash={d.squash} mark={-40 + rock - 120 * (d.landed ? 1 : 1 - d.y / h0)} tilt={rock * 0.3} uid={`${uid}-part`} opacity={f >= 10 ? 1 : 0} />
            )}
          </div>
        </div>
      </Camera>
      {dur > BAR && <Gloss f={f} at={BAR + 2} strength={0.4} />}
    </>
  );
};

// ───────────────────────── quote ─────────────────────────

export const QuoteScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const Q = L.quote;
  const words = parse(s.copy.line1 ?? "");
  const indent = Math.max(30, L.fs.quote * 0.55);
  const lh = 1.22;
  const block = fitFlow(words, REG, L.fs.quote, { w: Q.text.w - indent, h: Q.text.h }, lh, 20);
  const n = words.length;
  const start = 12;
  const stagger = n > 1 ? Math.max(2, Math.min(7.5, (dur - 54) / n)) : 0;
  const textEnd = start + n * stagger + 12;
  const whoAt = Math.min(textEnd, dur - 34);
  const who = plain(s.copy.sub ?? "");
  const whoFs = who ? fitFs([`— ${who}`], REG, L.fs.body, Q.who.w) : 0;
  const m = spring({ frame: f - 2, fps: FPS, config: { damping: 11, stiffness: 140, mass: 1 } });
  const u = clamp(f / dur);
  const bh = blockH(block, lh);
  const textTop = Q.text.y + (Q.text.h - bh) / 2;
  // the mark sits just over the words, wherever they start
  const markTop = Math.max(Q.mark.y, textTop - Q.mark.h * 0.62);
  return (
    <Camera z={1 + 0.05 * EASE_IO(u)} rx={lerp(2, 0, EASE(u))}>
      <div style={{ position: "absolute", left: Q.mark.x, top: markTop, font: `${BOLD} ${Q.mark.h}px/1 ${FONT}`, color: B.red, height: Q.mark.h * 0.62, overflow: "visible", opacity: clamp(m * 3),
        transformOrigin: "30% 40%", transform: `translateY(${((1 - m) * -140).toFixed(1)}px) rotate(${((1 - m) * -30).toFixed(2)}deg) scale(${(0.5 + 0.5 * m).toFixed(3)})` }}>“</div>
      <div style={{ position: "absolute", left: Q.text.x, top: textTop, width: 6, height: bh * p(f, 6, 30, EASE_IO), background: B.red, borderRadius: 3 }} />
      <div style={{ position: "absolute", left: Q.text.x + indent, top: textTop, width: Q.text.w - indent }}>
        <Unblur block={block} lh={lh} t={(i) => p(f, start + i * stagger, 12)} />
      </div>
      {who && (
        <div style={{ position: "absolute", left: Q.who.x + indent, top: Math.min(Q.who.y, textTop + bh + whoFs * 0.9), font: `${REG} ${whoFs}px/1.2 ${FONT}`, color: B.petrol, whiteSpace: "nowrap", opacity: p(f, whoAt, 14), transform: `translateX(${((1 - p(f, whoAt, 18)) * -40).toFixed(1)}px)` }}>— {who}</div>
      )}
    </Camera>
  );
};

// ───────────────────────── the end card ─────────────────────────

export const EndScene: React.FC<{ doc: VideoDoc; L: Layout; dur: number; uid: string }> = ({ doc, L, uid }) => {
  const f = useCurrentFrame();
  const E = L.end;
  const lh = 1.04;
  const block = fitBlock(lines(doc.endCard.line), BOLD, L.fs.end, E.line, { lh, breakable: true, maxLines: 3 });
  const bh = blockH(block, lh);
  const top = E.line.y + Math.max(0, (E.line.h - bh) / 2);
  const last = block.lines[block.lines.length - 1];
  const cta = plain(doc.endCard.cta);
  const ctaMax = L.fmt === "16:9" ? 760 : L.fmt === "9:16" ? 900 : 640;
  const ctaFs = cta ? Math.min(L.fs.cta, ctaMax / (lineW(cta, BOLD, 1) + 2.6)) : 0;
  const k = clamp((f - 26) / 14);
  const pulse = beatPulse(f, 44, 5);
  const btnUp = barHop(f, 44, 2 * BEAT, E.cta.h * 0.16, 12);
  const P = E.part;
  const d = drop(f, 4, P.r * 2.4, 14, 0.36, 3);
  const partUp = barHop(f, 59, 2 * BEAT, P.r * 0.45, 13);
  const hops = f >= 59 ? Math.floor((f - 59) / (2 * BEAT)) + clamp(((f - 59) % (2 * BEAT)) / 13) : 0;
  return (
    <Camera z={1.02 - 0.02 * EASE(clamp(f / 40))} ry={1.5 * Math.sin(f / 45)}>
      <GhostRing cx={P.cx} cy={P.cy} r={P.r * 1.7} f={f} opacity={p(f, 0, 30) * 0.8} />
      <div style={{ position: "absolute", left: E.line.x, top, width: E.line.w }}>
        <Rise block={block} lh={lh} t={(i) => p(f, 14 + i * 3, 16, SNAP)} />
      </div>
      {last && <Underline x={E.line.x} y={top + bh + block.fs * 0.02} w={lineW(last, BOLD, block.fs)} fs={block.fs} t={p(f, 34 + block.lines.length * 3, 18, SNAP)} />}
      {cta && (
        <div style={{ position: "absolute", left: E.cta.x, top: E.cta.y, transformOrigin: "0 50%", opacity: clamp(k * 3), transform: `translateY(${(-btnUp).toFixed(1)}px) scale(${(lerp(0.55, 1, backOut(k, 1.6)) * (1 + 0.045 * pulse)).toFixed(4)})` }}>
          <Button text={cta} h={E.cta.h} fs={ctaFs} pulse={pulse} nudge={pulse} />
        </div>
      )}
      <Part shape="oring" cx={P.cx} cy={P.cy} r={P.r} y={d.y + partUp} squash={d.squash} mark={-40 + 90 * hops} uid={`${uid}-part`} opacity={f >= 4 ? 1 : 0} />
    </Camera>
  );
};

/** The shot for a scene of the story. */
export const SceneOf: React.FC<SceneProps> = (props) => {
  switch (props.s.kind) {
    case "title": return <TitleScene {...props} />;
    case "words": return <WordsScene {...props} />;
    case "claim": return <ClaimScene {...props} />;
    case "steps": return <StepsScene {...props} />;
    case "product": return <ProductScene {...props} />;
    case "quote": return <QuoteScene {...props} />;
    case "feature": return <FeatureScene {...props} />;
    case "number": return <NumberScene {...props} />;
    case "compare": return <CompareScene {...props} />;
    default: return null;
  }
};
