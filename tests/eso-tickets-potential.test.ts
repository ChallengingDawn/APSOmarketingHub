import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFS, NO_VALUE, T, TOUTCOMES, VSTEPS, confIndex, potOf, potOpenOf, potWonOf, potentialOf, statsBy, sum } from "../src/lib/reporting/ticketsRules";

// SARCLA 01.11.2026: "on ticket apps we need another tab for the potential - the ticket value funnel on the pipeline with
// the confidence score".
const O = (id: string) => TOUTCOMES.findIndex((o) => o.id === id);
/** A ticket row: its outcome, potential, confidence and stage - the rest zero. */
function row(outcome: string, value: number, conf: number, stage = 0): number[] {
  const r = Array(21).fill(0) as number[];
  r[T.outcome] = O(outcome); r[T.value] = value; r[T.conf] = conf; r[T.stage] = stage;
  r[T.firstH] = -1; r[T.first] = -1; r[T.resolution] = outcome === "open" || outcome === "nores" ? -1 : 0; r[T.company] = -1;
  return r;
}
const WIN = { from: 0, to: 0 };

test("tickets potential: the confidence as the Ticket value app writes it", () => {
  assert.deepEqual(CONFS, ["High", "Medium", "Low"]);
  assert.equal(confIndex("high"), 0);
  assert.equal(confIndex(" Medium "), 1);
  assert.equal(confIndex("low"), 2);
  assert.equal(confIndex("unqualified"), -1);
  assert.equal(confIndex(null), -1);
});

test("tickets potential: valued 0 or without a confidence is no value - whatever the confidence says", () => {
  assert.deepEqual(potentialOf(row("open", 1200, 0)), { ci: 0, v: 1200 });
  assert.deepEqual(potentialOf(row("open", 0, 2)), { ci: NO_VALUE, v: 0 });
  assert.deepEqual(potentialOf(row("open", 500, -1)), { ci: NO_VALUE, v: 0 });
  // a read before 01.11.2026: no potential columns at all
  assert.deepEqual(potentialOf(row("open", 0, 0).slice(0, 18)), { ci: NO_VALUE, v: 0 });
});

test("tickets potential: the funnel - each step inside the one before, by confidence", () => {
  const rows = [
    row("won", 1000, 0), row("price", 400, 1), row("open", 2000, 0, 2), row("open", 300, 2, 3), row("nores", 50, 2), row("won", 0, 2),
  ];
  const s = statsBy(rows, WIN).get("")!;
  assert.equal(VSTEPS.length, 3);
  assert.equal(potOf(s), 3750);
  assert.equal(sum(s.pot[1]), 1400, "closed with a resolution: the won and the lost - not the open, not the closed without one");
  assert.equal(potWonOf(s), 1000);
  assert.deepEqual(s.pot[0], [3000, 400, 350, 0]);
  assert.deepEqual(s.potN[0], [2, 1, 2, 1], "the won valued 0 counts as no value");
  for (let i = 1; i < VSTEPS.length; i++) for (let c = 0; c <= NO_VALUE; c++) assert.ok(s.pot[i][c] <= s.pot[i - 1][c]);
  // the won and the decided by confidence: high 1 of 1, medium 0 of 1, no value 1 of 1
  assert.deepEqual(s.confWon, [1, 0, 0, 1]);
  assert.deepEqual(s.confResolved, [1, 1, 0, 1]);
});

test("tickets potential: the open pipeline by confidence and by the stage each stands in", () => {
  const rows = [row("open", 2000, 0, 2), row("open", 300, 2, 3), row("open", 100, 1, 2), row("open", 0, 2, 0), row("won", 900, 0, 7)];
  const s = statsBy(rows, WIN).get("")!;
  assert.equal(potOpenOf(s), 2400);
  assert.deepEqual(s.potOpen, [2000, 100, 300, 0]);
  assert.deepEqual(s.potOpenN, [1, 1, 1, 1]);
  assert.deepEqual(s.potStage[2], [2000, 100, 0, 0]);
  assert.deepEqual(s.potStage[3], [0, 0, 300, 0]);
  assert.deepEqual(s.potStageN[0], [0, 0, 0, 1]);
  assert.equal(s.potStage[7], undefined, "a closed ticket is not in the pipeline");
});
