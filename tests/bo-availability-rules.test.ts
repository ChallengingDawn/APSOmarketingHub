import assert from "node:assert/strict";
import { test } from "node:test";
import { BO_STAGES, GQS_STAGES, PEOPLE, PROPS, STAGES, changesFor, statusOf } from "../src/lib/boAvailability/rules";

test("HubSpot's status as the workflow read it: nothing or unknown counts as there", () => {
  assert.equal(statusOf("available"), "Available");
  assert.equal(statusOf("Available"), "Available");
  assert.equal(statusOf("away"), "Away");
  assert.equal(statusOf("busy"), "Away");
  assert.equal(statusOf(null), "Available");
  assert.equal(statusOf(""), "Available");
  assert.equal(statusOf("unknown"), "Available");
});

test("the six people and their properties, the workflow's open stages without the one that no longer exists", () => {
  assert.equal(PEOPLE.length, 6);
  assert.deepEqual(PROPS, ["claudia_cagnoni", "claudio_gabinato_status", "maida_osmani_status", "vanessa_battaglia_status", "adriana_deblander_status", "sara_gashi"]);
  assert.equal(Object.keys(BO_STAGES).length, 5);
  assert.deepEqual(Object.values(GQS_STAGES).sort(), ["Remind Back-Office", "Waiting on APSO", "Waiting on GQS"]);
  assert.equal(STAGES.length, 8);
  assert.ok(!STAGES.includes("2338266328")); // Resolved is not an open ticket
});

test("only what changed is written; a ticket already right gets nothing", () => {
  const want = { maida_osmani_status: "Away", claudia_cagnoni: "Available" } as const;
  assert.deepEqual(changesFor({ maida_osmani_status: "Away", claudia_cagnoni: "Available" }, want), {});
  assert.deepEqual(changesFor({ maida_osmani_status: "Available", claudia_cagnoni: "Available" }, want), { maida_osmani_status: "Away" });
  assert.deepEqual(changesFor({}, want), { maida_osmani_status: "Away", claudia_cagnoni: "Available" });
  // a person the hub did not find is not in "want": the ticket's value stays
  assert.deepEqual(changesFor({ sara_gashi: "Away" }, { claudia_cagnoni: "Available" }), { claudia_cagnoni: "Available" });
});
