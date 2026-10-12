import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DOC_KIND, SEED_RULE, buildDoc, checkRule, childMoves, decide, groupKey, newRuleId, parseDoc, publishedRules, resolve,
  ruleSetProblems, rulesHash, toPub, type CompanyProps, type PubRule, type Rule,
} from "../src/lib/ownerRules/rules";

// The same cases are run against the HubSpot app function's JavaScript port
// (hubspot-apsomarketinghub, src/app/functions/ownerRedirection.js) - see the fixture.
type Vectors = {
  rulesets: Record<string, PubRule[]>;
  cases: { name: string; rules: string; company: CompanyProps; expect: Record<string, unknown> }[];
  children: { owner: string | null; filter: "all" | "none" | string[]; to: string; moves: boolean }[];
};
const V = JSON.parse(readFileSync("tests/fixtures/owner-rules-vectors.json", "utf8")) as Vectors;

const rule = (over: Partial<Rule> & Pick<Rule, "kind">): Rule => {
  const base = { id: "r-x", enabled: true, toOwner: "222", cascade: { contacts: true, tickets: true, tasks: true }, note: "" };
  return (over.kind === "country"
    ? { ...base, countries: ["France"], customCountries: [], ...over }
    : { ...base, fromOwner: "111", ...over }) as Rule;
};

test("the seed is today's France app, exactly", () => {
  assert.deepEqual(toPub(SEED_RULE), V.rulesets.france[0]);
  assert.equal(SEED_RULE.enabled, true);
});

test("every shared case resolves as the fixture says", () => {
  for (const c of V.cases) {
    const got = resolve(c.company, V.rulesets[c.rules]) as Record<string, unknown>;
    for (const [k, v] of Object.entries(c.expect)) assert.deepEqual(got[k], v, `${c.name}: ${k}`);
  }
});

test("children: all of them, those of the named owners, or none - never the target's own", () => {
  for (const c of V.children) assert.equal(childMoves(c.owner, c.filter, c.to), c.moves, JSON.stringify(c));
});

test("a written result is final: its own webhook event writes nothing (two events, then it stops)", () => {
  const countries = ["France", "fr", "Italy", "", "Spain"];
  const owners = ["", "111", "222", "333", "29117550", "1202569408"];
  for (const set of Object.values(V.rulesets)) {
    for (const country of countries) {
      for (const owner of owners) {
        for (const custom of ["", "France"]) {
          const c: CompanyProps = { country, country_custom: custom, hubspot_owner_id: owner, region_responsibility: owner };
          const r = resolve(c, set);
          if (r.kind !== "apply") continue;
          const after = { ...c, ...r.changes };
          const again = resolve(after, set);
          assert.ok(again.kind === "none" || (again.kind === "apply" && !Object.keys(again.changes).length && again.to === r.to),
            `${JSON.stringify(c)} -> ${JSON.stringify(r.changes)} -> ${JSON.stringify(again)}`);
        }
      }
    }
  }
});

test("first match wins", () => {
  const rules = [toPub(rule({ id: "a", kind: "country", countries: ["Italy"], toOwner: "1" })), toPub(rule({ id: "b", kind: "country", countries: ["Italy", "IT"], toOwner: "2" }))];
  assert.equal(decide({ country: "italy" }, rules)?.id, "a");
  assert.equal(decide({ country: "IT" }, rules)?.id, "b");
  assert.equal(decide({ country: "Spain" }, rules), null);
});

test("checkRule: cleans lists, refuses what cannot work", () => {
  const ok = checkRule({ id: "r-1", kind: "country", countries: [" France ", "france", "FR", ""], customCountries: ["France"], toOwner: "29117550", note: " x " });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.rule.kind === "country" && ok.rule.countries, ["France", "FR"]);
    assert.equal(ok.rule.note, "x");
    assert.deepEqual(ok.rule.cascade, { contacts: true, tickets: true, tasks: true });
  }
  assert.equal(checkRule({ id: "r-1", kind: "country", countries: [], customCountries: [], toOwner: "1" }).ok, false);
  assert.equal(checkRule({ id: "r-1", kind: "owner", fromOwner: "5", toOwner: "5" }).ok, false);
  assert.equal(checkRule({ id: "r-1", kind: "owner", fromOwner: "5", toOwner: "Jeremy" }).ok, false);
  assert.equal(checkRule({ id: "R 1", kind: "owner", fromOwner: "5", toOwner: "6" }).ok, false);
  assert.equal(checkRule({ id: "r-1", kind: "owner", fromOwner: "5", toOwner: "6", cascade: { contacts: "yes" } }).ok, false);
  assert.equal(checkRule({ id: "r-1", kind: "region", toOwner: "6" }).ok, false);
});

