"use client";
// PICTURES (SARCLA 08.11.2026: "on picture frames you should be able to upload a photo or generate one"). Frames first -
// a place for a picture before there is one - then the picture: made from a few words in the house style, or uploaded.
// It lands IN the selected frame (taking its box, its corners, its circle), behind the page, or in the middle of it.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CropFreeIcon from "@mui/icons-material/CropFree";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { DesignNode } from "@/lib/design-document";
import { aspectFor } from "@/lib/content/studio/kinds/social/canvasAi";
import { PicturePanel, type Picture, type PictureAspect } from "../../../pictures";
import { Head, Note, PanelFrame, T, Tile } from "../look";
import { backgroundPicture, boardOf, frameOf, placePicture } from "../actions";
import type { StudioCtx } from "../Studio";

const FRAME = "#DDE5EB";
let seq = 0;
const nid = () => `frame${Date.now().toString(36)}${(seq += 1)}`;

type FrameKind = "rounded" | "circle" | "half" | "two" | "three";
const FRAMES: { key: FrameKind; label: string; view: React.ReactNode }[] = [
  { key: "rounded", label: "Rounded", view: <Box sx={{ width: 44, height: 32, borderRadius: "6px", bgcolor: FRAME }} /> },
  { key: "circle", label: "Circle", view: <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: FRAME }} /> },
  { key: "half", label: "Half page", view: <Box sx={{ width: 44, height: 34, display: "grid", gridTemplateRows: "1fr 1fr", bgcolor: "#fff", border: `1px solid ${T.line}` }}><Box sx={{ bgcolor: FRAME }} /></Box> },
  { key: "two", label: "Two", view: <Box sx={{ display: "flex", gap: "3px" }}>{[0, 1].map((i) => <Box key={i} sx={{ width: 20, height: 30, borderRadius: "4px", bgcolor: FRAME }} />)}</Box> },
  { key: "three", label: "Three", view: <Box sx={{ display: "flex", gap: "3px" }}>{[0, 1, 2].map((i) => <Box key={i} sx={{ width: 13, height: 30, borderRadius: "3px", bgcolor: FRAME }} />)}</Box> },
];

export function addFrames(ctx: StudioCtx, kind: FrameKind) {
  const c = ctx.canvas.current;
  if (!c) return;
  const s = boardOf(ctx);
  const m = Math.round(Math.min(s.w, s.h) * 0.075);
  const r = Math.round(Math.min(s.w, s.h) * 0.026);
  let made: DesignNode[] = [];
  if (kind === "rounded") made = [{ id: nid(), kind: "rect", x: Math.round(s.w * 0.2), y: Math.round(s.h * 0.25), width: Math.round(s.w * 0.6), height: Math.round(s.h * 0.5), fill: FRAME, cornerRadius: r }];
  if (kind === "circle") { const d = Math.round(Math.min(s.w, s.h) * 0.5); made = [{ id: nid(), kind: "ellipse", x: Math.round((s.w - d) / 2), y: Math.round((s.h - d) / 2), width: d, height: d, fill: FRAME }]; }
  if (kind === "half") made = s.w / s.h > 1.3
    ? [{ id: nid(), kind: "rect", x: Math.round(s.w / 2), y: 0, width: Math.round(s.w / 2), height: s.h, fill: FRAME }]
    : [{ id: nid(), kind: "rect", x: 0, y: 0, width: s.w, height: Math.round(s.h / 2), fill: FRAME }];
  if (kind === "two" || kind === "three") {
    const n = kind === "two" ? 2 : 3;
    const gap = Math.round(s.w * 0.02);
    const w = (s.w - m * 2 - gap * (n - 1)) / n;
    const h = Math.round(Math.min(s.h * 0.46, w * 1.25));
    made = Array.from({ length: n }, (_, i) => ({ id: nid(), kind: "rect" as const, x: Math.round(m + i * (w + gap)), y: Math.round((s.h - h) / 2), width: Math.round(w), height: h, fill: FRAME, cornerRadius: r }));
  }
  c.commit((cur) => [...cur, ...made]);
  c.select(made.slice(0, 1).map((x) => x.id));
}

export default function PicturesPanel({ ctx }: { ctx: StudioCtx }) {
  const frame = frameOf(ctx);
  const [where, setWhere] = useState<"page" | "background">("page");
  useEffect(() => { if (frame) setWhere("page"); }, [frame?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = boardOf(ctx);
  const aspect: PictureAspect = where === "background" ? aspectFor(s.w, s.h) : frame ? aspectFor(frame.width ?? 1, frame.height ?? 1) : s.w / s.h > 1.3 ? "16:9" : "4:5";
  const pick = (p: Picture) => {
    if (!ctx.canEdit) return;
    if (where === "background") backgroundPicture(ctx, p.url);
    else void placePicture(ctx, p);
  };
  return (
    <PanelFrame title="Pictures">
      <Head mt={0.5}>Frames</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0.75 }}>
        {FRAMES.map((f) => (
          <Tile key={f.key} onClick={() => addFrames(ctx, f.key)} disabled={!ctx.canEdit} title={`Add a ${f.label.toLowerCase()} frame`} sx={{ height: 58, display: "grid", placeItems: "center" }}>
            {f.view}
          </Tile>
        ))}
      </Box>
      <Note sx={{ mt: 0.75 }}>A frame holds the place; select it, then make or upload the picture that goes in it.</Note>

      <Head>The picture</Head>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, mb: 1.25, borderRadius: "10px", bgcolor: frame && where === "page" ? T.accentSoft : T.sunken, border: `1px solid ${frame && where === "page" ? "rgba(194,44,110,.25)" : T.line}` }}>
        <CropFreeIcon sx={{ fontSize: 18, color: frame && where === "page" ? T.accent : T.ink3 }} />
        <Typography sx={{ fontSize: "0.8rem", color: T.ink, flex: 1 }}>
          {where === "background" ? "It goes behind the page, as its background." : frame ? "It goes into the selected frame." : "It goes in the middle of the page - select a frame to fill it."}
        </Typography>
      </Box>
      <Box sx={{ mb: 1.5 }}>
        <SquareChoice value={where} onChange={setWhere} options={[{ key: "page", label: frame ? "Into the frame" : "On the page" }, { key: "background", label: "As the background" }]} />
      </Box>
      <PicturePanel onPick={pick} projectId={ctx.api.data.piece.projectId} pieceId={ctx.api.data.piece.id} me={ctx.api.data.me}
        aspect={aspect} tabs={["make", "upload", "mine", "project"]} start="make" columns={3} />
    </PanelFrame>
  );
}
