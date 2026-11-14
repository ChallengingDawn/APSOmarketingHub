"use client";
import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Button from "@mui/material/Button";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import TuneIcon from "@mui/icons-material/Tune";
import FilterListIcon from "@mui/icons-material/FilterList";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PriceCheckIcon from "@mui/icons-material/PriceCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import {
  BarChart, Bar, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from "recharts";
import PageHeader from "../PageHeader";
import HistoryTrendPanel from "./HistoryTrendPanel";
import StockInsightsPanel from "./StockInsightsPanel";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { useSavedFilters, useDetailMode, type DetailMode } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface PositionRow { material: string; matches: string; avg_position_pct: string; cheaper_count: string; expensive_count: string }
interface SummaryRow { material: string; apso_products: string; avg_price: string | null; total_stock: string }
interface StockRow { material: string; apso_products: string; apso_in_stock: string; apso_total_stock: string; comp_products: string; comp_in_stock: string }
interface CompMeta { id: number; name: string; code: string; currency: string }
interface BreakdownRow { product_type: string | null; material: string | null; color: string | null; product_number: string | null; product_description: string | null; competitor_id: number; competitor_name: string; currency: string; n: number; apso_n: number; comp_n: number; apso_total: number; coverage_pct: number | null; apso_avg: string | null; comp_avg: string | null; index_pct: string | null; diff_pct: string | null }
interface ScaleSeries { key: string; label: string; n: number; pct: (number | null)[] }
interface ScaleCurveResp { breakpoints: number[]; dimension: string; series: ScaleSeries[]; competitor: { id: number | null; name: string } | null; pairs: number; with_scale: number }
interface CurvePair { match_id: number; article_number: string; description: string | null; material: string | null; competitor_name: string; currency: string; external_ref: string | null; product_name: string | null; apso_price: number | null; comp_price: number | null; pct: number | null }
interface PairRow { match_id: number; article_number: string; description: string | null; product_type: string | null; material: string | null; color: string | null; apso_unit: string | null; currency: string; apso_price: string | null; external_ref: string; product_name: string | null; comp_unit: string | null; comp_price: string | null; apso_len_mm: number | null; comp_len_mm: number | null; index: number | null }
// Direct price-to-price comparison (both quoted on the same basis; stock length
// is not used to divide).
function pairIndex(pr: PairRow): { index: number | null; note: string; comparable: boolean; apsoPm: number | null; compPm: number | null } {
  const a = pr.apso_price != null ? Number(pr.apso_price) : null;
  const co = pr.comp_price != null ? Number(pr.comp_price) : null;
  if (!a || !co) return { index: null, note: "", comparable: false, apsoPm: null, compPm: null };
  return { index: Math.round((a / co) * 100), note: "", comparable: true, apsoPm: a, compPm: co };
}
const BREAK_BY: { value: string; label: string }[] = [
  { value: "product_type", label: "Product type" },
  { value: "type_material", label: "Type + Material" },
  { value: "material", label: "Material" },
  { value: "spec", label: "Type · Material · Colour" },
  { value: "product_group", label: "Product group" },
];

const CONF_LEVELS = [100, 95, 90, 80, 70];
function ccySym(c: string) { return c === "EUR" ? "€" : c === "CHF" ? "CHF" : c; }
function normUnit(u: string | null | undefined): string {
  const x = (u || "").trim().toLowerCase();
  if (["m", "lm", "lfm", "mtr", "meter", "metre", "laufmeter", "m1", "rm"].includes(x)) return "m";
  if (["m2", "qm", "sqm", "m²", "m^2"].includes(x)) return "m2";
  if (["kg", "kgs", "kilogram"].includes(x)) return "kg";
  if (["st", "stk", "stk.", "stck", "stück", "stueck", "pc", "pcs", "pce", "ea", "piece", "unit", "1"].includes(x)) return "pc";
  return x;
}
const TYPE_LABEL: Record<string, string> = {
  round_bar: "Round bar", tube: "Tube", plate: "Plate", sheet: "Sheet",
  o_ring: "O-ring", x_ring: "X-ring", cord: "Cord", bushing: "Bushing", profile: "Profile", other: "Other",
};
function typeLabel(t: string): string { return TYPE_LABEL[t] || (t ? t.replace(/_/g, " ") : "Other"); }
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// breakdown label depends on what we grouped by
function comboLabel(r: BreakdownRow): string {
  if (r.product_number) return r.product_description ? `${r.product_description}` : r.product_number;
  return [r.product_type ? typeLabel(r.product_type) : null, r.material ? matLabel(r.material) : null, r.color ? cap(r.color) : null].filter(Boolean).join(" · ") || "—";
}
const bTh = { textAlign: "left" as const, padding: "6px 10px", fontSize: "0.62rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase" as const, background: "#f5f7fb" };
const bThR = { ...bTh, textAlign: "right" as const };
const bTd = { padding: "6px 10px", color: "#15223a" };
const bTdR = { ...bTd, textAlign: "right" as const, fontFamily: "monospace" };

const MAT_ABBR: Record<string, string> = {
  ptfe: "PTFE", pom_c: "POM-C", pom_h: "POM-H", pc: "PC", pa6: "PA6", pa66: "PA66", pa6_g: "PA6-G",
  pe_hd: "PE-HD", pe_uhmw: "PE-UHMW", pp: "PP", pmma: "PMMA", psu: "PSU", pei: "PEI", pur: "PUR",
  pvc: "PVC", pvc_u: "PVC-U", peek: "PEEK", nbr: "NBR", fpm: "FPM", epdm: "EPDM", viton: "Viton", silicone: "Silicone",
};
function matLabel(raw: string): string {
  if (!raw) return "—";
  return MAT_ABBR[raw] || raw.toUpperCase().replace(/_/g, "-");
}
function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

// Recharts 3.x formatter helpers (params are loosely typed by the lib).
type RV = number | string | readonly (number | string)[] | undefined;
const tipPct = (v: RV): [string, string] => [`${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)}%`, "Position"];
const tipNum = (label: string) => (v: RV): [string, string] => [Number(v).toLocaleString(), label];
const labelPct = (v: ReactNode) => { const nn = Number(v); return `${nn > 0 ? "+" : ""}${nn.toFixed(0)}%`; };

// chart color by position (green = APSO cheaper, red = more expensive)
function posColor(v: number) {
  if (v <= -20) return "#1e7e45";
  if (v < -2) return "#34a06a";
  if (v <= 2) return "#c77700";
  if (v <= 20) return "#e0633a";
  return "#c5221f";
}

const SORT_OPTS = [
  { value: "index_desc", label: "Most expensive first" },
  { value: "index_asc", label: "Cheapest first" },
  { value: "count_desc", label: "Most products first" },
  { value: "name", label: "Name (A–Z)" },
];
const TOP_OPTS = [6, 10, 20, 100];
const idxColor = (i: number) => (i < 99 ? "#1e7e45" : i > 101 ? "#c5221f" : "#5d6b85");

interface SharedFilters { profitCenter: string; fAss: string; fMG: string; fSG: string; productGroup: string; material: string; scrapeDate: string }

