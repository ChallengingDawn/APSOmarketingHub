import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LIMITS, decide, factsOf, followUpSubject, isDtNewBusiness, mailFields, oNumber, reasonText, reentered, rfqCsv, subjectOf } from "../src/lib/gqsApprovals/rules";

const f = (potential: number | null, margin: number | null, liquidation = false) => ({ potential, margin, liquidation });

test("the rule in the workflow's order - the requests of 30.10-04.11.2026 decided as the workflow decided them", () => {
  assert.deepEqual(decide(f(0, 0)), { review: true, reason: "small" }, "446356237555: 0 EUR, margin 0 - review");
  assert.deepEqual(decide(f(1000, 0.25)), { review: true, reason: "mid" }, "445920149733: 1,000 EUR, 25 % - review");
  assert.deepEqual(decide(f(null, null)), { review: false }, "445920122059: nothing filled in - approved by itself");
  assert.deepEqual(decide(f(0, 0.5)), { review: false }, "445561985271: 0 EUR, 50 % - approved by itself");
  assert.deepEqual(decide(f(20000, 0.35)), { review: true, reason: "big" }, "445586464957: 20,000 EUR - review");
  assert.deepEqual(decide(f(15000, 0.2)), { review: true, reason: "mid" }, "445668548840: 15,000 EUR, 20 % - review");
});

test("the limits are inclusive, a missing value never fits, liquidation last", () => {
  assert.equal(decide(f(19999.99, 0.31)).review, false);
  assert.deepEqual(decide(f(1000, 0.2)), { review: true, reason: "small" }, "<= 1,000 and <= 20 % comes before the middle band");
  assert.deepEqual(decide(f(20000, null)), { review: true, reason: "big" }, "the big order needs no margin");
  assert.equal(decide(f(500, null)).review, false, "no margin: the small and middle cases cannot fit");
  assert.deepEqual(decide(f(5000, 0.9, true)), { review: true, reason: "liquidation" });
  assert.equal(decide(f(5000, 0.9, true), { ...DEFAULT_LIMITS, liquidation: false }).review, false);
  assert.deepEqual(decide(f(25000, 0.1, true)), { review: true, reason: "big" }, "the first case that fits names the reason");
});

test("the values as HubSpot gives them", () => {
  assert.deepEqual(factsOf({ order_potential_: "15000", margin__: "0.2", liquidation_article: "false" }), f(15000, 0.2));
  assert.deepEqual(factsOf({ order_potential_: "", margin__: null, liquidation_article: "true" }), f(null, null, true));
  assert.deepEqual(factsOf({ order_potential_: "1000,5" }), f(1000.5, null));
  assert.deepEqual(factsOf({ order_potential_: "9200", margin__: "25" }), f(9200, 0.25), "a margin typed as 25 is 25 %");
  assert.deepEqual(decide(factsOf({ order_potential_: "9200", margin__: "25" })), { review: true, reason: "mid" }, "419080997107: approved by itself by the workflow");
});

test("what the workflow wrote: subject, follow-up subject, O-number, the type", () => {
  assert.equal(subjectOf("Running Business", "Jan Kalt", "740260 / ACLARIS GmbH"), "GQS Special Request | Running Business |  Jan Kalt | 740260 / ACLARIS GmbH");
  assert.equal(followUpSubject("867395"), "GQS SALES FOLLOW-UP TICKET | 867395");
  assert.equal(oNumber(new Date("2026-11-04T07:28:40Z")), "O26.04110728", "446356237555's O-number");
  assert.equal(isDtNewBusiness("DT -  New Business"), true);
  assert.equal(isDtNewBusiness("KT -  New Business"), false);
  assert.equal(reentered(["3153750219"]), false);
  assert.equal(reentered(["3153750219", "2338266316"]), true);
  assert.match(reasonText("mid"), /between 1’?000 EUR and 20’?000 EUR and margin up to 30 %/);
});

test("the RFQ sheet and the mail's fields", () => {
  const p = { customer_number_customer_name: "1 / Muster AG", call_off: "1 call off", delivery_date: "2026-12-01", certificates_docs_datasheets: "Others", other_certificates_to_gqs: "UL", molded_parts___extruded_profiles: "true", why_the_request_for_molded_profiles__: "new tool" };
  const csv = rfqCsv(p).split("\n");
  assert.equal(csv[0], "DT Parts - Minimum RFQ Requirements");
  assert.ok(csv.includes("Call off:,1 call off - Delivery date: 2026-12-01"));
  assert.ok(csv.includes("Certificates/DoCs/Datasheets:,Others - UL"));
  assert.ok(csv.includes("Original / Neutralised Drawing:,Not provided"));
  assert.ok(csv.includes("Molded Parts / Extruded Profiles:,Yes"));
  const m = mailFields({ gqs_type_of_request: "Running Business", subject: "S", margin__: "0.25", order_potential_: "15000", liquidation_article: "false", colour: "" });
  assert.deepEqual(m.map(([k]) => k), ["Name", "GQS type", "In liquidation", "Margin", "Total order potential"]);
  assert.equal(m.find(([k]) => k === "Margin")![1], "25 %");
});
