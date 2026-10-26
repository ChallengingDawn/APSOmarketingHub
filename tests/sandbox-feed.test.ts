import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  fieldKind, isHiddenMoney, isLogicField, leakNeedles, moneyFactor, placeholderText, sandboxTargets, scaleMoney,
} from "../src/lib/sandboxFeed/policy";
import { codeHubspotAnswer, codeRows, kindOfPath, leakCheck, type CodeCtx } from "../src/lib/sandboxFeed/code";
import { hubspotRefusal, sqlRefusal } from "../src/lib/sandboxFeed/run";

const ctx = (types?: Record<string, string>): CodeCtx => ({
  salt: "test-salt", factor: 0.8, propType: types ? (p) => types[p] : undefined,
});

test("the money factor is hidden, stable, and never close to 1", () => {
  const f = moneyFactor("some-link-key");
  assert.equal(f, moneyFactor("some-link-key"));
  assert.ok(f >= 0.62 && f <= 1.5 && (f < 0.95 || f > 1.05), String(f));
  for (let i = 0; i < 300; i++) { const g = moneyFactor(`k${i}`); assert.ok(g < 0.95 || g > 1.05, `k${i} -> ${g}`); }
});

test("customer money is scaled; money the workflow and UC logic reads stays real", () => {
  for (const hidden of ["revenue_monthly", "revenue_pc_monthly", "erp_revenue", "amount", "revenue", "newcust_revenue_monthly"]) {
    assert.equal(isHiddenMoney(hidden), true, hidden);
  }
  for (const real of ["revenue_2025", "yearly_customer_potential", "max_pot_or_turnover", "order_total_net_revenue",
    "price", "erosion_amount_2025", "sales_potential_estimate", "max_revenue_bucket", "order_total_qty", "hs_object_id"]) {
    assert.equal(isHiddenMoney(real), false, real);
  }
  assert.equal(isLogicField("Revenue_2019"), true);
  assert.equal(scaleMoney(1000, 0.8), 800);
  assert.equal(scaleMoney("1250.50", 0.8), "1000.40");
  assert.equal(scaleMoney("7", 0.8), "6");
  assert.equal(scaleMoney("n/a", 0.8), "n/a");
});

test("fields are read by their names", () => {
  const cases: [string, string][] = [["email", "email"], ["hs_email_domain", "email"], ["mobilephone", "phone"],
    ["address", "address"], ["domain", "domain"], ["website", "domain"], ["hs_linkedin_url", "social"],
    ["name", "name"], ["firstname", "name"], ["customer_name", "name"], ["dealname", "name"], ["owner_name", "name"],
    ["subject", "text"], ["hs_note_body", "text"], ["description", "text"], ["hs_pipeline_stage", "keep"],
    ["pipeline_stage_name", "keep"], ["team_name", "keep"], ["city", "keep"], ["zip", "keep"], ["mandant", "keep"]];
  for (const [k, want] of cases) assert.equal(fieldKind(k), want, k);
});

test("a company search: named by its HubSpot number, its money as the rules say, its words replaced", () => {
  const body = { total: 1, results: [{ id: "31258743810", properties: {
    name: "Bossard AG", domain: "bossard.com", phone: "0417496611", city: "Zug", zip: "6300", country: "Switzerland",
    industry: "Mechanical or Industrial Engineering", revenue_2025: "120000", revenue_monthly: "1250.50",
    description: "Bossard supplies fastening technology", sales_priority: "A", hubspot_owner_id: "1202569408" } }] };
  const out = codeHubspotAnswer("/crm/v3/objects/companies/search", 200, body,
    ctx({ industry: "enumeration", sales_priority: "enumeration", revenue_2025: "number", revenue_monthly: "number" }));
  assert.ok("response" in out, JSON.stringify(out));
  const p = ((out as { response: { body: { results: { properties: Record<string, unknown> }[] } } }).response.body.results[0]).properties;
  assert.equal(p.name, "Company 31258743810");
  assert.match(String(p.domain), /^d[0-9a-f]{6}\.example\.invalid$/);
  assert.equal(p.phone, null);
  assert.equal(p.city, "Zug");
  assert.equal(p.industry, "Mechanical or Industrial Engineering");
  assert.equal(p.revenue_2025, "120000");             // segmentation reads it: real
  assert.equal(p.revenue_monthly, "1000.40");         // a customer figure: x factor
  assert.notEqual(p.description, body.results[0].properties.description);
  assert.equal(String(p.description).toLowerCase().includes("bossard"), false);
  assert.equal(p.hubspot_owner_id, "1202569408");
});

