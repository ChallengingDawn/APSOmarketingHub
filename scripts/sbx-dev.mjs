// `npm run sbx -- dev` - THE SANDBOX ON YOUR COMPUTER (SARCLA 28.10.2026: "put the repo so they can see it in localhost
// and having just a port to bring data" - the data outside, on Railway, pulled down to localhost).
//
// One terminal, three things:
//  1. its own database: PGlite - Postgres inside this process, kept in your profile (~/.apsohub-sandbox/<sandbox>/db) -
//     served on 127.0.0.1 for the app; nothing to install;
//  2. the app: `next dev` on http://localhost:3000, for this computer only, as the sandbox - no job runs, it connects to
//     nothing but its own database, and every HubSpot or database read is answered from what the hub brought;
//  3. every 20 seconds, its one way out - your relay on Railway, with your CLI sign-in: what the hub brought since the
//     last time is copied down into the app, and what the app's pages could not answer goes up, to wait on the hub's
//     Sandbox app until somebody presses Bring data there.
//
// syncOnce is the third part on its own (tests/sandbox-cli.test.ts runs it against a relay and a sandbox).

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

const EVERY_MS = 20_000;
const DIR = path.join(homedir(), ".apsohub-sandbox");

async function http(url, init = {}) {
  const res = await fetch(url, init);
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => ({})) };
}

const signedOut = () => Object.assign(new Error("your sign-in has ended - run: npm run sbx -- login (the sandbox keeps what it has)"), { signedOut: true });

/**
 * One exchange with the relay. `state` carries from round to round: `after` (how far the copy-down got), `sent` (the
 * reads already passed up) and `refused` (the refusals already copied down). Returns what moved, for the terminal.
 */
export async function syncOnce({ relay, token, app, localKey, state }) {
  const toRelay = { authorization: `Bearer ${token}` };
  const toApp = { authorization: `Bearer ${localKey}`, "content-type": "application/json" };
  const here = await http(`${app}/api/sandbox-link/feed`, { headers: toApp });
  if (!here.ok) throw new Error(`the sandbox on this computer answered ${here.status}`);
  // Delete all on this computer emptied what was copied down: copy it all down again
  if (state.after && Number(here.body.state?.brought ?? 0) === 0) { state.after = null; state.refused.clear(); }

  // down: what the hub brought since the last round
  let brought = 0, refused = 0;
  for (let page = 0; page < 500; page++) {
    const d = await http(`${relay}/api/sbx/data${state.after ? `?after=${encodeURIComponent(state.after)}` : ""}`, { headers: toRelay });
    if (d.status === 401) throw signedOut();
    if (!d.ok) throw new Error(d.body.error ?? `the relay answered ${d.status}`);
    const rows = d.body.rows ?? [];
    const fresh = (d.body.refused ?? []).filter((r) => !state.refused.has(r.key));
    if (rows.length || fresh.length) {
      const put = await http(`${app}/api/sandbox-link/feed`, { method: "POST", headers: toApp, body: JSON.stringify({ answers: rows, refused: fresh }) });
      if (!put.ok) throw new Error(`the sandbox on this computer refused the data: ${put.body.error ?? put.status}`);
      brought += rows.length;
      refused += fresh.length;
      for (const r of fresh) state.refused.add(r.key);
    }
    state.after = d.body.next ?? state.after;
    if (!d.body.more) break;
  }

  // up: what this computer's pages could not answer, each read once - it waits on the hub's Sandbox app
  const waiting = (here.body.misses ?? []).filter((m) => !state.sent.has(m.key));
  let noted = 0;
  if (waiting.length) {
    const m = await http(`${relay}/api/sbx/misses`, { method: "POST", headers: { ...toRelay, "content-type": "application/json" },
      body: JSON.stringify({ misses: waiting.map(({ kind, request }) => ({ kind, request })) }) });
    if (m.status === 401) throw signedOut();
    if (!m.ok) throw new Error(m.body.error ?? `the relay answered ${m.status}`);
    for (const x of waiting) state.sent.add(x.key);
    noted = Number(m.body.noted ?? 0);
  }
  return { brought, refused, noted };
}

