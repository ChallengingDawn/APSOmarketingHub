// BACK OFFICE DETECTION FOR ANY PERIOD - the pure half (the HubSpot reads and the store are in engine.ts).
//
// The Detection tab's own rows are the e-mails the distribution engine read, kept 21 days - so its tiles could not answer
// for a year (SARCLA 25.10.2026, on 365 days: "why these numbers, this is not possible"). What a ticket is filed as, and
// whether a person had to re-file it, live ON the ticket and in its history, so they are counted per day for the whole
// Back Office history and any period is a sum of days. Each ticket also counts for how sure its topic is - who set the
// category it has today (SARCLA 26.10.2026: "see the split on topic and confidence").

import { FLAG_TOPICS } from "../ticketClose/topics";

/** One entry of a property's history as HubSpot returns it. */
export type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string };

/**
 * Who set the category a ticket has today: a person; the AI reading the whole conversation at the close; the sentiment
 * flag (a hidden topic: internal, automatic or empty e-mail); the form or app the ticket came from; the AI's closest
 * guess for a customer e-mail it could not place (guess = it said "low"); keywords (the classifiers at intake and at
 * the close, the workflows' branches); none = Others or empty.
 */
export type How = "person" | "ai" | "flag" | "source" | "guess" | "keywords" | "none";
export const HOW_ORDER: How[] = ["person", "flag", "ai", "source", "guess", "keywords", "none"];
/** high = a person or the flag, medium = the AI or the form/app, low = the AI's unsure guess or keywords */
export const LEVEL: Record<How, "high" | "medium" | "low" | "none"> = { person: "high", flag: "high", ai: "medium", source: "medium", guess: "low", keywords: "low", none: "none" };
/** a ticket the AI filed by its closest guess (kv ticketClose:guessed) */
export type Guessed = { cat: string; sure: string };

/**
 * How a ticket came to the topic it has today (SARCLA 01.11.2026, on Detection: "the figures don't match - rethink the
 * app based on the logic we have"). The topic is decided in three places - at intake (the keywords, the form or app it
 * came from, or the person who created it), afterwards by the hub reading it (the sentiment flag, the AI two hours
 * after it arrived or at its close), and by a person re-filing it - so every ticket of a period is one of:
 * kept = it still has the topic it came with; hub = the hub's reading gave it (it came with Others, none, or a Task
 * Status Report); person = a person gave it the one it has; open = still Others or empty.
 */
export type Journey = "kept" | "hub" | "person" | "open";
export const JOURNEYS: Journey[] = ["kept", "hub", "person", "open"];

/** What one ticket counts for: its category today, how it got it, and whether a person changed it to another one. */
export type Fact = { cat: string; person: boolean; fromOthers: boolean; how: How; intake: string; journey: Journey };

/** One day's tickets (by the day they were created, Swiss time); topics = per category, how many by each How. */
export type DayFig = {
  n: number; others: number; empty: number; person: number; fromOthers: number; topics: Record<string, Partial<Record<How, number>>>;
  /** per Journey; tj = per category and Journey */
  j: Partial<Record<Journey, number>>; tj: Record<string, Partial<Record<Journey, number>>>;
  /** what changed after intake: pairKey(intake, today, journey) -> tickets (journeys hub and person only) */
  pairs: Record<string, number>;
};

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
export function howOf(cat: string, newest: Hist | undefined, resolvedAt?: string | null, guessed?: Guessed): How {
  if (isEmpty(cat) || isOthers(cat)) return "none";
  if (FLAG_TOPICS.includes(cat)) return "flag";
  if (!newest) return "keywords";
  if (byPerson(newest)) return "person";
  if (newest.sourceType === "INTEGRATION") {
    if (newest.sourceId === HUB_APP) {
      if (guessed?.cat === cat) return guessed.sure === "low" ? "guess" : "ai";
      return resolvedAt && Date.parse(newest.timestamp) >= Date.parse(resolvedAt) - 60_000 ? "ai" : "keywords";
    }
    return newest.sourceId && KEYWORD_APPS.has(newest.sourceId) ? "keywords" : "source";
  }
  return "keywords";
}

/** intake = what the ticket had half an hour after it arrived: the hub's routing writes within two minutes */
const INTAKE_MS = 30 * 60_000;
/** a value a person set this close to the creation came with the ticket (created by hand, its category picked) */
const BY_HAND_MS = 60_000;

/**
 * The topic a ticket came with: the last value set within its first half hour by the routing, a form or an app - or by
 * the person who created it, at the creation. A person's change after that is a re-filing, not the intake.
 */
