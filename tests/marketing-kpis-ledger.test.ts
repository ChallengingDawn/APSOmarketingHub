import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, breakdown, defaultWindow, erpTotals, fold, monthOf, potentialBand, totals, type Cube, type Dim, type Filters, type Win } from "../src/lib/marketingKpis/cube";
import { companiesOf, ledgerOf, type LedgerIn } from "../src/lib/marketingKpis/ledger";

// The companies behind a chart (SARCLA 31.10.2026: "allow to see the companies, paginated by 25"): the list a chart opens
// adds up to the chart - the same filters, window and figures as the cube it was folded into.
const months = (pairs: Record<number, number> = {}) => Array.from({ length: 12 }, (_, m) => pairs[m] ?? 0);
type In = { id: string; name: string; dims: Record<Dim, string>; cy?: Record<number, number>; py?: Record<number, number>; oi?: Record<number, number>; oiPy?: Record<number, number>; erp?: number[]; first?: number; pc?: Record<string, Record<number, number>> };
function read(list: In[], running: Cube["running"] = null) {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: LedgerIn[] = list.map((c) => ({
    id: c.id, name: c.name,
    dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, c.dims[d])])) as Record<Dim, number>,
    potential: null,
    months: [months(c.cy), months(c.py), months()],
    intake: [months(c.oi), months(c.oiPy), months()],
    erp: c.erp ?? null,
    firstInvoiceMonth: c.first ?? null,
    pcMonths: c.pc ? [months().map((_, m) => Object.fromEntries(Object.entries(c.pc!).map(([k, v]) => [k, v[m] ?? 0]))), months().map(() => ({}))] : undefined,
  }));
  const cube: Cube = { generatedAt: "2026-10-31T12:00:00.000Z", years: [2026, 2025, 2024], loaded: [9, 12, 12], running, labels, ...fold(companies) };
  return { cube, ledger: ledgerOf(cube, companies) };
}
const co = (id: string, name: string, prio: string, country: string, owner: string, x: Omit<In, "id" | "name" | "dims"> = {}): In => ({
  id, name, dims: { prio, segment: "APSOcore", potential: potentialBand(null), country, owner, type: "OEM", apic: "1.1", mandant: "M100", sae: owner }, ...x,
});
const { cube, ledger } = read([
  co("1", "Alpha AG", "Prio 1", "Switzerland", "Anna", { cy: { 0: 30_000, 5: 30_000 }, py: { 0: 50_000 }, oi: { 0: 10_000, 8: 5_000 }, oiPy: { 1: 4_000 }, erp: [1, 2, 60_000, 50_000, 3, 4, 15_000, 4_000], pc: { dt: { 0: 20_000, 5: 30_000 }, kt: { 0: 10_000 } } }),
  co("2", "Beta GmbH", "Prio 1", "Germany", "Ben", { cy: { 2: 30_000 }, py: { 1: 40_000 }, oi: { 2: 31_000 }, first: monthOf(0, 2) }),
  co("3", "Gamma SA", "Prio 2", "Switzerland", "Anna", { cy: { 4: 3_000 }, py: { 4: 2_000 }, erp: [0, 0, 3_000, 2_000, 0, 0, 0, 0] }),
  co("4", "Delta Ltd", "Prio 3", "Germany", "Ben"),
  co("5", "Epsilon AG", "No priority", "Switzerland", "No owner", { cy: { 1: 500 }, first: monthOf(0, 1) }),
]);
const ytd = defaultWindow(cube);
const sums = (f: Filters, win: Win, by: Parameters<typeof companiesOf>[2]["by"], erp?: "ytd" | "mtd") => companiesOf(cube, ledger, { filters: f, win, by, erp });

test("a list adds up to its chart: revenue, order intake, the buyers - filtered or not", () => {
  for (const f of [{}, { country: ["Switzerland"] }, { prio: ["Prio 1"], owner: ["Ben"] }] as Filters[]) {
    const t = totals(cube, f, ytd);
    const rev = sums(f, ytd, "rev");
    assert.equal(rev.sum.rev, t.rev, JSON.stringify(f));
    assert.equal(rev.sum.revPy, t.revPy);
    assert.equal(sums(f, ytd, "oi").sum.oi, t.oi);
    assert.equal(sums(f, ytd, "cust").total, t.bought);
    assert.equal(sums(f, ytd, "all").total, t.n);
  }
});

test("the largest first, a page of 25, the names on it with their owner, country and priority", () => {
  const p = sums({}, ytd, "rev");
  assert.deepEqual(p.rows.map((r) => r.name), ["Alpha AG", "Beta GmbH", "Gamma SA", "Epsilon AG"]);
  assert.deepEqual({ ...p.rows[1] }, { id: "2", name: "Beta GmbH", owner: "Ben", sae: "Ben", country: "Germany", prio: "Prio 1", rev: 30_000, revPy: 40_000, oi: 31_000, oiPy: 0 });
  // the order intake's own order
  assert.deepEqual(sums({}, ytd, "oi").rows.map((r) => r.name), ["Beta GmbH", "Alpha AG"]);
  // a page at a time
  const second = companiesOf(cube, ledger, { filters: {}, win: ytd, by: "all", size: 2, page: 1 });
  assert.equal(second.total, 5);
  assert.deepEqual(second.rows.map((r) => r.name), ["Gamma SA", "Epsilon AG"]);
});

test("the ERP's year to date, the new customers, one profit centre, a name, the customers chosen", () => {
  const e = erpTotals(cube, {});
  const y = sums({}, ytd, "rev", "ytd");
  assert.equal(y.sum.rev, e.revYtd);
  assert.equal(y.sum.oi, e.oiYtd);
  // the first invoice in the window: as the cube's new customers (by first invoice since 31.10.2026)
  assert.deepEqual(sums({}, { start: monthOf(0, 2), end: monthOf(0, 2) }, "new").rows.map((r) => r.name), ["Beta GmbH"]);
  assert.equal(sums({}, ytd, "new").total, 2);
  const dt = sums({}, ytd, "pc:dt");
  assert.deepEqual([dt.total, dt.sum.rev], [1, 50_000]);
  assert.deepEqual(companiesOf(cube, ledger, { filters: {}, win: ytd, by: "all", q: "ag" }).rows.map((r) => r.name), ["Alpha AG", "Epsilon AG"]);
  assert.deepEqual(companiesOf(cube, ledger, { filters: {}, win: ytd, by: "rev", ids: ["3"] }).rows.map((r) => r.name), ["Gamma SA"]);
});

test("a bar picked: its companies alone; the breakdown's other bars are not on the list", () => {
  const b = breakdown(cube, "country", { country: ["Germany"] }, ytd).find((r) => r.label === "Germany")!;
  const p = sums({ country: ["Germany"] }, ytd, "rev");
  assert.equal(p.sum.rev, b.rev);
  assert.ok(p.rows.every((r) => r.country === "Germany"));
});

test("the month in progress: last year's same month pro rata, as the charts", () => {
  const run = read([co("1", "Alpha AG", "Prio 1", "Switzerland", "Anna", { cy: { 9: 1_000 }, py: { 9: 3_100 } })], { month: monthOf(0, 9), day: 10, days: 31 });
  const w = { start: monthOf(0, 9), end: monthOf(0, 9) };
  const p = companiesOf(run.cube, run.ledger, { filters: {}, win: w, by: "rev" });
  assert.equal(p.sum.revPy, Math.round(totals(run.cube, {}, w).revPy));
  assert.equal(p.sum.revPy, 1_000);
});
