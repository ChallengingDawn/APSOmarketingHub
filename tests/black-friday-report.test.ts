import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport, codesFromText, endAfter, lastDayOf, splitCodes, zurichDay, zurichMidnight, type CodeOrder, type Holder } from "../src/lib/promo/report";

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
