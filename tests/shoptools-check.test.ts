import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectTool } from "../src/lib/shopTools/check";

// A shop tool's page as the shop serves it: which footer bridge, and where the tool's frame points.
const GW = "https://vulcan-gateway-production.up.railway.app";
const frame = (src: string) => `<iframe class="apso-vulcan-frame" src="${src}" title="Vulcanised O-ring configurator"></iframe>`;

test("the page frames this gateway, under the current bridge", () => {
  const html = frame(`${GW}/landing/tools/vulcan?embed=1&amp;shop=https://acc.apsoparts.com/de-CH/`) + "<script>var BRIDGE = 'v10-tools';</script>";
  assert.deepEqual(inspectTool(html, "vulcan", GW), { footer: "v10-tools", page: "this", pageOrigin: null });
});

test("still on PricingHub, under v9", () => {
  const html = frame("https://commercehubbackend-production.up.railway.app/landing/tools/vulcan?embed=1&amp;shop=x") + "<script>var BRIDGE = 'v9-tools';</script>";
  assert.deepEqual(inspectTool(html, "vulcan", GW), { footer: "v9-tools", page: "pricinghub", pageOrigin: null });
});

test("another tool's frame is not this tool's; an address ending at the name counts", () => {
  const other = frame("https://o-ring-gateway-production.up.railway.app/landing/tools/oring?embed=1");
  assert.equal(inspectTool(other, "vulcan", GW).page, "missing");
  // "vulcanised" must not pass for "vulcan"
  assert.equal(inspectTool(frame(`${GW}/landing/tools/vulcanised`), "vulcan", GW).page, "missing");
  assert.equal(inspectTool(frame(`${GW}/landing/tools/vulcan`), "vulcan", GW).page, "this");
  assert.equal(inspectTool(frame("https://elsewhere.example/landing/tools/vulcan.html?x=1"), "vulcan", GW).page, "other");
});
