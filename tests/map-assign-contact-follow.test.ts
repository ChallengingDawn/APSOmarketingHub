import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOLLOW_CAP, companyFollowsRules, followChanges, followTarget, notSureTotal, ownCompanyOf, planFollow, type FollowContact,
} from "../src/lib/mapAssign/follow";
import { buildNewContacts, sureClass, type CompanyRuleRow, type NewContactRow } from "../src/lib/mapAssign/contacts";
import { INTERNAL_DOMAINS, type Internal } from "../src/lib/mapAssign/plan";

const internal: Internal = { domains: new Set(INTERNAL_DOMAINS), emails: new Set(["diana@partner.ch"]) };
const ct = (id: string, x: Partial<FollowContact> = {}): FollowContact => ({ id, email: `p${id}@acme.ch`, owner: "TSA", region: "TSA", ...x });

test("contacts follow: the target is the company's owner and region now", () => {
  assert.deepEqual(followTarget({ owner: "JAN", region: "JAN" }), { owner: "JAN", region: "JAN" });
  // the company's region can be someone else than its owner: the contact takes both as they are
  assert.deepEqual(followTarget({ owner: "JAN", region: "MAX" }), { owner: "JAN", region: "MAX" });
  // no region on the company: the contact's region is left alone
  assert.deepEqual(followTarget({ owner: "JAN", region: null }), { owner: "JAN", region: null });
  assert.deepEqual(followTarget({ owner: "JAN", region: "  " }), { owner: "JAN", region: null });
  // no owner on the company: its contacts are left alone
  assert.equal(followTarget({ owner: null, region: "JAN" }), null);
  assert.equal(followTarget({ owner: "", region: "" }), null);
  assert.equal(followTarget(undefined), null);
  // ids as text (pg / kv may hand back a number)
  assert.deepEqual(followTarget({ owner: 123, region: 456 }), { owner: "123", region: "456" });
});

test("contacts follow: only what differs is written - owner and / or region, nothing else", () => {
  const t = { owner: "JAN", region: "JAN" };
  assert.deepEqual(followChanges({ owner: "JAN", region: "JAN" }, t), {});
  assert.deepEqual(followChanges({ owner: "TSA", region: "JAN" }, t), { hubspot_owner_id: "JAN" });
  // the usual one: HubSpot copied the company's owner, never the region
  assert.deepEqual(followChanges({ owner: "JAN", region: "TSA" }, t), { region_responsibility: "JAN" });
  assert.deepEqual(followChanges({ owner: null, region: null }, t), { hubspot_owner_id: "JAN", region_responsibility: "JAN" });
  // an empty company region leaves the contact's region as it is, whatever it holds
  assert.deepEqual(followChanges({ owner: "TSA", region: "TSA" }, { owner: "JAN", region: null }), { hubspot_owner_id: "JAN" });
  assert.deepEqual(followChanges({ owner: "JAN", region: "MAX" }, { owner: "JAN", region: null }), {});
  // no target (company with no owner): nothing
  assert.deepEqual(followChanges({ owner: "TSA", region: "TSA" }, null), {});
  // compared as text
  assert.deepEqual(followChanges({ owner: 123, region: "123" }, { owner: "123", region: "123" }), {});
});

test("contacts follow: a contact's own company", () => {
  assert.equal(ownCompanyOf("100", ["200", "300"]), "100");
  assert.equal(ownCompanyOf(null, ["200", "300"]), "200");
  assert.equal(ownCompanyOf("", ["", "300"]), "300");
  assert.equal(ownCompanyOf(null, []), null);
  assert.equal(ownCompanyOf(100), "100");
});

test("contacts follow: one company's plan - A+P people skipped, the cap, before kept for an undo", () => {
  const t = { owner: "JAN", region: "JAN" };
  const list = [
    ct("1"),                                                    // owner + region
    ct("2", { owner: "JAN" }),                                  // region only
    ct("3", { owner: "JAN", region: "JAN" }),                   // right already
    ct("4", { email: "jan.kalt@angst-pfister.com" }),           // A+P: never touched
    ct("5", { email: "Diana@Partner.ch" }),                     // on the A+P list by address
    ct("6", { email: null }),                                   // no e-mail: not A+P
    ct("1"),                                                    // read twice: once
  ];
  const p = planFollow("100", t, list, internal, FOLLOW_CAP);
  assert.deepEqual(p.writes.map((w) => [w.id, w.properties]), [
    ["1", { hubspot_owner_id: "JAN", region_responsibility: "JAN" }],
    ["2", { region_responsibility: "JAN" }],
    ["6", { hubspot_owner_id: "JAN", region_responsibility: "JAN" }],
  ]);
  assert.deepEqual(p.writes[0].before, { hubspot_owner_id: "TSA", region_responsibility: "TSA" });
  assert.equal(p.writes[0].company, "100");
  assert.deepEqual([p.checked, p.internal, p.left, p.noOwner], [4, 2, 0, false]);
  // the cap: the rest are left for the next pass
  const capped = planFollow("100", t, list, internal, 1);
  assert.deepEqual(capped.writes.map((w) => w.id), ["1"]);
  assert.equal(capped.left, 2);
  assert.equal(planFollow("100", t, list, internal, 0).writes.length, 0);
});

test("contacts follow: a company with no owner keeps its contacts as they are", () => {
  const p = planFollow("100", followTarget({ owner: null, region: "JAN" }), [ct("1"), ct("2")], internal, FOLLOW_CAP);
  assert.deepEqual([p.writes.length, p.checked, p.left, p.noOwner], [0, 0, 0, true]);
});

