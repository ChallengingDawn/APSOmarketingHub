import assert from "node:assert/strict";
import { test } from "node:test";
import { FIXABLE, FIX_ELSEWHERE, buildTopics, type TopicRow } from "../src/lib/mapAssign/topics";

const TSA = "1202569408", JAN = "37053854", JEREMY = "29117550";
const row = (id: string, x: Partial<TopicRow>): TopicRow => ({ id, name: `Co ${id}`, country: "CH", zip: "8000", sae: null, ownerNow: TSA, regionNow: TSA, decided: JAN, via: "zone", flags: [], contactsOff: 0, ...x });

test("Fix counts only what Performis does not decide (SARCLA 25.10.2026)", () => {
  const t = buildTopics([
    row("1", {}), row("2", {}), // rule 2, no SAE: fixable
    row("3", { sae: "Kalt Jan", country: "FR", via: "zone" }), // rule 2 with an SAE (a map-only country): Performis' - not fixable
    row("4", { sae: "TSA Team", via: "sae", decided: JEREMY }), // rule 1: Performis'
    row("5", { ownerNow: JAN, regionNow: null }), // region to fill: fixable
    row("6", { ownerNow: JAN, regionNow: JAN, contactsOff: 3 }), // contacts follow: fixable
  ]);
  const by = Object.fromEntries(t.topics.map((x) => [x.topic, x]));
  assert.equal(by.rule2.companies, 3);
  assert.equal(by.rule2.fixable, 2);
  assert.equal(by.rule1.fixable, 0);
  assert.equal(by.region.fixable, 1);
  assert.equal(by.contacts.fixable, 1);
  // the topics fixed elsewhere say where; none of them is fixable from the page
  for (const k of ["no-country", "left", "sae-nobody", "sae-elsewhere", "rule1", "redirection"] as const) {
    assert.ok(FIX_ELSEWHERE[k], k);
    assert.equal(FIXABLE[k], undefined, k);
  }
});
