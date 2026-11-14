"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { aoaSheet, downloadXlsx, type Cell } from "@/lib/pricing/xlsx";
import PageHeader from "../../PageHeader";
import TopScroll from "../../TopScroll";
import { SearchFilter, HierFilter, ClearFilters } from "../../Filters";
import { useSavedFilters } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface Opt { number: string; description: string }
interface Filters { profit_centers: string[]; main_groups: Opt[]; sub_groups: Opt[]; assortments: Opt[]; product_groups: Opt[] }
interface SupMatch { status: string; supplier_code: string | null; brand: string; matched_line: string | null; grade: string | null; new_price: number | null; old_price: number | null; change_pct: number | null }
interface Row {
  article_number: string; description: string; material: string | null; material_grade: string | null; type: string;
  thickness_od: number | null; height_id: string | null; width: number | null; length: number | null;
  calc_unit: string | null; net_weight: number | null;
  gwstdp: number | null; old_gwstdp: number | null; deviation: number | null;
  suppliers: Record<string, SupMatch>;
  competitors: Record<string, { sell: number | null; unit: string | null; deviation: number | null; our_cost: number | null }>;
  stock?: Record<string, StockInfo>;
}
interface StockInfo {
  supplier_article: string | null; link_method: string | null; link_score: number | null;
  qty: number | null; unit: string | null; in_stock: boolean | null;
  lead_time_days: number | null; lead_time_raw: string | null; warehouse: string | null;
  min_order_qty: number | null; fda: boolean | null; food_grade: boolean | null; usp_vi: boolean | null;
  source?: string | null; conflict?: string | null; conflict_article?: string | null;
  conflict_description?: string | null; also_stocked_as?: string | null;
  link_would_be?: string | null; link_would_be_description?: string | null;
  supplier_description: string | null;
}
interface SupInfo { name: string; currency: string; basis: string }
interface CompInfo { code: string; name: string; currency: string }

const fv = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const fp = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const pcChange = (v: number | null) => (v == null ? "#8b97ac" : v > 0.001 ? "#c62828" : v < -0.001 ? "#2e7d32" : "#5d6b85");
const STATUS: Record<string, { bg: string; color: string }> = {
  OK: { bg: "#e8f5e9", color: "#2e7d32" }, Review: { bg: "#fff3e0", color: "#e65100" }, "Not found": { bg: "#eef2f8", color: "#8b97ac" },
};
const EMPTY: SupMatch = { status: "Not found", supplier_code: null, brand: "", matched_line: null, grade: null, new_price: null, old_price: null, change_pct: null };
const isKT = (p: string) => /kt|kunststoff|plast/i.test(p);
type MatchView = "matched" | "unmatched" | "all";
interface Col { key: string; label: string; align?: "right" | "center"; sep?: boolean; group?: string; render: (r: Row) => React.ReactNode; raw?: (r: Row) => string | number }

// Diverging bar for the deviation (our cost − competitor sell)/our cost.
// v < 0 ⇒ competitor sells ABOVE our cost (we are cheaper → margin room) → GREEN, fills right, shows −%.
// v > 0 ⇒ competitor sells BELOW our cost (they undercut us)            → RED,   fills left,  shows +%.
function DivergeBar({ v }: { v: number }) {
  const HALF = 30;
  const w = Math.min(1, Math.abs(v)) * HALF;
  const good = v < 0;
  const color = good ? "#2e7d32" : "#c62828";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.2, justifyContent: "flex-end" }}>
      <Box sx={{ position: "relative", width: HALF * 2, height: 6, bgcolor: "#eef0f2", borderRadius: 1, flexShrink: 0 }}>
        <Box sx={{ position: "absolute", top: -1, bottom: -1, left: "50%", width: "1px", bgcolor: "#cfd4da" }} />
        <Box sx={{ position: "absolute", top: 0, height: 6, borderRadius: 1, bgcolor: color, width: w, left: good ? HALF : HALF - w }} />
      </Box>
      <Typography sx={{ fontFamily: "monospace", fontSize: "0.6rem", fontWeight: 800, color, minWidth: 32, textAlign: "right" }}>{v > 0 ? "+" : ""}{(v * 100).toFixed(0)}%</Typography>
    </Box>
  );
}
const GROUP_COLOR: Record<string, { bg: string; color: string }> = {
  "Price List": { bg: "#fdf0df", color: "#854d0e" },
  "GWStdP Calculation": { bg: "#e8f0f4", color: "#274e64" },
  "Competitor": { bg: "#eef5e9", color: "#2e7d32" },
};

