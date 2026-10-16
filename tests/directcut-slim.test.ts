import assert from "node:assert/strict";
import { test } from "node:test";
import { slim } from "../src/lib/directcut/board";

// THE PROJECTION IS THE WHOLE REASON THIS PAGE CAN LIVE IN THE HUB. The middleware's /admin/pipeline answers
// 967 KB (measured 16.10.2026): 852 cut-done cards are 531 KB of history nobody reads on first paint, and the
// per-plate rows inside stockImpact are another 152 KB. The hub is in Frankfurt and the gateway in Zurich, so
// shipping that on every board load is the one real cost of the move. slim() cuts it to 86 KB on the server.
//
// What these tests protect: the figures the page shows must survive the cut, the open stages must all be
// present, and the plate rows must NOT be.

const card = (over: Record<string, unknown> = {}) => ({
  key: "6009076",
  basis: "0232001119",
  basisName: "POM-C plate black · 15 mm sheet",
  cutArticle: "8001223260",
  l: 70, w: 32, qty: 500, heldQty: 500, producedQty: 0,
  stage: "to-cut" as const,
  orderNo: "12000021541",
  erpNo: "A26.665158.000",
  date: "2026-10-23",
  sawNeeded: true,
  kind: "cut",
  customer: "office@timmpt.at",
  enteredStageAt: "2026-10-13T09:38:06.304Z",
  createdAt: "2026-10-13T09:29:54.261Z",
  originBackend: false,
  ...over,
});

const pipeline = (over: Record<string, unknown> = {}) => ({
  at: "2026-10-16T06:00:00.000Z",
  counts: { reserved: 1, lapsed: 2, ordered: 0, "to-cut": 1, "cut-done": 3, closed: 0, total: 7 },
  stages: {
    reserved: [card({ key: "r1", stage: "reserved" })],
    lapsed: [card({ key: "l1", stage: "lapsed" }), card({ key: "l2", stage: "lapsed" })],
    ordered: [],
    "to-cut": [card()],
    "cut-done": [
      card({ key: "d1", stage: "cut-done", enteredStageAt: "2026-10-14T08:00:00.000Z" }),
      card({ key: "d2", stage: "cut-done", enteredStageAt: "2026-10-15T08:00:00.000Z" }),
      card({ key: "d3", stage: "cut-done", enteredStageAt: "2026-10-16T08:00:00.000Z" }),
    ],
    closed: [],
  },
  stockImpact: [
    {
      basis: "0232001119", name: "POM-C plate black · 15 mm sheet", thickness: 15, known: true,
      physicalPieces: 1, physical: 0, shownNet: 0, heldParts: 0, pinnedParts: 502, producedParts: 1,
      plates: [{ length: 1981, width: 402, qty: 1, full: false, available: 0, availableNet: 0, heldPct: 0 }],
    },
  ],
  ...over,
});

test("every figure the page shows survives the projection", () => {
  const b = slim(pipeline());
  const l = b.open.find((x) => x.key === "6009076");
  assert.ok(l, "the to-cut line is there");
  assert.equal(l.basis, "0232001119");
  assert.equal(l.name, "POM-C plate black · 15 mm sheet");
  assert.equal(l.qty, 500);
  // the split matters on its own: 500 ordered is not 500 servable
  assert.equal(l.held, 500);
  assert.equal(l.produced, 0);
  assert.equal(l.erpNo, "A26.665158.000");
  assert.equal(l.orderNo, "12000021541");
  assert.equal(l.sawNeeded, true);
  assert.equal(l.customer, "office@timmpt.at");
  assert.equal(l.fromShop, true, "originBackend false means the widget booked it");
  assert.equal(b.at, "2026-10-16T06:00:00.000Z");
  assert.equal(b.counts["cut-done"], 3);
});

test("open work is every stage a customer is waiting on, and lapsed is not one of them", () => {
  const b = slim(pipeline());
  const stages = [...new Set(b.open.map((l) => l.stage))].sort();
  assert.deepEqual(stages, ["reserved", "to-cut"], "reserved and to-cut are open; ordered was empty");
  assert.equal(b.open.some((l) => l.stage === "lapsed"), false, "an expired cart is not open work");
  assert.equal(b.open.some((l) => l.stage === "cut-done"), false);
});

test("finished lines come back newest first, and the count says how many there really are", () => {
  const b = slim(pipeline());
  assert.deepEqual(b.done.map((l) => l.key), ["d3", "d2", "d1"], "the pipeline sorts oldest-first; the page wants the opposite");
  assert.equal(b.doneTotal, 3);
});

test("only the last 100 finished lines travel, and the total still tells the truth", () => {
  const many = Array.from({ length: 400 }, (_, i) => card({ key: `d${i}`, stage: "cut-done" }));
  const b = slim(pipeline({ stages: { ...pipeline().stages, "cut-done": many } }));
  assert.equal(b.done.length, 100, "531 KB of history is not sent to a browser");
  assert.equal(b.doneTotal, 400, "but the page can still say there are 400");
});

test("the shelf keeps its counts and loses its plate rows", () => {
  const b = slim(pipeline());
  const a = b.stock[0];
  assert.equal(a.basis, "0232001119");
  assert.equal(a.physical, 0);
  assert.equal(a.offered, 0);
  assert.equal(a.pinned, 502, "pieces behind an order");
  assert.equal(a.produced, 1);
  assert.equal(a.plates, 1, "how many plate SIZES there are, not the rows themselves");
  // the rows are 152 KB of the gateway's answer and the page never shows them
  assert.equal("plates" in a && Array.isArray((a as unknown as { plates: unknown }).plates), false);
});

test("it does not fall over on a pipeline with nothing in it", () => {
  const b = slim({ at: "2026-10-16T06:00:00.000Z", counts: {}, stages: {}, stockImpact: [] });
  assert.deepEqual(b.open, []);
  assert.deepEqual(b.done, []);
  assert.equal(b.doneTotal, 0);
  assert.deepEqual(b.stock, []);
});

test("a line the ERP feed brought in is marked apart from one the widget booked", () => {
  // these carry no size and no basis, so the workshop view must not claim to know what to do with them
  const b = slim(pipeline({
    stages: {
      ...pipeline().stages,
      "to-cut": [card({ key: "8001265294", basis: null, basisName: null, l: 0, w: 0, kind: null, sawNeeded: null, erpNo: null, originBackend: true })],
    },
  }));
  const l = b.open.find((x) => x.key === "8001265294");
  assert.ok(l);
  assert.equal(l.fromShop, false);
  assert.equal(l.basis, null);
  assert.equal(l.sawNeeded, null, "no opinion, rather than a guess");
});
