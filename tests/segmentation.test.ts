import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apicMult, compute, enrich, fnum, initialPotential, isOwnMachine, parseSite, potentialEdits, potentialFormula, potentialSetter, prioBucket, prioWith, pyStr,
  recalcDecision, revBucket, revProps, unlost, webUpdates, type Enums,
} from "../src/lib/segmentation/engine";

const EN: Enums = {
  prio: { "1": "1- Prio", "2": "2- Prio", "3": "3- Prio", "4": "4- No priority" },
  revbucket: { "0": "0 - none", "1": "1 - <200", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8 - >=100k" },
  apic: { "1.10": "1.10 Pumps & valves", "1.9": "1.9 Pharma", "4.1": "4.1 Processing", "2.8": "2.8 Research" },
  industry: new Set(["MACHINERY", "PHARMACEUTICALS", "RESEARCH"]),
  kwType: "string", kwOpts: new Set(),
};
const REV = revProps(2026);

test("buckets: the CEO thresholds and the fine revenue scale", () => {
  assert.deepEqual([null, 499.99, 500, 2499, 2500, 24999, 25000].map(prioBucket), ["4", "4", "3", "3", "2", "2", "1"]);
  assert.deepEqual([null, 0, 199, 200, 999, 1000, 100000].map(revBucket), ["0", "0", "1", "2", "3", "4", "8"]);
});

test("fnum reads numbers as Python's float() does", () => {
  assert.equal(fnum(" 300 "), 300);
  assert.equal(fnum("abc"), null);
  assert.equal(fnum(""), null);
  assert.equal(fnum("1e3"), 1000);
  assert.equal(pyStr(8084), "8084.0");
  assert.equal(pyStr(1234.5), "1234.5");
});

test("compute: basis is MAX(potential, best year); a garbage potential is ignored and reported", () => {
  const c = compute({ yearly_customer_potential: "3000", revenue_2024: "120", revenue_2025: "40000" }, EN, REV);
  assert.equal(c.prefix, "1");
  assert.equal(c.basis, 40000);
  assert.deepEqual(c.upd, { max_revenue_2015_2026: "40000.0", max_revenue_bucket: "7", max_pot_or_turnover: "40000.0" });
  const g = compute({ yearly_customer_potential: "500015000", revenue_2025: "1200" }, EN, REV);
  assert.equal(g.clamped, true);
  assert.equal(g.prefix, "3");
  const settled = compute({ yearly_customer_potential: "800", max_pot_or_turnover: "800", sales_priority: "3- Prio" }, EN, REV);
  assert.deepEqual(settled.upd, {});
});

test("enrich: industry mapping first, then the first keyword rule; empty fields only", () => {
  assert.deepEqual(enrich({ industry: "PHARMACEUTICALS" }, EN), { apic_ap: "1.9 Pharma" });
  assert.deepEqual(enrich({ name: "Muster Pumpen AG" }, EN), { apic_ap: "1.10 Pumps & valves", industry: "MACHINERY", hs_keywords: "pumps and valves" });
  assert.deepEqual(enrich({ name: "X", apic_ap: "a", industry: "b" }, EN), {});
  assert.deepEqual(enrich({ name: "abc" }, EN), {}); // too short a text to judge
});

test("unlost: a current-year buyer is not lost", () => {
  assert.deepEqual(unlost({ apso_customer: "APSOlost", revenue_2026: "500" }, 2026), { apso_customer: "APSOcore" });
  assert.deepEqual(unlost({ apso_customer: "APSOlost", revenue_2026: "120" }, 2026), { apso_customer: "APSOprospect" });
  assert.deepEqual(unlost({ apso_customer: "APSOlost", revenue_2026: "0" }, 2026), {});
  assert.deepEqual(unlost({ apso_customer: "APSOcore", revenue_2026: "900" }, 2026), {});
});

test("potentials: the starter value and the recalculation formula", () => {
  assert.equal(apicMult("1.10.2 Valves"), 3.0);
  assert.equal(apicMult("1.1.2 Food"), 2.2);
  assert.equal(initialPotential({ apso_customer: "APSOmicro" }, REV), 300);
  assert.equal(initialPotential({ apic_ap: "1.9 Pharma" }, REV), 800);
  assert.equal(initialPotential({ apic_ap: "4.1 Processing" }, REV), 600);
  assert.equal(initialPotential({}, REV), 500);
  assert.equal(initialPotential({ revenue_2025: "1000", revenue_2019: "5000" }, REV), 6500); // floor 1.3 x best year
  assert.equal(potentialFormula({ revenue_2025: "1000", yearly_customer_potential: "2000" }, REV), 1300);
  assert.equal(potentialFormula({ revenue_2025: "10000", apic_ap: "1.10 x", yearly_customer_potential: "5000" }, REV), 7000); // +40% cap
  assert.equal(potentialFormula({}, REV), null);
});

test("who wrote a potential: our machines are recomputed, a person's number never", () => {
  assert.equal(isOwnMachine(null), true);
  assert.equal(isOwnMachine({ sourceType: "INTEGRATION", sourceId: "41691680" }), true);
  assert.equal(isOwnMachine({ sourceType: "INTEGRATION", sourceId: "123" }), false);
  assert.equal(isOwnMachine({ sourceType: "INTEGRATION", sourceId: "123" }, new Set(["123"])), true);
  assert.equal(isOwnMachine({ sourceType: "CRM_UI" }), false);
  const p = { yearly_customer_potential: "241", revenue_2025: "100" };
  const own = { value: "241", sourceType: "INTEGRATION", sourceId: "41691680" };
  const rep = { value: "30000", sourceType: "AUTOMATION_PLATFORM", sourceId: "wf" };
  assert.deepEqual(recalcDecision(p, [own, rep], REV), { kind: "human_restored", value: 30000 });
  assert.deepEqual(recalcDecision(p, [rep], REV), { kind: "manual_kept" });
  assert.deepEqual(recalcDecision({ revenue_2025: "1000" }, [], REV), { kind: "filled", value: 1300 });
});

test("website: meta description, schema.org address, TLD country, empty fields only", () => {
  const page = `<html><head><meta name="description" content="Hersteller von Pumpen &amp; Armaturen seit 1950 in der Schweiz">
    <script type="application/ld+json">{"@graph":[{"@type":"Organization","numberOfEmployees":{"value":"120"},
    "address":{"addressLocality":"Zürich","postalCode":"8000","addressCountry":"CH"}}]}</script></head><body>Pumps</body></html>`;
  const s = parseSite(page);
  assert.equal(s.description, "Hersteller von Pumpen & Armaturen seit 1950 in der Schweiz");
  assert.equal(s.employees, 120);
  assert.equal(s.country, "Switzerland");
  const upd = webUpdates({ domain: "muster.ch", name: "Muster AG" }, page, EN)!;
  assert.equal(upd.website, "https://www.muster.ch");
  assert.equal(upd.city, "Zürich");
  assert.equal(upd.apic_ap, "1.10 Pumps & valves");
  assert.equal(webUpdates({ domain: "gmail.com" }, page, EN), null);
  assert.deepEqual(webUpdates({ domain: "muster.ch" }, null, EN), {});
});

test("potential edits: a person's changes with before/after priority; our machines' writes are not edits", () => {
  const p = { name: "Muster AG", yearly_customer_potential: "30000", revenue_2025: "1200" };
  const hist = [
    { value: "30000", timestamp: "2026-10-01T09:00:00Z", sourceType: "CRM_UI", sourceId: "userId:59853577", updatedByUserId: 59853577 },
    { value: "800", timestamp: "2026-09-01T09:00:00Z", sourceType: "INTEGRATION", sourceId: "41691680" },
    { value: "800", timestamp: "2026-08-01T09:00:00Z", sourceType: "AUTOMATION_PLATFORM", sourceId: "enrollmentId:1" },
    { value: "", timestamp: "2026-07-01T09:00:00Z", sourceType: "CRM_UI_BULK_ACTION", sourceId: "userId:1", updatedByUserId: 1 },
  ];
  const e = potentialEdits("42", p, hist as never, REV);
  assert.deepEqual(e.map((x) => [x.source, x.prev, x.value, x.userId, x.prioBefore, x.prioAfter]), [
    ["rep", 800, 30000, "59853577", "3", "1"],
    ["workflow", null, 800, null, "3", "3"],
  ]);
  // the bulk clear repeats nothing before it - it is a change only if the value differs (null -> null is not)
  assert.equal(potentialSetter(p, hist as never), "person");
  assert.equal(potentialSetter({ yearly_customer_potential: "800" }, [hist[1]] as never), "machine");
  assert.equal(potentialSetter({}, []), "empty");
  assert.equal(prioWith(500015000, { revenue_2025: "1200" }, REV), "3"); // garbage potential ignored
});
