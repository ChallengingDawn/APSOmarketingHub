"use client";
// RETAIN & GROW - EROSION AT STAKE, FROM SARCLA'S EROSION EXCEL (ErosionArticle-2021-2025-Over2-5k, February
// 2025: one line a customer x article - each year 2021-2025, the open orders, the best year, the gap). Drawn as
// the other tabs are (SARCLA 20.10.2026: "it's still horrible - learn from the other tabs"), Who are our
// customers' layout: the figures top right, a tab per breakdown - owner, country, profit centre, customer,
// article - each one card with two charts whose bars are the filter (at stake; the last 12 months against the
// best year) and all the figures in a table under them, then the list of every customer and article.
// Counted (SARCLA chose 20.10): a customer still buying an article but less than in its best year, or stopped -
// no order for 12 to 24 months; lost over 24 months, one year only and made to order (800x) are left out and
// can be added under Filters. The rules are in retainCube.ts; the read in retain.ts.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

import { Badge, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import {
  FLOOR, HEADLINE, KIND_INFO, STOPPED_MONTHS, byDim, byKind, csvOf, eroding, keyCountry, keyOwner, keyPc, matches, rowsOf, sumsOf, totalsBy,
  type Dim, type Kind, type RFilters, type RetainData, type Row, type Sums,
} from "@/lib/marketingKpis/retainCube";
import { pcLabel } from "@/lib/marketingKpis/engageCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import type { MkState } from "./data";
import { DimChart } from "./DimChart";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { Pager, n0, usePaged } from "./ExplorerKit";
import { Pick } from "./Lead";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

const eur = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const many = (n: number, one: string, more: string) => `${n0(n)} ${n === 1 ? one : more}`;
const ownerName = (d: RetainData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");
const customerName = (d: RetainData, u: string) => d.companies[u]?.n || `Customer ${u}`;
const yearsLabel = (d: RetainData) => `${d.years[0]}–${d.years[d.years.length - 1]}`;
const artText = (t: string | undefined) => (t ?? "").replace(/\s*-\s*$/, "");
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const monthLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const sameKinds = (a: Kind[], b: Kind[]) => a.length === b.length && a.every((k) => b.includes(k));
/** a read from before 20.10 has no day of the last invoice: the months come with the next read */
const hasDays = (d: RetainData) => d.lines.length === 0 || d.lines.some((l) => l.d !== undefined);
/** nothing invoiced in the last 12 months, but on order: the customer is buying now, whenever the last invoice was */
const onOrderOnly = (r: Row) => r.l <= 0 && r.o > 0;

/* ── the tabs: a breakdown each, as on Who are our customers ─────────────────── */

type DimTab = "owners" | "countries" | "pcs" | "customers" | "articles";
type Tab = DimTab | "list";
const DIMS: Record<DimTab, { dim: Dim; name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  owners: { dim: "owner", name: "Owner", lower: "owner", icon: <GroupsOutlinedIcon />, tint: "purple", note: "Whose customers buy less than they did - the customer's owner in HubSpot today" },
  countries: { dim: "country", name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "green", note: "Where the customers buying less are" },
  pcs: { dim: "pc", name: "Profit centre", lower: "profit centre", icon: <WorkspacesOutlinedIcon />, tint: "amber", note: "Which ranges they buy less of" },
  customers: { dim: "customer", name: "Customer", lower: "customer", icon: <ApartmentOutlinedIcon />, tint: "blue", note: "The customers with the most at stake" },
  articles: { dim: "article", name: "Article", lower: "article", icon: <Inventory2OutlinedIcon />, tint: "slate", note: "The articles with the most at stake" },
};
const TAB_ORDER: Tab[] = ["owners", "countries", "pcs", "customers", "articles", "list"];
const FILTER_OF: Record<Dim, keyof Filters> = { owner: "owner", country: "country", pc: "pc", customer: "customer", article: "article" };
type Filters = { owner: string[]; country: string[]; pc: string[]; customer: string[]; article: string[] };
const NO_FILTERS: Filters = { owner: [], country: [], pc: [], customer: [], article: [] };

/** A breakdown's value as read: an owner's name, a country, "DT · Sealing", a customer's name, an article. */
function labelOf(d: RetainData, dim: Dim, key: string): string {
  if (dim === "owner") return ownerName(d, key);
  if (dim === "pc") return key === "Unknown" ? "No profit centre" : pcLabel(key);
  if (dim === "customer") return customerName(d, key);
  if (dim === "article") return `${key} · ${artText(d.articles[key]?.t) || "no text"}`;
  return key;
}

/* ── the read, shared by the page and the nutshell's cards ───────────────────────── */

type Read = { d: RetainData | null; computing: boolean; progress?: string; error?: string };
const shared: { r: Read; p: Promise<void> | null; subs: Set<() => void> } = { r: { d: null, computing: true }, p: null, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/retain").then((x) => x.json())
    .then((j) => {
      const v = j?.retain?.value as RetainData | undefined;
      shared.r = { d: v ?? shared.r.d, computing: !!j?.retain?.computing || !v, progress: j?.retain?.progress, error: j?.error ?? j?.retain?.error };
    })
    .catch((e) => { shared.r = { ...shared.r, error: String((e as Error)?.message ?? e) }; })
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.r.d || shared.r.computing) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000); });
}
/** Asked again every 10 minutes while the page is open and seen (SARCLA 20.10: "cards that never refresh while left open - avoid"). */
const REASK_MS = 10 * 60 * 1000;
let reask: ReturnType<typeof setInterval> | null = null;
function useRetain(): Read {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    shared.subs.add(f);
    if (!shared.r.d) loadShared();
    reask ??= setInterval(() => { if (shared.subs.size && document.visibilityState === "visible") loadShared(); }, REASK_MS);
    return () => { shared.subs.delete(f); if (!shared.subs.size && reask) { clearInterval(reask); reask = null; } };
  }, []);
  return shared.r;
}

