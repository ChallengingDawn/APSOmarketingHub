import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { REGION_COUNTRIES, REGION_OPTIONS, UNKNOWN_REGION, placeKey, regionsCountry, regionsFor, regionsToWrite, regionsValue, regionsZip, type RegionsTable, type SharedPostcode } from "../src/lib/mapAssign/regionsProp";

// the shipped table (public/geo/regions/regions.json, GeoNames' postal codes) - npm test runs from the repo root
const TABLE = JSON.parse(readFileSync("public/geo/regions/regions.json", "utf8")) as RegionsTable;
const value = (cc: string, zip: string, mapRegion: string | null = null, city: string | null = null) => regionsFor(TABLE, cc, zip, mapRegion, city)?.value ?? null;

test("the map's region codes give the dropdown's values - the codes that repeat across countries never mixed up", () => {
  assert.equal(regionsValue("DE", "DE-BE"), "BE - Berlin");
  assert.equal(regionsValue("CH", "CH-BE"), "BE - Bern");
  assert.equal(regionsValue("IT", "IT-RM"), "12 - Lazio");
  assert.equal(regionsValue("IT", "IT-SU"), null);
  assert.equal(regionsValue("AT", "AT-9"), "W - Wien");
  assert.equal(regionsValue("FR", "FR-2A"), "2A - Corse-du-Sud");
  assert.equal(regionsValue("LI", "LI-07"), "LH - Liechtenstein");
  assert.equal(regionsValue("DE", "CH-ZH"), null);
  assert.equal(regionsCountry("BE - Berlin"), "DE");
  assert.equal(regionsCountry("BE - Bern"), "CH");
  assert.equal(regionsCountry("ZIP CODE UNKOWN"), null);
});

test("postcodes as companies write them", () => {
  assert.equal(regionsZip("AT", "A-4060"), "4060");
  assert.equal(regionsZip("AT", "A 5224"), "5224");
  assert.equal(regionsZip("PL", "26-600"), "26600");
  assert.equal(regionsZip("NL", "5941 AG"), "5941");
  assert.equal(regionsZip("DE", "D-80331"), "80331");
  assert.equal(regionsZip("CH", "79539"), null, "a German postcode on a Swiss company");
  assert.equal(regionsZip("AT", "11050"), null);
  assert.equal(regionsZip("DE", "Hagenbrunn"), null);
  assert.equal(regionsZip("FR", ""), null);
});

test("the official postcode decides - where the workflow's two digits were wrong", () => {
  assert.equal(value("CH", "2400"), "NE - Neuchâtel / Neuenburg", "Le Locle");
  assert.equal(value("CH", "8805"), "ZH - Zürich", "Richterswil");
  assert.equal(value("CH", "8867"), "GL - Glarus", "Niederurnen");
  assert.equal(value("DE", "63814"), "BY - Bayern", "Mainaschaff");
  assert.equal(value("DE", "49080"), "NI - Niedersachsen", "Osnabrück");
  assert.equal(value("FR", "78400"), "78 - Yvelines", "Chatou - the map put it in Val-d'Oise");
  assert.equal(value("FR", "20000"), "2A - Corse-du-Sud", "Ajaccio");
  assert.equal(value("FR", "97200"), "972 - Martinique");
  assert.equal(value("IT", "00184"), "12 - Lazio");
  assert.equal(value("NL", "3446 BC"), "UT - Utrecht", "Woerden");
  assert.equal(value("PL", "26-600"), "MZ - Mazowieckie", "Radom");
  assert.equal(value("LI", "9490"), "LH - Liechtenstein");
  assert.equal(regionsFor(TABLE, "CH", "2400", null)?.via, "postcode");
});

test("a postcode in two regions: the company's town picks one, and its value is kept when it is one of them", () => {
  assert.equal(value("AT", "5163", "AT-4", "Mattsee"), "S - Salzburg", "Mattsee - the map put it in Upper Austria");
  assert.equal(value("AT", "5163", null, "Palting"), "OÖ - Oberösterreich");
  assert.equal(value("AT", "1210", null, "Wien"), "W - Wien");
  assert.equal(value("AT", "1210", null, "Langenzersdorf"), "NÖ - Niederösterreich");
  assert.equal(placeKey("Wien, Floridsdorf"), "wien floridsdorf");
  assert.equal(placeKey("Brandstätt"), "brandstatt");
  const a = regionsFor(TABLE, "AT", "1210", "AT-9");
  assert.ok(a?.also?.includes("W - Wien") && a.also.includes("NÖ - Niederösterreich"));
  assert.equal(a?.value, "W - Wien", "the postcode's point lies in Vienna");
  assert.equal(regionsToWrite("W - Wien", a), null);
  assert.equal(regionsToWrite("NÖ - Niederösterreich", a), null);
  assert.equal(regionsToWrite("S - Salzburg", a), "W - Wien");
});

test("what to write: the answer when it differs; nothing taken away; ZIP CODE UNKOWN only on an empty field", () => {
  const be = regionsFor(TABLE, "CH", "3011", null);
  assert.equal(regionsToWrite("BE - Bern", be), null);
  assert.equal(regionsToWrite("AG - Aargau", be), "BE - Bern");
  assert.equal(regionsToWrite("BE - Berlin", be), "BE - Bern", "another country's region");
  assert.equal(regionsToWrite(UNKNOWN_REGION, be), "BE - Bern");
  assert.equal(regionsToWrite("", be), "BE - Bern");
  assert.equal(regionsToWrite("ZH - Zürich", null), null, "no postcode region: the value is kept");
  assert.equal(regionsToWrite(null, null), UNKNOWN_REGION);
  assert.equal(regionsToWrite(UNKNOWN_REGION, null), null);
});

test("the map answers only for a postcode the official list does not know", () => {
  const empty: RegionsTable = {};
  assert.deepEqual(regionsFor(empty, "DE", "80331", "DE-BY"), { value: "BY - Bayern", via: "map" });
  assert.equal(regionsFor(empty, "DE", "", "DE-BY"), null, "no postcode, no region");
  assert.equal(regionsFor(TABLE, "GB", "SW1A 1AA", null), null, "not one of the eight countries");
});

test("every value of the table is one of the dropdown's", () => {
  for (const cc of REGION_COUNTRIES) {
    const t = TABLE[cc];
    assert.ok(t && typeof t === "object", cc);
    for (const v of Object.values(t as Record<string, number | SharedPostcode>)) {
      for (const i of typeof v === "number" ? [v] : [...v.r, ...Object.values(v.p)]) assert.ok(REGION_OPTIONS[cc][i], `${cc} ${i}`);
    }
  }
});
