import assert from "node:assert/strict";
import { test } from "node:test";
import { adminToken, callGateway } from "../src/lib/searchbar/call";

// The hub reads the search bar's gateway on Railway server to server: the key travels as X-Admin-Token (the
// gateway's requireAdmin), never to the browser; a refused key and a missing key are said in words.

const BASE = "https://smart-search-production-15d5.up.railway.app";
type Seen = { url: string; headers: Record<string, string> };
async function withFetch(answer: { status: number; body: unknown }, run: (seen: Seen[]) => Promise<void>) {
  const real = globalThis.fetch;
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init: { headers?: Record<string, string> }) => {
    seen.push({ url: String(url), headers: init?.headers ?? {} });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  try { await run(seen); } finally { globalThis.fetch = real; }
}

test("no key on the hub: the reason is plain", async () => {
  delete process.env.SMART_BAR_ADMIN_TOKEN;
  assert.equal(adminToken(), null);
  await assert.rejects(callGateway(BASE, adminToken(), "/api/smart-bar/report?days=7"), /SMART_BAR_ADMIN_TOKEN is not set on the hub/);
});

test("the key goes as X-Admin-Token, trimmed, to the gateway's path", async () => {
  process.env.SMART_BAR_ADMIN_TOKEN = " test-key ";
  await withFetch({ status: 200, body: { days: 7, settled_searches: 3 } }, async (seen) => {
    const r = await callGateway<{ settled_searches: number }>(BASE, adminToken(), "/api/smart-bar/report?days=7");
    assert.equal(r.settled_searches, 3);
    assert.equal(seen[0].url, `${BASE}/api/smart-bar/report?days=7`);
    assert.equal(seen[0].headers["x-admin-token"], "test-key");
  });
});

test("a refused key is named; any other refusal carries the gateway's own words", async () => {
  await withFetch({ status: 401, body: { error: "unauthorized" } }, async () => {
    await assert.rejects(callGateway(BASE, "k", "/api/smart-bar/stock"), /refused the hub's key \(SMART_BAR_ADMIN_TOKEN differs\)/);
  });
  await withFetch({ status: 503, body: { error: "admin endpoints disabled (SMART_BAR_ADMIN_TOKEN not set)" } }, async () => {
    await assert.rejects(callGateway(BASE, "k", "/api/smart-bar/stock"), /answered 503: admin endpoints disabled/);
  });
});
