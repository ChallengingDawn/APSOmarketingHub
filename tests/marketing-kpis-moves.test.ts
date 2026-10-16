import assert from "node:assert/strict";
import { test } from "node:test";
import { byPerson, firstMonth, movesOf, segmentRank, tally } from "../src/lib/marketingKpis/moves";

// HubSpot gives a property's history newest first; movesOf sorts it.
const h = (...e: [string, string, string?][]) => e.map(([timestamp, value, sourceType]) => ({ timestamp, value, sourceType: sourceType ?? "AUTOMATION_PLATFORM" })).reverse();

test("priority: a smaller number is up, a larger one down, months from the history", () => {
  const m = movesOf("prio", h(["2024-03-01T08:00:00Z", "3"], ["2025-02-10T08:00:00Z", "2"], ["2026-05-04T08:00:00Z", "4", "CRM_UI"]), "2025-01");
  assert.deepEqual(m.map((x) => [x.month, x.dir, x.from, x.to, x.person]), [
    ["2025-02", "up", "Prio 3", "Prio 2", false],
    ["2026-05", "down", "Prio 2", "No priority", true],
  ]);
});

test("moves before the first month count only as the value they leave standing", () => {
  const m = movesOf("prio", h(["2023-01-01T00:00:00Z", "1"], ["2024-06-01T00:00:00Z", "2"], ["2025-03-01T00:00:00Z", "1"]), "2025-01");
  assert.deepEqual(m.map((x) => [x.month, x.dir, x.from]), [["2025-03", "up", "Prio 2"]]);
});

test("the same value again, or a cleared one, is no move; the first value is 'set'", () => {
  const m = movesOf("segment", h(["2025-01-05T00:00:00Z", "APSOprospect"], ["2025-02-01T00:00:00Z", "APSOprospect"], ["2025-03-01T00:00:00Z", ""], ["2025-04-01T00:00:00Z", "APSOgrowth"]), "2025-01");
  assert.deepEqual(m.map((x) => [x.month, x.dir, x.from ?? null, x.to]), [
    ["2025-01", "set", null, "APSOprospect"],
    ["2025-04", "up", "APSOprospect", "APSOgrowth"],
  ]);
});

test("segments: ESO, DS and Growth Engine customers sit with APSOcore; an unknown value is no move", () => {
  assert.equal(segmentRank("APSOcore"), 1);
  assert.equal(segmentRank("ESO Customer"), 1);
  assert.equal(segmentRank("Growth Engine Customer"), 1);
  assert.equal(segmentRank("APSOlost"), 5);
  assert.equal(segmentRank("Something new"), null);
  const m = movesOf("segment", h(["2025-01-05T00:00:00Z", "APSOcore"], ["2025-02-01T00:00:00Z", "ESO Customer"], ["2025-03-01T00:00:00Z", "APSOlost"], ["2025-04-01T00:00:00Z", "Something new"]), "2025-01");
  assert.deepEqual(m.filter((x) => x.dir !== "set").map((x) => [x.month, x.dir]), [["2025-03", "down"]]);
});

test("potential: larger is up, smaller is down", () => {
  const m = movesOf("potential", h(["2024-12-01T00:00:00Z", "5000"], ["2025-06-01T00:00:00Z", "20000"], ["2026-01-01T00:00:00Z", "1000.5"]), "2025-01");
  assert.deepEqual(m.map((x) => [x.month, x.dir]), [["2025-06", "up"], ["2026-01", "down"]]);
});

test("a person is someone in HubSpot's screens or app; the engine and imports are not", () => {
  assert.equal(byPerson("CRM_UI"), true);
  assert.equal(byPerson("CRM_UI_BULK_ACTION"), true);
  assert.equal(byPerson("MOBILE_IOS"), true);
  assert.equal(byPerson("INTEGRATION"), false);
  assert.equal(byPerson("AUTOMATION_PLATFORM"), false);
  assert.equal(byPerson(undefined), false);
});

test("tally: counts per kind and month, by a person apart, and the from → to of priority and segment", () => {
  const moves = [
    ...movesOf("prio", h(["2024-01-01T00:00:00Z", "3"], ["2025-02-01T00:00:00Z", "2", "CRM_UI"]), "2025-01"),
    ...movesOf("prio", h(["2024-01-01T00:00:00Z", "3"], ["2025-02-15T00:00:00Z", "2"]), "2025-01"),
    ...movesOf("prio", h(["2024-01-01T00:00:00Z", "1"], ["2025-02-20T00:00:00Z", "2"]), "2025-01"),
    ...movesOf("potential", h(["2024-01-01T00:00:00Z", "100"], ["2025-02-20T00:00:00Z", "200", "CRM_UI"]), "2025-01"),
    ...movesOf("segment", h(["2025-02-01T00:00:00Z", "APSOmicro"]), "2025-01"),
  ];
  const t = tally(moves);
  assert.deepEqual(t.counts.prio["2025-02"], { up: 2, down: 1, set: 0, upPerson: 1, downPerson: 0 });
  assert.deepEqual(t.counts.potential["2025-02"], { up: 1, down: 0, set: 0, upPerson: 1, downPerson: 0 });
  assert.deepEqual(t.counts.segment["2025-02"], { up: 0, down: 0, set: 1, upPerson: 0, downPerson: 0 });
  assert.deepEqual(t.transitions.prio["2025-02"], { "Prio 3 → Prio 2": 2, "Prio 1 → Prio 2": 1 });
  assert.equal(t.transitions.segment["2025-02"], undefined);
  assert.deepEqual(Object.keys(t.transitions), ["prio", "segment"]);
});

test("firstMonth: where a property's history starts - values only, any order", () => {
  assert.equal(firstMonth(h(["2026-05-02T00:00:00Z", "2"], ["2026-08-01T00:00:00Z", "1"])), "2026-05");
  assert.equal(firstMonth([{ timestamp: "2025-01-01T00:00:00Z", value: "" }, { timestamp: "2025-03-01T00:00:00Z", value: "APSOcore" }]), "2025-03");
  assert.equal(firstMonth([]), "");
});
