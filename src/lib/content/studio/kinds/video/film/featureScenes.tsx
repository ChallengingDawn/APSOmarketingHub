// THE SCENES FOR A FEATURE (08.11.2026; SARCLA: "the video should also play with our features"). In the team's motion
// style, beside the library in scenes.tsx:
//   feature  the feature's icon tile springs in and its icon draws on, its name slides in on a red bar, the claim rises
//            word by word, the proof comes out of a blur; beside it its picture spins in on a card - the one picked,
//            else the shop's own photo for the feature (09.11.2026: no more icon in a turning disc)
//   number   one true figure: a plain number counts up to its value and lands on the beat (the camera kicks), any other
//            ("48/72h") slams in out of a blur; what it is rises under it with a red line, the proof after
//   compare  before / after: the old way on a quiet card, crossed out with a red line on the beat; then the APSOparts
//            way drops in on its card, its key word red, a tick popping
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "../engine/react";
import { backOut, clamp, EASE, EASE_IO, lerp, p, SNAP, spring } from "../engine/math";
import { drop } from "../engine/physics";
import { BAR, BEAT, FPS } from "../engine/timeline";
import { fitBlock, fitFs, lineW, plain, type Block } from "../engine/text";
import { FEATURE, featurePhoto } from "../features";
import type { SceneProps } from "./scenes";
import { card, Colored, GhostRing, Gloss, Kicker, Rise, Unblur } from "./parts";
import { Icon } from "./icons";
import { countable, group } from "./figure";
import { B, BOLD, FONT, REG } from "./theme";

const blockH = (b: Block, lh: number) => b.lines.length * b.fs * lh;
const lines = (...v: (string | undefined)[]) => v.filter((x): x is string => !!x && !!plain(x));

