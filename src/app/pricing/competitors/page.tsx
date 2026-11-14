"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StorageIcon from "@mui/icons-material/Storage";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import PageHeader from "../PageHeader";
import { ClearFilters } from "../Filters";
import { useSavedFilters } from "@/lib/pricing/prefs";
import { readXlsx } from "@/lib/pricing/xlsx";
import { firewallMessage, refusedByFirewall } from "../upload";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface CompetitorData {
  id: number;
  code: string;
  name: string;
  market: string;
  currency: string;
  website_url: string;
  product_count: string;
  last_scraped: string | null;
  business_unit: string | null;
}

const MARKET_COLORS: Record<string, { bg: string; color: string }> = {
  CH: { bg: "#e8f0f4", color: "#274e64" },
  DE: { bg: "#fef7e0", color: "#854d0e" },
  EU: { bg: "#f3e8ff", color: "#6d28d9" },
};

const BU_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  KT: { bg: "#e8f0f4", color: "#274e64", border: "#274e64" },
  DT: { bg: "#fef2f2", color: "#dc2626", border: "#c8463a" },
};

// ── Auto-scraping (monthly, first weekend) ──────────────────────────────────────────────
type AutoCodeResult = { status: string; products_found: number; attempts: number; run_id: number | null };
type AutoStatus = {
  settings: { enabled: boolean; hour: number; timezone: string; resume_days: number; run_matching_after: boolean; max_attempts: number };
  next_run: string | null;
  first_weekend_now: string | null;
  running: { id: number; trigger: string; started_at: string; phase: string; cancelling: boolean; results: Record<string, AutoCodeResult> } | null;
  last_sequence: { id: number; trigger: string; status: string; started_at: string; finished_at: string | null; note: string | null;
    results: { phase?: string; codes?: Record<string, AutoCodeResult> } | null } | null;
  lanes: Record<string, string[]>;
};

