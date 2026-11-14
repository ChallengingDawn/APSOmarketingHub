"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InventoryIcon from "@mui/icons-material/Inventory2";
import VerifiedIcon from "@mui/icons-material/Verified";
import PageHeader from "../../PageHeader";
import { useSavedFilters } from "@/lib/pricing/prefs";
import { FreshnessStrip } from "../MatchShared";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface Competitor { id: number; code: string; name: string }

interface UnmatchedCompetitorProduct {
  id: number;
  external_ref: string;
  product_name: string;
  material_normalized: string | null;
  material_raw: string | null;
  product_type: string | null;
  color_normalized: string | null;
  diameter: string | null;
  inner_diameter_mm: string | null;
  cord_diameter_mm: string | null;
  outer_diameter_mm: string | null;
  length: string | null;
  thickness: string | null;
  width: string | null;
  hardness: string | null;
  unit: string | null;
  in_stock: boolean | null;
  lead_time_days: number | null;
  stock_raw: string | null;
  source_url: string | null;
  certifications: string | null;
  price_tiers: { tier: number; price: string }[] | null;
  competitor_code: string;
  competitor_name: string;
  market: string;
  business_unit: string;
  currency: string;
  list_price: string | null;
}

// Split a free-text certifications string ("FDA, EC1935/2004, NSF 61") into chips.
function certList(s: string | null): string[] {
  if (!s) return [];
  return s.split(/[,;|]+/).map(x => x.trim()).filter(Boolean).slice(0, 6);
}
// Full competitor dimension spec line (every populated dimension, compact).
function specLine(p: UnmatchedCompetitorProduct): string {
  const f = (n: string | null) => (n == null || n === "" ? null : Number(n).toFixed(2).replace(/\.00$/, ""));
  const parts: string[] = [];
  const id = f(p.inner_diameter_mm), cord = f(p.cord_diameter_mm), od = f(p.outer_diameter_mm);
  const dia = f(p.diameter), len = f(p.length), thk = f(p.thickness), wid = f(p.width);
  if (id) parts.push(`ID ${id}`);
  if (cord) parts.push(`cord ${cord}`);
  if (dia && !id) parts.push(`Ø ${dia}`);
  if (od) parts.push(`OD ${od}`);
  if (thk) parts.push(`t ${thk}`);
  if (wid) parts.push(`w ${wid}`);
  if (len) parts.push(`L ${len}`);
  if (p.hardness) parts.push(`${p.hardness}`);
  if (p.color_normalized) parts.push(p.color_normalized);
  return parts.join(" · ") || "—";
}

interface ApsoCandidate {
  id: number;
  article_number: string;
  description: string;
  product_description: string | null;
  material_normalized: string | null;
  product_type_normalized: string | null;
  diameter: number | null;
  mandant: string;
  profit_center: string | null;
  currency: string;
  listprice: string | null;
  sub_group_number: string | null;
  sub_group_description: string | null;
}

