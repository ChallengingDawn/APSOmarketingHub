// DUPLICATES & MERGES - the measurement (SARCLA 18.10.2026: "features and measurement and how we can also improve
// it"). Pure: the stored rows in, every figure the page shows out. "Copy" = the workflow's rules as they run in
// HubSpot, "hub" = with the page's exclusions, "HubSpot" = what the workflow really wrote on the ticket.
//   - agreement: the copy against HubSpot - duplicate yes/no, the same duplicate ids, the same owner hand-over;
//     live and replayed rows apart (a replayed row is checked against today's tickets, not those of that day);
//   - merged by people: a flagged ticket that was merged (into another ticket, or others into it) counts once its
//     follow-up is final; precision = merged / flagged over final rows only, so open rows never read as "not merged";
//   - the rest counts what each step left out, and what each exclusion changes.

import { hsDuplicates, hsFound, hsText, type MergeState, type Row } from "./model";
import type { Exclusions } from "./rules";

export const SKIP = {
  noKey: "no order key in subject/order_number",
  never: "ticket category excluded from dup matching",
  erosionNoKey: "erosion ticket without an erosion key - nothing to compare",
} as const;

export type Agreement = {
  /** checked rows with HubSpot's answer read */
  compared: number; sameVerdict: number; bothFound: number; copyOnly: number; hubspotOnly: number;
  /** of bothFound: exactly the same duplicate tickets */
  sameIds: number;
  /** rows where the workflow's own owner write could be read (newer rows) */
  ownerCompared: number; sameOwner: number; copyOwner: number; hubspotOwner: number;
};
export type Rate = { flagged: number; merged: number; mergedWithFlagged: number };
export type Count = { key: string; count: number };
export type Measure = {
  totals: { rows: number; live: number; backfill: number; checked: number; settled: number; stopped: number; errors: number };
  agreement: { live: Agreement; backfill: Agreement; all: Agreement };
  flags: { copy: number; hub: number; hubspot: number; hubDiffers: number };
  steps: {
    entered: number; stoppedCertificates: number; stoppedErosion: number; never: number; erosionNoKey: number; noKey: number;
    searched: number; found: number; ownerChanged: number; unchanged: Count[]; errors: number; hubFound: number; hubOwnerChanged: number;
  };
  merge: {
    tracked: number; final: number; states: Record<MergeState, number>;
    precision: { copy: Rate; hub: Rate; hubspot: Rate };
    /** copy-flagged, final, not merged */
    neverMerged: number; neverMergedByPipeline: Count[];
    /** merged by people though nobody flagged it, by why the check did not compare it */
    unflaggedMerged: number; unflaggedMergedWhy: Count[];
    /** copy flags where every duplicate was already closed */
    allClosed: Rate;
    byAge: (Rate & { key: string })[];
  };
  owner: { copy: number; hub: number; hubspot: number; copyOtherPipeline: number; copyKnownPipeline: number; byPerson: { id: string; name: string; copy: number; hub: number; hubspot: number }[] };
  /** the copy's duplicates, by the pipeline they sit in */
  pipelines: Count[];
  skips: Count[];
  age: { buckets: Count[]; known: number; oldestDays: number | null; medianDays: number | null };
  noKey: { count: number; of: number; later: number; laterWouldFind: number };
  /** per never-match text of the hub: the rows where it took duplicates away */
  texts: { text: string; rows: number }[];
  perDay: { day: string; withDups: number; noDups: number; notCompared: number }[];
};

const DAY = 86400_000;
/** Whole days: "1-7 days" is 1 up to (not including) 8. */
const AGE = [
  { key: "newer than the ticket", lt: 0 }, { key: "under a day", lt: 1 }, { key: "1-7 days", lt: 8 },
  { key: "8-30 days", lt: 31 }, { key: "31-90 days", lt: 91 }, { key: "over 90 days", lt: Infinity },
] as const;

export const copyFound = (r: Row) => !!r.legacy?.duplicates.length;
export const hubFound = (r: Row) => !!r.hub?.duplicates.length;
export const isChecked = (r: Row) => !!r.legacy && !r.stopped && !r.error;
export const hubDiffers = (r: Row) =>
  JSON.stringify(r.hub?.duplicates ?? []) !== JSON.stringify(r.legacy?.duplicates ?? []) || (r.hub?.ownerChange?.ownerId ?? null) !== (r.legacy?.ownerChange?.ownerId ?? null);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const isMerged = (r: Row) => r.merge?.state === "merged";