export function intakeOf(hist: Hist[], created?: string | null): string {
  const asc = [...hist].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const c0 = created ? Date.parse(created) : NaN;
  if (!Number.isFinite(c0)) return (asc[0]?.value ?? "").trim();
  let v = "";
  for (const h of asc) {
    const t = Date.parse(h.timestamp);
    if (t > c0 + INTAKE_MS) break;
    if (!byPerson(h) || t <= c0 + BY_HAND_MS) v = (h.value ?? "").trim();
  }
  return v;
}

/** kept / hub / person / open - see Journey. */
export function journeyOf(cat: string, intake: string, how: How): Journey {
  if (isEmpty(cat) || isOthers(cat)) return "open";
  if (cat === intake) return "kept";
  return how === "person" ? "person" : "hub";
}

/** One key per "came with -> has today -> who"; the separator never appears in a category. */
const SEP = "\u0001";
export const pairKey = (intake: string, today: string, j: Journey) => [intake, today, j].join(SEP);
export function pairOf(key: string): { intake: string; today: string; journey: Journey } {
  const [intake, today, journey] = key.split(SEP);
  return { intake, today, journey: journey as Journey };
}

/**
 * A person re-filed the ticket when a change made by hand set a category other than the one it had just before - the
 * automatic one, or none. Setting the same value again is not a correction.
 */
export function factOf(current: string | null | undefined, hist: Hist[], resolvedAt?: string | null, guessed?: Guessed, created?: string | null): Fact {
  const cat = (current ?? "").trim();
  const asc = [...hist].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const how = howOf(cat, asc[asc.length - 1], resolvedAt, guessed);
  const intake = intakeOf(asc, created);
  const journey = journeyOf(cat, intake, how);
  let prev = "";
  for (const h of asc) {
    const v = (h.value ?? "").trim();
    if (byPerson(h) && v && v !== prev) return { cat, person: true, fromOthers: isOthers(prev) || isEmpty(prev), how, intake, journey };
    prev = v;
  }
  return { cat, person: false, fromOthers: false, how, intake, journey };
}

export const emptyDay = (): DayFig => ({ n: 0, others: 0, empty: 0, person: 0, fromOthers: 0, topics: {}, j: {}, tj: {}, pairs: {} });

export function addFact(d: DayFig, f: Fact): void {
  d.n++;
  if (isEmpty(f.cat)) d.empty++;
  else if (isOthers(f.cat)) d.others++;
  if (f.person) d.person++;
  if (f.fromOthers) d.fromOthers++;
  const c = f.cat || "(empty)";
  const t = (d.topics[c] ??= {});
  t[f.how] = (t[f.how] ?? 0) + 1;
  d.j[f.journey] = (d.j[f.journey] ?? 0) + 1;
  const tj = (d.tj[c] ??= {});
  tj[f.journey] = (tj[f.journey] ?? 0) + 1;
  if (f.journey === "hub" || f.journey === "person") {
    const k = pairKey(f.intake, f.cat, f.journey);
    d.pairs[k] = (d.pairs[k] ?? 0) + 1;
  }
}

function addCounts<K extends string>(into: Partial<Record<K, number>>, from: Partial<Record<K, number>> | undefined): void {
  for (const [k, n] of Object.entries(from ?? {}) as [K, number][]) into[k] = (into[k] ?? 0) + n;
}
function addDay(w: DayFig, d: DayFig): void {
  w.n += d.n; w.others += d.others; w.empty += d.empty; w.person += d.person; w.fromOthers += d.fromOthers;
  for (const [c, hows] of Object.entries(d.topics)) addCounts((w.topics[c] ??= {}), hows);
  addCounts(w.j, d.j);
  for (const [c, js] of Object.entries(d.tj ?? {})) addCounts((w.tj[c] ??= {}), js);
  addCounts(w.pairs, d.pairs);
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

/** A month of the period: its tickets per topic, and per Journey. */
export type MonthFig = { ym: string; topics: Record<string, number>; j: Partial<Record<Journey, number>> };

/** The tickets of from..to per month (YYYY-MM): per topic, and per Journey. */
export function monthsOf(days: Record<string, DayFig>, from: string, to: string): MonthFig[] {
  const by = new Map<string, MonthFig>();
  for (const [k, d] of Object.entries(days)) {
    if (k < from || k > to) continue;
    const ym = k.slice(0, 7);
    const m = by.get(ym) ?? { ym, topics: {}, j: {} };
    for (const [c, hows] of Object.entries(d.topics)) m.topics[c] = (m.topics[c] ?? 0) + Object.values(hows).reduce((a, n) => a + (n ?? 0), 0);
    addCounts(m.j, d.j);
    by.set(ym, m);
  }
  return [...by.values()].sort((a, b) => a.ym.localeCompare(b.ym));
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
