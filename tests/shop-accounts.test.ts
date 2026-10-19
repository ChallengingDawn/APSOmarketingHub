import assert from "node:assert/strict";
import { test } from "node:test";
import { INTERNAL, kindOf, nameWords, rankCandidates, withOrderCompanies } from "../src/lib/ticketAssoc/shopAccountRules";

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