/** The camera, as the library's scenes have it. */
const Camera: React.FC<{ z?: number; rx?: number; ry?: number; x?: number; y?: number; children: React.ReactNode }> = ({ z = 1, rx = 0, ry = 0, x = 0, y = 0, children }) => (
  <AbsoluteFill style={{ perspective: 1800 }}>
    <AbsoluteFill style={{ transformOrigin: "50% 50%", transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${z.toFixed(4)})` }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

/** Labels of the before / after cards, in the film's language. */
const BEFORE: Record<string, string> = { EN: "Before", DE: "Vorher", FR: "Avant", IT: "Prima", NL: "Voorheen", PL: "Wcześniej", ES: "Antes" };
const AFTER: Record<string, string> = { EN: "With APSOparts", DE: "Mit APSOparts", FR: "Avec APSOparts", IT: "Con APSOparts", NL: "Met APSOparts", PL: "Z APSOparts", ES: "Con APSOparts" };
const word = (m: Record<string, string>, lang?: string) => m[(lang ?? "EN").toUpperCase().slice(0, 2)] ?? m.EN;

// ───────────────────────── feature ─────────────────────────

export const FeatureScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const F = L.feature;
  const icon = s.icon ?? (s.feature ? FEATURE[s.feature].icon : "check");
  const name = plain(s.copy.kicker ?? "");
  const proof = plain(s.copy.sub ?? "");
  const u = clamp(f / dur);
  const lh = 1.05;
  const kfs = name ? fitFs([name], REG, L.fs.kicker, F.text.w - L.fs.kicker * 1.8) : 0;
  const pfs = proof ? Math.min(L.fs.body, fitFs([proof], REG, L.fs.body, F.text.w)) : 0;
  const proofBlock = proof ? fitBlock([proof], REG, pfs, { w: F.text.w, h: pfs * 2.5 }, { lh: 1.22, breakable: true, maxLines: 2 }) : null;
  const claim = fitBlock(lines(s.copy.line1), BOLD, L.fs.claim, { w: F.text.w, h: F.text.h - (name ? kfs * 2 : 0) - (proofBlock ? blockH(proofBlock, 1.22) + pfs : 0) }, { lh, breakable: true, maxLines: 3 });
  const total = (name ? kfs * 1.9 : 0) + blockH(claim, lh) + (proofBlock ? pfs * 0.8 + blockH(proofBlock, 1.22) : 0);
  const top = F.text.y + Math.max(0, (F.text.h - total) / 2);
  // the icon tile: a spring, then a breath on every bar
  const k = spring({ frame: f - 2, fps: FPS, config: { damping: 12, stiffness: 150, mass: 0.9 } });
  const tile = F.icon.h;
  const breath = 1 + 0.035 * Math.sin((f / BAR) * Math.PI * 2);
  const claimAt = 12;
  const words = claim.lines.reduce((n, l) => n + l.length, 0);
  const proofAt = claimAt + words * 3 + 10;
  // the picture card spins in from the right
  const C = F.card;
  const c = spring({ frame: f - 6, fps: FPS, config: { damping: 14, stiffness: 110, mass: 1 } });
  const turn = 5 * Math.sin((f - 24) / 30) * p(f, 22, 24);
  // its picture: the one picked, else the shop's own photo for the feature - never an icon in a disc (09.11.2026)
  const photo = s.image || featurePhoto(s.feature);
  return (
    <>
      <Camera z={1 + 0.04 * EASE_IO(u)} ry={lerp(-2.5, 2.5, EASE_IO(u))}>
        <div style={{ position: "absolute", left: F.icon.x, top: F.icon.y, width: tile, height: tile, borderRadius: tile * 0.24, background: B.red, display: "grid", placeItems: "center",
          boxShadow: `0 ${tile * 0.18}px ${tile * 0.4}px -${tile * 0.16}px rgba(216,9,1,.55)`, opacity: clamp(k * 3), transformOrigin: "50% 60%",
          transform: `translateY(${((1 - k) * tile * 0.6).toFixed(1)}px) rotate(${((1 - k) * -14).toFixed(2)}deg) scale(${(lerp(0.4, 1, k) * breath).toFixed(4)})` }}>
          <Icon name={icon} size={tile * 0.6} color="#fff" stroke={1.9} t={p(f, 8, 22, EASE)} />
        </div>
        <div style={{ position: "absolute", left: F.text.x, top, width: F.text.w }}>
          {name && <div style={{ marginBottom: kfs * 0.6 }}><Kicker text={name} fs={kfs} f={f} at={6} /></div>}
          <Rise block={claim} lh={lh} t={(i) => p(f, claimAt + i * 3, 16, SNAP)} />
          {proofBlock && <div style={{ marginTop: pfs * 0.8 }}><Unblur block={proofBlock} lh={1.22} color={B.mute} t={(i) => p(f, proofAt + i * 2, 12)} /></div>}
        </div>
        <div style={{ position: "absolute", left: C.x, top: C.y, width: C.w, height: C.h, perspective: 1600 }}>
          <div style={{ ...card, position: "absolute", inset: 0, overflow: "hidden", opacity: clamp(c * 4), transformOrigin: "50% 60%",
            transform: `translateX(${((1 - c) * L.W * 0.28).toFixed(1)}px) rotateY(${((1 - c) * 60 + turn).toFixed(2)}deg)` }}>
            <Img src={photo} alt="" onError={(e) => { e.currentTarget.style.opacity = "0"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${(1.08 - 0.06 * EASE(u)).toFixed(4)})` }} />
          </div>
        </div>
      </Camera>
      {dur > BAR && <Gloss f={f} at={BAR + 2} strength={0.4} />}
    </>
  );
};

// ───────────────────────── number ─────────────────────────


