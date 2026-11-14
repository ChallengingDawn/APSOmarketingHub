"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, Legend, ReferenceLine,
} from "recharts";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const RED = "#ed1b2f", NAVY = "#274e64", GOOD = "#1e8e3e", BAD = "#c5221f", WARN = "#e08e0b";
const PALETTE = ["#274e64", "#ed1b2f", "#e8a13a", "#2e7d4f", "#7b5ea7", "#3a8fb7", "#c0566f", "#6b8e23", "#b5651d", "#5c6bc0", "#00897b", "#8d6e63"];
const MARKETS: { m: "M100" | "M110"; cur: string }[] = [{ m: "M100", cur: "CHF" }, { m: "M110", cur: "EUR" }];

// ── helpers ──────────────────────────────────────────────────────────────
const num = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const ML: Record<string, string> = { pe_hd: "PE-HD", pe_uhmw: "PE-UHMW", pom_c: "POM-C", pom_h: "POM-H", pa6: "PA6", pa66: "PA66", pa6_g: "PA6-G", ptfe: "PTFE", peek: "PEEK", pvc: "PVC", pmma: "PMMA", pet: "PET", nbr: "NBR", hnbr: "HNBR", fkm: "FKM", ffkm: "FFKM", epdm: "EPDM", vmq: "VMQ", cr: "CR" };
const matLabel = (m: string | null) => (m ? (ML[m.toLowerCase()] || m.toUpperCase().replace(/_/g, "-")) : "—");
const isJunkMat = (m: string) => !m || /^[\d.]/.test(m) || /steel|sleeve|wafer|spring|conti|isoran/i.test(m);
const pct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const fmtInt = (v: number) => v.toLocaleString();
const round1 = (v: number) => Math.round(v * 10) / 10;
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, async () => { while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx]); } }));
  return ret;
}

// ── types ────────────────────────────────────────────────────────────────
type Pos = { material: string; matches: number; avg: number; cheaper: number; pricier: number };
type StockR = { material: string; apso_products: number; apso_in_stock: number; apso_total_stock: number };
type ByComp = { material: string; code: string; name: string; products: number; in_stock: number };
type Comp = { id: number; code: string; name: string; currency: string };
type Trend = { code: string; name: string; months: number; latest: number | null; delta: number | null; points: Record<string, number> };
type MarketData = { market: "M100" | "M110"; currency: string; pos: Pos[]; trends: Trend[] };
type Report = { stockAll: StockR[]; byCompAll: ByComp[]; compCur: Record<string, string>; markets: MarketData[] };

