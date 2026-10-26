// BACK OFFICE DETECTION FOR ANY PERIOD - the pure half (the HubSpot reads and the store are in engine.ts).
//
// The Detection tab's own rows are the e-mails the distribution engine read, kept 21 days - so its tiles could not answer
// for a year (SARCLA 25.10.2026, on 365 days: "why these numbers, this is not possible"). What a ticket is filed as, and
// whether a person had to re-file it, live ON the ticket and in its history, so they are counted per day for the whole
// Back Office history and any period is a sum of days. Each ticket also counts for how sure its topic is - who set the
// category it has today (SARCLA 26.10.2026: "see the split on topic and confidence").

import { HIDDEN_TOPICS } from "../ticketClose/topics";

/** One entry of a property's history as HubSpot returns it. */
export type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string };

/**
 * Who set the category a ticket has today: a person; the AI reading the whole conversation at the close; the sentiment
 * flag (a hidden topic: internal, automatic or empty e-mail); the form or app the ticket came from; keywords (the
 * classifiers at intake and at the close, the workflows' branches); none = Others or empty.
 */
export type How = "person" | "ai" | "flag" | "source" | "keywords" | "none";
export const HOW_ORDER: How[] = ["person", "flag", "ai", "source", "keywords", "none"];
/** high = a person or the flag, medium = the AI or the form/app, low = keywords */
export const LEVEL: Record<How, "high" | "medium" | "low" | "none"> = { person: "high", flag: "high", ai: "medium", source: "medium", keywords: "low", none: "none" };

/** What one ticket counts for: its category today, how it got it, and whether a person changed it to another one. */
export type Fact = { cat: string; person: boolean; fromOthers: boolean; how: How };

/** One day's tickets (by the day they were created, Swiss time); topics = per category, how many by each How. */
export type DayFig = { n: number; others: number; empty: number; person: number; fromOthers: number; topics: Record<string, Partial<Record<How, number>>> };

/** A period's figures. */
export type Win = DayFig & { from: string; to: string };

const ZURICH = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
/** The Swiss calendar day of a moment, YYYY-MM-DD - the period picker's days are Swiss days. */
export const dayOf = (iso: string | number) => ZURICH.format(new Date(iso));

const isOthers = (v: string) => v === "Others";
const isEmpty = (v: string) => !v.trim();

const HUB_APP = "50521064";
/** the keyword classifiers' HubSpot apps (routing and the close classifier, the older close classifier) */
const KEYWORD_APPS = new Set(["30109717", "34987322"]);
const byPerson = (h: Hist) => h.sourceType === "CRM_UI" || h.sourceType === "CONVERSATIONS" || /^MOBILE/.test(h.sourceType ?? "");

/** Who set today's category - from the newest entry of its history; the hub's app at or after the close is the AI. */
export function howOf(cat: string, newest: Hist | undefined, resolvedAt?: string | null): How {
  if (isEmpty(cat) || isOthers(cat)) return "none";
  if (HIDDEN_TOPICS.includes(cat)) return "flag";
  if (!newest) return "keywords";
  if (byPerson(newest)) return "person";
  if (newest.sourceType === "INTEGRATION") {
    if (newest.sourceId === HUB_APP) return resolvedAt && Date.parse(newest.timestamp) >= Date.parse(resolvedAt) - 60_000 ? "ai" : "keywords";
    return newest.sourceId && KEYWORD_APPS.has(newest.sourceId) ? "keywords" : "source";
  }
  return "keywords";
}

/**
 * A person re-filed the ticket when a change made by hand set a category other than the one it had just before - the
 * automatic one, or none. Setting the same value again is not a correction.
 */
export function factOf(current: string | null | undefined, hist: Hist[], resolvedAt?: string | null): Fact {
  const cat = (current ?? "").trim();
  const asc = [...hist].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const how = howOf(cat, asc[asc.length - 1], resolvedAt);
  let prev = "";
  for (const h of asc) {
    const v = (h.value ?? "").trim();
    if (byPerson(h) && v && v !== prev) return { cat, person: true, fromOthers: isOthers(prev) || isEmpty(prev), how };
    prev = v;
  }
  return { cat, person: false, fromOthers: false, how };
}

export const emptyDay = (): DayFig => ({ n: 0, others: 0, empty: 0, person: 0, fromOthers: 0, topics: {} });

export function addFact(d: DayFig, f: Fact): void {
  d.n++;
  if (isEmpty(f.cat)) d.empty++;
  else if (isOthers(f.cat)) d.others++;
  if (f.person) d.person++;
  if (f.fromOthers) d.fromOthers++;
  const t = (d.topics[f.cat || "(empty)"] ??= {});
  t[f.how] = (t[f.how] ?? 0) + 1;
}

function addDay(w: DayFig, d: DayFig): void {
  w.n += d.n; w.others += d.others; w.empty += d.empty; w.person += d.person; w.fromOthers += d.fromOthers;
  for (const [c, hows] of Object.entries(d.topics)) {
    const t = (w.topics[c] ??= {});
    for (const [h, n] of Object.entries(hows) as [How, number][]) t[h] = (t[h] ?? 0) + n;
  }
}

/**
 * The days of several month stores in one. Added, not replaced: a ticket created on the last evening of a month (UTC)
 * can fall on the next Swiss day, so that day appears in two months.
 */
export function mergeDays(stores: Record<string, DayFig>[]): Record<string, DayFig> {
  const out: Record<string, DayFig> = {};
  for (const s of stores) for (const [k, d] of Object.entries(s)) addDay((out[k] ??= emptyDay()), d);
  return out;
}

/** The sum of the days from..to (inclusive, YYYY-MM-DD). */
export function sumDays(days: Record<string, DayFig>, from: string, to: string): Win {
  const w: Win = { ...emptyDay(), from, to };
  for (const [k, d] of Object.entries(days)) if (k >= from && k <= to) addDay(w, d);
  return w;
}

const DAY_MS = 86_400_000;
const asUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The same number of days immediately before from..to. */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const len = Math.round((asUtc(to) - asUtc(from)) / DAY_MS) + 1;
  return { from: isoOf(asUtc(from) - len * DAY_MS), to: isoOf(asUtc(from) - DAY_MS) };
}

/** The months (YYYY-MM) from the first one to the one of `now`. */
export function monthsSince(first: string, now = new Date()): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
  while (y * 12 + (m - 1) <= end) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** "26 Oct 2025" - by hand in UTC, so the server and the browser write the same thing. */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
}
export const rangeLabel = (from: string, to: string) => (from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`);
