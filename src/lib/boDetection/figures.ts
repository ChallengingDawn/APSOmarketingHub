// BACK OFFICE DETECTION FOR ANY PERIOD - the pure half (the HubSpot reads and the store are in engine.ts).
//
// The Detection tab's own rows are the e-mails the distribution engine read, kept 21 days - so its tiles could not answer
// for a year (SARCLA 25.10.2026, on 365 days: "why these numbers, this is not possible"). What a ticket is filed as, and
// whether a person had to re-file it, live ON the ticket and in its history, so they are counted per day for the whole
// Back Office history and any period is a sum of days.

/** One entry of a property's history as HubSpot returns it. */
export type Hist = { value: string; timestamp: string; sourceType?: string };

/** What one ticket counts for: its category today, and whether a person changed it to another one. */
export type Fact = { cat: string; person: boolean; fromOthers: boolean };

/** One day's tickets (by the day they were created, Swiss time). */
export type DayFig = { n: number; others: number; empty: number; person: number; fromOthers: number; cats: Record<string, number> };

/** A period's figures. */
export type Win = DayFig & { from: string; to: string };

const ZURICH = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
/** The Swiss calendar day of a moment, YYYY-MM-DD - the period picker's days are Swiss days. */
export const dayOf = (iso: string | number) => ZURICH.format(new Date(iso));

const isOthers = (v: string) => v === "Others";
const isEmpty = (v: string) => !v.trim();

/**
 * A person re-filed the ticket when a change made in HubSpot itself (CRM_UI) set a category other than the one it had
 * just before - the automatic one, or none. Setting the same value again is not a correction.
 */
export function factOf(current: string | null | undefined, hist: Hist[]): Fact {
  const cat = (current ?? "").trim();
  const asc = [...hist].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let prev = "";
  for (const h of asc) {
    const v = (h.value ?? "").trim();
    if (h.sourceType === "CRM_UI" && v && v !== prev) return { cat, person: true, fromOthers: isOthers(prev) || isEmpty(prev) };
    prev = v;
  }
  return { cat, person: false, fromOthers: false };
}

export const emptyDay = (): DayFig => ({ n: 0, others: 0, empty: 0, person: 0, fromOthers: 0, cats: {} });

export function addFact(d: DayFig, f: Fact): void {
  d.n++;
  if (isEmpty(f.cat)) d.empty++;
  else if (isOthers(f.cat)) d.others++;
  if (f.person) d.person++;
  if (f.fromOthers) d.fromOthers++;
  const k = f.cat || "(empty)";
  d.cats[k] = (d.cats[k] ?? 0) + 1;
}

function addDay(w: DayFig, d: DayFig): void {
  w.n += d.n; w.others += d.others; w.empty += d.empty; w.person += d.person; w.fromOthers += d.fromOthers;
  for (const [c, n] of Object.entries(d.cats)) w.cats[c] = (w.cats[c] ?? 0) + n;
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
