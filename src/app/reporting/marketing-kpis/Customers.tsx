"use client";
// WHO ARE OUR CUSTOMERS - the customers stage as a drill-down (SARCLA 13.10: "if
// click, drill down on potential / APSO customer / country / owner"; "match the
// UC's"). Every company in HubSpot, cut by sales priority, APSO segment,
// potential, country, owner, customer type and mandant. A click on any row
// filters every other card; the filters live in the address, so a view can be
// sent on. The macro page shows the same in short, its rows leading here.

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
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";
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
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, TINT, TRACK, glass, type Tint } from "@/app/uc/report/ui";
import { SEGMENT_COLOR } from "@/app/uc/segmentation/PortfolioCharts";
import { DIMS, breakdown, shareOfWallet, totals, type Agg, type Cube, type Dim, type Filters, type Row } from "@/lib/marketingKpis/cube";
import type { SlowState } from "@/lib/integrations/slowReport";
import { MONTHS, stageHref } from "./data";

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
  return { cube: st?.cube?.value ?? null, computing: !!st?.cube?.computing || st === null, progress: st?.cube?.progress, error: st?.error ?? st?.cube?.error, computedAt: st?.cube?.computedAt };
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
const POT_COLOR = ["#7a4a06", "#a96a12", "#d08a1e", "#eab35a", "#f2d29c", "#d9dde4"];
const ONE_HUE = "#2d6fa8";
function colourOf(dim: Dim, label: string, i: number): string {
  if (dim === "prio") return PRIO_COLOR[label] ?? ONE_HUE;
  if (dim === "segment") return SEGMENT_COLOR[label] ?? "#8b97ac";
  if (dim === "potential") return POT_COLOR[i] ?? ONE_HUE;
  return ONE_HUE;
}

