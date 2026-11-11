"use client";
// ON THE CANVAS, OVER THE DESIGN (night of 09.11.2026, flow standard §1, §3, §4):
//   - the selected element: a small dark label above it, "<Element> · Ask AI · ×" (Ask AI puts the cursor in the
//     assistant's box, working on that element)
//   - every empty picture frame: its idea and "Make it" / "Upload" right in the frame; while the picture is made, the frame
//     shimmers with "Making the picture… 0:12"; a selected picture: Make another · Upload · Gallery · Remove
//   - while the AI writes: the elements it works on shimmer, and a small clock says what it does
// Positions follow the canvas (zoom, drag, resize) frame by frame; the layer lets every other click through to it.
// cv16 (the Page builder's point 1): one selected text or picture opens ITS popup beside it (./ElementPop.tsx); the label's
// "Ask AI" puts the cursor in that popup's own AI box (page/barAi.ts AI_BOX_ATTR) - never the whole post's. A frame being
// made says the words its picture comes from.

import { useEffect, useRef, useState } from "react";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { madeFrom } from "@/lib/content/studio/kinds/page/pictureJobs";
import ElementPop from "./ElementPop";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";

import type { DesignNode } from "@/lib/design-document";
import { PINK } from "../../parts";
import { EmptyActions, PictureActions, shimmerSx, useClock } from "../../standard";
import { elementName, headlineIdOf } from "./Map";
import { isEmptyFrame, isPictureNode } from "./useDesignAi";
import { placeLabel } from "@/lib/content/studio/kinds/social/place";
import type { StudioCtx } from "./Studio";

type R = { x: number; y: number; w: number; h: number };

