"use client";
// WHO ARE OUR CUSTOMERS - the page Marketing KPIs opens on (SARCLA 13.10). Every
// company in HubSpot, one breakdown at a time (sales priority, APSO customer,
// potential, country, owner, customer type, mandant), each in one card:
//   - the period and the drill-down filters sit with the chart they shape;
//   - the period: ready-made (this year to date, last 12 months, last year,
//     quarters) or any range of months, also over a year end, always against
//     the same months a year earlier;
//   - two charts - companies that bought, and revenue - whose bars filter;
//   - a full-width table in plain words and full figures, sorted by any column.
// SARCLA, on the version before: "way too confusing"; "the table should be
// wider so we can see the data clearly"; "no abbreviation".

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
// the tile toolbar and saved views (9f, SARCLA 18.10: "they should be on the main one then visible on the nutshell")
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";
import type { TileSpec } from "./tiles/registry";
import { WithActions } from "./tiles/WithActions";
import { ReportTabs } from "@/app/uc/report/Tabs";
import {
  DIMS, chosenDims, FIRST_MONTH, breakdown, change, clampWindow, defaultWindow, lastMonth, monthLabel, presets, proRataNote, shareOfWallet, sortRows, totals,
  upToDate, windowLabel, yearOfMonth, type Agg, type Cube, type Dim, type Filters, type Row, type SortKey, type Win,
} from "@/lib/marketingKpis/cube";
import type { SlowState } from "@/lib/integrations/slowReport";
import { RETRY_MS, RETRIES, everyWhileSeen, hubJson, stageHref, useSlow } from "./data";
import { onlineBy, onlineShare, type OnlineAgg, type OnlineCube } from "@/lib/marketingKpis/onlineShare";
import { MovementsView, inOut, movesIn, useMovements } from "./Movements";
import { FilterPanel, FilterSection as Section } from "./FilterPanel";
import { BEFORE, DimChart, THIS } from "./DimChart";

/* ── the data ─────────────────────────────────────────────────────────── */

export function useCustomersCube(): { cube: Cube | null; computing: boolean; progress?: string; error?: string; computedAt?: string } {
  const [st, setSt] = useState<{ ok?: boolean; cube?: SlowState<Cube>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // a deployment's error page is a moment, not an answer: ask again, keep what is shown
    const load = (tries = 0) => hubJson<{ ok?: boolean; cube?: SlowState<Cube>; error?: string }>("/api/reporting/marketing-kpis/customers")
      .then((j) => { if (!alive) return; setSt(j); timer = j?.cube?.computing ? setTimeout(() => { timer = undefined; load(); }, RETRY_MS) : undefined; })
      .catch((e) => {
        if (!alive) return;
        if (tries < RETRIES) { timer = setTimeout(() => load(tries + 1), RETRY_MS); return; }
        setSt((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) }));
      });
    load();
    // an open page moves on by itself: a newer ERP delivery shows without a reload (SARCLA 17.10)
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, []);
  const cube = st?.cube?.value ?? null;
  return { cube, computing: !!st?.cube?.computing || st === null, progress: st?.cube?.progress, error: st?.error ?? st?.cube?.error, computedAt: st?.cube?.computedAt ?? cube?.generatedAt };
}

/* ── words and numbers, in full ───────────────────────────────────────── */

/** The breakdowns' names, glyphs and words - shared with the ESO reports' Figures, which filter alike (SARCLA 24.10.2026). */
export const DIM: Record<Dim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string; kpi: string }> = {
  prio: { name: "Sales priority", lower: "sales priority", icon: <StarOutlineIcon />, tint: "green", note: "Which priority bands buy, and which carry the revenue", kpi: "KPI C01 · C02 · C06" },
  segment: { name: "APSO customer", lower: "APSO customer", icon: <GroupsOutlinedIcon />, tint: "purple", note: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine", kpi: "KPI C03 · C06" },
  potential: { name: "Potential", lower: "potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "The yearly customer potential, and how much of it we get", kpi: "KPI C07" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where our customers are", kpi: "KPI C05" },
  owner: { name: "Sales rep", lower: "sales rep", icon: <PersonOutlineIcon />, tint: "slate", note: "The company owner in HubSpot", kpi: "" },
  type: { name: "Customer type", lower: "customer type", icon: <CategoryOutlinedIcon />, tint: "pink", note: "OEM, C2S workshops, MRO, resellers", kpi: "KPI C04" },
  apic: { name: "APIC", lower: "APIC", icon: <FactoryOutlinedIcon />, tint: "amber", note: "The company's APIC industry code - 1.x OEM industries, down to the sub-industry", kpi: "" },
  mandant: { name: "Mandant", lower: "mandant", icon: <AccountBalanceOutlinedIcon />, tint: "slate", note: "The ERP company the customer is invoiced from", kpi: "KPI C05" },
  sae: { name: "Performis SAE", lower: "Performis SAE", icon: <PersonOutlineIcon />, tint: "purple", note: "The sales agent Performis has on the customer, as a person", kpi: "" },
};
const ORDER: Dim[] = ["prio", "segment", "potential", "country", "owner", "type", "apic", "mandant"];

const int = (n: number) => Math.round(n).toLocaleString("en");
const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const signedEur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const readAt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const ym = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const fromYm = (cube: Cube, s: string | null) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  return m ? (Number(m[1]) - cube.years[2]) * 12 + Number(m[2]) - 1 : null;
};

/** The filter window's folds come in one after another as it opens. */

/* ── the period ───────────────────────────────────────────────────────── */

