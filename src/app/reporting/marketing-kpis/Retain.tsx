"use client";
// RETAIN & GROW - EROSION AT STAKE, FROM SARCLA'S EROSION EXCEL (ErosionArticle-2021-2025-Over2-5k, February
// 2025: one line a customer x article - each year 2021-2025, the open orders, the best year, the gap; then
// Resp. action, Action, Result, Comment). Reworked twice on 20.10.2026 ("the graphs are bad on the design and
// the logic"; then "stopped recently - put the number of months", "the table on a new tab, better than the
// Excel list", and the erosion tickets out: "here you are only measuring the erosion articles"). Two tabs:
//   Overview   what is at stake: still buying less, or stopped - no order for 12 to 24 months - per owner in one
//              split graph (a click opens the owner's lines in the list); lost over 24 months, one year only and
//              made to order (800x) shown apart, each able to join
//   The list   one line a customer x article, as the Excel's but readable: the five years shaded against the
//              best one, the last 12 months and what is on order, what is at stake, the months since the last
//              invoice and the status - searched, sorted, a page at a time, downloadable for Excel
// The rules are in retainCube.ts; the read in retain.ts.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import TuneIcon from "@mui/icons-material/Tune";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

import { Badge, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import {
  FLOOR, HEADLINE, KIND_INFO, STOPPED_MONTHS, byKind, byOwner, csvOf, eroding, keyCountry, keyOwner, keyPc, matches, rowsOf, sumsOf, totalsBy,
  type Kind, type RFilters, type RetainData, type Row,
} from "@/lib/marketingKpis/retainCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import type { MkState } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { Pager, n0, usePaged } from "./ExplorerKit";
import { Pick } from "./Lead";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

const eur = (n: number | null | undefined) => (n == null ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const ownerName = (d: RetainData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");
const customerName = (d: RetainData, u: string) => d.companies[u]?.n || `Customer ${u}`;
const yearsLabel = (d: RetainData) => `${d.years[0]}–${d.years[d.years.length - 1]}`;
const artText = (t: string | undefined) => (t ?? "").replace(/\s*-\s*$/, "");
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const monthLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const KIND_COLOUR: Record<Kind, string> = { less: SERIES[0], stopped: SERIES[1], gone: "#8f9bab", oneoff: "#c4cbd5", made: DEEMPHASIS };
const sameKinds = (a: Kind[], b: Kind[]) => a.length === b.length && a.every((k) => b.includes(k));
/** a read from before 20.10 has no day of the last invoice: the months come with the next read */
const hasDays = (d: RetainData) => d.lines.length === 0 || d.lines.some((l) => l.d !== undefined);

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

/* ── the cards ───────────────────────────────────────────────────────────────── */

type Ctx = {
  d: RetainData; f: RFilters; kinds: Kind[]; right?: React.ReactNode;
  /** at half width in the nutshell: the compact form */
  half?: boolean;
  onOwner?: (o: string) => void; onKind?: (k: Kind) => void;
};

/** The figures top right: what is at stake, and its two parts. */
function Figures({ d, f }: { d: RetainData; f: RFilters }) {
  const k = byKind(d, f);
  const head = sumsOf(rowsOf(d, { ...f, kinds: HEADLINE }));
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; sub: string }[] = [
    { label: "At stake", icon: <TrendingDownOutlinedIcon />, tint: "amber", v: eur(head.gap), sub: `${n0(head.customers)} customers, ${n0(head.lines)} articles` },
    { label: "Still buying, less", icon: <TrendingDownOutlinedIcon />, tint: "blue", v: eur(k.less.gap), sub: `${n0(k.less.customers)} customers - ordered in the last 12 months, below the best year` },
    { label: `Stopped 12–${STOPPED_MONTHS} months`, icon: <BlockOutlinedIcon />, tint: "pink", v: eur(k.stopped.gap), sub: `${n0(k.stopped.customers)} customers - no order for 12 to ${STOPPED_MONTHS} months` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(3, minmax(150px, 210px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.v}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const legend = (kinds: Kind[]) => (
  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
    {KIND_INFO.filter((k) => kinds.includes(k.id)).map((k) => (
      <Box key={k.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: MUTED }}><Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: KIND_COLOUR[k.id] }} />{k.label}</Box>
    ))}
  </Box>
);

/** The one graph: at stake per owner, split by kind - still buying less, stopped 12-24 months (and any kind added). */
function OwnerSplitCard({ d, f, kinds, right, half, onOwner }: Ctx) {
  const owners = byOwner(d, { ...f, kinds });
  const paged = usePaged(owners, half ? 6 : 12);
  const max = Math.max(1, ...owners.map((o) => o.sums.gap));
  const shown = KIND_INFO.filter((k) => kinds.includes(k.id));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="At stake by owner"
        note={`What each owner's customers buy below their best year ${yearsLabel(d)} - the customer's owner in HubSpot today${onOwner ? " · click an owner to see its lines in the list" : ""}`} right={right} />
      {legend(kinds)}
      <Box sx={{ display: "grid", gridTemplateColumns: half ? "minmax(100px, 1fr) minmax(80px, 1.6fr) 96px" : "minmax(160px, 1fr) minmax(200px, 3fr) 110px 120px", columnGap: 1.25, rowGap: 0.75, alignItems: "center" }}>
        {paged.shown.map((o) => (
          <Box key={o.owner || "none"} role={onOwner ? "button" : undefined} tabIndex={onOwner ? 0 : undefined} onClick={onOwner ? () => onOwner(o.owner) : undefined}
            onKeyDown={onOwner ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOwner(o.owner); } } : undefined}
            sx={{ display: "contents", cursor: onOwner ? "pointer" : "default", "&:hover > *": onOwner ? { color: TINT.blue.fg } : {} }}>
            <Typography noWrap title={ownerName(d, o.owner)} sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{ownerName(d, o.owner)}</Typography>
            <Box role="img" aria-label={`${ownerName(d, o.owner)}: ${shown.map((k) => `${k.label} ${eur(o.sums.byKind[k.id])}`).join(", ")}`}
              sx={{ display: "flex", height: 18, width: `${Math.max(1, (100 * o.sums.gap) / max)}%`, borderRadius: "4px", overflow: "hidden", gap: "2px" }}>
              {shown.filter((k) => o.sums.byKind[k.id] > 0).map((k) => <Box key={k.id} title={`${k.label}: ${eur(o.sums.byKind[k.id])}`} sx={{ flex: `${o.sums.byKind[k.id]} 0 0`, bgcolor: KIND_COLOUR[k.id] }} />)}
            </Box>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(o.sums.gap)}</Typography>
            {!half && <Typography sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "right" }}>{n0(o.sums.customers)} customers</Typography>}
          </Box>
        ))}
      </Box>
      {!owners.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing at stake for this choice.</Typography>}
      <Pager p={paged} />
    </GlassCard>
  );
}

