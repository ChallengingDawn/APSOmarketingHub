"use client";
// THE VIDEO STUDIO'S PLAYER (08.11.2026): the film itself, live, in the preview pane - its own clock at 30 frames a
// second (requestAnimationFrame), play and pause, a scrub bar with the scenes on it, loop, frame-exact seeking (the
// arrow keys move one frame, with Shift one bar), scaled to fit the pane. What plays here is what the render machine
// renders: the same Film component, frame for frame.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Film } from "@/lib/content/studio/kinds/video/film/Film";
import { LAYOUTS } from "@/lib/content/studio/kinds/video/film/layout";
import { loadFilmFonts } from "@/lib/content/studio/kinds/video/film/fonts";
import { BAR, FPS, timecode } from "@/lib/content/studio/kinds/video/engine/timeline";
import { KIND_INFO, segmentAt, segments, totalFrames, type VideoDoc } from "@/lib/content/studio/kinds/video/model";
import { PINK } from "../../parts";

export type PlayerHandle = {
  /** Moves to frame `f`; `play` starts it from there. */
  seek: (f: number, play?: boolean) => void;
  pause: () => void;
};

const KIND_TONE: Record<string, string> = {
  title: "#e6edfd", words: "#efe8fd", claim: "#fde8f1", steps: "#e7f6ee", product: "#fdf0e3", quote: "#e9eef5", end: "#f6e2e1",
};

