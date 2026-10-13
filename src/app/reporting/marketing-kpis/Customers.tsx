"use client";
// WHO ARE OUR CUSTOMERS - the page Marketing KPIs opens on (SARCLA 13.10). Every
// company in HubSpot, cut by sales priority, APSO segment, potential, country,
// owner, customer type and mandant:
//   - a time window on top (a year, its months), against the same months a year earlier;
//   - companies and revenue side by side in every row;
//   - each card sorts and searches its own rows; a click on a row filters every other card;
//   - every figure says how far it is up to date.
// The window and the filters live in the address, so a view can be sent on. The
// macro page shows the same in short, its rows leading here.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import SwapVertIcon from "@mui/icons-material/SwapVert";
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

import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, INK, KpiTile, MUTED, RED, TINT, TRACK, glass, type Tint } from "@/app/uc/report/ui";
import { SEGMENT_COLOR } from "@/app/uc/segmentation/PortfolioCharts";
import {
  DIMS, MONTH_NAMES, breakdown, change, defaultWindow, lastMonth, shareOfWallet, sortRows, totals, upToDate, windowLabel,
  type Agg, type Cube, type Dim, type Filters, type Row, type SortKey, type Win,
} from "@/lib/marketingKpis/cube";
import type { SlowState } from "@/lib/integrations/slowReport";
import { stageHref } from "./data";

/* ── the data ─────────────────────────────────────────────────────────── */

