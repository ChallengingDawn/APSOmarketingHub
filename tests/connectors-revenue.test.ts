import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readRollup } from "../src/lib/connectors/steps/revenueCsv";
import {
  addHistoryCompany, addMonthlyCompany, addRollupRow, aliasMap, compareYears, countryIso, countryName, customerTotal,
  deltaRows, erpYearTotal, finishMonthly, geoMonthlyRows, historyRows, historyYears, keysToLookUp, kpiPlan,
  mergeReviewQueue, newHistoryAcc, newMonthlyAcc, newRollup, oiMonthlyRows, oiSeriesFromErp, pcLabel,
  planRevenueWrites, propRules, propsHash, pyFloat, pyFloatRepr, pyInt, pyJsonLoads, pyRound, pySum,
  revenueMonthlyRows, revenueProps, type KpiRow, type RollupRow,
} from "../src/lib/connectors/steps/revenueRules";

/* ── Python's arithmetic ───────────────────────────────────────────────── */

test("round: the exact binary value, ties to even, sign kept - as Python 3", () => {
  assert.equal(pyRound(2.675, 2), 2.67); // 2.67499999… in binary
  assert.equal(pyRound(1.005, 2), 1); // 1.00499999…
  assert.equal(pyRound(0.125, 2), 0.12); // an exact tie -> even
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(-0.005, 2), -0.01);
  assert.ok(Object.is(pyRound(-0.001, 2), -0));
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(3.5), 4);
  assert.equal(pyRound(1234567.891, 1), 1234567.9);
  assert.equal(pyRound(-3.125, 1), -3.1);
});

test("sum: compensated like Python 3.12, empty is 0", () => {
  assert.equal(pySum(new Array(10).fill(0.1)), 1); // a plain loop gives 0.9999999999999999
  assert.equal(pySum([1e100, 1, -1e100]), 1);
  assert.equal(pySum([]), 0);
});

test("float / int: what Python accepts, null where it raises", () => {
  assert.equal(pyFloat("1_000.5"), 1000.5);
  assert.equal(pyFloat(" 12.5 "), 12.5);
  assert.equal(pyFloat("1."), 1);
  assert.equal(pyFloat(".5"), 0.5);
  assert.equal(pyFloat(true), 1);
  assert.equal(pyFloat("-inf"), -Infinity);
  assert.ok(Number.isNaN(pyFloat("nan")));
  for (const bad of ["", " ", "12,5", "1_", "abc", null, undefined]) assert.equal(pyFloat(bad), null, String(bad));
  assert.equal(pyInt(" 2025 "), 2025);
  assert.equal(pyInt("7.0"), null);
  assert.equal(pyInt(undefined), null);
});

test("repr: floats written the way json.dumps writes them", () => {
  assert.equal(pyFloatRepr(99), "99.0");
  assert.equal(pyFloatRepr(1234.5), "1234.5");
  assert.equal(pyFloatRepr(1e16), "1e+16");
  assert.equal(pyFloatRepr(1.5e-5), "1.5e-05");
  assert.equal(pyFloatRepr(0.0001), "0.0001");
  assert.equal(pyFloatRepr(-0), "-0.0");
  assert.equal(pyFloatRepr(123456789.12), "123456789.12");
  assert.equal(pyFloatRepr(-1234567890123456800), "-1.2345678901234568e+18");
});

test("json: a blob keeps its keys in file order, NaN reads, broken JSON throws", () => {
  const m = pyJsonLoads('{"dt": 1, "100": 2}') as Map<string, unknown>;
  assert.deepEqual([...m.keys()], ["dt", "100"]); // JSON.parse would put "100" first
  assert.ok(Number.isNaN((pyJsonLoads('{"a": NaN}') as Map<string, number>).get("a")!));
  const d = pyJsonLoads('{"a": 1, "b": 2, "a": 3}') as Map<string, number>;
  assert.deepEqual([...d], [["a", 3], ["b", 2]]);
  for (const bad of ['{"a": 1,}', "{'a': 1}", '{"a": 01}', '{"a": 1} x', ""]) assert.throws(() => pyJsonLoads(bad), bad);
});

