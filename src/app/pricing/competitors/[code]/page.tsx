"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import DialogTitle from "@mui/material/DialogTitle";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import SearchIcon from "@mui/icons-material/Search";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PageHeader from "../../PageHeader";
import { downloadXlsx, readXlsx, sheetName, type Cell, type Sheet } from "@/lib/pricing/xlsx";
import { firewallMessage, refusedByFirewall } from "../../upload";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface CompetitorProduct {
  id: number;
  external_ref: string;
  product_name: string;
  material: string | null;
  material_normalized: string | null;
  product_type: string | null;
  product_type_normalized: string | null;
  color: string | null;
  color_normalized: string | null;
  diameter: number | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  hardness: string | null;
  certifications: string | null;
  unit: string | null;
  in_stock: boolean | null;
  lead_time_days: number | null;
  stock_raw: string | null;
  scraped_at: string;
  prices: { tier: number | null; price: string | null }[] | null;
  matched_apso_articles: { article_number: string; confidence: number; source: string; xref?: string | null }[] | null;
}

// all non-null scraped dimensions, labelled (rod=Ø+L, plate=L×W×T, etc.)
function dimsLabel(p: CompetitorProduct): string {
  const parts: string[] = [];
  const d = p.outer_diameter_mm ?? p.diameter;
  if (d) parts.push(`Ø${(+d).toFixed(2)}`);
  if (p.inner_diameter_mm) parts.push(`id${(+p.inner_diameter_mm).toFixed(2)}`);
  if (p.length) parts.push(`L${(+p.length).toFixed(2)}`);
  if (p.width) parts.push(`W${(+p.width).toFixed(2)}`);
  if (p.thickness) parts.push(`T${(+p.thickness).toFixed(2)}`);
  return parts.join(" · ") || "—";
}

function stockLabel(p: CompetitorProduct): string {
  if (p.in_stock === true) return p.lead_time_days ? `✓ ${p.lead_time_days}d` : "✓ in stock";
  if (p.in_stock === false) return p.lead_time_days ? `⌛ ${p.lead_time_days}d` : "on request";
  // never leave it blank — say so explicitly when the source carries no stock data
  return "No stock info";
}

interface CompetitorInfo {
  id: number;
  code: string;
  name: string;
  market: string;
  currency: string;
  website_url: string;
  product_count: string;
  last_scraped: string | null;
}

// Discover all unique price tiers across loaded products
function getPriceTiers(products: CompetitorProduct[]): number[] {
  const tiers = new Set<number>();
  // (null-tier / null-price rows are no-price products — exclude so we don't render "Qty null+" / "CHF NaN")
  for (const p of products) {
    if (p.prices) for (const pr of p.prices) if (pr.tier != null && pr.price != null) tiers.add(pr.tier);
  }
  return [...tiers].sort((a, b) => a - b);
}