function agreement(rows: Row[]): Agreement {
  const a: Agreement = { compared: 0, sameVerdict: 0, bothFound: 0, copyOnly: 0, hubspotOnly: 0, sameIds: 0, ownerCompared: 0, sameOwner: 0, copyOwner: 0, hubspotOwner: 0 };
  for (const r of rows) {
    if (!isChecked(r) || !r.actual) continue;
    a.compared++;
    const c = copyFound(r), h = hsFound(r);
    if (c === h) a.sameVerdict++;
    if (c && h) { a.bothFound++; if (sameSet(r.legacy!.duplicates.map(String), hsDuplicates(hsText(r)))) a.sameIds++; }
    else if (c) a.copyOnly++;
    else if (h) a.hubspotOnly++;
    if (r.actual.hsOwner !== undefined) {
      a.ownerCompared++;
      const mine = r.legacy!.ownerChange?.ownerId ?? null, theirs = r.actual.hsOwner?.ownerId ?? null;
      if (String(mine) === String(theirs)) a.sameOwner++;
      if (mine) a.copyOwner++;
      if (theirs) a.hubspotOwner++;
    }
  }
  return a;
}

const rate = (rows: Row[]): Rate => ({ flagged: rows.length, merged: rows.filter(isMerged).length, mergedWithFlagged: rows.filter((r) => isMerged(r) && r.merge!.withFlagged).length });
const tally = (keys: (string | null | undefined)[]): Count[] => {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k ?? "unknown", (m.get(k ?? "unknown") ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};
/** Days between the ticket's entry and its oldest duplicate's creation; null when the duplicates were not recorded. */
export function oldestDupDays(r: Row): number | null {
  const created = (r.legacy?.duplicates ?? []).map((id) => r.dups?.[id]?.createdate).filter((x): x is string => !!x).map((x) => Date.parse(x)).filter(Number.isFinite);
  if (!created.length) return null;
  return (Date.parse(r.enteredAt) - Math.min(...created)) / DAY;
}
export const ageKey = (days: number) => AGE.find((b) => days < b.lt)!.key;
const whySkipped = (r: Row) =>
  r.error ? "error" : r.stopped ? (/certificates/i.test(r.stopped) ? "certificates" : "erosion amount") : r.legacy?.skip === SKIP.noKey ? "no order key" : r.legacy?.skip === SKIP.never ? "never-match subject" : r.legacy?.skip === SKIP.erosionNoKey ? "erosion without key" : "searched";

export function measure(rows: Row[], ex: Exclusions): Measure {
  const checked = rows.filter(isChecked);
  const live = rows.filter((r) => !r.backfill), backfill = rows.filter((r) => r.backfill);
  const flaggedCopy = checked.filter(copyFound);
  const searched = checked.filter((r) => !r.legacy!.skip);

  // owners
  const persons = new Map<string, { id: string; name: string; copy: number; hub: number; hubspot: number }>();
  const person = (r: Row, id: string) => {
    const k = String(id);
    if (!persons.has(k)) persons.set(k, { id: k, name: r.ownerNames[k] ?? (r.actual?.ownerAfter === k ? r.actual.ownerAfterName ?? k : k), copy: 0, hub: 0, hubspot: 0 });
    return persons.get(k)!;
  };
  let copyOtherPipeline = 0, copyKnownPipeline = 0;
  for (const r of checked) {
    const lc = r.legacy!.ownerChange, hc = r.hub?.ownerChange, hs = r.actual?.hsOwner;
    if (lc) {
      person(r, lc.ownerId).copy++;
      const from = r.dups?.[lc.fromTicket];
      if (from && r.pipeline !== undefined) { copyKnownPipeline++; if (from.pipeline !== r.pipeline) copyOtherPipeline++; }
    }
    if (hc) person(r, hc.ownerId).hub++;
    if (hs) person(r, hs.ownerId).hubspot++;
  }

  // ages of the oldest duplicate
  const ages = flaggedCopy.map(oldestDupDays).filter((x): x is number => x !== null);
  const sorted = [...ages].sort((a, b) => a - b);

  // merges
  const states: Record<MergeState, number> = { open: 0, closed: 0, merged: 0, gone: 0 };
  for (const r of rows) if (r.merge) states[r.merge.state]++;
  const fin = (r: Row) => !!r.merge?.final;
  const finalCopy = flaggedCopy.filter(fin);
  const neverMerged = finalCopy.filter((r) => !isMerged(r) && r.merge!.state !== "gone");
  const unflagged = rows.filter((r) => isMerged(r) && !copyFound(r) && !hubFound(r) && !hsFound(r));
  const allClosed = finalCopy.filter((r) => r.legacy!.duplicates.length && r.legacy!.duplicates.every((id) => r.dups?.[id]?.closed === true));

  // what the hub's never-match texts took away
  const texts = ex.neverMatchTexts.filter((t) => t.trim()).map((text) => {
    const t = text.trim().toLowerCase();
    const n = checked.filter((r) => {
      if (!copyFound(r)) return false;
      const gone = r.legacy!.duplicates.filter((id) => !(r.hub?.duplicates ?? []).includes(id));
      if (!gone.length) return false;
      return r.subject.toLowerCase().includes(t) || gone.some((id) => (r.dups?.[id]?.subject ?? "").toLowerCase().includes(t));
    }).length;
    return { text, rows: n };
  });

  // per day
  const days = new Map<string, { day: string; withDups: number; noDups: number; notCompared: number }>();
  for (const r of rows) {
    const d = r.enteredAt.slice(0, 10);
    const x = days.get(d) ?? { day: d, withDups: 0, noDups: 0, notCompared: 0 };
    if (isChecked(r) && copyFound(r)) x.withDups++;
    else if (isChecked(r) && !r.legacy!.skip) x.noDups++;
    else x.notCompared++;
    days.set(d, x);
  }

  const noKey = checked.filter((r) => r.legacy!.skip === SKIP.noKey);
  const pipelines = tally(flaggedCopy.flatMap((r) => r.legacy!.duplicates.map((id) => (r.dups?.[id] ? r.dups[id].pipeline ?? "unknown" : "not recorded"))));
  return {
    totals: { rows: rows.length, live: live.length, backfill: backfill.length, checked: checked.length, settled: checked.filter((r) => r.actual).length, stopped: rows.filter((r) => r.stopped).length, errors: rows.filter((r) => r.error).length },
    agreement: { live: agreement(live), backfill: agreement(backfill), all: agreement(rows) },
    flags: { copy: flaggedCopy.length, hub: checked.filter(hubFound).length, hubspot: checked.filter((r) => r.actual && hsFound(r)).length, hubDiffers: checked.filter(hubDiffers).length },
    steps: {
      entered: rows.length,
      stoppedCertificates: rows.filter((r) => r.stopped && /certificates/i.test(r.stopped)).length,
      stoppedErosion: rows.filter((r) => r.stopped && !/certificates/i.test(r.stopped)).length,
      never: checked.filter((r) => r.legacy!.skip === SKIP.never).length,
      erosionNoKey: checked.filter((r) => r.legacy!.skip === SKIP.erosionNoKey).length,
      noKey: noKey.length,
      searched: searched.length,
      found: flaggedCopy.length,
      ownerChanged: checked.filter((r) => r.legacy!.ownerChange).length,
      unchanged: tally(flaggedCopy.filter((r) => !r.legacy!.ownerChange).map((r) => (r.ownerWhy ? r.ownerWhy.legacy ?? "unknown" : "not recorded"))),
      errors: rows.filter((r) => r.error).length,
      hubFound: checked.filter(hubFound).length,
      hubOwnerChanged: checked.filter((r) => r.hub?.ownerChange).length,
    },
    merge: {
      tracked: rows.filter((r) => r.merge).length, final: rows.filter(fin).length, states,
      precision: { copy: rate(finalCopy), hub: rate(checked.filter((r) => hubFound(r) && fin(r))), hubspot: rate(checked.filter((r) => r.actual && hsFound(r) && fin(r))) },
      neverMerged: neverMerged.length,
      neverMergedByPipeline: tally(neverMerged.map((r) => r.dups?.[r.legacy!.duplicates[0]]?.pipeline ?? "not recorded")),
      unflaggedMerged: unflagged.length,
      unflaggedMergedWhy: tally(unflagged.map(whySkipped)),
      allClosed: rate(allClosed),
      byAge: AGE.map((b) => ({ key: b.key, ...rate(finalCopy.filter((r) => { const d = oldestDupDays(r); return d !== null && ageKey(d) === b.key; })) })),
    },
    owner: {
      copy: checked.filter((r) => r.legacy!.ownerChange).length, hub: checked.filter((r) => r.hub?.ownerChange).length,
      hubspot: checked.filter((r) => r.actual?.hsOwner).length, copyOtherPipeline, copyKnownPipeline,
      byPerson: [...persons.values()].sort((a, b) => b.copy + b.hubspot - (a.copy + a.hubspot) || a.name.localeCompare(b.name)),
    },
    pipelines,
    skips: tally(rows.map(whySkipped).filter((k) => k !== "searched")),
    age: { buckets: AGE.map((b) => ({ key: b.key, count: ages.filter((d) => ageKey(d) === b.key).length })), known: ages.length, oldestDays: sorted.length ? sorted[sorted.length - 1] : null, medianDays: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null },
    noKey: { count: noKey.length, of: checked.length, later: noKey.filter((r) => r.later).length, laterWouldFind: noKey.filter((r) => r.later?.wouldFind?.length).length },
    texts,
    perDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}
