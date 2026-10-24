// THE ESO FIGURES' RULES - with no HubSpot in them, so the tests compile them (esoFigures.ts reads; this decides).
// The company's own series, as the HubSpot dashboard reads them: revenue and order intake per month (both years cut
// on the same day) and the ERP's forecast (per mandant, the whole company only) - SARCLA 24.10.2026.

export type MPair = { cy: number; py: number };
export type EsoFigures = {
  generatedAt: string;
  year: number; py: number;
  /** the whole company, from the KPI series - 12 months each, index 0 = January */
  total: { rev: MPair[]; oi: MPair[]; forecast: number[] };
  errors: string[];
};

const months12 = (): MPair[] => Array.from({ length: 12 }, () => ({ cy: 0, py: 0 }));

/** A KPI series summed per month, this year and last. */
export function monthsOfSeries(rows: { year: number | null; month: number | null; value: number }[], year: number): MPair[] {
  const out = months12();
  for (const r of rows) {
    if (!r.month || r.month < 1 || r.month > 12) continue;
    if (r.year === year) out[r.month - 1].cy += r.value;
    else if (r.year === year - 1) out[r.month - 1].py += r.value;
  }
  return out;
}
