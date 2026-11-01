import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, fold, monthOf, potentialBand, totals, newBy, type Cube, type Dim, type Filters, type Win } from "../src/lib/marketingKpis/cube";
import { companiesOf, ledgerOf, type CompanyBy, type LedgerIn } from "../src/lib/marketingKpis/ledger";
import { customerKpis, grr, keptRate, nrr } from "../src/lib/marketingKpis/customerKpis";
import { factsOf, periodOf, prepOf } from "../src/lib/marketingKpis/customerRules";

// The Customer Reports (SARCLA 01.11.2026: "based on what we know, think about what kind of dynamic KPI would be interesting
// here"): every figure worked out from the companies kept beside the cube, and every graph's list of companies adds up to
// its figure - the same rules count both (customerRules.ts).

/** Revenue by month number (0 = January 2024 … 35 = December 2026) -> the read's three years, this year first. */
const years = (byMonth: Record<number, number> = {}) => [2, 1, 0].map((y) => Array.from({ length: 12 }, (_, m) => byMonth[y * 12 + m] ?? 0));
type In = { id: string; name: string; country: string; owner: string; rev?: Record<number, number>; first?: number | null; orders?: [number, number] | null; pc?: Record<string, Record<number, number>> };
function read(list: In[], running: Cube["running"] = null) {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const companies: LedgerIn[] = list.map((c) => {
    const dims: Record<Dim, string> = { prio: "Prio 1", segment: "APSOcore", potential: potentialBand(null), country: c.country, owner: c.owner, type: "OEM", apic: "1.1", mandant: "M100", sae: c.owner };
    const pcYears = (y: number) => Array.from({ length: 12 }, (_, m) => Object.fromEntries(Object.entries(c.pc ?? {}).map(([pc, ms]) => [pc, ms[(2 - y) * 12 + m] ?? 0])));
    return {
      id: c.id, name: c.name, dims: Object.fromEntries(DIMS.map((d) => [d, ix(d, dims[d])])) as Record<Dim, number>, potential: null,
      months: years(c.rev), intake: years(), erp: null, firstInvoiceMonth: c.first ?? null, firstMonth: null, orders: c.orders ?? null,
      pcMonths: [pcYears(0), pcYears(1)],
    };
  });
  const cube: Cube = { generatedAt: "2026-11-01T12:00:00.000Z", years: [2026, 2025, 2024], loaded: [10, 12, 12], running, labels, orderDays: true, ...fold(companies) };
  return { cube, ledger: ledgerOf(cube, companies) };
}
const every = (from: number, to: number, x: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, x]));
const COMPANIES: In[] = [
  // bought every month since January 2024 - a customer from before the three years; Sealing all along, Plastics this year too
  { id: "1", name: "Alpha AG", country: "Switzerland", owner: "Anna", rev: every(0, 33, 1_000), orders: [20100105, 20261020], pc: { dt: every(12, 33, 700), kt: every(24, 33, 300) } },
  // new: its first invoice in March 2026
  { id: "2", name: "Beta GmbH", country: "Germany", owner: "Ben", rev: { 26: 4_000, 30: 2_000 }, first: 26, orders: [20260302, 20260710], pc: { ft: { 26: 4_000, 30: 2_000 } } },
  // February 2025, then April 2026: 13 months without - won back in April (ESO's "reactivated" counted at the period's start
  // would miss it: it bought in the 12 months before January)
  { id: "3", name: "Gamma SA", country: "Switzerland", owner: "Anna", rev: { 13: 800, 27: 900 }, orders: [20180101, 20260415], pc: { dt: { 13: 800, 27: 900 } } },
  // last bought June 2024: left the 12-month customers in June 2025, lost since
  { id: "4", name: "Delta Ltd", country: "Germany", owner: "Ben", rev: { 5: 3_000 }, orders: [20150101, 20240610] },
  // nothing in the three years, last order 2020: lost however long ago (SARCLA 29.10.2026)
  { id: "5", name: "Epsilon AG", country: "Switzerland", owner: "Anna", orders: [20190314, 20200101] },
  // never ordered: in no figure
  { id: "6", name: "Zeta AG", country: "Switzerland", owner: "Anna" },
  // the ERP's carried-over first order (2014), first invoiced May 2026: new then - and never lost before it
  { id: "7", name: "Eta AG", country: "Switzerland", owner: "Anna", rev: { 28: 1_500 }, first: 28, orders: [20140101, 20260510], pc: { st: { 28: 1_500 } } },
  // quiet since February 2026, €5,000 then: at risk
  { id: "8", name: "Theta GmbH", country: "Germany", owner: "Ben", rev: { ...every(14, 20, 2_000), 25: 5_000 }, orders: [20160101, 20260220], pc: { at: { ...every(14, 20, 2_000), 25: 5_000 } } },
  // €10,000 a year ago, €2,000 now: decreasing
  { id: "9", name: "Iota SA", country: "Switzerland", owner: "Anna", rev: { 14: 10_000, 26: 2_000 }, orders: [20170101, 20260301], pc: { dt: { 14: 6_000, 26: 2_000 }, kt: { 14: 4_000 } } },
  // an ERP customer no company carries yet (customers.ts erpOnlyCompanies): counted as any company, never a HubSpot id
  { id: "erp:100-123456", name: "Kappa Sàrl", country: "Germany", owner: "No owner", rev: { 30: 700 }, orders: [20160101, 20260701], pc: { dt: { 30: 700 } } },
];
const { cube, ledger } = read(COMPANIES);
const ytd: Win = { start: monthOf(0, 0), end: monthOf(0, 9) };
const list = (by: CompanyBy, win: Win = ytd, extra: { filters?: Filters; min?: number; cohort?: number | null } = {}) =>
  companiesOf(cube, ledger, { filters: extra.filters ?? {}, win, by, min: extra.min, cohort: extra.cohort, size: 100 });
