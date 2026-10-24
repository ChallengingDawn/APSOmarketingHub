import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED } from "../src/lib/mapAssign/seed";
import { performisFix, performisName, spellings } from "../src/lib/mapAssign/performisWrong";

const TSA = "1202569408", JEREMY = "29117550", JAN = "37053854", JAMES = "38431796", STEFAN = "1229976035", HOEHN = "1229976027", STAHL = "32984810";
const NAMES: Record<string, string> = {
  [TSA]: "TSA Team", [JEREMY]: "Jeremy Borey", [JAN]: "Jan Kalt", [JAMES]: "James Koeremez", [STEFAN]: "Stefan Wieneber", [HOEHN]: "Hans Peter Höhn",
  [STAHL]: "Christopher Stahl", "1229999587": "Luca Fantasia", "1229976029": "Maya Marzena Gustak", "1229976031": "Luna Bianca Falk",
};
const name = (o: string) => NAMES[o] ?? `#${o}`;
const active = (o: string) => o !== STAHL && o !== "1229976034" && o !== "31218632";
const sp = spellings(SEED, name);
const fix = (sae: string | null, country: string, decided: string, flags: string[] = [], erpId: string | null = "700001") =>
  performisFix({ sae, erpId, country, decided, flags }, SEED, sp, name, active);

test("each person's spelling: the SAE value that names them, never a code or someone else's name", () => {
  assert.equal(sp.get(JEREMY)?.best, "Borey Jeremy");
  assert.equal(sp.get(JAN)?.best, "Kalt Jan");
  assert.equal(sp.get(STEFAN)?.best, "Wieneber Stefan");
  assert.equal(sp.get(TSA)?.best, "TSA Team");
  assert.equal(performisName("Jeremy Borey"), "Borey Jeremy");
});

test("what Performis should have, and why", () => {
  // not a Performis customer: never listed
  assert.equal(fix("ESO CH GER", "CH", JAN, [], null), null);
  // the right person under its own name: fine - also spelled differently (ö = oe, a hyphen, a middle name)
  assert.equal(fix("Borey Jeremy", "CH", JEREMY), null);
  assert.equal(fix("Köremez James", "FR", JAMES), null);
  assert.equal(fix("Höhn Hans-Peter", "DE", HOEHN), null);
  assert.equal(fix("Hans Peter Höhn", "DE", HOEHN), null);
  assert.equal(fix("Fantasia Luca Mirko", "IT", "1229999587"), null);
  // another name or a team code for the right person (SARCLA: "ESO CH GER ... change it completely")
  assert.deepEqual(fix("ESO CH GER", "CH", JAN), { reason: "alias", write: "Kalt Jan" });
  assert.deepEqual(fix("WIESTE", "DE", STEFAN), { reason: "alias", write: "Wieneber Stefan" });
  assert.deepEqual(fix("Alioua Yani", "CH", JEREMY), { reason: "alias", write: "Borey Jeremy" });
  assert.deepEqual(fix("Resident APZ", "CH", TSA), { reason: "alias", write: "TSA Team" });
  // someone who left: whoever the rules give instead
  assert.deepEqual(fix("Stahl Christopher", "DE", TSA, ["owner-deactivated"]), { reason: "left", write: "TSA Team" });
  // France: TSA Team overruled to Jeremy
  assert.deepEqual(fix("TSA Team", "FR", JEREMY), { reason: "redirected", write: "Borey Jeremy" });
  // not a person; no SAE at all
  assert.deepEqual(fix("Region Stuttgart", "DE", TSA), { reason: "unknown", write: "TSA Team" });
  assert.deepEqual(fix(null, "CH", JAN), { reason: "no-sae", write: "Kalt Jan" });
  // the SAE's person does not work the country: the zone's person
  assert.deepEqual(fix("Saraiva Claudio", "DE", STEFAN, ["not-in-country"]), { reason: "elsewhere", write: "Wieneber Stefan" });
});
