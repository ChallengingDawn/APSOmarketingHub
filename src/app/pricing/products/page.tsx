"use client";
import React, { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Autocomplete from "@mui/material/Autocomplete";
import TableSortLabel from "@mui/material/TableSortLabel";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PageHeader from "../PageHeader";
import { FilterBar, SelectFilter, HierFilter, TextFilter, ClearFilters, FW } from "../Filters";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

// Price sets shown as columns in the products table. Each one can be expanded to
// reveal 10 scale-tier sub-columns (qty / scale price per tier).
// NOTE: scale data lives in a single `scale_prices` array on the product; it carries
// tier breakdowns for the LIST price. Other sets show "—" in their tier cells for now
// until per-set scale data is imported.
// One column PER price set PER mandant. The M100/CHF set first, then the M110/EUR
// set (the "5 more" columns). Only the Listed price carries scale tiers (from
// scale_prices for CHF, scale_prices_m110 for EUR) — expandable in-place.
interface PriceColConfig {
  key: string;
  label: string;
  field: keyof Product;
  currency: "CHF" | "EUR";
  scaleField?: "scale_prices" | "scale_prices_m110";
  color: string;
  bg: string;
  hoverBg?: string;
  tierBg: string;
}
const PRICE_COLUMNS: PriceColConfig[] = [
  // M100 / CHF
  { key: "gdwst", label: "GWstDP", field: "gdwst_price", currency: "CHF", color: "#2e7d32", bg: "#e8f5e9", tierBg: "#f0fdf4" },
  { key: "list_chf", label: "List CHF", field: "listprice", currency: "CHF", scaleField: "scale_prices", color: "#1f1f1f", bg: "#fafbfc", tierBg: "#f7f8fa" },
  { key: "bronze_chf", label: "Bronze CHF", field: "bronze_price", currency: "CHF", color: "#b8860b", bg: "#fdf6e3", tierBg: "#fbf6e8" },
  { key: "silver_chf", label: "Silver CHF", field: "silver_price", currency: "CHF", color: "#6b7280", bg: "#f0f0f0", tierBg: "#f5f5f5" },
  { key: "gold_chf", label: "Gold CHF", field: "gold_price", currency: "CHF", color: "#d4a017", bg: "#fef9e7", tierBg: "#fef9ed" },
  { key: "platinum_chf", label: "Platinum CHF", field: "platinum_price", currency: "CHF", color: "#6d28d9", bg: "#f3f0ff", tierBg: "#f7f4ff" },
  // M110 / EUR — the 5 additional columns
  { key: "list_eur", label: "List EUR", field: "listprice_m110", currency: "EUR", scaleField: "scale_prices_m110", color: "#1f1f1f", bg: "#eef2f7", tierBg: "#f1f5f9" },
  { key: "bronze_eur", label: "Bronze EUR", field: "bronze_price_m110", currency: "EUR", color: "#b8860b", bg: "#faf3df", tierBg: "#fbf6e8" },
  { key: "silver_eur", label: "Silver EUR", field: "silver_price_m110", currency: "EUR", color: "#6b7280", bg: "#ededed", tierBg: "#f5f5f5" },
  { key: "gold_eur", label: "Gold EUR", field: "gold_price_m110", currency: "EUR", color: "#d4a017", bg: "#fdf6df", tierBg: "#fef9ed" },
  { key: "platinum_eur", label: "Platinum EUR", field: "platinum_price_m110", currency: "EUR", color: "#6d28d9", bg: "#efeafe", tierBg: "#f7f4ff" },
];

interface Product {
  id: number;
  article_number: string;
  description: string;
  product_number: string | null;
  product_description: string | null;
  assortment_number: string | null;
  assortment_description: string | null;
  main_group_number: string | null;
  main_group_description: string | null;
  sub_group_number: string | null;
  sub_group_description: string | null;
  material: string;
  material_normalized: string;
  product_type: string;
  product_type_normalized: string;
  color: string;
  color_normalized: string;
  diameter: number | null;
  length: number | null;
  thickness: number | null;
  width: number | null;
  mandant: string;
  currency: string;
  // M100 / CHF price sets
  listprice: number | null;
  bronze_price: number | null;
  silver_price: number | null;
  gold_price: number | null;
  platinum_price: number | null;
  // M110 / EUR price sets (same article, second mandant)
  listprice_m110: number | null;
  bronze_price_m110: number | null;
  silver_price_m110: number | null;
  gold_price_m110: number | null;
  platinum_price_m110: number | null;
  scale_prices_m110: { tier: number; qty: number | null; list: number | null }[] | null;
  profit_center: string | null;
  article_type: string | null;
  article_status: string | null;
  hubspot_id: string | null;
  stock: number | null;
  unit: string;
  sales_unit: string | null;
  stock_unit: string | null;
  article_anyseals: string | null;
  stock_anyseals: number | null;
  gdwst_price: number | null;
  bronze_price_scaled: number | null;
  silver_price_scaled: number | null;
  gold_price_scaled: number | null;
  platinum_price_scaled: number | null;
  conformities: string | null;
  hardness: string | null;
  moq: string | null;
  country_of_origin: string | null;
  ap_compound: string | null;
  supplier_compound: string | null;
  tarifs_number: string | null;
  budget_class: string | null;
  scale_prices: { tier: number; qty: number | null; list: number | null }[] | null;
}

interface GroupOption { number: string; description: string }
interface Filters {
  materials: string[];
  product_types: string[];
  mandants: string[];
  profit_centers: string[];
  colors: string[];
  statuses: string[];
  assortments: GroupOption[];
  main_groups: GroupOption[];
  sub_groups: GroupOption[];
  product_groups: GroupOption[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  // Filters + search are saved per user and stay until "Clear all".
  const sf = useSavedFilters("products", { search: "", mandant: "", pc: "", ass: "", mg: "", sg: "", pg: "", status: "" });
  const [search, setSearch] = sf.bind("search");
  const [detailMode, setDetailMode] = useDetailMode();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Sort
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Which mandant's price columns to show, and column visibility (eye icon)
  const [priceMandant, setPriceMandant] = useState<"M100" | "M110" | "both">("both");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenuAnchor, setColMenuAnchor] = useState<null | HTMLElement>(null);

  // Expanded rows + expanded price set columns (one per set: gdwst, list, bronze, silver, gold, platinum)
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  function toggleSet(key: string) {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Filters — hierarchy: Profit Center → Assortment → Main Group → Sub Group → Product Group
  const [filters, setFilters] = useState<Filters | null>(null);
  const [filterMandant, setFilterMandant] = sf.bind("mandant");
  const [filterProfitCenter, setFilterProfitCenter] = sf.bind("pc");
  const [filterAssortment, setFilterAssortment] = sf.bind("ass");
  const [filterMainGroup, setFilterMainGroup] = sf.bind("mg");
  const [filterSubGroup, setFilterSubGroup] = sf.bind("sg");
  const [filterProductGroup, setFilterProductGroup] = sf.bind("pg");
  const [filterStatus, setFilterStatus] = sf.bind("status");

  const hasActiveFilter = sf.active;

  function clearAllFilters() {
    sf.reset();
    setPage(0);
  }

  // Sync progress
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null);
  const [syncTotalFetched, setSyncTotalFetched] = useState(0);
  const [syncSynced, setSyncSynced] = useState(0);
  const [syncErrors, setSyncErrors] = useState(0);
  const [, setNowTick] = useState(0); // tick re-render every second while syncing
  useEffect(() => {
    if (syncStartedAt === null) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [syncStartedAt]);

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Per-product edit / delete
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // Enrichment cache (scraped dimensions per article_number)
  const [enrichments, setEnrichments] = useState<Record<string, {
    dimensions_json: Record<string, string> | null;
    inner_diameter_mm: number | null; cord_diameter_mm: number | null;
    outer_diameter_mm: number | null; diameter_mm: number | null;
    thickness_mm: number | null; width_mm: number | null; length_mm: number | null;
    as_bs_number: string | null; parent_sku: string | null;
    product_name: string | null; lib_material: string | null; compound_ref: string | null;
    lib_hardness: string | null; temp_range: string | null; lib_color: string | null;
    lib_conformity: string | null; lib_standard: string | null;
    category_path: string | null; image_url: string | null;
  }>>({});

  // Fetch enrichment for visible products
  const fetchEnrichments = useCallback(async (articleNumbers: string[]) => {
    const missing = articleNumbers.filter(a => !(a in enrichments));
    if (missing.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/api/products/enrich-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_numbers: missing }),
      });
      const data = await res.json();
      if (data.enrichments) {
        setEnrichments(prev => ({ ...prev, ...data.enrichments }));
      }
    } catch { /* ignore */ }
  }, [enrichments]);

  // Fetch enrichments when products change
  useEffect(() => {
    if (products.length > 0) {
      const articleNums = [...new Set(products.map(p => p.article_number))];
      fetchEnrichments(articleNums);
    }
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared filter params (used by both products list and cascading filter options).
  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterMandant) params.set("mandant", filterMandant);
    if (filterProfitCenter) params.set("profit_center", filterProfitCenter);
    if (filterAssortment) params.set("assortment", filterAssortment);
    if (filterMainGroup) params.set("main_group", filterMainGroup);
    if (filterSubGroup) params.set("sub_group", filterSubGroup);
    if (filterProductGroup) params.set("product_group", filterProductGroup);
    if (filterStatus) params.set("status", filterStatus);
    return params;
  }, [filterMandant, filterProfitCenter, filterAssortment, filterMainGroup, filterSubGroup, filterProductGroup, filterStatus]);

  const fetchProducts = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the page loads once
    try {
      const params = filterParams();
      params.set("page", String(page + 1));
      params.set("per_page", "25");
      if (search) params.set("search", search);
      if (sortCol) { params.set("sort", sortCol); params.set("dir", sortDir); }
      const res = await fetch(`${API_URL}/api/products?${params}`);
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filterParams, page, search, sortCol, sortDir, sf.ready]);

  // Cascading filter options: each refetch reflects the currently-selected filters.
  const fetchFilters = useCallback(async () => {
    if (!sf.ready) return;
    try {
      const res = await fetch(`${API_URL}/api/products/filters?${filterParams()}`);
      setFilters(await res.json());
    } catch {
      setFilters(null);
    }
  }, [filterParams, sf.ready]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncTotalFetched(0);
    setSyncSynced(0);
    setSyncErrors(0);
    setSyncStartedAt(Date.now());
    setSyncStatus("Starting mirror...");

    try {
      const res = await fetch(`${API_URL}/api/products/sync`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || `Mirror failed (${res.status})`);
      }

      const poll = async () => {
        try {
          const statusRes = await fetch(`${API_URL}/api/products/sync/status`);
          const status = await statusRes.json();
          setSyncStatus(status.status || "Mirroring...");
          setSyncTotalFetched(status.total_fetched || 0);
          setSyncSynced(status.synced || 0);
          setSyncErrors(status.errors || 0);

          if (status.running) {
            setTimeout(poll, 1500);
          } else {
            setSyncing(false);
            setSyncStartedAt(null);
            if (status.status === "Complete") {
              setSyncResult(`Mirrored ${status.synced.toLocaleString()} products from HubSpot (${status.total_fetched.toLocaleString()} fetched, ${status.errors} errors)`);
            } else {
              setSyncResult(`Mirror finished: ${status.status}`);
            }
            fetchProducts();
            fetchFilters();
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 1500);
    } catch (err) {
      setSyncing(false);
      setSyncStartedAt(null);
      setSyncStatus("");
      setSyncResult(`Mirror failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Server-side streaming export — the browser downloads the .xlsx directly from
  // the backend (constant memory, no client-side build → no Out of Memory).
  function handleExport(mode: "filtered" | "all_no_pricing" | "all_with_pricing") {
    setExportOpen(false);
    const params = mode === "filtered" ? filterParams() : new URLSearchParams();
    if (mode === "filtered" && search) params.set("search", search);
    params.set("mode", mode);
    const url = `${API_URL}/api/products/export-stream?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSyncResult("Export started — your browser will download the Excel file shortly.");
  }

  async function handleDeleteAll() {
    setDeleting(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_URL}/api/products/all`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as Record<string, string>).error || `Delete failed (${res.status})`);
      setDeleteOpen(false);
      setSyncResult(`Deleted ${((data as { deleted?: number }).deleted ?? 0).toLocaleString()} products. Click "Mirror from HubSpot" to re-import everything.`);
      await fetchProducts();
      await fetchFilters();
    } catch (err) {
      setSyncResult(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  }

  // Editable fields, grouped for the edit dialog
  const EDIT_FIELDS: { key: keyof Product; label: string; group: string }[] = [
    { key: "description", label: "Description", group: "Details" },
    { key: "article_status", label: "Status", group: "Details" },
    { key: "profit_center", label: "Profit Center", group: "Details" },
    { key: "sales_unit", label: "Sales Unit", group: "Details" },
    { key: "stock_unit", label: "Stock Unit", group: "Details" },
    { key: "stock", label: "Stock", group: "Details" },
    { key: "listprice", label: "List CHF", group: "M100 / CHF" },
    { key: "bronze_price", label: "Bronze CHF", group: "M100 / CHF" },
    { key: "silver_price", label: "Silver CHF", group: "M100 / CHF" },
    { key: "gold_price", label: "Gold CHF", group: "M100 / CHF" },
    { key: "platinum_price", label: "Platinum CHF", group: "M100 / CHF" },
    { key: "listprice_m110", label: "List EUR", group: "M110 / EUR" },
    { key: "bronze_price_m110", label: "Bronze EUR", group: "M110 / EUR" },
    { key: "silver_price_m110", label: "Silver EUR", group: "M110 / EUR" },
    { key: "gold_price_m110", label: "Gold EUR", group: "M110 / EUR" },
    { key: "platinum_price_m110", label: "Platinum EUR", group: "M110 / EUR" },
  ];

  function openEdit(p: Product) {
    const f: Record<string, string> = {};
    for (const { key } of EDIT_FIELDS) {
      const v = p[key];
      f[key as string] = v == null ? "" : String(v);
    }
    setEditForm(f);
    setEditProduct(p);
  }

  async function saveEdit() {
    if (!editProduct) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${editProduct.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setProducts(prev => prev.map(x => (x.id === editProduct.id ? { ...x, ...data } : x)));
      setSyncResult(`Updated ${editProduct.article_number}.`);
      setEditProduct(null);
    } catch (err) {
      setSyncResult(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteProduct) return;
    setDeletingProduct(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${deleteProduct.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as Record<string, string>).error || "Delete failed"); }
      setProducts(prev => prev.filter(x => x.id !== deleteProduct.id));
      setTotal(t => Math.max(0, t - 1));
      setExpandedRow(null);
      setSyncResult(`Deleted ${deleteProduct.article_number}.`);
      setDeleteProduct(null);
    } catch (err) {
      setSyncResult(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingProduct(false);
    }
  }

  const cellMono = { fontSize: "0.72rem", fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" as const, color: "#274e64" };
  const cellText = { fontSize: "0.72rem", color: "#1f1f1f" };
  const cellSub = { fontSize: "0.72rem", color: "#5f6368" };
  const cellPrice = { fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 500, cursor: "pointer" };
  const grp = (num: string | null, desc: string | null) => (num ? `${num} — ${desc || ""}` : "—");

  // Single source of truth for the non-price columns — drives BOTH the header
  // and the body so the eye-icon hide/show works uniformly.
  const baseColumns: { id: string; label: string; align?: "right"; render: (p: Product) => React.ReactNode }[] = [
    { id: "profit_center", label: "Profit Center", render: (p) => <Typography sx={cellSub}>{p.profit_center || "—"}</Typography> },
    { id: "assortment_number", label: "Assortment", render: (p) => <Typography sx={{ ...cellText, whiteSpace: "nowrap" }}>{grp(p.assortment_number, p.assortment_description)}</Typography> },
    { id: "main_group_number", label: "Main Group", render: (p) => <Typography sx={{ ...cellText, whiteSpace: "nowrap" }}>{grp(p.main_group_number, p.main_group_description)}</Typography> },
    { id: "sub_group_number", label: "Sub Group", render: (p) => <Typography sx={{ ...cellText, whiteSpace: "nowrap" }}>{grp(p.sub_group_number, p.sub_group_description)}</Typography> },
    { id: "product_number", label: "Product Group", render: (p) => <Typography sx={{ ...cellText, whiteSpace: "nowrap" }}>{grp(p.product_number, p.product_description)}</Typography> },
    { id: "article_number", label: "Article Number", render: (p) => <Typography sx={cellMono}>{p.article_number}</Typography> },
    { id: "material_normalized", label: "Material", render: (p) => <Typography sx={cellText}>{p.material_normalized || p.material || "—"}</Typography> },
    { id: "article_status", label: "Status", render: (p) => <Typography sx={cellSub}>{p.article_status || "—"}</Typography> },
    { id: "stock", label: "Stock", align: "right", render: (p) => <Typography sx={{ ...cellText, fontWeight: 600 }}>{p.stock != null ? p.stock.toLocaleString() : "—"}</Typography> },
    { id: "mandant", label: "Mandant", render: (p) => <Chip label={p.mandant} size="small" sx={{ fontSize: "0.62rem", height: 20, bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600, whiteSpace: "nowrap" }} /> },
    { id: "sales_unit", label: "Sales Unit", render: (p) => <Typography sx={cellSub}>{p.sales_unit || p.unit || "—"}</Typography> },
    { id: "stock_unit", label: "Stock Unit", render: (p) => <Typography sx={cellSub}>{p.stock_unit || "—"}</Typography> },
    { id: "hubspot_id", label: "HubSpot ID", render: (p) => <Typography sx={{ ...cellMono, fontSize: "0.65rem", color: "#5f6368" }}>{p.hubspot_id || "—"}</Typography> },
  ];
  const visibleBase = baseColumns.filter((c) => !hiddenCols.has(c.id));
  const visiblePrices = PRICE_COLUMNS.filter((c) =>
    (priceMandant === "both" ? true : c.currency === (priceMandant === "M100" ? "CHF" : "EUR")) && !hiddenCols.has(c.key)
  );
  function toggleCol(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Server-side sort: changing the sort column/direction re-queries the FULL
  // dataset (not just the current page) via fetchProducts' deps, and jumps back
  // to page 1 so the user sees the true top of the sorted result.
  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  }

  function formatPrice(price: number | string | null, currency: string) {
    if (price == null || price === "") return "—";
    const num = typeof price === "string" ? parseFloat(price) : price;
    if (isNaN(num)) return "—";
    return `${currency} ${num.toFixed(2)}`;
  }

  return (
    <Box>
      <PageHeader
        icon="products"
        eyebrow="Pricing Intelligence"
        title="APSO Products"
        subtitle="Product catalog with pricing tiers"
        rightSlot={
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => setExportOpen(true)}
              sx={{ borderColor: "#1e7e45", color: "#1e7e45", "&:hover": { bgcolor: "#e8f5ee", borderColor: "#1e7e45" } }}
            >
              Export Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<DeleteOutlineIcon />}
              disabled={deleting || syncing}
              onClick={() => setDeleteOpen(true)}
              sx={{ borderColor: "#c5221f", color: "#c5221f", "&:hover": { bgcolor: "#fdecea", borderColor: "#c5221f" } }}
            >
              Delete all
            </Button>
            <Button variant="contained" startIcon={syncing ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SyncIcon />} disabled={syncing} onClick={handleSync}
              sx={{ bgcolor: "#ed1b2f", color: "#fff", boxShadow: "none",
                "&:hover": { bgcolor: "#c41527", boxShadow: "none" } }}>
              {syncing ? "Mirroring..." : "Mirror from HubSpot"}
            </Button>
          </Box>
        }
      />

      {syncing && (
        <Card sx={{ mb: 2, border: "1px solid #274e64", borderRadius: 3, overflow: "hidden" }}>
          <LinearProgress sx={{ height: 4, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
              <CircularProgress size={18} sx={{ color: "#274e64" }} />
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#1f1f1f" }}>Mirroring from HubSpot</Typography>
              {syncStartedAt !== null && (
                <Chip
                  label={`${Math.floor((Date.now() - syncStartedAt) / 1000)}s`}
                  size="small"
                  sx={{ ml: "auto", bgcolor: "#e8f0f4", color: "#274e64", fontFamily: "monospace", fontWeight: 600 }}
                />
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <Box>
                <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Fetched</Typography>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: "#274e64", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{syncTotalFetched.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Saved</Typography>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: "#34a853", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{syncSynced.toLocaleString()}</Typography>
              </Box>
              {syncErrors > 0 && (
                <Box>
                  <Typography sx={{ fontSize: "0.65rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Errors</Typography>
                  <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: "#ed1b2f", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{syncErrors.toLocaleString()}</Typography>
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 200, alignSelf: "flex-end" }}>
                <Typography sx={{ fontSize: "0.72rem", color: "#5f6368", textAlign: "right" }}>{syncStatus}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {syncResult && !syncing && (
        <Alert severity={syncResult.includes("failed") ? "error" : "success"} onClose={() => setSyncResult(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {syncResult}
        </Alert>
      )}

      {loading && !syncing && <LinearProgress sx={{ mb: 3 }} />}

      {/* Filter Bar */}
      {filters && (
        <FilterBar>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#5b6470", mr: 0.5 }}>Filters:</Typography>
          <SelectFilter label="Mandant" width={FW.mandant} value={filterMandant} options={filters.mandants.map(m => ({ value: m, label: m }))}
            onChange={(v) => { setFilterMandant(v); setFilterProfitCenter(""); setFilterAssortment(""); setFilterMainGroup(""); setFilterSubGroup(""); setFilterProductGroup(""); setPage(0); }} />
          <TextFilter label="Profit Center" value={filterProfitCenter} options={filters.profit_centers}
            onChange={(v) => { setFilterProfitCenter(v); setFilterAssortment(""); setFilterMainGroup(""); setFilterSubGroup(""); setFilterProductGroup(""); setPage(0); }} />
          <HierFilter label="Assortment" value={filterAssortment} options={filters.assortments}
            onChange={(n) => { setFilterAssortment(n); setFilterMainGroup(""); setFilterSubGroup(""); setFilterProductGroup(""); setPage(0); }} />
          <HierFilter label="Main Group" value={filterMainGroup} options={filters.main_groups}
            onChange={(n) => { setFilterMainGroup(n); setFilterSubGroup(""); setFilterProductGroup(""); setPage(0); }} />
          <HierFilter label="Sub Group" value={filterSubGroup} options={filters.sub_groups}
            onChange={(n) => { setFilterSubGroup(n); setFilterProductGroup(""); setPage(0); }} />
          <HierFilter label="Product Group" value={filterProductGroup} options={filters.product_groups}
            onChange={(n) => { setFilterProductGroup(n); setPage(0); }} />
          <TextFilter label="Status" width={FW.select} value={filterStatus} options={filters.statuses}
            onChange={(v) => { setFilterStatus(v); setPage(0); }} />
          <ClearFilters show={hasActiveFilter} onClick={clearAllFilters} />
        </FilterBar>
      )}

      {/* Products Table */}
      <Card sx={{ border: "1px solid #ececec", borderRadius: 4 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #ececec" }}>
            <TextField
              size="small"
              placeholder="Search articles, descriptions, materials..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "#5f6368" }} /></InputAdornment> } }}
              sx={{ flex: 1, maxWidth: 500 }}
            />
            <Chip label={`${total.toLocaleString()} total`} size="small" sx={{ fontWeight: 600, bgcolor: "#e8f0f4", color: "#274e64" }} />
            <DetailModeToggle mode={detailMode} onChange={setDetailMode} />
            {expandedSets.size > 0 && (
              <Button size="small" onClick={() => setExpandedSets(new Set())}
                sx={{ fontSize: "0.7rem", color: "#274e64", textTransform: "none", whiteSpace: "nowrap" }}>
                Collapse all scales
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {/* Price mandant filter: M100 (CHF) / M110 (EUR) / Both */}
            <ToggleButtonGroup
              size="small"
              exclusive
              value={priceMandant}
              onChange={(_, v) => { if (v) setPriceMandant(v); }}
              sx={{ "& .MuiToggleButton-root": { px: 1.4, py: 0.4, fontSize: "0.7rem", fontWeight: 700, color: "#5b6470", borderColor: "#d3d7dd", "&.Mui-selected": { bgcolor: "#ed1b2f", color: "#fff", "&:hover": { bgcolor: "#c41527" } } } }}
            >
              <ToggleButton value="M100">M100 CHF</ToggleButton>
              <ToggleButton value="M110">M110 EUR</ToggleButton>
              <ToggleButton value="both">Both</ToggleButton>
            </ToggleButtonGroup>
            {/* Eye icon — show/hide columns */}
            <Tooltip title="Show / hide columns">
              <IconButton size="small" onClick={(e) => setColMenuAnchor(e.currentTarget)} sx={{ color: hiddenCols.size > 0 ? "#274e64" : "#5b6470" }}>
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={colMenuAnchor} open={!!colMenuAnchor} onClose={() => setColMenuAnchor(null)}
              slotProps={{ paper: { sx: { maxHeight: 420 } } }}>
              <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9aa1ab" }}>Columns</Typography>
              {baseColumns.map((c) => (
                <MenuItem key={c.id} onClick={() => toggleCol(c.id)} dense>
                  <Checkbox edge="start" size="small" checked={!hiddenCols.has(c.id)} disableRipple sx={{ p: 0.5, mr: 1, "&.Mui-checked": { color: "#274e64" } }} />
                  <ListItemText primaryTypographyProps={{ fontSize: "0.82rem" }}>{c.label}</ListItemText>
                </MenuItem>
              ))}
              <Typography sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9aa1ab" }}>Price columns</Typography>
              {PRICE_COLUMNS.map((c) => (
                <MenuItem key={c.key} onClick={() => toggleCol(c.key)} dense>
                  <Checkbox edge="start" size="small" checked={!hiddenCols.has(c.key)} disableRipple sx={{ p: 0.5, mr: 1, "&.Mui-checked": { color: "#274e64" } }} />
                  <ListItemText primaryTypographyProps={{ fontSize: "0.82rem" }}>{c.label}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 2000 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8f9fa" }}>
                  <TableCell sx={{ width: 40, p: 0.5 }} />
                  {visibleBase.map((col) => (
                    <TableCell key={col.id} align={col.align} sx={{ fontWeight: 700, fontSize: "0.68rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", "&:hover .col-hide": { opacity: 1 } }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                        <TableSortLabel
                          active={sortCol === col.id}
                          direction={sortCol === col.id ? sortDir : "asc"}
                          onClick={() => handleSort(col.id)}
                          sx={{ "& .MuiTableSortLabel-icon": { fontSize: 14, opacity: 1 }, "&.Mui-active .MuiTableSortLabel-icon": { color: "#274e64" } }}
                        >
                          {col.label}
                        </TableSortLabel>
                        <Tooltip title="Hide column">
                          <IconButton className="col-hide" size="small" onClick={(e) => { e.stopPropagation(); toggleCol(col.id); }}
                            sx={{ p: 0.2, opacity: 0, transition: "opacity 0.15s", color: "#9aa1ab", "&:hover": { color: "#ed1b2f" } }}>
                            <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  ))}
                  {visiblePrices.map((ps) => {
                    const hasTiers = !!ps.scaleField;
                    const isOpen = hasTiers && expandedSets.has(ps.key);
                    return (
                      <React.Fragment key={ps.key}>
                        <TableCell align="right" onClick={hasTiers ? () => toggleSet(ps.key) : undefined}
                          sx={{ bgcolor: ps.bg, color: ps.color, fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: hasTiers ? "pointer" : "default",
                            borderLeft: isOpen ? `2px solid ${ps.color}` : undefined,
                            borderRight: isOpen ? "2px dashed" : undefined,
                            borderRightColor: isOpen ? ps.color : undefined,
                            "&:hover": hasTiers ? { bgcolor: ps.hoverBg || ps.bg, filter: "brightness(0.97)" } : undefined,
                            "&:hover .col-hide": { opacity: 1 } }}>
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3 }}>
                            {ps.label}
                            {hasTiers && (isOpen ? <KeyboardArrowUpIcon sx={{ fontSize: 14 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 14, opacity: 0.5 }} />)}
                            <Tooltip title="Hide column">
                              <IconButton className="col-hide" size="small" onClick={(e) => { e.stopPropagation(); toggleCol(ps.key); }}
                                sx={{ p: 0.2, opacity: 0, transition: "opacity 0.15s", color: ps.color, "&:hover": { color: "#ed1b2f" } }}>
                                <VisibilityOffOutlinedIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        {isOpen && Array.from({ length: 10 }, (_, i) => (
                          <TableCell key={`${ps.key}-t${i + 1}`} align="right"
                            sx={{ bgcolor: ps.tierBg, color: ps.color, fontWeight: 600, fontSize: "0.58rem", textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 70,
                              borderRight: i === 9 ? `2px dashed ${ps.color}` : undefined }}>
                            {ps.currency} t{i + 1}
                          </TableCell>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {products.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={100} align="center" sx={{ py: 6, color: "#5f6368" }}>
                      {total === 0 ? 'No products yet. Click "Mirror from HubSpot" to import.' : "No matching products."}
                    </TableCell>
                  </TableRow>
                )}
                {products.map((p, pi) => {
                  const isExpanded = expandedRow === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <TableRow hover sx={{ cursor: "pointer", bgcolor: isExpanded ? "#f0f7ff" : undefined,
                        "&:hover": { bgcolor: "#f8f9fa" },
                        "&:hover .exp-ic": { color: "#ed1b2f", animation: `${isExpanded ? "rowArrowBobUp" : "rowArrowBob"} 0.8s ease-in-out infinite` } }} onClick={() => setExpandedRow(isExpanded ? null : p.id)}>
                        <TableCell sx={{ p: 0.5, width: 36 }}>
                          <IconButton size="small" className="exp-ic" sx={{ color: isExpanded ? "#274e64" : "#9aa1ab", transition: "color 0.18s ease" }}>
                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        {visibleBase.map((col) => (
                          <TableCell key={col.id} align={col.align}>{col.render(p)}</TableCell>
                        ))}
                        {visiblePrices.map((ps) => {
                          const hasTiers = !!ps.scaleField;
                          const isOpen = hasTiers && expandedSets.has(ps.key);
                          const base = p[ps.field] as number | null;
                          const tiers = ps.scaleField ? (p[ps.scaleField] as { tier: number; qty: number | null; list: number | null }[] | null) : null;
                          return (
                            <React.Fragment key={`${p.id}-${ps.key}`}>
                              <TableCell align="right"
                                sx={{ bgcolor: ps.bg,
                                  borderLeft: isOpen ? `2px solid ${ps.color}` : undefined,
                                  borderRight: isOpen ? `2px dashed ${ps.color}` : undefined }}>
                                <Typography sx={{ ...cellPrice, color: ps.color, fontWeight: 700 }}>
                                  {formatPrice(base, ps.currency)}
                                </Typography>
                              </TableCell>
                              {isOpen && Array.from({ length: 10 }, (_, i) => {
                                const tier = tiers?.find(s => s.tier === i + 1);
                                return (
                                  <TableCell key={`${p.id}-${ps.key}-t${i + 1}`} align="right"
                                    sx={{ bgcolor: ps.tierBg, minWidth: 70,
                                      borderRight: i === 9 ? `2px dashed ${ps.color}` : undefined }}>
                                    {tier ? (
                                      <Box>
                                        <Typography sx={{ fontSize: "0.58rem", color: "#5f6368" }}>qty: {tier.qty ?? "—"}</Typography>
                                        <Typography sx={{ ...cellPrice, color: ps.color, fontSize: "0.68rem" }}>{formatPrice(tier.list, ps.currency)}</Typography>
                                      </Box>
                                    ) : (
                                      <Typography sx={{ ...cellSub, fontSize: "0.6rem" }}>—</Typography>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                      {/* Row detail: pop-up or in-row drop-down (per-user switch) */}
                      <RowDetail mode={detailMode} open={isExpanded} onClose={() => setExpandedRow(null)} colSpan={100}
                        title={p.article_number} subtitle={p.description || p.product_description || undefined}
                        onPrev={pi > 0 ? () => setExpandedRow(products[pi - 1].id) : undefined}
                        onNext={pi < products.length - 1 ? () => setExpandedRow(products[pi + 1].id) : undefined}>
                            <Box sx={{ p: 3, bgcolor: "#f8f9fb" }}>
                              {/* Header */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                                {/* The pop-up already names the article in its title bar — only the in-row view repeats it. */}
                                {detailMode === "inline" && <Box sx={{ width: 4, height: 24, borderRadius: 0.5, bgcolor: "#274e64" }} />}
                                <Box sx={{ flex: 1 }}>
                                  {detailMode === "inline" && <>
                                    <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1rem", fontWeight: 600, color: "#1f1f1f" }}>
                                      {p.article_number}
                                    </Typography>
                                    <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                                      {p.description || p.product_description || "No description"}
                                    </Typography>
                                  </>}
                                </Box>
                                <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                                  sx={{ borderColor: "#274e64", color: "#274e64", "&:hover": { bgcolor: "#eef2f5", borderColor: "#274e64" } }}>Edit</Button>
                                <Button size="small" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={(e) => { e.stopPropagation(); setDeleteProduct(p); }}
                                  sx={{ borderColor: "#c5221f", color: "#c5221f", "&:hover": { bgcolor: "#fdecea", borderColor: "#c5221f" } }}>Delete</Button>
                              </Box>

                              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr 1fr" }, gap: 2, alignItems: "start" }}>
                                {/* Product Info Card */}
                                <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #ececec" }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Product Info</Typography>
                                    {[
                                      ["Article", p.article_number],
                                      ["Description", p.description],
                                      ["Product No.", p.product_number],
                                      ["Material", p.material || p.material_normalized],
                                      ["AP Compound", p.ap_compound],
                                      ["Supplier Compound", p.supplier_compound],
                                      ["Hardness", p.hardness],
                                      ["Type", p.product_type || p.product_type_normalized],
                                      ["Color", p.color || p.color_normalized],
                                      ["Diameter", p.diameter],
                                      ["Conformities", p.conformities],
                                      ["Country", p.country_of_origin],
                                      ["Tarifs No.", p.tarifs_number],
                                    ].map(([l, v]) => (
                                      <Box key={String(l)} sx={{ display: "flex", justifyContent: "space-between", py: 0.4, borderBottom: "1px solid #f5f5f5" }}>
                                        <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>{l}</Typography>
                                        <Typography sx={{ fontSize: "0.7rem", color: "#1f1f1f", fontWeight: 500, textAlign: "right", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v ?? "—"}</Typography>
                                      </Box>
                                    ))}
                                  </CardContent>
                                </Card>

                                {/* Hierarchy Card */}
                                <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #ececec" }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Hierarchy & Business</Typography>
                                    {[
                                      ["Profit Center", p.profit_center],
                                      ["Assortment", p.assortment_number ? `${p.assortment_number} — ${p.assortment_description || ""}` : null],
                                      ["Main Group", p.main_group_number ? `${p.main_group_number} — ${p.main_group_description || ""}` : null],
                                      ["Sub Group", p.sub_group_number ? `${p.sub_group_number} — ${p.sub_group_description || ""}` : null],
                                      ["Product Group", p.product_number ? `${p.product_number} — ${p.product_description || ""}` : null],
                                      ["Mandant", p.mandant],
                                      ["Sales Unit", p.sales_unit || p.unit],
                                      ["Stock Unit", p.stock_unit],
                                      ["Stock", p.stock],
                                      ["MOQ", p.moq],
                                      ["Budget Class", p.budget_class],
                                      ["Status", p.article_status],
                                      ["HubSpot ID", p.hubspot_id],
                                    ].map(([l, v]) => (
                                      <Box key={String(l)} sx={{ display: "flex", justifyContent: "space-between", py: 0.4, borderBottom: "1px solid #f5f5f5" }}>
                                        <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>{l}</Typography>
                                        <Typography sx={{ fontSize: "0.7rem", color: "#1f1f1f", fontWeight: 500, textAlign: "right" }}>{v ?? "—"}</Typography>
                                      </Box>
                                    ))}
                                  </CardContent>
                                </Card>

                                {/* Price Sets Card */}
                                <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #ececec" }}>
                                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#274e64", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Price Sets — M100 (CHF) / M110 (EUR)</Typography>
                                    {[
                                      { label: "GWstDP", chf: p.gdwst_price, eur: null as number | null, color: "#2e7d32", bg: "#e8f5e9" },
                                      { label: "List", chf: p.listprice, eur: p.listprice_m110, color: "#1f1f1f", bg: "#f8f9fa" },
                                      { label: "Bronze", chf: p.bronze_price, eur: p.bronze_price_m110, color: "#b8860b", bg: "#fdf6e3" },
                                      { label: "Silver", chf: p.silver_price, eur: p.silver_price_m110, color: "#6b7280", bg: "#f0f0f0" },
                                      { label: "Gold", chf: p.gold_price, eur: p.gold_price_m110, color: "#d4a017", bg: "#fef9e7" },
                                      { label: "Platinum", chf: p.platinum_price, eur: p.platinum_price_m110, color: "#6d28d9", bg: "#f3f0ff" },
                                    ].map((t) => (
                                      <Box key={t.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, px: 1, borderRadius: 1, bgcolor: t.bg, mb: 0.5 }}>
                                        <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: t.color }}>{t.label}</Typography>
                                        <Box sx={{ textAlign: "right" }}>
                                          <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: t.color }}>
                                            {formatPrice(t.chf, "CHF")}
                                          </Typography>
                                          <Typography sx={{ fontSize: "0.62rem", fontFamily: "monospace", color: "#5f6368" }}>
                                            {formatPrice(t.eur, "EUR")}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    ))}
                                  </CardContent>
                                </Card>

                                {/* Matching Criteria Card — dynamic from scraped data */}
                                {(() => {
                                  const e = enrichments[p.article_number];
                                  const dims = e?.dimensions_json || {};
                                  const dimEntries = Object.entries(dims);
                                  const hasEnrichment = !!e;

                                  // Build criteria: HubSpot fields + scraped dimensions
                                  const criteria: { label: string; value: string | null; source: "hubspot" | "scraped"; match: string; weight: string }[] = [
                                    { label: "Material", value: e?.lib_material || p.material_normalized || p.material, source: e?.lib_material ? "scraped" : "hubspot", match: "exact", weight: "30%" },
                                    { label: "Compound", value: e?.compound_ref || p.ap_compound, source: e?.compound_ref ? "scraped" : "hubspot", match: "keyword", weight: "10%" },
                                    { label: "Product Type", value: p.product_type_normalized || p.product_type, source: "hubspot", match: "exact", weight: "15%" },
                                    { label: "Color", value: e?.lib_color || p.color_normalized || p.color, source: e?.lib_color ? "scraped" : "hubspot", match: "exact", weight: "5%" },
                                    { label: "Hardness", value: e?.lib_hardness || p.hardness, source: e?.lib_hardness ? "scraped" : "hubspot", match: "±5", weight: "5%" },
                                    { label: "Conformity", value: e?.lib_conformity || p.conformities, source: e?.lib_conformity ? "scraped" : "hubspot", match: "contains", weight: "5%" },
                                    { label: "Standard", value: e?.lib_standard || null, source: "scraped", match: "exact", weight: "5%" },
                                    { label: "Temp Range", value: e?.temp_range || null, source: "scraped", match: "range", weight: "—" },
                                  ];

                                  // Add all scraped dimensions as criteria
                                  dimEntries.forEach(([key, val]) => {
                                    criteria.push({ label: key, value: val, source: "scraped", match: "±5%", weight: "dim" });
                                  });

                                  // If no scraped dims, add HubSpot diameter as fallback
                                  if (dimEntries.length === 0 && p.diameter) {
                                    criteria.push({ label: "Diameter", value: `${p.diameter} mm`, source: "hubspot", match: "±5%", weight: "25%" });
                                  }

                                  return (
                                    <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #e0e7ff", bgcolor: "#fafbff" }}>
                                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                                          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#4285f4", textTransform: "uppercase", letterSpacing: "0.05em" }}>Matching Criteria</Typography>
                                          {hasEnrichment && (
                                            <Chip label="Enriched" size="small" sx={{ height: 18, fontSize: "0.5rem", fontWeight: 700, bgcolor: "#e8f5e9", color: "#2e7d32" }} />
                                          )}
                                          {!hasEnrichment && (
                                            <Chip label="HubSpot only" size="small" sx={{ height: 18, fontSize: "0.5rem", fontWeight: 600, bgcolor: "#fef7e0", color: "#854d0e" }} />
                                          )}
                                        </Box>
                                        <Typography sx={{ fontSize: "0.62rem", color: "#5f6368", mb: 1 }}>
                                          {p.product_type_normalized || p.product_type || "unknown"} — {dimEntries.length} dimensions scraped
                                          {e?.category_path && <> — <em>{e.category_path}</em></>}
                                        </Typography>

                                        {/* Image from scraper */}
                                        {e?.image_url && (
                                          <Box component="img" src={e.image_url} sx={{ width: "100%", maxHeight: 80, objectFit: "contain", borderRadius: 1, border: "1px solid #ececec", mb: 1, bgcolor: "#fff" }} />
                                        )}

                                        {criteria.map((c, idx) => (
                                          <Box key={`${c.label}-${idx}`} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.35, borderBottom: "1px solid #f0f2ff" }}>
                                            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: c.value ? "#34a853" : "#dadce0", flexShrink: 0 }} />
                                            <Typography sx={{ fontSize: "0.63rem", color: "#5f6368", minWidth: 80 }}>{c.label}</Typography>
                                            <Chip
                                              label={c.source === "scraped" ? "web" : "hs"}
                                              size="small"
                                              sx={{ height: 14, fontSize: "0.45rem", fontWeight: 700, bgcolor: c.source === "scraped" ? "#e8f5e9" : "#e8f0fe", color: c.source === "scraped" ? "#2e7d32" : "#1a73e8", minWidth: 24 }}
                                            />
                                            <Chip label={c.match} size="small" sx={{ height: 14, fontSize: "0.45rem", fontWeight: 600, bgcolor: "#f0f2ff", color: "#5f6368" }} />
                                            {c.weight !== "dim" && c.weight !== "—" && (
                                              <Chip label={c.weight} size="small" sx={{ height: 14, fontSize: "0.45rem", fontWeight: 600, bgcolor: "#fef7e0", color: "#854d0e" }} />
                                            )}
                                            <Typography sx={{ fontSize: "0.6rem", color: c.value ? "#1f1f1f" : "#dadce0", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {c.value || "—"}
                                            </Typography>
                                          </Box>
                                        ))}
                                      </CardContent>
                                    </Card>
                                  );
                                })()}

                                {/* Shop Enrichment Card — scraped from apsoparts.com */}
                                {(() => {
                                  const e = enrichments[p.article_number];
                                  const dims = e?.dimensions_json || {};
                                  const dimEntries = Object.entries(dims);
                                  const mm: [string, number | null][] = e ? [
                                    ["Inner Ø", e.inner_diameter_mm], ["Outer Ø", e.outer_diameter_mm], ["Cord Ø", e.cord_diameter_mm],
                                    ["Diameter", e.diameter_mm], ["Thickness", e.thickness_mm], ["Width", e.width_mm], ["Length", e.length_mm],
                                  ] : [];
                                  const fields: [string, string | null | undefined][] = e ? [
                                    ["Product Name", e.product_name], ["Material", e.lib_material], ["Compound", e.compound_ref],
                                    ["Hardness", e.lib_hardness], ["Temp Range", e.temp_range], ["Color", e.lib_color],
                                    ["Conformity", e.lib_conformity], ["Standard", e.lib_standard], ["AS/BS No.", e.as_bs_number],
                                    ["Category", e.category_path], ["Parent SKU", e.parent_sku],
                                  ] : [];
                                  return (
                                    <Card variant="outlined" sx={{ borderRadius: 3, border: "1px solid #d6ead9", bgcolor: "#f6fbf7" }}>
                                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1e7e45", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shop Enrichment</Typography>
                                          <Chip label={e ? "apsoparts.com" : "not scraped"} size="small" sx={{ height: 18, fontSize: "0.5rem", fontWeight: 700, bgcolor: e ? "#e8f5ee" : "#eef0f3", color: e ? "#1e7e45" : "#9aa1ab" }} />
                                        </Box>
                                        {!e && <Typography sx={{ fontSize: "0.72rem", color: "#9aa1ab" }}>No shop data scraped for this article yet. Run the APSOparts Scraper to enrich it.</Typography>}
                                        {e?.image_url && (
                                          <Box component="img" src={e.image_url} sx={{ width: "100%", maxHeight: 90, objectFit: "contain", borderRadius: 1, border: "1px solid #ececec", mb: 1, bgcolor: "#fff" }} />
                                        )}
                                        {fields.filter(([, v]) => v).map(([l, v]) => (
                                          <Box key={l} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.4, borderBottom: "1px solid #eef3ef" }}>
                                            <Typography sx={{ fontSize: "0.68rem", color: "#5f6368", flexShrink: 0 }}>{l}</Typography>
                                            <Typography sx={{ fontSize: "0.68rem", color: "#1f1f1f", fontWeight: 500, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{v}</Typography>
                                          </Box>
                                        ))}
                                        {mm.filter(([, v]) => v != null).length > 0 && (
                                          <>
                                            <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#1e7e45", textTransform: "uppercase", mt: 1, mb: 0.5 }}>Scraped dimensions (mm)</Typography>
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                              {mm.filter(([, v]) => v != null).map(([l, v]) => (
                                                <Chip key={l} label={`${l}: ${v}`} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 600, bgcolor: "#eef2f5", color: "#274e64" }} />
                                              ))}
                                            </Box>
                                          </>
                                        )}
                                        {dimEntries.length > 0 && (
                                          <>
                                            <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#1e7e45", textTransform: "uppercase", mt: 1, mb: 0.5 }}>All scraped specs</Typography>
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                              {dimEntries.map(([k, v]) => (
                                                <Chip key={k} label={`${k}: ${v}`} size="small" sx={{ height: 18, fontSize: "0.52rem", fontWeight: 500, bgcolor: "#f0fdf4", color: "#15803d" }} />
                                              ))}
                                            </Box>
                                          </>
                                        )}
                                      </CardContent>
                                    </Card>
                                  );
                                })()}
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

      {/* Export Dialog — 3 server-streamed options */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "#fff" }}>Export to Excel</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", mt: 0.3 }}>
            Streamed from the server — works for the full catalog
          </Typography>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          {[
            { mode: "filtered" as const, icon: <FilterAltIcon sx={{ color: "#274e64", fontSize: 24 }} />, bg: "#e8f0f4", title: "Export filtered view", desc: (hasActiveFilter || search)
              ? "Only the rows matching your current filters · with M100 + M110 pricing"
              : "No filters set — exports the whole catalog · with M100 + M110 pricing" },
            { mode: "all_no_pricing" as const, icon: <DescriptionIcon sx={{ color: "#5b6470", fontSize: 24 }} />, bg: "#eef0f3", title: "Export all data — without pricing", desc: `Full catalog (${total.toLocaleString()} articles), no price columns` },
            { mode: "all_with_pricing" as const, icon: <DescriptionIcon sx={{ color: "#1e7e45", fontSize: 24 }} />, bg: "#e8f5ee", title: "Export all data — with pricing", desc: `Full catalog (${total.toLocaleString()} articles) with M100 (CHF) + M110 (EUR) price sets` },
          ].map((opt) => (
            <Box
              key={opt.mode}
              onClick={() => handleExport(opt.mode)}
              sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5, borderBottom: "1px solid #f0f1f3", cursor: "pointer", "&:hover": { bgcolor: "#f7f8fa" } }}
            >
              <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{opt.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f1f1f" }}>{opt.title}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: "#5b6470" }}>{opt.desc}</Typography>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setExportOpen(false)} sx={{ color: "#5f6368" }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Delete-all confirm Dialog */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 1, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#c5221f", px: 3, py: 2.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.15rem", fontWeight: 600, color: "#fff" }}>Delete all products?</Typography>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "0.85rem", color: "#1f1f1f", mb: 1 }}>
            This removes all <strong>{total.toLocaleString()}</strong> products from the Pricing Hub database.
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: "#5b6470" }}>
            Use this to re-mirror from scratch: delete, then click <strong>Mirror from HubSpot</strong> to re-import everything with the new model. This does not touch HubSpot.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button onClick={handleDeleteAll} disabled={deleting} variant="contained"
            startIcon={deleting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <DeleteOutlineIcon />}
            sx={{ bgcolor: "#c5221f", color: "#fff", boxShadow: "none", "&:hover": { bgcolor: "#9e1b18", boxShadow: "none" } }}>
            {deleting ? "Deleting..." : "Delete all"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit product Dialog */}
      <Dialog open={!!editProduct} onClose={() => !savingEdit && setEditProduct(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#274e64", px: 3, py: 2 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>Edit product</Typography>
          {editProduct && <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{editProduct.article_number}</Typography>}
        </Box>
        <DialogContent sx={{ p: 3 }}>
          {["Details", "M100 / CHF", "M110 / EUR"].map(group => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9aa1ab", mb: 1 }}>{group}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
                {EDIT_FIELDS.filter(f => f.group === group).map(f => (
                  <TextField key={f.key as string} label={f.label} size="small" value={editForm[f.key as string] ?? ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [f.key as string]: e.target.value }))}
                    multiline={f.key === "description"} />
                ))}
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setEditProduct(null)} disabled={savingEdit} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button onClick={saveEdit} disabled={savingEdit} variant="contained"
            startIcon={savingEdit ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <EditOutlinedIcon />}
            sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#1a3a4c" }, boxShadow: "none" }}>
            {savingEdit ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete single product confirm */}
      <Dialog open={!!deleteProduct} onClose={() => !deletingProduct && setDeleteProduct(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 1, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#c5221f", px: 3, py: 2 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>Delete this product?</Typography>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "0.85rem", color: "#1f1f1f" }}>
            Remove <strong style={{ fontFamily: "monospace" }}>{deleteProduct?.article_number}</strong> from the Pricing Hub database? This also removes its competitor matches. (Does not touch HubSpot.)
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#f8f9fa", borderTop: "1px solid #ececec" }}>
          <Button onClick={() => setDeleteProduct(null)} disabled={deletingProduct} sx={{ color: "#5f6368" }}>Cancel</Button>
          <Button onClick={handleDeleteProduct} disabled={deletingProduct} variant="contained"
            startIcon={deletingProduct ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <DeleteOutlineIcon />}
            sx={{ bgcolor: "#c5221f", color: "#fff", boxShadow: "none", "&:hover": { bgcolor: "#9e1b18", boxShadow: "none" } }}>
            {deletingProduct ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
