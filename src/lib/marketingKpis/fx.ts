// EVERYTHING IN EUROS (SARCLA 18.10: "everything in EUR"). Google reports in CHF (the GA4
// property's currency: it converts the DE shop's euros into francs), the ERP in EUR, and
// HubSpot's orders in either. The hub turns francs into euros at the month's ECB reference
// rate - the monthly average, and the days so far for the running month. Every rate read
// is kept, so an ECB outage leaves the months already known.

import { kvGet, kvSet } from "@/lib/db/init";
import { parseEcbCsv, type ChfPerEur } from "./fxRates";

export { chfToEur, rateFor, type ChfPerEur } from "./fxRates";

const KEEP_KEY = "fx:chfPerEur:v1";
const ECB = "https://data-api.ecb.europa.eu/service/data/EXR";

/** The ECB's monthly averages from `fromMonth`, and the running month from its days so far; kept in the hub. */
export async function chfPerEur(fromMonth: string): Promise<ChfPerEur> {
  let kept: ChfPerEur = {};
  try { kept = (await kvGet<ChfPerEur>(KEEP_KEY)) ?? {}; } catch { /* no database: this read only */ }
  const get = async (series: string, start: string) => {
    const r = await fetch(`${ECB}/${series}?startPeriod=${start}&format=csvdata`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`ECB exchange rates did not answer (HTTP ${r.status})`);
    return parseEcbCsv(await r.text());
  };
  const rates: ChfPerEur = { ...kept };
  try {
    Object.assign(rates, await get("M.CHF.EUR.SP00.A", fromMonth));
    // the running month has no monthly average yet: the mean of its days so far
    const thisMonth = new Date().toISOString().slice(0, 7);
    const days = Object.values(await get("D.CHF.EUR.SP00.A", `${thisMonth}-01`));
    if (days.length) rates[thisMonth] = days.reduce((a, b) => a + b, 0) / days.length;
    try { await kvSet(KEEP_KEY, rates); } catch { /* kept next time */ }
  } catch (e) {
    if (!Object.keys(rates).length) throw e;     // nothing known: say so; otherwise the kept months stand
  }
  return rates;
}
