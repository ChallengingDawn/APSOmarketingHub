"use client";

// THE VISIT REPLAY, played (SARCLA 10.11.2026: "we see the screen which is good but don't see the mouse and behaviour on
// the shop"; "we still don't see any page movement"): a recorded page view laid over the page as it looks - the shop's
// still picture of the page (no script of the shop runs, the browser's cache is shared) at the visitor's window width,
// scrolled as they scrolled, their pointer moving and each click a ripple. Play, pause, faster, a timeline. The
// recording itself: src/lib/convert/replays.ts and the shop gateway's src/convert/replay.ts.
//
// THE CLICKS, SEEN (SARCLA 13.11.2026: "on video we still don't see where the customer clicks"): the ring of a click lasted
// 0.7 s of the recording - at 2x a third of a second. Now each click stays on the page as a numbered mark once the
// playback has passed it (a ring when it happens, a second long at any speed), the timeline carries a tick at each click,
// and the list under it says when and what was clicked - a click there goes to it. The recording keeps only where (x in
// thousandths of the window, y on the page), never the element: what was clicked is read from the page as drawn here
// (the frame shares the hub's origin), so a part changed since names what is there today. Still parts are skipped.
// `embedded`: inside the visit played back step by step (./Player.tsx) - its Play drives this one, the next step comes
// when the page view ends.

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
import { clickName, clicksOf, skipIdle, smallestAt, stateAt, type ReplayClick } from "@/lib/convert/replayRules";

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const CLICK = "#e0491f";
const FOCUS = "#c5221f";
/** What a click lands on, as the shop's click counter takes it: the link, button, field or picture around the point. */
const TARGET = "a,button,input,select,textarea,label,[role=button],img";

/** What each click landed on, read from the page as drawn in the frame - null while the frame cannot be read. */
function whatWasClicked(frame: HTMLIFrameElement | null, W: number, clicks: ReplayClick[]): string[] | null {
  try {
    const win = frame?.contentWindow, doc = frame?.contentDocument;
    if (!win || !doc || !doc.body) return null;
    // the still page scrolls its body (or the window): the boxes in page px, whichever scrolled
    const top = Math.max(win.scrollY || 0, doc.documentElement?.scrollTop || 0, doc.body.scrollTop || 0);
    const left = Math.max(win.scrollX || 0, doc.documentElement?.scrollLeft || 0, doc.body.scrollLeft || 0);
    const els = Array.from(doc.body.querySelectorAll<HTMLElement>("*")).filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|BR)$/.test(e.tagName)).slice(0, 8000);
    const boxes = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + left, y: r.top + top, w: r.width, h: r.height }; });
    return clicks.map((c) => {
      const i = smallestAt(boxes, (c.x / 1000) * W, c.y);
      if (i < 0) return "On the page";
      const target = els[i].closest<HTMLElement>(TARGET);
      const el = target ?? els[i];
      const text = (el.innerText ?? el.textContent ?? "").trim();
      // a click on a big block (no link, no button) says only where - its first words would name something else
      if (!target && (text.length > 80 || boxes[i].w * boxes[i].h > 150_000)) return clickName({ tag: el.tagName });
      return clickName({
        tag: el.tagName, type: el.getAttribute("type"), role: el.getAttribute("role"), aria: el.getAttribute("aria-label"), alt: el.getAttribute("alt"),
        title: el.getAttribute("title"), placeholder: el.getAttribute("placeholder"), text, imgAlt: el.querySelector("img[alt]")?.getAttribute("alt"),
      });
    });
  } catch {
    return null;
  }
}

