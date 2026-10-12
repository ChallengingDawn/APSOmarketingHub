// THE MONTHLY INPUTS - the marketing KPIs no connector reads yet (SEA from
// Google and Bing Ads, cart and check-out abandonment, the GA4 figures as the
// team reports them). Kept in apsomh_kv, started from SARCLA's sheet, typed
// month by month on Advanced reporting > Marketing KPIs > Monthly inputs.

import { kvGet, kvSet } from "@/lib/db/init";
import { TYPED } from "./measures";
import { seedInputs, type Inputs } from "./seed";

const KEY = "marketingKpis:inputs:v1";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;

export async function readInputs(): Promise<Inputs> {
  return (await kvGet<Inputs>(KEY)) ?? seedInputs();
}

/** One KPI's months: a number sets the month, null clears it. */
export async function saveMonths(kpi: string, values: Record<string, number | null>, by: string): Promise<Inputs> {
  if (!TYPED.includes(kpi)) throw new Error(`${kpi} is not typed by hand.`);
  const cur = await readInputs();
  const row = { ...(cur.months[kpi] ?? {}) };
  for (const [m, v] of Object.entries(values)) {
    if (!MONTH.test(m)) throw new Error(`Bad month "${m}".`);
    if (v === null) delete row[m];
    else if (typeof v === "number" && Number.isFinite(v)) row[m] = v;
    else throw new Error(`Bad value for ${m}.`);
  }
  const next: Inputs = { ...cur, months: { ...cur.months, [kpi]: row }, updatedAt: new Date().toISOString(), updatedBy: by };
  await kvSet(KEY, next);
  return next;
}

/** A target for a year: a number sets it, null clears it. */
export async function saveTarget(kpi: string, year: string, value: number | null, by: string): Promise<Inputs> {
  if (!YEAR.test(year)) throw new Error(`Bad year "${year}".`);
  if (value !== null && !(typeof value === "number" && Number.isFinite(value))) throw new Error("Bad target.");
  const cur = await readInputs();
  const row = { ...(cur.targets[kpi] ?? {}) };
  if (value === null) delete row[year]; else row[year] = value;
  const next: Inputs = { ...cur, targets: { ...cur.targets, [kpi]: row }, updatedAt: new Date().toISOString(), updatedBy: by };
  await kvSet(KEY, next);
  return next;
}
