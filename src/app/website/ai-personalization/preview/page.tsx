"use client";

// APSOconvert > PREVIEW (Website > AI testing & personalization). One shop page, live, in ONE layout wherever it is
// opened from (SARCLA 09.11.2026: "the preview application should be the same from all … really confusing"): the page
// and its numbers on top; the optimizations on the left; on the right the chosen one BEFORE | AFTER, both frames at the
// change ("see per optimization old block or pages, new blocks or pages, changes of origin"), its versions A-D ("always
// multiple or 1 version for a/b testing"), what changes in words, a change asked in a sentence - and SEND TO PROJECT:
// a Content project with the page, the optimization and its versions, where the texts and the look are brought to life
// ("so approve is more sent to project"; src/lib/convert/handoff.ts). A shop block (?block=, src/lib/convert/blocks.ts)
// gets many different versions side by side, the way the newsletter band was picked from 30 proposals. Nothing in a
// frame is counted or sent to the shop (src/app/api/website/ai-personalization/preview).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import HighlightAltOutlinedIcon from "@mui/icons-material/HighlightAltOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import MyLocationOutlinedIcon from "@mui/icons-material/MyLocationOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, AMBER, CardTitle, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, clip } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { ENVS, KIND_LABEL, STEP_LABEL, classify, type Env, type PageKind, type Step } from "@/lib/convert/model";
import type { ProblemsData } from "@/lib/convert/problems";
import type { PageRow, PagesList } from "@/lib/convert/pages";
import type { Analysis, BoardRow, Idea, Numbers, Revision, Version } from "@/lib/convert/studio";
import { iceScore } from "@/lib/convert/ice";
import { OP_LABEL, describe, type Change } from "@/lib/convert/versions";
import { projectForPage } from "@/lib/convert/handoff";
import { blockByKey, type ShopBlock } from "@/lib/convert/blocks";
import { CHANGE_LABEL, typeOfIdea } from "@/lib/convert/changeTypes";
import type { SeoData } from "@/lib/convert/seo";
import { convertPost, previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";
import { PageShot } from "../PageShot";
import { ClicksBar, type ClickDev, type ClicksData } from "../ClicksBar";
import { CONVERT } from "../base";
import { AI_GRADIENT, AiButton } from "../AiButton";
import { SendDialog, type SendChoice } from "./SendDialog";

type StudioData = {
  env: Env; path: string;
  page: { status: number; error: string | null; title: string; h1: string[]; description: string; lines: string[]; truncated: boolean; kind: PageKind | null; product: string | null; url: string | null };
  ideas: Idea[]; versions: Version[]; analysis: Analysis | null; canEdit: boolean; canContent: boolean; ai: boolean;
};
/** The ideas' numbered callouts on the page (the frame draws them, ../../../lib/convert/preview.ts shimSource). */
type Spots = { list: { n: number; sel: string; lead: boolean; title: string }[]; focus: number | null };
type Msg = { apsoPreview: "ready"; title: string } | { apsoPreview: "applied"; hit: number[] } | { apsoPreview: "go"; href: string } | { apsoPreview: "scroll"; y: number }
  | { apsoPreview: "picked"; selector: string; tag: string; text: string } | { apsoPreview: "styles"; total: number; nfailed: number; failed: string[] }
  | { apsoPreview: "drawn"; lines: string[] } | { apsoPreview: "body" } | { apsoPreview: "spot"; n: number } | { apsoPreview: "heat"; missing: string[]; names?: Record<string, string> }
  | { apsoPreview: "goto"; found: boolean };
/** Scroll the page in a frame to a block: the change a version makes, the block an optimization is about. */
type Goto = { sel: string; n: number };
type Picked = { selector: string; tag: string; text: string; from: string };
type Device = "desktop" | "phone";
type Zoom = "fit" | "full";
type Sync = { y: number; from: string; n: number };
type View = "both" | "after" | "before";
/** The click map's heat on the page as it is (the frame draws it): an item per element and its tenths. */
type HeatMsg = { list: { s: string; n: number; c: number[] }[]; max: number; focus: string | null };

const API = "/api/website/ai-personalization/work";
const since = (iso: string) => ago(Date.parse(iso) / 1000);
const pct = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);

// ---------------------------------------------------------------------------------------------------------------------
// THE FRAME

