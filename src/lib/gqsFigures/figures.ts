// GQS FIGURES - the pure half (the HubSpot read is in read.ts). SARCLA 01.11.2026, on Back Office distribution: "GQS
// should have its own KPI, subdivided like we do in advanced reporting - create a main toggle between pipelines".
//
// A GQS task is a request for an offer the Back Office prepares with the GQS team: it arrives (created by Sales, or in
// New for Back-Office), is worked (Open the GQS Task, Waiting on GQS, Waiting on Customer, Remind Back-Office) and ends
// as "Offer Sent to Sales" or "Refused". STATUS OF GQS then carries what came of the offer - WON or LOST - besides the
// approval steps. Measured 01.11.2026 on the 693 tasks since July 2025: 545 offers sent, 90 refused; the type of request
// and the WON / LOST outcome are kept on almost every task only from February 2026, so a period before that shows many
// "No type" and few outcomes - said where it is shown, never filled in.

import { dayOf } from "../boDetection/figures";

/** The GQS pipeline's stages the figures name (Back Office - Special Tasks GQS, 1726786775). */
export const GQS_STAGE = {
  createdBySales: "3153750219",
  newForBo: "2338266314",
  open: "2338266316",
  waitingGqs: "4704538856",
  waitingCustomer: "4793532647",
  waitingApso: "6078992599",
  remind: "2964068584",
  refused: "2510335189",
  offer: "2520497377",
} as const;
/** The stages a task spends its time in, in their order - each one's cumulative time is read. */
export const WORK_STAGES = [GQS_STAGE.createdBySales, GQS_STAGE.newForBo, GQS_STAGE.open, GQS_STAGE.waitingGqs, GQS_STAGE.waitingCustomer, GQS_STAGE.waitingApso, GQS_STAGE.remind] as const;

/** One GQS task as the figures need it. */
export type GqsRow = {
  id: string; created: string; stage: string; status: string | null; type: string | null;
  owner: string | null; ownerName: string | null;
  /** when it entered Offer Sent to Sales / Refused (the last time) */
  offerAt: string | null; refusedAt: string | null;
  /** milliseconds spent in each of WORK_STAGES, all the times it was there */
  t: Partial<Record<string, number>>;
  /** the linked ESO ticket's stage, as HubSpot copies it (ESO PIPELINE STATUS (FOR GQS)) */
  eso: string | null;
  /** "Reason to refuse" */
  reason: string | null;
  subject: string;
};
export type GqsStore = { at: string; rows: GqsRow[]; stages: { id: string; label: string; closed: boolean }[] };

export type Outcome = "offer" | "refused" | "open";
export const outcomeOf = (r: GqsRow): Outcome => (r.stage === GQS_STAGE.offer ? "offer" : r.stage === GQS_STAGE.refused ? "refused" : "open");
/** What came of the offer: WON / LOST in STATUS OF GQS, else not known (yet). */
export const resultOf = (r: GqsRow): "won" | "lost" | null => {
  const s = (r.status ?? "").trim().toUpperCase();
  return s === "WON" ? "won" : s === "LOST" ? "lost" : null;
};
const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
export const NO_TYPE = "No type";
/** "DT -  New Business" -> "DT - New Business" (HubSpot's labels carry two spaces). */
export const typeOf = (r: GqsRow) => tidy(r.type) || NO_TYPE;
export const NOBODY = "Nobody";
export const ownerOf = (r: GqsRow) => tidy(r.ownerName) || (r.owner ? `Owner ${r.owner}` : NOBODY);
/** Who refused it, from STATUS OF GQS ("Refused by GQS"); a task in Refused with another status: just "Refused". */
export const refusedBy = (r: GqsRow) => { const s = tidy(r.status); return /^refused by /i.test(s) ? s : "Refused"; };

const DAY = 86_400_000;
/** Days from the request to the offer sent to Sales. */
export const daysToOffer = (r: GqsRow): number | null => {
  if (!r.offerAt) return null;
  const d = (Date.parse(r.offerAt) - Date.parse(r.created)) / DAY;
  return Number.isFinite(d) && d >= 0 ? d : null;
};
/** Days a task has been open, at `now`. */
export const ageDays = (r: GqsRow, now = Date.now()) => Math.max(0, (now - Date.parse(r.created)) / DAY);

export function median(xs: number[]): number | null {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * A set of tasks summed up. won / lost = STATUS OF GQS, whatever the stage (a task can say WON while its stage was never
 * moved); waiting = in Offer Sent to Sales with no outcome yet; days = days to the offer of each offer sent.
 */
export type Sum = { n: number; offer: number; refused: number; open: number; won: number; lost: number; waiting: number; days: number[] };
export const emptySum = (): Sum => ({ n: 0, offer: 0, refused: 0, open: 0, won: 0, lost: 0, waiting: 0, days: [] });
export function addRow(s: Sum, r: GqsRow): Sum {
  s.n++;
  const o = outcomeOf(r);
  s[o]++;
  const res = resultOf(r);
  if (res) s[res]++;
  else if (o === "offer") s.waiting++;
  const d = daysToOffer(r);
  if (d !== null) s.days.push(d);
  return s;
}
export const sumOf = (rows: GqsRow[]) => rows.reduce(addRow, emptySum());
/** Won of the offers whose outcome is known; null when none is. */
export const wonShare = (s: Sum) => (s.won + s.lost ? s.won / (s.won + s.lost) : null);

/** The tasks created from..to (inclusive Swiss days, YYYY-MM-DD). */
export const inPeriod = (rows: GqsRow[], from: string, to: string) => rows.filter((r) => { const d = dayOf(r.created); return d >= from && d <= to; });
/**
 * The offers sent to Sales from..to, whenever they were asked for. A period's own requests are not like-for-like with
 * the days before: the latest have had less time to get their offer (01.11.2026: October's 65 requests had 28 offers
 * and 33 still open, September's 72 had had a month longer) - so offers, and how long they took, count by the day sent.
 */
export const sentIn = (rows: GqsRow[], from: string, to: string) => rows.filter((r) => { if (!r.offerAt) return false; const d = dayOf(r.offerAt); return d >= from && d <= to; });

/** The tasks summed up by a breakdown, the largest first. */
export function byKey(rows: GqsRow[], key: (r: GqsRow) => string): { label: string; s: Sum }[] {
  const m = new Map<string, Sum>();
  for (const r of rows) {
    const k = key(r);
    let s = m.get(k);
    if (!s) m.set(k, (s = emptySum()));
    addRow(s, r);
  }
  return [...m.entries()].map(([label, s]) => ({ label, s })).sort((a, b) => b.s.n - a.s.n || a.label.localeCompare(b.label));
}
/** The tasks of the period month by month (YYYY-MM of the Swiss day they were created), in order. */
export const byMonth = (rows: GqsRow[]) => byKey(rows, (r) => dayOf(r.created).slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label));

/** The median days a task spent in each stage, over the tasks that were there at all. */
export function stageTimes(rows: GqsRow[]): { stage: string; tasks: number; days: number | null }[] {
  return WORK_STAGES.map((stage) => {
    const xs = rows.map((r) => r.t[stage] ?? 0).filter((ms) => ms > 0).map((ms) => ms / DAY);
    return { stage, tasks: xs.length, days: median(xs) };
  });
}
