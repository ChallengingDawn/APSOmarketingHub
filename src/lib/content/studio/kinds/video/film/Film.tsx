// THE FILM (08.11.2026): a video document drawn at one frame. The same component plays in the studio (its own clock)
// and renders on the render machine (frame by frame, screenshotted) - one story, the layout of its format.
//   the stage      the light grey with its grid, drifting; it moves with every cut (parallax)
//   the shots      each scene in its bar-line window (Sequence), with its camera; cutting in with a whip, a sweep or
//                  a lift on the bar line (cuts.ts), motion-blurred along the move
//   the sweep      the petrol band with the red edge, over the cut
//   the logo       black, top left, on every shot - and on the end card it grows into the big APSOparts
import React from "react";
import { AbsoluteFill, Sequence, TimelineProvider, useCurrentFrame } from "../engine/react";
import { clamp, EASE_IO, lerp, p } from "../engine/math";
import { segmentAt, segments, totalFrames, type Segment, type VideoDoc } from "../model";
import { CUT_FRAMES, fxTransform, shotFx, sweepBand } from "./cuts";
import { LAYOUTS, type Layout } from "./layout";
import { Backdrop, Logo } from "./parts";
import { EndScene, SceneOf } from "./scenes";
import { B, FONT } from "./theme";

const fid = (s: string) => `vf-${s.replace(/[^a-zA-Z0-9-]/g, "-")}`;

/** One shot in its window: its scene, moved by its cuts, blurred along the move. */
const Shot: React.FC<{ seg: Segment; next: Segment | null; L: Layout; doc: VideoDoc; base: string; n: number }> = ({ seg, next, L, doc, base, n }) => {
  const f = useCurrentFrame();
  const fx = shotFx(seg, next, f, L.W, L.H);
  const id = fid(`${seg.id}-${n}`);
  const horizontal = Math.abs(fx.x) >= Math.abs(fx.y);
  const moving = Math.abs(fx.x) + Math.abs(fx.y) > 0.5;
  const bx = moving ? (horizontal ? fx.blur : fx.blur * 0.25) : fx.blur;
  const by = moving ? (horizontal ? fx.blur * 0.25 : fx.blur) : fx.blur;
  const blur = fx.blur > 0.4;
  const scene = seg.kind === "end" ? <EndScene doc={doc} L={L} dur={seg.dur} uid={id} /> : doc.scenes[seg.index] ? <SceneOf s={doc.scenes[seg.index]} L={L} dur={seg.dur} uid={id} base={base} /> : null;
  return (
    <>
      {blur && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} />
          </filter>
        </svg>
      )}
      <AbsoluteFill style={{ transformOrigin: "50% 50%", transform: fxTransform(fx), opacity: fx.opacity, filter: blur ? `url(#${id})` : undefined }}>{scene}</AbsoluteFill>
    </>
  );
};

/** The sweep's band over a cut on `at`: petrol, its leading edge red. */
const Sweep: React.FC<{ f: number; at: number; L: Layout }> = ({ f, at, L }) => {
  const b = sweepBand(f, at, L.W, L.H);
  if (!b) return null;
  const edge = L.W * 0.035;
  const poly = (l: number, w: number) => `polygon(${(l + b.slant).toFixed(1)}px 0, ${(l + w + b.slant).toFixed(1)}px 0, ${(l + w).toFixed(1)}px 100%, ${l.toFixed(1)}px 100%)`;
  return (
    <>
      <AbsoluteFill style={{ background: B.petrol, clipPath: poly(b.left, b.width - edge + 1) }} />
      <AbsoluteFill style={{ background: B.red, clipPath: poly(b.left + b.width - edge, edge) }} />
    </>
  );
};