export const NumberScene: React.FC<SceneProps> = ({ s, L, dur }) => {
  const f = useCurrentFrame();
  const N = L.number;
  const fig = plain(s.copy.line1 ?? "");
  const label = s.copy.line2 ?? "";
  const proof = plain(s.copy.sub ?? "");
  const u = clamp(f / dur);
  const icon = s.icon ?? (s.feature ? FEATURE[s.feature].icon : null);
  // the figure as big as its box takes it (the icon beside it where there is room)
  const iconW = icon ? N.fig.h * 0.42 : 0;
  const ffs = fig ? fitFs([fig], BOLD, N.fig.h * 0.9, N.fig.w - iconW * 1.3) : 0;
  const cnt = countable(fig);
  const land = BEAT * 2;
  const run = clamp((f - 4) / (land - 4));
  const shown = cnt ? `${cnt.pre}${group(Math.round(cnt.value * EASE(run)), cnt.sep)}${run >= 1 ? cnt.post : ""}` : fig;
  const slam = p(f, 4, 10, SNAP);
  const kick = f >= land ? 0.03 * Math.exp(-(f - land) / 5) : 0;
  const lfs = label ? L.fs.claim * 0.72 : 0;
  const labelBlock = fitBlock(lines(label), BOLD, lfs, N.label, { lh: 1.05, breakable: true, maxLines: 2 });
  const sfs = proof ? fitFs([proof], REG, L.fs.body, N.sub.w) : 0;
  const lastLine = labelBlock.lines[labelBlock.lines.length - 1];
  const figTop = N.fig.y + (N.fig.h - ffs) / 2;
  return (
    <>
      <GhostRing cx={L.W * (L.fmt === "9:16" ? 0.8 : 0.86)} cy={L.H * (L.fmt === "9:16" ? 0.3 : 0.32)} r={Math.min(L.W, L.H) * 0.36} f={f + 120} opacity={0.8} />
      <Camera z={1 + 0.04 * EASE_IO(u) + kick} rx={lerp(3, 0, EASE(u))}>
        <div style={{ position: "absolute", left: N.fig.x, top: figTop, height: ffs, display: "flex", alignItems: "center", gap: iconW * 0.3 }}>
          <div style={{ fontWeight: BOLD, fontSize: ffs, lineHeight: 1, fontFamily: FONT, letterSpacing: "-0.03em", color: B.red, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
            opacity: cnt ? clamp(f / 4) : clamp(slam * 2), transformOrigin: "0 70%",
            transform: cnt ? `scale(${(1 + 0.06 * Math.exp(-Math.max(0, f - land) / 4) * (f >= land ? 1 : 0)).toFixed(4)})` : `scale(${lerp(1.5, 1, slam).toFixed(4)})`,
            filter: !cnt && slam < 1 ? `blur(${((1 - slam) * 18).toFixed(1)}px)` : undefined }}>{shown}</div>
          {icon && (
            <div style={{ opacity: p(f, land - 4, 8), transform: `translateY(${((1 - backOut(p(f, land - 4, 14, EASE), 2)) * 30).toFixed(1)}px)` }}>
              <Icon name={icon} size={iconW} color={B.petrol} stroke={1.6} t={p(f, land - 4, 20)} />
            </div>
          )}
        </div>
        <div style={{ position: "absolute", left: N.label.x, top: N.label.y, width: N.label.w }}>
          <Rise block={labelBlock} lh={1.05} t={(i) => p(f, land - 6 + i * 2.5, 14, SNAP)} />
          {lastLine && <div style={{ width: lineW(lastLine, BOLD, labelBlock.fs) * p(f, land + 10, 16, SNAP), height: Math.max(5, labelBlock.fs * 0.075), background: B.red, borderRadius: 3, marginTop: labelBlock.fs * 0.1 }} />}
        </div>
        {proof && (
          <div style={{ position: "absolute", left: N.sub.x, top: N.sub.y, width: N.sub.w, font: `${REG} ${sfs}px/1.2 ${FONT}`, color: B.mute, whiteSpace: "nowrap",
            opacity: p(f, land + 18, 14), transform: `translateY(${((1 - p(f, land + 18, 16)) * sfs * 0.8).toFixed(1)}px)` }}>{proof}</div>
        )}
      </Camera>
      <Gloss f={f} at={land} strength={0.45} />
    </>
  );
};

// ───────────────────────── before / after ─────────────────────────

const Tick: React.FC<{ size: number; t: number }> = ({ size, t }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", transform: `scale(${(0.5 + 0.5 * backOut(clamp(t * 1.5), 2.4)).toFixed(3)})`, opacity: clamp(t * 4) }}>
    <circle cx="24" cy="24" r="22" fill={B.red} />
    <path d="M14 25 l7 7 l13 -15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clamp(t * 1.4 - 0.2)} />
  </svg>
);

