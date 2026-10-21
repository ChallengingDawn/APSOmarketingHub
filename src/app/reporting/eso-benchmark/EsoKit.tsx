"use client";
// THE ESO REPORTS, BUILT AS DIGITAL GROWTH IS (SARCLA 21.10.2026: "proceed with the report, starting with the ESO
// reporting, to make it in the same structure as the digital growth"): one report, its pages beneath it in the side
// panel and a BUC View first; each page its title with its figures top right, a tab per breakdown with Views and
// Filters at their right end, each tab one section - its charts side by side (this year blue, last year grey), then
// all the figures in a table - and every chart with its Actions, so it can go to the ESO BUC View.
// The read is the same (esoBenchmark.ts): figures per sales rep, so the reps are the only filter - in the Filters
// window, in the address (?rep=), and kept in this browser so every page opens on the same people (SARCLA 12.10).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { Pick } from "@/app/reporting/marketing-kpis/Lead";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { combine, n0, sumPairs, useEso, type EsoBenchmark, type Pair, type RepBenchmark } from "./shared";

/* ── what a page is made of ────────────────────────────────────────────── */

/** What a chart is drawn with - on its page, and in the BUC View. */
export type EsoCtx = {
  b: EsoBenchmark;
  /** the chosen reps as one (all of ESO when none is chosen) */
  rep: RepBenchmark;
  sel: string[];
  /** "Jan–Sep 2026", "Jan–Sep 2025" - the like-for-like windows */
  cy: string; py: string;
  /** the months compared (January = 1) */
  months: number;
  /** a rep's bar picks or drops that rep - on the page only */
  onRep?: (id: string) => void;
  /** the chart's Actions tab */
  actions?: React.ReactNode;
  /** half the width in the BUC View: fewer rows a page */
  half?: boolean;
};
export type EsoChart = { title: string; draw: (c: EsoCtx) => React.ReactNode };
export type EsoTab = {
  id: string; label: string; icon: React.ReactNode; tint: Tint;
  title: (c: EsoCtx) => string; note?: (c: EsoCtx) => string;
  /** the tab's charts, keys of the page's charts without the tab ("reps", not "reps:reps") - two to a row */
  charts: string[];
  /** "All the figures, by …" */
  table?: { title: string; draw: (c: EsoCtx) => React.ReactNode };
  foot?: (c: EsoCtx) => React.ReactNode;
};
export type EsoFigure = { label: string; icon: React.ReactNode; tint: Tint; value: string; d?: { text: string; color: string } | null; sub: string };
export type EsoPageDef = {
  /** "visits" -> /reporting/eso-benchmark/visits, actions page "eso-visits" */
  slug: string; title: string; line: string; icon: React.ReactNode; tint: Tint;
  figures: (c: EsoCtx) => EsoFigure[];
  tabs: EsoTab[];
  /** every chart of the page by "<tab>:<chart>" - the page draws them, and so does the BUC View */
  charts: Record<string, EsoChart>;
  /** what the read cannot answer for this page, under it */
  gaps?: RegExp;
};

export const pageKey = (slug: string) => `eso-${slug}`;
export const pageHref = (slug: string) => `/reporting/eso-benchmark/${slug}`;

/* ── numbers ───────────────────────────────────────────────────────────── */