export default function Player({ doc, handle, onScene }: {
  doc: VideoDoc;
  handle: React.MutableRefObject<PlayerHandle | null>;
  /** The scene showing changed (its index; -1 = the end card). */
  onScene?: (index: number) => void;
}) {
  const L = LAYOUTS[doc.format];
  const segs = useMemo(() => segments(doc), [doc]);
  const total = totalFrames(doc);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [, setFonts] = useState(false);
  // a seek while playing starts the clock again from the new frame
  const [epoch, setEpoch] = useState(0);
  const frameRef = useRef(0);
  frameRef.current = frame;

  // the film's font, then its words are measured with it
  useEffect(() => { void loadFilmFonts("").then((ok) => setFonts(ok)); }, []);

  // the clock: 30 frames a second from where it started, whatever the screen's own rate
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now();
    const f0 = frameRef.current >= total - 1 ? 0 : frameRef.current;
    const tick = (now: number) => {
      const n = f0 + Math.floor(((now - t0) * FPS) / 1000);
      if (n >= total && !loop) { setFrame(total - 1); setPlaying(false); return; }
      const f = n % total;
      if (f !== frameRef.current) setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, total, epoch]);

  // a shorter film: the playhead stays inside it
  useEffect(() => { if (frame > total - 1) setFrame(Math.max(0, total - 1)); }, [frame, total]);

  const seg = segmentAt(segs, Math.min(frame, total - 1));
  const segIndex = seg.index;
  useEffect(() => { onScene?.(segIndex); }, [segIndex, onScene]);

  const seek = useCallback((f: number, play?: boolean) => {
    const n = Math.max(0, Math.min(total - 1, Math.round(f)));
    frameRef.current = n;
    setFrame(n);
    if (play !== undefined) setPlaying(play);
    setEpoch((e) => e + 1);
  }, [total]);
  useEffect(() => {
    handle.current = { seek, pause: () => setPlaying(false) };
    return () => { handle.current = null; };
  }, [handle, seek]);

  // scaled to fit the pane
  const box = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState({ w: 800, h: 450 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.max(0.05, Math.min(avail.w / L.W, avail.h / L.H));

  // the scrub bar: drag anywhere on it, frame-exact
  const track = useRef<HTMLDivElement | null>(null);
  const fromPointer = (e: React.PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    seek(((e.clientX - r.left) / r.width) * (total - 1), false);
  };
  const keys = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? BAR : 1;
    if (e.key === " " || e.key === "k") { e.preventDefault(); setPlaying((x) => !x); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seek(frame + step, false); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seek(frame - step, false); }
    else if (e.key === "Home") { e.preventDefault(); seek(0, false); }
    else if (e.key === "End") { e.preventDefault(); seek(total - 1, false); }
  };
  const bar = Math.floor(frame / BAR) + 1;

  return (
    <Box tabIndex={0} onKeyDown={keys} aria-label="Film player - space plays, the arrows move a frame, with Shift a bar"
      sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.25, outline: "none", minHeight: 0 }}>
      <Box ref={box} sx={{ flex: 1, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <Box onClick={() => setPlaying((x) => !x)} sx={{ width: L.W * scale, height: L.H * scale, flexShrink: 0, overflow: "hidden", borderRadius: "12px", boxShadow: "0 18px 50px rgba(31,45,78,.20)", border: `1px solid ${HAIRLINE}`, cursor: "pointer", position: "relative", bgcolor: "#F4F6F8" }}>
          <div style={{ width: L.W, height: L.H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <Film doc={doc} frame={frame} />
          </div>
          {!playing && frame === 0 && (
            <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(21,34,58,.06)" }}>
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(31,45,78,.2)" }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 38, color: INK }} />
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, bgcolor: "rgba(255,255,255,.9)", border: `1px solid ${HAIRLINE}`, borderRadius: "14px", px: 1.25, py: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={playing ? "Pause (space)" : "Play (space)"}>
            <IconButton size="small" onClick={() => setPlaying((x) => !x)} sx={{ bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" }, width: 34, height: 34 }} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Back to the start">
            <IconButton size="small" onClick={() => seek(0)} aria-label="Back to the start"><SkipPreviousRoundedIcon sx={{ color: INK }} /></IconButton>
          </Tooltip>
          <Tooltip title={loop ? "Loops - click to play once" : "Plays once - click to loop"}>
            <IconButton size="small" onClick={() => setLoop((x) => !x)} aria-label="Loop" sx={{ color: loop ? PINK : MUTED }}><RepeatRoundedIcon /></IconButton>
          </Tooltip>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums", ml: 0.5 }}>{timecode(frame)}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>/ {timecode(total)}</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            Bar {bar} of {total / BAR} · {seg.kind === "end" ? "End card" : `${seg.index + 1}. ${KIND_INFO[seg.kind].label}`}
          </Typography>
        </Box>
        <Box ref={track} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); fromPointer(e); }}
          onPointerMove={(e) => { if (e.buttons & 1) fromPointer(e); }}
          sx={{ position: "relative", height: 34, mt: 1, borderRadius: "8px", overflow: "hidden", cursor: "ew-resize", touchAction: "none", userSelect: "none", display: "flex", gap: "2px", bgcolor: "#fff" }}>
          {segs.map((s) => (
            <Box key={`${s.id}-${s.start}`} sx={{ flex: `${s.dur} 0 0`, minWidth: 0, bgcolor: KIND_TONE[s.kind] ?? "#eef1f6", px: 0.75, display: "flex", alignItems: "center", borderRadius: "6px", opacity: seg === s ? 1 : 0.8 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.kind === "end" ? "End card" : `${s.index + 1} ${KIND_INFO[s.kind].label}`}
              </Typography>
            </Box>
          ))}
          {/* the bar lines - every cut lands on one */}
          {Array.from({ length: total / BAR - 1 }, (_, i) => (
            <Box key={i} sx={{ position: "absolute", top: 0, bottom: 0, left: `${(((i + 1) * BAR) / total) * 100}%`, width: "1px", bgcolor: "rgba(21,34,58,.10)", pointerEvents: "none" }} />
          ))}
          <Box sx={{ position: "absolute", top: 0, bottom: 0, left: `calc(${(frame / Math.max(1, total - 1)) * 100}% - 1px)`, width: "2px", bgcolor: PINK, pointerEvents: "none", boxShadow: "0 0 0 2px rgba(194,44,110,.18)" }} />
        </Box>
      </Box>
    </Box>
  );
}
