import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, defaultWindow, fold, monthOf, newBy, newByMonth, totals, type CompanyIn, type Cube, type Dim } from "../src/lib/marketingKpis/cube";

// The ESO New customers (29.10.2026): the cube keeps each new customer's revenue from its first order on, and the
// profit centre it bought most from - folded the way customers.ts folds every company.
const months = (pairs: Record<number, number> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? 0);
const pcs = (pairs: Record<number, Record<string, number>> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? {});
type In = { sae: string; first: number | null; cy?: Record<number, number>; py?: Record<number, number>; py2?: Record<number, number>; pcCy?: Record<number, Record<string, number>>; pcPy?: Record<number, Record<string, number>> };
function cubeOf(list: In[]): Cube {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: CompanyIn[] = list.map((c) => ({
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, d === "sae" ? c.sae : "x")])) as Record<Dim, number>,
    potential: null, months: [months(c.cy), months(c.py), months(c.py2)], firstMonth: c.first,
    pcMonths: [pcs(c.pcCy), pcs(c.pcPy)],
  }));
  return { generatedAt: "", years: [2026, 2025, 2024], loaded: [10, 12, 12], running: null, labels, ...fold(companies) };
}
const cube = cubeOf([
  // new in March 2026, mostly Sealing Technology
  { sae: "Anna", first: monthOf(0, 2), cy: { 2: 1_000, 4: 500, 9: 300 }, pcCy: { 2: { dt: 1_000 }, 4: { kt: 500 }, 9: { dt: 300 } } },
  // new in April 2025, Fluid Technology; bought again in February 2026
  { sae: "Ben", first: monthOf(1, 3), py: { 3: 2_000, 6: 1_000 }, cy: { 1: 400 }, pcPy: { 3: { ft: 2_000 }, 6: { ft: 1_000 } }, pcCy: { 1: { kt: 400 } } },
  // new in October 2025
  { sae: "Anna", first: monthOf(1, 9), py: { 9: 700 }, pcPy: { 9: { kt: 700 } } },
  // new in October 2026, nothing invoiced yet
  { sae: "Ben", first: monthOf(0, 9) },
  // an old customer and one new in 2024: neither is new this year or last
  { sae: "Anna", first: null, cy: { 0: 5_000 } },
  { sae: "Ben", first: monthOf(2, 5), py2: { 5: 100 }, py: { 1: 50 } },
]);
const ytd = defaultWindow(cube);

test("the new customers of the period and what they bought in it, against the same months a year earlier", () => {
  assert.deepEqual(ytd, { start: 24, end: 33 });
  const t = newBy(cube, {}, ytd).get("")!;
  assert.deepEqual(t, { n: 2, nPy: 2, rev: 1_800, revPy: 3_700 });
  // the same count as the cube's own new customers
  const a = totals(cube, {}, ytd);
  assert.equal(a.newC, t.n);
  assert.equal(a.newCPy, t.nPy);
});

test("by Performis SAE and by the profit centre they bought most from; a filter narrows them", () => {
  const bySae = newBy(cube, {}, ytd, "sae");
  assert.deepEqual(bySae.get("Anna"), { n: 1, nPy: 1, rev: 1_800, revPy: 700 });
  assert.deepEqual(bySae.get("Ben"), { n: 1, nPy: 1, rev: 0, revPy: 3_000 });
  const byPc = newBy(cube, {}, ytd, "pc");
  assert.deepEqual(byPc.get("dt"), { n: 1, nPy: 0, rev: 1_800, revPy: 0 });
  assert.deepEqual(byPc.get("none"), { n: 1, nPy: 0, rev: 0, revPy: 0 });
  assert.deepEqual(byPc.get("ft"), { n: 0, nPy: 1, rev: 0, revPy: 3_000 });
  assert.deepEqual(byPc.get("kt"), { n: 0, nPy: 1, rev: 0, revPy: 700 });
  assert.deepEqual(newBy(cube, { sae: ["Anna"] }, ytd).get(""), { n: 1, nPy: 1, rev: 1_800, revPy: 700 });
  // grouped by the Performis SAE, its own filter is left out - the others stay
  assert.equal(newBy(cube, { sae: ["Anna"] }, ytd, "sae").get("Ben")?.n, 1);
});

test("month by month: new that month, and what the period's new customers bought in it - the months add up to the period", () => {
  const ms = newByMonth(cube, {}, ytd);
  assert.equal(ms.length, 10);
  assert.deepEqual(ms.map((m) => m.n), [0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(ms.map((m) => m.rev), [0, 0, 1_000, 0, 500, 0, 0, 0, 0, 300]);
  assert.deepEqual(ms.map((m) => m.nPy), [0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(ms.map((m) => m.revPy), [0, 0, 0, 2_000, 0, 0, 1_000, 0, 0, 700]);
  const t = newBy(cube, {}, ytd).get("")!;
  assert.equal(ms.reduce((s, m) => s + m.rev, 0), t.rev);
  assert.equal(ms.reduce((s, m) => s + m.revPy, 0), t.revPy);
});

test("a window starting later counts only what was bought in it; last year's month in progress pro rata", () => {
  // May to October 2026: Anna's March customer is not new in it
  const w = { start: monthOf(0, 4), end: monthOf(0, 9) };
  assert.deepEqual(newBy(cube, {}, w).get(""), { n: 1, nPy: 1, rev: 0, revPy: 700 });
  // October 2026 runs to the 10th: October 2025's new customer and its revenue count 10/31
  const c: Cube = { ...cube, running: { month: monthOf(0, 9), day: 10, days: 31 } };
  const t = newBy(c, {}, ytd).get("")!;
  assert.equal(Math.round(t.nPy * 1000) / 1000, Math.round((1 + 10 / 31) * 1000) / 1000);
  assert.equal(Math.round(t.revPy), Math.round(3_000 + 700 * (10 / 31)));
});

test("a new customer's months are kept from its first order on, the zeros at the end left out", () => {
  const rows = cube.newRevenue!;
  const d = rows.find((r) => r[1] === monthOf(0, 9))!;
  assert.deepEqual(d.slice(1), [monthOf(0, 9), -1, 1]);
  const a = rows.find((r) => r[1] === monthOf(0, 2))!;
  assert.equal(cube.pcLabels![a[2]], "dt");
  assert.deepEqual(a.slice(3), [1, 1_000, 0, 500, 0, 0, 0, 0, 300]);
});
