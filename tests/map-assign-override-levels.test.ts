import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, saeOverrideFor, type AssignRules } from "../src/lib/mapAssign/rules";
import { validateRules } from "../src/lib/mapAssign/plan";
import { SEED } from "../src/lib/mapAssign/seed";

const VITALE = "1255191254", LUCA = "1229999587", TSA = "1202569408", JEREMY = "29117550";
const active = () => true;

test("an SAE override by zip code beats the region's, the region's beats the country's (SARCLA 25.10.2026)", () => {
  const rules: AssignRules = JSON.parse(JSON.stringify(SEED));
  rules.countries.IT = { ...rules.countries.IT, saeOverride: { "Vitale Simone": TSA }, saeOverrideByRegion: { "IT-SV": { "Vitale Simone": LUCA } }, saeOverrideByZip: { "17014": { "VITALE simone": JEREMY } } };
  const it = rules.countries.IT;
  assert.deepEqual(saeOverrideFor(it, "Vitale Simone", "17014", "IT-SV"), ["VITALE simone", JEREMY, "zip code 17014"]);
  assert.deepEqual(saeOverrideFor(it, "Vitale Simone", "17010", "IT-SV"), ["Vitale Simone", LUCA, "IT-SV"]);
  assert.deepEqual(saeOverrideFor(it, "Vitale Simone", "20100", "IT-MI"), ["Vitale Simone", TSA, null]);
  assert.equal(saeOverrideFor(it, "Fantasia Luca Mirko", "17014", "IT-SV"), undefined);
  // decide uses them
  assert.equal(decide({ id: "1", country: "Italy", zip: "17014", region: "IT-SV", sae: "Vitale Simone" }, rules, active).owner, JEREMY);
  assert.equal(decide({ id: "2", country: "Italy", zip: "17010", region: "IT-SV", sae: "Vitale Simone" }, rules, active).owner, LUCA);
  const d = decide({ id: "3", country: "Italy", zip: "20100", region: "IT-MI", sae: "Vitale Simone" }, rules, active);
  assert.equal(d.owner, TSA); assert.match(d.detail, /redirected in IT/);
  // no override anywhere: the SAE table
  assert.equal(decide({ id: "4", country: "Italy", zip: "20100", region: "IT-MI", sae: "Vitale Simone" }, SEED, active).owner, VITALE);
});

test("the region and zip-code overrides survive validation; a bad region is refused", () => {
  const ok = validateRules({ ...SEED, countries: { ...SEED.countries, IT: { ...SEED.countries.IT, saeOverrideByRegion: { "it-sv": { "Vitale Simone": LUCA } }, saeOverrideByZip: { "17014": { "Vitale Simone": JEREMY } } } } });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.value.countries.IT.saeOverrideByRegion, { "IT-SV": { "Vitale Simone": LUCA } });
    assert.deepEqual(ok.value.countries.IT.saeOverrideByZip, { "17014": { "Vitale Simone": JEREMY } });
  }
  assert.equal(validateRules({ ...SEED, countries: { ...SEED.countries, IT: { ...SEED.countries.IT, saeOverrideByRegion: { "Savona": { "Vitale Simone": LUCA } } } } }).ok, false);
  assert.equal(validateRules({ ...SEED, countries: { ...SEED.countries, IT: { ...SEED.countries.IT, saeOverrideByZip: { "17014": { "Vitale Simone": "nobody" } } } } }).ok, false);
});
