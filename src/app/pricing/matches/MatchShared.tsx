"use client";
import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import SettingsIcon from "@mui/icons-material/Settings";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SyncIcon from "@mui/icons-material/Sync";
import PersonIcon from "@mui/icons-material/Person";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

export // the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
export const NAVY = "#274e64", RED = "#ed1b2f", MUTED = "#5b6470", GOOD = "#1e7e45", BAD = "#c5221f", AMBER = "#c77700";

// ── Types ────────────────────────────────────────────────────────────────────────────
export interface MatchReason { score: number; weight: number; apso: string; comp: string }
type Num = string | number | null;
export interface ScaleTier { tier?: number; qty: number | null; list: number | null }
export interface ApsoProduct {
  article_number: string; description: string; product_description: string | null; product_number: string | null;
  material: string | null; material_raw: string | null; product_type: string | null; color: string | null;
  diameter: Num; thickness: Num; width: Num; length: Num; hardness: string | null; conformities: string | null;
  mandant: string; currency: string | null; profit_center: string | null;
  sub_group_number: string | null; sub_group_description: string | null;
  main_group_number: string | null; main_group_description: string | null;
  assortment_number: string | null; assortment_description: string | null;
  sales_unit: string | null; stock: Num; moq: Num; ap_compound: string | null; supplier_compound: string | null;
  country_of_origin: string | null; budget_class: string | null; article_status: string | null; article_type: string | null;
  prices_updated_at: string | null; price_qty: Num;
  listprice: Num; listprice_per_piece: Num; listprice_m110: Num; listprice_m110_per_piece: Num;
  scale_prices: ScaleTier[] | null; scale_prices_m110: ScaleTier[] | null;
  bronze_price: Num; silver_price: Num; gold_price: Num; platinum_price: Num;
  bronze_price_m110: Num; silver_price_m110: Num; gold_price_m110: Num; platinum_price_m110: Num;
}
export interface CompProduct {
  product_name: string; external_ref: string; material: string | null; material_raw: string | null;
  product_type: string | null; color: string | null; diameter: Num; inner_diameter_mm: Num; cord_diameter_mm: Num;
  outer_diameter_mm: Num; hardness: string | null; certifications: string | null;
  thickness: Num; width: Num; length: Num; unit: string | null; in_stock: boolean | null; competitor_id: number;
  scraped_at: string | null; price_scraped_at: string | null; list_price: Num; list_price_norm: Num;
  tiers: Record<string, number> | null;
}
export interface Match {
  id: number; confidence_score: Num; machine_confidence: Num; approved: boolean; approved_by: string | null; approved_at: string | null;
  approved_by_person: boolean; is_new: boolean; xref_code: string | null;
  approved_sibling: { id: number; ref: string; name: string; by: string | null; at: string | null } | null;
  match_type: string; match_reasons: Record<string, MatchReason | number> | null; created_at: string; updated_at: string;
  apso_product: ApsoProduct; competitor_product: CompProduct;
  competitor_name: string; competitor_code: string; competitor_currency: string;
}
export interface Competitor { id: number; code: string; name: string; currency?: string }

