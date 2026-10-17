import assert from "node:assert/strict";
import { test } from "node:test";
import { articleCandidates, productCandidates } from "../src/lib/connectors/steps/ticketRules";

test("articles written in groups are found - space, dash, dot, slash (SARCLA 17.10.2026)", () => {
  for (const s of ["Art 1120 030 724 please", "1120-030-724", "1120.030.724", "1120/030/724", "1120030724"]) {
    assert.deepEqual([...articleCandidates(s)], ["1120030724"], s);
  }
});

test("a quantity beside a grouped article does not hide it", () => {
  assert.deepEqual([...articleCandidates("1120 030 724 5 pcs")], ["1120030724"]);
  assert.deepEqual([...articleCandidates("Qty 5 1120 030 724")], ["1120030724"]);
});

test("order numbers and dates are not articles; a phone number is only a candidate (the catalogue rejects it)", () => {
  assert.deepEqual([...articleCandidates("A26.123456.000 and 17.10.2026")], []);
  assert.deepEqual([...articleCandidates("call 044 123 45 67")], ["0441234567"]);
});

test("eight-digit numbers are collected as possible product numbers, never as articles", () => {
  assert.deepEqual(productCandidates("product 11411201 and article 1120030724"), ["11411201"]);
  assert.deepEqual([...articleCandidates("product 11411201")], []);
});
