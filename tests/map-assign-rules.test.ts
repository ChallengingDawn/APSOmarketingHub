import assert from "node:assert/strict";
import { test } from "node:test";
import { contactCompany, countryOf, decide, prefixMatches, saeKey, zoneFor, type AssignRules } from "../src/lib/mapAssign/rules";

const rules: AssignRules = {
  defaultOwner: "TSA",
  sae: { "Borey Jeremy": "JER", "Kalt Jan": "JAN", "Köremez James": "JAM", "Stahl Christopher": "STAHL" },
  countries: {
    CH: { country: "CH", source: "sae", zones: [{ id: "a", owner: "JAN", prefixes: ["30-38", "40-49"] }, { id: "b", owner: "JER", prefixes: ["10-29", "39"] }], keyAccounts: [{ owner: "SAR", erpIds: ["111"] }] },
    FR: { country: "FR", source: "map", zones: [{ id: "c", owner: "JER", prefixes: ["01", "69", "74"] }], defaultOwner: "TSA" },
    DE: { country: "DE", source: "map", zones: [{ id: "d", owner: "CAN", prefixes: ["86"] }, { id: "e", owner: "LANGE", prefixes: ["869"] }] },
  },
};
const active = (o: string) => o !== "STAHL";

test("map assignment: SAE keys and postcodes", () => {
  assert.equal(saeKey("JEREMY  Borey"), saeKey("Borey Jeremy"));
  assert.equal(saeKey("Koremez James"), saeKey("Köremez James"));
  assert.equal(prefixMatches("3012", "30-38"), true);
  assert.equal(prefixMatches("3912", "30-38"), false);
  assert.equal(prefixMatches("D-80331", "80"), true);
  assert.equal(zoneFor("86950", rules.countries.DE.zones)?.zone.owner, "LANGE"); // longest prefix wins
  assert.equal(zoneFor("86150", rules.countries.DE.zones)?.zone.owner, "CAN");
  assert.equal(countryOf({ id: "1", country: "Switzerland", countryCustom: "Liechtenstein" }), "LI"); // custom first
  assert.equal(countryOf({ id: "1", country: "Schweiz" }), "CH");
});

test("map assignment: who decides", () => {
  assert.equal(decide({ id: "1", country: "CH", sae: "Jeremy Borey", zip: "3000" }, rules, active).owner, "JER"); // SAE country: SAE wins
  const un = decide({ id: "1", country: "CH", sae: "ESO CH GER", zip: "3000" }, rules, active);
  assert.equal(un.owner, "JAN"); assert.equal(un.via, "zone"); assert.ok(un.flags.includes("sae-unmapped")); // unknown SAE -> zone, flagged
  assert.equal(decide({ id: "1", country: "CH", sae: "Kalt Jan", erpId: "111" }, rules, active).owner, "JAN"); // SAE country: a known SAE beats the key list (as the workflows)
  assert.equal(decide({ id: "1", country: "CH", erpId: "111", zip: "3000" }, rules, active).owner, "SAR"); // no SAE: the key account
  assert.equal(decide({ id: "1", country: "FR", sae: "Köremez James", zip: "69001" }, rules, active).owner, "JER"); // map country: SAE ignored
  assert.equal(decide({ id: "1", country: "FR", sae: "Borey Jeremy", zip: "75001" }, rules, active).owner, "TSA"); // Paris is not Jeremy's zone
  const left = decide({ id: "1", country: "CH", sae: "Stahl Christopher" }, rules, active);
  assert.equal(left.owner, "TSA"); assert.ok(left.flags.includes("owner-deactivated")); // a deactivated owner is never written
  assert.equal(decide({ id: "1", country: "Peru", sae: "" }, rules, active).owner, "TSA"); // unknown country -> default, flagged
});

test("map assignment: a contact's company by its domain", () => {
  assert.equal(contactCompany("gmail.com", [{ id: "1", ownerId: "A", erpId: null }]).link, null);
  assert.equal(contactCompany("acme.ch", [{ id: "1", ownerId: "A", erpId: null }]).link, "1");
  assert.equal(contactCompany("acme.ch", [{ id: "1", ownerId: "A", erpId: null }, { id: "2", ownerId: "B", erpId: "9" }]).link, "2");
  const same = contactCompany("acme.ch", [{ id: "1", ownerId: "A", erpId: null }, { id: "2", ownerId: "A", erpId: null }]);
  assert.equal(same.link, null); assert.equal(same.owner, "A");
  assert.equal(contactCompany("acme.ch", [{ id: "1", ownerId: "A", erpId: "1" }, { id: "2", ownerId: "B", erpId: "2" }]).owner, null);
});

test("map assignment: region zones, SAE redirected per country, people of a country", () => {
  const r: AssignRules = { defaultOwner: "TSA", sae: { "Kalt Jan": "JAN", "Gustak Marzena": "MAYA" }, countries: {
    CH: { country: "CH", source: "sae", people: ["JAN", "JER", "TSA"], saeOverride: { "Gustak Marzena": "JER" }, zones: [{ id: "a", owner: "JAN", prefixes: ["30-38"] }, { id: "t", owner: "TSA", prefixes: [], regions: ["CH-TI"] }] },
    DE: { country: "DE", source: "sae", people: ["CAN"], zones: [{ id: "d", owner: "CAN", prefixes: ["8"] }] },
  } };
  assert.equal(zoneFor("6900", r.countries.CH.zones, "CH-TI")?.zone.owner, "TSA"); // the region decides when no prefix does
  assert.equal(zoneFor("3000", r.countries.CH.zones, "CH-BE")?.zone.owner, "JAN"); // a prefix beats a region
  assert.equal(decide({ id: "1", country: "CH", sae: "Gustak Marzena", zip: "3000" }, r, () => true).owner, "JER"); // redirected in CH
  const wrong = decide({ id: "1", country: "DE", sae: "Kalt Jan", zip: "80331" }, r, () => true);
  assert.equal(wrong.owner, "CAN"); assert.ok(wrong.flags.includes("not-in-country")); // Jan Kalt is not a German ESO: the zone decides
});
