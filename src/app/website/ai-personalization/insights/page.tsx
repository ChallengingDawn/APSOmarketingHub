"use client";

// APSOconvert > INSIGHTS - ONE page for what the AI proposes to change on the shop and the pages it reads (SARCLA
// 09.11.2026: "merge Insights and Problem pages, and only insights that propose different types of content change").
// The first choice is the TYPE OF CHANGE - Content's own types (src/lib/convert/changeTypes.ts): Page builder, SEO landing
// page, Banner, Newsletter, Blog (to come) - so what is shown here is what Content makes from it: "it's displayed on the
// app, then a brief is sent to reproduce it on Content". Each optimization is a card with the picture of the very block
// it is about; "Discover the optimization" = the diagnostic, the change, what it should move, then the Preview (before |
// after, versions A-D, "Send to project"). Under the cards, the same type's pages the AI has not read yet - the pages
// losing buyers (Page builder), Google's view of the pages (SEO landing page), the slider (Banner), the newsletter band
// (Newsletter) - each with "Find optimizations". Nothing reaches the shop from here.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { ENVS, KIND_LABEL, sortProblems } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";
import type { ProblemsData } from "@/lib/convert/problems";
import { iceScore } from "@/lib/convert/ice";
import { CHANGE_LABEL, CHANGE_TYPES, isChangeType, typeOfIdea, type ChangeType } from "@/lib/convert/changeTypes";
import { Chip } from "../Tag";
import { PageShot } from "../PageShot";
import { SquareChoice } from "../SquareChoice";
import { convertPost, previewHref } from "../Flow";
import { AiButton } from "../AiButton";
import { BlocksLens, CardPages, SeoLens } from "../problems/Lenses";
import { Customers, PageCard, SHOP_FROM, WhatStops, workByKey, type Row } from "../problems/parts";

type Priority = "high" | "medium" | "low";
/** Webyn's priority from the AI's own ranking: impact x confidence / effort. */
const priorityOf = (r: BoardRow): Priority => {
  const s = iceScore(r);
  return s === null ? "medium" : s >= 6 ? "high" : s >= 3 ? "medium" : "low";
};
const PRIO: Record<Priority, { label: string; fg: string; bg: string; border: string }> = {
  high: { label: "High", fg: "#c5221f", bg: "rgba(197,34,31,.08)", border: "rgba(197,34,31,.45)" },
  medium: { label: "Medium", fg: "#a96a12", bg: "rgba(169,106,18,.08)", border: "rgba(169,106,18,.4)" },
  low: { label: "Low", fg: "#4b5b74", bg: "rgba(75,91,116,.08)", border: "rgba(75,91,116,.3)" },
};
type Show = "decide" | "approved" | "all";
type TypeKey = ChangeType | "all";
const TYPE_TINT: Record<ChangeType, "blue" | "purple" | "amber" | "green" | "slate"> = {
  "page-refresh": "blue", "landing-page": "purple", banner: "amber", newsletter: "green", "blog-article": "slate",
};
/** The home page's rows - blocks of a page, so the Page builder's. */
const HOME_ROWS = ["home-top", "home-tools", "home-more", "home-text"];

/** A page's name from its address: its last part, words instead of dashes, no product number. */
function pageName(path: string): string {
  const last = path.replace(/\.html$/, "").split("/").filter(Boolean).pop() ?? path;
  const words = last.replace(/^\d{8}-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

/** The AI's last night scan in a few words: when, and what it read (or why nothing). */
function scanWords(s: { day: string; pages: string[]; note: string }): string {
  const d = `${s.day.slice(8, 10)}.${s.day.slice(5, 7)}.`;
  if (s.pages.length) return `night of ${d}: ${s.pages.length} ${s.pages.length === 1 ? "page" : "pages"} read`;
  if (s.note === "started") return `night of ${d}: reading`;
  return `night of ${d}: ${s.note}`;
}

function PrioTag({ p }: { p: Priority }) {
  const c = PRIO[p];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: "1px", borderRadius: "3px", border: `1px solid ${c.border}`, bgcolor: c.bg, color: c.fg, fontSize: "0.72rem", fontWeight: 800 }}>
      <ErrorOutlineIcon sx={{ fontSize: 13 }} />{c.label}
    </Box>
  );
}

