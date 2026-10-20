import assert from "node:assert/strict";
import { test } from "node:test";
import { TOPIC_ORDER, buildTopics, changedSinceOk, cleanOks, differs, topicOf, type TopicRow } from "../src/lib/mapAssign/topics";

/** A company whose owner moves from TSA to JAN by rule 1 - each case changes what it needs. */
const row = (x: Partial<TopicRow> = {}): TopicRow => ({
  id: "1", name: "Acme AG", country: "CH", zip: "3000", sae: "Kalt Jan",
  ownerNow: "TSA", regionNow: "TSA", decided: "JAN", via: "sae", flags: [], contactsOff: 0,
  ...x,
});

test("map assignment topics: one case per topic", () => {
  assert.equal(topicOf(row({ country: null, flags: ["no-country"] })), "no-country");
  assert.equal(topicOf(row({ via: "default", decided: "TSA2", flags: ["owner-deactivated"] })), "left");
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: null })), "region");
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: "JAN", contactsOff: 4 })), "contacts");
  assert.equal(topicOf(row({ via: "zone", flags: ["sae-unmapped"] })), "sae-nobody");
  assert.equal(topicOf(row({ via: "default", flags: ["not-in-country"] })), "sae-elsewhere");
  assert.equal(topicOf(row()), "rule1");
  assert.equal(topicOf(row({ via: "zone", sae: null })), "rule2");
  assert.equal(topicOf(row({ via: "default", sae: null, flags: ["no-zip"] })), "rule2");
  assert.equal(topicOf(row({ via: "key" })), "key");
  assert.equal(topicOf(row({ via: "redirection" })), "redirection");
  assert.equal(topicOf(row({ via: "something new" })), "other"); // never dropped from the counts
});

test("map assignment topics: nothing differs = no topic", () => {
  const right = row({ ownerNow: "JAN", regionNow: "JAN", contactsOff: 0 });
  assert.equal(differs(right), false);
  assert.equal(topicOf(right), null);
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: "JAN", contactsOff: null })), null); // not counted yet = 0
  // ids compared as text: kv / pg can hand back a number
  assert.equal(topicOf(row({ ownerNow: 123 as unknown as string, regionNow: "123", decided: "123" })), null);
});

test("map assignment topics: precedence", () => {
  // no country beats a person who left
  assert.equal(topicOf(row({ country: null, via: "default", flags: ["no-country", "owner-deactivated"] })), "no-country");
  assert.equal(topicOf(row({ country: "  ", flags: [] })), "no-country");
  // the person left beats the region topic
  assert.equal(topicOf(row({ ownerNow: "TSA", regionNow: "X", decided: "TSA", via: "default", flags: ["owner-deactivated"] })), "left");
  // region beats rule 1: the owner is right, the region is not
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: "TSA", via: "sae", contactsOff: 9 })), "region");
  // contacts only when owner AND region are right
  assert.equal(topicOf(row({ ownerNow: "TSA", regionNow: "JAN", contactsOff: 9 })), "rule1");
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: "TSA", contactsOff: 9 })), "region");
  assert.equal(topicOf(row({ ownerNow: "JAN", regionNow: "JAN", contactsOff: 9, flags: ["sae-unmapped"] })), "contacts");
  // an SAE nobody has beats the via, an SAE elsewhere too
  assert.equal(topicOf(row({ via: "zone", flags: ["sae-unmapped", "not-in-country"] })), "sae-nobody");
  assert.equal(topicOf(row({ via: "zone", flags: ["not-in-country"] })), "sae-elsewhere");
});

