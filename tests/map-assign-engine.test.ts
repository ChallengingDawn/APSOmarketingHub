import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BODY_LIMIT, DEFAULT_SETTINGS, cleanPrefix, cleanSettings, companyChanges, contactChanges, countryPutBytes, emailDomain, fullDue, inYear,
  internalFromList, isInternal, layerPoints, mergeRules, ownContacts, placeZip, priorityKey, saeStats, saeTarget, validateLive, validateRules,
  zipIndex, zurich, type LayerRow,
} from "../src/lib/mapAssign/plan";
import { SEED } from "../src/lib/mapAssign/seed";
import type { AssignRules, CountryRule } from "../src/lib/mapAssign/rules";

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

test("map assignment engine: regions, SAE redirects and people are checked and kept", () => {
  const r = JSON.parse(JSON.stringify(good));
  r.countries.fr.zones[0].regions = ["fr-69", " FR-2A ", "FR-69"];
  r.countries.fr.zones.push({ id: "bfc", owner: "29117550", regions: ["FR-21"] }); // whole regions only: no prefixes needed
  r.countries.fr.saeOverride = { " Köremez  James ": "38431796" };
  r.countries.fr.people = ["1202569408", 29117550, "29117550"];
  const v = validateRules(r);
  assert.equal(v.ok, true, v.ok ? "" : v.errors.join("; "));
  if (!v.ok) return;
  const fr = v.value.countries.FR;
  assert.deepEqual(fr.zones[0].regions, ["FR-69", "FR-2A"]); // upper-cased, once
  assert.deepEqual(fr.zones[1], { id: "bfc", owner: "29117550", prefixes: [], regions: ["FR-21"] });
  assert.deepEqual(fr.saeOverride, { "Köremez James": "38431796" });
  assert.deepEqual(fr.people, ["1202569408", "29117550"]);
  assert.equal(v.value.countries.NL.people, undefined); // none = anyone
  assert.equal(v.value.countries.NL.saeOverride, undefined);

  const bad = (patch: (x: typeof r) => void, has: RegExp) => {
    const x = JSON.parse(JSON.stringify(r));
    patch(x);
    const out = validateRules(x);
    assert.equal(out.ok, false, String(has));
    if (!out.ok) assert.ok(out.errors.some((e) => has.test(e)), `${has} not in ${JSON.stringify(out.errors)}`);
  };
  bad((x) => { x.countries.fr.zones[0].regions.push("Rhône"); }, /"Rhône" is not a region code/);
  bad((x) => { x.countries.fr.zones[0].regions = "FR-69"; }, /regions is not a list/);
  bad((x) => { x.countries.fr.zones[1].regions.push("FR-69"); }, /region FR-69 is in zone "ara" and in zone "bfc"/);
  bad((x) => { delete x.countries.fr.zones[1].regions; }, /zone bfc: prefixes is not a list/);
  bad((x) => { x.countries.fr.saeOverride = ["38431796"]; }, /FR: SAE redirects is not a table/);
  bad((x) => { x.countries.fr.saeOverride = { "Köremez James": "James" }; }, /FR SAE redirects: SAE "Köremez James": owner "James"/);
  bad((x) => { x.countries.fr.saeOverride = { "Köremez James": "1", "JAMES KÖREMEZ": "2" }; }, /same SAE with two owners/);
  bad((x) => { x.countries.fr.people = "1202569408"; }, /FR: people is not a list/);
  bad((x) => { x.countries.fr.people = ["1202569408", "TSA Team"]; }, /FR people 2: owner "TSA Team"/);
  // a redirect table / people list sent as null or empty is gone
  const cleared = JSON.parse(JSON.stringify(r));
  cleared.countries.fr.saeOverride = null;
  cleared.countries.fr.people = [];
  const c = validateRules(cleared);
  assert.ok(c.ok && c.value.countries.FR.saeOverride === undefined && c.value.countries.FR.people === undefined);
});

test("map assignment engine: one country per PUT stays under the 8 KB WAF limit", () => {
  for (const [cc, rule] of Object.entries(SEED.countries)) assert.ok(countryPutBytes(cc, rule) < BODY_LIMIT, `${cc}: ${countryPutBytes(cc, rule)} bytes`);
  const sae = new TextEncoder().encode(JSON.stringify({ patch: { sae: SEED.sae, defaultOwner: SEED.defaultOwner } })).length;
  assert.ok(sae < BODY_LIMIT, `the SAE table: ${sae} bytes`);
  assert.equal(countryPutBytes("CH", null), JSON.stringify({ patch: { countries: { CH: null } } }).length);
  const fr: CountryRule = { country: "FR", source: "map", zones: [{ id: "a", owner: "1", prefixes: [], label: "Jérémy" }] };
  assert.equal(countryPutBytes("FR", fr), JSON.stringify({ patch: { countries: { FR: fr } } }).length + 2); // UTF-8 bytes, not characters
});

