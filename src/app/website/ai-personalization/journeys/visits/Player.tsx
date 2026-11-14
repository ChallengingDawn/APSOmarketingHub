"use client";

// APSOconvert > Journeys > Visits - THE PLAYER (SARCLA 09.11.2026: "really as a play again their visits"): one visit
// played back step by step - the page as it looks (ONE picture at a time: each costs the hub requests, and the load
// balancer locks the office out past 2,000 in five minutes), what they did on it, the time they spent there, and the
// strip of every step below. Play / pause, previous / next, 1x 2x 4x; 1x plays ten times faster than the visit was.
// THE CLICKS (SARCLA 13.11.2026: "on video we still don't see where the customer clicks"): a step whose page view the
// shop recorded (the same page, opened within 5 minutes - src/lib/convert/replayRules.ts recordedSteps) plays that
// recording in place of the still picture - the page scrolled as they scrolled it, the pointer, each click marked where it
// was made and listed (when, what) - at twice the visit's speed in real time (1x: 2x), and the next step comes when it
// ends. A step without a recording stays the picture: the visit's other sources say which page, never where on it.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { ACCENT, FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { KIND_COLOR, KIND_NAME, type JKind } from "@/lib/journeys/model";
import { SOURCE_NAME, durWords, hasPicture, replayMs, type Speed, type VStep, type Visit } from "@/lib/convert/visitRules";
import { recordedSteps } from "@/lib/convert/replayRules";
import type { ReplayRow } from "@/lib/convert/replays";
import { KindLegend, LookTag, ReachTag, ddmmyyyy, hhmm, mono, weekday } from "./parts";
import { ReplayPlayer } from "./Replay";

const ICON: Partial<Record<JKind, React.ReactNode>> = {
  cart: <ShoppingCartOutlinedIcon />, checkout: <PaymentsOutlinedIcon />, order: <TaskAltOutlinedIcon />, account: <AccountCircleOutlinedIcon />,
  search: <SearchOutlinedIcon />, other: <WebOutlinedIcon />, product: <Inventory2OutlinedIcon />,
};
const NO_PICTURE: Partial<Record<JKind, string>> = {
  cart: "The cart is the customer's own - no picture of it",
  checkout: "The check-out is the customer's own - no picture of it",
  order: "The order went through",
  account: "Their own account pages - no picture of them",
  search: "The search results",
  // a kind of its own since 13.11.2026 (src/lib/journeys/model.ts) - the customer's own list, like the cart
  quickorder: "The quick order is the customer's own list - no picture of it",
  other: "A page of the shop without a picture",
  product: "This product's page is not in the shop's page list",
};

/** Where the visit's step strip gives each step its width: its time, between 20 seconds and 10 minutes. */
const weight = (s: VStep) => (s.secs === null ? 60 : Math.min(600, Math.max(20, s.secs)));

function Placeholder({ step }: { step: VStep }) {
  const c = KIND_COLOR[step.kind];
  return (
    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", p: 3,
      background: `linear-gradient(135deg, color-mix(in srgb, ${c} 10%, #fff), color-mix(in srgb, ${c} 22%, #fff))` }}>
      <Box sx={{ display: "grid", justifyItems: "center", gap: 1.25, maxWidth: 420 }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "16px", bgcolor: c, color: "#fff", display: "grid", placeItems: "center", "& svg": { fontSize: 34 } }}>
          {ICON[step.kind] ?? <WebOutlinedIcon />}
        </Box>
        <Typography sx={{ fontSize: { xs: "1.05rem", md: "1.35rem" }, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{step.kind === "product" ? step.name : step.kind === "search" ? step.name : KIND_NAME[step.kind]}</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{NO_PICTURE[step.kind] ?? ""}</Typography>
      </Box>
    </Box>
  );
}

/** `start`: a number that changes each time a person asks to play this visit from its start (0: shown, not played);
 *  `recorded`: the customer's page views the shop recorded (the pointer, the scroll, the clicks). */
