import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIMS, breakdown, defaultWindow, fold, lastMonth, monthMask, potentialBand, shareOfWallet, sortRows, totals, upToDate, usablePotential, windowLabel,
  type CompanyIn, type Cube, type Dim,
} from "../src/lib/marketingKpis/cube";

// A small portfolio, built the way customers.ts builds the real one: revenue per
// month for this year, last year and the year before.
const months = (pairs: Record<number, number> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? 0);
type In = { dims: Record<Dim, string>; potential?: number | null; cy?: Record<number, number>; py?: Record<number, number> };
function cubeOf(list: In[], loaded = 9): Cube {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: CompanyIn[] = list.map((c) => ({
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, c.dims[d])])) as Record<Dim, number>,
    potential: c.potential ?? null,
    months: [months(c.cy), months(c.py), months()],
  }));
  return { generatedAt: "", years: [2026, 2025, 2024], loaded: [loaded, 12, 12], labels, ...fold(companies) };
}
const co = (prio: string, segment: string, country: string, owner: string, x: Omit<In, "dims"> = {}): In => ({
  dims: { prio, segment, potential: potentialBand(x.potential ?? null), country, owner, type: "OEM", mandant: "M100" }, ...x,
});
const cube = cubeOf([
  co("Prio 1", "APSOcore", "Switzerland", "Anna", { potential: 120_000, cy: { 0: 30_000, 5: 30_000 }, py: { 0: 50_000 } }),
  co("Prio 1", "APSOgrowth", "Germany", "Ben", { potential: 40_000, cy: { 2: 30_000 }, py: { 1: 40_000 } }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { potential: 5_000, cy: { 4: 3_000 }, py: { 4: 2_000 } }),
  co("Prio 3", "APSOprospect", "Germany", "Ben", { potential: 800 }),
  co("No priority", "APSOprospect", "Switzerland", "No owner", { potential: 5_000_000, cy: { 1: 500 } }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { potential: 3_000, cy: { 7: 1_000 } }),
]);
const ytd = defaultWindow(cube);

test("the year to date: every company once, buyers counted once however many months they bought in", () => {
  assert.deepEqual(ytd, { y: 0, from: 0, to: 8 });
  const a = totals(cube, {}, ytd);
  assert.equal(a.n, 6);
  assert.equal(a.bought, 5);          // the first company bought in two months - still one buyer
  assert.equal(a.boughtPy, 3);
  assert.equal(a.rev, 94_500);
  assert.equal(a.revPy, 92_000);
  // the 5 M€ potential is a typing slip: out of share of wallet, its revenue too
  assert.equal(a.pot, 120_000 + 40_000 + 5_000 + 800 + 3_000);
  assert.equal(a.revPot, 94_000);
});

test("a window of months, against the same months a year earlier", () => {
  const q1 = { y: 0, from: 0, to: 2 };
  const a = totals(cube, {}, q1);
  assert.equal(a.rev, 30_000 + 30_000 + 500);
  assert.equal(a.bought, 3);
  assert.equal(a.revPy, 90_000);
  assert.equal(a.boughtPy, 2);
  const june = totals(cube, { prio: "Prio 1" }, { y: 0, from: 5, to: 5 });
  assert.equal(june.bought, 1);
  assert.equal(june.rev, 30_000);
  // last year, whole, against the year before (empty here)
  const ly = totals(cube, {}, { y: 1, from: 0, to: 11 });
  assert.equal(ly.rev, 92_000);
  assert.equal(ly.revPy, 0);
});

test("a click filters every other breakdown, and its own dimension still shows all its values", () => {
  const f = { prio: "Prio 1" };
  assert.deepEqual(sortRows(breakdown(cube, "country", f, ytd), "name", "country").map((r) => [r.label, r.n]), [["Germany", 1], ["Switzerland", 1]]);
  assert.deepEqual(breakdown(cube, "prio", f, ytd).map((r) => r.label), ["Prio 1", "Prio 2", "Prio 3", "No priority"]);
  assert.equal(totals(cube, { prio: "Prio 2", country: "Switzerland" }, ytd).n, 2);
  assert.equal(totals(cube, { owner: "Anna", segment: "APSOcore" }, ytd).rev, 64_000);
  assert.equal(totals(cube, { country: "Nowhere" }, ytd).n, 0);
});

test("each card sorts its own rows; priority and potential keep their order unless asked", () => {
  assert.deepEqual(breakdown(cube, "potential", {}, ytd).map((r) => r.label), ["€100K and more", "€25K – 100K", "€2.5K – 25K", "€500 – 2.5K"]);
  const seg = breakdown(cube, "segment", {}, ytd);
  assert.deepEqual(seg.map((r) => r.label), ["APSOcore", "APSOgrowth", "APSOprospect"]);          // by revenue
  assert.deepEqual(sortRows(seg, "n", "segment").map((r) => r.label), ["APSOcore", "APSOprospect", "APSOgrowth"]);
  assert.deepEqual(sortRows(seg, "name", "segment").map((r) => r.label), ["APSOcore", "APSOgrowth", "APSOprospect"]);
  assert.deepEqual(sortRows(breakdown(cube, "prio", {}, ytd), "rev", "prio").map((r) => r.label)[0], "Prio 1");
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

test("the window in words, and how far it is up to date", () => {
  assert.equal(windowLabel(cube, ytd), "Jan–Sep 2026");
  assert.equal(windowLabel(cube, ytd, 1), "Jan–Sep 2025");
  assert.equal(windowLabel(cube, { y: 0, from: 5, to: 5 }), "Jun 2026");
  assert.equal(upToDate(cube, ytd), "30 Sep 2026");
  assert.equal(upToDate(cube, { y: 1, from: 0, to: 1 }), "28 Feb 2025");
  assert.equal(lastMonth(cube, 0), 8);
  assert.equal(lastMonth(cube, 1), 11);
  assert.equal(monthMask(0, 2), 0b111);
});
