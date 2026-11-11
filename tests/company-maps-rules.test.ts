import assert from "node:assert/strict";
import { test } from "node:test";
import { MAPS_PREFIX, mapsLink, mapsQuery, queryOf, quotePlus } from "../src/lib/companyMaps/rules";

test("the query: the name, then street, second line, postcode, city, state, country", () => {
  assert.equal(mapsQuery({ name: "Kuvaplast AG", address: "Espenstrasse 7", zip: "9220", city: "Bischofszell", state: "Kanton Thurgau", country: "Switzerland" }),
    "Kuvaplast AG, Espenstrasse 7, 9220, Bischofszell, Kanton Thurgau, Switzerland");
  // without an address, the name alone; empty parts left out; line breaks become spaces
  assert.equal(mapsQuery({ name: "Kuvaplast AG" }), "Kuvaplast AG");
  assert.equal(mapsQuery({ name: " A  B ", address: "Espenstrasse\n7", city: "" }), "A B, Espenstrasse 7");
  assert.equal(mapsLink({}), "");
});

test("encoded as Python's quote_plus (the workflow's links)", () => {
  assert.equal(quotePlus("Zürich AG (Nord), 8048"), "Z%C3%BCrich+AG+%28Nord%29%2C+8048");
  assert.equal(quotePlus("a-b_c.d~e!*'"), "a-b_c.d~e%21%2A%27");
  // the workflow wrote this for Kuvaplast AG (10.11.2026), its street then still with the number
  assert.equal(mapsLink({ name: "Kuvaplast AG", address: "Espenstrasse 7", zip: "9220", city: "Bischofszell", country: "CH" }),
    `${MAPS_PREFIX}Kuvaplast+AG%2C+Espenstrasse+7%2C+9220%2C+Bischofszell%2C+CH`);
});

test("a link read back", () => {
  const l = mapsLink({ name: "Zürich AG", city: "Zürich" });
  assert.equal(queryOf(l), "Zürich AG, Zürich");
  assert.equal(queryOf("https://maps.app.goo.gl/xyz"), "");
});