test("the published document: only rules that are on, checksummed, refused when touched", () => {
  const rules: Rule[] = [SEED_RULE, rule({ id: "r-off", kind: "owner", enabled: false })];
  const doc = buildDoc(rules, "user 1", "2026-10-12T10:00:00.000Z");
  assert.equal(doc.kind, DOC_KIND);
  assert.deepEqual(doc.rules, [toPub(SEED_RULE)]);
  assert.equal(doc.hash, rulesHash(publishedRules(rules)));
  const raw = JSON.stringify(doc);
  const back = parseDoc(raw);
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.doc, doc);

  // a hand edit, a cut-off value, another document, a duplicate id: all refused
  assert.equal(parseDoc(raw.replace("29117550", "29117551")).ok, false);
  assert.equal(parseDoc(raw.slice(0, raw.length - 20)).ok, false);
  assert.equal(parseDoc(JSON.stringify({ ...doc, kind: "other" })).ok, false);
  assert.equal(parseDoc(JSON.stringify({ ...doc, version: 2 })).ok, false);
  const dup = [toPub(SEED_RULE), toPub(SEED_RULE)];
  assert.equal(parseDoc(JSON.stringify({ ...doc, rules: dup, hash: rulesHash(dup) })).ok, false);
  // not canonical (a duplicate country), even with a matching checksum
  const odd = [{ ...toPub(SEED_RULE), countries: ["France", "france"] }] as PubRule[];
  assert.equal(parseDoc(JSON.stringify({ ...doc, rules: odd, hash: rulesHash(odd) })).ok, false);
  assert.equal(parseDoc("").ok, false);
  assert.equal(parseDoc(undefined).ok, false);
  // nothing on is a valid document: HubSpot then changes nobody's companies
  const none = buildDoc([], "user 1", "2026-10-12T10:00:00.000Z");
  assert.ok(parseDoc(JSON.stringify(none)).ok);
});

test("rule sets: loops are errors, rules that never apply are warnings", () => {
  const ab = rule({ id: "r-ab", kind: "owner", fromOwner: "111", toOwner: "222" });
  const ba = rule({ id: "r-ba", kind: "owner", fromOwner: "222", toOwner: "111" });
  assert.deepEqual(ruleSetProblems([SEED_RULE]), { errors: [], warnings: [] });
  assert.match(ruleSetProblems([ab, ba]).errors.join(" "), /Rule 1 and rule 2 would hand companies back and forth/);
  // switched off, the pair is harmless
  assert.deepEqual(ruleSetProblems([ab, { ...ba, enabled: false }]).errors, []);
  // a country rule giving B and an earlier rule taking B's companies away
  const bc = rule({ id: "r-bc", kind: "owner", fromOwner: "222", toOwner: "333" });
  const frB = rule({ id: "fr-b", kind: "country", countries: ["France"], toOwner: "222" });
  assert.equal(ruleSetProblems([bc, frB]).errors.length, 1);
  // ... the other way round it settles: France keeps B, B's other companies go to C
  const w = ruleSetProblems([frB, bc]);
  assert.deepEqual(w.errors, []);
  assert.match(w.warnings.join(" "), /rule 2 does not move the companies rule 1 gives to the same person/);
  // shadowed rules
  const fr2 = rule({ id: "fr-2", kind: "country", countries: ["france"], toOwner: "333" });
  assert.match(ruleSetProblems([frB, fr2]).warnings.join(" "), /rule 2 never applies/);
  assert.match(ruleSetProblems([ab, rule({ id: "r-ab2", kind: "owner", fromOwner: "111", toOwner: "333" })]).warnings.join(" "), /rule 2 never applies/);
  assert.match(ruleSetProblems([SEED_RULE, { ...SEED_RULE }]).errors.join(" "), /twice/);
});

test("groups: the same target and cascade go together, an owner hand-over never with a country rule", () => {
  const set = V.rulesets.france_then_left;
  const a = resolve({ country: "France", hubspot_owner_id: "1" }, set);
  const b = resolve({ country: "fr", hubspot_owner_id: "2" }, set);
  const c = resolve({ country: "Italy", hubspot_owner_id: "111" }, set);
  assert.ok(a.kind === "apply" && b.kind === "apply" && c.kind === "apply");
  if (a.kind === "apply" && b.kind === "apply" && c.kind === "apply") {
    assert.equal(groupKey(a), groupKey(b));
    assert.notEqual(groupKey(a), groupKey(c));
  }
});

test("new rule ids are short, lower-case and unique", () => {
  let n = 0;
  const seq = ["AAAA1111-xx", "aaaa1111-yy", "bbbb2222"];
  assert.equal(newRuleId(["r-aaaa1111"], () => seq[n++]), "r-bbbb2222");
});
