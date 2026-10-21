import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLASS_ORDER, buildNewContacts, contactClass, followShare, matchShare, ruleOf, windowDays, windowStart, zurichMidnight,
  type CompanyRuleRow, type NewContactRow,
} from "../src/lib/mapAssign/contacts";

/** A company the rules give JAN, owned by TSA in HubSpot today - each case changes what it needs. */
const co = (x: Partial<CompanyRuleRow> = {}): CompanyRuleRow => ({
  id: "100", name: "Acme AG", country: "CH", ownerNow: "TSA", regionNow: "TSA", decided: "JAN", via: "sae", ...x,
});

test("map assignment contacts: one case per class", () => {
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: null }, co()), "no-company");
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: "  " }, undefined), "no-company");
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: "100" }, undefined), "unknown-company");
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: "100" }, co()), "follows");
  assert.equal(contactClass({ owner: "TSA", region: "TSA", companyId: "100" }, co()), "follows-company");
  assert.equal(contactClass({ owner: "MAX", region: "JAN", companyId: "100" }, co()), "differs");
  // every class is in the order the page shows
  assert.equal(new Set(CLASS_ORDER).size, 5);
});

test("map assignment contacts: precedence", () => {
  // no company beats everything, also when a company row is handed in
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: "" }, co()), "no-company");
  // the rules first: owner + region right by the rules is "follows", whatever the company has today
  assert.equal(contactClass({ owner: "JAN", region: "JAN", companyId: "100" }, co({ ownerNow: "JAN", regionNow: "JAN" })), "follows");
  // the owner by the rules but another region: not "follows"; the company is right, so not "follows its company" either
  assert.equal(contactClass({ owner: "JAN", region: null, companyId: "100" }, co({ ownerNow: "JAN", regionNow: "JAN" })), "differs");
  assert.equal(contactClass({ owner: "JAN", region: "TSA", companyId: "100" }, co()), "differs");
  // follows its company (not right yet): the owner only, the region is not asked
  assert.equal(contactClass({ owner: "TSA", region: null, companyId: "100" }, co()), "follows-company");
  // a company with nobody, a contact with nobody: it follows its company
  assert.equal(contactClass({ owner: null, region: null, companyId: "100" }, co({ ownerNow: null })), "follows-company");
  // ids compared as text: kv / pg can hand back a number
  assert.equal(contactClass({ owner: 123, region: "123", companyId: 100 }, co({ decided: "123" })), "follows");
});

test("map assignment contacts: the rules by via", () => {
  assert.equal(ruleOf("sae"), "rule1");
  assert.equal(ruleOf("zone"), "rule2");
  assert.equal(ruleOf("default"), "rule2");
  assert.equal(ruleOf("key"), "key");
  assert.equal(ruleOf("redirection"), "redirection");
  assert.equal(ruleOf("something new"), "other");
  assert.equal(ruleOf(null), "other");
});

test("map assignment contacts: the 30 Zurich days", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");
  const days = windowDays(now);
  assert.equal(days.length, 30);
  assert.equal(days[0], "2026-09-22");
  assert.equal(days[29], "2026-10-21");
  // CEST: midnight in Zurich is 22:00 UTC the day before; CET (after 25.10): 23:00
  assert.equal(zurichMidnight("2026-09-22"), Date.parse("2026-09-21T22:00:00Z"));
  assert.equal(zurichMidnight("2026-11-02"), Date.parse("2026-11-01T23:00:00Z"));
  assert.equal(windowStart(now), Date.parse("2026-09-21T22:00:00Z"));
  // a day just after midnight in Zurich is today there, still yesterday in UTC
  assert.equal(windowDays(Date.parse("2026-10-20T22:30:00Z"), 1)[0], "2026-10-21");
});

