"use client";
import React, { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import AddIcon from "@mui/icons-material/Add";
import TopScroll from "../TopScroll";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PageHeader from "../PageHeader";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";
import { SearchFilter, SelectFilter, HierFilter, TextFilter, ClearFilters, FW } from "../Filters";
import { downloadXlsx, type Cell, type Sheet } from "@/lib/pricing/xlsx";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface CompMatch {
  ref: string; name: string;
  match_source?: "xref" | "auto_approved" | "auto_pending";
  confidence?: number;
  unit?: string | null;        // effective unit of `prices` (article unit when converted)
  converted?: boolean;         // true = normalized into OUR sales unit; false = competitor's own
  price_date?: string | null;  // when the competitor price was captured (scrape date)
  // the trusted ref this match stands in for, because that one carries a much older price
  replaced?: { ref: string; price_date: string | null; match_source: string } | null;
  prices: Record<number, number>;
  comp_list: Record<number, number>;
  comp_bronze: Record<number, number>;
  comp_silver: Record<number, number>;
  comp_gold: Record<number, number>;
  comp_platinum: Record<number, number>;
}
interface Row {
  id: number; article_number: string; description: string;
  product_description: string | null;
  material_normalized: string | null; diameter: number | null;
  mandant: string; currency: string; profit_center: string | null;
  listprice: string | null; bronze_price: string | null; silver_price: string | null;
  gold_price: string | null; platinum_price: string | null;
  sub_group_number: string | null; main_group_number: string | null;
  assortment_number: string | null; stock: string | null;
  sales_unit: string | null; unit: string | null;
  // Article attributes (dimensions & weight) for the expanded detail row.
  net_weight?: number | string | null; length_mm?: number | string | null;
  thickness_mm?: number | string | null; width_mm?: number | string | null;
  // Per-piece APSO price per set per quantity tier (List uses the quantity scale).
  apso_tiers?: Record<string, Record<number, number | null>>;
  // the ERP scale ladder on the same per-unit basis as the line
  apso_scales?: { qty: number | null; price: number | null }[];
  price_basis_qty?: number | string | null;
  apso_price_date?: string | null;   // when this row was last read from HubSpot
  competitors: Record<string, CompMatch | null>;
}
interface Comp { code: string; name: string; currency: string }
interface Coverage { matched: number; confirmed: number; pct: number | null }
interface HistChange { d: string; from: number; to: number; pct: number }
interface HistComp { code: string; name: string; ref: string; first: { d: string; price: number } | null; latest: { d: string; price: number } | null; changes: HistChange[]; last_change: HistChange | null; max_change: HistChange | null }
interface Filters {
  materials: string[]; product_types: string[];
  profit_centers: string[];
  main_groups: { number: string; description: string }[];
  sub_groups: { number: string; description: string }[];
  assortments: { number: string; description: string }[];
  product_groups: { number: string; description: string }[];
}

const TIERS = [1, 5, 10, 25, 50];
const PRICE_SETS = [
  { key: "comp_list", label: "Listed Price", color: "#274e64", bg: "#e8f0f4" },
  { key: "comp_bronze", label: "Bronze", color: "#b8860b", bg: "#fdf6e3" },
  { key: "comp_silver", label: "Silver", color: "#6b7280", bg: "#f0f0f0" },
  { key: "comp_gold", label: "Gold", color: "#d4a017", bg: "#fef9e7" },
  { key: "comp_platinum", label: "Platinum", color: "#dc2626", bg: "#fef2f2" },
];

function pc(v: number | null | undefined): string { if (v == null) return "#dadce0"; if (v <= -0.1) return "#2e7d32"; if (v <= 0.02) return "#ff9800"; return "#c62828"; }
function pb(v: number | null | undefined): string { if (v == null) return "transparent"; if (v <= -0.1) return "#e8f5e9"; if (v <= 0.02) return "#fff3e0"; return "#ffebee"; }
function fp(v: number | null | undefined): string { if (v == null) return "—"; return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`; }
function fv(v: string | number | null): string { if (v == null || v === "") return "—"; const n = typeof v === "string" ? parseFloat(v) : v; return isNaN(n) ? "—" : n.toFixed(2); }

// Dates read dd.mm.yyyy everywhere in the app (the backend sends ISO yyyy-mm-dd; showing that raw
// or through an en-US locale is how "10-30-2026" got onto the page).
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : d;
}
// How old is a price: grey under three months, dark grey to six, orange beyond — so a year-old
// number never sits on the page looking like this morning's.
function ageColor(d: string | null | undefined): string {
  if (!d) return "#bdc1c6";
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return "#bdc1c6";
  const months = (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
  return months >= 6 ? "#e65100" : months >= 3 ? "#5f6368" : "#9aa1ab";
}
// Per competitor cell: where the match comes from and how sure it is.
function sourceChip(m: CompMatch): { label: string; bg: string; fg: string; tip: string } {
  if (m.match_source === "xref") return { label: "XREF", bg: "#e8f0f4", fg: "#274e64", tip: "Cross-reference file" };
  if (m.match_source === "auto_approved") return { label: `✓ ${m.confidence ?? "?"}%`, bg: "#e8f5e9", fg: "#2e7d32", tip: `Approved · matcher score ${m.confidence ?? "?"}%` };
  return { label: `${m.confidence ?? "?"}%`, bg: "#fff3e0", fg: "#e65100", tip: `Pending review · matcher score ${m.confidence ?? "?"}%` };
}

// How solid are the matches on this row? Reads the WEAKEST one of the competitors currently
// shown, because a single pending match among three is exactly what you need to see before
// pricing off the row — an average would hide it. Green: every match is approved by hand or
// comes from the cross-reference file. Orange: at least one is still the matcher's own guess,
// labelled with its confidence. Grey: nothing matched, the row has no competitor price at all.
function matchQuality(row: Row, comps: Comp[]): { label: string; bg: string; fg: string; detail: string } {
  const ms = comps.map(c => row.competitors?.[c.code]).filter(Boolean) as CompMatch[];
  if (!ms.length) return { label: "no match", bg: "#f1f3f4", fg: "#80868b", detail: "No competitor matched to this article" };
  const pending = ms.filter(m => m.match_source === "auto_pending");
  const lines = ms.map(m => `${m.ref ?? "?"} · ${m.match_source === "xref" ? "cross-reference file" : m.match_source === "auto_approved" ? "approved" : `pending ${m.confidence ?? "?"}%`}`);
  if (!pending.length) return { label: "100%", bg: "#e8f5e9", fg: "#2e7d32", detail: `All ${ms.length} matched and confirmed\n${lines.join("\n")}` };
  const weakest = Math.min(...pending.map(m => Number(m.confidence ?? 0)));
  return {
    label: `${weakest}% pending`, bg: "#fff3e0", fg: "#e65100",
    detail: `${pending.length} of ${ms.length} still unconfirmed — weakest ${weakest}%\n${lines.join("\n")}`,
  };
}

export default function BenchmarkPage() {
  const [data, setData] = useState<Row[]>([]);
  const [comps, setComps] = useState<Comp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  // Every filter of this page is saved to the logged-in user and stays until "Clear all".
  const sf = useSavedFilters("benchmark", {
    search: "", mandant: "M100", pc: "", ass: "", mg: "", sg: "", pg: "", mat: "", matchSource: "",
    priceSets: ["comp_list"] as string[], comps: [] as string[],   // comps [] = every competitor
  });
  const [search, setSearch] = sf.bind("search");
  const [mandant] = sf.bind("mandant");
  // Competitor codes differ per mandant: a saved pick from the other side would empty the table.
  const setMandant = (v: string) => sf.setMany({ mandant: v, comps: [] });
  const [detailMode, setDetailMode] = useDetailMode();
  const [coverage, setCoverage] = useState<Record<string, Coverage>>({});
  const [apsoDate, setApsoDate] = useState<{ latest: string | null; oldest: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState(""); const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  // Manual price injection — creates an entry under the 'manual' pseudo-competitor source
  // (same mechanism as the HubSpot card offers) and reloads the table.
  const [inject, setInject] = useState<{ open: boolean; row: Row | null; price: string; tier: string; label: string; note: string }>({ open: false, row: null, price: "", tier: "1", label: "", note: "" });
  const [injectBusy, setInjectBusy] = useState(false);

  // Which price set comparisons to show. Multi-select; at least one must be active.
  const priceSets = new Set(sf.f.priceSets.length ? sf.f.priceSets : ["comp_list"]);
  function togglePriceSet(key: string) {
    const next = new Set(priceSets);
    if (next.has(key)) {
      if (next.size === 1) return; // keep at least one selected
      next.delete(key);
    } else next.add(key);
    sf.set("priceSets", PRICE_SETS.map(p => p.key).filter(k => next.has(k)));
  }

  // Toggle competitor prices per competitor (click header to expand)
  const [expandedComps, setExpandedComps] = useState<Set<string>>(new Set());
  // Which competitors to show (all by default) — saved with the filters
  const visibleComps: Set<string> | null = sf.f.comps.length ? new Set(sf.f.comps) : null; // null = all
  const setVisibleComps = (v: Set<string> | null) => sf.set("comps", v ? [...v] : []);
  // Expanded row for details
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Per-article price-change log (lazy-loaded when a row is expanded).
  const [histCache, setHistCache] = useState<Record<number, HistComp[]>>({});
  useEffect(() => {
    if (expandedRow == null || histCache[expandedRow]) return;
    let alive = true;
    fetch(`${API_URL}/api/benchmark/price-history/${expandedRow}`).then(r => r.json())
      .then(j => { if (alive) setHistCache(prev => ({ ...prev, [expandedRow]: j.competitors || [] })); })
      .catch(() => { if (alive) setHistCache(prev => ({ ...prev, [expandedRow]: [] })); });
    return () => { alive = false; };
  }, [expandedRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filters
  const [filters, setFilters] = useState<Filters | null>(null);
  const [fPC, setFPC] = sf.bind("pc"); const [fAss, setFAss] = sf.bind("ass"); const [fMG, setFMG] = sf.bind("mg");
  const [fSG, setFSG] = sf.bind("sg"); const [fMat, setFMat] = sf.bind("mat"); const [fPG, setFPG] = sf.bind("pg");
  const [fMatchSource, setFMatchSource] = sf.bind("matchSource"); // "", "xref", "approved", "auto"

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetch(`${API_URL}/api/products/filters`).then(r => r.json()).then(setFilters).catch(() => {}); }, []);

  // ONE query builder for the table and the Excel export, so the export holds exactly the rows
  // on screen (it used to drop the product-group, match-source and competitor filters).
  const compsKey = sf.f.comps.join(",");
  const filterParams = useCallback(() => {
    const p = new URLSearchParams({ mandant });
    if (search) p.set("search", search);
    if (fPC) p.set("profit_center", fPC);
    if (fAss) p.set("assortment", fAss);
    if (fMG) p.set("main_group", fMG);
    if (fSG) p.set("sub_group", fSG);
    if (fPG) p.set("product_group", fPG);
    if (fMat) p.set("material", fMat);
    if (fMatchSource) p.set("match_source", fMatchSource);
    if (compsKey) p.set("competitors", compsKey);
    return p;
  }, [search, mandant, fPC, fAss, fMG, fSG, fPG, fMat, fMatchSource, compsKey]);

  const fetchData = useCallback(async () => {
    if (!sf.ready) return; // wait for this user's saved filters — never load the table twice
    setLoading(true);
    try {
      const p = filterParams();
      p.set("page", String(page + 1)); p.set("per_page", "25");
      const res = await fetch(`${API_URL}/api/benchmark?${p}`);
      const json = await res.json();
      setData(json.data || []); setTotal(json.total || 0); setComps(json.competitors || []);
      setCoverage(json.coverage || {}); setApsoDate(json.apso_price_date || null);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [page, filterParams, sf.ready]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currency = mandant === "M100" ? "CHF" : "EUR";
  const hasF = !!(search || fPC || fAss || fMG || fSG || fPG || fMat || fMatchSource || sf.f.comps.length || sf.f.priceSets.join(",") !== "comp_list");
  // "Clear all" empties every saved filter of the page; the mandant stays where the user put it.
  const clearAll = () => { sf.reset({ mandant }); setPage(0); };
  const activePSList = PRICE_SETS.filter(s => priceSets.has(s.key));
  const activePS = activePSList[0] || PRICE_SETS[0];
  // APSO price column groups follow the price-set filter — show exactly the selected sets,
  // each as its own quantity-tier group (mirrors the competitor side).
  const apsoSets = activePSList.length ? activePSList : [activePS];
  const shownComps = visibleComps === null ? comps : comps.filter(c => visibleComps.has(c.code));
  // The APSO price is per the ARTICLE's sales unit, which is a metre for bar and plate and a
  // piece only for the piece goods. The header used to say "per pc" whatever was on screen, so a
  // POM-C bar at 0.68 per METRE read as 0.68 per piece. Name the unit when every visible row
  // shares one, and stay honest about it when they do not — each row shows its own unit anyway.
  const unitLabel = (() => {
    const us = new Set(data.map(r => (r.sales_unit || r.unit || "").trim().toLowerCase()).filter(Boolean));
    return us.size === 1 ? [...us][0] : "sales unit";
  })();

  function sort(col: string) { if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } }
  function sorted(rows: Row[]) {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortCol]; const bv = (b as unknown as Record<string, unknown>)[sortCol];
      if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? c : -c;
    });
  }

  async function handleExport(scope: "all" | "view") {
    setExporting(true); setExportOpen(false);
    try {
      const p = filterParams();
      p.set("export", "1");
      p.set("per_page", scope === "all" ? "5000" : "25");
      p.set("page", scope === "all" ? "1" : String(page + 1));
      const res = await fetch(`${API_URL}/api/benchmark?${p}`);
      const json = await res.json();
      const rows = json.data as Row[];
      const cs = (json.competitors as Comp[]).filter(c => !compsKey || compsKey.split(",").includes(c.code));
      if (!rows.length) return;

      const now = new Date();

      // APSO cols: 7 product (inc unit) + 5 prices + their date = 13
      // Per competitor: ref + match + price date + N prices + PRICE_SETS×N comparisons
      const apsoColCount = 13;
      const compBlockSize = 3 + TIERS.length + PRICE_SETS.length * TIERS.length;

      // Column headers + widths + per-column number format.
      const hdrs: { label: string; width: number }[] = [
        { label: "Article Number", width: 16 },
        { label: "Description", width: 34 },
        { label: "Material", width: 16 },
        { label: "Diameter", width: 10 },
        { label: "Sub Group", width: 12 },
        { label: "Profit Center", width: 12 },
        { label: "Sales Unit", width: 10 },
        { label: `List Price (${currency})`, width: 12 },
        { label: "Bronze", width: 12 },
        { label: "Silver", width: 12 },
        { label: "Gold", width: 12 },
        { label: "Platinum", width: 12 },
        { label: "APSO prices as of", width: 13 },
      ];
      const colFmt: (string | null)[] = hdrs.map((_, i) => (i >= 7 && i <= 11 ? "#,##0.00" : null));
      cs.forEach((c) => {
        hdrs.push({ label: `${c.name} Reference`, width: 18 });
        hdrs.push({ label: `${c.name} Match`, width: 12 });
        hdrs.push({ label: `${c.name} Price date`, width: 12 });
        colFmt.push(null, null, null);
        TIERS.forEach((t) => { hdrs.push({ label: `${c.name} Qty ${t}+`, width: 12 }); colFmt.push("#,##0.00"); });
        PRICE_SETS.forEach((ps) => {
          TIERS.forEach((t) => { hdrs.push({ label: `${ps.label} ${t}`, width: 10 }); colFmt.push("0.0%"); });
        });
      });

      // The grid, written by the hub's writer (src/lib/pricing/xlsx.ts): a title and a line on what it holds, a band over
      // each block, the header, the rows. The comparisons are written as percent (12.5), and their header says so.
      const pct = colFmt.map((f) => f === "0.0%");
      const data: Cell[][] = rows.map((row) => {
        const vals: Cell[] = [
          row.article_number, row.description || "",
          (row.material_normalized || "").toUpperCase(),
          row.diameter ? parseFloat(String(row.diameter)) : "",
          row.sub_group_number || "", row.profit_center || "",
          row.sales_unit || row.unit || "",
          // the same per-unit figures as the line on screen (o-rings per piece, not per 100)
          ...["list", "bronze", "silver", "gold", "platinum"].map(k => row.apso_tiers?.[k]?.[1] ?? ""),
          fmtDate(row.apso_price_date),
        ];
        cs.forEach((comp) => {
          const m = row.competitors?.[comp.code];
          vals.push(m?.ref || "");
          vals.push(m ? sourceChip(m).tip : "");
          vals.push(m ? fmtDate(m.price_date) : "");
          TIERS.forEach((t) => vals.push(m?.prices?.[t] ?? ""));
          PRICE_SETS.forEach((ps) => {
            TIERS.forEach((t) => vals.push((m as unknown as Record<string, Record<number, number>>)?.[ps.key]?.[t] ?? ""));
          });
        });
        return vals.map((v, i) => (pct[i] && typeof v === "number" ? Math.round(v * 1000) / 10 : v));
      });
      const sheet: Sheet = {
        name: "Benchmark",
        preamble: [
          `APSO Benchmark — ${mandant} (${currency})`,
          `${scope === "all" ? "All" : "Filtered"}  |  ${rows.length} products  |  ${cs.map((c) => c.name).join(", ")}  |  ${fmtDate(now.toISOString())}`,
        ],
        groups: [
          { label: "APSO Product", span: 7, tone: "navy" },
          { label: `APSO Prices (${currency})`, span: apsoColCount - 7, tone: "blue" },
          ...cs.map((c) => ({ label: c.name, span: compBlockSize, tone: "slate" as const })),
        ],
        columns: hdrs.map((h, i) => ({
          header: pct[i] ? `${h.label} %` : h.label, width: h.width,
          format: colFmt[i] === "#,##0.00" ? ("money" as const) : pct[i] ? ("pct1" as const) : undefined,
        })),
        rows: data,
      };
      const ts = now.toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `APSOPricingHub_Benchmark_${mandant}_${scope}_${ts}.xlsx`;
      await downloadXlsx(filename, [sheet]);
    } catch (e) { console.error(e); } finally { setExporting(false); }
  }

  return (
    <Box>
      <PageHeader icon="benchmark" eyebrow="Pricing Intelligence" title="Benchmark Table" subtitle={`${mandant} — ${comps.map(c => c.name).join(", ") || "Loading..."}`}
        rightSlot={<Button variant="contained" startIcon={exporting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <FileDownloadIcon />} disabled={exporting || total === 0} onClick={() => setExportOpen(true)}
          sx={{ bgcolor: "#ed1b2f", color: "#fff", boxShadow: "none", fontWeight: 700,
            "&:hover": { bgcolor: "#c41527", boxShadow: "none" } }}>
          {exporting ? "Exporting..." : "Export Excel"}
        </Button>} />

      {/* Filters */}
      <Card sx={{ mb: 2, border: "1px solid #ececec", borderRadius: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <SearchFilter value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
            <SelectFilter label="Mandant" width={FW.mandant} noAll value={mandant} onChange={(v) => { setMandant(v); setPage(0); }}
              options={[{ value: "M100", label: "M100 (CH)" }, { value: "M110", label: "M110 (DE)" }]} />
            {filters && <>
              <TextFilter label="Profit Center" value={fPC} options={filters.profit_centers || []} onChange={(v) => { setFPC(v); setPage(0); }} />
              <HierFilter label="Assortment" value={fAss} options={filters.assortments || []} onChange={(n) => { setFAss(n); setPage(0); }} />
              <HierFilter label="Main Group" value={fMG} options={filters.main_groups || []} onChange={(n) => { setFMG(n); setPage(0); }} />
              <HierFilter label="Sub Group" value={fSG} options={filters.sub_groups || []} onChange={(n) => { setFSG(n); setPage(0); }} />
              <HierFilter label="Product Group" value={fPG} options={filters.product_groups || []} onChange={(n) => { setFPG(n); setPage(0); }} />
            </>}
            <ClearFilters show={hasF} onClick={clearAll} />
            <Box sx={{ flex: 1 }} />
            {apsoDate?.latest && (
              <Tooltip arrow title={apsoDate.oldest && apsoDate.oldest !== apsoDate.latest ? `Read from HubSpot · oldest row ${fmtDate(apsoDate.oldest)}` : "Read from HubSpot"}>
                <Chip label={`APSO prices · ${fmtDate(apsoDate.latest)}`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
              </Tooltip>
            )}
            <Chip label={`${total.toLocaleString()} matched`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f5e9", color: "#2e7d32" }} />
          </Box>

          {/* Match source filter */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#5f6368" }}>Match from:</Typography>
            {[
              { value: "", label: "All sources (incl. pending)", bg: "#ed1b2f", color: "#fff" },
              { value: "xref", label: "Excel file (Cross-Reference)", bg: "#e8f0f4", color: "#274e64" },
              { value: "approved", label: "Approved only", bg: "#e8f5e9", color: "#1b5e20" },
              { value: "auto", label: "AI Matching (all ≥70%)", bg: "#fff3e0", color: "#e65100" },
            ].map(opt => (
              <Chip key={opt.value} label={opt.label}
                onClick={() => { setFMatchSource(opt.value); setPage(0); }}
                sx={{
                  cursor: "pointer", fontSize: "0.72rem", height: 28, fontWeight: fMatchSource === opt.value ? 700 : 500,
                  bgcolor: fMatchSource === opt.value ? opt.bg : "#f1f3f4",
                  color: fMatchSource === opt.value ? opt.color : "#3c4043",
                  border: fMatchSource === opt.value ? `1px solid ${opt.bg}` : "1px solid transparent",
                }} />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Price set selector — multi-select to compare multiple sets at once */}
      <Box sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center", px: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#5f6368" }}>Compare:</Typography>
        {PRICE_SETS.map(ps => {
          const active = priceSets.has(ps.key);
          return (
            <Chip key={ps.key} label={ps.label} onClick={() => togglePriceSet(ps.key)}
              sx={{ cursor: "pointer", fontSize: "0.82rem", height: 34, px: 2,
                fontWeight: active ? 700 : 500,
                bgcolor: active ? ps.bg : "#f1f3f4",
                color: active ? ps.color : "#5f6368",
                border: active ? `2px solid ${ps.color}` : "1px solid transparent" }} />
          );
        })}
      </Box>

      {/* Competitor selector */}
      <Box sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", px: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#5f6368" }}>Competitors:</Typography>
        {comps.map(c => {
          const isVis = visibleComps === null || visibleComps.has(c.code);
          return (
            <Chip key={c.code} label={c.name}
              onClick={() => {
                setPage(0);
                if (visibleComps === null) {
                  setVisibleComps(new Set([c.code]));
                } else if (visibleComps.has(c.code) && visibleComps.size === 1) {
                  setVisibleComps(null);
                } else if (visibleComps.has(c.code)) {
                  const n = new Set(visibleComps); n.delete(c.code); setVisibleComps(n);
                } else {
                  const n = new Set(visibleComps); n.add(c.code); setVisibleComps(n);
                }
              }}
              sx={{ cursor: "pointer", fontSize: "0.75rem", height: 30, fontWeight: isVis ? 700 : 400, bgcolor: isVis ? "#ed1b2f" : "#f1f3f4", color: isVis ? "#fff" : "#9e9e9e", textDecoration: isVis ? "none" : "line-through", "&:hover": { bgcolor: isVis ? "#c41527" : "#e8eaed" } }} />
          );
        })}
        {visibleComps !== null && (
          <Button size="small" onClick={() => setVisibleComps(null)} sx={{ fontSize: "0.8rem", color: "#274e64", textTransform: "none" }}>Show all</Button>
        )}

        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.6rem", color: "#9e9e9e", mr: 1 }}>Click competitor header to expand prices</Typography>
        <DetailModeToggle mode={detailMode} onChange={setDetailMode} />
      </Box>

      {/* Legend */}
      <Box sx={{ display: "flex", gap: 2, mb: 1, px: 0.5, alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#e8f5e9", border: "1px solid #2e7d32" }} />
          <Typography sx={{ fontSize: "0.72rem", color: "#2e7d32", fontWeight: 600 }}>APSO cheaper than competitor</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#fff3e0", border: "1px solid #ff9800" }} />
          <Typography sx={{ fontSize: "0.72rem", color: "#e65100", fontWeight: 600 }}>Similar price (±2%)</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#ffebee", border: "1px solid #c62828" }} />
          <Typography sx={{ fontSize: "0.72rem", color: "#c62828", fontWeight: 600 }}>APSO more expensive</Typography>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 1, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {/* Table */}
      <Card sx={{ border: "1px solid #ececec", borderRadius: 0 }}>
        <CardContent sx={{ p: 0 }}>
          <TopScroll><TableContainer sx={{ overflowX: "visible", overflowY: "auto", maxHeight: "72vh" }}>
            <Table size="small" stickyHeader sx={{ minWidth: 900 + comps.length * (TIERS.length + (expandedComps.size > 0 ? TIERS.length : 0)) * 55 }}>
              <TableHead>
                {/* Row 1: Group headers */}
                <TableRow>
                  <TableCell sx={{ bgcolor: "#eef2f6", borderBottom: "none", width: 36 }} />
                  <TableCell colSpan={7} sx={{ bgcolor: "#eef2f6", color: "#274e64", fontWeight: 800, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.3, borderRight: "2px solid #d8e0e6", borderBottom: "none" }}>APSO Product</TableCell>
                  {apsoSets.map((ps, i) => {
                    const multi = apsoSets.length > 1;
                    return (
                      <TableCell key={`apso-grp-${ps.key}`} colSpan={TIERS.length}
                        sx={{ bgcolor: multi ? ps.bg : "#eef2f6", color: multi ? ps.color : "#274e64", fontWeight: 800, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", borderRight: i === apsoSets.length - 1 ? "2px solid #d8e0e6" : undefined, borderBottom: "none" }}>
                        {multi ? ps.label : <>APSO {ps.label} ({currency}) · per {unitLabel}</>}
                      </TableCell>
                    );
                  })}
                  {shownComps.map((c, ci) => {
                    const isExp = expandedComps.has(c.code);
                    // ref col (1) + optional price-tier cols + one TIERS group per selected price set
                    const span = 1 + (isExp ? TIERS.length : 0) + (activePSList.length * TIERS.length);
                    return (
                      <TableCell key={c.code} colSpan={span}
                        onClick={() => { const n = new Set(expandedComps); if (n.has(c.code)) n.delete(c.code); else n.add(c.code); setExpandedComps(n); }}
                        sx={{ bgcolor: "#fdf3d7", color: "#854d0e", fontWeight: 800, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", cursor: "pointer", borderRight: ci < shownComps.length - 1 ? "2px solid #f3d98a" : undefined, borderBottom: "none", "&:hover": { bgcolor: "#f9e9b8" } }}>
                        {isExp ? "◀ " : ""}{c.name}{!isExp ? " ▶" : ""}
                        {coverage[c.code] && (
                          <Tooltip arrow title={`${coverage[c.code].matched.toLocaleString()} of ${total.toLocaleString()} articles have a ${c.name} counterpart · ${coverage[c.code].confirmed.toLocaleString()} confirmed (cross-reference or approved)`}>
                            <Box sx={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "none", letterSpacing: 0, color: "#a16207", mt: 0.2 }}>
                              {coverage[c.code].pct != null ? `${coverage[c.code].pct}% matched` : "—"} · {coverage[c.code].matched.toLocaleString()}
                            </Box>
                          </Tooltip>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {/* Row 2: Column headers */}
                <TableRow>
                  <TableCell sx={{ bgcolor: "#f8f9fa", width: 36, p: 0 }} />
                  {[
                    { id: "article_number", label: "Article" },
                    { id: "description", label: "Description" },
                    { id: "material_normalized", label: "Material" },
                    { id: "diameter", label: "Dia." },
                    { id: "sales_unit", label: "Unit" },
                    { id: "match", label: "Match" },
                  ].map((col, i) => (
                    <TableCell key={col.id} sx={{ bgcolor: "#f8f9fa", fontWeight: 700, fontSize: "0.72rem", color: "#5f6368", whiteSpace: "nowrap", borderRight: i === 5 ? "2px solid #ececec" : undefined }}>
                      <TableSortLabel active={sortCol === col.id} direction={sortCol === col.id ? sortDir : "asc"} onClick={() => sort(col.id)}>{col.label}</TableSortLabel>
                    </TableCell>
                  ))}
                  {/* APSO price = each shown set's quantity-scaled prices (1/5/10/25/50). */}
                  {apsoSets.map((ps) => TIERS.map((t, i) => (
                    <TableCell key={`apso-h-${ps.key}-${t}`} align="right" sx={{ bgcolor: ps.bg, fontWeight: 700, fontSize: "0.7rem", color: ps.color, whiteSpace: "nowrap", borderLeft: i === 0 && apsoSets.length > 1 ? `1px dashed ${ps.color}` : undefined, borderRight: i === TIERS.length - 1 ? "2px solid #ececec" : undefined }}>
                      {t}+
                    </TableCell>
                  )))}
                  {/* Per competitor columns */}
                  {shownComps.map((c, ci) => {
                    const isExp = expandedComps.has(c.code);
                    return (
                      <React.Fragment key={c.code}>
                        <TableCell sx={{ bgcolor: "#f8f9fa", fontWeight: 600, fontSize: "0.5rem", color: "#5f6368", whiteSpace: "nowrap" }}>Match Ref</TableCell>
                        {isExp && TIERS.map(t => (
                          <TableCell key={`${c.code}-p-${t}`} sx={{ bgcolor: "#f0fdf4", fontWeight: 600, fontSize: "0.5rem", color: "#2e7d32", textAlign: "right", whiteSpace: "nowrap" }}>{t}+</TableCell>
                        ))}
                        {activePSList.map((ps, psi) => TIERS.map((t, ti) => {
                          const isLast = psi === activePSList.length - 1 && ti === TIERS.length - 1;
                          return (
                            <TableCell key={`${c.code}-${ps.key}-${t}`}
                              sx={{ bgcolor: ps.bg, fontWeight: 600, fontSize: "0.5rem", color: ps.color, textAlign: "right", whiteSpace: "nowrap",
                                borderLeft: ti === 0 ? `1px dashed ${ps.color}` : undefined,
                                borderRight: isLast && ci < shownComps.length - 1 ? "2px solid #ececec" : undefined }}>
                              {ti === 0 && <Box sx={{ fontSize: "0.5rem", fontWeight: 700, mb: 0.2, textTransform: "uppercase" }}>{ps.label}</Box>}
                              {t}
                            </TableCell>
                          );
                        }))}
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={100} align="center" sx={{ py: 6, color: "#5f6368" }}>No cross-referenced products found for {mandant}.</TableCell></TableRow>
                )}
                {sorted(data).map((row, ri, arr) => {
                  const bg = ri % 2 === 1 ? "#f8f9fa" : "#fff";
                  const isExp = expandedRow === row.id;
                  return (
                    <React.Fragment key={row.id}>
                    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => setExpandedRow(isExp ? null : row.id)}>
                      <TableCell sx={{ p: 0.5, width: 36, bgcolor: bg }}>
                        <IconButton size="small" sx={{ color: isExp ? "#274e64" : "#bdc1c6" }}>
                          {isExp ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ bgcolor: bg }}><Typography sx={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "monospace", color: "#274e64", whiteSpace: "nowrap" }}>{row.article_number}</Typography></TableCell>
                      <TableCell sx={{ bgcolor: bg }}><Tooltip title={row.description || ""} arrow><Typography sx={{ fontSize: "0.75rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.product_description || row.description || "—"}</Typography></Tooltip></TableCell>
                      <TableCell sx={{ bgcolor: bg }}><Chip label={(row.material_normalized || "—").toUpperCase()} size="small" sx={{ fontSize: "0.5rem", height: 16 }} /></TableCell>
                      <TableCell sx={{ bgcolor: bg }}><Typography sx={{ fontSize: "0.78rem" }}>{row.diameter ?? "—"}</Typography></TableCell>
                      <TableCell sx={{ bgcolor: bg }}><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{row.sales_unit || row.unit || "—"}</Typography></TableCell>
                      <TableCell sx={{ bgcolor: bg, borderRight: "2px solid #ececec" }}>{(() => {
                        const q = matchQuality(row, shownComps);
                        return (
                          <Tooltip title={q.detail} arrow>
                            <Chip label={q.label} size="small" sx={{ fontSize: "0.55rem", height: 17, fontWeight: 800, bgcolor: q.bg, color: q.fg, "& .MuiChip-label": { px: 0.7 } }} />
                          </Tooltip>
                        );
                      })()}</TableCell>
                      {/* APSO per-set quantity-scaled prices (1/5/10/25/50) */}
                      {apsoSets.map((ps) => TIERS.map((t, i) => {
                        const v = row.apso_tiers?.[ps.key.replace("comp_", "")]?.[t] ?? null;
                        // 1+ is the listed price; say so, and name the ERP scale when one starts at or below one unit.
                        const low = ps.key === "comp_list" && t === 1 ? (row.apso_scales || []).find(s => s.qty != null && s.qty <= 1 && s.price != null) : undefined;
                        const tip = ps.key === "comp_list" && t === 1
                          ? `Listed price${low ? ` · ERP scale from ${low.qty} ${row.sales_unit || row.unit || ""}: ${fv(low.price)} (applied from 5+)` : ""}`
                          : "";
                        return (
                          <TableCell key={`apso-b-${ps.key}-${t}`} align="right" sx={{ bgcolor: ps.bg, borderLeft: i === 0 && apsoSets.length > 1 ? `1px dashed ${ps.color}` : undefined, borderRight: i === TIERS.length - 1 ? "2px solid #ececec" : undefined }}>
                            <Tooltip title={tip} arrow disableHoverListener={!tip}>
                              <Typography sx={{ fontSize: "0.78rem", fontFamily: "monospace", fontWeight: 600, color: ps.color }}>{fv(v)}</Typography>
                            </Tooltip>
                          </TableCell>
                        );
                      }))}

                      {/* Per competitor */}
                      {shownComps.map((c, ci) => {
                        const m = row.competitors?.[c.code];
                        const isExp = expandedComps.has(c.code);
                        return (
                          <React.Fragment key={c.code}>
                            {/* Match ref, with how old the price is */}
                            <TableCell sx={{ bgcolor: bg }}>
                              <Tooltip title={m?.name || "No match"} arrow>
                                <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: m?.ref ? "#274e64" : "#dadce0", fontWeight: 600, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {m?.ref || "—"}
                                </Typography>
                              </Tooltip>
                              {m && (() => {
                                const sc = sourceChip(m);
                                return (
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.2, whiteSpace: "nowrap" }}>
                                    <Tooltip title={sc.tip} arrow>
                                      <Box component="span" sx={{ fontSize: "0.52rem", fontWeight: 800, px: 0.5, borderRadius: 0.5, bgcolor: sc.bg, color: sc.fg }}>{sc.label}</Box>
                                    </Tooltip>
                                    <Tooltip arrow title={m.replaced
                                      ? `Price of ${fmtDate(m.price_date)} · stands in for ${m.replaced.ref}, whose price is of ${fmtDate(m.replaced.price_date)}`
                                      : `Price of ${fmtDate(m.price_date)}`}>
                                      <Box component="span" sx={{ fontSize: "0.55rem", fontWeight: 700, color: ageColor(m.price_date) }}>{fmtDate(m.price_date)}{m.replaced ? " ↻" : ""}</Box>
                                    </Tooltip>
                                  </Box>
                                );
                              })()}
                            </TableCell>
                            {isExp && TIERS.map(t => (
                              <TableCell key={`${c.code}-p-${t}`} align="right" sx={{ bgcolor: "#f0fdf4" }}>
                                <Tooltip title={m ? `${m.name} (${m.ref})${m.price_date ? ` · price of ${fmtDate(m.price_date)}` : ""}${m.unit ? ` · per ${m.unit}${m.converted ? " (converted to our unit)" : " (competitor's own unit!)"}` : ""}` : "No match"} arrow>
                                  <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 500, color: m?.prices?.[t] ? "#2e7d32" : "#dadce0" }}>
                                    {m?.prices?.[t] ? fv(m.prices[t]) : "—"}
                                    {m?.prices?.[t] != null && m?.unit && <Box component="span" sx={{ fontSize: "0.58rem", fontWeight: 700, color: m.converted ? "#9aa1ab" : "#e65100" }}> /{m.unit}</Box>}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                            ))}
                            {activePSList.map((ps, psi) => {
                              const compData = m ? (m as unknown as Record<string, Record<number, number>>)[ps.key] || {} : {};
                              return TIERS.map((t, ti) => {
                                const v = compData[t] as number | undefined;
                                const isLast = psi === activePSList.length - 1 && ti === TIERS.length - 1;
                                return (
                                  <TableCell key={`${c.code}-${ps.key}-${t}`} align="right"
                                    sx={{ bgcolor: pb(v),
                                      borderLeft: ti === 0 ? `1px dashed ${ps.color}` : undefined,
                                      borderRight: isLast && ci < shownComps.length - 1 ? "2px solid #ececec" : undefined }}>
                                    <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 700, color: pc(v) }}>{fp(v)}</Typography>
                                  </TableCell>
                                );
                              });
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                    {/* Row detail — pop-up (default) or the drop-down under the row */}
                    <RowDetail mode={detailMode} open={isExp} onClose={() => setExpandedRow(null)} colSpan={100}
                      title={`${row.article_number} · ${row.description || row.product_description || ""}`}
                      subtitle={`${mandant} · per ${row.sales_unit || row.unit || "unit"} · APSO prices of ${fmtDate(row.apso_price_date)}`}
                      onPrev={ri > 0 ? () => setExpandedRow(arr[ri - 1].id) : undefined}
                      onNext={ri < arr.length - 1 ? () => setExpandedRow(arr[ri + 1].id) : undefined}>
                          <Box sx={{ p: 3, bgcolor: "#f8f9fb" }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
                              {/* Product Details */}
                              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>Product Details</Typography>
                                  {[
                                    ["Article No.", row.article_number],
                                    ["Description", row.description],
                                    ["Material", (row.material_normalized || "").toUpperCase()],
                                    ["Diameter", row.diameter ? `${row.diameter} mm` : "—"],
                                    ["Thickness", row.thickness_mm ? `${fv(row.thickness_mm)} mm` : "—"],
                                    ["Width", row.width_mm ? `${fv(row.width_mm)} mm` : "—"],
                                    ["Length", row.length_mm ? `${fv(row.length_mm)} mm` : "—"],
                                    ["Net weight", row.net_weight ? `${fv(row.net_weight)} kg` : "—"],
                                    ["Sales unit", row.sales_unit || row.unit || "—"],
                                    ["Mandant", row.mandant],
                                    ["APSO prices as of", fmtDate(row.apso_price_date)],
                                    ["Currency", row.currency],
                                    ["Profit Center", row.profit_center],
                                    ["Sub Group", row.sub_group_number],
                                    ["Assortment", row.assortment_number],
                                    ["Stock", row.stock],
                                  ].map(([l, v]) => (
                                    <Box key={String(l)} sx={{ display: "flex", justifyContent: "space-between", py: 0.4, borderBottom: "1px solid #f0f0f0" }}>
                                      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>{l}</Typography>
                                      <Typography sx={{ fontSize: "0.75rem", color: "#1f1f1f", fontWeight: 500 }}>{v ?? "—"}</Typography>
                                    </Box>
                                  ))}
                                </CardContent>
                              </Card>

                              {/* APSO All Prices */}
                              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>APSO Prices ({currency}) · per {Number(row.price_basis_qty) > 1 ? "pc" : (row.sales_unit || row.unit || "unit")}</Typography>
                                  {/* The SAME per-unit figures as the line (an o-ring priced per 100 is shown per piece). */}
                                  {[
                                    { label: "Listed Price", v: row.apso_tiers?.list?.[1] ?? null, color: "#274e64", bg: "#e8f0f4" },
                                    { label: "Bronze", v: row.apso_tiers?.bronze?.[1] ?? null, color: "#b8860b", bg: "#fdf6e3" },
                                    { label: "Silver", v: row.apso_tiers?.silver?.[1] ?? null, color: "#6b7280", bg: "#f0f0f0" },
                                    { label: "Gold", v: row.apso_tiers?.gold?.[1] ?? null, color: "#d4a017", bg: "#fef9e7" },
                                    { label: "Platinum", v: row.apso_tiers?.platinum?.[1] ?? null, color: "#dc2626", bg: "#fef2f2" },
                                  ].map(p => (
                                    <Box key={p.label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5, px: 1, borderRadius: 1, bgcolor: p.bg, mb: 0.5 }}>
                                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: p.color }}>{p.label}</Typography>
                                      <Typography sx={{ fontSize: "0.82rem", fontFamily: "monospace", fontWeight: 700, color: p.color }}>{fv(p.v)}</Typography>
                                    </Box>
                                  ))}
                                  {Number(row.price_basis_qty) > 1 && (
                                    <Typography sx={{ fontSize: "0.68rem", color: "#5f6368", mt: 0.5 }}>
                                      ERP price per {Number(row.price_basis_qty)} pcs: {fv(row.listprice)}
                                    </Typography>
                                  )}
                                  {(row.apso_scales || []).length > 0 && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: "#274e64", textTransform: "uppercase", mb: 0.5 }}>Listed price scales (ERP)</Typography>
                                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                        {(row.apso_scales || []).map((s, si) => (
                                          <Chip key={si} size="small" label={`from ${s.qty ?? "?"} ${row.sales_unit || row.unit || ""}: ${fv(s.price)}`}
                                            sx={{ height: 20, fontSize: "0.65rem", fontFamily: "monospace", bgcolor: "#e8f0f4", color: "#274e64" }} />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Competitor Matches */}
                              <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #e0e7ff", bgcolor: "#fafbff" }}>
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#4285f4", textTransform: "uppercase", mb: 1 }}>Cross-Reference Matches</Typography>
                                  {shownComps.map(c => {
                                    const m = row.competitors?.[c.code];
                                    return (
                                      <Box key={c.code} sx={{ mb: 1.5 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: m?.ref ? "#34a853" : "#dadce0" }} />
                                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#1f1f1f" }}>{c.name}</Typography>
                                        </Box>
                                        {m?.ref ? (
                                          <>
                                            <Box sx={{ pl: 2 }}>
                                              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>
                                                Ref: <strong style={{ color: "#274e64", fontFamily: "monospace" }}>{m.ref}</strong>
                                              </Typography>
                                              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>
                                                Product: {m.name || "—"}
                                              </Typography>
                                              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>
                                                Match:{" "}
                                                {m.match_source === "xref" ? (
                                                  <><Chip label="Cross-reference" size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: "#e8f5e9", color: "#2e7d32", fontWeight: 600 }} /> from Benchmark Excel</>
                                                ) : m.match_source === "auto_approved" ? (
                                                  <><Chip label={`AI approved · ${m.confidence ?? "?"}%`} size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: "#e8f5e9", color: "#2e7d32", fontWeight: 600 }} /></>
                                                ) : (
                                                  <><Chip label={`AI pending · ${m.confidence ?? "?"}%`} size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: "#fff3e0", color: "#e65100", fontWeight: 600 }} /> — requires review</>
                                                )}
                                              </Typography>
                                              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>
                                                Price date: <strong style={{ color: ageColor(m.price_date) }}>{fmtDate(m.price_date)}</strong>
                                                {m.unit && (
                                                  <> · per <strong style={{ color: m.converted ? "#2e7d32" : "#e65100" }}>{m.unit}</strong>{m.converted ? " (our unit)" : " — competitor's own unit, not comparable!"}</>
                                                )}
                                              </Typography>
                                              {m.replaced && (
                                                <Typography sx={{ fontSize: "0.7rem", color: "#a16207" }}>
                                                  Stands in for {m.replaced.match_source === "xref" ? "cross-reference" : "match"} <strong style={{ fontFamily: "monospace" }}>{m.replaced.ref}</strong> — its price is of {fmtDate(m.replaced.price_date)}
                                                </Typography>
                                              )}
                                              {Object.keys(m.prices).length > 0 && (
                                                <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                                  {Object.entries(m.prices).sort(([a], [b]) => Number(a) - Number(b)).map(([t, p]) => (
                                                    <Chip key={t} label={`${t}+: ${c.currency} ${fv(p)}${m.unit ? `/${m.unit}` : ""}`} size="small" sx={{ height: 20, fontSize: "0.65rem", bgcolor: "#f0fdf4", color: "#2e7d32", fontFamily: "monospace" }} />
                                                  ))}
                                                </Box>
                                              )}
                                            </Box>
                                          </>
                                        ) : (
                                          <Typography sx={{ pl: 2, fontSize: "0.72rem", color: "#dadce0" }}>No match</Typography>
                                        )}
                                      </Box>
                                    );
                                  })}
                                  <Button size="small" startIcon={<AddIcon />} onClick={() => setInject({ open: true, row, price: "", tier: "1", label: "", note: "" })}
                                    sx={{ mt: 0.5, textTransform: "none", fontWeight: 700, fontSize: "0.72rem", color: "#274e64" }}>
                                    Inject price manually
                                  </Button>
                                </CardContent>
                              </Card>

                              {/* Price change log — every competitor price move on this article */}
                              <Card variant="outlined" sx={{ borderRadius: 3, gridColumn: { xs: "1", md: "1 / -1" } }}>
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>
                                    Price change log <Box component="span" sx={{ color: "#9aa0a6", textTransform: "none", fontWeight: 500 }}>— every recorded move of the matched competitor prices (tier 1)</Box>
                                  </Typography>
                                  {!histCache[row.id] ? (
                                    <Typography sx={{ fontSize: "0.74rem", color: "#9aa0a6" }}>Loading price history…</Typography>
                                  ) : histCache[row.id].length === 0 ? (
                                    <Typography sx={{ fontSize: "0.74rem", color: "#9aa0a6" }}>No price history recorded for the matched competitor products yet.</Typography>
                                  ) : (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                                      {histCache[row.id].map(h => (
                                        <Box key={h.code} sx={{ flex: "1 1 260px", minWidth: 240, border: "1px solid #eef0f3", borderRadius: 2, p: 1.25 }}>
                                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800 }}>{h.name}</Typography>
                                            <Typography sx={{ fontSize: "0.64rem", fontFamily: "monospace", color: "#9aa0a6" }}>{h.ref}</Typography>
                                          </Box>
                                          <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
                                            Last change: {h.last_change
                                              ? <><b>{fmtDate(h.last_change.d)}</b> · {fv(h.last_change.from)} → <b>{fv(h.last_change.to)}</b> <Box component="span" sx={{ fontWeight: 800, color: h.last_change.pct > 0 ? "#c62828" : "#2e7d32" }}>({h.last_change.pct > 0 ? "+" : ""}{h.last_change.pct}%)</Box></>
                                              : "no change since first record"}
                                          </Typography>
                                          {h.max_change && h.changes.length > 1 && (
                                            <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
                                              Max move: <b>{fmtDate(h.max_change.d)}</b> · <Box component="span" sx={{ fontWeight: 800, color: h.max_change.pct > 0 ? "#c62828" : "#2e7d32" }}>{h.max_change.pct > 0 ? "+" : ""}{h.max_change.pct}%</Box>
                                            </Typography>
                                          )}
                                          {h.changes.length > 0 && (
                                            <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.25, maxHeight: 120, overflowY: "auto" }}>
                                              {h.changes.slice().reverse().map((cg, i) => (
                                                <Typography key={i} sx={{ fontSize: "0.66rem", fontFamily: "monospace", color: "#5f6368" }}>
                                                  {fmtDate(cg.d)}  {fv(cg.from)} → {fv(cg.to)}  <Box component="span" sx={{ fontWeight: 700, color: cg.pct > 0 ? "#c62828" : "#2e7d32" }}>{cg.pct > 0 ? "+" : ""}{cg.pct}%</Box>
                                                </Typography>
                                              ))}
                                            </Box>
                                          )}
                                          {h.first && h.latest && (
                                            <Typography sx={{ fontSize: "0.62rem", color: "#9aa0a6", mt: 0.5 }}>
                                              tracked {fmtDate(h.first.d)} → {fmtDate(h.latest.d)} · latest {fv(h.latest.price)}
                                            </Typography>
                                          )}
                                        </Box>
                                      ))}
                                    </Box>
                                  )}
                                </CardContent>
                              </Card>
                            </Box>
                          </Box>
                    </RowDetail>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer></TopScroll>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
        </CardContent>
      </Card>

      {/* Manual price injection — stored under the 'manual' source, flows into this table + charts */}
      <Dialog open={inject.open} onClose={() => !injectBusy && setInject(v => ({ ...v, open: false }))} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>Inject price manually</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)" }}>
            {inject.row?.article_number} · {mandant} · entered in the article&apos;s sales unit ({inject.row?.sales_unit || inject.row?.unit || "?"})
          </Typography>
        </Box>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "20px !important" }}>
          <TextField size="small" label={`Price (${mandant === "M110" ? "EUR" : "CHF"} per ${inject.row?.sales_unit || inject.row?.unit || "unit"})`} value={inject.price}
            onChange={(e) => setInject(v => ({ ...v, price: e.target.value }))} autoFocus />
          <TextField size="small" label="Quantity tier" type="number" value={inject.tier}
            onChange={(e) => setInject(v => ({ ...v, tier: e.target.value }))} helperText="1 = base price; 5/10/25/50 for scale tiers" />
          <TextField size="small" label="Source (e.g. offer, phone quote, competitor site)" value={inject.label}
            onChange={(e) => setInject(v => ({ ...v, label: e.target.value }))} />
          <TextField size="small" label="Note (optional)" multiline rows={2} value={inject.note}
            onChange={(e) => setInject(v => ({ ...v, note: e.target.value }))} helperText="Stored as a 'manual' source entry — visible in this table and the charts" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInject(v => ({ ...v, open: false }))} disabled={injectBusy} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button variant="contained" disabled={injectBusy || !(parseFloat(inject.price) > 0)} startIcon={<AddIcon />}
            onClick={async () => {
              if (!inject.row) return;
              setInjectBusy(true);
              try {
                await fetch(`${API_URL}/api/card/manual-price`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    article_number: inject.row.article_number, mandant, price: parseFloat(inject.price),
                    quantity_tier: parseInt(inject.tier) || 1, source_label: inject.label || "Manual entry",
                    note: inject.note, entered_by: "pricing-hub",
                  }),
                });
                setInject({ open: false, row: null, price: "", tier: "1", label: "", note: "" });
                fetchData();
              } finally { setInjectBusy(false); }
            }}
            sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#1d3a4d" }, textTransform: "none", fontWeight: 700 }}>
            Save price
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "#fff" }}>Export Benchmark</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>{mandant} — {comps.map(c => c.name).join(", ")}</Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          {[{ s: "all" as const, icon: <DescriptionIcon sx={{ color: "#2e7d32", fontSize: 24 }} />, bg: "#e8f5e9", t: "All Matched", d: `${total} products` },
            { s: "view" as const, icon: <FilterAltIcon sx={{ color: "#274e64", fontSize: 24 }} />, bg: "#e8f0f4", t: "Current View", d: `Page ${page + 1}${hasF ? " (filtered)" : ""}` }]
            .map(o => (
              <Box key={o.s} onClick={() => handleExport(o.s)} sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", borderBottom: "1px solid #f5f5f5", "&:hover": { bgcolor: o.bg } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: o.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{o.icon}</Box>
                <Box><Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{o.t}</Typography><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{o.d}</Typography></Box>
              </Box>
            ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}><Button onClick={() => setExportOpen(false)} sx={{ color: "#5f6368" }}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
