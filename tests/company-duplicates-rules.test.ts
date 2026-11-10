import assert from "node:assert/strict";
import { test } from "node:test";
import { performisCsv, performisFamilies, rolesOf } from "../src/lib/companyDuplicates/performis";
import { DEFAULT_RULES, autoBoth, apartPairs, domainOf, erpOf, findGroups, intoOf, mergesOf, nameKey, stillHolds, toCompany, type Company } from "../src/lib/companyDuplicates/rules";

const C = (id: string, extra: Partial<Company> = {}): Company => ({
  id, name: `Company ${id}`, domain: null, erp: null, placeholder: null, mandant: null, createdate: `2026-01-0${id.slice(-1)}T00:00:00Z`,
  zip: null, city: null, country: "switzerland", owner: null, deals: 0, contacts: 0, address: null, unique: null, phone: null, lastOrder: null, lastYear: null, revenue: 0, revenuePy: 0, ...extra,
});
const none = new Set<string>();

test("an ERP number is digits; the placeholders are not one", () => {
  assert.equal(erpOf(" 713281 "), "713281");
  assert.equal(erpOf("NO ERP ID (LEAD)"), null);
  assert.equal(erpOf("NO ERP ID CREATED BY ESO "), null);
  assert.equal(erpOf("---"), null);
  const c = toCompany({ id: "1", properties: { name: "X", erp_customer_id: "NO ERP ID (LEAD)", mandant: "M110" } });
  assert.equal(c.erp, null);
  assert.equal(c.placeholder, "NO ERP ID (LEAD)");
  assert.equal(toCompany({ id: "2", properties: { company_unique_number: " CH-123 ", address: "Bahnhofstr. 1" } }).unique, "CH-123");
});

test("placeholders never make one ERP customer", () => {
  const list = [1, 2, 3].map((i) => C(`${i}`, { placeholder: "NO ERP ID (LEAD)", mandant: "M110" }));
  const f = findGroups(list, DEFAULT_RULES, none);
  assert.equal(f.sure.length, 0);
  assert.equal(f.counts.placeholders, 3);
});

test("the same ERP number in the same Mandant: sure, into the oldest", () => {
  const f = findGroups([C("2", { erp: "845265", mandant: "M100" }), C("1", { erp: "845265", mandant: "M100" }), C("3", { erp: "845265", mandant: "M110" })], DEFAULT_RULES, none);
  assert.equal(f.sure.length, 1);
  assert.deepEqual(f.sure[0].members.map((c) => c.id), ["1", "2"]);
  assert.equal(f.sure[0].into, "1");
  assert.match(f.sure[0].why, /^Same customer number 845265 in M100$/);
  assert.ok(!f.sure[0].tooBig);
});

test("a sure group bigger than the limit waits for a person", () => {
  const list = [1, 2, 3, 4, 5].map((i) => C(`${i}`, { erp: "1000", mandant: "M100" }));
  assert.equal(findGroups(list, DEFAULT_RULES, none).sure[0].tooBig, true);
});

test("websites: bare host, never a mail provider or ours", () => {
  assert.equal(domainOf("https://www.Burri.World/de/"), "burri.world");
  assert.equal(domainOf("gmail.com"), null);
  assert.equal(domainOf("bluewin.ch"), null);
  assert.equal(domainOf("angst-pfister.com"), null);
  assert.equal(domainOf(null, "www.balluff.ch"), "balluff.ch");
  assert.equal(domainOf("n/a"), null);
});

test("names are compared without legal forms, accents and signs", () => {
  assert.equal(nameKey("Huwyler Klima AG"), nameKey("HUWYLER KLIMA"));
  assert.equal(nameKey("Würth AG"), nameKey("Wurth"));
  assert.equal(nameKey("PLAST-CHEM KOMPOZYTY sp. z o.o sp. k."), nameKey("Plast Chem Kompozyty"));
  assert.equal(nameKey("AG"), null);
});

test("the same name at the same postcode: possible, into the ERP customer's company", () => {
  const f = findGroups([
    C("1", { name: "BURRI public elements AG", zip: "8152", city: "Opfikon" }),
    C("2", { name: "Burri Public Elements", zip: "8152", erp: "713281", mandant: "M100" }),
  ], DEFAULT_RULES, none);
  assert.equal(f.possible.length, 1);
  assert.equal(f.possible[0].into, "2");
  assert.deepEqual(f.possible[0].shared, ["place"]);
});