/** The change against last year as the figures top right show it: arrow, per cent, green when it is good. */
export const chg = (p: Pair, goodWhenUp = true) => {
  if (!p.py || !Number.isFinite(p.cy) || !Number.isFinite(p.py)) return null;
  const r = (p.cy - p.py) / Math.abs(p.py);
  return { text: `${r > 0 ? "↑" : r < 0 ? "↓" : "±"} ${Math.abs(r * 100).toFixed(1)}%`, color: Math.abs(r) < 0.005 ? MUTED : (r > 0) === goodWhenUp ? GREEN : RED };
};
/** The same in a table cell. */
export function Change({ p, goodWhenUp = true, points = false }: { p: Pair; goodWhenUp?: boolean; points?: boolean }) {
  if (points) {
    if (!Number.isFinite(p.cy) || !Number.isFinite(p.py)) return <span style={{ color: FAINT }}>—</span>;
    const d = p.cy - p.py;
    return <span style={{ color: Math.abs(d) < 0.05 ? MUTED : (d > 0) === goodWhenUp ? GREEN : RED, fontWeight: 700 }}>{Math.abs(d) < 0.05 ? "level" : `${d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)} pts`}</span>;
  }
  const c = chg(p, goodWhenUp);
  return c ? <span style={{ color: c.color, fontWeight: 700 }}>{c.text}</span> : <span style={{ color: FAINT }}>—</span>;
}
export const repPair = (reps: RepBenchmark[], f: (r: RepBenchmark) => Pair) => sumPairs(reps.map(f));
/** A breakdown kept month by month, summed over the months compared. */
export const monthsRec = (rec: Record<string, Pair[]>, months: number): Record<string, Pair> => Object.fromEntries(Object.entries(rec).map(([k, ps]) => [k, sumPairs(ps.slice(0, months))]));
/** The keys of a breakdown in a fixed order first (priority bands), then the rest, largest first. */
export const ordered = (rec: Record<string, Pair>, first: readonly string[]) => [...first.filter((k) => rec[k]), ...Object.keys(rec).filter((k) => !first.includes(k)).sort((a, b) => rec[b].cy - rec[a].cy)];

/* ── the charts ────────────────────────────────────────────────────────── */

/** A chart's frame when it is not a DimChart (months): the same glass box, title, note, Actions. */
export function ChartBox({ title, note, actions, children }: { title: string; note?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
          {note && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>{note}</Typography>}
        </Box>
        {actions}
      </Box>
      {children}
    </Box>
  );
}

/** A figure per sales rep, this year against last - every rep, the chosen ones lit; a bar picks or drops its rep. */
export function RepChart({ c, title, value, fmt = n0, single = false, curLabel, prevLabel }: {
  c: EsoCtx; title: string; value: (r: RepBenchmark) => Pair; fmt?: (n: number) => string; single?: boolean; curLabel?: string; prevLabel?: string;
}) {
  const rows = c.b.reps.map((r) => ({ label: r.name, id: r.ownerId, p: value(r) }));
  const lit = c.b.reps.filter((r) => c.sel.includes(r.ownerId)).map((r) => r.name);
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.p.cy} prev={(r) => r.p.py} curLabel={curLabel ?? c.cy} prevLabel={prevLabel ?? c.py} fmt={fmt} single={single}
      selected={lit} pageSize={c.half ? 6 : 12} actions={c.actions}
      onPick={c.onRep ? (label) => { const r = rows.find((x) => x.label === label); if (r) c.onRep!(r.id); } : undefined} />
  );
}

/** A breakdown kept as {group: Pair}, this year against last; `order` keeps a fixed order (priority, status). */
export function GroupChart({ c, title, rec, label = (k) => k, fmt = n0, order, single = false, curLabel, prevLabel }: {
  c: EsoCtx; title: string; rec: Record<string, Pair>; label?: (k: string) => string; fmt?: (n: number) => string; order?: readonly string[]; single?: boolean; curLabel?: string; prevLabel?: string;
}) {
  const keys = order ? order.filter((k) => rec[k]) : Object.keys(rec);
  const rows = keys.map((k) => ({ label: label(k), p: rec[k] }));
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.p.cy} prev={(r) => r.p.py} curLabel={curLabel ?? c.cy} prevLabel={prevLabel ?? c.py} fmt={fmt} single={single}
      fixedOrder={!!order} pageSize={c.half ? 6 : 12} actions={c.actions} />
  );
}

