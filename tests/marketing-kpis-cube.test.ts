import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIMS, breakdown, clampWindow, defaultWindow, fold, lastMonth, masks, monthOf, potentialBand, presets, proRataNote, shareOfWallet, sortRows, totals,
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
  return { generatedAt: "", years: [2026, 2025, 2024], loaded: [loaded, 12, 12], running: null, labels, ...fold(companies) };
}
const co = (prio: string, segment: string, country: string, owner: string, x: Omit<In, "dims"> = {}): In => ({
  dims: { prio, segment, potential: potentialBand(x.potential ?? null), country, owner, type: "OEM", apic: "1.1 Machine Manufacturing (OEM)", mandant: "M100" }, ...x,
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
  assert.deepEqual(presets(cube).map((p) => p.id), ["ytd", "lm", "12m", "ly", "q1", "q2", "q3"]);   // no month in progress: no "month to date"
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
  assert.deepEqual(breakdown(cube, "potential", {}, ytd).map((r) => r.label), ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499"]);
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
  assert.equal(potentialBand(500), "€500 – 2,499");
  assert.equal(potentialBand(25_000), "€25,000 – 99,999");
  assert.equal(potentialBand(100_000), "€100,000 and more");
  assert.equal(usablePotential(1_000_001), false);
  assert.equal(usablePotential(0), false);
});

test("share of wallet: revenue in the window against the potential for as many months", () => {
  const a = totals(cube, { prio: "Prio 1" }, ytd);
  // (60k + 30k) / ((120k + 40k) * 9/12)
  assert.equal(Math.round(shareOfWallet(a, ytd)! * 1000) / 1000, 0.75);
  assert.equal(shareOfWallet(totals(cube, { country: "Nowhere" }, ytd), ytd), null);
});

test("the month in progress: year and month to date reach the last delivery, last year's same month pro rata", () => {
  // October 2026 so far (to the 12th), against October 2025 counted 12/31
  const c = cubeOf([
    co("Prio 1", "APSOcore", "Switzerland", "Anna", { potential: 120_000, cy: { 0: 10_000, 9: 3_100 }, py: { 0: 9_000, 9: 31_000 } }),
    co("Prio 2", "APSOcore", "Germany", "Ben", { potential: 12_000, py: { 9: 3_100 } }),
  ]);
  c.running = { month: monthOf(0, 9), day: 12, days: 31 };
  const ids = presets(c).map((p) => p.id);
  assert.deepEqual(ids.slice(0, 3), ["ytd", "mtd", "lm"]);
  const ytdW = presets(c)[0].win, mtd = presets(c)[1].win;
  assert.deepEqual(ytdW, { start: 24, end: 33 });
  assert.equal(windowLabel(c, ytdW), "Jan – 12 Oct 2026");
  assert.equal(windowLabel(c, ytdW, 1), "Jan – 12 Oct 2025");
  assert.equal(windowLabel(c, mtd), "1–12 Oct 2026");
  assert.equal(upToDate(c, mtd), "12 Oct 2026");
  assert.equal(presets(c)[2].label, "September 2026");
  const m = totals(c, {}, mtd);
  assert.equal(m.rev, 3_100);
  assert.equal(Math.round(m.revPy), 12_000 + 1_200);      // (31,000 + 3,100) x 12/31
  assert.equal(Math.round(m.boughtPy * 100) / 100, 0.77); // two of last October's buyers, 12/31 of each
  const y = totals(c, {}, ytdW);
  assert.equal(y.rev, 13_100);
  assert.equal(Math.round(y.revPy), 9_000 + 13_200);
  // the first company also bought in January last year: whole; the second only in October: pro rata
  assert.equal(Math.round(y.boughtPy * 1000) / 1000, Math.round((1 + 12 / 31) * 1000) / 1000);
  assert.match(proRataNote(c, ytdW)!, /October 2025 counted pro rata, 12 of 31 days/);
  assert.equal(proRataNote(c, presets(c)[2].win), null);
  // share of wallet over 9 months and 12 days
  assert.equal(Math.round(shareOfWallet(totals(c, { prio: "Prio 1" }, ytdW), ytdW, c)! * 10000) / 10000,
    Math.round((13_100 / (120_000 * ((9 + 12 / 31) / 12))) * 10000) / 10000);
});

test("new customers: a first order ever in the window, against the same months a year earlier", () => {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const one = (type: string, firstMonth: number | null): CompanyIn => ({
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, d === "type" ? type : "x")])) as Record<Dim, number>,
    potential: null, months: [months(), months(), months()], firstMonth,
  });
  const c: Cube = {
    generatedAt: "", years: [2026, 2025, 2024], loaded: [9, 12, 12], running: null, labels,
    ...fold([one("OEM", monthOf(0, 2)), one("OEM", monthOf(0, 4)), one("MRO", monthOf(1, 3)), one("OEM", monthOf(1, 9)), one("OEM", null)]),
  };
  const ytd = defaultWindow(c);
  const t = totals(c, {}, ytd);
  assert.equal(t.newC, 2);                 // March and May 2026
  assert.equal(t.newCPy, 1);               // April 2025 - October 2025 is outside Jan-Sep
  assert.deepEqual(sortRows(breakdown(c, "type", {}, ytd), "newC", "type").map((r) => [r.label, r.newC, r.newCPy]), [["OEM", 2, 0], ["MRO", 0, 1]]);
  // the month in progress: last October's new customer counts 12/31
  c.running = { month: monthOf(0, 9), day: 12, days: 31 };
  const y2 = totals(c, {}, presets(c)[0].win);
  assert.equal(Math.round(y2.newCPy * 1000) / 1000, Math.round((1 + 12 / 31) * 1000) / 1000);
});
