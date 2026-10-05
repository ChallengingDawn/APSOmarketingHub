import assert from "node:assert/strict";
import { test } from "node:test";
import type { Enums } from "../src/lib/segmentation/engine";
import { YEARLY_RULES, reclassify, shopByYear, yearlyReadProps } from "../src/lib/segmentation/yearly";

const EN: Enums = {
  prio: { "1": "1- Prio", "2": "2- Prio", "3": "3- Prio", "4": "4- No priority" },
  revbucket: {},
  apic: {
    "1.1": "1.1 Machine Manufacturing (OEM)", "1.9": "1.9 Pharma & Medical Devices (OEM)", "1.10": "1.10 Pumps and Valves (OEM)",
    "2.8": "2.8 Research and Development", "3.3": "3.3 Reseller",
  },
  industry: new Set(["MACHINERY", "PHARMACEUTICALS", "RESEARCH", "BANKING", "WHOLESALE", "MECHANICAL_OR_INDUSTRIAL_ENGINEERING"]),
  kwType: "string", kwOpts: new Set(),
};
const NOW = Date.parse("2027-01-12T08:00:00Z");
const ctx = { year: 2027, now: NOW, tickets: 0 };
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

test("ERP-owned segments are never touched", () => {
  for (const s of ["ESO-Customer 12", "DS Customer", "Growth Engine Customer"]) {
    const r = reclassify({ apso_customer: s, revenue_2026: "90000" }, EN, ctx);
    assert.equal(r.segment, null);
    assert.equal(r.rule, "erp");
  }
});

test("years count from the run: in 2027 'lost' means no revenue or order intake 2025-2027", () => {
  const lost = reclassify({ apso_customer: "APSOprospect", revenue_2023: "4000", createdate: ago(2000) }, EN, ctx);
  assert.equal(lost.segment, "APSOlost");
  const oi = reclassify({ apso_customer: "APSOlost", revenue_2023: "4000", oi_2025: "300", createdate: ago(2000), yearly_customer_potential: "5300" }, EN, ctx);
  assert.notEqual(oi.segment, "APSOlost");
});

test("prospects are re-decided: an established buyer becomes core, room to grow becomes growth", () => {
  const core = reclassify({ apso_customer: "APSOprospect", revenue_2026: "6000", yearly_customer_potential: "7800", industry: "MACHINERY", createdate: ago(900) }, EN, ctx);
  assert.equal(core.segment, "APSOcore");
  assert.equal(core.rule, "core");
  const growth = reclassify({ apso_customer: "APSOprospect", revenue_2026: "2000", yearly_customer_potential: "20000", apic_ap: EN.apic["1.10"], createdate: ago(900) }, EN, ctx);
  assert.equal(growth.segment, "APSOgrowth");
});

test("new, micro, ghost and the default", () => {
  assert.equal(reclassify({ apso_customer: "", createdate: ago(100) }, EN, ctx).segment, "APSOprospect");
  assert.equal(reclassify({ createdate: ago(100), numberofemployees: "3" }, EN, ctx).segment, "APSOmicro");
  assert.equal(reclassify({ createdate: ago(1000), numberofemployees: "8", budget_class: "List price" }, EN, ctx).segment, "No sales focus");
  assert.equal(reclassify({ createdate: ago(500), numberofemployees: "40" }, EN, ctx).rule, "default");
});

test("APIC and industry: a generic 1.1 is corrected or cleared from the industry, a reseller never changes", () => {
  assert.equal(reclassify({ apic_ap: EN.apic["1.1"], industry: "PHARMACEUTICALS" }, EN, ctx).apic, EN.apic["1.9"]);
  assert.equal(reclassify({ apic_ap: EN.apic["1.1"], industry: "BANKING" }, EN, ctx).apic, "");
  const reseller = reclassify({ apic_ap: EN.apic["3.3"] }, EN, ctx);
  assert.equal(reseller.apic, undefined);
  assert.equal(reseller.industry, "WHOLESALE");
  assert.equal(reclassify({ apic_ap: EN.apic["1.10"], industry: "BANKING" }, EN, ctx).industry, "MECHANICAL_OR_INDUSTRIAL_ENGINEERING");
});

test("the potential is shaped in memory for the rules and reported - the run never writes it", () => {
  const r = reclassify({ revenue_2026: "10000", yearly_customer_potential: "900000", createdate: ago(900), industry: "MACHINERY" }, EN, ctx);
  assert.equal(r.potential, 50000); // capped to 400k, then 5x revenue
  assert.equal(r.segment, "APSOgrowth");
});

test("the shop's datatracker properties: no suffix is 2026", () => {
  const s = shopByYear({ orders_datatracker: "2", n_of_views_datatracker_2024: "40", total_value_datatracker_2023: "80" });
  assert.equal(s.get(2026)?.orders, 2);
  assert.equal(s.get(2024)?.views, 40);
  assert.equal(s.get(2023)?.value, 80);
  const read = yearlyReadProps(new Set(["budget_class", "oi_2026", "oi_1999", "orders_datatracker", "n_of_views_datatracker_2025", "x"]), 2027);
  assert.deepEqual(read.sort(), ["budget_class", "n_of_views_datatracker_2025", "oi_2026", "orders_datatracker"]);
});

test("every rule the waterfall can return is listed for the page", () => {
  const keys = new Set(YEARLY_RULES.map((r) => r.key));
  for (const k of ["erp", "ghost", "micro", "lost", "churned", "new", "growth", "core", "budget", "small", "engaged_budget", "engaged", "dead", "default"]) assert.ok(keys.has(k), k);
});
