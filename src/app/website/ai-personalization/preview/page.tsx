"use client";

// APSOconvert > PREVIEW (Website > AI testing & personalization). One shop page, live: the page as visitors see it in a
// frame (src/app/api/website/ai-personalization/preview - nothing in it is counted or sent to the shop), its numbers
// from Problems, the AI's ideas for it (a person approves or drops each), and for an approved idea the VERSION the AI
// writes, laid over the page in the same frame - original and version side by side, on a desktop or a phone. Ask for a
// change in a sentence and the AI writes the next revision; every revision stays. An approved version is what the test
// will show (src/lib/convert/studio.ts). The page's TEXTS are written in Content Studio: "Send to Content" makes a
// project of the page, its numbers, its approved ideas and its version (src/lib/convert/handoff.ts) - this page
// shows, it does not write copy (SARCLA 07.11.2026: "we should not cannibalise content creation").

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
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
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
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
import type { BoardRow, Idea, Numbers, Revision, Version } from "@/lib/convert/studio";
import { iceScore } from "@/lib/convert/ice";
import { OP_LABEL, describe, type Change } from "@/lib/convert/versions";
import { projectForPage, markerOf, pageMarker } from "@/lib/convert/handoff";
import { convertPost, previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";
import { PageShot } from "../PageShot";

type StudioData = {
  env: Env; path: string;
  page: { status: number; error: string | null; title: string; h1: string[]; description: string; lines: string[]; truncated: boolean; kind: PageKind | null; product: string | null; url: string | null };
  ideas: Idea[]; versions: Version[]; canEdit: boolean; canContent: boolean; ai: boolean;
};
type Msg = { apsoPreview: "ready"; title: string } | { apsoPreview: "applied"; hit: number[] } | { apsoPreview: "go"; href: string } | { apsoPreview: "scroll"; y: number }
  | { apsoPreview: "picked"; selector: string; tag: string; text: string } | { apsoPreview: "styles"; total: number; nfailed: number; failed: string[] }
  | { apsoPreview: "drawn"; lines: string[] } | { apsoPreview: "body" };
type Picked = { selector: string; tag: string; text: string; from: string };
type Device = "desktop" | "phone";
type Zoom = "fit" | "full";
type Sync = { y: number; from: string; n: number };
type View = "version" | "original" | "both";

const API = "/api/website/ai-personalization/work";
const since = (iso: string) => ago(Date.parse(iso) / 1000);
const pct = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);

// ---------------------------------------------------------------------------------------------------------------------
// THE FRAME

