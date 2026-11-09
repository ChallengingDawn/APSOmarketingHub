"use client";

// APSOconvert > INSIGHTS - what the AI found on the shop's pages and proposes to change, the way Webyn's Insights show
// it (SARCLA 08.11.2026, with Webyn's cockpit on screen: "the AI already sees optimizations and proposes, then you can
// preview the change"): each one a card with the picture of the very block it is about (outlined), its priority, the
// page, and "Discover the optimization" - the diagnostic, the suggested change, what it should move - then see it on
// the page in the Preview, approve or drop it. The ideas are the AI's (the page's own reading, or the night scan of the
// worst pages - src/lib/convert/scan.ts); nothing reaches the shop from here.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { ENVS, KIND_LABEL, type PageKind } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";
import { iceScore } from "@/lib/convert/ice";
import { Chip } from "../Tag";
import { PageShot } from "../PageShot";
import { SquareChoice } from "../SquareChoice";
import { convertPost, previewHref } from "../Flow";

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

function Discover({ r, onClose, onDone }: { r: BoardRow; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (status: "approved" | "dropped" | "proposed") => {
    setBusy(status); setErr(null);
    const res = await convertPost("/api/website/ai-personalization/work", { action: "idea", id: r.id, status });
    setBusy(null);
    if (!res.ok) { setErr(res.error); return; }
    onDone();
    if (status !== "proposed") onClose();
  };
  const p = priorityOf(r);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px", m: { xs: 1.5, sm: 4 } } } }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Typography sx={{ flex: 1, fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{r.title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon sx={{ fontSize: 19 }} /></IconButton>
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <PrioTag p={p} />
          <Chip tint={r.env === "prod" ? "green" : "amber"}>{ENVS[r.env].label}</Chip>
          <Chip tint="slate">{KIND_LABEL[r.kind]} · {pageName(r.path)}</Chip>
          <Chip tint="slate">All devices</Chip>
          {iceScore(r) !== null && <Chip tint="blue">Impact {r.impact}/5 · Confidence {r.confidence}/5 · Effort {r.effort}/5</Chip>}
        </Box>
        <Box sx={{ borderRadius: "10px", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
          <PageShot env={r.env} path={r.path} focus={r.target ?? null} ratio={0.42} label={r.title} />
        </Box>
        <Box>
          <Section icon={<ErrorOutlineIcon />} tone="#c5221f" title="Diagnostic">{r.why || "-"}</Section>
          <Section icon={<ScienceOutlinedIcon />} tone="#2459d1" title="Suggested optimization">{r.change || "-"}</Section>
          <Section icon={<TrackChangesOutlinedIcon />} tone="#1b7a55" title="Objectives">{r.expect || "-"}</Section>
        </Box>
        {err && <Notice tone="bad">{err}</Notice>}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", pt: 0.5 }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: "1 1 200px" }}>{r.source === "ai" ? "Found by the AI" : `By ${r.createdBy ?? "–"}`} · {ago(Date.parse(r.createdAt) / 1000)} · {r.path}</Typography>
          {r.status === "proposed" && <Button disabled={!!busy} onClick={() => void decide("dropped")} sx={{ textTransform: "none", fontWeight: 600 }}>Drop</Button>}
          {r.status === "dropped" && <Button disabled={!!busy} onClick={() => void decide("proposed")} sx={{ textTransform: "none", fontWeight: 600 }}>Bring back</Button>}
          <Button variant="outlined" component={Link} href={previewHref(r.env, r.path, r.id)} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>See it on the page</Button>
          {r.status === "proposed" && (
            <Button variant="contained" disableElevation disabled={!!busy} onClick={() => void decide("approved")} startIcon={busy === "approved" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
              sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Yes, work on it</Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

export default function ConvertInsights() {
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState<Show>("decide");
  const [prio, setPrio] = useState<Priority | "all">("all");
  const [kind, setKind] = useState<PageKind | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/ideas?n=${tick}`;
  const held = useHeld<{ ideas: BoardRow[]; scans?: { day: string; pages: string[]; note: string }[] }>(url, [url]);
  const r = held.result;
  const all = r?.state === "ok" ? r.data.ideas : [];
  const lastScan = r?.state === "ok" ? (r.data.scans ?? [])[0] ?? null : null;
  const view = useMemo(() => {
    const byShow = all.filter((x) => (show === "decide" ? x.status === "proposed" : show === "approved" ? x.status === "approved" : x.status !== "dropped"));
    const kinds = (["product", "category", "cms", "home"] as PageKind[]).map((k) => ({ key: k, n: byShow.filter((x) => x.kind === k).length })).filter((k) => k.n > 0);
    const k: PageKind | "all" = kind !== "all" && kinds.some((x) => x.key === kind) ? kind : "all";
    const inKind = byShow.filter((x) => k === "all" || x.kind === k);
    const prios = (["high", "medium", "low"] as Priority[]).map((p) => ({ key: p, n: inKind.filter((x) => priorityOf(x) === p).length }));
    const pr: Priority | "all" = prio !== "all" && prios.some((x) => x.key === prio && x.n > 0) ? prio : "all";
    const rows = inKind.filter((x) => pr === "all" || priorityOf(x) === pr)
      .sort((a, b) => (iceScore(b) ?? 0) - (iceScore(a) ?? 0) || b.createdAt.localeCompare(a.createdAt));
    return {
      rows, kinds, k, prios, pr,
      counts: { decide: all.filter((x) => x.status === "proposed").length, approved: all.filter((x) => x.status === "approved").length, all: all.filter((x) => x.status !== "dropped").length },
      pages: new Set(byShow.map((x) => `${x.env}${x.path}`)).size,
    };
  }, [all, show, kind, prio]);
  const openRow = open ? all.find((x) => x.id === open) ?? null : null;

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading what the AI found…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Insights" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else {
    body = (
      <>
        <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: "flex", gap: 1.5, rowGap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <SquareChoice<Show> label="Show" value={show} onChange={setShow} options={[
              { key: "decide", label: "To decide", count: view.counts.decide }, { key: "approved", label: "In work", count: view.counts.approved }, { key: "all", label: "All", count: view.counts.all },
            ]} />
            <SquareChoice<Priority | "all"> label="Priority" value={view.pr} onChange={setPrio} options={[
              { key: "all", label: "All" }, ...view.prios.map((p) => ({ key: p.key, label: PRIO[p.key].label, count: p.n, disabled: p.n === 0 })),
            ]} />
            {view.kinds.length > 1 && (
              <SquareChoice<PageKind | "all"> label="Pages" value={view.k} onChange={setKind} options={[{ key: "all", label: "All" }, ...view.kinds.map((x) => ({ key: x.key, label: KIND_LABEL[x.key], count: x.n }))]} />
            )}
          </Box>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>
            {view.rows.length} {view.rows.length === 1 ? "optimization" : "optimizations"} on {view.pages} {view.pages === 1 ? "page" : "pages"} · the AI reads the pages losing buyers every night, 5 at a time, while fewer than 30 wait for a decision
            {" · "}{lastScan ? scanWords(lastScan) : "its first night shows here"}
          </Typography>
        </GlassCard>

        {view.rows.length === 0 && (
          <GlassCard>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{show === "decide" ? "Nothing waits for a decision." : "Nothing here yet."}</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
              The AI reads the pages losing buyers by itself every night; a page opened from <Box component={Link} href="/website/ai-personalization/problems" sx={{ color: "#2459d1", fontWeight: 600 }}>Problem pages</Box> is read at once.
            </Typography>
          </GlassCard>
        )}

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {view.rows.map((x) => {
            const p = priorityOf(x);
            return (
              <Box key={x.id} sx={{
                display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "14px", overflow: "hidden", bgcolor: "rgba(255,255,255,.92)",
                border: "1px solid rgba(21,34,58,.10)", boxShadow: "0 6px 18px rgba(21,34,58,.06)", transition: "box-shadow .15s, transform .15s",
                "&:hover": { boxShadow: "0 10px 26px rgba(21,34,58,.12)", transform: "translateY(-1px)" },
              }}>
                <Box component="button" type="button" onClick={() => setOpen(x.id)} sx={{ all: "unset", cursor: "pointer", display: "block" }}>
                  <PageShot env={x.env} path={x.path} focus={x.target ?? null} ratio={0.5} label={x.title} />
                </Box>
                <Box sx={{ p: 1.5, display: "grid", gap: 1, flex: 1, alignContent: "start", bgcolor: "rgba(36,89,209,.025)" }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                    <PrioTag p={p} />
                    {x.status !== "proposed" && <Chip tint={x.status === "approved" ? "green" : "slate"}>{x.status === "approved" ? "In work" : "Dropped"}</Chip>}
                    {x.source === "ai" && <Tooltip title="Found by the AI"><AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: "#6a46c9", ml: "auto" }} /></Tooltip>}
                  </Box>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.title}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    <Chip tint="slate">{ENVS[x.env].label} · {pageName(x.path)}</Chip>
                    <Chip tint="slate">All devices</Chip>
                  </Box>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.why}</Typography>
                  <Box sx={{ display: "flex", justifyContent: "center", mt: "auto", pt: 0.5 }}>
                    <Button variant="contained" disableElevation onClick={() => setOpen(x.id)} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Discover the optimization</Button>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        {openRow && <Discover r={openRow} onClose={() => setOpen(null)} onDone={() => setTick((n) => n + 1)} />}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Insights" subtitle="What the AI found on the shop's pages and proposes to change - each shown on its block"
        rightSlot={<Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {body}
    </Box>
  );
}
