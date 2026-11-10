import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, fold, monthOf, type CompanyIn, type Cube, type Dim } from "../src/lib/marketingKpis/cube";
import { MAX_SHARE, TARGETS, amountOf, checkAmount, checkTarget, checkWeights, cleanAll, impliedGrowth, quarterTargets, sheetWeights, targetToQuarter, weightsOf, yearTarget, yearTargetOf } from "../src/lib/reporting/mySalesRules";
import { cubeReach, dueToDate, revenueByPerson, revenueMeasures, visitsByPerson, visitsMeasure } from "../src/lib/reporting/mySalesFigures";
import type { VisitsData } from "../src/lib/reporting/visitsRules";

// SARCLA 01.11.2026: "introduce the file VPP ESO 2026 BORJER - allow the sales to set its own target percentage,
// understand the file how it's calculated". The sheet's own figures (Jeremy Borey, 2026) are the check.

test("the VPP sheet's five targets, in its order", () => {
  assert.deepEqual(TARGETS.map((t) => [t.id, t.kind]), [["own", "growth"], ["dt", "growth"], ["kt", "growth"], ["new", "eur"], ["visits", "count"]]);
});

test("a year's target as the sheet reckons it: last year and the growth on it, split by the plan's quarters", () => {
  // Target 1, own area: PY 620,462, growth 29.45 % -> 803,188; Q1 205,616 (25.6 %)
  const own = yearTarget("own", 29.45, 620_462)!;
  assert.equal(Math.round(own), 803_188);
  assert.deepEqual(quarterTargets("own", own).map(Math.round), [205_616, 200_797, 197_584, 199_191]);
  // Target 2, sealing: PY 285,800, growth 46.4 % -> 418,411
  assert.equal(Math.round(yearTarget("dt", 46.4, 285_800)!), 418_411);
  // Target 4, new customers: an amount - 40,000 -> 10,240 / 10,000 / 9,840 / 9,920
  assert.deepEqual(quarterTargets("new", yearTarget("new", 40_000, 0)!), [10_240, 10_000, 9_840, 9_920]);
  // Target 5, visits: a number, its own quarters - 480 -> 127.2 / 132 / 105.6 / 115.2
  assert.deepEqual(quarterTargets("visits", 480).map((x) => Math.round(x * 10) / 10), [127.2, 132, 105.6, 115.2]);
  assert.equal(Math.round(targetToQuarter("visits", 480, 1) * 10) / 10, 259.2);
  // nothing set: no target
  assert.equal(yearTarget("own", undefined, 620_462), null);
});

test("what may be set: a growth to two decimals, an amount, a number - within bounds; empty clears it", () => {
  assert.deepEqual(checkTarget("own", "29.45"), { ok: true, value: 29.45 });
  assert.deepEqual(checkTarget("own", -5), { ok: true, value: -5 });
  assert.deepEqual(checkTarget("new", "40,000"), { ok: true, value: 40_000 });
  assert.deepEqual(checkTarget("visits", ""), { ok: true, value: null });
  assert.equal(checkTarget("own", "abc").ok, false);
  assert.equal(checkTarget("own", 5_000).ok, false);
  assert.equal(checkTarget("new", -1).ok, false);
  // as kept: unknown keys and bad values dropped, who and when kept
  assert.deepEqual(cleanAll({ "123": { own: 12.5, visits: "480", bonus: 9_338, kt: "x", by: "jbo" }, abc: { own: 1 } }), { "123": { own: 12.5, visits: 480, by: "jbo" } });
});

test("the year to date is measured against what is due by now: the quarters done, the running one as far as it has run", () => {
  // to the end of October: Q1-Q3 whole, a third of Q4
  assert.equal(Math.round(dueToDate([100, 100, 100, 100], { month: 9, share: 1 })), 333);
  // mid-February: half a month of three
  assert.equal(Math.round(dueToDate([300, 300, 300, 300], { month: 1, share: 0.5 })), 150);
});

/* ── the figures, out of the cube and the visits read ─────────────────── */