test("contacts follow: an empty company region leaves every contact's region", () => {
  const p = planFollow("100", followTarget({ owner: "JAN", region: null }), [ct("1"), ct("2", { owner: "JAN", region: "MAX" }), ct("3", { region: null })], internal, FOLLOW_CAP);
  assert.deepEqual(p.writes.map((w) => [w.id, w.properties]), [["1", { hubspot_owner_id: "JAN" }], ["3", { hubspot_owner_id: "JAN" }]]);
});

/** A company the rules give JAN - each case changes what it needs. */
const co = (x: Partial<CompanyRuleRow> = {}): CompanyRuleRow => ({
  id: "100", name: "Acme AG", country: "CH", ownerNow: "JAN", regionNow: "JAN", decided: "JAN", via: "sae", ...x,
});

test("contacts follow: sure - the company follows the rules, the contact does not", () => {
  // the company follows the rules: a contact with another owner, or the right owner and another region, is sure
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, co()), "sure");
  assert.equal(sureClass({ owner: "JAN", region: "TSA", companyId: "100" }, co()), "sure");
  assert.equal(sureClass({ owner: "JAN", region: null, companyId: "100" }, co()), "sure");
  // follows the rules: nothing to correct
  assert.equal(sureClass({ owner: "JAN", region: "JAN", companyId: "100" }, co()), null);
  // not sure - the company first: its owner differs from the rules ...
  assert.equal(sureClass({ owner: "MAX", region: "MAX", companyId: "100" }, co({ ownerNow: "TSA", regionNow: "TSA" })), "company");
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, co({ ownerNow: "TSA", regionNow: "TSA" })), "company"); // follows its company
  // ... or its region does (HubSpot copies the owner only), or it has none
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, co({ regionNow: "MAX" })), "company");
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, co({ regionNow: null })), "company");
  // nobody decided: never sure
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, co({ ownerNow: "", regionNow: "", decided: "" })), "company");
  // no company, a company not read yet
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: null }, co()), "no-company");
  assert.equal(sureClass({ owner: "TSA", region: "TSA", companyId: "100" }, undefined), "unknown-company");
  // ids as text
  assert.equal(sureClass({ owner: 7, region: 7, companyId: 100 }, co({ ownerNow: "8", regionNow: 8 as unknown as string, decided: "8" })), "sure");
  // the re-read before a write asks the same of the company as HubSpot has it now
  assert.equal(companyFollowsRules({ owner: "JAN", region: "JAN" }, "JAN"), true);
  assert.equal(companyFollowsRules({ owner: "JAN", region: "TSA" }, "JAN"), false);
  assert.equal(companyFollowsRules({ owner: "TSA", region: "JAN" }, "JAN"), false);
  assert.equal(companyFollowsRules({ owner: "", region: "" }, ""), false);
});

test("contacts follow: the sure / not sure split in the new contacts' count", () => {
  const now = Date.parse("2026-10-24T10:00:00Z");
  const companies = new Map<string, CompanyRuleRow>([
    ["100", co()],                                                                                        // follows the rules (CH)
    ["200", co({ id: "200", country: "DE", ownerNow: "TSA", regionNow: "TSA", decided: "CAN", via: "zone" })], // differs from the rules
    ["300", co({ id: "300", country: "DE", ownerNow: "CAN", regionNow: null, decided: "CAN", via: "zone" })],  // owner right, no region
  ]);
  const c = (id: string, x: Partial<NewContactRow> = {}): NewContactRow =>
    ({ id, email: `p${id}@acme.ch`, created: `2026-10-2${Number(id) % 4}T08:00:00Z`, owner: "TSA", region: "TSA", companyId: "100", ...x });
  const rows: NewContactRow[] = [
    c("1"),                                                     // sure
    c("2", { owner: "JAN", region: null }),                     // sure (region only)
    c("3", { owner: "JAN", region: "JAN" }),                    // follows: not counted
    c("4", { companyId: "200" }),                               // not sure: the company differs from the rules
    c("5", { companyId: "300", owner: "MAX" }),                 // not sure: the company has no region
    c("6", { companyId: null }),                                // not sure: no company
    c("7", { companyId: "999" }),                               // not sure: company not read yet
    c("8", { email: "x@apsoparts.com" }),                       // A+P: left out
  ];
  const k = buildNewContacts(rows, companies, { now });
  assert.equal(k.total, 7);
  assert.equal(k.sure, 2);
  assert.deepEqual(k.notSure, { company: 2, "unknown-company": 1, "no-company": 1 });
  assert.equal(notSureTotal(k.notSure), 4);
  assert.equal(notSureTotal(undefined), 0);
  // the examples say which are sure
  assert.deepEqual(k.examples.filter((e) => e.sure).map((e) => e.id).sort(), ["1", "2"]);
  assert.equal(k.examples.find((e) => e.id === "4")?.sure, false);
  // per company country too
  assert.equal(k.countries.CH.sure, 2);
  assert.equal(k.countries.DE.sure, 0);
  assert.deepEqual(k.countries.DE.notSure, { company: 2, "unknown-company": 0, "no-company": 0 });
  // once written, a sure one follows the rules: none is sure any more
  const after = buildNewContacts(rows.map((r) => (r.id === "1" || r.id === "2" ? { ...r, owner: "JAN", region: "JAN" } : r)), companies, { now });
  assert.equal(after.sure, 0);
  assert.equal(after.classes.follows, k.classes.follows + 2);
});
