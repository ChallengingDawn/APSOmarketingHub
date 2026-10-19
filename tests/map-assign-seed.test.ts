import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { decide, prefixMatches, saeKey, zoneFor, type AssignRules } from "../src/lib/mapAssign/rules";
import { SEED } from "../src/lib/mapAssign/seed";

const TSA = "1202569408", JEREMY = "29117550", JAN = "37053854", CLAUDIO = "1229976033";
const LEFT = new Set(["32984810", "1229976034", "31218632"]); // Stahl, Nitschke, Bozek - deactivated owners the seed keeps
const active = (o: string) => !LEFT.has(o);
const rules: AssignRules = SEED; // the seed IS an AssignRules

/** "30-38" -> 30..38 as strings of the same length; "869" -> ["869"] */
function expand(p: string): string[] {
  const r = /^(\d+)-(\d+)$/.exec(p);
  if (!r) return [p];
  const out: string[] = [];
  for (let n = Number(r[1]); n <= Number(r[2]); n++) out.push(String(n).padStart(r[1].length, "0"));
  return out;
}
const owners = (r: AssignRules) => [
  r.defaultOwner,
  ...Object.values(r.sae),
  ...Object.values(r.countries).flatMap((c) => [...c.zones.map((z) => z.owner), ...(c.keyAccounts ?? []).map((k) => k.owner), ...(c.defaultOwner ? [c.defaultOwner] : [])]),
];

test("map seed: shape - numeric owner ids, well-formed prefixes and ids", () => {
  for (const o of owners(rules)) assert.match(o, /^\d+$/, `owner ${o}`);
  assert.equal(rules.defaultOwner, TSA);
  for (const [cc, c] of Object.entries(rules.countries)) {
    assert.equal(c.country, cc);
    assert.match(cc, /^[A-Z]{2}$/);
    assert.ok(c.source === "sae" || c.source === "map");
    const ids = new Set<string>();
    for (const z of c.zones) {
      assert.ok(!ids.has(z.id), `${cc} zone id ${z.id} twice`); ids.add(z.id);
      assert.ok(z.prefixes.length > 0, `${cc} ${z.id} has no prefix`);
      for (const p of z.prefixes) {
        const r = /^(\w+)-(\w+)$/.exec(p);
        if (r) {
          assert.equal(r[1].length, r[2].length, `${cc} ${p}: a range of one length`);
          assert.ok(Number(r[1]) < Number(r[2]), `${cc} ${p}: low-high`);
          assert.ok(prefixMatches(r[1], p) && prefixMatches(r[2], p), `${cc} ${p}: matches its own ends`);
        } else assert.match(p, /^\d+$/, `${cc} ${p}`);
      }
    }
    // one postcode prefix, one person: no prefix of one length in two zones of a country
    const seen = new Map<string, string>();
    for (const z of c.zones) for (const p of z.prefixes) for (const e of expand(p)) {
      assert.ok(!seen.has(e), `${cc} prefix ${e} in ${seen.get(e)} and ${z.id}`); seen.set(e, z.id);
    }
    // an ERP id belongs to one key-account list
    const erp = new Map<string, string>();
    for (const k of c.keyAccounts ?? []) for (const id of k.erpIds) {
      assert.match(id, /^\d+$/);
      assert.ok(!erp.has(id) || erp.get(id) === k.owner, `${cc} ERP ${id} on two owners`); erp.set(id, k.owner);
    }
  }
});

test("map seed: the Performis SAE table (3836456157)", () => {
  assert.equal(Object.keys(rules.sae).length, 27); // the workflow's 26 + "Köremez James" (SARCLA 19.10.2026)
  const keys = Object.keys(rules.sae).map(saeKey);
  assert.equal(new Set(keys).size, keys.length, "no two SAE values with the same key");
  assert.equal(rules.sae["Borey Jeremy"], JEREMY);
  assert.equal(rules.sae["Kalt Jan"], JAN);
  assert.equal(rules.sae["Höhn Hans-Peter"], "1229976027");
  assert.equal(rules.sae["Fantasia Luca Mirko"], "1229999587");
  assert.equal(rules.sae["TSA Team"], TSA);
  // deactivated owners are kept - the engine flags them
  assert.equal(rules.sae["Stahl Christopher"], "32984810");
  assert.equal(rules.sae["Nitschke Benjamin"], "1229976034");
  assert.equal(rules.sae["Bozek Paulina"], "31218632");
  // not in the workflow
  assert.equal(rules.sae["Köremez James"], "38431796"); // Sandra's customers -> James Koeremez
});

test("map seed: sources - France on the map, the rest on Performis", () => {
  for (const cc of ["CH", "DE", "IT", "AT", "NL", "PL"]) assert.equal(rules.countries[cc].source, "sae", cc);
  const fr = rules.countries.FR;
  assert.equal(fr.source, "map");
  assert.equal(fr.defaultOwner, TSA);
  assert.deepEqual(fr.zones.map((z) => z.owner), [JEREMY]);
  const deps = fr.zones.flatMap((z) => z.prefixes.flatMap(expand)).sort();
  assert.deepEqual(deps, ["01", "03", "07", "15", "21", "25", "26", "38", "39", "42", "43", "58", "63", "69", "70", "71", "73", "74", "89", "90"]);
});

