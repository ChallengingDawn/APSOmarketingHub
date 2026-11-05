// THE GQS TAB OF THE INCOMING TICKETS PAGE (SARCLA 05.11.2026: "another tab on ESO and Sales leader on customer tickets -
// a new, really developed tab to show the results of GQS to the sales leader, and to be able to report it also on my
// reports"; "GQS to line manager on GQS win rate and so forth"). What Sales asked Back Office for through GQS and what came
// of it, for the people the page shows - ESO, TSA, a line manager's team, a sales leader's team, one person. Pure: the
// tasks are the Back-Office report's (boGqs.ts, kept in kv boReport:gqsTasks), the page slices them.
//
//   whose      the requester's (back_office_ticket_requester) - the Sales person who asked
//   requests   by the day they came in; the offers by the day first sent to Sales, whenever asked for (as on the
//              Back-Office GQS page), so a period's offers are like for like with the months before
//   win rate   won of the offers sent whose result is known (STATUS OF GQS WON / LOST) - a request refused or never
//              offered is no lost offer
//   open       every task open today, whatever the period

import { FIRST_MONTH, daysTo, median, offersOf, sumOf, winRate, type GStage, type GqsTask } from "./boGqs";

export type GqsPerson = { name: string; team: string };
/** What the page reads: the tasks, their people by HubSpot owner id (requester, line manager, Back Office), whether a read runs. */
export type EsoGqs = { at: string; tasks: GqsTask[]; people: Record<string, GqsPerson> };

/** The tickets pages' window: months of the read's year (or the year before, year 1), the first and the last cut by days. */
export type GWin = { from: number; to: number; year?: 0 | 1; d0?: number; d1?: number };

const SWISS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
/** A moment's day in Zurich: [year, month 0-11, day]. */
export function swissYmd(ms: number): [number, number, number] {
  const [y, m, d] = SWISS.format(new Date(ms)).split("-").map(Number);
  return [y, m - 1, d];
}
/** Whether a moment falls in the window of a year's months. */
export function inWin(ms: number | undefined, year: number, win: GWin): boolean {
  if (!ms) return false;
  const [y, m, d] = swissYmd(ms);
  if (y !== year - (win.year ?? 0) || m < win.from || m > win.to) return false;
  if (m === win.from && d < (win.d0 ?? 1)) return false;
  if (m === win.to && d > (win.d1 ?? 31)) return false;
  return true;
}
/** Last year's same months only where GQS already ran in every one of them (from July 2025). */
export const prevOk = (year: number, win: GWin) => `${year - 1}-${String(win.from + 1).padStart(2, "0")}` >= FIRST_MONTH;

/** The name a person is shown by - "Nobody" for none. */
export const nameOf = (g: EsoGqs, id: string | undefined) => (id ? g.people[id]?.name ?? `Owner ${id}` : "Nobody");

/**
 * The requesters a page shows: ESO's or TSA's (their rosters, else their HubSpot team), a line manager's team under ESO
 * (Map assignment), the people of My Sales' or Sales Leader Reports' switch (`scoped`), or everyone (null).
 */
export function requestersOf(g: EsoGqs, team: "eso" | "tsa" | "total", lead: string | null, byId: Record<string, string>, scoped: boolean): Set<string> | null {
  const ids = new Set(g.tasks.flatMap((t) => (t.rq ? [t.rq] : [])));
  if (scoped) return new Set([...ids].filter((id) => !!lead && byId[id] === lead));
  if (team === "total") return null;
  const want = team === "eso" ? "ESO" : "TSA";
  return new Set([...ids].filter((id) => g.people[id]?.team === want && (team !== "eso" || !lead || byId[id] === lead)));
}

/** The period's requests (by the day they came in) and offers (by the day first sent) of some requesters - and of some names, the page's person filter. */
export type GSets = { req: GqsTask[]; off: GqsTask[] };
export function setsOf(g: EsoGqs, year: number, win: GWin, who: Set<string> | null, names?: string[]): GSets {
  const pick = names?.length ? new Set(names) : null;
  const mine = g.tasks.filter((t) => (!who || (!!t.rq && who.has(t.rq))) && (!pick || pick.has(nameOf(g, t.rq))));
  return { req: mine.filter((t) => inWin(t.c, year, win)), off: mine.filter((t) => inWin(t.of, year, win)) };
}

