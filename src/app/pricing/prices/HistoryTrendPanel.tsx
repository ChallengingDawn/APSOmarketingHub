"use client";
import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const PALETTE = ["#ed1b2f", "#274e64", "#34a853", "#e08e0b", "#6d28d9", "#0d9488", "#c2185b", "#1565c0", "#827717", "#5f6368"];
const OVERALL_COLOR = "#1a1d21";   // the bold "overall index" line
const OVERALL_MIN_OVERLAP = 25;    // overall index needs ≥25 shared articles between two scrapes to chain

interface Competitor { id: number; code: string; name: string; market: string; currency: string; }
interface RawSeries { material: string; points: Record<string, number>; samples: Record<string, number>; n: number; }
interface TypeIdx { points: Record<string, number>; samples: Record<string, number>; }
interface DiagRow { month: string; date: string; products: number; overlapPrev: number | null; }
interface IdxResponse { months: string[]; base: string | null; overall: Record<string, number>; overallSamples: Record<string, number>; materials: RawSeries[]; byType?: Record<string, TypeIdx>; byTypeMaterial?: Record<string, Record<string, TypeIdx>>; diag?: DiagRow[]; }
interface CompIndex extends IdxResponse { code: string; }
interface Series { key: string; label: string; color: string; points: Record<string, number>; samples: Record<string, number>; }
interface ArticleChange { ref: string; name: string | null; material: string; ptype: string | null; prev: number; curr: number; pct: number | null; }
interface ChangesResp { prev: string | null; curr: string | null; count: number; articles: ArticleChange[]; }

const TYPE_BREAKDOWN: { key: string; label: string; color: string }[] = [
  { key: "round_bar", label: "Round bars", color: "#274e64" },
  { key: "tube", label: "Tubes", color: "#0d9488" },
  { key: "plate", label: "Plates", color: "#6d28d9" },
];

const fetchJson = (u: string) => fetch(u).then(r => r.json()).catch(() => ({}));
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx]); }
  }));
  return ret;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number, dp = 0) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
const idxColor = (v: number | null) => v == null ? "#9aa0a6" : v > 100.5 ? "#d32f2f" : v < 99.5 ? "#1e8e3e" : "#5f6368"; // up=pricier(red)
// Points are one per MONTH (value "YYYY-MM") — format as "Jun 26".
const fmtMonth = (m: string) => { const [y, mo] = m.slice(0, 7).split("-").map(Number); return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); };
const distinctDates = (dates: string[]) => [...new Set(dates.map(d => d.slice(0, 7)))];   // distinct MONTHS

// Rebase a chained index series so the first SELECTED month with data = 100.
function rebase(points: Record<string, number>, months: string[]): Record<string, number> {
  const first = months.find(m => points[m] != null);
  if (first == null) return {};
  const v0 = points[first];
  const out: Record<string, number> = {};
  for (const m of months) if (points[m] != null && v0) out[m] = round1((points[m] / v0) * 100);
  return out;
}

// Compact per-product-type index chart (competitor's own price/unit over the selected months).
function TypeMiniChart({ label, color, series, months }: { label: string; color: string; series?: TypeIdx; months: string[] }) {
  const disp = series ? rebase(series.points, months) : {};
  const ms = months.filter(m => disp[m] != null);
  const last = ms.length ? disp[ms[ms.length - 1]] : null;
  const chartData = months.map(m => ({ month: m, idx: disp[m] ?? null }));
  return (
    <Card variant="outlined" sx={{ flex: "1 1 260px", minWidth: 240, border: "1px solid #e6e8ec", borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#1a1d21" }}>{label}</Typography>
        </Box>
        {last != null && (
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 900, color: idxColor(last), lineHeight: 1 }}>{Math.round(last)}</Typography>
            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: idxColor(last) }}>{signed(last - 100, 1)}%</Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ height: 150, p: 1 }}>
        {ms.length < 1 ? (
          <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#bdc1c6", fontSize: "0.74rem", textAlign: "center" }}>No {label.toLowerCase()} price history</Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#9aa0a6" }} tickFormatter={fmtMonth} />
              <YAxis tick={{ fontSize: 9, fill: "#9aa0a6" }} width={30} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => [`Index ${v} (${signed(Number(v) - 100, 1)}%)`, label]} labelFormatter={(l) => fmtMonth(String(l))} contentStyle={{ fontSize: "0.7rem", borderRadius: 8, border: "1px solid #e6e8ec" }} />
              <ReferenceLine y={100} stroke="#cdd3da" strokeWidth={1.5} />
              <Line type="monotone" dataKey="idx" stroke={color} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Card>
  );
}

