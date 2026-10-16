import assert from "node:assert/strict";
import { test } from "node:test";
import { declared, inspect } from "../src/lib/directup/check";

// What a store view's DirectUP page says about the three snippets, read the way the shop serves it.
const GW = "https://directup-gateway-production.up.railway.app";
const page = (body: string) => `<!doctype html><html><head>${body}</head><body></body></html>`;

test("a page with all three snippets", () => {
  const html = page(
    `<link rel="preconnect" href="${GW}" crossorigin>` +
    `<iframe src="${GW}/landing/tools/directup?v=8&amp;embed=1&amp;shop=https://www.apsoparts.com/fr-CH/" title="DirectUP"></iframe>` +
    `<script>(function () { var BRIDGE = 'v9-tools'; window.__directupBridge = BRIDGE; })();</script>`);
  assert.deepEqual(inspect(html, GW), { footer: "v9-tools", head: true, page: "this", pageOrigin: null });
});

test("an older bridge, no head, the page still framing PricingHub", () => {
  const html = page(
    `<iframe src="https://commercehubbackend-production.up.railway.app/landing/tools/directup.html?v=7&embed=1"></iframe>` +
    `<script>window.__directupBridge = 'v8-tools';</script>`);
  assert.deepEqual(inspect(html, GW), { footer: "v8-tools", head: false, page: "other", pageOrigin: "https://commercehubbackend-production.up.railway.app" });
});

test("nothing installed", () => {
  assert.deepEqual(inspect(page("<p>Veuillez vous connecter</p>"), GW), { footer: null, head: false, page: "missing", pageOrigin: null });
});

test("the store views come from the page's own hreflang links", () => {
  const html = page(
    '<link rel="alternate" href="https://www.apsoparts.com/fr-CH/directup?cb=1" hreflang="fr-CH" />' +
    '<link rel="alternate" href="https://www.apsoparts.com/en-INT/directup?cb=1" hreflang="x-default" />' +
    '<link rel="alternate" href="https://www.apsoparts.com/fr-INT/directup?cb=1" hreflang="fr" />');
  assert.deepEqual([...declared(html).entries()], [
    ["fr-CH", "https://www.apsoparts.com/fr-CH/directup"],
    ["en-INT", "https://www.apsoparts.com/en-INT/directup"],
    ["fr-INT", "https://www.apsoparts.com/fr-INT/directup"],
  ]);
});

test("a footer bridge counts as current from v12 on - a newer one pasted before the hub knows it is not 'older'", async () => {
  const { bridgeNumber, isCurrentBridge } = await import("../src/lib/directup/bridge");
  assert.equal(bridgeNumber("v12-tools"), 12);
  assert.equal(bridgeNumber("v9-tools"), 9);
  assert.equal(bridgeNumber(null), 0);
  assert.equal(isCurrentBridge("v12-tools"), true);
  assert.equal(isCurrentBridge("v13-tools"), true);
  assert.equal(isCurrentBridge("v11-tools"), false);
  assert.equal(isCurrentBridge(null), false);
});