const names = (by: CompanyBy, win: Win = ytd, extra: { filters?: Filters; min?: number; cohort?: number | null } = {}) => list(by, win, extra).rows.map((r) => r.name).sort();

test("customer base: active, new, won back and lost - lost however long ago, won back after 12 months without", () => {
  const b = customerKpis(cube, ledger, { page: "base", filters: {}, win: ytd }).base!;
  assert.equal(b.total.active, 7);
  assert.equal(b.total.newC, 2);
  assert.deepEqual(names("won"), ["Gamma SA", "Kappa Sàrl"]);
  assert.deepEqual(names("lost"), ["Delta Ltd", "Epsilon AG"]);
  // a year earlier: Delta and Epsilon were lost already - and Kappa, a customer from before the three years with nothing
  // in them until July 2026; nobody was new
  assert.equal(b.total.lostPy, 3);
  assert.equal(b.total.newPy, 0);
  // as the cube counts them
  const t = totals(cube, {}, ytd);
  assert.equal(b.total.active, t.bought);
  assert.equal(b.total.activePy, t.boughtPy);
  assert.equal(b.total.newC, newBy(cube, {}, ytd).get("")!.n);
  // the carried-over 2014 first order does not make Eta a lost customer before its first invoice
  const p = prepOf(ledger);
  assert.equal(factsOf(p, 6, periodOf(cube, ytd)).lostPy, false);
  assert.equal(factsOf(p, 5, periodOf(cube, ytd)).lost, false);
});