// ── Formatting ───────────────────────────────────────────────────────────────────────
export const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return isFinite(n) ? n : null; };
const D2 = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("de-CH", D2) : "—");
export const fmtDayMonth = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }) : "—");
export const fmtDateTime = (d: string | null | undefined) => (d ? `${new Date(d).toLocaleDateString("de-CH", D2)} ${new Date(d).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}` : "—");
export const fmtMoney = (v: number | null, ccy?: string) => (v == null ? "—" : `${ccy ? ccy + " " : ""}${v.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`);
export const fmtMm = (v: unknown) => { const n = num(v); return n == null || n === 0 ? null : `${+n.toFixed(2)} mm`; };
export const daysAgo = (d: string | null | undefined) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null);
export const personLabel = (s: string | null | undefined) => {
  if (!s) return "System";
  if (s === "restored-from-log") return "Restored from log";
  const at = s.indexOf("@");
  if (at < 0) return s;
  return s.slice(0, at).split(/[._-]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
};
const reasonOf = (m: Match, k: string): MatchReason | null => {
  const r = m.match_reasons?.[k];
  return r && typeof r === "object" ? (r as MatchReason) : null;
};

// ── Confidence & qualification ───────────────────────────────────────────────────────
export function confStyle(c: number) {
  if (c >= 100) return { bg: "#e8f5e9", color: "#1b5e20", label: "EXACT" };
  if (c >= 90) return { bg: "#fff3e0", color: "#e65100", label: "VERY CLOSE" };
  if (c >= 70) return { bg: "#fff9c4", color: "#f57f17", label: "PARTIAL" };
  return { bg: "#ffebee", color: "#c62828", label: "LOW" };
}
/** 100% once a person confirmed it, with the machine's own score underneath. */
export function ConfidenceCell({ m }: { m: Match }) {
  const c = num(m.confidence_score) ?? 0;
  const machine = num(m.machine_confidence);
  const st = confStyle(c);
  return (
    <Box>
      <Chip label={`${Math.round(c)}%`} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 800, fontSize: "0.7rem", height: 22 }} />
      <Typography sx={{ fontSize: "0.56rem", color: st.color, fontWeight: 700, mt: 0.25, whiteSpace: "nowrap" }}>
        {m.approved_by_person ? (machine != null && machine < 100 ? `CONFIRMED · machine ${Math.round(machine)}%` : "CONFIRMED") : st.label}
      </Typography>
    </Box>
  );
}
/** Pending / Approved by <person> / Auto-approved — with when. */
export function QualifiedCell({ m }: { m: Match }) {
  if (!m.approved) return <Chip label="PENDING" size="small" sx={{ fontSize: "0.6rem", fontWeight: 800, height: 20, bgcolor: "#fff9c4", color: "#b26a00" }} />;
  const person = m.approved_by_person;
  return (
    <Tooltip title={person ? `${m.match_type === "manual" ? "Linked by hand" : "Approved"} by ${m.approved_by || "a user"}${m.approved_at ? " · " + fmtDateTime(m.approved_at) : ""}` : `Auto-approved by the matcher at 100%${m.approved_at ? " · " + fmtDateTime(m.approved_at) : ""}`} arrow>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        {person ? <PersonIcon sx={{ fontSize: 15, color: GOOD }} /> : <SmartToyOutlinedIcon sx={{ fontSize: 15, color: "#1565c0" }} />}
        <Box sx={{ lineHeight: 1.15 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: person ? GOOD : "#1565c0", whiteSpace: "nowrap" }}>{person ? (m.match_type === "manual" ? "Linked by hand" : personLabel(m.approved_by)) : "Auto-approved"}</Typography>
          <Typography sx={{ fontSize: "0.58rem", color: MUTED }}>{fmtDate(m.approved_at)}</Typography>
        </Box>
      </Box>
    </Tooltip>
  );
}
/** NEW = first seen within the last 14 days; EXTRA REF = the article is already approved
 *  against another product of this competitor (a second candidate from a later scrape). */
export function ArrivalChips({ m }: { m: Match }) {
  return (
    <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap" }}>
      {m.is_new && (
        <Tooltip title={`First seen ${fmtDateTime(m.created_at)}`} arrow>
          <Chip label={`NEW · ${fmtDayMonth(m.created_at)}`} size="small" sx={{ height: 18, fontSize: "0.56rem", fontWeight: 800, bgcolor: RED, color: "#fff", borderRadius: 1 }} />
        </Tooltip>
      )}
      {!m.approved && m.approved_sibling && (
        <Tooltip title={`${m.competitor_name} ${m.approved_sibling.ref} is already approved for this article${m.approved_sibling.by ? ` (${personLabel(m.approved_sibling.by)}, ${fmtDate(m.approved_sibling.at)})` : ""} — this is another ${m.competitor_name} product, first seen ${fmtDate(m.created_at)}`} arrow>
          <Chip label={`EXTRA REF · ${m.approved_sibling.ref}`} size="small" sx={{ height: 18, maxWidth: 170, fontSize: "0.56rem", fontWeight: 800, bgcolor: "#fdf0df", color: "#854d0e", borderRadius: 1 }} />
        </Tooltip>
      )}
    </Box>
  );
}

// ── Price comparison ─────────────────────────────────────────────────────────────────
/** The APSO price set in the competitor's currency: EUR → M110, CHF → M100. Falls back to
 *  the other set when that one is empty — then flagged, and no % (no exchange rate here). */
export function apsoPriceFor(m: Match) {
  const a = m.apso_product;
  const wantEUR = (m.competitor_currency || "").toUpperCase() === "EUR";
  const m100 = num(a.listprice_per_piece), m110 = num(a.listprice_m110_per_piece);
  const pack = num(a.price_qty) ?? 1;
  const unit = pack > 1 ? "pc" : (a.sales_unit || "unit");
  const pick = (mandant: "M100" | "M110", fallback: boolean) => ({
    mandant, ccy: mandant === "M110" ? "EUR" : "CHF", perPiece: mandant === "M110" ? m110 : m100, fallback, pack, unit,
    scales: (mandant === "M110" ? a.scale_prices_m110 : a.scale_prices) || [],
    customer: mandant === "M110"
      ? { B: num(a.bronze_price_m110), S: num(a.silver_price_m110), G: num(a.gold_price_m110), P: num(a.platinum_price_m110) }
      : { B: num(a.bronze_price), S: num(a.silver_price), G: num(a.gold_price), P: num(a.platinum_price) },
  });
  if (wantEUR) return m110 ? pick("M110", false) : m100 ? pick("M100", true) : null;
  return m100 ? pick("M100", false) : m110 ? pick("M110", true) : null;
}
/** Competitor price per OUR unit at each of its quantity tiers. Only tier 1 comes converted
 *  from the server; the conversion is linear, so its ratio converts the other tiers too. */