/* ── countries ─────────────────────────────────────────────────────────── */

test("countries: both spellings fold to ISO-2, an unknown name keeps two letters", () => {
  assert.equal(countryIso("CH"), "CH");
  assert.equal(countryIso("ch"), "CH");
  assert.equal(countryIso("Switzerland"), "CH");
  assert.equal(countryIso(" the netherlands "), "NL");
  assert.equal(countryIso("Schweiz"), "SC");
  assert.equal(countryIso(""), "XX");
  assert.equal(countryIso(null), "XX");
  assert.equal(countryName("CH"), "Switzerland");
  assert.equal(countryName("QQ"), "QQ");
});

/* ── the rollup ────────────────────────────────────────────────────────── */

const row = (CompanyNumber: string, CustomerNumberUnique: string, InvoiceYear: string, InvoiceMonth: string, NetRevenueEUR: string, ProfitCenter: string, OI_NetRevenueEUR = ""): RollupRow =>
  ({ CompanyNumber, CustomerNumberUnique, InvoiceYear, InvoiceMonth, NetRevenueEUR, ProfitCenter, OI_NetRevenueEUR });

const ROWS: RollupRow[] = [
  row("100", "100-1", "2025", "1", "1000", "dt", "5"),
  row("100", "100-1", "2025", "1", "200", "PW"),
  row("100", "100-1", "2025", "1", "0.5", "dt"),
  row("110", "100-1", "2025", "2", "50", "ws"),
  row("100", "100-1", "2025", "4", "10", ""),
  row("100", "100-1", "2026", "3", "7.5", " KT "),
  row("120", "100-1", "2025", "1", "999", "dt"), // another mandant
  row("100", "", "2025", "1", "999", "dt"), // no customer
  row("100", "100-1", "2025", "13", "999", "dt"), // no such month
  row("100", "100-1", "x", "1", "999", "dt"), // no year
  row("100", "100-1", "2025", "1", "12,5", "dt"), // not a number to Python
];

test("rollup: mandant 100/110 only, buckets, quarters, the monthly JSON, months absent stay absent", () => {
  const acc = newRollup();
  for (const r of ROWS) addRollupRow(acc, r);
  assert.equal(acc.rows, 6);
  const years = acc.agg.get("100-1")!;
  const p = revenueProps(years, acc.oagg.get("100-1"), false);
  assert.equal(p.rev_2025_jan, 1200.5);
  assert.equal(p.rev_2025_jan_pc_dt, 1000.5);
  assert.equal(p.rev_2025_jan_pc_other, 200); // pw -> other
  assert.equal(p.rev_2025_feb_pc_other, 50); // ws -> other
  assert.equal(p.rev_2025_apr_pc_other, 10); // no profit centre -> unknown -> other
  assert.equal(p.rev_2025_q1, 1250.5);
  assert.equal(p.rev_2025_q1_pc_dt, 1000.5);
  assert.equal(p.rev_2025_q1_pc_other, 250);
  assert.equal(p.rev_2025_q1_pc_at, 0);
  assert.equal(p.rev_2025_q2, 10);
  assert.equal(p.rev_2025_q4, 0);
  assert.equal(p.revenue_2025, 1260.5);
  assert.equal(p.rev_2025_pc_monthly, '{"jan": {"dt": 1000.5, "pw": 200.0}, "feb": {"ws": 50.0}, "apr": {"unknown": 10.0}}');
  assert.equal(p.rev_2026_pc_monthly, '{"mar": {"kt": 7.5}}');
  assert.equal(p.rev_2025_mar, undefined); // the connector never zeroes a month the file lacks
  assert.equal(Object.keys(p).filter((k) => k.includes("2025")).length, 37);
  assert.equal(Object.keys(p).filter((k) => k.startsWith("oi_")).length, 0);
  assert.equal(customerTotal(years), 1268);
});

