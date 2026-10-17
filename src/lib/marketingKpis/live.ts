// THE MARKETING KPIS THE HUB READS ITSELF - month by month, this year and
// last, plus the breakdowns the stage pages draw. One read through slowReport
// (6 hours), each source on its own: one that fails is named, the rest stand.
//
//   leads            Contact Us form requests (contactRequests.ts)
//   registrations    new contacts with a shop account, per month
//   leads to sales   ESO and TSA tickets created from forms and chat
//   customers        companies by sales priority, all and invoiced this year
//   logged in        companies with a shop login this year (Datatracker)
//   traffic origin   GA4 sessions by channel and by country, year to date
//   search country   Search Console clicks by country, year to date
//   reach (SEO)      Search Console day by day, folded into months this year and
//                    last: impressions, clicks, CTR, position, brand share (R04-R08);
//                    every whole month kept in the hub, beyond Google's 16 months
//   reach (SEA)      Google Ads impressions and clicks through GA4's Ads link, per
//                    day summed into months, this year and the whole of last (R01-R03)

import { hubspotFetchJson, searchTotal } from "@/lib/integrations/hubspot";
import { fetchContactRequests } from "@/lib/integrations/contactRequests";
import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { fetchGscDaily, fetchGscQueries } from "@/lib/integrations/gsc";
import { kvGet, kvSet } from "@/lib/db/init";
import { BRAND_QUERY, completeOnly, mergeHistory, monthsFromDays, seriesFromMonths, type MonthAcc } from "./searchMonthly";

/** Every whole month of Search Console the hub has read - Google drops them after 16 months, the hub does not. */
const SEARCH_HISTORY_KEY = "marketingKpis:searchMonths:v1";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";

const KEY = "marketingKpis:live:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const ESO = "1726599376", TSA = "1726599377";
const MARKETING_SOURCES = ["FORM", "CHAT"];
const PRIOS: [string, string | null][] = [
  ["Prio 1", "1-Prio 1 - Pot >25000€"], ["Prio 2", "2-Prio 2 - Pot btw 2500 & 24999€"], ["Prio 3", "3-Prio 3 - Pot btw 500 & 2499€"],
  ["No priority", "4- No priority for sales, Pot. <500€"], ["Not set", null],
];

export type Monthly = { months: (number | null)[]; py: (number | null)[] };
export type LiveKpis = {
  generatedAt: string;
  year: number;
  /** completed months this year - year-to-date comparisons stop here */
  monthsDone: number;
  series: Record<string, Monthly>;
  ytd: Record<string, { cy: number | null; py: number | null; pyNote?: string }>;
  breakdowns: {
    channels: { label: string; sessions: number; newUsers: number }[];
    countries: { label: string; sessions: number }[];
    searchCountries: { label: string; clicks: number; impressions: number }[];
    prio: { band: string; all: number | null; active: number | null }[];
    handover: { eso: Monthly; tsa: Monthly };
  };
  /** how far Search Console's days reach: Google keeps 16 months and lags a day or two */
  search?: { firstDay: string | null; lastDay: string | null };
  errors: Record<string, string>;
};

/** A read with a failed source is asked again after this, not after 6 hours (12.10.2026: a GA4 403 stayed on the page after its fix). */
const RETRY_FAILED_MS = 30 * 60 * 1000;

export function marketingKpisLive(): Promise<SlowState<LiveKpis>> {
  // a read stored before Reach came from Search Console (17.10.2026) has neither its months nor its error:
  // it is out of date at once, so the next visit reads again (the stored figures show meanwhile)
  return slowReport(KEY, (v) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : !v?.series?.R04 || !v?.series?.R01 ? 0 : TTL_MS), build);
}

const ms = (y: number, m: number) => String(Date.UTC(y, m, 1)); // m 0-based, rolls over

/**
 * Months before a source existed are not zero, they are nothing: the Contact Us
 * form (Form_2507) went live in July 2025, so January-June 2025 read 0. Leading
 * zeros of a year become empty, so they are neither drawn nor compared.
 */
