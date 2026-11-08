"use client";
// SIZE, COLOUR & BACKGROUND (SARCLA 08.11.2026: "Size, colour and background should be much more complete"). The board's
// format (each network's sizes, or your own); the background - a brand colour or any colour, a gradient, our blueprint
// grid, a picture (made, uploaded, from the gallery) darkened to carry white words; and the brand's shapes.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import type { DesignNode } from "@/lib/design-document";
import { BRAND_BACKDROPS, C, FORMATS, GRADIENTS, PALETTE, sizeOf, type FormatKey } from "@/lib/content/studio/kinds/social/design";
import { PicturePanel } from "../../../pictures";
import { aspectFor } from "@/lib/content/studio/kinds/social/canvasAi";
import { Btn, Head, Note, PanelFrame, Swatch, T, Tile } from "../look";
import { FormatGlyph } from "../CanvasBar";
import { backgroundPicture, boardOf } from "../actions";
import type { StudioCtx } from "../Studio";

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq += 1)}`;

/** The brand's shapes, sized for the board. */
function shape(kind: "bar" | "band" | "ring" | "disc" | "corner" | "rule", s: { w: number; h: number }): DesignNode[] {
  const u = Math.min(s.w, s.h) / 1080;
  const m = Math.round(Math.min(s.w, s.h) * 0.075);
  switch (kind) {
    case "bar": return [{ id: nid("bar"), kind: "rect", x: m, y: Math.round(s.h * 0.5), width: Math.round(90 * u), height: Math.max(4, Math.round(10 * u)), fill: C.red, cornerRadius: Math.round(5 * u) }];
    case "band": return [{ id: nid("band"), kind: "rect", x: 0, y: Math.round(s.h * 0.78), width: s.w, height: Math.round(s.h * 0.22), fill: C.petrol }];
    case "ring": { const d = Math.round(Math.min(s.w, s.h) * 0.5); return [{ id: nid("ring"), kind: "ellipse", x: Math.round(s.w - d * 0.7), y: Math.round(s.h - d * 0.7), width: d, height: d, fill: "rgba(0,0,0,0)", stroke: C.petrol, strokeWidth: Math.round(d * 0.18) }]; }
    case "disc": { const d = Math.round(Math.min(s.w, s.h) * 0.16); return [{ id: nid("disc"), kind: "ellipse", x: s.w - m - d, y: m, width: d, height: d, fill: C.red }]; }
    case "corner": { const d = Math.round(Math.min(s.w, s.h) * 0.42); return [{ id: nid("corner"), kind: "rect", x: Math.round(s.w - d * 0.5), y: Math.round(s.h - d * 0.5), width: d, height: d, fill: C.red, rotation: 45 }]; }
    case "rule": return [{ id: nid("rule"), kind: "rect", x: m, y: Math.round(s.h - m), width: s.w - m * 2, height: Math.max(2, Math.round(3 * u)), fill: "rgba(39,78,100,0.25)" }];
  }
}

export default function SizePanel({ ctx }: { ctx: StudioCtx }) {
  const d = ctx.doc.design;
  const bg = ctx.live?.background;
  const c = ctx.canvas.current;
  const cur = sizeOf("custom", d);
  const [w, setW] = useState(String(cur.w));
  const [h, setH] = useState(String(cur.h));
  const [scrim, setScrim] = useState(bg?.scrim ?? 0);
  useEffect(() => { setScrim(bg?.scrim ?? 0); }, [bg?.scrim]);
  const [picking, setPicking] = useState(false);
  const [from, setFrom] = useState<string>(bg?.customGradient.from ?? C.petrol);
  const [to, setTo] = useState<string>(bg?.customGradient.to ?? C.petrolDeep);
  const nW = Math.round(Number(w)); const nH = Math.round(Number(h));
  const customOk = nW >= 200 && nH >= 200 && nW <= 4000 && nH <= 4000;
  const s = boardOf(ctx);
  const keys = Object.keys(FORMATS) as Exclude<FormatKey, "custom">[];
  const setBg = (p: Parameters<NonNullable<typeof c>["setBackground"]>[0]) => { if (ctx.canEdit) c?.setBackground(p); };
  const isGrad = !!bg?.gradientId;

  return (
    <PanelFrame title="Size & colour">
      <Head mt={0.5}>Format</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0.75 }}>
        {keys.map((k) => {
          const f = FORMATS[k];
          const on = ctx.fmt === k;
          const has = d.formats.includes(k);
          return (
            <Tile key={k} active={on} onClick={() => !on && ctx.goFormat(k)} title={`${f.label} ${f.w} × ${f.h} - ${f.where}${has ? "" : " (made from this one)"}`} sx={{ p: 1, height: 92, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              <Box sx={{ color: on ? T.accent : T.ink2 }}><FormatGlyph f={k} d={d} size={30} on={on} /></Box>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: T.ink, lineHeight: 1.1 }}>{f.label}</Typography>
              <Typography sx={{ fontSize: "0.66rem", color: T.ink3, fontVariantNumeric: "tabular-nums" }}>{f.w} × {f.h}</Typography>
              {has && !on && <Box sx={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", bgcolor: T.accent }} />}
            </Tile>
          );
        })}
      </Box>
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (customOk) ctx.goFormat("custom", { w: nW, h: nH }); }} sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.25 }}>
        <TextField size="small" label="Width" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ""))} sx={{ width: 92 }} />
        <Typography sx={{ color: T.ink3 }}>×</Typography>
        <TextField size="small" label="Height" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} sx={{ width: 92 }} />
        <Btn type="submit" disabled={!customOk} sx={{ flex: 1 }}>{ctx.fmt === "custom" ? "Resize" : "Custom size"}</Btn>
      </Box>
      <Note sx={{ mt: 0.75 }}>A dot: a format this post already has. A new one is made from the board on screen - the type keeps its shape, the corners keep their things.</Note>

      <Head>Background colour</Head>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {PALETTE.map((col) => <Swatch key={col} color={col} on={!isGrad && !bg?.src && bg?.color.toUpperCase() === col.toUpperCase()} onClick={() => setBg({ color: col, gradientId: null, src: null })} />)}
        <Box component="label" title="Any colour" sx={{ position: "relative", width: 30, height: 30, borderRadius: "7px", cursor: "pointer", background: "conic-gradient(#f44,#fd4,#4d6,#4cf,#64f,#f4c,#f44)", boxShadow: "inset 0 0 0 1px rgba(17,24,39,.12)" }}>
          <input type="color" value={bg?.color.startsWith("#") ? bg.color : "#ffffff"} onChange={(e) => setBg({ color: e.target.value, gradientId: null, src: null })} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
        </Box>
      </Box>

      <Head>Gradients</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.75 }}>
        {GRADIENTS.map((g) => {
          const on = isGrad && bg?.customGradient.from === g.from && bg?.customGradient.to === g.to;
          return <Swatch key={g.id} size={38} color={`linear-gradient(135deg, ${g.from}, ${g.to})`} on={on} title={g.label} onClick={() => setBg({ gradientId: "custom", customGradient: { from: g.from, to: g.to }, src: null })} />;
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <Typography sx={{ fontSize: "0.78rem", color: T.ink2 }}>Your own:</Typography>
        <input type="color" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 34, height: 28, border: `1px solid ${T.line}`, borderRadius: 6, padding: 0, background: "none" }} aria-label="Gradient from" />
        <input type="color" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 34, height: 28, border: `1px solid ${T.line}`, borderRadius: 6, padding: 0, background: "none" }} aria-label="Gradient to" />
        <Btn onClick={() => setBg({ gradientId: "custom", customGradient: { from, to }, src: null })} sx={{ height: 30 }}>Use it</Btn>
      </Box>

      <Head>Brand backgrounds</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
        {BRAND_BACKDROPS.map((b) => (
          <Tile key={b.id} active={bg?.src === b.src} onClick={() => setBg({ src: b.src, color: b.color, gradientId: null, scrim: 0 })} sx={{ height: 64, backgroundImage: `url(${b.src})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <Typography sx={{ position: "absolute", left: 8, bottom: 6, fontSize: "0.72rem", fontWeight: 700, color: b.id === "grid-dark" ? "#fff" : T.ink }}>{b.label}</Typography>
            {bg?.src === b.src && <CheckIcon sx={{ position: "absolute", top: 6, right: 6, fontSize: 16, color: b.id === "grid-dark" ? "#fff" : T.accent }} />}
          </Tile>
        ))}
      </Box>

      <Head right={bg?.src && !bg.src.startsWith("/social/") ? <Box component="button" type="button" onClick={() => setBg({ src: null })} sx={{ all: "unset", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700, color: "#b42318" }}>Remove it</Box> : undefined}>Background picture</Head>
      {bg?.src && !bg.src.startsWith("/social/") && (
        <Box sx={{ mb: 1.25 }}>
          <Typography sx={{ fontSize: "0.78rem", color: T.ink2 }}>Darken it, so white words read on it · {scrim}%</Typography>
          <Slider size="small" value={scrim} min={0} max={80} step={2} onChange={(_, v) => setScrim(v as number)} onChangeCommitted={(_, v) => setBg({ scrim: v as number })} sx={{ color: T.accent }} />
        </Box>
      )}
      {picking
        ? <PicturePanel onPick={(p) => { if (ctx.canEdit) backgroundPicture(ctx, p.url); setPicking(false); }} projectId={ctx.api.data.piece.projectId} pieceId={ctx.api.data.piece.id} me={ctx.api.data.me}
            aspect={aspectFor(s.w, s.h)} tabs={["make", "upload", "mine", "project"]} start="make" columns={3} />
        : <Btn onClick={() => setPicking(true)} disabled={!ctx.canEdit} sx={{ width: "100%" }}>Make, upload or choose a picture</Btn>}

      <Head>Brand shapes</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
        {([
          ["bar", "Red bar", <Box key="b" sx={{ width: 36, height: 6, borderRadius: 3, bgcolor: C.red }} />],
          ["band", "Petrol band", <Box key="b" sx={{ width: 48, height: 34, display: "flex", flexDirection: "column", justifyContent: "flex-end", bgcolor: "#fff", border: `1px solid ${T.line}` }}><Box sx={{ height: 9, bgcolor: C.petrol }} /></Box>],
          ["ring", "O-ring", <Box key="b" sx={{ width: 30, height: 30, borderRadius: "50%", border: `6px solid ${C.petrol}`, boxSizing: "border-box" }} />],
          ["disc", "Red dot", <Box key="b" sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: C.red }} />],
          ["corner", "Red corner", <Box key="b" sx={{ width: 40, height: 32, bgcolor: "#fff", border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}><Box sx={{ position: "absolute", right: -9, bottom: -9, width: 18, height: 18, bgcolor: C.red, transform: "rotate(45deg)" }} /></Box>],
          ["rule", "Fine rule", <Box key="b" sx={{ width: 44, height: 2, bgcolor: "rgba(39,78,100,.35)" }} />],
        ] as const).map(([k, label, view]) => (
          <Tile key={k} onClick={() => { if (!c || !ctx.canEdit) return; const made = shape(k, s); c.commit((nodes) => [...nodes, ...made]); c.select(made.map((x) => x.id)); }} disabled={!ctx.canEdit} title={label} sx={{ height: 60, display: "grid", placeItems: "center" }}>
            {view}
          </Tile>
        ))}
      </Box>
    </PanelFrame>
  );
}
