import assert from "node:assert/strict";
import { test } from "node:test";
import { findErpNumber, yearsToTry, type Ask } from "../src/lib/connectors/magento/erpNumber";

/** The shop, for one web order whose erp_order_number is `hidden` (null = not transferred yet). */
const shop = (hidden: string | null): Ask => async (cond, value) => {
  if (cond === "notnull") return hidden !== null;
  if (hidden === null) return false;
  if (cond === "like") return hidden.startsWith(value.replace(/%$/, ""));
  if (cond === "gteq") return hidden >= value; // text order, as the shop compares
  return hidden === value;
};
const YEARS = yearsToTry(new Date(Date.UTC(2026, 9, 15)));

test("the years: this one first, then back to 2014", () => {
  assert.deepEqual(YEARS.slice(0, 3), [26, 25, 24]);
  assert.equal(YEARS[YEARS.length - 1], 14);
});

test("the exact A-number from yes/no questions - this year's in about 23 questions", async () => {
  for (const a of ["A26.627835.000", "A26.000001.000", "A26.999999.000", "A26.500000.001", "A21.104512.000", "A14.000000.009"]) {
    const f = await findErpNumber(shop(a), YEARS);
    assert.equal(f.state, "found", a);
    assert.equal(f.number, a);
  }
  const now = await findErpNumber(shop("A26.627835.000"), YEARS);
  assert.ok(now.asked <= 24, `asked ${now.asked}`);
});

test("not transferred yet: one question, nothing found", async () => {
  assert.deepEqual(await findErpNumber(shop(null), YEARS), { number: null, asked: 1, state: "not_transferred" });
});

test("a value that is not an A-number, or a suffix past .009, is unreadable - never guessed", async () => {
  assert.equal((await findErpNumber(shop("G26.123456.000"), YEARS)).state, "unreadable");
  assert.equal((await findErpNumber(shop("A26.123456.010"), YEARS)).state, "unreadable");
  assert.equal((await findErpNumber(shop(""), YEARS)).state, "unreadable");
});

test("the shop stops answering: no_answer, nothing stamped", async () => {
  let n = 0;
  const flaky: Ask = async (c, v) => (++n > 5 ? null : shop("A26.627835.000")(c, v));
  const f = await findErpNumber(flaky, YEARS);
  assert.equal(f.state, "no_answer");
  assert.equal(f.number, null);
});
