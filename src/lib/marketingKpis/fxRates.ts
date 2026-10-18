// EXCHANGE RATES - the pure part (fx.ts reads them): francs per euro by month, and
// francs to euros at a month's rate. Shared by the reads and the pages.

/** "YYYY-MM" -> francs per euro */
export type ChfPerEur = Record<string, number>;

/** The ECB's CSV (csvdata): TIME_PERIOD and OBS_VALUE per row. */
export function parseEcbCsv(csv: string): Record<string, number> {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const head = lines[0].split(",");
  const ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) return {};
  const out: Record<string, number> = {};
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    const v = Number(c[vi]);
    if (c[ti] && Number.isFinite(v) && v > 0) out[c[ti]] = v;
  }
  return out;
}

/** The rate for a month - that month's, else the nearest month before it, else the nearest after. */
export function rateFor(rates: ChfPerEur, month: string): number | null {
  if (rates[month]) return rates[month];
  const ks = Object.keys(rates).sort();
  const before = ks.filter((k) => k < month);
  if (before.length) return rates[before[before.length - 1]];
  return ks.length ? rates[ks[0]] : null;
}

/** Francs to euros at the month's rate; null when no rate is known at all. */
export function chfToEur(chf: number, month: string, rates: ChfPerEur): number | null {
  const r = rateFor(rates, month);
  return r ? chf / r : null;
}
