import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ErpLinesSheet, LATE_BANDS, addWd, dayOf, onTime, otdSum, priceSum, summarizeErpLines, transitOf, wdAfter, type ErpLine,
} from "../src/lib/reporting/boErpLines";

test("erp lines: the ERP's transport time per country, its names and its default", () => {
  assert.equal(transitOf("Switzerland"), 1);
  assert.equal(transitOf("Germany"), 2);
  assert.equal(transitOf("Italy"), 4);
  assert.equal(transitOf("The Netherlands"), 2); // the BI model's name for the ERP's "Netherlands"
  assert.equal(transitOf("Great Britain"), 4);
  assert.equal(transitOf("Atlantis"), 6); // the table's "ZZ unbekannt"
});

test("erp lines: working days and days from the cells", () => {
  assert.equal(addWd("2026-10-02", 1), "2026-10-05"); // Friday + 1 = Monday
  assert.equal(addWd("2026-10-05", 2), "2026-10-07");
  assert.equal(wdAfter("2026-10-02", "2026-10-06"), 2);
  assert.equal(wdAfter("2026-10-06", "2026-10-02"), 0);
  assert.equal(dayOf(new Date(Date.UTC(2026, 9, 2))), "2026-10-02");
  assert.equal(dayOf(46297), "2026-10-02");
  assert.equal(dayOf("2026-10-02T11:23:13"), "2026-10-02");
  assert.equal(dayOf("02.10.2026 00:00:00"), "2026-10-02");
  assert.equal(dayOf(null), "");
  assert.equal(dayOf("not a date"), "");
});

test("erp lines: the sheet - the header found by its names, one line per order line", () => {
  const s = new ErpLinesSheet();
  s.feed(1, ["a title row", null]);
  s.feed(2, ["[Company]", "[Order]", "[ShippingDateInitial]", "[PriceSource]", "[Line]", "[OrderDate]"]);
  s.feed(3, [100, "A26.1.000", new Date(Date.UTC(2026, 9, 5)), "manually", 10, new Date(Date.UTC(2026, 9, 2))]);
  s.feed(4, [100, "A26.1.000", new Date(Date.UTC(2026, 9, 5)), "manually", 10, new Date(Date.UTC(2026, 9, 2))]);
  s.feed(5, [100, "A26.1.000", new Date(Date.UTC(2026, 9, 5)), "automatically", 20, new Date(Date.UTC(2026, 9, 2))]);
  s.feed(6, [null, null, null, null, null, null]);
  const r = s.finish()!;
  assert.equal(r.rows, 3);
  assert.deepEqual(r.lines.map((l) => [l.company, l.order, l.line, l.price, l.firstDay, l.orderDay, l.country]), [
    ["100", "A26.1.000", "10", "manually", "2026-10-05", "2026-10-02", ""],
    ["100", "A26.1.000", "20", "automatically", "2026-10-05", "2026-10-02", ""],
  ]);
  const none = new ErpLinesSheet();
  none.feed(1, ["Order", "Something else"]);
  assert.equal(none.finish(), null);
});

const L = (o: Partial<ErpLine>): ErpLine => ({
  company: "100", order: "A26.1.000", source: "eShop", orderDay: "2026-10-01", status: "invoiced", shipDay: "2026-10-02", country: "Switzerland",
  line: "10", lineType: "Order", price: "automatically", firstDay: "2026-10-05", confDay: "2026-10-05", article: "1", artType: "Standard", pc: "DT", ...o,
});

test("erp lines: on time = shipped plus the transport time by the first date", () => {
  assert.equal(onTime({ shipDay: "2026-10-02", firstDay: "2026-10-05", country: "Switzerland" }), true); // Fri + 1 wd = Mon
  assert.equal(onTime({ shipDay: "2026-10-02", firstDay: "2026-10-05", country: "Germany" }), false); // Fri + 2 wd = Tue
  assert.equal(onTime({ shipDay: "2026-10-01", firstDay: "2026-10-05", country: "Germany" }), true);
});

test("erp lines: the pass rate, the manual prices and OTD counted as the Back Office counts them", () => {
  const lines = [
    L({ line: "10" }),
    L({ line: "20", price: "manually", country: "Germany", artType: "Special", pc: "KT", confDay: "2026-10-09" }), // late 1 wd, pushed
    L({ line: "30", price: "calculated" }),
    L({ line: "40", artType: "Service", price: "manually" }), // a service: neither the price figures nor OTD
    L({ line: "50", source: "manually entered" }), // not a web order
    L({ line: "60", company: "120" }), // another mandant
    L({ line: "70", status: "entered", shipDay: "" }), // not shipped: the price counts, OTD not yet
    L({ line: "80", company: "110", orderDay: "2026-09-30", firstDay: "2026-09-29", confDay: "2026-09-29", shipDay: "2026-10-05", country: "Italy", price: "manually" }), // late
    L({ line: "90", lineType: "CreditNote" }),
  ];
  const k = summarizeErpLines(lines, "2026-11-07");
  assert.equal(k.lines, 9);
  assert.deepEqual(k.price["100"]["2026-10"], [4, 1, 2, 1]); // 10, 20, 30, 70 - lines, manually, automatically, calculated
  assert.deepEqual(k.price["110"]["2026-09"], [1, 1, 0, 0]);
  assert.deepEqual(priceSum(k, "100", ["2026-09", "2026-10"]), [4, 1, 2, 1]);
  assert.deepEqual(k.otd["100"]["2026-10"], { "S|DT": [2, 2, 0], "P|KT": [1, 0, 1] }); // 10 and 30 on time, 20 late and pushed
  assert.deepEqual(k.otd["110"]["2026-09"], { "S|DT": [1, 0, 0] });
  assert.deepEqual(otdSum(k, ["2026-09", "2026-10"]), [4, 2, 1]);
  assert.deepEqual(otdSum(k, ["2026-10"], { type: "P" }), [1, 0, 1]);
  assert.deepEqual(otdSum(k, ["2026-10"], { pc: "DT", mandant: "100" }), [2, 2, 0]);
  assert.deepEqual(k.country["2026-10"], { Switzerland: [2, 2], Germany: [1, 0] });
  assert.equal(LATE_BANDS.length, k.late["2026-10"].length);
  assert.deepEqual(k.late["2026-10"], [1, 0, 0, 0, 0, 0]);
  // Italy: shipped Mon 05.10 + 4 wd = Fri 09.10, first date Tue 29.09 - 8 working days late
  assert.deepEqual(k.late["2026-09"], [0, 0, 0, 0, 1, 0]);
  assert.deepEqual(k.lateRows.map((r) => [r[0], r[2], r[3], r[5], r[6], r[8]]), [
    ["A26.1.000", "Germany", "2026-10-05", 1, "P", "100"],
    ["A26.1.000", "Italy", "2026-09-29", 8, "S", "110"],
  ]);
  assert.equal(k.from, "2026-09");
  assert.equal(k.to, "2026-10");
  assert.equal(k.skipped["not eShop"], 1);
  assert.equal(k.skipped["another mandant"], 1);
  assert.equal(k.skipped["not an order line"], 1);
  assert.equal(k.skipped["not shipped yet"], 1);
});
