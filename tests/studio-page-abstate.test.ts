import assert from "node:assert/strict";
import { test } from "node:test";
import { AB_STATE_LABEL, abApplies, abLineOf, abStateOf, activateAb, runningOn } from "../src/lib/content/studio/kinds/page/abState";
import { pageDoc } from "../src/lib/content/studio/kinds/page/model";

// Content v8 (SARCLA 10.11.2026, point 6): "A/B testing should be on top header - if I click activate then I can set it on
// the last step". The bar's control says Off / Planned / Running; Activate switches it on (the setup is the last step's).

const page = pageDoc({ source: "pick", env: "prod", path: "/de-CH/privacy", store: "de-CH" });

test("the three states, in the bar's words", () => {
  assert.deepEqual(Object.values(AB_STATE_LABEL), ["Off", "Planned", "Running"]);
  assert.equal(abStateOf(page, null), "off");
  const on = activateAb(page);
  assert.equal(abStateOf(on, null), "planned");
  // a test of AI testing & personalization running on the page beats a plan here
  assert.equal(abStateOf(on, { id: "4", name: "Privacy intro", paused: false }), "running");
  assert.equal(abStateOf(page, { id: "4", name: "Privacy intro", paused: true }), "running");
});

test("Activate: the version open against the page as it is - its split, goal and audience kept", () => {
  const was = { ...page, letter: "B", abTest: { ...page.abTest, split: 30, goal: "orders" as const, audience: "new" as const } };
  const on = activateAb(was);
  assert.equal(on.abTest.enabled, true);
  assert.equal(on.abTest.a, "page");
  assert.equal(on.abTest.b, "B");
  assert.equal(on.abTest.split, 30);
  assert.equal(on.abTest.goal, "orders");
  // on already: nothing changes
  const again = activateAb({ ...on, abTest: { ...on.abTest, a: "A", b: "B" } });
  assert.equal(again.abTest.a, "A");
});

test("the bar's line says what runs against what", () => {
  const on = activateAb(page);
  assert.equal(abLineOf(page, "off", null), "No A/B test on this page");
  assert.equal(abLineOf(on, "planned", null), "Version A against the page as it is · 50% see version A · Add to cart decides · Every visitor");
  assert.match(abLineOf(on, "running", { id: "4", name: "Privacy intro", paused: true }), /^Paused in AI testing & personalization: Privacy intro/);
});

test("only a page of the shop has a test to show - a new page is not on the shop yet", () => {
  assert.equal(abApplies(page), true);
  assert.equal(abApplies({ source: "pick", path: "" }), false);
  assert.equal(abApplies({ source: "new", path: "" }), false);
});

test("the test that runs on this very page: its environment and address, running or paused", () => {
  const tests = [
    { id: "1", name: "Home hero", status: "running", env: "prod", pages: ["/de-CH/"], kind: "test" },
    { id: "2", name: "Old privacy", status: "stopped", env: "prod", pages: ["/de-CH/privacy"], kind: "test" },
    { id: "3", name: "Privacy on ACC", status: "running", env: "acc", pages: ["/de-CH/privacy"], kind: "test" },
    { id: "4", name: "Privacy intro", status: "paused", env: "prod", pages: ["/fr-CH/protection-des-donnees", "/de-CH/privacy/"], kind: "test" },
  ];
  assert.deepEqual(runningOn(tests, "prod", "/de-CH/privacy"), { id: "4", name: "Privacy intro", paused: true });
  assert.deepEqual(runningOn(tests, "acc", "/de-CH/privacy"), { id: "3", name: "Privacy on ACC", paused: false });
  assert.equal(runningOn(tests, "prod", "/de-CH/agb"), null);
  // a personalisation is not an A/B test
  assert.equal(runningOn([{ ...tests[0], kind: "personalise" }], "prod", "/de-CH/"), null);
});
