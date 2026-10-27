import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, FILING_CATEGORIES, NO_REQUEST } from "../src/lib/chat/shape";

// SARCLA 27.10.2026: "NO MORE OTHER ... REAL OPTION ONLY"
test("the chat filing offers real options only: never Others, to the AI or to a person", () => {
  assert.ok(!FILING_CATEGORIES.some((c) => c.value === "Others"));
  assert.ok(!CATEGORIES.some((c) => c.value === "Others" && c.aiChoice));
  assert.deepEqual(CATEGORIES.filter((c) => c.aiChoice).map((c) => c.value),
    ["Product Information", "Product Price", "Delivery", "Website Issue", "Invoicing & Accounting", "Order Cancellation"]);
});

test("\"No request\" is the hub's own marker, never a HubSpot value", () => {
  assert.ok(!CATEGORIES.some((c) => c.value === NO_REQUEST));
  assert.ok(!FILING_CATEGORIES.some((c) => c.value === NO_REQUEST));
});