test("customer base: every list adds up to its figure - the whole company, a country, a breakdown's value", () => {
  for (const filters of [{}, { country: ["Switzerland"] }, { owner: ["Ben"] }] as Filters[]) {
    const b = customerKpis(cube, ledger, { page: "base", filters, win: ytd }).base!;
    assert.equal(list("cust", ytd, { filters }).total, b.total.active, JSON.stringify(filters));
    assert.equal(list("new", ytd, { filters }).total, b.total.newC);
    assert.equal(list("won", ytd, { filters }).total, b.total.won);
    assert.equal(list("lost", ytd, { filters }).total, b.total.lost);
    assert.equal(list("custlost", ytd, { filters }).total, b.total.active + b.total.lost);
    for (const row of b.by.country) {
      const f = { ...filters, country: [row.label] };
      assert.equal(list("cust", ytd, { filters: f }).total, row.active, row.label);
      assert.equal(list("lost", ytd, { filters: f }).total, row.lost, row.label);
      assert.equal(list("won", ytd, { filters: f }).total, row.won, row.label);
    }
  }
});

test("customer base month by month: new + won back - lost = the change in the customers who bought in the last 12 months", () => {
  const b = customerKpis(cube, ledger, { page: "base", filters: {}, win: ytd }).base!;
  const sum = (f: (m: (typeof b.months)[number]) => number) => b.months.reduce((t, m) => t + f(m), 0);
  assert.equal(b.end12 - b.start12, sum((m) => m.newC + m.won - m.left));
  for (const m of b.months) {
    const one = { start: m.month, end: m.month };
    assert.equal(list("cust", one).total, m.active);
    assert.equal(list("new", one).total, m.newC);
    assert.equal(list("won", one).total, m.won);
    assert.equal(list("left", one).total, m.left);
    // the customers who bought in the 12 months to it: the companies that bought from 11 months before
    assert.equal(list("cust", { start: m.month - 11, end: m.month }).total, m.in12);
  }
  // Gamma came back in April, Kappa in July
  assert.equal(b.months.find((m) => m.month === 27)!.won, 1);
  assert.equal(b.months.find((m) => m.month === 30)!.won, 1);
});

test("revenue concentration: average, median, the top 10% and 20%, the bands - the lists add up", () => {
  const c = customerKpis(cube, ledger, { page: "concentration", filters: {}, win: ytd }).concentration!;
  const active = list("cust");
  assert.equal(c.total.n, active.total);
  assert.equal(c.total.rev, active.sum.rev);
  // Alpha 10,000 · Theta 5,000 · Beta 6,000 · Iota 2,000 · Eta 1,500 · Gamma 900 · Kappa 700: the median is Iota's
  assert.equal(c.total.median, 2_000);
  assert.equal(c.total.top10, 10_000);
  assert.equal(list("top:10").sum.rev, c.total.top10);
  assert.equal(list("top:20").sum.rev, c.total.top20);
  assert.equal(list("top:20").total, 1);
  assert.equal(c.pareto.cy[20], 1);
  c.bands.forEach((b, k) => { assert.equal(list(`band:${k}` as CompanyBy).total, b.n, b.label); assert.equal(list(`band:${k}` as CompanyBy).sum.rev, b.rev); });
  assert.deepEqual(c.top.slice(0, 2).map((t) => t.name), ["Alpha AG", "Beta GmbH"]);
  assert.deepEqual(list("first:2").rows.map((r) => r.name), ["Alpha AG", "Beta GmbH"]);
});

test("cross-selling: one, two, three or more profit centres, the pairs, the cross-sell targets from an amount", () => {
  const x = customerKpis(cube, ledger, { page: "cross", filters: {}, win: ytd, min: 2_500 }).cross!;
  // Alpha DT+KT; Iota only DT this year; everyone else one
  assert.deepEqual([x.total.one, x.total.two, x.total.three], [6, 1, 0]);
  assert.equal(list("pcs:1").total, x.total.one);
  assert.equal(list("pcs:2").total, x.total.two);
  assert.equal(list("pcsany").total, x.total.n);
  assert.equal(list("pcsmany").total, x.total.two + x.total.three);
  assert.equal(x.pairs.find((p) => p.a === "dt" && p.b === "kt")!.n, 1);
  assert.equal(list("pair:dt-kt").total, 1);
  // one profit centre, at least €2,500: Beta (FT 6,000) and Theta (AT 5,000)
  assert.deepEqual(names("single", ytd, { min: 2_500 }), ["Beta GmbH", "Theta GmbH"]);
  assert.equal(x.total.single, 2);
  assert.equal(x.single.find((s) => s.pc === "ft")!.n, list("single:ft", ytd, { min: 2_500 }).total);
  // a year earlier: Iota bought DT and KT
  assert.equal(x.total.py!.two, 1);
});