export function compTiers(m: Match) {
  const c = m.competitor_product;
  const raw1 = num(c.list_price), norm1 = num(c.list_price_norm);
  const ratio = raw1 && norm1 ? norm1 / raw1 : null;
  const tiers = Object.entries(c.tiers || {}).map(([q, p]) => ({ qty: Number(q), raw: Number(p) })).filter(t => isFinite(t.qty) && isFinite(t.raw)).sort((x, y) => x.qty - y.qty);
  return { converted: ratio != null, unitRaw: c.unit || "", tiers: tiers.map(t => ({ qty: t.qty, price: ratio != null ? t.raw * ratio : t.raw })) };
}
export function priceDiff(m: Match): number | null {
  const ap = apsoPriceFor(m);
  const ct = compTiers(m);
  const c1 = ct.tiers.find(t => t.qty <= 1)?.price ?? ct.tiers[0]?.price ?? null;
  if (!ap || ap.fallback || !ct.converted || ap.perPiece == null || c1 == null || c1 <= 0) return null;
  return ((ap.perPiece - c1) / c1) * 100;
}
const at = (list: { qty: number; price: number }[], q: number) => { let best: number | null = null, bq = -1; for (const t of list) if (t.qty <= q && t.qty > bq) { best = t.price; bq = t.qty; } return best; };
const diffColor = (d: number | null) => (d == null ? MUTED : d <= -5 ? GOOD : d < 5 ? AMBER : BAD);
export function DiffChip({ d }: { d: number | null }) {
  if (d == null) return <Typography sx={{ fontSize: "0.65rem", color: "#bdc1c6" }}>—</Typography>;
  return <Chip label={`${d > 0 ? "+" : ""}${d.toFixed(1)}%`} size="small" sx={{ height: 20, fontSize: "0.64rem", fontWeight: 800, bgcolor: d <= -5 ? "#e8f5ee" : d < 5 ? "#fdf3e2" : "#fdecea", color: diffColor(d) }} />;
}

/** Compact price comparison: one ladder, APSO vs competitor per quantity, % per row. */
export function PriceCompare({ m }: { m: Match }) {
  const ap = apsoPriceFor(m);
  const ct = compTiers(m);
  const pack = ap?.pack ?? 1;
  const apsoLadder = ap ? [{ qty: 1, price: ap.perPiece ?? 0 }, ...ap.scales.filter(s => num(s.qty) && num(s.list)).map(s => ({ qty: Number(s.qty), price: Number(s.list) / pack }))].filter(t => t.price > 0) : [];
  const qtys = [...new Set([1, ...apsoLadder.map(t => t.qty), ...ct.tiers.map(t => t.qty)])].filter(q => q > 0).sort((x, y) => x - y).slice(0, 7);
  const unit = ap?.unit || "unit";
  const head = { fontSize: "0.6rem", fontWeight: 800, color: MUTED, textTransform: "uppercase" as const, letterSpacing: "0.04em" };
  const cell = { fontSize: "0.78rem", fontFamily: "monospace", fontWeight: 700, textAlign: "right" as const };
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "#e3e7eb" }}>
      <Box sx={{ px: 1.5, py: 0.9, bgcolor: "#eef2f6", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>Price</Typography>
        {ap ? (
          <Chip size="small" label={`APSO ${ap.mandant} · ${ap.ccy} / ${unit}${pack > 1 ? ` (list per ${pack})` : ""}`} sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, bgcolor: ap.fallback ? "#fdf0df" : "#fff", color: ap.fallback ? "#854d0e" : NAVY }} />
        ) : <Chip size="small" label="No APSO list price in M100 or M110" sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, bgcolor: "#fdecea", color: BAD }} />}
        <Chip size="small" label={`${m.competitor_name} · ${m.competitor_currency} / ${ct.converted ? unit : (ct.unitRaw || "own unit")}`} sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, bgcolor: "#fef7e0", color: "#854d0e" }} />
      </Box>
      {ap?.fallback && (
        <Typography sx={{ px: 1.5, pt: 0.6, fontSize: "0.68rem", color: "#854d0e", fontWeight: 600 }}>
          No {ap.mandant === "M100" ? "M110 (EUR)" : "M100 (CHF)"} price on this article — showing {ap.mandant} in {ap.ccy}, no % across currencies.
        </Typography>
      )}
      {!ct.converted && ct.tiers.length > 0 && (
        <Typography sx={{ px: 1.5, pt: 0.6, fontSize: "0.68rem", color: "#854d0e", fontWeight: 600 }}>
          {m.competitor_name} prices per {ct.unitRaw || "its own unit"} — not convertible to /{unit}, no %.
        </Typography>
      )}
      <Box sx={{ px: 1.5, py: 0.8, display: "grid", gridTemplateColumns: "52px 1fr 1fr 64px", columnGap: 1, rowGap: 0.35, alignItems: "center" }}>
        <Typography sx={head}>Qty</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>APSO</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>{m.competitor_name}</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>Diff</Typography>
        {qtys.map(q => {
          const a = at(apsoLadder, q), c = at(ct.tiers, q);
          const d = a != null && c != null && c > 0 && ap && !ap.fallback && ct.converted ? ((a - c) / c) * 100 : null;
          return (
            <React.Fragment key={q}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>{q}+</Typography>
              <Typography sx={{ ...cell, color: "#1a1d21" }}>{a != null ? fmtMoney(a) : "—"}</Typography>
              <Typography sx={{ ...cell, color: NAVY }}>{c != null ? fmtMoney(c) : "—"}</Typography>
              <Box sx={{ textAlign: "right" }}><DiffChip d={d} /></Box>
            </React.Fragment>
          );
        })}
        {qtys.length === 0 && <Typography sx={{ gridColumn: "1 / span 4", fontSize: "0.72rem", color: MUTED }}>No prices on either side.</Typography>}
      </Box>
      {ap && Object.values(ap.customer).some(v => v != null) && (
        <Box sx={{ px: 1.5, pb: 0.7, display: "flex", gap: 1.2, flexWrap: "wrap", fontSize: "0.68rem", fontFamily: "monospace", fontWeight: 700 }}>
          {([["B", "#b8860b"], ["S", "#6b7280"], ["G", "#c99a06"], ["P", "#6d28d9"]] as const).map(([k, col]) => ap.customer[k] != null && (
            <span key={k} style={{ color: col }}>{k} {fmtMoney((ap.customer[k] as number) / pack)}</span>
          ))}
        </Box>
      )}
      <Box sx={{ px: 1.5, py: 0.6, borderTop: "1px solid #eef0f3", display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.64rem", color: MUTED }}>{m.competitor_name} price <b>{fmtDate(m.competitor_product.price_scraped_at)}</b></Typography>
        <Typography sx={{ fontSize: "0.64rem", color: MUTED }}>APSO prices <b>{fmtDate(m.apso_product.prices_updated_at)}</b></Typography>
        {m.competitor_product.in_stock != null && <Typography sx={{ fontSize: "0.64rem", color: m.competitor_product.in_stock ? GOOD : BAD, fontWeight: 700 }}>{m.competitor_product.in_stock ? "In stock" : "Out of stock"}</Typography>}
      </Box>
    </Card>
  );
}

