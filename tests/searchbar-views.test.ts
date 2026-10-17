import assert from "node:assert/strict";
import { test } from "node:test";
import { GROUPS, VIEWS, tryUrl, viewForTier } from "../src/app/website/search-bar/views";

// The Dynamic views tab (SARCLA 17.10.2026): every view the bar shows, each with searches that reach it; the
// logged answer types read as the view's name in the Searches tab; a search opens the shop with #apss-q=.

test("every view is complete and in a known group; ids are unique", () => {
  const ids = new Set<string>();
  for (const v of VIEWS) {
    assert.ok(!ids.has(v.id), `duplicate id ${v.id}`);
    ids.add(v.id);
    assert.ok((GROUPS as readonly string[]).includes(v.group), `${v.id}: group ${v.group}`);
    assert.ok(v.name && v.what.length > 20, `${v.id}: name and what`);
    assert.ok(v.examples.length > 0 || v.hint, `${v.id}: a search to try, or a hint how to see it`);
  }
  assert.equal(VIEWS.length, 77);
  for (const g of GROUPS) assert.ok(VIEWS.some((v) => v.group === g), `no view in ${g}`);
});

test("a logged answer type belongs to one view only", () => {
  const seen = new Map<string, string>();
  for (const v of VIEWS) for (const t of v.tiers) {
    assert.ok(!seen.has(t), `${t} in ${seen.get(t)} and ${v.id}`);
    seen.set(t, v.id);
  }
});

test("logged answer types read as the view's name, categories included", () => {
  const cases: [string, string | null][] = [
    ["rod-dim", "round-bars-at-diameter"], ["sku", "article-number"], ["material-dim", "o-ring-size-material"],
    ["drivepart-coupling", "drive-components"], ["drivepart-timing-pulley-dim", "drive-components-at-size"],
    ["antivib-airspring", "anti-vibration"], ["antivib-airspring-dim", "anti-vibration-at-size"], ["antivib-load", "anti-vibration-by-load"],
    ["hose-brand", "hoses"], ["tape-dim", "foils-tapes-at-thickness"], ["nonsense", null],
  ];
  for (const [tier, id] of cases) assert.equal(viewForTier(tier)?.id ?? null, id, tier);
});

test("a search opens the shop's store view with the bar searching it", () => {
  assert.equal(tryUrl("de-CH", "o-ring 20x2 nbr"), "https://www.apsoparts.com/de-CH/#apss-q=o-ring%2020x2%20nbr");
  assert.equal(tryUrl("fr-CH", "120°c"), "https://www.apsoparts.com/fr-CH/#apss-q=120%C2%B0c");
  assert.equal(tryUrl("en-INT", "a&b#c"), "https://www.apsoparts.com/en-INT/#apss-q=a%26b%23c");
});