test("map assignment contacts: the page's numbers", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");
  const companies = new Map<string, CompanyRuleRow>([
    ["100", co()],                                                                   // CH, rule 1, TSA now -> JAN
    ["200", co({ id: "200", name: "Bauer GmbH", country: "DE", ownerNow: "CAN", regionNow: "CAN", decided: "CAN", via: "zone" })], // right already
    ["300", co({ id: "300", name: "No land", country: null, ownerNow: null, regionNow: null, decided: "TSA", via: "default" })],
  ]);
  const c = (id: string, created: string, x: Partial<NewContactRow> = {}): NewContactRow =>
    ({ id, email: `p${id}@acme.ch`, created, owner: "JAN", region: "JAN", companyId: "100", ...x });
  const rows: NewContactRow[] = [
    c("1", "2026-10-21T08:00:00Z"),                                                  // follows, CH, today
    c("2", "2026-10-20T22:30:00Z", { owner: "TSA", region: "TSA" }),                 // follows its company - 00:30 in Zurich: today
    c("3", "2026-10-19T09:00:00Z", { owner: "MAX" }),                                // differs
    c("4", "2026-10-19T10:00:00Z", { companyId: "200", owner: "CAN", region: "CAN", email: "x@bauer.de" }), // follows, DE
    c("5", "2026-10-18T10:00:00Z", { companyId: null }),                             // no company
    c("6", "2026-10-18T11:00:00Z", { companyId: "999" }),                            // company not read yet
    c("7", "2026-10-17T11:00:00Z", { companyId: "300", owner: null, region: null }), // follows its company (nobody), no country
    c("8", "2026-10-21T09:00:00Z", { email: "jan.kalt@angst-pfister.com" }),         // A+P: left out
    c("9", "2026-09-21T21:59:00Z"),                                                  // 23:59 in Zurich the day before the window: left out
    c("1", "2026-10-21T08:00:00Z"),                                                  // read twice: once
  ];
  const k = buildNewContacts(rows, companies, { now });
  assert.equal(k.read, 9);
  assert.equal(k.internal, 1);
  assert.equal(k.total, 7);
  assert.deepEqual(k.classes, { follows: 2, "follows-company": 2, differs: 1, "unknown-company": 1, "no-company": 1 });
  assert.equal(followShare(k), 2 / 5); // of those whose company is known
  assert.equal(k.perDay.length, 30);
  assert.equal(k.perDay.reduce((a, d) => a + d.total, 0), 7);
  const today = k.perDay[29];
  assert.equal(today.day, "2026-10-21");
  assert.equal(today.total, 2);
  assert.deepEqual([today.classes.follows, today.classes["follows-company"]], [1, 1]);
  assert.deepEqual(k.byPerson, [
    { owner: "JAN", n: 3, follows: 1 }, { owner: "", n: 2, follows: 0 }, { owner: "CAN", n: 1, follows: 1 }, { owner: "TSA", n: 1, follows: 0 },
  ]);
  assert.deepEqual(k.byRule, [
    { rule: "rule1", n: 3, follows: 1 }, { rule: "rule2", n: 2, follows: 1 }, { rule: "unknown-company", n: 1, follows: 0 }, { rule: "no-company", n: 1, follows: 0 },
  ]);
  assert.deepEqual(k.byCountry, [
    { country: "CH", n: 3, follows: 1 }, { country: "", n: 2, follows: 0 }, { country: "??", n: 1, follows: 0 }, { country: "DE", n: 1, follows: 1 },
  ]);
  // the latest that do not follow, newest first - no-company ones are on their own tab
  assert.deepEqual(k.examples.map((e) => [e.id, e.kind]), [["2", "follows-company"], ["3", "differs"], ["6", "unknown-company"], ["7", "follows-company"]]);
  const e3 = k.examples[1];
  assert.deepEqual([e3.owner, e3.companyName, e3.companyOwnerNow, e3.decided, e3.rule, e3.country], ["MAX", "Acme AG", "TSA", "JAN", "rule1", "CH"]);
  // per company country: the pills; no company / not read yet in the totals only
  assert.deepEqual(Object.keys(k.countries), ["CH", "??", "DE"]);
  assert.equal(k.countries.CH.total, 3);
  assert.deepEqual(k.countries.DE.classes, { follows: 1, "follows-company": 0, differs: 0, "unknown-company": 0, "no-company": 0 });
  assert.equal(k.since, "2026-09-21T22:00:00.000Z");
  assert.equal(k.capped, false);
});

test("map assignment contacts: the match share", () => {
  assert.equal(matchShare(0, 0), null);
  assert.equal(matchShare(200, 50), 0.75);
  assert.equal(matchShare(10, 12), 0); // never below 0
});
