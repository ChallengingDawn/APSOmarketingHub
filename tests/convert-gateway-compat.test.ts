import assert from "node:assert/strict";
import { test } from "node:test";
import { normResults } from "../src/lib/convert/contract";
import { analyse } from "../src/lib/convert/stats";

// A results answer the DirectUp gateway (branch convert-runtime, src/convert/results.ts) really gave in its end-to-end
// run of 08.11.2026 - the hub must read it as it comes (counts, segments, weights) and work its figures out.
const GATEWAY_RESULTS = {"id":"12","v":1,"since":"2026-11-07T23:41:42.259Z","variants":[{"key":"a","visitors":9,"carts":2,"views":9,"applyMisses":0},{"key":"b","visitors":13,"carts":3,"views":14,"applyMisses":0}],"daily":[{"day":"2026-11-08","key":"a","visitors":9,"carts":2},{"day":"2026-11-08","key":"b","visitors":13,"carts":3}],"segments":{"device":[{"value":"desktop","key":"b","visitors":13,"carts":3},{"value":"desktop","key":"a","visitors":9,"carts":2}],"store":[{"value":"de-CH","key":"b","visitors":13,"carts":3},{"value":"de-CH","key":"a","visitors":9,"carts":2}],"login":[{"value":"guest","key":"b","visitors":13,"carts":3},{"value":"guest","key":"a","visitors":9,"carts":2}],"visitor":[{"value":"new","key":"b","visitors":13,"carts":3},{"value":"new","key":"a","visitors":9,"carts":2}],"source":[{"value":"direct","key":"b","visitors":9,"carts":3},{"value":"direct","key":"a","visitors":8,"carts":2},{"value":"search","key":"b","visitors":3,"carts":0},{"value":"ads","key":"b","visitors":1,"carts":0},{"value":"search","key":"a","visitors":1,"carts":0}]},"weights":{"a":0.5078,"b":0.4922},"weightsHistory":[{"at":"2026-11-07T23:41:40.295Z","a":0.5,"b":0.5},{"at":"2026-11-07T23:42:38.511Z","a":0.5078,"b":0.4922}]};

test("the gateway's real results answer reads into the hub's figures", () => {
  const r = normResults(GATEWAY_RESULTS, String(GATEWAY_RESULTS.id ?? "t"), Number(GATEWAY_RESULTS.v ?? 1));
  assert.deepEqual(r.variants.map((v) => [v.key, v.visitors, v.carts]), [["a", 9, 2], ["b", 13, 3]]);
  assert.ok(r.daily.length > 0);
  for (const dim of ["device", "store", "login", "visitor", "source"] as const) assert.ok(r.segments[dim].length > 0, dim);
  assert.ok(r.weights && Math.abs(r.weights.a + r.weights.b - 1) < 0.01);
  const a = analyse(r, new Date(Date.parse(r.since ?? "2026-11-08") + 86_400_000));
  assert.equal(a.verdict.key, "running");
  assert.ok(a.comparison.pBest && a.comparison.pBest.a + a.comparison.pBest.b > 0.99);
});
