#!/usr/bin/env node
// sbx - the sandbox's CLI (npm run sbx -- <command>). Talks to YOUR sandbox copy on Railway, never to the hub.
//
//   login [--url https://sandbox-you.up.railway.app]   confirm a code on the hub's Sandbox app (its sign-in); 12 hours
//   whoami                                              who is signed in, until when, on which sandbox
//   up                                                  deploy this folder to your preview (railway up, today's token)
//   railway <args...>                                   any Railway CLI command with today's sandbox-only token
//   pull                                                the hub's current release (scrubbed) onto branch "base"
//   ask --hs <METHOD> <path> [--body <json|@file>] --reason "<why>"
//   ask --sql "<SELECT ...>" [--params <json>] --reason "<why>"
//                                                       ask for data; then "Bring requested data" on the hub
//   ask-status <id> [--out <file.json>]                 the ask's state; its coded data when answered
//   review --title "<title>" --summary "<what and why>" send this branch's change (vs base) to review
//
// Railway: the token is fetched fresh for each command and handed to the `railway` CLI in RAILWAY_TOKEN - it is never
// written to disk. It only reaches the sandbox environment, and the hub replaces it every day.

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const DIR = path.join(homedir(), ".apsohub-sandbox");
const SESSION = path.join(DIR, "session.json");

function fail(msg) { console.error(`sbx: ${msg}`); process.exit(1); }
function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

function session() {
  if (!existsSync(SESSION)) fail("not signed in - run: npm run sbx -- login");
  const s = JSON.parse(readFileSync(SESSION, "utf8"));
  if (Date.parse(s.expiresAt) < Date.now()) fail("your sign-in has ended - run: npm run sbx -- login");
  return s;
}