export default function UnmatchedPage() {
  const [items, setItems] = useState<UnmatchedCompetitorProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  // Filters are saved per user and stay until "Clear".
  const sf = useSavedFilters("matches-unmatched", { search: "", competitor: "", market: "", bu: "" });
  const search = sf.f.search, filterCompetitor = sf.f.competitor, filterMarket = sf.f.market, filterBU = sf.f.bu;
  const setSearch = (v: string) => sf.set("search", v);
  const setFilterCompetitor = (v: string) => sf.set("competitor", v);
  const setFilterMarket = (v: string) => sf.set("market", v);
  const setFilterBU = (v: string) => sf.set("bu", v);
  const [userName, setUserName] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ msg: string; error: boolean } | null>(null);
  const [userEmail, setUserEmail] = useState("");

  // Manual link dialog — pick an APSO product for the selected competitor row
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; comp: UnmatchedCompetitorProduct | null }>({ open: false, comp: null });
  const [linkSearch, setLinkSearch] = useState("");
  const [linkMandant, setLinkMandant] = useState<"" | "M100" | "M110">("");
  const [apsoCandidates, setApsoCandidates] = useState<ApsoCandidate[]>([]);
  const [suggestions, setSuggestions] = useState<ApsoCandidate[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    // The logged-in platform user is the one who links (no manual entry needed).
    fetch(`/api/auth/me`).then(r => (r.ok ? r.json() : null)).then((d) => {
      if (d?.user) { setUserEmail(d.user.email || ""); setUserName(d.user.full_name || d.user.username || ""); }
      else if (typeof window !== "undefined") setUserEmail(localStorage.getItem("apso_user_email") || "");
    }).catch(() => { if (typeof window !== "undefined") setUserEmail(localStorage.getItem("apso_user_email") || ""); });
    fetch(`${API_URL}/api/competitors`).then(r => r.json()).then(setCompetitors).catch(() => {});
  }, []);

  const fetchUnmatched = useCallback(async () => {
    if (!sf.ready) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page + 1), per_page: "25" });
      if (search) p.set("search", search);
      if (filterCompetitor) p.set("competitor_id", filterCompetitor);
      if (filterMarket) p.set("market", filterMarket);
      if (filterBU) p.set("business_unit", filterBU);
      const res = await fetch(`${API_URL}/api/matches/unmatched-competitors?${p}`);
      const data = await res.json();
      setItems(data.data || []);
      setTotal(data.total || 0);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [sf.ready, page, search, filterCompetitor, filterMarket, filterBU]);

  useEffect(() => { fetchUnmatched(); }, [fetchUnmatched]);

  function saveEmail(email: string) {
    setUserEmail(email);
    if (typeof window !== "undefined") localStorage.setItem("apso_user_email", email);
  }

  function openLinkDialog(comp: UnmatchedCompetitorProduct) {
    setLinkSearch("");
    setApsoCandidates([]);
    setSuggestions([]);
    // Default the mandant to match the competitor's market (CH → M100, DE → M110, EU → both)
    const defaultMandant: "" | "M100" | "M110" =
      comp.market === "CH" ? "M100" : comp.market === "DE" ? "M110" : "";
    setLinkMandant(defaultMandant);
    setLinkDialog({ open: true, comp });
    // Fetch ranked suggestions (material family + same form + nearest dimension).
    setSuggesting(true);
    fetch(`${API_URL}/api/matches/suggest-apso?competitor_product_id=${comp.id}`)
      .then(r => r.json())
      .then(d => setSuggestions(d.data || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggesting(false));
    // The debounced effect will fire once linkDialog.comp is set and run the auto-seeded
    // search (material filter, no search text yet).
  }

  const runApsoSearch = useCallback(async (opts: { search: string; material: string; mandant: string }) => {
    setSearching(true);
    try {
      const p = new URLSearchParams();
      if (opts.search) p.set("search", opts.search);
      // Only apply material filter when the user hasn't typed an explicit search.
      // If they search "pom-" while the competitor row is ABS, they clearly want to
      // override the auto-seeded material filter.
      if (opts.material && !opts.search) p.set("material", opts.material);
      if (opts.mandant) p.set("mandant", opts.mandant);
      const res = await fetch(`${API_URL}/api/matches/search-apso-products?${p}`);
      const data = await res.json();
      setApsoCandidates(data.data || []);
    } catch { setApsoCandidates([]); }
    finally { setSearching(false); }
  }, []);

  // Search-as-you-type: debounce the APSO candidate query 300ms so typing "pom"
  // doesn't hammer the backend but the result list updates live.
  useEffect(() => {
    if (!linkDialog.open || !linkDialog.comp) return;
    const handle = setTimeout(() => {
      runApsoSearch({
        search: linkSearch.trim(),
        material: linkDialog.comp?.material_normalized || "",
        mandant: linkMandant,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [linkSearch, linkMandant, linkDialog.open, linkDialog.comp, runApsoSearch]);

  async function handleLink(apso: ApsoCandidate) {
    if (!linkDialog.comp) return;
    setLinking(true);
    try {
      const res = await fetch(`${API_URL}/api/matches/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apso_product_id: apso.id,
          competitor_product_id: linkDialog.comp.id,
          approved_by: userEmail || null,
          user_name: userName || null,
        }),
      });
      if (!res.ok) throw new Error("Link failed");
      setResult({ msg: `Linked ${linkDialog.comp.competitor_name} ${linkDialog.comp.external_ref} ↔ APSO ${apso.article_number}`, error: false });
      setLinkDialog({ open: false, comp: null });
      fetchUnmatched();
    } catch {
      setResult({ msg: "Failed to create manual link", error: true });
    } finally {
      setLinking(false);
    }
  }

  const apsoRow = (a: ApsoCandidate, highlight = false) => (
    <Box key={a.id} sx={{ p: 1.5, borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: 1.5,
      bgcolor: highlight ? "#f1f8f4" : "transparent", "&:hover": { bgcolor: highlight ? "#e8f5e9" : "#fafbfc" } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.3 }}>
          <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 700, color: "#274e64" }}>{a.article_number}</Typography>
          <Chip label={a.mandant} size="small" sx={{ fontSize: "0.55rem", height: 18, bgcolor: a.mandant === "M100" ? "#e8f0f4" : "#fef7e0", color: a.mandant === "M100" ? "#274e64" : "#854d0e" }} />
          <Chip label={(a.material_normalized || "—").toUpperCase()} size="small" sx={{ fontSize: "0.55rem", height: 18 }} />
          {a.product_type_normalized && <Chip label={a.product_type_normalized} size="small" sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#e8f0f4", color: "#274e64" }} />}
          {a.profit_center && <Chip label={a.profit_center} size="small" sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#fef2f2", color: "#c62828" }} />}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: "#15223a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</Typography>
        <Typography sx={{ fontSize: "0.65rem", color: "#5d6b85" }}>
          {a.listprice ? `${a.currency} ${Number(a.listprice).toFixed(2)}` : "no list price"}
          {a.sub_group_number && <> · SG {a.sub_group_number}</>}
        </Typography>
      </Box>
      <IconButton size="small" onClick={() => handleLink(a)} disabled={linking}
        sx={{ color: "#2e7d32", border: "1px solid #2e7d32", borderRadius: 2, "&:hover": { bgcolor: "#e8f5e9" } }}>
        <CheckCircleIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        icon="unmatched"
        eyebrow="Product Matching"
        title="Unmatched Competitor Products"
        subtitle="Competitor rows with no APSO match — pick one and link it to an APSO article"
        rightSlot={
          <Button component={Link} href="/pricing/matches" variant="outlined"
            sx={{ fontSize: "0.75rem", borderColor: "#c8463a", color: "#c8463a", fontWeight: 600,
              "&:hover": { borderColor: "#a8372c", color: "#a8372c", bgcolor: "#fff5f5" } }}>
            Match Overview
          </Button>
        }
      />

      <FreshnessStrip competitorIds={filterCompetitor ? [filterCompetitor] : undefined} />

      {result && <Alert severity={result.error ? "error" : "success"} onClose={() => setResult(null)} sx={{ mb: 2 }}>{result.msg}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <TextField size="small" placeholder="Search product name / ref..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ width: 260 }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Competitor</InputLabel>
              <Select value={filterCompetitor} label="Competitor"
                onChange={(e) => { setFilterCompetitor(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {competitors.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Market</InputLabel>
              <Select value={filterMarket} label="Market" onChange={(e) => { setFilterMarket(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="CH">CH</MenuItem>
                <MenuItem value="DE">DE</MenuItem>
                <MenuItem value="EU">EU</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Business Unit</InputLabel>
              <Select value={filterBU} label="Business Unit" onChange={(e) => { setFilterBU(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="KT">KT (Plastics)</MenuItem>
                <MenuItem value="DT">DT (Sealings)</MenuItem>
              </Select>
            </FormControl>
            {(search || filterCompetitor || filterMarket || filterBU) && (
              <Button size="small" onClick={() => { sf.reset(); setPage(0); }}
                sx={{ color: "#c8463a", fontSize: 12, fontWeight: 600 }}>Clear all</Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Chip label={`${total.toLocaleString()} unmatched`} size="small"
              sx={{ fontWeight: 600, bgcolor: "#fff3e0", color: "#e65100" }} />
          </Box>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 1, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#c8463a" } }} />}

      {/* Table */}
      <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: "72vh" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f5f7fb" }}>
                  {["Competitor", "Ref", "Competitor Article", "Material", "Type", "Specifications", "Certs / Stock", "Price (qty 1)", "Action"].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.7rem", color: "#5d6b85", textTransform: "uppercase" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: "#5d6b85" }}>
                    No unmatched competitor products in this filter — full coverage!
                  </TableCell></TableRow>
                )}
                {items.map(p => {
                  const certs = certList(p.certifications);
                  const tiers = p.price_tiers || [];
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Chip label={p.competitor_name} size="small"
                          sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#fef7e0", color: "#854d0e", fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                          <Typography sx={{ fontSize: "0.7rem", fontFamily: "monospace", color: "#5d6b85" }}>{p.external_ref}</Typography>
                          {p.source_url && (
                            <Tooltip title="Open competitor product page">
                              <IconButton size="small" component="a" href={p.source_url} target="_blank" rel="noopener noreferrer"
                                sx={{ p: 0.2, color: "#1565c0" }}><OpenInNewIcon sx={{ fontSize: 13 }} /></IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={p.material_raw || p.product_name}>
                          <Typography sx={{ fontSize: "0.72rem", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_name}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell><Chip label={(p.material_normalized || "—").toUpperCase()} size="small" sx={{ fontSize: "0.55rem", height: 18 }} /></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.68rem", color: "#5d6b85" }}>{p.product_type || "—"}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#15223a", whiteSpace: "nowrap" }}>{specLine(p)}</Typography></TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3, alignItems: "center", maxWidth: 190 }}>
                          {certs.map(cert => (
                            <Chip key={cert} icon={<VerifiedIcon sx={{ fontSize: "10px !important" }} />} label={cert} size="small"
                              sx={{ fontSize: "0.5rem", height: 16, bgcolor: "#e8f5e9", color: "#2e7d32", "& .MuiChip-icon": { color: "#2e7d32" } }} />
                          ))}
                          {p.in_stock === true && <Chip icon={<InventoryIcon sx={{ fontSize: "10px !important" }} />} label="in stock" size="small" sx={{ fontSize: "0.5rem", height: 16, bgcolor: "#e3f2fd", color: "#1565c0", "& .MuiChip-icon": { color: "#1565c0" } }} />}
                          {p.in_stock !== true && p.stock_raw && p.stock_raw !== "price not available" && <Chip label={p.stock_raw} size="small" sx={{ fontSize: "0.5rem", height: 16, bgcolor: "#eef2f8", color: "#5d6b85" }} />}
                          {certs.length === 0 && p.in_stock !== true && (!p.stock_raw || p.stock_raw === "price not available") && <Typography sx={{ fontSize: "0.62rem", color: "#c4c9ce" }}>—</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={tiers.length > 1 ? tiers.map(t => `qty ${t.tier}: ${p.currency} ${Number(t.price).toFixed(2)}`).join("  ·  ") : ""}>
                          <Typography sx={{ fontSize: "0.68rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {p.list_price ? `${p.currency} ${Number(p.list_price).toFixed(2)}` : "—"}
                            {tiers.length > 1 && <Typography component="span" sx={{ fontSize: "0.55rem", color: "#1565c0", ml: 0.4 }}>+{tiers.length - 1} tiers</Typography>}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="contained" startIcon={<LinkIcon />} onClick={() => openLinkDialog(p)}
                          sx={{ bgcolor: "#c8463a", color: "#fff", boxShadow: "none", fontSize: "0.65rem", fontWeight: 700,
                            "&:hover": { bgcolor: "#a8372c", boxShadow: "none" } }}>
                          Link APSO
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
        </CardContent>
      </Card>

      {/* Manual Link Dialog — pick APSO product for this competitor row */}
      <Dialog open={linkDialog.open} onClose={() => !linking && setLinkDialog({ open: false, comp: null })}
        maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: "#c8463a", px: 3, py: 2 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
            Link Competitor ↔ APSO Product
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)" }}>
            {linkDialog.comp?.competitor_name} — {linkDialog.comp?.external_ref} · {linkDialog.comp?.product_name}
          </Typography>
        </Box>
        <DialogContent sx={{ pt: "20px !important", display: "flex", flexDirection: "column", gap: 2 }}>
          {linkDialog.comp && (() => {
            const c = linkDialog.comp;
            const certs = certList(c.certifications);
            const tiers = c.price_tiers || [];
            const facts: { label: string; value: React.ReactNode }[] = [
              { label: "Material", value: (c.material_raw || c.material_normalized || "—") },
              { label: "Type", value: c.product_type || "—" },
              { label: "Spec", value: specLine(c) },
              { label: "Market", value: c.market },
            ];
            return (
              <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#fafbfc" }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: "#5d6b85", textTransform: "uppercase" }}>Competitor article</Typography>
                    {c.source_url && (
                      <Button size="small" component="a" href={c.source_url} target="_blank" rel="noopener noreferrer"
                        startIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                        sx={{ fontSize: "0.62rem", color: "#1565c0", textTransform: "none", py: 0 }}>
                        View on {c.competitor_name}
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", fontSize: "0.72rem", mb: certs.length || tiers.length ? 0.75 : 0 }}>
                    {facts.map(f => <div key={f.label}><strong>{f.label}:</strong> {f.value}</div>)}
                  </Box>
                  {(certs.length > 0 || c.in_stock === true || tiers.length > 0) && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                      {certs.map(cert => (
                        <Chip key={cert} icon={<VerifiedIcon sx={{ fontSize: "11px !important" }} />} label={cert} size="small"
                          sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#e8f5e9", color: "#2e7d32", "& .MuiChip-icon": { color: "#2e7d32" } }} />
                      ))}
                      {c.in_stock === true && <Chip icon={<InventoryIcon sx={{ fontSize: "11px !important" }} />} label="in stock" size="small" sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#e3f2fd", color: "#1565c0", "& .MuiChip-icon": { color: "#1565c0" } }} />}
                      {tiers.map(t => (
                        <Chip key={t.tier} label={`qty ${t.tier}: ${c.currency} ${Number(t.price).toFixed(2)}`} size="small"
                          sx={{ fontSize: "0.55rem", height: 18, bgcolor: "#fff", border: "1px solid #dfe5ee", color: "#5d6b85", fontFamily: "monospace" }} />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Ranked suggestions — material family + same form + nearest dimension */}
          {(suggesting || suggestions.length > 0) && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 15, color: "#2e7d32" }} />
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#2e7d32", textTransform: "uppercase" }}>
                  Suggested matches {suggestions.length > 0 && `(${suggestions.length})`}
                </Typography>
                {suggesting && <CircularProgress size={13} sx={{ color: "#2e7d32" }} />}
              </Box>
              {suggestions.length > 0 ? (
                <Box sx={{ border: "1px solid #c8e6c9", borderRadius: 2, overflow: "hidden", bgcolor: "#f8fcf9" }}>
                  {suggestions.map(a => apsoRow(a, true))}
                </Box>
              ) : !suggesting && (
                <Typography sx={{ fontSize: "0.72rem", color: "#8b97ac", fontStyle: "italic" }}>No close-dimension suggestions — use the search below.</Typography>
              )}
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <TextField size="small" label="Search APSO (article / description)"
              placeholder="Type to filter — live search" value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)} sx={{ flex: 1 }}
              slotProps={{
                input: {
                  endAdornment: searching
                    ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment>
                    : <InputAdornment position="end"><SearchIcon fontSize="small" sx={{ color: "#9e9e9e" }} /></InputAdornment>,
                },
              }} />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Mandant</InputLabel>
              <Select value={linkMandant} label="Mandant"
                onChange={(e) => setLinkMandant(e.target.value as "" | "M100" | "M110")}>
                <MenuItem value="">Both</MenuItem>
                <MenuItem value="M100">M100 (CH)</MenuItem>
                <MenuItem value="M110">M110 (DE)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField size="small" type="email" label="Your Email (optional — saved in browser)"
            value={userEmail} onChange={(e) => saveEmail(e.target.value)} />

          <Box sx={{ border: "1px solid #e4e9f1", borderRadius: 2, maxHeight: 320, overflow: "auto" }}>
            {searching && <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={20} /></Box>}
            {!searching && apsoCandidates.length === 0 && (
              <Box sx={{ p: 3, textAlign: "center", color: "#5d6b85", fontSize: "0.78rem" }}>
                No APSO candidates yet — try searching by article number, description, or change the mandant.
              </Box>
            )}
            {apsoCandidates.map(a => apsoRow(a))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLinkDialog({ open: false, comp: null })} disabled={linking} sx={{ color: "#5d6b85" }}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}