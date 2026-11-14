"use client";
import React, { useEffect, useState, useCallback } from "react";
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
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PageHeader from "../PageHeader";
import { ClearFilters } from "../Filters";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";
import { exportProductsExcel, type ExportMode } from "@/lib/pricing/exportExcel";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface ScrapedProduct {
  id: number;
  parent_sku: string;
  product_name: string;
  material: string | null;
  compound_ref: string | null;
  hardness: string | null;
  temp_range: string | null;
  color: string | null;
  conformity: string | null;
  standard: string | null;
  category_path: string | null;
  description: string | null;
  image_url: string | null;
  scraped_at: string;
}

interface ScrapedArticle {
  id: number;
  sku: string;
  parent_sku: string;
  inner_diameter_mm: number | null;
  cord_diameter_mm: number | null;
  outer_diameter_mm: number | null;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  diameter_mm: number | null;
  as_bs_number: string | null;
  dimensions_json: Record<string, string> | null;
  scraped_at: string;
  // Joined from product_library
  material?: string;
  product_name?: string;
}

export default function ScrapersPage() {
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [page, setPage] = useState(0);
  // Searches + the chosen view are saved per user; they stay until "Clear all".
  const sf = useSavedFilters("scrapers", { search: "", articlesSearch: "", view: "products" as "products" | "articles" });
  const [search, setSearch] = sf.bind("search");
  const [detailMode, setDetailMode] = useDetailMode();
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = sf.bind("view");
  const [articlesList, setArticlesList] = useState<ScrapedArticle[]>([]);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesPage, setArticlesPage] = useState(0);
  const [articlesSearch, setArticlesSearch] = sf.bind("articlesSearch");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the page loads once
    try {
      const params = new URLSearchParams({ page: String(page + 1), per_page: "25" });
      if (search) params.set("search", search);
      if (sortCol) { params.set("sort", sortCol); params.set("dir", sortDir); }
      const [prodRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/dimensions/products?${params}`),
        fetch(`${API_URL}/api/dimensions/stats`),
      ]);
      const prodData = await prodRes.json();
      const statsData = await statsRes.json();
      setProducts(prodData.data || []);
      setTotal(prodData.total || statsData.product_library_count || 0);
      setArticleCount(statsData.article_dimensions_count || 0);
    } catch {
      setProducts([]);
    }
  }, [page, search, sortCol, sortDir, sf.ready]);

  const fetchArticles = useCallback(async () => {
    if (!sf.ready) return;
    try {
      const params = new URLSearchParams({ page: String(articlesPage + 1), per_page: "25" });
      if (articlesSearch) params.set("search", articlesSearch);
      const res = await fetch(`${API_URL}/api/dimensions/articles?${params}`);
      const data = await res.json();
      setArticlesList(data.data || []);
      setArticlesTotal(data.total || 0);
    } catch {
      setArticlesList([]);
    }
  }, [articlesPage, articlesSearch, sf.ready]);

  useEffect(() => {
    if (!sf.ready) return;
    fetchData().finally(() => setLoading(false));
  }, [fetchData, sf.ready]);

  useEffect(() => {
    if (viewMode === "articles") fetchArticles();
  }, [viewMode, fetchArticles]);

  // Poll scrape status
  useEffect(() => {
    if (!scraping) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/dimensions/scrape-status`);
        const data = await res.json();
        setScrapeStatus(data.status || "");
        if (!data.running) {
          setScraping(false);
          fetchData();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [scraping, fetchData]);

  async function handleScrape() {
    setScraping(true);
    setScrapeStatus("Starting...");
    try {
      await fetch(`${API_URL}/api/dimensions/scrape`, { method: "POST" });
    } catch {
      setScraping(false);
      setScrapeStatus("Failed to start");
    }
  }

  async function handleExport(scope: "all" | "view", content: ExportMode) {
    setExporting(true);
    setExportOpen(false);
    try {
      let products = null;
      let dimensions = null;

      if (content === "products" || content === "both") {
        const params = new URLSearchParams();
        if (scope === "view") {
          params.set("per_page", "25");
          params.set("page", String(page + 1));
          if (search) params.set("search", search);
        } else {
          params.set("per_page", "99999");
        }
        const res = await fetch(`${API_URL}/api/dimensions/products?${params}`);
        const data = await res.json();
        products = data.data || [];
      }

      if (content === "dimensions" || content === "both") {
        const dParams = new URLSearchParams();
        if (scope === "view") {
          dParams.set("per_page", "25");
          dParams.set("page", String(articlesPage + 1));
          if (articlesSearch) dParams.set("search", articlesSearch);
        } else {
          // Cap at 10k to avoid browser crash (57k rows + dynamic columns = too much memory)
          dParams.set("per_page", "10000");
        }
        const res = await fetch(`${API_URL}/api/dimensions/articles?${dParams}`);
        const data = await res.json();
        dimensions = data.data || [];
      }

      const label = scope === "view" ? `Current View${search ? ` — "${search}"` : ""}` : "All Scraped Data";
      await exportProductsExcel(products, dimensions, label, content, "scraper");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  // Server-side sort: re-query the FULL dataset and jump to page 1.
  function handleSort(col: string) {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  }

  const columns = [
    { id: "_expand", label: "", noSort: true },
    { id: "parent_sku", label: "SKU" },
    { id: "product_name", label: "Product Name" },
    { id: "material", label: "Material" },
    { id: "compound_ref", label: "Compound" },
    { id: "hardness", label: "Hardness" },
    { id: "color", label: "Color" },
    { id: "conformity", label: "Conformity" },
    { id: "category_path", label: "Category" },
    { id: "scraped_at", label: "Scraped" },
  ];

  return (
    <Box>
      <PageHeader
        icon="scraper"
        eyebrow="Data Sources"
        title="APSOparts Scraper"
        subtitle="Product specs and dimensions scraped from apsoparts.com"
        rightSlot={
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={() => setExportOpen(true)}
              disabled={total === 0 || exporting}
              sx={{ borderColor: "#34a853", color: "#34a853", "&:hover": { bgcolor: "#e8f5e9" } }}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button
              variant="contained"
              startIcon={scraping ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SyncIcon />}
              disabled={scraping}
              onClick={handleScrape}
              sx={{ bgcolor: "#ed1b2f", color: "#fff", boxShadow: "none", fontWeight: 700,
                "&:hover": { bgcolor: "#c41527", boxShadow: "none" } }}
            >
              {scraping ? "Scraping..." : "Run Scraper"}
            </Button>
          </Box>
        }
      />

      {/* Scrape progress */}
      {scraping && (
        <Card sx={{ mb: 2, border: "1px solid #274e64", borderRadius: 3, overflow: "hidden" }}>
          <LinearProgress sx={{ height: 4, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, display: "flex", alignItems: "center", gap: 2 }}>
            <CircularProgress size={20} sx={{ color: "#274e64" }} />
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#1f1f1f" }}>Scraping apsoparts.com</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{scrapeStatus}</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Card sx={{ flex: 1, border: "1px solid #ececec", borderRadius: 3, borderTop: "3px solid #ed1b2f" }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", fontWeight: 700, textTransform: "uppercase" }}>Pages Scraped</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#ed1b2f" }}>2,079</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, border: "1px solid #ececec", borderRadius: 3, borderTop: "3px solid #274e64" }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", fontWeight: 700, textTransform: "uppercase" }}>Product Families</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#274e64" }}>{total.toLocaleString()}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, border: "1px solid #ececec", borderRadius: 3, borderTop: "3px solid #34a853" }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", fontWeight: 700, textTransform: "uppercase" }}>Article Dimensions</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#34a853" }}>{articleCount.toLocaleString()}</Typography>
          </CardContent>
        </Card>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* View Toggle */}
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <Chip
          label="Products"
          onClick={() => setViewMode("products")}
          sx={{ fontWeight: viewMode === "products" ? 700 : 500, bgcolor: viewMode === "products" ? "#274e64" : "#f1f3f4", color: viewMode === "products" ? "#fff" : "#3c4043", cursor: "pointer" }}
        />
        <Chip
          label="Articles & Dimensions"
          onClick={() => setViewMode("articles")}
          sx={{ fontWeight: viewMode === "articles" ? 700 : 500, bgcolor: viewMode === "articles" ? "#274e64" : "#f1f3f4", color: viewMode === "articles" ? "#fff" : "#3c4043", cursor: "pointer" }}
        />
      </Box>

      {/* Articles Table */}
      {viewMode === "articles" && (
        <Card sx={{ border: "1px solid #ececec", borderRadius: 4 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #ececec" }}>
              <TextField
                size="small"
                placeholder="Search SKU..."
                value={articlesSearch}
                onChange={(e) => { setArticlesSearch(e.target.value); setArticlesPage(0); }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "#5f6368" }} /></InputAdornment> } }}
                sx={{ flex: 1, maxWidth: 400 }}
              />
              <Chip label={`${articlesTotal.toLocaleString()} articles`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
              <ClearFilters show={!!(search || articlesSearch)} onClick={() => { sf.reset({ view: "articles" }); setArticlesPage(0); }} />
            </Box>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                    {["SKU", "Parent SKU", "Dim 1", "Dim 2", "Dim 3", "Dim 4", "Dim 5", "Dim 6", "Dim 7", "All Dimensions", "Scraped"].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {articlesList.length === 0 && (
                    <TableRow><TableCell colSpan={11} align="center" sx={{ py: 6, color: "#5f6368" }}>No articles scraped yet.</TableCell></TableRow>
                  )}
                  {articlesList.map((a) => {
                    const dimEntries = a.dimensions_json ? Object.entries(a.dimensions_json) : [];
                    return (
                      <TableRow key={a.id} hover>
                        <TableCell><Typography sx={{ fontSize: "0.75rem", fontWeight: 600, fontFamily: "monospace", color: "#274e64" }}>{a.sku}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#5f6368" }}>{a.parent_sku}</Typography></TableCell>
                        {Array.from({ length: 7 }, (_, i) => (
                          <TableCell key={i}>
                            {dimEntries[i] ? (
                              <Box>
                                <Typography sx={{ fontSize: "0.58rem", color: "#5f6368", fontWeight: 600 }}>{dimEntries[i][0]}</Typography>
                                <Typography sx={{ fontSize: "0.72rem", color: "#1f1f1f" }}>{dimEntries[i][1]}</Typography>
                              </Box>
                            ) : (
                              <Typography sx={{ fontSize: "0.72rem", color: "#dadce0" }}>—</Typography>
                            )}
                          </TableCell>
                        ))}
                        <TableCell><Typography sx={{ fontSize: "0.62rem", color: "#5f6368", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dimEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5f6368" }}>{a.scraped_at ? new Date(a.scraped_at).toLocaleDateString("de-CH") : "—"}</Typography></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={articlesTotal} page={articlesPage} onPageChange={(_, p) => setArticlesPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      {viewMode === "products" && (
      <Card sx={{ border: "1px solid #ececec", borderRadius: 4 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #ececec" }}>
            <TextField
              size="small"
              placeholder="Search SKU, name, material..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "#5f6368" }} /></InputAdornment> } }}
              sx={{ flex: 1, maxWidth: 400 }}
            />
            <Chip label={`${total.toLocaleString()} products`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
            <ClearFilters show={!!(search || articlesSearch)} onClick={() => { sf.reset({ view: "products" }); setPage(0); }} />
            <Box sx={{ flex: 1 }} />
            <DetailModeToggle mode={detailMode} onChange={setDetailMode} />
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                  {columns.map((col) => (
                    <TableCell key={col.id} sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", ...(col.id === "_expand" ? { width: 36, p: 0.5 } : {}) }}>
                      {col.noSort ? null : (
                        <TableSortLabel
                          active={sortCol === col.id}
                          direction={sortCol === col.id ? sortDir : "asc"}
                          onClick={() => handleSort(col.id)}
                          sx={{ "& .MuiTableSortLabel-icon": { fontSize: 14, opacity: 1 } }}
                        >
                          {col.label}
                        </TableSortLabel>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {products.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#5f6368" }}>
                      No scraped products. Click &quot;Run Scraper&quot; to start.
                    </TableCell>
                  </TableRow>
                )}
                {products.map((p, pi) => {
                  const isExpanded = expandedRow === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <TableRow hover sx={{ cursor: "pointer", bgcolor: isExpanded ? "#f0f7ff" : undefined }} onClick={() => setExpandedRow(isExpanded ? null : p.id)}>
                        <TableCell sx={{ p: 0.5, width: 36 }}>
                          <IconButton size="small" sx={{ color: isExpanded ? "#274e64" : "#bdc1c6" }}>
                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.75rem", fontWeight: 600, fontFamily: "monospace", color: "#274e64" }}>{p.parent_sku}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_name}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#1f1f1f" }}>{p.material || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.compound_ref || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.hardness || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.72rem", color: "#5f6368" }}>{p.color || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5f6368", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.conformity || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5f6368", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.category_path || "—"}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5f6368" }}>{p.scraped_at ? new Date(p.scraped_at).toLocaleDateString("de-CH") : "—"}</Typography></TableCell>
                      </TableRow>
                      <RowDetail mode={detailMode} open={isExpanded} onClose={() => setExpandedRow(null)} colSpan={columns.length} maxWidth="lg"
                        title={p.parent_sku} subtitle={p.product_name || undefined}
                        onPrev={pi > 0 ? () => setExpandedRow(products[pi - 1].id) : undefined}
                        onNext={pi < products.length - 1 ? () => setExpandedRow(products[pi + 1].id) : undefined}>
                            <Box sx={{ p: 3, bgcolor: "#f8f9fb" }}>
                              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>Technical Specs</Typography>
                                    {[
                                      ["Material", p.material],
                                      ["Compound", p.compound_ref],
                                      ["Hardness", p.hardness],
                                      ["Temp Range", p.temp_range],
                                      ["Color", p.color],
                                      ["Standard", p.standard],
                                    ].map(([l, v]) => (
                                      <Box key={String(l)} sx={{ display: "flex", justifyContent: "space-between", py: 0.4, borderBottom: "1px solid #f5f5f5" }}>
                                        <Typography sx={{ fontSize: "0.68rem", color: "#5f6368" }}>{l}</Typography>
                                        <Typography sx={{ fontSize: "0.68rem", color: "#1f1f1f", fontWeight: 500 }}>{v || "—"}</Typography>
                                      </Box>
                                    ))}
                                  </CardContent>
                                </Card>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>Conformity & Category</Typography>
                                    <Typography sx={{ fontSize: "0.68rem", color: "#1f1f1f", mb: 1, lineHeight: 1.5 }}>{p.conformity || "No conformity data"}</Typography>
                                    <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", fontStyle: "italic" }}>{p.category_path || "No category"}</Typography>
                                  </CardContent>
                                </Card>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", mb: 1 }}>Description</Typography>
                                    <Typography sx={{ fontSize: "0.68rem", color: "#5f6368", lineHeight: 1.5, maxHeight: 120, overflow: "auto" }}>
                                      {p.description?.substring(0, 500) || "No description"}
                                    </Typography>
                                    {p.image_url && (
                                      <Box component="img" src={p.image_url} sx={{ mt: 1, maxWidth: 80, maxHeight: 80, borderRadius: 1, border: "1px solid #ececec" }} />
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
          </TableContainer>

          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
        </CardContent>
      </Card>
      )}

      {/* Export Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "#fff" }}>Export to Excel</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", mt: 0.3 }}>
            Choose data scope and content
          </Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          {[
            { scope: "all" as const, title: "All Data", desc: `${total.toLocaleString()} products + ${articleCount.toLocaleString()} articles`, icon: <DescriptionIcon sx={{ color: "#2e7d32", fontSize: 24 }} />, bg: "#e8f5e9" },
            { scope: "view" as const, title: "Current View (page only)", desc: search ? `Filtered: "${search}"` : "Current page of 25 items", icon: <FilterAltIcon sx={{ color: "#274e64", fontSize: 24 }} />, bg: "#e8f0f4" },
          ].map((opt) => (
            <Box key={opt.scope} sx={{ borderBottom: "1px solid #f0f0f0" }}>
              <Box sx={{ px: 3, pt: 2, pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: opt.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{opt.icon}</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#1f1f1f" }}>{opt.title}</Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>{opt.desc}</Typography>
                </Box>
              </Box>
              <Box sx={{ px: 3, pb: 2, pt: 0.5, display: "flex", gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => handleExport(opt.scope, "products")}
                  sx={{ flex: 1, fontSize: "0.7rem", borderColor: "#274e64", color: "#274e64", borderRadius: 2, textTransform: "none", "&:hover": { bgcolor: "#e8f0f4" } }}>
                  Products only
                </Button>
                <Button size="small" variant="outlined" onClick={() => handleExport(opt.scope, "dimensions")}
                  sx={{ flex: 1, fontSize: "0.7rem", borderColor: "#6d28d9", color: "#6d28d9", borderRadius: 2, textTransform: "none", "&:hover": { bgcolor: "#f3f0ff" } }}>
                  Dimensions only
                </Button>
                <Button size="small" variant="contained" onClick={() => handleExport(opt.scope, "both")}
                  sx={{ flex: 1, fontSize: "0.7rem", bgcolor: "#274e64", borderRadius: 2, textTransform: "none", "&:hover": { bgcolor: "#1a3a4c" } }}>
                  Both (2 sheets)
                </Button>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setExportOpen(false)} sx={{ color: "#5f6368" }}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