/** Month by month, this year against last, as columns. */
export function MonthChart({ c, title, note, pairs, fmt }: { c: EsoCtx; title: string; note?: string; pairs: Pair[]; fmt?: (n: number) => string }) {
  const L = c.b.monthLabels.slice(0, c.months);
  const f = fmt ? (x: number | null) => (x === null ? "—" : fmt(x)) : undefined;
  return (
    <ChartBox title={title} note={note} actions={c.actions}>
      <ChartFrame table={{ columns: ["Month", String(c.b.window.year), String(c.b.window.py)], rows: L.map((x, i) => [x, Math.round(pairs[i]?.cy ?? 0), Math.round(pairs[i]?.py ?? 0)]), numeric: [1, 2] }}>
        <GroupedColumns data={L.map((x, i) => ({ x, current: pairs[i]?.cy ?? 0, prior: pairs[i]?.py ?? 0 }))} currentLabel={String(c.b.window.year)} priorLabel={String(c.b.window.py)}
          height={c.half ? 220 : 260} {...(f ? { format: f } : {})} />
      </ChartFrame>
    </ChartBox>
  );
}

/** This year month by month, a part per group (priority, category, kind). */
export function StackedMonths({ c, title, note, rec, keys }: { c: EsoCtx; title: string; note?: string; rec: Record<string, Pair[]>; keys: readonly string[] }) {
  const L = c.b.monthLabels.slice(0, c.months);
  const shown = keys.filter((k) => rec[k]);
  return (
    <ChartBox title={title} note={note} actions={c.actions}>
      <ChartFrame table={{ columns: ["Month", ...shown], rows: L.map((x, i) => [x, ...shown.map((k) => rec[k]?.[i]?.cy ?? 0)]), numeric: shown.map((_, i) => i + 1) }}>
        <StackedColumns data={L.map((x, i) => ({ x, ...Object.fromEntries(shown.map((k) => [k, rec[k]?.[i]?.cy ?? 0])) }))} parts={shown.map((k) => ({ key: k, label: k }))} height={c.half ? 220 : 260} />
      </ChartFrame>
    </ChartBox>
  );
}

/* ── the tables ────────────────────────────────────────────────────────── */

export type FigRow = { label: string; p: Pair; fmt?: (n: number) => string; goodWhenUp?: boolean; points?: boolean; note?: string;
  /** no change shown: last year cannot be compared (a pipeline still filling up, a whole year against months) */
  noChange?: boolean };

/** A figure as its row writes it; "—" where there is none (a median on too few tickets, no figure last year). */
const shown = (r: FigRow, x: number) => (Number.isFinite(x) ? (r.fmt ?? n0)(x) : "—");

/** "All the figures": a row per group - this year, last year, the change. */
export function PairRows({ c, head, rows, total }: { c: EsoCtx; head: string; rows: FigRow[]; total?: FigRow }) {
  const all = total ? [...rows, total] : rows;
  return (
    <Table head={[head, c.cy, c.py, "Change"]} firstWidth="minmax(220px, 2fr)"
      rows={all.map((r, i) => ({
        key: `${r.label}-${i}`, strong: r === total,
        cells: [
          <Box key="l" sx={{ minWidth: 0 }}><Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Box>{r.note && <Box sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 500 }}>{r.note}</Box>}</Box>,
          shown(r, r.p.cy), <Box key="p" component="span" sx={{ color: MUTED }}>{shown(r, r.p.py)}</Box>, r.noChange ? <span key="d" style={{ color: FAINT }}>—</span> : <Change key="d" p={r.p} goodWhenUp={r.goodWhenUp} points={r.points} />,
        ],
      }))} />
  );
}

/** A row per sales rep: the columns asked for; a row click picks or drops the rep. */
export function RepRows({ c, head, cells, total }: { c: EsoCtx; head: string[]; cells: (r: RepBenchmark) => React.ReactNode[]; total?: React.ReactNode[] }) {
  const rows = [...c.b.reps].map((r) => ({ r, cells: cells(r) }));
  return (
    <Table head={["Sales rep", ...head]} firstWidth="minmax(170px, 1.6fr)" minWidth={190 + head.length * 104}
      rows={[
        ...rows.map(({ r, cells: x }) => ({ key: r.ownerId, cells: [r.name, ...x], on: c.sel.includes(r.ownerId), onPick: c.onRep ? () => c.onRep!(r.ownerId) : undefined })),
        ...(total ? [{ key: "total", strong: true, cells: [c.sel.length ? "The chosen reps" : "All of ESO", ...total] }] : []),
      ]} />
  );
}

