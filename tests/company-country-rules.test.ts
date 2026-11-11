import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, decideCountry, norm } from "../src/lib/companyCountry/rules";

// a slice of HubSpot's country_custom dropdown (254 values, value = label, read 11.11.2026)
const OPTIONS = [
  "Switzerland", "Germany", "Austria", "France", "Italy", "Liechtenstein", "Poland", "Russia", "Monaco", "Spain", "Netherlands",
  "Belgium", "United Kingdom", "United States", "Czech Republic", "Turkey", "Hong Kong", "Macau", "Antigua and Barbuda",
  "Saint Lucia", "Bosnia and Herzegovina", "Congo", "Democratic Republic of the Congo", "Cote d'Ivoire", "Sweden", "Denmark",
];
const idx = buildIndex(OPTIONS);
const v = (c: string) => { const d = decideCountry(c, idx); return d.status === "sure" ? d.value : `(${d.reason})`; };

test("compared without case, accents, dots; & as and, St. as Saint", () => {
  assert.equal(norm("  Österreich "), "osterreich");
  assert.equal(norm("Antigua & Barbuda"), "antigua and barbuda");
  assert.equal(norm("St. Lucia"), "saint lucia");
  assert.equal(norm("U.S.A."), "usa");
  assert.equal(v("U.S.A."), "United States");
});

test("the workflow's table as it was", () => {
  assert.equal(v("DE"), "Germany");
  assert.equal(v("Deutschland"), "Germany");
  assert.equal(v("CH"), "Switzerland");
  assert.equal(v("UK"), "United Kingdom");
  assert.equal(v("Czechia"), "Czech Republic");
  assert.equal(v("Türkiye"), "Turkey");
  assert.equal(v("Switzerland"), "Switzerland");
});

test("the 18 the workflow failed on (11.11.2026): all but one written", () => {
  for (const [c, want] of [["Schweiz", "Switzerland"], ["RU", "Russia"], ["poland", "Poland"], ["POLAND", "Poland"], ["CHE", "Switzerland"],
    ["Italia", "Italy"], ["MC", "Monaco"], ["DEUTSCHLAND", "Germany"], ["ITALY", "Italy"]] as const) assert.equal(v(c), want, c);
  // "UD" is no country: never guessed
  assert.equal(v("UD"), "(unknown)");
});

test("codes and the countries' own names", () => {
  assert.equal(v("LI"), "Liechtenstein");
  assert.equal(v("Suisse"), "Switzerland");
  assert.equal(v("Svizzera"), "Switzerland");
  assert.equal(v("Autriche"), "Austria");
  assert.equal(v("España"), "Spain");
  assert.equal(v("Nederland"), "Netherlands");
  assert.equal(v("Polska"), "Poland");
  assert.equal(v("Danmark"), "Denmark");
  assert.equal(v("HK"), "Hong Kong");
  assert.equal(v("Antigua & Barbuda"), "Antigua and Barbuda");
  assert.equal(v("St. Lucia"), "Saint Lucia");
  assert.equal(v("CD"), "Democratic Republic of the Congo");
  assert.equal(v("Côte d’Ivoire"), "Cote d'Ivoire");
});

test("nothing outside the dropdown is ever written", () => {
  const values = new Set(OPTIONS);
  for (const [, out] of idx) if (out !== null) assert.ok(values.has(out), out);
  assert.equal(v("Narnia"), "(unknown)");
  assert.equal(v(""), "(unknown)");
});