test("two ERP customers are a group's companies - left alone", () => {
  const f = findGroups([C("1", { domain: "wuerth.ch", erp: "1" , mandant: "M100" }), C("2", { domain: "wuerth.ch", erp: "2", mandant: "M100" }), C("3", { domain: "wuerth.ch" })], DEFAULT_RULES, none);
  assert.equal(f.possible.length, 0);
  assert.equal(f.counts.families, 1);
  assert.equal(f.left[0].kind, "family");
});

test("the same ERP number in two Mandants is two ledgers - never merged", () => {
  const f = findGroups([C("1", { domain: "x.ch", erp: "5", mandant: "M100" }), C("2", { domain: "x.ch", erp: "5", mandant: "M110" })], DEFAULT_RULES, none);
  assert.equal(f.sure.length, 0);
  assert.equal(f.possible.length, 0);
  assert.equal(f.counts.families, 1);
});

test("one website in two countries: sites, left alone", () => {
  const f = findGroups([C("1", { domain: "lincolnelectric.eu", country: "switzerland" }), C("2", { domain: "lincolnelectric.eu", country: "poland" })], DEFAULT_RULES, none);
  assert.equal(f.possible.length, 0);
  assert.equal(f.counts.sites, 1);
});

test("website and place together are one group, both shared, listed first", () => {
  const f = findGroups([
    C("1", { name: "Kaiser engineering GmbH", zip: "4313", domain: "kaiser-engineering.ch", erp: "709569", mandant: "M100" }),
    C("2", { name: "Kaiser Engineering GmbH", zip: "4313", domain: "kaiser-engineering.ch" }),
    C("3", { name: "Spirig Pharma AG", domain: "spirig.ch" }),
    C("4", { name: "Spirig", domain: "spirig.ch", erp: "810332", mandant: "M100" }),
  ], DEFAULT_RULES, none);
  assert.equal(f.possible.length, 2);
  assert.deepEqual(f.possible[0].shared, ["place", "website"]);
  assert.equal(f.possible[1].otherNames, true);
  const off = findGroups([C("3", { name: "Spirig Pharma AG", domain: "spirig.ch" }), C("4", { name: "Spirig", domain: "spirig.ch" })], { ...DEFAULT_RULES, website: { on: true, otherNames: false } }, none);
  assert.equal(off.possible.length, 0);
});

test("a pair a person kept apart does not come back", () => {
  const list = [C("1", { domain: "a.ch" }), C("2", { domain: "a.ch" })];
  const f = findGroups(list, DEFAULT_RULES, new Set(apartPairs(["2", "1"])));
  assert.equal(f.possible.length, 0);
  assert.equal(f.counts.apart, 1);
  // a third company on the website: shown again
  assert.equal(findGroups([...list, C("3", { domain: "a.ch" })], DEFAULT_RULES, new Set(apartPairs(["1", "2"]))).possible.length, 1);
});

test("before a merge: still one ERP customer", () => {
  assert.equal(stillHolds("erp", [C("1", { erp: "9", mandant: "M100" }), C("2", { erp: "9", mandant: "M100" })]), null);
  assert.match(String(stillHolds("erp", [C("1", { erp: "9", mandant: "M100" }), C("2", { erp: "8", mandant: "M100" })])), /differ/);
  assert.match(String(stillHolds("possible", [C("1", { erp: "9" }), C("2", { erp: "8" })])), /never merged/);
  assert.match(String(stillHolds("possible", [C("1")])), /fewer/);
  assert.equal(intoOf([C("2"), C("1")], "erp"), "1");
});

test("the merges HubSpot's history tells", () => {
  const ev = mergesOf("9", [
    { value: "1;2", timestamp: "2026-02-15T00:52:04Z", sourceType: "INTEGRATION", sourceId: "22343290" },
    { value: "1;2;5;6", timestamp: "2026-03-05T19:54:32Z", sourceType: "CRM_UI", updatedByUserId: 7 },
    { value: "1;2;5;6;8", timestamp: "2026-04-01T10:00:00Z", sourceType: "CRM_UI", updatedByUserId: 7 },
  ], (h) => (h.sourceType === "INTEGRATION" ? `app ${h.sourceId}` : `user ${h.updatedByUserId}`));
  assert.deepEqual(ev.map((e) => [e.n, e.by]), [[1, "app 22343290"], [1, "user 7"], [1, "user 7"]]);
});