// ── Match breakdown, per product type (the weights the matcher really uses) ──────────
type Fam = "oring" | "plate" | "tube" | "bar";
const FAMILIES: Record<Fam, { label: string; keys: [string, string][] }> = {
  oring: { label: "O-ring / seal", keys: [["material", "Material"], ["inner_dia", "Inner Ø"], ["cord_dia", "Cord Ø"], ["certifications", "Certification class"], ["hardness", "Hardness"]] },
  plate: { label: "Plate / sheet", keys: [["material", "Material"], ["thickness", "Thickness"], ["width", "Width"], ["length", "Length"], ["color", "Colour"], ["type", "Form"]] },
  tube: { label: "Tube", keys: [["material", "Material"], ["outer_dia", "Outer Ø"], ["inner_dia", "Inner Ø"], ["color", "Colour"]] },
  bar: { label: "Round bar", keys: [["material", "Material"], ["diameter", "Diameter"], ["certifications", "Certifications"], ["color", "Colour"], ["type", "Form"], ["length", "Length"]] },
};
export function familyOf(m: Match): Fam {
  const r = m.match_reasons || {};
  const t = m.apso_product.product_type || "";
  if ("cord_dia" in r || "hardness" in r || t === "o_ring" || t === "x_ring") return "oring";
  if ("thickness" in r || t === "plate") return "plate";
  if ("outer_dia" in r || t === "tube") return "tube";
  return "bar";
}
export function MatchBreakdown({ m }: { m: Match }) {
  const fam = familyOf(m);
  const F = FAMILIES[fam];
  const legacy = m.match_reasons && Object.values(m.match_reasons).some(v => typeof v !== "object");
  const known = new Set(F.keys.map(k => k[0]));
  const extra = Object.entries(m.match_reasons || {}).filter(([k, v]) => !known.has(k) && typeof v === "object") as [string, MatchReason][];
  const machine = num(m.machine_confidence) ?? num(m.confidence_score) ?? 0;
  const row = (key: string, label: string, r: MatchReason | null) => {
    const info = r && r.weight === 0;
    const pts = r ? Math.round(r.score * r.weight) : 0;
    const okCol = !r ? "#bdc1c6" : info ? MUTED : r.score >= 1 ? GOOD : r.score >= 0.8 ? AMBER : BAD;
    return (
      <Box key={key} sx={{ display: "grid", gridTemplateColumns: "118px 64px 1fr", gap: 1, alignItems: "center", py: 0.45, borderBottom: "1px solid #f2f4f6" }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1a1d21" }}>{label}</Typography>
        <Box>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: okCol, fontFamily: "monospace" }}>{!r ? "not compared" : info ? "info" : `${pts} / ${r.weight}`}</Typography>
          {r && !info && <Box sx={{ height: 3, bgcolor: "#eef0f3", borderRadius: 2, mt: 0.3 }}><Box sx={{ height: 3, width: `${Math.max(0, Math.min(1, r.score)) * 100}%`, bgcolor: okCol, borderRadius: 2 }} /></Box>}
        </Box>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r ? <><b style={{ color: "#1a1d21" }}>{r.apso || "—"}</b> vs <b style={{ color: NAVY }}>{r.comp || "—"}</b></> : "—"}
        </Typography>
      </Box>
    );
  };
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "#e3e7eb" }}>
      <Box sx={{ px: 1.5, py: 0.9, bgcolor: "#eef2f6", display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>Match breakdown</Typography>
        <Chip size="small" label={F.label} sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, bgcolor: "#fff", color: NAVY }} />
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: confStyle(machine).color }}>machine {Math.round(machine)}%</Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 0.5 }}>
        {legacy ? <Typography sx={{ fontSize: "0.72rem", color: MUTED, py: 0.6 }}>Linked by hand — no machine breakdown.</Typography> : (
          <>
            {F.keys.map(([k, label]) => row(k, label, reasonOf(m, k)))}
            {extra.map(([k, r]) => row(k, k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), r))}
          </>
        )}
      </Box>
    </Card>
  );
}

