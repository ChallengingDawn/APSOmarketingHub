import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIMS, breakdown, clampWindow, defaultWindow, fold, lastMonth, masks, monthOf, potentialBand, presets, shareOfWallet, sortRows, totals,
  upToDate, usablePotential, windowLabel, type CompanyIn, type Cube, type Dim,
} from "../src/lib/marketingKpis/cube";

// A small portfolio, built the way customers.ts builds the real one: revenue per
// month for this year (2026), last year and the year before.
const months = (pairs: Record<number, number> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? 0);
type In = { dims: Record<Dim, string>; potential?: number | null; cy?: Record<number, number>; py?: Record<number, number>; py2?: Record<number, number> };
function cubeOf(list: In[], loaded = 9): Cube {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: CompanyIn[] = list.map((c) => ({
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, c.dims[d])])) as Record<Dim, number>,
    potential: c.potential ?? null,
    months: [months(c.cy), months(c.py), months(c.py2)],
  }));
  return { generatedAt: "", years: [2026, 2025, 2024], loaded: [loaded, 12, 12], labels, ...fold(companies) };
}
const co = (prio: string, segment: string, country: string, owner: string, x: Omit<In, "dims"> = {}): In => ({
  dims: { prio, segment, potential: potentialBand(x.potential ?? null), country, owner, type: "OEM", mandant: "M100" }, ...x,
});
const cube = cubeOf([
  co("Prio 1", "APSOcore", "Switzerland", "Anna", { potential: 120_000, cy: { 0: 30_000, 5: 30_000 }, py: { 0: 50_000, 11: 7_000 } }),
  co("Prio 1", "APSOgrowth", "Germany", "Ben", { potential: 40_000, cy: { 2: 30_000 }, py: { 1: 40_000 }, py2: { 11: 9_000 } }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { potential: 5_000, cy: { 4: 3_000 }, py: { 4: 2_000 } }),
  co("Prio 3", "APSOprospect", "Germany", "Ben", { potential: 800 }),
  co("No priority", "APSOprospect", "Switzerland", "No owner", { potential: 5_000_000, cy: { 1: 500 } }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { potential: 3_000, cy: { 7: 1_000 } }),
]);
const ytd = defaultWindow(cube);
const jan26 = monthOf(0, 0);

test("this year to date: every company once, a buyer once however many months it bought in", () => {
  assert.deepEqual(ytd, { start: 24, end: 32 });
  const a = totals(cube, {}, ytd);
  assert.equal(a.n, 6);
  assert.equal(a.bought, 5);
  assert.equal(a.boughtPy, 3);
  assert.equal(a.rev, 94_500);
  assert.equal(a.revPy, 92_000);
  // the 5 M€ potential is a typing slip: out of share of wallet, its revenue too
  assert.equal(a.pot, 120_000 + 40_000 + 5_000 + 800 + 3_000);
  assert.equal(a.revPot, 94_000);
});

test("a window over a year end counts each buyer once, against the same months a year earlier", () => {
  // December 2025 to March 2026, against December 2024 to March 2025
  const w = { start: monthOf(1, 11), end: jan26 + 2 };
  assert.equal(windowLabel(cube, w), "Dec 2025 – Mar 2026");
  assert.equal(windowLabel(cube, w, 1), "Dec 2024 – Mar 2025");
  const a = totals(cube, {}, w);
  assert.equal(a.rev, 7_000 + 30_000 + 30_000 + 500);
  assert.equal(a.bought, 3);                       // the first company bought in Dec and Jan: one buyer
  assert.equal(a.revPy, 9_000 + 50_000 + 40_000);
  assert.equal(a.boughtPy, 2);
});

