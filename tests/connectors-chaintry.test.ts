import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_CHAIN_TRIES, deliverySig, nextTry } from "../src/lib/connectors/chainTry";

// A hub copy that runs out of memory mid-run loses the downloaded files with its disk; the
// delivery is tried again on the next tick, twice at most - never a server down every 15 minutes.
test("a delivery cut short is tried again, then given up on", () => {
  const sig = deliverySig([{ remote: "dim_order.csv", size: 480, mtime: 2 }, { remote: "export.xml", size: 166, mtime: 1 }]);
  const first = nextTry(null, sig, 100);
  assert.deepEqual(first, { giveUp: false, save: { sig, n: 1, at: 100 } });
  const second = nextTry(first.save, sig, 200);
  assert.deepEqual(second, { giveUp: false, save: { sig, n: 2, at: 200 } });
  const third = nextTry(second.save, sig, 300);
  assert.equal(third.giveUp, true);
  assert.equal(third.save.n, MAX_CHAIN_TRIES);
});

test("a new delivery starts its own count", () => {
  const old = deliverySig([{ remote: "dim_order.csv", size: 480, mtime: 2 }]);
  const fresh = deliverySig([{ remote: "dim_order.csv", size: 481, mtime: 3 }]);
  assert.notEqual(old, fresh);
  assert.deepEqual(nextTry({ sig: old, n: 2, at: 1 }, fresh, 5), { giveUp: false, save: { sig: fresh, n: 1, at: 5 } });
});

test("the signature does not depend on the listing order", () => {
  const a = { remote: "a.csv", size: 1, mtime: 1 };
  const b = { remote: "b.csv", size: 2, mtime: 2 };
  assert.equal(deliverySig([a, b]), deliverySig([b, a]));
});
