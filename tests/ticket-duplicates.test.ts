import assert from "node:assert/strict";
import { test } from "node:test";
import { extractKeys, keysMatch } from "../src/lib/ticketDuplicates/rules";
import { mergeDue, outcomeOf, readMerge, type Row } from "../src/lib/ticketDuplicates/model";
import { spanOk } from "../src/lib/ticketDuplicates/period";

const H = 3600_000, D = 24 * H;
const T0 = Date.parse("2026-10-10T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const R = (id: string, extra: Partial<Row> = {}): Row => ({
  key: `${id}:${iso(T0)}`, ticketId: id, enteredAt: iso(T0), seenAt: iso(T0 + 2 * 60_000), subject: "BO | A26.666379", orderNumber: null, keys: "666379",
  ownerNames: {}, ownerAtCheck: "1", ...extra,
});

test("order keys: core + position, .000 is the whole order, any separator", () => {
  assert.deepEqual(extractKeys("A26.632870.003 and A26-640000 / A25 504807 000"), [
    { core: "632870", pos: "003" }, { core: "640000", pos: null }, { core: "504807", pos: null },
  ]);
  assert.ok(keysMatch(extractKeys("A26.632870"), extractKeys("A26.632870.003")));
  assert.ok(!keysMatch(extractKeys("A26.632870.001"), extractKeys("A26.632870.003")));
});

test("follow-up schedule: from one hour, then daily, once more at 7 days, then never - the year's rows never", () => {
  const r = R("1");
  assert.equal(mergeDue(r, T0 + 30 * 60_000), false);
  assert.equal(mergeDue(r, T0 + H), true);
  const read = (at: number, final = false): Row => ({ ...r, merge: { state: "open", checkedAt: iso(at), checks: 1, final } });
  assert.equal(mergeDue(read(T0 + H), T0 + 5 * H), false);
  assert.equal(mergeDue(read(T0 + H), T0 + 25 * H), true);
  assert.equal(mergeDue(read(T0 + 6.9 * D), T0 + 7 * D), true);
  assert.equal(mergeDue(read(T0 + 7 * D, true), T0 + 9 * D), false);
  assert.equal(mergeDue({ ...r, error: "boom" }, T0 + 2 * H), false);
  assert.equal(mergeDue({ ...r, backfill: true }, T0 + 2 * H), false);
});

test("reading a merge: merged away, others merged in, an old merge, gone, open and closed - and what became of a row", () => {
  const v = { type: "twice" as const, status: "possible" as const, of: ["8"], why: "", ownerChange: null, history: [], elsewhere: [] };
  const r = R("10", { v });
  const away = readMerge(r, { id: "8", merged: ["10"], closed: false, mergedAt: iso(T0 + 3 * H), mergedBy: "Maida" }, T0 + 4 * H);
  assert.deepEqual([away.state, away.into, away.withFlagged, away.final, away.by], ["merged", "8", true, true, "Maida"]);
  const intoMe = readMerge(r, { id: "10", merged: ["7"], closed: true, mergedAt: iso(T0 + 3 * H) }, T0 + 4 * H);
  assert.deepEqual([intoMe.state, intoMe.into, intoMe.with, intoMe.withFlagged], ["merged", "10", ["7"], false]);
  assert.equal(readMerge(r, { id: "10", merged: ["7"], closed: false, mergedAt: iso(T0 - D) }, T0 + 4 * H).state, "open");
  assert.deepEqual([readMerge(r, null, T0 + H).state, readMerge(r, null, T0 + H).final], ["gone", true]);
  const closed = readMerge(r, { id: "10", merged: [], closed: true }, T0 + 2 * D);
  assert.deepEqual([closed.state, closed.final, closed.checks], ["closed", false, 1]);
  assert.equal(outcomeOf({ ...r, merge: away }), "merged");
  assert.equal(outcomeOf({ ...r, merge: closed }), "closed");
  assert.equal(outcomeOf({ ...r, live: { at: iso(T0), flagged: true, owner: false, merged: "8" } }), "merged");
  assert.equal(outcomeOf({ ...r, mergedIn: ["7"] }), "merged");
  assert.equal(outcomeOf(r), "open");
});

test("the period: at most 365 days, never after today, the last 28 days when none is given", () => {
  assert.deepEqual(spanOk("2026-10-01", "2026-10-31", "2026-11-03"), { from: "2026-10-01", to: "2026-10-31", days: 31 });
  assert.deepEqual(spanOk("2024-01-01", "2026-12-31", "2026-11-03"), { from: "2025-11-04", to: "2026-11-03", days: 365 });
  assert.deepEqual(spanOk(null, null, "2026-11-03"), { from: "2026-10-07", to: "2026-11-03", days: 28 });
  assert.deepEqual(spanOk("2026-10-31", "2026-10-01", "2026-11-03"), { from: "2026-10-01", to: "2026-10-31", days: 31 });
});
