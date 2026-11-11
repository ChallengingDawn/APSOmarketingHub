import assert from "node:assert/strict";
import { test } from "node:test";
import { companyForKey, mandantHas } from "../src/lib/connectors/steps/orderRules";

// SARCLA 10.11.2026, A26.661694.001 | Maximilian Pusch: the order had its contact and no company. JüLo AG got its ERP
// number (867552, M110) typed by hand on 06.10; the order came on 08.10 20:09 and was looked up by the key
// "110-867552" only, which the company got 47 minutes later - and nothing ever linked them. 262 of 413,503 orders.

test("the key first; the oldest company when two carry it", () => {
  assert.equal(companyForKey("110-867552", [{ id: "450826192073", un: "110-867552" }]), "450826192073");
  assert.equal(companyForKey("100-1", [{ id: "20", un: "100-1" }, { id: "9", un: "100-1" }]), "9");
});

test("no key yet: the one company with that ERP number in that mandant", () => {
  const jueLo = { id: "450826192073", un: null, erp: "867552", mandant: "M110" };
  assert.equal(companyForKey("110-867552", [jueLo]), "450826192073");
  // the same number in the other mandant is another company
  assert.equal(companyForKey("100-867552", [jueLo]), null);
  assert.equal(companyForKey("110-867552", [{ ...jueLo, mandant: "M100" }]), null);
  // both mandants on one company
  assert.equal(companyForKey("100-867552", [{ ...jueLo, mandant: "M100;M110" }]), "450826192073");
  // a number written with a leading zero
  assert.equal(companyForKey("110-867552", [{ ...jueLo, erp: "0867552" }]), "450826192073");
  // no mandant on the company: which one is unknown - nothing
  assert.equal(companyForKey("110-867552", [{ ...jueLo, mandant: null }]), null);
  // two companies with that number in that mandant: a person decides
  assert.equal(companyForKey("110-867552", [jueLo, { ...jueLo, id: "2" }]), null);
  // a company with that number but keyed to another customer: not this one
  assert.equal(companyForKey("110-867552", [{ ...jueLo, un: "110-814841" }]), null);
  // the key wins over a number match
  assert.equal(companyForKey("110-867552", [jueLo, { id: "7", un: "110-867552" }]), "7");
});

test("no customer key on the order: nothing", () => {
  assert.equal(companyForKey("", [{ id: "1", un: "" }]), null);
  assert.equal(companyForKey("110-", [{ id: "1", erp: "", mandant: "M110" }]), null);
  assert.equal(mandantHas("M100 & M110", "110"), true);
  assert.equal(mandantHas("M1100", "110"), false);
});