test("contacts and owners: Contact <id> and Owner <id>, addresses at example.invalid", () => {
  const c = codeHubspotAnswer("/crm/v3/objects/contacts/batch/read", 200, { results: [{ id: "101", properties: {
    firstname: "Anna", lastname: "Muster", email: "anna.muster@kunde-ag.ch", jobtitle: "Einkauf", mobilephone: "+41 79 000 00 00" } }] }, ctx());
  const cp = (c as { response: { body: { results: { properties: Record<string, unknown> }[] } } }).response.body.results[0].properties;
  assert.deepEqual(cp, { firstname: "Contact", lastname: "101", email: "c101@example.invalid", jobtitle: "Contact 101", mobilephone: null });

  const o = codeHubspotAnswer("/crm/v3/owners?limit=100", 200, { results: [
    { id: "1202569408", email: "maida.x@apsoparts.com", firstName: "Maida", lastName: "X", userId: 77, teams: [{ id: "5", name: "Back Office" }] }] }, ctx());
  const ow = (o as { response: { body: { results: Record<string, unknown>[] } } }).response.body.results[0];
  assert.equal(ow.firstName, "Owner");
  assert.equal(ow.lastName, "1202569408");
  assert.equal(ow.email, "o1202569408@example.invalid");
  assert.deepEqual(ow.teams, [{ id: "5", name: "Back Office" }]);
});

test("a real name that survives in a field no rule knows is caught, and the answer is not sent", () => {
  const out = codeHubspotAnswer("/crm/v3/objects/companies/search", 200, { results: [{ id: "9", properties: {
    name: "Bossard AG", erp_alias: "BOSSARD" } }] }, ctx());
  assert.ok("refused" in out);
  assert.match((out as { refused: string }).refused, /results\[\]\.properties\.erp_alias/);
  assert.equal((out as { refused: string }).refused.toLowerCase().includes("bossard"), false, "the reason never names the value");
});

test("database rows: names by the ids beside them, customer money scaled, notes replaced", () => {
  const out = codeRows([{ company_id: 7, customer_name: "Kunde AG", revenue: 100.5, revenue_2024: 90, contact_email: "a@kunde-ag.ch",
    note: "call Anna on Monday", stage: "won", meta: { owner_name: "Sara Y", owner_id: 12 } }], ctx());
  assert.ok("response" in out, JSON.stringify(out));
  const r = (out as { response: { rows: Record<string, unknown>[] } }).response.rows[0];
  assert.equal(r.customer_name, "Company 7");
  assert.equal(r.revenue, 80.4);
  assert.equal(r.revenue_2024, 90);
  assert.match(String(r.contact_email), /^x[0-9a-f]{6}@example\.invalid$/);
  assert.notEqual(r.note, "call Anna on Monday");
  assert.equal(r.stage, "won");
  assert.equal((r.meta as Record<string, unknown>).owner_name, "Owner 12");
});

test("an error from HubSpot goes on as its status only - its message could echo a value", () => {
  const out = codeHubspotAnswer("/crm/v3/objects/companies/1", 404, { message: "Object Bossard AG not found" }, ctx());
  assert.deepEqual(out, { response: { status: 404, body: { status: "error", message: "HubSpot answered 404" } } });
});