test("a quarter, last year whole, and the months a window may reach", () => {
  const q1 = presets(cube).find((p) => p.id === "q1")!.win;
  assert.equal(windowLabel(cube, q1), "Jan–Mar 2026");
  assert.equal(totals(cube, {}, q1).rev, 60_500);
  const ly = presets(cube).find((p) => p.id === "ly")!.win;
  assert.equal(windowLabel(cube, ly), "2025");
  assert.equal(windowLabel(cube, ly, 1), "2024");
  assert.equal(totals(cube, {}, ly).rev, 99_000);
  assert.equal(totals(cube, {}, ly).revPy, 9_000);
  assert.deepEqual(presets(cube).map((p) => p.id), ["ytd", "12m", "ly", "q1", "q2", "q3"]);
  assert.equal(lastMonth(cube), 32);
  assert.deepEqual(clampWindow(cube, { start: 0, end: 99 }), { start: 12, end: 32 });
  assert.equal(upToDate(cube, ytd), "30 Sep 2026");
  assert.equal(upToDate(cube, ly), "31 Dec 2025");
  assert.deepEqual(masks(22, 25), [(1 << 22) | (1 << 23), 0b11]);
});

test("a click filters every other breakdown, and its own dimension still shows all its values", () => {
  const f = { prio: "Prio 1" };
  assert.deepEqual(sortRows(breakdown(cube, "country", f, ytd), "label", "country").map((r) => [r.label, r.n]), [["Germany", 1], ["Switzerland", 1]]);
  assert.deepEqual(breakdown(cube, "prio", f, ytd).map((r) => r.label), ["Prio 1", "Prio 2", "Prio 3", "No priority"]);
  assert.equal(totals(cube, { prio: "Prio 2", country: "Switzerland" }, ytd).n, 2);
  assert.equal(totals(cube, { owner: "Anna", segment: "APSOcore" }, ytd).rev, 64_000);
  assert.equal(totals(cube, { country: "Nowhere" }, ytd).n, 0);
});

test("any column sorts, both ways; priority and potential keep their order until asked", () => {
  assert.deepEqual(breakdown(cube, "potential", {}, ytd).map((r) => r.label), ["€100K and more", "€25K – 100K", "€2.5K – 25K", "€500 – 2.5K"]);
  const seg = breakdown(cube, "segment", {}, ytd);
  assert.deepEqual(seg.map((r) => r.label), ["APSOcore", "APSOgrowth", "APSOprospect"]);                 // by revenue
  assert.deepEqual(sortRows(seg, "n", "segment").map((r) => r.label), ["APSOcore", "APSOprospect", "APSOgrowth"]);
  assert.deepEqual(sortRows(seg, "n", "segment", false).map((r) => r.label), ["APSOgrowth", "APSOprospect", "APSOcore"]);
  assert.deepEqual(sortRows(seg, "label", "segment").map((r) => r.label), ["APSOcore", "APSOgrowth", "APSOprospect"]);
  assert.deepEqual(sortRows(seg, "label", "segment", false).map((r) => r.label), ["APSOprospect", "APSOgrowth", "APSOcore"]);
  assert.equal(sortRows(breakdown(cube, "prio", {}, ytd), "rev", "prio")[0].label, "Prio 1");
});

test("potential bands follow the sales-priority thresholds", () => {
  assert.equal(potentialBand(null), "Not set");
  assert.equal(potentialBand(499), "Under €500");
  assert.equal(potentialBand(500), "€500 – 2.5K");
  assert.equal(potentialBand(25_000), "€25K – 100K");
  assert.equal(potentialBand(100_000), "€100K and more");
  assert.equal(usablePotential(1_000_001), false);
  assert.equal(usablePotential(0), false);
});

test("share of wallet: revenue in the window against the potential for as many months", () => {
  const a = totals(cube, { prio: "Prio 1" }, ytd);
  // (60k + 30k) / ((120k + 40k) * 9/12)
  assert.equal(Math.round(shareOfWallet(a, ytd)! * 1000) / 1000, 0.75);
  assert.equal(shareOfWallet(totals(cube, { country: "Nowhere" }, ytd), ytd), null);
});