function Frame({ src, device, zoom, label, address, name, sync, pick, marks, spots, heat, goto, tall, onMsg, onRetry }: {
  src: string; device: Device; zoom: Zoom; label: string; address: string; name: string; sync: Sync | null;
  pick: boolean; marks: boolean; spots?: Spots | null; heat?: HeatMsg | null; goto?: Goto | null; tall?: number;
  onMsg: (m: Msg, from: string) => void; onRetry: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [w, setW] = useState(0);
  const [vh, setVh] = useState(800);
  const [ready, setReady] = useState(false);
  // the page's body has begun: it draws as its files come, so it is shown at once with a thin line on top (SARCLA
  // 08.11.2026 - a minute behind "Reading the page from the shop…" read as a broken preview)
  const [drawing, setDrawing] = useState(false);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { setW(el.clientWidth); setVh(window.innerHeight); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setReady(false);
    setDrawing(false);
    setLate(false);
    // a cold hub reads the page's ~130 files from the shop six at a time: up to ~30 s once a day, then from memory
    const t = setTimeout(() => setLate(true), 45_000);
    return () => clearTimeout(t);
  }, [src]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d = e.data as Msg;
      if (!d || typeof d !== "object" || !("apsoPreview" in d)) return;
      if (d.apsoPreview === "ready") setReady(true);
      if (d.apsoPreview === "body") { setDrawing(true); return; }
      onMsg(d, name);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onMsg, name]);
  // the other frame was scrolled: follow it (as a share of the page's height - a version can be longer or shorter)
  useEffect(() => {
    if (!sync || sync.from === name) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewScroll: sync.y }, "*");
  }, [sync, name]);
  // picking an element, outlining the version's changes: told to the page once it is drawn, and on every change
  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewPick: pick }, "*");
  }, [pick, ready]);
  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewMarks: marks }, "*");
  }, [marks, ready]);
  // the ideas' numbered callouts on the page, the one pointed at outlined and scrolled to
  const spotsKey = spots ? JSON.stringify(spots) : "";
  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewSpots: spots ?? { list: [], focus: null } }, "*");
  }, [spotsKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // the click map: each clicked element tinted where it was clicked, its count above it
  // to a block: once the page is drawn, and each time it is asked again
  const gotoKey = goto ? `${goto.sel}|${goto.n}` : "";
  useEffect(() => {
    if (!ready || !goto) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewGoto: goto.sel }, "*");
  }, [gotoKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const heatKey = heat ? JSON.stringify(heat) : "";
  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ apsoPreviewHeat: heat ?? { list: [], max: 0 } }, "*");
  }, [heatKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const phone = device === "phone";
  const W = phone ? 390 : 1280;
  const inner = phone ? Math.min(W, Math.max(0, w - 24)) : w;
  const scale = zoom === "full" && !phone ? 1 : inner ? Math.min(1, inner / W) : 0.5;
  const shownH = tall ?? (phone ? Math.min(780, Math.max(540, vh * 0.74)) : Math.max(420, vh * 0.7));
  const H = Math.round(shownH / scale);
  const bar = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, height: 34, bgcolor: "#f1f3f6", borderBottom: `1px solid ${HAIRLINE}` }}>
      {!phone && <Box sx={{ display: "flex", gap: 0.6 }}>{["#ff5f57", "#febc2e", "#28c840"].map((c) => <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c, opacity: 0.85 }} />)}</Box>}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 22, borderRadius: "6px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
        <Box component="span" sx={{ fontSize: "0.72rem", color: GREEN }}>●</Box>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(900) }} title={address}>{address.replace(/^https:\/\//, "")}</Typography>
      </Box>
      {pick && <Chip tint="purple">Pick an element</Chip>}
    </Box>
  );
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: /^(Version|After)/.test(label) ? "#6a46c9" : MUTED, textTransform: "uppercase", letterSpacing: ".04em", ...clip(520) }} title={label}>{label}</Typography>
        {ready && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>· {phone ? "390 px wide" : zoom === "full" ? "actual size" : `${Math.round(scale * 100)}%`}</Typography>}
        {!ready && drawing && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>· still loading its files…</Typography>}
      </Box>
      <Box ref={wrap} sx={{ position: "relative", ...(phone ? { display: "grid", placeItems: "center", py: 1.5, bgcolor: "#eef1f5", borderRadius: "18px" } : {}) }}>
        <Box sx={{
          position: "relative", overflow: "hidden", bgcolor: "#fff",
          ...(phone
            ? { width: inner || W, borderRadius: "28px", border: "8px solid #1d2433", boxShadow: "0 18px 40px rgba(21,34,58,.22)" }
            : { borderRadius: "12px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(21,34,58,.08)" }),
        }}>
          {bar}
          <Box sx={{ height: shownH, overflowX: zoom === "full" && !phone ? "auto" : "hidden", overflowY: "hidden", position: "relative" }}>
            <Box sx={{ width: zoom === "full" && !phone ? W : "100%", height: "100%", position: "relative", overflow: "hidden" }}>
              <iframe ref={frame} key={src} src={src} title={label} sandbox="allow-scripts" referrerPolicy="no-referrer"
                style={{ width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", background: "#fff", display: "block" }} />
            </Box>
            {!ready && drawing && (
              <Box aria-hidden sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, overflow: "hidden", bgcolor: "rgba(36,89,209,.12)",
                "&::after": { content: '""', position: "absolute", top: 0, bottom: 0, width: "30%", bgcolor: ACCENT, animation: "apsoLoad 1.1s ease-in-out infinite" },
                "@keyframes apsoLoad": { from: { left: "-30%" }, to: { left: "100%" } } }} />
            )}
            {!ready && !drawing && (
              <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,.82)", pointerEvents: late ? "auto" : "none" }}>
                {late
                  ? <Box sx={{ display: "grid", gap: 1, justifyItems: "center", color: MUTED, fontSize: "0.84rem", textAlign: "center", px: 2 }}>
                      The page did not answer in 45 seconds.
                      <Button size="small" variant="outlined" onClick={onRetry}>Read it again</Button>
                    </Box>
                  : <Box sx={{ display: "flex", gap: 1, alignItems: "center", color: MUTED, fontSize: "0.84rem" }}><CircularProgress size={16} /> Reading the page from the shop…</Box>}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// OPENING A PAGE

function Picker({ env, onOpen, problems }: { env: Env; onOpen: (env: Env, path: string) => void; problems: ProblemsData | null }) {
  const [e, setE] = useState<Env>(env);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PageRow[] | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 || /^https?:|^\//.test(t)) { setHits(null); return; }
    const c = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/website/ai-personalization/pages?q=${encodeURIComponent(t.slice(0, 80))}&where=all`, { signal: c.signal })
        .then((r) => r.json()).then((j: { ok?: boolean; data?: { list: PagesList } }) => setHits(j.ok && j.data ? j.data.list.rows.filter((x) => x[e]).slice(0, 10) : []))
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(timer); c.abort(); };
  }, [q, e]);
  const open = () => {
    const t = q.trim();
    if (!t) return;
    let path = t;
    try { if (/^https?:/i.test(t)) path = new URL(t).pathname; } catch { /* typed as a path */ }
    if (!path.startsWith("/")) path = `/${path}`;
    onOpen(/^https?:\/\/acc\./i.test(t) ? "acc" : e, path);
  };
  const top = (problems?.pages ?? []).filter((p) => p.reasons.length > 0).slice(0, 8);
  // the pages people already work on (their ideas), the newest first - one click back into each
  const board = useHeld<{ ideas: BoardRow[] }>("/api/website/ai-personalization/ideas", []);
  const worked = useMemo(() => {
    const rows = board.result?.state === "ok" ? board.result.data.ideas : [];
    const by = new Map<string, { env: Env; path: string; kind: PageKind; ideas: number; approved: number; ready: number; last: string; top: string }>();
    for (const r of rows) {
      if (r.status === "dropped") continue;
      const k = `${r.env}${r.path}`;
      const at = r.version?.updatedAt ?? r.decidedAt ?? r.createdAt;
      const g = by.get(k) ?? { env: r.env, path: r.path, kind: r.kind, ideas: 0, approved: 0, ready: 0, last: at, top: r.title };
      g.ideas += 1;
      if (r.status === "approved") g.approved += 1;
      if (r.version?.status === "approved") g.ready += 1;
      if (at > g.last) { g.last = at; g.top = r.title; }
      by.set(k, g);
    }
    return [...by.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 8);
  }, [board.result]);
  return (
    <>
    {worked.length > 0 && (
      <GlassCard>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Pages in work" note="Their optimizations and versions - open one where it was left" />
        <Box sx={{ display: "grid", gap: 1, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" } }}>
          {worked.map((w) => (
            <Box key={`${w.env}${w.path}`} component="button" type="button" onClick={() => onOpen(w.env, w.path)} sx={{
              all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", gap: 1.5, alignItems: "center", p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)", minWidth: 0,
              transition: "border-color .15s", "&:hover": { borderColor: ACCENT },
            }}>
              <Box sx={{ borderRadius: "6px", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}><PageShot env={w.env} path={w.path} /></Box>
              <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0 }}>
                <Chip tint={w.env === "prod" ? "green" : "amber"}>{ENVS[w.env].label}</Chip>
                <Chip tint="slate">{KIND_LABEL[w.kind]}</Chip>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, ...clip(420) }} title={w.path}>{w.path}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, ...clip(560) }}>{w.top}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
                {w.ideas} {w.ideas === 1 ? "optimization" : "optimizations"}{w.approved ? ` · ${w.approved} approved` : ""}{w.ready ? ` · ${w.ready} ready to test` : ""} · {ago(Date.parse(w.last) / 1000)}
              </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </GlassCard>
    )}
    <GlassCard>
      <CardTitle icon={<WebOutlinedIcon />} tint="blue" title="Open a page" note="Paste a shop address, or type a few letters of its name or address" />
      <Box sx={{ display: "grid", gap: 1.5, mt: 1.5 }}>
        <SquareChoice<Env> label="Shop" value={e} onChange={setE} options={[{ key: "prod", label: ENVS.prod.label }, { key: "acc", label: ENVS.acc.label }]} />
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" fullWidth value={q} onChange={(ev) => setQ(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") open(); }}
            placeholder="https://www.apsoparts.com/de-CH/… or o-ring" slotProps={{ input: { startAdornment: <SearchIcon sx={{ fontSize: 18, color: MUTED, mr: 1 }} /> } }} />
          <Button variant="contained" disableElevation onClick={open} disabled={!q.trim()}>Open</Button>
        </Box>
        {hits && (
          <Box sx={{ display: "grid", gap: 0.25 }}>
            {hits.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No page of the index has that in its address.</Typography>}
            {hits.map((h) => {
              const path = new URL(h[e]!.url).pathname;
              return (
                <Box key={path} component="button" type="button" onClick={() => onOpen(e, path)} sx={{ all: "unset", cursor: "pointer", display: "flex", gap: 1, alignItems: "center", px: 1, py: 0.6, borderRadius: "8px", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
                  <Chip tint={h.kind === "product" ? "green" : h.kind === "category" ? "blue" : h.kind === "home" ? "purple" : "amber"}>{KIND_LABEL[h.kind]}</Chip>
                  <Typography sx={{ fontSize: "0.84rem", ...clip(560) }}>{path}</Typography>
                </Box>
              );
            })}
          </Box>
        )}
        {top.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED, mb: 0.5 }}>OR START FROM A PROBLEM</Typography>
            <Box sx={{ display: "grid", gap: 0.25 }}>
              {top.map((p) => (
                <Box key={p.key} component="button" type="button" onClick={() => onOpen("prod", p.path)} sx={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 1, alignItems: "center", px: 1, py: 0.6, borderRadius: "8px", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, ...clip(520) }}>{p.name || p.path}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(520) }}>{p.reasons[0]}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{p.missed ? `${full(p.missed)} missed` : ""}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// OPTIMIZATIONS - the list on the left, the same wherever Preview is opened from (SARCLA 09.11.2026: "the preview
// application should be the same from all … really confusing")

type IdeaState = "proposed" | "approved" | "sent" | "dropped";
const STATE_TINT = { proposed: "amber", approved: "blue", sent: "green", dropped: "slate" } as const;
const STATE_LABEL = { proposed: "Proposed", approved: "In work", sent: "Sent to project", dropped: "Dropped" } as const;
/** A NEW landing page (SEO landing page type): Content writes the page, so it has no version on the page it came from. */
const isLanding = (i: Idea | null) => !!i && typeOfIdea(i) === "landing-page";
const stateOf = (i: Idea): IdeaState => (i.status === "dropped" ? "dropped" : i.sentAt ? "sent" : i.status === "approved" ? "approved" : "proposed");

/**
 * THE PAGE'S OPTIMIZATIONS, ONE AT A TIME (SARCLA 10.11.2026: the list of them under More - "I don't like, put them there
 * like a slider one by one" - "don't increase the header size, it should stay the same"). The optimization's title and
 * its chips are the slide: the arrows beside it, a swipe, the keyboard's left / right arrows or a dot go to another one,
 * and it slides in from the side it came from. The header keeps its height: the arrows and the dots sit beside the title.
 */
function OptimizationSlider({ items, at, onGo, children }: { items: Idea[]; at: number; onGo: (k: number) => void; children: React.ReactNode }) {
  const last = useRef(at);
  const dir = at >= last.current ? 1 : -1;
  useEffect(() => { last.current = at; }, [at]);
  const n = items.length;
  const go = useCallback((k: number) => { if (n > 1 && k >= 0 && k < n && k !== at) onGo(k); }, [n, at, onGo]);
  useEffect(() => {
    if (n < 2) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable))) return;
      if (e.key === "ArrowLeft") go(at - 1);
      if (e.key === "ArrowRight") go(at + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [n, at, go]);
  const down = useRef<number | null>(null);
  if (n < 2) return <Box sx={{ mt: 1 }}>{children}</Box>;
  const arrow = { flexShrink: 0, width: 32, height: 32, border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)", "&:hover": { bgcolor: "#fff", borderColor: ACCENT } } as const;
  // the arrows together with the count and the dots, on the right (SARCLA 10.11.2026: a "‹" alone by the title read as
  // a back arrow - "compared to the bar with the others makes no sense, it's why I thought 2")
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", touchAction: "pan-y" }}
        onPointerDown={(e) => { down.current = e.clientX; }}
        onPointerUp={(e) => { const x0 = down.current; down.current = null; if (x0 === null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 60) go(at + (dx < 0 ? 1 : -1)); }}>
        <Box key={items[at]?.id ?? at} sx={{
          animation: `${dir > 0 ? "optSlideIn" : "optSlideBack"} .32s cubic-bezier(.2,.7,.2,1)`,
          "@keyframes optSlideIn": { from: { opacity: 0, transform: "translateX(36px)" }, to: { opacity: 1, transform: "none" } },
          "@keyframes optSlideBack": { from: { opacity: 0, transform: "translateX(-36px)" }, to: { opacity: 1, transform: "none" } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}>{children}</Box>
      </Box>
      <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
      <Tooltip title={at > 0 ? `Previous: ${items[at - 1].title}` : ""}>
        <span><IconButton size="small" disabled={at <= 0} onClick={() => go(at - 1)} aria-label="Previous optimization" sx={arrow}><ChevronLeftRoundedIcon /></IconButton></span>
      </Tooltip>
      <Box sx={{ display: "grid", justifyItems: "center", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>Optimization {at + 1} / {n}</Typography>
        {n <= 12 && (
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: "5px", alignItems: "center" }}>
            {items.map((x, k) => (
              <Tooltip key={x.id} title={x.title}>
                <Box component="button" type="button" aria-label={`Optimization ${k + 1}`} onClick={() => go(k)} sx={{
                  all: "unset", cursor: "pointer", width: k === at ? 16 : 7, height: 7, borderRadius: 4,
                  bgcolor: k === at ? ACCENT : "rgba(36,89,209,.22)", transition: "width .2s, background-color .2s", "&:hover": { bgcolor: k === at ? ACCENT : "rgba(36,89,209,.45)" },
                }} />
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>
      <Tooltip title={at < n - 1 ? `Next: ${items[at + 1].title}` : ""}>
        <span><IconButton size="small" disabled={at >= n - 1} onClick={() => go(at + 1)} aria-label="Next optimization" sx={arrow}><ChevronRightRoundedIcon /></IconButton></span>
      </Tooltip>
      </Box>
    </Box>
  );
}

function OwnIdea({ onAdd }: { onAdd: (title: string, change: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <Button size="small" onClick={() => setOpen(true)} sx={{ justifySelf: "start", textTransform: "none", fontWeight: 600 }}>+ Your own optimization</Button>;
  return (
    <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "12px", border: `1px dashed ${HAIRLINE}` }}>
      <TextField size="small" label="The optimization" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 200 }} />
      <TextField size="small" label="What changes on the page" value={change} onChange={(e) => setChange(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} />
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="small" variant="contained" disableElevation disabled={!title.trim() || busy} onClick={async () => {
          setBusy(true);
          const ok = await onAdd(title.trim(), change.trim());
          setBusy(false);
          if (ok) { setTitle(""); setChange(""); setOpen(false); }
        }}>Add</Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// FRAMES THAT COST LITTLE - a frame running the shop's scripts has an opaque origin, so it shares no browser cache and
// asks the hub for ~100 files each time; the hub's WAF locks an address out at 2,000 requests in 5 minutes. So
// BEFORE is the page's still picture (no script, shared cache) at the same block, and the gallery's live frames load
// only when they come on screen, 4 at most.

function StillBefore({ env, path, focus, label }: { env: Env; path: string; focus: string | null; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>
      </Box>
      <Box sx={{ borderRadius: "12px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(21,34,58,.08)", bgcolor: "#fff" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, height: 34, bgcolor: "#f1f3f6", borderBottom: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ display: "flex", gap: 0.6 }}>{["#ff5f57", "#febc2e", "#28c840"].map((c) => <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c, opacity: 0.85 }} />)}</Box>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(900) }}>{path}</Typography>
        </Box>
        <PageShot env={env} path={path} ratio={1.25} label={label} focus={focus} />
      </Box>
    </Box>
  );
}

function OnScreen({ children, h }: { children: React.ReactNode; h: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Box ref={ref} sx={{ minHeight: h, minWidth: 0 }}>{on ? children : null}</Box>;
}

// ---------------------------------------------------------------------------------------------------------------------
// WHAT CHANGES - a version's changes from the page as it is, each in words, whole (never cut), with whether it found its
// place on the page; a click scrolls both frames to it

function WhatChanges({ version, hit, onGo }: { version: Version; hit: number[] | null; onGo: (sel: string) => void }) {
  const elementChanges = version.changes.map((c, i) => ({ c, i })).filter((x) => x.c.op !== "css");
  const missed = hit ? elementChanges.filter((x) => (hit[x.i] ?? 0) <= 0) : [];
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>What changes from the page as it is · {version.changes.length}</Typography>
        {hit && (missed.length === 0
          ? <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", color: GREEN, fontSize: "0.78rem", fontWeight: 600 }}><CheckCircleOutlineIcon sx={{ fontSize: 16 }} /> every change found its place</Box>
          : <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", color: AMBER, fontSize: "0.78rem", fontWeight: 600 }}><ErrorOutlineIcon sx={{ fontSize: 16 }} /> {missed.length} of {elementChanges.length} found nothing - ask the AI to aim them again</Box>)}
      </Box>
      {version.changes.map((c: Change, i) => {
        const h = hit && c.op !== "css" ? (hit[i] ?? 0) : null;
        const sel = "selector" in c ? c.selector : null;
        return (
          <Box key={i} component={sel ? "button" : "div"} type={sel ? "button" : undefined} onClick={sel ? () => onGo(sel) : undefined} sx={{
            all: "unset", display: "grid", gridTemplateColumns: "20px auto minmax(0,1fr)", gap: 1, alignItems: "start", px: 1, py: 0.6, borderRadius: "8px",
            cursor: sel ? "pointer" : "default", "&:hover": sel ? { bgcolor: "rgba(36,89,209,.06)" } : {},
          }}>
            {h === null ? <Box /> : h > 0 ? <CheckCircleOutlineIcon sx={{ fontSize: 16, color: GREEN, mt: "2px" }} /> : <ErrorOutlineIcon sx={{ fontSize: 16, color: h < 0 ? RED : AMBER, mt: "2px" }} />}
            <Chip tint="slate">{OP_LABEL[c.op]}</Chip>
            <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.4, overflowWrap: "anywhere" }} title={sel ?? undefined}>{describe(c)}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// SEND TO PROJECT (SARCLA 09.11.2026: "then send to project and on project is the really editor that bring to life -
// so approve is more sent to project"): a Content project with the page, its numbers, the optimization and every
// version; the send approves them, and Content's page studio opens on the version sent (the marker's v:<id>)

async function sendToProject(x: { data: StudioData; numbers: Numbers | null; idea: Idea; versions: Version[]; first: Version | null; block: ShopBlock | null; to: SendChoice }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ordered = x.first ? [x.first, ...x.versions.filter((v) => v.id !== x.first!.id)] : x.versions;
  // the brief carries the type of change (Content's type) and the block with the ADDRESS of its picture - agreed with
  // Content (3b, 09.11.2026): no change list and no picture in the brief, the studio loads the version by its marker
  const blk = x.block ?? (x.idea.block ? blockByKey(x.idea.block) : null);
  const focus = blk?.focus ?? x.idea.target ?? null;
  const picture = `${window.location.origin}/api/website/ai-personalization/preview?env=${x.data.env}&path=${encodeURIComponent(x.data.path)}&still=1${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`;
  const p = projectForPage({
    env: x.data.env, path: x.data.path, url: x.data.page.url ?? `${ENVS[x.data.env].base}${x.data.path}`, h1: x.data.page.h1[0] ?? "", title: x.data.page.title,
    numbers: x.numbers, ideas: [{ title: x.idea.title, why: x.idea.why, change: x.idea.change, expect: x.idea.expect }],
    version: null, versions: ordered.map((v) => ({ id: v.id, letter: v.letter, rev: v.rev, summary: v.summary })),
    previewPath: `${window.location.origin}${previewHref(x.data.env, x.data.path, x.idea.id)}`,
    contentType: typeOfIdea(x.idea),
    block: blk ? { name: blk.name, picture } : focus ? { name: "The part of the page it changes", picture } : null,
  });
  // a to-do of the page added to a project (Content's piece-add-convert, 3b 11.11.2026): the project chosen, or the new
  // one when a ticket is asked for it - with every version (Content decides which is tested), its ticket made or linked
  const addTo = async (projectId: number): Promise<{ ok: true; url: string | null; note: string } | { ok: false; error: string }> => {
    const r = await fetch(`/api/content/projects/${projectId}/work`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "piece-add-convert", env: x.data.env, path: x.data.path, versionId: ordered[0]?.id, ideaTitle: x.idea.title, brief: p.brief, contentType: p.contentType, ticket: x.to.ticket }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string; ticketError?: string | null } | null;
    if (!j?.ok) return { ok: false, error: j?.error ?? `Content answered ${r.status}.` };
    return { ok: true, url: j.url ?? null, note: j.ticketError ? ` The ticket was not made: ${j.ticketError}` : "" };
  };
  try {
    let projectId: number;
    let url: string;
    if (x.to.project) {
      const a = await addTo(x.to.project);
      if (!a.ok) return a;
      projectId = x.to.project;
      url = a.url ?? `/projects/${projectId}`;
    } else {
      const r = await fetch("/api/content/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; project?: { id: number }; error?: string } | null;
      if (!j?.ok || !j.project) return { ok: false, error: j?.error ?? `Content answered ${r.status}.` };
      projectId = j.project.id;
      url = `/create?project=${projectId}&type=${p.contentType}`;
      // its ticket, asked for with a new project: the page's to-do with it (Content gives the one it made already)
      if (x.to.ticket) {
        const a = await addTo(projectId);
        if (!a.ok) return { ok: false, error: `The project was made (#${projectId}), but its ticket was not: ${a.error}` };
      }
    }
    const m = await convertPost<unknown>(API, { action: "sent", ideaId: x.idea.id, projectId });
    if (!m.ok) return { ok: false, error: `It is in Content (project #${projectId}), but marking the optimization sent failed: ${m.error}` };
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Content did not answer." };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PAGE'S NUMBERS

function numbersFor(p: ProblemsData | null, path: string): (Numbers & { name: string }) | null {
  if (!p) return null;
  const c = classify(path);
  const key = c.kind === "product" && c.product ? `product:${c.product}` : `page:${path}`;
  const row = p.pages.find((x) => x.key === key);
  if (!row) return null;
  return {
    name: row.name, views: row.views, addToCarts: row.addToCarts, rate: row.rate, typical: row.typical, reasons: row.reasons,
    companies: row.shop?.companies ?? null, lost: row.shop?.lost ?? null, topLoss: row.shop?.topLoss ? STEP_LABEL[row.shop.topLoss as Step] : null, from: p.from, to: p.to,
  };
}

/** Google's view of the page (Problem pages > SEO pages) added to its numbers, so the AI reads its searches too. */
function withSeo(n: (Numbers & { name?: string }) | null, seo: SeoData | null, path: string): (Numbers & { name?: string }) | null {
  const row = seo?.rows.find((r) => r.path === path);
  if (!row) return n;
  const line = `Google (Search Console, ${seo!.from} to ${seo!.to}): shown ${row.impressions} times, ${row.clicks} clicks (${(row.ctr * 100).toFixed(1)}%${row.typical !== null ? `, ${(row.typical * 100).toFixed(1)}% is typical at its position` : ""}), average position ${row.position.toFixed(1)}${row.queries.length ? `; searches: ${row.queries.map((q) => `"${q.q}" ${q.impressions} shown`).join(", ")}` : ""}`;
  return { ...(n ?? {}), reasons: [...(n?.reasons ?? []), ...row.reasons, line].slice(0, 4) };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PAGE

function ConvertPreview() {
  const router = useRouter();
  const sp = useSearchParams();
  const env: Env = sp.get("env") === "acc" ? "acc" : "prod";
  const path = sp.get("path");
  const ideaSel = sp.get("idea");
  const letterSel = sp.get("v");
  const block = blockByKey(sp.get("block") ?? "");
  // from Google's view of the pages (Insights > SEO landing page): the AI proposes NEW landing pages for its searches
  const seoMode = sp.get("seo") === "1" && !block;
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [fresh, setFresh] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [sync, setSync] = useState<Sync | null>(null);
  // an optimization opens as Before | After, both at the change (SARCLA 09.11.2026: "see per optimization old block or
  // pages, new blocks or pages, changes of origin"; "page generating is not changing nothing" - the change was below
  // the frame's first screen)
  const [view, setView] = useState<View>("both");
  const [hit, setHit] = useState<number[] | null>(null);
  const [rev, setRev] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Send to Content asks where to (a new project, or one to add to) and the ticket (./SendDialog.tsx)
  const [sendOpen, setSendOpen] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [going, setGoing] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [marks, setMarks] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [ask, setAsk] = useState("");
  const [hand, setHand] = useState(false);
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [styles, setStyles] = useState<{ total: number; nfailed: number } | null>(null);
  const [spotFocus, setSpotFocus] = useState<number | null>(null);
  // a number clicked on the page goes to its optimization in the slider (set below, once the list is known)
  const byNumber = useRef<((n: number) => void) | null>(null);
  const [showSpots, setShowSpots] = useState(true);
  const [compare, setCompare] = useState<boolean | null>(null);
  const [goN, setGoN] = useState(0);
  const [goSel, setGoSel] = useState<string | null>(null);
  const [clicks, setClicks] = useState(sp.get("clicks") === "1");
  const [clickDev, setClickDev] = useState<ClickDev>("d");
  const [clickTick, setClickTick] = useState(0);
  const [heatFocus, setHeatFocus] = useState<string | null>(null);
  const [heatMissing, setHeatMissing] = useState<string[]>([]);
  const [heatNames, setHeatNames] = useState<Record<string, string>>({});
  const [making, setMaking] = useState<{ done: number; of: number } | null>(null);
  useEffect(() => { setClickDev(device === "phone" ? "m" : "d"); }, [device]);
  const told = useRef(false);
  const drawn = useRef<{ from: string; lines: string[] } | null>(null);

  const href = useCallback((p: string, idea?: string | null, letter?: string | null) =>
    `/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(p)}${idea ? `&idea=${idea}` : ""}${letter ? `&v=${letter}` : ""}${block && p === path ? `&block=${block.key}` : ""}`, [env, block, path]);
  const go = useCallback((e: Env, p: string, idea?: string | null) => {
    router.push(`/website/ai-personalization/preview?env=${e}&path=${encodeURIComponent(p)}${idea ? `&idea=${idea}` : ""}`);
  }, [router]);
  const select = useCallback((idea: string | null, letter?: string | null) => { if (path) router.replace(href(path, idea, letter)); }, [router, href, path]);
  // a step a person takes (another optimization, a version, side by side) is a step of the browser's history too: its
  // back button goes to where they were (SARCLA 10.11.2026: "browser back leaves")
  const visit = useCallback((idea: string | null, letter?: string | null) => { if (path) router.push(href(path, idea, letter)); }, [router, href, path]);
  // the optimizations a person slides through do not start the AI by themselves (a block's come with their versions)
  const slid = useRef(false);

  const url = path ? `${API}?env=${env}&path=${encodeURIComponent(path)}&n=${tick}${fresh ? "&fresh=1" : ""}` : null;
  const held = useHeld<StudioData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const probUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const prob = useHeld<ProblemsData>(probUrl, [probUrl]);
  const problems = prob.result?.state === "ok" ? prob.result.data : null;
  const seoUrl = sp.get("seo") === "1" ? `/api/website/ai-personalization/seo?from=${win.from}&to=${win.to}` : null;
  const seoHeld = useHeld<SeoData>(seoUrl, [seoUrl]);
  const seo = seoHeld.result?.state === "ok" ? seoHeld.result.data : null;
  const numbers = path ? withSeo(numbersFor(problems, path), seo, path) : null;
  const ideasBody = () => ({ action: "ideas", env, path, numbers, ...(block ? { block: block.key } : {}), ...(seoMode ? { landing: true } : {}) });

  const clicksUrl = path ? `/api/website/ai-personalization/clicks?env=${env}&path=${encodeURIComponent(path)}&dev=${clickDev}&n=${clickTick}` : null;
  const ch = useHeld<ClicksData>(clicks ? clicksUrl : null, [clicks, clicksUrl]);
  const clickData = ch.result?.state === "ok" ? ch.result.data : null;
  const clickErr = ch.result && ch.result.state !== "ok" ? (ch.result.state === "error" ? ch.result.error : "The hub could not read the clicks.") : null;
  const heatMsg: HeatMsg | null = clicks && clickData?.heat?.list.length ? { list: clickData.heat.list.map((i) => ({ s: i.s, n: i.n, c: i.c })), max: clickData.heat.max, focus: heatFocus } : null;

  const ideas = d?.ideas ?? [];
  const ranked = useMemo(() => [...ideas].sort((x, y) => (x.status === "dropped" ? 1 : 0) - (y.status === "dropped" ? 1 : 0) || (iceScore(y) ?? -1) - (iceScore(x) ?? -1)), [ideas]);
  const numberOf = useMemo(() => new Map(ranked.filter((i) => i.status !== "dropped").map((i, k) => [i.id, k + 1])), [ranked]);
  const spots: Spots = useMemo(() => ({
    list: showSpots ? ranked.filter((i) => i.status !== "dropped" && i.target).map((i) => ({ n: numberOf.get(i.id)!, sel: i.target!, lead: numberOf.get(i.id) === 1 && i.source === "ai", title: i.title })) : [],
    focus: spotFocus,
  }), [ranked, numberOf, showSpots, spotFocus]);
  const versionsOf = useMemo(() => {
    const m = new Map<string, Version[]>();
    for (const v of d?.versions ?? []) m.set(v.ideaId, [...(m.get(v.ideaId) ?? []), v].sort((a, b) => a.letter.localeCompare(b.letter)));
    return m;
  }, [d]);
  const idea = ideas.find((i) => i.id === ideaSel) ?? null;
  byNumber.current = (n) => { const i = ranked.filter((x) => x.status !== "dropped")[n - 1]; if (i) { setCompare(false); select(i.id); } };
  const versions = idea ? versionsOf.get(idea.id) ?? [] : [];
  const version = versions.find((v) => v.letter === letterSel) ?? versions[0] ?? null;
  useEffect(() => { setHit(null); setRev(null); }, [version?.id, version?.rev]);
  useEffect(() => { setPicked(null); setPick(false); setStyles(null); told.current = false; drawn.current = null; }, [path, env]);
  useEffect(() => { setAsk(""); setHand(false); setJsonErr(null); setGoSel(null); }, [idea?.id, version?.id]);

  // where the frames open: at the TOP of the page (SARCLA 10.11.2026: "the page should always open on top"); a change
  // is gone to when it is clicked in "What changes". A shop block being optimized (the newsletter band, in the footer)
  // is the page's subject, so its frames open on it.
  // An optimization of ONE block opens at its block (SARCLA 10.11.2026: "we cannot say where it is").
  const blockSel = idea?.scope === "block" && idea.target ? idea.target : null;
  const beforeGoto: Goto | null = goSel ? { sel: goSel, n: goN } : block ? { sel: block.selector, n: goN } : blockSel ? { sel: blockSel, n: goN } : null;
  const afterGoto: Goto | null = beforeGoto;

  const base = path ? `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}${fresh ? `&fresh=1&f=${fresh}` : ""}` : "";
  const srcOf = (v: Version, r?: number | null) => `${base}&v=${v.id}&r=${r ?? v.rev}&at=${encodeURIComponent(v.updatedAt)}`;

  const onMsg = useCallback((m: Msg, from: string) => {
    if (m.apsoPreview === "spot" && typeof m.n === "number") {
      setSpotFocus(m.n);
      byNumber.current?.(m.n);
    }
    if (m.apsoPreview === "scroll" && typeof m.y === "number") setSync((s) => ({ y: m.y, from, n: (s?.n ?? 0) + 1 }));
    if (m.apsoPreview === "applied" && Array.isArray(m.hit) && from === "after") setHit(m.hit);
    if (m.apsoPreview === "heat" && Array.isArray(m.missing) && from === "before") {
      setHeatMissing(m.missing.filter((x) => typeof x === "string").slice(0, 40));
      const nm: Record<string, string> = {};
      for (const [k, v] of Object.entries(m.names && typeof m.names === "object" ? m.names : {}).slice(0, 40)) if (typeof v === "string" && v) nm[k] = v.slice(0, 48);
      setHeatNames(nm);
    }
    if (m.apsoPreview === "drawn" && Array.isArray(m.lines) && (from === "before" || drawn.current?.from !== "before")) drawn.current = { from, lines: m.lines.slice(0, 160) };
    if (m.apsoPreview === "picked" && typeof m.selector === "string") {
      const pk = { selector: m.selector.slice(0, 300), tag: String(m.tag).slice(0, 20), text: String(m.text ?? "").slice(0, 160), from };
      setPicked(pk); setPick(false);
      setAsk(`Change this element - ${pk.selector}${pk.text ? ` (it reads “${pk.text.slice(0, 80)}”)` : ""}: `);
    }
    if (m.apsoPreview === "styles" && typeof m.total === "number") {
      setStyles((s) => (s && s.nfailed >= m.nfailed ? s : { total: m.total, nfailed: m.nfailed }));
      if (m.nfailed > 0 && !told.current) {
        told.current = true;
        void convertPost(API, { action: "diag", total: m.total, nfailed: m.nfailed, failed: (m.failed ?? []).slice(0, 3) });
      }
    }
    if (m.apsoPreview === "go" && typeof m.href === "string") {
      try {
        const u = new URL(m.href);
        if (u.origin === ENVS.prod.base || u.origin === ENVS.acc.base) setGoing(u.pathname);
      } catch { /* not an address */ }
    }
  }, []);

  const act = async (key: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusy(key);
    setErr(null);
    let send = body;
    if ((body.action === "ideas" || body.action === "build") && drawn.current) {
      const lines: string[] = [];
      let size = JSON.stringify(body).length + 40;
      for (const l of drawn.current.lines) { if (size + l.length + 4 > 7600) break; lines.push(l); size += l.length + 4; }
      send = { ...body, drawn: lines };
    }
    const res = await convertPost<unknown>(API, send);
    setBusy(null);
    if (!res.ok) { setErr(res.error); return false; }
    setTick((n) => n + 1);
    return true;
  };
  const build = async (i: Idea, opts: { request?: string; letter?: string; another?: boolean } = {}) => {
    const ok = await act(`build:${i.id}`, { action: "build", ideaId: i.id, ...(opts.request ? { request: opts.request } : {}), ...(opts.letter ? { letter: opts.letter } : {}), ...(opts.another ? { another: true } : {}) });
    if (ok && opts.another) {
      const taken = (versionsOf.get(i.id) ?? []).map((v) => v.letter);
      const next = ["A", "B", "C", "D"].find((l) => !taken.includes(l));
      select(i.id, next ?? null);
    } else if (ok) select(i.id, opts.letter ?? null);
    return ok;
  };
  // a block's optimizations as many versions side by side (SARCLA picked the newsletter band from 30 different
  // proposals): every proposed optimization of the block gets its first version, one after the other
  const makeAll = async () => {
    const todo = ranked.filter((i) => i.status !== "dropped" && !(versionsOf.get(i.id)?.length)).slice(0, 6);
    setMaking({ done: 0, of: todo.length });
    for (let k = 0; k < todo.length; k++) {
      const ok = await act(`build:${todo[k].id}`, { action: "build", ideaId: todo[k].id });
      setMaking({ done: k + 1, of: todo.length });
      if (!ok) break;
    }
    setMaking(null);
    setCompare(true);
  };

  // The Preview opens on the lead optimization and shows its proposed version at once (SARCLA 09.11.2026: "Choose one to
  // see it - the optimization is not shown, no preview of the proposed alternatives"): no optimization chosen = the
  // lead is; one without a version gets its Version A from the AI by itself, once, after the frame drew the page (the
  // AI reads the drawn outline). A block with versions to compare opens on them side by side instead.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || !d || !path || ideaSel || compare || clicks) return;
    // from Google's view: the lead new landing page - the page's other optimizations wait under More
    const lead = seoMode ? ranked.find((i) => i.status !== "dropped" && isLanding(i)) : ranked.find((i) => i.status !== "dropped" && !isLanding(i));
    if (!lead) return;
    autoPicked.current = true;
    const compared = ranked.filter((i) => i.status !== "dropped" && (versionsOf.get(i.id)?.length ?? 0) > 0).length;
    if (block && compared >= 2) return;
    select(lead.id);
  }, [d, path, ideaSel, ranked, versionsOf, block, compare, clicks, select, seoMode]);
  const autoBuilt = useRef(new Set<string>());
  useEffect(() => {
    if (!idea || !d || !d.canEdit || !d.ai || d.page.status !== 200 || busy || making) return;
    // a new landing page has no version on this page: Content writes the new page
    if (idea.status === "dropped" || versions.length > 0 || autoBuilt.current.has(idea.id) || isLanding(idea) || idea.scope === "block" || slid.current) return;
    const t = setTimeout(() => {
      if (autoBuilt.current.has(idea.id)) return;
      autoBuilt.current.add(idea.id);
      void build(idea);
    }, drawn.current ? 600 : 4000);
    return () => clearTimeout(t);
  }, [idea?.id, versions.length, d, busy, making]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Find optimizations" from a card: a page (or a block) without optimizations asks the AI once, after the frame drew it
  const asked = useRef(false);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (askTimer.current) clearTimeout(askTimer.current); }, []);
  useEffect(() => {
    if (asked.current || !d || !path) return;
    if (sp.get("ask") !== "1" && !(numbers?.reasons?.length)) return;
    const has = seoMode ? d.ideas.some((i) => i.status !== "dropped" && isLanding(i)) : d.ideas.length > 0;
    if (!d.canEdit || !d.ai || d.page.status !== 200 || has) return;
    asked.current = true;
    askTimer.current = setTimeout(() => {
      router.replace(`${href(path, null)}${seoMode ? "&seo=1" : ""}`);
      void act("ideas", ideasBody());
    }, 8000);
  }, [d, numbers?.reasons?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode;
  if (!path) {
    body = <Picker env={env} onOpen={(e, p) => go(e, p)} problems={problems} />;
  } else if (r === null) {
    body = <LoadingPanel label="Reading the page from the shop…" />;
  } else if (r.state !== "ok") {
    body = <UpstreamPanel source="Preview" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  } else {
    // ONE OPTIMIZATION, ONE SCREEN (SARCLA 09.11.2026: "editor and preview are even worse, it's still too complicated"):
    // on top the optimization - back to Insights, the previous / next one, Drop, Send to Content - and why / what / what it
    // should move; then its pictures, Before | After at the change, with only the versions and the device above them,
    // and the AI helper beside them with what the version changes. Everything else (all the page's optimizations, the
    // code, the revisions, the clicks, what the AI reads) folded under "More".
    const data = r.data;
    const pg = data.page;
    // a new landing page changes nothing on THIS page (SARCLA 10.11.2026: "I don't understand this optimization, it
    // changes nothing"): it is not one of the page's optimizations - they are listed apart, from Google's view only
    const live = ranked.filter((i) => i.status !== "dropped" && (seoMode || !isLanding(i)));
    const newPages = seoMode ? [] : ranked.filter((i) => i.status !== "dropped" && isLanding(i));
    const withVersions = live.filter((i) => (versionsOf.get(i.id)?.length ?? 0) > 0);
    // ONE optimization's versions side by side, framed on its block, until one is picked (SARCLA 10.11.2026: "3 or 4
    // versions" against the block as it is); a block of the shop's optimizations side by side as before
    const own = !!idea && versions.length >= 2 && !letterSel && !isLanding(idea);
    const gallery = own || (!!compare && withVersions.length >= 2);
    const st = idea ? stateOf(idea) : null;
    const pos = idea ? live.findIndex((i) => i.id === idea.id) : -1;
    const step = (dir: number) => { const k = pos + dir; if (k >= 0 && k < live.length) { setCompare(false); slid.current = true; visit(live[k].id); } };
    const building = idea ? busy === `build:${idea.id}` : false;
    const landing = isLanding(idea);
    // product pages come later: their layout is the theme's code (SARCLA 10.11.2026: "beside product pages")
    const productPage = classify(path).kind === "product";
    const btn ={ borderRadius: "6px", textTransform: "none", fontWeight: 700 } as const;
    const nums = numbers ? [
      numbers.views ? `${full(numbers.views)} views` : null,
      numbers.rate != null ? `cart rate ${pct(numbers.rate)}${numbers.typical ? ` - ${pct(numbers.typical)} is typical` : ""}` : null,
      numbers.companies ? `${full(numbers.lost ?? 0)} of ${full(numbers.companies)} signed-in customers did not order` : null,
    ].filter(Boolean).join(" · ") : "";
    const send = async (to: SendChoice) => {
      if (!idea) return;
      setBusy("send"); setSendErr(null);
      const res = await sendToProject({ data, numbers, idea, versions, first: version, block, to });
      if (!res.ok) { setBusy(null); setSendErr(res.error); return; }
      setSendOpen(false);
      router.push(res.url);
    };

    const pictures = pg.status !== 200 ? null : own && idea ? (
      // ONE block's versions side by side, each framed on the block - pick one to work on it
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))", xl: versions.length >= 3 ? "repeat(4, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))" } }}>
        <StillBefore env={env} path={path} focus={blockSel ?? block?.focus ?? null} label="Before · the block as it is" />
        {versions.map((v) => (
          <Box key={v.id} sx={{ minWidth: 0, cursor: "pointer", borderRadius: "12px", "&:hover": { boxShadow: `0 0 0 2px ${ACCENT}` } }} onClick={() => { setCompare(false); visit(idea.id, v.letter); }}>
            <OnScreen h={470}>
              <Frame src={srcOf(v)} device={device} zoom="fit" name={`g${v.id}`} sync={null} pick={false} marks={false} goto={{ sel: blockSel ?? block?.selector ?? "[data-apso-c],[data-apso-v]", n: goN }} tall={420}
                address={pg.url ?? path} label={`Version ${v.letter} · ${v.summary}`} onMsg={() => {}} onRetry={() => setFresh((n) => n + 1)} />
            </OnScreen>
          </Box>
        ))}
      </Box>
    ) : gallery ? (
      // a block's versions side by side - pick one to work on it
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" } }}>
        <StillBefore env={env} path={path} focus={block?.focus ?? beforeGoto?.sel ?? null} label="Before · the page as it is" />
        {withVersions.flatMap((i) => (versionsOf.get(i.id) ?? []).map((v) => ({ i, v }))).slice(0, 4).map(({ i, v }) => (
          <Box key={v.id} sx={{ minWidth: 0, cursor: "pointer", borderRadius: "12px", "&:hover": { boxShadow: `0 0 0 2px ${ACCENT}` } }} onClick={() => { setCompare(false); select(i.id, v.letter); }}>
            <OnScreen h={470}>
              <Frame src={srcOf(v)} device={device} zoom="fit" name={`g${v.id}`} sync={null} pick={false} marks={false} goto={{ sel: block?.selector ?? i.target ?? "[data-apso-c],[data-apso-v]", n: goN }} tall={420}
                address={pg.url ?? path} label={`${i.title} · Version ${v.letter}`} onMsg={() => {}} onRetry={() => setFresh((n) => n + 1)} />
            </OnScreen>
          </Box>
        ))}
      </Box>
    ) : (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: version ? { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" } : "minmax(0,1fr)" }}>
        {version && <StillBefore env={env} path={path} focus={goSel ?? block?.focus ?? blockSel ?? null} label={blockSel ? "Before · the block as it is" : "Before"} />}
        {version
          ? <Frame src={srcOf(version, rev)} device={device} zoom="fit" name="after" sync={null} pick={pick} marks={marks} goto={afterGoto}
              address={pg.url ?? path} label={`After · Version ${version.letter}${rev !== null && rev !== version.rev ? ` · revision ${rev}` : ""}`} onMsg={onMsg} onRetry={() => setFresh((n) => n + 1)} />
          : <Frame src={base} device={device} zoom="fit" name="before" sync={null} pick={pick} marks={false} spots={null} heat={!idea && clicks ? heatMsg : null} goto={beforeGoto}
              address={pg.url ?? path} label={landing ? "The page Google shows for these searches today" : idea ? "The page as it is - the version comes beside it" : "The page as it is"} onMsg={onMsg} onRetry={() => setFresh((n) => n + 1)} />}
      </Box>
    );

    body = (
      <>
        {/* the optimization */}
        <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: "flex", gap: 1, rowGap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" component={Link} href={`${CONVERT}/insights`} startIcon={<ArrowBackRoundedIcon />} sx={{ ...btn, fontWeight: 600, color: MUTED }}>Insights</Button>
            <Box sx={{ flex: 1 }} />
            {idea && data.canEdit && st !== "dropped" && <Button size="small" onClick={() => void act(`i:${idea.id}`, { action: "idea", id: idea.id, status: "dropped" })} sx={{ ...btn, fontWeight: 600, color: MUTED }}>Drop</Button>}
            {idea && data.canEdit && st === "dropped" && <Button size="small" onClick={() => void act(`i:${idea.id}`, { action: "idea", id: idea.id, status: "proposed" })} sx={{ ...btn, fontWeight: 600 }}>Bring back</Button>}
            {idea?.projectId && <Button size="small" variant="outlined" href={`/projects/${idea.projectId}`} sx={btn}>Open the project</Button>}
            {idea && st === "sent" && version && <Button size="small" variant="outlined" href={`${CONVERT}/tests?make=${version.id}`} sx={btn}>Test Version {version.letter}</Button>}
            {idea && data.canEdit && st !== "dropped" && (
              <Tooltip title={!data.canContent ? "Content needs the Marketing access" : !versions.length && !landing ? "Its version comes first - the AI is making it" : landing ? "An SEO landing page project in Content with the brief to write the new page" : `A ${CHANGE_LABEL[typeOfIdea(idea)]} project in Content with a brief to rebuild it there`}>
                <span>
                  <Button size="small" variant="contained" disableElevation disabled={!data.canContent || (!versions.length && !landing) || busy === "send"} onClick={() => { setSendErr(null); setSendOpen(true); }}
                    startIcon={busy === "send" ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <SendOutlinedIcon sx={{ fontSize: 16 }} />} sx={btn}>
                    {st === "sent" ? "Send to Content again" : "Send to Content"}
                  </Button>
                </span>
              </Tooltip>
            )}
            {idea && <SendDialog open={sendOpen} onClose={() => setSendOpen(false)} onSend={(c) => void send(c)} env={data.env} path={data.path}
              versions={versions.length} busy={busy === "send"} error={sendErr} />}
          </Box>
          <OptimizationSlider items={idea && pos >= 0 ? live : []} at={pos} onGo={(k) => step(k - pos)}>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: INK, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              {idea ? idea.title : block ? `${block.name} - ${block.goal}` : pg.h1[0] || pg.title || path}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center", mt: 0.75 }}>
              {idea?.part && <Chip tint="blue">{idea.part}</Chip>}
              {idea && pos === 0 && idea.source === "ai" && live.length > 1 && <Chip tint="pink">The lead</Chip>}
              {idea && <Chip tint="purple">{CHANGE_LABEL[typeOfIdea(idea)]}</Chip>}
              {st && <Chip tint={STATE_TINT[st]}>{STATE_LABEL[st]}</Chip>}
              {idea && (versionsOf.get(idea.id)?.length ?? 0) > 1 && <Chip tint="slate">{versionsOf.get(idea.id)!.length} versions</Chip>}
              {block && <Chip tint="amber">Block · {block.name}</Chip>}
              <Chip tint={env === "prod" ? "green" : "amber"}>{ENVS[env].label}</Chip>
              <Typography component="span" sx={{ fontSize: "0.78rem", color: MUTED, overflowWrap: "anywhere" }}>{pg.h1[0] || pg.title || path}</Typography>
              {pg.url && <Tooltip title="Open on the shop"><IconButton size="small" component="a" href={pg.url} target="_blank" rel="noopener"><OpenInNewIcon sx={{ fontSize: 15, color: MUTED }} /></IconButton></Tooltip>}
            </Box>
          </OptimizationSlider>
          {nums && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{nums}</Typography>}
        </GlassCard>

        {pg.status !== 200 && <Notice tone="bad">{pg.error ? `The shop did not answer: ${pg.error}` : `The shop answered ${pg.status} for this page.`}</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        {going && (
          <Notice tone="warn">
            The link in the preview goes to {going}.{" "}
            <Box component="button" type="button" onClick={() => { const p = going; setGoing(null); go(env, p); }} sx={{ all: "unset", cursor: "pointer", color: ACCENT, fontWeight: 700 }}>Open it in the preview</Box>
            {" · "}
            <Box component="button" type="button" onClick={() => setGoing(null)} sx={{ all: "unset", cursor: "pointer", color: MUTED, fontWeight: 600 }}>Stay</Box>
          </Notice>
        )}

        {/* no optimization yet (from Google's view: no new landing page yet): the page, and the AI's button */}
        {(seoMode ? !idea && !live.some((i) => isLanding(i)) : live.length === 0) && pg.status === 200 && (
          <GlassCard sx={{ display: "grid", gap: 1.25, justifyItems: "start" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{busy === "ideas" ? `The AI is reading ${block ? "the block" : seoMode ? "the searches Google shows this page for" : "the page's blocks and their clicks, and building 3-4 versions of each block it picks"} - about a minute` : seoMode ? "No new landing page proposed from this page yet" : productPage ? "Product pages come later" : "No optimization on this page yet"}</Typography>
            {!seoMode && productPage && busy !== "ideas" && <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.45 }}>A product page&apos;s layout is the theme&apos;s code, so the AI proposes no optimization here for now. Home, category and content pages get block optimizations: a block of the page and 3-4 modules to replace it.</Typography>}
            {busy === "ideas" && <LinearProgress sx={{ width: "100%", height: 4, borderRadius: 2, bgcolor: "rgba(106,70,201,.12)", "& .MuiLinearProgress-bar": { backgroundImage: AI_GRADIENT } }} />}
            {data.canEdit && (seoMode || !productPage) && <AiButton busy={busy === "ideas"} disabled={!data.ai} onClick={() => void act("ideas", ideasBody())}>{seoMode ? "Find landing pages" : "Find optimizations"}</AiButton>}
            {!data.ai && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No AI key on this hub - optimizations can be added by hand, under More.</Typography>}
          </GlassCard>
        )}

        {/* the work: the page is the show; on its right the AI helper, then why / what / what it should move, then what
            the version changes (SARCLA 10.11.2026: "all the features come to the right side, after the AI helper - the
            page in the show") */}
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", xl: idea ? "minmax(0,1fr) 380px" : "minmax(0,1fr)" }, alignItems: "start" }}>
          <GlassCard sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1, rowGap: 1, alignItems: "center", flexWrap: "wrap" }}>
              {idea && versions.length > 0 && (
                <SquareChoice<string> label="Version" value={gallery ? "" : version?.letter ?? ""} onChange={(l) => { setCompare(false); visit(idea.id, l); }}
                  options={versions.map((v) => ({ key: v.letter, label: v.letter }))} />
              )}
              {idea && versions.length >= 2 && !landing && (
                <Button size="small" variant={own ? "contained" : "outlined"} disableElevation onClick={() => { setCompare(false); if (!own) visit(idea.id, null); }}
                  startIcon={<ViewModuleOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>All {versions.length} versions side by side</Button>
              )}
              {idea && data.canEdit && st !== "dropped" && data.ai && versions.length > 0 && versions.length < 4 && (
                <Tooltip title="A clearly different way to make the same optimization - for the A/B test">
                  <span>
                    <Button size="small" variant="outlined" disabled={building} onClick={() => void build(idea, { another: true })}
                      startIcon={building ? <CircularProgress size={13} /> : <AddCircleOutlineIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>
                      {building ? "The AI is writing…" : `Another version (${["A", "B", "C", "D"].find((l) => !versions.some((v) => v.letter === l))})`}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {block && !own && withVersions.length >= 2 && (
                <Button size="small" variant={gallery ? "contained" : "outlined"} disableElevation onClick={() => { if (gallery) setCompare(false); else { setCompare(true); } }}
                  startIcon={<ViewModuleOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>The block&apos;s optimizations side by side</Button>
              )}
              {own && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Click a version to work on it.</Typography>}
              <Box sx={{ flex: 1 }} />
              <SquareChoice<Device> value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "phone", label: "Phone" }]} />
            </Box>
            {clicks && !idea && path && (
              <Box sx={{ mt: 1.5 }}>
                <ClicksBar data={clickData} error={clickErr} loading={!ch.result || ch.stale} dev={clickDev} onDev={setClickDev} env={env} path={path}
                  focus={heatFocus} onFocus={(s) => setHeatFocus((f) => (f === s ? null : s))} missing={heatMissing} names={heatNames}
                  onChanged={() => setClickTick((n) => n + 1)} />
              </Box>
            )}
            {idea && !version && building && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: "10px", border: "1px solid rgba(106,70,201,.3)", bgcolor: "rgba(106,70,201,.06)", display: "grid", gap: 1 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <AutoAwesomeIcon sx={{ fontSize: 18, color: "#6a46c9" }} />
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>The AI is writing the proposed version - about a minute</Typography>
                </Box>
                <LinearProgress sx={{ height: 4, borderRadius: 2, bgcolor: "rgba(106,70,201,.12)", "& .MuiLinearProgress-bar": { backgroundImage: AI_GRADIENT } }} />
              </Box>
            )}
            {idea && !version && !building && data.canEdit && st !== "dropped" && !landing && (
              <Box sx={{ mt: 1.5 }}><AiButton disabled={!data.ai} onClick={() => void build(idea)}>Make the version</AiButton></Box>
            )}
            {idea && landing && !version && (
              <Typography sx={{ mt: 1.5, fontSize: "0.84rem", color: INK, lineHeight: 1.45 }}>
                <b>A new page - Content writes it.</b> Below is the page Google shows for these searches today. Send it to Content: the
                landing page studio gets the brief and writes the new page there.
              </Typography>
            )}
            {styles && styles.nfailed > 0 && (
              <Box sx={{ mt: 1.5 }}><Notice tone="warn">Your browser drew {styles.total - styles.nfailed} of the shop&apos;s {styles.total} stylesheets - the page can look raw. Read it again under More.</Notice></Box>
            )}
            <Box sx={{ mt: 1.5 }}>{pictures}</Box>
            {version && !gallery && <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 1.25 }}><b>Version {version.letter}:</b> {version.summary}</Typography>}
          </GlassCard>

          {idea && (
            <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
              {data.canEdit && st !== "dropped" && data.ai && (!landing || version) && !own && (
                <AiHelper version={version} ask={ask} setAsk={setAsk} busy={building} picked={picked} pick={pick} onPick={() => setPick((x) => !x)}
                  onSend={async () => { if (await build(idea, { request: ask.trim(), ...(version ? { letter: version.letter } : {}) })) setAsk(""); }} />
              )}
              {([
                ["Diagnostic", idea.why, <ErrorOutlineIcon key="d" />, "#c5221f"],
                [landing ? "The new page" : "The optimization", idea.change, <ScienceOutlinedIcon key="o" />, "#2459d1"],
                ["Should move", idea.expect, <TrackChangesOutlinedIcon key="m" />, "#1b7a55"],
              ] as const).filter(([, t]) => t).map(([k, t, icon, tone]) => (
                <Box key={k} sx={{ p: 1.25, borderRadius: "10px", bgcolor: `${tone}0d`, border: `1px solid ${tone}26`, minWidth: 0 }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5 }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: `${tone}1f`, color: tone, "& svg": { fontSize: 15 } }}>{icon}</Box>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: tone }}>{k}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}>{t}</Typography>
                </Box>
              ))}
              {version && !own && (
                <GlassCard sx={{ p: { xs: 1.5, md: 1.75 } }}>
                  {rev !== null && rev !== version.rev && <Box sx={{ mb: 1 }}><Notice tone="warn">After shows revision {rev}. <Box component="button" type="button" onClick={() => setRev(null)} sx={{ all: "unset", cursor: "pointer", color: ACCENT, fontWeight: 600 }}>Back to the latest</Box></Notice></Box>}
                  <WhatChanges version={version} hit={hit && (rev === null || rev === version.rev) ? hit : null} onGo={(sel) => { setGoSel(sel); setGoN((n) => n + 1); }} />
                </GlassCard>
              )}
            </Box>
          )}
        </Box>

        {/* new landing pages proposed from this page's Google searches: not changes of this page - Content writes them */}
        {newPages.length > 0 && (
          <GlassCard sx={{ p: { xs: 1.5, md: 1.75 } }}>
            <CardTitle icon={<SearchIcon />} tint="purple" title={`New pages proposed from this page's Google searches · ${newPages.length}`} note="They change nothing on this page: each is a NEW page for Content to write" />
            <Box sx={{ display: "grid", gap: 0.5, mt: 1 }}>
              {newPages.map((i) => (
                <Box key={i.id} component="button" type="button" onClick={() => router.push(`${href(path, i.id)}&seo=1`)}
                  sx={{ all: "unset", cursor: "pointer", fontSize: "0.84rem", color: ACCENT, fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                  {i.title}
                </Box>
              ))}
            </Box>
          </GlassCard>
        )}

        {/* everything else, folded */}
        <Box component="details" sx={{ px: 0.5, "& > summary": { cursor: "pointer", fontSize: "0.84rem", fontWeight: 700, color: MUTED, py: 0.5 } }}>
          <summary>More - every optimization of this page, the version&apos;s code and revisions, the clicks, what the AI reads</summary>
          <Box sx={{ display: "grid", gap: 2, mt: 1.5 }}>
            <GlassCard sx={{ p: { xs: 1.5, md: 1.75 } }}>
              <CardTitle icon={<TipsAndUpdatesOutlinedIcon />} tint="amber" title="More optimizations for this page" note={`${live.length} in the slider at the top${block ? ` - of the ${block.name.toLowerCase()}` : ""}; a new one joins it`} />
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: 1.25 }}>
                {data.canEdit && live.length > 0 && <AiButton size="small" busy={busy === "ideas"} disabled={!data.ai || pg.status !== 200} onClick={() => void act("ideas", ideasBody())}>{busy === "ideas" ? "The AI is reading…" : "Find more optimizations"}</AiButton>}
                {data.canEdit && block && live.some((i) => !(versionsOf.get(i.id)?.length)) && (
                  <Button size="small" variant="outlined" disabled={!!making || !!busy} onClick={() => void makeAll()} startIcon={making ? <CircularProgress size={13} /> : <AutoFixHighOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>
                    {making ? `Writing version ${Math.min(making.done + 1, making.of)} of ${making.of}…` : "A version of each, side by side"}
                  </Button>
                )}
              </Box>
              {data.canEdit && <Box sx={{ mt: 1 }}><OwnIdea onAdd={async (title, change) => act("add", { action: "add", env, path, title, change, numbers })} /></Box>}
              {data.analysis && (
                <Box sx={{ mt: 1.5, p: 1.25, borderRadius: "10px", borderLeft: "3px solid #6a46c9", bgcolor: "rgba(106,70,201,.06)" }}>
                  <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: "#6a46c9", textTransform: "uppercase", letterSpacing: ".06em" }}>The AI&apos;s reading of the page</Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45, mt: 0.25 }}>{data.analysis.text}</Typography>
                </Box>
              )}
            </GlassCard>
            {idea && version && data.canEdit && st !== "dropped" && (
              <GlassCard sx={{ p: { xs: 1.5, md: 1.75 }, display: "grid", gap: 1 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>Version {version.letter}&apos;s code</Typography>
                  <Button size="small" onClick={() => { setHand((h) => !h); setJson(JSON.stringify(version.changes, null, 2)); setJsonErr(null); }} sx={{ textTransform: "none" }}>{hand ? "Close" : "Open the code"}</Button>
                </Box>
                {hand && (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <TextField multiline minRows={10} maxRows={28} value={json} onChange={(e) => setJson(e.target.value)}
                      sx={{ "& textarea": { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.76rem" } }} />
                    {jsonErr && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{jsonErr}</Typography>}
                    <Button size="small" variant="contained" disableElevation sx={{ justifySelf: "end" }} onClick={async () => {
                      let parsed: unknown;
                      try { parsed = JSON.parse(json); } catch (e) { setJsonErr(`Not valid JSON: ${(e as Error).message}`); return; }
                      const res = await convertPost<{ problems: string[] }>(API, { action: "edit", versionId: version.id, changes: parsed });
                      if (!res.ok) { setJsonErr(res.error); return; }
                      setTick((n) => n + 1);
                      setJsonErr(res.data.problems.length ? `Saved; left out: ${res.data.problems.join("; ")}` : null);
                      if (!res.data.problems.length) setHand(false);
                    }}>Save as a new revision</Button>
                  </Box>
                )}
                <Revisions version={version} shown={rev ?? version.rev} onRev={(x) => setRev(x === version.rev ? null : x)} />
              </GlassCard>
            )}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button size="small" variant={clicks ? "contained" : "outlined"} color="warning" disableElevation onClick={() => { if (!clicks) { setCompare(false); select(null); } setClicks(!clicks); }}
                startIcon={<TouchAppOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>{clicks ? "Hide the clicks" : "Where people click"}</Button>
              {version && <Button size="small" variant={marks ? "contained" : "outlined"} disableElevation onClick={() => setMarks((x) => !x)} startIcon={<HighlightAltOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>Outline the changes</Button>}
              <Button size="small" href={`${CONVERT}/journeys/page?path=${encodeURIComponent(data.path)}`} sx={{ ...btn, fontWeight: 600 }}>Page flow</Button>
              <Button size="small" onClick={() => router.push(`${CONVERT}/preview`)} sx={{ ...btn, fontWeight: 600 }}>Another page</Button>
              <Button size="small" onClick={() => setFresh((n) => n + 1)} startIcon={<RefreshIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, fontWeight: 600 }}>Read the page again</Button>
            </Box>
            {pg.lines.length > 0 && (
              <Box component="details" sx={{ px: 1, "& summary": { cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: MUTED } }}>
                <summary>What the AI reads of this page ({pg.lines.length} lines)</summary>
                <Box component="pre" sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", mt: 1 }}>{pg.lines.join("\n")}</Box>
              </Box>
            )}
          </Box>
        </Box>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Nothing here is counted, ordered or sent - prices, availability and the cart stay empty.</Typography>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {!path && <PageHeader title="Preview" subtitle="An optimization on its page, Before | After with its versions - then sent to Content to be rebuilt there" />}
      {body}
    </Box>
  );
}

// THE AI HELPER (SARCLA 09.11.2026: "your optimization should have an AI helper"): beside the optimization, what to change
// in its version in a sentence - or, before there is one, how to make it. A few ready requests; a picked element
// lands here. Each answer is a new revision of the version, so nothing is lost.
const HELPER_ASKS = ["Make it stand out more", "Shorter, clearer text", "Move it higher on the page", "Closer to the shop's own look", "Better on a phone"];

function AiHelper({ version, ask, setAsk, busy, picked, pick, onPick, onSend }: {
  version: Version | null; ask: string; setAsk: (s: string) => void; busy: boolean; picked: Picked | null; pick: boolean; onPick: () => void; onSend: () => Promise<void>;
}) {
  return (
    <Box id="apso-ai-helper" sx={{ p: 1.5, borderRadius: "12px", border: "1px solid rgba(106,70,201,.28)", background: "linear-gradient(135deg, rgba(106,70,201,.07), rgba(36,89,209,.05) 55%, rgba(181,53,154,.05))", display: "grid", gap: 1, scrollMarginTop: 80 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Box sx={{ width: 28, height: 28, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: "#6a46c9", color: "#fff", flexShrink: 0 }}><AutoAwesomeIcon sx={{ fontSize: 17 }} /></Box>
        <Typography sx={{ fontWeight: 800, color: INK, fontSize: "0.92rem" }}>AI helper</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, flex: "1 1 260px" }}>
          {version ? `Say what to change in Version ${version.letter} - it writes a new revision, the old one stays` : "Say how to make the version - or let it make it as proposed"}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {HELPER_ASKS.map((h) => (
          <Box key={h} component="button" type="button" disabled={busy} onClick={() => setAsk(h)} sx={{
            all: "unset", cursor: "pointer", px: 1, py: 0.35, borderRadius: "6px", border: "1px solid rgba(106,70,201,.3)", bgcolor: ask === h ? "rgba(106,70,201,.14)" : "rgba(255,255,255,.7)",
            color: "#5b3fd0", fontSize: "0.76rem", fontWeight: 600, "&:hover": { bgcolor: "rgba(106,70,201,.1)" },
          }}>{h}</Box>
        ))}
      </Box>
      <TextField size="small" multiline minRows={2} value={ask} onChange={(e) => setAsk(e.target.value)} disabled={busy} fullWidth
        placeholder={version ? `e.g. “make the delivery line bigger, under the title”` : "e.g. “keep the shop's red, put the button under the price”"}
        inputProps={{ maxLength: 1500 }} sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ask.trim() && !busy) void onSend(); }} />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <AiButton size="small" busy={busy} disabled={!ask.trim()} onClick={() => void onSend()}>
          {busy ? "The AI is writing…" : version ? `Change Version ${version.letter}` : "Make the version"}
        </AiButton>
        <Button size="small" onClick={onPick} startIcon={<AdsClickOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ textTransform: "none", fontWeight: 600, color: pick ? "#5b3fd0" : MUTED }}>
          {pick ? "Click an element in the page…" : "Point at the page"}
        </Button>
        {picked && !pick && <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: "1 1 100%" }}>{`Pointed at: ${picked.text ? `“${picked.text.slice(0, 60)}”` : picked.selector}`}</Typography>}
      </Box>
    </Box>
  );
}

function Revisions({ version, shown, onRev }: { version: Version; shown: number; onRev: (r: number) => void }) {
  const revs = useHeld<{ revisions: Revision[] }>(`${API}?revisions=${version.id}&r=${version.rev}`, [version.id, version.rev]);
  const list = revs.result?.state === "ok" ? revs.result.data.revisions : [];
  if (list.length < 2) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, mb: 0.5, display: "flex", gap: 0.5, alignItems: "center", textTransform: "uppercase", letterSpacing: ".05em" }}><HistoryOutlinedIcon sx={{ fontSize: 15 }} /> Revisions of Version {version.letter}</Typography>
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {list.map((x) => (
          <Box key={x.rev} component="button" type="button" onClick={() => onRev(x.rev)} sx={{
            all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", gap: 1, px: 1, py: 0.5, borderRadius: "8px",
            bgcolor: shown === x.rev ? "rgba(36,89,209,.07)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
          }}>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: shown === x.rev ? ACCENT : INK }}>rev {x.rev}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, overflowWrap: "anywhere" }}>{x.request ?? "first version"}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{x.by} · {since(x.at)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Opening the preview…" />}>
      <ConvertPreview />
    </Suspense>
  );
}