test("the same name, postcode and website with at most one number is merged by the hub", () => {
  const f = findGroups([
    C("1", { name: "Resonetics SA", zip: "1070", domain: "resonetics.com", erp: "715700", mandant: "M100" }),
    C("2", { name: "Resonetics", zip: "1070", domain: "resonetics.com" }),
    C("3", { name: "MBO services GmbH", zip: "2345", domain: "mbo-services.at" }),
    C("4", { name: "MBO services GmbH", zip: "2345" }),
  ], DEFAULT_RULES, none);
  const both = f.possible.find((g) => g.members.some((c) => c.id === "1"))!;
  const place = f.possible.find((g) => g.members.some((c) => c.id === "3"))!;
  assert.equal(autoBoth(both, DEFAULT_RULES), true);
  assert.equal(both.into, "1");
  assert.equal(autoBoth(place, DEFAULT_RULES), false);
  assert.equal(autoBoth(both, { ...DEFAULT_RULES, both: { autoMerge: false } }), false);
});

const NOW = Date.parse("2026-11-10T12:00:00Z");
test("Performis: the account that buys is MAIN, others that buy SIDE, the rest DUPLICATE", () => {
  const r = rolesOf([
    C("1", { name: "Uni Zürich", erp: "721713", mandant: "M100", lastOrder: "2026-10-01", revenue: 9000, unique: "100-721713" }),
    C("2", { name: "Uni Zürich", erp: "802650", mandant: "M100", lastOrder: "2026-11-01", revenue: 400 }),
    C("3", { name: "Uni Zürich (DUPLICATE DON'T USE)", erp: "787010", mandant: "M100", lastOrder: "2023-05-01", revenuePy: 4000 }),
  ], NOW);
  assert.deepEqual(r.map((a) => a.role), ["main", "side", "duplicate"]);
  assert.equal(r[0].newName, "Uni Zürich (MAIN ACCOUNT)");
  assert.equal(r[2].newName, "Uni Zürich (DUPLICATE DON'T USE)");
  assert.equal(r[1].uniqueNumber, "100-802650");
  assert.equal(r[1].derived, true);
  // nobody buys: the one that ordered last is MAIN
  assert.deepEqual(rolesOf([C("1", { erp: "1", mandant: "M100", lastOrder: "2020-01-01" }), C("2", { erp: "2", mandant: "M100", lastOrder: "2022-01-01" })], NOW).map((a) => a.role), ["duplicate", "main"]);
});

test("Performis: one company = same name and postcode or same name and website; never across Mandants", () => {
  const list = [
    C("1", { name: "Geomatica Associati sagl", zip: "6713", erp: "809879", mandant: "M100", lastOrder: "2026-09-01" }),
    C("2", { name: "Geomatica Associati", zip: "6713", erp: "809880", mandant: "M100" }),
    C("3", { name: "Geomatica Associati", zip: "6713" }),
    C("4", { name: "Würth AG", domain: "wuerth.ch", erp: "5", mandant: "M100" }),
    C("5", { name: "Würth Industrie", domain: "wuerth.ch", erp: "6", mandant: "M100" }),
    C("6", { name: "Kunde AG", zip: "1000", erp: "7", mandant: "M100" }),
    C("7", { name: "Kunde GmbH", zip: "1000", erp: "8", mandant: "M110" }),
  ];
  const f = performisFamilies(list, NOW);
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].accounts.map((a) => [a.id, a.role]), [["1", "main"], ["2", "duplicate"]]);
  const csv = performisCsv(f).replace(/^﻿/, "").split("\r\n");
  assert.equal(csv[0], '"Company unique number";"Company name";"New company name"');
  assert.equal(csv[1], '"100-809879";"Geomatica Associati sagl";"Geomatica Associati sagl (MAIN ACCOUNT)"');
});
