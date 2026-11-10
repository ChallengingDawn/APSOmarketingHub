import assert from "node:assert/strict";
import { test } from "node:test";
import { ENV_OPTIONS, envFilter, pickedEnv, publishTargets, rowNote, storesFor, targetWhy, typedPath } from "../src/lib/content/studio/kinds/page/env";
import { pathInfo } from "../src/lib/content/studio/kinds/page/model";

// Content v8 (SARCLA 10.11.2026, point 7): "Page builder i can't select acc". The page picker offers the environment
// (Production | ACC) above STORE; ACC lists ACC's pages, opens them from acc.apsoparts.com, and the to-do works on ACC -
// its last step writes ACC's page to ACC only.

const isPage = (p: string) => !!pathInfo(p);

test("the picker offers Production first, then ACC", () => {
  assert.deepEqual(ENV_OPTIONS.map((o) => o.label), ["Production", "ACC"]);
});

test("a typed address says its environment; a path opens in the one shown", () => {
  assert.deepEqual(typedPath("https://acc.apsoparts.com/de-CH/privacy", isPage), { env: "acc", path: "/de-CH/privacy" });
  assert.deepEqual(typedPath("https://www.apsoparts.com/fr-CH/protection-des-donnees?x=1#top", isPage), { env: "prod", path: "/fr-CH/protection-des-donnees" });
  assert.deepEqual(typedPath("/de-CH/privacy", isPage), { env: null, path: "/de-CH/privacy" });
  assert.equal(typedPath("https://acc.apsoparts.com/de-CH/checkout/cart", isPage), null);
  assert.equal(pickedEnv(null, "acc"), "acc");
  assert.equal(pickedEnv("prod", "acc"), "prod");
});

test("the store views offered are those the index holds pages for in that environment", () => {
  const stores = [{ store: "de-CH", prod: 900, acc: 880 }, { store: "pl-PL", prod: 300, acc: 0 }, { store: "nl-INT", prod: 0, acc: 12 }];
  assert.deepEqual(storesFor("prod", stores, ["x"]), ["de-CH", "pl-PL"]);
  assert.deepEqual(storesFor("acc", stores, ["x"]), ["de-CH", "nl-INT"]);
  // the index not read yet: the picker's own list
  assert.deepEqual(storesFor("acc", [], ["de-CH", "fr-CH"]), ["de-CH", "fr-CH"]);
});

test("a row of ACC that production lacks says so", () => {
  assert.equal(rowNote({ env: "acc", onlyAcc: true }), "only on ACC");
  assert.equal(rowNote({ env: "acc" }), "");
  assert.equal(rowNote({ env: "prod", onlyAcc: true }), "");
});

test("the page index is asked for the environment picked", () => {
  assert.deepEqual(envFilter({ env: "acc", only: true }), { env: "acc", onlyAcc: true });
  assert.deepEqual(envFilter({ env: "prod", only: true }), { env: "prod", onlyAcc: false });
  assert.deepEqual(envFilter({ env: "staging" }), { env: null, onlyAcc: false });
  assert.deepEqual(envFilter({}), { env: null, onlyAcc: false });
});

test("the last step follows the to-do: a page of ACC is written to ACC only", () => {
  assert.deepEqual(publishTargets({ source: "pick", env: "acc" }), ["acc"]);
  assert.deepEqual(publishTargets({ source: "convert", env: "acc" }), ["acc"]);
  assert.deepEqual(publishTargets({ source: "pick", env: "prod" }), ["acc", "prod"]);
  // a new page made here goes to either
  assert.deepEqual(publishTargets({ source: "new", env: "acc" }), ["acc", "prod"]);
  assert.match(targetWhy({ source: "pick", env: "acc" }, "prod"), /ACC/);
  assert.equal(targetWhy({ source: "pick", env: "acc" }, "acc"), "");
  assert.equal(targetWhy({ source: "pick", env: "prod" }, "prod"), "");
});