/** Side-by-side attributes — only the ones that define this product type. */
export function AttributeCompare({ m }: { m: Match }) {
  const a = m.apso_product, c = m.competitor_product;
  const fam = familyOf(m);
  const ok = (k: string) => { const r = reasonOf(m, k); return r && r.weight > 0 ? r.score >= 1 : null; };
  const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  const dimRow = (label: string, key: string, av: unknown, cv: unknown) => ({ label, apso: fmtMm(av) || (reasonOf(m, key)?.apso ? `${reasonOf(m, key)!.apso} mm` : "—"), comp: fmtMm(cv) || (reasonOf(m, key)?.comp ? `${reasonOf(m, key)!.comp} mm` : "—"), match: ok(key) });
  const rows: { label: string; apso: React.ReactNode; comp: React.ReactNode; match: boolean | null }[] = [
    { label: "Article / ref", apso: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{a.article_number}</span>, comp: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.external_ref}</span>, match: null },
    { label: "Description", apso: a.description, comp: c.product_name, match: null },
    { label: "Material", apso: txt(a.material).toUpperCase(), comp: txt(c.material).toUpperCase(), match: ok("material") },
  ];
  if (fam === "oring") rows.push(
    dimRow("Inner Ø", "inner_dia", null, c.inner_diameter_mm),
    dimRow("Cord Ø", "cord_dia", null, c.cord_diameter_mm),
    { label: "Hardness", apso: txt(a.hardness || reasonOf(m, "hardness")?.apso), comp: txt(c.hardness), match: ok("hardness") },
    { label: "Certification", apso: txt(a.conformities || reasonOf(m, "certifications")?.apso), comp: txt(c.certifications || reasonOf(m, "certifications")?.comp), match: ok("certifications") },
  );
  if (fam === "plate") rows.push(dimRow("Thickness", "thickness", a.thickness, c.thickness), dimRow("Width", "width", a.width, c.width), dimRow("Length", "length", a.length, c.length));
  if (fam === "tube") rows.push(dimRow("Outer Ø", "outer_dia", a.diameter, c.outer_diameter_mm ?? c.diameter), dimRow("Inner Ø", "inner_dia", null, c.inner_diameter_mm));
  if (fam === "bar") rows.push(dimRow("Diameter", "diameter", a.diameter, c.diameter), dimRow("Length", "length", a.length, c.length));
  rows.push({ label: "Colour", apso: txt(a.color), comp: txt(c.color), match: ok("color") });
  if (fam !== "oring" && (a.conformities || c.certifications)) rows.push({ label: "Certifications", apso: txt(a.conformities), comp: txt(c.certifications), match: ok("certifications") });
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "#e3e7eb" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "112px 1fr 1fr", bgcolor: "#eef2f6", px: 1.5, py: 0.7 }}>
        {["", "APSO", m.competitor_name].map((h, i) => <Typography key={i} sx={{ fontSize: "0.7rem", fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>{h}</Typography>)}
      </Box>
      {rows.map((r, i) => (
        <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "112px 1fr 1fr", gap: 1, px: 1.5, py: 0.45, bgcolor: i % 2 ? "#fafbfc" : "#fff",
          borderLeft: `3px solid ${r.match === true ? GOOD : r.match === false ? BAD : "transparent"}` }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>{r.label}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: "#1a1d21" }}>{r.apso}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: "#1a1d21" }}>{r.comp}</Typography>
        </Box>
      ))}
    </Card>
  );
}

