import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE, companyFacts, day, factsDiff, latestShipment, monthsFrom, sameValue, wantMandant } from "../src/lib/connectors/steps/rules";

test("mandant: the key's prefix, never a guess", () => {
  assert.equal(wantMandant("110-815906"), "M110");
  assert.equal(wantMandant(" 100-1 "), "M100");
  assert.equal(wantMandant("ABC-1"), null);
  assert.equal(wantMandant(""), null);
  // a prefix the picklist does not offer is skipped instead of failing a batch
  assert.equal(wantMandant("120-5", new Set(["M100", "M110"])), null);
});

test("dates: HubSpot gives either a day or epoch ms", () => {
  assert.equal(day("2026-10-01"), "2026-10-01");
  assert.equal(day(String(Date.UTC(2026, 9, 1))), "2026-10-01");
  assert.equal(day(""), null);
});

const T = "2026-10-07";
const inv = STAGE.invoiced;

test("order facts: deliveries of one order count once, credit notes and cancelled do not count", () => {
  const f = companyFacts([
    { order_order_number: "A25.100.001", order_order_date: "2025-03-01", order_shipment_date: "2025-03-10", hs_pipeline_stage: inv },
    { order_order_number: "A25.100.002", order_order_date: "2025-03-02", order_shipment_date: "2025-04-01", hs_pipeline_stage: inv },
    { order_order_number: "A26.200.000", order_order_date: "2026-05-01" },
    { order_order_number: "G26.300", order_order_date: "2026-06-01" },
    { order_order_number: "A26.400.001", order_order_date: "2026-07-01", hs_pipeline_stage: STAGE.cancelled },
    { order_order_number: "", order_order_date: "2026-08-01" },
    { order_order_number: "A26.500.001", order_order_date: "2026-09-01", hs_pipeline: "999" },
  ], null, T);
  assert.equal(f.order_total_orders, 2);
  assert.equal(f.order_first_order_date, "2025-03-01");
  assert.equal(f.order_last_order_date, "2026-05-01");
  assert.equal(f.order_last_shipment_date, "2025-04-01");
  assert.equal(f.order_avg_days_between_orders, 426); // 426 days / 1 gap
});

test("order facts: the pre-2020 baseline joins in, a future shipment does not count, nothing gives all empty", () => {
  const f = companyFacts([{ order_order_number: "A24.1.001", order_order_date: "2024-01-01", order_shipment_date: "2030-01-01", hs_pipeline_stage: inv }],
    { first: "2015-06-01", last: "2019-12-01", ship: "2019-12-05", n: 4 }, T);
  assert.equal(f.order_total_orders, 5);
  assert.equal(f.order_first_order_date, "2015-06-01");
  assert.equal(f.order_last_order_date, "2024-01-01");
  assert.equal(f.order_last_shipment_date, "2019-12-05");
  assert.equal(f.order_avg_days_between_orders, 784); // 3136 days / 4 - the connector gives 784.0
  const none = companyFacts([], null, T);
  assert.deepEqual(Object.values(none), [null, null, null, null, null]);
});

test("same / diff: numbers within 0.05, dates by day, empties equal", () => {
  assert.ok(sameValue("12", 12));
  assert.ok(sameValue("33.33", 33.3));
  assert.ok(sameValue("2026-01-01", "2026-01-01T00:00:00Z"));
  assert.ok(sameValue("", null));
  assert.ok(!sameValue("", 5));
  assert.deepEqual(factsDiff({ order_total_orders: "3", order_first_order_date: "2025-01-01" }, {
    order_first_order_date: "2025-01-01", order_last_order_date: "2025-02-01", order_last_shipment_date: null, order_total_orders: 3, order_avg_days_between_orders: null,
  }), { order_last_order_date: "2025-02-01" });
});

test("contact shipment: months to today, latest date per contact, documents without contact counted", () => {
  assert.deepEqual(monthsFrom("2025-11", "2026-02-10"), [[2025, 11], [2025, 12], [2026, 1], [2026, 2]]);
  const { latest, noContact } = latestShipment(
    new Map([["o1", "2026-07-01"], ["o2", "2026-08-01"], ["o3", "2026-09-01"]]),
    new Map([["o1", ["c1"]], ["o2", ["c1", "c2"]]]),
  );
  assert.equal(latest.get("c1"), "2026-08-01");
  assert.equal(latest.get("c2"), "2026-08-01");
  assert.equal(noContact, 1);
});
