import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleLine, summarize } from "../src/lib/connectors/summary";
import { STEPS, splitProp, stepName, writesByProperty } from "../src/lib/connectors/compass";

// "seconds 276" was what the chain page said about a mandant sweep that changed nothing.
test("a run that changed nothing says so, with what it looked at - never its duration", () => {
  assert.equal(summarize({ seconds: 276, to_fix: 0, missing: 0, contradicting: 0, companies_with_a_key: 56086 }, true), "Nothing to change · 56,086 companies checked");
  assert.equal(summarize({ seconds: 12 }, true), "Done");
});

test("a live run leads with what it wrote; a test run with what it would change", () => {
  assert.equal(summarize({ to_fix: 3, written: 3, failed: 0, companies_with_a_key: 56086 }, true), "3 written · 56,086 companies checked");
  assert.equal(summarize({ to_fix: 3, companies_with_a_key: 56086 }, false), "3 to fix · 56,086 companies checked");
  assert.equal(summarize({ to_update: 0, orders_in_snapshot: 803000 }, false), "Nothing to change · 803,000 orders checked");
  // a specific count beats the generic "updated" it repeats
  assert.equal(summarize({ rows: 10, companies_changed: 1234, updated: 1234 }, true), "1,234 companies changed · 10 rows read");
  assert.equal(summarize({ to_update: 5, updated: 0, errors: 5 }, true), "5 to change (not written) · 5 failed");
});

test("the KPI steps' counts per series are added up", () => {
  const r = { companies_read: 60000, revenue_monthly: { would_create: 2, would_update: 10 }, oi_monthly: { would_update: 5 } };
  assert.equal(summarize(r, false), "2 to create · 15 to change · 60,000 companies read");
  assert.equal(summarize({ revenue_delta: { skipped: "x" }, revenue_monthly: { created: 0, updated: 0 } }, true), "Nothing to change");
});

test("examples read as before → after", () => {
  assert.equal(exampleLine({ contact: "123", was: "", now: "2026-10-01" }), "contact 123: (empty) → 2026-10-01");
  assert.equal(exampleLine({ order: "A1.001", lines: 3 }), "order A1.001 · lines 3");
});

test("What it writes: one row per object and property, every writing step on it", () => {
  const rows = writesByProperty();
  const keys = rows.map((r) => `${r.object}|${r.name}`);
  assert.equal(new Set(keys).size, keys.length);
  const stage = rows.find((r) => r.name === "hs_pipeline_stage" && r.object.startsWith("Order"));
  assert.deepEqual(stage?.by.map((b) => b.step.key), ["stages", "orders_daily", "stages_new_orders"]);
  assert.equal(stage?.by.find((b) => b.step.key === "orders_daily")?.note, "→ Entered");
  const title = rows.find((r) => r.name === "hs_order_name");
  assert.deepEqual(title?.by.map((b) => b.step.key), ["magento_stamp", "orders_daily", "order_sync"]);
  // names are bare: no annotation left on a property name
  for (const r of rows) assert.ok(!r.name.includes(" (") && !r.name.includes(" - "), r.name);
});

test("splitProp keeps the property name and moves the remark aside", () => {
  assert.deepEqual(splitProp("order_reconcile_state (→ erp_linked)"), { name: "order_reconcile_state", note: "→ erp_linked" });
  assert.deepEqual(splitProp("oi_<year>_<month>, oi_<year> - only with OI_FROM_CSV=1 (off: x)"), { name: "oi_<year>_<month>, oi_<year>", note: "only with OI_FROM_CSV=1 (off: x)" });
  assert.deepEqual(splitProp("mandant"), { name: "mandant", note: "" });
});

test("every step has a plain name for the notices", () => {
  for (const s of STEPS) assert.equal(stepName(s.key), s.name);
  assert.equal(stepName("articles_create_missing"), "Create the missing articles");
});
