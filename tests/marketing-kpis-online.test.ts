import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, type Dim } from "../src/lib/marketingKpis/cube";
import { classifySearchCustomers, foldOnline, groupOrders, onlineBy, onlineShare, splitNumber, webMark, type OrderRec } from "../src/lib/marketingKpis/onlineShare";

const rec = (id: string, number: string, month: string, value: number, web = false, cancelled = false): OrderRec => ({ id, number, month, value, web, cancelled });

test("an order number and its delivery part", () => {
  assert.deepEqual(splitNumber("A26.648373.001"), ["A26.648373", "001"]);
  assert.deepEqual(splitNumber(" G26.626707.000 "), ["G26.626707", "000"]);
  assert.equal(splitNumber("22000009064"), null);
  assert.equal(splitNumber(null), null);
});

test("the shop's mark: its order id, the eshop channel or a web order number", () => {
  assert.equal(webMark({ hs_external_order_id: "6000286795" }), true);
  assert.equal(webMark({ order_channel: "EShop" }), true);
  assert.equal(webMark({ order_web_order_number: "10000156325" }), true);
  assert.equal(webMark({ order_channel: "", hs_external_order_id: null }), false);
});

test("orders: the web record and its deliveries are one order, valued once - the deliveries when there are any", () => {
  const o = groupOrders([
    rec("1", "A26.1.000", "2026-09", 100, true),
    rec("2", "A26.1.001", "2026-09", 60),
    rec("3", "A26.1.002", "2026-10", 45),
  ], new Set());
  assert.deepEqual([...o.entries()], [["A26.1", { month: "2026-09", value: 105, web: true, pick: "2" }]]);
});

test("a web order the ERP has not delivered yet counts with its web record's value", () => {
  const o = groupOrders([rec("1", "A26.2.000", "2026-10", 80, true)], new Set());
  assert.deepEqual(o.get("A26.2"), { month: "2026-10", value: 80, web: true, pick: "1" });
});

test("an ERP order is web when its archived web record was - and not otherwise", () => {
  const o = groupOrders([rec("1", "A26.3.001", "2026-09", 50), rec("2", "A26.4.001", "2026-09", 70)], new Set(["A26.3"]));
  assert.equal(o.get("A26.3")!.web, true);
  assert.equal(o.get("A26.4")!.web, false);
});

test("credit notes and cancelled orders are left out; a web order without an ERP number stands alone", () => {
  const o = groupOrders([
    rec("1", "G26.5.000", "2026-09", -40),
    rec("2", "A26.6.001", "2026-09", 90, false, true),
    rec("3", "", "2026-10", 30, true),
    rec("4", "A26.7.001", "", 10),
  ], new Set());
  assert.deepEqual([...o.keys()], ["web:3"]);
});

const L = (over: Partial<Record<Dim, string>> = {}) => Object.fromEntries(DIMS.map((d) => [d, over[d] ?? "Not set"])) as Record<Dim, string>;

