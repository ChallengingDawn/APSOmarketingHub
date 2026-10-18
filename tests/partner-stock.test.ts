import assert from "node:assert/strict";
import { test } from "node:test";
import { addresses, due, lineOf, nextSend, summary, zurich } from "../src/lib/partnerStock/rules";

test("Zurich's clock: 07:00 is 05:00 UTC in summer and 06:00 UTC in winter", () => {
  assert.deepEqual(zurich(new Date("2026-10-19T05:00:00Z")), { day: "2026-10-19", hour: 7, weekday: 1 });
  assert.deepEqual(zurich(new Date("2026-11-02T06:00:00Z")), { day: "2026-11-02", hour: 7, weekday: 1 });
  // just before midnight UTC is already tomorrow in Zurich
  assert.equal(zurich(new Date("2026-10-18T22:30:00Z")).day, "2026-10-19");
});

test("the file goes out once a day from 07:00 to 18:00 Zurich, weekends only when asked", () => {
  const mon0659 = new Date("2026-10-19T04:59:00Z"), mon0700 = new Date("2026-10-19T05:00:00Z"), mon1800 = new Date("2026-10-19T16:00:00Z");
  assert.equal(due(null, mon0659, false).due, false);
  assert.deepEqual(due(null, mon0700, false), { due: true, day: "2026-10-19" });
  assert.equal(due("2026-10-19", mon0700, false).due, false); // sent today already
  assert.equal(due("2026-10-18", mon1800, false).due, false); // too late: the day is skipped, not sent in the evening
  const sat = new Date("2026-10-24T06:00:00Z");
  assert.equal(due(null, sat, false).due, true);
  assert.equal(due(null, sat, true).due, false);
});

test("a line: stock, MOQ and status as the partner reads them", () => {
  assert.deepEqual(lineOf("PLOTA1625C", "1220011310", { article_description: " APSOvib buffer ", stock_quantity: "1240", sales_unit: "Stk", moq: "NO", article_status: "Running Article", compass_article_inactive: "active" }),
    { partnerCode: "PLOTA1625C", apso: "1220011310", description: "APSOvib buffer", stock: 1240, unit: "pcs", moq: "No", moqQty: null, status: "Active" });
  const moq = lineOf("X", "1", { stock_quantity: null, sales_unit: "Stk", moq: "YES", moq_minimum_quantity: "50", compass_article_inactive: "No" });
  assert.equal(moq.stock, 0); assert.equal(moq.moq, "Yes"); assert.equal(moq.moqQty, 50); assert.equal(moq.status, "Active");
  assert.equal(lineOf("X", "1", { compass_article_inactive: "inactive", article_status: "Running Article" }).status, "Inactive");
  assert.equal(lineOf("X", "1", { article_status: "Liquidation" }).status, "Liquidation");
  // not in Products & Pricing: a special - stock from the ERP when read, unknown when not
  assert.deepEqual(lineOf("PLOTX", "8001247963", null, 0), { partnerCode: "PLOTX", apso: "8001247963", description: "", stock: 0, unit: "", moq: "", moqQty: null, status: "Special" });
  assert.equal(lineOf("X", "1", null).stock, null);
  const s = summary([lineOf("a", "1", { stock_quantity: "3" }), lineOf("b", "2", { moq: "YES" }), lineOf("c", "3", null)]);
  assert.deepEqual(s, { articles: 3, inStock: 1, moq: 1, inactive: 0, specials: 1 });
});

test("recipients typed in a field", () => {
  assert.deepEqual(addresses("a@x.com; B@X.com , a@x.com nope"), ["a@x.com", "b@x.com"]);
  assert.deepEqual(addresses(["c@y.it", ""]), ["c@y.it"]);
});

test("the page says when the next file goes out", () => {
  assert.equal(nextSend(null, new Date("2026-10-19T04:00:00Z"), false), "today at 07:00");
  assert.equal(nextSend("2026-10-19", new Date("2026-10-19T08:00:00Z"), false), "tomorrow at 07:00");
  assert.equal(nextSend("2026-10-23", new Date("2026-10-23T08:00:00Z"), true), "26.10.2026 at 07:00"); // Friday -> Monday
});
