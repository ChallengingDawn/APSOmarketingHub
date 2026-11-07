import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HIST, bands, byDate, deliveryCollector, deliveryOf, erpDay, medianWd, sumDMonths, summarize, within, workingDays, both,
} from "../src/lib/reporting/boDelivery";

// Back-Office Reports > OTD > Delivery speed (SARCLA 06.11.2026): the ERP's order file, a delivery once, working days from
// the order to the shipment, shipped by the proposed date or not. Made-up rows below.

const row = (o: Record<string, string>) => (c: string) => o[c] ?? "";
const base = {
  OrderNumber: "A26.500001.001", OrderStatus: "invoiced", OrderDate: "02.03.2026 00:00:00", ShipmentDate: "04.03.2026 00:00:00",
  DeliveryDateProp: "20.02.2030 00:00:00", ShippedToCountry: "Switzerland", ShippingMode: "DHL", Inactive: "", DeletedOrder: "N", WithoutShipment: "N", OrderYear: "2026",
};
const TODAY = "2026-11-06";

test("delivery: the ERP's dates and the working days between them", () => {
  assert.equal(erpDay("04.03.2026 00:00:00"), "2026-03-04");
  assert.equal(erpDay(" 31.12.2025"), "2025-12-31");
  assert.equal(erpDay(""), null);
  assert.equal(erpDay("2026-03-04"), null, "only the ERP's own format");
  assert.equal(workingDays("2026-03-02", "2026-03-02"), 0, "the same day");
  assert.equal(workingDays("2026-03-02", "2026-03-03"), 1, "Monday -> Tuesday");
  assert.equal(workingDays("2026-03-06", "2026-03-09"), 1, "Friday -> Monday");
  assert.equal(workingDays("2026-03-06", "2026-03-07"), 0, "Friday -> Saturday");
  assert.equal(workingDays("2026-03-07", "2026-03-09"), 1, "Saturday -> Monday");
  assert.equal(workingDays("2026-03-02", "2026-03-16"), 10, "two weeks");
  assert.equal(workingDays("2026-03-05", "2026-03-02"), 0, "never below 0");
});

test("delivery: what counts as a shipped delivery, and why a row does not", () => {
  const d = deliveryOf(row(base), base.OrderNumber, TODAY, 2025);
  assert.deepEqual(d, { num: "A26.500001.001", order: "2026-03-02", ship: "2026-03-04", wd: 2, prop: null, country: "Switzerland", mode: "DHL" });
  const why = (o: Record<string, string>) => deliveryOf(row({ ...base, ...o }), o.OrderNumber ?? base.OrderNumber, TODAY, 2025);
  assert.equal(why({ OrderNumber: "G26.100001.001" }), "not an A-number", "a credit note");
  assert.equal(why({ OrderNumber: "R26.100001" }), "not an A-number", "a frame contract");
  assert.equal(why({ Inactive: "J" }), "inactive or deleted");
  assert.equal(why({ DeletedOrder: "Y" }), "inactive or deleted");
  assert.equal(why({ WithoutShipment: "J" }), "without shipment");
  assert.equal(why({ ShipmentDate: "" }), "no shipment date");
  assert.equal(why({ ShipmentDate: "09.11.2026 00:00:00" }), "not shipped yet", "a planned date after today");
  assert.equal(why({ OrderStatus: "entered" }), "status");
  assert.equal(why({ OrderStatus: "credited" }), "status");
  assert.deepEqual(why({ OrderStatus: "ready for tour" }), why({ OrderStatus: "being delivered" }), "both shipped");
  assert.equal(typeof why({ OrderStatus: "ready for tour" }), "object");
  assert.equal(why({ OrderDate: "05.03.2026 00:00:00" }), "bad dates", "ordered after it shipped");
  assert.equal(why({ ShipmentDate: "04.03.2024 00:00:00" }), null, "an older year: not read at all");
  assert.equal(why({ ShipmentDate: "", OrderYear: "2023" }), null, "an old order without a shipment date: not counted as skipped");
  const p = why({ DeliveryDateProp: "10.03.2026 00:00:00", ShippedToCountry: "", OrderCountry: "Germany", ShippingMode: "" });
  assert.deepEqual(p && typeof p === "object" ? [p.prop, p.country, p.mode] : p, ["2026-03-10", "Germany", "Not named"], "a real proposed date; the order's country when the shipped-to is empty");
});

