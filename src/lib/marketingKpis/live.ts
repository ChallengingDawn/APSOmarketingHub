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
//   search country   Search Console clicks and impressions by country, month by month this
//                    year and last (R09: clicks from the focus markets); every whole month kept
//   email (R11)      HubSpot's marketing emails per month: delivered, opens, clicks
//   SEA networks     Google Ads by network (Search, Performance Max...), this year and the same months last
//   Microsoft Ads    the visits GA4 tags bing / ppc, their orders and revenue, per month this year and last
//   reach (SEO)      Search Console day by day, folded into months this year and
//                    last: impressions, clicks, CTR, position, brand share (R04-R08);
//                    every whole month kept in the hub, beyond Google's 16 months
//   reach (SEA)      Google Ads impressions and clicks through GA4's Ads link, per
//                    day summed into months, this year and the whole of last (R01-R03);
//                    every whole month kept in the hub too
//   (R10, AI search visibility, is added by the KPI route from the AEO answers the hub keeps)

import { hubspotFetchJson, searchTotal } from "@/lib/integrations/hubspot";
import { fetchContactRequests } from "@/lib/integrations/contactRequests";
import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { fetchGscDaily, fetchGscQueries } from "@/lib/integrations/gsc";
import { kvGet, kvSet } from "@/lib/db/init";
import { BRAND_QUERY, completeOnly, mergeHistory, monthsFromDays, seriesFromMonths, type MonthAcc } from "./searchMonthly";
import { countryTable, mergeCountryMonths, r09Series, type CountryMonths, type CountryRow } from "./countryMonths";
import { chfPerEur, chfToEur, type ChfPerEur } from "./fx";
import { msAdsSeries, msAdsSheetId, msAdsStale, parseMsAdsSheet } from "./msAdsSheet";
import { googleFetchJson } from "@/lib/integrations/google";

/** Every whole month of Search Console the hub has read - Google drops them after 16 months, the hub does not. */
const SEARCH_HISTORY_KEY = "marketingKpis:searchMonths:v1";
/** Every whole month of Google Ads impressions and clicks the hub has read (SARCLA 17.10: "have the data in our database"). */
const SEA_HISTORY_KEY = "marketingKpis:seaMonths:v1";
/** Every whole month of Search Console by country (R09). */
const COUNTRY_HISTORY_KEY = "marketingKpis:searchCountryMonths:v1";
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
    /** by country, this year so far; pyClicks/sameClicks on the whole months both years have (`searchSame`) */
    searchCountries: (CountryRow | { label: string; clicks: number; impressions: number; pyClicks?: undefined; sameClicks?: undefined; focus?: undefined })[];
    /** the months (0-11) the country comparison is made on */
    searchSame?: number[];
    /** clicks and impressions by country and month, this year and last - Reach's period and country filter */
    searchCountryMonths?: CountryMonths;
    /** Google Ads by network, the whole months this year against the same months last year */
    /** cost in euros (GA4's francs at each month's ECB rate), or in francs - `seaCurrency` says which */
    seaNetworks?: { label: string; impr: number; clicks: number; cost: number; pyImpr: number; pyClicks: number; pyCost: number }[];
    seaCurrency?: "EUR" | "CHF";
    /** "YYYY-MM" -> network -> [impressions, clicks, cost] - Reach's period filter */
    seaNetworkMonths?: Record<string, Record<string, [number, number, number]>>;
    /** the Microsoft Advertising script's sheet: the last day counted, when it was written, whether it has stopped */
    msAds?: { through: string | null; written: string | null; stale: boolean; currency: string | null };
    seaUpTo?: number;
    prio: { band: string; all: number | null; active: number | null }[];
    handover: { eso: Monthly; tsa: Monthly };
  };
  /** how far Search Console's days reach: Google keeps 16 months and lags a day or two */
  search?: { firstDay: string | null; lastDay: string | null };
  errors: Record<string, string>;
  /**
   * Live KPIs whose source is not open to the hub yet, with what they wait for (R11 until the
   * hub's HubSpot app may read marketing email) - listed as not connected, not as empty cards,
   * and not read again every half hour as a failure would be.
   */
  waiting?: Record<string, string>;
  /** francs per euro by month (ECB) - the pages turn the typed francs into euros with it */
  fx?: ChfPerEur;
};

/** A read with a failed source is asked again after this, not after 6 hours (12.10.2026: a GA4 403 stayed on the page after its fix). */
const RETRY_FAILED_MS = 30 * 60 * 1000;