export function ReplayPlayer({ row, embedded = false, play = false, rate = 2, onEnded }: {
  row: ReplayRow; embedded?: boolean; play?: boolean; rate?: number; onEnded?: () => void;
}) {
  const url = `/api/website/ai-personalization/visits/replay?pv=${row.pv}`;
  const held = useHeld<ReplayFull>(url, [url]);
  const full = held.result?.state === "ok" ? held.result.data : null;
  const ev = useMemo(() => (full?.ev ?? []).slice().sort((a, b) => a[0] - b[0]), [full]);
  const clicks = useMemo(() => clicksOf(ev), [ev]);
  const end = Math.max(1000, full?.ms ?? row.ms);
  const [t, setT] = useState(0);
  const [own, setOwn] = useState(false);
  const playing = embedded ? play : own;
  const [speed, setSpeed] = useState(2);
  const sp = embedded ? rate : speed;
  const [sel, setSel] = useState<number | null>(null);
  const [whats, setWhats] = useState<string[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(800);
  const [drawn, setDrawn] = useState(0);
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
  }, [full]);

  // the clock - the still parts skipped (nothing moved for 2.5 s)
  useEffect(() => {
    if (!playing || !full) return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) * sp; last = now;
      setT((x) => Math.min(end, skipIdle(ev, x + dt, end)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sp, end, ev, full]);
  // the end of the page view: the player stops - in the visit played back, its next step comes
  const ended = useRef(false);
  useEffect(() => {
    if (t < end) { ended.current = false; return; }
    if (!playing || ended.current) return;
    ended.current = true;
    if (embedded) onEnded?.(); else setOwn(false);
  }, [t, end, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // the ring of a click lasts about a second of the screen's time, at any speed
  const ring = 900 * sp;
  const st = stateAt(ev, t, ring);
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
  // what each click landed on, once the page is drawn (and again a moment later - late fonts move the page)
  useEffect(() => {
    if (!drawn || !clicks.length) return;
    setWhats(whatWasClicked(frame.current, W, clicks));
    const k = setTimeout(() => setWhats(whatWasClicked(frame.current, W, clicks)), 1500);
    return () => clearTimeout(k);
  }, [drawn, clicks, W]);

  const env = row.host.startsWith("acc.") ? "acc" : "prod";
  const src = `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(row.path)}&still=1`;
  const cursor = st.px !== null && st.py !== null ? { x: (st.px / 1000) * W * scale, y: (st.py - st.scroll) * scale } : null;
  const reached = clicks.filter((c) => c.t <= t);
  // a click in the list: the playback goes to it (a moment before while it plays, so the click is seen happening)
  const goTo = (c: ReplayClick) => { setSel(c.k); setT(playing ? Math.max(0, c.t - 800) : c.t); };

  if (held.result === null) return <LoadingPanel label="Reading the recorded page view…" />;
  if (held.result.state !== "ok") return <Notice tone="warn">{held.result.state === "error" ? held.result.error : "The recording could not be read."}</Notice>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box ref={box} sx={{ position: "relative", width: "100%", height: H * scale, overflow: "hidden", borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
        <Box component="iframe" ref={frame} src={src} title={`The page ${row.path}`} sandbox="allow-same-origin" tabIndex={-1} onLoad={() => setDrawn((n) => n + 1)}
          sx={{ position: "absolute", left: 0, top: 0, width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }} />
        {reached.map((c) => {
          const age = t - c.t, on = sel === c.k;
          return (
            <Box key={c.k} sx={{ position: "absolute", left: (c.x / 1000) * W * scale, top: (c.y - st.scroll) * scale, width: 0, height: 0, pointerEvents: "none" }}>
              {age < ring && (
                <Box sx={{ position: "absolute", left: -20, top: -20, width: 40, height: 40, borderRadius: "50%", border: `3px solid ${CLICK}`, boxSizing: "border-box",
                  opacity: 1 - age / ring, transform: `scale(${0.45 + (0.9 * age) / ring})` }} />
              )}
              <Box sx={{ position: "absolute", left: -10, top: -10, width: 20, height: 20, borderRadius: "50%", boxSizing: "border-box", border: "2px solid #fff",
                bgcolor: on ? FOCUS : CLICK, color: "#fff", fontSize: "10px", fontWeight: 700, lineHeight: "16px", textAlign: "center", fontFamily: "system-ui, sans-serif",
                boxShadow: on ? "0 0 0 4px rgba(197,34,31,.3)" : "0 1px 4px rgba(0,0,0,.4)" }}>{c.k}</Box>
            </Box>
          );
        })}
        {cursor && (
          <Box component="svg" viewBox="0 0 24 24" sx={{ position: "absolute", left: cursor.x, top: cursor.y, width: 22, height: 22, pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))", transition: playing ? "left .12s linear, top .12s linear" : "none" }}>
            <path d="M3 2l7.5 19 2.4-7.6L20.5 11z" fill="#15223a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </Box>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {!embedded && (
          <IconButton onClick={() => { if (t >= end) setT(0); setOwn((p) => !p); }} aria-label={playing ? "Pause" : "Play"} sx={{ bgcolor: "#2459d1", color: "#fff", "&:hover": { bgcolor: "#1d47a8" } }}>
            {playing ? <PauseRoundedIcon /> : t >= end ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}
          </IconButton>
        )}
        <Slider size="small" value={t} min={0} max={end} marks={clicks.map((c) => ({ value: c.t }))} aria-label="The page view's time"
          onChange={(_, v) => { if (!embedded) setOwn(false); setT(v as number); }}
          sx={{ flex: "1 1 240px", mx: 1, "& .MuiSlider-mark": { width: 3, height: 12, borderRadius: "1px", bgcolor: CLICK, opacity: 0.85 }, "& .MuiSlider-markActive": { bgcolor: CLICK, opacity: 1 } }} />
        <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums", minWidth: 84 }}>{mmss(t)} / {mmss(end)}</Typography>
        {!embedded && [1, 2, 4].map((x) => (
          <Button key={x} size="small" variant={speed === x ? "contained" : "outlined"} disableElevation onClick={() => setSpeed(x)} sx={{ minWidth: 40, textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>{x}×</Button>
        ))}
      </Box>

      {/* the clicks: when and what - a click here goes to it */}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>
          {clicks.length ? `${clicks.length} click${clicks.length === 1 ? "" : "s"} on this page` : "No click on this page"}
        </Typography>
        {clicks.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The recording has the pointer and the scroll of this page view, and no click.</Typography>}
        {clicks.length > 0 && (
          <Box sx={{ display: "grid", gap: 0.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" } }}>
            {clicks.map((c, i) => {
              const on = sel === c.k, past = c.t <= t;
              return (
                <Box key={c.k} component="button" type="button" onClick={() => goTo(c)} title="Go to this click"
                  sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, minWidth: 0, px: 0.75, py: 0.4, borderRadius: "6px",
                    border: `1px solid ${on ? FOCUS : HAIRLINE}`, bgcolor: past ? "rgba(224,73,31,.06)" : "rgba(255,255,255,.8)", "&:hover": { borderColor: CLICK }, "&:focus-visible": { outline: `2px solid ${CLICK}` } }}>
                  <Box sx={{ width: 18, height: 18, flex: "none", borderRadius: "50%", bgcolor: on ? FOCUS : past ? CLICK : "rgba(224,73,31,.45)", color: "#fff", fontSize: "10px", fontWeight: 700, lineHeight: "18px", textAlign: "center" }}>{c.k}</Box>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontVariantNumeric: "tabular-nums", flex: "none" }}>{mmss(c.t)}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: past ? INK : MUTED, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {whats?.[i] ?? "On the page"}{c.n > 1 ? ` · ${c.n} clicks at once` : ""}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        {row.dev === "m" ? "On a phone" : "On a desktop"}, a window {row.w} px wide · {ev.length} moments{embedded ? ` · played at ${sp}x, the still parts skipped` : " · the still parts skipped"} · the page as it looks today, so a part may have moved since - what was clicked is named from it.
      </Typography>
    </Box>
  );
}
