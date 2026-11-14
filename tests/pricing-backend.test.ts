import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedPath, stampBody, stampQuery, writePages } from "../src/lib/pricing/backend";

// The Pricing app's route to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)

test("only the areas the Pricing pages use pass - not the shop tools', not DoC's, nothing that walks out", () => {
  assert.equal(allowedPath(["matches", "approve-group"]), true);
  assert.equal(allowedPath(["products", "filters"]), true);
  assert.equal(allowedPath(["purchasing", "lists", "12"]), true);
  for (const p of [["doc", "resolve"], ["directup", "jobs"], ["oring"], ["rwdr"], ["hub", "legacy-prefs"], [], ["..", "doc"], ["matches", ".."], ["matches", "a/b"]]) {
    assert.equal(allowedPath(p), false, p.join("/"));
  }
  // the HubSpot card's routes: the Benchmark's manual price only - never the card pass, never competitor prices
  assert.equal(allowedPath(["card", "manual-price"]), true);
  assert.equal(allowedPath(["card", "manual-price", "4", "file"]), true);
  assert.equal(allowedPath(["card", "pass"]), false);
  assert.equal(allowedPath(["card", "competitor-prices"]), false);
});

test("a change needs Edit on a page it is made from", () => {
  assert.ok(writePages(["matches", "approve-group"]).includes("/pricing/matches/pending"));
  assert.ok(writePages(["matches", "7"]).includes("/pricing/prices"));
  assert.deepEqual(writePages(["analytics", "repricing-refresh"]), ["/pricing/repricing"]);
  assert.ok(writePages(["products", "sync"]).includes("/pricing/matches"));
  assert.ok(!writePages(["products", "7"]).includes("/pricing/matches"));
  assert.deepEqual(writePages(["card", "manual-price"]), ["/pricing/benchmark"]);
  assert.deepEqual(writePages(["scrapers", "trigger", "x"]), ["/pricing/competitors"]);
  assert.deepEqual(writePages(["dimensions", "scrape"]), ["/pricing/scrapers"]);
  assert.deepEqual(writePages(["anyseals", "sync", "3"]), ["/pricing/stock"]);
  assert.deepEqual(writePages(["dashboard", "kpis"]), []);
});

test("the person on a change is the hub's, never what the browser wrote", () => {
  const who = { email: "anna@apsoparts.com", name: "Anna" };
  const b = JSON.parse(stampBody(JSON.stringify({ ids: [1], user_email: "someone@else.com", approved_by: "x" }), who));
  assert.deepEqual(b, { ids: [1], user_email: "anna@apsoparts.com", user_name: "Anna", approved_by: "anna@apsoparts.com" });
  // no approved_by asked for, none added
  assert.equal("approved_by" in JSON.parse(stampBody("{}", who)), false);
  // not an object: as it came
  assert.equal(stampBody("[1,2]", who), "[1,2]");
  assert.equal(stampBody("not json", who), "not json");
  const q = stampQuery(new URLSearchParams("reason=dup&user_email=x@y.z"), who);
  assert.equal(q.get("user_email"), "anna@apsoparts.com");
  assert.equal(q.get("reason"), "dup");
  assert.equal(stampQuery(new URLSearchParams("a=1"), who).has("user_email"), false);
  assert.equal(stampQuery(new URLSearchParams("a=1"), who, true).get("user_name"), "Anna");
});