test("map assignment topics: the 10% rule", () => {
  assert.equal(changedSinceOk(100, 100), false);
  assert.equal(changedSinceOk(100, 110), false); // exactly 10% is not more than 10%
  assert.equal(changedSinceOk(100, 90), false);
  assert.equal(changedSinceOk(100, 111), true);
  assert.equal(changedSinceOk(100, 89), true);
  assert.equal(changedSinceOk(0, 0), false);
  assert.equal(changedSinceOk(0, 1), true);
  // kv parses JSON: a number stored as text comes back as a number, a broken entry is dropped
  assert.deepEqual(cleanOks({ rule1: { at: "2026-10-20T08:00:00Z", by: 42, companies: "120" }, bogus: { at: "x", companies: 1 }, key: { by: "x" } }),
    { rule1: { at: "2026-10-20T08:00:00Z", by: "42", companies: 120 } });
  assert.deepEqual(cleanOks(null), {});
});

test("map assignment topics: the page's data", () => {
  const rows: TopicRow[] = [
    ...Array.from({ length: 6 }, (_, i) => row({ id: `a${i}`, name: `CH ${i}`, revenue: i })),               // rule1 CH TSA -> JAN
    ...Array.from({ length: 3 }, (_, i) => row({ id: `b${i}`, country: "DE", ownerNow: null, decided: "CAN" })), // rule1 DE nobody -> CAN
    row({ id: "c1", ownerNow: "JAN", regionNow: null, contactsOff: 2 }),                                    // region
    row({ id: "d1", ownerNow: "JAN", regionNow: "JAN", contactsOff: 5 }),                                   // contacts
    row({ id: "e1", country: null, flags: ["no-country"] }),                                                // no country
    row({ id: "z1", ownerNow: "JAN", regionNow: "JAN" }),                                                   // right: left out
  ];
  const oks = { rule1: { at: "2026-10-20T08:00:00Z", by: "SARCLA", companies: 9 }, region: { at: "2026-10-19T08:00:00Z", by: "SARCLA", companies: 4 } };
  const all = buildTopics(rows, { oks, at: "2026-10-20T09:00:00Z" });
  assert.deepEqual(all.topics.map((t) => t.topic), ["no-country", "region", "contacts", "rule1"]); // TOPIC_ORDER, empty ones left out
  assert.deepEqual(all.topics.map((t) => t.topic), TOPIC_ORDER.filter((t) => all.topics.some((x) => x.topic === t)));
  assert.deepEqual(all.total, { companies: 12, contacts: 7, changeOwner: 10 });
  assert.equal(all.countries[0].country, "CH");
  assert.deepEqual(all.countries.find((c) => c.country === "??"), { country: "??", companies: 1, changeOwner: 1 });

  const r1 = all.topics.find((t) => t.topic === "rule1")!;
  assert.equal(r1.companies, 9);
  assert.deepEqual(r1.moves, [{ from: "TSA", to: "JAN", companies: 6, contacts: 0 }, { from: null, to: "CAN", companies: 3, contacts: 0 }]);
  assert.deepEqual(r1.countries, [{ country: "CH", companies: 6 }, { country: "DE", companies: 3 }]);
  assert.equal(r1.examples.length, 5);
  assert.deepEqual(r1.examples.slice(0, 2).map((e) => e.id), ["a5", "b0"]); // one per move in turn, the biggest customer first
  assert.deepEqual(r1.ok, { ...oks.rule1, changed: false });
  const region = all.topics.find((t) => t.topic === "region")!;
  assert.equal(region.kind, "region");
  assert.deepEqual(region.moves, [{ from: null, to: "JAN", companies: 1, contacts: 2 }]); // region now -> the owner
  assert.equal(region.ok?.changed, true); // 4 at the OK, 1 now

  // one country: the OK compares with the topic in every country, the pills stay complete
  const de = buildTopics(rows, { country: "de", oks });
  assert.equal(de.country, "DE");
  assert.deepEqual(de.topics.map((t) => t.topic), ["rule1"]);
  assert.equal(de.topics[0].companies, 3);
  assert.equal(de.topics[0].all, 9);
  assert.equal(de.topics[0].ok?.changed, false);
  assert.equal(de.countries.length, all.countries.length);
  assert.deepEqual(buildTopics(rows, { country: "??" }).topics.map((t) => t.topic), ["no-country"]);
});
