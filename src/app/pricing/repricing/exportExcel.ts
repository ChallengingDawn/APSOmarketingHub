import { aoaSheet, downloadXlsx, type Cell, type Sheet } from "@/lib/pricing/xlsx";
import {
  type Article, type Factors, type Kind, type Sel,
  costInfo, newPrice, marginOf, implausible, basisUnit, roundCents, selSummary, FX_CURRENCIES,
} from "./model";

export type ExportInput = {
  arts: Article[];                       // the WHOLE selection
  factors: Factors;
  cost: Record<string, number>;          // typed / uploaded cost overrides
  corr: Record<string, number>;          // correction overrides
  sel: Sel; user: string;
  mandantSheets: boolean;                // add "Upload M100" (CHF) + "Upload M110" (EUR)
  costNote?: string;                     // how an uploaded cost sheet was read
};

const SCALE_SLOTS = 12;

/**
 * Performis upload workbook. The main sheet carries the NEW BASIC price (EUR) with its scale
 * ladder; the pricing settings that produced it sit at the bottom of that same sheet. Every
 * article of the selection is accounted for: exported, or listed in "Excluded — review" with
 * the reason (no cost, placeholder cost, implausible proposal).
 */
export async function exportUpload(o: ExportInput): Promise<{ exported: number; excluded: number; file: string }> {
  const { arts, factors: f } = o;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const TIERS = f.tiers.map(t => t.qty);
  const baseQ = TIERS[0] ?? 1, scaleQs = TIERS.slice(1, 1 + SCALE_SLOTS);
  const corrOf = (a: Article) => o.corr[a.article_number] ?? a.correction ?? 1;

  const excluded: Cell[][] = [];
  const ok: { a: Article; eur: number; cf: number }[] = [];
  for (const a of arts) {
    const ci = costInfo(a, o.cost[a.article_number], f);
    if (ci.eur == null) { excluded.push([a.article_number, a.description || "", ci.raw ?? "", ci.currency, a.basic_current ?? "", ci.problem || "no cost"]); continue; }
    const cf = corrOf(a);
    const why = implausible(newPrice(ci.eur, cf, f, baseQ, "basic"), a.basic_current);
    if (why) { excluded.push([a.article_number, a.description || "", ci.raw ?? "", ci.currency, a.basic_current ?? "", why]); continue; }
    ok.push({ a, eur: ci.eur, cf });
  }

  const head = ["article no", "price date", "currency", "sales price unit", "sales price",
    ...Array.from({ length: SCALE_SLOTS }, (_, i) => `scale price ${i + 1}`),
    ...Array.from({ length: SCALE_SLOTS }, (_, i) => `scale ${i + 1}`),
    "current price", "change vs current"];
  const rowsFor = (kind: Kind) => ok.map(({ a, eur, cf }) => {
    const cur = kind === "m100" ? "CHF" : "EUR";
    const p = (q: number | undefined) => { const v = q != null ? newPrice(eur, cf, f, q, kind) : null; return v != null ? roundCents(v) : ""; };
    const current = kind === "basic" ? a.basic_current : kind === "m100" ? a.m100_current : null;
    const first = newPrice(eur, cf, f, baseQ, kind);
    const change = current && first != null ? Math.round(((first - current) / current) * 1000) / 10 : "";
    return [a.article_number, today, cur, basisUnit(a) || "pce", p(baseQ),
      ...Array.from({ length: SCALE_SLOTS }, (_, i) => p(scaleQs[i])),
      ...Array.from({ length: SCALE_SLOTS }, (_, i) => scaleQs[i] ?? ""),
      current != null ? roundCents(current) : "", change === "" ? "" : `${change > 0 ? "+" : ""}${change}%`];
  });

  // ── the settings block, at the bottom of the main sheet ──
  const corrN = arts.filter(a => corrOf(a) !== 1).length;
  const costN = arts.filter(a => o.cost[a.article_number] != null).length;
  const fxTxt = FX_CURRENCIES.map(c => (f.fx[c] ? `1 ${c} = ${f.fx[c]} EUR` : `${c} not set`)).join(" · ");
  const settings: Cell[][] = [
    [], [],
    ["PRICING SETTINGS USED"],
    ["Exported", `${today} ${now.toTimeString().slice(0, 5)}`],
    ["By", o.user || "—"],
    ["Selection", selSummary(o.sel)],
    ["Articles", `${ok.length} exported · ${excluded.length} held back (sheet "Excluded — review")`],
    ["BASIC (EUR)", "GWStdP in EUR × correction × base factor × scale factor"],
    ["M100 (CHF)", "BASIC × country factor M100 × currency factor"],
    ["M110 (EUR)", "BASIC × country factor M110"],
    ["Base factor", f.base],
    ["Country factor M100", f.country_m100],
    ["Country factor M110", f.country_m110],
    ["Currency factor (M100)", f.currency],
    ["GWStdP to EUR", `EUR costs as they are · ${fxTxt}`],
    [],
    ["Quantity", "Scale factor", "Margin BASIC", "Margin M100", "Margin M110"],
    ...f.tiers.map(t => [t.qty, t.factor,
      `${(marginOf(1, f, t.qty, "basic") * 100).toFixed(1)}%`, `${(marginOf(1, f, t.qty, "m100") * 100).toFixed(1)}%`, `${(marginOf(1, f, t.qty, "m110") * 100).toFixed(1)}%`]),
    [],
    ["Correction factors", corrN ? `${corrN} articles with a correction other than 1 (sheet "Corrections")` : "none (all 1)"],
    ["Cost overrides", costN ? `${costN} articles with a typed or uploaded GWStdP${o.costNote ? ` — ${o.costNote}` : ""}` : "none (HubSpot GWStdP)"],
  ];

  // the hub's writer (src/lib/pricing/xlsx.ts): the header on row 1 and the articles under it, as Performis reads them
  const sheets: Sheet[] = [
    aoaSheet("Upload BASIC", [head, ...rowsFor("basic"), ...settings], {
      widths: [14, 11, 8, 14, 12, ...Array.from({ length: SCALE_SLOTS * 2 }, () => 11), 13, 15],
    }),
  ];
  if (o.mandantSheets) {
    sheets.push(aoaSheet("Upload M100", [head, ...rowsFor("m100")]));
    sheets.push(aoaSheet("Upload M110", [head, ...rowsFor("m110")]));
  }
  if (corrN) {
    sheets.push(aoaSheet("Corrections", [["article no", "description", "correction factor"],
      ...arts.filter(a => corrOf(a) !== 1).map(a => [a.article_number, a.description || "", corrOf(a)])]));
  }
  if (excluded.length) {
    sheets.push(aoaSheet("Excluded — review", [["article no", "description", "GWStdP", "cost currency", "current BASIC (EUR)", "why it was held back"], ...excluded],
      { widths: [14, 50, 10, 8, 12, 60] }));
  }
  const file = `price-list-upload-${today}.xlsx`;
  await downloadXlsx(file, sheets);
  return { exported: ok.length, excluded: excluded.length, file };
}