async function call(method, route, body) {
  const s = session();
  const res = await fetch(`${s.url}/api/sbx/${route}`, {
    method, headers: { authorization: `Bearer ${s.token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (route === "pull" && res.ok) return res;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) fail(j.error ?? `the sandbox answered ${res.status}`);
  return j;
}

function git(args, opts = {}) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0 && !opts.allowFail) fail(`git ${args.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return (r.stdout ?? "").trim();
}

function railway(args) {
  return call("GET", "railway").then((r) => {
    const env = { ...process.env, RAILWAY_TOKEN: r.token };
    delete env.RAILWAY_API_TOKEN;
    const out = spawnSync("railway", args, { stdio: "inherit", env, shell: process.platform === "win32" });
    if (out.error) fail(`could not start the Railway CLI (${out.error.message}) - install it: npm i -g @railway/cli`);
    return { ...r, status: out.status ?? 1 };
  });
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "login") {
  const prev = existsSync(SESSION) ? JSON.parse(readFileSync(SESSION, "utf8")) : {};
  const url = (flag(args, "--url") ?? prev.url ?? process.env.SBX_URL ?? "").replace(/\/+$/, "");
  if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) fail("which sandbox? npm run sbx -- login --url https://<your sandbox>.up.railway.app");
  // no password here: the sandbox opens only through the hub - a code, confirmed on the hub's Sandbox app (behind the
  // hub's own sign-in and authenticator), lets this terminal in for 12 hours
  const st = await fetch(`${url}/api/sbx/login-start`, { method: "POST" });
  const c = await st.json().catch(() => ({}));
  if (!st.ok) fail(c.error ?? `the sandbox answered ${st.status}`);
  console.log(`Confirm this terminal on the hub (signed in there):

  ${c.confirmAt ?? "the hub's Sandbox app"}

Code: ${c.code} - waiting up to 10 minutes...`);
  if (c.confirmAt && !args.includes("--no-browser")) {
    const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", c.confirmAt]] : process.platform === "darwin" ? ["open", [c.confirmAt]] : ["xdg-open", [c.confirmAt]];
    spawnSync(opener[0], opener[1], { stdio: "ignore" });
  }
  let j = null;
  const until = Date.now() + 10 * 60_000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 3000));
    const pr = await fetch(`${url}/api/sbx/login-poll?poll=${encodeURIComponent(c.poll)}`).catch(() => null);
    if (!pr) continue;
    if (pr.status === 410) fail("the code ran out - run login again");
    if (pr.status === 200) { j = await pr.json(); break; }
  }
  if (!j) fail("nobody confirmed the code on the hub in 10 minutes - run login again");
  mkdirSync(DIR, { recursive: true });
  writeFileSync(SESSION, JSON.stringify({ url, token: j.token, user: j.user, expiresAt: j.expiresAt }, null, 2), { mode: 0o600 });
  try { chmodSync(SESSION, 0o600); } catch { /* Windows keeps it in your profile */ }
  console.log(`Signed in as ${j.user} on ${url} until ${new Date(j.expiresAt).toLocaleString()}.`);
} else if (cmd === "whoami") {
  const s = session();
  console.log(`${s.user} on ${s.url}, until ${new Date(s.expiresAt).toLocaleString()}`);
} else if (cmd === "railway") {
  const r = await railway(args);
  process.exit(r.status);
} else if (cmd === "up") {
  const r0 = await call("GET", "railway");
  console.log(`Deploying this folder to ${r0.service} (sandbox only)...`);
  const r = await railway(["up", "--service", r0.service, "--detach", ...args]);
  if (r.status === 0) console.log(`Sent. Watch it: npm run sbx -- railway logs --service ${r0.service}`);
  process.exit(r.status);
} else if (cmd === "ask") {
  const reason = flag(args, "--reason") ?? fail("say why: --reason \"...\"");
  let spec;
  if (args.includes("--hs")) {
    const i = args.indexOf("--hs");
    const method = args[i + 1], url = args[i + 2];
    const raw = flag(args, "--body");
    const body = raw ? JSON.parse(raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw) : null;
    spec = { kind: "hs", request: { method, url, body } };
  } else if (args.includes("--sql")) {
    spec = { kind: "sql", request: { text: flag(args, "--sql"), params: JSON.parse(flag(args, "--params") ?? "[]") } };
  } else fail("ask --hs <METHOD> <path> ... or ask --sql \"SELECT ...\"");
  const j = await call("POST", "ask", { spec, reason });
  console.log(`Ask ${j.id} filed. ${j.next}\nThen: npm run sbx -- ask-status ${j.id} --out ask-${j.id}.json`);
} else if (cmd === "ask-status") {
  const id = Number(args[0]) || fail("which ask? ask-status <id>");
  const j = await call("GET", `ask?id=${id}`);
  console.log(`Ask ${id}: ${j.state}${j.note ? ` - ${j.note}` : ""}`);
  const out = flag(args, "--out");
  if (j.data && out) { writeFileSync(out, JSON.stringify(j.data, null, 2)); console.log(`Coded data written to ${out}`); }
} else if (cmd === "review") {
  const title = flag(args, "--title") ?? fail("give it a title: --title \"...\"");
  const summary = flag(args, "--summary") ?? "";
  if (!git(["rev-parse", "--verify", "--quiet", "base"], { allowFail: true })) fail("no base branch - run: npm run sbx -- pull");
  const base = (/release (\w+)/.exec(git(["log", "-1", "--format=%s", "base"])) ?? [])[1] ?? null;
  const patch = git(["diff", "base...HEAD"]);
  if (!patch) fail("nothing to review - this branch has no change against base (commit your work first)");
  const files = git(["diff", "--numstat", "base...HEAD"]).split("\n").filter(Boolean).map((l) => {
    const [a, d, p] = l.split("\t"); return { path: p, added: Number(a) || 0, removed: Number(d) || 0 };
  });
  const j = await call("POST", "review", { title, summary, base, files, patch, preview_url: session().url });
  console.log(`Review ${j.id} sent: ${files.length} file(s). ${j.next}`);
} else if (cmd === "pull") {
  if (git(["status", "--porcelain"], { allowFail: true })) fail("commit or stash your work first - pull switches branches");
  const res = await call("GET", "pull");
  const sha = res.headers.get("x-snapshot-sha");
  const tar = Buffer.from(await res.arrayBuffer());
  const fresh = !existsSync(".git");
  if (fresh) git(["init", "-q", "-b", "base"]);
  const back = fresh ? "work" : git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!fresh) {
    if (git(["rev-parse", "--verify", "--quiet", "base"], { allowFail: true })) git(["checkout", "-q", "base"]);
    else git(["checkout", "-q", "--orphan", "base"]);
    git(["rm", "-r", "-q", "--ignore-unmatch", "."]);
  }
  // through stdin: Git Bash's GNU tar reads "C:\..." as a remote host, Windows' bsdtar does not
  const t = spawnSync("tar", ["-xzf", "-"], { input: tar, stdio: ["pipe", "inherit", "inherit"] });
  if (t.status !== 0) fail("could not unpack the code (tar)");
  git(["add", "-A"]);
  git(["commit", "-q", "--allow-empty", "-m", `release ${sha}`]);
  if (fresh) git(["checkout", "-q", "-b", "work"]);
  else git(["checkout", "-q", back === "base" ? "-" : back], { allowFail: true });
  console.log(fresh
    ? `The hub's release ${sha} is on branch base; you are on branch work. Next: npm install`
    : `Release ${sha} is on branch base. Bring it into your work: git merge base`);
} else {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
  console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
}
