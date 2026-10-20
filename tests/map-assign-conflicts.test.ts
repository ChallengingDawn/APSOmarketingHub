import assert from "node:assert/strict";
import { test } from "node:test";
import { conflictCounts, heldBy, layerPoints, likeEscape, redirectionSig, type ConflictRow, type LayerRow } from "../src/lib/mapAssign/plan";
import type { PubRule } from "../src/lib/ownerRules/rules";

const JEREMY = "29117550", TSA = "1202569408", SANDRA = "30052119", JAMES = "38431796", KALT = "37053854";
const cascade = { contacts: true, tickets: true, tasks: true };
const france: PubRule = { id: "france", kind: "country", countries: ["France", "FR"], customCountries: ["France"], toOwner: JEREMY, cascade };
const sandra: PubRule = { id: "sandra", kind: "owner", fromOwner: SANDRA, toOwner: JAMES, cascade };

const row = (o: Partial<ConflictRow>): ConflictRow => ({ country: "FR", country_raw: "FR", country_custom: null, owner_now: TSA, owner_decided: TSA, ...o });

test("conflicts: per rule, the companies it matches and those the map gives to someone else", () => {
  const rows = [
    row({ owner_decided: JEREMY }), // the map agrees
    row({ owner_decided: TSA }), row({ owner_decided: TSA }), // the map: TSA Team
    row({ country_raw: null, country_custom: "France", owner_decided: TSA }),
    row({ country: "CH", country_raw: "CH", owner_now: SANDRA, owner_decided: KALT }), // Sandra's, the map: Jan Kalt
    row({ country: "CH", country_raw: "CH", owner_now: SANDRA, owner_decided: JAMES }), // Sandra's, the map agrees
    row({ country: "DE", country_raw: "DE", owner_now: KALT, owner_decided: KALT }), // no rule
  ];
  const c = conflictCounts(rows, [france, sandra]);
  assert.deepEqual(c.get("france"), { matched: 4, against: [{ owner: TSA, companies: 3, countries: ["FR"] }] });
  assert.deepEqual(c.get("sandra"), { matched: 2, against: [{ owner: KALT, companies: 1, countries: ["CH"] }] });
});

test("conflicts: the first matching rule takes the company, as Owner redirection runs them", () => {
  // a French company of Sandra's: the France rule comes first and takes it
  const rows = [row({ owner_now: SANDRA, owner_decided: TSA })];
  const c = conflictCounts(rows, [france, sandra]);
  assert.equal(c.get("france")!.matched, 1);
  assert.equal(c.get("sandra")!.matched, 0);
  const d = conflictCounts(rows, [sandra, france]);
  assert.equal(d.get("sandra")!.matched, 1);
  assert.equal(d.get("france")!.matched, 0);
});

test("held: only the first matching rule, and only when it is kept over the map", () => {
  const fr = { country_raw: "france", country_custom: null, owner_now: TSA };
  assert.equal(heldBy(fr, [france, sandra], new Set()), null);
  assert.equal(heldBy(fr, [france, sandra], new Set(["france"]))?.id, "france");
  // Sandra's French company: France comes first - Sandra's rule kept does not hold it
  assert.equal(heldBy({ ...fr, owner_now: SANDRA }, [france, sandra], new Set(["sandra"])), null);
  assert.equal(heldBy({ country_raw: "CH", country_custom: null, owner_now: SANDRA }, [france, sandra], new Set(["sandra"]))?.id, "sandra");
  assert.equal(heldBy({ country_raw: "CH", country_custom: null, owner_now: TSA }, [france, sandra], new Set(["france", "sandra"])), null);
});

test("an answer lapses when the rule's matching or person changes, not when its order or cascade does", () => {
  const a = redirectionSig(france);
  assert.equal(redirectionSig({ ...france, countries: ["FR", "france"], cascade: { contacts: false, tickets: false, tasks: false } }), a);
  assert.notEqual(redirectionSig({ ...france, toOwner: TSA }), a);
  assert.notEqual(redirectionSig({ ...france, customCountries: [] }), a);
  assert.notEqual(redirectionSig(sandra), redirectionSig({ ...sandra, fromOwner: KALT }));
});

test("layers: where it comes from - SAE, owner now, owner by the rules, what would change", () => {
  const base = { name: "x", revenue: null, lastOrder: null, firstOrder: null, priority: null };
  const rows: LayerRow[] = [
    { ...base, id: "1", zip: "1700", owner: TSA, sae: "ESO CH GER", decided: KALT, region: TSA, via: "sae" },
    { ...base, id: "2", zip: "1700", owner: KALT, sae: " ESO  CH GER ", decided: KALT, region: KALT, via: "sae" },
    { ...base, id: "3", zip: "1700", owner: JEREMY, sae: null, decided: JEREMY, region: null, via: "zone" },
    { ...base, id: "4", zip: "1700", owner: null, sae: "Borey Jeremy", decided: JEREMY, region: JEREMY },
  ];
  const { points } = layerPoints(rows, (z) => z, 2026);
  assert.equal(points.length, 1);
  const p = points[0];
  assert.deepEqual(p.sae, { "ESO CH GER": 2, "": 1, "Borey Jeremy": 1 });
  assert.deepEqual(p.now, { [TSA]: 1, [KALT]: 1, [JEREMY]: 1, "": 1 });
  assert.deepEqual(p.decided, { [KALT]: 2, [JEREMY]: 2 });
  assert.equal(p.change, 3); // 1: owner TSA; 3: region empty; 4: no owner
  assert.deepEqual(p.via, { sae: 2, zone: 1 }); // which rule decided (4 came without one)
});

test("search text is matched as typed", () => {
  assert.equal(likeEscape("50%_off\\x"), "50\\%\\_off\\\\x");
  assert.equal(likeEscape("Kalt"), "Kalt");
});
