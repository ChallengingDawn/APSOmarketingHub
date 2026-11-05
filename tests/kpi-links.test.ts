import assert from "node:assert/strict";
import { test } from "node:test";
import { carriersOf, linkChanges, rowOf } from "../src/lib/reporting/kpiLinks";

// SARCLA 05.11.2026: link the plan's existing actions to a KPI, several at once, and those carrying its Digital
// Growth tickets offered. Made-up rows below.

test("kpi links: saving the ticks tracks the new ones and takes off the unticked", () => {
  const tracking = new Set(["i1", "s7"]);
  assert.deepEqual(linkChanges(new Set(["i1", "i2", "s9"]), tracking), { add: ["i2", "s9"], drop: ["s7"] });
  assert.deepEqual(linkChanges(new Set(["i1", "s7"]), tracking), { add: [], drop: [] }, "nothing changed, nothing saved");
  assert.deepEqual(linkChanges(new Set(), tracking), { add: [], drop: ["i1", "s7"] });
});

test("kpi links: a row's key is an action or a sub-action", () => {
  assert.deepEqual(rowOf("i12"), { kind: "item", id: 12 });
  assert.deepEqual(rowOf("s3"), { kind: "sub", id: 3 });
  assert.equal(rowOf("x3"), null);
  assert.equal(rowOf("i"), null);
});

test("kpi links: the rows behind the KPI's tickets, and what was made on the KPI", () => {
  const items = [{ id: 1, kind: "action" }, { id: 2, kind: "action" }, { id: 3, kind: "topic" }];
  const subs = [
    { id: 10, ticketIds: ["900"] },
    { id: 11, ticketIds: ["901"] },
    { id: 12, kpiTile: "reach::R05" },
    { id: 13, kpiTile: "reach::R04" },
  ];
  const own = { "1": ["900"], "2": ["555"], "3": ["900"] };
  assert.deepEqual([...carriersOf(items, subs, own, ["900"], "reach::R05")].sort(), ["i1", "s10", "s12"]);
  assert.deepEqual([...carriersOf(items, subs, undefined, [], "reach::R05")], ["s12"], "no tickets: only what was made on it");
});
