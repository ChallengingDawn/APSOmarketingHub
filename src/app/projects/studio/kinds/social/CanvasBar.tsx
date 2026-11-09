"use client";
// THE CANVAS'S BAR (SARCLA 08.11.2026: "this top bar needs to be completely reworked, I don't like it"). Minimal: undo and
// redo, the format the board is in (and the post's other formats), the zoom. Export sits at the foot of the map since
// 09.11 (beside the last step, flow standard §5). No "Use design", no "unsaved
// changes" - every change saves itself. The rare things (the editable file, an import, replacing a word everywhere, the
// keys) wait behind "…".

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";

import { applyReplace } from "@/lib/editor/findReplace";
import {
  FORMATS, adaptDoc, cleanDoc, formatLabel, readapt, sizeOf, withoutFormat, type FormatKey, type SocialDesign,
} from "@/lib/content/studio/kinds/social/design";
import { formatsInUse } from "@/lib/content/studio/kinds/social/model";
import { Btn, IconBtn, BAR_H, T } from "./look";
import { fileStem, save } from "./actions";
import type { StudioCtx } from "./Studio";

/** A small picture of a format's shape. */
export function FormatGlyph({ f, d, size = 16, on }: { f: FormatKey; d: Pick<SocialDesign, "custom">; size?: number; on?: boolean }) {
  const s = sizeOf(f, d);
  const k = size / Math.max(s.w, s.h);
  return (
    <Box sx={{ width: size, height: size, display: "grid", placeItems: "center", flexShrink: 0 }}>
      {/* a filled shape, so it never reads as a checkbox */}
      <Box sx={{ width: Math.max(4, s.w * k), height: Math.max(4, s.h * k), borderRadius: "2px", bgcolor: on ? T.accent : "currentColor", opacity: on ? 0.9 : 0.42 }} />
    </Box>
  );
}

const KEYS: [string, string][] = [
  ["Double-click", "Type in a text"], ["*word*", "Makes a word red"], ["Shift + click", "Select more"], ["Arrows", "Nudge 1 px (Shift: 10)"],
  ["Ctrl + D", "Duplicate"], ["Delete", "Remove"], ["Ctrl + Z / Ctrl + Y", "Undo / redo"], ["Ctrl + wheel", "Zoom"], ["Esc", "Deselect"],
];

