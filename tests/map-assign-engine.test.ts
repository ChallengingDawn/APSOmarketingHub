import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SETTINGS, cleanPrefix, cleanSettings, companyChanges, contactChanges, emailDomain, fullDue, internalFromList, isInternal, mergeRules,
  ownContacts, validateLive, validateRules, zurich,
} from "../src/lib/mapAssign/plan";
import { SEED } from "../src/lib/mapAssign/seed";
import type { AssignRules } from "../src/lib/mapAssign/rules";

const good = {
  defaultOwner: "1202569408",
  sae: { "Borey Jeremy": "29117550", " Kalt  Jan ": 1229999295 },
  countries: {
    fr: { source: "map", zones: [{ id: "ara", owner: "29117550", prefixes: ["01", " 69 ", "21-25"], label: "Auvergne-Rhône-Alpes" }], defaultOwner: "1202569408" },
    NL: { country: "NL", source: "sae", zones: [{ id: "nl", owner: "1230006208", prefixes: ["50-81", "1234ab"] }], keyAccounts: [{ owner: "1230006208", erpIds: ["770354", " 771855 ", "770354"] }] },
  },
};

test("map assignment engine: a PUT's rules are checked and stored clean", () => {
  const v = validateRules(good);
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.deepEqual(Object.keys(v.value.countries).sort(), ["FR", "NL"]); // keys upper-cased
  assert.equal(v.value.countries.FR.country, "FR");
  assert.deepEqual(v.value.countries.FR.zones[0].prefixes, ["01", "69", "21-25"]);
  assert.deepEqual(v.value.countries.NL.zones[0].prefixes, ["50-81", "1234AB"]);
  assert.deepEqual(v.value.countries.NL.keyAccounts?.[0].erpIds, ["770354", "771855"]); // trimmed, once
  assert.equal(v.value.sae["Kalt Jan"], "1229999295"); // spaces folded, number -> id text
});

test("map assignment engine: what a PUT may not store", () => {
  const bad = (patch: (r: typeof good & Record<string, unknown>) => unknown, has: RegExp) => {
    const r = JSON.parse(JSON.stringify(good));
    const out = validateRules(patch(r) ?? r);
    assert.equal(out.ok, false, String(has));
    if (!out.ok) assert.ok(out.errors.some((e) => has.test(e)), `${has} not in ${JSON.stringify(out.errors)}`);
  };
  bad((r) => { r.defaultOwner = "TSA Team"; }, /default owner.*not a HubSpot owner id/);
  bad((r) => { (r.sae as Record<string, unknown>)["X"] = "abc"; }, /SAE "X"/);
  bad((r) => { (r.countries as Record<string, unknown>).France = r.countries.fr; }, /not an ISO 3166/);
  bad((r) => { (r.countries.fr as Record<string, unknown>).country = "DE"; }, /FR: the rule says country "DE"/);
  bad((r) => { r.countries.fr.zones[0].prefixes.push("30-389"); }, /"30-389" is not a postcode prefix/);
  bad((r) => { r.countries.fr.zones[0].prefixes.push("38-30"); }, /"38-30"/);
  bad((r) => { r.countries.fr.zones[0].prefixes.push("75 001-x"); }, /is not a postcode prefix/);
  bad((r) => { r.countries.fr.zones.push({ ...r.countries.fr.zones[0] }); }, /zone id "ara" twice/);
  bad((r) => { r.countries.fr.zones[0].owner = ""; }, /FR zone ara: owner/);
  bad((r) => { (r.countries.fr as Record<string, unknown>).source = "zones"; }, /source must be/);
  bad((r) => { (r.sae as Record<string, unknown>)["JEREMY borey"] = "1"; }, /same SAE with two owners/);
  bad((r) => { (r.countries.NL.keyAccounts as unknown[])[0] = { owner: "1", erpIds: "770354" }; }, /erpIds is not a list/);
  bad(() => "nope", /not an object/);
  // the same SAE twice for the SAME person is fine
  const twice = JSON.parse(JSON.stringify(good));
  twice.sae["JEREMY borey"] = "29117550";
  assert.equal(validateRules(twice).ok, true);
});

test("map assignment engine: the seed passes the PUT's checks", () => {
  const v = validateRules(SEED);
  assert.equal(v.ok, true, v.ok ? "" : v.errors.join("; "));
});

test("map assignment engine: a patch is one country, merged", () => {
  const cur = (validateRules(good) as { ok: true; value: AssignRules }).value;
  const m = mergeRules(cur, { countries: { de: { country: "DE", source: "map", zones: [] }, NL: null } });
  assert.deepEqual(Object.keys(m.countries).sort(), ["DE", "FR"]);
  assert.equal(m.sae, cur.sae);
  assert.equal(mergeRules(cur, { defaultOwner: "1" }).defaultOwner, "1");
});

test("map assignment engine: prefixes and live switches", () => {
  assert.equal(cleanPrefix(" 30-38 "), "30-38");
  assert.equal(cleanPrefix("ab-cd"), "AB-CD");
  assert.equal(cleanPrefix("3-38"), null);
  assert.equal(cleanPrefix(""), null);
  assert.equal(cleanPrefix(869), "869");
  assert.deepEqual(validateLive({ fr: true, CH: false }), { ok: true, value: { FR: true, CH: false } });
  assert.equal(validateLive({ France: true }).ok, false);
  assert.equal(validateLive({ FR: "yes" }).ok, false);
  assert.equal(validateLive(null).ok, false);
});