test("delivery: a number once - its last row wins, also when that row no longer counts", () => {
  const c = deliveryCollector(TODAY, 2025);
  c.row(row(base), base.OrderNumber);
  c.row(row({ ...base, ShipmentDate: "06.03.2026 00:00:00" }), base.OrderNumber);
  assert.equal(c.found.size, 1);
  assert.equal(c.found.get(base.OrderNumber)!.wd, 4);
  c.row(row({ ...base, Inactive: "J" }), base.OrderNumber);
  assert.equal(c.found.size, 0);
  assert.deepEqual(c.skipped, { "inactive or deleted": 1 });
});

test("delivery: the months, the bands, the median, shipped by the proposed date", () => {
  const c = deliveryCollector(TODAY, 2025);
  const add = (n: string, order: string, ship: string, extra: Record<string, string> = {}) =>
    c.row(row({ ...base, OrderNumber: n, OrderDate: `${order} 00:00:00`, ShipmentDate: `${ship} 00:00:00`, ...extra }), n);
  add("A26.1.001", "02.03.2026", "02.03.2026");                 // 0
  add("A26.2.001", "02.03.2026", "03.03.2026");                 // 1
  add("A26.3.001", "02.03.2026", "09.03.2026");                 // 5
  add("A26.4.001", "02.02.2026", "30.03.2026", { ShippedToCountry: "Germany" }); // 40 -> 31+
  add("A26.5.001", "02.03.2026", "11.03.2026", { DeliveryDateProp: "12.03.2026 00:00:00" }); // 7, by the date
  add("A26.6.001", "02.03.2026", "20.03.2026", { DeliveryDateProp: "12.03.2026 00:00:00" }); // 14, 6 late
  add("A26.7.001", "01.09.2026", "15.10.2026", { DeliveryDateProp: "01.10.2026 00:00:00" }); // recent, late
  const k = summarize(c.found.values(), TODAY, c.skipped, (n) => (n === "A26.7.001" ? "Muster AG" : ""));
  assert.equal(k.deliveries, 7);
  const m = k.months["2026-03"];
  assert.equal(m.s.length, HIST);
  assert.equal(m.s[0] + m.s[1] + m.s[5] + m.s[HIST - 1], 4, "without a date: 0, 1, 5 and 31+");
  assert.equal(m.p[7] + m.p[14], 2);
  assert.equal(m.by, 1);
  assert.deepEqual(m.late, [0, 0, 1, 0], "6 working days late");
  assert.deepEqual(m.c.Germany, [1, 0, 0, 0]);
  assert.deepEqual(m.c.Switzerland, [5, 2, 2, 1]);
  assert.deepEqual(bands(both(m)), [2, 1, 2, 1]);
  assert.equal(medianWd(both(m)), 5);
  assert.equal(within(both(m), 1), 2 / 6);
  assert.equal(byDate(m), 0.5);
  assert.equal(within([], 2), null);
  assert.equal(medianWd(Array(HIST).fill(0)), null);
  // the slow list: shipped in the last 92 days - only October's here, with its customer
  assert.deepEqual(k.slow, [["A26.7.001", "2026-09-01", "2026-10-15", 32, "2026-10-01", "Switzerland", "DHL", "Muster AG"]]);
  // months added up, as the page does for a period
  const t = sumDMonths([m, k.months["2026-10"], undefined]);
  assert.equal(t.by, 1);
  assert.deepEqual(t.late, [0, 0, 2, 0], "October's 10 working days late");
  assert.deepEqual(t.c.Switzerland, [6, 2, 3, 1]);
});
