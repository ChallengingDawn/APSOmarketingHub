import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ArticlesSheet, PRODUCT_KEYS, articleFacts, checkFacts, factsHash, packFacts, sameValues, stockUnitCall, unpackFacts, type ArticleRow,
} from "../src/lib/connectors/steps/productFactsRules";

const HEAD = ["[Article]", "[InLiquidation]", "[GwstdpCurrency]", "[GwstdpCHF]", "[GwstdpEUR]", "[GwstdpUSD]", "[StockUnit]", "[SalesUnit]",
  "[Material]"]; // a column the rules do not read (the articles step writes it) is ignored

test("product facts: the articles sheet - the header by its names, only the articles HubSpot has, the first row of each", () => {
  const s = new ArticlesSheet((a) => a !== "9999999999");
  s.feed(1, ["a title"]);
  s.feed(2, HEAD);
  s.feed(3, ["1120030001", "N", "EUR", 1234.5, 1300, 1450.2, "kg", "Stk", "NBR"]);
  s.feed(4, ["1120030001", "J", "EUR", 1, 1, 1, "m", "m", ""]); // the same article again
  s.feed(5, ["9999999999", "N", "CHF", 100, 100, 100, "Stk", "Stk", ""]); // not in HubSpot
  s.feed(6, [null]);
  const m = s.finish()!;
  assert.equal(m.size, 1);
  assert.equal(s.rows, 3);
  assert.equal(s.skipped, 1);
  assert.deepEqual(unpackFacts(m.get("1120030001")!), {
    // per stock unit = the ERP's price per 100 units / 100, in each currency; the lead currency beside it
    unit_cost_chf: "12.345", unit_cost_eur: "13", unit_cost_usd: "14.502", currency: "EUR",
    stock_unit: "kg", article_status: "Running Article",
  });
  const none = new ArticlesSheet();
  none.feed(1, ["Article", "Price"]);
  assert.equal(none.finish(), null);
});

test("product facts: the GWStdP's placeholder never written, the ERP's 'Unknown' unit is none, nothing invented", () => {
  const base = { article: "", inliquidation: "", gwstdpcurrency: "", gwstdpchf: "", gwstdpeur: "", gwstdpusd: "", stockunit: "", salesunit: "", suppliername: "" } satisfies ArticleRow;
  assert.deepEqual(articleFacts({ ...base, article: "1", gwstdpcurrency: "EUR", gwstdpchf: "200", inliquidation: "J", stockunit: "Stk" }),
    { unit_cost_chf: "2", currency: "EUR", stock_unit: "Stk", article_status: "Liquidation" });
  assert.deepEqual(articleFacts({ ...base, article: "2", gwstdpcurrency: "EUR", gwstdpchf: "0.01", gwstdpeur: "0.01", stockunit: "Unknown" }), { currency: "EUR" });
  assert.deepEqual(articleFacts({ ...base, article: "3", gwstdpchf: "0" }), {});
  const f = articleFacts({ ...base, article: "4", gwstdpchf: "50", suppliername: "Trelleborg" });
  assert.deepEqual(unpackFacts(packFacts(f)), f);
  assert.equal(packFacts(f).split("\u0001").length, PRODUCT_KEYS.length);
});

test("product facts: the stock unit only where it does not move who writes the stock", () => {
  assert.equal(stockUnitCall("Stk", "", "Stk"), "write"); // empty, same as the sales unit: the gateway keeps the stock
  assert.equal(stockUnitCall("m", "", ""), "write");
  assert.equal(stockUnitCall("Stk", "Pcs", "Stk"), "same"); // another spelling of the same unit: left as HubSpot has it
  assert.equal(stockUnitCall("kg", "Kg", "Stk"), "same");
  assert.equal(stockUnitCall("kg", "", "Stk"), "moves_stock"); // kg held, sold by the piece: the stock would change writer
  assert.equal(stockUnitCall("m", "kg", "Stk"), "write"); // another unit, still cross-unit: the cost's unit is corrected
  assert.equal(stockUnitCall("Stk", "kg", "Stk"), "moves_stock");
  assert.equal(stockUnitCall("Stk", "", "100 Pcs"), "write"); // a multiple of the same unit is not cross-unit
  assert.equal(stockUnitCall(undefined, "", "Stk"), "none");
});

test("product facts: only properties HubSpot has, a choice list's listed values, nothing the stock step writes when live", () => {
  const props = new Map<string, Set<string> | null>([["unit_cost_chf", null], ["currency", new Set(["CHF", "EUR"])], ["stock_unit", new Set(["Stk", "kg"])]]);
  const f = { unit_cost_chf: "2", unit_cost_eur: "1.9", currency: "GBX", stock_unit: "kg" };
  assert.deepEqual(checkFacts(f, { props, stockStepLive: false }), {
    facts: { unit_cost_chf: "2", stock_unit: "kg" },
    dropped: { unit_cost_eur: "no such property in HubSpot", currency: "not one of its options" },
  });
  assert.deepEqual(checkFacts(f, { props, stockStepLive: true }).facts, { stock_unit: "kg" });
  assert.equal(factsHash({ b: "1", a: "2" }), factsHash({ a: "2", b: "1" }));
});

test("product facts: what HubSpot already holds is not written again (numbers as numbers)", () => {
  assert.equal(sameValues({ unit_cost_chf: "1.5", stock_unit: "kg" }, { unit_cost_chf: "1.50", stock_unit: "kg" }), true);
  assert.equal(sameValues({ unit_cost_chf: "1.5" }, { unit_cost_chf: "1.6" }), false);
  assert.equal(sameValues({ unit_cost_chf: "1.5" }, { unit_cost_chf: null }), false);
  assert.equal(sameValues({ stock_unit: "kg" }, { stock_unit: "Kg" }), false);
});
