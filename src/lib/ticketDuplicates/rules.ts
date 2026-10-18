// DUPLICATES & MERGES - the rules, pure (SARCLA 18.10.2026: "DUPS and merge should be a separate app, and we should
// also improve that, exclude something"). A faithful copy of the live HubSpot workflow "SARCLA | BACK OFFICE FILTERING
// | DUPS HANDLING WITH CODE" (2864393419, code step read 18.10.2026), with the exclusions as settings - their defaults
// ARE the workflow's behaviour, so "legacy" and "hub" only part where SARCLA changes a setting:
//   - order key = the 6-digit core + an optional 3-digit position (A26.632870.003); ".000" is the whole order, matching
//     any line; two tickets are duplicates when a key matches;
//   - never matched: CERTIFICATE(S) | ..., "certificate due / create the certificate / days for delivery",
//     C2S PROBLEM ..., anything starting with a warning sign; EROSION | tickets only match each other, on erosion_key,
//     and never change hands;
//   - at most 3 duplicates; the owner moves to the owner of the OLDEST OPEN duplicate created up to 30 days before
//     this ticket, unless that is already the owner; a deactivated owner is skipped. Any pipeline (the workflow's
//     search has no pipeline filter).
// Before its code the workflow stops for tickets that have been in Back Office "Certificates" (3640065212) or carry
// erosion_amount_2025.

export type Key = { core: string; pos: string | null };
const ORDER_KEY = /A2\d[\s._-]*(\d{6})(?:[\s._-]*(\d{3}))?(?!\d)/gi;

export function extractKeys(text: string | null | undefined): Key[] {
  const out = new Map<string, Key>();
  for (const m of String(text ?? "").matchAll(ORDER_KEY)) {
    const pos = m[2] === undefined || m[2] === "000" ? null : m[2];
    out.set(`${m[1]}.${pos ?? ""}`, { core: m[1], pos });
  }
  return [...out.values()];
}
/** Same core and the same position, or one side without a position. */
export const keysMatch = (a: Key[], b: Key[]) => a.some((x) => b.some((y) => x.core === y.core && (x.pos === null || y.pos === null || x.pos === y.pos)));
/** The keys of two texts together, each once (the workflow's set union). */
const union = (a: Key[], b: Key[]) => [...new Map([...a, ...b].map((k) => [`${k.core}.${k.pos ?? ""}`, k])).values()];
export const fmtKeys = (k: Key[]) => k.map((x) => x.core + (x.pos ? `.${x.pos}` : "")).sort().join(", ") || "(none)";

const NEVER = [/^\s*CERTIFICATES?\s*\|/i, /certificate due|create the certificate|days for delivery/i, /^\s*C2S PROBLEM/i, /^\s*⚠/];
export const isErosion = (s: string | null | undefined) => /^\s*EROSION\s*\|/i.test(String(s ?? "").trim());

export type Exclusions = {
  /** pipelines whose tickets can be duplicates; empty = all (the workflow) */
  pipelines: string[];
  /** the owner is only taken from a duplicate in the ticket's own pipeline (the workflow: any pipeline) */
  ownerFromSamePipelineOnly: boolean;
  /** extra subject texts that are never a duplicate (case-insensitive, contained) */
  neverMatchTexts: string[];
  /** a duplicate older than this gives no owner (the workflow: 30) */
  ownerMaxAgeDays: number;
  /** the owner never changes - duplicates are only flagged */
  flagOnly: boolean;
};
export const DEFAULT_EXCLUSIONS: Exclusions = { pipelines: [], ownerFromSamePipelineOnly: false, neverMatchTexts: [], ownerMaxAgeDays: 30, flagOnly: false };

export type Ticket = { id: string; subject: string; orderNumber: string | null; owner: string | null; createdate: string | null; closed: boolean; erosionKey: string | null; pipeline: string | null };
export type DupResult = {
  keys: string;
  /** the workflow's own text, as it would write dup_reason_and_id */
  message: string;
  duplicates: string[];
  reason: string | null;
  ownerChange: { ownerId: string; fromTicket: string } | null;
  skip?: string;
};

const neverMatch = (s: string, ex: Exclusions) => NEVER.some((r) => r.test(s)) || ex.neverMatchTexts.some((t) => t.trim() && s.toLowerCase().includes(t.trim().toLowerCase()));

/** Duplicates of `me` among `candidates` - in the order the workflow meets them (its targeted search, then its sweep). */
export function findDuplicates(me: Ticket, candidates: Ticket[], ex: Exclusions, archived: Set<string>): DupResult {
  const myKeys = union(extractKeys(me.subject), extractKeys(me.orderNumber));
  const keys = fmtKeys(myKeys);
  const none = (skip: string): DupResult => ({ keys, message: "No duplicates found", duplicates: [], reason: null, ownerChange: null, skip });
  if (neverMatch(me.subject, ex)) return none("ticket category excluded from dup matching");
  const erosion = isErosion(me.subject);
  if (erosion && !me.erosionKey) return none("erosion ticket without an erosion key - nothing to compare");
  if (!myKeys.length && !erosion) return none("no order key in subject/order_number");

  const dups: Ticket[] = [];
  let reason: string | null = null;
  const seen = new Set<string>();
  for (const c of candidates) {
    if (dups.length >= 3) break;
    if (c.id === me.id || seen.has(c.id)) continue;
    seen.add(c.id);
    if (neverMatch(c.subject, ex)) continue;
    if (isErosion(c.subject) !== erosion) continue;
    if (ex.pipelines.length && !ex.pipelines.includes(c.pipeline ?? "")) continue;
    if (erosion) {
      if (me.erosionKey && c.erosionKey && c.erosionKey.trim() === me.erosionKey) { dups.push(c); reason = `Same erosion key ${me.erosionKey} (same customer, article and year)`; }
      continue;
    }
    const other = union(extractKeys(c.subject), extractKeys(c.orderNumber));
    if (keysMatch(myKeys, other)) {
      dups.push(c);
      const common = myKeys.filter((k) => other.some((o) => o.core === k.core && o.pos === k.pos));
      reason = `Same order number ${common.length ? fmtKeys(common) : fmtKeys(other)}`;
    }
  }
  const ids = dups.map((d) => d.id);
  const base = ids.length ? `Duplicates found: ${ids.join(", ")} | Reason: ${reason ?? "Same order number (detected)"}` : "No duplicates found";
  if (erosion) {
    return { keys, duplicates: ids, reason, ownerChange: null, message: ids.length ? `${base}\nOwner not changed: this is an erosion win-back ticket and stays with the customer's sales rep.` : base };
  }
  // the owner: the oldest open duplicate created before this ticket, within the age limit, that has an owner
  let ownerChange: DupResult["ownerChange"] = null;
  if (!ex.flagOnly) {
    const mine = Date.parse(me.createdate ?? "") || Date.now();
    const cutoff = mine - ex.ownerMaxAgeDays * 86400_000;
    const cands = dups
      .filter((d) => d.owner && d.createdate && !d.closed && Date.parse(d.createdate) >= cutoff && Date.parse(d.createdate) < mine)
      .filter((d) => !ex.ownerFromSamePipelineOnly || d.pipeline === me.pipeline)
      .sort((a, b) => String(a.createdate).localeCompare(String(b.createdate)));
    for (const d of cands) {
      if (d.owner === me.owner) break; // already with the right person
      if (archived.has(d.owner!)) continue; // never to a deactivated user
      ownerChange = { ownerId: d.owner!, fromTicket: d.id };
      break;
    }
  }
  return { keys, duplicates: ids, reason, ownerChange, message: base };
}
