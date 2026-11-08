"use client";
// THE SCENES AS A STRIP (08.11.2026, Content v3; SARCLA: "the controls are really hard"). Under the film, every scene
// as a small picture of itself (the film drawn at the moment its words are in), then the end card: a click opens one
// (the film holds on it, its words on the left), a drag changes the order, "+" adds one of our kinds after the one
// open. While the film plays, the scene playing fills with a bar; nothing here needs to be learned.

import { memo, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { AMBER, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Film } from "@/lib/content/studio/kinds/video/film/Film";
import { LAYOUTS } from "@/lib/content/studio/kinds/video/film/layout";
import { FPS } from "@/lib/content/studio/kinds/video/engine/timeline";
import { plain } from "@/lib/content/studio/kinds/video/engine/text";
import { KIND_INFO, MAX_SCENES, SCENE_KINDS, type Issue, type SceneKind, type Segment, type VideoDoc } from "@/lib/content/studio/kinds/video/model";
import { SEL } from "./ui";

const H_MAX = 74;
const H_MIN = 50;

/** The frame a scene is shown at when it is held: its words are in, clear of the cut out of it. */
export const holdFrame = (s: Segment) => s.start + Math.max(0, Math.min(s.dur - 12, 54));

/** A scene drawn small: the film itself at one frame. */
const Thumb = memo(function Thumb({ film, frame, w }: { film: VideoDoc; frame: number; w: number }) {
  const L = LAYOUTS[film.format];
  const scale = w / L.W;
  return (
    <Box sx={{ width: w, height: L.H * scale, overflow: "hidden", position: "relative", bgcolor: "#F4F6F8", pointerEvents: "none" }}>
      <div style={{ width: L.W, height: L.H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <Film doc={film} frame={frame} />
      </div>
    </Box>
  );
});

export default function Strip({ film, segs, selected, playing, frame, issues, disabled, onSelect, onMove, onAdd }: {
  film: VideoDoc; segs: Segment[]; selected: number | null; playing: number | null; frame: number; issues: Issue[]; disabled: boolean;
  onSelect: (i: number) => void; onMove: (from: number, to: number) => void; onAdd: (k: SceneKind) => void;
}) {
  const L = LAYOUTS[film.format];
  // every scene in view where it can be: the pictures shrink a little before the strip scrolls
  const row = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(900);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = (room - 56 - 8 * segs.length) / Math.max(1, segs.length);
  const H = Math.round(Math.max(H_MIN, Math.min(H_MAX, (fit * L.H) / L.W)));
  const w = Math.round((H * L.W) / L.H);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const flag = (i: number | "end") => {
    const mine = issues.filter((x) => x.scene === i);
    return mine.some((x) => x.level === "stop") ? RED : mine.length ? AMBER : null;
  };
  return (
    <Box ref={row} onDragEnd={() => { setDrag(null); setOver(null); }} sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5, alignItems: "flex-start" }}>
      {segs.map((s) => {
        const end = s.index === -1;
        const i = s.index;
        const on = selected === i;
        const live = playing === i;
        const progress = live ? Math.max(0, Math.min(1, (frame - s.start) / s.dur)) : 0;
        const dot = flag(end ? "end" : i);
        const sc = end ? null : film.scenes[i];
        const words = sc ? plain(sc.copy.line1 ?? sc.copy.kicker ?? "") : plain(film.endCard.line);
        return (
          <Box key={`${s.id}-${s.start}`}
            draggable={!end && !disabled}
            onDragStart={(e) => { if (end) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); setDrag(i); }}
            onDragOver={(e) => { if (drag !== null && !end) { e.preventDefault(); setOver(i); } }}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && !end && drag !== i) onMove(drag, i); setDrag(null); setOver(null); }}
            sx={{ flexShrink: 0, width: w, opacity: drag === i ? 0.4 : 1, position: "relative" }}>
            {over === i && drag !== null && drag !== i && <Box sx={{ position: "absolute", left: drag > i ? -6 : undefined, right: drag < i ? -6 : undefined, top: 0, height: H, width: 3, borderRadius: 2, bgcolor: SEL }} />}
            <Tooltip title={words || (end ? "The end card" : "No words yet")} enterDelay={500} placement="top">
              <Box component="button" type="button" onClick={() => onSelect(i)} aria-pressed={on} aria-label={end ? "The end card" : `Scene ${i + 1}`} sx={{
                all: "unset", boxSizing: "border-box", display: "block", cursor: end || disabled ? "pointer" : "grab", position: "relative", borderRadius: "6px", overflow: "hidden",
                outline: on ? `2px solid ${SEL}` : `1px solid ${HAIRLINE}`, outlineOffset: on ? 1 : 0, boxShadow: on ? "0 6px 16px rgba(36,89,209,.18)" : "0 1px 2px rgba(31,45,78,.06)",
                "&:hover": { outline: `2px solid ${on ? SEL : "#9fb3c0"}` }, "&:focus-visible": { outline: `2px solid ${SEL}` },
              }}>
                <Thumb film={film} frame={holdFrame(s)} w={w} />
                {live && <Box sx={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${progress * 100}%`, bgcolor: "#d80901" }} />}
                {dot && <Box sx={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "2px", bgcolor: dot, boxShadow: "0 0 0 2px #fff" }} />}
              </Box>
            </Tooltip>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: on ? SEL : INK, whiteSpace: "nowrap" }}>{end ? "End" : i + 1}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
                {end ? "" : `${KIND_INFO[s.kind as SceneKind].label} · `}{(s.dur / FPS).toFixed(0)} s
              </Typography>
            </Box>
          </Box>
        );
      })}
      <Tooltip title={film.scenes.length >= MAX_SCENES ? `${MAX_SCENES} scenes at most` : "Add a scene"}>
        <span>
          <Box component="button" type="button" disabled={disabled || film.scenes.length >= MAX_SCENES} onClick={(e) => setMenu(e.currentTarget)} aria-label="Add a scene" sx={{
            all: "unset", boxSizing: "border-box", flexShrink: 0, width: 56, height: H, borderRadius: "6px", border: `1.5px dashed ${HAIRLINE}`, display: "grid", placeItems: "center",
            color: MUTED, cursor: "pointer", "&:hover": { borderColor: SEL, color: SEL }, "&:disabled": { opacity: 0.5, cursor: "default" },
          }}>
            <AddRoundedIcon />
          </Box>
        </span>
      </Tooltip>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { width: 300, borderRadius: "10px" } } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {selected !== null && selected >= 0 ? `Add after scene ${selected + 1}` : "Add a scene"}
        </Typography>
        {SCENE_KINDS.map((k) => (
          <MenuItem key={k} onClick={() => { setMenu(null); onAdd(k); }} sx={{ display: "block", whiteSpace: "normal" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{KIND_INFO[k].label}</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{KIND_INFO[k].blurb}</Typography>
          </MenuItem>
        ))}
      </Menu>
      {segs.length === 1 && (
        <Typography sx={{ alignSelf: "center", fontSize: "0.8rem", color: MUTED, ml: 1 }}>No scenes yet - make the film, or add a scene.</Typography>
      )}
    </Box>
  );
}
