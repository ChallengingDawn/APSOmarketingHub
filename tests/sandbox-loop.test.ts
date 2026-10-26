// The whole loop, hub side included: a sandbox page misses -> Bring data -> the hub's round (feed.ts) collects it, runs
// it (HubSpot stubbed with made-up "real" data, the hub's database a throwaway one), codes it, delivers it -> the page
// answers coded, and not one real value is stored in the sandbox. Opt-in - needs a local sandbox copy and two
// throwaway databases:
//   SANDBOX_TEST_URL=http://127.0.0.1:3197  SANDBOX_TEST_DATABASE_URL=<the sandbox's>  SANDBOX_TEST_HUB_DATABASE_URL=<the "hub's">
//   SANDBOX_TEST_LINK_KEY=<key whose sha256 the sandbox has>  SANDBOX_TEST_SESSION_SECRET=<the sandbox's>
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";
import { SignJWT } from "jose";

const URL_ = process.env.SANDBOX_TEST_URL;
const SANDBOX_DB = process.env.SANDBOX_TEST_DATABASE_URL;
const HUB_DB = process.env.SANDBOX_TEST_HUB_DATABASE_URL;
const KEY = process.env.SANDBOX_TEST_LINK_KEY;
const SECRET = process.env.SANDBOX_TEST_SESSION_SECRET;
const ready = !!(URL_ && SANDBOX_DB && HUB_DB && KEY && SECRET);

// made-up "real" data - none of it may reach the sandbox
const REAL = ["zimtstern", "anna", "muster", "kunde-ag", "kunde ag", "0417496611", "maida"];
const HUBSPOT: Record<string, unknown> = {
  "POST /crm/v3/objects/contacts/batch/read": { results: [
    { id: "101", properties: { email: "anna.muster@kunde-ag.example", firstname: "Anna", lastname: "Muster", phone: "0417496611", mobilephone: null, address: "Seestrasse 1", zip: "6300", city: "Zug", country: "Switzerland" } },
    { id: "102", properties: { email: "info@zimtstern-fluid.example", firstname: "Info", lastname: "Zimtstern", phone: null, mobilephone: null, address: null, zip: "6301", city: "Zug", country: "Switzerland" } }] },
  "POST /crm/v3/objects/companies/search": { total: 2, results: [
    { id: "900001", properties: { name: "Zimtstern Fluidtechnik AG", domain: "zimtstern-fluid.example", revenue_2025: "120000", revenue_monthly: "1250.50", sales_priority: "A" } },
    { id: "900002", properties: { name: "Kunde AG", domain: "kunde-ag.example", revenue_2025: "5000", revenue_monthly: "80.00", sales_priority: "C" } }] },
  "GET /crm/v3/properties/companies": { results: [{ name: "sales_priority", type: "enumeration" }, { name: "revenue_2025", type: "number" }, { name: "revenue_monthly", type: "number" }, { name: "name", type: "string" }, { name: "domain", type: "string" }] },
  "GET /crm/v3/properties/contacts": { results: [{ name: "phone", type: "string", fieldType: "phonenumber" }] },
  "GET /crm/v3/objects/companies/900003": { id: "900003", properties: { name: "Zimtstern Fluidtechnik AG", erp_alias: "ZIMTSTERN" } },
};