// One competitor = one self-contained card with its OWN hidden menu (Compare by /
// confidence / sort / how many / which side) and its own data fetch.
function CompetitorCard({ comp, shared, detailMode }: { comp: CompMeta; shared: SharedFilters; detailMode: DetailMode }) {
  const [breakBy, setBreakBy] = useState("type_material");
  const [minConf, setMinConf] = useState(95);
  const [sortBy, setSortBy] = useState("index_desc");
  const [topN, setTopN] = useState(6);
  const [side, setSide] = useState("all");
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rowPairs, setRowPairs] = useState<Record<string, PairRow[]>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const [me, setMe] = useState<{ email: string; name: string }>({ email: "", name: "" });
  const sym = ccySym(comp.currency);

  useEffect(() => {
    fetch(`/api/auth/me`).then(r => r.ok ? r.json() : null).then((d) => {
      if (d?.user?.email) setMe({ email: d.user.email, name: d.user.full_name || d.user.username || "" });
      else if (typeof window !== "undefined") setMe({ email: localStorage.getItem("apso_user_email") || "", name: "" });
    }).catch(() => { if (typeof window !== "undefined") setMe({ email: localStorage.getItem("apso_user_email") || "", name: "" }); });
  }, []);

  // Delete a wrong match straight from the comparison table; refresh the row + aggregates.
  const removeMatch = async (matchId: number, key: string) => {
    const p = new URLSearchParams({ reason: "Removed from comparison table" });
    if (me.email) p.set("user_email", me.email);
    if (me.name) p.set("user_name", me.name);
    try {
      await fetch(`${API_URL}/api/matches/${matchId}?${p.toString()}`, { method: "DELETE" });
      setRowPairs(prev => ({ ...prev, [key]: (prev[key] || []).filter(x => x.match_id !== matchId) }));
      setPairs(prev => prev.filter(x => x.match_id !== matchId));
      setBump(b => b + 1); // recompute the breakdown aggregates / index
    } catch { /* ignore */ }
  };

  const rowKey = (d: BreakdownRow) => `${d.product_type || ""}|${d.material || ""}|${d.color || ""}|${d.product_number || ""}`;
  const toggleRow = (d: BreakdownRow) => {
    const key = rowKey(d);
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (rowPairs[key]) return;
    setRowBusy(key);
    const p = new URLSearchParams();
    p.set("competitor_id", String(comp.id));
    p.set("min_confidence", String(minConf));
    if (shared.scrapeDate) p.set("as_of", shared.scrapeDate);
    if (shared.profitCenter) p.set("profit_center", shared.profitCenter);
    if (shared.fAss) p.set("assortment", shared.fAss);
    if (shared.fMG) p.set("main_group", shared.fMG);
    if (shared.fSG) p.set("sub_group", shared.fSG);
    if (d.product_type) p.set("product_type", d.product_type);
    if (d.material) p.set("material", d.material);
    if (d.color) p.set("color", d.color);
    if (d.product_number) p.set("product_group", d.product_number);
    else if (shared.productGroup) p.set("product_group", shared.productGroup);
    fetch(`${API_URL}/api/analytics/match-pairs?${p}`).then(r => r.json())
      .then(dd => setRowPairs(prev => ({ ...prev, [key]: dd.pairs || [] })))
      .catch(() => setRowPairs(prev => ({ ...prev, [key]: [] })))
      .finally(() => setRowBusy(null));
  };

  // When expanded, load the raw 1-to-1 matched pairs (to verify & spot unit issues).
  useEffect(() => {
    if (!expanded) return;
    const p = new URLSearchParams();
    p.set("competitor_id", String(comp.id));
    p.set("min_confidence", String(minConf));
    if (shared.scrapeDate) p.set("as_of", shared.scrapeDate);
    if (shared.profitCenter) p.set("profit_center", shared.profitCenter);
    if (shared.fAss) p.set("assortment", shared.fAss);
    if (shared.fMG) p.set("main_group", shared.fMG);
    if (shared.fSG) p.set("sub_group", shared.fSG);
    if (shared.productGroup) p.set("product_group", shared.productGroup);
    if (shared.material) p.set("material", shared.material);
    let cancelled = false;
    fetch(`${API_URL}/api/analytics/match-pairs?${p}`).then(r => r.json())
      .then(d => { if (!cancelled) setPairs(d.pairs || []); }).catch(() => { if (!cancelled) setPairs([]); });
    return () => { cancelled = true; };
  }, [expanded, comp.id, minConf, shared.scrapeDate, shared.profitCenter, shared.fAss, shared.fMG, shared.fSG, shared.productGroup, shared.material]);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("competitor_ids", String(comp.id));
    p.set("min_confidence", String(minConf));
    p.set("group_by", breakBy);
    if (shared.scrapeDate) p.set("as_of", shared.scrapeDate);
    if (shared.profitCenter) p.set("profit_center", shared.profitCenter);
    if (shared.fAss) p.set("assortment", shared.fAss);
    if (shared.fMG) p.set("main_group", shared.fMG);
    if (shared.fSG) p.set("sub_group", shared.fSG);
    if (shared.productGroup) p.set("product_group", shared.productGroup);
    if (shared.material) p.set("material", shared.material);
    let cancelled = false;
    fetch(`${API_URL}/api/analytics/competitor-breakdown?${p}`).then(r => r.json())
      .then(d => { if (!cancelled) setRows(d.rows || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [comp.id, breakBy, minConf, shared.scrapeDate, shared.profitCenter, shared.fAss, shared.fMG, shared.fSG, shared.productGroup, shared.material, bump]);

  const all = rows.map(r => {
    const a = r.apso_avg != null ? Number(r.apso_avg) : 0;
    const cp = r.comp_avg != null ? Number(r.comp_avg) : 0;
    return { ...r, a, cp, index: r.index_pct != null ? Number(r.index_pct) : 0 };
  });
  const totApso = all.reduce((s, r) => s + r.apso_n, 0);
  const totComp = all.reduce((s, r) => s + r.comp_n, 0);
  const overall = totApso ? all.reduce((s, r) => s + r.index * r.apso_n, 0) / totApso : 0; // volume-weighted

  const processed = all
    .filter(r => side === "all" ? true : side === "cheaper" ? r.index < 99 : r.index > 101)
    .sort((x, y) => sortBy === "index_desc" ? y.index - x.index : sortBy === "index_asc" ? x.index - y.index : sortBy === "count_desc" ? y.apso_n - x.apso_n : comboLabel(x).localeCompare(comboLabel(y)));
  const disp = processed.slice(0, topN);

  const ctrl = (label: string, value: string, set: (v: string) => void, opts: { value: string; label: string }[]) => (
    <FormControl size="small" fullWidth sx={{ mb: 1.25 }}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => set(e.target.value)}>
        {opts.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.85rem" }}>{o.label}</MenuItem>)}
      </Select>
    </FormControl>
  );

  // The per-spec price breakdown (pairs table): under the row, or in the pop-up.
  const breakdownBody = (key: string) => {
    const prs = rowPairs[key] || [];
    return (rowBusy === key ? <Typography sx={{ fontSize: "0.75rem", color: "#8b97ac", py: 1 }}>Loading prices…</Typography>
                   : prs.length === 0 ? <Typography sx={{ fontSize: "0.75rem", color: "#8b97ac", py: 1 }}>No price detail.</Typography>
                   : (
                    (() => {
                      const allRows = prs.map(pr => ({ pr, r: pairIndex(pr) }));
                      const shown = allRows.slice(0, 60);
                      const cmp = allRows.filter(x => x.r.comparable && x.r.index != null);
                      const avg = (xs: number[]) => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
                      const avgA = avg(cmp.map(x => x.r.apsoPm as number));
                      const avgC = avg(cmp.map(x => x.r.compPm as number));
                      const avgP = avg(cmp.map(x => (x.r.index as number) - 100));
                      const tCol = avgP < -1 ? "#1e7e45" : avgP > 1 ? "#c5221f" : "#5d6b85";
                      return (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr>
                            <th style={{ ...bTh, fontSize: "0.66rem" }}>APSO article</th><th style={{ ...bThR, fontSize: "0.66rem" }}>APSO / m</th><th style={{ ...bTh, fontSize: "0.66rem" }}>Competitor ref</th><th style={{ ...bThR, fontSize: "0.66rem" }}>Competitor / m</th><th style={{ ...bThR, fontSize: "0.66rem" }}>% vs comp</th><th style={{ ...bThR, fontSize: "0.66rem", width: 34 }}></th>
                          </tr></thead>
                          <tbody>
                            {shown.map(({ pr, r }, pi) => {
                              const pct = r.index != null ? r.index - 100 : null;
                              const col = pct == null ? "#8b97ac" : pct < -1 ? "#1e7e45" : pct > 1 ? "#c5221f" : "#5d6b85";
                              const nc = !r.comparable;
                              const basis = normUnit(pr.apso_unit) === "m" ? "m" : (pr.apso_unit || "");
                              const aRaw = `${sym} ${pr.apso_price}${basis ? `/${basis}` : ""}`;
                              const cRaw = `${sym} ${pr.comp_price}${basis ? `/${basis}` : ""}`;
                              return (
                                <tr key={pi} style={{ borderTop: "1px solid #f4f6f8", background: nc ? "#fff6f6" : pi % 2 ? "#f6f8fa" : "#fff" }}>
                                  <td style={{ ...bTd, fontSize: "0.8rem" }}><Box sx={{ fontFamily: "monospace", color: "#274e64", fontWeight: 700 }}>{pr.article_number} <Box component="span" sx={{ color: "#8b97ac", fontWeight: 500 }}>[unit: {pr.apso_unit || "?"}{pr.apso_len_mm ? `, ${pr.apso_len_mm}mm` : ""}]</Box></Box><Box sx={{ fontSize: "0.7rem", color: "#8b97ac", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.description || ""}</Box></td>
                                  <td style={{ ...bTdR, fontSize: "0.82rem" }}><Box sx={{ fontWeight: 700 }}>{r.apsoPm != null ? `${sym} ${r.apsoPm.toFixed(2)}` : "—"}</Box><Box sx={{ fontSize: "0.66rem", color: "#8b97ac" }}>{aRaw}</Box></td>
                                  <td style={{ ...bTd, fontFamily: "monospace", fontSize: "0.76rem", color: "#5d6b85", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pr.product_name || ""}>{pr.external_ref}</td>
                                  <td style={{ ...bTdR, fontSize: "0.82rem" }}><Box sx={{ fontWeight: 700 }}>{r.compPm != null ? `${sym} ${r.compPm.toFixed(2)}` : "—"}</Box><Box sx={{ fontSize: "0.66rem", color: nc ? "#c5221f" : "#8b97ac" }}>{cRaw}</Box></td>
                                  <td style={{ ...bTdR, fontSize: "0.85rem", color: col, fontWeight: 800 }}>{nc ? "n/c" : `${pct! > 0 ? "+" : ""}${pct!.toFixed(0)}%`}</td>
                                  <td style={{ ...bTdR, padding: "2px 4px" }}>
                                    <IconButton size="small" title="Remove this match" onClick={(e) => { e.stopPropagation(); removeMatch(pr.match_id, key); }} sx={{ color: "#c5221f", p: 0.3, "&:hover": { bgcolor: "#fdebed" } }}>
                                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "2px solid #d8e0e6", background: "#eef2f6" }}>
                              <td style={{ ...bTd, fontSize: "0.78rem", fontWeight: 800, color: "#15223a" }}>TOTAL · {cmp.length} pairs (per metre)</td>
                              <td style={{ ...bTdR, fontSize: "0.8rem", fontWeight: 800 }}>{sym} {avgA.toFixed(2)}</td>
                              <td style={{ ...bTd, fontSize: "0.7rem", color: "#5d6b85" }}>average</td>
                              <td style={{ ...bTdR, fontSize: "0.8rem", fontWeight: 800 }}>{sym} {avgC.toFixed(2)}</td>
                              <td style={{ ...bTdR, fontSize: "0.95rem", fontWeight: 800, color: tCol }}>{avgP > 0 ? "+" : ""}{avgP.toFixed(0)}%</td>
                              <td style={{ ...bTdR }} />
                            </tr>
                          </tfoot>
                        </table>
                      );
                    })()
                  ));
  };

  const scale = (big: boolean) => big ? 1.18 : 1;
  const renderList = (list: typeof processed, big = false) => {
    const k = scale(big);
    return (
      <>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: `${0.66 * k}rem`, fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: 0.3, mb: 1.2, px: 1, py: 0.6, bgcolor: "#f1f4f6", border: "1px solid #e2e8f0", borderRadius: 1 }}>
          <Box component="span" sx={{ color: "#1e7e45" }}>← APSO cheaper</Box><span>0% · same price</span><Box component="span" sx={{ color: "#c5221f" }}>more expensive →</Box>
        </Box>
        {list.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center", color: "#8b97ac", fontSize: "0.9rem" }}>No comparable products for this view.</Box>
        ) : list.map((d, di) => {
          const diff = d.index - 100;
          const col = idxColor(d.index);
          const valPct = Math.max(0, Math.min(200, d.index)) / 2;
          const barLeft = Math.min(50, valPct), barWidth = Math.max(1.2, Math.abs(valPct - 50));
          const verdict = d.index < 99 ? "APSO cheaper" : d.index > 101 ? "APSO more expensive" : "Same price";
          const key = rowKey(d);
          const open = openKey === key;
          return (
            <Box key={di} sx={{ py: 1.4 * k, px: 1, borderRadius: 1, bgcolor: di % 2 ? "#f8fafc" : "#fff" }}>
              <Box onClick={() => toggleRow(d)} sx={{ cursor: "pointer", borderRadius: 1, p: 0.5, m: -0.5, "&:hover": { bgcolor: "#f7f9fb" } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.6, gap: 1 }}>
                  <Typography sx={{ fontSize: `${0.96 * k}rem`, fontWeight: 700, color: "#15223a" }}>{open ? "▾ " : "▸ "}{comboLabel(d)}</Typography>
                  <Typography sx={{ fontSize: `${1.18 * k}rem`, fontWeight: 800, color: col, whiteSpace: "nowrap" }}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                  </Typography>
                </Box>
                <Box sx={{ position: "relative", height: 20 * k, bgcolor: "#f1f4f6", borderRadius: 1, mb: 0.8 }}>
                  <Box sx={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: "2px", bgcolor: "#aeb4bd" }} />
                  <Box sx={{ position: "absolute", top: 0, bottom: 0, left: `${barLeft}%`, width: `${barWidth}%`, bgcolor: col, borderRadius: 1 }} />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 0.5 }}>
                  <Typography sx={{ fontSize: `${0.84 * k}rem`, color: "#42505c" }}>
                    APSO <Box component="span" sx={{ fontWeight: 800, color: "#274e64", fontFamily: "monospace" }}>{sym} {d.a.toFixed(0)}</Box>
                    {"   vs   "}{comp.name} <Box component="span" sx={{ fontWeight: 800, color: "#c8463a", fontFamily: "monospace" }}>{sym} {d.cp.toFixed(0)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: `${0.76 * k}rem`, fontWeight: 700, color: col }}>{verdict}</Typography>
                </Box>
                <Typography sx={{ fontSize: `${0.78 * k}rem`, color: "#6b7480", mt: 0.2 }}>
                  <Box component="span" sx={{ fontWeight: 700, color: "#c8463a" }}>{d.comp_n.toLocaleString()}</Box> competitor prices
                  {"  ·  "}<Box component="span" sx={{ color: "#274e64", fontWeight: 700 }}>{open ? "hide" : "show"} price breakdown</Box>
                </Typography>
              </Box>
              {open && (big || detailMode === "inline") && (
                <Box sx={{ mt: 1, ml: 1, pl: 1.5, borderLeft: "3px solid #e2e8f0" }}>
                  {breakdownBody(key)}
                </Box>
              )}
            </Box>
          );
        })}
      </>
    );
  };

  const header = (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: "#15223a" }}>{comp.name} <Box component="span" sx={{ color: "#8b97ac", fontWeight: 600, fontSize: "0.88rem" }}>· {sym}</Box></Typography>
      <Typography sx={{ fontSize: "0.78rem", color: "#42505c" }}>
        Overall <Box component="span" sx={{ fontWeight: 800, color: idxColor(overall), fontSize: "0.9rem" }}>{overall ? `${overall - 100 > 0 ? "+" : ""}${(overall - 100).toFixed(0)}%` : "—"}</Box>
        {"  ·  "}{totApso.toLocaleString()} APSO vs {totComp.toLocaleString()} competitor products
        {"  ·  "}<Box component="span" sx={{ color: "#8b97ac" }}>list price · qty 1</Box>
      </Typography>
    </Box>
  );

  return (
    <Card variant="outlined" sx={{ border: "1px solid #e4e9f1", borderRadius: 2 }}>
      <Box sx={{ px: 2, py: 1.4, bgcolor: "#f4f7f9", borderBottom: "2px solid #d8e0e6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        {header}
        <Box sx={{ display: "flex", gap: 0.75 }}>
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} title="Filter / customise" sx={{ color: "#5d6b85", bgcolor: "#fff", border: "1px solid #e0e4e8", borderRadius: 1.5, "&:hover": { bgcolor: "#eef2f6" } }}>
            <FilterListIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setExpanded(true)} title="Expand" sx={{ color: "#5d6b85", bgcolor: "#fff", border: "1px solid #e0e4e8", borderRadius: 1.5, "&:hover": { bgcolor: "#eef2f6" } }}>
            <OpenInFullIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Popover open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
          <Box sx={{ p: 2, width: 250 }}>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#15223a", mb: 1.25, display: "flex", alignItems: "center", gap: 0.5 }}><FilterListIcon sx={{ fontSize: 16 }} /> Filter this graph</Typography>
            {ctrl("Compare by", breakBy, setBreakBy, BREAK_BY)}
            {ctrl("Min. confidence", String(minConf), (v) => setMinConf(Number(v)), CONF_LEVELS.map(l => ({ value: String(l), label: `≥ ${l}%` })))}
            {ctrl("Sort by", sortBy, setSortBy, SORT_OPTS)}
            {ctrl("Show", topN >= 100 ? "100" : String(topN), (v) => setTopN(Number(v)), TOP_OPTS.map(t => ({ value: String(t), label: t >= 100 ? "All rows" : `Top ${t}` })))}
            {ctrl("Which", side, setSide, [{ value: "all", label: "All" }, { value: "expensive", label: "Only where APSO is more expensive" }, { value: "cheaper", label: "Only where APSO is cheaper" }])}
          </Box>
        </Popover>
      </Box>
      <Box sx={{ p: 2 }}>
        {loading && <LinearProgress sx={{ mb: 1, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}
        {renderList(disp)}
        {processed.length > disp.length && <Typography sx={{ mt: 1, fontSize: "0.72rem", color: "#8b97ac", textAlign: "center" }}>+{processed.length - disp.length} more — open the filter menu to show more, or expand ⛶</Typography>}
      </Box>

      {detailMode === "popup" && !expanded && (() => {
        const oi = processed.findIndex(r => rowKey(r) === openKey);
        if (oi < 0) return null;
        const od = processed[oi];
        return (
          <RowDetail mode="popup" open onClose={() => setOpenKey(null)} colSpan={1} maxWidth="lg"
            title={`${comboLabel(od)} · ${comp.name}`}
            subtitle={`APSO ${sym} ${od.a.toFixed(0)} vs ${comp.name} ${sym} ${od.cp.toFixed(0)} · ${od.index - 100 > 0 ? "+" : ""}${(od.index - 100).toFixed(0)}% · ${od.comp_n.toLocaleString()} competitor prices`}
            onPrev={oi > 0 ? () => toggleRow(processed[oi - 1]) : undefined}
            onNext={oi < processed.length - 1 ? () => toggleRow(processed[oi + 1]) : undefined}>
            <Box sx={{ p: 2, bgcolor: "#fff" }}>{breakdownBody(rowKey(od))}</Box>
          </RowDetail>
        );
      })()}

      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <Box sx={{ px: 3, py: 2, bgcolor: "#f4f7f9", borderBottom: "2px solid #d8e0e6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {header}
          <IconButton size="small" onClick={() => setExpanded(false)}>✕</IconButton>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          {/* in-modal controls so you can filter while expanded */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 1.25, mb: 2.5 }}>
            {ctrl("Compare by", breakBy, setBreakBy, BREAK_BY)}
            {ctrl("Min. confidence", String(minConf), (v) => setMinConf(Number(v)), CONF_LEVELS.map(l => ({ value: String(l), label: `≥ ${l}%` })))}
            {ctrl("Sort by", sortBy, setSortBy, SORT_OPTS)}
            {ctrl("Show", topN >= 100 ? "100" : String(topN), (v) => setTopN(Number(v)), TOP_OPTS.map(t => ({ value: String(t), label: t >= 100 ? "All rows" : `Top ${t}` })))}
            {ctrl("Which", side, setSide, [{ value: "all", label: "All" }, { value: "expensive", label: "More expensive" }, { value: "cheaper", label: "Cheaper" }])}
          </Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
            {[
              { l: "Overall vs market (weighted)", v: overall ? `${overall - 100 > 0 ? "+" : ""}${(overall - 100).toFixed(0)}%` : "—", c: idxColor(overall) },
              { l: "Specs shown", v: processed.length.toLocaleString(), c: "#274e64" },
              { l: "APSO products", v: totApso.toLocaleString(), c: "#274e64" },
              { l: "Competitor products", v: totComp.toLocaleString(), c: "#c8463a" },
            ].map(s => (
              <Box key={s.l} sx={{ flex: 1, minWidth: 130, border: "1px solid #eef2f8", borderRadius: 1.5, p: 1.25 }}>
                <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#8b97ac", textTransform: "uppercase" }}>{s.l}</Typography>
                <Typography sx={{ fontSize: "1.3rem", fontWeight: 800, color: s.c }}>{s.v}</Typography>
              </Box>
            ))}
          </Box>
          {renderList(processed, true)}

          {/* Raw 1-to-1 matched pairs — proves the comparison is article-by-article
              and exposes unit mismatches (APSO unit vs competitor unit). */}
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#15223a", mb: 0.3 }}>Matched pairs — 1-to-1 (APSO article ↔ its competitor product)</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: "#42505c", mb: 1 }}>Sorted by index (worst first). <Box component="span" sx={{ color: "#c5221f", fontWeight: 700 }}>Red unit</Box> = APSO and competitor are sold in different units → not comparable, likely the cause of an extreme index.</Typography>
            <Box sx={{ overflowX: "auto", maxHeight: 420 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={bTh}>APSO article</th><th style={bTh}>Spec</th><th style={bThR}>APSO price</th><th style={bTh}>unit</th><th style={bTh}>Competitor ref</th><th style={bThR}>Comp. price</th><th style={bTh}>unit</th><th style={bThR}>Index</th>
                </tr></thead>
                <tbody>
                  {pairs.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#8b97ac" }}>Loading pairs…</td></tr>
                  ) : pairs.map((pr, i) => {
                    const { index: cmpIdx, note, comparable } = pairIndex(pr);
                    const idxCol = cmpIdx == null ? "#8b97ac" : cmpIdx < 99 ? "#1e7e45" : cmpIdx > 101 ? "#c5221f" : "#5d6b85";
                    return (
                      <tr key={i} style={{ borderTop: "1px solid #f0f2f4", background: !comparable ? "#fff6f6" : undefined }}>
                        <td style={{ ...bTd, fontFamily: "monospace", color: "#274e64", fontWeight: 700 }}>{pr.article_number}</td>
                        <td style={{ ...bTd, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pr.description || ""}>{[pr.product_type ? typeLabel(pr.product_type) : null, pr.material ? matLabel(pr.material) : null, pr.color ? cap(pr.color) : null].filter(Boolean).join(" · ")}{note && <Box component="span" sx={{ ml: 0.5, color: "#8b97ac", fontSize: "0.85em" }}>({note})</Box>}</td>
                        <td style={bTdR}>{sym} {pr.apso_price}</td>
                        <td style={{ ...bTd, fontWeight: 700, color: !comparable ? "#c5221f" : "#5d6b85" }}>{pr.apso_unit || "—"}</td>
                        <td style={{ ...bTd, fontFamily: "monospace", color: "#5d6b85", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pr.product_name || ""}>{pr.external_ref}</td>
                        <td style={bTdR}>{sym} {pr.comp_price}</td>
                        <td style={{ ...bTd, fontWeight: 700, color: !comparable ? "#c5221f" : "#5d6b85" }}>{pr.comp_unit || "—"}</td>
                        <td style={{ ...bTdR, color: idxCol, fontWeight: 800 }}>{comparable ? cmpIdx : "n/c"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Full-width "Price vs order quantity" curve: APSO's scale (volume) price descends as
// quantity grows; the competitor is a flat per-unit price. Optionally split by product
// type / material / colour so you can compare groups and spot where APSO's volume
// discount makes it competitive.
function ScaleCurveCard({ comps, shared }: { comps: CompMeta[]; shared: SharedFilters }) {
  const [sel, setSel] = useState<string>("all"); // "all" or a competitor id
  const [dimension, setDimension] = useState<"none" | "product_type" | "material" | "color">("material");
  const [data, setData] = useState<ScaleCurveResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Inspect & remove matches behind one line
  const [pickGroup, setPickGroup] = useState<{ key: string; label: string } | null>(null);
  const [cpairs, setCpairs] = useState<CurvePair[]>([]);
  const [cpBusy, setCpBusy] = useState(false);
  const [me, setMe] = useState<{ email: string; name: string }>({ email: "", name: "" });

  const compIds = comps.map(c => c.id).join(",");
  const ids = sel === "all" ? compIds : sel;

  useEffect(() => {
    fetch(`/api/auth/me`).then(r => r.ok ? r.json() : null).then((d) => {
      if (d?.user?.email) setMe({ email: d.user.email, name: d.user.full_name || d.user.username || "" });
      else if (typeof window !== "undefined") setMe({ email: localStorage.getItem("apso_user_email") || "", name: "" });
    }).catch(() => { if (typeof window !== "undefined") setMe({ email: localStorage.getItem("apso_user_email") || "", name: "" }); });
  }, []);

  const sharedParams = useCallback((p: URLSearchParams) => {
    if (shared.scrapeDate) p.set("as_of", shared.scrapeDate);
    if (shared.profitCenter) p.set("profit_center", shared.profitCenter);
    if (shared.fAss) p.set("assortment", shared.fAss);
    if (shared.fMG) p.set("main_group", shared.fMG);
    if (shared.fSG) p.set("sub_group", shared.fSG);
    if (shared.productGroup) p.set("product_group", shared.productGroup);
    if (shared.material) p.set("material", shared.material);
  }, [shared.scrapeDate, shared.profitCenter, shared.fAss, shared.fMG, shared.fSG, shared.productGroup, shared.material]);

  useEffect(() => {
    if (!comps.length || !ids) { setData(null); return; }
    const p = new URLSearchParams();
    p.set("competitor_ids", ids);
    p.set("min_confidence", "95");
    p.set("dimension", dimension);
    sharedParams(p);
    setBusy(true);
    fetch(`${API_URL}/api/analytics/competitor-scale-curve?${p.toString()}`)
      .then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setBusy(false));
  }, [sel, compIds, ids, dimension, sharedParams, refresh, comps.length]);

  // Load the individual matches behind the picked line
  const loadPairs = useCallback(() => {
    if (!pickGroup || !ids) { setCpairs([]); return; }
    const p = new URLSearchParams();
    p.set("competitor_ids", ids);
    p.set("min_confidence", "95");
    p.set("dimension", dimension);
    if (dimension !== "none") p.set("value", pickGroup.key);
    sharedParams(p);
    setCpBusy(true);
    fetch(`${API_URL}/api/analytics/curve-pairs?${p.toString()}`)
      .then(r => r.json()).then(d => setCpairs(d.pairs || [])).catch(() => setCpairs([])).finally(() => setCpBusy(false));
  }, [pickGroup, ids, dimension, sharedParams]);

  useEffect(() => { loadPairs(); }, [loadPairs, refresh]);

  const removeMatch = async (matchId: number) => {
    const p = new URLSearchParams({ reason: "Removed from price curve" });
    if (me.email) p.set("user_email", me.email);
    if (me.name) p.set("user_name", me.name);
    try {
      await fetch(`${API_URL}/api/matches/${matchId}?${p.toString()}`, { method: "DELETE" });
      setCpairs(prev => prev.filter(x => x.match_id !== matchId));
      setRefresh(r => r + 1); // recompute the curve
    } catch { /* ignore */ }
  };

  const bps = data?.breakpoints || [];
  const series = data?.series || [];
  const chartData = bps.map((q, idx) => {
    const row: Record<string, number | null> = { q };
    series.forEach((s) => { row[s.key] = s.pct[idx]; });
    return row;
  });
  const palette = ["#274e64", "#c8463a", "#1e7e45", "#b8860b", "#6a4c93", "#0b7285"];
  const compName = data?.competitor?.name || "Competitor";

  return (
    <Card sx={{ border: "1px solid #e4e9f1", mb: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5, mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#15223a", fontFamily: "var(--font-outfit), sans-serif", mb: 0.3 }}>
              How much more (or less) APSO costs vs {compName} — by order quantity
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "#5d6b85" }}>
              Each line = average price gap. <Box component="span" sx={{ color: "#c5221f", fontWeight: 700 }}>Above 0 = APSO more expensive</Box>, <Box component="span" sx={{ color: "#1e7e45", fontWeight: 700 }}>below 0 = APSO cheaper</Box>. As you order more, APSO&apos;s volume discount pulls the line down.
            </Typography>
            {data && (
              <Typography sx={{ fontSize: "0.68rem", color: data.with_scale === 0 ? "#c5221f" : "#8b97ac", mt: 0.4 }}>
                {data.pairs.toLocaleString()} matched pairs · <Box component="span" sx={{ fontWeight: 700 }}>{data.with_scale.toLocaleString()}</Box> with volume (scale) pricing
                {data.with_scale === 0 && " — no scale prices in this selection, so the line stays flat. Re-mirror from HubSpot to load scale prices."}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Competitor</InputLabel>
              <Select value={sel} label="Competitor" onChange={(e) => setSel(e.target.value)}>
                <MenuItem value="all">All competitors ({comps.length})</MenuItem>
                {comps.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <ToggleButtonGroup size="small" exclusive value={dimension} onChange={(_e, v) => v && setDimension(v)}>
              <ToggleButton value="none" sx={{ textTransform: "none", fontSize: 12 }}>Overall</ToggleButton>
              <ToggleButton value="product_type" sx={{ textTransform: "none", fontSize: 12 }}>Type</ToggleButton>
              <ToggleButton value="material" sx={{ textTransform: "none", fontSize: 12 }}>Material</ToggleButton>
              <ToggleButton value="color" sx={{ textTransform: "none", fontSize: 12 }}>Color</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
        {busy && <LinearProgress sx={{ mb: 1, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}
        {series.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center", color: "#8b97ac", fontSize: "0.82rem" }}>
            {busy ? "Loading…" : "No scale-price data for this selection."}
          </Box>
        ) : (
          <>
          <Typography sx={{ fontSize: "0.68rem", color: "#8b97ac", mb: 0.5 }}>
            Tip: click a name in the legend to list its matches and remove a wrong one.
          </Typography>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#eef2f8" />
              <XAxis dataKey="q" type="category" tick={{ fontSize: 11, fill: "#5d6b85" }} tickLine={false} axisLine={{ stroke: "#e4e9f1" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5d6b85" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} width={56} />
              <ReferenceLine y={0} stroke="#8b97ac" strokeWidth={1.5} label={{ value: "same price", position: "insideTopRight", fontSize: 10, fill: "#8b97ac" }} />
              <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e9f1", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                formatter={(v) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)}%`}
                labelFormatter={(l) => `Order qty ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                onClick={(o) => {
                  const dk = (o as { dataKey?: unknown })?.dataKey;
                  const key = dk != null ? String(dk) : "";
                  if (key) setPickGroup({ key, label: String((o as { value?: unknown })?.value ?? key) });
                }} />
              {series.map((s, idx) => {
                const color = dimension === "none" ? "#274e64" : palette[idx % palette.length];
                const name = dimension === "none" ? `APSO vs ${compName}` : dimension === "material" ? matLabel(s.label) : s.label;
                return (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={name}
                    stroke={color} strokeWidth={2.6} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
                );
              })}
            </LineChart>
          </ResponsiveContainer>

          {pickGroup && (
            <Box sx={{ mt: 1.5, border: "1px solid #e4e9f1", borderRadius: 1.5, overflow: "hidden" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1.5, py: 1, bgcolor: "#f7f9fb", borderBottom: "1px solid #e4e9f1" }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#15223a" }}>
                  Matches behind <Box component="span" sx={{ color: "#274e64" }}>{dimension === "material" ? matLabel(pickGroup.key) : pickGroup.label}</Box>
                  <Box component="span" sx={{ color: "#8b97ac", fontWeight: 500 }}> · worst first · qty 1 · click 🗑 to remove a wrong match</Box>
                </Typography>
                <Button size="small" onClick={() => setPickGroup(null)} sx={{ fontSize: 12, color: "#5d6b85" }}>Close</Button>
              </Box>
              {cpBusy ? (
                <Typography sx={{ fontSize: "0.76rem", color: "#8b97ac", p: 1.5 }}>Loading matches…</Typography>
              ) : cpairs.length === 0 ? (
                <Typography sx={{ fontSize: "0.76rem", color: "#8b97ac", p: 1.5 }}>No matches.</Typography>
              ) : (
                <Box sx={{ maxHeight: 320, overflow: "auto" }}>
                  {cpairs.slice(0, 200).map((pr, ix) => {
                    const csym = pr.currency === "EUR" ? "€" : "CHF";
                    return (
                      <Box key={pr.match_id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8, bgcolor: ix % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f0f1f3" }}>
                        <Box sx={{ width: 64, textAlign: "right", flexShrink: 0 }}>
                          <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: (pr.pct ?? 0) > 1 ? "#c5221f" : (pr.pct ?? 0) < -1 ? "#1e7e45" : "#5d6b85" }}>
                            {(pr.pct ?? 0) > 0 ? "+" : ""}{pr.pct}%
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.76rem", color: "#15223a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <Box component="span" sx={{ fontFamily: "monospace", color: "#274e64" }}>{pr.article_number}</Box> {pr.description}
                          </Typography>
                          <Typography sx={{ fontSize: "0.7rem", color: "#6b7480", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            ↔ <Box component="span" sx={{ fontFamily: "monospace", color: "#c8463a" }}>{pr.external_ref}</Box> {pr.product_name} · {pr.competitor_name}
                            {"  ·  "}{csym} {pr.apso_price?.toFixed(2)} vs {csym} {pr.comp_price?.toFixed(2)}
                          </Typography>
                        </Box>
                        <IconButton size="small" title="Remove this match" onClick={() => removeMatch(pr.match_id)} sx={{ color: "#c5221f", flexShrink: 0 }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const TAB_SLUGS = ["pricing", "stock", "trends"] as const;

export default function PricesTrendsStockPage() {
  const [tab, setTab] = useState(0);
  // Deep-linkable tabs via URL hash: /prices#stock, /prices#trends, /prices#pricing
  useEffect(() => {
    const apply = () => { const h = window.location.hash.replace("#", "").toLowerCase(); const i = TAB_SLUGS.indexOf(h as typeof TAB_SLUGS[number]); if (i >= 0) setTab(i); };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const changeTab = (v: number) => { setTab(v); if (typeof window !== "undefined") window.history.replaceState(null, "", `#${TAB_SLUGS[v]}`); };
  // Filters are saved per user (shared by the three tabs) and stay until "Clear all".
  const sf = useSavedFilters("prices", {
    mandant: "M100" as "M100" | "M110" | "both", material: "", pc: "", pg: "", ass: "", mg: "", sg: "",
    comps: [] as number[], scrape: "",
  });
  const [mandant, setMandant] = sf.bind("mandant");
  const [material, setMaterial] = sf.bind("material");
  const [profitCenter, setProfitCenter] = sf.bind("pc");
  const [productGroup, setProductGroup] = sf.bind("pg");
  const [fAss, setFAss] = sf.bind("ass");
  const [fMG, setFMG] = sf.bind("mg");
  const [fSG, setFSG] = sf.bind("sg");
  const [savedComps, setSavedComps] = sf.bind("comps");
  const [detailMode, setDetailMode] = useDetailMode();
  const [materials, setMaterials] = useState<{ material: string; n: string }[]>([]);
  const [profitCenters, setProfitCenters] = useState<string[]>([]);
  const [productGroups, setProductGroups] = useState<{ number: string; description: string }[]>([]);
  const [assortments, setAssortments] = useState<{ number: string; description: string }[]>([]);
  const [mainGroups, setMainGroups] = useState<{ number: string; description: string }[]>([]);
  const [subGroups, setSubGroups] = useState<{ number: string; description: string }[]>([]);

  // Competitor comparison (per product-type category)
  const [competitorsList, setCompetitorsList] = useState<CompMeta[]>([]);
  const [selectedComps, setSelectedComps] = useState<number[]>([]);
  const [scrapeDate, setScrapeDate] = sf.bind("scrape"); // "" = latest
  const [scrapeDates, setScrapeDates] = useState<string[]>([]);

  const [position, setPosition] = useState<PositionRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockByComp, setStockByComp] = useState<{ material: string; code: string; name: string; products: string; in_stock: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = mandant === "M110" ? "EUR" : "CHF";

  useEffect(() => {
    fetch(`${API_URL}/api/analytics/materials`).then(r => r.json()).then(d => setMaterials(d.data || [])).catch(() => {});
    fetch(`${API_URL}/api/competitors`).then(r => r.json()).then((d: CompMeta[]) => setCompetitorsList(d || [])).catch(() => {});
  }, []);

  // Competitors available for the chosen mandant: M100→CHF, M110→EUR, both→all.
  // (Don't mix currencies — the top mandant toggle drives the competitor set.)
  const availableComps = useMemo(() => {
    if (mandant === "both") return competitorsList;
    const cur = mandant === "M110" ? "EUR" : "CHF";
    return competitorsList.filter(c => c.currency === cur);
  }, [competitorsList, mandant]);

  // The market's competitors, narrowed to the user's saved pick when it still applies
  // (an empty pick = all of them). Re-applied whenever the market (or list) changes.
  useEffect(() => {
    if (!sf.ready) return;
    const avail = availableComps.map(c => c.id);
    const keep = savedComps.filter(id => avail.includes(id));
    setSelectedComps(keep.length ? keep : avail);
  }, [availableComps, sf.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available scrape dates for the chosen competitors (for the "compare against scrape" selector)
  useEffect(() => {
    if (!selectedComps.length) { setScrapeDates([]); return; }
    fetch(`${API_URL}/api/analytics/competitor-scrapes?competitor_ids=${selectedComps.join(",")}`)
      .then(r => r.json()).then(d => setScrapeDates(d.dates || [])).catch(() => {});
  }, [selectedComps]);

  // Bottom comparative table — every spec across all selected competitors, same top filters.
  // Spec-level data across all selected competitors — powers the KPI strip + Market overview.
  const [tableRows, setTableRows] = useState<BreakdownRow[]>([]);
  useEffect(() => {
    if (!sf.ready) return;
    if (!selectedComps.length) { setTableRows([]); return; }
    const p = new URLSearchParams();
    p.set("competitor_ids", selectedComps.join(","));
    p.set("min_confidence", "95");
    p.set("group_by", "spec");
    if (scrapeDate) p.set("as_of", scrapeDate);
    if (profitCenter) p.set("profit_center", profitCenter);
    if (fAss) p.set("assortment", fAss);
    if (fMG) p.set("main_group", fMG);
    if (fSG) p.set("sub_group", fSG);
    if (productGroup) p.set("product_group", productGroup);
    if (material) p.set("material", material);
    let cancelled = false;
    fetch(`${API_URL}/api/analytics/competitor-breakdown?${p}`).then(r => r.json())
      .then(d => { if (!cancelled) setTableRows(d.rows || []); })
      .catch(() => { if (!cancelled) setTableRows([]); });
    return () => { cancelled = true; };
  }, [selectedComps, scrapeDate, profitCenter, fAss, fMG, fSG, productGroup, material, sf.ready]);

  // Conditional/cascading options — Profit Center and Product Group narrow each
  // other (exclude-self), exactly like the APSO Products app.
  const fetchFilterOptions = useCallback(async () => {
    if (!sf.ready) return;
    const p = new URLSearchParams();
    if (mandant !== "both") p.set("mandant", mandant);
    if (profitCenter) p.set("profit_center", profitCenter);
    if (fAss) p.set("assortment", fAss);
    if (fMG) p.set("main_group", fMG);
    if (fSG) p.set("sub_group", fSG);
    if (productGroup) p.set("product_group", productGroup);
    try {
      const d = await fetch(`${API_URL}/api/products/filters?${p}`).then(r => r.json());
      setProfitCenters(d.profit_centers || []);
      setAssortments(d.assortments || []);
      setMainGroups(d.main_groups || []);
      setSubGroups(d.sub_groups || []);
      setProductGroups(d.product_groups || []);
    } catch { /* */ }
  }, [mandant, profitCenter, fAss, fMG, fSG, productGroup, sf.ready]);
  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  const fetchData = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the page loads once
    setLoading(true);
    try {
      const p = new URLSearchParams({ mandant });
      if (material) p.set("material", material);
      if (profitCenter) p.set("profit_center", profitCenter);
      if (productGroup) p.set("product_group", productGroup);
      if (fAss) p.set("assortment", fAss);
      if (fMG) p.set("main_group", fMG);
      if (fSG) p.set("sub_group", fSG);
      const sp = new URLSearchParams();
      if (material) sp.set("material", material);
      if (productGroup) sp.set("product_group", productGroup);
      if (profitCenter) sp.set("profit_center", profitCenter);
      if (fAss) sp.set("assortment", fAss);
      if (fMG) sp.set("main_group", fMG);
      if (fSG) sp.set("sub_group", fSG);
      const [ov, st] = await Promise.all([
        fetch(`${API_URL}/api/analytics/overview?${p}`).then(r => r.json()),
        fetch(`${API_URL}/api/analytics/stock?${sp}`).then(r => r.json()),
      ]);
      setPosition(ov.position || []);
      setSummary(ov.summary || []);
      setStock(st.data || []);
      setStockByComp(st.by_competitor || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [mandant, material, profitCenter, productGroup, fAss, fMG, fSG, sf.ready]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- derived ----
  const chartData = useMemo(() => position.map(p => ({
    material: matLabel(p.material),
    position: num(p.avg_position_pct),
    matches: num(p.matches),
    cheaper: num(p.cheaper_count),
    expensive: num(p.expensive_count),
  })).sort((a, b) => a.position - b.position), [position]);

  const totals = useMemo(() => {
    const matches = chartData.reduce((s, d) => s + d.matches, 0);
    const cheaper = chartData.reduce((s, d) => s + d.cheaper, 0);
    const expensive = chartData.reduce((s, d) => s + d.expensive, 0);
    const wAvg = matches > 0 ? chartData.reduce((s, d) => s + d.position * d.matches, 0) / matches : 0;
    return { matches, cheaper, expensive, wAvg, cheaperPct: matches ? (cheaper / matches) * 100 : 0, expensivePct: matches ? (expensive / matches) * 100 : 0 };
  }, [chartData]);

  const summaryByMat = useMemo(() => {
    const m = new Map(summary.map(s => [s.material, s]));
    return position.map(p => ({ ...p, ...(m.get(p.material) || {}) }));
  }, [position, summary]);

  // Stable colour per competitor (index 0 = APSO navy) — reused in chart bars, legend and table bubbles.
  const STOCK_PALETTE = ["#274e64", "#c8463a", "#e8a13a", "#2e7d4f", "#7b5ea7", "#3a8fb7", "#c0566f", "#6b8e23", "#b5651d", "#5c6bc0", "#00897b", "#8d6e63"];
  const stockComps = useMemo(() => {
    const m = new Map<string, string>();
    stockByComp.forEach(r => { if (!m.has(r.code)) m.set(r.code, r.name); });
    return [...m.entries()].map(([code, name], i) => ({ code, name, color: STOCK_PALETTE[(i + 1) % STOCK_PALETTE.length] }));
  }, [stockByComp]);
  const stockByCompMap = useMemo(() => {
    const m = new Map<string, { products: string; in_stock: string }>();
    stockByComp.forEach(r => m.set(`${r.material}|${r.code}`, r));
    return m;
  }, [stockByComp]);

  // ---- shared chart pieces ----
  const tooltipStyle = { fontSize: "0.72rem", borderRadius: 2, border: "1px solid #e4e9f1", boxShadow: "0 4px 16px rgba(26,58,76,0.10)", padding: "8px 10px" };

  return (
    <Box>
      <PageHeader
        icon="analytics"
        eyebrow="Pricing Intelligence"
        title="Prices · Trends · Stock"
        subtitle="Competitive price position, stock coverage and trends — pick a topic, filter, and compare."
        rightSlot={
          <Button variant="contained" startIcon={<PictureAsPdfIcon />}
            onClick={() => {
              const p = new URLSearchParams();
              p.set("mandant", mandant);
              if (material) p.set("material", material);
              if (productGroup) p.set("product_group", productGroup);
              if (profitCenter) p.set("profit_center", profitCenter);
              if (fAss) p.set("assortment", fAss);
              if (fMG) p.set("main_group", fMG);
              if (fSG) p.set("sub_group", fSG);
              window.open(`/pricing/prices/report?${p.toString()}`, "_blank");
            }}
            sx={{ bgcolor: "#c8463a", fontWeight: 800, textTransform: "none", boxShadow: "0 4px 14px rgba(237,27,47,0.28)", "&:hover": { bgcolor: "#a8372c" } }}>
            Export PDF
          </Button>
        }
      />

      {/* Section switcher — refined segmented control with icon + descriptor */}
      <Tabs value={tab} onChange={(_, v) => changeTab(v)} variant="fullWidth"
        sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 2, bgcolor: "#fff", overflow: "hidden",
          "& .MuiTab-root": { minHeight: 70, py: 1, textTransform: "none", color: "#5d6b85", alignItems: "stretch",
            borderRight: "1px solid #eef1f4", "&:last-of-type": { borderRight: "none" },
            "&:hover": { bgcolor: "#fafbfc" },
            "&.Mui-selected": { color: "#c8463a", bgcolor: "#fff5f6" } },
          "& .MuiTabs-indicator": { backgroundColor: "#c8463a", height: 3 } }}>
        {[
          { icon: <PriceCheckIcon sx={{ fontSize: 22 }} />, title: "Pricing", desc: "Price position vs competitors" },
          { icon: <Inventory2Icon sx={{ fontSize: 22 }} />, title: "Stock", desc: "Availability & coverage" },
          { icon: <ShowChartIcon sx={{ fontSize: 22 }} />, title: "History Trend", desc: "Price movement over time" },
        ].map((t) => (
          <Tab key={t.title} label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, width: "100%", justifyContent: "center" }}>
              {t.icon}
              <Box sx={{ textAlign: "left" }}>
                <Typography sx={{ fontSize: "0.98rem", fontWeight: 800, lineHeight: 1.2, color: "inherit" }}>{t.title}</Typography>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 500, color: "#8b97ac", lineHeight: 1.2 }}>{t.desc}</Typography>
              </Box>
            </Box>
          } />
        ))}
      </Tabs>

      {/* Filter bar — conditional/cascading like the APSO Products app */}
      <Card sx={{ mb: 2, border: "1px solid #e4e9f1" }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* Single filter row — article selection (Material + hierarchy), shared across all
                tabs. Competitors + Scrape are price-only and appear on the Pricing tab. */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Autocomplete size="small" sx={{ minWidth: 200, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#274e64", borderWidth: 1.5 }, "& .MuiInputLabel-root": { color: "#274e64", fontWeight: 600 } }}
                options={materials.map(m => m.material)}
                getOptionLabel={(o) => matLabel(o)} value={material || null}
                onChange={(_, v) => setMaterial(v || "")}
                renderInput={(params) => <TextField {...params} label="Material" placeholder="All materials" />} />
              <Autocomplete size="small" sx={{ minWidth: 150 }} options={profitCenters}
                value={profitCenter || null} onChange={(_, v) => { setProfitCenter(v || ""); setFAss(""); setFMG(""); setFSG(""); setProductGroup(""); }}
                renderInput={(params) => <TextField {...params} label="Profit Center" />} />
              <Autocomplete size="small" sx={{ minWidth: 210 }} options={assortments}
                getOptionLabel={(o) => `${o.number} — ${o.description || ""}`}
                renderOption={(props, o) => (<li {...props} key={o.number}><Box sx={{ lineHeight: 1.2 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a" }}>{o.description || "(no description)"}</Typography><Typography sx={{ fontSize: "0.65rem", color: "#9e9e9e", fontFamily: "monospace" }}>{o.number}</Typography></Box></li>)}
                value={assortments.find(g => g.number === fAss) || null}
                onChange={(_, v) => { setFAss(v ? v.number : ""); setFMG(""); setFSG(""); setProductGroup(""); }}
                isOptionEqualToValue={(o, v) => o.number === v.number}
                renderInput={(params) => <TextField {...params} label="Assortment" />} />
              <Autocomplete size="small" sx={{ minWidth: 210 }} options={mainGroups}
                getOptionLabel={(o) => `${o.number} — ${o.description || ""}`}
                renderOption={(props, o) => (<li {...props} key={o.number}><Box sx={{ lineHeight: 1.2 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a" }}>{o.description || "(no description)"}</Typography><Typography sx={{ fontSize: "0.65rem", color: "#9e9e9e", fontFamily: "monospace" }}>{o.number}</Typography></Box></li>)}
                value={mainGroups.find(g => g.number === fMG) || null}
                onChange={(_, v) => { setFMG(v ? v.number : ""); setFSG(""); setProductGroup(""); }}
                isOptionEqualToValue={(o, v) => o.number === v.number}
                renderInput={(params) => <TextField {...params} label="Main Group" />} />
              <Autocomplete size="small" sx={{ minWidth: 230, "& .MuiOutlinedInput-notchedOutline": { borderColor: fSG ? "#274e64" : "#bcc3cc" } }} options={subGroups}
                getOptionLabel={(o) => `${o.number} — ${o.description || ""}`}
                renderOption={(props, o) => (<li {...props} key={o.number}><Box sx={{ lineHeight: 1.2 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a" }}>{o.description || "(no description)"}</Typography><Typography sx={{ fontSize: "0.65rem", color: "#9e9e9e", fontFamily: "monospace" }}>{o.number}</Typography></Box></li>)}
                value={subGroups.find(g => g.number === fSG) || null}
                onChange={(_, v) => { setFSG(v ? v.number : ""); setProductGroup(""); }}
                isOptionEqualToValue={(o, v) => o.number === v.number}
                renderInput={(params) => <TextField {...params} label="Sub Group" />} />
              <Autocomplete size="small" sx={{ minWidth: 230 }} options={productGroups}
                getOptionLabel={(o) => `${o.number} — ${o.description || ""}`}
                renderOption={(props, o) => (<li {...props} key={o.number}><Box sx={{ lineHeight: 1.2 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a" }}>{o.description || "(no description)"}</Typography><Typography sx={{ fontSize: "0.65rem", color: "#9e9e9e", fontFamily: "monospace" }}>{o.number}</Typography></Box></li>)}
                value={productGroups.find(g => g.number === productGroup) || null}
                onChange={(_, v) => setProductGroup(v ? v.number : "")}
                isOptionEqualToValue={(o, v) => o.number === v.number}
                renderInput={(params) => <TextField {...params} label="Product Group" />} />
              {/* Competitors + Scrape are price-only (competitor comparison) — Pricing tab only. */}
              {tab === 0 && <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <FormControl size="small" sx={{ minWidth: 150, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#c8463a" } }}>
                  <InputLabel sx={{ color: "#c5221f", fontWeight: 600 }}>Market</InputLabel>
                  <Select value={mandant} label="Market" onChange={(e) => setMandant(e.target.value as "M100" | "M110" | "both")}>
                    <MenuItem value="M100">M100 · CHF</MenuItem>
                    <MenuItem value="M110">M110 · EUR</MenuItem>
                    <MenuItem value="both">Both markets</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Competitors</InputLabel>
                  <Select multiple value={selectedComps.map(String)} label="Competitors"
                    onChange={(e) => { const v = e.target.value; const arr = (typeof v === "string" ? v.split(",") : v).map(Number); setSelectedComps(arr); setSavedComps(arr.length === availableComps.length ? [] : arr); }}
                    renderValue={(sel) => (sel as string[]).length === 0 ? "None" : (sel as string[]).length === availableComps.length ? "All competitors" : (sel as string[]).map(id => competitorsList.find(c => c.id === Number(id))?.name || id).join(", ")}>
                    {availableComps.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>
                        <Checkbox size="small" checked={selectedComps.includes(c.id)} sx={{ p: 0.5, mr: 0.5 }} />
                        <ListItemText primaryTypographyProps={{ fontSize: "0.85rem" }}>{c.name} <span style={{ color: "#8b97ac" }}>· {ccySym(c.currency)}</span></ListItemText>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Scrape ({scrapeDates.length})</InputLabel>
                  <Select value={scrapeDate} label={`Scrape (${scrapeDates.length})`} onChange={(e) => setScrapeDate(e.target.value)}>
                    <MenuItem value="">Latest prices</MenuItem>
                    {scrapeDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </>}
              {sf.active && (
                <Button size="small" onClick={() => sf.reset()} sx={{ color: "#c8463a", fontSize: 12, fontWeight: 600 }}>Clear all</Button>
              )}
              {tab === 0 && <DetailModeToggle mode={detailMode} onChange={setDetailMode} />}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {/* ───────── OVERVIEW ───────── */}
      {tab === 0 && (
        <Box className="animate-fade-in">
          {selectedComps.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", color: "#8b97ac", fontSize: "0.85rem" }}>Pick one or more competitors above.</Box>
          ) : (
            <>
              <ScaleCurveCard comps={availableComps.filter(c => selectedComps.includes(c.id))} shared={{ profitCenter, fAss, fMG, fSG, productGroup, material, scrapeDate }} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                {availableComps.filter(c => selectedComps.includes(c.id)).map(c => (
                  <CompetitorCard key={c.id} comp={c} detailMode={detailMode} shared={{ profitCenter, fAss, fMG, fSG, productGroup, material, scrapeDate }} />
                ))}
              </Box>
            </>
          )}
        </Box>
      )}

      {/* ───────── STOCK ───────── */}
      {tab === 1 && (
        <Box className="animate-fade-in">
          <StockInsightsPanel qs={(() => { const s = new URLSearchParams({ mandant }); if (material) s.set("material", material); if (productGroup) s.set("product_group", productGroup); if (profitCenter) s.set("profit_center", profitCenter); if (fAss) s.set("assortment", fAss); if (fMG) s.set("main_group", fMG); if (fSG) s.set("sub_group", fSG); return s.toString(); })()} />

          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase", letterSpacing: "0.05em", mt: 3, mb: 1.2 }}>Raw coverage</Typography>
          <Box>

            {/* Full data table: every number behind the chart */}
            <Card sx={{ border: "1px solid #e4e9f1", width: "100%", display: "flex", flexDirection: "column" }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #e4e9f1" }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#15223a", fontFamily: "var(--font-outfit), sans-serif" }}>Stock coverage — APSO vs competitors</Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "#5d6b85" }}>Every in-stock count feeding the chart — APSO plus each competitor, per material.</Typography>
              </Box>
              <Box sx={{ overflowX: "auto", flex: 1 }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "& th": { textAlign: "left", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#5d6b85", p: 1, borderBottom: "1px solid #e4e9f1", bgcolor: "#f5f7fb", whiteSpace: "nowrap" }, "& td": { fontSize: "0.72rem", color: "#15223a", p: 1, borderBottom: "1px solid #f0f1f3", whiteSpace: "nowrap" } }}>
                  <thead><tr>
                    <th style={{ position: "sticky", left: 0, background: "#f5f7fb", zIndex: 1 }}>Material</th>
                    <th><Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: STOCK_PALETTE[0] }} />APSO in stock</Box></th>
                    <th>APSO articles</th>
                    <th>APSO units</th>
                    {stockComps.map(c => (
                      <th key={c.code}><Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: c.color }} />{c.name.split(" ")[0]} in stock</Box></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {stock.map((r) => (
                      <tr key={r.material}>
                        <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{matLabel(r.material)}</td>
                        <td style={{ fontWeight: 700 }}>{num(r.apso_in_stock).toLocaleString()}</td>
                        <td style={{ color: "#5d6b85" }}>{num(r.apso_products).toLocaleString()}</td>
                        <td style={{ color: "#5d6b85" }}>{num(r.apso_total_stock).toLocaleString()}</td>
                        {stockComps.map(c => { const v = stockByCompMap.get(`${r.material}|${c.code}`); const inS = num(v?.in_stock || 0); return <td key={c.code} style={{ color: inS > num(r.apso_in_stock) ? "#c5221f" : inS > 0 ? "#1e7e45" : "#c4c9ce", fontWeight: inS > 0 ? 600 : 400 }}>{v ? `${inS.toLocaleString()} / ${num(v.products).toLocaleString()}` : "·"}</td>; })}
                      </tr>
                    ))}
                    {stock.length === 0 && <tr><td colSpan={4 + stockComps.length} style={{ textAlign: "center", padding: 28, color: "#8b97ac" }}>No data</td></tr>}
                  </tbody>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.64rem", color: "#8b97ac", px: 2.5, py: 1 }}>Competitor cells show <b>in&nbsp;stock / total products</b>. Red = competitor beats APSO on in-stock count.</Typography>
            </Card>
          </Box>
        </Box>
      )}

      {/* ───────── HISTORY TREND ───────── */}
      {tab === 2 && <HistoryTrendPanel />}
    </Box>
  );
}
