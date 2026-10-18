import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_EXCLUSIONS, findDuplicates, type DupResult, type Ticket } from "../src/lib/ticketDuplicates/rules";
import { DUPS_APP, hsDuplicates, hsFound, mergeDue, ownerWhy, readMerge, workflowWrites, type Row } from "../src/lib/ticketDuplicates/model";
import { SKIP, ageKey, measure, oldestDupDays } from "../src/lib/ticketDuplicates/measure";

const H = 3600_000, D = 24 * H;
const T0 = Date.parse("2026-10-10T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const BO = "1726786777", ESO = "1726599376";

const dup = (ids: string[], owner: { ownerId: string; fromTicket: string } | null = null, skip?: string): DupResult => ({
  keys: "666379", message: ids.length ? `Duplicates found: ${ids.join(", ")} | Reason: Same order number 666379` : "No duplicates found", duplicates: ids, reason: ids.length ? "Same order number 666379" : null, ownerChange: owner, ...(skip ? { skip } : {}),
});
const R = (id: string, extra: Partial<Row> = {}): Row => ({
  key: `${id}:${iso(T0)}`, ticketId: id, enteredAt: iso(T0), seenAt: iso(T0 + 2 * 60_000), subject: "BO | A26.666379", orderNumber: null, keys: "666379",
  legacy: dup([]), hub: dup([]), ownerNames: {}, ownerAtCheck: "1", pipeline: BO, ...extra,
});
const T = (id: string, extra: Partial<Ticket> = {}): Ticket => ({ id, subject: "A26.666379", orderNumber: null, owner: null, createdate: "2026-10-18T08:00:00Z", closed: false, erosionKey: null, pipeline: BO, ...extra });

test("follow-up schedule: from one hour, then daily, once more at 7 days, then never", () => {
  const r = R("1");
  assert.equal(mergeDue(r, T0 + 30 * 60_000), false);
  assert.equal(mergeDue(r, T0 + H), true);
  const read = (at: number, final = false): Row => ({ ...r, merge: { state: "open", checkedAt: iso(at), checks: 1, final } });
  assert.equal(mergeDue(read(T0 + H), T0 + 5 * H), false);
  assert.equal(mergeDue(read(T0 + H), T0 + 25 * H), true);
  assert.equal(mergeDue(read(T0 + 6.9 * D), T0 + 7 * D), true); // the final read, even within the day
  assert.equal(mergeDue(read(T0 + 7 * D, true), T0 + 9 * D), false);
  assert.equal(mergeDue({ ...r, error: "boom" }, T0 + 2 * H), false);
});

test("reading a merge: merged away, others merged in, an old merge, gone, open and closed", () => {
  const r = R("10", { legacy: dup(["8"]) });
  const away = readMerge(r, { id: "8", merged: ["10"], closed: false, mergedAt: iso(T0 + 3 * H), mergedBy: "Maida" }, T0 + 4 * H);
  assert.deepEqual([away.state, away.into, away.withFlagged, away.final, away.by], ["merged", "8", true, true, "Maida"]);
  const intoMe = readMerge(r, { id: "10", merged: ["7"], closed: true, mergedAt: iso(T0 + 3 * H) }, T0 + 4 * H);
  assert.deepEqual([intoMe.state, intoMe.into, intoMe.with, intoMe.withFlagged], ["merged", "10", ["7"], false]);
  // merged before this entry (the ticket came back to New): not this entry's merge
  assert.equal(readMerge(r, { id: "10", merged: ["7"], closed: false, mergedAt: iso(T0 - D) }, T0 + 4 * H).state, "open");
  assert.deepEqual([readMerge(r, null, T0 + H).state, readMerge(r, null, T0 + H).final], ["gone", true]);
  const closed = readMerge(r, { id: "10", merged: [], closed: true }, T0 + 2 * D);
  assert.deepEqual([closed.state, closed.final, closed.checks], ["closed", false, 1]);
  assert.equal(readMerge({ ...r, merge: closed }, { id: "10", merged: [], closed: true }, T0 + 7 * D).final, true);
});

test("HubSpot's answer: the workflow's first write after entry wins over what the merge flow left", () => {
  assert.deepEqual(hsDuplicates("Duplicates found: 437330298102, 437350308033 | Reason: Same order number 654"), ["437330298102", "437350308033"]);
  assert.deepEqual(hsDuplicates("No duplicates found"), []);
  const w = workflowWrites(iso(T0), [
    { value: "✅ Merged tickets into #8", timestamp: iso(T0 + 2 * D) },
    { value: "Duplicates found: 8 | Reason: x", timestamp: iso(T0 + 5 * 60_000), sourceType: "INTEGRATION", sourceId: DUPS_APP },
    { value: "No duplicates found", timestamp: iso(T0 - 3 * D) },
  ], [
    { value: "555", timestamp: iso(T0 + 60_000), sourceType: "INTEGRATION", sourceId: "30109717" },
    { value: "777", timestamp: iso(T0 + 5 * 60_000), sourceType: "INTEGRATION", sourceId: DUPS_APP },
  ]);
  assert.equal(w.firstMessage, "Duplicates found: 8 | Reason: x");
  assert.deepEqual(w.hsOwner, { ownerId: "777", at: iso(T0 + 5 * 60_000) });
  assert.deepEqual(workflowWrites(iso(T0), [], [{ value: "555", timestamp: iso(T0 + 60_000), sourceId: "30109717" }]), { firstMessage: null, hsOwner: null });
  const r = R("1", { actual: { at: iso(T0), message: null, detected: null, ownerBefore: null, ownerAfter: null, ownerAfterName: null, ownerSetBy: null, firstMessage: "Duplicates found: 8 | Reason: x" } });
  assert.equal(hsFound(r), true);
  assert.equal(hsFound({ ...r, actual: { ...r.actual!, firstMessage: null, message: "No duplicates found" } }), false);
});

test("why the owner stayed, told the way findDuplicates decides it", () => {
  const me = T("10", { owner: "76134337", createdate: "2026-10-18T09:00:00Z" });
  const why = (dups: Ticket[], ex = DEFAULT_EXCLUSIONS, archived = new Set<string>()) => ownerWhy(me, dups, ex, archived, findDuplicates(me, dups, ex, archived));
  assert.equal(why([T("8", { owner: "76134337", createdate: "2026-10-15T00:00:00Z" })]), "already-owner");
  assert.equal(why([T("8", { owner: "1", createdate: "2026-10-15T00:00:00Z", closed: true })]), "no-open-recent");
  assert.equal(why([T("8", { owner: "1", createdate: "2026-08-01T00:00:00Z" })]), "no-open-recent");
  assert.equal(why([T("8", { owner: "2", createdate: "2026-10-15T00:00:00Z" })], DEFAULT_EXCLUSIONS, new Set(["2"])), "deactivated");
  assert.equal(why([T("8", { owner: "2", createdate: "2026-10-15T00:00:00Z", pipeline: ESO })], { ...DEFAULT_EXCLUSIONS, ownerFromSamePipelineOnly: true }), "other-pipeline");
  assert.equal(why([T("8", { owner: "2", createdate: "2026-10-15T00:00:00Z" })], { ...DEFAULT_EXCLUSIONS, flagOnly: true }), "flag-only");
  assert.equal(why([T("8", { owner: "2", createdate: "2026-10-15T00:00:00Z" })]), null); // handed over - nothing to explain
});

test("age of the oldest duplicate, in whole-day buckets", () => {
  const r = R("1", { legacy: dup(["8", "9"]), dups: { "8": { subject: "", pipeline: BO, createdate: iso(T0 - 10 * D), closed: false, owner: null }, "9": { subject: "", pipeline: BO, createdate: iso(T0 - 2 * D), closed: false, owner: null } } });
  assert.equal(oldestDupDays(r), 10);
  assert.equal(oldestDupDays(R("2", { legacy: dup(["8"]) })), null);
  assert.deepEqual([-0.1, 0.5, 1, 7.9, 8, 30.5, 31, 400].map(ageKey), ["newer than the ticket", "under a day", "1-7 days", "1-7 days", "8-30 days", "8-30 days", "31-90 days", "over 90 days"]);
});

test("measure: agreement live vs replayed, precision on final rows only, hand-overs from another pipeline", () => {
  const out = (msg: string | null, hsOwner: { ownerId: string; at: string } | null | undefined = null) => ({ at: iso(T0), message: msg, detected: null, ownerBefore: "1", ownerAfter: "1", ownerAfterName: null, ownerSetBy: null, firstMessage: msg, hsOwner });
  const dupInfo = (pipeline: string, closed = false, days = 3) => ({ subject: "A26.666379", pipeline, createdate: iso(T0 - days * D), closed, owner: "2" });
  const rows: Row[] = [
    // live, both found the same, owner handed over from an ESO ticket by both; merged by people with the flagged ticket
    R("1", { legacy: dup(["8"], { ownerId: "2", fromTicket: "8" }), hub: dup(["8"]), dups: { "8": dupInfo(ESO) }, ownerNames: { "2": "Sara" },
      actual: out("Duplicates found: 8 | Reason: x", { ownerId: "2", at: iso(T0) }), merge: { state: "merged", into: "8", with: ["8"], withFlagged: true, checkedAt: iso(T0 + D), checks: 2, final: true } }),
    // live, copy found, HubSpot did not; flagged but left alone for 7 days, the duplicate was closed
    R("2", { legacy: dup(["9"]), hub: dup(["9"]), dups: { "9": dupInfo(BO, true, 40) }, actual: out("No duplicates found"), merge: { state: "closed", checkedAt: iso(T0 + 7 * D), checks: 4, final: true } }),
    // live, flagged, still being followed - not in the precision yet
    R("3", { legacy: dup(["7"]), hub: dup([]), dups: { "7": { ...dupInfo(BO), subject: "ERP Order Export Stale Warning A26.666379" } }, actual: out("Duplicates found: 7, 6 | Reason: x"), merge: { state: "open", checkedAt: iso(T0 + D), checks: 1, final: false } }),
    // replayed, no order key; got one later and the search finds a duplicate; then merged although nobody flagged it
    R("4", { backfill: true, keys: "(none)", legacy: dup([], null, SKIP.noKey), hub: dup([], null, SKIP.noKey), actual: out("No duplicates found"),
      later: { at: iso(T0 + D), keys: "666379", orderNumber: "A26.666379", wouldFind: ["8"] }, merge: { state: "merged", into: "8", with: ["8"], withFlagged: false, checkedAt: iso(T0 + D), checks: 1, final: true } }),
    // replayed, HubSpot found, the copy did not (today's tickets differ)
    R("5", { backfill: true, actual: out("Duplicates found: 3 | Reason: x") }),
    // stopped before the check, and one that could not be read
    R("6", { stopped: "has been in Certificates - the workflow stops", legacy: null, hub: null }),
    R("7", { legacy: null, hub: null, error: "HubSpot: 500" }),
  ];
  const m = measure(rows, { ...DEFAULT_EXCLUSIONS, ownerFromSamePipelineOnly: true, neverMatchTexts: ["ERP Order Export Stale Warning"] });

  assert.deepEqual([m.totals.rows, m.totals.live, m.totals.backfill, m.totals.checked, m.totals.stopped, m.totals.errors], [7, 5, 2, 5, 1, 1]);
  assert.deepEqual([m.agreement.live.compared, m.agreement.live.sameVerdict, m.agreement.live.bothFound, m.agreement.live.sameIds, m.agreement.live.copyOnly], [3, 2, 2, 1, 1]);
  assert.deepEqual([m.agreement.live.ownerCompared, m.agreement.live.sameOwner, m.agreement.live.copyOwner, m.agreement.live.hubspotOwner], [3, 3, 1, 1]);
  assert.deepEqual([m.agreement.backfill.compared, m.agreement.backfill.sameVerdict, m.agreement.backfill.hubspotOnly], [2, 1, 1]);
  assert.deepEqual([m.flags.copy, m.flags.hub, m.flags.hubspot], [3, 2, 3]);

  // precision: rows 1 and 2 are final copy flags; row 3 is still open and does not count
  assert.deepEqual(m.merge.precision.copy, { flagged: 2, merged: 1, mergedWithFlagged: 1 });
  assert.equal(m.merge.neverMerged, 1);
  assert.deepEqual(m.merge.neverMergedByPipeline, [{ key: BO, count: 1 }]);
  assert.deepEqual(m.merge.allClosed, { flagged: 1, merged: 0, mergedWithFlagged: 0 });
  assert.equal(m.merge.unflaggedMerged, 1);
  assert.deepEqual(m.merge.unflaggedMergedWhy, [{ key: "no order key", count: 1 }]);
  assert.deepEqual(m.merge.states, { open: 1, closed: 1, merged: 2, gone: 0 });
  assert.deepEqual(m.merge.byAge.filter((x) => x.flagged).map((x) => [x.key, x.flagged, x.merged]), [["1-7 days", 1, 1], ["31-90 days", 1, 0]]);

  assert.deepEqual([m.owner.copy, m.owner.hub, m.owner.hubspot, m.owner.copyOtherPipeline, m.owner.copyKnownPipeline], [1, 0, 1, 1, 1]);
  assert.deepEqual(m.owner.byPerson, [{ id: "2", name: "Sara", copy: 1, hub: 0, hubspot: 1 }]);
  assert.deepEqual(m.pipelines, [{ key: BO, count: 2 }, { key: ESO, count: 1 }]);
  assert.deepEqual(m.skips, [{ key: "certificates", count: 1 }, { key: "error", count: 1 }, { key: "no order key", count: 1 }]);
  assert.deepEqual(m.noKey, { count: 1, of: 5, later: 1, laterWouldFind: 1 });
  assert.deepEqual(m.texts, [{ text: "ERP Order Export Stale Warning", rows: 1 }]);
  assert.deepEqual([m.steps.entered, m.steps.stoppedCertificates, m.steps.noKey, m.steps.searched, m.steps.found, m.steps.ownerChanged], [7, 1, 1, 4, 3, 1]);
  assert.deepEqual(m.steps.unchanged, [{ key: "not recorded", count: 2 }]);
  assert.deepEqual(m.perDay, [{ day: "2026-10-10", withDups: 3, noDups: 1, notCompared: 3 }]);
});