function Period({ cube, win, onChange }: { cube: Cube; win: Win; onChange: (w: Win) => void }) {
  const ready = presets(cube);
  const months = Array.from({ length: lastMonth(cube) - FIRST_MONTH + 1 }, (_, i) => FIRST_MONTH + i);
  const sel = { height: 32, fontSize: "0.82rem", fontWeight: 600, borderRadius: "9px", bgcolor: "#fff", flex: 1, "& .MuiSelect-select": { py: 0.5, pl: 1.25 } };
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {ready.map((p) => {
          const on = p.win.start === win.start && p.win.end === win.end;
          return (
            <Chip key={p.id} label={p.label} onClick={() => onChange(p.win)} aria-pressed={on}
              sx={{ height: 28, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.14)"}` }} />
          );
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>From</Typography>
        <Select size="small" value={win.start} onChange={(e) => onChange(clampWindow(cube, { start: Number(e.target.value), end: Math.max(Number(e.target.value), win.end) }))} sx={sel} inputProps={{ "aria-label": "From month" }}>
          {months.map((k) => <MenuItem key={k} value={k}>{monthLabel(cube, k)}</MenuItem>)}
        </Select>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>to</Typography>
        <Select size="small" value={win.end} onChange={(e) => onChange(clampWindow(cube, { start: Math.min(win.start, Number(e.target.value)), end: Number(e.target.value) }))} sx={sel} inputProps={{ "aria-label": "To month" }}>
          {months.map((k) => <MenuItem key={k} value={k}>{monthLabel(cube, k)}</MenuItem>)}
        </Select>
      </Box>
    </Box>
  );
}

/* ── the four figures ─────────────────────────────────────────────────── */

/** Unknown industries are not an industry: left out of "the top APIC". */
const NO_APIC = new Set(["Not set", "NO INFORMATION FOUND"]);
/**
 * The industry that brings the most revenue in the window, its change and its
 * share, and the two after it (SARCLA 17.10: "instead of Companies in HubSpot,
 * use APIC - the top APIC").
 */
function TopApic({ cube, a, win }: { cube: Cube; a: Agg; win: Win }) {
  const top = sortRows(breakdown(cube, "apic", {}, win), "rev", "apic").filter((r) => !NO_APIC.has(r.label) && r.rev > 0);
  const first = top[0];
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const c = first ? change(first.rev, first.revPy) : null;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 0.9, minWidth: 0, overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Badge icon={<FactoryOutlinedIcon />} tint="purple" size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED }}>Top APIC, {w}</Typography>
      </Box>
      {first ? (
        <>
          <Typography sx={{ fontSize: "1.08rem", fontWeight: 700, color: INK, lineHeight: 1.25 }}>{first.label}</Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.8, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.45rem", fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{eur(first.rev)}</Typography>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: c == null || Math.abs(c) < 0.0005 ? MUTED : c > 0 ? GREEN : RED }}>{first.revPy ? signedPct(c) : "new"}</Typography>
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>
            {a.rev > 0 ? `${pct(first.rev / a.rev)} of all revenue · ` : ""}{int(first.bought)} companies bought · {pw}: {eur(first.revPy)}
          </Typography>
          {top.length > 1 && (
            <Box sx={{ mt: "auto", pt: 0.75, borderTop: "1px solid rgba(21,34,58,.07)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.35 }}>
              {top.slice(1, 3).map((r, i) => (
                <Box key={r.label} sx={{ display: "flex", gap: 1, fontSize: "0.76rem", color: MUTED }}>
                  <Box component="span" sx={{ fontWeight: 700, color: FAINT }}>{i + 2}.</Box>
                  <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</Box>
                  <Box component="span" sx={{ fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{eur(r.rev)}</Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      ) : <Typography sx={{ fontSize: "0.9rem", color: FAINT }}>No APIC with revenue in these months.</Typography>}
    </Box>
  );
}

function Figures({ cube, a, all, win, readIso }: { cube: Cube; a: Agg; all: Agg; win: Win; readIso?: string }) {
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const upTo = `Up to ${upToDate(cube, win)}`;
  const sow = shareOfWallet(a, win, cube);
  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <TopApic cube={cube} a={a} win={win} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ShoppingCartOutlinedIcon />} tint="green" label={`Companies that bought, ${w}`} value={int(a.bought)}
          delta={{ ratio: change(a.bought, a.boughtPy), versus: `${pw}: ${int(a.boughtPy)}` }} note={upTo} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<EuroOutlinedIcon />} tint="blue" label={`Revenue, ${w}`} value={eur(a.rev)}
          delta={{ ratio: change(a.rev, a.revPy), versus: `${pw}: ${eur(a.revPy)}` }} note={upTo} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<DonutLargeOutlinedIcon />} tint="amber" label="Share of wallet" value={pct(sow)}
          note={`Revenue against the yearly potential for the same number of months · ${upTo}`} />
      </Grid>
    </Grid>
  );
}

/* ── the charts: their bars are the filter ────────────────────────────── */

const byBought = (r: Row) => r.bought, byRev = (r: Row) => r.rev, byNew = (r: Row) => r.newC;
/**
 * Our focus markets (SARCLA 17.10: the online share "should only focus on our focus markets"):
 * the eight countries that make 97% of the revenue. Only the online share chart by country keeps to them.
 */
export const FOCUS_MARKETS = ["Switzerland", "Germany", "Italy", "France", "Austria", "Netherlands", "Liechtenstein", "Poland"];
// a row without orders a year earlier draws no grey bar, rather than a false 0%
const byOnline = (r: Row) => r.online ?? 0, byOnlinePy = (r: Row) => r.onlinePy ?? NaN;

/** KPI C06, read on its own (online.ts): the page shows everything else meanwhile. */
const useOnline = () => useSlow<OnlineCube>("/api/reporting/marketing-kpis/online", "online");
/** Rows with the online share of their orders - by label, under the same filters and months. */
function withOnline(rows: Row[], groups: Map<string, OnlineAgg> | null): Row[] {
  if (!groups) return rows;
  return rows.map((r) => {
    const a = groups.get(r.label);
    return { ...r, online: a ? onlineShare(a.all, a.web) : null, onlinePy: a ? onlineShare(a.allPy, a.webPy) : null };
  });
}
/** All the groups together. */
function sumOnline(groups: Map<string, OnlineAgg>): OnlineAgg {
  const t = { all: 0, web: 0, allPy: 0, webPy: 0 };
  for (const a of groups.values()) { t.all += a.all; t.web += a.web; t.allPy += a.allPy; t.webPy += a.webPy; }
  return t;
}
/** A share's change, in percentage points. */
const points = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? null : `${a - b > 0 ? "+" : a - b < 0 ? "−" : "±"}${Math.abs((a - b) * 100).toFixed(1)} pt`;

/** In the online chart's place while its read runs - or why it could not. */
function OnlineWaiting({ progress, error }: { progress?: string; error?: string }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1, alignContent: "start" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>Online share of order value</Typography>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
        {!error && <CircularProgress size={16} />}
        <Typography sx={{ fontSize: "0.82rem", color: error ? RED : MUTED }}>
          {error ? `Could not read the orders: ${error}` : `Reading every order of the three years${progress ? ` - ${progress}` : ""}. About 5 minutes the first time, then kept for 6 hours; the rest of the page does not wait for it.`}
        </Typography>
      </Box>
    </Box>
  );
}

/* ── the table: wide, in words, any column sorts ──────────────────────── */

type Col = { key: SortKey; head: string; tip: string; cell: (r: Row, sum: number) => React.ReactNode };

function DimTable({ cube, dim, rows, win, selected, onPick, withNew = false, onlineTotal }: {
  cube: Cube; dim: Dim; rows: Row[]; win: Win; selected?: string[]; onPick: (label: string) => void; withNew?: boolean;
  /** the online share of all the rows' orders; the column shows once the online read is in */
  onlineTotal?: OnlineAgg | null;
}) {
  const fixed = dim === "prio" || dim === "potential";
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: fixed ? "natural" : "rev", desc: true });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { setSort({ key: fixed ? "natural" : "rev", desc: true }); setQ(""); setOpen(false); }, [dim, fixed]);
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.rev), 0);
  const tot: Row = rows.reduce<Row>((t, r) => ({
    label: "Total", n: t.n + r.n, pot: t.pot + r.pot, bought: t.bought + r.bought, boughtPy: t.boughtPy + r.boughtPy,
    rev: t.rev + r.rev, revPy: t.revPy + r.revPy, revPot: t.revPot + r.revPot, newC: t.newC + r.newC, newCPy: t.newCPy + r.newCPy, oi: t.oi + r.oi, oiPy: t.oiPy + r.oiPy,
  }), { label: "Total", n: 0, pot: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, revPot: 0, newC: 0, newCPy: 0, oi: 0, oiPy: 0 });
  if (onlineTotal) { tot.online = onlineShare(onlineTotal.all, onlineTotal.web); tot.onlinePy = onlineShare(onlineTotal.allPy, onlineTotal.webPy); }
  const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
  const cols: Col[] = [
    { key: "n", head: "Companies", tip: "Companies in HubSpot today", cell: (r) => int(r.n) },
    { key: "bought", head: `Bought in ${w}`, tip: "Companies with invoiced revenue in at least one month of the period", cell: (r) => int(r.bought) },
    { key: "boughtPy", head: `Bought in ${pw}`, tip: "The same, a year earlier", cell: (r) => int(r.boughtPy) },
    ...(withNew ? [
      { key: "newC" as SortKey, head: `New customers ${w}`, tip: "Companies whose first order ever falls in the period", cell: (r: Row) => int(r.newC) },
      { key: "newCPy" as SortKey, head: `New customers ${pw}`, tip: "The same, a year earlier", cell: (r: Row) => int(r.newCPy) },
    ] : []),
    { key: "rev", head: `Revenue ${w}`, tip: "Invoiced revenue in the period", cell: (r) => eur(r.rev) },
    { key: "revPy", head: `Revenue ${pw}`, tip: "Invoiced revenue in the same months a year earlier", cell: (r) => eur(r.revPy) },
    { key: "diff", head: "Change in €", tip: "Revenue in the period minus the same months a year earlier", cell: (r) => <span style={{ color: tone(r.rev - r.revPy) }}>{signedEur(r.rev - r.revPy)}</span> },
    { key: "change", head: "Change in %", tip: "The change against the same months a year earlier", cell: (r) => <span style={{ color: tone(change(r.rev, r.revPy)), fontWeight: 700 }}>{r.revPy ? signedPct(change(r.rev, r.revPy)) : r.rev > 0 ? "new" : "—"}</span> },
    { key: "share", head: "Share of revenue", tip: "This row's part of all the revenue in the table", cell: (r, s) => (r.rev > 0 && s > 0 ? pct(r.rev / s) : "—") },
    { key: "sow", head: "Share of wallet", tip: "Revenue against the yearly potential for the same number of months", cell: (r) => pct(shareOfWallet(r, win, cube)) },
    ...(onlineTotal ? [{
      key: "online" as SortKey, head: "Online share of orders", tip: `The orders' net value that came through the shop, in ${w}; in brackets ${pw} (KPI C06)`,
      // the year earlier beneath, so the eleven columns still fit the card
      cell: (r: Row) => (r.online == null ? "—" : <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.2 }}>
        {pct(r.online)}{r.onlinePy != null && <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>({pct(r.onlinePy)})</Box>}
      </Box>),
    }] : []),
  ];
  const sorted = sortRows(rows, sort.key, dim, sort.desc);
  const found = q ? sorted.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : sorted;
  const LIMIT = 25;
  const shown = open || q ? found : found.slice(0, LIMIT);
  const by = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  // headers may take two lines, and the thirteen columns with the new customers sit a little closer, so the table fits the card without scrolling sideways
  const pad = withNew ? 0.6 : 0.75;
  const head = {
    fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: pad, verticalAlign: "bottom" as const,
    maxWidth: 124, "& .MuiTableSortLabel-root": { whiteSpace: "normal", textAlign: "right" },
    // the arrow only on the column that sorts: an unseen arrow on every header cost the table its width
    "& .MuiTableSortLabel-root:not(.Mui-active) .MuiTableSortLabel-icon": { display: "none" },
  };
  const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 1, px: pad };
  return (
    <Box sx={{ minWidth: 0 }}>
      {rows.length > 12 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, mb: 1, height: 34, maxWidth: 320, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower}` }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
      )}
      <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
        <Table size="small" sx={{ minWidth: 860 }} aria-label={`Our customers by ${DIM[dim].lower}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...head, maxWidth: "none", minWidth: 110, pl: 1.5 }}>
                <TableSortLabel active={sort.key === "label"} direction={sort.key === "label" && !sort.desc ? "desc" : "asc"} onClick={() => by("label")}>{DIM[dim].name}</TableSortLabel>
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
              const on = !!selected?.includes(r.label);
              return (
                <TableRow key={r.label} hover onClick={() => onPick(r.label)} selected={on} aria-selected={on}
                  sx={{ cursor: "pointer", opacity: selected?.length && !on ? 0.5 : 1, "&.Mui-selected, &.Mui-selected:hover": { bgcolor: TINT[DIM[dim].tint].bg } }}>
                  <TableCell sx={{ ...body, fontWeight: 600, whiteSpace: "normal", maxWidth: 150 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>{on && <CheckIcon sx={{ fontSize: 16, color: TINT[DIM[dim].tint].fg }} />}{r.label}</Box>
                  </TableCell>
                  {cols.map((c) => <TableCell key={c.key} align="right" sx={body}>{c.cell(r, sumRev)}</TableCell>)}
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell sx={{ ...body, fontWeight: 800, borderBottom: 0 }}>Total</TableCell>
              {cols.map((c) => <TableCell key={c.key} align="right" sx={{ ...body, fontWeight: 800, borderBottom: 0 }}>{c.cell(tot, sumRev)}</TableCell>)}
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      {!q && found.length > LIMIT && (
        <Button size="small" onClick={() => setOpen((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, mt: 0.75 }}>
          {open ? "Show the first 25" : `Show all ${found.length}`}
        </Button>
      )}
    </Box>
  );
}

function Waiting({ computing, progress, error }: { computing: boolean; progress?: string; error?: string }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error ? `Could not read the companies: ${error}` : computing ? `Reading every company in HubSpot${progress ? ` - ${progress}` : ""}. Two to three minutes the first time, then kept for 6 hours.` : "Loading…"}
        </Typography>
      </Box>
    </GlassCard>
  );
}

