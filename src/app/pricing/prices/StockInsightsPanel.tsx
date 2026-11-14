"use client";
import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine, Legend,
} from "recharts";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const NAVY = "#274e64", RED = "#ed1b2f", GOOD = "#2e7d32", WARN = "#e65100", BAD = "#c5221f";

type Mat = { material: string; ptype: string | null; n: number; in_stock: number; units: number };
type CompMat = { material: string; ptype: string | null; code: string; name: string; n: number; in_stock: number };
type Lead = { code: string; name: string; n: number; in_stock: number; pct: number };
type Grp = { code: string; label: string; n: number; out: number };
type Disc = { article_number: string; material: string; x: number; y: number };
type Quad = { material: string; diff_pct: number; in_stock: boolean };
interface Data {
  apso_by_material: Mat[]; comp_by_material: CompMat[]; leaderboard: Lead[];
  only_apso: { material: string; n: number }[]; stockout_groups: Grp[];
  anyseals_funnel: { total: number; with_ref: number; anyseals_in_stock: number; apso_out_anyseals_in: number };
  anyseals_discrepancy: Disc[]; quadrant: Quad[]; leadtime: { days: number; n: number }[];
}
const ML: Record<string, string> = { pom_c: "POM-C", pom_h: "POM-H", pa6: "PA6", pa66: "PA66", pa6_g: "PA6-G", pe_uhmw: "PE-UHMW", pe_hd: "PE-HD", ptfe: "PTFE", peek: "PEEK", pvdf: "PVDF", pmma: "PMMA", pvc: "PVC", pp: "PP", pet: "PET", nbr: "NBR", fkm: "FKM", epdm: "EPDM", vmq: "VMQ" };
const ml = (m: string | null) => (m ? (ML[m] || m.toUpperCase().replace(/_/g, "-")) : "—");
const PT: Record<string, string> = { round_bar: "Rod", plate: "Plate", tube: "Tube", sheet: "Sheet", o_ring: "O-ring", x_ring: "X-ring", cord: "Cord", bushing: "Bushing", profile: "Profile", block: "Block", film: "Film" };
const pt = (t: string | null) => (t ? (PT[t] || t.replace(/_/g, " ")) : "other");
const pctColor = (p: number) => (p >= 70 ? GOOD : p >= 40 ? WARN : BAD);
const PALETTE = ["#274e64", "#ed1b2f", "#e8a13a", "#2e7d4f", "#7b5ea7", "#3a8fb7", "#c0566f", "#6b8e23", "#b5651d", "#5c6bc0", "#00897b", "#8d6e63"];
const heatBg = (p: number | null) => (p == null ? "#f1f3f4" : p >= 75 ? "#e7f4ea" : p >= 50 ? "#fff5e6" : p >= 25 ? "#ffe2d4" : "#ffd6d6");

