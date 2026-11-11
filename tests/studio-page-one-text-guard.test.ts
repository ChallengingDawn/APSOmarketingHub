import assert from "node:assert/strict";
import { test } from "node:test";
import { guardText } from "../src/lib/content/studio/kinds/page/plan/newpage";

// Content v12 (11.11.2026): the Kalrez page's hero, rewritten by the AI as ONE text, read "both in stock in our standard
// assortment" on ACC - the one AI road the word rules did not read. The one-text rewrite now runs them too.
test("one text rewritten by the AI loses its stock promise, the rest stays", () => {
  const said: string[] = [];
  const out = guardText("Order the affected O-rings until 27 November 2026. Switch to evolast® PB794 or PN794, both in stock in our standard assortment. Our team helps you case by case.", "", said, "");
  assert.equal(out, "Order the affected O-rings until 27 November 2026. Our team helps you case by case.");
  assert.equal(said.length, 1);
  assert.match(said[0], /stock or delivery promise/);
  const de: string[] = [];
  assert.equal(guardText("Sofort ab Lager lieferbar. Für Öle und Kraftstoffe.", "", de, ""), "Für Öle und Kraftstoffe.");
});
