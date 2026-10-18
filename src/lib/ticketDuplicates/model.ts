// DUPLICATES & MERGES - what a checked ticket keeps, and the pure helpers around it (SARCLA 18.10.2026: "features and
// measurement and how we can also improve it"). The engine stores a Row per ticket entering Back Office "New"; later
// runs read the ticket again to see whether people merged it. No HubSpot and no database here, so the tests can run it.

import type { DupResult, Exclusions, Ticket } from "./rules";

/** The private app whose token the DUPS workflow's code uses - its writes carry this source id (read 18.10.2026). */
export const DUPS_APP = "22343290";
/** The workflow writes about 5 minutes after entry; a write this long after still counts as its answer. */
const WRITE_WINDOW_MS = 2 * 60 * 60_000;

export type Outcome = {
  at: string; message: string | null; detected: string | null; ownerBefore: string | null; ownerAfter: string | null; ownerAfterName: string | null; ownerSetBy: string | null;
  /** dup_reason_and_id as the workflow first wrote it after this entry - the merge flow clears or rewrites it later
   *  (null: nothing written then; missing on rows read before 18.10 evening) */
  firstMessage?: string | null;
  /** the owner the DUPS workflow wrote after this entry (null: it moved nobody; missing on older rows) */
  hsOwner?: { ownerId: string; at: string } | null;
};
/** A duplicate as the check saw it - the merge rate and the owner's pipeline are measured from this. */
export type DupInfo = { subject: string; pipeline: string | null; createdate: string | null; closed: boolean; owner: string | null };
export type MergeState = "open" | "closed" | "merged" | "gone";
export type Merge = {
  state: MergeState;
  /** the ticket that lives on: the other one when this ticket was merged away, this one when others were merged in */
  into?: string;
  /** the tickets merged together with it */
  with?: string[];
  /** merged with a ticket the copy, the hub or HubSpot had flagged */
  withFlagged?: boolean;
  at?: string | null; by?: string | null;
  checkedAt: string; checks: number;
  /** no more reads: merged or gone, or 7 days old */
  final: boolean;
};
/** A ticket without an order key at the check that got one later (the association engine fills Order Number). */
export type Later = { at: string; keys: string; orderNumber: string | null; wouldFind?: string[] };
export type OwnerWhy = "erosion" | "flag-only" | "no-open-recent" | "other-pipeline" | "already-owner" | "deactivated";

export type Row = {
  key: string; ticketId: string; enteredAt: string; seenAt: string; subject: string; orderNumber: string | null; keys: string;
  /** the workflow stops before its code: certificates stage / erosion amount */
  stopped?: string;
  legacy: DupResult | null; hub: DupResult | null;
  ownerNames: Record<string, string>;
  ownerAtCheck: string | null;
  actual?: Outcome;
  error?: string;
  /** replayed from the last 7 days: the ticket, its duplicates and its owner as they are today, not as they were */
  backfill?: true;
  pipeline?: string | null;
  dups?: Record<string, DupInfo>;
  /** why the owner stayed, when duplicates were found and nobody was handed over */
  ownerWhy?: { legacy: OwnerWhy | null; hub: OwnerWhy | null };
  merge?: Merge;
  later?: Later;
};

const HOUR = 60 * 60_000, DAY = 24 * HOUR;
export const FINAL_AFTER_MS = 7 * DAY;

/** Read again once the ticket is an hour old, then daily, then once more at 7 days - after that it is final. */
export function mergeDue(r: Row, now: number): boolean {
  if (r.error || r.merge?.final) return false;
  const age = now - Date.parse(r.enteredAt);
  if (!(age >= HOUR)) return false;
  if (!r.merge) return true;
  // not final yet, so the last read was before day 7: read daily, and once more as soon as day 7 is reached
  return now - Date.parse(r.merge.checkedAt) >= DAY || age >= FINAL_AFTER_MS;
}

