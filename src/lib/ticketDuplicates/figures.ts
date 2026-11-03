// DUPLICATES - the page's figures (SARCLA 02.11.2026). Pure: the stored rows of the period in, what each tab shows out -
// the flow from checked to merged, each type's counts and breakdowns, what was never compared and why.

import { outcomeOf, type Row } from "./model";
import { BUILT_IN } from "./types";

export type Count = { key: string; count: number };
export type Figures = {
  checked: number; excluded: number; compared: number;
  /** Merged away by people (or their workflow) into a ticket of the period. HubSpot keeps only the ticket that lives on -
   *  the merged one is gone from its search, so the year's read sees the merge only on the survivor (SARCLA 03.11.2026:
   *  "Merged 3 · 1%" could not be true - 3,922 tickets had been merged in the year). */
  merged: { away: number; into: number };
  twice: { flagged: number; sure: number; possible: number; merged: number; closed: number; open: number; owner: number; autoMerged: number };
  order: { flagged: number; owner: number; merged: number; closed: number; open: number; historyOnly: number; elsewhereOnly: number };
  nothing: number;
  /** a system or a colleague sent the same subject again - not counted as a customer writing twice */
  systemSender: number;
  exclusions: (Count & { builtIn: boolean })[];
  /** per day for a period up to two months, else per month */
  series: { x: string; merged: number; sure: number; possible: number; order: number }[];
  byDay: boolean;
  gaps: Count[];
  twiceOwners: Count[]; orderOwners: Count[]; twiceSenders: Count[];
  live: { written: number; merged: number; owner: number };
  /** rows made by the year build, not seen live */
  rebuilt: number;
};

export const hasVerdict = (r: Row) => !!r.v && !r.error;
export const isSure = (r: Row) => r.v?.type === "twice" && !!r.v.sure;
export const isHistoryOnly = (r: Row) => !!r.v && !r.v.status && !r.v.excludedBy && r.v.history.length > 0 && !r.v.elsewhere.length;
export const isElsewhereOnly = (r: Row) => !!r.v && !r.v.status && !r.v.excludedBy && r.v.elsewhere.length > 0;
/** The time between the two tickets of a "twice". */
export const GAPS = ["under 10 minutes", "10 to 60 minutes", "1 to 24 hours", "1 to 3 days", "over 3 days"] as const;
export const gapKey = (min: number) => (min < 10 ? GAPS[0] : min < 60 ? GAPS[1] : min < 1440 ? GAPS[2] : min < 4320 ? GAPS[3] : GAPS[4]);
/** The tickets merged away into this row's ticket - seen by the year's read, or by the live check's later reads. */
export function mergedAwayOf(r: Row): string[] {
  const out = new Set((r.mergedIn ?? []).map(String));
  const m = r.merge;
  if (m?.state === "merged" && m.into) {
    if (String(m.into) === String(r.ticketId)) for (const x of m.with ?? []) out.add(String(x));
    else out.add(String(r.ticketId));
  }
  if (r.live?.merged) out.add(String(r.ticketId));
  return [...out];
}
/** Whose the earlier ticket is - the person who has the request. */
export const ownerOfFirst = (r: Row) => { const o = r.v?.of[0] ? r.dups?.[r.v.of[0]]?.owner : null; return o ? r.ownerNames[o] ?? `Owner ${o}` : "No owner"; };

const tally = (keys: string[]): Count[] => {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

export function figures(rows: Row[], days: number): Figures {
  const done = rows.filter(hasVerdict);
  const twice = done.filter((r) => r.v!.type === "twice"), order = done.filter((r) => r.v!.type === "order");
  const excluded = done.filter((r) => r.v!.excludedBy);
  const out = (list: Row[], k: "merged" | "closed" | "open") => list.filter((r) => outcomeOf(r) === k).length;
  const byDay = days <= 62;
  const series = new Map<string, Figures["series"][number]>();
  // a ticket merged away counts once, on the ticket it went into
  const away = new Set<string>();
  let into = 0;
  for (const r of done) {
    const x = byDay ? r.enteredAt.slice(0, 10) : r.enteredAt.slice(0, 7);
    const s = series.get(x) ?? { x, merged: 0, sure: 0, possible: 0, order: 0 };
    const gone = mergedAwayOf(r).filter((id) => !away.has(id));
    for (const id of gone) away.add(id);
    if (gone.length) { into++; s.merged += gone.length; }
    if (r.v!.type === "twice") { if (r.v!.sure) s.sure++; else s.possible++; }
    else if (r.v!.type === "order") s.order++;
    series.set(x, s);
  }
  const builtIn = new Set(BUILT_IN.map((b) => b.label));
  return {
    checked: done.length, excluded: excluded.length, compared: done.length - excluded.length,
    merged: { away: away.size, into },
    twice: {
      flagged: twice.length, sure: twice.filter(isSure).length, possible: twice.filter((r) => !r.v!.sure).length,
      merged: out(twice, "merged"), closed: out(twice, "closed"), open: out(twice, "open"),
      owner: twice.filter((r) => r.v!.ownerChange).length, autoMerged: twice.filter((r) => r.live?.merged).length,
    },
    order: {
      flagged: order.length, owner: order.filter((r) => r.v!.ownerChange).length,
      merged: out(order, "merged"), closed: out(order, "closed"), open: out(order, "open"),
      historyOnly: done.filter(isHistoryOnly).length, elsewhereOnly: done.filter(isElsewhereOnly).length,
    },
    nothing: done.filter((r) => !r.v!.status && !r.v!.excludedBy).length,
    systemSender: done.filter((r) => r.v!.systemSender && r.v!.type !== "twice").length,
    exclusions: tally(excluded.map((r) => r.v!.excludedBy!)).map((x) => ({ ...x, builtIn: builtIn.has(x.key) })),
    series: [...series.values()].sort((a, b) => a.x.localeCompare(b.x)), byDay,
    gaps: GAPS.map((key) => ({ key, count: twice.filter((r) => gapKey(r.v!.gapMin ?? 0) === key).length })),
    twiceOwners: tally(twice.map(ownerOfFirst)), orderOwners: tally(order.map(ownerOfFirst)),
    twiceSenders: tally(twice.map((r) => r.sender ?? "no sender")),
    live: { written: done.filter((r) => r.live?.flagged).length, merged: done.filter((r) => r.live?.merged).length, owner: done.filter((r) => r.live?.owner).length },
    rebuilt: done.filter((r) => r.backfill).length,
  };
}