export default function CanvasBar({ ctx, hist, zoom }: { ctx: StudioCtx; hist: { past: number; future: number }; zoom: { scale: number; fit: boolean } }) {
  const d = ctx.doc.design;
  const c = ctx.canvas.current;
  const [fmtAnchor, setFmtAnchor] = useState<HTMLElement | null>(null);
  const [zoomAnchor, setZoomAnchor] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [replace, setReplace] = useState<HTMLElement | null>(null);
  const [keys, setKeys] = useState<HTMLElement | null>(null);
  const [find, setFind] = useState("");
  const [rep, setRep] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const stem = fileStem(ctx.api.data.piece.title);
  const used = formatsInUse(ctx.doc);

  return (
    <Box sx={{ height: BAR_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 0.5, px: 1.5, bgcolor: "rgba(255,255,255,.86)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}`, zIndex: 2 }}>
      <IconBtn title="Undo (Ctrl+Z)" onClick={() => c?.undo()} disabled={!hist.past || !ctx.canEdit}><UndoIcon /></IconBtn>
      <IconBtn title="Redo (Ctrl+Y)" onClick={() => c?.redo()} disabled={!hist.future || !ctx.canEdit}><RedoIcon /></IconBtn>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1.25, borderColor: T.line }} />

      {/* the board's size, quietly; the formats themselves are the squared choices on the right (flow standard §1) */}
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 0.5, color: T.ink3, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", minWidth: 0, flexShrink: 1, overflow: "hidden" }}>
        <FormatGlyph f={ctx.fmt} d={d} />
        {sizeOf(ctx.fmt, d).w} × {sizeOf(ctx.fmt, d).h}
      </Box>
      <Menu anchorEl={fmtAnchor} open={!!fmtAnchor} onClose={() => setFmtAnchor(null)} slotProps={{ paper: { sx: { width: 320, borderRadius: "12px", mt: 0.5, boxShadow: T.shadow } } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.72rem", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em" }}>This post's formats</Typography>
        {d.formats.map((f) => (
          <MenuItem key={f} selected={f === ctx.fmt} onClick={() => { setFmtAnchor(null); if (f !== ctx.fmt) ctx.goFormat(f); }} sx={{ gap: 1.25, py: 1 }}>
            <FormatGlyph f={f} d={d} size={20} on={f === ctx.fmt} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{formatLabel(f, d)}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: T.ink3 }}>{f === "custom" ? "Your own size" : FORMATS[f].where}{used.includes(f) ? " · goes out" : ""}</Typography>
            </Box>
            {f === ctx.fmt && <CheckIcon sx={{ fontSize: 18, color: T.accent }} />}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setFmtAnchor(null); ctx.openPanel("size"); }} sx={{ fontSize: "0.86rem" }}>Add a format…</MenuItem>
        {d.formats.length > 1 && (
          <MenuItem disabled={!ctx.canEdit} onClick={() => {
            setFmtAnchor(null);
            if (!window.confirm(`Make the other formats again from this ${ctx.fmt === "custom" ? "custom" : FORMATS[ctx.fmt].label.toLowerCase()} one? What was changed by hand in them is replaced.`)) return;
            ctx.set((x) => ({ ...x, design: d.formats.filter((f) => f !== ctx.fmt).reduce((acc, f) => readapt(acc, f, ctx.fmt), x.design) }));
          }} sx={{ fontSize: "0.86rem" }}>Make the other formats from this one</MenuItem>
        )}
        {d.formats.length > 1 && (
          <MenuItem disabled={!ctx.canEdit} onClick={() => {
            setFmtAnchor(null);
            const f = ctx.fmt;
            ctx.set((x) => ({ ...x, design: withoutFormat(x.design, f) }));
            ctx.goFormat(d.formats.find((g) => g !== f) ?? "square");
          }} sx={{ fontSize: "0.86rem", color: "#b42318" }}>Remove this format</MenuItem>
        )}
      </Menu>

      <Box sx={{ flex: 1 }} />
      {note && <Typography sx={{ fontSize: "0.8rem", color: T.ink2, mr: 1, maxWidth: 360 }} noWrap title={note}>{note}</Typography>}

      {/* the post's formats, squared; adding, remaking, removing one behind the small arrow */}
      <Box role="radiogroup" aria-label="The post's formats" sx={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${T.line2}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
        {d.formats.map((f, i) => {
          const on = f === ctx.fmt;
          return (
            <Box key={f} component="button" type="button" role="radio" aria-checked={on} onClick={() => { if (!on) ctx.goFormat(f); }} sx={{
              all: "unset", cursor: on ? "default" : "pointer", px: 1.1, height: 30, display: "inline-flex", alignItems: "center", fontSize: "0.78rem", fontWeight: 650, whiteSpace: "nowrap",
              borderLeft: i ? `1px solid ${T.line2}` : "none", color: on ? "#fff" : T.ink, bgcolor: on ? "#2459d1" : "transparent",
              "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)", color: "#2459d1" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: -2 },
            }}>{f === "custom" ? "Custom" : FORMATS[f].label}</Box>
          );
        })}
      </Box>
      <IconBtn title="Add, remake or remove a format" onClick={(e) => setFmtAnchor(e.currentTarget)} active={!!fmtAnchor}><KeyboardArrowDownIcon /></IconBtn>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1.25, borderColor: T.line }} />

      {/* zoom */}
      <IconBtn title="Zoom out" onClick={() => c?.zoom("out")}><RemoveIcon /></IconBtn>
      <Box component="button" type="button" onClick={(e) => setZoomAnchor(e.currentTarget)} sx={{ all: "unset", cursor: "pointer", minWidth: 52, textAlign: "center", height: 34, lineHeight: "34px", borderRadius: "8px", fontSize: "0.84rem", fontWeight: 600, color: T.ink, fontVariantNumeric: "tabular-nums", "&:hover": { bgcolor: T.hover } }}>
        {Math.round(zoom.scale * 100)}%
      </Box>
      <IconBtn title="Zoom in" onClick={() => c?.zoom("in")}><AddIcon /></IconBtn>
      <Menu anchorEl={zoomAnchor} open={!!zoomAnchor} onClose={() => setZoomAnchor(null)} slotProps={{ paper: { sx: { borderRadius: "10px", minWidth: 150 } } }}>
        <MenuItem selected={zoom.fit} onClick={() => { setZoomAnchor(null); c?.zoom("fit"); }}>Fit to the screen</MenuItem>
        {[0.5, 0.75, 1, 1.5, 2].map((z) => <MenuItem key={z} onClick={() => { setZoomAnchor(null); c?.zoom(z); }}>{z * 100}%</MenuItem>)}
      </Menu>
      <IconBtn title="Fit to the screen" onClick={() => c?.zoom("fit")} disabled={zoom.fit}><FitScreenOutlinedIcon /></IconBtn>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1.25, borderColor: T.line }} />

      {/* the rare things */}
      <IconBtn title="More" onClick={(e) => setMore(e.currentTarget)} active={!!more}><MoreHorizIcon /></IconBtn>
      <Menu anchorEl={more} open={!!more} onClose={() => setMore(null)} slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 260 } } }}>
        <MenuItem onClick={(e) => { setReplace(e.currentTarget); setMore(null); }} disabled={!ctx.canEdit}>Replace a word everywhere…</MenuItem>
        <MenuItem onClick={() => {
          setMore(null);
          const scene = c?.scene();
          if (!scene) return;
          const url = URL.createObjectURL(new Blob([JSON.stringify(scene, null, 1)], { type: "application/json" }));
          save(url, `${stem}-${ctx.fmt}-page-${ctx.pageIx + 1}.json`);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }}>Download this page as an editable file</MenuItem>
        <MenuItem disabled={!ctx.canEdit} onClick={() => { setMore(null); file.current?.click(); }}>Import a page from a file…</MenuItem>
        <Divider />
        <MenuItem onClick={(e) => { setKeys(e.currentTarget); setMore(null); }}>Keyboard shortcuts</MenuItem>
      </Menu>
      <input ref={file} type="file" hidden accept="application/json,.json" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f || !c) return;
        try {
          const raw = cleanDoc(JSON.parse(await f.text()), sizeOf(ctx.fmt, d));
          if (!raw || !raw.nodes.length) { setNote("That file holds no design."); return; }
          c.load(adaptDoc(raw, sizeOf(ctx.fmt, d)));
          setNote("Imported - Ctrl+Z takes it back.");
        } catch { setNote("That file is not a design."); }
      }} />
      <Popover open={!!replace} anchorEl={replace} onClose={() => setReplace(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 2, width: 340, borderRadius: "12px" } } }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, mb: 0.5 }}>Replace a word everywhere</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: T.ink3, mb: 1.5 }}>On every page, in every format.</Typography>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          let changed = 0;
          ctx.set((x) => ({
            ...x, design: {
              ...x.design, pages: x.design.pages.map((p) => ({
                ...p, by: Object.fromEntries(Object.entries(p.by).map(([k, doc]) => {
                  if (!doc) return [k, doc];
                  const r = applyReplace(doc.nodes, find, rep);
                  changed += r.changed;
                  return [k, { ...doc, nodes: r.blocks }];
                })),
              })),
            },
          }));
          setTimeout(() => { setNote(changed ? `Replaced in ${changed} text${changed > 1 ? "s" : ""}.` : `Nothing says "${find}".`); ctx.reload(); }, 0);
          setReplace(null);
        }} sx={{ display: "grid", gap: 1 }}>
          <TextField size="small" autoFocus label="Find" value={find} onChange={(e) => setFind(e.target.value)} />
          <TextField size="small" label="Replace with" value={rep} onChange={(e) => setRep(e.target.value)} />
          <Btn main type="submit" disabled={!find.trim()}>Replace</Btn>
        </Box>
      </Popover>
      <Popover open={!!keys} anchorEl={keys} onClose={() => setKeys(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 2, width: 330, borderRadius: "12px" } } }}>
        {KEYS.map(([k, v]) => (
          <Box key={k} sx={{ display: "flex", gap: 1.5, py: 0.5 }}>
            <Typography sx={{ width: 130, fontSize: "0.78rem", fontWeight: 700, fontFamily: "ui-monospace, Consolas, monospace", color: T.ink }}>{k}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: T.ink2 }}>{v}</Typography>
          </Box>
        ))}
      </Popover>

    </Box>
  );
}

