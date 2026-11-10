import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLineStore, customerLines, customerList, dayNo, dayOf, lineOf, pick } from "../src/lib/reporting/otdLines";
import type { OtdLine } from "../src/lib/reporting/otdRules";

const L = (o: Partial<OtdLine>): OtdLine => ({
  company: "100", order: "A26.000001.001", line: "10", source: "eShop", orderDay: "2026-03-02", firstDay: "2026-03-10", confDay: "2026-03-10",
  shipDay: "2026-03-09", atCustomer: "2026-03-10", article: "0191200011", st: "S", pc: "DT", supplier: "Anyseals NV", customer: "100-1", ...o,
});

test("otd lines: the days as whole numbers, both ways", () => {
  assert.equal(dayNo("2020-01-01"), 0);
  assert.equal(dayOf(dayNo("2026-11-10")), "2026-11-10");
  assert.equal(dayNo(""), -1);
  assert.equal(dayOf(-1), "");
});

test("otd lines: the store keeps the cube's lines with a customer, and reads them back as they were", () => {
  const lines = [
    L({}),
    // late 2 working days, GLC, a DirectCut leftover, a product group, planned, the other mandant and source
    L({ order: "A26.000002.001", company: "110", source: "manually entered", st: "P", supplier: "", group: "POM-C", planned: "J", atCustomer: "2026-03-12", wishDay: "2026-03-11", customer: "110-2" }),
    L({ order: "A26.000003.001", atCustomer: "2026-11-20" }), // after today: not counted yet
    L({ order: "A26.000004.001", customer: undefined }), // no customer: not in the customers' store
    L({ order: "A26.000005.001", firstDay: "" }),
  ];
  const s = buildLineStore(lines, "2026-11-10", {
    namesOf: (c) => (c === "100-1" ? { name: "Muster AG", owner: "Nancy" } : undefined),
    infoOf: (a) => ({ t: "O-ring 10x2", g: "NORMATEC O-ring", s: "NBR", p: a }),
    glcOf: (o) => (o === "A26.000002.001" ? "L" : undefined),
  });
  assert.equal(s.rows.length, 2);
  assert.deepEqual(s.cust, ["100-1", "110-2"]);
  assert.deepEqual(s.names, { "100-1": ["Muster AG", "Nancy"] });
  assert.deepEqual(s.info["0191200011"], ["O-ring 10x2", "NBR", "0191200011"]);
  const b = lineOf(s, s.rows[1]);
  assert.deepEqual(b, {
    c: "110-2", order: "A26.000002.001", line: "10", a: "0191200011", company: "110", src: "m", st: "P", pc: "DT", sup: "", group: "POM-C",
    planned: "J", glc: "L", orderDay: "2026-03-02", firstDay: "2026-03-10", confDay: "2026-03-10", shipDay: "2026-03-09", atCustomer: "2026-03-12",
    wishDay: "2026-03-11", late: 2,
  });
  // a GLC kind only for a line without a supplier
  assert.equal(lineOf(s, s.rows[0]).glc, "");
});

test("otd lines: the customers' list and one customer, by the pages' filters", () => {
  const lines = [
    L({ order: "A26.000001.001", line: "10" }),
    L({ order: "A26.000001.001", line: "20", atCustomer: "2026-03-13" }), // 3 days late
    L({ order: "A26.000002.001", firstDay: "2026-04-01", atCustomer: "2026-04-20" }), // 13 days late, in April
    L({ order: "A26.000003.001", customer: "100-9", source: "manually entered" }),
    L({ order: "A26.000004.001", firstDay: "2026-02-27", atCustomer: "2026-03-02" }), // promised in February, delivered in March
  ];
  const s = buildLineStore(lines, "2026-11-10");
  const list = customerList(s, { from: "2026-03", to: "2026-04", axis: "promised", src: ["e"] });
  assert.equal(list.length, 1); // 100-9 is not eShop
  const x = list[0];
  assert.deepEqual([x.c, x.n, x.late, x.days, x.over10, x.orders, x.lateOrders], ["100-1", 3, 2, 16, 1, 2, 2]);
  assert.deepEqual(x.m, { "2026-03": [2, 1], "2026-04": [1, 1] });
  // by the day delivered, February's promise counts in March
  assert.equal(pick(s, { from: "2026-03", to: "2026-03", axis: "delivered", src: ["e"] }).length, 3);
  assert.equal(pick(s, { from: "2026-03", to: "2026-03", axis: "promised" }).length, 3);
  const one = customerLines(s, { from: "2026-01", to: "2026-12", axis: "promised" }, "100-1");
  assert.equal(one.lines.length, 4);
  assert.equal(customerLines(s, { from: "2026-01", to: "2026-12", axis: "promised" }, "nobody").lines.length, 0);
});
