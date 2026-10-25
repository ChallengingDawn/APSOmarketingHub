import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, type AssignRules } from "../src/lib/mapAssign/rules";
import { mergeRules, validateRules } from "../src/lib/mapAssign/plan";
import { RULE_FIXES, SUCCESSORS_FROM_WORKFLOWS, applyFixes, withoutPlaceholders } from "../src/lib/mapAssign/fixes";
import { SEED } from "../src/lib/mapAssign/seed";

const TSA = "1202569408", STAHL = "32984810", NITSCHKE = "1229976034", BOZEK = "31218632", RAUSMANN = "817647087";
const LEFT = new Set([STAHL, NITSCHKE, BOZEK, "1229976038", "29285069", "30795573"]);
const active = (o: string) => !LEFT.has(o);

test("someone who has left: their successor takes the company - SAE, zone - else the default, flagged (SARCLA 25.10.2026)", () => {
  const stahl = decide({ id: "1", country: "Germany", zip: "70173", sae: "Stahl Christopher" }, SEED, active);
  assert.equal(stahl.owner, TSA); assert.equal(stahl.via, "sae"); assert.deepEqual(stahl.flags, ["successor"]);
  const zone = decide({ id: "2", country: "Germany", zip: "01067" }, SEED, active); // Nitschke's zone
  assert.equal(zone.owner, RAUSMANN); assert.equal(zone.via, "zone");
  const bozek = decide({ id: "3", country: "Poland", zip: "00-001", sae: "Bozek Paulina" }, SEED, active);
  assert.equal(bozek.owner, TSA); assert.ok(bozek.flags.includes("successor"));
  // no successor: the default, flagged as before
  const none: AssignRules = { ...SEED, successors: {} };
  const d = decide({ id: "4", country: "Germany", zip: "70173", sae: "Stahl Christopher" }, none, active);
  assert.equal(d.via, "default"); assert.ok(d.flags.includes("owner-deactivated"));
  // a successor who has left too: the default
  const gone: AssignRules = { ...SEED, successors: { [STAHL]: NITSCHKE } };
  assert.ok(decide({ id: "5", country: "Germany", zip: "70173", sae: "Stahl Christopher" }, gone, active).flags.includes("owner-deactivated"));
});

test("the successors are kept through validation and patches", () => {
  const v = validateRules({ ...SEED, successors: { [STAHL]: TSA } });
  assert.ok(v.ok); if (v.ok) assert.deepEqual(v.value.successors, { [STAHL]: TSA });
  assert.equal(validateRules({ ...SEED, successors: { [STAHL]: STAHL } }).ok, false);
  assert.equal(validateRules({ ...SEED, successors: { [STAHL]: "nobody" } }).ok, false);
  const merged = mergeRules(SEED, { successors: {} });
  assert.equal(merged.successors, undefined); // emptied
  assert.deepEqual(mergeRules({ ...SEED, successors: { [STAHL]: TSA } }, { sae: SEED.sae }).successors, { [STAHL]: TSA });
});

test("the corrections of 25.10: successors from the redirection workflows, zone names without placeholders", () => {
  const saved: AssignRules = JSON.parse(JSON.stringify({ ...SEED, successors: undefined }));
  saved.countries.DE.zones = saved.countries.DE.zones.map((z) => (z.id === "de-christopher-stahl-placeholder-for-volkan-vanessa" ? { ...z, label: "Christopher Stahl (placeholder for Volkan/Vanessa)" } : z));
  const done = RULE_FIXES.filter((f) => !f.id.startsWith("2026-10-25")).map((f) => f.id);
  const { rules } = applyFixes(saved, done);
  assert.deepEqual(rules.successors, SUCCESSORS_FROM_WORKFLOWS);
  assert.equal(rules.countries.DE.zones.find((z) => z.id === "de-christopher-stahl-placeholder-for-volkan-vanessa")?.label, "Christopher Stahl");
  // an edit made on the page is kept
  const edited = applyFixes({ ...saved, successors: { [STAHL]: RAUSMANN } }, done).rules;
  assert.equal(edited.successors?.[STAHL], RAUSMANN);
  // the seed carries both
  assert.deepEqual(SEED.successors, SUCCESSORS_FROM_WORKFLOWS);
  assert.ok(Object.values(SEED.countries).every((r) => r.zones.every((z) => !/placeholder/i.test(z.label ?? ""))));
  const tobias = withoutPlaceholders({ ...SEED, countries: { DE: { ...SEED.countries.DE, zones: [{ id: "x", owner: TSA, prefixes: ["20"], label: "TSA Team (placeholder for Tobias Witt)" }, { id: "y", owner: TSA, prefixes: ["21"], label: "Marc Frech" }] } } });
  assert.deepEqual(tobias.countries.DE.zones.map((z) => z.label), ["TSA Team", "Marc Frech"]);
});

test("the leavers' Owner redirection rules read as rules, one per person, all to someone still here (SARCLA 25.10.2026)", async () => {
  const { LEAVER_RULES, checkRule } = await import("../src/lib/ownerRules/rules");
  const from = new Set<string>();
  for (const r of LEAVER_RULES) {
    const c = checkRule(r);
    assert.ok(c.ok, `${r.id}: ${c.ok ? "" : c.error}`);
    assert.equal(r.kind, "owner"); assert.ok(r.enabled);
    assert.ok(!from.has(r.fromOwner)); from.add(r.fromOwner);
    assert.ok(LEFT.has(r.fromOwner) && !LEFT.has(r.toOwner));
    // the same person takes over in Map assignment
    assert.equal(SUCCESSORS_FROM_WORKFLOWS[r.fromOwner], r.toOwner);
  }
  assert.equal(LEAVER_RULES.length, Object.keys(SUCCESSORS_FROM_WORKFLOWS).length);
});
