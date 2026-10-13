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

import { useEffect, useMemo, useState } from "react";
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
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
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
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import {
  DIMS, FIRST_MONTH, breakdown, change, clampWindow, defaultWindow, lastMonth, monthLabel, presets, proRataNote, shareOfWallet, sortRows, totals,
  upToDate, windowLabel, yearOfMonth, type Agg, type Cube, type Dim, type Filters, type Row, type SortKey, type Win,
} from "@/lib/marketingKpis/cube";
import type { SlowState } from "@/lib/integrations/slowReport";
import { RETRY_MS, RETRIES, hubJson, stageHref } from "./data";

/* ── the data ─────────────────────────────────────────────────────────── */

export function useCustomersCube(): { cube: Cube | null; computing: boolean; progress?: string; error?: string; computedAt?: string } {
  const [st, setSt] = useState<{ ok?: boolean; cube?: SlowState<Cube>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // a deployment's error page is a moment, not an answer: ask again, keep what is shown
    const load = (tries = 0) => hubJson<{ ok?: boolean; cube?: SlowState<Cube>; error?: string }>("/api/reporting/marketing-kpis/customers")
      .then((j) => { if (!alive) return; setSt(j); if (j?.cube?.computing) timer = setTimeout(load, RETRY_MS); })
      .catch((e) => {
        if (!alive) return;
        if (tries < RETRIES) { timer = setTimeout(() => load(tries + 1), RETRY_MS); return; }
        setSt((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) }));
      });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  const cube = st?.cube?.value ?? null;
  return { cube, computing: !!st?.cube?.computing || st === null, progress: st?.cube?.progress, error: st?.error ?? st?.cube?.error, computedAt: st?.cube?.computedAt ?? cube?.generatedAt };
}

/* ── words and numbers, in full ───────────────────────────────────────── */