test("fold and slice: share by segment, the year earlier, and the filters", () => {
  const years = [2026, 2025, 2024];
  const o = {
    generatedAt: "", years, through: "2026-10-16", orders: { all: 0, web: 0, noCompany: 0 },
    ...foldOnline([
      { month: "2026-09", value: 900, web: true, labels: L({ segment: "APSOcore", prio: "Prio 1" }) },
      { month: "2026-09", value: 100, web: false, labels: L({ segment: "APSOcore", prio: "Prio 1" }) },
      { month: "2026-09", value: 500, web: true, labels: L({ segment: "APSOgrowth", prio: "Prio 2" }) },
      { month: "2025-09", value: 400, web: false, labels: L({ segment: "APSOcore", prio: "Prio 1" }) },
      { month: "2025-09", value: 400, web: true, labels: L({ segment: "APSOcore", prio: "Prio 1" }) },
      { month: "2023-05", value: 999, web: true, labels: L() },   // outside the three years
    ], years),
  };
  const sep26 = { start: 24 + 8, end: 24 + 8 };
  const all = onlineBy(o, {}, sep26).get("")!;
  assert.deepEqual(all, { all: 1500, web: 1400, allPy: 800, webPy: 400 });
  assert.equal(onlineShare(all.all, all.web)!.toFixed(4), (1400 / 1500).toFixed(4));
  const seg = onlineBy(o, {}, sep26, "segment");
  assert.deepEqual(seg.get("APSOcore"), { all: 1000, web: 900, allPy: 800, webPy: 400 });
  assert.deepEqual(seg.get("APSOgrowth"), { all: 500, web: 500, allPy: 0, webPy: 0 });
  // a filter on another dimension narrows; the grouped dimension's own filter does not
  assert.deepEqual([...onlineBy(o, { prio: ["Prio 2"] }, sep26, "segment").keys()], ["APSOgrowth"]);
  assert.equal(onlineBy(o, { segment: ["APSOcore"] }, sep26, "segment").size, 2);
  // a label the orders do not know gives nothing, not everything
  assert.equal(onlineBy(o, { country: ["Atlantis"] }, sep26).size, 0);
  assert.equal(onlineShare(0, 0), null);
  // several values: either passes
  assert.deepEqual([...onlineBy(o, { prio: ["Prio 1", "Prio 2"] }, sep26, "segment").keys()].sort(), ["APSOcore", "APSOgrowth"]);
  assert.equal(onlineBy(o, { prio: ["Prio 2", "Prio 9"] }, sep26).get("")!.all, 500);
});

test("customers from search: new, reactivated and active per channel, matched by the shop's order number", () => {
  const orders: Record<string, { company: string; month: string }> = {
    "6000000001": { company: "A", month: "2026-03" },   // A: first order ever, through SEO
    "6000000002": { company: "B", month: "2026-04" },   // B: back after a year and more, through SEA
    "6000000003": { company: "C", month: "2026-05" },   // C: a regular, through SEO
    "6000000004": { company: "A", month: "2026-06" },   // A again, SEA: active there, not new
    "6000000005": { company: "D", month: "2025-03" },   // last year: D new through SEO
  };
  const companyMonths = new Map([
    ["A", new Set(["2026-03", "2026-06"])], ["B", new Set(["2024-11", "2026-04"])],
    ["C", new Set(["2026-01", "2026-05"])], ["D", new Set(["2025-03"])],
  ]);
  const firstOrder = new Map([["A", "2026-03"], ["B", "2023-05"], ["C", "2019-02"], ["D", "2025-03"]]);
  const r = classifySearchCustomers({
    ga4: [
      { tid: "6000000001", channel: "Organic Search", date: "2026-03-04" },
      { tid: "6000000002", channel: "Paid Search", date: "2026-04-10" },
      { tid: "6000000003", channel: "Organic Search", date: "2026-05-02" },
      { tid: "6000000004", channel: "Paid Search", date: "2026-06-20" },
      { tid: "6000000004", channel: "Paid Search", date: "2026-06-20" },   // the same order twice: once
      { tid: "6000000005", channel: "Organic Search", date: "2025-03-15" },
      { tid: "9999999999", channel: "Organic Search", date: "2026-07-01" },  // not in HubSpot
      { tid: "6000000003", channel: "Direct", date: "2026-11-01" },          // after the window
    ],
    orderOf: (t) => orders[t] ?? null, companyMonths, firstOrder, year: 2026, upTo: 9, webOrdersCy: 20,
  });
  assert.deepEqual(r.cy.organic, { new: 1, react: 0, active: 2 });
  assert.deepEqual(r.cy.paid, { new: 0, react: 1, active: 2 });
  assert.deepEqual(r.py.organic, { new: 1, react: 0, active: 1 });
  assert.deepEqual(r.coverage, { ga4: 5, matched: 4, webOrders: 20 });
});
