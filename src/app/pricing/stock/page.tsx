"use client";
import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import TablePagination from "@mui/material/TablePagination";
import SyncIcon from "@mui/icons-material/Sync";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import PageHeader from "../PageHeader";
import { ClearFilters } from "../Filters";
import { useSavedFilters } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface AnyealsProduct {
  hubspot_id: string | null;
  article_number: string;
  description: string | null;
  mandant: string;
  article_status: string | null;
  // Postgres NUMERIC / DECIMAL come over the wire as strings (node-pg
  // doesn't auto-convert to keep precision). Treat as string|number.
  stock: string | number | null;
  stock_unit: string | null;
  article_anyseals: string | null;
  stock_anyseals: string | number | null;
  country_of_origin: string | null;
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtInt(v: string | number | null | undefined): string {
  const n = toNum(v);
  return n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

interface UploadRecord {
  id: number;
  filename: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  row_count: number;
  status: string;
  synced_at: string | null;
  matched_count: number;
  unmatched_count: number;
  error_message: string | null;
  mandants_synced: string | null;
}

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  uploaded: "info",
  syncing: "warning",
  synced: "success",
  failed: "error",
};

function fmtDate(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" });
}

export default function StockPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "pick" | null>(null);
  const [debugInfo, setDebugInfo] = useState<unknown>(null);

  // Anyseals stock data (local mirror)
  const [stockRows, setStockRows] = useState<AnyealsProduct[]>([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockPage, setStockPage] = useState(0);
  // Search, mandant and comparison view are saved per user; they stay until "Clear all".
  const sf = useSavedFilters("stock", {
    search: "", mandant: "M100" as "M100" | "M110" | "all",
    compare: "both" as "both" | "only_anyseals" | "only_apso" | "discrepancy",
  });
  const [stockSearch, setStockSearch] = sf.bind("search");
  const [stockMandant, setStockMandant] = sf.bind("mandant");
  const [stockCompare, setStockCompare] = sf.bind("compare");
  const [stockLoading, setStockLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the table loads once
    setStockLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(stockPage + 1),
        per_page: "50",
        mandant: stockMandant,
        compare: stockCompare,
      });
      if (stockSearch) params.set("search", stockSearch);
      const res = await fetch(`${API_URL}/api/anyseals/products?${params}`);
      const data = await res.json();
      setStockRows(data.data || []);
      setStockTotal(data.total || 0);
    } catch {
      setStockRows([]);
      setStockTotal(0);
    } finally {
      setStockLoading(false);
    }
  }, [stockPage, stockSearch, stockMandant, stockCompare, sf.ready]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);
  const [includeM110, setIncludeM110] = useState(false);
  const mandants = includeM110 ? ["M100", "M110"] : ["M100"];
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/anyseals/uploads`);
      const data = await res.json();
      setUploads(data.data || []);
    } catch {
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Poll while a row is in 'syncing' state.
  useEffect(() => {
    const isSyncing = uploads.some((u) => u.status === "syncing");
    if (!isSyncing) return;
    const t = setInterval(fetchUploads, 4000);
    return () => clearInterval(t);
  }, [uploads, fetchUploads]);

  const sync = async (id: number) => {
    setError(null);
    setInfo(null);
    setBusy(id);
    try {
      const res = await fetch(`${API_URL}/api/anyseals/sync/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandants }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setInfo(
        `Synced #${id} (${mandants.join("+")}): ${data.upload.matched_count.toLocaleString()} updated, ${data.upload.unmatched_count.toLocaleString()} unmatched.`,
      );
      await fetchUploads();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickFromHubSpot = async (force = false) => {
    setError(null);
    setInfo(null);
    setDebugInfo(null);
    setBusy("pick");
    try {
      const res = await fetch(`${API_URL}/api/anyseals/pick-from-hubspot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandants, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pickup failed");
      if (data.debug) setDebugInfo(data.debug);
      if (data.skipped) {
        setInfo(`Skipped: ${data.reason}`);
      } else if (data.result) {
        setInfo(
          `Picked ${data.result.filename} → ${data.result.matched_count.toLocaleString()} updated, ${data.result.unmatched_count.toLocaleString()} unmatched.`,
        );
      }
      await fetchUploads();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box>
      <PageHeader
        icon="stock"
        eyebrow="Data Sources"
        title="Anyseals Stock"
        subtitle="Daily supplier stock CSV pulled from the HubSpot File Manager folder and synced to the Products & Pricing custom object (article_anyseals, stock_anyseals). Match key: article_number == ref_art. Default: M100 only — M110 left untouched."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity={info.startsWith("Skipped") ? "warning" : "success"} sx={{ mb: 2 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      {debugInfo !== null && (
        <Card sx={{ mb: 2, bgcolor: "#fafbfc", border: "1px solid #ececec", borderRadius: 2 }}>
          <CardContent sx={{ "&:last-child": { pb: 2 } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5f6368" }}>
                Debug — last pickup
              </Typography>
              <Button size="small" onClick={() => setDebugInfo(null)} sx={{ minWidth: "auto", fontSize: 11 }}>Hide</Button>
            </Box>
            <Box sx={{ fontFamily: "monospace", fontSize: 11.5, whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 320, color: "#1f1f1f" }}>
              {JSON.stringify(debugInfo, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="stretch">
            <Box
              sx={{
                flex: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 3,
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <InventoryIcon sx={{ fontSize: 36, color: "text.secondary" }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  HubSpot File Manager → Products &amp; Pricing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Files are dropped into the configured folder by the email-scrape workflow. The
                  cron at <strong>18:30 Europe/Zurich</strong> picks the newest <code>Anyseals_Stock_*.csv</code> and
                  writes <code>article_anyseals</code> + <code>stock_anyseals</code> on the matching custom-object records.
                </Typography>
              </Box>
            </Box>
            <Stack spacing={1.5} sx={{ minWidth: { md: 260 } }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={busy === "pick" ? <SyncIcon /> : <CloudDownloadIcon />}
                disabled={busy === "pick"}
                onClick={() => pickFromHubSpot(false)}
              >
                {busy === "pick" ? "Working..." : "Pick & Sync now"}
              </Button>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includeM110}
                    onChange={(e) => setIncludeM110(e.target.checked)}
                  />
                }
                label="Also update M110"
                sx={{ mt: -0.5 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="h6">Anyseals Stock — Products</Typography>
              <Typography variant="caption" color="text.secondary">
                Local mirror of products with Anyseals supplier data. Refreshed by /products → Sync from HubSpot.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Search article / description / Anyseals code…"
                value={stockSearch}
                onChange={(e) => { setStockSearch(e.target.value); setStockPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 280 }}
              />
              <ClearFilters show={sf.active} onClick={() => { sf.reset(); setStockPage(0); }} />
              <Stack direction="row" spacing={0}>
                {(["M100", "M110", "all"] as const).map((m) => (
                  <Button
                    key={m}
                    size="small"
                    variant={stockMandant === m ? "contained" : "outlined"}
                    onClick={() => { setStockMandant(m); setStockPage(0); }}
                    sx={{
                      minWidth: 60,
                      borderRadius: 0,
                      "&:first-of-type": { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                      "&:last-of-type": { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
                      ml: m === "M100" ? 0 : "-1px",
                      ...(stockMandant === m
                        ? {
                            bgcolor: "#ed1b2f",
                            color: "#fff",
                            "&:hover": { bgcolor: "#c8121f" },
                          }
                        : {
                            color: "#ed1b2f",
                            borderColor: "#ed1b2f",
                            "&:hover": {
                              borderColor: "#ed1b2f",
                              bgcolor: "rgba(237, 27, 47, 0.06)",
                            },
                          }),
                    }}
                  >
                    {m === "all" ? "All" : m}
                  </Button>
                ))}
              </Stack>
              <Chip
                label={`${stockTotal.toLocaleString()} rows`}
                size="small"
                sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }}
              />
            </Box>
          </Box>
          {/* Comparison row — APSO red filter chips. 'Both' is the
              default; the three deltas surface action items: stock
              they have but we don't, stock we have but they don't,
              and rows where both sides report stock but the numbers
              disagree. */}
          <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
            {([
              { key: "both", label: "Both sides" },
              { key: "only_anyseals", label: "Only Anyseals (we don't stock)" },
              { key: "only_apso", label: "Only APSO (they don't stock)" },
              { key: "discrepancy", label: "Discrepancy" },
            ] as const).map((opt) => {
              const active = stockCompare === opt.key;
              return (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  size="small"
                  onClick={() => {
                    setStockCompare(opt.key);
                    setStockPage(0);
                  }}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    height: 26,
                    bgcolor: active ? "#ed1b2f" : "transparent",
                    color: active ? "#fff" : "#ed1b2f",
                    border: "1px solid #ed1b2f",
                    "&:hover": {
                      bgcolor: active ? "#c8121f" : "rgba(237, 27, 47, 0.06)",
                    },
                  }}
                />
              );
            })}
          </Box>

          {stockLoading ? (
            <LinearProgress />
          ) : stockRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No Anyseals data in the local mirror yet. Run <strong>Sync from HubSpot</strong> on the Products page first.
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>HubSpot ID</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Article No.</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mandant</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Article Anyseals</TableCell>
                      {/* Stock columns sit side-by-side so the visual
                          comparison reads at a glance. Both render
                          integer + unit; APSO column renamed from
                          'Stock (A+P)'. */}
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stock Anyseals</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stock APSO</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockRows.map((r) => {
                      const unit = r.stock_unit || "Pcs";
                      const sa = toNum(r.stock_anyseals);
                      const sap = toNum(r.stock);
                      const colorFor = (n: number | null) =>
                        n == null ? "#bdc1c6" : n > 0 ? "#34a853" : n < 0 ? "#ed1b2f" : "#5f6368";
                      return (
                        <TableRow key={`${r.article_number}-${r.mandant}`} hover>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#5f6368" }}>{r.hubspot_id || "—"}</TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.72rem", fontWeight: 600, color: "#274e64" }}>{r.article_number}</TableCell>
                          <TableCell sx={{ fontSize: "0.72rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              label={r.mandant}
                              size="small"
                              sx={{ fontSize: "0.62rem", height: 20, bgcolor: r.mandant === "M100" ? "#e8f0f4" : "#fef7e0", color: r.mandant === "M100" ? "#274e64" : "#854d0e", fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.72rem", color: r.article_anyseals ? "#274e64" : "#bdc1c6", fontWeight: 600 }}>
                            {r.article_anyseals || "—"}
                          </TableCell>
                          <TableCell align="right" sx={{
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            color: colorFor(sa),
                          }}>
                            {fmtInt(sa)}
                            {sa != null && (
                              <Typography component="span" sx={{ fontSize: "0.6rem", color: "#9aa0a6", ml: 0.5 }}>
                                {unit}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            color: colorFor(sap),
                          }}>
                            {fmtInt(sap)}
                            {sap != null && (
                              <Typography component="span" sx={{ fontSize: "0.6rem", color: "#9aa0a6", ml: 0.5 }}>
                                {unit}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.7rem", color: "#5f6368" }}>{r.article_status || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={stockTotal}
                page={stockPage}
                onPageChange={(_, p) => setStockPage(p)}
                rowsPerPage={50}
                rowsPerPageOptions={[50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Sync history
          </Typography>
          {loading ? (
            <LinearProgress />
          ) : uploads.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No syncs yet — click <strong>Pick &amp; Sync now</strong>, or wait for the 18:30 cron.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell align="right">Rows</TableCell>
                    <TableCell>Uploaded</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Mandants</TableCell>
                    <TableCell align="right">Matched</TableCell>
                    <TableCell align="right">Unmatched</TableCell>
                    <TableCell>Synced</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploads.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.filename || "-"}
                      </TableCell>
                      <TableCell align="right">{u.row_count.toLocaleString()}</TableCell>
                      <TableCell>{fmtDate(u.uploaded_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.status}
                          color={STATUS_COLOR[u.status] || "default"}
                          variant={u.status === "synced" ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                        {u.mandants_synced || "-"}
                      </TableCell>
                      <TableCell align="right">{u.matched_count.toLocaleString()}</TableCell>
                      <TableCell align="right">{u.unmatched_count.toLocaleString()}</TableCell>
                      <TableCell>{fmtDate(u.synced_at)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SyncIcon />}
                          disabled={busy === u.id || u.status === "syncing"}
                          onClick={() => sync(u.id)}
                        >
                          {busy === u.id || u.status === "syncing" ? "Syncing..." : "Sync to HubSpot"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}