/** What is not in the headline: lost over 24 months, one year only, made to order - each can join the list. */
function ApartCard({ d, f, kinds, right, onKind }: Ctx) {
  const k = byKind(d, f);
  const apart = KIND_INFO.filter((x) => !HEADLINE.includes(x.id));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="slate" title="Not in the headline - shown apart" note="Below their best year, but not a customer buying less now or stopped lately: lost years ago, one order, or a project" right={right} />
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" } }}>
        {apart.map((x) => {
          const on = kinds.includes(x.id);
          return (
            <Box key={x.id} sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, borderRadius: "14px", p: 1.5, display: "grid", gap: 0.5, bgcolor: on ? TINT.blue.bg : "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: KIND_COLOUR[x.id] }} />
                <Typography sx={{ flex: 1, fontSize: "0.88rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{eur(k[x.id].gap)}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{n0(k[x.id].customers)} customers, {n0(k[x.id].lines)} articles - {x.note}</Typography>
              {onKind && <Box><Button size="small" onClick={() => onKind(x.id)} sx={{ textTransform: "none", fontWeight: 700, px: 0 }}>{on ? "In the list and the graph - take out" : "Add to the list and the graph"}</Button></Box>}
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

/* ── the list ────────────────────────────────────────────────────────────────── */

/** nothing invoiced in the last 12 months, but on order: the customer is buying now, whenever the last invoice was */
const onOrderOnly = (r: Row) => r.l <= 0 && r.o > 0;
type SortKey = "gap" | "months" | "best" | "now" | "customer" | "y0" | "y1" | "y2" | "y3" | "y4";
type Sort = { k: SortKey; desc: boolean };
const sortValue = (d: RetainData, r: Row, k: SortKey): number | string =>
  k === "gap" ? r.gap : k === "months" ? (onOrderOnly(r) ? 0 : r.months ?? -1) : k === "best" ? r.best : k === "now" ? r.now : k === "customer" ? customerName(d, r.u).toLowerCase() : r.y[Number(k.slice(1))] ?? 0;

/** A year's figure, shaded against the line's best year (outlined) - the shape of the line at a glance. */
function YearCell({ v, best, isBest }: { v: number; best: number; isBest: boolean }) {
  const share = best > 0 ? Math.max(0, Math.min(1, v / best)) : 0;
  return (
    <Box role="cell" sx={{ px: 0.5, py: 0.6, display: "flex", alignItems: "center", borderBottom: `1px solid ${HAIRLINE}` }}>
      <Box title={v > 0 ? `${eur(v)} - ${Math.round(share * 100)}% of the best year` : "Nothing invoiced"}
        sx={{ width: "100%", textAlign: "right", px: 0.75, py: 0.45, borderRadius: "7px", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
          bgcolor: v > 0 ? `rgba(45, 111, 168, ${(0.07 + 0.36 * share).toFixed(3)})` : "transparent",
          color: v > 0 ? INK : FAINT, fontWeight: isBest ? 800 : 500, outline: isBest ? `1.5px solid ${SERIES[0]}` : "none", outlineOffset: "-1.5px" }}>
        {v > 0 ? eur(v) : "—"}
      </Box>
    </Box>
  );
}

function ListCard({ d, f, kinds, onKind, q, setQ, sort, setSort, right }: Ctx & { q: string; setQ: (q: string) => void; sort: Sort; setSort: (s: Sort) => void }) {
  const k = byKind(d, f);
  const rows = useMemo(() => {
    const rs = rowsOf(d, { ...f, kinds }).filter((r) => matches(d, r, q));
    const dir = sort.desc ? -1 : 1;
    return rs.sort((a, b) => { const x = sortValue(d, a, sort.k), y = sortValue(d, b, sort.k); return x === y ? b.gap - a.gap : (x < y ? -1 : 1) * dir; });
  }, [d, f, kinds, q, sort]);
  const sums = sumsOf(rows);
  const paged = usePaged(rows, 25);
  const sig = `${kinds.join()}|${q}|${sort.k}|${sort.desc}|${(f.owner ?? []).join()}|${(f.country ?? []).join()}|${(f.pc ?? []).join()}`;
  useEffect(() => { paged.setPage(0); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = hasDays(d);
  const download = () => {
    const blob = new Blob(["﻿" + csvOf(d, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `erosion-list-${d.asOf}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const cols = "minmax(170px, 1.4fr) minmax(170px, 1.4fr) repeat(5, 84px) 126px 104px 164px";
  const head: { label: string; k?: SortKey; right?: boolean }[] = [
    { label: "Customer", k: "customer" }, { label: "Article" },
    ...d.years.map((y, i) => ({ label: String(y), k: `y${i}` as SortKey, right: true })),
    { label: "Last 12 months", k: "now", right: true }, { label: "At stake", k: "gap", right: true }, { label: "Last invoice", k: "months" },
  ];
  const cell = { px: 0.75, py: 0.6, borderBottom: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, fontSize: "0.82rem", color: INK, fontVariantNumeric: "tabular-nums" } as const;
  const sub = { fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } as const;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start", minWidth: 0 }}>
      <CardTitle icon={<TableRowsOutlinedIcon />} tint="blue" title="Customer × article - the erosion list"
        note={`One line a customer and an article whose best year ${yearsLabel(d)} reached €${FLOOR.toLocaleString("en")} · each year shaded against the line's best one (outlined)`} right={right} />

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, number, article…" inputProps={{ "aria-label": "Search the list" }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MUTED }} /></InputAdornment> }}
          sx={{ width: { xs: "100%", sm: 260 }, "& .MuiOutlinedInput-root": { borderRadius: "11px", bgcolor: "#fff", fontSize: "0.86rem" } }} />
        {KIND_INFO.map((x) => {
          const on = kinds.includes(x.id);
          return (
            <Chip key={x.id} size="small" onClick={onKind ? () => onKind(x.id) : undefined} title={x.note} variant={on ? "filled" : "outlined"} aria-pressed={on}
              label={<span>{x.label} <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}>{eur(k[x.id].gap)}</Box></span>}
              icon={<Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: KIND_COLOUR[x.id], ml: "8px !important" }} />}
              sx={{ height: 30, fontSize: "0.78rem", fontWeight: 700, bgcolor: on ? TINT.blue.bg : "#fff", color: INK }} />
          );
        })}
        <Box sx={{ flex: 1 }} />
        <Button onClick={download} disabled={!rows.length} startIcon={<FileDownloadOutlinedIcon />} variant="outlined"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "11px", height: 38, bgcolor: "#fff", whiteSpace: "nowrap" }}>
          Download for Excel
        </Button>
      </Box>

      <Typography sx={{ fontSize: "0.86rem", color: INK }}>
        <b>{n0(rows.length)}</b> lines · <b>{n0(sums.customers)}</b> customers · <Box component="b" sx={{ color: RED }}>{eur(sums.gap)}</Box> at stake
        <Box component="span" sx={{ color: MUTED }}> of {eur(sums.best)} in their best years</Box>
      </Typography>

      <Box sx={{ overflowX: "auto", mx: -0.5 }}>
        <Box role="table" aria-label="The erosion list" sx={{ minWidth: 1150, display: "grid", gridTemplateColumns: cols, px: 0.5 }}>
          <Box role="row" sx={{ display: "contents" }}>
            {head.map((h, i) => {
              const on = !!h.k && sort.k === h.k;
              return (
                <Box key={i} role="columnheader" aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined}
                  onClick={h.k ? () => setSort(on ? { k: h.k!, desc: !sort.desc } : { k: h.k!, desc: h.k !== "customer" }) : undefined}
                  sx={{ px: 0.75, pb: 0.75, display: "flex", alignItems: "flex-end", justifyContent: h.right ? "flex-end" : "flex-start", gap: 0.25, borderBottom: `1px solid ${HAIRLINE}`,
                    fontSize: "0.7rem", fontWeight: 700, color: on ? INK : FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h.right ? "right" : "left",
                    cursor: h.k ? "pointer" : "default", userSelect: "none", "&:hover": h.k ? { color: INK } : {} }}>
                  {h.label}{on && (sort.desc ? <ArrowDownwardIcon sx={{ fontSize: 13 }} /> : <ArrowUpwardIcon sx={{ fontSize: 13 }} />)}
                </Box>
              );
            })}
          </Box>
          {paged.shown.map((r) => {
            const c = d.companies[r.u], art = d.articles[r.a];
            const bestIdx = r.y.indexOf(r.best);
            return (
              <Box key={`${r.u}|${r.a}`} role="row" sx={{ display: "contents", "&:hover > *": { bgcolor: "#f6f9fd" } }}>
                <Box role="cell" sx={cell}>
                  <Box component="span" sx={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={customerName(d, r.u)}>
                    {c?.id ? <Box component="a" href={HS_COMPANY(c.id)} target="_blank" rel="noreferrer" sx={{ color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{customerName(d, r.u)}</Box> : customerName(d, r.u)}
                  </Box>
                  <Box component="span" sx={sub} title={`${r.u} · ${c?.k ?? "Unknown"} · ${ownerName(d, c?.o ?? "")}`}>{r.u} · {c?.k ?? "Unknown"} · {ownerName(d, c?.o ?? "")}</Box>
                </Box>
                <Box role="cell" sx={cell}>
                  <Box component="span" sx={{ fontWeight: 650 }}>{r.a}{art?.p ? <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {art.p}</Box> : null}</Box>
                  <Box component="span" sx={sub} title={artText(art?.t)}>{artText(art?.t) || "—"}</Box>
                </Box>
                {r.y.map((v, i) => <YearCell key={i} v={v} best={r.best} isBest={i === bestIdx} />)}
                <Box role="cell" sx={{ ...cell, alignItems: "flex-end" }}>
                  <span>{r.l > 0 ? eur(r.l) : <Box component="span" sx={{ color: FAINT }}>€0</Box>}</span>
                  {r.o > 0 && <Box component="span" sx={{ ...sub, color: SERIES[0] }}>+ {eur(r.o)} on order</Box>}
                </Box>
                <Box role="cell" sx={{ ...cell, alignItems: "flex-end" }}>
                  <Box component="span" sx={{ color: RED, fontWeight: 750 }}>{eur(r.gap)}</Box>
                  <Box component="span" sx={sub}>−{Math.round((100 * r.gap) / Math.max(1, r.best))}% vs best</Box>
                </Box>
                <Box role="cell" sx={cell}>
                  <Box component="span" sx={{ fontWeight: 650, whiteSpace: "nowrap", color: onOrderOnly(r) ? SERIES[0] : INK }} title={r.d ? `Last invoiced ${r.d}` : undefined}>
                    {onOrderOnly(r) ? "On order now" : r.months == null ? (r.lastYear ? `In ${r.lastYear}` : "—") : r.months === 0 ? "This month" : `${r.months} month${r.months === 1 ? "" : "s"} ago`}
                  </Box>
                  <Box component="span" sx={{ ...sub, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: KIND_COLOUR[r.kind], flex: "0 0 auto" }} />
                    {KIND_INFO.find((x) => x.id === r.kind)!.short}{r.d ? ` · ${monthLabel(r.d)}` : ""}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      {!rows.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No line for this choice{q ? ` and "${q}"` : ""}.</Typography>}
      <Pager p={paged} />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        At stake = the best year less the last 12 months and what is on order. Still buying, less: invoiced in the last 12 months or on order. Stopped: no invoice for 12 to {STOPPED_MONTHS} months and nothing on order; longer is lost. Last invoice: the last time the article was invoiced to the customer.
        {!days && <Box component="span" sx={{ color: "#a86a00" }}> The months since the last invoice come with the next read of the orders (a quarter of an hour) - until then a line shows its last year, and stopped means bought in {d.years[d.years.length - 2]} or {d.years[d.years.length - 1]}.</Box>}
      </Typography>
    </GlassCard>
  );
}

/** Every card by its key "<tab>:<card>" - the page draws them, and so does the nutshell. */
const CARDS: Record<string, { title: string; draw: (c: Ctx) => React.ReactNode }> = {
  "owners:gap": { title: "At stake by owner", draw: (c) => <OwnerSplitCard {...c} /> },
  "owners:apart": { title: "Not in the headline", draw: (c) => <ApartCard {...c} /> },
};

/** The card the nutshell's Retain & grow panel starts with (demotable). */
export const RETAIN_NUTSHELL_CARDS = [{ key: "retain:owners:gap", title: "At stake by owner" }];

/** A Retain & grow card promoted to the nutshell - the same card as on the page, with its filters. */
export function RetainPromoted({ spec, actions, half }: { spec: TileSpec; actions: React.ReactNode; half?: boolean }) {
  const r = useRetain();
  const [, tab, card] = spec.key.split(":");
  const c = CARDS[`${tab}:${card}`];
  if (!r.d || !c) {
    return <GlassCard><CardTitle icon={<TrendingDownOutlinedIcon />} tint="amber" title={c?.title ?? spec.title} note={r.d ? "This card is no longer on its page - Actions takes it off here." : "Reading the orders…"} right={actions} /></GlassCard>;
  }
  const ff = spec.filters ?? {};
  const kinds = (ff.kind?.length ? ff.kind : HEADLINE) as Kind[];
  return <>{c.draw({ d: r.d, f: { owner: ff.owner, country: ff.country, pc: ff.pc }, kinds, right: actions, half })}</>;
}

type Tab = "overview" | "list";

export function RetainExplorer({ state }: { state: MkState | null }) {
  void state;
  const params = useSearchParams();
  const r = useRetain();
  const d = r.d;
  const pick = (k: string) => params.getAll(k);
  const [tab, setTab] = useState<Tab>(() => (params.get("tab") === "list" ? "list" : "overview"));
  const [owners, setOwners] = useState<string[]>(() => pick("owner"));
  const [countries, setCountries] = useState<string[]>(() => pick("country"));
  const [pcs, setPcs] = useState<string[]>(() => pick("pc"));
  const [kinds, setKinds] = useState<Kind[]>(() => { const k = pick("kind").filter((x) => KIND_INFO.some((i) => i.id === x)) as Kind[]; return k.length ? k : HEADLINE; });
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [sort, setSort] = useState<Sort>({ k: "gap", desc: true });
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const u = new URLSearchParams();
    if (tab !== "overview") u.set("tab", tab);
    for (const [k, xs] of [["owner", owners], ["country", countries], ["pc", pcs]] as const) for (const x of xs) u.append(k, x);
    if (!sameKinds(kinds, HEADLINE)) for (const k of kinds) u.append("kind", k);
    if (q.trim()) u.set("q", q.trim());
    const s = u.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, owners, countries, pcs, kinds, q]);

  const f: RFilters = useMemo(() => ({ owner: owners, country: countries, pc: pcs }), [owners, countries, pcs]);
  const flip = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const options = useMemo(() => {
    if (!d) return null;
    const all = eroding(d, {});
    return { owners: totalsBy(all, keyOwner(d)).map(([k]) => k), countries: totalsBy(all, keyCountry(d)).map(([k]) => k), pcs: totalsBy(all, keyPc(d)).map(([k]) => k) };
  }, [d]);
  const listCount = useMemo(() => (d ? rowsOf(d, { ...f, kinds }).length : null), [d, f, kinds]);
  const chosenCount = owners.length + countries.length + pcs.length;
  const filters = Object.fromEntries(([["owner", owners], ["country", countries], ["pc", pcs], ["kind", sameKinds(kinds, HEADLINE) ? [] : kinds]] as const).filter(([, xs]) => xs.length)) as Record<string, string[]>;
  const clearAll = () => { setOwners([]); setCountries([]); setPcs([]); };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start={RETAIN_NUTSHELL_CARDS.some((x) => x.key === `retain:owners:${key}`) ? "nutshell" : "tab"}
      tile={{ key: `retain:owners:${key}`, page: "retain", tab: "owners", title, filters, kind: "card" }} />
  );

  if (!d || !options) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!r.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: r.error ? RED : MUTED }}>{r.error ? `Could not load: ${r.error}` : `Reading the orders since ${new Date().getFullYear() - 5}… a quarter of an hour the first time${r.progress ? ` · ${r.progress}` : ""}`}</Typography>
      </Box></GlassCard>
    );
  }
  const ctx: Ctx = { d, f, kinds, onKind: (k) => setKinds((xs) => { const next = flip(xs, k); return next.length ? next : HEADLINE; }) };

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Retain &amp; grow
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>Erosion at stake</b> on {new Date(d.asOf).toLocaleDateString("en-GB")} · each customer and article against its best year {yearsLabel(d)}: still bought, but less, or stopped - no order for 12 to {STOPPED_MONTHS} months{r.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {owners.map((x) => <Chip key={x} size="small" label={<span><b>Owner:</b> {ownerName(d, x)}</span>} onDelete={() => setOwners(flip(owners, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {countries.map((x) => <Chip key={x} size="small" label={<span><b>Country:</b> {x}</span>} onDelete={() => setCountries(flip(countries, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              {pcs.map((x) => <Chip key={x} size="small" label={<span><b>Profit centre:</b> {x}</span>} onDelete={() => setPcs(flip(pcs, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures d={d} f={f} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name="retain" tab={tab} onSelect={setTab} tabs={[{ id: "overview", label: "Overview", count: null }, { id: "list", label: "The list", count: listCount == null ? null : n0(listCount) }]} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="retain" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="retain-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      <Box role="tabpanel" id={`retain-panel-${tab}`} aria-labelledby={`retain-tab-${tab}`} sx={{ display: "grid", gap: 1.75, minWidth: 0 }}>
        {tab === "overview" && CARDS["owners:gap"].draw({ ...ctx, right: act("gap", "At stake by owner"), onOwner: (o) => { setOwners([o]); setTab("list"); window.scrollTo({ top: 0, behavior: "smooth" }); } })}
        {tab === "overview" && CARDS["owners:apart"].draw({ ...ctx, right: act("apart", "Not in the headline") })}
        {tab === "list" && <ListCard {...ctx} q={q} setQ={setQ} sort={sort} setSort={setSort} />}
      </Box>

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - {n0(d.orders)} order documents since January {d.years[0]}{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 24 hours. Money is what was invoiced (the order as placed and its invoiced deliveries are never both counted); credit notes are left out; a line&apos;s year is its invoice&apos;s. On order: ordered and not invoiced yet, for orders of the last two years. {n0(d.noCustomer)} documents without a customer number (web orders the ERP has not numbered yet) are not in it.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="retain-filters" open={panel} onClose={() => setPanel(false)} subtitle="The owner, the country, the profit centre" onClearAll={chosenCount ? clearAll : undefined}>
        <FilterSection id="rt-f-owner" index={0} title="Owner" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.owner} onFlip={() => setOpen((o) => ({ ...o, owner: !o.owner }))} summary={owners.length ? `${owners.length} chosen` : "All"} chosen={owners.length > 0}>
          {options.owners.map((o) => <Pick key={o || "none"} on={owners.includes(o)} label={ownerName(d, o)} onClick={() => setOwners(flip(owners, o))} />)}
        </FilterSection>
        <FilterSection id="rt-f-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {options.countries.map((k) => <Pick key={k} on={countries.includes(k)} label={k} onClick={() => setCountries(flip(countries, k))} />)}
        </FilterSection>
        <FilterSection id="rt-f-pc" index={2} title="Profit centre" icon={<WorkspacesOutlinedIcon />} tint="amber" open={!!open.pc} onFlip={() => setOpen((o) => ({ ...o, pc: !o.pc }))} summary={pcs.length ? pcs.join(", ") : "All"} chosen={pcs.length > 0}>
          {options.pcs.map((p) => <Pick key={p} on={pcs.includes(p)} label={p} onClick={() => setPcs(flip(pcs, p))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}