export function useCustomersCube(): { cube: Cube | null; computing: boolean; progress?: string; error?: string; computedAt?: string } {
  const [st, setSt] = useState<{ ok?: boolean; cube?: SlowState<Cube>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/marketing-kpis/customers").then((r) => r.json())
      .then((j) => { if (!alive) return; setSt(j); if (j?.cube?.computing) timer = setTimeout(load, 5000); })
      .catch((e) => { if (alive) setSt({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  const cube = st?.cube?.value ?? null;
  return { cube, computing: !!st?.cube?.computing || st === null, progress: st?.cube?.progress, error: st?.error ?? st?.cube?.error, computedAt: st?.cube?.computedAt ?? cube?.generatedAt };
}

/* ── words, colours, numbers ──────────────────────────────────────────── */

const DIM: Record<Dim, { name: string; icon: React.ReactNode; tint: Tint; note: string; kpi: string }> = {
  prio: { name: "Sales priority", icon: <StarOutlineIcon />, tint: "green", note: "Which bands buy, and which carry the revenue", kpi: "C01 · C02" },
  segment: { name: "APSO customer", icon: <GroupsOutlinedIcon />, tint: "purple", note: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine", kpi: "C03" },
  potential: { name: "Potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "Yearly customer potential, and how much of it we get", kpi: "C07" },
  country: { name: "Country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where our customers are", kpi: "C05" },
  owner: { name: "Owner", icon: <PersonOutlineIcon />, tint: "slate", note: "The company owner in HubSpot", kpi: "" },
  type: { name: "Customer type", icon: <CategoryOutlinedIcon />, tint: "pink", note: "OEM, C2S workshops, MRO, resellers", kpi: "C04" },
  mandant: { name: "Mandant", icon: <AccountBalanceOutlinedIcon />, tint: "slate", note: "The ERP company the customer is invoiced from", kpi: "C05" },
};
const PRIO_COLOR: Record<string, string> = { "Prio 1": "#1b7a55", "Prio 2": "#3cb889", "Prio 3": "#eda100", "No priority": "#b9c0c9", "Not set": "#c5221f" };
const POT_COLOR: Record<string, string> = { "€100K and more": "#7a4a06", "€25K – 100K": "#a96a12", "€2.5K – 25K": "#d08a1e", "€500 – 2.5K": "#eab35a", "Under €500": "#f2d29c", "Not set": "#d9dde4" };
const ONE_HUE = "#2d6fa8";
const REV_HUE = "#1b7a55";
function colourOf(dim: Dim, label: string): string {
  if (dim === "prio") return PRIO_COLOR[label] ?? ONE_HUE;
  if (dim === "segment") return SEGMENT_COLOR[label] ?? "#8b97ac";
  if (dim === "potential") return POT_COLOR[label] ?? ONE_HUE;
  return ONE_HUE;
}

const moneyShort = (n: number) => {
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}€${Math.round(a / 1e3).toLocaleString("en")}K`;
  return `${sign}€${Math.round(a).toLocaleString("en")}`;
};
const pctOf = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");
/** A bar's share of the longest; credit notes can leave a sum below zero, which draws nothing. */
const width = (x: number, max: number) => `${Math.max(0, Math.min(100, (100 * x) / max))}%`;
const readAt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

/* ── the time window ──────────────────────────────────────────────────── */

function TimeFilter({ cube, win, onChange }: { cube: Cube; win: Win; onChange: (w: Win) => void }) {
  const last = lastMonth(cube, win.y);
  const presets: { label: string; from: number; to: number }[] = [
    { label: win.y === 0 ? "Year to date" : "Full year", from: 0, to: last },
    ...[0, 1, 2, 3].map((q) => ({ label: `Q${q + 1}`, from: q * 3, to: q * 3 + 2 })).filter((p) => p.to <= last),
  ];
  const pick = (y: number) => {
    const l = lastMonth(cube, y);
    onChange({ y, from: Math.min(win.from, l), to: y === 0 && win.y !== 0 ? l : Math.min(win.to, l) });
  };
  const sel = { height: 30, fontSize: "0.82rem", fontWeight: 600, borderRadius: "9px", bgcolor: "rgba(255,255,255,.8)", "& .MuiSelect-select": { py: 0.4, pl: 1.25 } };
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
      <ToggleButtonGroup size="small" exclusive value={win.y} onChange={(_, v) => v !== null && pick(v)}
        sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.5, py: 0.35, borderRadius: "9px" } }}>
        {cube.years.slice(0, 2).map((y, i) => <ToggleButton key={y} value={i}>{y}</ToggleButton>)}
      </ToggleButtonGroup>
      {presets.map((p) => {
        const on = p.from === win.from && p.to === win.to;
        return (
          <Chip key={p.label} label={p.label} onClick={() => onChange({ ...win, from: p.from, to: p.to })}
            sx={{ height: 28, fontSize: "0.8rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "rgba(255,255,255,.8)", color: on ? TINT.blue.fg : MUTED, border: `1px solid ${on ? "transparent" : "rgba(21,34,58,.12)"}` }} />
        );
      })}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Select size="small" value={win.from} onChange={(e) => { const f = Number(e.target.value); onChange({ ...win, from: f, to: Math.max(f, win.to) }); }} sx={sel} inputProps={{ "aria-label": "From month" }}>
          {MONTH_NAMES.map((m, i) => <MenuItem key={m} value={i} disabled={i > last}>{m}</MenuItem>)}
        </Select>
        <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>to</Typography>
        <Select size="small" value={win.to} onChange={(e) => { const t = Number(e.target.value); onChange({ ...win, to: t, from: Math.min(win.from, t) }); }} sx={sel} inputProps={{ "aria-label": "To month" }}>
          {MONTH_NAMES.map((m, i) => <MenuItem key={m} value={i} disabled={i > last}>{m}</MenuItem>)}
        </Select>
      </Box>
    </Box>
  );
}

/* ── the four headline figures, each with how far it is up to date ────── */

function Headline({ cube, a, all, win, readIso, compact = false }: { cube: Cube; a: Agg; all: Agg; win: Win; readIso?: string; compact?: boolean }) {
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, win.y + 1);
  const upTo = `Up to ${upToDate(cube, win)}`;
  const sow = shareOfWallet(a, win);
  const filtered = a.n !== all.n;
  return (
    <Grid container spacing={compact ? 1.5 : 2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ApartmentOutlinedIcon />} tint="purple" label="Companies" value={full(a.n)}
          note={`${filtered ? `${pctOf(a.n, all.n)} of the ${full(all.n)} in HubSpot` : "every company in HubSpot"} · as of ${readAt(readIso)}`} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ShoppingCartOutlinedIcon />} tint="green" label={`Bought ${w}`} value={full(a.bought)}
          delta={{ ratio: change(a.bought, a.boughtPy), versus: `${pw} (${full(a.boughtPy)})` }}
          note={`${pctOf(a.bought, a.n)} of these companies · ${upTo}`} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<EuroOutlinedIcon />} tint="blue" label={`Revenue ${w}`} value={moneyShort(a.rev)}
          delta={{ ratio: change(a.rev, a.revPy), versus: `${pw} (${moneyShort(a.revPy)})` }} note={upTo} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<DonutLargeOutlinedIcon />} tint="amber" label="Share of wallet" value={sow == null ? "—" : `${(sow * 100).toFixed(1)}%`}
          note={`revenue ${w} against the yearly potential for as many months · ${upTo}`} />
      </Grid>
    </Grid>
  );
}

/* ── rows: companies and revenue side by side ─────────────────────────── */

const COLS = { xs: "minmax(110px, 1fr) minmax(0, 1.1fr) minmax(0, 1.3fr)", md: "minmax(130px, 1fr) minmax(170px, 1.1fr) minmax(220px, 1.3fr)" };

/** A bar and its figures; the figures get a fixed width so every row's bar starts and ends in line. */
function Measure({ bar, figures, children }: { bar: React.ReactNode; figures: number; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `minmax(30px, 1fr) ${figures}px`, gap: 1, alignItems: "center", minWidth: 0 }}>
      <Box sx={{ position: "relative", height: 12, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>{bar}</Box>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 0.6, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{children}</Box>
    </Box>
  );
}

function DrillRows({ dim, rows, all, selected, cube, win, onPick, hrefOf }: {
  dim: Dim; rows: Row[]; all: Row[]; selected?: string; cube: Cube; win: Win;
  onPick?: (label: string) => void; hrefOf?: (label: string) => string;
}) {
  const maxN = Math.max(1, ...all.map((r) => r.n));
  const maxR = Math.max(1, ...all.map((r) => Math.max(r.rev, r.revPy)));
  const sumRev = all.reduce((s, r) => s + Math.max(0, r.rev), 0);
  const py = cube.years[win.y + 1];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: COLS, gap: 2, px: 1, pb: 0.5 }}>
        {[DIM[dim].name, "Companies · bought", `Revenue · share · vs ${py}`].map((h, i) => (
          <Typography key={h} sx={{ fontSize: "0.66rem", fontWeight: 600, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</Typography>
        ))}
      </Box>
      {rows.map((r) => {
        const colour = colourOf(dim, r.label);
        const on = selected === r.label;
        const faded = selected != null && !on;
        const ch = change(r.rev, r.revPy);
        const sow = shareOfWallet(r, win);
        const tip = `${r.label}: ${full(r.n)} companies, ${full(r.bought)} bought ${windowLabel(cube, win)} (${pctOf(r.bought, r.n)}; ${full(r.boughtPy)} a year earlier) · revenue ${moneyShort(r.rev)} (${moneyShort(r.revPy)} a year earlier)${sow != null ? ` · share of wallet ${(sow * 100).toFixed(1)}%` : ""}`;
        const body = (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              {on ? <CheckIcon sx={{ fontSize: 15, color: colour, flexShrink: 0 }} /> : <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: colour, flexShrink: 0 }} />}
              <Typography sx={{ fontSize: "0.86rem", fontWeight: on ? 700 : 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
            </Box>
            <Measure figures={104} bar={(
              <>
                <Box sx={{ position: "absolute", inset: 0, width: width(r.n, maxN), minWidth: 4, bgcolor: `${colour}40`, borderRadius: 99 }} />
                <Box sx={{ position: "absolute", inset: 0, width: width(r.bought, maxN), minWidth: r.bought ? 3 : 0, background: `linear-gradient(90deg, ${colour}cc, ${colour})`, borderRadius: 99 }} />
              </>
            )}>
              <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{full(r.n)}</Typography>
              <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>{full(r.bought)}</Typography>
            </Measure>
            <Measure figures={172} bar={(
              <>
                <Box sx={{ position: "absolute", inset: 0, width: width(r.rev, maxR), minWidth: r.rev > 0 ? 3 : 0, background: `linear-gradient(90deg, ${REV_HUE}bb, ${REV_HUE})`, borderRadius: 99 }} />
                {r.revPy > 0 && <Box sx={{ position: "absolute", top: 1, bottom: 1, left: `calc(${width(r.revPy, maxR)} - 1px)`, width: 2, bgcolor: INK, opacity: 0.55, borderRadius: 1 }} />}
              </>
            )}>
              <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{moneyShort(r.rev)}</Typography>
              <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, width: 40, textAlign: "right" }}>{r.rev > 0 ? pctOf(r.rev, sumRev) : "—"}</Typography>
              <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700, width: 46, textAlign: "right", color: ch == null || Math.abs(ch) < 0.0005 ? FAINT : ch > 0 ? GREEN : RED }}>
                {ch == null ? (r.rev > 0 ? "new" : "—") : `${ch > 0 ? "↑" : "↓"}${Math.abs(ch * 100).toFixed(0)}%`}
              </Typography>
            </Measure>
          </>
        );
        const sx = {
          display: "grid", gridTemplateColumns: COLS, gap: 2, alignItems: "center",
          px: 1, py: 0.75, borderRadius: "10px", textDecoration: "none", color: "inherit", cursor: "pointer",
          opacity: faded ? 0.45 : 1, bgcolor: on ? TINT[DIM[dim].tint].bg : "transparent",
          transition: "background-color .12s ease, opacity .12s ease",
          "&:hover": { bgcolor: on ? TINT[DIM[dim].tint].bg : "rgba(21,34,58,.04)", opacity: 1 },
          "&:focus-visible": { outline: `2px solid ${TINT[DIM[dim].tint].fg}`, outlineOffset: 1 },
        } as const;
        return hrefOf ? (
          <Box key={r.label} component={Link} href={hrefOf(r.label)} title={tip} sx={sx}>{body}</Box>
        ) : (
          <Box key={r.label} component="button" type="button" onClick={() => onPick?.(r.label)} title={tip} aria-pressed={on}
            sx={{ ...sx, border: 0, font: "inherit", textAlign: "left", width: "100%" }}>{body}</Box>
        );
      })}
    </Box>
  );
}

/* ── a card: its own sort and search, the click filters the others ───── */

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rev", label: "Revenue" }, { key: "n", label: "Companies" }, { key: "bought", label: "Bought" },
  { key: "change", label: "Change vs last year" }, { key: "name", label: "Name" },
];
const ORDERED: Partial<Record<Dim, string>> = { prio: "Priority order", potential: "Band order" };

function DimCard({ cube, dim, filters, win, onPick, onClear, limit = 8 }: {
  cube: Cube; dim: Dim; filters: Filters; win: Win; onPick: (d: Dim, label: string) => void; onClear: (d: Dim) => void; limit?: number;
}) {
  const [sort, setSort] = useState<SortKey>(ORDERED[dim] ? "natural" : "rev");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const all = useMemo(() => breakdown(cube, dim, filters, win), [cube, dim, filters, win]);
  const sorted = useMemo(() => sortRows(all, sort, dim), [all, sort, dim]);
  const found = q ? sorted.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : sorted;
  const shown = open || q ? found : found.slice(0, limit);
  const d = DIM[dim];
  const control = { height: 30, fontSize: "0.8rem", borderRadius: "9px", bgcolor: "rgba(255,255,255,.85)", border: "1px solid rgba(21,34,58,.12)" };
  return (
    <GlassCard sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardTitle icon={d.icon} tint={d.tint} title={d.name} note={d.note}
        right={d.kpi ? <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.04em" }}>{d.kpi}</Typography> : undefined} />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: -1, mb: 1.5 }}>
        <Select size="small" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} sx={{ ...control, fontWeight: 600, "& .MuiSelect-select": { py: 0.4, pl: 1 }, "& fieldset": { border: 0 } }}
          renderValue={(v) => <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><SwapVertIcon sx={{ fontSize: 16, color: MUTED }} />Sort: {v === "natural" ? ORDERED[dim] : SORTS.find((s) => s.key === v)?.label}</Box>}
          inputProps={{ "aria-label": `Sort ${d.name}` }}>
          {ORDERED[dim] && <MenuItem value="natural">{ORDERED[dim]}</MenuItem>}
          {SORTS.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
        </Select>
        {all.length > limit && (
          <Box sx={{ ...control, display: "flex", alignItems: "center", gap: 0.5, px: 1, minWidth: 170 }}>
            <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${d.name.toLowerCase()}…`} inputProps={{ "aria-label": `Find in ${d.name}` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
          </Box>
        )}
        {filters[dim] && (
          <Chip size="small" label={filters[dim]} onDelete={() => onClear(dim)}
            sx={{ height: 28, fontSize: "0.78rem", fontWeight: 700, bgcolor: TINT[d.tint].bg, color: TINT[d.tint].fg, "& .MuiChip-deleteIcon": { color: TINT[d.tint].fg } }} />
        )}
      </Box>
      {shown.length ? (
        <DrillRows dim={dim} rows={shown} all={all} selected={filters[dim]} cube={cube} win={win}
          onPick={(label) => (filters[dim] === label ? onClear(dim) : onPick(dim, label))} />
      ) : (
        <Typography sx={{ fontSize: "0.85rem", color: FAINT }}>{q ? `Nothing matches "${q}".` : "No company matches these filters."}</Typography>
      )}
      {!q && found.length > limit && (
        <Button size="small" onClick={() => setOpen((x) => !x)} sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 600, mt: 0.75 }}>
          {open ? "Show fewer" : `Show all ${found.length}`}
        </Button>
      )}
    </GlassCard>
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

const ORDER: Dim[] = ["prio", "segment", "potential", "country", "owner", "type", "mandant"];

function windowFrom(params: URLSearchParams, cube: Cube): Win {
  const d = defaultWindow(cube);
  const y = params.get("year") ? cube.years.indexOf(Number(params.get("year"))) : 0;
  if (y !== 0 && y !== 1) return d;
  const last = lastMonth(cube, y);
  const f = Number(params.get("from")), t = Number(params.get("to"));
  const from = f >= 1 && f <= 12 ? Math.min(f - 1, last) : 0;
  const to = t >= 1 && t <= 12 ? Math.min(t - 1, last) : y === 0 ? d.to : last;
  return { y, from: Math.min(from, to), to };
}

export function CustomersExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(DIMS.flatMap((d) => (params.get(d) ? [[d, params.get(d)!]] : []))));
  const [win, setWin] = useState<Win | null>(null);
  useEffect(() => { if (cube && !win) setWin(windowFrom(new URLSearchParams(params.toString()), cube)); }, [cube, win, params]);

  // the view lives in the address: a drill-down can be sent on
  useEffect(() => {
    if (!cube || !win) return;
    const q = new URLSearchParams();
    for (const d of DIMS) if (filters[d]) q.set(d, filters[d]!);
    const def = defaultWindow(cube);
    if (win.y !== def.y || win.from !== def.from || win.to !== def.to) { q.set("year", String(cube.years[win.y])); q.set("from", String(win.from + 1)); q.set("to", String(win.to + 1)); }
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [filters, win, cube]);

  const pick = (d: Dim, label: string) => setFilters((f) => ({ ...f, [d]: label }));
  const clear = (d: Dim) => setFilters((f) => { const n = { ...f }; delete n[d]; return n; });
  const a = useMemo(() => (cube && win ? totals(cube, filters, win) : null), [cube, filters, win]);
  const all = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);

  if (!cube || !win || !a || !all) return <Waiting computing={computing} progress={progress} error={error} />;
  const active = DIMS.filter((d) => filters[d]);
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      {/* the window, the drill-down, and how fresh it all is */}
      <Box sx={{ ...glass, borderRadius: "18px", px: 2, py: 1.25, display: "grid", gap: 1, position: "sticky", top: 8, zIndex: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <TimeFilter cube={cube} win={win} onChange={setWin} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            {computing ? "Reading HubSpot again… · " : ""}Revenue up to {upToDate(cube, { y: 0, from: 0, to: lastMonth(cube, 0) })} · companies read {readAt(computedAt)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <FilterAltOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
          {active.length === 0 ? (
            <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>All companies in HubSpot - click any row to drill down</Typography>
          ) : (
            <>
              {active.map((d) => (
                <Chip key={d} label={<span><b>{DIM[d].name}:</b> {filters[d]}</span>} onDelete={() => clear(d)}
                  sx={{ height: 28, fontSize: "0.8rem", bgcolor: TINT[DIM[d].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[d].tint].fg } }} />
              ))}
              <Button size="small" onClick={() => setFilters({})} sx={{ textTransform: "none", fontWeight: 600 }}>Clear all</Button>
            </>
          )}
        </Box>
      </Box>

      <Headline cube={cube} a={a} all={all} win={win} readIso={computedAt} />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" } }}>
        {ORDER.map((d) => <DimCard key={d} cube={cube} dim={d} filters={filters} win={win} onPick={pick} onClear={clear} limit={d === "country" || d === "owner" ? 10 : 8} />)}
      </Box>

      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Every company in HubSpot, read every 6 hours. Bought = invoiced revenue in a month of the window; revenue against the same months a year earlier.
        This year&apos;s months count once their revenue is loaded. Priority, segment, potential and owner are today&apos;s. Share of wallet leaves out potentials above €1M.
      </Typography>
    </Box>
  );
}

/* ── the macro page and the sales leader view: the same, in short ─────── */

export function CustomersSummary() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const win = useMemo(() => (cube ? defaultWindow(cube) : null), [cube]);
  const a = useMemo(() => (cube && win ? totals(cube, {}, win) : null), [cube, win]);
  if (!cube || !win || !a) return <Waiting computing={computing} progress={progress} error={error} />;
  const href = (d: Dim) => (label: string) => `${stageHref("customers")}?${new URLSearchParams({ [d]: label }).toString()}`;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Headline cube={cube} a={a} all={a} win={win} readIso={computedAt} compact />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" } }}>
        {(["prio", "segment"] as Dim[]).map((d) => {
          const rows = breakdown(cube, d, {}, win);
          return (
            <Box key={d} sx={{ ...glass, borderRadius: "20px", p: 2 }}>
              <CardTitle icon={DIM[d].icon} tint={DIM[d].tint} title={d === "prio" ? "By sales priority" : "By APSO customer"} note={`${windowLabel(cube, win)} · click a row to drill down`} />
              <DrillRows dim={d} rows={rows} all={rows} cube={cube} win={win} hrefOf={href(d)} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
