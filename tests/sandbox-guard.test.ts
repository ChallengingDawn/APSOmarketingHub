import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { allowedHosts, installSandboxGuard, SANDBOX_BLOCKED, targetHost } from "../src/lib/sandbox/netGuard";
import { looksLikeHubDatabase, pickJobs } from "../src/lib/sandbox/jobs";
import { isSandbox } from "../src/lib/sandbox/mode";

// test environments: only the variables a case needs (Next's types would ask for NODE_ENV too)
const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const SANDBOX_ENV = env({ DATABASE_URL: "postgresql://u:p@postgres.railway.internal:5432/railway" });

test("the switch is APSOHUB_SANDBOX=1 and nothing else", () => {
  assert.equal(isSandbox(env({ APSOHUB_SANDBOX: "1" })), true);
  assert.equal(isSandbox(env({ APSOHUB_SANDBOX: "true" })), false);
  assert.equal(isSandbox(env({})), false);
});

test("the sandbox may reach itself, its own database, HubSpot once a token is set, the door - Anthropic only while SANDBOX_AI=on", () => {
  const a = allowedHosts(SANDBOX_ENV);
  assert.deepEqual([...a].sort(), ["127.0.0.1", "::1", "localhost", "postgres.railway.internal"]);
  assert.equal(allowedHosts({ ...SANDBOX_ENV, HUBSPOT_TOKEN: "pat-test" }).has("api.hubapi.com"), true);
  assert.equal(allowedHosts({ ...SANDBOX_ENV, HUBSPOT_TOKEN: " " }).has("api.hubapi.com"), false);
  assert.deepEqual([...allowedHosts({ ...SANDBOX_ENV, SANDBOX_VIEWER_URL: "https://Smart-Search.example/" })].filter((h) => h.includes("smart")), ["smart-search.example"]);
  assert.equal(allowedHosts({ ...SANDBOX_ENV, SANDBOX_VIEWER_URL: "not a url" }).size, a.size, "an unreadable door lets nothing extra through");
  assert.equal(allowedHosts({ ...SANDBOX_ENV, SANDBOX_AI: "on" }).has("api.anthropic.com"), true);
  assert.equal(allowedHosts({ ...SANDBOX_ENV, SANDBOX_AI: "yes" }).has("api.anthropic.com"), false);
  assert.equal(allowedHosts(env({ PGHOST: "DB.Local" })).has("db.local"), true);
});

test("the host is read from every way Socket.connect is called", () => {
  assert.equal(targetHost([[{ host: "API.HubApi.com", port: 443 }, () => {}]]), "api.hubapi.com");
  assert.equal(targetHost([{ host: "smtp.hubspot.com", port: 587 }]), "smtp.hubspot.com");
  assert.equal(targetHost([{ port: 3000 }]), "localhost");
  assert.equal(targetHost([5432, "db.example"]), "db.example");
  assert.equal(targetHost(["443", "x.example"]), "x.example");
  assert.equal(targetHost([{ host: "[::1]", port: 80 }]), "::1");
  assert.equal(targetHost(["/tmp/.s.PGSQL.5432"]), null);
  assert.equal(targetHost([{ path: "\\\\.\\pipe\\x" }]), null);
});

test("a sandbox job can be switched on only by its name", () => {
  const known = ["mapAssign", "ticketValue", "magento"];
  assert.deepEqual(pickJobs(undefined, known), { on: [], unknown: [] });
  assert.deepEqual(pickJobs(" mapAssign, nope ,mapAssign,magento", known), { on: ["mapAssign", "magento"], unknown: ["nope"] });
});

test("a sandbox refuses the hub's own database", () => {
  assert.equal(looksLikeHubDatabase(env({ PGHOST: "apso-dev.cluster-abc.eu-central-1.rds.amazonaws.com" })), true);
  assert.equal(looksLikeHubDatabase(SANDBOX_ENV), false);
});

test("instrumentation.ts starts the hub's schedulers only outside the sandbox", () => {
  const src = readFileSync(path.resolve(process.cwd(), "src/instrumentation.ts"), "utf8");
  const gate = src.indexOf('process.env.APSOHUB_SANDBOX !== "1"');
  assert.ok(gate > 0, "the hub's block must be gated on APSOHUB_SANDBOX");
  const starts = [...src.matchAll(/\b(start\w+|install\w+)\(\)/g)];
  assert.ok(starts.length >= 20);
  for (const m of starts) {
    if (m[1] === "startSandbox") continue;
    assert.ok((m.index ?? 0) > gate, `${m[1]}() runs before the sandbox gate`);
  }
});

test("with the guard on, HubSpot without a token, SMTP and the rest are refused; the sandbox's own server still answers", async () => {
  installSandboxGuard(SANDBOX_ENV);
  installSandboxGuard(SANDBOX_ENV); // twice is harmless

  await assert.rejects(fetch("https://api.hubapi.com/crm/v3/objects/companies"), (e: unknown) => {
    const cause = (e as { cause?: { code?: string } }).cause;
    return cause?.code === SANDBOX_BLOCKED;
  });

  const smtp = await new Promise<string | undefined>((resolve) => {
    const s = net.connect({ host: "smtp.hubspot.com", port: 587 });
    s.on("connect", () => resolve("connected"));
    s.on("error", (e: NodeJS.ErrnoException) => resolve(e.code));
  });
  assert.equal(smtp, SANDBOX_BLOCKED);

  const server = http.createServer((_req, res) => res.end("ok"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const port = (server.address() as net.AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(await res.text(), "ok");
  } finally {
    server.close();
  }
});
