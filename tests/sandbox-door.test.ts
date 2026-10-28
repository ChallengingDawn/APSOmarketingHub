// The microservices in a sandbox: read through the door (src/lib/sandbox/viewer.ts) with the person's viewer key, never
// with a gateway's admin key - and nothing but a read leaves.
import assert from "node:assert/strict";
import http from "node:http";
import type net from "node:net";
import { test } from "node:test";
import { doorGet } from "../src/lib/sandbox/viewer";
import { adminToken } from "../src/lib/searchbar/call";
import { DOOR_KEY } from "../src/lib/sandbox/mode";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return fn().finally(() => { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
}

test("only a read goes through the door, and only with the door set up", async () => {
  await withEnv({ SANDBOX_VIEWER_URL: "http://127.0.0.1:1", SANDBOX_VIEWER_KEY: "k" }, async () => {
    for (const method of ["POST", "PUT", "DELETE", "patch"]) {
      await assert.rejects(doorGet("search-bar", "/api/smart-bar/admin/kill-switch", { method }), /only reads the microservices/);
    }
  });
  await withEnv({ SANDBOX_VIEWER_URL: undefined, SANDBOX_VIEWER_KEY: undefined }, async () => {
    await assert.rejects(doorGet("ads", "/admin/status"), /\.env\.local/);
  });
});

test("a read reaches the door under its service, with the viewer key - and the door's refusal is named", async () => {
  const seen: { url?: string; key?: string; method?: string }[] = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, key: req.headers["x-viewer-key"] as string, method: req.method });
    if (req.headers["x-viewer-key"] !== "daniel-key") { res.writeHead(403, { "content-type": "application/json" }); res.end('{"error":"unknown viewer key"}'); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"days":7}');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/`;
  try {
    await withEnv({ SANDBOX_VIEWER_URL: base, SANDBOX_VIEWER_KEY: "daniel-key" }, async () => {
      assert.deepEqual(await doorGet("search-bar", "/api/smart-bar/report?days=7"), { days: 7 });
      assert.deepEqual(await doorGet("3d", "status"), { days: 7 });
    });
    assert.deepEqual(seen.map((s) => [s.method, s.url, s.key]), [
      ["GET", "/viewer/search-bar/api/smart-bar/report?days=7", "daniel-key"], ["GET", "/viewer/3d/status", "daniel-key"]]);
    await withEnv({ SANDBOX_VIEWER_URL: base, SANDBOX_VIEWER_KEY: "someone-else" }, async () => {
      await assert.rejects(doorGet("directup", "/status"), /refused your viewer key \(unknown viewer key\)/);
    });
  } finally {
    server.close();
  }
});

test("in a sandbox a gateway's key is the door's placeholder, never a real key", async () => {
  await withEnv({ APSOHUB_SANDBOX: "1", SMART_BAR_ADMIN_TOKEN: "the-real-admin-token" }, async () => {
    assert.equal(adminToken(), DOOR_KEY);
  });
  await withEnv({ APSOHUB_SANDBOX: undefined, SMART_BAR_ADMIN_TOKEN: "the-real-admin-token" }, async () => {
    assert.equal(adminToken(), "the-real-admin-token");
  });
});
