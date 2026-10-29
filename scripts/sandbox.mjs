#!/usr/bin/env node
// `npm run sandbox` - THE SANDBOX ON YOUR COMPUTER (SARCLA 28.10.2026: the code in a GitHub of its own, run on
// localhost; HubSpot through your own private app; the microservices through a read-only door on the Smart-Search
// gateway).
//
// One terminal, until Ctrl+C:
//  1. its own database: PGlite - Postgres inside this process, kept in your profile (~/.apsohub-sandbox/db) - served on
//     127.0.0.1 for the app; nothing to install;
//  2. the app: `next dev` on http://localhost:3000 (--port for another), for this computer only, as the sandbox - no
//     job runs, and it connects to nothing but its database, HubSpot (reads only - writes are held back) and the door.
//
// Your settings live in .env.local (see .env.example): HUBSPOT_TOKEN, SANDBOX_VIEWER_URL, SANDBOX_VIEWER_KEY and
// SANDBOX_PERSON ("you@apsoparts.com|Your Name" - else your git name and address). Next reads that file itself; of this
// terminal's own environment, nothing that looks like a key reaches the app.

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

const DIR = path.join(homedir(), ".apsohub-sandbox");
const args = process.argv.slice(2);
const fail = (msg) => { console.error(`sandbox: ${msg}`); process.exit(1); };
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

/** KEY=VALUE lines of .env.local - only to find who you are; Next loads the file for the app itself. */
function envLocal() {
  if (!existsSync(".env.local")) return {};
  const out = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

function git(...a) {
  try { return execFileSync("git", a, { encoding: "utf8" }).trim(); } catch { return ""; }
}

/** This computer's own session key for its sandbox - made once, kept in your profile, never sent anywhere. */
function sessionSecret() {
  const file = path.join(DIR, "local.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).sessionSecret;
  const k = { sessionSecret: randomBytes(32).toString("base64url") };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(k, null, 2), { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows keeps it in your profile */ }
  return k.sessionSecret;
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

// what the app is never handed from your terminal: anything that looks like a key, and the hub's own settings
const NOT_FOR_THE_APP = /(token|secret|password|passwd|api_?key|private|credential|database_url|^pg[a-z]*$|^aws_|hubspot|magento|smtp|^sandbox_|^next_public_)/i;

if (!existsSync("package.json") || !existsSync(path.join("node_modules", "next"))) fail("run it in your sandbox folder, after npm install");
const port = Number(flag("--port") ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("--port takes a number from 1024 to 65535");
if (!(await portFree(port))) fail(`port ${port} is taken - npm run sandbox -- --port ${port + 1}`);

const local = envLocal();
const [email, name] = (local.SANDBOX_PERSON ?? process.env.SANDBOX_PERSON ?? `${git("config", "user.email")}|${git("config", "user.name")}`)
  .split("|").map((x) => x.trim());
if (!email || !/@/.test(email)) fail('who are you? Put SANDBOX_PERSON="you@apsoparts.com|Your Name" in .env.local');

// 1. the database
const dataDir = path.join(DIR, "db");
mkdirSync(dataDir, { recursive: true });
const { PGlite } = await import("@electric-sql/pglite");
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const db = await PGlite.create(dataDir);
const pgPort = await freePort();
const pg = new PGLiteSocketServer({ db, host: "127.0.0.1", port: pgPort, maxConnections: 50 });
await pg.start();

// 2. the app
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !NOT_FOR_THE_APP.test(k)));
for (const k of ["SANDBOX_AI", "SANDBOX_JOBS"]) if (process.env[k]) env[k] = process.env[k];
Object.assign(env, {
  APSOHUB_SANDBOX: "1", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: `postgres://postgres@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
  SESSION_SECRET: sessionSecret(),
  // an admin in their own sandbox: they build admin pages too, and nothing pressed here changes anything real
  SANDBOX_PEOPLE: `${email}|admin|${(name || email.split("@")[0]).replace(/[|;]/g, " ")}`,
});
const next = path.join("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", String(port)], { env, stdio: "inherit" });

let stopping = false;
const stop = async (code) => {
  if (stopping) return;
  stopping = true;
  try { child.kill(); } catch { /* already gone */ }
  await pg.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
child.on("exit", (c) => stop(c ?? 0));

console.log(`\nsandbox: starting on http://localhost:${port} for ${email} - the first page takes a minute to compile.`);
let up = false;
for (let i = 0; i < 240 && !up; i++) {
  up = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false);
  if (!up) await new Promise((r) => setTimeout(r, 1000));
}
if (!up) { console.error("sandbox: it did not start in 4 minutes"); await stop(1); }
console.log(`sandbox: open on http://localhost:${port}${local.HUBSPOT_TOKEN ? "" : " - no HUBSPOT_TOKEN in .env.local yet, HubSpot pages stay empty"}${local.SANDBOX_VIEWER_KEY ? "" : " - no door to the microservices yet"}. Ctrl+C stops it.`);
if (!args.includes("--no-browser")) {
  const url = `http://localhost:${port}`;
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}
