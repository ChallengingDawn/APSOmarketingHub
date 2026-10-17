import assert from "node:assert/strict";
import { test } from "node:test";
import { articleCandidates, productCandidates, shopLinks } from "../src/lib/connectors/steps/ticketRules";

test("shop links: the product of a product page, the article of a chosen size - with or without https, any store view", () => {
  assert.deepEqual(shopLinks("see https://www.apsoparts.com/de-CH/eur/06555127-universal-food-drink-upe-mit-spirale.html thanks"), { articles: [], products: ["06555127"] });
  assert.deepEqual(shopLinks("www.apsoparts.com/fr-CH/11400711-o-ring.html?sku=0111104030&q=1"), { articles: ["0111104030"], products: ["11400711"] });
  assert.deepEqual(shopLinks('<a href="https://www.apsoparts.com/it-IT/product_0111104030">questo</a>'), { articles: ["0111104030"], products: [] });
  // a phone number or another site is not a shop link
  assert.deepEqual(shopLinks("call +41 44 123 45 67 or see https://example.com/06555127-x.html"), { articles: [], products: [] });
});

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
