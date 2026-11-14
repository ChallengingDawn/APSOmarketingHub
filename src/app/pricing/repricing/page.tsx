"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readTable } from "@/lib/pricing/xlsx";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TablePagination from "@mui/material/TablePagination";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import SyncIcon from "@mui/icons-material/Sync";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import TableViewIcon from "@mui/icons-material/TableView";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import PageHeader from "../PageHeader";
import TopScroll from "../TopScroll";
import { FilterBar, SearchFilter, HierFilter, TextFilter, ClearFilters } from "../Filters";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { usePref, useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";
import {
  type Article, type Factors, type Kind, type Sel,
  DEFAULT_FACTORS, FX_CURRENCIES, COMPS_CHF, COMPS_EUR, ALL_COMPS, normFactors, scaleFactor, currentFor, erpScaleNote,
  compAt, compGap, compKind, basisUnit, costInfo, newPrice, marginOf, pctTxt, fmtDate, selParams,
} from "./model";
import { exportUpload } from "./exportExcel";
import { exportPdf } from "./exportPdf";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const RED = "#ed1b2f", GOOD = "#1e8e3e", BAD = "#c5221f", NAVY = "#274e64", MUTED = "#5b6470", WARN = "#b45309";
const ORANGE_BG = "#fdf3e7", ORANGE_HD = "#fdf0df", ORANGE_TX = "#854d0e";
const BLUE_BG = "#eef5fc", BLUE_HD = "#e7f0fb", BLUE_TX = "#1d4ed8";
const GREEN_BG = "#eef7ee", GREEN_TX = "#2e7d32";
const GREY_BG = "#f6f7f9";
const PAGE_LIMIT = 5000;
type Show = { curBasic: boolean; newBasic: boolean; curM100: boolean; newM100: boolean; newM110: boolean };
type Opt = { number: string; description: string };
type FilterOpts = { profit_centers: string[]; assortments: Opt[]; main_groups: Opt[]; sub_groups: Opt[]; product_groups: Opt[] };
type LastSync = { scope: string; synced: number; errors: number; articles: number; finished_at: string } | null;
type RefreshStatus = { running: boolean; total: number; done: number; synced: number; skipped: number; errors: number; not_found: number; status: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const norm = (v: any) => (v == null ? "" : String(v).trim().toLowerCase());
const daysSince = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity);
const fmtStamp = (iso: string | null | undefined) => (iso ? `${fmtDate(iso)} ${new Date(iso).toTimeString().slice(0, 5)}` : "—");

// A column group of the price grid. kind = how its cells are computed.
type Group = { key: string; label: string; cur: string; kind: "cur" | "new" | "comp"; sys?: Kind; bg: string; hd: string; tx: string };

export default function RepricingPage() {
  const sf = useSavedFilters("repricing", { search: "", pc: "", ass: "", mg: "", sg: "", pg: "", matched: false });
  const sel: Sel = sf.f;
  const [filters, setFilters] = useState<FilterOpts | null>(null);
  const [arts, setArts] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<{ all: LastSync; selection: LastSync }>({ all: null, selection: null });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [rawFactors, setFactors, factorsReady] = usePref<Factors>("repricing:factors", DEFAULT_FACTORS);
  const factors = useMemo(() => normFactors(rawFactors), [rawFactors]);
  useEffect(() => {  // one-time carry-over of the factors this browser kept before they were saved per user
    if (!factorsReady || JSON.stringify(rawFactors) !== JSON.stringify(DEFAULT_FACTORS)) return;
    try { const old = window.localStorage.getItem("repricing-factors-v2"); if (old) { setFactors(normFactors(JSON.parse(old))); window.localStorage.removeItem("repricing-factors-v2"); } } catch { /* ignore */ }
  }, [factorsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const [factorOpen, setFactorOpen] = useState(false);
  const [show, setShow] = usePref<Show>("repricing:columns", { curBasic: true, newBasic: true, curM100: true, newM100: true, newM110: true });
  const [compShow, setCompShow] = usePref<Record<string, boolean>>("repricing:competitors", Object.fromEntries(ALL_COMPS.map(c => [c.code, true])));
  const [collapsed, setCollapsed] = usePref<Record<string, boolean>>("repricing:collapsed", {});
  const [sort, setSort] = usePref<{ col: string; dir: "asc" | "desc" }>("repricing:sort", { col: "", dir: "asc" });
  const [mandantSheets, setMandantSheets] = usePref<boolean>("repricing:export-mandant-sheets", false);
  const [detailMode, setDetailMode] = useDetailMode();
  const [corr, setCorr] = useState<Record<string, number>>({});
  const [cost, setCost] = useState<Record<string, number>>({});
  const [costNote, setCostNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCorr, setBulkCorr] = useState("");
  const [bulkGW, setBulkGW] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [openArt, setOpenArt] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Article | null>(null);
  const [delHubspot, setDelHubspot] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [refresh, setRefresh] = useState<RefreshStatus | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState("");
  const [me, setMe] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const TIERS = factors.tiers.map(t => t.qty);

  useEffect(() => { fetch(`${API_URL}/api/products/filters`).then(r => r.json()).then(setFilters).catch(() => {}); }, []);
  useEffect(() => { fetch(`/api/auth/me`).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.user) setMe(d.user.full_name || d.user.email || d.user.username || ""); }).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const p = selParams(sel); p.set("limit", String(PAGE_LIMIT));
      const j = await fetch(`${API_URL}/api/analytics/repricing-articles?${p}`).then(r => r.json());
      setArts(j.articles || []); setTotal(j.total ?? (j.articles || []).length);
      if (j.last_sync) setLastSync(j.last_sync);
      setPage(0); setSelected(new Set());
      if (!(j.articles || []).length) setErr("No articles for this filter.");
    } catch { setErr("Couldn't load articles."); } finally { setLoading(false); }
  }, [sel.search, sel.pc, sel.ass, sel.mg, sel.sg, sel.pg, sel.matched]); // eslint-disable-line react-hooks/exhaustive-deps
  // First load waits for the saved filters; the search box is debounced.
  useEffect(() => { if (!sf.ready) return; const t = setTimeout(load, sel.search ? 350 : 0); return () => clearTimeout(t); }, [sf.ready, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // The WHOLE selection (beyond the first page of 5,000) — for the exports.
  const loadAll = async (): Promise<Article[]> => {
    if (arts.length >= total) return arts;
    const all = [...arts];
    while (all.length < total) {
      setExporting(`Loading ${all.length.toLocaleString()} / ${total.toLocaleString()} articles…`);
      const p = selParams(sel); p.set("limit", String(PAGE_LIMIT)); p.set("offset", String(all.length));
      const j = await fetch(`${API_URL}/api/analytics/repricing-articles?${p}`).then(r => r.json());
      if (!(j.articles || []).length) break;
      all.push(...j.articles);
    }
    return all;
  };

  // "Update from HubSpot" — re-reads ONLY the current selection (seconds), with progress.
  const updateFromHubspot = async () => {
    setErr("");
    try {
      const body = Object.fromEntries(selParams(sel).entries());
      const r = await fetch(`${API_URL}/api/analytics/repricing-refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json());
      if (!r.total && r.message !== "already running") { setNote("Nothing to update for this filter."); return; }
      setRefresh({ running: true, total: r.total || 0, done: 0, synced: 0, skipped: 0, errors: 0, not_found: 0, status: "Reading HubSpot…" });
      let fails = 0;
      for (;;) {
        await new Promise(res => setTimeout(res, 1500));
        const s: RefreshStatus | null = await fetch(`${API_URL}/api/analytics/repricing-refresh/status`).then(x => (x.ok ? x.json() : null)).catch(() => null);
        if (!s) { if (++fails > 8) throw new Error("status unavailable"); continue; }
        fails = 0; setRefresh(s);
        if (!s.running) {
          if (s.status.startsWith("Failed")) setErr(`HubSpot update: ${s.status}`);
          else setNote(`Updated ${s.synced.toLocaleString()} articles from HubSpot${s.not_found ? ` · ${s.not_found} not found in HubSpot` : ""}${s.skipped ? ` · ${s.skipped} skipped (not Standard)` : ""}.`);
          break;
        }
      }
      await load();
    } catch (e) { setErr(`HubSpot update failed: ${(e as Error).message}`); }
    finally { setRefresh(null); }
  };

  const onCostFile = async (file: File) => {
    try {
      const wb = await readTable(file);
      const map: Record<string, number> = {};
      const isArt = (x: string) => (x.includes("article") || x.includes("artikel")) && (x.includes("number") || x.includes("no") || x.includes("nr"));
      const isCost = (x: string) => x.replace(/\s+/g, "").includes("gwstdp") || x.includes("purchase price") || x.includes("cost") || x.includes("einstand");
      for (const name of wb.sheetNames) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any[][] = await wb.rows(name);
        const hi = g.findIndex(r => Array.isArray(r) && r.some(c => isArt(norm(c))) && r.some(c => isCost(norm(c))));
        if (hi < 0) continue;
        const h = g[hi].map(norm);
        const ai = h.findIndex((x: string) => isArt(x)), gi = h.findIndex((x: string) => isCost(x));
        for (const r of g.slice(hi + 1)) { const a = r?.[ai]; const v = Number(r?.[gi]); if (a != null && isFinite(v) && v > 0) map[String(a).trim()] = v; }
        break;
      }
      if (!Object.keys(map).length) { setErr("No GWStdP / cost column found (need an 'Article number' and a 'GWStdP' or 'purchase price' column)."); return; }
      // Same basis as HubSpot (per ONE stock unit, the article's lead currency): ERP/Performis
      // sheets quote per 100 — detected against the synced cost and converted at once.
      const ratios: number[] = [];
      for (const a of arts) { const v = map[a.article_number]; if (v > 0 && a.gwstdp != null && a.gwstdp > 0) ratios.push(v / a.gwstdp); }
      let n = "";
      if (ratios.length >= 3) {
        const med = [...ratios].sort((x, y) => x - y)[Math.floor(ratios.length / 2)];
        if (med > 20) { for (const k of Object.keys(map)) map[k] = map[k] / 100; n = `read as GWStdP per 100 units (median ${med.toFixed(0)}× the synced cost), converted to per 1`; }
        else n = `read as cost per 1 stock unit (median ${med.toFixed(2)}× the synced cost)`;
      }
      setCost(map); setCostNote(n); setNote(`Cost sheet: ${Object.keys(map).length} articles${n ? `, ${n}` : ""}.`);
    } catch (e) { setErr(`Couldn't read that cost sheet. ${(e as Error)?.message ?? ""}`.trim()); }
  };

  const F = (k: "base" | "country_m100" | "country_m110" | "currency", v: string) => setFactors(f => ({ ...normFactors(f), [k]: parseFloat(v) || 0 }));
  const setFx = (c: string, v: string) => setFactors(f => { const n = normFactors(f); return { ...n, fx: { ...n.fx, [c]: parseFloat(v) || 0 } }; });
  const setTier = (i: number, key: "qty" | "factor", v: string) => setFactors(f => { const n = normFactors(f); return { ...n, tiers: n.tiers.map((t, j) => (j === i ? { ...t, [key]: parseFloat(v) || 0 } : t)) }; });
  const addTier = () => setFactors(f => { const n = normFactors(f); return { ...n, tiers: [...n.tiers, { qty: (n.tiers[n.tiers.length - 1]?.qty || 1) * 2, factor: 1 }] }; });
  const removeTier = (i: number) => setFactors(f => { const n = normFactors(f); return { ...n, tiers: n.tiers.filter((_, j) => j !== i) }; });
  const sortTiers = () => setFactors(f => { const n = normFactors(f); return { ...n, tiers: [...n.tiers].sort((a, b) => a.qty - b.qty) }; });

  const corrOf = (a: Article) => corr[a.article_number] ?? a.correction ?? 1;
  const ciOf = (a: Article) => costInfo(a, cost[a.article_number], factors);
  // Why there is no usable cost, in plain words (a stale copy is the usual cause).
  const costProblem = (a: Article): string | null => {
    const ci = ciOf(a);
    if (ci.eur != null) return null;
    if (ci.raw == null) return daysSince(a.synced_at) > 2 ? `no GWStdP · HubSpot copy from ${fmtDate(a.synced_at)} — update from HubSpot` : "no GWStdP in HubSpot";
    return ci.problem;
  };

  // ── column groups (each can be hidden, collapsed to its first quantity, and sorted) ──
  const groups: Group[] = useMemo(() => {
    const g: Group[] = [];
    if (show.curBasic) g.push({ key: "cb", label: "Current BASIC", cur: "EUR", kind: "cur", sys: "basic", bg: GREY_BG, hd: GREY_BG, tx: MUTED });
    if (show.newBasic) g.push({ key: "nb", label: "New BASIC", cur: "EUR", kind: "new", sys: "basic", bg: ORANGE_BG, hd: ORANGE_HD, tx: ORANGE_TX });
    if (show.curM100) g.push({ key: "cm", label: "Current M100", cur: "CHF", kind: "cur", sys: "m100", bg: GREY_BG, hd: GREY_BG, tx: MUTED });
    if (show.newM100) g.push({ key: "nm", label: "New M100", cur: "CHF", kind: "new", sys: "m100", bg: BLUE_BG, hd: BLUE_HD, tx: BLUE_TX });
    for (const c of COMPS_CHF) if (compShow[c.code]) g.push({ key: c.code, label: c.label, cur: "CHF", kind: "comp", bg: "#eef2f6", hd: "#e8eef4", tx: NAVY });
    if (show.newM110) g.push({ key: "n110", label: "New M110", cur: "EUR", kind: "new", sys: "m110", bg: GREEN_BG, hd: GREEN_BG, tx: GREEN_TX });
    for (const c of COMPS_EUR) if (compShow[c.code]) g.push({ key: c.code, label: c.label, cur: "EUR", kind: "comp", bg: "#eef2f6", hd: "#e8eef4", tx: NAVY });
    return g;
  }, [show, compShow]);
  const tiersOf = (g: Group) => (collapsed[g.key] ? TIERS.slice(0, 1) : TIERS);
  const valueAt = (a: Article, g: Group, t: number): number | null => {
    if (g.kind === "cur") return currentFor(a, g.sys!, t);
    if (g.kind === "new") return newPrice(ciOf(a).eur, corrOf(a), factors, t, g.sys!);
    return compAt(a.competitors?.[g.key]?.prices, t);
  };

  // ── sorting: every column, prices included; empty values always last ──
  const sortVal = (a: Article, col: string): string | number | null => {
    switch (col) {
      case "article": return a.article_number;
      case "description": return a.description || null;
      case "sales_unit": return a.sales_unit || null;
      case "stock_unit": return a.stock_unit || null;
      case "currency": return a.gwstdp_currency || null;
      case "cost": return ciOf(a).eur;
      case "corr": return corrOf(a);
      case "cost_date": return a.gwstdp_date || null;
      case "price_date": return a.price_date || null;
    }
    const [k, t] = col.split(":");
    const g = groups.find(x => x.key === k);
    return g ? valueAt(a, g, Number(t)) : null;
  };
  const sortedArts = useMemo(() => {
    if (!sort.col) return arts;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...arts].sort((x, y) => {
      const vx = sortVal(x, sort.col), vy = sortVal(y, sort.col);
      if (vx == null && vy == null) return 0; if (vx == null) return 1; if (vy == null) return -1;
      return (typeof vx === "number" && typeof vy === "number" ? vx - vy : String(vx).localeCompare(String(vy))) * dir;
    });
  }, [arts, sort, cost, corr, factors, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleSort = (col: string) => { setSort(s => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" })); setPage(0); };
  const SL = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableSortLabel active={sort.col === col} direction={sort.col === col ? sort.dir : "asc"} onClick={() => handleSort(col)}
      sx={{ "& .MuiTableSortLabel-icon": { fontSize: 14 }, "&.Mui-active .MuiTableSortLabel-icon": { color: NAVY } }}>{children}</TableSortLabel>
  );

  const shown = sortedArts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allSel = shown.length > 0 && shown.every(a => selected.has(a.article_number));
  const someSel = shown.some(a => selected.has(a.article_number));
  const toggleAll = () => setSelected(prev => { const n = new Set(prev); if (allSel) shown.forEach(a => n.delete(a.article_number)); else shown.forEach(a => n.add(a.article_number)); return n; });
  const toggleOne = (art: string) => setSelected(prev => { const n = new Set(prev); if (n.has(art)) n.delete(art); else n.add(art); return n; });
  const applyBulkCorr = () => { const v = parseFloat(bulkCorr); if (!isFinite(v)) return; setCorr(m => { const n = { ...m }; selected.forEach(art => { n[art] = v; }); return n; }); };
  const applyBulkGW = () => { const v = parseFloat(bulkGW); if (!isFinite(v)) return; setCost(m => { const n = { ...m }; selected.forEach(art => { n[art] = v; }); return n; }); };
  const doDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${delTarget.id}?hubspot=${delHubspot}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setArts(list => list.filter(x => x.id !== delTarget.id)); setTotal(t => t - 1);
      setOpenArt(null); setDelTarget(null);
    } catch { setErr("Couldn't delete the article."); }
    finally { setDeleting(false); }
  };

  // Pop-up stepping: ← / → walk the sorted list and keep the table page in step.
  const openIdx = openArt ? sortedArts.findIndex(a => a.article_number === openArt) : -1;
  const step = (d: number) => { const i = openIdx + d; if (i < 0 || i >= sortedArts.length) return; setOpenArt(sortedArts[i].article_number); setPage(Math.floor(i / rowsPerPage)); };

  const runExport = async (kind: "xlsx" | "pdf") => {
    setExportAnchor(null); setErr("");
    try {
      setExporting("Preparing export…");
      const whole = selected.size > 0 ? arts.filter(a => selected.has(a.article_number)) : await loadAll();
      const ordered = sort.col ? [...whole].sort((x, y) => { const vx = sortVal(x, sort.col), vy = sortVal(y, sort.col); if (vx == null) return 1; if (vy == null) return -1; return (typeof vx === "number" && typeof vy === "number" ? vx - vy : String(vx).localeCompare(String(vy))) * (sort.dir === "asc" ? 1 : -1); }) : whole;
      setExporting(kind === "pdf" ? "Building the PDF…" : "Building the Excel…");
      if (kind === "xlsx") {
        const r = await exportUpload({ arts: ordered, factors, cost, corr, sel, user: me, mandantSheets, costNote });
        setNote(`${r.exported.toLocaleString()} articles exported${r.excluded ? ` · ${r.excluded.toLocaleString()} held back in "Excluded — review" (no cost, placeholder cost or implausible proposal)` : ""}.`);
      } else {
        const r = await exportPdf({ arts: ordered, factors, cost, corr, sel, user: me, showM100: show.newM100, showM110: show.newM110, compShow });
        setNote(`PDF ready: ${r.rows.toLocaleString()} articles.`);
      }
    } catch (e) { setErr(`Export failed: ${(e as Error).message}`); }
    finally { setExporting(""); }
  };

  const toggle = (k: keyof Show, label: string, tx: string) => (
    <Chip label={label} size="small" onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))}
      sx={{ cursor: "pointer", fontWeight: 700, fontSize: "0.7rem", bgcolor: show[k] ? tx : "#f1f3f4", color: show[k] ? "#fff" : "#3c4043", "&:hover": { opacity: 0.9 } }} />
  );
  const lastCopy = [lastSync.all?.finished_at, lastSync.selection?.finished_at].filter(Boolean).sort().pop() || null;
  const U = (u: string, col = "#9aa1ab") => (u ? <Typography component="span" sx={{ fontSize: "0.52rem", fontWeight: 700, color: col }}> /{u}</Typography> : null);
  const priceTip = (a: Article, kind: Kind, t: number) => {
    const ci = ciOf(a), cf = corrOf(a), price = newPrice(ci.eur, cf, factors, t, kind);
    if (price == null) return costProblem(a) || "No cost";
    const country = kind === "basic" ? 1 : kind === "m100" ? factors.country_m100 : factors.country_m110;
    const cur = currentFor(a, kind, t);
    return `${kind.toUpperCase()} @ ${t}+ = cost ${ci.raw!.toFixed(4)} ${ci.currency}${ci.currency !== "EUR" ? ` × ${factors.fx[ci.currency]} (to EUR)` : ""} × corr ${cf} × base ${factors.base} × scale ${scaleFactor(factors, t)}${kind !== "basic" ? ` × country ${country}` : ""}${kind === "m100" ? ` × currency ${factors.currency}` : ""} = ${price.toFixed(2)}
margin ${pctTxt(marginOf(cf, factors, t, kind))}${cur != null ? `\ncurrent ${cur.toFixed(2)} → ${(((price - cur) / cur) * 100).toFixed(1)}%` : ""}`;
  };

  const groupCells = (a: Article) => groups.map(g => tiersOf(g).map((t, i, arr) => {
    const v = valueAt(a, g, t);
    const su = basisUnit(a);
    const last = i === arr.length - 1 ? "2px solid #ececec" : undefined;
    if (g.kind === "cur") {
      const scaleNote = i === 0 ? erpScaleNote(g.sys === "basic" ? a.basic_scales : a.m100_scales, g.sys === "basic" ? a.basic_current : a.m100_current, su) : null;
      const cell = <Box component="span">{v != null ? <>{v.toFixed(2)}{U(su)}</> : "—"}{scaleNote && <Box component="span" sx={{ color: WARN, fontWeight: 800 }}> *</Box>}</Box>;
      return <TableCell key={g.key + t} align="right" sx={{ bgcolor: g.bg, fontSize: "0.72rem", fontFamily: "monospace", color: MUTED, borderRight: last }}>{scaleNote ? <Tooltip title={scaleNote} arrow>{cell}</Tooltip> : cell}</TableCell>;
    }
    if (g.kind === "new") {
      const cur = currentFor(a, g.sys!, t);
      const diff = v != null && cur ? (v - cur) / cur : null;
      return (
        <TableCell key={g.key + t} align="right" sx={{ bgcolor: g.bg, py: 0.4, borderRight: last }}>
          <Tooltip title={<span style={{ whiteSpace: "pre-line", fontFamily: "monospace", fontSize: "0.72rem" }}>{priceTip(a, g.sys!, t)}</span>} arrow placement="top">
            <Box>{v != null ? (<>
              <Box sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1a1d21", fontFamily: "monospace", lineHeight: 1.15 }}>{v.toFixed(2)}{U(su)}</Box>
              {diff != null && <Box sx={{ fontSize: "0.58rem", fontWeight: 700, color: Math.abs(diff) > 0.9 ? BAD : diff > 0.001 ? BAD : diff < -0.001 ? GOOD : MUTED }}>{diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}%{Math.abs(diff) > 0.9 ? " ⚠" : ""}</Box>}
            </>) : <Box sx={{ fontSize: "0.82rem", color: "#c4c9ce", fontFamily: "monospace" }}>—</Box>}</Box>
          </Tooltip>
        </TableCell>
      );
    }
    const cc = a.competitors?.[g.key];
    const ours = newPrice(ciOf(a).eur, corrOf(a), factors, t, compKind(g.key));
    // A % only when their price is in OUR unit — a per-m price against our per-kg one is no comparison.
    const { d, basis } = compGap(ours, v, cc?.converted);
    return (
      <TableCell key={g.key + t} align="right" sx={{ bgcolor: g.bg, py: 0.4, borderRight: last }}>
        <Box sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: v != null ? NAVY : "#c4c9ce", lineHeight: 1.15 }}>{v != null ? <>{v.toFixed(2)}{cc?.unit && U(cc.unit, cc.converted ? "#9aa1ab" : ORANGE_TX)}</> : "—"}</Box>
        {d != null && <Box sx={{ fontSize: "0.58rem", fontWeight: 800, color: d > 0.02 ? BAD : d < -0.1 ? GOOD : ORANGE_TX }}>{d > 0 ? "+" : ""}{(d * 100).toFixed(1)}%</Box>}
        {basis && <Tooltip title="More than 4× apart — our price and theirs are not on the same basis (per piece vs per kg?)"><Box sx={{ fontSize: "0.58rem", fontWeight: 800, color: ORANGE_TX }}>basis?</Box></Tooltip>}
      </TableCell>
    );
  }));

  const openA = openIdx >= 0 ? sortedArts[openIdx] : null;
  const detail = (a: Article) => <ArticleDetail a={a} factors={factors} ci={ciOf(a)} corr={corrOf(a)} problem={costProblem(a)} onDelete={() => { setDelHubspot(true); setDelTarget(a); }} />;
  const colCount = 9 + groups.reduce((s, g) => s + tiersOf(g).length, 0);

  return (
    <Box>
      <PageHeader icon="repricing" eyebrow="Pricing Intelligence" title="Repricing Studio"
        subtitle="Cost-plus prices for every article of the selection, next to the market"
        rightSlot={<Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Tooltip title={`HubSpot copy: ${lastSync.selection ? `selection ${fmtStamp(lastSync.selection.finished_at)}` : ""}${lastSync.selection && lastSync.all ? " · " : ""}${lastSync.all ? `full ${fmtStamp(lastSync.all.finished_at)}` : ""}` || "HubSpot copy"}>
            <Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 600 }}>HubSpot {lastCopy ? fmtStamp(lastCopy) : "—"}</Typography>
          </Tooltip>
          <Button variant="outlined" disabled={!!refresh || !arts.length} startIcon={refresh ? <CircularProgress size={14} /> : <SyncIcon />} onClick={updateFromHubspot}
            sx={{ textTransform: "none", fontWeight: 700, borderColor: NAVY, color: NAVY }}>
            {refresh ? `Updating ${refresh.done.toLocaleString()} / ${refresh.total.toLocaleString()}` : total > 20000 ? "Update first 20,000 from HubSpot" : `Update ${total.toLocaleString()} from HubSpot`}</Button>
          <Button variant="contained" disableElevation disabled={!arts.length || !!exporting} startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
            onClick={e => setExportAnchor(e.currentTarget)} sx={{ bgcolor: GOOD, color: "#fff", fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#176c2f" } }}>
            {selected.size > 0 ? `Export ${selected.size} selected` : `Export ${total.toLocaleString()}`}</Button>
          <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
            <MenuItem onClick={() => runExport("xlsx")}><ListItemIcon><TableViewIcon fontSize="small" sx={{ color: GOOD }} /></ListItemIcon>
              <ListItemText primary="Excel — Performis upload" secondary="New BASIC price + scales · settings at the bottom" /></MenuItem>
            <MenuItem dense onClick={() => setMandantSheets(v => !v)}><ListItemIcon><Checkbox size="small" checked={mandantSheets} sx={{ p: 0 }} /></ListItemIcon>
              <ListItemText primary="Add M100 + M110 sheets" /></MenuItem>
            <Divider />
            <MenuItem onClick={() => runExport("pdf")}><ListItemIcon><PictureAsPdfIcon fontSize="small" sx={{ color: RED }} /></ListItemIcon>
              <ListItemText primary="PDF — APSOparts layout" secondary="Settings + the table as shown" /></MenuItem>
          </Menu>
        </Box>} />

      <FilterBar right={<>
        <Chip label={arts.length < total ? `${arts.length.toLocaleString()} of ${total.toLocaleString()} shown · export covers all` : `${total.toLocaleString()} articles`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f5e9", color: "#2e7d32" }} />
      </>}>
        <SearchFilter value={sel.search} onChange={v => sf.set("search", v)} />
        {filters && <>
          <TextFilter label="Profit Center" value={sel.pc} options={filters.profit_centers || []} onChange={v => sf.setMany({ pc: v, ass: "", mg: "", sg: "", pg: "" })} />
          <HierFilter label="Assortment" value={sel.ass} options={filters.assortments || []} onChange={n => sf.setMany({ ass: n, mg: "", sg: "", pg: "" })} />
          <HierFilter label="Main Group" value={sel.mg} options={filters.main_groups || []} onChange={n => sf.setMany({ mg: n, sg: "", pg: "" })} />
          <HierFilter label="Sub Group" value={sel.sg} options={filters.sub_groups || []} onChange={n => sf.setMany({ sg: n, pg: "" })} />
          <HierFilter label="Product Group" value={sel.pg} options={filters.product_groups || []} onChange={n => sf.set("pg", n)} />
        </>}
        <FormControlLabel control={<Switch size="small" checked={sel.matched} onChange={e => sf.set("matched", e.target.checked)} />}
          label={<Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: NAVY }}>Matched only</Typography>} />
        <ClearFilters show={sf.active} onClick={() => sf.reset()} />
        {loading && <CircularProgress size={18} sx={{ color: RED }} />}
      </FilterBar>

      {refresh && <LinearProgress variant={refresh.total ? "determinate" : "indeterminate"} value={refresh.total ? (refresh.done / refresh.total) * 100 : 0} sx={{ mb: 1.5, height: 4, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: NAVY } }} />}
      {exporting && <Typography sx={{ fontSize: "0.78rem", color: NAVY, fontWeight: 700, mb: 1 }}>{exporting}</Typography>}

      {/* factor summary */}
      <Card sx={{ border: "1px solid #e6e8ec", borderRadius: 2.5, mb: 2 }}>
        <CardContent sx={{ p: 1.5, display: "flex", flexWrap: "wrap", gap: 1.2, alignItems: "center", "&:last-child": { pb: 1.5 } }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1a1d21" }}>Factors</Typography>
          {[["Base", factors.base], ["Country M100", factors.country_m100], ["Country M110", factors.country_m110], ["Currency", factors.currency]].map(([k, v]) => (
            <Chip key={k} label={`${k} ${v}`} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "#f1f3f4", color: "#3c4043" }} />
          ))}
          {FX_CURRENCIES.filter(c => factors.fx[c]).map(c => <Chip key={c} label={`1 ${c} = ${factors.fx[c]} EUR`} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "#fff7ed", color: WARN }} />)}
          <Chip label={`Quantities: ${TIERS.join(" · ")}`} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "#eef2f6", color: NAVY }} />
          <Button size="small" variant="contained" disableElevation startIcon={<TuneIcon sx={{ fontSize: 16 }} />} onClick={() => setFactorOpen(true)}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", bgcolor: NAVY, "&:hover": { bgcolor: "#1d3a4d" } }}>Configure</Button>
          <Button size="small" variant="outlined" startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />} onClick={() => inputRef.current?.click()}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderColor: "#d8dce1", color: NAVY }}>Upload GWStdP sheet</Button>
          <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={e => { const fl = e.target.files?.[0]; if (fl) onCostFile(fl); e.target.value = ""; }} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Margin @1: BASIC <b style={{ color: GOOD }}>{pctTxt(marginOf(1, factors, TIERS[0] ?? 1, "basic"))}</b> · M100 <b style={{ color: GOOD }}>{pctTxt(marginOf(1, factors, TIERS[0] ?? 1, "m100"))}</b> · M110 <b style={{ color: GOOD }}>{pctTxt(marginOf(1, factors, TIERS[0] ?? 1, "m110"))}</b></Typography>
        </CardContent>
      </Card>

      <FactorDialog open={factorOpen} onClose={() => { sortTiers(); setFactorOpen(false); }} factors={factors}
        F={F} setFx={setFx} setTier={setTier} addTier={addTier} removeTier={removeTier} sortTiers={sortTiers} reset={() => setFactors(DEFAULT_FACTORS)} />

      {/* Delete article (optionally in HubSpot too) */}
      <Dialog open={!!delTarget} onClose={() => !deleting && setDelTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ bgcolor: RED, px: 3, py: 2 }}><Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>Delete article</Typography></Box>
        <DialogContent sx={{ pt: "20px !important" }}>
          <Typography sx={{ fontSize: "0.86rem", color: "#1f1f1f" }}>Delete <b style={{ fontFamily: "monospace" }}>{delTarget?.article_number}</b>?</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 2 }}>{delTarget?.description}</Typography>
          <FormControlLabel control={<Checkbox checked={delHubspot} onChange={e => setDelHubspot(e.target.checked)} sx={{ color: RED, "&.Mui-checked": { color: RED } }} />}
            label={<Typography sx={{ fontSize: "0.8rem" }}>Also delete it in <b>HubSpot</b> — permanent, removes the source record</Typography>} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDelTarget(null)} disabled={deleting} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disableElevation color="error" onClick={doDelete} disabled={deleting} startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{ textTransform: "none", fontWeight: 700 }}>{delHubspot ? "Delete here + HubSpot" : "Delete here only"}</Button>
        </DialogActions>
      </Dialog>

      {/* column visibility + view */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, mr: 0.5 }}>Columns:</Typography>
        {toggle("curBasic", "Current BASIC", "#8a8f97")}
        {toggle("newBasic", "New BASIC", ORANGE_TX)}
        {toggle("curM100", "Current M100", "#8a8f97")}
        {toggle("newM100", "New M100", BLUE_TX)}
        {toggle("newM110", "New M110", GREEN_TX)}
        <Box sx={{ width: "1px", height: 18, bgcolor: "#d8dce1", mx: 0.5 }} />
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: MUTED }}>Competitors:</Typography>
        {ALL_COMPS.map(cc => (
          <Chip key={cc.code} label={cc.label} size="small" onClick={() => setCompShow(s => ({ ...s, [cc.code]: !s[cc.code] }))}
            sx={{ cursor: "pointer", fontWeight: 700, fontSize: "0.7rem", bgcolor: compShow[cc.code] ? NAVY : "#f1f3f4", color: compShow[cc.code] ? "#fff" : "#3c4043", "&:hover": { opacity: 0.9 } }} />
        ))}
        <Box sx={{ width: "1px", height: 18, bgcolor: "#d8dce1", mx: 0.5 }} />
        <Button size="small" startIcon={<UnfoldLessIcon sx={{ fontSize: 16 }} />} onClick={() => setCollapsed(Object.fromEntries(groups.map(g => [g.key, true])))} sx={{ textTransform: "none", fontSize: "0.7rem", fontWeight: 700, color: NAVY }}>Collapse all</Button>
        <Button size="small" startIcon={<UnfoldMoreIcon sx={{ fontSize: 16 }} />} onClick={() => setCollapsed({})} sx={{ textTransform: "none", fontSize: "0.7rem", fontWeight: 700, color: NAVY }}>Expand all</Button>
        <Box sx={{ flex: 1 }} />
        <DetailModeToggle mode={detailMode} onChange={setDetailMode} />
      </Box>

      {err && <Typography sx={{ fontSize: "0.82rem", color: BAD, mb: 1, fontWeight: 600 }}>{err}</Typography>}
      {note && <Typography sx={{ fontSize: "0.8rem", color: NAVY, mb: 1.5, fontWeight: 600 }}>{note}</Typography>}

      {arts.length > 0 && (
        <Card sx={{ border: "1px solid #ececec", borderRadius: 4, overflow: "hidden" }}>
          {selected.size > 0 && (
            <Box sx={{ px: 2, py: 1, bgcolor: "#eef5ff", borderBottom: "1px solid #d8e6f5", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: NAVY, whiteSpace: "nowrap" }}>{selected.size} selected</Typography>
              <Button size="small" onClick={() => setSelected(new Set())} sx={{ fontSize: "0.72rem", color: MUTED, textTransform: "none" }}>Clear</Button>
              <Box sx={{ width: "1px", height: 22, bgcolor: "#cdd9e6" }} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>Set for all selected →</Typography>
              <BulkInput label="Correction" value={bulkCorr} onChange={setBulkCorr} onApply={applyBulkCorr} color={RED} />
              <BulkInput label="GWStdP" value={bulkGW} onChange={setBulkGW} onApply={applyBulkGW} color={NAVY} />
            </Box>
          )}
          <TopScroll><TableContainer sx={{ overflow: "visible" }}>
            <Table size="small" sx={{ minWidth: 1500 }}>
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" } }}>
                  <TableCell rowSpan={2} padding="checkbox" sx={{ bgcolor: "#f8f9fa", width: 40 }}><Checkbox size="small" checked={allSel} indeterminate={someSel && !allSel} onChange={toggleAll} sx={{ p: 0.5 }} /></TableCell>
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa", width: 36, p: 0.5 }} />
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa" }}><SL col="article">Article</SL></TableCell>
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa" }}><SL col="description">Description</SL></TableCell>
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa" }}><SL col="sales_unit">Sales unit</SL></TableCell>
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa" }}><Tooltip title="Prices and cost are per this unit"><span><SL col="stock_unit">Stock unit</SL></span></Tooltip></TableCell>
                  <TableCell rowSpan={2} sx={{ bgcolor: "#f8f9fa" }}><Tooltip title="Currency of the GWStdP (its lead currency)"><span><SL col="currency">Cost cur.</SL></span></Tooltip></TableCell>
                  <TableCell rowSpan={2} align="right" sx={{ bgcolor: "#f8f9fa" }}><SL col="cost">GWStdP</SL></TableCell>
                  <TableCell rowSpan={2} align="right" sx={{ bgcolor: "#f8f9fa", borderRight: "2px solid #e8ebee" }}><SL col="corr">Correction</SL></TableCell>
                  {groups.map(g => (
                    <TableCell key={g.key} colSpan={tiersOf(g).length} align="center" sx={{ bgcolor: g.hd, color: g.tx, borderRight: "2px solid #ececec", py: 0.3 }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3 }}>
                        {g.label} · {g.cur}
                        <Tooltip title={collapsed[g.key] ? "Show every quantity" : `Only ${TIERS[0] ?? 1}+`}>
                          <IconButton size="small" onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))} sx={{ p: 0.2, color: g.tx }}>
                            {collapsed[g.key] ? <UnfoldMoreIcon sx={{ fontSize: 15, transform: "rotate(90deg)" }} /> : <UnfoldLessIcon sx={{ fontSize: 15, transform: "rotate(90deg)" }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.62rem", color: MUTED, textTransform: "uppercase", whiteSpace: "nowrap" } }}>
                  {groups.map(g => tiersOf(g).map((t, i, arr) => (
                    <TableCell key={g.key + t} align="right" sx={{ bgcolor: g.bg, color: g.tx, borderRight: i === arr.length - 1 ? "2px solid #ececec" : undefined }}>
                      <SL col={`${g.key}:${t}`}>{t}+</SL>
                    </TableCell>
                  )))}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map(a => {
                  const ci = ciOf(a), problem = costProblem(a);
                  const isOpen = openArt === a.article_number;
                  return (
                    <React.Fragment key={a.article_number}>
                      <TableRow hover selected={selected.has(a.article_number)} sx={{ "&.Mui-selected": { bgcolor: "#eef5ff" }, "& td": { borderBottom: isOpen && detailMode === "inline" ? "none" : undefined } }}>
                        <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(a.article_number)} onChange={() => toggleOne(a.article_number)} sx={{ p: 0.5 }} /></TableCell>
                        <TableCell sx={{ p: 0.5, width: 36 }}>
                          <Tooltip title="Details"><IconButton size="small" onClick={() => setOpenArt(isOpen ? null : a.article_number)} sx={{ color: isOpen ? NAVY : "#9aa1ab" }}>
                            {detailMode === "popup" ? <OpenInNewIcon sx={{ fontSize: 16 }} /> : isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton></Tooltip>
                        </TableCell>
                        <TableCell><Typography onClick={() => setOpenArt(a.article_number)} sx={{ fontSize: "0.74rem", fontFamily: "monospace", fontWeight: 700, color: "#1a1d21", cursor: "pointer", "&:hover": { color: NAVY, textDecoration: "underline" } }}>{a.article_number}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#3c4043", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{a.sales_unit || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.7rem", color: "#1a1d21", fontWeight: 700 }}>{a.stock_unit || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: ci.currency === "EUR" ? MUTED : WARN }}>{a.gwstdp != null || cost[a.article_number] != null ? ci.currency : "—"}</Typography></TableCell>
                        <TableCell align="right" sx={{ py: 0.3 }}>
                          <input type="number" step="0.01" min="0" placeholder="—" value={cost[a.article_number] ?? a.gwstdp ?? ""}
                            onChange={e => { const v = e.target.value; setCost(m => { const n = { ...m }; if (v === "") delete n[a.article_number]; else n[a.article_number] = parseFloat(v) || 0; return n; }); }}
                            style={{ width: 86, textAlign: "right", fontFamily: "monospace", fontSize: "0.72rem", fontWeight: 700, color: ci.eur != null ? "#1a1d21" : "#9aa1ab", border: `1px solid ${problem ? "#f3c98b" : "#d8dce1"}`, borderRadius: 4, padding: "2px 4px", background: "#fff" }} />
                          {problem
                            ? <Tooltip title={problem}><Box sx={{ fontSize: "0.56rem", color: WARN, fontWeight: 700, maxWidth: 90, ml: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{problem}</Box></Tooltip>
                            : <Box sx={{ fontSize: "0.56rem", color: "#9aa1ab" }}>{a.gwstdp_date ? `since ${fmtDate(a.gwstdp_date)}` : ""}</Box>}
                        </TableCell>
                        <TableCell align="right" sx={{ borderRight: "2px solid #e8ebee" }}>
                          <input type="number" step="0.01" value={corrOf(a)} onChange={e => setCorr(m => ({ ...m, [a.article_number]: parseFloat(e.target.value) || 0 }))}
                            style={{ width: 54, textAlign: "right", fontFamily: "monospace", fontSize: "0.72rem", fontWeight: 700, color: RED, border: "1px solid #f0c9ce", borderRadius: 4, padding: "2px 4px" }} />
                        </TableCell>
                        {groupCells(a)}
                      </TableRow>
                      {detailMode === "inline" && (
                        <RowDetail mode="inline" open={isOpen} onClose={() => setOpenArt(null)} colSpan={colCount}>{isOpen ? detail(a) : null}</RowDetail>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer></TopScroll>
          <TablePagination component="div" count={sortedArts.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100, 250]} sx={{ borderTop: "1px solid #ececec" }} />
          <Box sx={{ px: 2, py: 1, borderTop: "1px solid #f0f1f3" }}>
            <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>Per stock unit · new = GWStdP in EUR × correction × factors · <Box component="span" sx={{ color: WARN, fontWeight: 800 }}>*</Box> ERP scale below the listed price</Typography>
          </Box>
        </Card>
      )}

      {detailMode === "popup" && openA && (
        <RowDetail mode="popup" open onClose={() => setOpenArt(null)} colSpan={colCount} maxWidth="lg"
          title={`${openA.article_number} · ${openA.description || ""}`}
          subtitle={`${openIdx + 1} / ${sortedArts.length} · ${openA.stock_unit || openA.sales_unit || "—"} · ${openA.profit_center || ""} ${openA.product_description || ""}`}
          onPrev={openIdx > 0 ? () => step(-1) : undefined} onNext={openIdx < sortedArts.length - 1 ? () => step(1) : undefined}>
          {detail(openA)}
        </RowDetail>
      )}
    </Box>
  );
}

// ── the article detail (pop-up or in-row): facts, the proposal per quantity, the market ──
function ArticleDetail({ a, factors, ci, corr, problem, onDelete }: { a: Article; factors: Factors; ci: ReturnType<typeof costInfo>; corr: number; problem: string | null; onDelete: () => void }) {
  const su = basisUnit(a);
  const tiers = factors.tiers.map(t => t.qty);
  const facts: [string, React.ReactNode][] = [
    ["Status", a.article_status || "—"], ["Mandant", a.mandant || "—"],
    ["Units", `sold per ${a.sales_unit || "—"} · priced per ${su || "—"}`], ["Stock", a.stock != null ? String(a.stock) : "—"],
    ["GWStdP", ci.raw != null ? `${ci.raw.toFixed(4)} ${ci.currency}${ci.currency !== "EUR" && ci.eur != null ? ` = ${ci.eur.toFixed(4)} EUR` : ""}` : "—"],
    ["GWStdP changed", fmtDate(a.gwstdp_date)], ["Listed price changed", fmtDate(a.price_date)],
    ["Supplier-list cost date", fmtDate(a.list_cost_date)], ["Copied from HubSpot", fmtDate(a.synced_at)],
    ["Competitor match", a.matched ? "yes" : "no"],
  ];
  const sysCols: { kind: Kind; label: string; cur: string; tx: string }[] = [
    { kind: "basic", label: "BASIC", cur: "EUR", tx: ORANGE_TX }, { kind: "m100", label: "M100", cur: "CHF", tx: BLUE_TX }, { kind: "m110", label: "M110", cur: "EUR", tx: GREEN_TX },
  ];
  const comps = ALL_COMPS.filter(c => a.competitors?.[c.code]);
  const th = { fontSize: "0.62rem", fontWeight: 800, color: MUTED, textTransform: "uppercase" as const, py: 0.5, whiteSpace: "nowrap" as const };
  const td = { fontSize: "0.76rem", fontFamily: "monospace", py: 0.45 };
  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      {problem && <Box sx={{ px: 1.5, py: 0.8, bgcolor: "#fff7ed", border: "1px solid #f3c98b", borderRadius: 1.5, fontSize: "0.8rem", color: WARN, fontWeight: 700 }}>{problem}</Box>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 1.5 }}>
        {facts.map(([k, v]) => (
          <Box key={k}><Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#1f1f1f", fontWeight: 600 }}>{v}</Typography></Box>
        ))}
      </Box>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead><TableRow sx={{ bgcolor: "#eef2f6" }}>
            <TableCell sx={th}>Quantity</TableCell><TableCell sx={th} align="right">Scale</TableCell>
            {sysCols.map(s => <React.Fragment key={s.kind}>
              <TableCell sx={{ ...th, color: s.tx }} align="right">{s.label} now</TableCell>
              <TableCell sx={{ ...th, color: s.tx }} align="right">{s.label} new · {s.cur}/{su}</TableCell>
              <TableCell sx={{ ...th, color: s.tx }} align="right">Margin</TableCell>
            </React.Fragment>)}
          </TableRow></TableHead>
          <TableBody>
            {tiers.map(t => (
              <TableRow key={t}>
                <TableCell sx={{ ...td, fontWeight: 800 }}>{t}+</TableCell>
                <TableCell sx={td} align="right">{scaleFactor(factors, t)}</TableCell>
                {sysCols.map(s => {
                  const cur = currentFor(a, s.kind, t), nw = newPrice(ci.eur, corr, factors, t, s.kind);
                  const d = cur && nw != null ? (nw - cur) / cur : null;
                  return <React.Fragment key={s.kind}>
                    <TableCell sx={{ ...td, color: MUTED }} align="right">{cur != null ? cur.toFixed(2) : "—"}</TableCell>
                    <TableCell sx={{ ...td, fontWeight: 800 }} align="right">{nw != null ? nw.toFixed(2) : "—"}{d != null && <Box component="span" sx={{ ml: 0.75, fontSize: "0.66rem", color: d > 0.001 ? BAD : d < -0.001 ? GOOD : MUTED }}>{d > 0 ? "+" : ""}{(d * 100).toFixed(1)}%</Box>}</TableCell>
                    <TableCell sx={{ ...td, color: GOOD }} align="right">{pctTxt(marginOf(corr, factors, t, s.kind))}</TableCell>
                  </React.Fragment>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {erpScaleNote(a.basic_scales, a.basic_current, su) && <Typography sx={{ fontSize: "0.74rem", color: WARN, fontWeight: 700 }}>BASIC: {erpScaleNote(a.basic_scales, a.basic_current, su)}</Typography>}
      {comps.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: "#e8eef4" }}>
              <TableCell sx={th}>Competitor</TableCell>
              {tiers.map(t => <TableCell key={t} sx={th} align="right">{t}+</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {comps.map(c => {
                const cc = a.competitors![c.code];
                return (
                  <TableRow key={c.code}>
                    <TableCell sx={{ ...td, fontFamily: "inherit", fontWeight: 700, color: NAVY }}>{c.label} <Box component="span" sx={{ fontSize: "0.66rem", color: cc.converted ? "#9aa1ab" : ORANGE_TX }}>{compKind(c.code) === "m100" ? "CHF" : "EUR"}/{cc.unit || "—"}{cc.converted ? "" : " (own unit)"}</Box></TableCell>
                    {tiers.map(t => {
                      const v = compAt(cc.prices, t), ours = newPrice(ci.eur, corr, factors, t, compKind(c.code));
                      const { d, basis } = compGap(ours, v, cc.converted);
                      return <TableCell key={t} sx={td} align="right">{v != null ? v.toFixed(2) : "—"}{d != null && <Box component="span" sx={{ ml: 0.75, fontSize: "0.66rem", fontWeight: 800, color: d > 0.02 ? BAD : d < -0.1 ? GOOD : ORANGE_TX }}>{d > 0 ? "+" : ""}{(d * 100).toFixed(0)}%</Box>}{basis && <Box component="span" sx={{ ml: 0.75, fontSize: "0.66rem", fontWeight: 800, color: ORANGE_TX }}>basis?</Box>}</TableCell>;
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon fontSize="small" />} onClick={onDelete} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem" }}>Delete article</Button>
      </Box>
    </Box>
  );
}

function BulkInput({ label, value, onChange, onApply, color }: { label: string; value: string; onChange: (v: string) => void; onApply: () => void; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{label}</Typography>
      <input type="number" step="0.01" value={value} placeholder="—" onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onApply(); }}
        style={{ width: 66, textAlign: "right", fontFamily: "monospace", fontSize: "0.72rem", fontWeight: 700, color, border: "1px solid #d8dce1", borderRadius: 4, padding: "3px 5px" }} />
      <Button size="small" variant="contained" disableElevation onClick={onApply} disabled={value === ""}
        sx={{ minWidth: 0, px: 1.2, py: 0.3, fontSize: "0.68rem", fontWeight: 700, textTransform: "none", bgcolor: color, "&:hover": { bgcolor: color, opacity: 0.9 } }}>Apply</Button>
    </Box>
  );
}

// ── factors & quantities: settings on the left, quantities on the right, a live example below ──
function FactorDialog({ open, onClose, factors, F, setFx, setTier, addTier, removeTier, sortTiers, reset }: {
  open: boolean; onClose: () => void; factors: Factors;
  F: (k: "base" | "country_m100" | "country_m110" | "currency", v: string) => void; setFx: (c: string, v: string) => void;
  setTier: (i: number, k: "qty" | "factor", v: string) => void; addTier: () => void; removeTier: (i: number) => void; sortTiers: () => void; reset: () => void;
}) {
  const [example, setExample] = useState("10");
  const ex = parseFloat(example) || 0;
  const inp = (w: number, color = "#1a1d21", border = "#d8dce1") => ({ width: w, textAlign: "right" as const, fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 7px" });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <Box sx={{ bgcolor: NAVY, px: 3, py: 1.75 }}>
        <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>Factors &amp; quantities</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)" }}>BASIC = GWStdP (EUR) × correction × base × scale · M100 = BASIC × country × currency · M110 = BASIC × country</Typography>
      </Box>
      <DialogContent sx={{ pt: "18px !important", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.2fr" }, gap: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em" }}>Factors</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <FNum label="Base (qty 1)" value={factors.base} onChange={v => F("base", v)} tint={ORANGE_BG} />
            <FNum label="Currency (M100 CHF)" value={factors.currency} onChange={v => F("currency", v)} tint={BLUE_BG} />
            <FNum label="Country M100" value={factors.country_m100} onChange={v => F("country_m100", v)} tint={BLUE_BG} />
            <FNum label="Country M110" value={factors.country_m110} onChange={v => F("country_m110", v)} tint={GREEN_BG} />
          </Box>
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em", mt: 1 }}>GWStdP to EUR</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            {FX_CURRENCIES.map(c => (
              <Box key={c} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED, minWidth: 52, whiteSpace: "nowrap" }}>1 {c} =</Typography>
                <input type="number" step="0.0001" min="0" value={factors.fx[c] || ""} placeholder="—" title={factors.fx[c] ? undefined : "No rate set: costs in this currency are held back"} onChange={e => setFx(c, e.target.value)} style={inp(80, WARN, "#f3c98b")} />
                <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>EUR</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Quantities</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 1fr 1fr 32px", gap: 0.75, alignItems: "center", mb: 0.5 }}>
            {["Qty", "Scale", "Margin BASIC", "M100", "M110", ""].map(h => <Typography key={h} sx={{ fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>{h}</Typography>)}
          </Box>
          {factors.tiers.map((t, i) => (
            <Box key={i} sx={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 1fr 1fr 32px", gap: 0.75, alignItems: "center", mb: 0.6 }}>
              <input type="number" min="1" value={t.qty} onChange={e => setTier(i, "qty", e.target.value)} onBlur={sortTiers} style={inp(76)} />
              <input type="number" step="0.01" value={t.factor} onChange={e => setTier(i, "factor", e.target.value)} style={inp(86, ORANGE_TX, "#f0d6b6")} />
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: GOOD }}>{pctTxt(marginOf(1, factors, t.qty, "basic"))}</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: GOOD }}>{pctTxt(marginOf(1, factors, t.qty, "m100"))}</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: GOOD }}>{pctTxt(marginOf(1, factors, t.qty, "m110"))}</Typography>
              <IconButton size="small" onClick={() => removeTier(i)} disabled={factors.tiers.length <= 1} sx={{ color: "#c4c9ce", "&:hover": { color: RED } }}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={addTier} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", color: NAVY }}>Add quantity</Button>
          <Box sx={{ mt: 2, p: 1.25, bgcolor: "#f8f9fb", border: "1px solid #eceef1", borderRadius: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: NAVY }}>Example: GWStdP</Typography>
              <input type="number" step="0.01" value={example} onChange={e => setExample(e.target.value)} style={inp(70)} />
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>EUR</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: `60px repeat(3, 1fr)`, rowGap: 0.3, fontFamily: "monospace", fontSize: "0.74rem" }}>
              <span /><b style={{ color: ORANGE_TX }}>BASIC €</b><b style={{ color: BLUE_TX }}>M100 CHF</b><b style={{ color: GREEN_TX }}>M110 €</b>
              {factors.tiers.map(t => (
                <React.Fragment key={t.qty}><b>{t.qty}+</b>
                  <span>{newPrice(ex, 1, factors, t.qty, "basic")!.toFixed(2)}</span><span>{newPrice(ex, 1, factors, t.qty, "m100")!.toFixed(2)}</span><span>{newPrice(ex, 1, factors, t.qty, "m110")!.toFixed(2)}</span>
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={reset} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", color: MUTED, "&:hover": { color: RED } }}>Reset to default</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" disableElevation onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, bgcolor: NAVY, "&:hover": { bgcolor: "#1d3a4d" } }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

function FNum({ label, value, onChange, tint }: { label: string; value: number; onChange: (v: string) => void; tint: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.3 }}>{label}</Typography>
      <TextField size="small" type="number" value={value} onChange={e => onChange(e.target.value)} sx={{ width: "100%", "& input": { fontWeight: 700, fontSize: "0.86rem", textAlign: "center", py: 0.7, bgcolor: tint, borderRadius: 1 } }} inputProps={{ step: 0.01 }} />
    </Box>
  );
}
