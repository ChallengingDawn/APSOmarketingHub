import assert from "node:assert/strict";
import { test } from "node:test";
import { STOP_REASONS, reasonsRanked, stopShare, stoppedMonth, sumShare, sumStopped } from "../src/lib/reporting/boStopped";
import { STOPPED_FILE } from "../src/lib/reporting/boStoppedFile";

test("the file's months: its overview's totals, and the reasons as its overview counts them", () => {
  const oct = stoppedMonth(STOPPED_FILE, null, "2026-10")!;
  assert.equal(oct.transferred, 4261);
  assert.equal(oct.stopped, 788);
  assert.equal(oct.from, "file");
  // the overview's October column, reason by reason (the order margin only where it is the one reason)
  assert.deepEqual(STOP_REASONS.map((r) => oct.reasons[r.id] ?? 0), [117, 156, 124, 226, 12, 42, 61, 21, 3, 38, 62, 7]);
  assert.equal(oct.listed, 788);
  assert.equal(oct.mandant!["100"] + oct.mandant!["110"], 788);
  assert.ok(oct.note);
  assert.equal(stopShare(stoppedMonth(STOPPED_FILE, null, "2026-01")), 712 / 4182);
  // 2025: month totals and reasons only
  const jan25 = stoppedMonth(STOPPED_FILE, null, "2025-01")!;
  assert.equal(jan25.stopped, 679);
  assert.equal(jan25.reasons.denomination, 184);
  assert.equal(jan25.perOrder, undefined);
});

test("a month the file does not have: what was typed in, else nothing", () => {
  const typed = { "stopped.transferred": { "2026-11": 4000 }, "stopped.stopped": { "2026-11": 600 }, "stopped.credit": { "2026-11": 150 } };
  const nov = stoppedMonth(STOPPED_FILE, typed, "2026-11")!;
  assert.equal(nov.from, "typed");
  assert.equal(stopShare(nov), 0.15);
  assert.equal(nov.reasons.credit, 150);
  assert.equal(stoppedMonth(STOPPED_FILE, typed, "2026-12"), null);
  // the file wins over a typed figure of its month
  assert.equal(stoppedMonth(STOPPED_FILE, { "stopped.stopped": { "2026-10": 1 } }, "2026-10")!.stopped, 788);
});

test("months added up: the share over the months with both figures, the breakdowns over the listed ones", () => {
  const yms = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
  const s = sumStopped(yms.map((ym) => stoppedMonth(STOPPED_FILE, null, ym)));
  assert.equal(s.months, 10);
  assert.equal(s.stopped, 712 + 741 + 805 + 615 + 545 + 657 + 813 + 522 + 655 + 788);
  assert.ok(Math.abs(sumShare(s)! - s.stopped / s.transferred) < 1e-12);
  assert.equal(s.detailed, 10);
  assert.equal(s.perOrder.reduce((a, b) => a + b, 0), s.listed);
  assert.equal(s.mandant["100"] + s.mandant["110"], s.listed);
  assert.equal(Object.values(s.handledBy).reduce((a, b) => a + b, 0), s.listed);
  // the credit limit is the first reason of 2026
  assert.equal(reasonsRanked(s.reasons)[0].id, "credit");
  // tickets per order over the months that have both
  assert.ok(s.tickets! > 0 && s.ticketOrders > 0);
});