/* ── the reps chosen ───────────────────────────────────────────────────── */

const KEPT = "eso.selection";
function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}

/** The chosen reps: in the address (?rep=…, so a saved view keeps them), and in this browser, so the next page opens on them. */
function useReps(b?: EsoBenchmark): [string[], (ids: string[]) => void] {
  const params = useSearchParams();
  const fromUrl = params.getAll("rep");
  // a page opened without reps in its address takes the ones chosen last
  useEffect(() => {
    if (new URLSearchParams(window.location.search).getAll("rep").length) return;
    try {
      const kept = JSON.parse(localStorage.getItem(KEPT) ?? "[]") as string[];
      if (Array.isArray(kept) && kept.length) setQuery((q) => { for (const id of kept) q.append("rep", String(id)); });
    } catch { /* a private window starts on all of ESO */ }
  }, []);
  const known = b ? fromUrl.filter((id) => b.reps.some((r) => r.ownerId === id)) : fromUrl;
  const set = (ids: string[]) => {
    setQuery((q) => { q.delete("rep"); for (const id of ids) q.append("rep", id); });
    try { localStorage.setItem(KEPT, JSON.stringify(ids)); } catch { /* still applies on this page */ }
  };
  return [known, set];
}

export function ctxOf(b: EsoBenchmark, sel: string[], extra: Partial<EsoCtx> = {}): EsoCtx {
  const last = b.monthLabels[b.revenueMonths - 1];
  return { b, rep: combine(b, sel), sel, cy: `Jan–${last} ${b.window.year}`, py: `Jan–${last} ${b.window.py}`, months: b.revenueMonths, ...extra };
}

/* ── the page ──────────────────────────────────────────────────────────── */

