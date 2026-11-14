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
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const PALETTE = ["#c8463a", "#274e64", "#34a853", "#e08e0b", "#6d28d9", "#0d9488", "#c2185b", "#1565c0", "#827717", "#5d6b85"];
const OVERALL_COLOR = "#15223a";
const OVERALL_MIN_OVERLAP = 10;  // overall index needs ≥10 shared codes between two price lists to chain

interface SupplierInfo { supplier: string; dates: number; lists: number; latest: string | null; }
interface RawSeries { material: string; points: Record<string, number>; samples: Record<string, number>; n: number; }
interface TypeIdx { points: Record<string, number>; samples: Record<string, number>; }
interface DiagRow { date: string; products: number; overlapPrev: number | null; }
interface IdxResponse { supplier: string; months: string[]; base: string | null; overall: Record<string, number>; overallSamples: Record<string, number>; materials: RawSeries[]; byType?: Record<string, TypeIdx>; byTypeMaterial?: Record<string, Record<string, TypeIdx>>; diag?: DiagRow[]; }
interface Series { key: string; label: string; color: string; points: Record<string, number>; samples: Record<string, number>; }
interface ArticleChange { ref: string; name: string | null; material: string; ptype: string | null; prev: number; curr: number; pct: number | null; }
interface ChangesResp { prev: string | null; curr: string | null; count: number; articles: ArticleChange[]; }

const TYPE_BREAKDOWN: { key: string; label: string; color: string }[] = [
  { key: "round_bar", label: "Round bars", color: "#274e64" },
  { key: "tube", label: "Tubes", color: "#0d9488" },
  { key: "plate", label: "Plates", color: "#6d28d9" },
];

const fetchJson = (u: string) => fetch(u).then(r => r.json()).catch(() => ({}));
const round1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number, dp = 0) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
const idxColor = (v: number | null) => v == null ? "#8b97ac" : v > 100.5 ? "#d32f2f" : v < 99.5 ? "#1e8e3e" : "#5d6b85"; // up = pricier (red)
// Points are one per price-list DATE ("YYYY-MM-DD") — format as "27 Mar 26".
const fmtDate = (d: string) => { const [y, m, day] = d.slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, day || 1).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }); };

function rebase(points: Record<string, number>, dates: string[]): Record<string, number> {
  const first = dates.find(m => points[m] != null);
  if (first == null) return {};
  const v0 = points[first];
  const out: Record<string, number> = {};
  for (const m of dates) if (points[m] != null && v0) out[m] = round1((points[m] / v0) * 100);
  return out;
}