// ════════════════════════════════════════════════════════════════════════
function ReportInner() {
  const sp = useSearchParams();
  const filterKeys = ["material", "product_group", "profit_center", "assortment", "main_group", "sub_group"] as const;
  const activeFilters = filterKeys.map(k => [k, sp.get(k)] as const).filter(([, v]) => v);
  const fq = useMemo(() => { const p = new URLSearchParams(); activeFilters.forEach(([k, v]) => p.set(k, v!)); return p.toString(); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const [d, setD] = useState<Report | null>(null);
  const [err, setErr] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const generatedAt = useMemo(() => new Date().toLocaleString("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }), []);

  // The browser's own print - to paper, or "Save as PDF": the print styles below lay the report out on A4, a market to a
  // page. The PricingHub drew it into a picture first (html2canvas-pro, not part of the hub); printed, the text stays
  // text and can be searched and copied in the PDF.
  function downloadPdf() { window.print(); }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = (u: string) => fetch(u).then(r => r.json()).catch(() => ({}));
        const [st, comps] = await Promise.all([
          j(`${API_URL}/api/analytics/stock?${fq}`),
          j(`${API_URL}/api/competitors`).then((x) => Array.isArray(x) ? x : []),
        ]);
        const compCur: Record<string, string> = {}; (comps as Comp[]).forEach(c => { compCur[c.code] = c.currency; });
        const stockAll: StockR[] = (st.data || []).map((r: Record<string, unknown>) => ({ material: String(r.material), apso_products: num(r.apso_products), apso_in_stock: num(r.apso_in_stock), apso_total_stock: num(r.apso_total_stock) })).filter((r: StockR) => !isJunkMat(r.material));
        const byCompAll: ByComp[] = (st.by_competitor || []).map((r: Record<string, unknown>) => ({ material: String(r.material), code: String(r.code), name: String(r.name), products: num(r.products), in_stock: num(r.in_stock) })).filter((r: ByComp) => !isJunkMat(r.material));

        const markets: MarketData[] = [];
        for (const { m, cur } of MARKETS) {
          const op = new URLSearchParams(); activeFilters.forEach(([k, v]) => op.set(k, v!)); op.set("mandant", m);
          const ov = await j(`${API_URL}/api/analytics/overview?${op.toString()}`);
          const pos: Pos[] = (ov.position || []).map((r: Record<string, unknown>) => ({ material: String(r.material), matches: num(r.matches), avg: num(r.avg_position_pct), cheaper: num(r.cheaper_count), pricier: num(r.expensive_count) })).filter((r: Pos) => !isJunkMat(r.material));
          // Trend: average list price per scrape, indexed to first scrape = 100 (two points: 2025 → Jun 2026)
          const mComps = (comps as Comp[]).filter(c => c.currency === cur);
          const trends: Trend[] = (await mapLimit(mComps, 4, async (c) => {
            const idx = await j(`${API_URL}/api/scrapers/${c.code}/price-index`);
            const months: string[] = idx.months || [];
            const avg: Record<string, number> = idx.avgByMonth || {};
            const ms = months.filter(mo => avg[mo] != null);
            const v0 = ms.length ? avg[ms[0]] : null;
            const points: Record<string, number> = {};
            if (v0) for (const mo of ms) points[mo] = round1((avg[mo] / v0) * 100);
            const latest = ms.length >= 2 && v0 ? points[ms[ms.length - 1]] : null;
            const delta = latest != null ? round1(latest - 100) : null;
            return { code: c.code, name: c.name, months: ms.length, latest, delta, points } as Trend;
          })).filter(t => t.months > 0).sort((a, b) => (b.latest != null ? 1 : 0) - (a.latest != null ? 1 : 0) || b.months - a.months);
          markets.push({ market: m, currency: cur, pos, trends });
        }
        if (alive) setD({ stockAll, byCompAll, compCur, markets });
      } catch { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, [fq]);

  if (err) return <Box sx={{ p: 6, textAlign: "center", color: "#9aa1ab" }}>Couldn&apos;t load the report data. Make sure you&apos;re signed in, then reload.</Box>;
  if (!d) return <Box sx={{ height: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}><CircularProgress sx={{ color: RED }} /><Typography sx={{ color: "#5b6470", fontWeight: 600 }}>Building report — M100 &amp; M110…</Typography></Box>;

  const filterLabel = activeFilters.length ? activeFilters.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ") : "Full catalogue";

  return (
    <Box className="report-root" sx={{ bgcolor: "#eef0f3", minHeight: "100vh", py: { xs: 0, md: 4 }, "@media print": { bgcolor: "#fff", py: 0 } }}>
      <style>{`
        @page { size: A4; margin: 13mm 12mm 16mm 12mm; }
        @media print {
          body * { visibility: hidden; }
          .report-root, .report-root * { visibility: visible; }
          .report-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .report-paper { box-shadow: none !important; margin: 0 !important; width: auto !important; }
          .sheet { break-inside: avoid; }
          .page-break { break-before: page; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
        }
      `}</style>

      <Box className="no-print" sx={{ position: "fixed", top: 16, right: 16, zIndex: 50, display: "flex", gap: 1 }}>
        <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={downloadPdf}
          sx={{ bgcolor: RED, fontWeight: 800, textTransform: "none", boxShadow: "0 6px 18px rgba(237,27,47,0.35)", "&:hover": { bgcolor: "#c5152a" }, "&.Mui-disabled": { bgcolor: "#e88", color: "#fff" } }}>
          Print / save as PDF
        </Button>
      </Box>

      <Box ref={paperRef} className="report-paper" sx={{ maxWidth: 820, mx: "auto", bgcolor: "#fff", boxShadow: "0 4px 30px rgba(0,0,0,0.10)", borderRadius: { xs: 0, md: 1 }, overflow: "hidden", "@media print": { maxWidth: "100%" } }}>

        {/* ───────── COVER — Swiss grid ───────── */}
        <Box className="sheet" sx={{ position: "relative", overflow: "hidden", bgcolor: "#fff", borderBottom: "1px solid #e6e8ec", px: 5, py: 5.5 }}>
          {["33%", "66%"].map(l => <Box key={l} sx={{ position: "absolute", top: 0, bottom: 0, left: l, width: "1px", bgcolor: "#eef1f4", pointerEvents: "none" }} />)}
          <Box sx={{ position: "absolute", left: 0, right: 0, top: "50%", height: "1px", bgcolor: "#eef1f4", pointerEvents: "none" }} />
          <Box sx={{ position: "absolute", top: 34, right: 42, width: 30, height: 30, "&::before": { content: '""', position: "absolute", left: 0, top: 13, width: 30, height: 4, bgcolor: RED }, "&::after": { content: '""', position: "absolute", left: 13, top: 0, width: 4, height: 30, bgcolor: RED } }} />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, mb: 2.6 }}>
              <Box sx={{ bgcolor: RED, color: "#fff", fontFamily: "var(--font-outfit), sans-serif", fontWeight: 900, fontSize: "0.82rem", letterSpacing: "0.01em", px: 0.9, py: 0.35, borderRadius: 0.8, lineHeight: 1 }}>APSO</Box>
              <Typography sx={{ color: "#1a1d21", fontWeight: 800, letterSpacing: "0.2em", fontSize: "0.7rem", textTransform: "uppercase" }}>Pricing Intelligence</Typography>
            </Box>
            <Typography sx={{ color: "#111", fontFamily: "var(--font-inter), sans-serif", fontWeight: 800, fontSize: "2.4rem", lineHeight: 1.03, letterSpacing: "-0.035em", mb: 1.4 }}>Competitive Pricing<br />&amp; Stock Report</Typography>
            <Box sx={{ width: 56, height: 2, bgcolor: RED, mb: 1.7 }} />
            <Typography sx={{ color: "#5b6470", fontSize: "0.9rem", maxWidth: 540, lineHeight: 1.5 }}>Where APSO stands on price and availability against tracked competitors — and how their prices are trending. Covers both markets.</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", mt: 4 }}>
              {[["Markets", "M100 · CHF + M110 · EUR"], ["Scope", filterLabel], ["Generated", generatedAt]].map(([k, v], i, arr) => (
                <Box key={k} sx={{ pr: 3, mr: 3, borderRight: i < arr.length - 1 ? "1px solid #e6e8ec" : "none" }}>
                  <Typography sx={{ color: "#9aa1ab", fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", mb: 0.4 }}>{k}</Typography>
                  <Typography sx={{ color: "#1a1d21", fontSize: "0.86rem", fontWeight: 700 }}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* one full report body per market — first flows under the cover, later ones start a fresh page */}
        {d.markets.map((md, i) => <MarketSection key={md.market} md={md} first={i === 0} stockAll={d.stockAll} byCompAll={d.byCompAll} compCur={d.compCur} />)}

        <Box sx={{ px: 5, py: 2.5, borderTop: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.62rem", color: "#9aa1ab" }}>APSO Pricing Intelligence · Confidential — internal use only</Typography>
          <Typography sx={{ fontSize: "0.62rem", color: "#9aa1ab" }}>{generatedAt}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── one market's full body (KPIs + pricing + stock + trend) ───────────────
function MarketSection({ md, stockAll, byCompAll, compCur, first }: { md: MarketData; stockAll: StockR[]; byCompAll: ByComp[]; compCur: Record<string, string>; first?: boolean }) {
  const { market, currency, pos, trends } = md;
  const byCompM = byCompAll.filter(c => compCur[c.code] === currency);
  const compInStock = new Map<string, number>(); byCompM.forEach(c => compInStock.set(c.material, (compInStock.get(c.material) || 0) + c.in_stock));

  // KPIs
  const M = pos.reduce((s, r) => s + r.matches, 0);
  const wAvg = M ? pos.reduce((s, r) => s + r.avg * r.matches, 0) / M : 0;
  const cheaper = pos.reduce((s, r) => s + r.cheaper, 0);
  const pricier = pos.reduce((s, r) => s + r.pricier, 0);
  const apsoArt = stockAll.reduce((s, r) => s + r.apso_products, 0);
  const apsoIn = stockAll.reduce((s, r) => s + r.apso_in_stock, 0);
  const inStockPct = apsoArt ? (apsoIn / apsoArt) * 100 : 0;
  const gap = stockAll.map(r => ({ m: r.material, g: (compInStock.get(r.material) || 0) - r.apso_in_stock })).sort((a, b) => b.g - a.g)[0];
  const tCount = trends.filter(t => t.latest != null).length;

  // charts
  const posChart = pos.slice(0, 14).map(r => ({ material: matLabel(r.material), avg: Math.max(-150, Math.min(150, round1(r.avg))) })).sort((a, b) => a.avg - b.avg);
  const covByMat = new Map<string, Record<string, number>>();
  byCompM.forEach(c => { const o = covByMat.get(c.material) || {}; o[c.code] = (o[c.code] || 0) + c.in_stock; covByMat.set(c.material, o); });
  const covMats = [...stockAll].sort((a, b) => b.apso_in_stock - a.apso_in_stock).slice(0, 8);
  const covChart = covMats.map(s => ({ material: matLabel(s.material), apso: s.apso_in_stock, ...(covByMat.get(s.material) || {}) }));
  const covTotals = new Map<string, number>(); byCompM.forEach(c => { if (covMats.some(m => m.material === c.material)) covTotals.set(c.code, (covTotals.get(c.code) || 0) + c.in_stock); });
  const covComps = [...new Map(byCompM.map(c => [c.code, c.name])).entries()].map(([code, name], i) => ({ code, name, color: PALETTE[(i + 1) % PALETTE.length] })).filter(c => (covTotals.get(c.code) || 0) > 0);

  // trend — exactly two points: 2025 and Jun 2026
  const trendSeries = trends.filter(t => Object.keys(t.points).length >= 2).map((t, i) => ({ code: t.code, name: t.name, color: PALETTE[i % PALETTE.length], latest: t.latest || 100 }));
  const trendChart = [
    { label: "2025", ...Object.fromEntries(trendSeries.map(s => [s.code, 100])) },
    { label: "Jun 2026", ...Object.fromEntries(trendSeries.map(s => [s.code, s.latest])) },
  ];

  return (
    <>
      {/* per-market banner — first flows under the cover; later markets start a fresh page */}
      <Box className={`sheet${first ? "" : " page-break"}`} sx={{ position: "relative", overflow: "hidden", bgcolor: "#fff", borderBottom: "1px solid #e6e8ec", px: 5, py: 5 }}>
        {["33%", "66%"].map(l => <Box key={l} sx={{ position: "absolute", top: 0, bottom: 0, left: l, width: "1px", bgcolor: "#eef1f4", pointerEvents: "none" }} />)}
        <Box sx={{ position: "absolute", top: 30, right: 42, width: 28, height: 28, "&::before": { content: '""', position: "absolute", left: 0, top: 12, width: 28, height: 4, bgcolor: RED }, "&::after": { content: '""', position: "absolute", left: 12, top: 0, width: 4, height: 28, bgcolor: RED } }} />
        <Box sx={{ position: "absolute", right: 26, bottom: -14, fontFamily: "var(--font-outfit), sans-serif", fontWeight: 900, fontSize: "4.6rem", color: "#f1f3f5", letterSpacing: "-0.05em", lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>{market}</Box>
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, mb: 2.2 }}>
            <Box sx={{ bgcolor: RED, color: "#fff", fontFamily: "var(--font-outfit), sans-serif", fontWeight: 900, fontSize: "0.78rem", px: 0.85, py: 0.3, borderRadius: 0.8, lineHeight: 1 }}>APSO</Box>
            <Typography sx={{ color: "#1a1d21", fontWeight: 800, letterSpacing: "0.2em", fontSize: "0.66rem", textTransform: "uppercase" }}>Pricing Intelligence</Typography>
          </Box>
          <Typography sx={{ color: "#9aa1ab", fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", mb: 0.5 }}>Market report</Typography>
          <Typography sx={{ color: "#111", fontFamily: "var(--font-inter), sans-serif", fontWeight: 800, fontSize: "2.2rem", letterSpacing: "-0.03em", lineHeight: 1.05 }}>{market} · {currency}</Typography>
          <Box sx={{ width: 52, height: 2, bgcolor: RED, mt: 1.4, mb: 1.4 }} />
          <Typography sx={{ color: "#5b6470", fontSize: "0.88rem", maxWidth: 520, lineHeight: 1.5 }}>{market === "M100" ? "Swiss market (CHF)" : "European market (EUR)"} — price position, stock coverage and competitor price trend.</Typography>
        </Box>
      </Box>

      {/* exec KPIs */}
      <Box className="sheet" sx={{ px: 5, py: 3 }}>
        <SectionTitle n="01" title="Executive summary" />
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, mt: 2 }}>
          <Kpi label="Avg price position" value={pct1(wAvg)} hint={`${fmtInt(M)} matched articles`} color={wAvg <= 0 ? GOOD : BAD} />
          <Kpi label="Cheaper than rivals" value={`${(M ? cheaper / M * 100 : 0).toFixed(0)}%`} hint={`${fmtInt(cheaper)} articles we win on price`} color={GOOD} />
          <Kpi label="More expensive" value={`${(M ? pricier / M * 100 : 0).toFixed(0)}%`} hint={`${fmtInt(pricier)} articles priced above`} color={BAD} />
          <Kpi label="APSO in-stock" value={`${inStockPct.toFixed(0)}%`} hint={`across ${stockAll.length} materials`} color={inStockPct >= 60 ? GOOD : WARN} />
          <Kpi label="Biggest stock gap" value={gap ? matLabel(gap.m) : "—"} hint={gap ? `${fmtInt(gap.g)} more in-stock at a ${currency} rival` : ""} color={WARN} />
          <Kpi label="Competitors tracked" value={`${tCount}`} hint={`${currency} rivals with ≥2 scrapes`} color={NAVY} />
        </Box>
      </Box>

      {/* price position */}
      <Box className="sheet" sx={{ px: 5, py: 3 }}>
        <SectionTitle n="02" title="Price position by material" sub="How APSO's price compares to the average competitor (market) price, per material. Negative = we are cheaper." />
        {posChart.length ? (
          <Box sx={{ mt: 1 }}>
            <ResponsiveContainer width="100%" height={Math.max(200, posChart.length * 25)}>
              <BarChart data={posChart} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#5b6470" }} unit="%" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="material" tick={{ fontSize: 10, fill: "#1a1d21" }} width={70} axisLine={false} tickLine={false} />
                <RTooltip formatter={(v) => [pct1(Number(v)), "vs market avg"]} contentStyle={{ fontSize: 12 }} />
                <ReferenceLine x={0} stroke="#9aa1ab" />
                <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={16}>{posChart.map((r, i) => <Cell key={i} fill={r.avg <= 0 ? GOOD : BAD} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
            <DataTable head={["Material", "Matches", "vs market avg", "Cheaper", "Pricier"]} rows={pos.slice(0, 16).map(r => [
              matLabel(r.material), fmtInt(r.matches), { v: pct1(round1(r.avg)), c: r.avg <= 0 ? GOOD : BAD }, fmtInt(r.cheaper), fmtInt(r.pricier),
            ])} />
          </Box>
        ) : <Empty>No matched price data for {market}.</Empty>}
      </Box>

      {/* stock coverage */}
      <Box className="sheet" sx={{ px: 5, py: 3 }}>
        <SectionTitle n="03" title={`Stock coverage — APSO vs ${currency} competitors`} sub="In-stock article count per material; each competitor coloured." />
        {covChart.length ? (
          <Box sx={{ mt: 1 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={covChart} margin={{ top: 8, right: 8, bottom: 20, left: 0 }} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="material" tick={{ fontSize: 9, fill: "#5b6470" }} interval={0} angle={-20} textAnchor="end" height={42} tickLine={false} axisLine={{ stroke: "#e6e8ec" }} />
                <YAxis tick={{ fontSize: 10, fill: "#5b6470" }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="apso" name="APSO" fill={PALETTE[0]} radius={[2, 2, 0, 0]} maxBarSize={18} />
                {covComps.map(c => <Bar key={c.code} dataKey={c.code} name={c.name.split(" ")[0]} fill={c.color} radius={[2, 2, 0, 0]} maxBarSize={18} />)}
              </BarChart>
            </ResponsiveContainer>
            <DataTable head={["Material", "APSO in stock", "APSO articles", `${currency} comp. in stock`]} rows={stockAll.slice(0, 16).map(r => { const ci = compInStock.get(r.material) || 0; return [
              matLabel(r.material), fmtInt(r.apso_in_stock), fmtInt(r.apso_products), { v: fmtInt(ci), c: ci > r.apso_in_stock ? BAD : GOOD },
            ]; })} />
          </Box>
        ) : <Empty>No stock data for {currency} competitors.</Empty>}
      </Box>

      {/* price trend — two points */}
      <Box className="sheet" sx={{ px: 5, py: 3 }}>
        <SectionTitle n="04" title="Competitor price trend" sub="Average list price per scrape, indexed to the first scrape = 100. Two snapshots so far: 2025 → Jun 2026; above 100 = prices rose." />
        {trendSeries.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5b6470" }} padding={{ left: 30, right: 30 }} />
                <YAxis tick={{ fontSize: 10, fill: "#5b6470" }} width={40} domain={["auto", "auto"]} />
                <RTooltip formatter={(v, n) => [`Index ${v}`, n as string]} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <ReferenceLine y={100} stroke="#9aa1ab" strokeWidth={1.5} label={{ value: "100", position: "left", fontSize: 9, fill: "#9aa1ab" }} />
                {trendSeries.map(s => <Line key={s.code} type="linear" dataKey={s.code} name={s.name.split(" ")[0]} stroke={s.color} strokeWidth={2.2} dot={{ r: 4 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
        {trends.length ? (
          <DataTable head={["Competitor", "Scrapes", "Latest index", "Δ vs 2025"]} rows={trends.map(t => [
            t.name, `${t.months}`,
            t.latest != null ? { v: String(Math.round(t.latest)), c: t.latest > 100.5 ? BAD : t.latest < 99.5 ? GOOD : "#5b6470" } : { v: "—", c: "#9aa1ab" },
            t.delta != null ? { v: pct1(t.delta), c: t.delta > 0 ? BAD : t.delta < 0 ? GOOD : "#5b6470" } : { v: "needs 2nd scrape", c: "#9aa1ab" },
          ])} />
        ) : <Empty>No {currency} competitor price history yet.</Empty>}
        <Typography sx={{ fontSize: "0.68rem", color: "#9aa1ab", mt: 1.5 }}>Average price per scrape across each competitor&apos;s catalogue — directional only, as the basket differs between the two scrapes.</Typography>
      </Box>
    </>
  );
}

// ── presentational helpers ────────────────────────────────────────────────
function SectionTitle({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
        <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 800, fontSize: "0.9rem", color: RED, letterSpacing: "0.05em" }}>{n}</Typography>
        <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "#1a1d21" }}>{title}</Typography>
      </Box>
      {sub && <Typography sx={{ fontSize: "0.78rem", color: "#5b6470", mt: 0.4 }}>{sub}</Typography>}
      <Box sx={{ height: 2, bgcolor: "#eef0f3", mt: 1 }} />
    </Box>
  );
}
function Kpi({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <Box sx={{ border: "1px solid #e6e8ec", borderRadius: 1.5, p: 1.5, borderLeft: `4px solid ${color}` }}>
      <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#9aa1ab", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.7rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: "0.66rem", color: "#5b6470" }}>{hint}</Typography>
    </Box>
  );
}
type TCell = string | { v: string; c: string };
function DataTable({ head, rows }: { head: string[]; rows: TCell[][] }) {
  return (
    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 2, "& th": { fontSize: "0.62rem", fontWeight: 800, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right", p: "6px 8px", borderBottom: "1.5px solid #e6e8ec", bgcolor: "#f7f8f9" }, "& th:first-of-type, & td:first-of-type": { textAlign: "left" }, "& td": { fontSize: "0.74rem", p: "5px 8px", borderBottom: "1px solid #f0f1f3", textAlign: "right" } }}>
      <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => {
            const o = typeof c === "object" ? c : { v: c, c: j === 0 ? "#1a1d21" : "#3c4043" };
            return <td key={j} style={{ color: o.c, fontWeight: j === 0 ? 700 : 600, fontFamily: j === 0 ? undefined : "monospace" }}>{o.v}</td>;
          })}</tr>
        ))}
      </tbody>
    </Box>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <Box sx={{ py: 5, textAlign: "center", color: "#9aa1ab", fontSize: "0.82rem" }}>{children}</Box>;

export default function ReportPage() {
  return <Suspense fallback={<Box sx={{ height: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress sx={{ color: RED }} /></Box>}><ReportInner /></Suspense>;
}
