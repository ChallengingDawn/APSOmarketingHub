import assert from "node:assert/strict";
import { test } from "node:test";
import { keepAlive } from "../src/lib/http/keepAlive";

// A slow answer kept alive past the load balancer's 60 s (08.11.2026): spaces while it works, then the JSON.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("spaces go out while the work runs, then the JSON - and r.json() reads it", async () => {
  const r = keepAlive(async () => { await wait(120); return Response.json({ ok: true, n: 1 }); }, 10);
  assert.equal(r.status, 200);
  const text = await r.clone().text();
  // at least one beat before the answer (timers are uneven on a busy machine - the count is not the point)
  assert.match(text, /^ +\{"ok":true,"n":1\}$/);
  assert.deepEqual(await r.json(), { ok: true, n: 1 });
});

test("a failing work and a non-JSON answer still arrive as JSON with ok: false", async () => {
  const thrown = keepAlive(async () => { throw new Error("HubSpot did not answer"); }, 1000);
  assert.deepEqual(await thrown.json(), { ok: false, error: "HubSpot did not answer" });
  const html = keepAlive(async () => new Response("<html>bad gateway</html>", { status: 502 }), 1000);
  // never a page of HTML or a bare status in front of a person (SARCLA 10.11.2026: "The hub answered 200.")
  assert.deepEqual(await html.json(), { ok: false, error: "The hub is restarting or busy - try again in a minute." });
  const refused = keepAlive(async () => Response.json({ ok: false, error: "Not allowed" }, { status: 403 }), 1000);
  assert.deepEqual(await refused.json(), { ok: false, error: "Not allowed" });
});