export default function CompetitorDataPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [competitor, setCompetitor] = useState<CompetitorInfo | null>(null);
  const [products, setProducts] = useState<CompetitorProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [importSheet, setImportSheet] = useState("");
  const [importAll, setImportAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Export
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Scraper (run from this table view; table fills live as it goes)
  const [hasAdapter, setHasAdapter] = useState(false);
  const [scrapeMenuEl, setScrapeMenuEl] = useState<HTMLElement | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState("");
  // scrape snapshots (switch the table between scrape dates: 19.04 vs new run)
  const [snapshots, setSnapshots] = useState<{ date: string; products: number }[]>([]);
  const [snapshot, setSnapshot] = useState<string>("");   // "" = all dates; else YYYY-MM-DD
  const [cleanMenuEl, setCleanMenuEl] = useState<HTMLElement | null>(null);

  const fetchCompetitor = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/competitors`);
      const data = await res.json();
      setCompetitor((data as CompetitorInfo[]).find(c => c.code === code) || null);
    } catch { /* */ }
  }, [code]);

  const fetchProducts = useCallback(async () => {
    if (!competitor) return;
    try {
      const p = new URLSearchParams({ page: String(page + 1), per_page: "25" });
      if (search) p.set("search", search);
      if (snapshot) p.set("on", snapshot);
      if (sortCol) { p.set("sort", sortCol); p.set("dir", sortDir); }   // server-side sort over the FULL dataset
      const res = await fetch(`${API_URL}/api/competitors/${competitor.id}/products?${p}`);
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.total || 0);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, [competitor, page, search, snapshot, sortCol, sortDir]);

  const fetchSnapshots = useCallback(async () => {
    try {
      const s = await (await fetch(`${API_URL}/api/scrapers/${code}/snapshots`)).json();
      setSnapshots(Array.isArray(s) ? s : []);
      // default to "All dates" so products always show — don't hide them behind a single-date filter
      // (a scrape still switches to its own date via startScrape for the live fill)
    } catch { setSnapshots([]); }
  }, [code]);

  // Import the bundled 2025 price list (server reads the file shipped in the repo)
  const importBundled = useCallback(async () => {
    if (!window.confirm("Replace ALL data for this competitor with the bundled 2025 price list (dated 02.10.2025)? Existing rows are wiped first.")) return;
    setResult("Importing 2025 price list…");
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/import-bundled`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "import failed");
      setResult(`Imported ${j.products_imported} products, ${j.prices_imported} prices (dated 2025-10-02)`);
      setSnapshot("");
      setPage(0);
      fetchSnapshots();
      fetchCompetitor();
    } catch (e) { setResult(`Import failed: ${e instanceof Error ? e.message : "unknown"}`); }
  }, [code, fetchSnapshots, fetchCompetitor]);

  // Relabel a snapshot's date (e.g. an old 2025 price list that was imported as 2026-04-19)
  const relabelSnapshot = useCallback(async (date: string) => {
    setCleanMenuEl(null);
    if (!date) return;
    const to = window.prompt(
      `New date (YYYY-MM-DD) for the ${new Date(date).toLocaleDateString("en-GB")} scrape.\nUse a 2025 date for old price-list imports:`,
      "2025-10-02"
    );
    if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/relabel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: date, to }),
      });
      const j = await r.json().catch(() => ({}));
      setResult(`Relabelled ${j.products ?? 0} products → ${to}${(j.products ?? 0) === 0 ? " (0 matched — try “Set date for ALL products”)" : ""}`);
      setSnapshot("");
      setPage(0);
      fetchSnapshots();
      fetchCompetitor();
    } catch { /* */ }
  }, [code, fetchSnapshots, fetchCompetitor]);

  // Set ONE date for ALL current products (robust for a fresh import — no from-date matching)
  const relabelAll = useCallback(async () => {
    setCleanMenuEl(null);
    const to = window.prompt("Set ONE date (YYYY-MM-DD) for ALL current products of this competitor\n(use this to date a freshly-imported run):", "2025-01-01");
    if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/relabel-all`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }),
      });
      const j = await r.json().catch(() => ({}));
      setResult(`Set ${j.products ?? 0} products to ${to}`);
      setSnapshot("");
      setPage(0);
      fetchSnapshots();
      fetchCompetitor();
    } catch { /* */ }
  }, [code, fetchSnapshots, fetchCompetitor]);

  // Clear scraped product rows — all, or only error/"429" rows (cascades to prices + history)
  const deleteProducts = useCallback(async (bad: boolean) => {
    setCleanMenuEl(null);
    const msg = bad ? "Remove all error / “429” rows" : "DELETE ALL scraped products";
    if (!window.confirm(`${msg} for this competitor? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/products${bad ? "?bad=1" : ""}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setResult(`Removed ${j.deleted_products ?? 0} product rows`);
      setSnapshot("");
      setPage(0);
      fetchSnapshots();
      fetchCompetitor();
    } catch { /* */ }
  }, [code, fetchSnapshots, fetchCompetitor]);

  // Delete a bad/incomplete scrape run (removes its prices + trend points everywhere)
  const deleteSnapshot = useCallback(async (date: string) => {
    if (!date) return;
    if (!window.confirm(`Delete the entire ${new Date(date).toLocaleDateString("en-GB")} scrape (all its products + prices)? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/snapshot/${date}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setResult(`Deleted ${j.deleted_products ?? 0} products from the ${new Date(date).toLocaleDateString("en-GB")} scrape`);
      const s = await (await fetch(`${API_URL}/api/scrapers/${code}/snapshots`)).json();
      setSnapshots(Array.isArray(s) ? s : []);
      setSnapshot(Array.isArray(s) && s[0]?.date ? s[0].date : "");
      setPage(0);
      fetchCompetitor();
    } catch { /* */ }
  }, [code, fetchCompetitor]);

  // SAFE single-run delete: removes only this date's price points (trend + current prices),
  // keeps the product catalogue and every other dated history point.
  const deleteRun = useCallback(async (date: string) => {
    if (!date) return;
    if (!window.confirm(`Remove ONLY the ${new Date(date).toLocaleDateString("en-GB")} run's prices/trend point?\nThe product catalogue and all other dates stay intact.`)) return;
    setCleanMenuEl(null);
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/run/${date}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setResult(`Removed ${j.deleted_history ?? 0} trend points + ${j.deleted_prices ?? 0} prices from ${new Date(date).toLocaleDateString("en-GB")} (catalogue kept)`);
      const s = await (await fetch(`${API_URL}/api/scrapers/${code}/snapshots`)).json();
      setSnapshots(Array.isArray(s) ? s : []);
      fetchCompetitor();
    } catch { /* */ }
  }, [code, fetchCompetitor]);

  useEffect(() => { fetchCompetitor(); }, [fetchCompetitor]);
  useEffect(() => { if (competitor) fetchProducts(); }, [competitor, fetchProducts]);
  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  // Is this competitor wired for live scraping?
  useEffect(() => {
    fetch(`${API_URL}/api/scrapers/adapters`).then(r => r.json())
      .then(a => setHasAdapter(!!a[code])).catch(() => setHasAdapter(false));
  }, [code]);

  // While scraping, poll status + refresh the table so rows fill in live
  useEffect(() => {
    if (!scraping || !competitor) return;
    const cid = competitor.id;
    const today = new Date().toISOString().slice(0, 10);
    const iv = setInterval(async () => {
      try {
        // refresh the table DIRECTLY for today's run (don't depend on snapshot/search state)
        const pd = await (await fetch(`${API_URL}/api/competitors/${cid}/products?on=${today}&page=1&per_page=25`)).json();
        setProducts(pd.data || []); setTotal(pd.total || 0); setLoading(false);
        const rows = await (await fetch(`${API_URL}/api/scrapers/status`)).json();
        const row = rows.find((x: { code: string }) => x.code === code);
        if (!row) return;
        if (row.last_status === "running") {
          setScrapeMsg(`Scraping… ${row.last_products_found ?? 0} products so far`);
        } else if (row.last_status === "completed") {
          setScrapeMsg(`✓ Done — ${row.last_products_found ?? 0} products`);
          setScraping(false); fetchCompetitor(); fetchSnapshots();
        } else if (row.last_status === "failed") {
          setScrapeMsg(`Failed: ${row.last_error || "unknown error"}`);
          setScraping(false);
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [scraping, competitor, code, fetchCompetitor, fetchSnapshots]);

  async function startScrape(limit?: number) {
    setScrapeMenuEl(null);
    setScraping(true); setScrapeMsg("Starting…");
    // clear the table and switch it to today's run → old rows disappear, new ones fill in live
    setProducts([]); setTotal(0); setPage(0);
    setSnapshot(new Date().toISOString().slice(0, 10));
    try {
      const q = limit ? `?limit=${limit}` : "";
      const r = await fetch(`${API_URL}/api/scrapers/trigger/${code}${q}`, { method: "POST" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      setScrapeMsg("Running…");
    } catch (err) { setScraping(false); setScrapeMsg(`Failed to start: ${err instanceof Error ? err.message : "error"}`); }
  }

  async function stopScrape() {
    setScrapeMsg("Stopping… (finishing the current fetch, ≤30s)");
    try {
      const r = await fetch(`${API_URL}/api/scrapers/${code}/stop`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setScraping(false);
      setScrapeMsg(d.stopped ? "Scrape stopped." : "No running scrape to stop.");
    } catch { setScraping(false); setScrapeMsg("Stop request failed."); }
  }

  async function doSchedule() {
    if (!schedAt) return;
    setSchedOpen(false);
    try {
      const r = await fetch(`${API_URL}/api/scrapers/schedule/${code}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_at: new Date(schedAt).toISOString(), limit: 0 }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      setScrapeMsg(`Scheduled for ${new Date(schedAt).toLocaleString()}`);
    } catch (err) { setScrapeMsg(`Schedule failed: ${err instanceof Error ? err.message : "error"}`); }
  }

  const priceTiers = getPriceTiers(products);

  // Sorting is server-side over the FULL dataset (see fetchProducts). Toggle dir on same column,
  // and jump back to page 1 so you see the new top of the sorted list.
  function handleSort(col: string) {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  }

  // ─── EXPORT ─────────────────────────────────────────────────────
  async function handleExport(scope: "all" | "view") {
    if (!competitor) return;
    setExporting(true);
    setExportOpen(false);
    setResult(null);
    try {
      // Fetch data
      const p = new URLSearchParams({ per_page: scope === "all" ? "99999" : "25" });
      if (scope === "view") { p.set("page", String(page + 1)); if (search) p.set("search", search); }
      const res = await fetch(`${API_URL}/api/competitors/${competitor.id}/products?${p}`);
      const data = await res.json();
      const rows = data.data as CompetitorProduct[] || [];
      if (!rows.length) { setResult("No data to export"); setExporting(false); return; }

      // Discover price tiers
      const tiers = getPriceTiers(rows);

      // Build Excel with SheetJS (memory-safe for large competitor catalogs).
      const now = new Date();
      const label = scope === "all" ? "All Products" : `Current View${search ? ` — "${search}"` : ""}`;

      const hdrs: { header: string; w: number }[] = [
        { header: "Reference / Item Number", w: 24 },
        { header: "Product Name", w: 40 },
        { header: "Material", w: 18 },
        { header: "Type", w: 14 },
        { header: "Color", w: 12 },
        { header: "Diameter (mm)", w: 14 },
        { header: "Unit", w: 8 },
        { header: "Stock", w: 18 },
        { header: "Match APSO Number", w: 20 },
        ...tiers.map((t) => ({ header: `Qty ${t}+`, w: 14 })),
        { header: "Updated", w: 14 },
      ];
      const colFmt: (string | null)[] = hdrs.map((_, i) =>
        i === 5 || (i >= 9 && i < 9 + tiers.length) ? "#,##0.00" : null
      );

      // written by the hub's writer (src/lib/pricing/xlsx.ts): a title, a line on what it holds, the header, the rows
      const aoa: Cell[][] = [];
      rows.forEach((prod) => {
        const prices = prod.prices || [];
        aoa.push([
          prod.external_ref || "",
          prod.product_name || "",
          (prod.material_normalized || prod.material || "").toUpperCase(),
          prod.product_type || "",
          prod.color_normalized || prod.color || "",
          prod.diameter ? parseFloat(String(prod.diameter)) : "",
          prod.unit || "",
          prod.in_stock === true ? (prod.lead_time_days ? `In stock (${prod.lead_time_days}d)` : "In stock")
            : prod.in_stock === false ? (prod.lead_time_days ? `${prod.lead_time_days}d lead time` : "On request")
            : "No stock info",
          "", // Match APSO Number — placeholder
          ...tiers.map((t) => {
            const pr = prices.find((p) => p.tier === t);
            return pr && pr.price != null ? parseFloat(pr.price) : "";
          }),
          prod.scraped_at ? new Date(prod.scraped_at).toLocaleDateString("en-GB") : "",
        ]);
      });

      const sheet: Sheet = {
        name: sheetName(competitor.name),
        preamble: [
          `${competitor.name} — Competitor Products`,
          `${label}  |  ${rows.length.toLocaleString()} products  |  ${competitor.market} / ${competitor.currency}  |  Exported ${now.toLocaleDateString("en-GB")}`,
        ],
        columns: hdrs.map((h, i) => ({ header: h.header, width: h.w, format: colFmt[i] ? ("money" as const) : undefined })),
        rows: aoa,
      };
      const ts = now.toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `APSOPricingHub_${competitor.name.replace(/[^a-zA-Z0-9]/g, "_")}_${scope === "all" ? "All" : "View"}_${ts}.xlsx`;
      await downloadXlsx(filename, [sheet]);
      setResult(`Exported ${rows.length.toLocaleString()} products to ${filename}`);
    } catch (err) {
      setResult(`Export failed: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setExporting(false);
    }
  }

  // ─── IMPORT ─────────────────────────────────────────────────────
  async function handleFileChange(file: File | null) {
    setImportFile(file);
    setImportSheets([]);
    setImportSheet("");
    if (!file) return;
    try {
      const wb = await readXlsx(await file.arrayBuffer());
      setImportSheets(wb.sheetNames);
      setImportSheet(wb.sheetNames[0] || "");
    } catch { /* not an .xlsx: the import reads it, or says why not */ }
  }

  async function handleImport() {
    if (!importFile || !competitor) return;
    if (!importAll && !importSheet) return;
    setImporting(true);
    setResult(null);
    try {
      const buffer = await importFile.arrayBuffer();
      const p = new URLSearchParams();
      if (!importAll && importSheet) p.set("sheet", importSheet);
      const res = await fetch(`${API_URL}/api/competitors/${competitor.code}/import?${p}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buffer,
      });
      if (refusedByFirewall(res)) throw new Error(firewallMessage(`/competitors/${competitor.code}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed`);
      setResult(`Imported ${data.products_imported} products, ${data.prices_imported} prices`);
      setImportOpen(false);
      fetchProducts();
      fetchCompetitor();
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setImporting(false);
    }
  }

  const mc = competitor?.market === "CH" ? { bg: "#e8f0f4", color: "#274e64" }
    : competitor?.market === "DE" ? { bg: "#fef7e0", color: "#854d0e" }
    : { bg: "#f3e8ff", color: "#6d28d9" };

  return (
    <Box>
      <PageHeader
        icon="competitors"
        eyebrow="Competitor"
        title={competitor?.name || code}
        subtitle={competitor ? `${competitor.market} — ${competitor.currency} — ${competitor.website_url}` : "Loading..."}
        rightSlot={
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => router.push("/pricing/competitors")}
              sx={{ borderColor: "#5f6368", color: "#5f6368", "&:hover": { bgcolor: "#f8f9fa" } }}>
              Back
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}
              sx={{ borderColor: "#274e64", color: "#274e64", "&:hover": { bgcolor: "#e8f0f4" } }}>
              Import Excel
            </Button>
            <Button variant="outlined" startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
              disabled={exporting || total === 0} onClick={() => setExportOpen(true)}
              sx={{ borderColor: "#34a853", color: "#34a853", "&:hover": { bgcolor: "#e8f5e9" } }}>
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button variant="contained" disabled={!hasAdapter || scraping}
              startIcon={scraping ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <TravelExploreIcon />}
              endIcon={!scraping ? <ArrowDropDownIcon /> : undefined}
              onClick={(e) => setScrapeMenuEl(e.currentTarget)}
              sx={{ bgcolor: "#ed1b2f", color: "#fff", boxShadow: "none", fontWeight: 700, "&:hover": { bgcolor: "#c41527", boxShadow: "none" } }}>
              {scraping ? "Scraping…" : hasAdapter ? "Scrape" : "No scraper"}
            </Button>
            <Menu anchorEl={scrapeMenuEl} open={!!scrapeMenuEl} onClose={() => setScrapeMenuEl(null)}>
              <MenuItem onClick={() => startScrape(0)}><TravelExploreIcon fontSize="small" sx={{ mr: 1, color: "#ed1b2f" }} />Run now (full catalogue)</MenuItem>
              <MenuItem onClick={() => startScrape(100)}><TravelExploreIcon fontSize="small" sx={{ mr: 1, color: "#5f6368" }} />Test run (first 100)</MenuItem>
              <MenuItem onClick={() => { setScrapeMenuEl(null); setSchedAt(""); setSchedOpen(true); }}><ScheduleIcon fontSize="small" sx={{ mr: 1, color: "#274e64" }} />Schedule for later…</MenuItem>
            </Menu>
            <Button variant="outlined" onClick={stopScrape}
              sx={{ borderColor: "#c0392b", color: "#c0392b", "&:hover": { borderColor: "#ed1b2f", bgcolor: "#fff5f5" } }}>
              Stop
            </Button>
          </Box>
        }
      />

      {code === "reiff" && (
        <Alert severity="warning" icon={false}
          sx={{ mb: 2, borderRadius: 3, border: "2px solid #e65100", bgcolor: "#fff4e5",
            "& .MuiAlert-message": { width: "100%" } }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: "#b53d00", mb: 0.5 }}>
            ⚠️ Reiff has been acquired by Magg Technik
          </Typography>
          <Typography sx={{ fontSize: "0.88rem", color: "#7a3300" }}>
            Reiff’s webshop is no longer available to us, so we can <b>no longer scrape it legally</b>.
            This competitor is kept for <b>historical price data only</b> — do not run new scrapes.
          </Typography>
        </Alert>
      )}

      {(scraping || scrapeMsg) && (
        <Card sx={{ mb: 2, border: "1px solid #274e64", borderRadius: 3, overflow: "hidden" }}>
          {scraping && <LinearProgress sx={{ height: 4, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}
          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", gap: 1.5 }}>
            {scraping && <CircularProgress size={18} sx={{ color: "#274e64" }} />}
            <Typography sx={{ fontSize: "0.8rem", color: scrapeMsg.startsWith("Failed") ? "#b02a37" : "#1f1f1f", fontWeight: 600 }}>
              {scrapeMsg}{scraping ? " — table updates live below" : ""}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Dialog open={schedOpen} onClose={() => setSchedOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Schedule scrape — {competitor?.name}</DialogTitle>
        <DialogContent>
          <TextField type="datetime-local" fullWidth value={schedAt} onChange={e => setSchedAt(e.target.value)}
            sx={{ mt: 1 }} slotProps={{ inputLabel: { shrink: true } }} label="Run at" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchedOpen(false)} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button variant="contained" disabled={!schedAt} onClick={doSchedule} sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#1a3a4c" } }}>Schedule</Button>
        </DialogActions>
      </Dialog>

      {result && (
        <Alert severity={result.startsWith("Error") || result.startsWith("Export failed") ? "error" : "success"} onClose={() => setResult(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {result}
        </Alert>
      )}

      {/* Stats */}
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        {[
          { value: total.toLocaleString(), label: "Products", accent: mc.color },
          { value: competitor?.market || "", label: "Market", accent: "#5f6368" },
          { value: competitor?.currency || "", label: "Currency", accent: "#5f6368" },
          { value: competitor?.last_scraped ? new Date(competitor.last_scraped).toLocaleDateString("en-GB") : "Never", label: "Last Update", accent: "#5f6368" },
        ].map((s, i) => (
          <Card key={i} sx={{ flex: 1, border: "1px solid #ececec", borderRadius: 3, borderTop: i === 0 ? `3px solid ${s.accent}` : undefined }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, textAlign: "center" }}>
              <Typography sx={{ fontSize: i === 0 ? "1.8rem" : "1rem", fontWeight: 700, color: s.accent }}>{s.value}</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "#5f6368", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Products Table */}
      <Card sx={{ border: "1px solid #ececec", borderRadius: 4 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #ececec" }}>
            <TextField size="small" placeholder="Search products, materials..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "#5f6368" }} /></InputAdornment> } }}
              sx={{ flex: 1, maxWidth: 360 }} />
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Scraping</InputLabel>
              <Select label="Scraping" value={snapshot} onChange={(e) => { setSnapshot(e.target.value); setPage(0); }}>
                <MenuItem value="">All dates</MenuItem>
                {snapshots.map(s => (
                  <MenuItem key={s.date} value={s.date}>{new Date(s.date).toLocaleDateString("en-GB")} ({s.products})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" startIcon={<DeleteOutlineIcon />} endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setCleanMenuEl(e.currentTarget)}
              sx={{ borderColor: "#f0b6b6", color: "#c0392b", "&:hover": { borderColor: "#ed1b2f", bgcolor: "#fff5f5" } }}>
              Clean
            </Button>
            <Menu anchorEl={cleanMenuEl} open={!!cleanMenuEl} onClose={() => setCleanMenuEl(null)}>
              {snapshot && (
                <MenuItem onClick={() => relabelSnapshot(snapshot)}>
                  Relabel the {new Date(snapshot).toLocaleDateString("en-GB")} scrape’s date… (e.g. → 2025)
                </MenuItem>
              )}
              {snapshot && (
                <MenuItem onClick={() => deleteRun(snapshot)}>
                  Delete only the {new Date(snapshot).toLocaleDateString("en-GB")} run’s prices (keep catalogue + other dates)
                </MenuItem>
              )}
              {snapshot && (
                <MenuItem onClick={() => { setCleanMenuEl(null); deleteSnapshot(snapshot); }} sx={{ color: "#c0392b" }}>
                  Delete the {new Date(snapshot).toLocaleDateString("en-GB")} scrape (all products + prices)
                </MenuItem>
              )}
              <MenuItem onClick={relabelAll}>Set date for ALL products…</MenuItem>
              <MenuItem onClick={() => deleteProducts(true)}>Remove error / “429” rows</MenuItem>
              <MenuItem onClick={() => deleteProducts(false)} sx={{ color: "#c0392b", fontWeight: 600 }}>Delete ALL products</MenuItem>
            </Menu>
            {code === "kundert" && (
              <Button size="small" variant="outlined" onClick={importBundled}
                sx={{ borderColor: "#274e64", color: "#274e64", "&:hover": { bgcolor: "#e8f0f4" } }}>
                Restore 2025 prices
              </Button>
            )}
            <Chip label={`${total.toLocaleString()} products`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 900 + priceTiers.length * 100 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                  {[
                    { id: "external_ref", label: "Ref / Item No." },
                    { id: "product_name", label: "Product Name" },
                    { id: "material_normalized", label: "Material" },
                    { id: "product_type", label: "Type" },
                    { id: "color_normalized", label: "Color" },
                    { id: "dimensions", label: "Dimensions (mm)" },
                    { id: "unit", label: "Unit" },
                    { id: "stock", label: "Stock", align: "right" as const },
                    { id: "match_apso", label: "Match APSO No.", match: true },
                    ...priceTiers.map(t => ({ id: `price_${t}`, label: `Qty ${t}+`, align: "right" as const, price: true })),
                    { id: "scraped_at", label: "Updated" },
                  ].map(col => (
                    <TableCell key={col.id} align={(col as {align?: "right"}).align}
                      sx={{ fontWeight: 700, fontSize: "0.68rem", color: (col as {price?: boolean}).price ? "#2e7d32" : "#5f6368",
                        bgcolor: (col as {price?: boolean}).price ? "#e8f5e9" : undefined,
                        textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      <TableSortLabel active={sortCol === col.id} direction={sortCol === col.id ? sortDir : "asc"} onClick={() => handleSort(col.id)}>
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {products.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={10 + priceTiers.length} align="center" sx={{ py: 6, color: "#5f6368" }}>
                    {total === 0 ? "No products yet. Click \"Import Excel\" to add data." : "No matching products."}
                  </TableCell></TableRow>
                )}
                {products.map((p) => {
                  const prices = p.prices || [];
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 600, fontFamily: "monospace", color: "#274e64" }}>{p.external_ref}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_name}</Typography></TableCell>
                      <TableCell>
                        <Chip label={(p.material_normalized || p.material || "—").toUpperCase()} size="small" sx={{ fontSize: "0.6rem", height: 20 }} />
                        {p.hardness && <Typography sx={{ fontSize: "0.6rem", color: "#5f6368", mt: 0.25 }}>{p.hardness}</Typography>}
                        {p.certifications && <Typography sx={{ fontSize: "0.58rem", color: "#1565c0", fontWeight: 600, mt: 0.25 }} title={p.certifications}>{p.certifications}</Typography>}
                      </TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.product_type || "—"}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.color_normalized || p.color || "—"}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#3c4043" }}>{dimsLabel(p)}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.unit || "—"}</Typography></TableCell>
                      <TableCell align="right"><Typography sx={{ fontSize: "0.72rem", color: p.in_stock === true ? "#2e7d32" : p.in_stock === false ? "#e65100" : "#5f6368" }} title={p.stock_raw || ""}>{stockLabel(p)}</Typography></TableCell>
                      <TableCell>
                        {p.matched_apso_articles && p.matched_apso_articles.length > 0 ? (
                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                            {p.matched_apso_articles.slice(0, 3).map((m, i) => (
                              <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                <Chip label={`${m.article_number}${m.source === "xref" ? " ★" : ""}`}
                                  size="small"
                                  sx={{ fontSize: "0.6rem", height: 18, fontFamily: "monospace", bgcolor: m.source === "xref" ? "#e8f0f4" : "#e8f5e9", color: m.source === "xref" ? "#274e64" : "#2e7d32", fontWeight: 600 }} />
                                {m.xref && <Typography sx={{ fontSize: "0.5rem", fontFamily: "monospace", fontWeight: 700, color: "#274e64", mt: 0.2 }}>{m.xref}</Typography>}
                              </Box>
                            ))}
                            {p.matched_apso_articles.length > 3 && (
                              <Chip label={`+${p.matched_apso_articles.length - 3}`} size="small" sx={{ fontSize: "0.6rem", height: 18 }} />
                            )}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#dadce0" }}>—</Typography>
                        )}
                      </TableCell>
                      {priceTiers.map(t => {
                        const pr = prices.find(x => x.tier === t);
                        const val = pr && pr.price != null ? parseFloat(pr.price) : NaN;
                        const has = !isNaN(val);
                        return (
                          <TableCell key={t} align="right" sx={{ bgcolor: "#f0fdf4" }}>
                            <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 600, color: has ? "#2e7d32" : "#dadce0" }}>
                              {has ? `${competitor?.currency} ${val.toFixed(2)}` : "—"}
                            </Typography>
                          </TableCell>
                        );
                      })}
                      <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5f6368" }}>{p.scraped_at ? new Date(p.scraped_at).toLocaleDateString("en-GB") : "—"}</Typography></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "#fff" }}>Export to Excel</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", mt: 0.3 }}>{competitor?.name} — choose scope</Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <Box onClick={() => handleExport("all")} sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", borderBottom: "1px solid #f5f5f5", "&:hover": { bgcolor: "#f0fdf4" }, transition: "background 0.15s" }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DescriptionIcon sx={{ color: "#2e7d32", fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#1f1f1f" }}>All Products</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{total.toLocaleString()} products with all price tiers</Typography>
            </Box>
          </Box>
          <Box onClick={() => handleExport("view")} sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", "&:hover": { bgcolor: "#e8f0f4" }, transition: "background 0.15s" }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#e8f0f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FilterAltIcon sx={{ color: "#274e64", fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#1f1f1f" }}>Current View</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>
                Current page{search ? ` — filtered: "${search}"` : ""}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setExportOpen(false)} sx={{ color: "#5f6368" }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>Import {competitor?.name} Data</Typography>
        </Box>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "20px !important", px: 3 }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ borderStyle: "dashed", py: 2, borderRadius: 2 }}>
            {importFile ? importFile.name : "Choose Excel file (.xlsx)"}
            <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
          </Button>
          {importSheets.length > 0 && (
            <>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip label="All Sheets" onClick={() => setImportAll(true)} sx={{ cursor: "pointer", fontWeight: importAll ? 700 : 500, bgcolor: importAll ? "#274e64" : "#f1f3f4", color: importAll ? "#fff" : "#3c4043" }} />
                <Chip label="Single Sheet" onClick={() => setImportAll(false)} sx={{ cursor: "pointer", fontWeight: !importAll ? 700 : 500, bgcolor: !importAll ? "#274e64" : "#f1f3f4", color: !importAll ? "#fff" : "#3c4043" }} />
              </Box>
              {!importAll && (
                <FormControl fullWidth size="small">
                  <InputLabel>Sheet</InputLabel>
                  <Select value={importSheet} label="Sheet" onChange={(e) => setImportSheet(e.target.value)}>
                    {importSheets.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {importAll && <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.75rem" }}>All {importSheets.length} sheets will be auto-parsed.</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setImportOpen(false)} disabled={importing} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={!importFile || (!importAll && !importSheet) || importing}
            startIcon={importing ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <UploadFileIcon />}
            sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#1a3a4c" }, borderRadius: 2 }}>
            {importing ? "Importing..." : importAll ? `Import All (${importSheets.length} sheets)` : "Import"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