test("map assignment engine: the SAE a country uses (the Performis tab)", () => {
  const rules: AssignRules = {
    defaultOwner: "9", sae: { "Kalt Jan": "1", "Pielock Nancy": "2", "TSA Team": "9" },
    countries: {
      CH: { country: "CH", source: "sae", zones: [], people: ["9", "1", "2"] },
      LI: { country: "LI", source: "sae", zones: [], people: ["9"], saeOverride: { "Kalt Jan": "1" } },
      FR: { country: "FR", source: "map", zones: [] },
    },
  };
  assert.deepEqual(saeTarget(rules, "CH", "JAN KALT"), { owner: "1", redirected: false, notInCountry: false });
  assert.deepEqual(saeTarget(rules, "LI", "Pielock Nancy"), { owner: null, redirected: false, notInCountry: true }); // not one of LI's people
  assert.deepEqual(saeTarget(rules, "LI", "kalt  jan"), { owner: "1", redirected: true, notInCountry: false }); // a redirect may point to anyone
  assert.deepEqual(saeTarget(rules, "DE", "Pielock Nancy"), { owner: "2", redirected: false, notInCountry: false }); // no rule: anyone
  assert.deepEqual(saeTarget(rules, "FR", "Kalt Jan"), { owner: "1", redirected: false, notInCountry: false }); // the table's answer (FR is "map": shown, not copied)
  assert.deepEqual(saeTarget(rules, "CH", "Köremez James"), { owner: null, redirected: false, notInCountry: false }); // not in the table
  assert.deepEqual(saeTarget(rules, null, ""), { owner: null, redirected: false, notInCountry: false });
});

test("map assignment engine: where a postcode sits on the map", () => {
  const ch = zipIndex([["3000", 46.9, 7.4, "CH-BE"], ["3011", 46.9, 7.4, "ch-be"], ["8400", 47.5, 8.7, "CH-ZH"], ["8404", 47.5, 8.7, "CH-ZH"], ["6900", 46, 8.9], "junk", [null, 1, 2]]);
  assert.equal(ch.keys.length, 5);
  assert.deepEqual(placeZip(ch, "3011"), { code: "3011", region: "CH-BE", exact: true });
  assert.deepEqual(placeZip(ch, "CH-8400"), { code: "8400", region: "CH-ZH", exact: true });
  assert.deepEqual(placeZip(ch, "6900"), { code: "6900", region: null, exact: true }); // a 3-element point: no region
  assert.deepEqual(placeZip(ch, "8403"), { code: "8404", region: "CH-ZH", exact: false }); // the nearest of 8400 / 8404
  assert.deepEqual(placeZip(ch, "8401"), { code: "8400", region: "CH-ZH", exact: false });
  assert.deepEqual(placeZip(ch, "3012"), { code: "3011", region: "CH-BE", exact: false });
  assert.equal(placeZip(ch, "3999"), null); // nothing else starts with 39
  assert.equal(placeZip(ch, "5000"), null);
  assert.equal(placeZip(ch, "84000"), null); // a numeric postcode longer than the country's: another country's
  assert.equal(placeZip(ch, "84"), null); // shorter than the country's
  assert.equal(placeZip(ch, ""), null);
  assert.equal(placeZip(zipIndex(undefined), "3011"), null); // no file
  const nl = zipIndex([["1011", 52.3, 4.9, "NL-NH"], ["1012", 52.3, 4.9, "NL-NH"]]);
  assert.deepEqual(placeZip(nl, "1012 AB"), { code: "1012", region: "NL-NH", exact: false });
  const pl = zipIndex([["00-002", 52.2, 21, "PL-MZ"], ["00-950", 52.2, 21, "PL-MZ"], ["80-001", 54.3, 18.6, "PL-PM"]]);
  assert.deepEqual(placeZip(pl, "00950"), { code: "00-950", region: "PL-MZ", exact: true });
  assert.deepEqual(placeZip(pl, "80-180"), { code: "80-001", region: "PL-PM", exact: false });
});