export default function HistoryTrendPanel() {
  const [available, setAvailable] = useState<Competitor[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});   // month count per competitor (tab label)
  const [cache, setCache] = useState<Record<number, CompIndex>>({});
  const [active, setActive] = useState<number | null>(null);
  const [selMats, setSelMats] = useState<Set<string>>(new Set());     // material families
  const [monthSel, setMonthSel] = useState<Set<string>>(new Set());   // months ticked
  const [changes, setChanges] = useState<Record<number, ChangesResp>>({});
  const [loading, setLoading] = useState(true);
  const [tabBusy, setTabBusy] = useState(false);
  const codeOf = (id: number) => available.find(c => c.id === id)?.code || cache[id]?.code || "";

  // On mount: list EVERY competitor (probe /competitor-scrapes for the month count shown on each
  // tab). Competitors with ≥2 months lead; the rest still appear so you can see their scrape state.
  useEffect(() => {
    let alive = true;
    (async () => {
      const comps: Competitor[] = await fetchJson(`${API_URL}/api/competitors`).then(j => Array.isArray(j) ? j : []);
      if (!alive) return;
      const cnt: Record<number, number> = {};
      await mapLimit(comps, 4, async (c) => {
        const dates: string[] = await fetchJson(`${API_URL}/api/analytics/competitor-scrapes?competitor_ids=${c.id}`)
          .then(j => (j.dates || []).map((x: string) => String(x).slice(0, 10)));
        cnt[c.id] = distinctDates(dates).length;
      });
      if (!alive) return;
      const avail = [...comps].sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || a.name.localeCompare(b.name));
      setCounts(cnt);
      setAvailable(avail);
      setActive(avail[0]?.id ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // Lazily load the active competitor's monthly index the first time it's opened.
  useEffect(() => {
    if (active == null || cache[active]) return;
    const code = codeOf(active);
    if (!code) return;
    let alive = true;
    setTabBusy(true);
    fetchJson(`${API_URL}/api/scrapers/${code}/price-changes`).then((j: ChangesResp) => { if (alive) setChanges(prev => ({ ...prev, [active]: j })); });
    fetchJson(`${API_URL}/api/scrapers/${code}/price-index`)
      .then((j: IdxResponse) => { if (alive) setCache(prev => ({ ...prev, [active]: { ...j, code, months: j.months || [], materials: j.materials || [], overall: j.overall || {}, overallSamples: j.overallSamples || {}, byType: j.byType || {}, byTypeMaterial: j.byTypeMaterial || {} } })); })
      .finally(() => { if (alive) setTabBusy(false); });
    return () => { alive = false; };
  }, [active, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = active != null ? cache[active] : undefined;
  const comp = available.find(c => c.id === active);

  // Default month + material selection whenever the competitor's data arrives.
  useEffect(() => {
    if (!data) return;
    setMonthSel(new Set(data.months));
    const top = [...data.materials].sort((a, b) => Object.keys(b.points).length - Object.keys(a.points).length || b.n - a.n)
      .slice(0, 5).map(m => m.material);
    setSelMats(new Set(top));
  }, [data]);

  const months = useMemo(() => (data?.months || []).filter(m => monthSel.has(m)), [data, monthSel]);

  // Build display series (rebased to first selected month) for Overall + each chosen material.
  const overallDisp = useMemo(() => data ? rebase(data.overall, months) : {}, [data, months]);
  const matSeries: Series[] = useMemo(() => {
    if (!data) return [];
    return data.materials.filter(m => selMats.has(m.material)).map((m, i) => ({
      key: m.material, label: m.material, color: PALETTE[data.materials.findIndex(x => x.material === m.material) % PALETTE.length] || PALETTE[i % PALETTE.length],
      points: rebase(m.points, months), samples: m.samples,
    }));
  }, [data, selMats, months]);

  const allSeries: Series[] = useMemo(() => [
    { key: "Overall", label: "Overall", color: OVERALL_COLOR, points: overallDisp, samples: data?.overallSamples || {} },
    ...matSeries,
  ], [overallDisp, matSeries, data]);

  const chartData = months.map(m => {
    const row: Record<string, string | number | null> = { month: m };
    for (const s of allSeries) row[s.label] = s.points[m] ?? null;
    return row;
  });

  // Headline (overall): latest vs base month.
  const overMonths = months.filter(m => overallDisp[m] != null);
  const firstM = overMonths[0] ?? null;
  const lastM = overMonths[overMonths.length - 1] ?? null;
  const overallLatest = lastM ? overallDisp[lastM] : null;
  // Show the chart when ANY line (overall OR a material) has ≥2 comparable months — the
  // overall can net to ~flat while individual materials clearly move, and we must not hide that.
  const ptsOf = (s: Series) => months.filter(m => s.points[m] != null).length;
  const anyTrend = allSeries.some(s => ptsOf(s) >= 2);
  const trulyFlat = anyTrend && allSeries.every(s => { const ms = months.filter(m => s.points[m] != null); return ms.length < 2 || ms.every(m => Math.abs(s.points[m] - 100) < 0.5); });
  // Breakdown follows a REAL material (never the "Other" catch-all), preferring one that has form data.
  const hasForms = (m: string) => !!(data?.byTypeMaterial?.[m] && Object.keys(data.byTypeMaterial[m]).length);
  const selKeys = matSeries.map(s => s.key);
  const primaryMat =
    selKeys.find(k => k !== "Other" && hasForms(k)) ??
    selKeys.find(k => k !== "Other") ??
    data?.materials.find(m => m.material !== "Other" && hasForms(m.material))?.material ??
    data?.materials.find(m => m.material !== "Other")?.material ??
    selKeys[0] ?? null;
  // Form breakdown (bars/tubes/plates) only applies to competitors selling semi-finished forms
  // — not e.g. O-Ring (sealing rings). Hide it when no bar/tube/plate data exists at all.
  const hasFormData = !!data && (Object.values(data.byTypeMaterial || {}).some(types => Object.keys(types).length > 0)
    || TYPE_BREAKDOWN.some(t => data.byType?.[t.key] && Object.keys(data.byType[t.key].points).length > 0));

  const toggleMat = (k: string) => setSelMats(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleMonth = (m: string) => setMonthSel(p => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });

  // End-of-line index pill (the wdk "136" badge), drawn only on each line's last real point.
  function idxBadge(s: Series) {
    let lastI = -1;
    chartData.forEach((row, i) => { if (row[s.label] != null) lastI = i; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => {
      if (props.index !== lastI || props.value == null) return null;
      const txt = String(Math.round(Number(props.value)));
      const w = 14 + txt.length * 9;
      return (
        <g>
          <rect x={props.x + 8} y={props.y - 11} width={w} height={22} rx={4} fill={s.color} />
          <text x={props.x + 8 + w / 2} y={props.y + 4} fontSize={12} fontWeight={800} fill="#fff" textAnchor="middle">{txt}</text>
        </g>
      );
    };
  }

  return (
    <Box className="animate-fade-in">
      {loading ? (
        <Card sx={{ border: "1px solid #e6e8ec", borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", fontWeight: 600 }}>Finding competitors with a price history…</Typography>
          </CardContent>
        </Card>
      ) : available.length === 0 ? (
        <Card sx={{ border: "1px solid #e6e8ec", borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1a1d21", mb: 0.5 }}>No price history yet</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#5f6368", maxWidth: 560, mx: "auto" }}>
              A competitor appears here once it has been scraped in at least two different months, so its price/unit can be tracked over time.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ border: "1px solid #e6e8ec", borderRadius: 2, overflow: "hidden" }}>
          <Tabs value={active ?? false} onChange={(_, v) => setActive(v)} variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: "1px solid #ececec", "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
              "& .MuiTabs-indicator": { backgroundColor: "#ed1b2f" }, "& .Mui-selected": { color: "#ed1b2f !important" } }}>
            {available.map(c => <Tab key={c.id} value={c.id} label={`${c.name} (${c.market}) · ${counts[c.id] ?? "?"} mo`} />)}
          </Tabs>
          <CardContent sx={{ p: 2 }}>
            {!data ? (
              <Box sx={{ py: 4 }}><LinearProgress sx={{ mb: 1 }} /><Typography sx={{ fontSize: "0.78rem", color: "#9aa0a6", textAlign: "center" }}>{tabBusy ? "Building monthly price index…" : "Loading…"}</Typography></Box>
            ) : data.months.length === 0 ? (
              <Typography sx={{ color: "#5f6368", fontSize: "0.85rem", py: 4, textAlign: "center" }}>No tier-1 price history for this competitor.</Typography>
            ) : (
              <>
                {/* Scrapes to compare (one point per scrape date) */}
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mb: 1.5, p: 1, bgcolor: "#f8f9fa", borderRadius: 2, border: "1px solid #ececec" }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mr: 1 }}>Months:</Typography>
                  {data.months.map(m => {
                    const n = data.overallSamples[m] || 0;
                    return (
                      <FormControlLabel key={m}
                        control={<Checkbox size="small" checked={monthSel.has(m)} onChange={() => toggleMonth(m)} sx={{ py: 0.25, "&.Mui-checked": { color: "#274e64" } }} />}
                        label={<Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#3c4043" }}>{fmtMonth(m)} <span style={{ color: "#9aa0a6", fontWeight: 400 }}>· {n} art.</span></Typography>}
                        sx={{ mr: 1.5, ml: 0 }} />
                    );
                  })}
                </Box>

                {/* Material chips */}
                {data.materials.length > 0 && (() => {
                  const allOn = data.materials.every(m => selMats.has(m.material));
                  return (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
                      <Chip label={allOn ? "Clear all" : "Select all"} size="small"
                        onClick={() => setSelMats(allOn ? new Set() : new Set(data.materials.map(m => m.material)))}
                        sx={{ fontWeight: 700, cursor: "pointer", bgcolor: "#fff", color: "#274e64",
                          border: "1px solid #274e64", "&:hover": { bgcolor: "#eef3f6" } }} />
                      {data.materials.map((m, i) => (
                        <Chip key={m.material} label={`${m.material} (${Object.keys(m.points).length})`} size="small"
                          onClick={() => toggleMat(m.material)}
                          sx={{ fontWeight: 600, cursor: "pointer",
                            bgcolor: selMats.has(m.material) ? PALETTE[i % PALETTE.length] : "#f1f3f4",
                            color: selMats.has(m.material) ? "#fff" : "#3c4043", "&:hover": { opacity: 0.9 } }} />
                      ))}
                    </Box>
                  );
                })()}

                {/* ═══════════ wdk-style PRICE INDEX hero ═══════════ */}
                <Card variant="outlined" sx={{ border: "1px solid #e6e8ec", borderRadius: 2, overflow: "hidden", mb: 2.5 }}>
                  <Box sx={{ px: 2.5, py: 1.5, background: "linear-gradient(90deg, #ed1b2f 0%, #c5152a 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography sx={{ color: "#fff", fontSize: "1.15rem", fontWeight: 800, lineHeight: 1.1 }}>Price Index{comp ? ` · ${comp.name}` : ""}</Typography>
                      <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: "0.7rem", fontWeight: 500 }}>
                        competitor&apos;s own price/unit · constant basket (same articles month-over-month) · base month = 100
                      </Typography>
                    </Box>
                    {overallLatest != null && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lastM ? fmtMonth(lastM) : "Latest"}</Typography>
                          <Typography sx={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}>{signed(overallLatest - 100, 1)}% vs base</Typography>
                        </Box>
                        <Box sx={{ bgcolor: "#fff", borderRadius: 1.5, px: 1.5, py: 0.5, minWidth: 64, textAlign: "center" }}>
                          <Typography sx={{ color: "#ed1b2f", fontSize: "1.7rem", fontWeight: 900, lineHeight: 1 }}>{Math.round(overallLatest)}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "stretch" }}>
                    {/* Overall index by month — readable rows: month, index, change vs previous, basket size */}
                    <Box sx={{ flex: "0 0 auto", minWidth: 230, borderRight: { md: "1px solid #eef0f3" }, borderBottom: { xs: "1px solid #eef0f3", md: "none" }, p: 1.5 }}>
                      <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, color: "#9aa1ab", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.75 }}>Index by month</Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {overMonths.map((m, i) => {
                          const v = overallDisp[m];
                          const prev = i > 0 ? overallDisp[overMonths[i - 1]] : null;
                          const mom = prev != null ? v - prev : null;
                          return (
                            <Box key={m} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1, py: 0.75, borderRadius: 1.5, bgcolor: "#f5f8fa", border: "1px solid #eef0f3" }}>
                              <Box>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1d21" }}>{fmtMonth(m)}</Typography>
                                <Typography sx={{ fontSize: "0.62rem", color: "#9aa0a6" }}>{data.overallSamples[m] || 0} articles</Typography>
                              </Box>
                              <Box sx={{ textAlign: "right" }}>
                                <Typography sx={{ fontSize: "1.05rem", fontWeight: 900, color: idxColor(v ?? null), lineHeight: 1 }}>{v != null ? v : "—"}</Typography>
                                {mom != null && <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: idxColor(v ?? null) }}>{signed(mom, 1)} vs prev</Typography>}
                                {mom == null && <Typography sx={{ fontSize: "0.6rem", color: "#bdc1c6" }}>base = 100</Typography>}
                              </Box>
                            </Box>
                          );
                        })}
                        {overMonths.length === 0 && <Typography sx={{ fontSize: "0.74rem", color: "#bdc1c6", py: 1 }}>No comparable months.</Typography>}
                      </Box>
                    </Box>

                    {/* Index line chart */}
                    <Box sx={{ flex: 1, minWidth: 0, p: 1.5, height: 400, display: "flex", flexDirection: "column" }}>
                      {!anyTrend ? (
                        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, px: 3, textAlign: "center" }}>
                          <Box sx={{ px: 1.5, py: 0.4, borderRadius: 5, bgcolor: "#fff8e1", border: "1px solid #ffe08a", color: "#8a6d00", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>{(data.diag?.length || 0) >= 2 ? "Scrapes don't overlap" : "One scrape so far"}</Box>
                          <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1a1d21" }}>No trend yet</Typography>
                          <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", maxWidth: 480 }}>
                            A price index needs <b>two scrapes that share the same articles</b>. {comp?.name} {(data.diag?.length || 0) >= 2
                              ? "has been scraped more than once, but consecutive scrapes share too few common articles (or sit on a different price basis) to chain into an index."
                              : "has only one usable scrape so far."} The curve starts as soon as it&apos;s scraped again with an overlapping catalogue.
                          </Typography>
                          {data.diag && data.diag.length > 0 && (
                            <Box sx={{ mt: 0.5, width: "100%", maxWidth: 460 }}>
                              <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: "#9aa1ab", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.5 }}>Scrapes on record</Typography>
                              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "& th": { fontSize: "0.62rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", textAlign: "right", p: "5px 8px", borderBottom: "1px solid #e6e8ec", bgcolor: "#f8f9fa" }, "& th:first-of-type, & td:first-of-type": { textAlign: "left" }, "& td": { fontSize: "0.74rem", p: "5px 8px", borderBottom: "1px solid #f0f1f3", textAlign: "right", fontFamily: "monospace" } }}>
                                <thead><tr><th>Scrape date</th><th>Priced articles</th><th>Shared w/ previous</th></tr></thead>
                                <tbody>
                                  {data.diag.map(d => (
                                    <tr key={d.month}>
                                      <td style={{ fontWeight: 700 }}>{d.date}</td>
                                      <td>{d.products.toLocaleString()}</td>
                                      <td style={{ color: d.overlapPrev == null ? "#9aa0a6" : d.overlapPrev < OVERALL_MIN_OVERLAP ? "#d32f2f" : "#1e8e3e", fontWeight: 700 }}>
                                        {d.overlapPrev == null ? "— first" : `${d.overlapPrev}${d.overlapPrev < OVERALL_MIN_OVERLAP ? " ⚠" : " ✓"}`}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Box>
                              <Typography sx={{ fontSize: "0.64rem", color: "#9aa0a6", mt: 0.5, textAlign: "left" }}>Need ≥{OVERALL_MIN_OVERLAP} shared articles between two scrapes for the overall index to chain.</Typography>
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <>
                          {trulyFlat && (
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start", px: 1.25, py: 0.4, mb: 0.5, borderRadius: 5, bgcolor: "#e6f4ea", border: "1px solid #a8dab5", color: "#1e7e45", fontSize: "0.7rem", fontWeight: 700 }}>
                              No price change since last update — {comp?.name} held prices flat {firstM ? fmtMonth(firstM) : ""}→{lastM ? fmtMonth(lastM) : ""}.
                            </Box>
                          )}
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 12, right: 72, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5b6470" }} tickFormatter={fmtMonth} />
                            <YAxis tick={{ fontSize: 11, fill: "#5b6470" }} width={44} domain={["auto", "auto"]} />
                            <Tooltip formatter={(v, name) => [`Index ${v} (${signed(Number(v) - 100, 1)}%)`, name as string]} labelFormatter={(l) => fmtMonth(String(l))}
                              contentStyle={{ fontSize: "0.72rem", borderRadius: 8, border: "1px solid #e6e8ec" }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <ReferenceLine y={100} stroke="#9aa0a6" strokeWidth={2} label={{ value: "100", position: "left", fontSize: 10, fill: "#9aa0a6", fontWeight: 700 }} />
                            {allSeries.map(s => (
                              <Line key={s.key} type="monotone" dataKey={s.label} stroke={s.color}
                                strokeWidth={s.key === "Overall" ? 3 : 2} strokeDasharray={s.key === "Overall" ? undefined : "4 2"}
                                dot={{ r: s.key === "Overall" ? 3 : 2.5 }} connectNulls label={idxBadge(s)} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                        </>
                      )}
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: "0.68rem", color: "#9aa0a6", px: 1.5, pb: 1.25 }}>
                    Each point is <b>{comp?.name}</b>&apos;s own price per unit, indexed to the base month = 100, chained month-over-month over the articles present in <b>both</b> consecutive months (a real same-article price move, not a basket change). The badge at each line end is the latest index; <b>above 100 = prices rose</b>. The bold black line is all articles; dashed lines are per polymer family.
                  </Typography>
                </Card>

                {/* Breakdown by material × product type — e.g. POM round bars / POM plates.
                    Only for competitors selling semi-finished forms (hidden for O-rings etc.). */}
                {hasFormData && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                    Breakdown by form — {primaryMat ? <Box component="span" sx={{ color: "#1a1d21" }}>{primaryMat}</Box> : "select a material"} <Box component="span" sx={{ color: "#bdc1c6", textTransform: "none", fontWeight: 500 }}>(click a material chip above to switch)</Box>
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                    {TYPE_BREAKDOWN.map(t => (
                      <TypeMiniChart key={t.key} label={`${primaryMat ? primaryMat + " " : ""}${t.label.toLowerCase()}`} color={t.color}
                        series={primaryMat ? data.byTypeMaterial?.[primaryMat]?.[t.key] : data.byType?.[t.key]} months={months} />
                    ))}
                  </Box>
                </Box>
                )}

                {/* KPI cards — latest index + change per selected material (only when there's a real trend) */}
                {anyTrend && matSeries.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 0.5 }}>
                    {matSeries.map(s => {
                      const ms = months.filter(m => s.points[m] != null);
                      const ld = ms[ms.length - 1];
                      const last = ld ? s.points[ld] : null;
                      const chg = last != null ? last - 100 : null;
                      const up = chg != null && chg > 0.05, down = chg != null && chg < -0.05;
                      const dc = up ? "#d32f2f" : down ? "#1e8e3e" : "#5f6368";
                      const dbg = up ? "#fce8e6" : down ? "#e6f4ea" : "#f1f3f4";
                      return (
                        <Card key={s.key} onClick={() => toggleMat(s.key)}
                          sx={{ flex: "1 1 200px", minWidth: 200, maxWidth: 270, cursor: "pointer", position: "relative", overflow: "hidden",
                            border: "1px solid #ececec", borderRadius: 3, transition: "box-shadow .15s, transform .15s",
                            "&:hover": { boxShadow: "0 6px 18px rgba(0,0,0,0.08)", transform: "translateY(-2px)" } }}>
                          <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: s.color }} />
                          <CardContent sx={{ p: 1.75, pl: 2.25, "&:last-child": { pb: 1.75 } }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color }} />
                                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#1f1f1f" }}>{s.label}</Typography>
                              </Box>
                              <Box sx={{ fontSize: "0.52rem", fontWeight: 700, color: "#80868b", letterSpacing: "0.08em", border: "1px solid #e0e0e0", borderRadius: 0.75, px: 0.55, py: 0.15 }}>
                                {ld ? `${s.samples[ld] || 0} ART.` : "—"}
                              </Box>
                            </Box>
                            <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: idxColor(last), lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                              {last != null ? Math.round(last) : "—"}
                            </Typography>
                            <Typography sx={{ fontSize: "0.6rem", color: "#9aa0a6", mt: 0.15, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              index{ld ? ` · ${fmtMonth(ld)}` : ""}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.85, mt: 1.1 }}>
                              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: dbg, color: dc, borderRadius: 1, px: 0.9, py: 0.3 }}>
                                {up ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : down ? <ArrowDownwardIcon sx={{ fontSize: 14 }} /> : <RemoveIcon sx={{ fontSize: 14 }} />}
                                <Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>{chg != null ? `${signed(chg, 1)}%` : "n/a"}</Typography>
                              </Box>
                              <Typography sx={{ fontSize: "0.68rem", color: "#9aa0a6" }}>vs base month</Typography>
                            </Box>
                            <Typography sx={{ fontSize: "0.62rem", color: "#bdc1c6", mt: 0.7 }}>price move on same articles</Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}

                {/* Detail table — index per month per selected material (only when there's a real trend) */}
                {anyTrend && matSeries.length > 0 && months.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Detail — index per month</Typography>
                    <TableContainer sx={{ border: "1px solid #ececec", borderRadius: 2, overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", textTransform: "uppercase" }}>Material</TableCell>
                            {months.map(m => <TableCell key={m} align="right" sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", whiteSpace: "nowrap" }}>{fmtMonth(m)}</TableCell>)}
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", bgcolor: "#e8f5e9" }}>Δ %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {matSeries.map(s => {
                            const ms = months.filter(m => s.points[m] != null);
                            const last = ms.length ? s.points[ms[ms.length - 1]] : null;
                            const chg = last != null ? last - 100 : null;
                            return (
                              <TableRow key={s.key} hover>
                                <TableCell>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: s.color }} />
                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{s.label}</Typography>
                                  </Box>
                                </TableCell>
                                {months.map(m => (
                                  <TableCell key={m} align="right" sx={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 600, color: s.points[m] != null ? idxColor(s.points[m]) : "#dadce0" }}>
                                    {s.points[m] != null ? s.points[m] : "—"}
                                  </TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 700, color: idxColor(last), bgcolor: "#f0fdf4" }}>
                                  {chg != null ? signed(chg, 1) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {/* Matched articles — the actual overlapping articles behind the index (proof) */}
                {(() => {
                  const ch = active != null ? changes[active] : undefined;
                  if (!ch || !ch.articles?.length || !ch.prev || !ch.curr) return null;
                  const inMat = primaryMat ? ch.articles.filter(a => a.material === primaryMat) : ch.articles;
                  const rows = inMat.slice(0, 80);
                  if (!rows.length) return null;
                  const fmtP = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  const formLbl = (t: string | null) => t === "round_bar" ? "bar" : t === "tube" ? "tube" : t === "plate" ? "plate" : (t || "—");
                  return (
                    <Box sx={{ mt: 2.5 }}>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                        Matched articles{primaryMat ? ` · ${primaryMat}` : ""} — {fmtMonth(ch.prev)} → {fmtMonth(ch.curr)}
                        <Box component="span" sx={{ color: "#bdc1c6", fontWeight: 500, textTransform: "none" }}> · same article in both scrapes · {rows.length} of {inMat.length} shown (biggest move first)</Box>
                      </Typography>
                      <TableContainer sx={{ border: "1px solid #ececec", borderRadius: 2, maxHeight: 360, overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow sx={{ "& th": { bgcolor: "#f8f9fa", fontWeight: 700, fontSize: "0.66rem", color: "#5f6368", textTransform: "uppercase" } }}>
                              <TableCell>Article</TableCell>
                              <TableCell>Form</TableCell>
                              <TableCell align="right">{fmtMonth(ch.prev)}</TableCell>
                              <TableCell align="right">{fmtMonth(ch.curr)}</TableCell>
                              <TableCell align="right">Δ %</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((a, i) => {
                              const col = a.pct == null ? "#9aa0a6" : a.pct > 0.05 ? "#d32f2f" : a.pct < -0.05 ? "#1e8e3e" : "#5f6368";
                              return (
                                <TableRow key={a.ref + i} hover>
                                  <TableCell sx={{ maxWidth: 320 }}>
                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, fontFamily: "monospace", color: "#274e64" }}>{a.ref}</Typography>
                                    <Typography sx={{ fontSize: "0.66rem", color: "#9aa0a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{a.name || ""}</Typography>
                                  </TableCell>
                                  <TableCell sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{formLbl(a.ptype)}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: "0.74rem", fontFamily: "monospace", color: "#5f6368" }}>{fmtP(a.prev)}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: "0.74rem", fontFamily: "monospace", fontWeight: 700, color: "#1a1d21" }}>{fmtP(a.curr)}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: "0.78rem", fontWeight: 800, color: col }}>{a.pct != null ? `${signed(a.pct, 1)}%` : "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && (
        <Typography sx={{ fontSize: "0.68rem", color: "#9aa0a6", mt: 1.25, lineHeight: 1.6 }}>
Every competitor is listed (sorted by months of history); a price index appears once two scrapes share enough articles to chain — until then the tab shows its scrapes on record. Notes: <Box component="span" sx={{ fontWeight: 700, color: "#5f6368" }}>Reiff</Box> — acquired by Magg, scraping policy-blocked (no new data). <Box component="span" sx={{ fontWeight: 700, color: "#5f6368" }}>Kahmann &amp; Ellerbrock</Box> — first scrape 06 Jun; a trend appears after its next scrape.
        </Typography>
      )}
    </Box>
  );
}