test("map seed: spot checks from the FEHDIA workflow (2937369826)", () => {
  const who = (cc: string, zip: string) => zoneFor(zip, rules.countries[cc].zones)?.zone.owner ?? null;
  assert.equal(who("CH", "3000"), JAN);
  assert.equal(who("CH", "8001"), JAN);
  assert.equal(who("CH", "1200"), JEREMY);
  assert.equal(who("CH", "3900"), JEREMY); // 39 is Jeremy's in the workflow
  assert.equal(who("CH", "6900"), TSA); // Ticino
  assert.equal(who("CH", "8400"), null); // a gap in the workflow (84) -> the country default
  assert.equal(who("DE", "80331"), "817497321"); // Marc Frech
  assert.equal(who("DE", "44135"), "817647087"); // Bernd Rausmann
  assert.equal(who("DE", "86950"), "1229998780"); // Christoph Lange: 869
  assert.equal(who("DE", "86150"), "32984810"); // 860-868: Christopher Stahl (placeholder)
  assert.equal(who("DE", "20095"), TSA); // placeholder for Tobias Witt
  assert.equal(who("DE", "D-01067"), "1229976034"); // Benjamin Nitschke
  assert.equal(who("IT", "20121"), "1255191254"); // Milano: Simone Vitale
  assert.equal(who("IT", "20900"), "33688321"); // Monza: Raffaello Lonardi
  assert.equal(who("IT", "20500"), null);
  assert.equal(who("IT", "00184"), "1229999587"); // Roma: Luca Fantasia
  assert.equal(who("AT", "1010"), "1229976036"); // Tamara Mandl
  assert.equal(who("AT", "6020"), null);
  assert.equal(who("NL", "5611 AB"), "1230006208"); // Nigel van der Loo
  assert.equal(who("PL", "00-950"), "31218632"); // Paulina Bozek
});

test("map seed: decisions with the engine's rules", () => {
  const d = (c: { country: string; zip?: string; sae?: string; erpId?: string }) => decide({ id: "1", ...c }, rules, active);
  assert.equal(d({ country: "CH", zip: "1200", sae: "Kalt Jan" }).owner, JAN); // SAE first in CH
  const z = d({ country: "CH", zip: "3000" });
  assert.equal(z.owner, JAN); assert.equal(z.via, "zone");
  assert.equal(d({ country: "CH", zip: "8400" }).owner, TSA);
  assert.equal(d({ country: "FR", zip: "75001", sae: "Borey Jeremy" }).owner, TSA); // map country: Paris is TSA
  assert.equal(d({ country: "FR", zip: "69001", sae: "TSA Team" }).owner, JEREMY);
  assert.equal(d({ country: "FR", zip: "90000" }).owner, JEREMY); // Territoire de Belfort (SARCLA's 20th)
  const left = d({ country: "DE", zip: "01067" });
  assert.equal(left.owner, TSA); assert.ok(left.flags.includes("owner-deactivated")); // Nitschke has left
  assert.equal(d({ country: "CH", zip: "3000", sae: "Kalt Jan", erpId: "799177" }).owner, "37053854"); // a known SAE beats the key list (as the workflows)
  assert.equal(d({ country: "CH", zip: "3000", erpId: "799177" }).owner, CLAUDIO); // no SAE: the key account
  assert.equal(d({ country: "IT", zip: "20121", erpId: "770354" }).owner, "1229999587"); // Luca's reseller list
  assert.equal(d({ country: "FR", zip: "75001", erpId: "797740" }).owner, JEREMY); // Jeremy's key customer
});

test("map seed: geo files the page loads", () => {
  const dir = join(process.cwd(), "public/geo");
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as { country: string; name: string; points: number; bytes: number }[];
  assert.ok(index.length >= 7);
  for (const cc of ["CH", "DE", "FR", "IT", "AT", "NL", "PL"]) assert.ok(index.some((i) => i.country === cc), cc);
  for (const i of index) {
    for (const kind of ["postcodes", "shapes"]) assert.ok(existsSync(join(dir, kind, `${i.country}.json`)), `${kind}/${i.country}`);
  }
  const ch = JSON.parse(readFileSync(join(dir, "postcodes/CH.json"), "utf8")) as { country: string; points: [string, number, number][] };
  assert.equal(ch.country, "CH");
  const bern = ch.points.find((p) => p[0] === "3011");
  assert.ok(bern && Math.abs(bern[1] - 46.95) < 0.05 && Math.abs(bern[2] - 7.45) < 0.05, "3011 is Bern");
  const fr = JSON.parse(readFileSync(join(dir, "postcodes/FR.json"), "utf8")) as { points: [string, number, number][] };
  assert.ok(fr.points.every((p) => /^\d{5}$/.test(p[0]) && !/^9[78]/.test(p[0])), "France: metropolitan 5-digit codes");
  const shapes = JSON.parse(readFileSync(join(dir, "shapes/FR.json"), "utf8")) as { outline: { type: string }; regions: { code: string }[] };
  assert.ok(["Polygon", "MultiPolygon"].includes(shapes.outline.type));
  assert.equal(shapes.regions.length, 96); // metropolitan départements
});
