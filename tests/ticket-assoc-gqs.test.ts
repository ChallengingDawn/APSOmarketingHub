import assert from "node:assert/strict";
import { test } from "node:test";
import { planGqs } from "../src/lib/ticketAssoc/gqsTypeRules";

const ESO = "1726599376", TSA = "1726599377", BO = "2338266298";

test("an ESO / TSA ticket newly linked to a GQS request gets GQS - live writes, preview lists", () => {
  assert.deepEqual(planGqs({ pipeline: ESO, type: null }, undefined, true), { what: "set", next: ESO });
  assert.deepEqual(planGqs({ pipeline: TSA, type: "Running Business" }, undefined, true), { what: "set", next: TSA });
  assert.deepEqual(planGqs({ pipeline: ESO, type: null }, undefined, false), { what: "would", next: `${ESO}:would` });
  // preview lists it once; once live, it is written
  assert.deepEqual(planGqs({ pipeline: ESO, type: null }, `${ESO}:would`, false), { what: null, next: `${ESO}:would` });
  assert.deepEqual(planGqs({ pipeline: ESO, type: null }, `${ESO}:would`, true), { what: "set", next: ESO });
});

test("a ticket that already carries GQS is listed once, then nothing", () => {
  assert.deepEqual(planGqs({ pipeline: ESO, type: "GQS" }, undefined, true), { what: "already", next: ESO });
  assert.deepEqual(planGqs({ pipeline: ESO, type: "GQS" }, ESO, true), { what: null, next: ESO });
  // the workflow (or the hub) set it after preview listed it
  assert.deepEqual(planGqs({ pipeline: ESO, type: "GQS" }, `${ESO}:would`, false), { what: null, next: ESO });
});

test("as the workflow: a person who changes it afterwards is left alone - a move into ESO / TSA sets it again", () => {
  assert.deepEqual(planGqs({ pipeline: ESO, type: "Running Business" }, ESO, true), { what: "left", next: `${ESO}:left` });
  assert.deepEqual(planGqs({ pipeline: ESO, type: "Running Business" }, `${ESO}:left`, true), { what: null, next: `${ESO}:left` });
  assert.deepEqual(planGqs({ pipeline: TSA, type: "Running Business" }, `${ESO}:left`, true), { what: "set", next: TSA }, "moved from ESO to TSA: re-enrolled");
  assert.deepEqual(planGqs({ pipeline: ESO, type: "GQS" }, `${ESO}:left`, true), { what: null, next: ESO }, "a person put GQS back");
});

test("other pipelines are not touched", () => {
  assert.deepEqual(planGqs({ pipeline: BO, type: null }, undefined, true), { what: null, next: undefined });
  assert.deepEqual(planGqs({ pipeline: null, type: null }, ESO, true), { what: null, next: ESO });
});