const moneyShort = (n: number) => {
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}€${Math.round(a / 1e3).toLocaleString("en")}K`;
  return `${sign}€${Math.round(a).toLocaleString("en")}`;
};
/** A bar's share of the longest; credit notes can leave a sum below zero, which draws nothing. */
const width = (x: number, max: number) => `${Math.max(0, Math.min(100, (100 * x) / max))}%`;
const pctOf = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");
const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
export const revenueWindow = (cube: Cube) => (cube.revenueMonths ? `Jan–${MONTHS[cube.revenueMonths - 1]}` : "no month loaded yet");

/* ── the four headline figures ────────────────────────────────────────── */

function Headline({ cube, a, all, compact = false }: { cube: Cube; a: Agg; all: Agg; compact?: boolean }) {
  const win = revenueWindow(cube);
  const sow = shareOfWallet(a, cube.revenueMonths);
  const filtered = a.n !== all.n;
  return (
    <Grid container spacing={compact ? 1.5 : 2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ApartmentOutlinedIcon />} tint="purple" label="Companies" value={full(a.n)}
          note={filtered ? `${pctOf(a.n, all.n)} of the ${full(all.n)} in HubSpot` : "every company in HubSpot"} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<ShoppingCartOutlinedIcon />} tint="green" label={`Bought in ${cube.year}`} value={full(a.bought)}
          note={`${pctOf(a.bought, a.n)} of them · ${cube.year - 1} whole year: ${full(a.boughtPy)}`} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<EuroOutlinedIcon />} tint="blue" label={`Revenue ${win}`} value={moneyShort(a.rev)}
          delta={{ ratio: change(a.rev, a.revPy), versus: `${win} ${cube.year - 1}` }} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile icon={<DonutLargeOutlinedIcon />} tint="amber" label="Share of wallet" value={sow == null ? "—" : `${(sow * 100).toFixed(1)}%`}
          note={`revenue ${win} against the yearly potential for the same months`} />
      </Grid>
    </Grid>
  );
}

/* ── a card of rows that drill down ───────────────────────────────────── */

type Measure = "n" | "rev";
/** name · bar · figures: the name gets the room, the bar takes what is left. */
const COLS = "minmax(130px, 1.25fr) minmax(64px, 1fr) 172px";

function DrillRows({ dim, rows, selected, measure, revenueMonths, onPick, hrefOf, limit }: {
  dim: Dim; rows: Row[]; selected?: string; measure: Measure; revenueMonths: number;
  onPick?: (label: string) => void; hrefOf?: (label: string) => string; limit: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => (measure === "n" ? r.n : Math.max(r.rev, r.revPy))));
  const sumRev = rows.reduce((s, r) => s + r.rev, 0);
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: COLS, gap: 1.5, px: 1, pb: 0.5 }}>
        {[DIM[dim].name, measure === "n" ? "Bought / all" : "This yr ┃ last yr", measure === "n" ? "Companies · bought" : "Revenue · share · change"].map((h, i) => (
          <Typography key={h} sx={{ fontSize: "0.66rem", fontWeight: 600, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 2 ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</Typography>
        ))}
      </Box>
      {shown.map((r) => {
        const colour = colourOf(dim, r.label, rows.indexOf(r));
        const on = selected === r.label;
        const faded = selected != null && !on;
        const ch = change(r.rev, r.revPy);
        const sow = shareOfWallet(r, revenueMonths);
        const tip = `${r.label}: ${full(r.n)} companies · ${full(r.bought)} bought this year (${pctOf(r.bought, r.n)}) · revenue ${moneyShort(r.rev)} (last year same months ${moneyShort(r.revPy)})${sow != null ? ` · share of wallet ${(sow * 100).toFixed(1)}%` : ""}`;
        const body = (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              {on ? <CheckIcon sx={{ fontSize: 15, color: colour, flexShrink: 0 }} /> : <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: colour, flexShrink: 0 }} />}
              <Typography sx={{ fontSize: "0.86rem", fontWeight: on ? 700 : 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
            </Box>
            <Box sx={{ position: "relative", height: 14, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
              {measure === "n" ? (
                <>
                  <Box sx={{ position: "absolute", inset: 0, width: width(r.n, max), minWidth: 4, bgcolor: `${colour}40`, borderRadius: 99 }} />
                  <Box sx={{ position: "absolute", inset: 0, width: width(r.bought, max), minWidth: r.bought ? 3 : 0, background: `linear-gradient(90deg, ${colour}cc, ${colour})`, borderRadius: 99 }} />
                </>
              ) : (
                <>
                  <Box sx={{ position: "absolute", inset: 0, width: width(r.rev, max), minWidth: r.rev > 0 ? 3 : 0, background: `linear-gradient(90deg, ${colour}cc, ${colour})`, borderRadius: 99 }} />
                  {r.revPy > 0 && <Box sx={{ position: "absolute", top: 1, bottom: 1, left: `calc(${width(r.revPy, max)} - 1px)`, width: 2, bgcolor: INK, opacity: 0.55, borderRadius: 1 }} />}
                </>
              )}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 0.75, whiteSpace: "nowrap" }}>
              {measure === "n" ? (
                <>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(r.n)}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{full(r.bought)} · {pctOf(r.bought, r.n)}</Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{moneyShort(r.rev)}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.rev > 0 ? pctOf(r.rev, sumRev) : "—"}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums", color: ch == null || Math.abs(ch) < 0.0005 ? FAINT : ch > 0 ? "#1b7a55" : RED }}>
                    {ch == null ? (r.rev > 0 ? "new" : "—") : `${ch > 0 ? "↑" : "↓"}${Math.abs(ch * 100).toFixed(0)}%`}
                  </Typography>
                </>
              )}
            </Box>
          </>
        );
        const sx = {
          display: "grid", gridTemplateColumns: COLS, gap: 1.5, alignItems: "center",
          px: 1, py: 0.7, borderRadius: "10px", textDecoration: "none", color: "inherit", cursor: "pointer",
          opacity: faded ? 0.45 : 1, bgcolor: on ? `${TINT[DIM[dim].tint].bg}` : "transparent",
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
      {rows.length > limit && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ justifySelf: "start", textTransform: "none", fontWeight: 600, mt: 0.5 }}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </Box>
  );
}

function DimCard({ cube, dim, filters, measure, onPick, onClear, limit = 8 }: {
  cube: Cube; dim: Dim; filters: Filters; measure: Measure; onPick: (d: Dim, label: string) => void; onClear: (d: Dim) => void; limit?: number;
}) {
  const rows = useMemo(() => breakdown(cube, dim, filters, measure), [cube, dim, filters, measure]);
  const d = DIM[dim];
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={d.icon} tint={d.tint} title={d.name} note={d.note}
        right={filters[dim] ? (
          <Chip size="small" label={`${filters[dim]} ×`} onClick={() => onClear(dim)} sx={{ height: 24, fontSize: "0.74rem", fontWeight: 700, bgcolor: TINT[d.tint].bg, color: TINT[d.tint].fg }} />
        ) : d.kpi ? <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.04em" }}>{d.kpi}</Typography> : undefined} />
      {rows.length ? (
        <DrillRows dim={dim} rows={rows} selected={filters[dim]} measure={measure} revenueMonths={cube.revenueMonths} limit={limit}
          onPick={(label) => (filters[dim] === label ? onClear(dim) : onPick(dim, label))} />
      ) : (
        <Typography sx={{ fontSize: "0.85rem", color: FAINT }}>No company matches these filters.</Typography>
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

/* ── the stage page ───────────────────────────────────────────────────── */

const ORDER: Dim[] = ["prio", "segment", "potential", "country", "owner", "type", "mandant"];

export function CustomersExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(DIMS.flatMap((d) => (params.get(d) ? [[d, params.get(d)!]] : []))));
  const [measure, setMeasure] = useState<Measure>(params.get("measure") === "revenue" ? "rev" : "n");

  // the view lives in the address: a drill-down can be sent on
  useEffect(() => {
    const q = new URLSearchParams();
    for (const d of DIMS) if (filters[d]) q.set(d, filters[d]!);
    if (measure === "rev") q.set("measure", "revenue");
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [filters, measure]);

  const pick = (d: Dim, label: string) => setFilters((f) => ({ ...f, [d]: label }));
  const clear = (d: Dim) => setFilters((f) => { const n = { ...f }; delete n[d]; return n; });
  const a = useMemo(() => (cube ? totals(cube, filters) : null), [cube, filters]);
  const all = useMemo(() => (cube ? totals(cube, {}) : null), [cube]);

  if (!cube || !a || !all) return <Waiting computing={computing} progress={progress} error={error} />;
  const active = DIMS.filter((d) => filters[d]);
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      {/* what is shown: the filters, and companies or revenue */}
      <Box sx={{ ...glass, borderRadius: "18px", px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", position: "sticky", top: 8, zIndex: 3 }}>
        <FilterAltOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
        {active.length === 0 ? (
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>All companies in HubSpot - click any row below to drill down</Typography>
        ) : (
          <>
            {active.map((d) => (
              <Chip key={d} label={<span><b>{DIM[d].name}:</b> {filters[d]}</span>} onDelete={() => clear(d)}
                sx={{ height: 28, fontSize: "0.8rem", bgcolor: TINT[DIM[d].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[d].tint].fg } }} />
            ))}
            <Button size="small" onClick={() => setFilters({})} sx={{ textTransform: "none", fontWeight: 600 }}>Clear all</Button>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={measure} onChange={(_, v) => v && setMeasure(v)}
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 1.5, py: 0.4, borderRadius: "9px" } }}>
          <ToggleButton value="n">Companies</ToggleButton>
          <ToggleButton value="rev">Revenue</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Headline cube={cube} a={a} all={all} />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
        {ORDER.map((d) => <DimCard key={d} cube={cube} dim={d} filters={filters} measure={measure} onPick={pick} onClear={clear} limit={d === "country" || d === "owner" ? 10 : 8} />)}
      </Box>

      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Every company in HubSpot{computedAt ? `, read ${new Date(computedAt).toLocaleString("en-GB")}` : ""}, every 6 hours. Bought = invoiced revenue in {cube.year} so far.
        Revenue = {revenueWindow(cube)}, against the same months of {cube.year - 1} (a month counts once it is loaded). Share of wallet leaves out potentials above €1M.
      </Typography>
    </Box>
  );
}

/* ── the macro page and the sales leader view: the same, in short ─────── */

export function CustomersSummary() {
  const { cube, computing, progress, error } = useCustomersCube();
  const a = useMemo(() => (cube ? totals(cube, {}) : null), [cube]);
  if (!cube || !a) return <Waiting computing={computing} progress={progress} error={error} />;
  const href = (d: Dim) => (label: string) => `${stageHref("customers")}?${new URLSearchParams({ [d]: label }).toString()}`;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Headline cube={cube} a={a} all={a} compact />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
        {(["prio", "segment"] as Dim[]).map((d) => (
          <Box key={d} sx={{ ...glass, borderRadius: "20px", p: 2 }}>
            <CardTitle icon={DIM[d].icon} tint={DIM[d].tint} title={d === "prio" ? "By sales priority" : "By APSO customer"} note="Click a row to drill down" />
            <DrillRows dim={d} rows={breakdown(cube, d, {})} measure="n" revenueMonths={cube.revenueMonths} hrefOf={href(d)} limit={6} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