export const CompareScene: React.FC<SceneProps & { lang?: string }> = ({ s, L, dur, lang }) => {
  const f = useCurrentFrame();
  const C = L.compare;
  const head = plain(s.copy.kicker ?? "");
  const kfs = head ? fitFs([head], REG, L.fs.kicker, C.head.w - L.fs.kicker * 1.8) : 0;
  const u = clamp(f / dur);
  const pad = Math.min(C.before.w, C.before.h) * 0.11;
  const tagFs = Math.max(22, L.fs.kicker * 0.78);
  const inner = (b: typeof C.before) => ({ w: b.w - pad * 2, h: b.h - pad * 2 - tagFs * 2 });
  const fit = (t: string | undefined, b: typeof C.before) => fitBlock(lines(t), BOLD, L.fs.claim * 0.9, inner(b), { lh: 1.08, breakable: true, maxLines: 3 });
  const before = fit(s.copy.line1, C.before);
  const after = fit(s.copy.line2, C.after);
  const fs = Math.min(before.fs, after.fs);
  const b2 = fitBlock(lines(s.copy.line1), BOLD, fs, inner(C.before), { lh: 1.08, breakable: true, maxLines: 3 });
  const a2 = fitBlock(lines(s.copy.line2), BOLD, fs, inner(C.after), { lh: 1.08, breakable: true, maxLines: 3 });
  const strikeAt = BEAT * 2 - 4;
  const strike = p(f, strikeAt, 10, SNAP);
  const afterAt = BEAT * 3;
  const d = drop(f, afterAt - 10, Math.min(220, L.H * 0.14), 10, 0.3, 2);
  const shownAfter = f >= afterAt - 10;
  const fade = p(f, strikeAt + 4, 18);
  const kick = f >= afterAt ? 0.025 * Math.exp(-(f - afterAt) / 4) : 0;
  const cardBox = (b: typeof C.before): React.CSSProperties => ({ ...card, position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box", padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between" });
  const tag = (text: string, color: string) => <div style={{ font: `${REG} ${tagFs}px/1 ${FONT}`, color, whiteSpace: "nowrap" }}>{text}</div>;
  return (
    <Camera z={1 + 0.03 * EASE_IO(u) + kick} x={L.fmt === "16:9" ? lerp(24, -24, EASE_IO(u)) : 0} y={L.fmt === "16:9" ? 0 : lerp(30, -20, EASE_IO(u))}>
      {head && <div style={{ position: "absolute", left: C.head.x, top: C.head.y + (C.head.h - kfs * 1.3) / 2 }}><Kicker text={head} fs={kfs} f={f} at={0} /></div>}
      <div style={{ ...cardBox(C.before), background: "#F3F5F7", opacity: clamp(f / 4) * lerp(1, 0.78, fade), transform: `translateY(${((1 - p(f, 0, 14, SNAP)) * 60).toFixed(1)}px) scale(${lerp(1, 0.97, fade).toFixed(4)})`, transformOrigin: "50% 50%" }}>
        {tag(word(BEFORE, lang), B.mute)}
        <div style={{ position: "relative" }}>
          <div style={{ font: `${BOLD} ${b2.fs}px/1.08 ${FONT}`, color: lerp(0, 1, fade) > 0.5 ? "#8A949C" : B.ink, transition: "none" }}>
            {b2.lines.map((ln, i) => <div key={i} style={{ whiteSpace: "nowrap" }}><Colored line={ln.map((w) => ({ ...w, red: false }))} color="inherit" /></div>)}
          </div>
          {b2.lines.map((ln, i) => (
            <div key={i} style={{ position: "absolute", left: 0, top: (i + 0.55) * b2.fs * 1.08, width: lineW(ln, BOLD, b2.fs) * clamp(strike * b2.lines.length - i), height: Math.max(5, b2.fs * 0.08), background: B.red, borderRadius: 3 }} />
          ))}
        </div>
      </div>
      {shownAfter && (
        <div style={{ ...cardBox(C.after), opacity: clamp((f - (afterAt - 10)) / 3), transformOrigin: "50% 100%",
          transform: `translateY(${(-d.y).toFixed(1)}px) rotate(${((1 - p(f, afterAt - 10, 16)) * 3).toFixed(2)}deg) scale(${(1 + 0.05 * d.squash).toFixed(3)}, ${(1 - 0.06 * d.squash).toFixed(3)})` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {tag(word(AFTER, lang), B.petrol)}
            <Tick size={tagFs * 2} t={clamp((f - afterAt - 8) / 14)} />
          </div>
          <div style={{ font: `${BOLD} ${a2.fs}px/1.08 ${FONT}`, color: B.ink }}>
            {a2.lines.map((ln, i) => <div key={i} style={{ whiteSpace: "nowrap" }}><Colored line={ln} /></div>)}
          </div>
        </div>
      )}
      {f >= afterAt && <Gloss f={f} at={afterAt + 2} strength={0.4} />}
    </Camera>
  );
};
