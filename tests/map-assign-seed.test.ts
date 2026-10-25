import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { decide, prefixMatches, saeKey, zoneFor, type AssignRules } from "../src/lib/mapAssign/rules";
import { SEED, SEED_PEOPLE } from "../src/lib/mapAssign/seed";
import { placeZip, zipIndex } from "../src/lib/mapAssign/plan";

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
  ...Object.values(r.countries).flatMap((c) => [
    ...c.zones.map((z) => z.owner), ...(c.keyAccounts ?? []).map((k) => k.owner), ...(c.defaultOwner ? [c.defaultOwner] : []),
    ...(c.people ?? []), ...Object.values(c.saeOverride ?? {}),
  ]),
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
  assert.equal(Object.keys(rules.sae).length, 35); // the workflow's 26 + "Köremez James" + "ESO CH GER" + "WIESTE" (SARCLA 19-20.10.2026) + "Resident APZ" and 5 names (24.10.2026)
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

test("map seed: sources - rule 1 (the SAE) first everywhere, France too since 20.10.2026", () => {
  for (const cc of ["CH", "DE", "IT", "AT", "NL", "PL", "FR"]) assert.equal(rules.countries[cc].source, "sae", cc);
  const fr = rules.countries.FR;
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
  assert.equal(d({ country: "FR", zip: "75001", sae: "Borey Jeremy" }).owner, JEREMY); // rule 1: his SAE, wherever in France
  assert.equal(d({ country: "FR", zip: "75001", sae: "TSA Team" }).owner, JEREMY); // rule 1, overruled in France: TSA Team -> Jeremy
  assert.equal(d({ country: "CH", zip: "8400", sae: "TSA Team" }).owner, TSA); // ... in France only
  assert.equal(d({ country: "FR", zip: "75001", sae: "Köremez James" }).owner, JAMES); // James works France too
  assert.equal(d({ country: "FR", zip: "69001", sae: "Kuridza Sandra" }).owner, "38431796"); // her SAE is James Koeremez's since 25.10.2026 (Owner redirection's rule), and he works France
  assert.equal(d({ country: "FR", zip: "75001" }).owner, TSA); // no SAE: rule 2, Paris is no zone of his
  assert.equal(d({ country: "FR", zip: "90000" }).owner, JEREMY); // no SAE: rule 2, Territoire de Belfort (SARCLA's 20th)
  const left = d({ country: "DE", zip: "01067" });
  // Nitschke has left: Bernd Rausmann takes over (the NIBE redirection workflows, SARCLA 25.10.2026)
  assert.equal(left.owner, "817647087"); assert.ok(left.flags.includes("successor")); assert.ok(!left.flags.includes("owner-deactivated"));
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

const DENIS = "1229999295", NANCY = "1229976026", KATJA = "1229998779", MAYA = "1229976029", JAMES = "38431796";

test("map seed: the people of each country (KM workbook, sheet \"Owner by country\")", () => {
  // 116 rows, 49 countries; "(no owner)" rows are no one
  assert.equal(Object.keys(SEED_PEOPLE).length, 49);
  const count = (cc: string) => SEED.countries[cc].people?.length ?? 0;
  assert.deepEqual(
    Object.fromEntries(["CH", "DE", "IT", "FR", "NL", "AT", "PL", "BE", "LI", "GB", "ES"].map((cc) => [cc, count(cc)])),
    { CH: 10, DE: 10, IT: 5, FR: 3, NL: 2, AT: 2, PL: 2, BE: 2, LI: 1, GB: 1, ES: 2 },
  );
  for (const [cc, list] of Object.entries(SEED_PEOPLE)) {
    assert.equal(list[0], TSA, `${cc}: TSA Team first - a team like the others, in every country`);
    assert.equal(new Set(list).size, list.length, `${cc}: someone twice`);
    assert.deepEqual(SEED.countries[cc].people, list, `${cc}: on the rule`);
    assert.equal(SEED.countries[cc].country, cc);
  }
  const where = (o: string) => Object.keys(SEED_PEOPLE).filter((cc) => SEED_PEOPLE[cc].includes(o)).sort();
  assert.deepEqual(where(JEREMY), ["CH", "FR"]); // SARCLA: Jeremy = FR + CH
  assert.deepEqual(where(JAN), ["CH"]);
  assert.deepEqual(where(NANCY), ["CH"]); // each person only in their home country
  assert.deepEqual(where(KATJA), ["DE"]);
  assert.equal(where(DENIS).length, 18); // Denis Schawlochow: all his countries
  for (const cc of ["BE", "CZ", "ES", "HU", "SE", "US"]) assert.ok(SEED_PEOPLE[cc].includes(DENIS), cc);
  assert.deepEqual(SEED.countries.CH.people, [TSA, JEREMY, JAN, MAYA, DENIS, "1229976031", NANCY, "32968527", JAMES, CLAUDIO]);
  // the deactivated stay where the sheet has them (never written: the engine flags them)
  assert.ok(SEED_PEOPLE.DE.includes("1229976034") && SEED_PEOPLE.DE.includes("32984810") && SEED_PEOPLE.PL.includes("31218632"));
  // a country not in the sheet: no rule, no list = anyone
  assert.equal(SEED.countries.GR, undefined);
  // a country the workflows had no rule for: a Performis rule with no zones, carrying its people
  assert.deepEqual(SEED.countries.BE, { country: "BE", source: "sae", zones: [], people: [TSA, DENIS] });
  // the workflows' rules are kept as they were
  assert.equal(SEED.countries.CH.keyAccounts?.length, 2);
  assert.equal(SEED.countries.FR.source, "sae"); // rule 1 first in France too (SARCLA 20.10.2026)
});

test("map seed: an SAE from outside the country - the zone decides", () => {
  const d = (c: { country: string; zip?: string; sae?: string; region?: string }) => decide({ id: "1", ...c }, rules, active);
  // Nancy is CH: her Liechtenstein SAE goes to the default (the sheet has only TSA Team in LI)
  const li = d({ country: "LI", zip: "9490", sae: "Pielock Nancy" });
  assert.equal(li.owner, TSA); assert.ok(li.flags.includes("not-in-country"));
  assert.equal(d({ country: "CH", zip: "8001", sae: "Pielock Nancy" }).owner, NANCY); // at home
  // Katja is DE: in CH her SAE gives way to the zone - Bern is Jan Kalt's
  const ch = d({ country: "CH", zip: "3000", sae: "Storm Katja" });
  assert.equal(ch.owner, JAN); assert.equal(ch.via, "zone"); assert.ok(ch.flags.includes("not-in-country"));
  assert.equal(d({ country: "DE", zip: "50667", sae: "Storm Katja" }).owner, KATJA);
  // Denis works Belgium
  assert.equal(d({ country: "BE", zip: "1000", sae: "Schawlochow Denis" }).owner, DENIS);
  assert.equal(d({ country: "BE", zip: "1000", sae: "Kalt Jan" }).owner, TSA);
  // a country without a list: anyone
  assert.equal(d({ country: "GR", zip: "10431", sae: "Kalt Jan" }).owner, JAN);
});

test("map seed: a postcode's region from the map's points (public/geo/postcodes)", () => {
  const ix = (cc: string) => zipIndex((JSON.parse(readFileSync(join(process.cwd(), "public/geo/postcodes", `${cc}.json`), "utf8")) as { points: unknown }).points);
  const ch = ix("CH");
  const region = (zip: string) => placeZip(ch, zip)?.region ?? null;
  // the other agent's 4th element; until it is there a point has no region and nothing breaks
  if (ch.regions.some((r) => r)) {
    assert.equal(region("3011"), "CH-BE");
    assert.equal(region("8400"), "CH-ZH");
    assert.equal(region("6900"), "CH-TI");
    assert.equal(region("5000"), "CH-AG");
    // a zone of whole regions: Aargau (50-59, a gap in Jan Kalt's workflow zone) given to Jan by its region
    const r: AssignRules = JSON.parse(JSON.stringify(rules));
    r.countries.CH.zones[0].regions = ["CH-AG"];
    const dec = decide({ id: "1", country: "CH", zip: "5000", region: region("5000") }, r, active);
    assert.equal(dec.owner, JAN); assert.equal(dec.detail.startsWith("zone region CH-AG"), true);
  } else assert.equal(region("3011"), null);
  assert.equal(placeZip(ch, "3011")?.code, "3011");
  assert.deepEqual(placeZip(ix("PL"), "00002"), { code: "00-002", region: placeZip(ix("PL"), "00-002")?.region ?? null, exact: true }); // "00-002" as the file has it
});

test("map seed: GDP per region (public/geo/gdp)", () => {
  const dir = join(process.cwd(), "public/geo");
  const meta = JSON.parse(readFileSync(join(dir, "gdp/index.json"), "utf8")) as Record<string, { unit: string; known: number; regions: number }>;
  for (const cc of ["CH", "DE", "FR", "IT", "AT", "NL", "PL"]) {
    const gdp = JSON.parse(readFileSync(join(dir, "gdp", `${cc}.json`), "utf8")) as Record<string, number | null>;
    const codes = (JSON.parse(readFileSync(join(dir, "shapes", `${cc}.json`), "utf8")) as { regions: { code: string }[] }).regions.map((x) => x.code).sort();
    assert.deepEqual(Object.keys(gdp).sort(), codes, `${cc}: one value per map region`);
    assert.equal(meta[cc].unit, "MEUR");
    assert.ok(meta[cc].known >= codes.length - 6, `${cc}: ${meta[cc].known} of ${codes.length} known`);
    for (const v of Object.values(gdp)) assert.ok(v === null || (typeof v === "number" && v > 0), `${cc}: ${v}`);
  }
  const ch = JSON.parse(readFileSync(join(dir, "gdp/CH.json"), "utf8")) as Record<string, number>;
  assert.ok(ch["CH-ZH"] > ch["CH-BE"] && ch["CH-BE"] > ch["CH-AI"], "Zurich > Bern > Appenzell Innerrhoden");
});
