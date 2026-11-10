import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULES, apartPairs, domainOf, erpOf, findGroups, intoOf, mergesOf, nameKey, stillHolds, toCompany, type Company } from "../src/lib/companyDuplicates/rules";

const C = (id: string, extra: Partial<Company> = {}): Company => ({
  id, name: `Company ${id}`, domain: null, erp: null, placeholder: null, mandant: null, createdate: `2026-01-0${id.slice(-1)}T00:00:00Z`,
  zip: null, city: null, country: "switzerland", owner: null, deals: 0, contacts: 0, address: null, unique: null, phone: null, ...extra,
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
