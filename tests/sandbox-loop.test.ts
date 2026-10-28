// The whole loop, hub side included: a page of the sandbox on the person's computer misses -> `sbx dev`'s exchange
// (scripts/sbx-dev.mjs syncOnce) passes the read up to the relay -> Bring data on the hub (feed.ts) runs it (HubSpot
// stubbed with made-up "real" data, the hub's database a throwaway one), codes it, puts it on the relay -> the exchange
// copies it down -> the page answers coded, and not one real value is stored on the computer or the relay. Opt-in -
// needs a local relay, a local sandbox and three throwaway databases:
//   SANDBOX_TEST_URL=http://127.0.0.1:3197/sandbox/run/diana (the relay, built with that SANDBOX_BASE_PATH)
//   SANDBOX_TEST_DATABASE_URL=<the relay's>  SANDBOX_TEST_HUB_DATABASE_URL=<the "hub's">
//   SANDBOX_TEST_LINK_KEY=<key whose sha256 the relay has>  SANDBOX_TEST_SESSION_SECRET=<the relay's>
//   SANDBOX_TEST_LOCAL_URL=http://127.0.0.1:3199 (APSOHUB_SANDBOX=1 SANDBOX_LOCAL=1)  SANDBOX_TEST_LOCAL_DATABASE_URL=<its>
//   SANDBOX_TEST_LOCAL_KEY=<key whose sha256 the local sandbox has>
//   and SANDBOX_PEOPLE="diana@apsoparts.example|user|Diana Test" on both
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { Client } from "pg";
import { SignJWT } from "jose";

const URL_ = process.env.SANDBOX_TEST_URL;
const SANDBOX_DB = process.env.SANDBOX_TEST_DATABASE_URL;
const HUB_DB = process.env.SANDBOX_TEST_HUB_DATABASE_URL;
const KEY = process.env.SANDBOX_TEST_LINK_KEY;
const SECRET = process.env.SANDBOX_TEST_SESSION_SECRET;
const LOCAL = process.env.SANDBOX_TEST_LOCAL_URL;
const LOCAL_DB = process.env.SANDBOX_TEST_LOCAL_DATABASE_URL;
const LOCAL_KEY = process.env.SANDBOX_TEST_LOCAL_KEY;
const ready = !!(URL_ && SANDBOX_DB && HUB_DB && KEY && SECRET && LOCAL && LOCAL_DB && LOCAL_KEY);

type Moved = { brought: number; refused: number; noted: number };
type SyncState = { after: string | null; sent: Set<string>; refused: Set<string> };

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

/** A request naming another host, the way a web page that points a name of its own at 127.0.0.1 would arrive. */
function asHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers: { host } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", reject);
    req.end();
  });
}

