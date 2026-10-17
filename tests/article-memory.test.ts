import assert from "node:assert/strict";
import { test } from "node:test";
import { articleOf, internalIdsOn, isArticleNumber, linePc, linesWithoutPcOn, repairOrder, unresolvedIds, type ArtInfo, type LiveLine } from "../src/lib/connectors/steps/orderRules";

const line = (key: string, artno: string, rlc = 10): LiveLine => ({ d: "20261001", gone: false, key, artno, unit: "Stk", qty: 1, sq: 1, rlc, clc: 5, rtc: rlc, meur: 5 });
const DIM = new Map<string, ArtInfo>([["630093", ["DT", "1222010102", "Chair leg buffer"]]]);

test("an order line's article: dim_article by key, then the hub's memory by internal id, then the raw id", () => {
  const known = new Map<string, ArtInfo>([["570483", ["KT", "8000394400", "Made to order"]]]);
  assert.deepEqual(articleOf(line("630093", "178251"), { art: DIM, fixmap: {}, known }), ["DT", "1222010102", "Chair leg buffer"]);
  // the made-to-order article: today's dim_article lacks the key, the memory knows the id
  assert.deepEqual(articleOf(line("999999", "570483"), { art: DIM, fixmap: {}, known }), ["KT", "8000394400", "Made to order"]);
  assert.deepEqual(articleOf(line("999999", "570483"), { art: DIM, fixmap: {} }), ["", "570483", ""]);
});

test("the lines left on an internal id are the ones nothing resolves", () => {
  const ctx = { art: DIM, fixmap: {}, known: new Map<string, ArtInfo>([["570483", ["KT", "8000394400", ""]]]) };
  assert.deepEqual(unresolvedIds([line("630093", "178251"), line("1", "570483"), line("2", "14136666"), { d: "x", gone: true }], ctx), ["14136666"]);
  assert.equal(isArticleNumber("1222010102"), true);
  assert.equal(isArticleNumber("570483"), false);
});

test("repairing an order: only the lines on a known internal id, the line properties and the main profit centre", () => {
  const before = JSON.stringify([
    { a: "1222010102", q: 1, r: 50, gm: 20, pc: "DT", t: "Chair leg buffer" },
    { a: "570483", q: 2, r: 300, gm: null, pc: "", t: "" },
    { a: "14136666", q: 1, r: 5, gm: null, pc: "", t: "" },
  ]);
  assert.deepEqual(internalIdsOn(before), ["570483", "14136666"]);
  const known = new Map<string, ArtInfo>([["570483", ["KT", "8000394400", "Made to order part"]]]);
  const r = repairOrder(before, known);
  assert.deepEqual(r.fixed, ["570483"]);
  assert.equal(r.patch.order_line_02_article, "8000394400");
  assert.equal(r.patch.order_line_02_pc, "KT");
  assert.equal(r.patch.order_line_01_article, undefined); // resolved lines untouched
  assert.equal(r.patch.order_profit_center, "KT"); // 300 KT against 50 DT
  const after = JSON.parse(r.patch.order_positions_json);
  assert.deepEqual(after.map((p: { a: string; pc: string }) => [p.a, p.pc]), [["1222010102", "DT"], ["8000394400", "KT"], ["14136666", ""]]);
  assert.deepEqual(internalIdsOn(r.patch.order_positions_json), ["14136666"]);
  // nothing known: no patch at all
  assert.deepEqual(repairOrder(before, new Map()), { patch: {}, fixed: [] });
  assert.deepEqual(repairOrder("not json", known), { patch: {}, fixed: [] });
});

test("a line the old fixmap resolved without a profit centre: noted by its article, repaired by number", () => {
  const fixmap = { "48737": { n: "0650454103", t: "", pc: "", conf: "medium" } };
  // nothing else knows the id: the fixmap gives the article, not the profit centre - noted as the article
  assert.deepEqual(unresolvedIds([line("1", "48737"), line("630093", "178251")], { art: DIM, fixmap }), ["0650454103"]);
  // once the memory knows the fixmap id (learnt by number), it answers before the fixmap
  const known = new Map<string, ArtInfo>([["48737", ["FT", "0650454103", "O-ring"]]]);
  assert.deepEqual(articleOf(line("1", "48737"), { art: DIM, fixmap, known }), ["FT", "0650454103", "O-ring"]);
  assert.deepEqual(unresolvedIds([line("1", "48737")], { art: DIM, fixmap, known }), []);

  const before = JSON.stringify([
    { a: "0650454103", q: 120, r: 570, gm: 75.9, pc: "", t: "" },
    { a: "1222010102", q: 1, r: 50, gm: 20, pc: "DT", t: "Chair leg buffer" },
  ]);
  assert.deepEqual(linesWithoutPcOn(before), ["0650454103"]);
  assert.deepEqual(internalIdsOn(before), []); // not an internal id
  const r = repairOrder(before, new Map<string, ArtInfo>([["0650454103", ["FT", "0650454103", "O-ring"]]]));
  assert.deepEqual(r.fixed, ["0650454103"]);
  assert.equal(r.patch.order_line_01_pc, "FT");
  assert.equal(r.patch.order_profit_center, "FT"); // 570 FT against 50 DT
  assert.deepEqual(linesWithoutPcOn(r.patch.order_positions_json), []);
  // Products & Pricing keeps the new profit centre: ASW is written as FT, like every other line of FT
  assert.equal(linePc("ASW"), "FT");
  assert.equal(linePc("dt"), "DT");
  assert.equal(linePc("UNKNOWN"), "");
  assert.equal(linePc("PW"), "PW"); // a code the order's main profit centre does not list: kept on the line
  assert.equal(linePc(null), "");
  // the memory knows the article but no profit centre: nothing to change
  assert.deepEqual(repairOrder(before, new Map<string, ArtInfo>([["0650454103", ["", "0650454103", "O-ring"]]])), { patch: {}, fixed: [] });
});
