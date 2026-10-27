// A sandbox served by the hub (src/lib/sandbox/proxy.ts): which sandbox an address is, the hub's signature on what it
// forwards, what crosses in each direction, and the pin that keeps a sandbox page's calls under its own path.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { SignJWT } from "jose";
import {
  downstreamHeaders, localLocation, pinScript, signProxy, targetOf, upstreamHeaders, verifyProxy,
} from "../src/lib/sandbox/proxy";
import { sandboxTargetList, sandboxTargets } from "../src/lib/sandboxFeed/policy";

const KEY = createHash("sha256").update("a link key").digest("hex");

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

test("the hub's signature: who is asking, for a minute, only with the link key", async () => {
  const t = await signProxy("Diana@APSOparts.example", KEY);
  assert.equal(await verifyProxy(t, KEY), "diana@apsoparts.example");
  assert.equal(await verifyProxy(t, createHash("sha256").update("another key").digest("hex")), null, "another key");
  assert.equal(await verifyProxy(t, undefined), null, "a copy without the key lets nobody in this way - the hub itself");
  assert.equal(await verifyProxy(t, "short"), null);
  assert.equal(await verifyProxy(null, KEY), null);
  assert.equal(await verifyProxy(`${t}x`, KEY), null, "tampered");
  const old = await signProxy("diana@apsoparts.example", KEY, -5);
  assert.equal(await verifyProxy(old, KEY), null, "expired");
  // a hub SESSION signed with the same bytes is still not a forwarded request
  const session = await new SignJWT({ email: "diana@apsoparts.example", typ: "session" }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("1m").sign(new TextEncoder().encode(`sandbox-proxy:${KEY}`));
  assert.equal(await verifyProxy(session, KEY), null);
});

test("what crosses: never a cookie either way, never the hub's address, redirects stay on the hub", () => {
  const up = upstreamHeaders(new Headers({
    cookie: "apsomarketinghub_session=secret", authorization: "Bearer x", host: "hub.example", "x-forwarded-for": "10.0.0.1",
    accept: "text/html", rsc: "1", "next-router-state-tree": "%5B%5D", "content-type": "application/json", "x-sandbox-proxy": "forged",
  }));
  assert.deepEqual([...up.keys()].sort(), ["accept", "content-type", "next-router-state-tree", "rsc"]);

  const origin = "https://sandbox-x-sandbox.up.railway.app";
  const down = downstreamHeaders(new Headers({
    "set-cookie": "apsomarketinghub_session=theirs; Path=/", "content-type": "text/html", "content-encoding": "gzip",
    "content-length": "12", location: `${origin}/sandbox/run/x/signin?next=%2F`, "x-powered-by": "Next.js",
  }), origin);
  assert.deepEqual([...down.keys()].sort(), ["content-type", "location"]);
  assert.equal(down.get("location"), "/sandbox/run/x/signin?next=%2F");

  assert.equal(localLocation("https://0.0.0.0:3000/sandbox/run/x/", origin), "/sandbox/run/x/");
  assert.equal(localLocation("http://sandbox-x.railway.internal:3000/sandbox/run/x/a?b=1", origin), "/sandbox/run/x/a?b=1");
  assert.equal(localLocation("/sandbox/run/x/a", origin), "/sandbox/run/x/a");
  assert.equal(localLocation("https://www.apsoparts.com/", origin), "https://www.apsoparts.com/", "elsewhere stays elsewhere");
});

test("the pin: a sandbox page's root-relative calls stay under its path, links back to the hub may leave", () => {
  const B = "/sandbox/run/diana";
  const seen: string[] = [];
  class FakeRequest { url: string; constructor(u: string) { this.url = u; } }
  class FakeXhr { open(_m: string, u: string) { seen.push(`xhr ${u}`); } }
  class FakeEventSource { constructor(u: string) { seen.push(`es ${u}`); } }
  let click: ((e: unknown) => void) | null = null;
  const win = {
    location: { href: `https://hub.example${B}/reporting`, origin: "https://hub.example" },
    fetch: (i: unknown) => { seen.push(`fetch ${typeof i === "string" ? i : (i as FakeRequest).url}`); return Promise.resolve(); },
    EventSource: FakeEventSource,
  } as Record<string, unknown>;
  const doc = { addEventListener: (_t: string, f: (e: unknown) => void) => { click = f; } };
  new Function("window", "document", "location", "XMLHttpRequest", "Request", "URL", pinScript(B))(
    win, doc, win.location, FakeXhr, FakeRequest, URL);

  const f = win.fetch as (i: unknown) => Promise<void>;
  f("/api/sandbox");
  f(`${B}/api/sandbox`);
  f("https://hub.example/api/uc/lifecycle");
  f("https://www.apsoparts.com/x");
  f(new FakeRequest("https://hub.example/api/x"));
  new (FakeXhr as unknown as new () => { open: (m: string, u: string) => void })().open("GET", "/api/xhr");
  new (win.EventSource as new (u: string) => unknown)("/api/stream");
  assert.deepEqual(seen, [
    `fetch https://hub.example${B}/api/sandbox`, `fetch ${B}/api/sandbox`, `fetch https://hub.example${B}/api/uc/lifecycle`,
    "fetch https://www.apsoparts.com/x", `fetch https://hub.example${B}/api/x`, `xhr https://hub.example${B}/api/xhr`,
    `es https://hub.example${B}/api/stream`,
  ]);

  const link = (href: string, leave = false) => {
    const a = { href: new URL(href, (win.location as { href: string }).href).toString(), attrs: { href } as Record<string, string>,
      getAttribute(k: string) { return this.attrs[k]; }, setAttribute(k: string, v: string) { this.attrs[k] = v; this.href = new URL(v, "https://hub.example").toString(); },
      hasAttribute: (k: string) => leave && k === "data-leave-sandbox" };
    click!({ target: { closest: () => a } });
    return a.attrs.href;
  };
  assert.equal(link("/reporting"), `https://hub.example${B}/reporting`);
  assert.equal(link(`${B}/reporting`), `${B}/reporting`);
  assert.equal(link("/sandbox", true), "/sandbox", "Bring data on the hub / Back to the hub");
});