test("placeholders are as long as the text they replace and the same each time", () => {
  const t = "Bitte um Offerte für 200 O-Ringe, Lieferung bis Ende Monat";
  assert.equal(placeholderText("s", t), placeholderText("s", t));
  assert.ok(Math.abs(placeholderText("s", t).length - t.length) <= 1);
  assert.deepEqual(leakNeedles("Bossard AG").sort(), ["bossard", "bossard ag"]);
  assert.deepEqual(leakNeedles("AG"), []);
  assert.deepEqual(leakCheck({ a: ["company 7"] }, new Set(["company"])), { ok: false, path: "a[]" });
});

test("the hub runs only reads, only on its list, never logins, keys or the catalogue", () => {
  assert.equal(hubspotRefusal({ method: "POST", url: "/crm/v3/objects/tickets/search", body: {} }), null);
  assert.equal(hubspotRefusal({ method: "GET", url: "/crm/v3/owners?limit=100", body: null }), null);
  assert.match(String(hubspotRefusal({ method: "PATCH", url: "/crm/v3/objects/companies/1", body: {} })), /only reads/);
  assert.match(String(hubspotRefusal({ method: "GET", url: "/files/v3/files/123", body: null })), /not served/);
  assert.equal(sqlRefusal({ text: "SELECT * FROM erosion_tickets WHERE created_at > $1", params: [] }), null);
  assert.equal(sqlRefusal({ text: "SELECT note FROM t WHERE note = 'a;b'", params: [] }), null);
  assert.match(String(sqlRefusal({ text: "DELETE FROM erosion_tickets", params: [] })), /only reads/);
  assert.match(String(sqlRefusal({ text: "SELECT v FROM apsomh_kv WHERE k = $1", params: [] })), /logins and keys/);
  assert.match(String(sqlRefusal({ text: "select * from apsomh_users", params: [] })), /logins and keys/);
  assert.match(String(sqlRefusal({ text: "SELECT * FROM pg_catalog.pg_tables", params: [] })), /system/);
  assert.match(String(sqlRefusal({ text: "SELECT current_setting('x')", params: [] })), /system/);
  assert.match(String(sqlRefusal({ text: "SELECT 1; SELECT 2", params: [] })), /one statement/);
  assert.equal(kindOfPath("/crm/v4/associations/tickets/companies/batch/read").kind, "assoc");
  assert.equal(kindOfPath("/crm/v3/objects/2-201387076/search").objectType, "2-201387076");
});

test("SANDBOX_URLS: https only (plain http only on this machine), each once", () => {
  assert.deepEqual(sandboxTargets(" https://a.up.railway.app/ ,http://evil.example, http://127.0.0.1:3197,https://a.up.railway.app"),
    ["https://a.up.railway.app", "http://127.0.0.1:3197"]);
  assert.deepEqual(sandboxTargets(undefined), []);
});

// Every money field an engine reads must be decided: real (on the logic list) - the factor never touches it.
// A new one makes this fail, so somebody decides instead of the sandbox silently scaling what a rule reads.
test("money the rule engines read stays real", () => {
  const ENGINES = ["boDetection", "boDistribution", "boSentiment", "companyDomain", "contactPhone", "datatracker",
    "directcut", "erosion", "holiday", "lifecycle", "mapAssign", "oneshot", "ownerRules", "partnerStock", "personas",
    "segmentation", "smartTickets", "ticketAssoc", "ticketClose", "ticketDuplicates", "ticketValue"];
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
  for (const e of ENGINES) { try { walk(path.resolve(process.cwd(), "src/lib", e)); } catch { /* an engine folder that does not exist */ } }
  const names = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/["'`]([a-z0-9]+(?:_[a-z0-9]+)+_?|revenue|price|potential|value|total|amount)["'`]/g)) {
      if (/(revenue|amount|turnover|umsatz|price|margin|cost|subtotal|potential)/.test(m[1])) names.add(m[1]);
    }
  }
  assert.ok(names.size > 10);
  const scaled = [...names].filter((n) => isHiddenMoney(n));
  assert.deepEqual(scaled, [], `engines read these, but the sandbox would scale them: ${scaled.join(", ")}`);
});
