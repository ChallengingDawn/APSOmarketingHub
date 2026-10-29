#!/usr/bin/env node
// `npm run hs -- <method> <path> [body]` - READ HUBSPOT FROM THE TERMINAL with your own private app (HUBSPOT_TOKEN in
// .env.local), to look at real records, properties and pipelines while you build (SARCLA 29.10.2026: in the sandbox
// they can pull data). Reads only: GET, and the POSTs that search (/search) or read in batches (/batch/read) - anything
// else is refused here, whatever scopes the app has. Prints the JSON; `--out <file>` writes it instead (keep pulled
// data in .sandbox-data/, which git ignores).
//
//   npm run hs -- GET /crm/v3/objects/companies?limit=5&properties=name,domain
//   npm run hs -- POST /crm/v3/objects/tickets/search '{"limit":10,"sorts":["-createdate"]}'
//   npm run hs -- POST /crm/v3/objects/contacts/batch/read @ids.json --out .sandbox-data/contacts.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const API = (process.env.HUBSPOT_API_BASE || "https://api.hubapi.com").replace(/\/+$/, "");
const args = process.argv.slice(2);
const fail = (msg) => { console.error(`hs: ${msg}`); process.exit(1); };
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] : null;
const [methodRaw, url, bodyRaw] = args.filter((_, i) => outAt < 0 || (i !== outAt && i !== outAt + 1));

/** HubSpot calls that only read: every GET, and the POSTs that search or read in batches. */
function isRead(method, p) {
  const m = method.toUpperCase();
  if (m === "GET") return true;
  if (m !== "POST") return false;
  const pathname = new URL(p, "https://api.hubapi.com").pathname;
  return /\/search$/.test(pathname) || /\/batch\/read$/.test(pathname);
}

function token() {
  if (!existsSync(".env.local")) fail("no .env.local here - run it in your sandbox folder (see .env.example)");
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => /^\s*HUBSPOT_TOKEN\s*=/.test(l));
  const t = line?.replace(/^\s*HUBSPOT_TOKEN\s*=\s*/, "").replace(/^(["'])(.*)\1$/, "$2").trim();
  if (!t) fail("no HUBSPOT_TOKEN in .env.local - the access token of your own HubSpot private app");
  return t;
}

if (!methodRaw || !url) fail("usage: npm run hs -- GET /crm/v3/objects/companies?limit=5   (or POST .../search '<json>')");
if (!url.startsWith("/")) fail("give the path, starting with / (e.g. /crm/v3/objects/deals?limit=10)");
const method = methodRaw.toUpperCase();
if (!isRead(method, url)) fail(`${method} ${url.split("?")[0]} would change HubSpot - the sandbox only reads (GET, .../search, .../batch/read)`);
const body = bodyRaw ? (bodyRaw.startsWith("@") ? readFileSync(bodyRaw.slice(1), "utf8") : bodyRaw) : undefined;
if (body !== undefined) { try { JSON.parse(body); } catch { fail("the body is not JSON"); } }

let res;
for (let attempt = 1; attempt <= 3; attempt++) {
  res = await fetch(`${API}${url}`, {
    method, body,
    headers: { authorization: `Bearer ${token()}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  });
  if (res.status !== 429 || attempt === 3) break;
  await new Promise((r) => setTimeout(r, (Number(res.headers.get("retry-after")) || attempt) * 1000));
}
const text = await res.text();
let pretty = text;
try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON - as it came */ }
if (!res.ok) { console.error(`hs: HubSpot answered ${res.status}`); console.error(pretty.slice(0, 2000)); process.exit(1); }
if (out) {
  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeFileSync(out, pretty);
  console.log(`hs: ${method} ${url.split("?")[0]} -> ${out} (${pretty.length} characters)`);
} else console.log(pretty);