function notBeforeFirst(xs: (number | null)[]): (number | null)[] {
  const first = xs.findIndex((x) => x != null && x > 0);
  return first < 0 ? xs.map(() => null) : xs.map((x, i) => (i < first ? null : x));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function countTickets(pipeline: string, from: string, to: string): Promise<number | null> {
  const r = await hubspotFetchJson<{ total?: number }>({
    path: "/crm/v3/objects/tickets/search", method: "POST", useTicketsToken: true,
    body: { limit: 1, properties: [], filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: pipeline },
      { propertyName: "source_type", operator: "IN", values: MARKETING_SOURCES },
      { propertyName: "createdate", operator: "GTE", value: from },
      { propertyName: "createdate", operator: "LT", value: to },
    ] }] },
  });
  return typeof r.total === "number" ? r.total : null;
}

async function build(): Promise<LiveKpis> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();       // October 12 -> 9 complete months
  const cyMonths = monthsDone + 1;             // the running month too, for the charts
  const errors: Record<string, string> = {};
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const series: Record<string, Monthly> = {};
  const guard = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); }
  };

  // Leads: the Contact Us form, per month.
  await guard("leads", async () => {
    reportProgress(KEY, "reading contact requests");
    const s = empty();
    for (const [side, y, to] of [["months", year, iso(now)], ["py", py, `${py}-12-31`]] as const) {
      const r = await fetchContactRequests({ from: `${y}-01-01`, to });
      for (const b of r.buckets) {
        const i = Number(b.from.slice(5, 7)) - 1;
        if (b.requests != null) s[side][i] = (s[side][i] ?? 0) + b.requests;
      }
    }
    s.py = notBeforeFirst(s.py);
    series.L01 = s;
  });

  // Registrations: new contacts with a shop account, per month.
  await guard("registrations", async () => {
    const s = empty();
    for (const [side, y, n] of [["months", year, cyMonths], ["py", py, 12]] as const) {
      for (let m = 0; m < n; m++) {
        reportProgress(KEY, `counting shop registrations ${y}-${m + 1}`);
        s[side][m] = await searchTotal("contacts", { filterGroups: [{ filters: [
          { propertyName: "eyemagine_customer_id", operator: "HAS_PROPERTY" },
          { propertyName: "createdate", operator: "GTE", value: ms(y, m) },
          { propertyName: "createdate", operator: "LT", value: ms(y, m + 1) },
        ] }] });
      }
    }
    series.L04 = s;
  });

  // Leads to sales: ESO and TSA tickets created from forms and chat.
  const handover = { eso: empty(), tsa: empty() };
  await guard("handover", async () => {
    for (const [key, pipe] of [["eso", ESO], ["tsa", TSA]] as const) {
      for (const [side, y, n] of [["months", year, cyMonths], ["py", py, 12]] as const) {
        for (let m = 0; m < n; m++) {
          reportProgress(KEY, `counting ${key.toUpperCase()} tickets from forms and chat ${y}-${m + 1}`);
          handover[key][side][m] = await countTickets(pipe, ms(y, m), ms(y, m + 1));
        }
      }
    }
    series.H01 = handover.eso;
    const both = empty();
    for (const side of ["months", "py"] as const) {
      for (let m = 0; m < 12; m++) {
        const a = handover.eso[side][m], b = handover.tsa[side][m];
        both[side][m] = a == null && b == null ? null : (a ?? 0) + (b ?? 0);
      }
    }
    series.L02 = both;
  });

  // Customers: companies by sales priority, all and invoiced this year.
  const ytd: LiveKpis["ytd"] = {};
  const prio: LiveKpis["breakdowns"]["prio"] = [];
  await guard("customers", async () => {
    reportProgress(KEY, "counting companies by priority");
    const prioF = (v: string | null) => (v === null ? { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" } : { propertyName: "sales_priority", operator: "EQ", value: v });
    const active = (y: number) => ({ propertyName: `revenue_${y}`, operator: "GT", value: "0" });
    for (const [band, value] of PRIOS) {
      prio.push({
        band,
        all: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value)] }] }),
        active: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value), active(year)] }] }),
      });
    }
    const cy = await searchTotal("companies", { filterGroups: [{ filters: [active(year)] }] });
    const pyAll = await searchTotal("companies", { filterGroups: [{ filters: [active(py)] }] });
    ytd.C01 = { cy, py: pyAll, pyNote: `${py} whole year` };
    ytd.G01 = { cy, py: pyAll, pyNote: `${py} whole year` };
  });
  await guard("loggedIn", async () => {
    reportProgress(KEY, "counting companies that logged in");
    const cy = await searchTotal("companies", { filterGroups: [{ filters: [{ propertyName: "n_of_logins_datatracker", operator: "GT", value: "0" }] }] });
    const pyN = await searchTotal("companies", { filterGroups: [{ filters: [{ propertyName: `n_of_logins_datatracker_${py}`, operator: "GT", value: "0" }] }] });
    ytd.V06 = { cy, py: pyN, pyNote: `${py} whole year` };
  });

  // Traffic origin and countries (GA4), clicks by country (Search Console), year to date.
  const channels: LiveKpis["breakdowns"]["channels"] = [];
  const countries: LiveKpis["breakdowns"]["countries"] = [];
  const searchCountries: LiveKpis["breakdowns"]["searchCountries"] = [];
  await guard("ga4", async () => {
    reportProgress(KEY, "reading GA4 channels and countries");
    const ch = await fetchGa4Report({ name: "acquisitionChannels", from: `${year}-01-01`, to: iso(now) });
    for (const r of ch.rows) channels.push({ label: r.keys[0] || "(not set)", sessions: r.values[0] ?? 0, newUsers: r.values[1] ?? 0 });
    const co = await fetchGa4Report({ name: "countries", from: `${year}-01-01`, to: iso(now) });
    for (const r of co.rows) countries.push({ label: r.keys[0] || "(not set)", sessions: r.values[0] ?? 0 });
  });
  await guard("searchConsole", async () => {
    reportProgress(KEY, "reading Search Console countries");
    const g = await fetchGscQueries({ dimension: "country", from: `${year}-01-01`, to: iso(now), rowLimit: 15 });
    for (const r of g.rows) searchCountries.push({ label: r.key.toUpperCase(), clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 });
  });

  // Reach (SEO) month by month from Search Console, this year and last - the
  // Monthly inputs no longer carry R04-R07 (SARCLA 17.10: "update live")
  let search: LiveKpis["search"];
  await guard("searchConsoleMonthly", async () => {
    reportProgress(KEY, "reading Search Console day by day");
    const from = `${py}-01-01`, to = iso(now);
    const all = await fetchGscDaily({ from, to });
    const brand = await fetchGscDaily({ from, to, queryRegex: BRAND_QUERY });
    // the months the hub kept, with what Google still has; the whole months go back into the keep
    let kept: Record<string, MonthAcc> = {};
    try { kept = (await kvGet<Record<string, MonthAcc>>(SEARCH_HISTORY_KEY)) ?? {}; } catch { /* no database: Google's months only */ }
    const months = mergeHistory(kept, monthsFromDays(all.days, brand.days));
    try { await kvSet(SEARCH_HISTORY_KEY, completeOnly(months)); } catch { /* kept next time */ }
    Object.assign(series, seriesFromMonths(months, year, now));
    const dates = all.days.map((d) => d.date).sort();
    search = { firstDay: dates[0] ?? null, lastDay: dates[dates.length - 1] ?? null };
  });

  // SEA: Google Ads through GA4's Ads link, a year per call (GA4 takes 365 days at most)
  await guard("googleAds", async () => {
    reportProgress(KEY, "reading Google Ads through GA4");
    const s = { R01: empty(), R02: empty(), R03: empty() };
    for (const [side, y, to] of [["py", py, `${py}-12-31`], ["months", year, iso(now)]] as const) {
      const r = await fetchGa4Report({ name: "adsDaily", from: `${y}-01-01`, to });
      for (const row of r.rows) {
        const m = Number(row.keys[0]?.slice(5, 7)) - 1;
        if (!(m >= 0 && m < 12)) continue;
        s.R01[side][m] = (s.R01[side][m] ?? 0) + (row.values[0] ?? 0);
        s.R02[side][m] = (s.R02[side][m] ?? 0) + (row.values[1] ?? 0);
      }
    }
    for (const side of ["months", "py"] as const) {
      // before the Ads link answered, a month is nothing rather than zero
      s.R01[side] = notBeforeFirst(s.R01[side]);
      s.R02[side] = s.R02[side].map((v, i) => (s.R01[side][i] == null ? null : v));
      s.R03[side] = s.R01[side].map((imp, i) => (imp ? (s.R02[side][i] ?? 0) / imp : null));
    }
    Object.assign(series, s);
  });

  return {
    generatedAt: new Date().toISOString(), year, monthsDone,
    series, ytd,
    breakdowns: { channels, countries, searchCountries, prio, handover },
    search,
    errors,
  };
}
