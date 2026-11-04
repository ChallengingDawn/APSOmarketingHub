// BACK-OFFICE REPORTS > ESO & TSA tickets in more detail (SARCLA 04.11.2026: "ESO & TSA tickets should be also improved
// with a little bit more details, win rate and so forth"). The ESO's and the TSA's incoming tickets - the sales actions
// left out, as the ticket counts on the page - from the ESO Reports' own read, added up per month, and per channel and per
// owner per month, with what ESO Reports counts on them (src/lib/reporting/ticketsRules.ts, the same rules):
//   win rate        won (closed as Ordered or a one-shot order) of the tickets closed with a resolution
//   in a day        the first contact - a reply in the ticket, an e-mail sent, a call, a meeting - within a working day
//   first contact   the working hours to it, Monday to Friday 8-17 Zurich, on average
//   quiet           closed with nothing logged on the ticket at all
//   potential       the Sales potential estimate (EUR) of the tickets, and of the won ones
// Added up on the server: the page gets ~ 2 x 22 months x (1 + channels + owners) small rows, never the tickets.

import { T, outcomeGroup, potentialOf, quietRow, speedOf, type TicketsData } from "./ticketsRules";

/** the columns of a group's figures */
export const IN = { n: 0, won: 1, resolved: 2, closed: 3, lost: 4, quiet: 5, inDay: 6, hoursS: 7, hoursN: 8, pot: 9, potWon: 10 } as const;
export const IN_WIDTH = 11;
export type InRow = number[];
/** one pipeline: per month ("2026-03"), and per channel and per owner (by name) per month */
export type InPipe = { m: Record<string, InRow>; ch: Record<string, Record<string, InRow>>; who: Record<string, Record<string, InRow>> };
export type InDetail = { eso: InPipe; tsa: InPipe };

export const inZero = (): InRow => Array(IN_WIDTH).fill(0) as number[];

/** a ticket row added to a group's figures */
export function inAdd(a: InRow, r: number[]): void {
  const g = outcomeGroup(r[T.outcome]);
  const closed = g !== "open", decided = closed && g !== "nores";
  const hours = r[T.firstH] >= 0 ? r[T.firstH] / 10 : null;
  const { v } = potentialOf(r);
  a[IN.n]++;
  if (closed) a[IN.closed]++;
  if (decided) a[IN.resolved]++;
  if (g === "won") { a[IN.won]++; a[IN.potWon] += v; }
  if (g === "lost") a[IN.lost]++;
  if (quietRow(r)) a[IN.quiet]++;
  if (speedOf(hours) === 0) a[IN.inDay]++;
  if (hours != null) { a[IN.hoursS] += hours; a[IN.hoursN]++; }
  a[IN.pot] += v;
}

/** The incoming tickets of the ESO and of the TSA, added up - each figure rounded to a tenth (the hours) or a whole. */
export function inboundDetail(d: Pick<TicketsData, "tickets" | "year" | "labels" | "people">): InDetail {
  const pipe = (): InPipe => ({ m: {}, ch: {}, who: {} });
  const out: InDetail = { eso: pipe(), tsa: pipe() };
  const at = (rec: Record<string, InRow>, ym: string) => (rec[ym] ??= inZero());
  for (const r of d.tickets) {
    if (r[T.group] !== 0) continue;
    const ym = `${d.year - r[T.year]}-${String(r[T.month] + 1).padStart(2, "0")}`;
    const p = out[(r[T.pipe] ?? 0) === 1 ? "tsa" : "eso"];
    const ch = d.labels.channel[r[T.channel]] ?? "Not set";
    const who = d.people[r[T.person]]?.name ?? "No owner";
    inAdd(at(p.m, ym), r);
    inAdd(at((p.ch[ch] ??= {}), ym), r);
    inAdd(at((p.who[who] ??= {}), ym), r);
  }
  const tidy = (x: InRow) => { x[IN.hoursS] = Math.round(x[IN.hoursS] * 10) / 10; x[IN.pot] = Math.round(x[IN.pot]); x[IN.potWon] = Math.round(x[IN.potWon]); };
  for (const p of [out.eso, out.tsa]) {
    Object.values(p.m).forEach(tidy);
    for (const by of [p.ch, p.who]) for (const months of Object.values(by)) Object.values(months).forEach(tidy);
  }
  return out;
}