test("the whole loop: a miss on the computer is brought from the hub through the relay, coded, and nothing real is stored", { skip: !ready }, async () => {
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

  // `sbx dev`'s exchange is an ES module beside the CLI; a real import() - the compiled tests are CommonJS
  const esm = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
  const { syncOnce } = await esm(pathToFileURL(path.resolve(process.cwd(), "scripts/sbx-dev.mjs")).href) as
    { syncOnce: (o: { relay: string; token: string; app: string; localKey: string; state: SyncState }) => Promise<Moved> };
  const { bring, deleteAllIn, feedOne, readSandbox } = await import("../src/lib/sandboxFeed/feed");
  const hub = new Client({ connectionString: HUB_DB });
  const sb = new Client({ connectionString: SANDBOX_DB });
  const pc = new Client({ connectionString: LOCAL_DB });
  await hub.connect(); await sb.connect(); await pc.connect();
  const local = (p: string, init: RequestInit = {}) => original(`${LOCAL}${p}`, { ...init, headers: { "content-type": "application/json" } });
  try {
    await hub.query(`CREATE TABLE IF NOT EXISTS erp_fixture (company_id int, customer_name text, revenue numeric, revenue_2024 numeric, contact_email text, note text)`);
    await hub.query(`TRUNCATE erp_fixture`);
    await hub.query(`INSERT INTO erp_fixture VALUES (900001, 'Zimtstern Fluidtechnik AG', 1000.50, 900, 'anna.muster@kunde-ag.example', 'Anna wants a call')`);
    await deleteAllIn(URL_!, KEY!);

    // the CLI's sign-in on the relay (the CLI test proves how it is got)
    const found = await sb.query(`SELECT id FROM apsomh_users WHERE email = 'diana@apsoparts.example'`);
    const uid = found.rows[0]?.id ?? (await sb.query(`INSERT INTO apsomh_users (username, email, full_name, password_hash, role, must_change_password)
      VALUES ('diana@apsoparts.example', 'diana@apsoparts.example', 'Diana Test', 'x', 'user', false) RETURNING id`)).rows[0].id;
    const token = await new SignJWT({ uid: Number(uid), typ: "sbx-cli" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
      .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    const state: SyncState = { after: null, sent: new Set(), refused: new Set() };
    const sync = () => syncOnce({ relay: URL_!, token, app: LOCAL!, localKey: LOCAL_KEY!, state });

    // 0. the sandbox on the computer is theirs alone: no sign-in, localhost only, its link only with its own key
    const bar = await (await local("/api/sandbox")).json() as { name: string | null };
    assert.equal(bar.name, "Diana", "no sign-in on the person's own computer - its band names them");
    assert.equal(await asHost(`${LOCAL}/api/sandbox`, "evil.example"), 403, "a name pointed at 127.0.0.1 is refused");
    assert.equal((await original(`${LOCAL}/api/sandbox-link/feed`, { headers: { authorization: `Bearer ${KEY}` } })).status, 401, "the hub's key opens nothing here");
    await local("/api/sandbox", { method: "POST", body: JSON.stringify({ action: "delete-all" }) });

    // 1. a page on the computer misses (HubSpot), a database read misses, and a read the hub will not serve
    const before = await (await local("/api/datatracker/contacts?ids=101,102")).json() as { ok: boolean };
    assert.equal(before.ok, false);
    const { hubspotKey, sqlKey } = await import("../src/lib/sandbox/canon");
    const sql = { text: "SELECT company_id, customer_name, revenue, revenue_2024, contact_email, note FROM erp_fixture ORDER BY company_id", params: [] };
    const files = { method: "GET", url: "/files/v3/files/123", body: null };
    await pc.query(`INSERT INTO sandbox_misses (key, kind, request) VALUES ($1, 'sql', $2), ($3, 'hs', $4)`,
      [sqlKey(sql.text, sql.params), JSON.stringify(sql), hubspotKey(files.method, files.url, null), JSON.stringify(files)]);

    // 2. the exchange passes them up - which read, never data - and the hub's Sandbox app sees them on the relay
    const up = await sync();
    assert.deepEqual(up, { brought: 0, refused: 0, noted: 3 });
    assert.deepEqual(await sync(), { brought: 0, refused: 0, noted: 0 }, "each read once");
    const waiting = await readSandbox(URL_!, KEY!);
    assert.equal(waiting.misses.length, 3);

    // 3. the hub's minute round never runs a read: it mails the review (Delete all keeps reviews, so start clean)
    await sb.query(`DELETE FROM sandbox_reviews`);
    await sb.query(`INSERT INTO sandbox_reviews (by_user, title, summary, base, files, patch) VALUES ('diana@apsoparts.example', 'Bar spacing', 'Tighter bar', 'd70958d', $1, $2)`,
      [JSON.stringify([{ path: "src/app/SandboxBar.tsx", added: 3, removed: 1 }]), "diff --git a/x b/x\n"]);
    const mailed: string[] = [];
    assert.match(await feedOne(URL_!, KEY!, { sendReview: async (r) => { mailed.push(r.title); } }), /1 review mailed/);
    assert.equal(hubspotCalls.length, 0, "the round read nothing from HubSpot");
    assert.deepEqual(mailed, ["Bar spacing"]);

    // 4. Bring data, pressed on the hub: two brought, the one it does not serve refused - onto the relay
    const reads = await bring(URL_!, KEY!, "reads");
    assert.match(reads.line, /2 brought, 1 refused \(1x HubSpot \/files\/v3\/files is not served/, reads.line);

    // 5. the exchange copies them down, and the page on the computer answers coded
    assert.deepEqual(await sync(), { brought: 2, refused: 1, noted: 0 });
    const after = await (await local("/api/datatracker/contacts?ids=101,102")).json() as { ok: boolean; data: Record<string, unknown> };
    assert.equal(after.ok, true);
    assert.deepEqual(after.data["101"], { email: "c101@example.invalid", name: "Contact 101", phone: null, mobile: null, address: "6300 Zug, Switzerland" });
    const rows = (await pc.query(`SELECT response FROM sandbox_replay WHERE kind = 'sql'`)).rows[0].response.rows[0];
    assert.equal(rows.customer_name, "Company 900001");
    assert.equal(rows.revenue_2024, "900");
    assert.notEqual(rows.revenue, "1000.50");
    const states = (await pc.query(`SELECT kind, state FROM sandbox_misses ORDER BY kind, state`)).rows.map((r) => `${r.kind}:${r.state}`);
    assert.deepEqual(states, ["hs:answered", "hs:refused", "sql:answered"]);
    const band = await (await local("/api/sandbox")).json() as { missing: number; refused: number; brought: number };
    assert.deepEqual([band.missing, band.refused, band.brought], [0, 1, 2]);

    // 6. Bring requested data: the CLI's asks, answered on the relay (one refused by the leak check)
    await sb.query(`INSERT INTO sandbox_asks (by_user, spec, reason) VALUES ('diana@apsoparts.example', $1, 'companies with priority'), ('diana@apsoparts.example', $2, 'one company')`, [
      JSON.stringify({ kind: "hs", request: { method: "POST", url: "/crm/v3/objects/companies/search", body: { limit: 2, properties: ["name", "domain", "revenue_2025", "revenue_monthly", "sales_priority"] } } }),
      JSON.stringify({ kind: "hs", request: { method: "GET", url: "/crm/v3/objects/companies/900003", body: null } })]);
    const asked = await bring(URL_!, KEY!, "asks");
    assert.match(asked.line, /1 brought, 1 refused \(1x leak check/, asked.line);
    const asks = (await sb.query(`SELECT state, answer_key FROM sandbox_asks ORDER BY id`)).rows;
    const companies = (await sb.query(`SELECT response FROM sandbox_replay WHERE key = $1`, [asks[0].answer_key])).rows[0].response.body.results;
    assert.deepEqual(companies.map((c: { properties: { name: string; sales_priority: string; revenue_2025: string } }) => [c.properties.name, c.properties.sales_priority, c.properties.revenue_2025]),
      [["Company 900001", "A", "120000"], ["Company 900002", "C", "5000"]]);
    assert.deepEqual(await sync(), { brought: 1, refused: 0, noted: 0 }, "the ask's answer is copied down too");

    // 7. Delete all on the computer: what the hub brought comes down again with the next exchange
    await local("/api/sandbox", { method: "POST", body: JSON.stringify({ action: "delete-all" }) });
    assert.equal(Number((await pc.query(`SELECT count(*) FROM sandbox_replay`)).rows[0].count), 0);
    assert.equal((await sync()).brought, 3);

    // 8. nothing real anywhere - not on the relay, not on the computer
    for (const [where, db] of [["relay", sb], ["computer", pc]] as const) {
      const everything = JSON.stringify((await db.query(`SELECT * FROM sandbox_replay`)).rows).toLowerCase()
        + JSON.stringify((await db.query(`SELECT * FROM sandbox_misses`)).rows).toLowerCase()
        + JSON.stringify((await db.query(`SELECT note FROM sandbox_asks`)).rows).toLowerCase();
      const leaks = REAL.filter((r) => everything.includes(r));
      assert.deepEqual(leaks, [], `real values stored on the ${where}: ${leaks.join(", ")}`);
    }
  } finally {
    globalThis.fetch = original;
    await hub.end(); await sb.end(); await pc.end();
    const { getPool } = await import("../src/lib/db/client");
    await getPool().end().catch(() => {});
  }
});