function MakingOver({ r, upload, from, label }: { r: R; upload?: boolean; from?: string | null; label?: string }) {
  const clock = useClock(true);
  const words = madeFrom(from, 90);
  return (
    <Box sx={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: "6px", outline: `2px solid ${PINK}`, display: "grid", placeItems: "center", overflow: "hidden", ...shimmerSx, bgcolor: "rgba(255,255,255,.35)" }}>
      <Box sx={{ px: 1.25, py: 0.6, borderRadius: "6px", bgcolor: "rgba(22,32,42,.86)", color: "#fff", fontSize: "0.78rem", fontWeight: 700, maxWidth: Math.max(160, r.w - 24), textAlign: "center" }}>
        <Box sx={{ whiteSpace: "nowrap" }}>{upload ? "Uploading the picture…" : label ?? "Making the picture…"} <Box component="span" sx={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{clock}</Box></Box>
        {/* cv16: the words it is made from (a newer ask in the popup replaces it) */}
        {words && !upload && r.h > 110 && <Box sx={{ mt: 0.25, fontWeight: 500, fontSize: "0.72rem", opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>From: “{words}”</Box>}
      </Box>
    </Box>
  );
}

const POP_W = 340;

export default function Overlay({ ctx, onAskAi, onGallery }: { ctx: StudioCtx; onAskAi: () => void; onGallery: (nodeId: string) => void }) {
  const ai = ctx.ai;
  const box = useRef<HTMLDivElement>(null);
  const nodes: DesignNode[] = ctx.live?.nodes ?? [];
  const page = ctx.doc.design.pages[ctx.pageIx];
  const working = ai.working && ai.working.pageId === page?.id ? ai.working : null;
  const clock = useClock(!!ai.working);
  const selId = ctx.selection.length === 1 ? ctx.selection[0] : ctx.selection.find((id) => nodes.find((n) => n.id === id)?.kind === "text") ?? ctx.selection[0] ?? null;
  const sel = selId ? nodes.find((n) => n.id === selId) ?? null : null;
  const frames = nodes.filter((n) => isEmptyFrame(n) && !n.hidden);
  const workingIds = working ? (working.ids === "all" ? nodes.filter((n) => n.kind === "text" || isEmptyFrame(n)).map((n) => n.id) : working.ids) : [];
  const makingIds = Object.keys(ai.making).filter((id) => nodes.some((n) => n.id === id));
  // with a selection: every other element too, so its label can sit where it covers none of them
  const others = sel ? nodes.filter((n) => !n.hidden && n.kind !== "scrim" && !ctx.selection.includes(n.id)).map((n) => n.id) : [];
  const ids = [...new Set([...(sel ? [sel.id] : []), ...frames.map((f) => f.id), ...workingIds, ...makingIds, ...others])];
  const want = useRef(ids);
  want.current = ids;
  const [rects, setRects] = useState<Record<string, R>>({});
  const [board, setBoard] = useState<R | null>(null);
  // while words are typed right on the canvas, the label steps aside (it showed through the typing box as a ghost)
  const [typing, setTyping] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  // cv16: the element's popup - open for each new selection, closed by its ×
  const [closed, setClosed] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusAsk = useRef(false);

  // follow the canvas: zoom, drag and resize move the boxes
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const c = ctx.canvas.current;
      const host = box.current;
      if (c && host) {
        const o = host.getBoundingClientRect();
        const next: Record<string, R> = {};
        for (const id of want.current) {
          const r = c.rectOf(id);
          if (r) next[id] = { x: Math.round(r.left - o.left), y: Math.round(r.top - o.top), w: Math.round(r.width), h: Math.round(r.height) };
        }
        const br = c.boardRect();
        const bd = br ? { x: Math.round(br.left - o.left), y: Math.round(br.top - o.top), w: Math.round(br.width), h: Math.round(br.height) } : null;
        const ed = !!document.querySelector("[contenteditable=true][role=textbox]");
        const k = JSON.stringify([next, bd, ed]);
        if (k !== last) { last = k; setRects(next); setBoard(bd); setTyping(ed); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ctx.canvas]);

  const headlineId = headlineIdOf(nodes);
  const sr = sel ? rects[sel.id] : null;
  const popFor = sel && ctx.selection.length >= 1 && !sel.hidden && (sel.kind === "text" || isPictureNode(sel) || isEmptyFrame(sel)) ? sel : null;
  const popOpen = !!popFor && closed !== popFor.id && !typing;
  // the label's "Ask AI": the cursor into the popup's own box (opened first when it was closed)
  const askHere = () => {
    if (!popFor) { onAskAi(); return; }
    if (closed === popFor.id) { setClosed(null); focusAsk.current = true; return; }
    (popRef.current?.querySelector(`[${AI_BOX_ATTR}]`) as HTMLElement | null)?.focus();
  };
  useEffect(() => {
    if (!focusAsk.current || !popOpen) return;
    focusAsk.current = false;
    setTimeout(() => (popRef.current?.querySelector(`[${AI_BOX_ATTR}]`) as HTMLElement | null)?.focus(), 30);
  });
  useEffect(() => { setClosed(null); }, [popFor?.id]);
  // beside the element: on its right when there is room, else on its left, else under or over it; when none fits (a
  // headline across the board), in the stage's corner away from the element's middle - always whole inside the stage
  const W = box.current?.clientWidth ?? 9999;
  const H = box.current?.clientHeight ?? 9999;
  const [popH, setPopH] = useState(420);
  useEffect(() => { const h = popRef.current?.offsetHeight; if (h && Math.abs(h - popH) > 4) setPopH(h); });
  const popAt = sr ? (() => {
    const fitY = (y: number) => Math.max(8, Math.min(y, H - popH - 8));
    if (sr.x + sr.w + 14 + POP_W <= W - 8) return { x: sr.x + sr.w + 14, y: fitY(sr.y) };
    if (sr.x - POP_W - 14 >= 8) return { x: sr.x - POP_W - 14, y: fitY(sr.y) };
    const x = Math.max(8, Math.min(W - POP_W - 8, sr.x + sr.w / 2 - POP_W / 2));
    if (sr.y + sr.h + 12 + popH <= H - 8) return { x, y: sr.y + sr.h + 12 };
    if (sr.y - 12 - popH >= 8) return { x, y: sr.y - 12 - popH };
    return { x: sr.x + sr.w / 2 < W / 2 ? W - POP_W - 8 : 8, y: fitY(sr.y + sr.h / 2 - popH / 2) };
  })() : null;
  const label = sr ? placeLabel(sr, others.map((id) => rects[id]).filter((r): r is R => !!r), board, labelRef.current?.offsetWidth ?? 170, box.current?.clientWidth ?? 9999, box.current?.clientHeight ?? 9999) : null;

  return (
    <Box ref={box} aria-hidden={false} sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4, overflow: "hidden" }}>
      {/* what the AI is writing */}
      {workingIds.filter((id) => !ai.making[id]).map((id) => rects[id] && (
        <Box key={`w-${id}`} sx={{ position: "absolute", left: rects[id].x - 4, top: rects[id].y - 4, width: rects[id].w + 8, height: rects[id].h + 8, borderRadius: "6px", outline: "1.5px dashed rgba(194,44,110,.7)", ...shimmerSx }} />
      ))}
      {ai.working && (
        <Box role="status" sx={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.7, borderRadius: "8px", bgcolor: "rgba(255,255,255,.96)", border: "1px solid rgba(194,44,110,.3)", boxShadow: "0 8px 24px -12px rgba(16,24,40,.35)", whiteSpace: "nowrap" }}>
          <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: PINK }} />
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: PINK }}>{ai.working.label}…</Typography>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#8a94a3", fontVariantNumeric: "tabular-nums" }}>{clock}</Typography>
        </Box>
      )}

      {/* the empty frames: the idea and Make it / Upload, in the frame */}
      {frames.map((f) => {
        const r = rects[f.id];
        if (!r) return null;
        if (ai.making[f.id]) return <MakingOver key={f.id} r={r} upload={!!ai.uploading[f.id]} from={ai.making[f.id]?.idea} label={ai.making[f.id]?.label} />;
        // the selected frame's popup does the same, beside it
        if (popOpen && popFor?.id === f.id) return null;
        if (!ctx.canEdit || f.locked || r.w < 120 || r.h < 70) return null;
        return (
          <Box key={f.id} sx={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.75, p: 1, boxSizing: "border-box", outline: "1.5px dashed rgba(39,78,100,.35)", outlineOffset: -6, borderRadius: "6px" }}>
            {r.h > 120 && r.w > 200 && (
              <Typography sx={{ maxWidth: Math.min(r.w - 24, 320), fontSize: "0.76rem", color: "#4b5563", textAlign: "center", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {ai.ideaFor(f.id)}
              </Typography>
            )}
            <Box sx={{ pointerEvents: "auto" }}>
              <EmptyActions compact canMake={ctx.api.data.ai} onMake={() => void ai.makeFor(f.id)} onUpload={(file) => void ai.uploadFor(f.id, file)} onGallery={() => onGallery(f.id)} />
            </Box>
            {ai.slotError[f.id] && <Typography sx={{ fontSize: "0.72rem", color: "#b42318", bgcolor: "rgba(255,255,255,.9)", px: 0.75, borderRadius: "4px" }}>{ai.slotError[f.id]}</Typography>}
          </Box>
        );
      })}
      {/* a picture being made again */}
      {makingIds.filter((id) => !frames.some((f) => f.id === id)).map((id) => rects[id] && <MakingOver key={`m-${id}`} r={rects[id]} upload={!!ai.uploading[id]} from={ai.making[id]?.idea} label={ai.making[id]?.label} />)}

      {/* the selected element: its label, and a picture's actions */}
      {sel && sr && !typing && (
        <Box ref={labelRef} sx={{ position: "absolute", left: label?.x ?? sr.x, top: label?.y ?? sr.y - 32, display: "inline-flex", alignItems: "center", gap: 0.25, height: 26, pl: 1, pr: 0.25, borderRadius: "6px", bgcolor: "#16202a", color: "#fff", boxShadow: "0 6px 16px -8px rgba(0,0,0,.5)", pointerEvents: "auto", whiteSpace: "nowrap" }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#fff", pr: 0.5 }}>{elementName(sel, headlineId)}</Typography>
          {ctx.canEdit && ctx.api.data.ai && (
            <Box component="button" type="button" onClick={askHere} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.75, height: 22, borderRadius: "4px", fontSize: "0.74rem", fontWeight: 700, color: "#ffc2dc", borderLeft: "1px solid rgba(255,255,255,.18)", "&:hover": { bgcolor: "rgba(255,255,255,.12)" }, "& svg": { fontSize: 14 } }}>
              <AutoAwesomeOutlinedIcon />Ask AI
            </Box>
          )}
          <Box component="button" type="button" aria-label="Deselect" onClick={() => ctx.canvas.current?.select([])} sx={{ all: "unset", cursor: "pointer", display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: "4px", color: "rgba(255,255,255,.75)", "&:hover": { bgcolor: "rgba(255,255,255,.12)", color: "#fff" }, "& svg": { fontSize: 14 } }}>
            <CloseIcon />
          </Box>
        </Box>
      )}
      {sel && sr && !popOpen && isPictureNode(sel) && ctx.canEdit && !sel.locked && !ai.making[sel.id] && sr.w > 140 && (
        <Box sx={{ position: "absolute", left: sr.x + sr.w / 2, top: Math.min(sr.y + sr.h - 46, (box.current?.clientHeight ?? 9999) - 52), transform: "translateX(-50%)", px: 0.5, py: 0.4, borderRadius: "8px", bgcolor: "rgba(22,32,42,.9)", boxShadow: "0 8px 20px -10px rgba(0,0,0,.6)", pointerEvents: "auto" }}>
          <PictureActions dark canMake={ctx.api.data.ai} onMake={() => void ai.makeFor(sel.id)} onUpload={(file) => void ai.uploadFor(sel.id, file)} onGallery={() => onGallery(sel.id)} onRemove={() => ai.removeFrom(sel.id)} />
        </Box>
      )}

      {/* cv16: the selected element's own popup */}
      {popOpen && popFor && popAt && (
        <Box ref={popRef} data-testid="element-pop" sx={{ position: "absolute", left: popAt.x, top: popAt.y, width: POP_W, pointerEvents: "auto", zIndex: 6 }}
          onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ElementPop ctx={ctx} node={popFor} name={elementName(popFor, headlineId)} nodes={nodes} onClose={() => setClosed(popFor.id)} />
        </Box>
      )}
    </Box>
  );
}