export function Player({ visit, names, start = 0, onEnded, recorded }: { visit: Visit; names: Map<string, string>; start?: number; onEnded?: () => void; recorded?: ReplayRow[] }) {
  const steps = visit.steps;
  const recs = useMemo(() => recordedSteps(steps, recorded ?? []), [steps, recorded]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(start > 0);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  // the picture follows the step a moment later: a step skipped quickly never asks for its page
  const [shown, setShown] = useState(0);

  useEffect(() => { setI(0); setShown(0); setEnded(false); setPlaying(false); }, [visit.id]);
  useEffect(() => { if (start > 0) { setI(0); setEnded(false); setPlaying(true); } }, [start]);
  useEffect(() => { const t = setTimeout(() => setShown(i), 300); return () => clearTimeout(t); }, [i]);

  const step = steps[Math.min(i, steps.length - 1)];
  const rec = recs.get(Math.min(i, steps.length - 1)) ?? null;
  const pic = steps[Math.min(shown, steps.length - 1)];
  const total = useMemo(() => steps.reduce((n, s) => n + weight(s), 0), [steps]);
  const dur = replayMs(step.secs, speed);

  const go = (n: number) => { setEnded(false); setI(Math.max(0, Math.min(steps.length - 1, n))); };
  const advance = () => {
    if (i < steps.length - 1) setI(i + 1);
    else { setPlaying(false); setEnded(true); onEnded?.(); }
  };
  const toggle = () => {
    if (ended) { setEnded(false); setI(0); setPlaying(true); return; }
    setPlaying((p) => !p);
  };

  const who = [...new Set(visit.contacts.map((c) => names.get(c) ?? `Contact ${c}`))];
  const pictured = hasPicture(pic);

  // the page picture's frame is watched from here (PageShot stays as it is): a step's time starts once its page is
  // drawn - or after 8 s, a slow page is not waited for - and a layer says the page is coming meanwhile
  const frameBox = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    if (!pictured || !pic.path) return;
    const box = frameBox.current;
    if (!box) return;
    const path = pic.path;
    const done = () => setDrawn(path);
    let frame: HTMLIFrameElement | null = null;
    const hook = () => {
      const f = box.querySelector("iframe");
      if (f && f !== frame) { frame?.removeEventListener("load", done); frame = f; f.addEventListener("load", done); }
    };
    hook();
    const mo = new MutationObserver(hook);
    mo.observe(box, { childList: true, subtree: true });
    const t = setTimeout(done, 8000);
    return () => { mo.disconnect(); frame?.removeEventListener("load", done); clearTimeout(t); };
  }, [pic.path, pictured]);
  const ready = !hasPicture(step) || drawn === step.path;
  const loading = pictured && drawn !== pic.path;

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0 }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,textarea")) return;
        // a button's own space presses it - only the space on the rest of the player plays or pauses
        if (e.key === " " && !(e.target as HTMLElement).closest("button,a")) { e.preventDefault(); toggle(); }
        else if (e.key === "ArrowRight") go(i + 1);
        else if (e.key === "ArrowLeft") go(i - 1);
      }}>
      {/* what this visit was */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
          {weekday(visit.start)} {ddmmyyyy(visit.start)} · {hhmm(visit.start)}{visit.end !== visit.start ? `-${hhmm(visit.end)}` : ""}
        </Typography>
        <ReachTag reach={visit.reach} />
        <Chip tint="slate">{steps.length} step{steps.length === 1 ? "" : "s"}{steps.length > 1 ? ` · ${durWords(visit.secs)}` : ""}</Chip>
        {who.slice(0, 2).map((n) => <Chip key={n} tint="blue">{n}</Chip>)}
        {who.length > 2 && <Chip tint="blue">+{who.length - 2}</Chip>}
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.75fr) minmax(0,1fr)" }, alignItems: "start" }}>
        {/* the page as they used it - its recording, the clicks on it */}
        {rec ? (
          <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
              <Box sx={{ px: 1, py: 0.35, borderRadius: "6px", bgcolor: "rgba(21,34,58,.86)", color: "#fff", fontSize: "0.78rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {i + 1} / {steps.length} · {hhmm(step.at)}
              </Box>
              <Box sx={{ px: 1, py: 0.35, borderRadius: "6px", bgcolor: KIND_COLOR[step.kind], color: "#fff", fontSize: "0.74rem", fontWeight: 700 }}>{KIND_NAME[step.kind]}</Box>
              <Chip tint="amber">Recorded on the shop - the pointer and the clicks</Chip>
            </Box>
            <ReplayPlayer key={rec.pv} row={rec} embedded play={playing} rate={2 * speed} onEnded={advance} />
          </Box>
        ) : (
        <Box sx={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", minWidth: 0 }}>
          <Box sx={{ position: "relative", width: "100%", aspectRatio: `${1 / 0.62}` }}>
            {pictured
              ? <Box ref={frameBox} sx={{ position: "absolute", inset: 0 }}><PageShot key={pic.path!} env="prod" path={pic.path!} ratio={0.62} label={pic.name} /></Box>
              : <Placeholder step={pic} />}
            {loading && (
              <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(243,245,248,.92)", backdropFilter: "blur(2px)" }}>
                <Box sx={{ display: "grid", justifyItems: "center", gap: 1, width: "min(320px, 80%)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>{pic.name}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Drawing the page from the shop…</Typography>
                  <LinearProgress sx={{ width: "100%", height: 4, borderRadius: 2 }} />
                </Box>
              </Box>
            )}
            <Box sx={{ position: "absolute", left: 10, top: 10, display: "flex", gap: 0.75, alignItems: "center" }}>
              <Box sx={{ px: 1, py: 0.35, borderRadius: "6px", bgcolor: "rgba(21,34,58,.86)", color: "#fff", fontSize: "0.78rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {i + 1} / {steps.length} · {hhmm(step.at)}
              </Box>
              <Box sx={{ px: 1, py: 0.35, borderRadius: "6px", bgcolor: KIND_COLOR[step.kind], color: "#fff", fontSize: "0.74rem", fontWeight: 700 }}>{KIND_NAME[step.kind]}</Box>
            </Box>
            {!playing && i === 0 && !ended && (
              <Box component="button" type="button" onClick={toggle} aria-label="Play the visit" sx={{
                all: "unset", cursor: "pointer", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.25, borderRadius: "12px", bgcolor: "rgba(21,34,58,.88)", color: "#fff",
                fontWeight: 700, fontSize: "1rem", boxShadow: "0 10px 30px rgba(21,34,58,.25)", "&:hover": { bgcolor: ACCENT }, "&:focus-visible": { outline: `3px solid ${ACCENT}` },
              }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 30 }} /> Play the visit
              </Box>
            )}
          </Box>
          {/* how long this step stays on the screen */}
          <Box sx={{ height: 4, bgcolor: "rgba(21,34,58,.06)" }}>
            <Box key={`${visit.id}-${i}-${speed}-${ended}`} onAnimationEnd={advance}
              sx={{ height: "100%", bgcolor: ACCENT, width: ended ? "100%" : 0, transformOrigin: "0 0",
                animation: ended ? "none" : `apsoVisitFill ${dur}ms linear forwards`, animationPlayState: playing && ready ? "running" : "paused",
                "@keyframes apsoVisitFill": { from: { width: "0%" }, to: { width: "100%" } } }} />
          </Box>
        </Box>
        )}

        {/* what they did on it */}
        <Box sx={{ display: "grid", gap: 1.25, alignContent: "start", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".06em" }}>Step {i + 1} of {steps.length}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {hhmm(step.at)} · {step.secs === null ? "the last page" : `${durWords(step.secs)} here`}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "1.12rem", fontWeight: 700, color: INK, lineHeight: 1.3, overflowWrap: "anywhere" }}>{step.name}</Typography>
          {step.path && <Typography sx={mono} title={step.path}>{step.path}</Typography>}
          {step.looks.length > 0 && (
            <Box sx={{ display: "grid", gap: 0.75 }}>
              {step.looks.slice(0, 6).map((l, k) => (
                <Box key={`${l.article}-${k}`} sx={{ p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", display: "grid", gap: 0.5 }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography sx={{ ...mono, color: INK, fontWeight: 700 }}>{l.article || (l.product ? `Product ${l.product}` : "Product page")}</Typography>
                    <LookTag look={l} />
                  </Box>
                  {l.name && <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.35 }}>{l.name}</Typography>}
                </Box>
              ))}
              {step.looks.length > 6 && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>+{step.looks.length - 6} more articles</Typography>}
            </Box>
          )}
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{SOURCE_NAME[step.source]}{step.contact && names.get(step.contact) ? ` · ${names.get(step.contact)}` : ""}</Typography>
          {hasPicture(step) && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button component={Link} href={`${previewHref("prod", step.path!)}&ask=1`} size="small" variant="contained" disableElevation
                startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Find optimizations</Button>
              <Button component={Link} href={previewHref("prod", step.path!)} size="small" variant="outlined" sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>Open in Preview</Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* the controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Tooltip title="Previous step (←)"><span><IconButton onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step" sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px" }}><SkipPreviousRoundedIcon /></IconButton></span></Tooltip>
        <Button onClick={toggle} variant="contained" disableElevation aria-label={playing ? "Pause" : ended ? "Play again" : "Play"}
          startIcon={playing ? <PauseRoundedIcon /> : ended ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, minWidth: 116, py: 0.9 }}>
          {playing ? "Pause" : ended ? "Play again" : i > 0 ? "Play on" : "Play"}
        </Button>
        <Tooltip title="Next step (→)"><span><IconButton onClick={() => go(i + 1)} disabled={i >= steps.length - 1} aria-label="Next step" sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px" }}><SkipNextRoundedIcon /></IconButton></span></Tooltip>
        <Box sx={{ ml: { xs: 0, sm: 1 } }}>
          <SquareChoice<"1" | "2" | "4"> label="Speed" value={String(speed) as "1" | "2" | "4"} onChange={(k) => setSpeed(Number(k) as Speed)}
            options={[{ key: "1", label: "1x" }, { key: "2", label: "2x" }, { key: "4", label: "4x" }]} />
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, ml: { sm: "auto" } }}>1x plays a minute of the visit in 6 seconds</Typography>
      </Box>

      {/* every step, its width its time */}
      <Box sx={{ overflowX: "auto", pb: 0.5, minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: "4px", minWidth: Math.min(steps.length * 34, 900) }}>
          {steps.map((s, k) => {
            const on = k === i;
            return (
              <Tooltip key={k} title={`${hhmm(s.at)} · ${s.name} · ${s.secs === null ? "the last page" : durWords(s.secs)}${recs.has(k) ? " · recorded: the pointer and the clicks" : ""}`}>
                <Box component="button" type="button" onClick={() => go(k)} aria-label={`Step ${k + 1}: ${s.name}`} aria-current={on ? "step" : undefined} sx={{
                  all: "unset", cursor: "pointer", flex: `${weight(s) / total} 1 0`, minWidth: 30, height: 40, borderRadius: "6px", position: "relative",
                  bgcolor: KIND_COLOR[s.kind], opacity: k <= i ? 1 : 0.42, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${INK}` : "none",
                  transition: "opacity .2s", display: "flex", alignItems: "center", px: 0.75, overflow: "hidden",
                  "&:hover": { opacity: 1 }, "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
                }}>
                  <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 1px rgba(0,0,0,.25)" }}>
                    {hhmm(s.at)}{s.looks.length ? ` · ${s.looks.length} art.` : ""}
                  </Typography>
                  {recs.has(k) && <Box component="span" aria-hidden sx={{ position: "absolute", right: 4, top: 4, width: 7, height: 7, borderRadius: "50%", bgcolor: "#e0491f", border: "1.5px solid #fff" }} />}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
      <KindLegend kinds={steps.map((s) => s.kind)} />
    </Box>
  );
}