/** This computer's own keys for its sandbox - made once, kept in your profile, never sent anywhere. */
function localKeys() {
  const file = path.join(DIR, "local.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const k = { sessionSecret: randomBytes(32).toString("base64url"), linkKey: randomBytes(32).toString("base64url") };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(k, null, 2), { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows keeps it in your profile */ }
  return k;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}

// what the app is never handed from your terminal: anything that looks like a credential, and the hub's own settings
const NOT_FOR_THE_APP = /(token|secret|password|passwd|api_?key|private|credential|database_url|^pg[a-z]*$|^aws_|hubspot|magento|smtp|^sandbox_|^next_public_)/i;

/** The sandbox on this computer, until Ctrl+C. `session()` is the CLI's sign-in, read again every round. */
export async function startDev({ session, port = 3000, openBrowser = true }) {
  if (!existsSync("package.json") || !existsSync(path.join("node_modules", "next"))) {
    throw new Error("run it in the folder you pulled, after npm install");
  }
  const s0 = session();
  const who = await http(`${s0.url}/api/sbx/whoami`, { headers: { authorization: `Bearer ${s0.token}` } });
  if (who.status === 401) throw new Error("your sign-in has ended - run: npm run sbx -- login");
  if (!who.ok) throw new Error(who.body.error ?? `your relay answered ${who.status}`);
  if (!(await portFree(port))) throw new Error(`port ${port} is taken - npm run sbx -- dev --port ${port + 1}`);

  const keys = localKeys();
  const name = new URL(s0.url).pathname.split("/").filter(Boolean).pop() ?? new URL(s0.url).hostname.split(".")[0];
  const dataDir = path.join(DIR, name, "db");
  mkdirSync(dataDir, { recursive: true });

  // 1. the database
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const db = await PGlite.create(dataDir);
  const pgPort = await freePort();
  const pg = new PGLiteSocketServer({ db, host: "127.0.0.1", port: pgPort, maxConnections: 50 });
  await pg.start();

  // 2. the app
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !NOT_FOR_THE_APP.test(k)));
  for (const k of ["SANDBOX_AI", "SANDBOX_JOBS"]) if (process.env[k]) env[k] = process.env[k];
  if (process.env.SANDBOX_AI === "on" && process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  Object.assign(env, {
    APSOHUB_SANDBOX: "1", SANDBOX_LOCAL: "1", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: `postgres://postgres@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
    SESSION_SECRET: keys.sessionSecret,
    SANDBOX_LINK_KEY_SHA256: createHash("sha256").update(keys.linkKey).digest("hex"),
    SANDBOX_PEOPLE: `${who.body.email}|user|${String(who.body.name ?? "").replace(/[|;]/g, " ")}`,
    HUBSPOT_TOKEN: "sandbox-replay",
    ...(who.body.hub ? { SANDBOX_HUB_URL: who.body.hub } : {}),
  });
  const next = path.join("node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", String(port)], { env, stdio: "inherit" });

  let timer = null, stopping = false;
  const stop = async (code) => {
    if (stopping) return;
    stopping = true;
    if (timer) clearInterval(timer);
    try { child.kill(); } catch { /* already gone */ }
    await pg.stop().catch(() => {});
    await db.close().catch(() => {});
    process.exit(code);
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  child.on("exit", (c) => stop(c ?? 0));

  const app = `http://127.0.0.1:${port}`;
  console.log(`\nsbx: starting the sandbox on http://localhost:${port} - the first page takes a minute to compile.`);
  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    up = await fetch(`${app}/api/health`).then((r) => r.ok, () => false);
    if (!up) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) { console.error("sbx: the sandbox did not start in 4 minutes"); return stop(1); }

  // 3. the one way out
  const state = { after: null, sent: new Set(), refused: new Set() };
  let saidSignedOut = false;
  const round = async () => {
    try {
      const s = session();
      const r = await syncOnce({ relay: s.url, token: s.token, app, localKey: keys.linkKey, state });
      saidSignedOut = false;
      if (r.brought) console.log(`sbx: ${r.brought} read${r.brought === 1 ? "" : "s"} copied down from the hub`);
      if (r.refused) console.log(`sbx: ${r.refused} read${r.refused === 1 ? "" : "s"} refused by the hub (the band says why)`);
      if (r.noted) console.log(`sbx: ${r.noted} read${r.noted === 1 ? "" : "s"} waiting - bring them on the hub: ${who.body.hub ? `${who.body.hub}/sandbox` : "its Sandbox app"}`);
    } catch (e) {
      if (!(e.signedOut && saidSignedOut)) console.error(`sbx: ${e.message}`);
      if (e.signedOut) saidSignedOut = true;
    }
  };
  await round();
  timer = setInterval(round, EVERY_MS);
  console.log(`sbx: the sandbox is open on http://localhost:${port} - its data comes from ${s0.url} every ${EVERY_MS / 1000} s. Ctrl+C stops it.`);
  if (openBrowser) {
    const url = `http://localhost:${port}`;
    const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
}