test("rollup: order intake only with OI_FROM_CSV, and an unreadable OI stops the load", () => {
  const acc = newRollup();
  for (const r of ROWS) addRollupRow(acc, r);
  const p = revenueProps(acc.agg.get("100-1")!, acc.oagg.get("100-1"), true);
  assert.equal(p.oi_2025_jan, 5);
  assert.equal(p.oi_2025_feb, 0);
  assert.equal(p.oi_2025, 5);
  assert.throws(() => addRollupRow(newRollup(), row("100", "100-1", "2025", "1", "1", "dt", "abc"), 7), /record 7/);
});

test("csv: ';', a UTF-8 BOM and CRLF read like the connector's DictReader", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rev-"));
  try {
    const f = join(dir, "revenue_oi_rollup.csv");
    const head = "CompanyNumber;CustomerNumberUnique;InvoiceYear;InvoiceMonth;NetRevenueEUR;OI_NetRevenueEUR;ProfitCenter";
    const lines = ROWS.map((r) => [r.CompanyNumber, r.CustomerNumberUnique, r.InvoiceYear, r.InvoiceMonth, r.NetRevenueEUR, r.OI_NetRevenueEUR, r.ProfitCenter].join(";"));
    writeFileSync(f, `﻿${[head, ...lines.slice(0, 3), "", ...lines.slice(3)].join("\r\n")}\r\n`, "utf8");
    const got = await readRollup(f);
    assert.equal(got.rows, 6);
    assert.equal(got.lines, ROWS.length);
    const want = newRollup();
    for (const r of ROWS) addRollupRow(want, r);
    assert.deepEqual(revenueProps(got.agg.get("100-1")!, got.oagg.get("100-1"), true), revenueProps(want.agg.get("100-1")!, want.oagg.get("100-1"), true));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ── matching, the review queue, what may be written ───────────────────── */

test("writes: resolutions alias, a key on two customers gets the later, unchanged hashes skip, calculated and unknown left out", () => {
  const acc = newRollup();
  addRollupRow(acc, row("100", "100-1", "2025", "1", "10", "dt"));
  addRollupRow(acc, row("100", "100-9", "2025", "1", "20", "dt"));
  addRollupRow(acc, row("100", "100-2", "2025", "1", "30", "dt"));
  addRollupRow(acc, row("100", "100-3", "2025", "2", "40", "dt"));
  addRollupRow(acc, row("100", "100-5", "2025", "1", "50", "dt"));
  const queue = [
    { type: "revenue", un: "100-9", status: "resolved", resolved_un: "100-1" },
    { type: "revenue", un: "100-3", status: "resolved", resolved_un: "100-4" },
  ];
  const alias = aliasMap(queue);
  const map = new Map([["100-1", "11"], ["100-5", "55"]]);
  assert.deepEqual(keysToLookUp(acc, alias, map), ["100-2", "100-4"]);
  const rules = propRules([
    ...["rev_2025_jan", "rev_2025_jan_pc_dt", "rev_2025_pc_monthly", "revenue_2025", "rev_2025_feb", "rev_2025_feb_pc_dt"].map((name) => ({ name })),
    { name: "rev_2025_q1", calculated: true },
    { name: "rev_2025_q2", fieldType: "calculation_equation" },
  ]);
  const p55 = planRevenueWrites(acc, alias, map, false, rules, new Map()).ups.get("55")!;
  const plan = planRevenueWrites(acc, alias, map, false, rules, new Map([["55", p55.hash]]));
  assert.deepEqual([...plan.ups.keys()], ["11"]);
  assert.equal(plan.ups.get("11")!.un, "100-9");
  assert.equal(plan.ups.get("11")!.props.rev_2025_jan, 20);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.shared, 1);
  assert.deepEqual(plan.unmatched.map((u) => [u.un, u.revenue_eur, u.years]), [["100-2", 30, [2025]], ["100-3", 40, [2025]]]);
  assert.ok(plan.skipped.calculated.has("rev_2025_q1") && plan.skipped.calculated.has("rev_2025_q2"));
  assert.ok(plan.skipped.unknown.has("rev_2025_q3"));
  assert.equal(plan.ups.get("11")!.props.rev_2025_q1, undefined);

  const merged = mergeReviewQueue(queue, plan.unmatched, 1_760_000_000);
  assert.equal(merged.added, 1);
  assert.equal(merged.resurfaced, 1);
  assert.deepEqual(merged.queue[2], { type: "revenue", un: "100-2", revenue_eur: 30, years: [2025], status: "pending", ts: 1_760_000_000 });
  assert.equal(merged.queue[1].status, "pending");
  assert.equal(merged.queue[1].note, "resolution '100-4' not found in HubSpot");
  assert.equal(queue[1].status, "resolved"); // the input is not touched
  // a pending item stays as it is
  assert.equal(mergeReviewQueue(merged.queue, plan.unmatched, 1).added, 0);
});

test("hash: the same properties in another order hash the same", () => {
  assert.equal(propsHash({ a: 1, b: "x" }), propsHash({ b: "x", a: 1 }));
  assert.notEqual(propsHash({ a: 1 }), propsHash({ a: 2 }));
  const r = propRules([{ name: "y", modificationMetadata: { readOnlyValue: true } }, { name: "z" }]);
  assert.ok(r.readOnly.has("y") && !r.readOnly.has("z") && r.known.has("z"));
});

/* ── the monthly figures and their KPI rows ────────────────────────────── */

function monthlyDoc(today: string) {
  const acc = newMonthlyAcc(compareYears(today));
  addMonthlyCompany(acc, { company_unique_number: "100-5", country: "Switzerland", rev_2025_pc_monthly: '{"jan": {"dt": 100, "kt": 50}, "feb": {"dt": 10}}', rev_2026_pc_monthly: '{"jan": {"dt": 120}}' });
  addMonthlyCompany(acc, { company_unique_number: "110-7", country: "DE", rev_2026_pc_monthly: '{"jan": {"dt": "30"}, "February": {"st": 5}}' });
  addMonthlyCompany(acc, { company_unique_number: "", country: "", rev_2025_pc_monthly: "not json", rev_2026_pc_monthly: "{}" });
  return finishMonthly(acc, today, "t");
}

test("monthly: series, profit centres, country by mandant, finished months, like for like", () => {
  const doc = monthlyDoc("2026-03-15");
  assert.equal(doc.scanned, 3);
  assert.equal(doc.blobs, 3);
  assert.deepEqual(doc.series["2025"].slice(0, 3), [150, 10, 0]);
  assert.deepEqual(doc.series["2026"].slice(0, 3), [150, 5, 0]);
  assert.deepEqual(doc.by_profit_centre["2026"], { dt: 150, st: 5 });
  assert.equal(doc.complete_months, 2);
  assert.deepEqual(doc.like_for_like, { months: 2, prev: 160, cur: 155, pct: -3.1 });
  assert.deepEqual(doc.geo.map((g) => [g.mandant, g.country, g.year, g.month, g.value]), [
    ["100", "CH", 2025, 1, 150], ["100", "CH", 2025, 2, 10], ["100", "CH", 2026, 1, 120], ["110", "DE", 2026, 1, 30], ["110", "DE", 2026, 2, 5],
  ]);
  assert.equal(doc.geo[0].entity, "APSOparts AG (CH)");
  assert.equal(doc.geo[0].country_name, "Switzerland");
});

test("kpi rows: the years follow the clock, labels and comparable flags as the report reads them", () => {
  assert.deepEqual(compareYears("2027-01-05"), [2026, 2027]);
  const doc = monthlyDoc("2026-03-15");
  const rows = revenueMonthlyRows(doc);
  assert.equal(rows.length, 24);
  assert.deepEqual(rows[0].props, {
    name: "revenue_monthly|2025-01", kpi_category: "revenue_monthly", metric_name: "revenue_sum", metric_value: 150,
    snapshot_date: "2025-01-01", kpi_year: 2025, kpi_month_label: "01 January", kpi_comparable: "yes",
  });
  assert.equal(rows[2].props.kpi_comparable, "no");
  // as the connector: no finished month reads as twelve (reported, not changed)
  assert.ok(revenueMonthlyRows({ ...doc, complete_months: 0 }).every((r) => r.props.kpi_comparable === "yes"));
  const geo = geoMonthlyRows(doc);
  assert.equal(geo[0].name, "revenue_geo|100|CH|2025-01");
  assert.equal(geo[0].props.kpi_country, "Switzerland");
  assert.equal(geo[0].props.kpi_entity, "APSOparts AG (CH)");
  const oi = oiSeriesFromErp([
    { kpi_year: "2026", kpi_month_label: "02 February", metric_value: "12.5" },
    { kpi_year: "2026.0", kpi_month_label: "01 January", metric_value: "" },
    { kpi_year: null, kpi_month_label: "03 March", metric_value: "9" },
  ])!;
  assert.deepEqual(oi["2026"].slice(0, 3), [0, 12.5, 0]);
  assert.equal(oiSeriesFromErp([]), null);
  const oiRows = oiMonthlyRows(oi, "2026-03-15");
  assert.equal(oiRows[1].name, "oi_monthly|2026-02");
  assert.equal(oiRows[1].props.metric_name, "order_intake_sum");
  assert.equal(oiRows[1].props.kpi_comparable, "yes");
  assert.equal(oiRows[2].props.kpi_comparable, "no");
});

test("delta: finished months only, by month and by country; January writes and archives nothing", () => {
  const d = deltaRows(monthlyDoc("2026-03-15"), "2026-03-15");
  assert.equal(d.months, 2);
  assert.deepEqual(d.byMonth.map((r) => [r.name, r.props.metric_value]), [["revenue_delta|2026-01", 0], ["revenue_delta|2026-02", -5]]);
  assert.deepEqual(d.byCountry!.map((r) => [r.name, r.props.metric_value, r.props.kpi_country, r.props.kpi_month_label]), [
    ["revenue_delta_country|CH", -40, "Switzerland", "Jan-Feb"],
    ["revenue_delta_country|DE", 35, "Germany", "Jan-Feb"],
  ]);
  const jan = deltaRows(monthlyDoc("2026-01-10"), "2026-01-10");
  assert.equal(jan.months, 0);
  assert.equal(jan.byMonth.length, 0);
});

test("kpi plan: update by name, create the rest, archive only for a series that sweeps", () => {
  const r = (name: string): KpiRow => ({ name, props: { name } });
  const have = new Map([["a", "1"], ["b", "2"], ["z", "9"]]);
  const p = kpiPlan(have, [r("a"), r("c")], true);
  assert.deepEqual(p.update.map((u) => u.id), ["1"]);
  assert.deepEqual(p.create.map((c) => c.name), ["c"]);
  assert.deepEqual(p.archive, ["2", "9"]);
  assert.deepEqual(kpiPlan(have, [r("a")], false).archive, []);
});

/* ── twelve years and the cohorts ──────────────────────────────────────── */

function historyAcc() {
  const today = "2026-10-08";
  const acc = newHistoryAcc(historyYears(today), today);
  // first order this year: new in March; October 7 months later is not a return
  addHistoryCompany(acc, { country: "CH", compass_first_order_year: "2026", rev_2026_pc_monthly: '{"mar": {"dt": 100}, "oct": {"dt": 5}}' });
  // 13 months of silence (Dec 2023 -> Jan 2025): reactivated
  addHistoryCompany(acc, { country: "Germany", compass_first_order_year: "2019", rev_2023_pc_monthly: '{"dec": {"kt": 50}}', rev_2025_pc_monthly: '{"jan": {"kt": 10}}' });
  // nothing earlier in the blobs but the ERP says it started in 2024: reactivated, not new
  addHistoryCompany(acc, { country: "IT", compass_first_order_year: "2024.0", rev_2025_pc_monthly: '{"feb": {"ST": 20}}' });
  // 12 months is not a gap
  addHistoryCompany(acc, { country: "", rev_2024_pc_monthly: '{"jan": {"dt": 1}}', rev_2025_pc_monthly: '{"jan": {"dt": 2}}' });
  // a blob that is "{}" counts as history, a credit-only month is not activity
  addHistoryCompany(acc, { country: "FR", rev_2026_pc_monthly: "{}", rev_2025_pc_monthly: '{"may": {"dt": -4}}' });
  return acc;
}

test("history: new, reactivated after 13+ months, the ERP's first year decides a first month", () => {
  const acc = historyAcc();
  assert.equal(acc.seen, 5);
  assert.equal(acc.withblob, 5);
  assert.deepEqual([...acc.neu.values()], [{ y: 2026, m0: 2, n: 1 }]);
  assert.deepEqual([...acc.react.values()], [{ y: 2025, m0: 0, n: 1 }, { y: 2025, m0: 1, n: 1 }]);
  assert.equal(acc.byYear.get(2026), 105);
  assert.equal(acc.byWindow.get(2026), 105);
  assert.deepEqual([...acc.newcustRev.values()].map((c) => [c.y, c.mi, c.v]), [[2026, 3, 100], [2026, 10, 5]]);
});

test("history rows: labels never hold a date, the window lives in kpi_window, the ERP aligns the running year", () => {
  const plan = historyRows(historyAcc(), null);
  const cat = (c: string) => new Map(plan.categories.find((x) => x.cat === c)!.rows.map((r) => [r.name, r.props]));
  const year = cat("revenue_year");
  assert.deepEqual(year.get("revyear|full|2026"), { name: "revyear|full|2026", kpi_category: "revenue_year", metric_name: "revenue_sum", metric_value: 105, snapshot_date: "2026-12-01", kpi_year: 2026, kpi_month_label: "13 Full year", kpi_comparable: "no" });
  assert.equal(year.get("revyear|ytd|2026")!.kpi_window, "Jan-Oct (partial)");
  assert.equal(year.get("revyear|ytd|2026")!.kpi_month_label, "00 YTD");
  assert.equal(year.get("revyear|top|2026")!.kpi_window, "Jan-Oct");
  assert.equal(year.get("revyear|top|2023")!.kpi_window, "Full year");
  assert.equal(cat("revenue_pc_year").get("revpcyear|st|2025")!.kpi_profit_center, "Antivibration Technology (ST)");
  const geo = cat("revenue_geo_pc_yearly").get("revgeopc|DE|kt|2025")!;
  assert.equal(geo.kpi_window, "Jan-Sep");
  assert.equal(geo.kpi_country, "Germany");
  const nc = cat("newcust_revenue_monthly");
  assert.equal(nc.get("newcustrev|2026-10")!.kpi_period, "MTD");
  assert.equal(nc.get("newcustrev|2026-10")!.kpi_comparable, "no");
  assert.equal(nc.get("newcustrev|2026-03")!.kpi_period, "past");
  assert.equal(cat("newcust_monthly").get("newcust|2026-03")!.metric_value, 1);
  assert.equal(cat("reactivated_monthly").get("react|2025-01")!.metric_name, "reactivated_customers_count");
  assert.deepEqual(plan.categories.map((c) => [c.cat, c.sweep]), [
    ["revenue_year", true], ["revenue_pc_year", false], ["revenue_geo_pc_yearly", false],
    ["newcust_revenue_monthly", true], ["newcust_monthly", false], ["reactivated_monthly", false],
  ]);
  const aligned = historyRows(historyAcc(), 999);
  assert.deepEqual(aligned.erpAlignment, { blobs: 105, erp: 999 });
  assert.equal(aligned.categories[0].rows.find((r) => r.name === "revyear|full|2026")!.props.metric_value, 999);
});

test("history helpers: profit-centre labels, the ERP's year total", () => {
  assert.equal(pcLabel("dt"), "Sealing Technology (DT)");
  assert.equal(pcLabel("zz"), "ZZ (ZZ)");
  assert.equal(erpYearTotal(["1.5", "2"]), 3.5);
  assert.equal(erpYearTotal(["x"]), null);
  assert.equal(erpYearTotal([null]), null);
  assert.equal(erpYearTotal([]), null);
  assert.equal(historyYears("2026-10-08").length, 12);
});
