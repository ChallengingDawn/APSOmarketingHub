import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOps, applyWithRoot, batches, cleanOps, diffOps, type Op } from "../src/lib/content/studio/doc";

// A studio's document saves as small changes, under the hub's 8 KB request limit (08.11.2026).

const doc = { subject: "Hello", blocks: [{ id: "a", text: "One" }, { id: "b", text: "Two" }], meta: { lang: "DE" } };

test("a change to one field is one small set", () => {
  const next = { ...doc, blocks: [doc.blocks[0], { id: "b", text: "Two!" }] };
  assert.deepEqual(diffOps(doc, next), [{ op: "set", path: ["blocks", 1, "text"], value: "Two!" }]);
  assert.deepEqual(applyOps(doc, diffOps(doc, next)), next);
  assert.deepEqual(diffOps(doc, doc), []);
});

test("a list that grew or moved is set whole; keys gone are cleared", () => {
  const grown = { ...doc, blocks: [...doc.blocks, { id: "c", text: "Three" }] };
  assert.deepEqual(diffOps(doc, grown), [{ op: "set", path: ["blocks"], value: grown.blocks }]);
  const { meta: _gone, ...noMeta } = doc;
  void _gone;
  assert.deepEqual(diffOps(doc, noMeta), [{ op: "set", path: ["meta"], value: null }]);
});

test("insert, remove, move and append do what they say; a change that no longer fits is skipped", () => {
  const ops: Op[] = [
    { op: "insert", path: ["blocks"], index: 1, value: { id: "x", text: "New" } },
    { op: "move", path: ["blocks"], from: 0, to: 2 },
    { op: "append", path: ["subject"], value: " world" },
    { op: "remove", path: ["blocks"], index: 9 },
    { op: "set", path: ["missing", 3, "x"], value: 1 },
  ];
  const out = applyOps(doc, ops) as typeof doc;
  assert.deepEqual(out.blocks.map((b) => b.id), ["x", "b", "a"]);
  assert.equal(out.subject, "Hello world");
  // the original is never touched
  assert.equal(doc.subject, "Hello");
});

test("two people changing two fields both keep theirs", () => {
  const anna: Op[] = [{ op: "set", path: ["subject"], value: "Anna's subject" }];
  const bert: Op[] = [{ op: "set", path: ["blocks", 0, "text"], value: "Bert's text" }];
  const out = applyOps(applyOps(doc, anna), bert);
  assert.equal(out.subject, "Anna's subject");
  assert.equal(out.blocks[0].text, "Bert's text");
});

test("batches fit one request each, and a long text arrives whole", () => {
  const long = "x".repeat(30_000);
  const ops: Op[] = [{ op: "set", path: ["blocks", 0, "text"], value: long }, { op: "set", path: ["subject"], value: "S" }];
  const b = batches(ops, 6_500);
  for (const one of b) assert.ok(new TextEncoder().encode(JSON.stringify(one)).length <= 6_500 + 200);
  const out = b.reduce((d, one) => applyOps(d, one), doc);
  assert.equal(out.blocks[0].text, long);
  assert.equal(out.subject, "S");
  // a big new list goes item by item
  const many = { ...doc, blocks: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, text: "y".repeat(400) })) };
  const out2 = batches(diffOps(doc, many), 6_500).reduce((d, one) => applyOps(d, one), doc);
  assert.deepEqual(out2, many);
});

test("only well-formed changes are taken; nothing reaches an object's prototype", () => {
  assert.equal(cleanOps([{ op: "set", path: ["__proto__", "x"], value: 1 }]), null);
  assert.equal(cleanOps([{ op: "drop", path: ["a"] }]), null);
  assert.equal(cleanOps("nope"), null);
  assert.deepEqual(cleanOps([{ op: "set", path: ["a", 0], value: 2 }]), [{ op: "set", path: ["a", 0], value: 2 }]);
  const polluted = applyOps({}, [{ op: "set", path: ["constructor", "prototype", "bad"], value: 1 }]);
  assert.equal(({} as Record<string, unknown>).bad, undefined);
  assert.deepEqual(polluted, {});
});

test("a whole new document replaces the old", () => {
  assert.deepEqual(applyWithRoot(doc, diffOps(doc, [1, 2])), [1, 2]);
});

test("a big new block goes in empty, then its fields - every request under the limit (08.11.2026)", () => {
  const big = { id: "n", kind: "text", text: "z".repeat(20_000), parts: ["p".repeat(7_000), "q"] };
  const ops: Op[] = [{ op: "insert", path: ["blocks"], index: 1, value: big }];
  const b = batches(ops, 6_500);
  for (const one of b) assert.ok(new TextEncoder().encode(JSON.stringify(one)).length <= 6_500 + 200);
  const out = b.reduce((d, one) => applyOps(d, one), doc);
  assert.deepEqual(out.blocks[1], big);
  assert.equal(out.blocks.length, 3);
});

