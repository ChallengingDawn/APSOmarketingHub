import assert from "node:assert/strict";
import { test } from "node:test";
import { ArticlesSheet, GWSTDP_PER, articleFacts, checkOptions, factsHash } from "../src/lib/connectors/steps/productFactsRules";

const HEAD = ["[Article]", "[ArticleType]", "[InLiquidation]", "[CountryOfOrigin]", "[ConsumptionDriven]", "[ReplenishmentDays]", "[TariffNumber]", "[SupplierName]",
  "[GwstdpCurrency]", "[GwstdpCHF]", "[GwstdpEUR]", "[GwstdpUSD]", "[StockDay]", "[StockValueCHF]", "[StockValueEUR]", "[Consumption]", "[Movement]",
  "[Material]", "[Hardness]", "[Colour]", "[CompoundAP]", "[CompoundSupplier]", "[Conformity]"];

test("product facts: the articles sheet - the header by its names, one row per article, the first one kept", () => {
  const s = new ArticlesSheet();
  s.feed(1, ["a title"]);
  s.feed(2, HEAD);
  s.feed(3, ["1120030001", "Standard", "N", "Germany", "J", 21, "4016.93", "Trelleborg", "CHF", 1234.5, 1300, null, new Date(Date.UTC(2026, 10, 7)), 5000.123, 5200, 120, -3, "NBR", "70 Shore A", "black", "N7001", "4N70", "FDA"]);
  s.feed(4, ["1120030001", "Standard", "N", "Italy", "N", 7, "", "", "EUR", 1, 1, null, null, 0, 0, 0, 0, "", "", "", "", "", ""]); // the same article again
  s.feed(5, [null]);
  const rows = s.finish()!;
  assert.equal(rows.length, 1);
  const f = articleFacts(rows[0]);
  assert.deepEqual(f, {
    unit_cost_chf: String(Math.round((1234.5 / GWSTDP_PER) * 10000) / 10000), currency: "CHF",
    stock_value_chf: "5000.12", stock_value_eur: "5200", consumption: "120", stock_movement: "-3", stock_as_of_date: "2026-11-07",
    replenishment_days: "21", country_of_origin: "Germany", consumption_driven: "J", tarifs_number: "4016.93", article_status: "Running Article",
    c2s_article: "false", main_supplier: "Trelleborg", material: "NBR", hardness: "70 Shore A", colour: "black", ap_compound_designation: "N7001",
    supplier_compound_designation: "4N70", conformities: "FDA",
  });
  const none = new ArticlesSheet();
  none.feed(1, ["Article", "Price"]);
  assert.equal(none.finish(), null);
});

test("product facts: the GWStdP in the lead currency, nothing invented when a value is missing", () => {
  const base = Object.fromEntries(HEAD.map((h) => [h.replace(/[[\]]/g, "").toLowerCase(), ""])) as Parameters<typeof articleFacts>[0];
  assert.deepEqual(articleFacts({ ...base, article: "1", gwstdpcurrency: "EUR", gwstdpchf: "200", gwstdpeur: "150", inliquidation: "J", articletype: "Special" }),
    { unit_cost_chf: String(150 / GWSTDP_PER), currency: "EUR", article_status: "Liquidation", c2s_article: "true" });
  assert.deepEqual(articleFacts({ ...base, article: "2", gwstdpcurrency: "GBP", gwstdpchf: "200" }), {}); // no GBP price in the model: no cost written
  assert.deepEqual(articleFacts({ ...base, article: "3", gwstdpcurrency: "CHF", gwstdpchf: "0", replenishmentdays: "-1" }), {});
});

test("product facts: a choice list's value only when HubSpot lists it; the hash says what changed", () => {
  const opts = new Map([["country_of_origin", new Set(["Germany", "Italy"])], ["consumption_driven", new Set(["J", "N"])]]);
  const c = checkOptions({ country_of_origin: "DE", consumption_driven: "J", material: "NBR" }, opts);
  assert.deepEqual(c, { facts: { consumption_driven: "J", material: "NBR" }, dropped: ["country_of_origin"] });
  assert.equal(factsHash({ b: "1", a: "2" }), factsHash({ a: "2", b: "1" }));
});
