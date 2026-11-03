import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport, codesFromText, endAfter, lastDayOf, rateOfCode, splitCodes, wrongRate, zurichDay, zurichMidnight, type CodeOrder, type Holder } from "../src/lib/promo/report";

// Black Friday 2026 (SARCLA 03.11.2026): one code per company; each use placed on the company the code was given to.
const H = (companyId: string, code: string, group: string, discount: number): Holder =>
  ({ companyId, name: `Co ${companyId}`, code, discount, group, budgetClass: null });
const O = (orderId: string, codes: string, companyIds: string[], total = 100, discount = -10, createdAt = `2026-11-2${orderId.slice(-1)}T10:00:00Z`): CodeOrder =>
  ({ orderId, codes, createdAt, total, discount, name: `A-${orderId}`, companyIds });
const RATES = { new: 20, list: 10, bronze: 10, silver: 5, gold: 5, platinum: 5, unclassified: 5 };

test("each use counts for the company that holds the code, by group", () => {
  const r = buildReport(
    [H("1", "BFN-0001", "new", 20), H("2", "bfl-0001", "list", 10), H("3", "BFF-0001", "gold", 5)],
    [O("11", "BFN-0001", ["1"], 500, -100), O("12", " bfl-0001 ", ["2"], 200, -20), O("13", "WELCOME10", ["9"])],
    RATES);
  assert.deepEqual(r.totals, { handedOut: 3, used: 2, orders: 2, revenue: 700, discountGiven: 120 });
  const g = Object.fromEntries(r.groups.map((x) => [x.group, x]));
  assert.equal(g.new.used, 1);
  assert.equal(g.new.rate, 20);
  assert.equal(g.list.revenue, 200);
  assert.equal(g.gold.used, 0);
  assert.equal(r.checks.length, 0, "another promotion's code is not ours to check");
});

test("a code used by another company, or used twice, is a check", () => {
  const r = buildReport([H("1", "BFN-0001", "new", 20), H("2", "BFL-0001", "list", 10)],
    [O("11", "BFN-0001", ["7"]), O("12", "BFL-0001", ["2"]), O("13", "BFL-0001", ["2"])], RATES);
  assert.deepEqual(r.checks.map((c) => [c.orderId, c.reason, c.holderId]), [["11", "other company", "1"], ["13", "used again", "2"]]);
});

test("an order not linked to a company yet is counted, not flagged", () => {
  const r = buildReport([H("1", "BFN-0001", "new", 20)], [O("11", "BFN-0001", [])], RATES);
  assert.equal(r.totals.used, 1);
  assert.equal(r.checks.length, 0);
});

test("codes: one field may hold several, any case", () => {
  assert.deepEqual(splitCodes("bfn-1, BFN-2;bfn-3"), ["BFN-1", "BFN-2", "BFN-3"]);
  assert.deepEqual(splitCodes(null), []);
});

test("Magento's coupon export: the code column only", () => {
  const csv = 'Coupon Code,Created,Used,Times Used\n"BF26-ABCD1234","11/10/26",No,0\nbf26-zzzz9999,11/10/26,No,0\n\n"BF26-ABCD1234",x,No,0\n';
  assert.deepEqual(codesFromText(csv), ["BF26-ABCD1234", "BF26-ZZZZ9999"]);
  assert.deepEqual(codesFromText("BFN-0001\nBFN-0002\r\nBFN-0003"), ["BFN-0001", "BFN-0002", "BFN-0003"]);
});

test("Swiss days: 16.11 starts at 23:00 UTC, the end is the night after 06.12, summer has +2", () => {
  assert.equal(zurichMidnight("2026-11-16"), "2026-11-15T23:00:00.000Z");
  assert.equal(endAfter("2026-12-06"), "2026-12-06T23:00:00.000Z");
  assert.equal(lastDayOf("2026-12-06T23:00:00.000Z"), "2026-12-06");
  assert.equal(zurichDay("2026-11-15T23:00:00.000Z"), "2026-11-16");
  assert.equal(zurichMidnight("2026-07-01"), "2026-06-30T22:00:00.000Z");
});

test("results: every order with a code, by day, new customers against existing ones", () => {
  const r = buildReport(
    [H("1", "BLACKFRIDAY20-AAA", "new", 20), H("2", "BLACKFRIDAY15-BBB", "list", 15), H("3", "BLACKFRIDAY5-CCC", "gold", 5)],
    [O("11", "BLACKFRIDAY20-AAA", ["1"], 500, -100, "2026-11-16T09:00:00Z"), O("12", "BLACKFRIDAY15-BBB", ["2"], 200, -30, "2026-11-16T10:00:00Z"),
     O("13", "BLACKFRIDAY5-CCC", ["3"], 1000, -50, "2026-11-17T23:30:00Z")],
    RATES);
  assert.equal(r.results.orders.length, 3);
  assert.equal(r.results.orders[0].orderId, "13", "the newest first");
  assert.equal(r.results.newCompaniesWon, 1);
  assert.deepEqual(r.results.split.new, { orders: 1, revenue: 500, discountGiven: 100 });
  assert.deepEqual(r.results.split.existing, { orders: 2, revenue: 1200, discountGiven: 80 });
  // 23:30 UTC on the 17th is already the 18th in Zurich
  assert.deepEqual(r.results.byDay.map((x) => [x.day, x.orders, x.newOrders]), [["2026-11-16", 2, 1], ["2026-11-18", 1, 0]]);
});

test("a BLACKFRIDAY code the page never handed out is a check; another promotion's code is not", () => {
  const r = buildReport([H("1", "BLACKFRIDAY20-AAA", "new", 20)], [O("11", "BLACKFRIDAY10-ZZZ", ["9"]), O("12", "WELCOME10", ["9"])], RATES);
  assert.deepEqual(r.checks.map((c) => [c.orderId, c.reason]), [["11", "not from the page"]]);
  assert.equal(r.results.orders.length, 1);
});

test("a code still on a new account (no company yet) counts, and is not held against the order's company", () => {
  const r = buildReport([{ companyId: "", name: "A new account", code: "BLACKFRIDAY20-NEW", discount: 20, group: "new", budgetClass: null }],
    [O("11", "BLACKFRIDAY20-NEW", ["77"], 300, -60)], RATES);
  assert.equal(r.checks.length, 0);
  assert.equal(r.results.newCompaniesWon, 1);
});

test("a rule's codes only under their own rate", () => {
  assert.equal(rateOfCode("blackfriday10-ab12cd"), 10);
  assert.equal(rateOfCode("BLACKFRIDAY5XYZ"), 5);
  assert.equal(rateOfCode("BLACKFRIDAY107K2QX9A"), 10, "Magento's part may start with a digit");
  assert.equal(rateOfCode("BLACKFRIDAY57K2Q"), 5);
  assert.equal(rateOfCode("BLACKFRIDAY3-X"), null, "no 3 % rule");
  assert.equal(rateOfCode("TEST-10-0001"), null);
  assert.deepEqual(wrongRate(["BLACKFRIDAY10-A", "BLACKFRIDAY15-B", "TEST-15-1", "BLACKFRIDAY1099"], 10), ["BLACKFRIDAY15-B"]);
  assert.deepEqual(wrongRate(["BLACKFRIDAY107A", "BLACKFRIDAY5B"], 5), ["BLACKFRIDAY107A"]);
});
