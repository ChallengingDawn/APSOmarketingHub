"use client";
// THE FILM, PLAYING (08.11.2026; Content v3 - SARCLA: "the controls are really hard"). The film itself, live, as big as
// the stage allows: a click on it plays or pauses; under it one play button, the time, and the scenes as a strip
// (Strip.tsx - given here as `strip`, so it follows the playhead without the rest of the studio redrawing 30 times a
// second). Space plays and pauses. It always loops. What plays here is what the render machine renders: the same
// Film component, frame for frame.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Film } from "@/lib/content/studio/kinds/video/film/Film";
import { LAYOUTS } from "@/lib/content/studio/kinds/video/film/layout";
import { loadFilmFonts } from "@/lib/content/studio/kinds/video/film/fonts";
import { FPS } from "@/lib/content/studio/kinds/video/engine/timeline";
import { segmentAt, segments, totalFrames, type Segment, type VideoDoc } from "@/lib/content/studio/kinds/video/model";

export type PlayerHandle = {
  /** Moves to frame `f`; `play` starts it from there. */
  seek: (f: number, play?: boolean) => void;
  pause: () => void;
};

const clock = (f: number) => {
  const s = Math.floor(Math.max(0, f) / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Player({ doc, handle, onScene, strip, onOpen, overlay, onPick }: {
  doc: VideoDoc;
  handle: React.MutableRefObject<PlayerHandle | null>;
  /** The scene showing changed (its index; -1 = the end card). */
  onScene?: (index: number) => void;
  /** What sits under the controls, given the frame and the scene playing. */
  strip?: (frame: number, seg: Segment, playing: boolean) => React.ReactNode;
  /** A double-click on the film: the scene showing (-1 = the end card) and where, in the film's own pixels. */
  onOpen?: (index: number, at: { x: number; y: number }) => void;
  /** Drawn over the film, in the film's own pixels scaled to the stage (the words typed on it). */
  overlay?: (scale: number) => React.ReactNode;
  /** A click on the film held still (cv16, the Page builder's "a click selects ONE element"): the scene showing and where,
   *  in the film's own pixels - true when it picked something there (the film then stays still), false to play. */
  onPick?: (index: number, at: { x: number; y: number }) => boolean;
}) {
  const L = LAYOUTS[doc.format];
  const segs = useMemo(() => segments(doc), [doc]);
  const total = totalFrames(doc);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [, setFonts] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const frameRef = useRef(0);
  frameRef.current = frame;

  // the film's font, then its words are measured with it
  useEffect(() => { void loadFilmFonts("").then((ok) => setFonts(ok)); }, []);

  // the clock: 30 frames a second from where it started, whatever the screen's own rate; it loops
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now();
    const f0 = frameRef.current >= total - 1 ? 0 : frameRef.current;
    const tick = (now: number) => {
      const f = (f0 + Math.floor(((now - t0) * FPS) / 1000)) % total;
      if (f !== frameRef.current) setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, epoch]);

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

  // scaled to fit the stage
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

  // one click plays or pauses; a double-click opens the scene showing (the click waits a moment to know which)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const click = (e: React.MouseEvent<HTMLElement>) => {
    // held still, a click on a line or a picture picks it (cv16); on nothing, or while playing, it plays or pauses
    const r = e.currentTarget.getBoundingClientRect();
    const at = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    const toggle = () => { if (playing || !onPick?.(segIndex, at)) setPlaying((x) => !x); };
    if (!onOpen) { toggle(); return; }
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickTimer.current = null; toggle(); }, 230);
  };
  const dbl = (e: React.MouseEvent<HTMLElement>) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setPlaying(false);
    const r = e.currentTarget.getBoundingClientRect();
    onOpen?.(segIndex, { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale });
  };

  const keys = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable], [role=textbox]")) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); setPlaying((x) => !x); }
  };

  return (
    <Box tabIndex={0} onKeyDown={keys} aria-label="The film - space plays and pauses"
      sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.25, outline: "none", minHeight: 0 }}>
      <Box ref={box} sx={{ flex: 1, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <Box onClick={click} onDoubleClick={dbl} title={onPick ? "Click a line or a picture to change it · double-click: every word of the scene" : onOpen ? "Click: play or pause · double-click: change this scene" : undefined} sx={{ width: L.W * scale, height: L.H * scale, flexShrink: 0, overflow: "hidden", borderRadius: "10px", boxShadow: "0 18px 50px rgba(31,45,78,.20)", border: `1px solid ${HAIRLINE}`, cursor: "pointer", position: "relative", bgcolor: "#F4F6F8" }}>
          <div style={{ width: L.W, height: L.H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <Film doc={doc} frame={frame} />
          </div>
          {overlay?.(scale)}
          {!playing && !overlay && !onPick && (
            <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0, transition: "opacity .15s", "&:hover": { opacity: 1 } }}>
              <Box sx={{ width: 60, height: 60, borderRadius: "50%", bgcolor: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(31,45,78,.2)" }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 36, color: INK }} />
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, bgcolor: "rgba(255,255,255,.92)", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", px: 1.25, pt: 1, pb: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <IconButton size="small" onClick={() => setPlaying((x) => !x)} aria-label={playing ? "Pause" : "Play"}
            sx={{ bgcolor: "#d80901", color: "#fff", borderRadius: "8px", "&:hover": { bgcolor: "#b00700" }, width: 36, height: 36 }}>
            {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
          </IconButton>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK, fontVariantNumeric: "tabular-nums" }}>{clock(frame)}</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>/ {clock(total)}</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{onPick ? "Click a line or a picture on the film to change it · drag a scene to move it" : onOpen ? "Double-click the film to change the scene showing · drag a scene to move it" : "Click a scene to open it · drag to move it"}</Typography>
        </Box>
        {strip?.(frame, seg, playing)}
      </Box>
    </Box>
  );
}
