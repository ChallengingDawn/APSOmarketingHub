import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, type AssignRules } from "../src/lib/mapAssign/rules";
import { REDIRECTIONS_FIX, RULE_FIXES, applyFixes, withKeyAccount, withRedirectionsOnTheMap, withSae } from "../src/lib/mapAssign/fixes";
import { SEED } from "../src/lib/mapAssign/seed";

const TSA = "1202569408", JEREMY = "29117550", CLAUDIO = "1229976033", YANI = "32968527";
const active = () => true;

/** SARCLA's saved rules of 24.10.2026 14:49, as far as these corrections go: Switzerland's key accounts cut to three. */
const saved = (): AssignRules => {
  const r: AssignRules = JSON.parse(JSON.stringify(SEED));
  r.sae["Alioua Yani"] = YANI;
  delete r.sae["Resident APZ"];
  for (const k of ["Sara Gashi", "Leart Asllani", "Claudio Gabinato", "Hans Peter Höhn", "Luca Fantasia"]) delete r.sae[k];
  r.countries.CH = { ...r.countries.CH, keyAccounts: [{ owner: CLAUDIO, label: "Claudio Saraiva - key customers", erpIds: ["705846", "706892", "707925"] }] };
  return r;
};

test("the corrections of 24.10.2026 reach saved rules once", () => {
  const { rules, applied } = applyFixes(saved(), []);
  assert.equal(applied.length, RULE_FIXES.length);
  assert.equal(rules.sae["Resident APZ"], TSA);
  assert.equal(rules.sae["Alioua Yani"], JEREMY);
  assert.equal(rules.sae["Sara Gashi"], "30050251");
  assert.deepEqual(rules.countries.CH.keyAccounts, [{ owner: CLAUDIO, label: "Claudio Saraiva - key customers", erpIds: ["705846", "706892", "707925", "788310"] }]);
  // applied before: nothing again, an edit made on the page since stays
  const later = { ...rules, sae: { ...rules.sae, "Resident APZ": CLAUDIO } };
  const again = applyFixes(later, RULE_FIXES.map((f) => f.id));
  assert.equal(again.applied.length, 0);
  assert.equal(again.rules.sae["Resident APZ"], CLAUDIO);
});

test("Yani Alioua's SAE goes to Jeremy, Resident APZ to TSA Team", () => {
  const { rules } = applyFixes(saved(), []);
  const yani = decide({ id: "1", country: "Switzerland", zip: "2560", sae: "Alioua Yani" }, rules, active);
  assert.equal(yani.owner, JEREMY);
  assert.equal(yani.via, "sae");
  assert.equal(decide({ id: "2", country: "Switzerland", zip: "8852", sae: "Resident APZ" }, rules, active).owner, TSA);
});

test("withSae replaces a value however it is spelled; withKeyAccount never doubles an id", () => {
  const r = withSae(SEED, "YANI ALIOUA", JEREMY);
  assert.equal(Object.keys(r.sae).filter((k) => k.toLowerCase().includes("alioua")).length, 1);
  assert.equal(r.sae["YANI ALIOUA"], JEREMY);
  const once = withKeyAccount(saved(), "CH", CLAUDIO, "788310", "x");
  assert.equal(withKeyAccount(once, "CH", CLAUDIO, "788310", "x"), once);
  // nobody's list in the country: a new one for the person
  const none = withKeyAccount({ ...saved(), countries: { ...saved().countries, CH: { ...saved().countries.CH, keyAccounts: [] } } }, "CH", CLAUDIO, "788310", "Claudio Saraiva - key customers");
  assert.deepEqual(none.countries.CH.keyAccounts, [{ owner: CLAUDIO, label: "Claudio Saraiva - key customers", erpIds: ["788310"] }]);
  // no rule for the country: unchanged
  assert.equal(withKeyAccount(SEED, "ZZ", CLAUDIO, "1", "x"), SEED);
});

test("Owner redirection's rules become overrides on the map: all of France to Jeremy but James's SAE, Sandra's SAE to James", () => {
  assert.ok(RULE_FIXES.some((f) => f.id === REDIRECTIONS_FIX));
  const base = saved();
  base.sae["Kuridza Sandra"] = "30052119";
  base.countries.FR = { ...base.countries.FR, zones: [...base.countries.FR.zones, { id: "fr-tsa", owner: TSA, label: "TSA Team", prefixes: ["75"] }], saeOverride: { "TSA Team": JEREMY, "KÖREMEZ JAMES": TSA }, saeOverrideByZip: { "75": { "Köremez James": TSA, "Borey Jeremy": TSA } } };
  const { rules } = applyFixes(base, []);
  const fr = (zip: string, sae: string | null) => decide({ id: "1", country: "France", zip, sae }, rules, active).owner;
  assert.equal(fr("75001", null), JEREMY); // a zone that was TSA Team's
  assert.equal(fr("29200", null), JEREMY); // in no zone (was the country's default, TSA Team)
  assert.equal(fr("69001", "TSA Team"), JEREMY);
  // "the redirection was for all France outside of SAE James" - every override on his SAE goes, at every level
  assert.equal(fr("31000", "Köremez James"), "38431796");
  assert.equal(fr("75001", "Köremez James"), "38431796");
  assert.equal(fr("31000", "Kuridza Sandra"), "38431796");
  assert.equal(fr("75001", "Borey Jeremy"), JEREMY); // a zip-code override to TSA Team turned to Jeremy
  assert.ok(Object.keys(rules.countries.FR.saeOverride ?? {}).every((k) => !/james|sandra/i.test(k)));
  assert.equal(fr("31000", "Stahl Christopher"), JEREMY);
  assert.equal(fr("31000", "Some Unknown SAE"), JEREMY);
  assert.ok(rules.countries.FR.keyAccounts?.every((k) => k.owner === JEREMY));
  assert.equal(rules.countries.FR.defaultOwner, JEREMY);
  // Sandra's SAE to James wherever it lands; the other countries untouched
  assert.equal(decide({ id: "2", country: "Switzerland", zip: "1200", sae: "Kuridza Sandra" }, rules, active).owner, "38431796");
  assert.equal(decide({ id: "3", country: "Switzerland", zip: "8000", sae: "ESO CH GER" }, rules, active).owner, "37053854");
  assert.deepEqual(rules.countries.DE, base.countries.DE);
  // no France rule: only the SAE row changes
  const noFr = { ...base, countries: Object.fromEntries(Object.entries(base.countries).filter(([cc]) => cc !== "FR")) };
  assert.equal(withRedirectionsOnTheMap(noFr).countries.FR, undefined);
});

test("the seed carries the same corrections", () => {
  assert.equal(applyFixes(SEED, []).rules.sae["Alioua Yani"], SEED.sae["Alioua Yani"]);
  for (const f of RULE_FIXES.filter((x) => x.id !== "2026-10-24-ch-rochat")) assert.deepEqual(f.apply(SEED).sae, SEED.sae, f.id);
  assert.ok(SEED.countries.CH.keyAccounts?.some((k) => k.owner === CLAUDIO && k.erpIds.includes("788310")));
});