/* ── the page ─────────────────────────────────────────────────────────── */

export function CustomersExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const params = useSearchParams();
  // several values per breakdown (SARCLA 17.10: "multi-selection, for example 2 sales reps"), each its own ?owner=… in the address
  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(DIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))));
  // the breakdowns, and after them the movements (KPI C08)
  const [view, setView] = useState<Dim | "moves">(() => ([...ORDER, "moves"] as string[]).includes(params.get("view") ?? "") ? (params.get("view") as Dim | "moves") : "prio");
  const dimView: Dim = view === "moves" ? "prio" : view;
  const [win, setWin] = useState<Win | null>(null);
  const shownDefault = useRef<Win | null>(null);
  useEffect(() => {
    if (!cube) return;
    const def = defaultWindow(cube);
    if (!win) {
      const s = fromYm(cube, params.get("from")), e = fromYm(cube, params.get("to"));
      setWin(s != null && e != null ? clampWindow(cube, { start: s, end: e }) : def);
      shownDefault.current = def;
      return;
    }
    // a newer delivery moved "year to date" on (into a new month): the page follows, unless a window was chosen
    const was = shownDefault.current;
    if (was && (was.start !== def.start || was.end !== def.end) && win.start === was.start && win.end === was.end) setWin(def);
    shownDefault.current = def;
  }, [cube, win, params]);

  // the view lives in the address: a drill-down can be sent on
  useEffect(() => {
    if (!cube || !win) return;
    const q = new URLSearchParams();
    if (view !== "prio") q.set("view", view);
    for (const d of DIMS) for (const v of filters[d] ?? []) q.append(d, v);
    const def = defaultWindow(cube);
    if (win.start !== def.start || win.end !== def.end) { q.set("from", ym(cube, win.start)); q.set("to", ym(cube, win.end)); }
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [filters, win, view, cube]);

  const toggle = (d: Dim, label: string) => setFilters((f) => {
    const cur = f[d] ?? [], next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    const n = { ...f };
    if (next.length) n[d] = next; else delete n[d];
    return n;
  });
  const a = useMemo(() => (cube && win ? totals(cube, filters, win) : null), [cube, filters, win]);
  const all = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);
  const rows = useMemo(() => (cube && win ? breakdown(cube, dimView, filters, win) : []), [cube, dimView, filters, win]);
  const onl = useOnline();
  const onlineGroups = useMemo(() => (onl.value && win ? onlineBy(onl.value, filters, win, dimView) : null), [onl.value, filters, win, dimView]);
  const onlineNow = useMemo(() => (onl.value && win ? onlineBy(onl.value, filters, win).get("") ?? { all: 0, web: 0, allPy: 0, webPy: 0 } : null), [onl.value, filters, win]);

  // the filters open as a window of their own (SARCLA 13.10), closed at first; a chart can open it on its breakdown
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (dim: Dim) => { setFocus((f) => ({ dim, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  if (!cube || !win || !a || !all) return <Waiting computing={computing} progress={progress} error={error} />;
  const d = DIM[dimView];
  // the charts take every value, largest first, and page through them; priority and potential keep their order
  const ranked = (dim: Dim) => {
    const r = breakdown(cube, dim, filters, win);
    return dim === "prio" || dim === "potential" ? r : sortRows(r, "rev", dim);
  };
  const chartRows = ranked(dimView);
  const fixedView = dimView === "prio" || dimView === "potential";
  // a bar filters, and the filter window opens on that breakdown (SARCLA 14.10)
  const fromChart = (dim: Dim) => (label: string) => { toggle(dim, label); openOn(dim); };
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const pro = proRataNote(cube, win);
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  // the tile toolbar per chart, keyed "customers:<tab>:<chart>"; the filters in force go into a ticket
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `customers:${view}:${key}`, page: "customers", tab: view, title, summary: `${w} against ${pw}`, filters: Object.fromEntries(active.map((x) => [x, filters[x] ?? []])),
        ...(cube && win ? { from: ym(cube, win.start), to: ym(cube, win.end) } : {}), kind: "card" }} />
  );
  // each tab shows its own breakdown only (SARCLA 14.10: "information not belonging to the table");
  // customer type and APIC also count their new customers
  const withNew = view === "type" || view === "apic";
  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {/* the title and what is shown on the left; the four figures and the filters button top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Who are our customers
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{w}</b> against {pw}{pro ? ` (${pro})` : ""} · figures up to {upToDate(cube, win)}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {active.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {chosen.map(([x, v]) => (
                <Chip key={`${x}:${v}`} size="small" label={<span><b>{DIM[x].name}:</b> {v}</span>} onDelete={() => toggle(x, v)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              <Button size="small" onClick={() => setFilters({})} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <KpiCards cube={cube} a={a} all={all} win={win} readIso={computedAt} online={onlineNow} onlineBusy={!onl.value && !onl.error} />
        </Box>
      </Box>

      {/* the tabs, and at their right end the Filters button (SARCLA 14.10) - it opens the window on the tab's breakdown */}
      {/* one row from tablet width: when the tabs do not fit they wrap inside their own bar, and Filters stays at the right end; on a phone Filters goes below */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="customers" tab={view} onSelect={setView}
            tabs={[...ORDER.map((x) => ({ id: x as Dim | "moves", label: DIM[x].name, count: filters[x]?.length ? String(filters[x]!.length) : null })), { id: "moves" as const, label: "Movements", count: null }]} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="customers" /></Box>
        <Button onClick={() => (panel ? setPanel(false) : view === "moves" ? setPanel(true) : openOn(view))} variant={panel || active.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="customers-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || active.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>

      {view === "moves" ? (
        <WithActions tile={{ key: "customers:moves:movements", page: "customers", tab: "moves", title: "Movements", summary: `${w} against ${pw}`,
          filters: Object.fromEntries(active.map((x) => [x, filters[x] ?? []])), ...(cube && win ? { from: ym(cube, win.start), to: ym(cube, win.end) } : {}), kind: "card" }}>
          <MovementsView cube={cube} win={win} filtered={active.length > 0} />
        </WithActions>
      ) : (
      /* minmax(0, 1fr): a chart may not widen its card past the column */
      <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <CardTitle icon={d.icon} tint={d.tint} title={`Our customers by ${d.lower}`} note={d.note}
          right={d.kpi ? <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>{d.kpi}</Typography> : undefined} />

        {/* the charts first - this view's own - and the table at the end */}
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>
          <DimChart key={`b-${dimView}`} title={`Companies that bought, by ${d.lower}`} rows={chartRows} cur={byBought} prev={(r) => r.boughtPy} pageSize={12} fixedOrder={fixedView}
            curLabel={w} prevLabel={pw} fmt={int} selected={filters[dimView]} onPick={fromChart(dimView)} onFilter={() => openOn(dimView)} filterLabel={`Filter by ${d.lower}`}
            actions={act("bought", `Companies that bought, by ${d.lower}`)} />
          <DimChart key={`r-${dimView}`} title={`Revenue, by ${d.lower}`} rows={chartRows} cur={byRev} prev={(r) => r.revPy} pageSize={12} fixedOrder={fixedView}
            curLabel={w} prevLabel={pw} fmt={eur} selected={filters[dimView]} onPick={fromChart(dimView)} onFilter={() => openOn(dimView)} filterLabel={`Filter by ${d.lower}`}
            actions={act("revenue", `Revenue, by ${d.lower}`)} />
          {withNew && (
            <DimChart key={`n-${dimView}`} title={`New customers, by ${d.lower}`} rows={chartRows} cur={byNew} prev={(r) => r.newCPy} pageSize={12} fixedOrder={fixedView}
              curLabel={w} prevLabel={pw} fmt={int} selected={filters[dimView]} onPick={fromChart(dimView)} onFilter={() => openOn(dimView)} filterLabel={`Filter by ${d.lower}`}
              actions={act("new", `New customers, by ${d.lower}`)} />
          )}
          {/* KPI C06: of the orders' value, how much came through the shop - its own read, in when it is in */}
          {/* the odd chart out takes the whole row */}
          <Box sx={{ minWidth: 0, gridColumn: { lg: withNew ? "auto" : "1 / -1" } }}>
          {onlineGroups ? (
            <DimChart key={`o-${dimView}`} title={dimView === "country" ? "Online share of order value, our focus markets" : `Online share of order value, by ${d.lower}`}
              rows={withOnline(chartRows, onlineGroups).filter((r) => r.online != null && (dimView !== "country" || FOCUS_MARKETS.includes(r.label)))}
              cur={byOnline} prev={byOnlinePy} pageSize={12} fixedOrder={fixedView}
              curLabel={w} prevLabel={pw} fmt={pct} selected={filters[dimView]} onPick={fromChart(dimView)} onFilter={() => openOn(dimView)} filterLabel={`Filter by ${d.lower}`}
              actions={act("online", `Online share of order value, by ${d.lower}`)} />
          ) : <OnlineWaiting progress={onl.progress} error={onl.error} />}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by {d.lower}</Typography>
          <DimTable cube={cube} dim={dimView} rows={withOnline(rows, onlineGroups)} win={win} selected={filters[dimView]} onPick={(l) => toggle(dimView, l)} withNew={withNew}
            onlineTotal={onlineGroups ? sumOnline(onlineGroups) : null} />
        </Box>

        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
          Every company in HubSpot, read again after every ERP delivery; revenue up to that delivery. Bought = invoiced revenue in at least one month of the period.
          Priority, APSO customer, potential, sales rep and APIC are today&apos;s. Share of wallet leaves out potentials above €1,000,000.
          {onl.value && <> Online share: of the orders&apos; net value by order date, the part that came through the shop (apsoparts.com), read {readAt(onl.value.generatedAt)};
            credit notes and cancelled orders left out; in euros, a CHF order at its month&apos;s ECB rate.</>}
        </Typography>
      </GlassCard>
      )}

      <FilterWindow open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube} win={win} setWin={setWin} filters={filters} toggle={toggle} clearAll={() => setFilters({})} />
    </Box>
  );
}