function Frame({ src, device, zoom, label, address, name, sync, pick, marks, onMsg, onRetry }: {
  src: string; device: Device; zoom: Zoom; label: string; address: string; name: string; sync: Sync | null;
  pick: boolean; marks: boolean; onMsg: (m: Msg, from: string) => void; onRetry: () => void;
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
  const phone = device === "phone";
  const W = phone ? 390 : 1280;
  const inner = phone ? Math.min(W, Math.max(0, w - 24)) : w;
  const scale = zoom === "full" && !phone ? 1 : inner ? Math.min(1, inner / W) : 0.5;
  const shownH = phone ? Math.min(780, Math.max(540, vh * 0.74)) : Math.max(420, vh * 0.7);
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
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: label.startsWith("Version") ? "#6a46c9" : MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>
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
        <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Pages in work" note="Their ideas and versions - open one where it was left" />
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
                {w.ideas} {w.ideas === 1 ? "idea" : "ideas"}{w.approved ? ` · ${w.approved} approved` : ""}{w.ready ? ` · ${w.ready} ready to test` : ""} · {ago(Date.parse(w.last) / 1000)}
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
// IDEAS

const IDEA_TINT = { proposed: "amber", approved: "green", dropped: "slate" } as const;
const IDEA_LABEL = { proposed: "Proposed", approved: "Approved", dropped: "Dropped" } as const;

function IdeaCard({ idea, version, selected, canEdit, busy, onSelect, onStatus, onBuild }: {
  idea: Idea; version: Version | null; selected: boolean; canEdit: boolean; busy: boolean;
  onSelect: () => void; onStatus: (s: Idea["status"]) => void; onBuild: () => void;
}) {
  return (
    <Box onClick={onSelect} sx={{
      p: 1.5, borderRadius: "14px", border: `1px solid ${selected ? ACCENT : HAIRLINE}`, bgcolor: selected ? "rgba(36,89,209,.04)" : "rgba(255,255,255,.6)",
      cursor: "pointer", opacity: idea.status === "dropped" ? 0.6 : 1, display: "grid", gap: 0.75,
    }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, flex: 1, lineHeight: 1.3 }}>{idea.title}</Typography>
        <Chip tint={IDEA_TINT[idea.status]}>{IDEA_LABEL[idea.status]}</Chip>
      </Box>
      {idea.why && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}><b>Why</b> {idea.why}</Typography>}
      {idea.change && <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>Change</b> {idea.change}</Typography>}
      {idea.expect && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}><b>Should move</b> {idea.expect}</Typography>}
      {iceScore(idea) !== null && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
          <Tooltip title="Impact x confidence / effort - the higher, the sooner to try it">
            <Box component="span" sx={{ px: 0.9, py: 0.15, borderRadius: "5px", bgcolor: "#2459d1", color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}>Score {iceScore(idea)}</Box>
          </Tooltip>
          {([["Impact", idea.impact], ["Confidence", idea.confidence], ["Effort", idea.effort]] as const).map(([k, v]) => (
            <Box key={k} component="span" sx={{ px: 0.8, py: 0.15, borderRadius: "5px", border: `1px solid ${HAIRLINE}`, fontSize: "0.7rem", fontWeight: 600, color: MUTED }}>{k} {v}/5</Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, flex: 1 }}>
          {idea.source === "ai" ? "AI" : idea.createdBy} · {since(idea.createdAt)}{idea.decidedBy && idea.status !== "proposed" ? ` · ${IDEA_LABEL[idea.status].toLowerCase()} by ${idea.decidedBy}` : ""}
        </Typography>
        {canEdit && idea.status === "proposed" && (
          <>
            <Button size="small" onClick={(e) => { e.stopPropagation(); onStatus("dropped"); }}>Drop</Button>
            <Button size="small" variant="contained" disableElevation onClick={(e) => { e.stopPropagation(); onStatus("approved"); }}>Approve</Button>
          </>
        )}
        {canEdit && idea.status === "approved" && !version && (
          <Button size="small" variant="contained" disableElevation disabled={busy} onClick={(e) => { e.stopPropagation(); onBuild(); }}
            startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <AutoFixHighOutlinedIcon sx={{ fontSize: 16 }} />}>
            {busy ? "Writing…" : "Write the version"}
          </Button>
        )}
        {version && <Chip tint={version.status === "approved" ? "green" : "blue"}>{version.status === "approved" ? "Version approved" : `Version · rev ${version.rev}`}</Chip>}
        {canEdit && idea.status === "dropped" && <Button size="small" onClick={(e) => { e.stopPropagation(); onStatus("proposed"); }}>Bring back</Button>}
      </Box>
    </Box>
  );
}

function OwnIdea({ onAdd }: { onAdd: (title: string, change: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <Button size="small" onClick={() => setOpen(true)} sx={{ justifySelf: "start" }}>+ Your own idea</Button>;
  return (
    <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", border: `1px dashed ${HAIRLINE}` }}>
      <TextField size="small" label="The idea" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 200 }} />
      <TextField size="small" label="What changes on the page" value={change} onChange={(e) => setChange(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} />
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="small" variant="contained" disableElevation disabled={!title.trim() || busy} onClick={async () => {
          setBusy(true);
          const ok = await onAdd(title.trim(), change.trim());
          setBusy(false);
          if (ok) { setTitle(""); setChange(""); setOpen(false); }
        }}>Add, approved</Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// THE VERSION

function VersionCard({ version, idea, hit, canEdit, busy, rev, prefill, onRev, onAsk, onStatus, onEdit }: {
  version: Version; idea: Idea; hit: number[] | null; canEdit: boolean; busy: boolean; rev: number | null; prefill: { text: string; n: number } | null;
  onRev: (r: number | null) => void; onAsk: (request: string) => Promise<boolean>; onStatus: (s: "approve" | "reopen") => void; onEdit: (changes: unknown) => Promise<string | null>;
}) {
  const [ask, setAsk] = useState("");
  const askRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!prefill) return;
    setAsk(prefill.text);
    setTimeout(() => { askRef.current?.focus(); askRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }, [prefill]);
  const [hand, setHand] = useState(false);
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const revs = useHeld<{ revisions: Revision[] }>(`${API}?revisions=${version.id}&r=${version.rev}`, [version.id, version.rev]);
  const list = revs.result?.state === "ok" ? revs.result.data.revisions : [];
  const shownRev = rev ?? version.rev;
  const counted = hit && shownRev === version.rev;
  const elementChanges = version.changes.map((c, i) => ({ c, i })).filter((x) => x.c.op !== "css");
  const missed = counted ? elementChanges.filter((x) => (hit[x.i] ?? 0) <= 0) : [];
  return (
    <GlassCard>
      <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="purple" title={`Version · revision ${version.rev}`}
        note={idea.title}
        right={<Chip tint={version.status === "approved" ? "green" : "blue"}>{version.status === "approved" ? `Approved${version.approvedBy ? ` by ${version.approvedBy}` : ""}` : "Draft"}</Chip>} />
      <Box sx={{ display: "grid", gap: 1.25, mt: 1.5 }}>
        {version.summary && <Typography sx={{ fontSize: "0.84rem", color: INK }}>{version.summary}</Typography>}
        {counted && (missed.length === 0
          ? <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", color: GREEN, fontSize: "0.82rem", fontWeight: 600 }}><CheckCircleOutlineIcon sx={{ fontSize: 17 }} /> Every change found its place on the page</Box>
          : <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", color: AMBER, fontSize: "0.82rem", fontWeight: 600 }}><ErrorOutlineIcon sx={{ fontSize: 17 }} /> {missed.length} of {elementChanges.length} changes found nothing on the page - ask the AI to aim them again</Box>)}
        {rev !== null && rev !== version.rev && <Notice tone="warn">The frame shows revision {rev}. <Box component="button" type="button" onClick={() => onRev(null)} sx={{ all: "unset", cursor: "pointer", color: ACCENT, fontWeight: 600 }}>Back to the latest</Box></Notice>}
        <Box sx={{ display: "grid", gap: 0.5 }}>
          {version.changes.map((c: Change, i) => {
            const h = counted && c.op !== "css" ? (hit[i] ?? 0) : null;
            return (
              <Box key={i} sx={{ display: "grid", gridTemplateColumns: "22px auto minmax(0,1fr)", gap: 1, alignItems: "center" }}>
                {h === null ? <Box /> : h > 0 ? <CheckCircleOutlineIcon sx={{ fontSize: 16, color: GREEN }} /> : <ErrorOutlineIcon sx={{ fontSize: 16, color: h < 0 ? RED : AMBER }} />}
                <Chip tint="slate">{OP_LABEL[c.op]}</Chip>
                <Typography sx={{ fontSize: "0.8rem", color: INK, ...clip(420) }} title={"selector" in c ? c.selector : undefined}>{describe(c)}</Typography>
              </Box>
            );
          })}
        </Box>
        {canEdit && (
          <Box sx={{ display: "grid", gap: 1 }}>
            <TextField size="small" multiline minRows={2} value={ask} onChange={(e) => setAsk(e.target.value)} disabled={busy} inputRef={askRef}
              placeholder="Ask for a change in a sentence - e.g. “make the delivery line bigger, under the title”" inputProps={{ maxLength: 1500 }} />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button size="small" variant="contained" disableElevation disabled={!ask.trim() || busy}
                startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <AutoFixHighOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={async () => { if (await onAsk(ask.trim())) setAsk(""); }}>
                {busy ? "The AI is writing…" : "Send to the AI"}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => { setHand((h) => !h); setJson(JSON.stringify(version.changes, null, 2)); setJsonErr(null); }}>{hand ? "Close the code" : "Edit the code"}</Button>
              {version.status === "approved"
                ? <>
                    <Button size="small" onClick={() => onStatus("reopen")}>Back to draft</Button>
                    <Button size="small" variant="contained" disableElevation href={`/website/ai-personalization/tests?make=${version.id}`}
                      sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>Test it on the shop</Button>
                  </>
                : <Button size="small" variant="contained" color="success" disableElevation disabled={busy} onClick={() => onStatus("approve")}>Approve the version</Button>}
            </Box>
            {hand && (
              <Box sx={{ display: "grid", gap: 1 }}>
                <TextField multiline minRows={10} maxRows={28} value={json} onChange={(e) => setJson(e.target.value)}
                  sx={{ "& textarea": { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.76rem" } }} />
                {jsonErr && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{jsonErr}</Typography>}
                <Button size="small" variant="contained" disableElevation sx={{ justifySelf: "end" }} onClick={async () => {
                  let parsed: unknown;
                  try { parsed = JSON.parse(json); } catch (e) { setJsonErr(`Not valid JSON: ${(e as Error).message}`); return; }
                  const err = await onEdit(parsed);
                  setJsonErr(err);
                  if (!err) setHand(false);
                }}>Save as a new revision</Button>
              </Box>
            )}
          </Box>
        )}
        {list.length > 1 && (
          <Box>
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED, mb: 0.5, display: "flex", gap: 0.5, alignItems: "center" }}><HistoryOutlinedIcon sx={{ fontSize: 15 }} /> REVISIONS</Typography>
            <Box sx={{ display: "grid", gap: 0.25 }}>
              {list.map((r) => (
                <Box key={r.rev} component="button" type="button" onClick={() => onRev(r.rev === version.rev ? null : r.rev)} sx={{
                  all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", gap: 1, px: 1, py: 0.5, borderRadius: "8px",
                  bgcolor: shownRev === r.rev ? "rgba(36,89,209,.07)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
                }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: shownRev === r.rev ? ACCENT : INK }}>rev {r.rev}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, ...clip(300) }}>{r.request ?? "first version"}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{r.by} · {since(r.at)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// TO CONTENT STUDIO - the page's texts are written there: a project with the page, its numbers, its approved ideas
// and its version, found again by its marker line (like AI answers' recommendations)

function ToContent({ data, numbers, ideas, version }: { data: StudioData; numbers: Numbers | null; ideas: Idea[]; version: Version | null }) {
  const router = useRouter();
  const [made, setMade] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const marker = pageMarker(data.env, data.path);
  useEffect(() => {
    if (!data.canContent) return;
    let live = true;
    fetch("/api/content/projects?scope=visible").then((r) => r.json()).then((j: { ok?: boolean; projects?: { id: number; brief: string | null }[] }) => {
      if (!live || !j.ok) return;
      const p = (j.projects ?? []).find((x) => { const m = markerOf(x.brief); return !!m && m.env === data.env && m.path === data.path; });
      setMade(p ? p.id : null);
    }).catch(() => { /* the button still makes one */ });
    return () => { live = false; };
  }, [data.canContent, data.env, data.path, marker]);
  if (!data.canContent) {
    return <Tooltip title="Content Studio needs the Marketing access"><span><Button size="small" disabled>Send to Content</Button></span></Tooltip>;
  }
  const send = async () => {
    setBusy(true); setErr(null);
    const p = projectForPage({
      env: data.env, path: data.path, url: data.page.url ?? `${ENVS[data.env].base}${data.path}`, h1: data.page.h1[0] ?? "", title: data.page.title,
      numbers, ideas: ideas.filter((i) => i.status === "approved").map((i) => ({ title: i.title, why: i.why, change: i.change, expect: i.expect })),
      version: version ? { rev: version.rev, summary: version.summary } : null,
      previewPath: `${window.location.origin}${previewHref(data.env, data.path)}`,
    });
    try {
      const r = await fetch("/api/content/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; project?: { id: number }; error?: string } | null;
      if (!j?.ok || !j.project) { setErr(j?.error ?? `Content Studio answered ${r.status}.`); setBusy(false); return; }
      router.push(`/create?project=${j.project.id}&type=${p.contentType}`);
    } catch {
      setErr("Content Studio did not answer."); setBusy(false);
    }
  };
  return (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
      {made !== null && <Button size="small" variant="contained" disableElevation href={`/projects/${made}`}>Open in Content</Button>}
      <Tooltip title={made !== null ? "A project for this page is in Content already - this makes another" : "Content Studio writes the page's texts from its numbers, approved ideas and version"}>
        <span>
          <Button size="small" variant={made !== null ? "text" : "contained"} disableElevation disabled={busy} onClick={() => void send()}
            startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <EditNoteOutlinedIcon sx={{ fontSize: 17 }} />}>
            {made !== null ? "Send again" : "Send to Content"}
          </Button>
        </span>
      </Tooltip>
      {err && <Typography sx={{ fontSize: "0.76rem", color: RED, width: "100%" }}>{err}</Typography>}
    </Box>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PAGE

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

function ConvertPreview() {
  const router = useRouter();
  const sp = useSearchParams();
  const env: Env = sp.get("env") === "acc" ? "acc" : "prod";
  const path = sp.get("path");
  const ideaSel = sp.get("idea");
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [fresh, setFresh] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [sync, setSync] = useState<Sync | null>(null);
  const [view, setView] = useState<View>("both");
  const [hit, setHit] = useState<number[] | null>(null);
  const [rev, setRev] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [going, setGoing] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [marks, setMarks] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);
  const [styles, setStyles] = useState<{ total: number; nfailed: number } | null>(null);
  const told = useRef(false);
  // the page as the browser drew it, from the original's frame (else the version's) - the AI aims its changes at it
  const drawn = useRef<{ from: string; lines: string[] } | null>(null);

  const go = useCallback((e: Env, p: string, idea?: string | null) => {
    router.push(`/website/ai-personalization/preview?env=${e}&path=${encodeURIComponent(p)}${idea ? `&idea=${idea}` : ""}`);
  }, [router]);

  const url = path ? `${API}?env=${env}&path=${encodeURIComponent(path)}&n=${tick}${fresh ? "&fresh=1" : ""}` : null;
  const held = useHeld<StudioData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const probUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const prob = useHeld<ProblemsData>(probUrl, [probUrl]);
  const problems = prob.result?.state === "ok" ? prob.result.data : null;
  const numbers = path ? numbersFor(problems, path) : null;

  const ideas = d?.ideas ?? [];
  const versionOf = useMemo(() => new Map((d?.versions ?? []).map((v) => [v.ideaId, v])), [d]);
  const idea = ideas.find((i) => i.id === ideaSel) ?? ideas.find((i) => versionOf.has(i.id)) ?? null;
  const version = idea ? versionOf.get(idea.id) ?? null : null;
  useEffect(() => { setHit(null); setRev(null); }, [version?.id, version?.rev]);
  useEffect(() => { setPicked(null); setPick(false); setStyles(null); told.current = false; drawn.current = null; }, [path, env]);
  useEffect(() => { if (!version && view !== "original") setView("original"); else if (version && view === "original") setView("both"); }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = path ? `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}${fresh ? `&fresh=1&f=${fresh}` : ""}` : "";
  const vSrc = version ? `${base}&v=${version.id}&r=${rev ?? version.rev}&at=${encodeURIComponent(version.updatedAt)}` : "";

  const onMsg = useCallback((m: Msg, from: string) => {
    if (m.apsoPreview === "scroll" && typeof m.y === "number") setSync((s) => ({ y: m.y, from, n: (s?.n ?? 0) + 1 }));
    if (m.apsoPreview === "applied" && Array.isArray(m.hit)) setHit(m.hit);
    if (m.apsoPreview === "drawn" && Array.isArray(m.lines) && (from === "original" || drawn.current?.from !== "original")) drawn.current = { from, lines: m.lines.slice(0, 160) };
    if (m.apsoPreview === "picked" && typeof m.selector === "string") { setPicked({ selector: m.selector.slice(0, 300), tag: String(m.tag).slice(0, 20), text: String(m.text ?? "").slice(0, 160), from }); setPick(false); }
    if (m.apsoPreview === "styles" && typeof m.total === "number") {
      setStyles((s) => (s && s.nfailed >= m.nfailed ? s : { total: m.total, nfailed: m.nfailed }));
      // the browser could not draw some of the shop's styles: once per page, into the hub's log
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
    // the AI's two actions take the drawn page along, cut to fit the hub's 8 KB body
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

  // "Find ideas" on an Insights card opens the page with ?ask=1: a page without ideas asks the AI by itself, once - after
  // a few seconds, so the frame has sent the page as it is drawn (the AI aims its ideas at it); the address then loses
  // its ask=1, so a reload never asks twice. A person's click, the hub's daily AI budget as for the button.
  const asked = useRef(false);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (askTimer.current) clearTimeout(askTimer.current); }, []);
  useEffect(() => {
    if (asked.current || sp.get("ask") !== "1" || !d || !path) return;
    if (!d.canEdit || !d.ai || d.page.status !== 200 || d.ideas.length > 0) return;
    asked.current = true;
    askTimer.current = setTimeout(() => {
      router.replace(`/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}`);
      void act("ideas", { action: "ideas", env, path, numbers });
    }, 8000);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode;
  if (!path) {
    body = <Picker env={env} onOpen={(e, p) => go(e, p)} problems={problems} />;
  } else if (r === null) {
    body = <LoadingPanel label="Reading the page from the shop…" />;
  } else if (r.state !== "ok") {
    body = <UpstreamPanel source="Preview" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  } else {
    const data = r.data;
    const pg = data.page;
    const counts = { proposed: ideas.filter((i) => i.status === "proposed").length, approved: ideas.filter((i) => i.status === "approved").length };
    body = (
      <>
        {/* the page and its numbers */}
        <GlassCard sx={{ py: { xs: 1.5, md: 1.75 } }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ minWidth: 0, flex: "1 1 360px" }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tint={env === "prod" ? "green" : "amber"}>{ENVS[env].label}</Chip>
                {pg.kind && <Chip tint={pg.kind === "product" ? "green" : pg.kind === "category" ? "blue" : pg.kind === "home" ? "purple" : "amber"}>{KIND_LABEL[pg.kind]}</Chip>}
                <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK, ...clip(640) }}>{pg.h1[0] || pg.title || path}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, ...clip(760) }}>{path}</Typography>
            </Box>
            {numbers ? (
              <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
                {[
                  ["Views", numbers.views ? full(numbers.views) : "–"],
                  ["Cart rate", `${pct(numbers.rate)} / ${pct(numbers.typical)} typical`],
                  ["Customers lost", numbers.companies ? `${full(numbers.lost ?? 0)} of ${full(numbers.companies)}` : "–"],
                  ["Most stopped at", numbers.topLoss ?? "–"],
                ].map(([k, v]) => (
                  <Box key={k}><Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 700, textTransform: "uppercase" }}>{k}</Typography><Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{v}</Typography></Box>
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, display: "flex", gap: 0.5, alignItems: "center" }}>
                <InsightsOutlinedIcon sx={{ fontSize: 16 }} />{prob.result === null ? "Reading its numbers…" : "Not on Problems in this period"}
              </Typography>
            )}
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
              <ToContent data={data} numbers={numbers} ideas={ideas} version={version} />
              <Button size="small" href={`/website/ai-personalization/journeys?path=${encodeURIComponent(data.path)}`} sx={{ textTransform: "none" }}>Its visitors' flow</Button>
              <Button size="small" onClick={() => router.push("/website/ai-personalization/preview")}>Other page</Button>
              {pg.url && <Tooltip title="Open on the shop"><IconButton size="small" component="a" href={pg.url} target="_blank" rel="noopener"><OpenInNewIcon sx={{ fontSize: 17, color: MUTED }} /></IconButton></Tooltip>}
            </Box>
          </Box>
          {numbers?.reasons?.[0] && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{numbers.reasons.join(" · ")}</Typography>}
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

        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
          {/* the preview */}
          <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
              <SquareChoice<View> label="Show" value={version ? view : "original"} onChange={setView}
                options={version ? [{ key: "both", label: "Side by side" }, { key: "version", label: "Version" }, { key: "original", label: "Original" }] : [{ key: "original", label: "The page as it is" }]} />
              <SquareChoice<Device> label="On" value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "phone", label: "Phone" }]} />
              {device === "desktop" && <SquareChoice<Zoom> label="Size" value={zoom} onChange={setZoom} options={[{ key: "fit", label: "Fit" }, { key: "full", label: "Actual size" }]} />}
              <Box sx={{ flex: 1 }} />
              {version && (
                <Button size="small" variant={marks ? "contained" : "outlined"} disableElevation onClick={() => setMarks((x) => !x)} startIcon={<HighlightAltOutlinedIcon sx={{ fontSize: 17 }} />}
                  sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>{marks ? "Changes shown" : "Show the changes"}</Button>
              )}
              <Tooltip title="Click an element in the page to ask the AI to change it">
                <Button size="small" variant={pick ? "contained" : "outlined"} color="secondary" disableElevation onClick={() => setPick((x) => !x)} startIcon={<AdsClickOutlinedIcon sx={{ fontSize: 17 }} />}
                  sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>{pick ? "Click an element…" : "Pick an element"}</Button>
              </Tooltip>
              <Tooltip title="Read the page from the shop again">
                <IconButton size="small" onClick={() => setFresh((n) => n + 1)} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
              </Tooltip>
            </Box>
            {picked && (
              <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap", mb: 1.5, p: 1.25, borderRadius: "10px", border: "1px solid rgba(124,77,255,.35)", bgcolor: "rgba(124,77,255,.06)" }}>
                <AdsClickOutlinedIcon sx={{ fontSize: 18, color: "#6a46c9" }} />
                <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, ...clip(720) }}>{picked.text ? `“${picked.text}”` : `A <${picked.tag}> element`}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontFamily: "ui-monospace, Consolas, monospace", ...clip(720) }}>{picked.selector}</Typography>
                </Box>
                {version && data.canEdit
                  ? <Button size="small" variant="contained" disableElevation onClick={() => { setPrefill({ text: `Change this element - ${picked.selector}${picked.text ? ` (it reads “${picked.text.slice(0, 80)}”)` : ""}: `, n: Date.now() }); }}>Ask the AI to change it</Button>
                  : idea && idea.status === "approved" && data.canEdit
                    ? <Button size="small" variant="contained" disableElevation disabled={busy === `build:${idea.id}`} onClick={() => void act(`build:${idea.id}`, { action: "build", ideaId: idea.id, request: `Start from this element - ${picked.selector}${picked.text ? ` (it reads “${picked.text.slice(0, 80)}”)` : ""}.` })}>
                        {busy === `build:${idea.id}` ? "The AI is writing…" : "Write the version from here"}
                      </Button>
                    : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Approve an idea first - its version can then change this element.</Typography>}
                <Button size="small" onClick={() => setPicked(null)}>Clear</Button>
              </Box>
            )}
            {styles && styles.nfailed > 0 && (
              <Notice tone="warn">Your browser drew {styles.total - styles.nfailed} of the shop&apos;s {styles.total} stylesheets in the preview - the page can look raw. The hub has noted it; reading the page again usually helps.</Notice>
            )}
            {pg.status === 200 && (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: version && view === "both" ? { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" } : "minmax(0,1fr)" }}>
                {(!version || view !== "version") && <Frame src={base} device={device} zoom={zoom} name="original" sync={sync} pick={pick} marks={false} address={pg.url ?? path} label={version ? "Original" : "The page"} onMsg={onMsg} onRetry={() => setFresh((n) => n + 1)} />}
                {version && view !== "original" && <Frame src={vSrc} device={device} zoom={zoom} name="version" sync={sync} pick={pick} marks={marks} address={pg.url ?? path} label={`Version · rev ${rev ?? version.rev}`} onMsg={onMsg} onRetry={() => setFresh((n) => n + 1)} />}
              </Box>
            )}
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1 }}>
              Nothing here is counted, ordered or sent - prices, availability and the cart stay empty.
            </Typography>
          </GlassCard>

          {/* the version and the ideas */}
          <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: version ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" }, alignItems: "start" }}>
            {version && idea && (
              <VersionCard version={version} idea={idea} hit={hit} canEdit={data.canEdit} busy={busy === `build:${idea.id}`} rev={rev} prefill={prefill} onRev={setRev}
                onAsk={(request) => act(`build:${idea.id}`, { action: "build", ideaId: idea.id, request })}
                onStatus={(s) => void act(`v:${version.id}`, { action: s, versionId: version.id })}
                onEdit={async (changes) => {
                  const res = await convertPost<{ problems: string[] }>(API, { action: "edit", versionId: version.id, changes });
                  if (!res.ok) return res.error;
                  setTick((n) => n + 1);
                  return res.data.problems.length ? `Saved; left out: ${res.data.problems.join("; ")}` : null;
                }} />
            )}
            <GlassCard>
              <CardTitle icon={<TipsAndUpdatesOutlinedIcon />} tint="amber" title={`Ideas · ${ideas.filter((i) => i.status !== "dropped").length}`}
                note={counts.proposed ? `${counts.proposed} waiting for a yes or no` : "Approve one and the AI writes its version"} />
              <Box sx={{ display: "grid", gap: 1.25, mt: 1.5 }}>
                {data.canEdit && (
                  <Button variant={ideas.length ? "outlined" : "contained"} disableElevation disabled={!data.ai || busy === "ideas" || pg.status !== 200} onClick={() => void act("ideas", { action: "ideas", env, path, numbers })}
                    startIcon={busy === "ideas" ? <CircularProgress size={14} /> : <TipsAndUpdatesOutlinedIcon sx={{ fontSize: 17 }} />}>
                    {busy === "ideas" ? "The AI is reading the page… about half a minute" : ideas.length ? "Ask the AI for more ideas" : "Ask the AI for ideas"}
                  </Button>
                )}
                {!data.ai && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No AI key on this hub - ideas can be added by hand.</Typography>}
                {ideas.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No idea for this page yet.</Typography>}
                {[...ideas].sort((x, y) => (x.status === "dropped" ? 1 : 0) - (y.status === "dropped" ? 1 : 0) || (iceScore(y) ?? -1) - (iceScore(x) ?? -1)).map((i) => (
                  <IdeaCard key={i.id} idea={i} version={versionOf.get(i.id) ?? null} selected={idea?.id === i.id} canEdit={data.canEdit} busy={busy === `build:${i.id}`}
                    onSelect={() => go(env, path, i.id)}
                    onStatus={(s) => void act(`i:${i.id}`, { action: "idea", id: i.id, status: s })}
                    onBuild={() => { go(env, path, i.id); void act(`build:${i.id}`, { action: "build", ideaId: i.id }); }} />
                ))}
                {data.canEdit && <OwnIdea onAdd={(title, change) => act("add", { action: "add", env, path, title, change, numbers })} />}
              </Box>
            </GlassCard>
            {pg.lines.length > 0 && (
              <Box component="details" sx={{ px: 1, "& summary": { cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: MUTED } }}>
                <summary>What the AI reads of this page ({pg.lines.length} lines)</summary>
                <Box component="pre" sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", mt: 1 }}>{pg.lines.join("\n")}</Box>
              </Box>
            )}
          </Box>
        </Box>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Preview"
        subtitle="A shop page live, its ideas, and the version beside the original"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(held.stale || busy) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {path && <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>}
          </Box>
        }
      />
      {body}
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
