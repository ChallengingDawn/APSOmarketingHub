#!/usr/bin/env node
// `npm run door -- <service> <path>` - READ A MICROSERVICE FROM THE TERMINAL through the read-only door on the
// Smart-Search gateway, with your viewer key (sandbox-viewer.json, picked by SANDBOX_PERSON in .env.local) - SARCLA
// 29.10.2026: in the sandbox they can pull data. Services: search-bar, ads, directup, directcut, 3d; the paths are the
// reads the hub's pages make (src/lib/searchbar/gateway.ts, adsbuckets/, directup/, directcut/, threeD/calls.ts).
// Reads only - the door refuses anything else. Prints the JSON; `--out <file>` writes it instead (keep pulled data in
// .sandbox-data/, which git ignores).
//
//   npm run door -- search-bar /api/smart-bar/report?days=30
//   npm run door -- directup /usage?days=30 --out .sandbox-data/directup-usage.json
//   npm run door -- 3d /callers

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const fail = (msg) => { console.error(`door: ${msg}`); process.exit(1); };
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] : null;
const [service, p] = args.filter((_, i) => outAt < 0 || (i !== outAt && i !== outAt + 1));
if (!service || !p) fail("usage: npm run door -- <search-bar|ads|directup|directcut|3d> <path>");
if (!p.startsWith("/")) fail("give the path, starting with / (e.g. /api/smart-bar/report?days=30)");

/** The door's address and your key: .env.local's own SANDBOX_VIEWER_URL/KEY, else sandbox-viewer.json by your address. */
function door() {
  const local = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) local[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  if (local.SANDBOX_VIEWER_URL && local.SANDBOX_VIEWER_KEY) return { url: local.SANDBOX_VIEWER_URL, key: local.SANDBOX_VIEWER_KEY };
  const email = (local.SANDBOX_PERSON ?? "").split("|")[0].trim().toLowerCase();
  if (!email) fail('who are you? Put SANDBOX_PERSON="you@apsoparts.com|Your Name" in .env.local');
  if (!existsSync("sandbox-viewer.json")) fail("no sandbox-viewer.json here - run it in your sandbox folder");
  const j = JSON.parse(readFileSync("sandbox-viewer.json", "utf8"));
  if (!j.url || !j.keys?.[email]) fail(`sandbox-viewer.json has no viewer key for ${email}`);
  return { url: j.url, key: j.keys[email] };
}

const { url, key } = door();
const res = await fetch(`${url.replace(/\/+$/, "")}/viewer/${service}${p}`, { headers: { "x-viewer-key": key } });
const text = await res.text();
let pretty = text;
try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON - as it came */ }
if (!res.ok) { console.error(`door: ${res.status} - ${pretty.slice(0, 500)}`); process.exit(1); }
if (out) {
  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeFileSync(out, pretty);
  console.log(`door: ${service} ${p.split("?")[0]} -> ${out} (${pretty.length} characters)`);
} else console.log(pretty);
