// VISIT & TRAFFIC ORIGIN - the read (the rules are in visitCube.ts). GA4: exact users per month,
// a month x country x channel cube, and the landing pages; HubSpot: the companies that logged in
// to the shop, per sales priority (Datatracker's login counts on the company). A year per GA4
// call (the hub asks GA4 for 365 days at most). About half a minute; read every 6 hours, the
// page shows the last read meanwhile.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { searchTotal } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import type { VisitData } from "./visitCube";

const KEY = "marketingKpis:visit:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
const PRIOS: [string, string | null][] = [
  ["Prio 1", "1-Prio 1 - Pot >25000€"], ["Prio 2", "2-Prio 2 - Pot btw 2500 & 24999€"], ["Prio 3", "3-Prio 3 - Pot btw 500 & 2499€"],
  ["No priority", "4- No priority for sales, Pot. <500€"], ["Not set", null],
];

export function visitData(): Promise<SlowState<VisitData>> {
  return slowReport(KEY, (v: VisitData) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), build);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** GA4's yearMonth "202609" as "2026-09"; a date "2026-09-14" as its month */
const monthKey = (k: string) => (/^\d{6}$/.test(k) ? `${k.slice(0, 4)}-${k.slice(4, 6)}` : k.slice(0, 7));

async function build(): Promise<VisitData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();
  const errors: Record<string, string> = {};
  const guard = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); }
  };
  const ranges: [string, string][] = [[`${py}-01-01`, `${py}-12-31`], [`${year}-01-01`, iso(now)]];

  const users: VisitData["users"] = {};
  await guard("users", async () => {
    reportProgress(KEY, "reading GA4 users per month");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitUsersMonthly", from, to });
      for (const row of r.rows) users[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0];
    }
  });

  const channels: string[] = [];
  const cube: VisitData["cube"] = [];
  await guard("cube", async () => {
    reportProgress(KEY, "reading GA4 sessions by month, country and channel");
    const idx = (c: string) => { let i = channels.indexOf(c); if (i < 0) { i = channels.length; channels.push(c); } return i; };
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitCube", from, to });
      for (const row of r.rows) {
        const country = (row.keys[1] ?? "").toUpperCase();
        cube.push([monthKey(row.keys[0] ?? ""), country === "(NOT SET)" ? "" : country, idx(row.keys[2] || "(not set)"), row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0]);
      }
    }
  });

  // landing pages: the whole months this year, and the same months a year earlier
  const landing: VisitData["landing"] = { months: monthsDone, cy: [], py: [] };
  await guard("landing", async () => {
    if (!monthsDone) return;
    reportProgress(KEY, "reading GA4 landing pages");
    const last = (y: number) => iso(new Date(Date.UTC(y, monthsDone, 0)));
    for (const [side, y] of [["cy", year], ["py", py]] as const) {
      const r = await fetchGa4Report({ name: "visitLanding", from: `${y}-01-01`, to: last(y) });
      landing[side] = r.rows.map((row) => [row.keys[0] || "(not set)", row.keys[1] || "(not set)", row.values[0] ?? 0, row.values[1] ?? 0]);
    }
  });

  // known customers: companies that logged in to the shop, per sales priority (V06, V07)
  const prio: VisitData["prio"] = [];
  await guard("prio", async () => {
    reportProgress(KEY, "counting logged-in companies by priority");
    const prioF = (v: string | null) => (v === null ? { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" } : { propertyName: "sales_priority", operator: "EQ", value: v });
    for (const [band, value] of PRIOS) {
      prio.push({
        band,
        all: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value)] }] }),
        cy: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value), { propertyName: "n_of_logins_datatracker", operator: "GT", value: "0" }] }] }),
        py: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value), { propertyName: `n_of_logins_datatracker_${py}`, operator: "GT", value: "0" }] }] }),
      });
    }
  });

  return { generatedAt: new Date().toISOString(), year, monthsDone, users, channels, cube, landing, prio, errors };
}
