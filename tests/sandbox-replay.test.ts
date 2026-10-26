import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canonical, hubspotKey, isHubspotRead, isSqlRead, sqlKey, tablesIn, NEVER_FROM_HUB } from "../src/lib/sandbox/canon";
import { hubKeyOk, realAddressIn } from "../src/lib/sandbox/link";
import { tablesToEmpty, KEEP_TABLES } from "../src/lib/sandbox/store";

const at = (iso: string) => Date.parse(iso);

test("times are cut to the day; ids, counts and amounts are not", () => {
  assert.equal(canonical(at("2026-10-26T09:00:00Z")), "<day 2026-10-26>");
  assert.equal(canonical(String(at("2026-10-26T16:30:00Z"))), "<day 2026-10-26>");
  assert.equal(canonical("2026-10-26T16:30:00.000Z"), "<day 2026-10-26>");
  assert.equal(canonical("2026-10-26"), "<day 2026-10-26>");
  assert.equal(canonical(new Date("2026-10-26T23:59:00Z")), "<day 2026-10-26>");
  assert.equal(canonical(31258743810), 31258743810);       // a HubSpot company id
  assert.equal(canonical("4197562568"), "4197562568");     // a pipeline id
  assert.equal(canonical(1250.5), 1250.5);
  assert.deepEqual(canonical({ b: 1, a: { d: 2, c: 3 } }), { a: { c: 3, d: 2 }, b: 1 });
});

test("the same search asked twice in a day is one read; another day or another filter is another", () => {
  const body = (since: number, stage = "1") => JSON.stringify({
    filterGroups: [{ filters: [{ propertyName: "createdate", operator: "GTE", value: since }, { propertyName: "hs_pipeline_stage", operator: "EQ", value: stage }] }],
    properties: ["subject", "hs_pipeline_stage"], limit: 100,
  });
  const url = "/crm/v3/objects/tickets/search";
  const morning = hubspotKey("POST", url, body(at("2026-09-26T09:00:00Z")));
  const afternoon = hubspotKey("post", url, body(at("2026-09-26T16:00:00Z")));
  assert.equal(morning, afternoon);
  assert.notEqual(morning, hubspotKey("POST", url, body(at("2026-09-27T09:00:00Z"))));
  assert.notEqual(morning, hubspotKey("POST", url, body(at("2026-09-26T09:00:00Z"), "2")));
  assert.equal(hubspotKey("GET", "/crm/v3/owners?limit=100&after=5"), hubspotKey("GET", "https://api.hubapi.com/crm/v3/owners?after=5&limit=100"));
});

test("HubSpot reads are GETs, searches and batch reads - everything else is a write and never leaves", () => {
  assert.equal(isHubspotRead("GET", "/crm/v3/objects/companies/123"), true);
  assert.equal(isHubspotRead("POST", "/crm/v3/objects/companies/search"), true);
  assert.equal(isHubspotRead("POST", "/crm/v3/objects/contacts/batch/read"), true);
  assert.equal(isHubspotRead("POST", "/crm/v4/associations/tickets/companies/batch/read"), true);
  assert.equal(isHubspotRead("PATCH", "/crm/v3/objects/companies/123"), false);
  assert.equal(isHubspotRead("POST", "/crm/v3/objects/tickets"), false);
  assert.equal(isHubspotRead("POST", "/crm/v3/objects/tickets/batch/update"), false);
  assert.equal(isHubspotRead("PUT", "/crm/v4/objects/tickets/1/associations/companies/2"), false);
  assert.equal(isHubspotRead("DELETE", "/crm/v3/objects/tickets/1"), false);
});

test("a database read is a SELECT with no write hidden inside", () => {
  assert.equal(isSqlRead("SELECT * FROM erp_orders WHERE id = $1"), true);
  assert.equal(isSqlRead("  -- note\n with x as (select 1) select * from x"), true);
  assert.equal(isSqlRead("SELECT note FROM t WHERE note = 'please delete me'"), true);
  assert.equal(isSqlRead("WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d"), false);
  assert.equal(isSqlRead("SELECT * FROM t FOR UPDATE"), false);
  assert.equal(isSqlRead("INSERT INTO t VALUES (1)"), false);
  assert.equal(isSqlRead("CREATE TABLE IF NOT EXISTS t (k text)"), false);
  assert.equal(sqlKey("SELECT 1\n  FROM t WHERE d > $1", [new Date("2026-10-26T08:00:00Z")]),
    sqlKey("SELECT 1 FROM t WHERE d > $1", ["2026-10-26T17:00:00Z"]));
});

test("the tables a read names, for the hub's refusal of logins and keys", () => {
  assert.deepEqual(tablesIn(`SELECT * FROM public."apsomh_users" u JOIN apsomh_sessions s ON s.uid = u.id`).sort(), ["apsomh_sessions", "apsomh_users"]);
  assert.deepEqual(tablesIn("select v from apsomh_kv where k = $1"), ["apsomh_kv"]);
  assert.ok(NEVER_FROM_HUB.includes("apsomh_kv"));
});

test("Delete all empties every table but the logins (the key store is done apart)", () => {
  const all = ["apsomh_users", "apsomh_sessions", "apsomh_user_app_access", "apsomh_kv", "sandbox_marker",
    "sandbox_replay", "sandbox_misses", "erosion_tickets", "apsomh_audit"];
  assert.deepEqual(tablesToEmpty(all), ["apsomh_audit", "erosion_tickets", "sandbox_misses", "sandbox_replay"]);
  for (const k of KEEP_TABLES) assert.ok(!tablesToEmpty(all).includes(k));
});

test("only the hub's key opens the side door, and only when a hash is configured", () => {
  const key = "hub-key-for-test";
  const hash = createHash("sha256").update(key).digest("hex");
  assert.equal(hubKeyOk(`Bearer ${key}`, hash), true);
  assert.equal(hubKeyOk(`Bearer ${key}x`, hash), false);
  assert.equal(hubKeyOk(key, hash), false);
  assert.equal(hubKeyOk(`Bearer ${key}`, undefined), false);
  assert.equal(hubKeyOk(`Bearer ${key}`, "not-a-hash"), false);
});

test("a delivery carrying a real address is refused whole; coded addresses pass", () => {
  const ok = { answers: [{ key: "k", kind: "hs", request: {}, response: { body: { email: "c123@example.invalid" } } }] };
  assert.equal(realAddressIn(ok), null);
  const bad = { answers: [{ key: "k", kind: "hs", request: {}, response: { body: { note: "write to anna@customer.example" } } }] };
  assert.equal(realAddressIn(bad), "…@customer.example");
});