function Section({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 0.5, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Box sx={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: `${tone}1f`, color: tone, "& svg": { fontSize: 16 } }}>{icon}</Box>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: tone }}>{title}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.88rem", color: INK, lineHeight: 1.5, pl: 4.25 }}>{children}</Typography>
    </Box>
  );
}

const stateOf = (r: BoardRow) => (r.status === "dropped" ? "Dropped" : r.sentAt ? "Sent to project" : r.status === "approved" ? "In work" : null);

function Discover({ r, onClose, onDone }: { r: BoardRow; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (status: "dropped" | "proposed") => {
    setBusy(status); setErr(null);
    const res = await convertPost("/api/website/ai-personalization/work", { action: "idea", id: r.id, status });
    setBusy(null);
    if (!res.ok) { setErr(res.error); return; }
    onDone();
    if (status === "dropped") onClose();
  };
  const p = priorityOf(r);
  const t = typeOfIdea(r);
  const st = stateOf(r);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px", m: { xs: 1.5, sm: 4 } } } }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Typography sx={{ flex: 1, fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{r.title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon sx={{ fontSize: 19 }} /></IconButton>
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <PrioTag p={p} />
          <Chip tint={TYPE_TINT[t]}>{CHANGE_LABEL[t]}</Chip>
          {st && <Chip tint={st === "Dropped" ? "slate" : "green"}>{st}</Chip>}
          <Chip tint={r.env === "prod" ? "green" : "amber"}>{ENVS[r.env].label}</Chip>
          <Chip tint="slate">{KIND_LABEL[r.kind]} · {pageName(r.path)}</Chip>
          {iceScore(r) !== null && <Chip tint="blue">Impact {r.impact}/5 · Confidence {r.confidence}/5 · Effort {r.effort}/5</Chip>}
        </Box>
        <Box sx={{ borderRadius: "10px", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
          <PageShot env={r.env} path={r.path} focus={r.target ?? null} ratio={0.42} label={r.title} />
        </Box>
        <Box>
          <Section icon={<ErrorOutlineIcon />} tone="#c5221f" title="Diagnostic">{r.why || "-"}</Section>
          <Section icon={<ScienceOutlinedIcon />} tone="#2459d1" title="The optimization">{r.change || "-"}</Section>
          <Section icon={<TrackChangesOutlinedIcon />} tone="#1b7a55" title="Should move">{r.expect || "-"}</Section>
        </Box>
        {err && <Notice tone="bad">{err}</Notice>}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", pt: 0.5 }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: "1 1 200px" }}>{r.source === "ai" ? "Found by the AI" : `By ${r.createdBy ?? "–"}`} · {ago(Date.parse(r.createdAt) / 1000)} · {r.path}</Typography>
          {r.status === "proposed" && <Button disabled={!!busy} onClick={() => void decide("dropped")} sx={{ textTransform: "none", fontWeight: 600 }}>Drop</Button>}
          {r.status === "dropped" && <Button disabled={!!busy} onClick={() => void decide("proposed")} startIcon={busy ? <CircularProgress size={13} /> : undefined} sx={{ textTransform: "none", fontWeight: 600 }}>Bring back</Button>}
          <AiButton href={previewHref(r.env, r.path, r.id)}>{r.versions ? "See its versions on the page" : "See it on the page"}</AiButton>
        </Box>
      </Box>
    </Dialog>
  );
}

/** The optimization cards, 12 a page. */
function IdeaGrid({ rows, onOpen, resetKey }: { rows: BoardRow[]; onOpen: (id: string) => void; resetKey: string }) {
  const PER = 12;
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const p = Math.min(page, pages);
  return (
    <Box ref={top} sx={{ display: "grid", gap: 2, scrollMarginTop: 16 }}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {rows.slice((p - 1) * PER, p * PER).map((x) => {
          const t = typeOfIdea(x);
          const st = stateOf(x);
          return (
            <Box key={x.id} sx={{
              display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "14px", overflow: "hidden", bgcolor: "rgba(255,255,255,.92)",
              border: "1px solid rgba(21,34,58,.10)", boxShadow: "0 6px 18px rgba(21,34,58,.06)", transition: "box-shadow .15s, transform .15s",
              "&:hover": { boxShadow: "0 10px 26px rgba(21,34,58,.12)", transform: "translateY(-1px)" },
            }}>
              <Box component="button" type="button" onClick={() => onOpen(x.id)} sx={{ all: "unset", cursor: "pointer", display: "block" }}>
                <PageShot env={x.env} path={x.path} focus={x.target ?? null} ratio={0.5} label={x.title} />
              </Box>
              <Box sx={{ p: 1.5, display: "grid", gap: 1, flex: 1, alignContent: "start", bgcolor: "rgba(36,89,209,.025)" }}>
                <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                  <PrioTag p={priorityOf(x)} />
                  <Chip tint={TYPE_TINT[t]}>{CHANGE_LABEL[t]}</Chip>
                  {st && <Chip tint={st === "Dropped" ? "slate" : "green"}>{st}</Chip>}
                  {x.versions > 0 && <Chip tint="purple">{x.versions} {x.versions === 1 ? "version" : "versions"}</Chip>}
                  {x.source === "ai" && <Tooltip title="Found by the AI"><AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: "#6a46c9", ml: "auto" }} /></Tooltip>}
                </Box>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.title}</Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  <Chip tint="slate">{ENVS[x.env].label} · {pageName(x.path)}</Chip>
                </Box>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.why}</Typography>
                <Box sx={{ display: "flex", justifyContent: "center", mt: "auto", pt: 0.5 }}>
                  <AiButton onClick={() => onOpen(x.id)}>Discover the optimization</AiButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {pages > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
          <Pagination count={pages} page={p} onChange={(_, n) => { setPage(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} shape="rounded" color="primary"
            sx={{ "& .MuiPaginationItem-root": { borderRadius: "6px", fontWeight: 600 } }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{(p - 1) * PER + 1}-{Math.min(p * PER, rows.length)} of {full(rows.length)}</Typography>
        </Box>
      )}
    </Box>
  );
}

/** The pages losing buyers the AI has not read yet - each a card with "Find optimizations"; its customers below. */
function PagesToRead({ from, to, ideas, themes }: { from: string; to: string; ideas: BoardRow[]; themes: boolean }) {
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/problems?from=${from}&to=${to}&n=${tick}`;
  const held = useHeld<ProblemsData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  // the shop's record still being read: ask again in twenty seconds
  useEffect(() => {
    if (d?.shop.state !== "computing") return;
    const t = setTimeout(() => setTick((n) => n + 1), 20_000);
    return () => clearTimeout(t);
  }, [d?.shop.state, tick]);
  const work = useMemo(() => workByKey(ideas), [ideas]);
  const rows = useMemo(() => (d ? (sortProblems((d.pages as Row[]).filter((p) => p.reasons.length > 0 && !work.has(p.key)), "missed") as Row[]) : []), [d, work]);
  if (r === null) return <LoadingPanel label="Reading Google Analytics and the shop's record…" />;
  if (r.state === "not-configured") return <NotConnectedPanel source="the hub" missing={r.missing} />;
  if (r.state === "error") return <UpstreamPanel source="Pages losing buyers" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  const data = r.data;
  const selected = sel ? rows.find((p) => p.key === sel) ?? null : null;
  return (
    <>
      {!data.ga4.configured && <Notice tone="warn">Google Analytics is not connected on this hub - the views and add-to-carts are missing.</Notice>}
      {data.ga4.error && <Notice tone="bad">Google Analytics did not answer: {data.ga4.error}</Notice>}
      {data.shop.state === "computing" && <Notice tone="warn">The shop&apos;s record is being read{data.shop.progress ? ` (${data.shop.progress})` : ""} - the customers appear when it is done.</Notice>}
      {data.from < SHOP_FROM && <Notice tone="warn">The shop&apos;s record of customers starts on 2 October 2026 - before that, Google Analytics only.</Notice>}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        A page losing buyers: {full(data.minViews)}+ views and less than half the typical cart rate, or {data.minCompanies}+ customers opened it and most did not order. The pages the AI already read are above, as optimizations.
      </Typography>
      {rows.length === 0
        ? <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>Every page losing buyers in this period has its optimizations above.</Typography>
        : <CardPages rows={rows} keyOf={(p) => p.key} resetKey={`${from}:${to}`} render={(p) => <PageCard p={p} selected={p.key === sel} onSelect={() => setSel((c) => (c === p.key ? null : p.key))} work={null} />} />}
      {selected && <Customers key={selected.key} row={selected} from={data.from} to={data.to} />}
      {themes && data.pages.some((p) => p.reasons.length > 0) && <WhatStops from={data.from} to={data.to} rows={data.pages as Row[]} />}
    </>
  );
}

const READ_NEXT: Record<TypeKey, { title: string; note: string }> = {
  all: { title: "Pages losing buyers, not read yet", note: "The AI reads 5 a night by itself - or now, with Find optimizations" },
  "page-refresh": { title: "Pages losing buyers, not read yet", note: "And the home page's rows, each optimized as one block" },
  "landing-page": { title: "Google's view of the shop's pages", note: "Shown on Google, clicked little: the searches the shop does not answer well" },
  banner: { title: "The home slider", note: "Its optimizations come as clearly different versions side by side" },
  newsletter: { title: "The newsletter band", note: "On every page; its sign-ups come from HubSpot's newsletter forms" },
  "blog-article": { title: "The blog", note: "To come" },
};

export default function ConvertInsights() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [type, setType] = useState<TypeKey>("all");
  const [show, setShow] = useState<Show>("decide");
  const [prio, setPrio] = useState<Priority | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  // a link may name the type (Problem pages' old address leads here with ?type=)
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("type");
      if (isChangeType(t)) setType(t);
    } catch { /* no address to read */ }
  }, []);
  const url = `/api/website/ai-personalization/ideas?n=${tick}`;
  const held = useHeld<{ ideas: BoardRow[]; scans?: { day: string; pages: string[]; note: string }[] }>(url, [url]);
  const r = held.result;
  const all = useMemo(() => (r?.state === "ok" ? r.data.ideas : []), [r]);
  const lastScan = r?.state === "ok" ? (r.data.scans ?? [])[0] ?? null : null;
  const view = useMemo(() => {
    const byShow = all.filter((x) => (show === "decide" ? x.status === "proposed" : show === "approved" ? x.status === "approved" : x.status !== "dropped"));
    const types = CHANGE_TYPES.map((t) => ({ key: t.key, n: byShow.filter((x) => typeOfIdea(x) === t.key).length }));
    const inType = byShow.filter((x) => type === "all" || typeOfIdea(x) === type);
    const prios = (["high", "medium", "low"] as Priority[]).map((p) => ({ key: p, n: inType.filter((x) => priorityOf(x) === p).length }));
    const pr: Priority | "all" = prio !== "all" && prios.some((x) => x.key === prio && x.n > 0) ? prio : "all";
    const rows = inType.filter((x) => pr === "all" || priorityOf(x) === pr)
      .sort((a, b) => (iceScore(b) ?? 0) - (iceScore(a) ?? 0) || b.createdAt.localeCompare(a.createdAt));
    return {
      rows, types, prios, pr, total: byShow.length,
      counts: { decide: all.filter((x) => x.status === "proposed").length, approved: all.filter((x) => x.status === "approved").length, all: all.filter((x) => x.status !== "dropped").length },
      pages: new Set(rows.map((x) => `${x.env}${x.path}`)).size,
    };
  }, [all, show, type, prio]);
  const openRow = open ? all.find((x) => x.id === open) ?? null : null;
  const next = READ_NEXT[type];

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading what the AI found…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Insights" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else {
    body = (
      <>
        <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: "grid", gap: 1.25 }}>
            <SquareChoice<TypeKey> label="Type of change" value={type} onChange={setType} options={[
              { key: "all", label: "All", count: view.total },
              ...CHANGE_TYPES.map((t) => ({ key: t.key, label: t.soon ? `${t.label} · to come` : t.label, count: t.soon ? undefined : view.types.find((x) => x.key === t.key)?.n ?? 0, disabled: !!t.soon })),
            ]} />
            <Box sx={{ display: "flex", gap: 1.5, rowGap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
              <SquareChoice<Show> label="Show" value={show} onChange={setShow} options={[
                { key: "decide", label: "To decide", count: view.counts.decide }, { key: "approved", label: "In work", count: view.counts.approved }, { key: "all", label: "All", count: view.counts.all },
              ]} />
              <SquareChoice<Priority | "all"> label="Priority" value={view.pr} onChange={setPrio} options={[
                { key: "all", label: "All" }, ...view.prios.map((p) => ({ key: p.key, label: PRIO[p.key].label, count: p.n, disabled: p.n === 0 })),
              ]} />
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>
            {view.rows.length} {view.rows.length === 1 ? "optimization" : "optimizations"} on {view.pages} {view.pages === 1 ? "page" : "pages"}
            {type !== "all" && ` · ${CHANGE_TYPES.find((t) => t.key === type)?.about}`}
            {type === "landing-page" || type === "banner" || type === "newsletter"
              ? " · the AI makes a new batch of this type within the hour whenever fewer than 3 wait for a decision (once a day)"
              : <>{" · "}the AI keeps 100 block optimizations ready - up to 10 pages an hour, the pages losing buyers first · {lastScan ? scanWords(lastScan) : "its first night shows here"}</>}
          </Typography>
        </GlassCard>

        {view.rows.length === 0 && type !== "blog-article" && (
          <GlassCard>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{show === "decide" ? "Nothing of this type waits for a decision." : "Nothing of this type yet."}</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>Find optimizations on one of the pages below - the AI reads it at once.</Typography>
          </GlassCard>
        )}
        {view.rows.length > 0 && <IdeaGrid rows={view.rows} onOpen={setOpen} resetKey={`${type}:${show}:${view.pr}`} />}

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap", mt: 1 }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>{next.title}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{next.note}</Typography>
        </Box>
        {(type === "all" || type === "page-refresh") && <PagesToRead from={win.from} to={win.to} ideas={all} themes={type === "all"} />}
        {type === "page-refresh" && <BlocksLens from={win.from} to={win.to} totalViews={null} homeViews={null} only={HOME_ROWS} compact />}
        {type === "landing-page" && <SeoLens from={win.from} to={win.to} names={new Map()} onlyProblems />}
        {type === "banner" && <BlocksLens from={win.from} to={win.to} totalViews={null} homeViews={null} only={["home-slider"]} compact />}
        {type === "newsletter" && <BlocksLens from={win.from} to={win.to} totalViews={null} homeViews={null} only={["newsletter"]} compact />}
        {type === "blog-article" && <Notice tone="warn">The shop has no blog yet - its articles come here once it has one, as Content&apos;s Blog article.</Notice>}

        {openRow && <Discover r={openRow} onClose={() => setOpen(null)} onDone={() => setTick((n) => n + 1)} />}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Insights" subtitle="What the AI proposes to change on the shop, by type of content - see it on the page, then send it to Content"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* SARCLA 10.11.2026: "put a disclaimer on Insights: product pages are deactivated for the moment, as cart and my
                account - not sent [the] token on dotSource['s] hard-coded pages"; 11.11.2026: "put this a small message on
                top right before the date switcher" */}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", maxWidth: 440, px: 1.25, py: 0.6, borderRadius: "8px", bgcolor: "rgba(183,121,31,.08)", border: "1px solid rgba(183,121,31,.25)" }}>
              <InfoOutlinedIcon sx={{ fontSize: 15, color: "#b7791f", mt: "2px" }} />
              <Typography sx={{ fontSize: "0.72rem", color: INK, lineHeight: 1.4 }}>
                For the moment the AI proposes no optimization on <b>product pages</b>, the <b>cart</b> or <b>My account</b>: dotSource codes those
                pages in the shop&apos;s theme, and the hub has no access to change them yet. Home, category and content pages get block
                optimizations - a block of the page and 3 or 4 modules to replace it.
              </Typography>
            </Box>
            <WindowPicker />
            {held.stale && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        } />
      {body}
    </Box>
  );
}