/** The ids in the workflow's text "Duplicates found: 1, 2 | Reason: ..." - as the merge flow reads them. */
export function hsDuplicates(text: string | null | undefined): string[] {
  const m = /Duplicates\s+found:\s*([^|]+)/i.exec(String(text ?? ""));
  return m ? m[1].split(",").map((x) => x.replace(/\D/g, "")).filter(Boolean) : [];
}
/** What HubSpot answered for this entry: its first write after it, else what the field holds now. */
export const hsText = (r: Row) => (r.actual ? (r.actual.firstMessage ?? r.actual.message) : null);
export const hsFound = (r: Row) => { const t = hsText(r); return !!t && !/^\s*No duplicates found/i.test(t); };
export const flaggedIds = (r: Row) => [...new Set([...(r.legacy?.duplicates ?? []), ...(r.hub?.duplicates ?? []), ...hsDuplicates(hsText(r))])];

type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string }[];
const inWindow = (enteredAt: string, ts: string) => { const d = Date.parse(ts) - Date.parse(enteredAt); return d >= -60_000 && d <= WRITE_WINDOW_MS; };
const first = (h: Hist) => [...h].sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];

/** The workflow's own writes after this entry, from the property histories. */
export function workflowWrites(enteredAt: string, dupHist: Hist | undefined, ownerHist: Hist | undefined): Pick<Outcome, "firstMessage" | "hsOwner"> {
  const msg = first((dupHist ?? []).filter((h) => inWindow(enteredAt, h.timestamp)));
  const own = first((ownerHist ?? []).filter((h) => h.sourceId === DUPS_APP && inWindow(enteredAt, h.timestamp)));
  return { firstMessage: msg ? msg.value : null, hsOwner: own?.value ? { ownerId: String(own.value), at: own.timestamp } : null };
}

/** A read of the ticket: HubSpot answers a merged-away id with the ticket it went into. */
export type Read = { id: string; merged: string[]; closed: boolean; mergedAt?: string | null; mergedBy?: string | null } | null;

export function readMerge(r: Row, rec: Read, now: number): Merge {
  const checks = (r.merge?.checks ?? 0) + 1;
  const checkedAt = new Date(now).toISOString();
  const final = now - Date.parse(r.enteredAt) >= FINAL_AFTER_MS;
  if (!rec) return { state: "gone", checkedAt, checks, final: true };
  const flagged = new Set(flaggedIds(r));
  const id = String(rec.id), mine = String(r.ticketId);
  const merged = rec.merged.map(String).filter((x) => x !== id);
  // a merge from before this entry (the ticket came back to New) is not this entry's
  const before = !!rec.mergedAt && Date.parse(rec.mergedAt) < Date.parse(r.enteredAt) - 60_000;
  if (id !== mine || (merged.length && !before)) {
    const others = id !== mine ? [id, ...merged.filter((x) => x !== mine)] : merged;
    return {
      state: "merged", into: id, with: others, withFlagged: others.some((x) => flagged.has(x)),
      at: rec.mergedAt ?? null, by: rec.mergedBy ?? null, checkedAt, checks, final: true,
    };
  }
  return { state: rec.closed ? "closed" : "open", checkedAt, checks, final };
}

/** Why a ticket with duplicates kept its owner - the owner step of findDuplicates, told in words. */
export function ownerWhy(me: Ticket, dups: Ticket[], ex: Exclusions, archived: Set<string>, res: DupResult): OwnerWhy | null {
  if (!res.duplicates.length || res.ownerChange) return null;
  if (/^\s*EROSION\s*\|/i.test(me.subject)) return "erosion";
  if (ex.flagOnly) return "flag-only";
  const mine = Date.parse(me.createdate ?? "") || Date.now();
  const cutoff = mine - ex.ownerMaxAgeDays * DAY;
  const open = dups.filter((d) => d.owner && d.createdate && !d.closed && Date.parse(d.createdate) >= cutoff && Date.parse(d.createdate) < mine);
  if (!open.length) return "no-open-recent";
  const cands = open.filter((d) => !ex.ownerFromSamePipelineOnly || d.pipeline === me.pipeline).sort((a, b) => String(a.createdate).localeCompare(String(b.createdate)));
  if (!cands.length) return "other-pipeline";
  for (const d of cands) {
    if (d.owner === me.owner) return "already-owner";
    if (!archived.has(d.owner!)) return null; // would have been handed over
  }
  return "deactivated";
}