test("the whole loop: a miss is brought from the hub, coded, and nothing real is stored", { skip: !ready }, async () => {
  process.env.DATABASE_URL = HUB_DB;            // this process plays the hub
  process.env.HUBSPOT_TOKEN = "stub-not-a-token";
  const original = globalThis.fetch;
  const hubspotCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(input instanceof Request ? input.url : String(input));
    if (u.hostname !== "api.hubapi.com") return original(input, init);
    const k = `${(init?.method ?? "GET").toUpperCase()} ${u.pathname}`;
    hubspotCalls.push(k);
    const body = HUBSPOT[k];
    return new Response(JSON.stringify(body ?? { message: "not stubbed" }), { status: body ? 200 : 404, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const hub = new Client({ connectionString: HUB_DB });
  const sb = new Client({ connectionString: SANDBOX_DB });
  await hub.connect(); await sb.connect();
  try {
    await hub.query(`CREATE TABLE IF NOT EXISTS erp_fixture (company_id int, customer_name text, revenue numeric, revenue_2024 numeric, contact_email text, note text)`);
    await hub.query(`TRUNCATE erp_fixture`);
    await hub.query(`INSERT INTO erp_fixture VALUES (900001, 'Zimtstern Fluidtechnik AG', 1000.50, 900, 'anna.muster@kunde-ag.example', 'Anna wants a call')`);

    const token = await new SignJWT({ uid: 1, username: "tester", role: "admin", typ: "session" })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    const as = (p: string, init: RequestInit = {}) => original(`${URL_}${p}`, { ...init, headers: { cookie: `apsomarketinghub_session=${token}`, "content-type": "application/json" } });
    await original(`${URL_}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "x", password: "y" }) });
    await sb.query(`INSERT INTO apsomh_users (id, username, email, full_name, password_hash, totp_enrolled, role, must_change_password)
      VALUES (1, 'tester', 'tester@example.invalid', 'Tester', 'x', true, 'admin', false) ON CONFLICT (id) DO NOTHING`);
    await as("/api/sandbox", { method: "POST", body: JSON.stringify({ action: "delete-all" }) });

    // 1. a page misses (HubSpot), a database read misses, and the CLI asks for companies (and one that will leak)
    const before = await (await as("/api/datatracker/contacts?ids=101,102")).json() as { ok: boolean };
    assert.equal(before.ok, false);
    const { sqlKey } = await import("../src/lib/sandbox/canon");
    const sql = { text: "SELECT company_id, customer_name, revenue, revenue_2024, contact_email, note FROM erp_fixture ORDER BY company_id", params: [] };
    await sb.query(`INSERT INTO sandbox_misses (key, kind, request) VALUES ($1, 'sql', $2)`, [sqlKey(sql.text, sql.params), JSON.stringify(sql)]);
    await sb.query(`INSERT INTO sandbox_asks (by_user, spec, reason) VALUES ('tester', $1, 'companies with priority'), ('tester', $2, 'one company')`, [
      JSON.stringify({ kind: "hs", request: { method: "POST", url: "/crm/v3/objects/companies/search", body: { limit: 2, properties: ["name", "domain", "revenue_2025", "revenue_monthly", "sales_priority"] } } }),
      JSON.stringify({ kind: "hs", request: { method: "GET", url: "/crm/v3/objects/companies/900003", body: null } })]);
    await sb.query(`INSERT INTO sandbox_misses (key, kind, request) VALUES ('w', 'hs', $1)`, [JSON.stringify({ method: "PATCH", url: "/crm/v3/objects/companies/1", body: {} })]);
    await sb.query(`DELETE FROM sandbox_reviews`);
    await sb.query(`INSERT INTO sandbox_reviews (by_user, title, summary, base, files, patch) VALUES ('tester', 'Bar spacing', 'Tighter bar', 'd70958d', $1, $2)`,
      [JSON.stringify([{ path: "src/app/SandboxBar.tsx", added: 3, removed: 1 }]), "diff --git a/x b/x\n"]);

    // 2. Bring data, Bring requested data
    await as("/api/sandbox", { method: "POST", body: JSON.stringify({ action: "bring" }) });
    await as("/api/sandbox", { method: "POST", body: JSON.stringify({ action: "bring-requested" }) });

    // 3. the hub's round
    const { feedOne } = await import("../src/lib/sandboxFeed/feed");
    const mailed: { title: string; host: string }[] = [];
    const line = await feedOne(URL_!, KEY!, {
      railway: { token: "railway-test-token", at: new Date().toISOString() },
      sendReview: async (r, host) => { mailed.push({ title: r.title, host }); },
    });
    assert.match(line, /3 answered, 2 refused.*1 review mailed, Railway token replaced/, line);
    assert.deepEqual(mailed.map((m) => m.title), ["Bar spacing"]);
    assert.equal((await sb.query(`SELECT state FROM sandbox_reviews`)).rows[0].state, "sent");
    assert.equal((await sb.query(`SELECT v FROM sandbox_cli WHERE k = 'railway_token'`)).rows[0].v, "railway-test-token");
    // the next round: the review is not mailed twice, the token is not handed over again
    const again = await feedOne(URL_!, KEY!, { railway: { token: "railway-test-token", at: new Date(Date.now() - 60_000).toISOString() }, sendReview: async () => { throw new Error("mailed twice"); } });
    assert.match(again, /nothing asked/, again);
    assert.equal(hubspotCalls.includes("PATCH /crm/v3/objects/companies/1"), false, "a write is never run");

    // 4. the page answers coded
    const after = await (await as("/api/datatracker/contacts?ids=101,102")).json() as { ok: boolean; data: Record<string, { email: string; name: string; phone: string | null; address: string | null }> };
    assert.equal(after.ok, true);
    assert.deepEqual(after.data["101"], { email: "c101@example.invalid", name: "Contact 101", phone: null, mobile: null, address: "6300 Zug, Switzerland" });

    // 5. the database read and the ask came back coded; the leaking one and the write were refused, with a reason
    const rows = (await sb.query(`SELECT response FROM sandbox_replay WHERE kind = 'sql'`)).rows[0].response.rows[0];
    assert.equal(rows.customer_name, "Company 900001");
    assert.equal(rows.revenue_2024, "900");
    assert.notEqual(rows.revenue, "1000.50");
    const asks = (await sb.query(`SELECT state, note, answer_key FROM sandbox_asks ORDER BY id`)).rows;
    assert.equal(asks[0].state, "answered");
    assert.ok(asks[0].answer_key);
    assert.equal(asks[1].state, "refused");
    assert.match(asks[1].note, /leak check/);
    const companies = (await sb.query(`SELECT response FROM sandbox_replay WHERE key = $1`, [asks[0].answer_key])).rows[0].response.body.results;
    assert.deepEqual(companies.map((c: { properties: { name: string; sales_priority: string; revenue_2025: string } }) => [c.properties.name, c.properties.sales_priority, c.properties.revenue_2025]),
      [["Company 900001", "A", "120000"], ["Company 900002", "C", "5000"]]);
    assert.equal((await sb.query(`SELECT state FROM sandbox_misses WHERE key = 'w'`)).rows[0].state, "refused");

    // 6. nothing real anywhere in the sandbox
    const everything = JSON.stringify((await sb.query(`SELECT * FROM sandbox_replay`)).rows).toLowerCase()
      + JSON.stringify((await sb.query(`SELECT * FROM sandbox_misses`)).rows).toLowerCase()
      + JSON.stringify((await sb.query(`SELECT note FROM sandbox_asks`)).rows).toLowerCase();
    const leaks = REAL.filter((r) => everything.includes(r));
    assert.deepEqual(leaks, [], `real values stored in the sandbox: ${leaks.join(", ")}`);
  } finally {
    globalThis.fetch = original;
    await hub.end(); await sb.end();
    const { getPool } = await import("../src/lib/db/client");
    await getPool().end().catch(() => {});
  }
});