/** The four figures, each in a small card, top right beside the title (SARCLA 13.10). */
function KpiCards({ cube, a, all, win, readIso, online, onlineBusy }: { cube: Cube; a: Agg; all: Agg; win: Win; readIso?: string; online?: OnlineAgg | null; onlineBusy?: boolean }) {
  const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
  const items: { label: string; value: string; ch?: number | null; chText?: string | null; chTone?: number | null; sub: string; icon: React.ReactNode; tint: Tint }[] = [
    { label: "Companies", value: int(a.n), sub: a.n !== all.n ? `${pct(a.n / all.n)} of all ${int(all.n)}` : `as of ${readAt(readIso)}`, icon: <ApartmentOutlinedIcon />, tint: "purple" },
    { label: "Companies that bought", value: int(a.bought), ch: change(a.bought, a.boughtPy), sub: `a year earlier: ${int(a.boughtPy)}`, icon: <ShoppingCartOutlinedIcon />, tint: "green" },
    { label: "Revenue", value: eur(a.rev), ch: change(a.rev, a.revPy), sub: `a year earlier: ${eur(a.revPy)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: "Share of wallet", value: pct(shareOfWallet(a, win, cube)), sub: "of the yearly potential", icon: <DonutLargeOutlinedIcon />, tint: "amber" },
  ];
  if (online || onlineBusy) {
    const now = online ? onlineShare(online.all, online.web) : null, py = online ? onlineShare(online.allPy, online.webPy) : null;
    items.push({
      label: "Online share", value: online ? pct(now) : "…", chText: points(now, py), chTone: now != null && py != null ? now - py : null,
      sub: online ? (py != null ? `of order value · a year earlier: ${pct(py)}` : "of the orders' value") : "reading the orders", icon: <ShoppingCartOutlinedIcon />, tint: "blue",
    });
  }
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            {it.ch !== undefined && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(it.ch ?? null) }}>{signedPct(it.ch ?? null)}</Typography>}
            {it.chText && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(it.chTone ?? null) }}>{it.chText}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * The filters, as a window of their own over the page - like the assistant's
 * chat: it opens from the button, closes with its cross or Escape, and the
 * charts behind it stay live (SARCLA 13.10: "collapsable; when open it
 * overlays the graphs; it works like a separate chat").
 */
export function FilterWindow({ id = "customers-filters", period = true, dims = ORDER, names = {}, open, onClose, focus, cube, win, setWin, filters, toggle, clearAll }: {
  /** the breakdowns it offers - this page's, unless given (the Figures add the Performis SAE) */
  dims?: Dim[];
  /** the window's id - the Figures of the ESO reports open the same one (SARCLA 24.10.2026: "filters as in Digital Growth") */
  id?: string;
  /** the Period fold - the Figures stand on the ERP's month and year to date, they have none */
  period?: boolean;
  /** a breakdown under another name on that page - the Figures call the sales rep "Company owner" */
  names?: Partial<Record<Dim, string>>;
  open: boolean; onClose: () => void; focus: { dim: Dim; n: number } | null; cube: Cube; win: Win; setWin: (w: Win) => void; filters: Filters; toggle: (d: Dim, label: string) => void; clearAll: () => void;
}) {
  const chosen = chosenDims(filters).flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  const [shut, setShut] = useState<Partial<Record<Dim | "period", boolean>>>({});
  // a breakdown opens by itself when it holds a choice; the first two are open to begin with
  const isOpen = (k: Dim | "period") => {
    if (shut[k] !== undefined) return !shut[k];
    return k === "period" || k === "prio" || k === "segment" || !!filters[k]?.length;
  };
  const flip = (k: Dim | "period") => setShut((s) => ({ ...s, [k]: isOpen(k) }));
  // opened from a chart: that breakdown unfolds, comes into view and lights up for a moment
  const [lit, setLit] = useState<Dim | null>(null);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    setLit(focus.dim);
    const t1 = setTimeout(() => document.getElementById(`filter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    const t2 = setTimeout(() => setLit(null), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focus]);
  return (
    <FilterPanel id={id} open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length > 0 ? chosen.map(([x, v]) => (
        <Chip key={`${x}:${v}`} size="small" label={<span><b>{names[x] ?? DIM[x].name}:</b> {v}</span>} onDelete={() => toggle(x, v)}
          sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
      )) : null}>
      {period && (
      <Section id="filter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")}
        summary={windowLabel(cube, win)}>
        <Period cube={cube} win={win} onChange={setWin} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
          Against {windowLabel(cube, win, 1)}{proRataNote(cube, win) ? ` - ${proRataNote(cube, win)}` : ""} · figures up to {upToDate(cube, win)}
        </Typography>
      </Section>
      )}
      {dims.map((dim, i) => (
        <Section key={dim} id={`filter-${dim}`} index={i + 1} lit={lit === dim} title={names[dim] ?? DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => flip(dim)} summary={!filters[dim]?.length ? "All" : filters[dim]!.length === 1 ? filters[dim]![0] : `${filters[dim]!.length} chosen`} chosen={!!filters[dim]?.length}>
          <Facet cube={cube} dim={dim} win={win} filters={filters} onPick={(l) => toggle(dim, l)} />
        </Section>
      ))}
    </FilterPanel>
  );
}