/** Who qualified this match, how and when — plus where the article sits. */
export function QualificationCard({ m }: { m: Match }) {
  const a = m.apso_product;
  const line = (k: string, v: React.ReactNode) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.3, borderBottom: "1px solid #f2f4f6" }}>
      <Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 600 }}>{k}</Typography>
      <Typography sx={{ fontSize: "0.72rem", color: "#1a1d21", fontWeight: 600, textAlign: "right" }}>{v}</Typography>
    </Box>
  );
  const machine = num(m.machine_confidence);
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "#e3e7eb" }}>
      <Box sx={{ px: 1.5, py: 0.9, bgcolor: "#eef2f6" }}><Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>Qualification</Typography></Box>
      <Box sx={{ px: 1.5, py: 0.6 }}>
        {line("Status", m.approved ? (m.approved_by_person ? (m.match_type === "manual" ? "Linked by hand" : "Approved by a person") : "Auto-approved (100%)") : "Pending review")}
        {m.approved && line("By", m.approved_by_person ? (m.approved_by || "—") : "Matcher")}
        {m.approved && line("When", fmtDateTime(m.approved_at))}
        {line("Confidence", `${Math.round(num(m.confidence_score) ?? 0)}%${machine != null && m.approved_by_person ? ` (machine ${Math.round(machine)}%)` : ""}`)}
        {line("First seen", fmtDateTime(m.created_at))}
        {m.approved_sibling && line(`Also approved`, `${m.competitor_name} ${m.approved_sibling.ref}`)}
        {m.xref_code && line("XREF", m.xref_code)}
        {line("Mandant", a.mandant)}
        {line("Product group", a.product_description || a.product_number || "—")}
        {line("Sub group", a.sub_group_description || a.sub_group_number || "—")}
        {line("Stock · MOQ", `${a.stock ?? "—"} · ${a.moq ?? "—"}`)}
        {a.budget_class && line("Budget class", <span style={{ color: BAD }}>{a.budget_class}</span>)}
      </Box>
    </Card>
  );
}