const months = (pairs: Record<number, number> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? 0);
const pcs = (pairs: Record<number, Record<string, number>> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? {});
type In = { sae: string; first: number | null; cy?: Record<number, number>; py?: Record<number, number>; pcCy?: Record<number, Record<string, number>>; pcPy?: Record<number, Record<string, number>> };
function cubeOf(list: In[]): Cube {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: CompanyIn[] = list.map((c) => ({
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, d === "sae" ? c.sae : "x")])) as Record<Dim, number>,
    potential: null, months: [months(c.cy), months(c.py), months()], firstMonth: c.first,
    pcMonths: [pcs(c.pcCy), pcs(c.pcPy)],
  }));
  // read to October 2026
  return { generatedAt: "", years: [2026, 2025, 2024], loaded: [10, 12, 12], running: null, labels, ...fold(companies) };
}
const cube = cubeOf([
  { sae: "Anna", first: null, cy: { 0: 1_000, 4: 2_000, 9: 500 }, py: { 0: 800, 11: 1_200 }, pcCy: { 0: { dt: 1_000 }, 4: { kt: 2_000 }, 9: { dt: 500 } }, pcPy: { 0: { dt: 800 }, 11: { kt: 1_200 } } },
  // new in May 2026: what it was invoiced counts for the new customers' target
  { sae: "Anna", first: monthOf(0, 4), cy: { 4: 300, 7: 200 }, pcCy: { 4: { kt: 300 }, 7: { kt: 200 } } },
  { sae: "Ben", first: null, cy: { 1: 4_000 }, py: { 1: 1_000 }, pcCy: { 1: { ft: 4_000 } }, pcPy: { 1: { ft: 1_000 } } },
]);

test("one person's four revenue targets: quarters, last year, the year to date", () => {
  assert.deepEqual(cubeReach(cube), { month: 9, share: 1 });
  const m = revenueMeasures(cube, ["Anna"]);
  assert.deepEqual(m.own, { q: [1_000, 2_300, 200, 500], qPy: [800, 0, 0, 1_200], py: 2_000, ytd: 4_000, ytdPy: 800 });
  assert.deepEqual(m.dt.q, [1_000, 0, 0, 500]);
  assert.equal(m.dt.py, 800);
  assert.deepEqual(m.kt.q, [0, 2_300, 200, 0]);
  assert.equal(m.kt.py, 1_200);
  // the year's new customers: what they were invoiced, quarter by quarter, adding up to the year to date
  assert.deepEqual(m.new.q, [0, 300, 200, 0]);
  assert.equal(m.new.ytd, 500);
  // nobody: nothing at all, never everybody
  assert.equal(revenueMeasures(cube, []).own.ytd, 0);
});

test("each person's share, for My team and All ESO - only the people asked for", () => {
  const by = revenueByPerson(cube, ["Anna", "Ben"]);
  assert.deepEqual(by.own.map((r) => [r.label, r.cur]).sort(), [["Anna", 4_000], ["Ben", 4_000]]);
  assert.deepEqual(by.dt, [{ label: "Anna", cur: 1_500, prev: 800 }]);
  assert.deepEqual(revenueByPerson(cube, ["Ben"]).own.map((r) => r.label), ["Ben"]);
});

test("the visits target: completed visits per quarter, last year's customer meetings beside them", () => {
  const d = {
    year: 2026, today: "2026-10-31",
    people: [{ id: "1", name: "Anna", team: "ESO" }, { id: "2", name: "Ben", team: "ESO" }],
    // a row's year counted back from the read's: 0 this year, 1 the year before
    visits: [[0, 0, 0, 5], [0, 0, 3, 9], [0, 0, 3, 10], [1, 0, 9, 2], [0, 1, 9, 2]],
    lastYear: [[0, 1, 3], [0, 10, 4]],
  } as unknown as VisitsData;
  const a = visitsMeasure(d, new Set([0]));
  assert.deepEqual(a.q, [1, 2, 0, 0]);
  assert.deepEqual(a.qPy, [1, 0, 0, 1]);
  assert.equal(a.ytd, 3);
  assert.deepEqual(visitsByPerson(d, new Set([0, 1])).map((r) => [r.label, r.cur]), [["Anna", 3], ["Ben", 1]]);
});