/* ── the figures ─────────────────────────────────────────────────────────────── */

/** The four figures top right, each in a small card - as on Who are our customers. */
function Figures({ d, f, kinds }: { d: RetainData; f: RFilters; kinds: Kind[] }) {
  const k = byKind(d, f);
  const s = sumsOf(rowsOf(d, { ...f, kinds }));
  const apart = KIND_INFO.filter((x) => !kinds.includes(x.id));
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; sub: string }[] = [
    { label: "At stake", icon: <TrendingDownOutlinedIcon />, tint: "amber", v: eur(s.gap), sub: `${many(s.customers, "customer", "customers")}, ${many(s.lines, "article", "articles")} - ${pct(s.gap / Math.max(1, s.best))} of their best year` },
    { label: "Still buying, less", icon: <TrendingDownOutlinedIcon />, tint: "blue", v: eur(k.less.gap), sub: `${n0(k.less.customers)} customers - ordered in the last 12 months` },
    { label: `Stopped 12–${STOPPED_MONTHS} months`, icon: <BlockOutlinedIcon />, tint: "pink", v: eur(k.stopped.gap), sub: `${n0(k.stopped.customers)} customers - no order since` },
    { label: "Not counted", icon: <LayersOutlinedIcon />, tint: "slate", v: eur(apart.reduce((a, x) => a + k[x.id].gap, 0)), sub: apart.length ? `${apart.map((x) => x.short.toLowerCase()).join(", ")} - Filters adds them` : "everything is counted" },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(124px, 172px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.v}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── a breakdown: two charts, then all the figures ──────────────────────────── */

type Ctx = {
  d: RetainData; f: RFilters; kinds: Kind[];
  /** the chosen values of this breakdown, and a click on a bar or a row */
  selected?: string[]; onPick?: (key: string) => void; onFilter?: () => void;
  act?: (card: string, title: string) => React.ReactNode;
};
type ChartRowR = { label: string; rev: number; key: string; sums: Sums };

/** The breakdown's rows for the charts: labelled, a name used twice told apart, the most at stake first. */
function chartRows(d: RetainData, f: RFilters, kinds: Kind[], dim: Dim): ChartRowR[] {
  const seen = new Map<string, number>();
  return byDim(d, { ...f, kinds }, dim).map(({ key, sums }) => {
    let label = cut(labelOf(d, dim, key), 30);
    const n = seen.get(label) ?? 0;
    seen.set(label, n + 1);
    if (n) label = `${cut(label, 22)} (${key})`;
    return { label, rev: sums.gap, key, sums };
  });
}

/** At stake, by the breakdown - one bar each, the largest first. */
function StakeChart({ d, f, kinds, tab, selected, onPick, onFilter, act }: Ctx & { tab: DimTab }) {
  const x = DIMS[tab];
  const rows = useMemo(() => chartRows(d, f, kinds, x.dim), [d, f, kinds, x.dim]);
  const sel = rows.filter((r) => selected?.includes(r.key)).map((r) => r.label);
  return (
    <DimChart title={`At stake, by ${x.lower}`} rows={rows} cur={(r) => r.sums.gap} prev={() => NaN} single fixedOrder pageSize={12}
      curLabel="At stake" prevLabel="" fmt={eur}
      selected={sel} onPick={(l) => { const r = rows.find((y) => y.label === l); if (r) onPick?.(r.key); }} onFilter={onFilter} filterLabel={`Filter by ${x.lower}`}
      actions={act?.("gap", `At stake, by ${x.lower}`)} />
  );
}

/** The last 12 months and what is on order, against the best year - the gap is what is at stake. */
function BestNowChart({ d, f, kinds, tab, selected, onPick, onFilter, act }: Ctx & { tab: DimTab }) {
  const x = DIMS[tab];
  const rows = useMemo(() => chartRows(d, f, kinds, x.dim), [d, f, kinds, x.dim]);
  const sel = rows.filter((r) => selected?.includes(r.key)).map((r) => r.label);
  return (
    <DimChart title={`Now against the best year, by ${x.lower}`} rows={rows} cur={(r) => r.sums.now} prev={(r) => r.sums.best} fixedOrder pageSize={12}
      curLabel="Last 12 months + on order" prevLabel={`Best year ${yearsLabel(d)}`} fmt={eur}
      selected={sel} onPick={(l) => { const r = rows.find((y) => y.label === l); if (r) onPick?.(r.key); }} onFilter={onFilter} filterLabel={`Filter by ${x.lower}`}
      actions={act?.("bestnow", `Now against the best year, by ${x.lower}`)} />
  );
}

const head = {
  fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 0.75, verticalAlign: "bottom" as const,
  maxWidth: 124, "& .MuiTableSortLabel-root": { whiteSpace: "normal", textAlign: "right" },
  "& .MuiTableSortLabel-root:not(.Mui-active) .MuiTableSortLabel-icon": { display: "none" },
};
const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 1, px: 0.75 };
const ONE_LINE = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const searchBox = { display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, width: "100%", maxWidth: 320, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" } as const;
const tableBox = { overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" } as const;

/** All the figures of a breakdown, as Who are our customers' table: sorted by any column, a click filters, a total. */
function DimFigures({ d, f, kinds, tab, selected, onPick }: Ctx & { tab: DimTab }) {
  const x = DIMS[tab];
  const rows = useMemo(() => byDim(d, { ...f, kinds }, x.dim).map((r) => ({ ...r, label: labelOf(d, x.dim, r.key) })), [d, f, kinds, x.dim]);
  type Col = { key: string; head: string; tip: string; val: (s: Sums) => number; cell: (s: Sums) => React.ReactNode };
  const cols: Col[] = [
    { key: "customers", head: "Customers", tip: "Customers with a line at stake", val: (s) => s.customers, cell: (s) => n0(s.customers) },
    { key: "lines", head: "Articles", tip: "Customer and article lines at stake", val: (s) => s.lines, cell: (s) => n0(s.lines) },
    { key: "best", head: `Best year ${yearsLabel(d)}`, tip: "Each line's best calendar year, added up", val: (s) => s.best, cell: (s) => eur(s.best) },
    { key: "now", head: "Last 12 months + on order", tip: "Invoiced in the last 12 months, and ordered but not invoiced yet", val: (s) => s.now, cell: (s) => eur(s.now) },
    { key: "gap", head: "At stake", tip: "The best year less the last 12 months and what is on order", val: (s) => s.gap, cell: (s) => <Box component="span" sx={{ fontWeight: 700 }}>{eur(s.gap)}</Box> },
    { key: "share", head: "Of the best year", tip: "At stake against the best year", val: (s) => s.gap / Math.max(1, s.best), cell: (s) => <Box component="span" sx={{ color: RED, fontWeight: 700 }}>−{pct(s.gap / Math.max(1, s.best))}</Box> },
    ...KIND_INFO.filter((k) => kinds.includes(k.id)).map((k) => ({ key: `k-${k.id}`, head: k.label, tip: k.note, val: (s: Sums) => s.byKind[k.id], cell: (s: Sums) => eur(s.byKind[k.id]) })),
  ];
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "gap", desc: true });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { setSort({ key: "gap", desc: true }); setQ(""); setOpen(false); }, [tab]);
  const col = cols.find((c) => c.key === sort.key);
  const sorted = [...rows].sort((a, b) => {
    const r = sort.key === "label" ? a.label.localeCompare(b.label) : (col ? col.val(a.sums) - col.val(b.sums) : 0);
    return sort.desc ? -r : r;
  });
  const found = q ? sorted.filter((r) => `${r.label} ${r.key}`.toLowerCase().includes(q.toLowerCase())) : sorted;
  const LIMIT = 25;
  const shown = open || q ? found : found.slice(0, LIMIT);
  const tot = sumsOf(rowsOf(d, { ...f, kinds }));
  const by = (key: string) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "label" }));
  return (
    <Box sx={{ minWidth: 0 }}>
      {rows.length > 12 && (
        <Box sx={{ ...searchBox, mb: 1 }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${/^[aeiou]/.test(x.lower) ? "an" : "a"} ${x.lower}…`} inputProps={{ "aria-label": `Find ${/^[aeiou]/.test(x.lower) ? "an" : "a"} ${x.lower}` }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
      )}
      <Box sx={tableBox}>
        <Table size="small" sx={{ minWidth: 900 }} aria-label={`At stake by ${x.lower}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...head, maxWidth: "none", minWidth: 150, pl: 1.5 }}>
                <TableSortLabel active={sort.key === "label"} direction={sort.key === "label" && sort.desc ? "desc" : "asc"} onClick={() => by("label")}>{x.name}</TableSortLabel>
              </TableCell>
              {cols.map((c) => (
                <TableCell key={c.key} align="right" sx={head} title={c.tip}>
                  <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key && !sort.desc ? "asc" : "desc"} onClick={() => by(c.key)}>{c.head}</TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((r) => {
              const on = !!selected?.includes(r.key);
              return (
                <TableRow key={r.key} hover onClick={onPick ? () => onPick(r.key) : undefined} selected={on} aria-selected={on}
                  sx={{ cursor: onPick ? "pointer" : "default", opacity: selected?.length && !on ? 0.5 : 1, "&.Mui-selected, &.Mui-selected:hover": { bgcolor: TINT[x.tint].bg } }}>
                  <TableCell sx={{ ...body, fontWeight: 600, whiteSpace: "normal", maxWidth: x.dim === "article" || x.dim === "customer" ? 320 : 220, pl: 1.5 }} title={x.dim === "customer" ? r.key : undefined}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>{on && <CheckIcon sx={{ fontSize: 16, color: TINT[x.tint].fg }} />}{r.label}</Box>
                  </TableCell>
                  {cols.map((c) => <TableCell key={c.key} align="right" sx={body}>{c.cell(r.sums)}</TableCell>)}
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell sx={{ ...body, fontWeight: 800, borderBottom: 0, pl: 1.5 }}>Total</TableCell>
              {cols.map((c) => <TableCell key={c.key} align="right" sx={{ ...body, fontWeight: 800, borderBottom: 0 }}>{c.cell(tot)}</TableCell>)}
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      {!q && found.length > LIMIT && (
        <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ textTransform: "none", fontWeight: 600, mt: 0.75 }}>
          {open ? "Show the first 25" : `Show all ${n0(found.length)}`}
        </Button>
      )}
    </Box>
  );
}

/** A breakdown's tab: one card - the two charts, then all the figures. */
function DimSection(c: Ctx & { tab: DimTab }) {
  const x = DIMS[c.tab];
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={x.icon} tint={x.tint} title={`Erosion by ${x.lower}`} note={x.note} />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>
        <StakeChart {...c} />
        <BestNowChart {...c} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by {x.lower}</Typography>
        <DimFigures {...c} />
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        A line is a customer and an article whose best year {yearsLabel(c.d)} reached €{FLOOR.toLocaleString("en")}. At stake = the best year less the last 12 months and what is on order.
        Still buying, less: invoiced in the last 12 months or on order. Stopped: no invoice for 12 to {STOPPED_MONTHS} months and nothing on order.
      </Typography>
    </GlassCard>
  );
}

/* ── the list: every customer and article ────────────────────────────────────── */

type ListKey = "customer" | "best" | "last" | "now" | "gap" | "months";
function ListSection({ d, f, kinds, q, setQ }: Ctx & { q: string; setQ: (q: string) => void }) {
  const [sort, setSort] = useState<{ key: ListKey; desc: boolean }>({ key: "gap", desc: true });
  const last = d.years.length - 1;
  const val = (r: Row, k: ListKey): number | string =>
    k === "customer" ? customerName(d, r.u).toLowerCase() : k === "best" ? r.best : k === "last" ? r.y[last] : k === "now" ? r.now : k === "gap" ? r.gap : onOrderOnly(r) ? 0 : r.months ?? -1;
  const rows = useMemo(() => {
    const rs = rowsOf(d, { ...f, kinds }).filter((r) => matches(d, r, q));
    return rs.sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); const c = x < y ? -1 : x > y ? 1 : b.gap - a.gap; return sort.desc && x !== y ? -c : c; });
  }, [d, f, kinds, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(rows, 25);
  const sig = `${kinds.join()}|${q}|${sort.key}|${sort.desc}|${JSON.stringify(f)}`;
  useEffect(() => { paged.setPage(0); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = sumsOf(rows);
  const by = (key: ListKey) => setSort((x) => (x.key === key ? { key, desc: !x.desc } : { key, desc: key !== "customer" }));
  const download = () => {
    const blob = new Blob(["﻿" + csvOf(d, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `erosion-list-${d.asOf}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const sortHead = (k: ListKey, label: string, tip: string) => (
    <TableCell align={k === "customer" ? "left" : "right"} sx={{ ...head, ...(k === "customer" ? { maxWidth: "none", pl: 1.5 } : {}) }} title={tip}>
      <TableSortLabel active={sort.key === k} direction={sort.key === k && !sort.desc ? "asc" : "desc"} onClick={() => by(k)}>{label}</TableSortLabel>
    </TableCell>
  );
  const lastInvoice = (r: Row) => (onOrderOnly(r) ? "On order now" : r.months == null ? (r.lastYear ? `In ${r.lastYear}` : "—") : r.months === 0 ? "This month" : `${r.months} month${r.months === 1 ? "" : "s"} ago`);
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<TableRowsOutlinedIcon />} tint="blue" title="Every customer and article" note={`One line a customer and an article whose best year ${yearsLabel(d)} reached €${FLOOR.toLocaleString("en")} - the erosion Excel's list`} />
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mt: -1 }}>
        <Box sx={searchBox}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a customer or an article…" inputProps={{ "aria-label": "Search the list" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{many(rows.length, "line", "lines")} · {many(s.customers, "customer", "customers")} · {eur(s.gap)} at stake</Typography>
        <Box sx={{ flex: 1 }} />
        <Button onClick={download} disabled={!rows.length} startIcon={<FileDownloadOutlinedIcon />} variant="outlined"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", height: 38, bgcolor: "#fff", whiteSpace: "nowrap" }}>
          Download for Excel
        </Button>
      </Box>
      <Box sx={tableBox}>
        <Table size="small" sx={{ minWidth: 1080 }} aria-label="Every customer and article">
          <TableHead>
            <TableRow>
              {sortHead("customer", "Customer", "The customer, its number and owner")}
              <TableCell sx={{ ...head, maxWidth: "none" }}>Article</TableCell>
              {sortHead("best", "Best year", `The line's best calendar year ${yearsLabel(d)}`)}
              {sortHead("last", String(d.years[last]), `Invoiced in ${d.years[last]}`)}
              {sortHead("now", "Last 12 months + on order", "Invoiced in the last 12 months, and ordered but not invoiced yet")}
              {sortHead("gap", "At stake", "The best year less the last 12 months and what is on order")}
              {sortHead("months", "Last invoice", "The last time the article was invoiced to the customer")}
              <TableCell sx={{ ...head, maxWidth: "none" }}>Counted as</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.shown.map((r) => {
              const c = d.companies[r.u], art = d.articles[r.a];
              return (
                <TableRow key={`${r.u}|${r.a}`} hover>
                  <TableCell sx={{ ...body, maxWidth: 240, pl: 1.5 }}>
                    <Box sx={{ fontWeight: 600, ...ONE_LINE }} title={customerName(d, r.u)}>
                      {c?.id ? <Box component="a" href={HS_COMPANY(c.id)} target="_blank" rel="noreferrer" sx={{ color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{customerName(d, r.u)}</Box> : customerName(d, r.u)}
                    </Box>
                    <Box sx={{ fontSize: "0.74rem", color: FAINT, ...ONE_LINE }}>{r.u} · {ownerName(d, c?.o ?? "")}</Box>
                  </TableCell>
                  <TableCell sx={{ ...body, maxWidth: 300 }}>
                    <Box sx={{ fontWeight: 600, ...ONE_LINE }} title={artText(art?.t)}>{artText(art?.t) || "—"}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: FAINT }}>{r.a}{art?.p ? ` · ${art.p}` : ""}</Box>
                  </TableCell>
                  <TableCell align="right" sx={body}>{eur(r.best)} <Box component="span" sx={{ color: FAINT, fontSize: "0.76rem" }}>{r.bestYear}</Box></TableCell>
                  <TableCell align="right" sx={body}>{r.y[last] > 0 ? eur(r.y[last]) : <Box component="span" sx={{ color: FAINT }}>—</Box>}</TableCell>
                  <TableCell align="right" sx={body}>{r.now > 0 ? eur(r.now) : <Box component="span" sx={{ color: FAINT }}>—</Box>}</TableCell>
                  <TableCell align="right" sx={{ ...body, fontWeight: 700 }}>{eur(r.gap)}</TableCell>
                  <TableCell align="right" sx={body} title={r.d ? `Last invoiced ${r.d}` : undefined}>
                    {lastInvoice(r)}{r.d && !onOrderOnly(r) ? <Box component="span" sx={{ color: FAINT, fontSize: "0.76rem" }}> · {monthLabel(r.d)}</Box> : null}
                  </TableCell>
                  <TableCell sx={{ ...body, color: MUTED }}>{KIND_INFO.find((k) => k.id === r.kind)!.short}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {!rows.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No line for this choice{q ? ` and "${q}"` : ""}.</Typography>}
      <Pager p={paged} />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Last invoice: the last time the article was invoiced to the customer; a line on order but not invoiced lately is buying now. The download has every line of this choice, with each of the five years, as the Excel.
        {!hasDays(d) && <Box component="span" sx={{ color: "#a86a00" }}> The months since the last invoice come with the next read of the orders (a quarter of an hour) - until then a line shows its last year, and stopped means bought in {d.years[d.years.length - 2]} or {d.years[d.years.length - 1]}.</Box>}
      </Typography>
    </GlassCard>
  );
}

/* ── the nutshell ─────────────────────────────────────────────────────────────── */

/** The card the nutshell's Retain & grow panel starts with (demotable). */
export const RETAIN_NUTSHELL_CARDS = [{ key: "retain:owners:gap", title: "At stake, by owner" }];

/** A Retain & grow chart promoted to the nutshell - the same chart as on its tab, with its filters. */
export function RetainPromoted({ spec, actions, half }: { spec: TileSpec; actions: React.ReactNode; half?: boolean }) {
  void half;
  const r = useRetain();
  const [, tab, card] = spec.key.split(":");
  const known = tab in DIMS && (card === "gap" || card === "bestnow");
  if (!r.d || !known) {
    return <GlassCard><CardTitle icon={<TrendingDownOutlinedIcon />} tint="amber" title={spec.title} note={r.d ? "This card is no longer on its page - Actions takes it off here." : "Reading the orders…"} right={actions} /></GlassCard>;
  }
  const ff = spec.filters ?? {};
  const kinds = (ff.kind?.length ? ff.kind : HEADLINE) as Kind[];
  const c = { d: r.d, f: { owner: ff.owner, country: ff.country, pc: ff.pc, customer: ff.customer, article: ff.article }, kinds, tab: tab as DimTab, act: () => actions };
  return card === "gap" ? <StakeChart {...c} /> : <BestNowChart {...c} />;
}

/* ── the page ─────────────────────────────────────────────────────────────────── */

export function RetainExplorer({ state }: { state: MkState | null }) {
  void state;
  const params = useSearchParams();
  const r = useRetain();
  const d = r.d;
  const [tab, setTab] = useState<Tab>(() => { const t = params.get("tab") as Tab | null; return t && TAB_ORDER.includes(t) ? t : "owners"; });
  const [filters, setFilters] = useState<Filters>(() => ({ owner: params.getAll("owner"), country: params.getAll("country"), pc: params.getAll("pc"), customer: params.getAll("customer"), article: params.getAll("article") }));
  const [kinds, setKinds] = useState<Kind[]>(() => { const k = params.getAll("kind").filter((x) => KIND_INFO.some((i) => i.id === x)) as Kind[]; return k.length ? k : HEADLINE; });
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const u = new URLSearchParams();
    if (tab !== "owners") u.set("tab", tab);
    for (const [k, xs] of Object.entries(filters)) for (const x of xs) u.append(k, x);
    if (!sameKinds(kinds, HEADLINE)) for (const k of kinds) u.append("kind", k);
    if (q.trim() && tab === "list") u.set("q", q.trim());
    const s = u.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, filters, kinds, q]);

  const f: RFilters = useMemo(() => ({ ...filters }), [filters]);
  const toggle = (k: keyof Filters, v: string) => setFilters((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const flipKind = (k: Kind) => setKinds((xs) => { const next = xs.includes(k) ? xs.filter((y) => y !== k) : [...xs, k]; return next.length ? next : HEADLINE; });
  const options = useMemo(() => {
    if (!d) return null;
    const all = eroding(d, {});
    return { owners: totalsBy(all, keyOwner(d)).map(([k]) => k), countries: totalsBy(all, keyCountry(d)).map(([k]) => k), pcs: totalsBy(all, keyPc(d)).map(([k]) => k) };
  }, [d]);
  const chosen = Object.values(filters).reduce((a, xs) => a + xs.length, 0);
  const kindsChanged = !sameKinds(kinds, HEADLINE);
  const specFilters = Object.fromEntries([...Object.entries(filters), ["kind", kindsChanged ? kinds : []]].filter(([, xs]) => (xs as string[]).length)) as Record<string, string[]>;
  const openOn = (section: string) => { setOpen((o) => ({ ...o, [section]: true })); setPanel(true); };

  if (!d || !options) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!r.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: r.error ? RED : MUTED }}>{r.error ? `Could not load: ${r.error}` : `Reading the orders since ${new Date().getFullYear() - 5}… a quarter of an hour the first time${r.progress ? ` · ${r.progress}` : ""}`}</Typography>
      </Box></GlassCard>
    );
  }
  const k = byKind(d, f);
  const dimCtx = (t: DimTab): Ctx & { tab: DimTab } => {
    const key = FILTER_OF[DIMS[t].dim];
    const section = { owner: "owner", country: "country", pc: "pc" }[key as "owner" | "country" | "pc"];
    return {
      d, f, kinds, tab: t, selected: filters[key], onPick: (v) => toggle(key, v), onFilter: section ? () => openOn(section) : undefined,
      act: (card, title) => (
        <TileActions where="tab" start={RETAIN_NUTSHELL_CARDS.some((x) => x.key === `retain:${t}:${card}`) ? "nutshell" : "tab"}
          tile={{ key: `retain:${t}:${card}`, page: "retain", tab: t, title, filters: specFilters, kind: "card" }} />
      ),
    };
  };
  const chip = (key: keyof Filters, label: string, tint: Tint) => filters[key].map((v) => (
    <Chip key={`${key}-${v}`} size="small" label={<span><b>{label}:</b> {cut(labelOf(d, key === "customer" ? "customer" : key === "article" ? "article" : key, v), 40)}</span>}
      onDelete={() => toggle(key, v)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[tint].bg }} />
  ));

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Retain &amp; grow
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>The last 12 months</b> against each customer&apos;s best year {yearsLabel(d)}, per article · read {new Date(d.asOf).toLocaleDateString("en-GB")}{r.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {(chosen > 0 || kindsChanged) && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {chip("owner", "Owner", "purple")}{chip("country", "Country", "green")}{chip("pc", "Profit centre", "amber")}{chip("customer", "Customer", "blue")}{chip("article", "Article", "slate")}
              {kindsChanged && <Chip size="small" label={<span><b>Counted:</b> {kinds.map((x) => KIND_INFO.find((i) => i.id === x)!.short.toLowerCase()).join(", ")}</span>} onDelete={() => setKinds(HEADLINE)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.slate.bg }} />}
              <Button size="small" onClick={() => { setFilters(NO_FILTERS); setKinds(HEADLINE); }} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures d={d} f={f} kinds={kinds} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="retain" tab={tab} onSelect={setTab}
            tabs={TAB_ORDER.map((t) => ({ id: t, label: t === "list" ? "The list" : DIMS[t].name, count: t === "list" ? null : filters[FILTER_OF[DIMS[t].dim]].length ? String(filters[FILTER_OF[DIMS[t].dim]].length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="retain" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosen || kindsChanged ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="retain-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen || kindsChanged ? undefined : "#fff" }}>
          Filters{chosen + (kindsChanged ? 1 : 0) ? ` · ${chosen + (kindsChanged ? 1 : 0)}` : ""}
        </Button>
      </Box>

      <Box role="tabpanel" id={`retain-panel-${tab}`} aria-labelledby={`retain-tab-${tab}`} sx={{ minWidth: 0 }}>
        {tab === "list" ? <ListSection d={d} f={f} kinds={kinds} q={q} setQ={setQ} /> : <DimSection {...dimCtx(tab)} />}
      </Box>

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - {n0(d.orders)} order documents since January {d.years[0]}{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 24 hours. Money is what was invoiced (the order as placed and its invoiced deliveries are never both counted); credit notes are left out; a line&apos;s year is its invoice&apos;s. On order: ordered and not invoiced yet, for orders of the last two years. {n0(d.noCustomer)} documents without a customer number (web orders the ERP has not numbered yet) are not in it.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="retain-filters" open={panel} onClose={() => setPanel(false)} subtitle="What is counted, the owner, the country, the profit centre" onClearAll={chosen || kindsChanged ? () => { setFilters(NO_FILTERS); setKinds(HEADLINE); } : undefined}>
        <FilterSection id="rt-f-kind" index={0} title="What is counted" icon={<LayersOutlinedIcon />} tint="slate" open={!!open.kind} onFlip={() => setOpen((o) => ({ ...o, kind: !o.kind }))} summary={kindsChanged ? `${kinds.length} of ${KIND_INFO.length}` : "Buying less, stopped"} chosen={kindsChanged}>
          {KIND_INFO.map((x) => <Pick key={x.id} on={kinds.includes(x.id)} label={`${x.label} - ${eur(k[x.id].gap)}`} note={x.note} onClick={() => flipKind(x.id)} />)}
        </FilterSection>
        <FilterSection id="rt-f-owner" index={1} title="Owner" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.owner} onFlip={() => setOpen((o) => ({ ...o, owner: !o.owner }))} summary={filters.owner.length ? `${filters.owner.length} chosen` : "All"} chosen={filters.owner.length > 0}>
          {options.owners.map((o) => <Pick key={o || "none"} on={filters.owner.includes(o)} label={ownerName(d, o)} onClick={() => toggle("owner", o)} />)}
        </FilterSection>
        <FilterSection id="rt-f-country" index={2} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={filters.country.length ? `${filters.country.length} chosen` : "All"} chosen={filters.country.length > 0}>
          {options.countries.map((c) => <Pick key={c} on={filters.country.includes(c)} label={c} onClick={() => toggle("country", c)} />)}
        </FilterSection>
        <FilterSection id="rt-f-pc" index={3} title="Profit centre" icon={<WorkspacesOutlinedIcon />} tint="amber" open={!!open.pc} onFlip={() => setOpen((o) => ({ ...o, pc: !o.pc }))} summary={filters.pc.length ? filters.pc.join(", ") : "All"} chosen={filters.pc.length > 0}>
          {options.pcs.map((p) => <Pick key={p} on={filters.pc.includes(p)} label={labelOf(d, "pc", p)} onClick={() => toggle("pc", p)} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}