/** One breakdown's values: a check, the name, a bar of the companies that bought, the count; the long ones search. */
function Facet({ cube, dim, win, filters, onPick }: { cube: Cube; dim: Dim; win: Win; filters: Filters; onPick: (label: string) => void }) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const r = breakdown(cube, dim, filters, win);
    return dim === "prio" || dim === "potential" ? r : sortRows(r, "rev", dim);
  }, [cube, dim, filters, win]);
  const sel = filters[dim] ?? [];
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  // the chosen value always shows, even when it is not among the first ones
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.includes(r.label))];
  const max = Math.max(1, ...rows.map((r) => r.bought));
  const t = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      <Box sx={{ display: "flex", justifyContent: "space-between", px: 1, pb: 0.25 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{DIM[dim].name}</Typography>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bought</Typography>
      </Box>
      {shown.map((r) => {
        const on = sel.includes(r.label);
        return (
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on} title={on ? "Click again to let it go" : sel.length ? `Add ${r.label}` : `Show only ${r.label}`}
            sx={{
              display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) auto", alignItems: "center", columnGap: 1, width: "100%", border: 0, font: "inherit", textAlign: "left", cursor: "pointer",
              px: 1, py: 0.6, borderRadius: "9px", bgcolor: on ? t.bg : "#fff", color: INK, boxShadow: on ? `inset 0 0 0 1.5px ${t.fg}` : "inset 0 0 0 1px rgba(21,34,58,.06)",
              opacity: sel.length && !on ? 0.7 : 1, "&:hover": { boxShadow: `inset 0 0 0 1.5px ${t.fg}`, opacity: 1 }, "&:focus-visible": { outline: `2px solid ${t.fg}`, outlineOffset: 1 },
            }}>
            <Box sx={{ width: 18, height: 18, borderRadius: "5px", display: "grid", placeItems: "center", bgcolor: on ? t.fg : "#fff", border: on ? "none" : "1.5px solid rgba(21,34,58,.28)" }}>
              {on && <CheckIcon sx={{ fontSize: 14, color: "#fff" }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
              <Box sx={{ height: 3, borderRadius: 99, bgcolor: "rgba(21,34,58,.06)", mt: 0.4, overflow: "hidden" }}>
                <Box sx={{ width: `${(100 * Math.max(0, r.bought)) / max}%`, height: "100%", bgcolor: t.fg, opacity: 0.55, borderRadius: 99 }} />
              </Box>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{int(r.bought)}</Typography>
          </Box>
        );
      })}
      {rows.length > LIMIT && !q && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", px: 1, mt: 0.25 }}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </Box>
  );
}

/* ── the macro page and the sales leader view: the same, in short ─────── */

export function CustomersSummary() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const win = useMemo(() => (cube ? defaultWindow(cube) : null), [cube]);
  const a = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);
  if (!cube || !win || !a) return <Waiting computing={computing} progress={progress} error={error} />;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {/* a newer ERP delivery is being read: say so, rather than show the old date as if current (SARCLA 16.10) */}
      {computing && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={14} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Reading the companies again for the latest ERP delivery{progress ? ` - ${progress}` : ""}; these figures stand at {upToDate(cube, win)} until it is done.
          </Typography>
        </Box>
      )}
      <Figures cube={cube} a={a} all={a} win={win} readIso={computedAt} />
      <CustomersGraph cube={cube} win={win} />
    </Box>
  );
}

