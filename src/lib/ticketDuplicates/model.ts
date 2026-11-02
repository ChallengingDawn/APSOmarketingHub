// DUPLICATES & MERGES - what a checked ticket keeps, and the pure helpers around it. The engine stores a Row per ticket
// entering Back Office "New" (and the year build one per entry of the last 365 days); later reads see whether people
// merged it. No HubSpot and no database here, so the tests can run it.

import type { Verdict } from "./types";

/** An other ticket as the check saw it - its subject, pipeline, age, state and owner, for the lists. */
export type DupInfo = { subject: string; pipeline: string | null; createdate: string | null; closed: boolean; owner: string | null };
export type MergeState = "open" | "closed" | "merged" | "gone";
export type Merge = {
  state: MergeState;
  /** the ticket that lives on: the other one when this ticket was merged away, this one when others were merged in */
  into?: string;
  /** the tickets merged together with it */
  with?: string[];
  /** merged with a ticket the hub had named */
  withFlagged?: boolean;
  at?: string | null; by?: string | null;
  checkedAt: string; checks: number;
  /** no more reads: merged or gone, or 7 days old */
  final: boolean;
};

export type Row = {
  key: string; ticketId: string; enteredAt: string; seenAt: string; subject: string; orderNumber: string | null; keys: string;
  pipeline?: string | null;
  /** the sender's e-mail domain (the ticket's first contact) */
  sender?: string | null;
  ownerNames: Record<string, string>;
  ownerAtCheck: string | null;
  /** the hub's verdict (types.ts) */
  v?: Verdict;
  /** the other tickets named - the hub's, the closed ones on the order, the ones in another pipeline */
  dups?: Record<string, DupInfo>;
  merge?: Merge;
  /** tickets merged into this one in HubSpot, seen by the year build */
  mergedIn?: string[];
  /** live: what the hub wrote on the ticket (or why not) */
  live?: { at: string; flagged: boolean; owner: boolean; merged?: string; note?: string; error?: string };
  error?: string;
  /** made by the year build from the tickets as they are today, not checked at the time */
  backfill?: true;
};

const HOUR = 60 * 60_000, DAY = 24 * HOUR;
export const FINAL_AFTER_MS = 7 * DAY;

/** Read again once the ticket is an hour old, then daily, then once more at 7 days - after that it is final. */
export function mergeDue(r: Row, now: number): boolean {
  if (r.error || r.merge?.final || r.backfill) return false;
  const age = now - Date.parse(r.enteredAt);
  if (!(age >= HOUR)) return false;
  if (!r.merge) return true;
  // not final yet, so the last read was before day 7: read daily, and once more as soon as day 7 is reached
  return now - Date.parse(r.merge.checkedAt) >= DAY || age >= FINAL_AFTER_MS;
}

/** A read of the ticket: HubSpot answers a merged-away id with the ticket it went into. */
export type Read = { id: string; merged: string[]; closed: boolean; mergedAt?: string | null; mergedBy?: string | null } | null;

export function readMerge(r: Row, rec: Read, now: number): Merge {
  const checks = (r.merge?.checks ?? 0) + 1;
  const checkedAt = new Date(now).toISOString();
  const final = now - Date.parse(r.enteredAt) >= FINAL_AFTER_MS;
  if (!rec) return { state: "gone", checkedAt, checks, final: true };
  const named = new Set(r.v?.of ?? []);
  const id = String(rec.id), mine = String(r.ticketId);
  const merged = rec.merged.map(String).filter((x) => x !== id);
  // a merge from before this entry (the ticket came back to New) is not this entry's
  const before = !!rec.mergedAt && Date.parse(rec.mergedAt) < Date.parse(r.enteredAt) - 60_000;
  if (id !== mine || (merged.length && !before)) {
    const others = id !== mine ? [id, ...merged.filter((x) => x !== mine)] : merged;
    return {
      state: "merged", into: id, with: others, withFlagged: others.some((x) => named.has(x)),
      at: rec.mergedAt ?? null, by: rec.mergedBy ?? null, checkedAt, checks, final: true,
    };
  }
  return { state: rec.closed ? "closed" : "open", checkedAt, checks, final };
}

/** What became of a row: merged (by a person, the hub, or seen merged by the year build), closed, still open. */
export function outcomeOf(r: Row): "merged" | "closed" | "open" {
  if (r.merge?.state === "merged" || r.live?.merged || r.mergedIn?.length) return "merged";
  if (r.merge?.state === "closed" || r.merge?.state === "gone") return "closed";
  return "open";
}