/** The figures top right, each in a small card (as on Digital Growth's pages). */
export function Figures({ items }: { items: EsoFigure[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(124px, 172px))` } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.value}</Typography>
            {it.d && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: it.d.color }}>{it.d.text}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export function EsoWaiting({ state }: { state: ReturnType<typeof useEso> }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {!state?.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>
          {state?.error ? `The ESO figures could not be read: ${state.error}` : `Reading HubSpot - a few minutes the first time${state?.progress ? ` · ${state.progress}` : ""}.`}
        </Typography>
      </Box>
    </GlassCard>
  );
}

/** One ESO page: title and figures, the tabs with Views and Filters, the tab's section, the Filters window. */
export function EsoExplorer({ def }: { def: EsoPageDef }) {
  const state = useEso();
  const b = state?.value;
  const params = useSearchParams();
  const [sel, setSel] = useReps(b);
  const asked = params.get("tab");
  const tab = def.tabs.find((t) => t.id === asked) ?? def.tabs[0];
  const setTab = (id: string) => setQuery((q) => { if (id === def.tabs[0].id) q.delete("tab"); else q.set("tab", id); });
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState(true);
  const selKey = sel.join(",");
  const c = useMemo(() => (b ? ctxOf(b, sel) : null), [b, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
      </Box>
      {!b || !c ? (
        <>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>{def.title}</Typography>
          <EsoWaiting state={state} />
        </>
      ) : (
        <Page def={def} c={c} tab={tab} setTab={setTab} sel={sel} setSel={setSel} panel={panel} setPanel={setPanel} open={open} setOpen={setOpen} computing={!!state?.computing} readAt={state?.computedAt ?? b.generatedAt} />
      )}
    </Box>
  );
  return body;
}

function Page({ def, c: base, tab, setTab, sel, setSel, panel, setPanel, open, setOpen, computing, readAt }: {
  def: EsoPageDef; c: EsoCtx; tab: EsoTab; setTab: (id: string) => void; sel: string[]; setSel: (ids: string[]) => void;
  panel: boolean; setPanel: (x: boolean) => void; open: boolean; setOpen: (x: boolean) => void; computing: boolean; readAt: string;
}) {
  const b = base.b;
  const flip = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const c: EsoCtx = { ...base, onRep: flip };
  const page = pageKey(def.slug);
  const names = b.reps.filter((r) => sel.includes(r.ownerId)).map((r) => r.name);
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `${page}:${tab.id}:${key}`, page, tab: tab.id, title, summary: `${c.cy} against ${c.py} · ${names.length ? names.join(", ") : "all of ESO"}`, ...(sel.length ? { filters: { rep: sel } } : {}), kind: "card" }} />
  );
  const charts = tab.charts.map((k) => ({ k, ch: def.charts[`${tab.id}:${k}`] })).filter((x) => x.ch);
  const gaps = def.gaps ? b.gaps.filter((g) => def.gaps!.test(g)) : [];
  return (
    <>
      {/* the title and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            {def.title}
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{c.cy}</b> against {c.py} · {def.line} · {names.length ? `${names.length} sales rep${names.length > 1 ? "s" : ""}` : "all of ESO"}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {names.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {b.reps.filter((r) => sel.includes(r.ownerId)).map((r) => (
                <Chip key={r.ownerId} size="small" label={<span><b>Sales rep:</b> {r.name}</span>} onDelete={() => flip(r.ownerId)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.purple.fg } }} />
              ))}
              <Button size="small" onClick={() => setSel([])} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures items={def.figures(c)} /></Box>
      </Box>

      {/* the tabs, and at their right end Views and Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name={page} tab={tab.id} onSelect={setTab} tabs={def.tabs.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page={page} /></Box>
        <Button onClick={() => setPanel(!panel)} variant={panel || sel.length ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls={`${page}-filters`} startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || sel.length ? undefined : "#fff" }}>
          Filters{sel.length ? ` · ${sel.length}` : ""}
        </Button>
      </Box>

      {/* the tab: one section - its charts side by side, then all the figures */}
      <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <CardTitle icon={tab.icon} tint={tab.tint} title={tab.title(c)} note={tab.note?.(c)} />
        {charts.length > 0 && (
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: charts.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }, mt: -1 }}>
            {charts.map(({ k, ch }, i) => (
              // the odd chart out takes the whole row
              <Box key={k} sx={{ minWidth: 0, gridColumn: { lg: charts.length % 2 === 1 && i === charts.length - 1 && charts.length > 1 ? "1 / -1" : "auto" } }}>
                {ch.draw({ ...c, actions: act(k, ch.title) })}
              </Box>
            ))}
          </Box>
        )}
        {tab.table && (
          <Box>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>{tab.table.title}</Typography>
            {tab.table.draw(c)}
          </Box>
        )}
        {tab.foot && <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>{tab.foot(c)}</Typography>}
      </GlassCard>

      <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot {new Date(readAt).toLocaleString("en-GB")} · refreshed every 12 hours · the completed months of this year against the same months of last year · customers under their current owner in both years.
        {gaps.length > 0 && <> {gaps.join(" ")}</>}
      </Typography>

      <FilterPanel id={`${page}-filters`} open={panel} onClose={() => setPanel(false)} subtitle="The sales reps - several at once; every ESO page opens on them" onClearAll={sel.length ? () => setSel([]) : undefined}>
        <FilterSection id={`${page}-f-rep`} index={0} title="Sales rep" icon={<BadgeOutlinedIcon />} tint="purple" open={open} onFlip={() => setOpen(!open)} summary={sel.length ? `${sel.length} chosen` : "All of ESO"} chosen={sel.length > 0}>
          {b.reps.map((r) => <Pick key={r.ownerId} on={sel.includes(r.ownerId)} label={r.name} onClick={() => flip(r.ownerId)} />)}
        </FilterSection>
      </FilterPanel>
    </>
  );
}