function TypeMiniChart({ label, color, series, dates }: { label: string; color: string; series?: TypeIdx; dates: string[] }) {
  const disp = series ? rebase(series.points, dates) : {};
  const ms = dates.filter(m => disp[m] != null);
  const last = ms.length ? disp[ms[ms.length - 1]] : null;
  const chartData = dates.map(m => ({ date: m, idx: disp[m] ?? null }));
  return (
    <Card variant="outlined" sx={{ flex: "1 1 260px", minWidth: 240, border: "1px solid #e4e9f1", borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid #eef2f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#15223a" }}>{label}</Typography>
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
          <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#b5bfcf", fontSize: "0.74rem", textAlign: "center" }}>No {label.toLowerCase()} price history</Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#8b97ac" }} tickFormatter={fmtDate} />
              <YAxis tick={{ fontSize: 9, fill: "#8b97ac" }} width={30} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => [`Index ${v} (${signed(Number(v) - 100, 1)}%)`, label]} labelFormatter={(l) => fmtDate(String(l))} contentStyle={{ fontSize: "0.7rem", borderRadius: 8, border: "1px solid #e4e9f1" }} />
              <ReferenceLine y={100} stroke="#cdd3da" strokeWidth={1.5} />
              <Line type="monotone" dataKey="idx" stroke={color} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Card>
  );
}

export default function SupplierTrendPanel() {
  const [available, setAvailable] = useState<SupplierInfo[]>([]);
  const [cache, setCache] = useState<Record<string, IdxResponse>>({});
  const [active, setActive] = useState<string | null>(null);
  const [selMats, setSelMats] = useState<Set<string>>(new Set());
  const [dateSel, setDateSel] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Record<string, ChangesResp>>({});
  const [loading, setLoading] = useState(true);
  const [tabBusy, setTabBusy] = useState(false);

  // On mount: list suppliers that have ingested price lists (tab label shows their #dates).
  useEffect(() => {
    let alive = true;
    (async () => {
      const j = await fetchJson(`${API_URL}/api/purchasing/suppliers-with-history`);
      if (!alive) return;
      const sups: SupplierInfo[] = Array.isArray(j.suppliers) ? j.suppliers : [];
      setAvailable(sups);
      setActive(sups[0]?.supplier ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // Lazily load the active supplier's index + the article moves behind it.
  useEffect(() => {
    if (active == null || cache[active]) return;
    let alive = true;
    setTabBusy(true);
    const q = encodeURIComponent(active);
    fetchJson(`${API_URL}/api/purchasing/price-changes?supplier=${q}`).then((j: ChangesResp) => { if (alive) setChanges(prev => ({ ...prev, [active]: j })); });
    fetchJson(`${API_URL}/api/purchasing/price-index?supplier=${q}`)
      .then((j: IdxResponse) => { if (alive) setCache(prev => ({ ...prev, [active]: { ...j, months: j.months || [], materials: j.materials || [], overall: j.overall || {}, overallSamples: j.overallSamples || {}, byType: j.byType || {}, byTypeMaterial: j.byTypeMaterial || {} } })); })
      .finally(() => { if (alive) setTabBusy(false); });
    return () => { alive = false; };
  }, [active, cache]);

  const data = active != null ? cache[active] : undefined;

  useEffect(() => {
    if (!data) return;
    setDateSel(new Set(data.months));
    const top = [...data.materials].sort((a, b) => Object.keys(b.points).length - Object.keys(a.points).length || b.n - a.n).slice(0, 5).map(m => m.material);
    setSelMats(new Set(top));
  }, [data]);

  const dates = useMemo(() => (data?.months || []).filter(m => dateSel.has(m)), [data, dateSel]);
  const overallDisp = useMemo(() => data ? rebase(data.overall, dates) : {}, [data, dates]);
  const matSeries: Series[] = useMemo(() => {
    if (!data) return [];
    return data.materials.filter(m => selMats.has(m.material)).map((m, i) => ({
      key: m.material, label: m.material, color: PALETTE[data.materials.findIndex(x => x.material === m.material) % PALETTE.length] || PALETTE[i % PALETTE.length],
      points: rebase(m.points, dates), samples: m.samples,
    }));
  }, [data, selMats, dates]);

  const allSeries: Series[] = useMemo(() => [
    { key: "Overall", label: "Overall", color: OVERALL_COLOR, points: overallDisp, samples: data?.overallSamples || {} },
    ...matSeries,
  ], [overallDisp, matSeries, data]);

  const chartData = dates.map(m => {
    const row: Record<string, string | number | null> = { date: m };
    for (const s of allSeries) row[s.label] = s.points[m] ?? null;
    return row;
  });

  const overDates = dates.filter(m => overallDisp[m] != null);
  const firstM = overDates[0] ?? null;
  const lastM = overDates[overDates.length - 1] ?? null;
  const overallLatest = lastM ? overallDisp[lastM] : null;
  const ptsOf = (s: Series) => dates.filter(m => s.points[m] != null).length;
  const anyTrend = allSeries.some(s => ptsOf(s) >= 2);
  const trulyFlat = anyTrend && allSeries.every(s => { const ms = dates.filter(m => s.points[m] != null); return ms.length < 2 || ms.every(m => Math.abs(s.points[m] - 100) < 0.5); });
  const hasForms = (m: string) => !!(data?.byTypeMaterial?.[m] && Object.keys(data.byTypeMaterial[m]).length);
  const selKeys = matSeries.map(s => s.key);
  const primaryMat =
    selKeys.find(k => k !== "Other" && hasForms(k)) ??
    selKeys.find(k => k !== "Other") ??
    data?.materials.find(m => m.material !== "Other" && hasForms(m.material))?.material ??
    data?.materials.find(m => m.material !== "Other")?.material ??
    selKeys[0] ?? null;
  const hasFormData = !!data && (Object.values(data.byTypeMaterial || {}).some(types => Object.keys(types).length > 0)
    || TYPE_BREAKDOWN.some(t => data.byType?.[t.key] && Object.keys(data.byType[t.key].points).length > 0));

  const toggleMat = (k: string) => setSelMats(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleDate = (m: string) => setDateSel(p => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });

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
        <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography sx={{ fontSize: "0.85rem", color: "#5d6b85", fontWeight: 600 }}>Finding suppliers with a price history…</Typography>
          </CardContent>
        </Card>
      ) : available.length === 0 ? (
        <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a", mb: 0.5 }}>No supplier price lists yet</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#5d6b85", maxWidth: 560, mx: "auto" }}>
              A supplier appears here once you&apos;ve ingested a price list for it. Upload a second list with a later valid-from date and its price index starts to chart.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2, overflow: "hidden" }}>
          <Tabs value={active ?? false} onChange={(_, v) => setActive(v)} variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: "1px solid #e4e9f1", "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
              "& .MuiTabs-indicator": { backgroundColor: "#c8463a" }, "& .Mui-selected": { color: "#c8463a !important" } }}>
            {available.map(s => <Tab key={s.supplier} value={s.supplier} label={`${s.supplier} · ${s.dates} ${s.dates === 1 ? "list" : "dates"}`} />)}
          </Tabs>
          <CardContent sx={{ p: 2 }}>
            {!data ? (
              <Box sx={{ py: 4 }}><LinearProgress sx={{ mb: 1 }} /><Typography sx={{ fontSize: "0.78rem", color: "#8b97ac", textAlign: "center" }}>{tabBusy ? "Building supplier price index…" : "Loading…"}</Typography></Box>
            ) : data.months.length === 0 ? (
              <Typography sx={{ color: "#5d6b85", fontSize: "0.85rem", py: 4, textAlign: "center" }}>No priced rows for this supplier.</Typography>
            ) : (
              <>
                {/* Price-list dates to compare (one point per valid-from date) */}
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mb: 1.5, p: 1, bgcolor: "#f5f7fb", borderRadius: 2, border: "1px solid #e4e9f1" }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: "0.05em", mr: 1 }}>Price-list dates:</Typography>
                  {data.months.map(m => {
                    const n = data.overallSamples[m] || 0;
                    return (
                      <FormControlLabel key={m}
                        control={<Checkbox size="small" checked={dateSel.has(m)} onChange={() => toggleDate(m)} sx={{ py: 0.25, "&.Mui-checked": { color: "#274e64" } }} />}
                        label={<Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#4a5a70" }}>{fmtDate(m)} <span style={{ color: "#8b97ac", fontWeight: 400 }}>· {n} art.</span></Typography>}
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
                        sx={{ fontWeight: 700, cursor: "pointer", bgcolor: "#fff", color: "#274e64", border: "1px solid #274e64", "&:hover": { bgcolor: "#eef3f6" } }} />
                      {data.materials.map((m, i) => (
                        <Chip key={m.material} label={`${m.material} (${Object.keys(m.points).length})`} size="small"
                          onClick={() => toggleMat(m.material)}
                          sx={{ fontWeight: 600, cursor: "pointer", bgcolor: selMats.has(m.material) ? PALETTE[i % PALETTE.length] : "#eef2f8", color: selMats.has(m.material) ? "#fff" : "#4a5a70", "&:hover": { opacity: 0.9 } }} />
                      ))}
                    </Box>
                  );
                })()}

                {/* ═══════════ PRICE INDEX hero ═══════════ */}
                <Card variant="outlined" sx={{ border: "1px solid #e4e9f1", borderRadius: 2, overflow: "hidden", mb: 2.5 }}>
                  <Box sx={{ px: 2.5, py: 1.5, background: "linear-gradient(90deg, #274e64 0%, #1d3a4d 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography sx={{ color: "#fff", fontSize: "1.15rem", fontWeight: 800, lineHeight: 1.1 }}>Supplier Price Index{active ? ` · ${active}` : ""}</Typography>
                      <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: "0.7rem", fontWeight: 500 }}>
                        supplier&apos;s own price per article · constant basket (same article across price lists) · base date = 100
                      </Typography>
                    </Box>
                    {overallLatest != null && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{lastM ? fmtDate(lastM) : "Latest"}</Typography>
                          <Typography sx={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}>{signed(overallLatest - 100, 1)}% vs base</Typography>
                        </Box>
                        <Box sx={{ bgcolor: "#fff", borderRadius: 1.5, px: 1.5, py: 0.5, minWidth: 64, textAlign: "center" }}>
                          <Typography sx={{ color: "#274e64", fontSize: "1.7rem", fontWeight: 900, lineHeight: 1 }}>{Math.round(overallLatest)}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "stretch" }}>
                    {/* Overall index by date */}
                    <Box sx={{ flex: "0 0 auto", minWidth: 230, borderRight: { md: "1px solid #eef2f8" }, borderBottom: { xs: "1px solid #eef2f8", md: "none" }, p: 1.5 }}>
                      <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, color: "#8b97ac", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.75 }}>Index by date</Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {overDates.map((m, i) => {
                          const v = overallDisp[m];
                          const prev = i > 0 ? overallDisp[overDates[i - 1]] : null;
                          const mom = prev != null ? v - prev : null;
                          return (
                            <Box key={m} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1, py: 0.75, borderRadius: 1.5, bgcolor: "#f5f8fa", border: "1px solid #eef2f8" }}>
                              <Box>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#15223a" }}>{fmtDate(m)}</Typography>
                                <Typography sx={{ fontSize: "0.62rem", color: "#8b97ac" }}>{data.overallSamples[m] || 0} articles</Typography>
                              </Box>
                              <Box sx={{ textAlign: "right" }}>
                                <Typography sx={{ fontSize: "1.05rem", fontWeight: 900, color: idxColor(v ?? null), lineHeight: 1 }}>{v != null ? v : "—"}</Typography>
                                {mom != null && <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: idxColor(v ?? null) }}>{signed(mom, 1)} vs prev</Typography>}
                                {mom == null && <Typography sx={{ fontSize: "0.6rem", color: "#b5bfcf" }}>base = 100</Typography>}
                              </Box>
                            </Box>
                          );
                        })}
                        {overDates.length === 0 && <Typography sx={{ fontSize: "0.74rem", color: "#b5bfcf", py: 1 }}>No comparable dates.</Typography>}
                      </Box>
                    </Box>

                    {/* Index line chart */}
                    <Box sx={{ flex: 1, minWidth: 0, p: 1.5, height: 400, display: "flex", flexDirection: "column" }}>
                      {!anyTrend ? (
                        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, px: 3, textAlign: "center" }}>
                          <Box sx={{ px: 1.5, py: 0.4, borderRadius: 5, bgcolor: "#fff8e1", border: "1px solid #ffe08a", color: "#8a6d00", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>{(data.diag?.length || 0) >= 2 ? "Lists don't overlap" : "One price list so far"}</Box>
                          <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a" }}>No trend yet</Typography>
                          <Typography sx={{ fontSize: "0.8rem", color: "#5d6b85", maxWidth: 480 }}>
                            A price index needs <b>two price lists that share the same articles</b>. {active} {(data.diag?.length || 0) >= 2
                              ? "has more than one price list, but consecutive lists share too few common articles (or sit on a different price basis) to chain into an index."
                              : "has only one price list so far."} The curve starts as soon as a later list with overlapping articles is ingested.
                          </Typography>
                          {data.diag && data.diag.length > 0 && (
                            <Box sx={{ mt: 0.5, width: "100%", maxWidth: 460 }}>
                              <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: "#8b97ac", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.5 }}>Price lists on record</Typography>
                              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "& th": { fontSize: "0.62rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", textAlign: "right", p: "5px 8px", borderBottom: "1px solid #e4e9f1", bgcolor: "#f5f7fb" }, "& th:first-of-type, & td:first-of-type": { textAlign: "left" }, "& td": { fontSize: "0.74rem", p: "5px 8px", borderBottom: "1px solid #f0f1f3", textAlign: "right", fontFamily: "monospace" } }}>
                                <thead><tr><th>List date</th><th>Priced articles</th><th>Shared w/ previous</th></tr></thead>
                                <tbody>
                                  {data.diag.map(d => (
                                    <tr key={d.date}>
                                      <td style={{ fontWeight: 700 }}>{fmtDate(d.date)}</td>
                                      <td>{d.products.toLocaleString()}</td>
                                      <td style={{ color: d.overlapPrev == null ? "#8b97ac" : d.overlapPrev < OVERALL_MIN_OVERLAP ? "#d32f2f" : "#1e8e3e", fontWeight: 700 }}>
                                        {d.overlapPrev == null ? "— first" : `${d.overlapPrev}${d.overlapPrev < OVERALL_MIN_OVERLAP ? " ⚠" : " ✓"}`}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Box>
                              <Typography sx={{ fontSize: "0.64rem", color: "#8b97ac", mt: 0.5, textAlign: "left" }}>Need ≥{OVERALL_MIN_OVERLAP} shared articles between two lists for the overall index to chain.</Typography>
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <>
                          {trulyFlat && (
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start", px: 1.25, py: 0.4, mb: 0.5, borderRadius: 5, bgcolor: "#e6f4ea", border: "1px solid #a8dab5", color: "#1e7e45", fontSize: "0.7rem", fontWeight: 700 }}>
                              No price change since last list — {active} held prices flat {firstM ? fmtDate(firstM) : ""}→{lastM ? fmtDate(lastM) : ""}.
                            </Box>
                          )}
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 12, right: 72, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5d6b85" }} tickFormatter={fmtDate} />
                              <YAxis tick={{ fontSize: 11, fill: "#5d6b85" }} width={44} domain={["auto", "auto"]} />
                              <Tooltip formatter={(v, name) => [`Index ${v} (${signed(Number(v) - 100, 1)}%)`, name as string]} labelFormatter={(l) => fmtDate(String(l))} contentStyle={{ fontSize: "0.72rem", borderRadius: 8, border: "1px solid #e4e9f1" }} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <ReferenceLine y={100} stroke="#8b97ac" strokeWidth={2} label={{ value: "100", position: "left", fontSize: 10, fill: "#8b97ac", fontWeight: 700 }} />
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
                  <Typography sx={{ fontSize: "0.68rem", color: "#8b97ac", px: 1.5, pb: 1.25 }}>
                    Each point is <b>{active}</b>&apos;s own purchase price per article, indexed to the base date = 100, chained list-over-list over the articles present in <b>both</b> consecutive lists (a real same-article price move, not a basket change). The badge at each line end is the latest index; <b>above 100 = prices rose</b>. The bold black line is all articles; dashed lines are per polymer family.
                  </Typography>
                </Card>

                {/* Breakdown by form */}
                {hasFormData && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                      Breakdown by form — {primaryMat ? <Box component="span" sx={{ color: "#15223a" }}>{primaryMat}</Box> : "select a material"} <Box component="span" sx={{ color: "#b5bfcf", textTransform: "none", fontWeight: 500 }}>(click a material chip above to switch)</Box>
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                      {TYPE_BREAKDOWN.map(t => (
                        <TypeMiniChart key={t.key} label={`${primaryMat ? primaryMat + " " : ""}${t.label.toLowerCase()}`} color={t.color}
                          series={primaryMat ? data.byTypeMaterial?.[primaryMat]?.[t.key] : data.byType?.[t.key]} dates={dates} />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* KPI cards */}
                {anyTrend && matSeries.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 0.5 }}>
                    {matSeries.map(s => {
                      const ms = dates.filter(m => s.points[m] != null);
                      const ld = ms[ms.length - 1];
                      const last = ld ? s.points[ld] : null;
                      const chg = last != null ? last - 100 : null;
                      const up = chg != null && chg > 0.05, down = chg != null && chg < -0.05;
                      const dc = up ? "#d32f2f" : down ? "#1e8e3e" : "#5d6b85";
                      const dbg = up ? "#fce8e6" : down ? "#e6f4ea" : "#eef2f8";
                      return (
                        <Card key={s.key} onClick={() => toggleMat(s.key)}
                          sx={{ flex: "1 1 200px", minWidth: 200, maxWidth: 270, cursor: "pointer", position: "relative", overflow: "hidden", border: "1px solid #e4e9f1", borderRadius: 3, transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: "0 6px 18px rgba(0,0,0,0.08)", transform: "translateY(-2px)" } }}>
                          <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: s.color }} />
                          <CardContent sx={{ p: 1.75, pl: 2.25, "&:last-child": { pb: 1.75 } }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color }} />
                                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#15223a" }}>{s.label}</Typography>
                              </Box>
                              <Box sx={{ fontSize: "0.52rem", fontWeight: 700, color: "#8b97ac", letterSpacing: "0.08em", border: "1px solid #dfe5ee", borderRadius: 0.75, px: 0.55, py: 0.15 }}>
                                {ld ? `${s.samples[ld] || 0} ART.` : "—"}
                              </Box>
                            </Box>
                            <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: idxColor(last), lineHeight: 1.05, letterSpacing: "-0.02em" }}>{last != null ? Math.round(last) : "—"}</Typography>
                            <Typography sx={{ fontSize: "0.6rem", color: "#8b97ac", mt: 0.15, textTransform: "uppercase", letterSpacing: "0.05em" }}>index{ld ? ` · ${fmtDate(ld)}` : ""}</Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.85, mt: 1.1 }}>
                              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: dbg, color: dc, borderRadius: 1, px: 0.9, py: 0.3 }}>
                                {up ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : down ? <ArrowDownwardIcon sx={{ fontSize: 14 }} /> : <RemoveIcon sx={{ fontSize: 14 }} />}
                                <Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>{chg != null ? `${signed(chg, 1)}%` : "n/a"}</Typography>
                              </Box>
                              <Typography sx={{ fontSize: "0.68rem", color: "#8b97ac" }}>vs base date</Typography>
                            </Box>
                            <Typography sx={{ fontSize: "0.62rem", color: "#b5bfcf", mt: 0.7 }}>price move on same articles</Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}

                {/* Detail table */}
                {anyTrend && matSeries.length > 0 && dates.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Detail — index per date</Typography>
                    <TableContainer sx={{ border: "1px solid #e4e9f1", borderRadius: 2, overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: "#f5f7fb" }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5d6b85", textTransform: "uppercase" }}>Material</TableCell>
                            {dates.map(m => <TableCell key={m} align="right" sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5d6b85", whiteSpace: "nowrap" }}>{fmtDate(m)}</TableCell>)}
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5d6b85", bgcolor: "#e8f5e9" }}>Δ %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {matSeries.map(s => {
                            const ms = dates.filter(m => s.points[m] != null);
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
                                {dates.map(m => (
                                  <TableCell key={m} align="right" sx={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 600, color: s.points[m] != null ? idxColor(s.points[m]) : "#dfe5ee" }}>
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
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                        Matched articles{primaryMat ? ` · ${primaryMat}` : ""} — {fmtDate(ch.prev)} → {fmtDate(ch.curr)}
                        <Box component="span" sx={{ color: "#b5bfcf", fontWeight: 500, textTransform: "none" }}> · same article in both lists · {rows.length} of {inMat.length} shown (biggest move first)</Box>
                      </Typography>
                      <TableContainer sx={{ border: "1px solid #e4e9f1", borderRadius: 2, maxHeight: 360, overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow sx={{ "& th": { bgcolor: "#f5f7fb", fontWeight: 700, fontSize: "0.66rem", color: "#5d6b85", textTransform: "uppercase" } }}>
                              <TableCell>Article</TableCell>
                              <TableCell>Form</TableCell>
                              <TableCell align="right">{fmtDate(ch.prev)}</TableCell>
                              <TableCell align="right">{fmtDate(ch.curr)}</TableCell>
                              <TableCell align="right">Δ %</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((a, i) => {
                              const col = a.pct == null ? "#8b97ac" : a.pct > 0.05 ? "#d32f2f" : a.pct < -0.05 ? "#1e8e3e" : "#5d6b85";
                              return (
                                <TableRow key={a.ref + i} hover>
                                  <TableCell sx={{ maxWidth: 320 }}>
                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, fontFamily: "monospace", color: "#274e64" }}>{a.ref}</Typography>
                                    <Typography sx={{ fontSize: "0.66rem", color: "#8b97ac", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{a.name || ""}</Typography>
                                  </TableCell>
                                  <TableCell sx={{ fontSize: "0.72rem", color: "#5d6b85" }}>{formLbl(a.ptype)}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: "0.74rem", fontFamily: "monospace", color: "#5d6b85" }}>{fmtP(a.prev)}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: "0.74rem", fontFamily: "monospace", fontWeight: 700, color: "#15223a" }}>{fmtP(a.curr)}</TableCell>
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
        <Typography sx={{ fontSize: "0.68rem", color: "#8b97ac", mt: 1.25, lineHeight: 1.6 }}>
          Every supplier with an ingested price list is listed (sorted by number of list dates); a price index appears once two lists share enough articles to chain — until then the tab shows its lists on record. Same constant-basket methodology as the competitor price-index, on the buy side.
        </Typography>
      )}
    </Box>
  );
}
