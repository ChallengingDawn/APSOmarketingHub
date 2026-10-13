import assert from "node:assert/strict";
import { test } from "node:test";
import { deltas } from "../src/lib/threeD/counts";

const c = (n: number, kind = "aplink", source = "catalogue", locale: string | null = "de") => ({ day: "2026-10-14", source, locale, kind, n });

test("the hub adds only what grew since its last look, within one gateway start", () => {
  const first = deltas(null, "boot-1", [c(5), c(2, "check")]);
  assert.deepEqual(first.add.map((x) => x.n), [5, 2]);
  const second = deltas({ bootId: "boot-1", counts: first.seen }, "boot-1", [c(8), c(2, "check")]);
  assert.deepEqual(second.add, [c(3)], "3 more AP-Link calls, no new checks");
});

test("a restarted gateway (new bootId) starts from zero - its counters are new", () => {
  const prev = deltas(null, "boot-1", [c(50)]);
  const after = deltas({ bootId: "boot-1", counts: prev.seen }, "boot-2", [c(4)]);
  assert.deepEqual(after.add, [c(4)]);
});

test("a source without a store view is kept apart from one with", () => {
  const out = deltas(null, "b", [c(1, "aplink", "hubspot-card", null), c(1, "aplink", "product-page", "fr")]);
  assert.equal(Object.keys(out.seen).length, 2);
});