export default function PurchasingBenchmarkPage() {
  const [data, setData] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<SupInfo[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<{ name: string }[]>([]);
  const [competitors, setCompetitors] = useState<CompInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const [unmatchedTotal, setUnmatchedTotal] = useState(0);
  const [scoped, setScoped] = useState(true);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters, the matched/unmatched view and the supplier / competitor picks are saved per user
  // and stay until "Clear all". Suppliers are saved as the ones switched OFF, so a supplier
  // added later is on by default.
  // "all" so supplier-scoped coverage gaps (articles no line prices, e.g. Ø below every range)
  // stay visible in the table and the Excel export instead of silently disappearing.
  const sf = useSavedFilters("purchasing-benchmark", {
    search: "", ass: "", mg: "", sg: "", pg: "", match: "all" as MatchView, supsOff: [] as string[], comps: [] as string[],
  });
  const [search, setSearch] = sf.bind("search");
  const [filters, setFilters] = useState<Filters | null>(null);
  const [fAss, setFAss] = sf.bind("ass");
  const [fMG, setFMG] = sf.bind("mg");
  const [fSG, setFSG] = sf.bind("sg");
  const [fPG, setFPG] = sf.bind("pg");
  const [matchView, setMatchView] = sf.bind("match");
  const [supSel, setSupSelRaw] = useState<Set<string>>(new Set());
  const compSel = useMemo(() => new Set(sf.f.comps), [sf.f.comps]);
  const setCompSel = (n: Set<string>) => sf.set("comps", [...n]);
  const supInit = useRef(false);

  useEffect(() => { fetch(`${API_URL}/api/products/filters`).then(r => r.json()).then(setFilters).catch(() => {}); }, []);
  const ktOpts = (filters?.profit_centers || []).filter(isKT);

  const params = useCallback((perPage: number, pg: number) => {
    const p = new URLSearchParams({ page: String(pg), per_page: String(perPage), match: matchView });
    if (search) p.set("search", search);
    if (fAss) p.set("assortment", fAss);
    if (fMG) p.set("main_group", fMG);
    if (fSG) p.set("sub_group", fSG);
    if (fPG) p.set("product_group", fPG);
    if (supSel.size) p.set("suppliers", [...supSel].join(","));
    else if (supInit.current) p.set("suppliers", "__none__"); // user deselected all -> show raw apso_products
    if (compSel.size) p.set("competitors", [...compSel].join(","));
    return p;
  }, [search, fAss, fMG, fSG, fPG, matchView, supSel, compSel]);

  const fetchData = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the page loads once
    setLoading(true);
    try {
      const j = await fetch(`${API_URL}/api/purchasing/benchmark?${params(25, page + 1)}`).then(r => r.json());
      setData(j.rows || []); setTotal(j.total || 0); setSuppliers(j.suppliers || []); setCompetitors(j.competitors || []);
      setMatchedTotal(j.matchedTotal || 0); setUnmatchedTotal(j.unmatchedTotal || 0); setScoped(j.scoped !== false);
      const avail = (j.availableSuppliers || []) as { name: string }[];
      setAvailableSuppliers(avail);
      if (!supInit.current && avail.length) { supInit.current = true; setSupSelRaw(new Set(avail.map(a => a.name).filter(n => !sf.f.supsOff.includes(n)))); }
    } catch { setData([]); } finally { setLoading(false); }
  }, [params, page, sf.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // A supplier pick is saved as the suppliers switched off.
  const setSupSel = (n: Set<string>) => { setSupSelRaw(n); sf.set("supsOff", availableSuppliers.map(a => a.name).filter(x => !n.has(x))); };
  useEffect(() => { fetchData(); }, [fetchData]);

  const clearF = () => { sf.reset(); setSupSelRaw(new Set(availableSuppliers.map(a => a.name))); setPage(0); };
  const hasF = sf.active;
  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n); setPage(0);
  };

  const mono = (v: string | null, color = "#274e64") => <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace", color, whiteSpace: "nowrap" }}>{v || "—"}</Typography>;
  const ellip = (v: string | null, w = 220) => <Tooltip title={v || ""} arrow><Typography sx={{ fontSize: "0.73rem", color: "#4a5a70", maxWidth: w, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "—"}</Typography></Tooltip>;
  const numTxt = (v: number | null, color = "#5d6b85", strong = false) => <Typography sx={{ fontFamily: "monospace", fontSize: strong ? "0.76rem" : "0.73rem", fontWeight: strong ? 700 : 500, color: v != null ? color : "#c4c9ce" }}>{fv(v)}</Typography>;
  const statusCell = (s: string) => { const st = STATUS[s] || STATUS["Not found"]; return <Chip label={s || "—"} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: st.bg, color: st.color }} />; };

  const selComps = competitors.filter(c => compSel.has(c.code));
  const primary = suppliers[0];
  const M = (r: Row) => (primary ? r.suppliers[primary.name] || EMPTY : EMPTY);
  // The article's OWN grade ("PEEK SL", "POM-C EC", "PA 6 G") — the matched line's material
  // drops the A+P suffix (PEEK SL matches the PVX line whose material is just "PEEK").
  const gradeOf = (r: Row) => r.material_grade || (primary ? (r.suppliers[primary.name]?.grade || r.material) : r.material);
  const dash = () => <Typography sx={{ fontSize: "0.72rem", color: "#c4c9ce", fontFamily: "monospace" }}>—</Typography>;
  const kgUnit = (u: string | null) => /^kg$/i.test((u || "").trim());
  // Convert a supplier's list price into the ARTICLE's calc unit. The old version assumed the
  // supplier quoted per kg, which is true of the primary but not of MCAM (per piece) — running
  // that formula on a per-piece price would have multiplied it by the weight a second time.
  const priceIn = (r: Row, sd: SupInfo) => {
    const m = r.suppliers[sd.name] || EMPTY;
    if (m.new_price == null) return null;
    const supKg = /kg/i.test(sd.basis || "kg");
    const artKg = kgUnit(r.calc_unit);
    if (supKg === artKg) return m.new_price;
    if (supKg) return r.net_weight != null ? m.new_price * r.net_weight : null;
    return r.net_weight ? m.new_price / r.net_weight : null;
  };
  const certCell = (v: boolean | null | undefined) =>
    v == null ? <Typography sx={{ fontSize: "0.72rem", color: "#c4c9ce" }}>—</Typography>
      : <Chip label={v ? "yes" : "no"} size="small" sx={{ height: 16, fontSize: "0.55rem", fontWeight: 700, bgcolor: v ? "#e8f5e9" : "#eef2f8", color: v ? "#2e7d32" : "#8b97ac" }} />;

  // A supplier article number reaches us two ways and they do not always agree:
  //   • the PRICE LIST line matched to this article, which is what the price beside it belongs to
  //   • the SUPPLIER CATALOGUE item this article is linked to, which is where stock comes from
  // MCAM's price-list codes are its catalogue numbers without the leading zero (301 of 362 resolve),
  // so they are directly comparable. Showing only the first left the column blank on every article
  // the price list does not carry, while the catalogue plainly knew the item. Now the catalogue
  // fills in, marked as such, and a genuine disagreement is shown rather than hidden.
  //
  // The price list is the authority, so a row backed by one is simply shown in brown. Where our
  // own attribute link would have picked a different grade — the letter-suffix cases, PAI SL,
  // PEI EC, PA 6-G MO — the alternative is named in the tooltip rather than raised as an alarm,
  // so it stays reviewable without implying the priced row is wrong.
  const zeroless = (v: string | null | undefined) => String(v || "").replace(/^0+/, "");
  const supplierArticleCell = (
    code: string | null, link: string | null | undefined, altDesc?: string | null,
  ) => {

    // Always show the CATALOGUE number when we have one. The price list writes the same item
    // without its leading zero, so showing whichever source happened to win put 1381120003 and
    // 01381120004 in the same column on adjacent rows — one number, two spellings. The catalogue
    // form is the one to type into MCAM Connect, so it is the one shown; colour says whether a
    // price-list line backs it, not which source supplied the digits.
    const shown = link || code;
    if (!shown) return dash();
    if (code) {
      return (
        <Tooltip arrow title={altDesc
          ? `Priced from the supplier price list. Our own attribute match would have picked ${altDesc} instead — a different grade of the same polymer, worth a look if this article is one of the SL / EC / MO types.`
          : "Priced from the supplier price list."}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace", color: "#854d0e", whiteSpace: "nowrap" }}>{shown}</Typography>
        </Tooltip>
      );
    }
    return (
      <Tooltip arrow title="From the supplier catalogue. The price list has no line for this article, so there is no price beside it.">
        <Typography sx={{ fontSize: "0.73rem", fontFamily: "monospace", fontStyle: "italic", color: "#8b97ac", whiteSpace: "nowrap" }}>{shown}</Typography>
      </Tooltip>
    );
  };

  // Columns 1-to-1 with the supplier "Table" sheet.
  const cols: Col[] = [
    { key: "article", label: "A+P article", raw: r => r.article_number, render: r => mono(r.article_number) },
    { key: "desc", label: "A+P description EN", raw: r => r.description, render: r => ellip(r.description, 240) },
    { key: "type", label: "Type", raw: r => r.type, render: r => <Typography sx={{ fontSize: "0.72rem", color: "#5d6b85", textTransform: "capitalize" }}>{r.type || "—"}</Typography> },
    { key: "material", label: "Material", raw: r => (gradeOf(r) || "").toUpperCase(), render: r => <Chip label={(gradeOf(r) || "—").toUpperCase()} size="small" sx={{ height: 17, fontSize: "0.58rem", fontWeight: 700, bgcolor: "#eef2f8" }} /> },
    { key: "brand", label: "Brand Name", raw: r => M(r).brand || "", render: r => ellip(M(r).brand || null, 150) },
    { key: "thk", label: "Thickness/OD [mm]", align: "right", raw: r => r.thickness_od ?? "", render: r => numTxt(r.thickness_od) },
    { key: "height", label: "Height/ID [mm]", align: "right", raw: r => r.height_id ?? "", render: r => <Typography sx={{ fontFamily: "monospace", fontSize: "0.73rem", color: r.height_id ? "#5d6b85" : "#c4c9ce" }}>{r.height_id || "—"}</Typography> },
    { key: "width", label: "Width [mm]", align: "right", raw: r => r.width ?? "", render: r => numTxt(r.width) },
    { key: "length", label: "Length [mm]", align: "right", raw: r => r.length ?? "", render: r => numTxt(r.length) },
    { key: "net", label: "Net Weight", align: "right", sep: true, raw: r => r.net_weight ?? "", render: r => numTxt(r.net_weight) },
    // price unit belongs to the ARTICLE, so it stays with the A+P facts rather than under a
    // supplier band. Every supplier now states its own basis in its price column header.
    { key: "priceunit", label: "price unit", sep: true, raw: r => r.calc_unit || "", render: r => <Typography sx={{ fontSize: "0.72rem", color: "#5d6b85" }}>{r.calc_unit || "—"}</Typography> },
    // ── GWStdP Calculation — before the suppliers, so the cost being compared is read first ──
    { key: "old_gwstdp", label: "Old GWSDTP", align: "right", group: "GWStdP Calculation", raw: r => r.old_gwstdp ?? "", render: r => numTxt(r.old_gwstdp) },
    { key: "gwstdp", label: "GWSDTP", align: "right", group: "GWStdP Calculation", raw: r => r.gwstdp ?? "", render: r => numTxt(r.gwstdp, "#274e64", true) },
    { key: "deviation", label: "Deviation (%)", align: "right", group: "GWStdP Calculation", sep: true, raw: r => r.deviation ?? "", render: r => <Typography sx={{ fontFamily: "monospace", fontSize: "0.73rem", fontWeight: 700, color: pcChange(r.deviation) }}>{fp(r.deviation)}</Typography> },
  ];
  // EVERY supplier renders the same way, the primary included — that is the whole point of
  // "Ensinger should be like the other suppliers". Stock, lead time and approvals sit inside
  // their own supplier's band instead of a separate group at the far right.
  suppliers.forEach(sd => {
    const Mx = (r: Row) => r.suppliers[sd.name] || EMPTY;
    const S = (r: Row) => r.stock?.[sd.name];
    const short = sd.name.split(" ")[0];
    const hasStock = data.some((r: Row) => r.stock?.[sd.name]);
    const hasCerts = data.some((r: Row) => { const st = r.stock?.[sd.name]; return !!st && (st.fda != null || st.food_grade != null || st.usp_vi != null); });
    const block: Col[] = [
      { key: `${sd.name}-code`, label: `${short} article`, group: short,
        raw: r => S(r)?.supplier_article || Mx(r).supplier_code || "",
        render: r => supplierArticleCell(Mx(r).supplier_code, S(r)?.supplier_article, S(r)?.link_would_be_description) },
      { key: `${sd.name}-list`, label: `${short} ${sd.currency}/${sd.basis}`, group: short, align: "right", raw: r => Mx(r).new_price ?? "", render: r => numTxt(Mx(r).new_price, "#15223a", true) },
      { key: `${sd.name}-price`, label: `${short} price`, group: short, align: "right", raw: r => priceIn(r, sd) ?? "", render: r => numTxt(priceIn(r, sd), "#15223a", true) },
    ];
    if (hasStock) block.push(
      { key: `${sd.name}-stock`, label: `${short} stock`, group: short, align: "right",
        raw: r => S(r)?.qty ?? "",
        render: r => {
          const st = S(r);
          if (!st) return dash();
          const on = st.qty != null && st.qty > 0;
          return (
            <Box sx={{ minWidth: 80 }}>
              <Typography sx={{ fontFamily: "monospace", fontSize: "0.74rem", fontWeight: 700, color: on ? "#2e7d32" : "#8b97ac" }}>
                {st.qty == null ? "—" : `${st.qty}${st.unit ? ` ${st.unit}` : ""}`}
              </Typography>
            </Box>
          );
        } },
      { key: `${sd.name}-lead`, label: `${short} lead`, group: short, align: "right",
        raw: r => S(r)?.lead_time_days ?? "",
        render: r => {
          const d = S(r)?.lead_time_days;
          if (d == null) return dash();
          return <Typography sx={{ fontFamily: "monospace", fontSize: "0.74rem", fontWeight: 700, color: d === 0 ? "#2e7d32" : d <= 21 ? "#e65100" : "#c62828" }}>{d === 0 ? "stock" : `${d} d`}</Typography>;
        } },
    );
    // Approvals as three separate columns. null is "not stated", never "no" — an unknown
    // approval must not read as an absent one.
    if (hasCerts) block.push(
      { key: `${sd.name}-fda`, label: `${short} FDA`, group: short, align: "center", raw: r => { const v = S(r)?.fda; return v == null ? "" : v ? "yes" : "no"; }, render: r => certCell(S(r)?.fda) },
      { key: `${sd.name}-food`, label: `${short} food grade`, group: short, align: "center", raw: r => { const v = S(r)?.food_grade; return v == null ? "" : v ? "yes" : "no"; }, render: r => certCell(S(r)?.food_grade) },
      { key: `${sd.name}-usp`, label: `${short} USP VI`, group: short, align: "center", raw: r => { const v = S(r)?.usp_vi; return v == null ? "" : v ? "yes" : "no"; }, render: r => certCell(S(r)?.usp_vi) },
    );
    block[block.length - 1].sep = true;
    cols.push(...block);
  });
  selComps.forEach(c => cols.push({
    key: `comp-${c.code}`, label: `${c.name} (${c.currency})`, align: "right", group: "Competitor",
    raw: r => r.competitors?.[c.code]?.sell ?? "",
    render: r => {
      const cd = r.competitors?.[c.code];
      if (!cd || cd.sell == null) return <Typography sx={{ fontFamily: "monospace", fontSize: "0.73rem", color: "#c4c9ce" }}>—</Typography>;
      const u = cd.unit ? `/${cd.unit}` : "";
      return (
        <Box sx={{ minWidth: 104 }}>
          <Typography sx={{ fontFamily: "monospace", fontSize: "0.74rem", fontWeight: 700, color: "#274e64" }}>{cd.sell.toFixed(2)}<Typography component="span" sx={{ fontSize: "0.62rem", color: "#8b97ac", fontWeight: 500 }}>{u ? ` ${u}` : ""}</Typography></Typography>
          {cd.our_cost != null && <Typography sx={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#8b97ac", lineHeight: 1.2 }}>our {cd.our_cost.toFixed(2)} {u}</Typography>}
          {cd.deviation != null && <DivergeBar v={cd.deviation} />}
        </Box>
      );
    },
  }));

  // Group bands for the two-level header (colored, like the Excel's "Price List" / "GWStdP" bands).
  const groupBands: { label: string; span: number }[] = [];
  cols.forEach(c => { const g = c.group || ""; const last = groupBands[groupBands.length - 1]; if (last && last.label === g) last.span++; else groupBands.push({ label: g, span: 1 }); });

  const exportXlsx = async () => {
    try {
      const j = await fetch(`${API_URL}/api/purchasing/benchmark?${params(9999, 1)}`).then(r => r.json());
      const rows = (j.rows || []) as Row[];
      const head = cols.map(c => c.label);
      const body = rows.map(r => cols.map(c => (c.raw ? c.raw(r) : "")));
      await downloadXlsx("purchasing_benchmark.xlsx", [aoaSheet("Table", [head, ...body] as Cell[][])]);
    } catch { /* noop */ }
  };

  const MATCH_CHIPS: { key: MatchView; label: string; count: number; bg: string; color: string }[] = [
    { key: "matched", label: "Matched", count: matchedTotal, bg: "#e8f5e9", color: "#1b5e20" },
    { key: "unmatched", label: "Unmatched", count: unmatchedTotal, bg: "#fff3e0", color: "#e65100" },
    { key: "all", label: "All", count: matchedTotal + unmatchedTotal, bg: "#c8463a", color: "#fff" },
  ];

  return (
    <Box>
      <PageHeader icon="benchmark" eyebrow="Purchasing" title="Benchmarking Table"
        subtitle="Our KT plastics articles matched to the supplier's OCR'd price lines. Toggle a supplier to see its priced articles; add competitors to compare selling prices."
        rightSlot={
          <Button variant="contained" startIcon={<FileDownloadIcon />} disabled={total === 0} onClick={exportXlsx}
            sx={{ bgcolor: "#c8463a", color: "#fff", boxShadow: "none", fontWeight: 700, "&:hover": { bgcolor: "#a8372c", boxShadow: "none" } }}>Export Excel</Button>
        } />

      <Card sx={{ mb: 1.5, border: "1px solid #e4e9f1", borderRadius: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <SearchFilter value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
            {filters && <>
              {ktOpts.length > 0 && <Chip label="Profit Center: KT (Plastics)" size="small" sx={{ fontWeight: 600, bgcolor: "#eef2f6", color: "#274e64" }} />}
              <HierFilter label="Assortment" value={fAss} options={filters.assortments || []} onChange={(n) => { setFAss(n); setPage(0); }} />
              <HierFilter label="Main Group" value={fMG} options={filters.main_groups || []} onChange={(n) => { setFMG(n); setPage(0); }} />
              <HierFilter label="Sub Group" value={fSG} options={filters.sub_groups || []} onChange={(n) => { setFSG(n); setPage(0); }} />
              <HierFilter label="Product Group" value={fPG} options={filters.product_groups || []} onChange={(n) => { setFPG(n); setPage(0); }} />
            </>}
            <ClearFilters show={hasF} onClick={clearF} />
            <Box sx={{ flex: 1 }} />
            {MATCH_CHIPS.map(c => {
              const active = matchView === c.key;
              return <Chip key={c.key} label={`${c.label} · ${c.count}`} onClick={() => { setMatchView(c.key); setPage(0); }}
                sx={{ cursor: "pointer", fontSize: "0.74rem", height: 28, fontWeight: active ? 700 : 500, bgcolor: active ? c.bg : "#eef2f8", color: active ? c.color : "#4a5a70", border: active ? `1px solid ${c.bg}` : "1px solid transparent" }} />;
            })}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85" }}>Suppliers:</Typography>
            {availableSuppliers.map(s => {
              const active = supSel.has(s.name);
              return <Chip key={s.name} label={s.name} onClick={() => toggleSet(supSel, s.name, setSupSel)}
                sx={{ cursor: "pointer", fontSize: "0.72rem", height: 28, fontWeight: active ? 700 : 500, bgcolor: active ? "#854d0e" : "#eef2f8", color: active ? "#fff" : "#9e9e9e", textDecoration: active ? "none" : "line-through" }} />;
            })}
            {availableSuppliers.length === 0 && <Typography sx={{ fontSize: "0.72rem", color: "#8b97ac" }}>none yet — OCR a supplier PDF in OCR &amp; Mapping</Typography>}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#5d6b85" }}>Compare with competitor sales price:</Typography>
            {competitors.map(c => {
              const active = compSel.has(c.code);
              return <Chip key={c.code} label={c.name} onClick={() => toggleSet(compSel, c.code, setCompSel)}
                sx={{ cursor: "pointer", fontSize: "0.72rem", height: 26, fontWeight: active ? 700 : 500, bgcolor: active ? "#274e64" : "#eef2f8", color: active ? "#fff" : "#5d6b85", border: active ? "1px solid #274e64" : "1px solid transparent" }} />;
            })}
            {competitors.length === 0 && <Typography sx={{ fontSize: "0.72rem", color: "#8b97ac" }}>no plastics competitors configured</Typography>}
          </Box>
        </CardContent>
      </Card>

      {!scoped && availableSuppliers.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.25, mb: 1.5, borderRadius: 2, bgcolor: "#fff8e1", border: "1px solid #ffe0a3" }}>
          <Box sx={{ fontSize: "1.1rem" }}>⚠️</Box>
          <Typography sx={{ fontSize: "0.78rem", color: "#7a5b00" }}>
            <b>Main Supplier not populated in HubSpot yet</b> — showing all KT plastics that match the supplier&rsquo;s materials. Once the <b>Main Supplier</b> property is filled per article, this auto-scopes to exactly the articles we buy from each supplier.
          </Typography>
        </Box>
      )}

      {loading && <LinearProgress sx={{ mb: 1, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {availableSuppliers.length === 0 && !loading ? (
        <Card sx={{ border: "1px dashed #d8dce1", borderRadius: 3, p: 4, textAlign: "center", bgcolor: "#fafbfc" }}>
          <Typography sx={{ fontWeight: 700, color: "#15223a", mb: 0.5 }}>No supplier price list yet</Typography>
          <Typography sx={{ fontSize: "0.88rem", color: "#5d6b85" }}>OCR a supplier price-list PDF in OCR &amp; Mapping; its articles appear here matched to ours.</Typography>
        </Card>
      ) : (
        <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 0 }}>
          <CardContent sx={{ p: 0 }}>
            <TopScroll><TableContainer sx={{ overflowX: "visible", overflowY: "auto", maxHeight: "70vh" }}>
              <Table size="small" stickyHeader sx={{ minWidth: 200 + cols.length * 94 }}>
                <TableHead>
                  <TableRow>
                    {groupBands.map((g, i) => { const gc = GROUP_COLOR[g.label]; return (
                      <TableCell key={i} colSpan={g.span} align="center" sx={{ top: 0, bgcolor: gc?.bg || "#f5f7fb", color: gc?.color || "transparent", fontWeight: 800, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "none", whiteSpace: "nowrap", borderRight: g.label ? "1px solid #e6dcc6" : undefined }}>{g.label || " "}</TableCell>
                    ); })}
                  </TableRow>
                  <TableRow sx={{ "& th": { bgcolor: "#f5f7fb", fontWeight: 700, fontSize: "0.68rem", color: "#5d6b85", whiteSpace: "nowrap", lineHeight: 1.2, top: 27 } }}>
                    {cols.map(c => <TableCell key={c.key} align={c.align} sx={{ borderRight: c.sep ? "2px solid #e4e9f1" : undefined }}>{c.label}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={cols.length} align="center" sx={{ py: 6, color: "#5d6b85" }}>No articles for this view.</TableCell></TableRow>
                  )}
                  {data.map((r, ri) => {
                    const bg = ri % 2 === 1 ? "#f5f7fb" : "#fff";
                    return (
                      <TableRow key={r.article_number} hover>
                        {cols.map(c => <TableCell key={c.key} align={c.align} sx={{ bgcolor: bg, borderRight: c.sep ? "2px solid #e4e9f1" : undefined }}>{c.render(r)}</TableCell>)}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer></TopScroll>
            <Box sx={{ px: 2, py: 0.5, borderTop: "1px solid #f0f1f3", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.7rem", color: "#8b97ac" }}>Match by grade + variant + thickness (validated 100% vs the mapping file). Net weight + Old/Change% are wired next; GWStdP comes from HubSpot.</Typography>
              <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]} />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
