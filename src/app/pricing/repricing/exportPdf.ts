import {
  type Article, type Factors, type Sel,
  ALL_COMPS, compAt, compGap, compKind, costInfo, newPrice, currentAt, basisUnit, selSummary, FX_CURRENCIES,
} from "./model";

export type PdfInput = {
  arts: Article[]; factors: Factors;
  cost: Record<string, number>; corr: Record<string, number>;
  sel: Sel; user: string;
  showM100: boolean; showM110: boolean; compShow: Record<string, boolean>;
};

const NAVY: [number, number, number] = [39, 78, 100];
const RED: [number, number, number] = [237, 27, 47];
const GREY: [number, number, number] = [91, 100, 112];
const MAX_ROWS = 4000;

/** The studio as an APSOparts-branded landscape A4 PDF: selection + settings, then the table. */
export async function exportPdf(o: PdfInput): Promise<{ file: string; rows: number }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 8;
  const f = o.factors;
  const now = new Date();
  const dateTxt = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const TIERS = f.tiers.map(t => t.qty).slice(0, 5);
  const baseQ = TIERS[0] ?? 1;
  const corrOf = (a: Article) => o.corr[a.article_number] ?? a.correction ?? 1;
  const comps = ALL_COMPS.filter(c => o.compShow[c.code] !== false);

  const header = (first: boolean) => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 15, "F");
    doc.setFillColor(...RED); doc.rect(0, 15, W, 1.4, "F");
    // Wordmark only — no logo file in the repo, and an invented badge is not the brand.
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("APSOparts", M, 9.8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Repricing Studio${first ? "" : " (continued)"}  ·  ${dateTxt}`, W - M, 9.6, { align: "right" });
  };

  // ── columns ──
  type Col = { label: string; w: number; align?: "right"; sub?: string };
  const cols: Col[] = [
    { label: "Article", w: 20 }, { label: "Description", w: 60 }, { label: "Unit", w: 10 },
    { label: "GWStdP", w: 19, align: "right" }, { label: "BASIC now", w: 16, align: "right", sub: "EUR" },
    ...TIERS.map(t => ({ label: `New ${t}+`, w: 14, align: "right" as const, sub: "BASIC EUR" })),
    { label: "vs now", w: 12, align: "right" },
    ...(o.showM100 ? [{ label: `M100 ${baseQ}+`, w: 16, align: "right" as const, sub: "CHF" }] : []),
    ...(o.showM110 ? [{ label: `M110 ${baseQ}+`, w: 16, align: "right" as const, sub: "EUR" }] : []),
    ...(comps.length ? [{ label: "Competitor most below us", w: 36, sub: `${baseQ}+, same unit + currency` }] : []),
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const scale = Math.min(1, (W - 2 * M) / tableW);
  for (const c of cols) c.w *= scale;

  const fit = (txt: string, w: number) => { const t = doc.splitTextToSize(txt, w - 1.5) as string[]; return t.length > 1 ? `${t[0].replace(/\s+\S*$/, "")}…` : (t[0] || ""); };
  const n2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

  header(true);
  // ── summary ──
  let y = 23;
  doc.setTextColor(26, 29, 33); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  const priced = o.arts.filter(a => costInfo(a, o.cost[a.article_number], f).eur != null).length;
  const lines: [string, string][] = [
    ["Selection", `${selSummary(o.sel)}  ·  ${o.arts.length.toLocaleString("de-CH")} articles, ${priced.toLocaleString("de-CH")} with a usable GWStdP`],
    ["Factors", `base ${f.base} · country M100 ${f.country_m100} · country M110 ${f.country_m110} · currency ${f.currency} · ${FX_CURRENCIES.filter(c => f.fx[c]).map(c => `1 ${c} = ${f.fx[c]} EUR`).join(" · ") || "costs in EUR"}`],
    ["Quantities", f.tiers.map(t => `${t.qty}+ ×${t.factor}`).join("   ")],
    ["Formula", "BASIC = GWStdP (EUR) × correction × base × scale · M100 = BASIC × country × currency · M110 = BASIC × country"],
  ];
  for (const [k, v] of lines) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY); doc.text(k, M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(26, 29, 33); doc.text(fit(v, W - 2 * M - 24), M + 24, y);
    y += 4.6;
  }
  y += 2;

  const drawHead = () => {
    doc.setFillColor(238, 242, 246); doc.rect(M, y - 4, W - 2 * M, 8.4, "F");
    let x = M;
    for (const c of cols) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...NAVY);
      const tx = c.align === "right" ? x + c.w - 1 : x + 1;
      doc.text(c.label, tx, y - 0.6, { align: c.align === "right" ? "right" : "left" });
      if (c.sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(...GREY); doc.text(c.sub, tx, y + 2.6, { align: c.align === "right" ? "right" : "left" }); }
      x += c.w;
    }
    y += 6.6;
  };
  drawHead();

  const rows = o.arts.slice(0, MAX_ROWS);
  rows.forEach((a, i) => {
    if (y > H - 12) { doc.addPage(); header(false); y = 24; drawHead(); }
    if (i % 2 === 1) { doc.setFillColor(248, 249, 251); doc.rect(M, y - 3.4, W - 2 * M, 4.8, "F"); }
    const ci = costInfo(a, o.cost[a.article_number], f);
    const cf = corrOf(a);
    const first = newPrice(ci.eur, cf, f, baseQ, "basic");
    const now0 = currentAt(a.basic_scales, a.basic_current, baseQ);
    const d = first != null && now0 ? (first - now0) / now0 : null;
    // The competitor where we stand most expensive (same currency as the price system it faces).
    let market = "";
    let worst: { label: string; v: number; d: number } | null = null;
    let basisOff = "";
    for (const c of comps) {
      const cc = a.competitors?.[c.code];
      if (!cc?.converted) continue;  // their own unit (per m vs our per kg) is no comparison
      const v = compAt(cc.prices, baseQ);
      const ours = newPrice(ci.eur, cf, f, baseQ, compKind(c.code));
      const g = compGap(ours, v, cc.converted);
      if (g.basis && !basisOff) basisOff = `${c.label} ${v!.toFixed(2)}  basis?`;
      if (g.d == null || v == null) continue;
      if (!worst || g.d > worst.d) worst = { label: c.label, v, d: g.d };
    }
    if (worst) market = `${worst.label} ${worst.v.toFixed(2)}  ${worst.d > 0 ? "+" : ""}${(worst.d * 100).toFixed(0)}%`;
    else if (basisOff) market = basisOff;
    const cells: { t: string; color?: [number, number, number]; bold?: boolean }[] = [
      { t: a.article_number, bold: true },
      { t: a.description || "" },
      { t: basisUnit(a) },
      { t: ci.raw != null ? `${ci.raw.toFixed(ci.raw < 10 ? 4 : 2)} ${ci.currency}` : "—", color: ci.eur == null ? GREY : undefined },
      { t: n2(now0), color: GREY },
      ...TIERS.map(t => ({ t: n2(newPrice(ci.eur, cf, f, t, "basic")), bold: true })),
      { t: d == null ? "" : `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%${Math.abs(d) > 0.9 ? " !" : ""}`, color: d == null ? undefined : Math.abs(d) > 0.9 ? [180, 83, 9] as [number, number, number] : d > 0.001 ? RED : [30, 142, 62] as [number, number, number] },
      ...(o.showM100 ? [{ t: n2(newPrice(ci.eur, cf, f, baseQ, "m100")) }] : []),
      ...(o.showM110 ? [{ t: n2(newPrice(ci.eur, cf, f, baseQ, "m110")) }] : []),
      ...(comps.length ? [{ t: market, color: worst ? (worst.d > 0.02 ? RED : NAVY) : basisOff ? [180, 83, 9] as [number, number, number] : NAVY }] : []),
    ];
    let x = M;
    doc.setFontSize(6.8);
    cells.forEach((c, k) => {
      const col = cols[k];
      doc.setFont("helvetica", c.bold ? "bold" : "normal");
      doc.setTextColor(...(c.color || ([26, 29, 33] as [number, number, number])));
      const txt = fit(c.t, col.w);
      doc.text(txt, col.align === "right" ? x + col.w - 1 : x + 1, y, { align: col.align === "right" ? "right" : "left" });
      x += col.w;
    });
    y += 4.8;
  });
  if (o.arts.length > MAX_ROWS) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...RED);
    doc.text(`${(o.arts.length - MAX_ROWS).toLocaleString("de-CH")} more articles in the Excel export.`, M, Math.min(y + 3, H - 10));
  }

  // ── footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(216, 220, 225); doc.line(M, H - 7, W - M, H - 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(`APSOparts · Angst+Pfister · Repricing Studio · ${dateTxt}${o.user ? ` · ${o.user}` : ""}`, M, H - 3.5);
    doc.text(`Page ${p} / ${pages}`, W - M, H - 3.5, { align: "right" });
  }
  const file = `repricing-studio-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
  return { file, rows: rows.length };
}
