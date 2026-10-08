import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The registry imports the steps' I/O (not compilable here), so it is read as text: the
// "chain" keys in chainStatus.ts - what erosion, articles and segmentation wait for -
// must be exactly the registry's chain steps, and every registry key a connector step.
const registry = readFileSync("src/lib/connectors/steps/registry.ts", "utf8");
const chainStatus = readFileSync("src/lib/connectors/chainStatus.ts", "utf8");
const compass = readFileSync("src/lib/connectors/compass.ts", "utf8");

const entries = [...registry.matchAll(/\{ key: "([a-z_]+)", cadence: "([a-z0-9]+)"/g)].map((m) => ({ key: m[1], cadence: m[2] }));

test("the registry lists every step once, in the connector's order", () => {
  assert.ok(entries.length >= 18, String(entries.length));
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length);
  const order = entries.map((e) => e.key);
  assert.ok(order.indexOf("revenue_kpi") < order.indexOf("erp_revenue"), "KPIs before the workbook");
  assert.ok(order.indexOf("erp_revenue") < order.indexOf("revenue_history"), "history after the workbook");
  assert.ok(order.indexOf("orders_daily") < order.indexOf("stages_new_orders"));
  assert.ok(order.indexOf("order_sync") < order.indexOf("company_stats"));
  assert.ok(order.indexOf("company_stats") < order.indexOf("contact_shipment"));
});

test("the done signal waits for exactly the chain steps", () => {
  const listed = /CHAIN_KEYS = \[([\s\S]*?)\]/.exec(chainStatus)![1].match(/"([a-z_]+)"/g)!.map((s) => s.slice(1, -1));
  assert.deepEqual([...listed].sort(), entries.filter((e) => e.cadence === "chain").map((e) => e.key).sort());
});

test("every step on the page that the hub can run is known to the registry", () => {
  const keys = new Set(entries.map((e) => e.key));
  for (const m of compass.matchAll(/key: "([a-z_]+)", name: "[^"]*", group: "([a-z]+)", phase: "preview"/g)) {
    assert.ok(keys.has(m[1]), m[1]);
  }
});