function Panel({ title, sub, children, span = 1, fill = false }: { title: string; sub?: string; children: React.ReactNode; span?: number; fill?: boolean }) {
  return (
    <Card sx={{ border: "1px solid #e6e8ec", gridColumn: { xs: "1", md: `span ${span}` }, borderRadius: 2.5, ...(fill && { display: "flex", flexDirection: "column" }) }}>
      <CardContent sx={{ p: 2.2, ...(fill && { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, "&:last-child": { pb: 2.2 } }) }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#1a1d21", fontFamily: "var(--font-outfit), sans-serif" }}>{title}</Typography>
        {sub && <Typography sx={{ fontSize: "0.7rem", color: "#5b6470", mb: 1.2 }}>{sub}</Typography>}
        {children}
      </CardContent>
    </Card>
  );
}

export default function StockInsightsPanel({ qs = "" }: { qs?: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [radarKind, setRadarKind] = useState<"sealings" | "plastics">("sealings");
  const [discMat, setDiscMat] = useState<string>("all");
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/analytics/stock-insights?${qs}`).then(r => r.json()).then((j) => { setD(j); setLoading(false); }).catch(() => setLoading(false));
  }, [qs]);

  if (loading) return <Box sx={{ py: 8, textAlign: "center", color: "#9aa1ab" }}>Loading stock insights…</Box>;
  if (!d || !d.apso_by_material) return <Box sx={{ py: 8, textAlign: "center", color: "#9aa1ab" }}>No data.</Box>;

  // ── derive ── (matrix rows are material × product type; matched products only)
  const rk = (m: string, t: string | null) => `${m}|${t || ""}`;
  const comps = [...new Map(d.comp_by_material.map(c => [c.code, c.name])).entries()]; // [code,name]
  const compInfo = new Map<string, Map<string, { pct: number; n: number }>>();
  d.comp_by_material.forEach(c => { const k = rk(c.material, c.ptype); if (!compInfo.has(k)) compInfo.set(k, new Map()); compInfo.get(k)!.set(c.code, { pct: c.n ? Math.round(c.in_stock / c.n * 100) : 0, n: c.n }); });
  // product types → sub-columns (top by matched count); materials → rows
  const typeTotal = new Map<string, number>(); d.apso_by_material.forEach(m => typeTotal.set(m.ptype || "", (typeTotal.get(m.ptype || "") || 0) + m.n));
  const ptypes = [...typeTotal.entries()].filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  const matTotal = new Map<string, number>(); d.apso_by_material.forEach(m => matTotal.set(m.material, (matTotal.get(m.material) || 0) + m.n));
  const matRows = [...matTotal.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  // each competitor shows ONLY the product types it actually carries (drop empty columns)
  const compTypes = new Map<string, Set<string>>();
  d.comp_by_material.forEach(c => { if (c.ptype) { if (!compTypes.has(c.code)) compTypes.set(c.code, new Set()); compTypes.get(c.code)!.add(c.ptype); } });
  const compCols = comps.map(([code, name]) => ({ code, name, types: ptypes.filter(t => compTypes.get(code)?.has(t)) })).filter(c => c.types.length > 0);
  // radar aggregates back up to material level
  const agg = (arr: { material: string; n: number; in_stock: number }[]) => { const mm = new Map<string, { n: number; in_stock: number }>(); arr.forEach(x => { const e = mm.get(x.material) || { n: 0, in_stock: 0 }; e.n += x.n; e.in_stock += x.in_stock; mm.set(x.material, e); }); return mm; };
  const am = agg(d.apso_by_material), cmm = agg(d.comp_by_material);
  const ELAST = new Set(["nbr", "hnbr", "fkm", "ffkm", "fvmq", "vmq", "epdm", "cr", "eco", "acm", "aem", "pur", "aflas", "fepm", "iir", "sbr", "silicone", "viton", "fpm"]);
  const isSealing = (m: string) => ELAST.has(m.toLowerCase());
  const radar = [...am.entries()].filter(([m]) => (isSealing(m) ? "sealings" : "plastics") === radarKind).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([material, a]) => { const c = cmm.get(material); return { material, apso: a.n ? Math.round(a.in_stock / a.n * 100) : 0, comp: c && c.n ? Math.round(c.in_stock / c.n * 100) : 0 }; });
  // leaderboard: in-stock % per competitor, restricted to the selected material class (sealings/plastics)
  const lbMap = new Map<string, { code: string; name: string; n: number; in_stock: number }>();
  d.comp_by_material.forEach(c => { if ((isSealing(c.material) ? "sealings" : "plastics") !== radarKind) return; const e = lbMap.get(c.code) || { code: c.code, name: c.name, n: 0, in_stock: 0 }; e.n += c.n; e.in_stock += c.in_stock; lbMap.set(c.code, e); });
  const lbRows = [...lbMap.values()].map(e => ({ ...e, pct: e.n ? Math.round(e.in_stock / e.n * 100) : 0 })).sort((a, b) => b.pct - a.pct);
  const onlyApsoRows = (d.only_apso || []).filter(r => (isSealing(r.material) ? "sealings" : "plastics") === radarKind);
  const quadPts = (d.quadrant || []).filter(p => (isSealing(p.material) ? "sealings" : "plastics") === radarKind);
  // In-stock articles by material — APSO + every competitor (colored, with legend), filtered to the chosen class
  const covByMat = new Map<string, Record<string, number>>();
  d.comp_by_material.forEach(c => { const o = covByMat.get(c.material) || {}; o[c.code] = (o[c.code] || 0) + c.in_stock; covByMat.set(c.material, o); });
  const covMats = matRows.filter(m => (isSealing(m) ? "sealings" : "plastics") === radarKind).slice(0, 10);
  const coverageChart = covMats.map(mat => ({ material: ml(mat), apso: am.get(mat)?.in_stock || 0, ...(covByMat.get(mat) || {}) }));
  // only competitors that actually stock something in the visible materials (keeps the legend clean); colour stays stable by full-list index
  const covTotals = new Map<string, number>(); d.comp_by_material.forEach(c => { if (covMats.includes(c.material)) covTotals.set(c.code, (covTotals.get(c.code) || 0) + c.in_stock); });
  const covComps = [...new Map(d.comp_by_material.map(c => [c.code, c.name])).entries()].map(([code, name], i) => ({ code, name, color: PALETTE[(i + 1) % PALETTE.length] })).filter(c => (covTotals.get(c.code) || 0) > 0);
  // Anyseals discrepancy: per-material filter + opportunity count (Anyseals has more than us)
  const discAll = d.anyseals_discrepancy || [];
  const discMatCount = new Map<string, number>(); discAll.forEach(p => { if (p.material) discMatCount.set(p.material, (discMatCount.get(p.material) || 0) + 1); });
  const discMats = [...discMatCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m]) => m);
  const discPts = discMat === "all" ? discAll : discAll.filter(p => p.material === discMat);
  const discOpp = discPts.filter(p => (p.y || 0) > (p.x || 0)).length;

  const card2 = (chart: React.ReactNode) => <ResponsiveContainer width="100%" height={250}>{chart as React.ReactElement}</ResponsiveContainer>;
  const tip = { background: "#fff", border: "1px solid #e6e8ec", borderRadius: 8, fontSize: 12 };
  const kindToggle = (
    <Box sx={{ display: "flex", gap: 0.5, mb: 1.5 }}>
      {(["sealings", "plastics"] as const).map(k => (
        <Box key={k} onClick={() => setRadarKind(k)} sx={{ cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, px: 1.4, py: 0.4, borderRadius: 1, textTransform: "capitalize", transition: "all .15s", bgcolor: radarKind === k ? "#1a2744" : "#eef2f6", color: radarKind === k ? "#fff" : "#5b6470", "&:hover": { bgcolor: radarKind === k ? "#1a2744" : "#e2e7ee" } }}>{k}</Box>
      ))}
    </Box>
  );

  return (
    <Box className="animate-fade-in" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* Matrix + Radar share one full-width row */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2, alignItems: "stretch" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
      {/* 1. Availability Gap Matrix */}
      <Panel title="Availability Gap Matrix" sub="In-stock % per competitor, broken down by product type — MATCHED products only. Red = they're stocked, we trail (lost-sale risk).">
        <Box sx={{ overflowX: "auto" }}>
          <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: "2px", "& th": { fontSize: "0.6rem", fontWeight: 700, color: "#5b6470", p: "3px 5px", textAlign: "center" }, "& td": { fontSize: "0.68rem", fontWeight: 700, p: "5px 6px", textAlign: "center", borderRadius: "4px", minWidth: 40 } }}>
            <thead>
              {/* competitor group header (APSO dropped; each competitor only spans the types it carries) */}
              <tr>
                <th rowSpan={2} style={{ textAlign: "left" }}>Material</th>
                {compCols.map(c => <th key={c.code} colSpan={c.types.length} style={{ color: "#854d0e", background: "#fdf3d7", borderRadius: "5px 5px 0 0", borderLeft: "3px solid #fff" }}><Tooltip title={c.name} arrow><span>{c.name.split(" ")[0]}</span></Tooltip></th>)}
              </tr>
              <tr>
                {compCols.map(c => c.types.map((t, ti) => <th key={`${c.code}-${t}`} style={{ color: "#9aa1ab", borderLeft: ti === 0 ? "3px solid #fff" : undefined }}>{pt(t)}</th>))}
              </tr>
            </thead>
            <tbody>
              {matRows.map(mat => (
                <tr key={mat}>
                  <td style={{ textAlign: "left", background: "none", fontWeight: 700, color: "#1a1d21", whiteSpace: "nowrap" }}>{ml(mat)}</td>
                  {compCols.map(c => c.types.map((t, ti) => { const p = compInfo.get(rk(mat, t))?.get(c.code); return <td key={`${c.code}-${t}`} style={{ background: p ? heatBg(p.pct) : "#f7f8f9", color: p ? pctColor(p.pct) : "#d4d8dc", borderLeft: ti === 0 ? "3px solid #fff" : undefined }}><Tooltip title={p ? `${p.n} matched` : "no match"} arrow><span>{p ? `${p.pct}%` : "·"}</span></Tooltip></td>; }))}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </Panel>
        </Box>
        <Box sx={{ width: { xs: "100%", lg: 380 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Stock Coverage Radar */}
          <Panel title="Stock Coverage Radar" sub="APSO in-stock % (navy) vs avg competitor (red) across top materials.">
            {kindToggle}
            {radar.length ? <RadarSvg data={radar} /> : <Box sx={{ py: 6, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No {radarKind} with enough matched data.</Box>}
          </Panel>
          {/* Only APSO in stock — pricing power */}
          <Panel title="Only APSO in stock — pricing power" sub="Articles we can ship but no matched competitor can. Safe to hold / raise price.">
            {kindToggle}
            {onlyApsoRows.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={onlyApsoRows.map(r => ({ ...r, label: ml(r.material) }))} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#5b6470" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#5b6470" }} width={64} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={tip} formatter={(v) => [v as number, "articles"]} />
                  <Bar dataKey="n" radius={[0, 3, 3, 0]} maxBarSize={18} fill={GOOD} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Box sx={{ py: 4, px: 1, textAlign: "center", color: "#9aa1ab", fontSize: "0.74rem", lineHeight: 1.5 }}>No {radarKind} where we&apos;re the only one in stock — competitors are stocked on almost everything we match. (See the Gap Matrix: we trail on stock.)</Box>}
          </Panel>
        </Box>
      </Box>

      {/* Remaining charts in a 2-column grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>

      {/* 5. Competitor Availability Leaderboard */}
      <Panel title="Competitor Availability Leaderboard" sub={`Of the matched ${radarKind} we both carry, the % each competitor has in stock. Higher = harder to beat on availability.`}>
        {kindToggle}
        {lbRows.length ? card2(
          <BarChart data={lbRows.map(r => ({ ...r, label: r.name.split(" ")[0] }))} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#5b6470" }} axisLine={false} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#5b6470" }} width={72} axisLine={false} tickLine={false} />
            <RTooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}%  (${p?.payload?.in_stock}/${p?.payload?.n} in stock)`, "availability"]} />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]} maxBarSize={18}>{lbRows.map((r, i) => <Cell key={i} fill={pctColor(r.pct)} />)}</Bar>
          </BarChart>
        ) : <Box sx={{ py: 6, textAlign: "center", color: "#9aa1ab" }}>No matched {radarKind} stock data.</Box>}
      </Panel>

      {/* 27. Lead-time Advantage — sits next to the leaderboard */}
      <Panel title="Lead-time Advantage" sub="Competitor lead time (days) on items where APSO is in stock — we ship now, they wait.">
        {d.leadtime.length ? card2(
          <BarChart data={d.leadtime.map(r => ({ label: `${r.days}d`, n: r.n }))} margin={{ left: 4, right: 8, top: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5b6470" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#5b6470" }} axisLine={false} tickLine={false} />
            <RTooltip contentStyle={tip} formatter={(v) => [v as number, "matched items"]} />
            <ReferenceLine x="0d" stroke={GOOD} />
            <Bar dataKey="n" radius={[3, 3, 0, 0]} maxBarSize={30} fill={NAVY} />
          </BarChart>
        ) : <Box sx={{ py: 6, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No competitor lead-time data captured yet.</Box>}
      </Panel>

      {/* 16. Anyseals vs APSO Discrepancy */}
      <Panel span={2} title="APSO stock vs Anyseals stock — where can we cover a shortage?" sub="Each dot is one article we can source from Anyseals. X = how many we hold; Y = how many Anyseals holds. The dashed line is 'both equal'.">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.2, alignItems: "center" }}>
          {["all", ...discMats].map(m => (
            <Box key={m} onClick={() => setDiscMat(m)} sx={{ cursor: "pointer", fontSize: "0.66rem", fontWeight: 700, px: 1.2, py: 0.35, borderRadius: 1, transition: "all .15s", bgcolor: discMat === m ? "#1a2744" : "#eef2f6", color: discMat === m ? "#fff" : "#5b6470", "&:hover": { bgcolor: discMat === m ? "#1a2744" : "#e2e7ee" } }}>{m === "all" ? "All materials" : ml(m)}</Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ScatterSvg points={discPts.map(p => ({ x: p.x, y: p.y, label: p.article_number }))} diagonal wide xlab="APSO stock" ylab="Anyseals stock" height={300} />
          </Box>
          <Box sx={{ width: { xs: "100%", md: 252 }, flexShrink: 0 }}>
            <Box sx={{ p: 1.5, mb: 1.6, borderRadius: 2, bgcolor: "#e7f4ea", border: "1px solid #cfe8d6" }}>
              <Typography sx={{ fontSize: "1.9rem", fontWeight: 800, color: GOOD, lineHeight: 1 }}>{discOpp.toLocaleString()}</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#2e7d4f", mt: 0.4 }}>buy-to-cover candidates</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "#5b6470", mt: 0.2, lineHeight: 1.4 }}>articles where Anyseals holds more than us</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, color: "#9aa1ab", textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>How to read it</Typography>
            {[
              { c: GOOD, t: "Above the line", d: "Anyseals has more — if we're short, source from them." },
              { c: "#9aa1ab", t: "On the line", d: "Both hold about the same — the numbers agree." },
              { c: WARN, t: "Below the line", d: "We hold more than Anyseals — no cover needed." },
            ].map((r, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1.1 }}>
                <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: r.c, mt: "3px", flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#1a1d21", lineHeight: 1.3 }}>{r.t}</Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: "#5b6470", lineHeight: 1.4 }}>{r.d}</Typography>
                </Box>
              </Box>
            ))}
            <Typography sx={{ fontSize: "0.66rem", color: "#9aa1ab", mt: 0.6, fontStyle: "italic" }}>Hover any dot to see the article.</Typography>
          </Box>
        </Box>
      </Panel>

      {/* 26. Price × Availability Quadrant */}
      <Panel title="Price × Availability Quadrant" sub="Horizontal = APSO price vs the cheapest matched competitor (left = we're cheaper). Vertical = stock (bottom = in stock). Bottom-left = cheap & available = win.">
        {kindToggle}
        {quadPts.length ? <QuadrantSvg points={quadPts} /> : <Box sx={{ py: 6, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No matched {radarKind} with price + stock data.</Box>}
      </Panel>

      {/* In-stock articles by material — APSO vs competitors (colored + legend) */}
      <Panel fill title="In-stock articles by material — APSO vs competitors" sub="Count of in-stock matched articles per material. Each competitor has its own colour — see legend.">
        {kindToggle}
        {coverageChart.length ? (
          <Box sx={{ flex: 1, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageChart} margin={{ top: 8, right: 8, bottom: 24, left: 0 }} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="2 4" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="material" tick={{ fontSize: 9, fill: "#5b6470" }} interval={0} angle={-25} textAnchor="end" height={48} tickLine={false} axisLine={{ stroke: "#e6e8ec" }} />
                <YAxis tick={{ fontSize: 10, fill: "#5b6470" }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tip} cursor={{ fill: "rgba(39,78,100,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="apso" name="APSO" fill={PALETTE[0]} radius={[2, 2, 0, 0]} maxBarSize={20} />
                {covComps.map(c => <Bar key={c.code} dataKey={c.code} name={c.name.split(" ")[0]} fill={c.color} radius={[2, 2, 0, 0]} maxBarSize={20} />)}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : <Box sx={{ py: 6, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No coverage data.</Box>}
      </Panel>
      </Box>
    </Box>
  );
}

/* ── custom SVG charts ── */
function RadarSvg({ data }: { data: { material: string; apso: number; comp: number }[] }) {
  const W = 320, H = 250, cx = W / 2, cy = H / 2 - 6, R = 88, k = Math.max(data.length, 3);
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + i * 2 * Math.PI / k; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = (key: "apso" | "comp") => data.map((row, i) => pt(i, R * (row[key] / 100)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="250">
      {[0.25, 0.5, 0.75, 1].map((rr, j) => <polygon key={j} points={data.map((_, i) => pt(i, R * rr).join(",")).join(" ")} fill="none" stroke="#e6eaee" />)}
      {data.map((row, i) => { const [x, y] = pt(i, R + 14); return <text key={i} x={x} y={y} fontSize={9} fill="#5b6470" textAnchor="middle">{ml(row.material)}</text>; })}
      <polygon points={poly("comp")} fill={RED} fillOpacity={0.12} stroke={RED} strokeWidth={1.6} />
      <polygon points={poly("apso")} fill={NAVY} fillOpacity={0.18} stroke={NAVY} strokeWidth={1.8} />
    </svg>
  );
}
function ScatterSvg({ points, diagonal, xlab, ylab, height = 250, wide }: { points: { x: number; y: number; label: string }[]; diagonal?: boolean; xlab: string; ylab: string; height?: number; wide?: boolean }) {
  const W = wide ? Math.round(height * 2.6) : 320, H = height, m = 26;
  const max = Math.max(10, ...points.map(p => Math.max(p.x || 0, p.y || 0)));
  const sx = (v: number) => m + (v / max) * (W - m - 8);
  const sy = (v: number) => H - m - (v / max) * (H - m - 10);
  const wrap = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; label: string; vx: number; vy: number } | null>(null);
  const onEnter = (e: React.MouseEvent, p: { x: number; y: number; label: string }) => {
    const r = wrap.current?.getBoundingClientRect(); if (!r) return;
    setHov({ x: e.clientX - r.left, y: e.clientY - r.top, label: p.label, vx: p.x, vy: p.y });
  };
  return (
    <Box ref={wrap} sx={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto" }}>
        {/* upper-left triangle = Anyseals has more than us = buy-to-cover opportunity */}
        {diagonal && <polygon points={`${sx(0)},${sy(0)} ${sx(max)},${sy(max)} ${sx(0)},${sy(max)}`} fill="#e7f4ea" fillOpacity={0.6} />}
        <line x1={m} y1={H - m} x2={W - 6} y2={H - m} stroke="#d6dce1" /><line x1={m} y1={8} x2={m} y2={H - m} stroke="#d6dce1" />
        {diagonal && <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="#b7c2cb" strokeDasharray="4 3" />}
        {points.map((p, i) => { const d2 = (p.y || 0) - (p.x || 0); const c = Math.abs(d2) < max * 0.12 ? "#9aa1ab" : d2 > 0 ? GOOD : WARN; const cx = sx(p.x || 0), cy = sy(p.y || 0); const on = hov?.label === p.label; return <g key={i} style={{ cursor: "pointer" }} onMouseMove={e => onEnter(e, p)} onMouseLeave={() => setHov(null)}><circle cx={cx} cy={cy} r={on ? 5 : 3.2} fill={c} fillOpacity={on ? 1 : 0.72} stroke={on ? "#fff" : "none"} strokeWidth={1} /><circle cx={cx} cy={cy} r={8} fill="transparent" /></g>; })}
        <text x={(W) / 2} y={H - 4} fontSize={9} fill="#5b6470" textAnchor="middle">{xlab} →</text>
        <text x={9} y={H / 2} fontSize={9} fill="#5b6470" textAnchor="middle" transform={`rotate(-90 9 ${H / 2})`}>{ylab} →</text>
      </svg>
      {hov && (
        <Box sx={{ position: "absolute", left: Math.min(hov.x + 12, (wrap.current?.clientWidth || 0) - 150), top: Math.max(hov.y - 44, 0), pointerEvents: "none", bgcolor: "#1a1d21", color: "#fff", px: 1, py: 0.6, borderRadius: 1, fontSize: "0.7rem", lineHeight: 1.35, boxShadow: "0 4px 14px rgba(0,0,0,.25)", whiteSpace: "nowrap", zIndex: 5 }}>
          <Box sx={{ fontWeight: 800 }}>{hov.label}</Box>
          <Box sx={{ opacity: 0.85 }}>APSO {hov.vx} &nbsp;·&nbsp; Anyseals {hov.vy}</Box>
        </Box>
      )}
    </Box>
  );
}
function QuadrantSvg({ points }: { points: { material: string; diff_pct: number; in_stock: boolean }[] }) {
  const H = 300, W = 640, cx = W / 2, midY = H / 2;
  const cap = (v: number) => Math.max(-100, Math.min(100, v));
  const sx = (v: number) => cx + (cap(v) / 100) * (W / 2 - 16);
  const fs = 10;
  const wrap = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<{ x: number; y: number; i: number; material: string; diff: number; inStock: boolean } | null>(null);
  const onMove = (e: React.MouseEvent, p: { material: string; diff_pct: number; in_stock: boolean }, i: number) => {
    const r = wrap.current?.getBoundingClientRect(); if (!r) return;
    setHov({ x: e.clientX - r.left, y: e.clientY - r.top, i, material: p.material, diff: p.diff_pct, inStock: p.in_stock });
  };
  return (
    <Box ref={wrap} sx={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto" }}>
        <rect x={0} y={0} width={cx} height={midY} fill="#fcfcfc" /><rect x={cx} y={0} width={cx} height={midY} fill="#fff6f6" />
        <rect x={0} y={midY} width={cx} height={midY} fill="#f1f9f2" /><rect x={cx} y={midY} width={cx} height={midY} fill="#fffaf0" />
        <line x1={cx} y1={6} x2={cx} y2={H - 6} stroke="#cfd6dd" /><line x1={6} y1={midY} x2={W - 6} y2={midY} stroke="#cfd6dd" />
        <text x={10} y={18} fontSize={fs} fill="#9aa1ab" fontWeight={700}>CHEAP · but OUT</text>
        <text x={W - 10} y={18} fontSize={fs} fill={BAD} fontWeight={700} textAnchor="end">EXPENSIVE &amp; OUT · LOSE</text>
        <text x={10} y={H - 24} fontSize={fs} fill={GOOD} fontWeight={700}>CHEAP &amp; IN STOCK · WIN</text>
        <text x={W - 10} y={H - 24} fontSize={fs} fill={WARN} fontWeight={700} textAnchor="end">IN STOCK · but PRICIER</text>
        {points.map((p, i) => { const cy = p.in_stock ? midY + (midY - 18) * (0.2 + (i % 9) / 14) : midY - (midY - 18) * (0.2 + (i % 9) / 14); const on = hov?.i === i; return <g key={i} style={{ cursor: "pointer" }} onMouseMove={e => onMove(e, p, i)} onMouseLeave={() => setHov(null)}><circle cx={sx(p.diff_pct)} cy={cy} r={on ? 5 : 3} fill={p.in_stock ? (p.diff_pct <= 0 ? GOOD : WARN) : (p.diff_pct <= 0 ? "#1565c0" : BAD)} fillOpacity={on ? 1 : 0.65} stroke={on ? "#fff" : "none"} strokeWidth={1} /><circle cx={sx(p.diff_pct)} cy={cy} r={8} fill="transparent" /></g>; })}
        <text x={cx + 6} y={midY + 14} fontSize={fs} fill="#5b6470">→ APSO pricier</text>
        <text x={cx - 6} y={midY + 14} fontSize={fs} fill="#5b6470" textAnchor="end">cheaper ←</text>
      </svg>
      {hov && (
        <Box sx={{ position: "absolute", left: Math.min(hov.x + 12, (wrap.current?.clientWidth || 0) - 160), top: Math.max(hov.y - 44, 0), pointerEvents: "none", bgcolor: "#1a1d21", color: "#fff", px: 1, py: 0.6, borderRadius: 1, fontSize: "0.7rem", lineHeight: 1.35, boxShadow: "0 4px 14px rgba(0,0,0,.25)", whiteSpace: "nowrap", zIndex: 5 }}>
          <Box sx={{ fontWeight: 800 }}>{ml(hov.material)}</Box>
          <Box sx={{ opacity: 0.85 }}>{hov.diff > 0 ? "+" : ""}{hov.diff}% vs competitor · {hov.inStock ? "in stock" : "out of stock"}</Box>
        </Box>
      )}
    </Box>
  );
}
