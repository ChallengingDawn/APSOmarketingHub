// Which sandbox an address is (src/lib/sandbox/targets.ts), and what a relay accepts as a read the person's computer
// could not answer (missIn, src/lib/sandbox/canon.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { targetOf } from "../src/lib/sandbox/targets";
import { hubspotKey, missIn, sqlKey } from "../src/lib/sandbox/canon";
import { sandboxTargetList, sandboxTargets } from "../src/lib/sandboxFeed/policy";

test("an address names its sandbox: its path, or its Railway host without the word sandbox", () => {
  assert.deepEqual(targetOf("https://sandbox-diana-fehr-sandbox.up.railway.app"), {
    slug: "diana-fehr", origin: "https://sandbox-diana-fehr-sandbox.up.railway.app", basePath: "/sandbox/run/diana-fehr",
    base: "https://sandbox-diana-fehr-sandbox.up.railway.app/sandbox/run/diana-fehr",
  });
  assert.equal(targetOf("https://apsohub-sandbox-sandbox.up.railway.app/")?.slug, "apsohub");
  assert.equal(targetOf("http://127.0.0.1:3197/sandbox/run/diana")?.base, "http://127.0.0.1:3197/sandbox/run/diana");
  assert.equal(targetOf("http://evil.example/sandbox/run/x"), null, "plain http only on this machine");
  assert.equal(targetOf("https://a.up.railway.app/somewhere/else"), null, "only a sandbox path");
  assert.equal(targetOf("https://a.up.railway.app/sandbox/run/../../api"), null);
  assert.equal(targetOf("not a url"), null);
});

test("SANDBOX_URLS: https only (plain http only on this machine), each sandbox once", () => {
  assert.deepEqual(sandboxTargets(" https://a.up.railway.app/ ,http://evil.example, http://127.0.0.1:3197/sandbox/run/b,https://a.up.railway.app"),
    ["https://a.up.railway.app/sandbox/run/a", "http://127.0.0.1:3197/sandbox/run/b"]);
  assert.deepEqual(sandboxTargetList("https://sandbox-x-sandbox.up.railway.app,https://other.up.railway.app/sandbox/run/x").map((t) => t.origin),
    ["https://sandbox-x-sandbox.up.railway.app"], "one sandbox per name");
  assert.deepEqual(sandboxTargets(undefined), []);
});

test("a computer's waiting read: reads only, keyed by the relay itself, never the sandbox's own tables", () => {
  const search = { method: "post", url: "/crm/v3/objects/companies/search", body: '{"limit":2,"after":"0"}' };
  const hs = missIn("hs", search);
  assert.deepEqual(hs, { kind: "hs", key: hubspotKey("POST", search.url, search.body), request: { ...search, method: "POST" } });
  // the key is the one the sandbox's own replay writes for the same call, whatever the computer sends alongside
  assert.equal(missIn("hs", { ...search, key: "forged" })?.key, hubspotKey("POST", search.url, search.body));
  assert.equal(missIn("hs", { method: "GET", url: "/crm/v3/objects/companies/1" })?.kind, "hs");

  assert.equal(missIn("hs", { method: "PATCH", url: "/crm/v3/objects/companies/1", body: {} }), null, "a write");
  assert.equal(missIn("hs", { method: "POST", url: "/crm/v3/objects/companies", body: {} }), null, "a create");
  assert.equal(missIn("hs", { method: "GET", url: "https://api.hubapi.com/crm/v3/x" }), null, "a path, not an address");
  assert.equal(missIn("hs", { method: "GET", url: `/${"x".repeat(5000)}` }), null, "too long");

  const sql = { text: "SELECT company_id FROM erp_fixture WHERE company_id = $1", params: [1] };
  assert.deepEqual(missIn("sql", sql), { kind: "sql", key: sqlKey(sql.text, sql.params), request: sql });
  assert.deepEqual(missIn("sql", { text: "SELECT 1" })?.request, { text: "SELECT 1", params: [] });
  assert.equal(missIn("sql", { text: "DELETE FROM erp_fixture" }), null, "a write");
  assert.equal(missIn("sql", { text: "SELECT * FROM apsomh_users" }), null, "the logins");
  assert.equal(missIn("sql", { text: "SELECT * FROM sandbox_replay" }), null, "the sandbox's own table");
  assert.equal(missIn("sql", { text: "SELECT * FROM pg_tables" }), null, "the catalogue");
  assert.equal(missIn("other", sql), null);
  assert.equal(missIn("sql", null), null);
});
