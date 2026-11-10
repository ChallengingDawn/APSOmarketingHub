"use client";

// THE VISIT REPLAY, played (SARCLA 10.11.2026: "we see the screen which is good but don't see the mouse and behaviour on
// the shop"; "we still don't see any page movement"): a recorded page view laid over the page as it looks - the shop's
// still picture of the page (no script of the shop runs, the browser's cache is shared) at the visitor's window width,
// scrolled as they scrolled, their pointer moving and each click a ripple. Play, pause, faster, a timeline. The
// recording itself: src/lib/convert/replays.ts and the shop gateway's src/convert/replay.ts.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import type { ReplayFull, ReplayRow } from "@/lib/convert/replays";
import { stateAt } from "@/lib/convert/replayRules";

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function ReplayPlayer({ row }: { row: ReplayRow }) {
  const url = `/api/website/ai-personalization/visits/replay?pv=${row.pv}`;
  const held = useHeld<ReplayFull>(url, [url]);
  const full = held.result?.state === "ok" ? held.result.data : null;
  const ev = useMemo(() => (full?.ev ?? []).slice().sort((a, b) => a[0] - b[0]), [full]);
  const end = Math.max(1000, full?.ms ?? row.ms);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(800);
  const W = Math.min(1600, Math.max(320, row.w));
  const H = Math.min(1400, Math.max(400, row.vh));
  const scale = width / W;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 800));
    ro.observe(el);
    setWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  // the clock
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) * speed; last = now;
      setT((x) => { const n = x + dt; if (n >= end) { setPlaying(false); return end; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, end]);

  const st = stateAt(ev, t);
  // the page scrolled as the visitor scrolled it (the still page scrolls its body - c5c27ef3)
  useEffect(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    try {
      const d = w.document;
      w.scrollTo(0, st.scroll);
      if (d.body) d.body.scrollTop = st.scroll;
      if (d.documentElement) d.documentElement.scrollTop = st.scroll;
    } catch { /* not readable yet */ }
  }, [st.scroll]);

  const env = row.host.startsWith("acc.") ? "acc" : "prod";
  const src = `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(row.path)}&still=1`;
  const cursor = st.px !== null && st.py !== null ? { x: (st.px / 1000) * W * scale, y: (st.py - st.scroll) * scale } : null;

  if (held.result === null) return <LoadingPanel label="Reading the recorded page view…" />;
  if (held.result.state !== "ok") return <Notice tone="warn">{held.result.state === "error" ? held.result.error : "The recording could not be read."}</Notice>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box ref={box} sx={{ position: "relative", width: "100%", height: H * scale, overflow: "hidden", borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
        <Box component="iframe" ref={frame} src={src} title={`The page ${row.path}`} sandbox="allow-same-origin" tabIndex={-1}
          sx={{ position: "absolute", left: 0, top: 0, width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }} />
        {st.clicks.map((c, i) => (
          <Box key={i} sx={{ position: "absolute", left: (c.x / 1000) * W * scale - 14, top: (c.y - st.scroll) * scale - 14, width: 28, height: 28, borderRadius: "50%",
            border: "3px solid #e0491f", opacity: 1 - c.age / 700, transform: `scale(${0.6 + c.age / 500})`, pointerEvents: "none" }} />
        ))}
        {cursor && (
          <Box component="svg" viewBox="0 0 24 24" sx={{ position: "absolute", left: cursor.x, top: cursor.y, width: 22, height: 22, pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))", transition: playing ? "left .12s linear, top .12s linear" : "none" }}>
            <path d="M3 2l7.5 19 2.4-7.6L20.5 11z" fill="#15223a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </Box>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <IconButton onClick={() => { if (t >= end) setT(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"} sx={{ bgcolor: "#2459d1", color: "#fff", "&:hover": { bgcolor: "#1d47a8" } }}>
          {playing ? <PauseRoundedIcon /> : t >= end ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
        <Slider size="small" value={t} min={0} max={end} onChange={(_, v) => { setPlaying(false); setT(v as number); }} sx={{ flex: "1 1 240px", mx: 1 }} />
        <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums", minWidth: 84 }}>{mmss(t)} / {mmss(end)}</Typography>
        {[1, 2, 4].map((x) => (
          <Button key={x} size="small" variant={speed === x ? "contained" : "outlined"} disableElevation onClick={() => setSpeed(x)} sx={{ minWidth: 40, textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>{x}×</Button>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        {row.dev === "m" ? "On a phone" : "On a desktop"}, a window {row.w} px wide · {ev.length} moments · the page as it looks today, so a part may have moved since.
      </Typography>
    </Box>
  );
}