/**
 * Who our customers are, in one graph (SARCLA 17.10: "this should be only one
 * graph, with the movement changes in both"): by sales priority or by APSO
 * customer - one switch - each row its revenue against a year earlier, the
 * companies that bought, the online share of their orders, and how many
 * companies moved into it and out of it in the same months. A row opens the
 * customers page on that value.
 */
function CustomersGraph({ cube, win }: { cube: Cube; win: Win }) {
  const [dim, setDim] = useState<"prio" | "segment">("prio");
  const onl = useOnline();
  const { m: moves } = useMovements();
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const rows = useMemo(() => {
    const r = breakdown(cube, dim, {}, win);
    return withOnline(dim === "prio" ? r : sortRows(r, "rev", dim), onl.value ? onlineBy(onl.value, {}, win, dim) : null);
  }, [cube, dim, win, onl.value]);
  const months = useMemo(() => Array.from({ length: win.end - win.start + 1 }, (_, i) => win.start + i), [win]);
  const io = useMemo(() => (moves ? inOut(movesIn(moves, cube, months, dim)) : null), [moves, cube, months, dim]);
  const maxRev = Math.max(1, ...rows.map((r) => Math.max(r.rev, r.revPy)));
  const maxMove = Math.max(1, ...[...(io?.values() ?? [])].flatMap((x) => [x.in, x.out]));
  const href = (label: string) => `${stageHref("customers")}?${new URLSearchParams({ view: dim, [dim]: label }).toString()}`;
  const cols = "minmax(130px, 1.1fr) minmax(260px, 2.6fr) minmax(124px, .9fr) minmax(84px, .7fr) minmax(210px, 1.7fr)";
  const head = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.04em", lineHeight: 1.3 };
  const D = DIM[dim];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <CardTitle icon={D.icon} tint={D.tint} title={`Our customers by ${D.lower}`} note={`${w} against ${pw} · click a row to open it`} />
        </Box>
        <Box role="tablist" aria-label="By" sx={{ display: "inline-flex", p: 0.5, gap: 0.5, borderRadius: "12px", bgcolor: "rgba(21,34,58,.05)" }}>
          {(["prio", "segment"] as const).map((x) => (
            <Box key={x} component="button" type="button" role="tab" aria-selected={dim === x} onClick={() => setDim(x)}
              sx={{ border: 0, font: "inherit", cursor: "pointer", px: 1.5, py: 0.7, borderRadius: "9px", fontSize: "0.84rem", fontWeight: 700,
                bgcolor: dim === x ? "#fff" : "transparent", color: dim === x ? INK : MUTED, boxShadow: dim === x ? "0 1px 3px rgba(21,34,58,.12)" : "none" }}>
              {DIM[x].name}
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 820, display: "grid", gridTemplateColumns: cols, columnGap: 2, alignItems: "center" }}>
          <Box sx={head}>{D.name}</Box>
          <Box sx={head}>Revenue {w} <span style={{ textTransform: "none", fontWeight: 600 }}>(grey: {pw})</span></Box>
          <Box sx={{ ...head, textAlign: "right" }}>Bought</Box>
          <Box sx={{ ...head, textAlign: "right" }}>Online share</Box>
          <Box sx={{ ...head, textAlign: "center" }}>Moved out · moved in</Box>
          {rows.map((r) => {
            const c = change(r.rev, r.revPy);
            const mv = io?.get(r.label);
            return (
              <Box key={r.label} component={Link} href={href(r.label)} sx={{
                display: "contents", color: INK, textDecoration: "none",
                "&:hover > *": { bgcolor: "rgba(21,34,58,.035)" },
              }}>
                <Box sx={{ py: 1.1, pl: 1, borderRadius: "10px 0 0 10px", fontSize: "0.88rem", fontWeight: 700 }}>{r.label}</Box>
                <Box sx={{ py: 1.1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 128px", columnGap: 1.25, alignItems: "center" }}>
                  <Box sx={{ display: "grid", gap: 0.4 }}>
                    <Box sx={{ height: 12, borderRadius: 99, bgcolor: THIS, width: `${(100 * Math.max(0, r.rev)) / maxRev}%`, minWidth: r.rev > 0 ? 3 : 0 }} />
                    <Box sx={{ height: 5, borderRadius: 99, bgcolor: BEFORE, width: `${(100 * Math.max(0, r.revPy)) / maxRev}%`, minWidth: r.revPy > 0 ? 3 : 0 }} />
                  </Box>
                  <Box sx={{ textAlign: "right", lineHeight: 1.2 }}>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{eur(r.rev)}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap", color: c == null || Math.abs(c) < 0.0005 ? FAINT : c > 0 ? GREEN : RED }}>
                      {r.revPy ? signedPct(c) : r.rev > 0 ? "new" : ""}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ py: 1.1, textAlign: "right", fontSize: "0.84rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  <b>{int(r.bought)}</b><Box component="span" sx={{ color: FAINT, fontSize: "0.76rem" }}> of {int(r.n)}</Box>
                </Box>
                <Box sx={{ py: 1.1, textAlign: "right", fontSize: "0.84rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: onl.value ? INK : FAINT }}>
                  {onl.value ? pct(r.online ?? null) : "…"}
                </Box>
                {/* moved out to the left in red, moved in to the right in green */}
                <Box sx={{ py: 1.1, pr: 1, borderRadius: "0 10px 10px 0", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 2px minmax(0, 1fr)", alignItems: "center", columnGap: 0.75 }}>
                  {io ? (
                    <>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.6 }}>
                        <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700, color: mv?.out ? RED : FAINT, fontVariantNumeric: "tabular-nums" }}>{mv?.out ? `−${int(mv.out)}` : "0"}</Typography>
                        <Box sx={{ height: 10, borderRadius: "99px 0 0 99px", bgcolor: RED, opacity: 0.8, width: `${(100 * (mv?.out ?? 0)) / maxMove}%`, maxWidth: "62%" }} />
                      </Box>
                      <Box sx={{ height: 18, bgcolor: "rgba(21,34,58,.18)" }} />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                        <Box sx={{ height: 10, borderRadius: "0 99px 99px 0", bgcolor: GREEN, opacity: 0.85, width: `${(100 * (mv?.in ?? 0)) / maxMove}%`, maxWidth: "62%" }} />
                        <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700, color: mv?.in ? GREEN : FAINT, fontVariantNumeric: "tabular-nums" }}>{mv?.in ? `+${int(mv.in)}` : "0"}</Typography>
                      </Box>
                    </>
                  ) : <Typography sx={{ gridColumn: "1 / -1", textAlign: "center", fontSize: "0.76rem", color: FAINT }}>…</Typography>}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Bought = companies with invoiced revenue in the months, of all in that {D.lower}. Online share = of their orders&apos; net value, the part through the shop.
        Moves = companies whose {D.lower} changed in these months, into this one and out of it{moves ? "" : " - reading the history"}.
      </Typography>
    </GlassCard>
  );
}


/**
 * A chart of Who are our customers promoted to In a nutshell (SARCLA 18.10: "promote/demote are not
 * really connected") - drawn again from its spec: the tab, the chart, the filters, the months.
 */
export function CustomersPromoted({ spec, actions }: { spec: TileSpec; actions?: React.ReactNode }) {
  const { cube } = useCustomersCube();
  const onl = useOnline();
  const dim = (ORDER as string[]).includes(spec.tab ?? "") ? (spec.tab as Dim) : "prio";
  const filters = (spec.filters ?? {}) as Filters;
  const win = useMemo(() => {
    if (!cube) return null;
    const s = fromYm(cube, spec.from ?? null), e = fromYm(cube, spec.to ?? null);
    return s != null && e != null ? clampWindow(cube, { start: s, end: e }) : defaultWindow(cube);
  }, [cube, spec.from, spec.to]);
  const onlineGroups = useMemo(() => (onl.value && win ? onlineBy(onl.value, filters, win, dim) : null), [onl.value, filters, win, dim]);
  if (!cube || !win) return <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{spec.title}…</Typography></Box>;
  const d = DIM[dim];
  const fixed = dim === "prio" || dim === "potential";
  const rows = fixed ? breakdown(cube, dim, filters, win) : sortRows(breakdown(cube, dim, filters, win), "rev", dim);
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const common = { rows, curLabel: w, prevLabel: pw, selected: filters[dim], onPick: () => undefined, pageSize: 10, fixedOrder: fixed, actions };
  switch (spec.key.split(":")[2]) {
    case "movements": return <Box sx={{ position: "relative", minWidth: 0 }}><MovementsView cube={cube} win={win} filtered={Object.values(filters).some((x) => x?.length)} />{actions && <Box sx={{ position: "absolute", top: { xs: 16, md: 22 }, right: 0, zIndex: 1, "& > button": { mr: 0 } }}>{actions}</Box>}</Box>;
    case "bought": return <DimChart title={`Companies that bought, by ${d.lower}`} cur={byBought} prev={(r) => r.boughtPy} fmt={int} {...common} />;
    case "revenue": return <DimChart title={`Revenue, by ${d.lower}`} cur={byRev} prev={(r) => r.revPy} fmt={eur} {...common} />;
    case "new": return <DimChart title={`New customers, by ${d.lower}`} cur={byNew} prev={(r) => r.newCPy} fmt={int} {...common} />;
    case "online": return onlineGroups
      ? <DimChart title={dim === "country" ? "Online share of order value, our focus markets" : `Online share of order value, by ${d.lower}`} cur={byOnline} prev={byOnlinePy} fmt={pct} {...common}
          rows={withOnline(rows, onlineGroups).filter((r) => r.online != null && (dim !== "country" || FOCUS_MARKETS.includes(r.label)))} />
      : <OnlineWaiting progress={onl.progress} error={onl.error} />;
    default: return null;
  }
}