test("map assignment engine: only what differs is written", () => {
  assert.deepEqual(companyChanges({ owner: "1", region: "1" }, "1"), {});
  assert.deepEqual(companyChanges({ owner: "2", region: null }, "1"), { hubspot_owner_id: "1", region_responsibility: "1" });
  assert.deepEqual(companyChanges({ owner: "1", region: "" }, "1"), { region_responsibility: "1" });
  // a contact follows its company: owner, region, SAE
  assert.deepEqual(contactChanges({ owner: "1", region: "1", sae: "Borey Jeremy" }, { owner: "1", sae: "Borey Jeremy" }), {});
  assert.deepEqual(contactChanges({ owner: "2", region: "1", sae: null }, { owner: "1", sae: "Borey Jeremy" }), { hubspot_owner_id: "1", sae_performis: "Borey Jeremy" });
  // the company has no SAE: the contact's is never blanked
  assert.deepEqual(contactChanges({ owner: "1", region: "1", sae: "Kalt Jan" }, { owner: "1", sae: null }), {});
  assert.deepEqual(contactChanges({ owner: "1", region: "1", sae: " Kalt Jan " }, { owner: "1", sae: "Kalt Jan" }), {});
});

test("map assignment engine: a contact belongs to its primary company only", () => {
  const assoc = new Map([
    ["A", ["c1", "c2", "c3", "c4", "c5"]],
    ["B", ["c2", "c3", "c6"]],
  ]);
  const primary: Record<string, string | null> = { c1: "A", c2: "B", c3: null, c4: "Z", c6: "B" }; // c5 not read
  const own = ownContacts(["A", "B"], assoc, (id) => (id in primary ? primary[id] : undefined));
  assert.deepEqual(own.get("A"), ["c1", "c3"]); // c2 is B's, c4 is Z's (outside), c5 unread; c3 has no primary: first company
  assert.deepEqual(own.get("B"), ["c2", "c6"]);
  assert.deepEqual(ownContacts(["X"], new Map(), () => null).get("X"), []);
});

test("map assignment engine: the nightly full read", () => {
  const at = (s: string) => Date.parse(s);
  assert.deepEqual(zurich(at("2026-10-19T00:30:00Z")), { day: "2026-10-19", hm: "02:30" }); // summer time
  assert.deepEqual(zurich(at("2026-12-01T01:30:00Z")), { day: "2026-12-01", hm: "02:30" }); // winter time
  assert.equal(fullDue(at("2026-10-19T00:00:00Z"), null), true); // never read
  assert.equal(fullDue(at("2026-10-19T00:00:00Z"), at("2026-10-18T00:40:00Z")), false); // 02:00 Zurich: not yet
  assert.equal(fullDue(at("2026-10-19T00:35:00Z"), at("2026-10-18T00:40:00Z")), true); // 02:35: last was yesterday
  assert.equal(fullDue(at("2026-10-19T10:00:00Z"), at("2026-10-19T00:36:00Z")), false); // done tonight
  assert.equal(fullDue(at("2026-10-19T00:40:00Z"), at("2026-10-19T00:20:00Z")), true); // the last was before 02:30
  assert.equal(fullDue(at("2026-10-19T00:10:00Z"), at("2026-10-17T23:00:00Z")), true); // more than a day: at once
});

test("map assignment engine: A+P people are never given a customer's owner", () => {
  // the shape of HubSpot list 2865 ("DO NOT EDIT! AP employees")
  const list = {
    filterBranchType: "OR",
    filterBranches: [
      { filterBranchType: "AND", filters: [
        { property: "hs_email_domain", operation: { operator: "IS_EQUAL_TO", values: ["apsoparts.com"] } },
        { property: "email", operation: { operator: "IS_NOT_EQUAL_TO", values: ["diana.fehr@apsoparts.com"] } },
      ] },
      { filterBranchType: "AND", filters: [{ property: "hs_email_domain", operation: { operator: "IS_EQUAL_TO", values: ["Pewatron.com"] } }] },
      { filterBranchType: "AND", filters: [{ property: "email", operation: { operator: "IS_EQUAL_TO", values: ["Someone@Bluewin.ch"] } }] },
    ],
  };
  const i = internalFromList(list);
  assert.equal(isInternal("x@pewatron.com", i), true);
  assert.equal(isInternal("diana.fehr@apsoparts.com", i), true); // an exception in the list is still an employee
  assert.equal(isInternal("x@angst-pfister.com", i), true); // always
  assert.equal(isInternal("someone@bluewin.ch", i), true);
  assert.equal(isInternal("other@bluewin.ch", i), false);
  assert.equal(isInternal(null, i), false);
  assert.equal(isInternal("x@ANGST-PFISTER.COM", internalFromList(undefined)), true); // unreadable list: the two domains
  assert.equal(emailDomain(" Jan.Kalt@Rubix.COM "), "rubix.com");
  assert.equal(emailDomain("no-at-sign"), "");
});

test("map assignment engine: breaker settings", () => {
  assert.deepEqual(cleanSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(cleanSettings({ breaker: "50", contactBreaker: -1, linkBreaker: 1e9 }), { breaker: 50, contactBreaker: DEFAULT_SETTINGS.contactBreaker, linkBreaker: 1000 });
  assert.equal(cleanSettings({ breaker: 0 }).breaker, 0); // 0 = live writes stopped
});
