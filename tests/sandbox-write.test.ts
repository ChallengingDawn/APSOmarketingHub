// Needs a throwaway Postgres: SANDBOX_TEST_DATABASE_URL=postgres://...  (skipped without it - npm test stays offline).
import assert from "node:assert/strict";
import { test } from "node:test";

const DB = process.env.SANDBOX_TEST_DATABASE_URL;

test("a HubSpot write in the sandbox is answered 'done', listed, and never reaches the network; a read goes out", { skip: !DB }, async () => {
  process.env.DATABASE_URL = DB;
  const { hubspotFetch } = await import("../src/lib/sandbox/hubspot");
  const { getPool } = await import("../src/lib/db/client");
  let network = 0;
  const original = (async () => { network++; throw new Error("the real network was called"); }) as unknown as typeof fetch;
  const f = hubspotFetch(original);

  const before = await getPool().query(`SELECT count(*)::int AS n FROM sandbox_would_write`).catch(() => ({ rows: [{ n: 0 }] }));
  const res = await f("https://api.hubapi.com/crm/v3/objects/companies/31258743810", {
    method: "PATCH", body: JSON.stringify({ properties: { hubspot_owner_id: "1202569408" } }),
  });
  assert.equal(res.status, 200);
  assert.match(((await res.json()) as { sandbox: string }).sandbox, /nothing was sent/);
  const after = await getPool().query<{ n: number; url: string }>(
    `SELECT count(*)::int AS n, max(url) AS url FROM sandbox_would_write`);
  assert.equal(after.rows[0].n, before.rows[0].n + 1);
  assert.equal(after.rows[0].url, "/crm/v3/objects/companies/31258743810");

  // a create and an association are writes too
  for (const [method, url] of [["POST", "/crm/v3/objects/tickets"], ["PUT", "/crm/v4/objects/tickets/1/associations/companies/2"]]) {
    assert.equal((await f(`https://api.hubapi.com${url}`, { method, body: "{}" })).status, 200);
  }
  assert.equal(network, 0, "no HubSpot write went to the network");

  // a read - a GET, a search, a batch read - goes to HubSpot with the person's own app
  await assert.rejects(f("https://api.hubapi.com/crm/v3/objects/companies/1"));
  await assert.rejects(f("https://api.hubapi.com/crm/v3/objects/companies/search", { method: "POST", body: "{}" }));
  assert.equal(network, 2, "reads go out");

  // anything that is not HubSpot is handed on to the network layer (where the guard refuses it)
  await assert.rejects(f("https://data-connector.example/erosion/outlook"));
  assert.equal(network, 3);
  await getPool().end();
});
