import assert from "node:assert/strict";
import { test } from "node:test";
import { INTERNAL, industryOf, kindOf, nameWords, rankCandidates, shopNumberOf, storeOf, withOrderCompanies } from "../src/lib/ticketAssoc/shopAccountRules";

test("a shop account's kind: a company on its domain, a business address, a free address", () => {
  assert.equal(kindOf("cern.ch", true), "match");
  assert.equal(kindOf("cern.ch", false), "business");
  assert.equal(kindOf("gmail.com", false), "free");
  assert.equal(kindOf("bluewin.ch", false), "free");
  assert.equal(kindOf("", false), "free");
  assert.ok(INTERNAL.test("apsoparts.com") && INTERNAL.test("de.angst-pfister.com") && !INTERNAL.test("pfister-bau.ch"));
});

test("the companies on a domain, the one named like the company typed first", () => {
  assert.deepEqual(nameWords("CIR Comptoir Industriel Régional SAS"), ["cir", "comptoir", "industriel", "regional"]);
  const list = [
    { id: "1", name: "Sika Schweiz AG", country: "Switzerland" },
    { id: "2", name: "Sika Technology AG", country: "Switzerland" },
    { id: "3", name: "Sika Deutschland GmbH", country: "Germany" },
  ];
  assert.deepEqual(rankCandidates("Sika Deutschland", list).map((c) => c.id), ["3", "1", "2"]);
  assert.deepEqual(rankCandidates("SIKA TECHNOLOGY", list).map((c) => c.id), ["2", "1", "3"]);
  // nothing typed: HubSpot's order stands
  assert.deepEqual(rankCandidates("", list).map((c) => c.id), ["1", "2", "3"]);
});

test("the company their orders are booked on comes first, then the domain's, each once", () => {
  const dom = [{ id: "1", name: "Sika Schweiz AG", country: "" }, { id: "2", name: "Sika Technology AG", country: "" }];
  const ord = [{ id: "2", name: "Sika Technology AG", country: "", orders: 1 }, { id: "9", name: "Sika Services AG", country: "", orders: 4 }];
  assert.deepEqual(withOrderCompanies(ord, dom).map((c) => [c.id, c.orders ?? 0]), [["9", 4], ["2", 1], ["1", 0]]);
  assert.deepEqual(withOrderCompanies([], dom).map((c) => c.id), ["1", "2"]);
});

test("orders first, then the company of the shop account's customer number, then the domain's - each once, with why", () => {
  const dom = [{ id: "1", name: "Sika Schweiz AG", country: "" }, { id: "7", name: "Sika Services AG", country: "" }];
  const ord = [{ id: "9", name: "Sika Technology AG", country: "", orders: 2 }];
  const num = [{ id: "7", name: "Sika Services AG", country: "" }];
  assert.deepEqual(withOrderCompanies(ord, dom, num).map((c) => [c.id, c.why]), [["9", "orders"], ["7", "number"], ["1", "domain"]]);
  assert.deepEqual(withOrderCompanies([], dom, []).map((c) => c.why), ["domain", "domain"]);
});

test("the shop's record read as people say it: the store, the industry, the customer number", () => {
  assert.equal(storeOf("Germany EUR DE Store View"), "Germany EUR DE");
  assert.equal(storeOf(""), null);
  assert.equal(industryOf("keine Branche"), null);
  assert.equal(industryOf("Aucune branche"), null);
  assert.equal(industryOf("nautica"), "nautica");
  assert.equal(shopNumberOf(" 715700 "), "715700");
  assert.equal(shopNumberOf("NO ERP ID (LEAD)"), null);
  assert.equal(shopNumberOf(null), null);
});
