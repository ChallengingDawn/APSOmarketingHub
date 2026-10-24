import assert from "node:assert/strict";
import { test } from "node:test";
import { asOfOf, booksOf, monthsOfSeries, oiLoaded, type CompanyIn } from "../src/lib/reporting/esoFiguresRules";

const blob = (m: Record<string, Record<string, number>>) => JSON.stringify(m);
const names = new Map([["29117550", { name: "Jeremy Borey", active: true }], ["1202569408", { name: "TSA Team", active: true }]]);

test("the ERP's day: the most common erp_rev_as_of, a straggler from an older file does not move it", () => {
  assert.equal(asOfOf([{ erp_rev_as_of: "2026-10-23" }, { erp_rev_as_of: "2026-10-23T05:00:00Z" }, { erp_rev_as_of: "2026-09-30" }, { erp_rev_as_of: "" }]), "2026-10-23");
  assert.equal(asOfOf([{}]), null);
});

test("a person's figures: the months before the running one from the monthly loads, the running month the ERP's month-to-date for both years, ESO/TSA by the rosters", () => {
  const companies: CompanyIn[] = [
    // an ESO rep's customer: Jan-Sep from the blob, October = MTD
    { hubspot_owner_id: "29117550", erp_rev_mtd_cy: "100", erp_rev_mtd_py: "80", erp_rev_ytd_cy: "1100", erp_rev_ytd_py: "900", erp_oi_mtd_cy: "50", erp_oi_mtd_py: "40", erp_oi_ytd_cy: "1000", erp_oi_ytd_py: "800",
      rev_2026_pc_monthly: blob({ jan: { DT: 600, KT: 400 }, oct: { DT: 999 } }), rev_2025_pc_monthly: blob({ jan: { DT: 820 }, oct: { DT: 2000 } }), oi_2026_jan: "900", oi_2025_jan: "760" },
    { hubspot_owner_id: "29117550", erp_rev_ytd_cy: "10" },
    // the TSA Team's
    { hubspot_owner_id: "1202569408", erp_rev_ytd_cy: "5", erp_rev_mtd_cy: "5" },
    // someone outside both rosters, and no owner
    { hubspot_owner_id: "999", erp_rev_ytd_cy: "7" },
    { hubspot_owner_id: "", erp_rev_ytd_cy: "3" },
  ];
  const books = booksOf(companies, 2026, 10, names);
  const jb = books.find((b) => b.id === "29117550")!;
  assert.equal(jb.team, "ESO");
  assert.equal(jb.name, "Jeremy Borey");
  assert.equal(jb.companies, 2);
  assert.deepEqual(jb.rev.ytd, { cy: 1110, py: 900 });
  assert.deepEqual(jb.rev.months[0], { cy: 1000, py: 820 });
  // the running month is the ERP's MTD (cut on the same day), never the blob's month (999 / a full 2000 last year)
  assert.deepEqual(jb.rev.months[9], { cy: 100, py: 80 });
  assert.deepEqual(jb.oi.months[0], { cy: 900, py: 760 });
  assert.deepEqual(jb.oi.months[9], { cy: 50, py: 40 });
  assert.deepEqual(jb.rev.months[10], { cy: 0, py: 0 });
  assert.equal(books.find((b) => b.id === "1202569408")!.team, "TSA");
  assert.equal(books.find((b) => b.id === "999")!.team, "Other");
  assert.equal(books.find((b) => b.id === "999")!.name, "Owner 999");
  const none = books.find((b) => b.id === "")!;
  assert.equal(none.team, "None");
  assert.equal(none.name, "No owner");
  // largest revenue first
  assert.equal(books[0].id, "29117550");
});

test("a KPI series per month, this year and last - the forecast is this year's only", () => {
  const rows = [
    { year: 2026, month: 1, value: 10 }, { year: 2026, month: 1, value: 5 }, { year: 2025, month: 1, value: 7 },
    { year: 2024, month: 1, value: 99 }, { year: 2026, month: null, value: 1 }, { year: 2026, month: 12, value: 3 },
  ];
  const m = monthsOfSeries(rows, 2026);
  assert.deepEqual(m[0], { cy: 15, py: 7 });
  assert.deepEqual(m[11], { cy: 3, py: 0 });
  assert.equal(m.reduce((s, x) => s + x.cy + x.py, 0), 25);
});

test("order intake loaded per company: the months before the running one holding 60% of last year's", () => {
  const books = booksOf([{ hubspot_owner_id: "29117550", oi_2026_jan: "100", oi_2025_jan: "100", oi_2026_feb: "50", oi_2025_feb: "100", oi_2026_mar: "100", oi_2025_mar: "100" }], 2026, 10, names);
  assert.equal(oiLoaded(books, 10), 1);
  assert.equal(oiLoaded(books, 1), 0);
});