const DIM: Record<Dim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string; kpi: string }> = {
  prio: { name: "Sales priority", lower: "sales priority", icon: <StarOutlineIcon />, tint: "green", note: "Which priority bands buy, and which carry the revenue", kpi: "KPI C01 · C02" },
  segment: { name: "APSO customer", lower: "APSO customer", icon: <GroupsOutlinedIcon />, tint: "purple", note: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine", kpi: "KPI C03" },
  potential: { name: "Potential", lower: "potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "The yearly customer potential, and how much of it we get", kpi: "KPI C07" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where our customers are", kpi: "KPI C05" },
  owner: { name: "Sales rep", lower: "sales rep", icon: <PersonOutlineIcon />, tint: "slate", note: "The company owner in HubSpot", kpi: "" },
  type: { name: "Customer type", lower: "customer type", icon: <CategoryOutlinedIcon />, tint: "pink", note: "OEM, C2S workshops, MRO, resellers", kpi: "KPI C04" },
  apic: { name: "APIC", lower: "APIC", icon: <FactoryOutlinedIcon />, tint: "amber", note: "The company's APIC industry code - 1.x OEM industries, down to the sub-industry", kpi: "" },
  mandant: { name: "Mandant", lower: "mandant", icon: <AccountBalanceOutlinedIcon />, tint: "slate", note: "The ERP company the customer is invoiced from", kpi: "KPI C05" },
};
const ORDER: Dim[] = ["prio", "segment", "potential", "country", "owner", "type", "apic", "mandant"];
const THIS = "#2d6fa8", BEFORE = "#b9c0c9";

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

/* ── the period ───────────────────────────────────────────────────────── */

function Period({ cube, win, onChange }: { cube: Cube; win: Win; onChange: (w: Win) => void }) {
  const ready = presets(cube);
  const months = Array.from({ length: lastMonth(cube) - FIRST_MONTH + 1 }, (_, i) => FIRST_MONTH + i);
  const sel = { height: 32, fontSize: "0.84rem", fontWeight: 600, borderRadius: "9px", bgcolor: "#fff", "& .MuiSelect-select": { py: 0.5, pl: 1.25 } };
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mr: 0.5 }}>Period</Typography>
      {ready.map((p) => {
        const on = p.win.start === win.start && p.win.end === win.end;
        return (
          <Chip key={p.id} label={p.label} onClick={() => onChange(p.win)} aria-pressed={on}
            sx={{ height: 30, fontSize: "0.82rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.14)"}` }} />
        );
      })}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>or from</Typography>
        <Select size="small" value={win.start} onChange={(e) => onChange(clampWindow(cube, { start: Number(e.target.value), end: Math.max(Number(e.target.value), win.end) }))} sx={sel} inputProps={{ "aria-label": "From month" }}>
          {months.map((k) => <MenuItem key={k} value={k}>{monthLabel(cube, k)}</MenuItem>)}
        </Select>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>to</Typography>
        <Select size="small" value={win.end} onChange={(e) => onChange(clampWindow(cube, { start: Math.min(win.start, Number(e.target.value)), end: Number(e.target.value) }))} sx={sel} inputProps={{ "aria-label": "To month" }}>
          {months.map((k) => <MenuItem key={k} value={k}>{monthLabel(cube, k)}</MenuItem>)}
        </Select>
      </Box>
    </Box>
  );
}

/* ── the four figures ─────────────────────────────────────────────────── */

function Figures({ cube, a, all, win, readIso }: { cube: Cube; a: Agg; all: Agg; win: Win; readIso?: string }) {
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const upTo = `Up to ${upToDate(cube, win)}`;
  const sow = shareOfWallet(a, win, cube);
  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ApartmentOutlinedIcon />} tint="purple" label="Companies in HubSpot" value={int(a.n)}
          note={`${a.n !== all.n ? `${pct(a.n / all.n)} of all ${int(all.n)} · ` : ""}as of ${readAt(readIso)}`} />
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

function DimChart({ title, rows, cur, prev, curLabel, prevLabel, fmt, selected, onPick }: {
  title: string; rows: Row[]; cur: (r: Row) => number; prev: (r: Row) => number; curLabel: string; prevLabel: string;
  fmt: (n: number) => string; selected?: string; onPick: (label: string) => void;
}) {
  const data = rows.map((r) => ({ label: r.label, cur: Math.max(0, cur(r)), prev: Math.max(0, prev(r)) }));
  const pick = (d: unknown) => { const l = (d as { payload?: { label?: string } })?.payload?.label; if (l) onPick(l); };
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>Click a bar to show only that one</Typography>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44 + 56)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 120, bottom: 4, left: 4 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke="#e6e8ec" />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={170} tickLine={false} axisLine={false} interval={0}
            tick={{ fontSize: 12.5, fill: INK }} />
          <Tooltip cursor={{ fill: "rgba(21,34,58,.04)" }} formatter={(v: unknown, n: unknown) => [fmt(Number(v)), String(n)]}
            contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} />
          <Legend verticalAlign="top" align="left" height={26} iconType="circle" itemSorter="dataKey" wrapperStyle={{ fontSize: "0.78rem" }} />
          <Bar dataKey="cur" name={curLabel} fill={THIS} radius={[0, 4, 4, 0]} cursor="pointer" onClick={pick} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.label} fill={THIS} fillOpacity={selected && selected !== d.label ? 0.3 : 1} />)}
            <LabelList dataKey="cur" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 12, fill: INK, fontWeight: 700 }} />
          </Bar>
          <Bar dataKey="prev" name={prevLabel} fill={BEFORE} radius={[0, 4, 4, 0]} cursor="pointer" onClick={pick} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.label} fill={BEFORE} fillOpacity={selected && selected !== d.label ? 0.3 : 1} />)}
            <LabelList dataKey="prev" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 11.5, fill: MUTED }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/* ── the table: wide, in words, any column sorts ──────────────────────── */

type Col = { key: SortKey; head: string; tip: string; cell: (r: Row, sum: number) => React.ReactNode };

function DimTable({ cube, dim, rows, win, selected, onPick }: { cube: Cube; dim: Dim; rows: Row[]; win: Win; selected?: string; onPick: (label: string) => void }) {
  const fixed = dim === "prio" || dim === "potential";
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: fixed ? "natural" : "rev", desc: true });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { setSort({ key: fixed ? "natural" : "rev", desc: true }); setQ(""); setOpen(false); }, [dim, fixed]);
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.rev), 0);
  const tot: Row = rows.reduce<Row>((t, r) => ({
    label: "Total", n: t.n + r.n, pot: t.pot + r.pot, bought: t.bought + r.bought, boughtPy: t.boughtPy + r.boughtPy,
    rev: t.rev + r.rev, revPy: t.revPy + r.revPy, revPot: t.revPot + r.revPot,
  }), { label: "Total", n: 0, pot: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, revPot: 0 });
  const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
  const cols: Col[] = [
    { key: "n", head: "Companies", tip: "Companies in HubSpot today", cell: (r) => int(r.n) },
    { key: "bought", head: `Bought in ${w}`, tip: "Companies with invoiced revenue in at least one month of the period", cell: (r) => int(r.bought) },
    { key: "boughtPy", head: `Bought in ${pw}`, tip: "The same, a year earlier", cell: (r) => int(r.boughtPy) },
    { key: "rev", head: `Revenue ${w}`, tip: "Invoiced revenue in the period", cell: (r) => eur(r.rev) },
    { key: "revPy", head: `Revenue ${pw}`, tip: "Invoiced revenue in the same months a year earlier", cell: (r) => eur(r.revPy) },
    { key: "diff", head: "Change in €", tip: "Revenue in the period minus the same months a year earlier", cell: (r) => <span style={{ color: tone(r.rev - r.revPy) }}>{signedEur(r.rev - r.revPy)}</span> },
    { key: "change", head: "Change in %", tip: "The change against the same months a year earlier", cell: (r) => <span style={{ color: tone(change(r.rev, r.revPy)), fontWeight: 700 }}>{r.revPy ? signedPct(change(r.rev, r.revPy)) : r.rev > 0 ? "new" : "—"}</span> },
    { key: "share", head: "Share of revenue", tip: "This row's part of all the revenue in the table", cell: (r, s) => (r.rev > 0 && s > 0 ? pct(r.rev / s) : "—") },
    { key: "sow", head: "Share of wallet", tip: "Revenue against the yearly potential for the same number of months", cell: (r) => pct(shareOfWallet(r, win, cube)) },
  ];
  const sorted = sortRows(rows, sort.key, dim, sort.desc);
  const found = q ? sorted.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : sorted;
  const LIMIT = 25;
  const shown = open || q ? found : found.slice(0, LIMIT);
  const by = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  // headers may take two lines, so the ten columns fit the card without scrolling sideways
  const head = {
    fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 1, verticalAlign: "bottom" as const,
    maxWidth: 132, "& .MuiTableSortLabel-root": { whiteSpace: "normal", textAlign: "right" },
  };
  const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 1, px: 1 };
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
              <TableCell sx={{ ...head, maxWidth: "none", minWidth: 150, pl: 1.5 }}>
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
              const on = selected === r.label;
              return (
                <TableRow key={r.label} hover onClick={() => onPick(r.label)} selected={on} aria-selected={on}
                  sx={{ cursor: "pointer", opacity: selected && !on ? 0.5 : 1, "&.Mui-selected, &.Mui-selected:hover": { bgcolor: TINT[DIM[dim].tint].bg } }}>
                  <TableCell sx={{ ...body, fontWeight: 600 }}>
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
  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(DIMS.flatMap((d) => (params.get(d) ? [[d, params.get(d)!]] : []))));
  const [view, setView] = useState<Dim>(() => ((ORDER as string[]).includes(params.get("view") ?? "") ? (params.get("view") as Dim) : "prio"));
  const [win, setWin] = useState<Win | null>(null);
  useEffect(() => {
    if (!cube || win) return;
    const s = fromYm(cube, params.get("from")), e = fromYm(cube, params.get("to"));
    setWin(s != null && e != null ? clampWindow(cube, { start: s, end: e }) : defaultWindow(cube));
  }, [cube, win, params]);

  // the view lives in the address: a drill-down can be sent on
  useEffect(() => {
    if (!cube || !win) return;
    const q = new URLSearchParams();
    if (view !== "prio") q.set("view", view);
    for (const d of DIMS) if (filters[d]) q.set(d, filters[d]!);
    const def = defaultWindow(cube);
    if (win.start !== def.start || win.end !== def.end) { q.set("from", ym(cube, win.start)); q.set("to", ym(cube, win.end)); }
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [filters, win, view, cube]);

  const toggle = (d: Dim, label: string) => setFilters((f) => { const n = { ...f }; if (n[d] === label) delete n[d]; else n[d] = label; return n; });
  const clear = (d: Dim) => setFilters((f) => { const n = { ...f }; delete n[d]; return n; });
  const a = useMemo(() => (cube && win ? totals(cube, filters, win) : null), [cube, filters, win]);
  const all = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);
  const rows = useMemo(() => (cube && win ? breakdown(cube, view, filters, win) : []), [cube, view, filters, win]);

  // the filters fold away behind a button at the top (SARCLA 13.10); the choice is remembered in this browser
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) === "1"); } catch { /* storage blocked */ } }, []);
  const flip = () => setOpen((o) => { try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* storage blocked */ } return !o; });

  if (!cube || !win || !a || !all) return <Waiting computing={computing} progress={progress} error={error} />;
  const d = DIM[view];
  const active = DIMS.filter((x) => filters[x]);
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const pro = proRataNote(cube, win);
  // the charts show the twelve with the most revenue; priority and potential keep their order
  const top = (dim: Dim, n: number) => {
    const r = breakdown(cube, dim, filters, win);
    return dim === "prio" || dim === "potential" ? r : sortRows(r, "rev", dim).slice(0, n);
  };
  const chartRows = top(view, 12);
  // every view also shows the revenue by country and by sales rep (SARCLA 13.10); where one of
  // them is the view itself, the sales priority takes its place
  const beside: Dim[] = view === "country" ? ["owner", "prio"] : view === "owner" ? ["country", "prio"] : ["country", "owner"];
  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0 }}>
      {/* the title, the four figures small beside it, and the filters button */}
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: { xs: 1.5, md: 3 }, flexWrap: "wrap" }}>
        <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
          Who are our customers
        </Typography>
        <Box sx={{ flex: 1 }} />
        <KpiStrip cube={cube} a={a} all={all} win={win} readIso={computedAt} />
      </Box>

      {/* what is shown, always; the period controls when the filters are open */}
      <Box sx={{ ...glass, borderRadius: "16px", px: 2, py: 1.1, display: "grid", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button onClick={flip} size="small" variant={open ? "contained" : "outlined"} disableElevation aria-expanded={open} aria-controls="customers-filters"
            startIcon={<TuneIcon />} endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", px: 1.5, height: 32, mr: 0.5 }}>
            Filters{active.length ? ` (${active.length})` : ""}
          </Button>
          <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: MUTED }} />
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
            <b style={{ color: INK }}>{w}</b> against <b style={{ color: INK }}>{pw}</b>{pro ? ` (${pro})` : ""} · figures up to {upToDate(cube, win)}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          <Box sx={{ width: "1px", height: 18, bgcolor: HAIRLINE, mx: 0.5 }} />
          <FilterAltOutlinedIcon sx={{ fontSize: 18, color: MUTED }} />
          {active.length === 0 ? (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>All companies - click a bar or a row to show only that one</Typography>
          ) : (
            <>
              {active.map((x) => (
                <Chip key={x} size="small" label={<span><b>{DIM[x].name}:</b> {filters[x]}</span>} onDelete={() => clear(x)}
                  sx={{ height: 26, fontSize: "0.8rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              <Button size="small" onClick={() => setFilters({})} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </>
          )}
        </Box>
        {open && (
          <Box id="customers-filters" sx={{ pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
            <Period cube={cube} win={win} onChange={setWin} />
          </Box>
        )}
      </Box>

      <Box>
        <ReportTabs name="customers" tab={view} onSelect={setView}
          tabs={ORDER.map((x) => ({ id: x, label: DIM[x].name, count: filters[x] ? "1 chosen" : null }))} />
      </Box>

      <GlassCard sx={{ display: "grid", gap: 2 }}>
        <CardTitle icon={d.icon} tint={d.tint} title={`Our customers by ${d.lower}`} note={d.note}
          right={d.kpi ? <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>{d.kpi}</Typography> : undefined} />

        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>
          <DimChart title={`Companies that bought, by ${d.lower}`} rows={chartRows} cur={(r) => r.bought} prev={(r) => r.boughtPy}
            curLabel={w} prevLabel={pw} fmt={int} selected={filters[view]} onPick={(l) => toggle(view, l)} />
          <DimChart title={`Revenue, by ${d.lower}`} rows={chartRows} cur={(r) => r.rev} prev={(r) => r.revPy}
            curLabel={w} prevLabel={pw} fmt={eur} selected={filters[view]} onPick={(l) => toggle(view, l)} />
        </Box>
        {chartRows.length < rows.length && (
          <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: -1 }}>The charts show the 12 with the most revenue; the table below has all {rows.length}.</Typography>
        )}

        <DimTable cube={cube} dim={view} rows={rows} win={win} selected={filters[view]} onPick={(l) => toggle(view, l)} />

        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
          {beside.map((o) => (
            <DimChart key={o} title={`Revenue, by ${DIM[o].lower}${o === "prio" ? "" : " - the 10 largest"}`} rows={top(o, 10)} cur={(r) => r.rev} prev={(r) => r.revPy}
              curLabel={w} prevLabel={pw} fmt={eur} selected={filters[o]} onPick={(l) => toggle(o, l)} />
          ))}
        </Box>

        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
          Every company in HubSpot, read every 6 hours; revenue up to the last ERP delivery. Bought = invoiced revenue in at least one month of the period.
          Priority, APSO customer, potential and sales rep are today&apos;s. Share of wallet leaves out potentials above €1,000,000.
        </Typography>
      </GlassCard>
    </Box>
  );
}

const OPEN_KEY = "apsomh:customers-filters-open";

/** The four figures, small, beside the title (SARCLA 13.10: "it is always repeating, put it small on top"). */
function KpiStrip({ cube, a, all, win, readIso }: { cube: Cube; a: Agg; all: Agg; win: Win; readIso?: string }) {
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
  const items: { label: string; value: string; ch?: number | null; sub: string; tip: string }[] = [
    { label: "Companies", value: int(a.n), sub: a.n !== all.n ? `${pct(a.n / all.n)} of ${int(all.n)}` : `as of ${readAt(readIso)}`, tip: `Companies in HubSpot, as of ${readAt(readIso)}` },
    { label: `Bought, ${w}`, value: int(a.bought), ch: change(a.bought, a.boughtPy), sub: `${pw}: ${int(a.boughtPy)}`, tip: "Companies with invoiced revenue in at least one month of the period" },
    { label: `Revenue, ${w}`, value: eur(a.rev), ch: change(a.rev, a.revPy), sub: `${pw}: ${eur(a.revPy)}`, tip: `Invoiced revenue, up to ${upToDate(cube, win)}` },
    { label: "Share of wallet", value: pct(shareOfWallet(a, win, cube)), sub: "of the yearly potential", tip: "Revenue against the yearly potential, for the same time" },
  ];
  return (
    <Box sx={{ display: "flex", gap: { xs: 2, md: 3 }, flexWrap: "wrap", alignItems: "flex-end" }}>
      {items.map((it) => (
        <Box key={it.label} title={it.tip} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{it.label}</Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            {it.ch !== undefined && <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: tone(it.ch ?? null) }}>{signedPct(it.ch ?? null)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, whiteSpace: "nowrap" }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the macro page and the sales leader view: the same, in short ─────── */

export function CustomersSummary() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const win = useMemo(() => (cube ? defaultWindow(cube) : null), [cube]);
  const a = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);
  if (!cube || !win || !a) return <Waiting computing={computing} progress={progress} error={error} />;
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  const href = (d: Dim, label: string) => `${stageHref("customers")}?${new URLSearchParams({ view: d, [d]: label }).toString()}`;
  const head = { fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, whiteSpace: "nowrap" as const };
  const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const };
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Figures cube={cube} a={a} all={a} win={win} readIso={computedAt} />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" } }}>
        {(["prio", "segment"] as Dim[]).map((d) => (
          <Box key={d} sx={{ ...glass, borderRadius: "20px", p: 2, minWidth: 0 }}>
            <CardTitle icon={DIM[d].icon} tint={DIM[d].tint} title={`By ${DIM[d].lower}`} note={`${w} against ${pw} · click a row to open it`} />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>
                  {[DIM[d].name, "Companies", `Bought in ${w}`, `Revenue ${w}`, "Change in %"].map((h, i) => <TableCell key={h} align={i ? "right" : "left"} sx={head}>{h}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {breakdown(cube, d, {}, win).map((r) => {
                    const c = change(r.rev, r.revPy);
                    return (
                      <TableRow key={r.label} hover component={Link} href={href(d, r.label)} sx={{ textDecoration: "none", cursor: "pointer" }}>
                        <TableCell sx={{ ...body, fontWeight: 600 }}>{r.label}</TableCell>
                        <TableCell align="right" sx={body}>{int(r.n)}</TableCell>
                        <TableCell align="right" sx={body}>{int(r.bought)}</TableCell>
                        <TableCell align="right" sx={body}>{eur(r.rev)}</TableCell>
                        <TableCell align="right" sx={{ ...body, fontWeight: 700, color: c == null ? FAINT : c > 0 ? GREEN : RED }}>{r.revPy ? signedPct(c) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