test("each person's own period weighting, else the sheet's - four quarters making 100 %, and the 120 % the sheet counts to (SARCLA 01.11.2026)", () => {
  assert.deepEqual(sheetWeights("own"), [25.6, 25, 24.6, 24.8]);
  assert.deepEqual(sheetWeights("visits"), [26.5, 27.5, 22, 24]);
  // the person's own split, the year's target falling on it
  const t = { own: 10, weights: { own: [30, 25, 20, 25] } };
  assert.deepEqual(weightsOf(t, "own"), [0.3, 0.25, 0.2, 0.25]);
  assert.deepEqual(weightsOf(t, "dt"), [0.256, 0.25, 0.246, 0.248]);
  assert.deepEqual(quarterTargets("own", 1000, weightsOf(t, "own")), [300, 250, 200, 250]);
  assert.equal(targetToQuarter("own", 1000, 1, weightsOf(t, "own")), 550);
  // four, each 0-100, together 100 (half a point either way taken as 100)
  assert.deepEqual(checkWeights(["30", "25", "20", "25"]), { ok: true, value: [30, 25, 20, 25] });
  assert.equal(checkWeights([30, 25, 20]).ok, false);
  assert.equal(checkWeights([30, 30, 30, 30]).ok, false);
  assert.equal(checkWeights([-1, 51, 25, 25]).ok, false);
  // kept with the targets; a bad split dropped
  assert.deepEqual(cleanAll({ "7": { own: 10, weights: { own: [30, 25, 20, 25], kt: [90, 90, 0, 0] } } })["7"], { own: 10, weights: { own: [30, 25, 20, 25] } });
  assert.equal(MAX_SHARE, 1.2);
});

test("a growth target's year typed as an amount in place of the growth (SARCLA 10.11.2026: \"change the value of the target itself\")", () => {
  // Target 1 of the sheet: 620,462 last year; 803,188 typed as the amount - the same target as +29.45 %, and it stays put
  assert.equal(yearTargetOf({ own: 29.45, amounts: { own: 803_188 } }, "own", 620_462), 803_188);
  assert.equal(yearTargetOf({ own: 29.45, amounts: { own: 803_188 } }, "own", 700_000), 803_188); // last year moved: the amount did not
  assert.equal(Math.round(yearTargetOf({ own: 29.45 }, "own", 620_462)!), 803_188); // no amount: the growth, as before
  assert.equal(yearTargetOf({ amounts: { own: 500_000 } }, "own", 0), 500_000); // no last year needed for an amount
  assert.equal(impliedGrowth(803_188, 620_462), 29.45);
  assert.equal(impliedGrowth(500_000, 0), null);
  // an amount only stands in for a growth: the new customers' and the visits' targets are amounts / numbers already
  assert.equal(amountOf({ new: 40_000, amounts: { new: 99_000 } }, "new"), undefined);
  assert.equal(yearTargetOf({ new: 40_000, amounts: { new: 99_000 } }, "new", 0), 40_000);
  // what may be typed: to the euro, up to €100 million, with the separators people type; empty clears it
  assert.deepEqual(checkAmount("449'103"), { ok: true, value: 449_103 });
  assert.deepEqual(checkAmount("€ 1,250,000.4"), { ok: true, value: 1_250_000 });
  assert.deepEqual(checkAmount(""), { ok: true, value: null });
  assert.equal(checkAmount("-5").ok, false);
  assert.equal(checkAmount("abc").ok, false);
  // kept clean: growth targets only, within bounds
  assert.deepEqual(cleanAll({ "7": { own: 10, amounts: { own: 450_000, dt: "x", new: 5, visits: 9 } } })["7"], { own: 10, amounts: { own: 450_000 } });
});