test("recency and risk: months since the last order, at risk from an amount, decreasing 30% or more - the call lists", () => {
  const r = customerKpis(cube, ledger, { page: "recency", filters: {}, win: ytd, min: 2_500 }).recency!;
  r.total.rec.forEach((n, k) => assert.equal(list(`rec:${k}` as CompanyBy).total, n, `rec:${k}`));
  assert.deepEqual(names("rec:3"), names("lost"));
  assert.deepEqual(names("risk", ytd, { min: 2_500 }), ["Theta GmbH"]);
  assert.equal(r.total.risk, 1);
  assert.equal(r.total.riskRev, 5_000);
  // Iota 10,000 -> 2,000; Theta 14,000 -> 5,000 (at risk too)
  assert.deepEqual(names("down", ytd, { min: 2_500 }), ["Iota SA", "Theta GmbH"]);
  assert.equal(r.total.down, 2);
  assert.equal(r.total.downDrop, 17_000);
  // from €25,000 nobody
  assert.equal(customerKpis(cube, ledger, { page: "recency", filters: {}, win: ytd, min: 25_000 }).recency!.total.risk, 0);
  // the lost list: the latest losses first, the last order before the three years by its day
  const lost = list("lost").rows;
  assert.deepEqual(lost.map((x) => [x.name, x.last]), [["Delta Ltd", "2024-06"], ["Epsilon AG", "2020-01-01"]]);
});

test("retention: net and gross revenue retention, the customer retention rate - by cohort, the lists add up", () => {
  const t = customerKpis(cube, ledger, { page: "retention", filters: {}, win: ytd }).retention!;
  // bought January-October 2025: Alpha, Gamma, Theta, Iota
  assert.deepEqual(names("base"), ["Alpha AG", "Gamma SA", "Iota SA", "Theta GmbH"]);
  assert.equal(t.total.base, 4);
  assert.equal(t.total.kept, list("kept").total);
  assert.equal(t.total.gone, list("gone").total);
  assert.equal(t.total.then, list("base").sum.revPy);
  assert.equal(t.total.now, list("base").sum.rev);
  assert.equal(nrr(t.total), t.total.now / t.total.then);
  assert.ok(grr(t.total)! <= 1);
  assert.equal(keptRate(t.total), 1);
  // all four from before the three years
  assert.deepEqual(t.cohorts.map((c) => c.label), ["Before 2024"]);
  assert.equal(list("base", ytd, { cohort: 0 }).total, 4);
  assert.equal(list("base", ytd, { cohort: 2026 }).total, 0);
});

test("an ERP customer not in HubSpot yet counts like any company, and keeps its own id on the lists", () => {
  const k = list("won").rows.find((r) => r.name === "Kappa Sàrl")!;
  assert.equal(k.id, "erp:100-123456");
  assert.equal(k.rev, 700);
});

test("the month in progress: last year's same month pro rata, as the cube", () => {
  const run = read(COMPANIES, { month: monthOf(0, 9), day: 10, days: 31 });
  const w = { start: monthOf(0, 0), end: monthOf(0, 9) };
  const b = customerKpis(run.cube, run.ledger, { page: "base", filters: {}, win: w }).base!;
  assert.equal(b.total.activePy, totals(run.cube, {}, w).boughtPy);
  const c = customerKpis(run.cube, run.ledger, { page: "concentration", filters: {}, win: w }).concentration!;
  assert.equal(Math.round(c.total.revPy), Math.round(companiesOf(run.cube, run.ledger, { filters: {}, win: w, by: "cust" }).rows.reduce((s, r) => s + r.revPy, 0)));
});