function AutoScrapeCard() {
  const [st, setSt] = useState<AutoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/api/scrapers/auto`); if (r.ok) setSt(await r.json()); } catch { /* keep the last state */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const call = async (path: string, method: "PUT" | "POST", body?: Record<string, unknown>) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API_URL}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "request failed"); }
    finally { setBusy(false); }
  };
  if (!st) return null;
  const results = st.running?.results || st.last_sequence?.results?.codes || {};
  const tone = (x: string) => x.startsWith("completed") ? "#2e7d32" : x.startsWith("running") ? "#e65100" : x.startsWith("failed") ? "#c62828" : "#5d6b85";
  const when = (iso: string) => new Date(iso).toLocaleString();
  return (
    <Card sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 4 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <ScheduleIcon sx={{ color: "#c8463a" }} />
          <Box sx={{ maxWidth: 720 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Auto-scraping — first weekend of each month</Typography>
            <Typography sx={{ fontSize: 12.5, color: "#5d6b85" }}>
              Refreshes every competitor that has an adapter on the first Saturday at {String(st.settings.hour).padStart(2, "0")}:00 ({st.settings.timezone});
              Sunday only re-runs what did not finish. Two lanes (static shops / browser-driven shops), each one scrape at a time; runs are resumable,
              so a crash costs a pause, not a restart. Matching is re-run for the scraped competitors afterwards. Thyssen and Reiff are excluded (no adapter).
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={<Switch checked={st.settings.enabled} disabled={busy} onChange={(e) => call("/api/pricing/api/scrapers/auto", "PUT", { enabled: e.target.checked })} />}
            label={<Typography sx={{ fontWeight: 700 }}>{st.settings.enabled ? "On" : "Off"}</Typography>} />
          {st.running ? (
            <Button size="small" variant="outlined" color="error" disabled={busy || st.running.cancelling} onClick={() => call("/api/pricing/api/scrapers/auto/stop", "POST")}>
              {st.running.cancelling ? "Stopping…" : "Stop sequence"}
            </Button>
          ) : (
            <Button size="small" variant="outlined" disabled={busy} onClick={() => call("/api/pricing/api/scrapers/auto/run-now", "POST")} sx={{ borderColor: "#274e64", color: "#274e64" }}>
              Run sequence now
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 3, mt: 1.5, flexWrap: "wrap", fontSize: 12.5, color: "#4a5a70" }}>
          <span>Next run: <b>{st.settings.enabled && st.next_run ? st.next_run : "—"}</b></span>
          {st.running && <span>Running #{st.running.id} ({st.running.trigger}) since {when(st.running.started_at)} — {st.running.phase}</span>}
          {!st.running && st.last_sequence && (
            <span>
              Last: #{st.last_sequence.id} <b>{st.last_sequence.status}</b> · {when(st.last_sequence.started_at)}
              {st.last_sequence.finished_at ? ` → ${when(st.last_sequence.finished_at)}` : ""}
              {st.last_sequence.results?.phase ? ` · ${st.last_sequence.results.phase}` : ""}
              {st.last_sequence.note ? ` · ${st.last_sequence.note}` : ""}
            </span>
          )}
        </Box>
        {Object.keys(results).length > 0 && (
          <Box sx={{ display: "flex", gap: 0.75, mt: 1.25, flexWrap: "wrap" }}>
            {Object.entries(results).map(([code, r]) => (
              <Chip key={code} size="small" label={`${code}: ${r.status}${r.products_found ? ` · ${r.products_found.toLocaleString()}` : ""}${r.attempts > 1 ? ` (try ${r.attempts})` : ""}`}
                sx={{ bgcolor: "#eef2f8", color: tone(r.status), fontWeight: 600 }} />
            ))}
          </Box>
        )}
        {err && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErr("")}>{err}</Alert>}
      </CardContent>
    </Card>
  );
}

export default function CompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  // Saved per user; stay until "Clear all".
  const sf = useSavedFilters("competitors", { market: "", bu: "" });
  const [filterMarket, setFilterMarket] = sf.bind("market");
  const [filterBU, setFilterBU] = sf.bind("bu");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importCompetitor, setImportCompetitor] = useState<CompetitorData | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [importSheet, setImportSheet] = useState("");
  const [importAll, setImportAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ message: string; isError: boolean } | null>(null);

  // Scraper dialog
  const [scraperOpen, setScraperOpen] = useState(false);
  const [scraperCompetitor, setScraperCompetitor] = useState<CompetitorData | null>(null);
  const [adapters, setAdapters] = useState<Record<string, { mode: string; name: string }>>({});
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeInfo, setScrapeInfo] = useState("");
  const [schedAt, setSchedAt] = useState("");

  const fetchCompetitors = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/competitors`);
      const data = await res.json();
      setCompetitors(data);
    } catch { setCompetitors([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompetitors(); }, [fetchCompetitors]);
  useEffect(() => {
    fetch(`${API_URL}/api/scrapers/adapters`).then(r => r.json()).then(setAdapters).catch(() => setAdapters({}));
  }, []);

  function openScraper(c: CompetitorData) {
    setScraperCompetitor(c); setScrapeInfo(""); setSchedAt(""); setScrapeBusy(false); setScraperOpen(true);
  }

  async function pollStatus(code: string) {
    for (let i = 0; i < 600; i++) {              // up to ~30 min
      await new Promise(r => setTimeout(r, 3000));
      try {
        const rows = await (await fetch(`${API_URL}/api/scrapers/status`)).json();
        const row = rows.find((x: { code: string }) => x.code === code);
        if (!row) continue;
        if (row.last_status === "completed") { setScrapeInfo(`✓ Done — ${row.last_products_found ?? 0} products scraped.`); setScrapeBusy(false); fetchCompetitors(); return; }
        if (row.last_status === "failed") { setScrapeInfo(`Failed: ${row.last_error || "unknown error"}`); setScrapeBusy(false); return; }
        setScrapeInfo(`Running… ${row.last_products_found ?? 0} products so far.`);
      } catch { /* keep polling */ }
    }
    setScrapeBusy(false);
  }

  async function runNow(code: string) {
    setScrapeBusy(true); setScrapeInfo("Starting…");
    try {
      const r = await fetch(`${API_URL}/api/scrapers/trigger/${code}`, { method: "POST" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      setScrapeInfo("Running…"); pollStatus(code);
    } catch (err) { setScrapeBusy(false); setScrapeInfo(`Failed to start: ${err instanceof Error ? err.message : "error"}`); }
  }

  async function scheduleScrape(code: string) {
    if (!schedAt) return;
    try {
      const r = await fetch(`${API_URL}/api/scrapers/schedule/${code}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_at: new Date(schedAt).toISOString(), limit: 0 }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      setScrapeInfo(`Scheduled for ${new Date(schedAt).toLocaleString()}.`);
    } catch (err) { setScrapeInfo(`Schedule failed: ${err instanceof Error ? err.message : "error"}`); }
  }

  const markets = [...new Set(competitors.map(c => c.market))].sort();
  const bus = [...new Set(competitors.map(c => c.business_unit || "KT"))].sort();
  const filtered = competitors.filter(c => {
    if (filterMarket && c.market !== filterMarket) return false;
    if (filterBU && (c.business_unit || "KT") !== filterBU) return false;
    return true;
  });
  const totalProducts = competitors.reduce((sum, c) => sum + parseInt(c.product_count || "0"), 0);

  function openImport(comp: CompetitorData) {
    setImportCompetitor(comp);
    setImportFile(null);
    setImportSheets([]);
    setImportSheet("");
    setImportAll(false);
    setImportOpen(true);
  }

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
    if (!importFile || !importCompetitor) return;
    if (!importAll && !importSheet) return;
    setImporting(true);
    setResult(null);
    try {
      const buffer = await importFile.arrayBuffer();
      const params = new URLSearchParams();
      if (!importAll && importSheet) params.set("sheet", importSheet);
      const res = await fetch(
        `${API_URL}/api/competitors/${importCompetitor.code}/import?${params}`,
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buffer }
      );
      if (refusedByFirewall(res)) throw new Error(firewallMessage("/competitors"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      const sheetsInfo = data.sheets_processed?.length ? ` (${data.sheets_processed.length} sheets)` : "";
      setResult({
        message: `${importCompetitor.name}: ${data.products_imported} products, ${data.prices_imported} prices imported${sheetsInfo}`,
        isError: false,
      });
      setImportOpen(false);
      fetchCompetitors();
    } catch (err) {
      setResult({ message: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`, isError: true });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Box>
      <PageHeader
        icon="competitors"
        eyebrow="Data Sources"
        title="Competitors"
        subtitle={`${competitors.length} competitors tracked — ${totalProducts.toLocaleString()} products total`}
      />

      {result && (
        <Alert severity={result.isError ? "error" : "success"} onClose={() => setResult(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {result.message}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <AutoScrapeCard />

      {/* Filter Bar */}
      <Card sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 4 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#5d6b85", minWidth: 70 }}>Market:</Typography>
            {[{ label: "All", value: "" }, ...markets.map(m => ({ label: m, value: m }))].map(opt => {
              const active = filterMarket === opt.value;
              return (
                <Chip key={opt.value} label={opt.label} onClick={() => setFilterMarket(opt.value)}
                  sx={{
                    cursor: "pointer",
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? "#c8463a" : "#eef2f8",
                    color: active ? "#fff" : "#4a5a70",
                    "&:hover": { bgcolor: active ? "#a8372c" : "#e8eaed" },
                  }} />
              );
            })}
            <Box sx={{ flex: 1 }} />
            <ClearFilters show={sf.active} onClick={() => sf.reset()} />
            <Chip label={`${filtered.length} shown`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#5d6b85", minWidth: 70 }}>Business:</Typography>
            {[{ label: "All", value: "" }, ...bus.map(b => ({ label: b === "KT" ? "KT — Plastics" : "DT — Sealings", value: b }))].map(opt => {
              const active = filterBU === opt.value;
              return (
                <Chip key={opt.value} label={opt.label} onClick={() => setFilterBU(opt.value)}
                  sx={{
                    cursor: "pointer",
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? "#c8463a" : "#eef2f8",
                    color: active ? "#fff" : "#4a5a70",
                    "&:hover": { bgcolor: active ? "#a8372c" : "#e8eaed" },
                  }} />
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Competitor Cards */}
      <Grid container spacing={2.5} className="stagger-children">
        {filtered.map((c) => {
          const bu = c.business_unit || "KT";
          const buC = BU_COLORS[bu] || BU_COLORS.KT;
          const mc = MARKET_COLORS[c.market] || MARKET_COLORS.EU;
          const count = parseInt(c.product_count || "0");
          return (
            <Grid key={c.code} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 4, borderTop: `3px solid ${buC.border}`, height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Header */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#15223a" }}>{c.name}</Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: "#5d6b85", mt: 0.2 }}>{c.website_url}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Chip label={bu} size="small" sx={{ bgcolor: buC.bg, color: buC.color, fontWeight: 700 }} />
                      <Chip label={c.market} size="small" sx={{ bgcolor: mc.bg, color: mc.color, fontWeight: 700 }} />
                    </Box>
                  </Box>

                  {/* Stats */}
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: "#f5f7fb", textAlign: "center" }}>
                      <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: count > 0 ? buC.color : "#dfe5ee" }}>
                        {count.toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: "0.6rem", color: "#5d6b85", fontWeight: 600, textTransform: "uppercase" }}>Products</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: "#f5f7fb", textAlign: "center" }}>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5d6b85" }}>
                        {c.currency}
                      </Typography>
                      <Typography sx={{ fontSize: "0.6rem", color: "#5d6b85", fontWeight: 600, textTransform: "uppercase" }}>Currency</Typography>
                    </Box>
                  </Box>

                  {/* Last scraped */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2 }}>
                    <ScheduleIcon sx={{ fontSize: 14, color: "#5d6b85" }} />
                    <Typography sx={{ fontSize: "0.68rem", color: "#5d6b85" }}>
                      {c.last_scraped
                        ? `Last updated: ${new Date(c.last_scraped).toLocaleDateString("en-GB")}`
                        : "No data imported yet"
                      }
                    </Typography>
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ mt: "auto", display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<TravelExploreIcon />}
                      onClick={() => openScraper(c)}
                      sx={{
                        flex: 1, fontSize: "0.72rem", borderColor: "#c8463a", color: "#c8463a",
                        borderRadius: 2, textTransform: "none",
                        "&:hover": { bgcolor: "#fef2f2" },
                      }}
                    >
                      Scraper
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<StorageIcon />}
                      onClick={() => router.push(`/pricing/competitors/${c.code}`)}
                      sx={{
                        flex: 1, fontSize: "0.72rem", bgcolor: buC.color,
                        borderRadius: 2, textTransform: "none",
                        "&:hover": { bgcolor: bu === "DT" ? "#b91c1c" : "#1a3a4c" },
                      }}
                    >
                      Data ({count > 0 ? count.toLocaleString() : "Import"})
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Scraper Dialog (placeholder for now) */}
      <Dialog open={scraperOpen} onClose={() => setScraperOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#c8463a", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>
            {scraperCompetitor?.name} — Scraper
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)" }}>
            Configure automated price scraping
          </Typography>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          {scraperCompetitor && !adapters[scraperCompetitor.code] ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <TravelExploreIcon sx={{ fontSize: 44, color: "#dfe5ee", mb: 1.5 }} />
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#15223a", mb: 0.5 }}>
                No automated scraper for {scraperCompetitor?.name} yet
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", color: "#5d6b85" }}>
                This competitor isn’t wired for live scraping ({scraperCompetitor?.website_url}). Use the Data button to import Excel for now.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#5d6b85", mb: 2 }}>
                Scrape {scraperCompetitor?.website_url} and update the Hub directly
                {scraperCompetitor && adapters[scraperCompetitor.code]?.mode
                  ? ` (${adapters[scraperCompetitor.code].mode})` : ""}.
              </Typography>

              <Button fullWidth variant="contained" disabled={scrapeBusy}
                startIcon={scrapeBusy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <TravelExploreIcon />}
                onClick={() => scraperCompetitor && runNow(scraperCompetitor.code)}
                sx={{ bgcolor: "#c8463a", boxShadow: "none", fontWeight: 700, mb: 1, "&:hover": { bgcolor: "#a8372c", boxShadow: "none" } }}>
                {scrapeBusy ? "Running…" : "Run now"}
              </Button>

              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
                <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #dfe5ee", fontSize: "0.8rem" }} />
                <Button variant="outlined" startIcon={<ScheduleIcon />} disabled={!schedAt || scrapeBusy}
                  onClick={() => scraperCompetitor && scheduleScrape(scraperCompetitor.code)}
                  sx={{ borderColor: "#274e64", color: "#274e64", whiteSpace: "nowrap" }}>
                  Schedule
                </Button>
              </Box>

              {scrapeBusy && <LinearProgress sx={{ mt: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}
              {scrapeInfo && (
                <Alert severity={scrapeInfo.startsWith("Failed") || scrapeInfo.startsWith("Schedule failed") ? "error" : scrapeInfo.startsWith("✓") || scrapeInfo.startsWith("Scheduled") ? "success" : "info"}
                  sx={{ mt: 2, borderRadius: 2, fontSize: "0.78rem" }}>{scrapeInfo}</Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScraperOpen(false)} sx={{ color: "#5d6b85" }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>
            {importCompetitor?.name} — Import Data
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)" }}>
            Upload Excel file with competitor pricing
          </Typography>
        </Box>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "20px !important", px: 3 }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ borderStyle: "dashed", py: 2, borderRadius: 2 }}>
            {importFile ? importFile.name : "Choose Excel file (.xlsx)"}
            <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
          </Button>

          {importSheets.length > 0 && (
            <>
              {/* All sheets toggle */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  label="All Sheets"
                  onClick={() => setImportAll(true)}
                  sx={{ cursor: "pointer", fontWeight: importAll ? 700 : 500, bgcolor: importAll ? "#274e64" : "#eef2f8", color: importAll ? "#fff" : "#4a5a70" }}
                />
                <Chip
                  label="Single Sheet"
                  onClick={() => setImportAll(false)}
                  sx={{ cursor: "pointer", fontWeight: !importAll ? 700 : 500, bgcolor: !importAll ? "#274e64" : "#eef2f8", color: !importAll ? "#fff" : "#4a5a70" }}
                />
              </Box>

              {!importAll && (
                <FormControl fullWidth size="small">
                  <InputLabel>Sheet</InputLabel>
                  <Select value={importSheet} label="Sheet" onChange={(e) => setImportSheet(e.target.value)}>
                    {importSheets.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {importAll && (
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.75rem" }}>
                  All {importSheets.length} sheets will be parsed and imported automatically.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setImportOpen(false)} disabled={importing} sx={{ color: "#5d6b85" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!importFile || (!importAll && !importSheet) || importing}
            startIcon={importing ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <UploadFileIcon />}
            sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#1a3a4c" }, borderRadius: 2 }}
          >
            {importing ? "Importing..." : importAll ? `Import All (${importSheets.length} sheets)` : "Import Sheet"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}