/** The whole detail of one match (used in the pop-up and in the in-row drop-down). */
export function MatchDetail({ m }: { m: Match }) {
  return (
    <Box sx={{ p: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.25fr 1fr 0.8fr" }, gap: 1.5, alignItems: "start" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
        <AttributeCompare m={m} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
        <PriceCompare m={m} />
        <MatchBreakdown m={m} />
      </Box>
      <QualificationCard m={m} />
    </Box>
  );
}

// ── Freshness strip: APSO prices + last scrape per supplier ─────────────────────────
interface Freshness {
  apso: { prices_updated_at: string | null; articles: number; updated_recently: number };
  suppliers: { id: number; code: string; name: string; scraper_enabled: boolean; last_status: string | null; last_run_at: string | null; last_found: number | null; last_error: string | null; prices_at: string | null; matches: number }[];
}
const ageColor = (d: number | null) => (d == null ? "#9aa1ab" : d <= 14 ? GOOD : d <= 45 ? AMBER : BAD);
export function FreshnessStrip({ competitorIds }: { competitorIds?: string[] }) {
  const [f, setF] = useState<Freshness | null>(null);
  const [sync, setSync] = useState<{ running: boolean; status?: string } | null>(null);
  const load = useCallback((fresh = false) => {
    fetch(`${API_URL}/api/matching/freshness${fresh ? "?fresh=1" : ""}`).then(r => (r.ok ? r.json() : null)).then(j => j && setF(j)).catch(() => {});
  }, []);
  useEffect(() => { load(); fetch(`${API_URL}/api/products/sync/status`).then(r => r.json()).then(s => s?.running && setSync({ running: true, status: s.status })).catch(() => {}); }, [load]);
  // While the HubSpot sync runs, follow it; when it ends, reload the dates.
  useEffect(() => {
    if (!sync?.running) return;
    const t = setInterval(async () => {
      const s = await fetch(`${API_URL}/api/products/sync/status`).then(r => r.json()).catch(() => null);
      if (!s || !s.running) { setSync(s ? { running: false, status: s.status } : null); load(true); }
      else setSync({ running: true, status: s.status });
    }, 4000);
    return () => clearInterval(t);
  }, [sync?.running, load]);
  const startSync = async () => {
    setSync({ running: true, status: "Starting…" });
    try { await fetch(`${API_URL}/api/products/sync`, { method: "POST" }); } catch { setSync({ running: false, status: "Could not start" }); }
  };
  const sups = (f?.suppliers || []).filter(s => (competitorIds && competitorIds.length ? competitorIds.includes(String(s.id)) : s.matches > 0));
  const apsoAge = daysAgo(f?.apso.prices_updated_at);
  return (
    <Card sx={{ mb: 2, border: "1px solid #ececec", borderRadius: 2, px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em" }}>APSO prices</Typography>
      <Chip size="small" label={fmtDateTime(f?.apso.prices_updated_at)} sx={{ height: 22, fontSize: "0.68rem", fontWeight: 800, bgcolor: "#f1f5f8", color: ageColor(apsoAge) }} />
      <Tooltip title="Re-reads every article and its M100 / M110 prices from HubSpot" arrow>
        <span>
          <Button size="small" variant="outlined" disabled={!!sync?.running} onClick={startSync}
            startIcon={sync?.running ? <CircularProgress size={13} /> : <SyncIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.7rem", py: 0.1, borderColor: NAVY, color: NAVY }}>
            {sync?.running ? (sync.status || "Updating…") : "Update from HubSpot"}
          </Button>
        </span>
      </Tooltip>
      <Box sx={{ width: "1px", height: 20, bgcolor: "#e3e7eb", mx: 0.5 }} />
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em" }}>Last scrape</Typography>
      {sups.map(s => {
        const runAge = daysAgo(s.last_run_at), priceAge = daysAgo(s.prices_at);
        const stale = s.prices_at && s.last_run_at && new Date(s.prices_at) < new Date(s.last_run_at) && (priceAge ?? 0) > 2;
        return (
          <Tooltip key={s.id} arrow title={<span style={{ whiteSpace: "pre-line" }}>{`${s.name}\nLast run ${fmtDateTime(s.last_run_at)} · ${s.last_status || "—"} · ${s.last_found ?? 0} products\nPrices stored ${fmtDateTime(s.prices_at)}${s.last_error ? `\n${s.last_error}` : ""}\n${s.matches.toLocaleString()} matches`}</span>}>
            <Chip size="small" label={<span><b>{s.name}</b> {s.last_run_at ? fmtDayMonth(s.last_run_at) : "no run"}{stale ? <span style={{ color: AMBER }}> · prices {fmtDayMonth(s.prices_at)}</span> : null}</span>}
              sx={{ height: 22, fontSize: "0.66rem", bgcolor: "#fff", border: `1px solid ${ageColor(stale ? priceAge : runAge)}`, color: "#1a1d21" }} />
          </Tooltip>
        );
      })}
      {f && sups.length === 0 && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>—</Typography>}
    </Card>
  );
}

// ── Settings (gear): run matching, remove machine matches, clear all ────────────────
interface Progress { running: boolean; stopping?: boolean; processed: number; matched: number; auto_approved: number; review: number; status: string }
export function MatchingSettings({ competitors, onChanged }: { competitors: Competitor[]; onChanged: (msg: string, error?: boolean) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "auto" | "all">(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [runMandant, setRunMandant] = useState<"M100" | "M110">("M100");
  const [autoApprove, setAutoApprove] = useState(100);
  const [minConfidence, setMinConfidence] = useState(70);
  const [comps, setComps] = useState<number[]>([]);
  const poll = useCallback(() => fetch(`${API_URL}/api/matching/status`).then(r => r.json()).then(setProgress).catch(() => {}), []);
  useEffect(() => { poll(); }, [poll]);
  useEffect(() => { if (!progress?.running) return; const t = setInterval(poll, 3000); return () => clearInterval(t); }, [progress?.running, poll]);
  const run = async () => {
    setRunOpen(false);
    const r = await fetch(`${API_URL}/api/matching/run`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandant: runMandant, auto_approve: autoApprove, min_confidence: minConfidence, competitor_ids: comps }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    onChanged(j.message || (r?.ok ? "Matching started" : "Could not start matching"), !r?.ok);
    poll();
  };
  const stop = async () => { await fetch(`${API_URL}/api/matching/stop`, { method: "POST" }).catch(() => {}); poll(); };
  const doClear = async () => {
    if (!confirm) return;
    setBusy(true);
    const r = await fetch(`${API_URL}/api/matching/${confirm}`, { method: "DELETE" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setConfirm(null); setTyped("");
    onChanged(r?.ok ? `Removed ${Number(j.deleted || 0).toLocaleString()} matches` : "Removal failed", !r?.ok);
  };
  return (
    <>
      {progress?.running && (
        <Chip size="small" icon={<CircularProgress size={12} sx={{ color: NAVY }} />} onDelete={stop} deleteIcon={<Tooltip title="Stop"><StopIcon /></Tooltip>}
          label={`Matching · ${progress.processed.toLocaleString()} done · ${progress.matched.toLocaleString()} matched`}
          sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "#e8f0f4", color: NAVY }} />
      )}
      <Tooltip title="Matching settings"><IconButton onClick={e => setAnchor(e.currentTarget)} sx={{ border: "1px solid #d8dce1", borderRadius: 1.5, color: NAVY }}><SettingsIcon fontSize="small" /></IconButton></Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem disabled={!!progress?.running} onClick={() => { setAnchor(null); setRunOpen(true); }}>
          <ListItemIcon><PlayArrowIcon fontSize="small" sx={{ color: NAVY }} /></ListItemIcon><ListItemText primary="Run matching…" secondary="Competitors, mandant, thresholds" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); setConfirm("auto"); }}>
          <ListItemIcon><DeleteSweepIcon fontSize="small" sx={{ color: AMBER }} /></ListItemIcon><ListItemText primary="Remove machine matches" secondary="Keeps everything a person approved or linked" />
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); setConfirm("all"); }}>
          <ListItemIcon><DeleteForeverIcon fontSize="small" sx={{ color: RED }} /></ListItemIcon><ListItemText primary="Clear all matches" secondary="Every match, including people's approvals" />
        </MenuItem>
      </Menu>

      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: confirm === "all" ? RED : AMBER, px: 2.5, py: 1.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, color: "#fff" }}>{confirm === "all" ? "Clear all matches" : "Remove machine matches"}</Typography>
        </Box>
        <DialogContent sx={{ pt: "16px !important" }}>
          <Typography sx={{ fontSize: "0.84rem", mb: 1.5 }}>
            {confirm === "all" ? "Deletes every match, also the ones people approved. The approval log stays." : "Deletes the matcher's own matches that no person approved. Approved and hand-linked matches stay."}
          </Typography>
          {confirm === "all" && <TextField size="small" fullWidth label='Type "clear" to confirm' value={typed} onChange={e => setTyped(e.target.value)} />}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={busy || (confirm === "all" && typed.trim().toLowerCase() !== "clear")} onClick={doClear}
            sx={{ textTransform: "none", fontWeight: 700, bgcolor: confirm === "all" ? RED : AMBER, "&:hover": { bgcolor: confirm === "all" ? "#c41527" : "#a86400" } }}>
            {busy ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={runOpen} onClose={() => setRunOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: NAVY, px: 2.5, py: 1.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>Run matching</Typography>
        </Box>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "18px !important" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Mandant</InputLabel>
            <Select value={runMandant} label="Mandant" onChange={e => setRunMandant(e.target.value as "M100" | "M110")}>
              <MenuItem value="M100">M100 — CH (CHF)</MenuItem>
              <MenuItem value="M110">M110 — DE (EUR)</MenuItem>
            </Select>
          </FormControl>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, flex: 1 }}>Competitors {comps.length ? `(${comps.length})` : "(by profit center)"}</Typography>
              <Button size="small" onClick={() => setComps(competitors.map(c => c.id))} sx={{ fontSize: "0.66rem", textTransform: "none" }}>All</Button>
              <Button size="small" onClick={() => setComps([])} sx={{ fontSize: "0.66rem", textTransform: "none", color: RED }}>None</Button>
            </Box>
            <Box sx={{ p: 1, border: "1px solid #ececec", borderRadius: 1.5, maxHeight: 220, overflow: "auto" }}>
              <FormGroup sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {competitors.map(c => (
                  <FormControlLabel key={c.id} label={<Typography sx={{ fontSize: "0.78rem" }}>{c.name}</Typography>}
                    control={<Checkbox size="small" checked={comps.includes(c.id)} onChange={e => setComps(e.target.checked ? [...comps, c.id] : comps.filter(i => i !== c.id))} sx={{ py: 0.25 }} />} />
                ))}
              </FormGroup>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField size="small" type="number" label="Auto-approve at %" value={autoApprove} onChange={e => setAutoApprove(parseInt(e.target.value) || 100)} sx={{ flex: 1 }} />
            <TextField size="small" type="number" label="Keep from %" value={minConfidence} onChange={e => setMinConfidence(parseInt(e.target.value) || 70)} sx={{ flex: 1 }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setRunOpen(false)} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disableElevation startIcon={<PlayArrowIcon />} onClick={run} sx={{ textTransform: "none", fontWeight: 700, bgcolor: NAVY, "&:hover": { bgcolor: "#1d3a4d" } }}>Run</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Multi-select competitor filter (value = comma-joined ids, "" = all). */
export function CompetitorFilter({ value, onChange, competitors, width = 170 }: { value: string; onChange: (csv: string) => void; competitors: Competitor[]; width?: number }) {
  const sel = value ? value.split(",").filter(Boolean) : [];
  return (
    <FormControl size="small" sx={{ minWidth: width, maxWidth: 260 }}>
      <InputLabel>Competitor</InputLabel>
      <Select multiple value={sel} label="Competitor"
        onChange={e => { const v = e.target.value; onChange((typeof v === "string" ? v.split(",") : v).filter(Boolean).join(",")); }}
        renderValue={s => (s as string[]).map(id => competitors.find(c => String(c.id) === id)?.name || id).join(", ")}>
        {competitors.map(c => (
          <MenuItem key={c.id} value={String(c.id)} dense>
            <Checkbox size="small" checked={sel.includes(String(c.id))} sx={{ p: 0.4, mr: 0.5 }} />
            <ListItemText primaryTypographyProps={{ fontSize: "0.82rem" }}>{c.name}</ListItemText>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
