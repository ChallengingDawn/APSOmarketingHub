import assert from "node:assert/strict";
import { test } from "node:test";
import { STORE_VIEWS } from "../src/lib/content/studio/kinds/page/storeViews";
import { newModule, normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { MODULES } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { SAMPLES2 } from "../src/lib/content/studio/kinds/page/modules/library2";
import { STOCK_WORDS } from "../src/lib/content/studio/kinds/banner/brand";

// Content v11 (SARCLA 10.11.2026, on the "change into another module" gallery): the Campaign poster's picture read
// "Schläuche und Armaturen, ab Lager". The modules' sample words (copied from the shop's own banners) promised stock and
// delivery times: "ab Lager", "48/72 h", "Lieferung ab Lager in Europa". They are what the gallery's pictures show and what
// a fill starts from, so none of them may promise stock or a delivery time, in any shop language.
const DELIVERY = /\b48\s*\/\s*72\b|\b(24|48|72)\s*(h|std|stunden|hours|heures|ore)\b|\b48 bis 72\b/i;
const textOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

test("no module's sample or default words promise stock or a delivery time, in any store view", () => {
  const stores = [...new Set(STORE_VIEWS.map((v) => v.key))];
  const bad: string[] = [];
  for (const d of MODULES) {
    for (const store of stores) {
      const m0 = newModule(d.id, store, "t1");
      const sample = { ...((d as { sample?: object }).sample ?? {}), ...(SAMPLES2[d.id]?.(store) ?? {}) };
      const m = normalizeModule({ type: d.id, settings: { ...m0.settings, ...sample } });
      if (!m) continue;
      const words = textOf(renderModule(m)) + " " + JSON.stringify(m.settings);
      const hit = words.match(STOCK_WORDS) ?? words.match(DELIVERY);
      if (hit) bad.push(`${d.id} (${store}): "${hit[0]}"`);
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 20), []);
});

// Content v11: a campaign with one date says what the date is - "until 27.11. 2026", never a bare date
test("a dated campaign with its end date alone says 'until' in the page's language", () => {
  const m = (store: string, extra: Record<string, string>) => normalizeModule({ type: "campaign-date", settings: { ...newModule("campaign-date", store, "t9").settings, title: "Kalrez", extra } })!;
  assert.match(textOf(renderModule(m("en-INT", { to: "27.11.2026" }))), /until 27\.11\. 2026/);
  assert.match(textOf(renderModule(m("de-CH", { to: "27.11.2026" }))), /bis 27\.11\. 2026/);
  assert.match(textOf(renderModule(m("fr-CH", { from: "16.11." }))), /dès le 16\.11\./);
  assert.doesNotMatch(textOf(renderModule(m("en-INT", { from: "16.11.", to: "06.12.2026" }))), /until|from/, "two dates: the word between them only");
});