/** Speed lines across a whip or a lift, the four frames either side of its bar line. */
const Streaks: React.FC<{ f: number; at: number; L: Layout; vertical: boolean }> = ({ f, at, L, vertical }) => {
  const t = (f - (at - 4)) / 8;
  if (t < 0 || t > 1) return null;
  const rows = [0.16, 0.31, 0.47, 0.6, 0.76, 0.88];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {rows.map((r, i) => {
        const run = clamp(t * 1.6 - i * 0.08);
        const len = (vertical ? L.H : L.W) * (0.35 + 0.1 * (i % 3));
        const pos = lerp(vertical ? L.H : L.W, -len, run);
        const th = 3 + (i % 3) * 2;
        const style: React.CSSProperties = vertical
          ? { position: "absolute", left: L.W * r, top: pos, width: th, height: len, background: "linear-gradient(transparent, rgba(39,78,100,.22), transparent)" }
          : { position: "absolute", top: L.H * r, left: pos, height: th, width: len, background: "linear-gradient(90deg, transparent, rgba(39,78,100,.22), transparent)" };
        return run > 0 && run < 1 ? <div key={i} style={style} /> : null;
      })}
    </AbsoluteFill>
  );
};

/** The logo: black, top left, on every shot; on the end card it grows into the big APSOparts and stays. */
const FilmLogo: React.FC<{ f: number; end: Segment; L: Layout; base: string }> = ({ f, end, L, base }) => {
  const k = p(f - end.start, 2, 24, EASE_IO);
  const x = lerp(L.logo.x, L.bigLogo.x, k);
  const y = lerp(L.logo.y, L.bigLogo.y, k);
  const h = lerp(L.logo.h, L.bigLogo.h, k);
  return <Logo base={base} x={x} y={y} h={h} opacity={p(f, 2, 14)} />;
};

/** The whole film at `frame`, at its format's full size (scale it to show it smaller). */
export const Film: React.FC<{ doc: VideoDoc; frame: number; base?: string }> = ({ doc, frame, base = "" }) => {
  const L = LAYOUTS[doc.format] ?? LAYOUTS["16:9"];
  const segs = segments(doc);
  const total = totalFrames(doc);
  const f = Math.max(0, Math.min(total - 1, Math.floor(frame)));
  const cur = segmentAt(segs, f);
  const ci = segs.indexOf(cur);
  const fx = shotFx(cur, segs[ci + 1] ?? null, f - cur.start, L.W, L.H);
  const end = segs[segs.length - 1];
  return (
    <TimelineProvider value={{ frame: f, start: 0, lo: 0, hi: total }}>
      <div style={{ position: "relative", width: L.W, height: L.H, overflow: "hidden", background: B.bg, fontFamily: FONT, userSelect: "none", WebkitFontSmoothing: "antialiased" }}>
        <Backdrop f={f} L={L} shift={{ x: fx.x * 0.35, y: fx.y * 0.35, blur: fx.blur * 0.4 }} tone={cur.kind === "end" ? p(f - cur.start, 0, 30) : 0} />
        {segs.map((sg, i) => (
          <Sequence key={`${sg.id}-${i}`} from={sg.start} durationInFrames={sg.dur}>
            <Shot seg={sg} next={segs[i + 1] ?? null} L={L} doc={doc} base={base} n={i} />
          </Sequence>
        ))}
        {segs.map((sg, i) => ((sg.cut === "whip" || sg.cut === "lift") && Math.abs(f - sg.start) <= 4 ? <Streaks key={`st-${i}`} f={f} at={sg.start} L={L} vertical={sg.cut === "lift"} /> : null))}
        <FilmLogo f={f} end={end} L={L} base={base} />
        {/* the sweep wipes the whole frame, the logo too, for the few frames it crosses */}
        {segs.map((sg, i) => (sg.cut === "sweep" && Math.abs(f - sg.start) <= CUT_FRAMES.sweepHalf ? <Sweep key={`sw-${i}`} f={f} at={sg.start} L={L} /> : null))}
      </div>
    </TimelineProvider>
  );
};

export { LAYOUTS };
/** The film's size and length for a document. */
export const filmSize = (doc: VideoDoc) => {
  const L = LAYOUTS[doc.format] ?? LAYOUTS["16:9"];
  return { width: L.W, height: L.H, frames: totalFrames(doc) };
};