export function marketingKpisLive(): Promise<SlowState<LiveKpis>> {
  // a read stored before Reach came from Search Console (17.10.2026) has neither its months nor its error:
  // it is out of date at once, so the next visit reads again (the stored figures show meanwhile)
  // and one stored before R09, R11 and the SEA networks (18.10.2026) likewise
  return slowReport(KEY, (v) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS
    : !v?.series?.R04 || !v?.series?.R01 || !v?.series?.R09 || (!v?.series?.R11 && !v?.waiting?.R11) || !v?.breakdowns?.seaNetworks || !v?.fx || !v?.series?.MSV || (msAdsSheetId() && !v?.breakdowns?.msAds) ? 0 : TTL_MS), build);
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

  // Exchange rates first: Google's francs become euros (SARCLA 18.10: "everything in EUR")
  let fx: ChfPerEur = {};
  await guard("fx", async () => {
    reportProgress(KEY, "reading the ECB exchange rates");
    fx = await chfPerEur(`${py}-01`);
  });

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
  let searchCountries: LiveKpis["breakdowns"]["searchCountries"] = [];
  let searchSame: number[] | undefined;
  let searchCountryMonths: CountryMonths | undefined;
  let seaNetworks: LiveKpis["breakdowns"]["seaNetworks"];
  let msAds: LiveKpis["breakdowns"]["msAds"];
  const seaNetworkMonths: NonNullable<LiveKpis["breakdowns"]["seaNetworkMonths"]> = {};
  const waiting: Record<string, string> = {};
  await guard("ga4", async () => {
    reportProgress(KEY, "reading GA4 channels and countries");
    const ch = await fetchGa4Report({ name: "acquisitionChannels", from: `${year}-01-01`, to: iso(now) });
    for (const r of ch.rows) channels.push({ label: r.keys[0] || "(not set)", sessions: r.values[0] ?? 0, newUsers: r.values[1] ?? 0 });
    const co = await fetchGa4Report({ name: "countries", from: `${year}-01-01`, to: iso(now) });
    for (const r of co.rows) countries.push({ label: r.keys[0] || "(not set)", sessions: r.values[0] ?? 0 });
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

  // Search visibility by country (R09): a Search Console read per month, from January last
  // year - Google keeps 16 months, the hub every whole month it has read
  await guard("searchConsole", async () => {
    const fresh: CountryMonths = {};
    const thisMonth = iso(now).slice(0, 7);
    // a month that starts before Google's first day is only partly there: shown, never kept
    const first = search?.firstDay ?? iso(new Date(Date.UTC(year, now.getUTCMonth() - 15, 1)));
    for (let k = 0; k <= 12 + now.getUTCMonth(); k++) {
      const start = new Date(Date.UTC(py, k, 1)), end = new Date(Date.UTC(py, k + 1, 0));
      const m = iso(start).slice(0, 7);
      if (iso(end) < first) continue;
      reportProgress(KEY, `reading Search Console countries ${m}`);
      const g = await fetchGscQueries({ dimension: "country", from: iso(start), to: m === thisMonth ? iso(now) : iso(end), rowLimit: 300 });
      fresh[m] = Object.fromEntries(g.rows.map((r) => [r.key.toLowerCase(), [r.clicks ?? 0, r.impressions ?? 0] as [number, number]]));
    }
    let kept: CountryMonths = {};
    try { kept = (await kvGet<CountryMonths>(COUNTRY_HISTORY_KEY)) ?? {}; } catch { /* no database: Google's months only */ }
    const { months, keep } = mergeCountryMonths(kept, fresh, (m) => m < thisMonth && `${m}-01` >= first);
    try { await kvSet(COUNTRY_HISTORY_KEY, keep); } catch { /* kept next time */ }
    series.R09 = r09Series(months, year);
    // a month only partly there is no month to compare
    for (const side of ["months", "py"] as const) {
      for (let i = 0; i < 12; i++) {
        const m = `${side === "py" ? py : year}-${String(i + 1).padStart(2, "0")}`;
        if (m < thisMonth && `${m}-01` < first && !kept[m]) series.R09[side][i] = null;
      }
    }
    const t = countryTable(Object.fromEntries(Object.entries(months).filter(([m]) => m >= thisMonth || `${m}-01` >= first || kept[m])), year, monthsDone);
    searchCountries = t.rows;
    searchSame = t.same;
    searchCountryMonths = Object.fromEntries(Object.entries(months).filter(([m]) => (m.startsWith(`${year}-`) || m.startsWith(`${py}-`)) && (m >= thisMonth || `${m}-01` >= first || kept[m])));
  });

  // Email reach (R11): HubSpot's marketing emails per month - delivered, opens, clicks
  await guard("email", async () => {
    reportProgress(KEY, "reading HubSpot marketing email statistics");
    type Counters = Record<string, number | undefined>;
    type Bucket = { interval?: { start?: string | number }; aggregations?: { counters?: Counters }; counters?: Counters };
    let r: { results?: Bucket[] };
    try {
      r = await hubspotFetchJson<{ results?: Bucket[] }>({
        path: `/marketing/v3/emails/statistics/histogram?interval=MONTH&startTimestamp=${encodeURIComponent(`${py}-01-01T00:00:00Z`)}&endTimestamp=${encodeURIComponent(now.toISOString())}`,
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/MISSING_SCOPES|required scopes/i.test(msg)) {
        // HubSpot does not offer marketing.email.read to the hub's app (18.10.2026: the upload was refused)
        const why = "HubSpot does not yet let the hub's app read marketing email statistics";
        for (const id of ["R11", "R11O", "R11C"]) waiting[id] = why;
        return;
      }
      throw e;
    }
    const s = { R11: empty(), R11OP: empty(), R11CL: empty(), R11O: empty(), R11C: empty() };
    for (const b of r.results ?? []) {
      const at = b.interval?.start;
      if (at == null) continue;
      // the interval starts at midnight in the portal's time zone: half a day on lands in its month either way
      const d = new Date((typeof at === "number" ? at : Date.parse(at)) + 12 * 3600 * 1000);
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      const side = y === year ? "months" : y === py ? "py" : null;
      if (!side) continue;
      const c = b.aggregations?.counters ?? b.counters ?? {};
      s.R11[side][m] = (s.R11[side][m] ?? 0) + (c.delivered ?? 0);
      s.R11OP[side][m] = (s.R11OP[side][m] ?? 0) + (c.open ?? c.opened ?? 0);
      s.R11CL[side][m] = (s.R11CL[side][m] ?? 0) + (c.click ?? c.clicked ?? 0);
    }
    for (const side of ["months", "py"] as const) {
      s.R11[side] = notBeforeFirst(s.R11[side]);
      for (const k of ["R11OP", "R11CL"] as const) s[k][side] = s[k][side].map((v, i) => (s.R11[side][i] == null ? null : v));
      s.R11O[side] = s.R11[side].map((n, i) => (n ? (s.R11OP[side][i] ?? 0) / n : null));
      s.R11C[side] = s.R11[side].map((n, i) => (n ? (s.R11CL[side][i] ?? 0) / n : null));
    }
    Object.assign(series, s);
  });

  // SEA by network: the whole months this year against the same months last year
  await guard("googleAdsNetworks", async () => {
    reportProgress(KEY, "reading Google Ads by network");
    if (!monthsDone) return;
    const acc: Record<string, { impr: number; clicks: number; cost: number; pyImpr: number; pyClicks: number; pyCost: number }> = {};
    const lastDay = (y: number) => iso(new Date(Date.UTC(y, monthsDone, 0)));
    for (const [y, cy] of [[year, true], [py, false]] as const) {
      const r = await fetchGa4Report({ name: "adsNetworkDaily", from: `${y}-01-01`, to: lastDay(y) });
      for (const row of r.rows) {
        const a = (acc[row.keys[1] || "(not set)"] ??= { impr: 0, clicks: 0, cost: 0, pyImpr: 0, pyClicks: 0, pyCost: 0 });
        // GA4's cost is in francs: each day at its month's rate
        const chf = row.values[2] ?? 0;
        const cost = Object.keys(fx).length ? chfToEur(chf, String(row.keys[0] ?? "").slice(0, 7), fx) ?? chf : chf;
        if (cy) { a.impr += row.values[0] ?? 0; a.clicks += row.values[1] ?? 0; a.cost += cost; }
        else { a.pyImpr += row.values[0] ?? 0; a.pyClicks += row.values[1] ?? 0; a.pyCost += cost; }
        const mo = ((seaNetworkMonths[String(row.keys[0] ?? "").slice(0, 7)] ??= {})[row.keys[1] || "(not set)"] ??= [0, 0, 0]);
        mo[0] += row.values[0] ?? 0; mo[1] += row.values[1] ?? 0; mo[2] += cost;
      }
    }
    seaNetworks = Object.entries(acc).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.impr + b.pyImpr - (a.impr + a.pyImpr));
  });

  // Microsoft Ads as GA4 sees it: bing / ppc visits, orders and revenue per month (revenue in euros)
  await guard("microsoftAds", async () => {
    reportProgress(KEY, "reading Microsoft Ads visits through GA4");
    const s = { MSV: empty(), MSO: empty(), MSR: empty() };
    for (const [side, y, to] of [["py", py, `${py}-12-31`], ["months", year, iso(now)]] as const) {
      const r = await fetchGa4Report({ name: "msAdsDaily", from: `${y}-01-01`, to });
      for (const row of r.rows) {
        const ymd = String(row.keys[0] ?? "");
        const m = Number(ymd.slice(5, 7)) - 1;
        if (!(m >= 0 && m < 12)) continue;
        s.MSV[side][m] = (s.MSV[side][m] ?? 0) + (row.values[0] ?? 0);
        s.MSO[side][m] = (s.MSO[side][m] ?? 0) + (row.values[1] ?? 0);
        const chf = row.values[2] ?? 0;
        s.MSR[side][m] = (s.MSR[side][m] ?? 0) + (Object.keys(fx).length ? chfToEur(chf, ymd.slice(0, 7), fx) ?? chf : chf);
      }
    }
    for (const side of ["months", "py"] as const) {
      s.MSV[side] = notBeforeFirst(s.MSV[side]);
      s.MSO[side] = s.MSO[side].map((v, i) => (s.MSV[side][i] == null ? null : v ?? 0));
      s.MSR[side] = s.MSR[side].map((v, i) => (s.MSV[side][i] == null ? null : v ?? 0));
    }
    // without a rate the revenue would be francs under a euro sign: then it is left out
    if (!Object.keys(fx).length) delete (s as Partial<typeof s>).MSR;
    Object.assign(series, s);
  });

  // Microsoft Ads impressions, clicks and cost: the Microsoft Advertising script's Google Sheet
  await guard("microsoftAdsSheet", async () => {
    const id = msAdsSheetId();
    if (!id) {
      const why = "Being set up: a script in Microsoft Advertising will write these to a Google Sheet every morning";
      for (const k of ["R01M", "R02M", "X01M"]) waiting[k] = why;
      return;
    }
    reportProgress(KEY, "reading the Microsoft Ads sheet");
    const r = await googleFetchJson<{ values?: unknown[][] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent("A1:I60")}?valueRenderOption=UNFORMATTED_VALUE`,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly", label: "Microsoft Ads sheet",
    });
    const sheet = parseMsAdsSheet(r.values);
    const rate = Object.keys(fx).length && (sheet.currency ?? "CHF") === "CHF" ? (v: number, m: string) => chfToEur(v, m, fx) : undefined;
    const s = msAdsSeries(sheet, year, rate);
    // francs that could not be turned into euros are left out rather than shown under a euro sign
    if ((sheet.currency ?? "CHF") === "CHF" && !rate) delete (s as Partial<typeof s>).X01M;
    Object.assign(series, s);
    msAds = { through: sheet.through, written: sheet.written, stale: msAdsStale(sheet, now), currency: sheet.currency };
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
    // the whole months go into the hub's keep; a month GA4 no longer gives comes from it
    let kept: Record<string, { impr: number; clicks: number }> = {};
    try { kept = (await kvGet<Record<string, { impr: number; clicks: number }>>(SEA_HISTORY_KEY)) ?? {}; } catch { /* no database */ }
    const thisMonth = iso(now).slice(0, 7);
    for (const [side, y] of [["py", py], ["months", year]] as const) {
      for (let m = 0; m < 12; m++) {
        const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
        if (s.R01[side][m] != null && ym < thisMonth) kept[ym] = { impr: s.R01[side][m]!, clicks: s.R02[side][m] ?? 0 };
        else if (s.R01[side][m] == null && kept[ym]) { s.R01[side][m] = kept[ym].impr; s.R02[side][m] = kept[ym].clicks; }
      }
    }
    try { await kvSet(SEA_HISTORY_KEY, kept); } catch { /* kept next time */ }
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
    breakdowns: { channels, countries, searchCountries, searchSame, searchCountryMonths, seaNetworks, seaNetworkMonths, msAds, seaUpTo: monthsDone, seaCurrency: Object.keys(fx).length ? "EUR" : "CHF", prio, handover },
    search,
    errors,
    waiting,
    fx,
  };
}