/** A group's figures: the requests and their approval, the offers and what came of them, the value, the speed. */
export type GStat = {
  req: number; review: number; lmYes: number; lmNo: number; refused: number;
  offers: number; won: number; lost: number; wait: number; rate: number | null;
  potAsked: number; potOffered: number; potWon: number; days: number | null;
};
export function statOf(s: GSets): GStat {
  const a = sumOf(s.req), o = offersOf(s.off);
  return {
    req: a.n, review: a.review, lmYes: a.lmYes, lmNo: a.lmNo, refused: a.refused,
    offers: o.n, won: o.won, lost: o.lost, wait: o.n - o.won - o.lost, rate: winRate(o.won, o.lost),
    potAsked: a.pot, potOffered: o.pot, potWon: o.potWon, days: median(o.days),
  };
}
/** The figures by a breakdown - the requester, their line manager, the type of request - the largest first. */
export function statsBy(g: EsoGqs, s: GSets, key: (t: GqsTask) => string): Map<string, GStat> {
  const keys = new Set([...s.req, ...s.off].map(key));
  const out = new Map<string, GStat>();
  for (const k of keys) out.set(k, statOf({ req: s.req.filter((t) => key(t) === k), off: s.off.filter((t) => key(t) === k) }));
  return new Map([...out].sort((a, b) => b[1].offers + b[1].req - (a[1].offers + a[1].req)));
}
export const typeOf = (t: GqsTask) => t.ty ?? (t.c < Date.UTC(2026, 0, 1) ? "Not asked yet (before 2026)" : "No type");

/** Month by month over the window: requests by the month they came in, the offers by the month first sent and what came of them. */
export type GMonths = { req: number[]; offers: number[]; won: number[]; lost: number[]; wait: number[] };
export function monthsOf(s: GSets, win: GWin): GMonths {
  const n = win.to - win.from + 1;
  const z = () => Array.from({ length: n }, () => 0);
  const m: GMonths = { req: z(), offers: z(), won: z(), lost: z(), wait: z() };
  for (const t of s.req) m.req[swissYmd(t.c)[1] - win.from]++;
  for (const t of s.off) {
    const i = swissYmd(t.of!)[1] - win.from;
    m.offers[i]++;
    if (t.res === "w") m.won[i]++; else if (t.res === "l") m.lost[i]++; else m.wait[i]++;
  }
  return m;
}

/** Every task open today of some requesters (whatever the period): its stage, since when, the days since the request. */
export type GOpen = { t: GqsTask; inStage: number | null; age: number | null };
export function openOf(g: EsoGqs, who: Set<string> | null, now: number, names?: string[]): GOpen[] {
  const pick = names?.length ? new Set(names) : null;
  return g.tasks.filter((t) => t.s !== "offer" && t.s !== "refused" && (!who || (!!t.rq && who.has(t.rq))) && (!pick || pick.has(nameOf(g, t.rq))))
    .map((t) => ({ t, inStage: t.at ? daysTo(t.at, now) : null, age: daysTo(t.c, now) }))
    .sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
}
/** The open tasks by a breakdown: how many, how many there over four weeks, the median days in their stage, the stage most are in. */
export function openBy(open: GOpen[], key: (o: GOpen) => string): { label: string; n: number; old: number; days: number | null; most: GStage | null }[] {
  const by = new Map<string, GOpen[]>();
  for (const o of open) { const k = key(o); const x = by.get(k); if (x) x.push(o); else by.set(k, [o]); }
  return [...by].map(([label, xs]) => {
    const st = new Map<GStage, number>();
    for (const o of xs) st.set(o.t.s, (st.get(o.t.s) ?? 0) + 1);
    const most = [...st].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { label, n: xs.length, old: xs.filter((o) => (o.inStage ?? 0) > 28).length, days: median(xs.map((o) => o.inStage ?? 0)), most };
  }).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/** The fields the page draws - the days per stage and the approval rule's reasons stay on the Back-Office page. */
const SLIM = ["id", "c", "s", "ty", "o", "rq", "lm", "cu", "pot", "of", "ofN", "rf", "at", "ap", "dec", "res", "by"] as const;
export const slimTask = (t: GqsTask): GqsTask => Object.fromEntries(SLIM.flatMap((k) => (t[k] === undefined ? [] : [[k, t[k]]]))) as unknown as GqsTask;