test("map assignment engine: the map's layers per postcode", () => {
  assert.equal(priorityKey("1-Prio 1 - Pot >25000€"), "P1");
  assert.equal(priorityKey("4- No priority for sales, Pot. <500€"), "P4");
  assert.equal(priorityKey(""), null);
  assert.equal(inYear("2026-09-11", 2026), true);
  assert.equal(inYear("2025-12-31", 2026), false);
  assert.equal(inYear(String(Date.parse("2026-03-01T00:00:00Z")), 2026), true);
  assert.equal(inYear(null, 2026), false);
  const row = (id: string, zip: string | null, x: Partial<LayerRow> = {}): LayerRow =>
    ({ id, name: `C${id}`, zip, owner: "1", revenue: null, lastOrder: null, firstOrder: null, priority: null, ...x });
  const rows = [
    row("1", "3011", { revenue: 1000, lastOrder: "2026-05-01", firstOrder: "2019-01-01", priority: "1-Prio 1 - Pot >25000€", category: "APSOcore" }),
    row("2", "3011", { revenue: 50.5, lastOrder: "2026-02-01", firstOrder: "2026-02-01", priority: "3-Prio 3 - Pot btw 500 & 2499€" }),
    row("3", "3011", { revenue: -20, lastOrder: "2025-12-01", priority: "3-Prio 3 - Pot btw 500 & 2499€" }), // a credit note this year
    row("4", "3011", { revenue: 400, lastOrder: "2026-01-02" }),
    row("5", "3011", { revenue: 300, lastOrder: "2026-01-02" }),
    row("6", "8400"),
    row("7", null),
    row("8", "9999"),
  ];
  const place = (z: string | null) => (z === "3011" || z === "8400" ? z : null);
  const { points, unplaced } = layerPoints(rows, place, 2026);
  assert.equal(unplaced, 2);
  assert.deepEqual(points.map((p) => p.zip), ["3011", "8400"]);
  const b = points[0];
  assert.equal(b.companies, 5);
  assert.equal(b.customers, 4); // an order this year
  assert.equal(b.newCustomers, 1); // first order this year
  assert.equal(b.revenue, 1730.5); // net: the credit note counts
  assert.deepEqual(b.priority, { P1: 1, P3: 2 });
  assert.deepEqual(b.category, { APSOcore: 1 });
  assert.deepEqual(b.top.map((t) => [t.id, t.revenue]), [["1", 1000], ["4", 400], ["5", 300]]);
  // a row without its decision (an old caller) counts no change
  assert.deepEqual(points[1], { zip: "8400", companies: 1, customers: 0, newCustomers: 0, revenue: 0, priority: {}, category: {}, top: [], sae: { "": 1 }, now: { "1": 1 }, decided: {}, change: 0, via: {}, tickets: 0, sales: 0 });
});

test("map assignment engine: the Performis tab per country and SAE", () => {
  const rules: AssignRules = {
    defaultOwner: "9", sae: { "Borey Jeremy": "5", "Pielock Nancy": "2" },
    countries: { LI: { country: "LI", source: "sae", zones: [], people: ["9"], saeOverride: { "Borey Jeremy": "7" } } },
  };
  const stats = saeStats([
    { country: "CH", sae: "Borey Jeremy", owner_now: "5", companies: 10, contacts: 30, off: 1, contactsOff: 2 },
    { country: "CH", sae: "JEREMY BOREY", owner_now: "9", companies: 2, contacts: 4, off: 2, contactsOff: 4 },
    { country: "CH", sae: null, owner_now: null, companies: 3, contacts: 0, off: 3, contactsOff: 0 },
    { country: "LI", sae: "Pielock Nancy", owner_now: "2", companies: 4, contacts: 8, off: 4, contactsOff: 8 },
    { country: "LI", sae: "Borey Jeremy", owner_now: "5", companies: 1, contacts: 1, off: 1, contactsOff: 1 },
  ], rules);
  assert.deepEqual(stats.map((s) => `${s.country} ${s.sae}`), ["CH Borey Jeremy", "CH ", "LI Pielock Nancy", "LI Borey Jeremy"]);
  const j = stats[0];
  assert.equal(j.companies, 12); assert.equal(j.contacts, 34); assert.equal(j.companiesOff, 3); assert.equal(j.contactsOff, 6);
  assert.equal(j.mappedTo, "5"); assert.equal(j.redirected, false);
  assert.deepEqual(j.ownerNow, [{ owner: "5", companies: 10 }, { owner: "9", companies: 2 }]);
  assert.deepEqual(stats[1].ownerNow, [{ owner: null, companies: 3 }]);
  assert.equal(stats[1].mappedTo, null);
  assert.equal(stats[2].mappedTo, null); // Nancy is not one of LI's people
  assert.equal(stats[3].mappedTo, "7"); assert.equal(stats[3].redirected, true);
});
