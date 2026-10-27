// The way into a sandbox and its CLI, end to end against a local sandbox copy - the real scripts/sbx.mjs, let in by a
// code confirmed the way the hub's Sandbox app does it. Opt-in, the same settings as tests/sandbox-loop.test.ts; the copy
// must run with SANDBOX_PEOPLE="diana@apsoparts.example|user|Diana Test", under its path (SANDBOX_TEST_URL ends in it).
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import { SignJWT } from "jose";
import { APP_KEYS } from "../src/lib/auth/access";
import { PROXY_HEADER, signProxy } from "../src/lib/sandbox/proxy";

const URL_ = process.env.SANDBOX_TEST_URL;
const SANDBOX_DB = process.env.SANDBOX_TEST_DATABASE_URL;
const KEY = process.env.SANDBOX_TEST_LINK_KEY;
const SECRET = process.env.SANDBOX_TEST_SESSION_SECRET;
const ready = !!(URL_ && SANDBOX_DB && KEY && SECRET);
const SBX = path.resolve(process.cwd(), "scripts/sbx.mjs");
const DIANA = "diana@apsoparts.example";

test("a sandbox opens only through the hub; its CLI is let in by a code confirmed there, then asks, pulls, reviews", { skip: !ready }, async () => {
  const sb = new Client({ connectionString: SANDBOX_DB });
  await sb.connect();
  const home = mkdtempSync(path.join(tmpdir(), "sbx-home-"));
  const work = mkdtempSync(path.join(tmpdir(), "sbx-work-"));
  const { approveCli, feedOne } = await import("../src/lib/sandboxFeed/feed");
  try {
    // 1. no sign-in of its own: the password route is gone, the sign-in page points to the hub
    const pw = await fetch(`${URL_}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: DIANA, password: "x" }) });
    assert.equal(pw.status, 404, "no password sign-in on a sandbox");
    assert.match(await (await fetch(`${URL_}/signin`)).text(), /opens from the hub/);

    // 2. the browser: only what the hub forwards, signed with who is asking - for a person the sandbox names
    const base = new URL(URL_!).pathname.replace(/\/$/, "");
    const page = await fetch(URL_!, { redirect: "manual" });
    assert.ok([302, 303, 307].includes(page.status), `unsigned: sent to its sign-in (${page.status})`);
    assert.equal(new URL(page.headers.get("location")!, URL_).pathname, `${base}/signin`);
    const keySha = createHash("sha256").update(KEY!).digest("hex");
    const as = async (email: string, key = keySha) => fetch(`${URL_}/api/sandbox`, { headers: { [PROXY_HEADER]: await signProxy(email, key) } });
    assert.equal((await as("stranger@apsoparts.example")).status, 401, "a person it does not name");
    assert.equal((await as(DIANA, createHash("sha256").update("not the key").digest("hex"))).status, 401, "another key");
    const bar = await as(DIANA);
    assert.equal(bar.status, 200, "a person it names");
    assert.equal(bar.headers.get("set-cookie"), null, "and no session of its own");
    assert.equal(((await bar.json()) as { name: string | null }).name, "Diana", "its band names whose sandbox it is");
    const diana = (await sb.query(`SELECT role, awaiting_setup, must_change_password FROM apsomh_users WHERE email = $1`, [DIANA])).rows[0];
    assert.deepEqual(diana, { role: "user", awaiting_setup: false, must_change_password: false });
    assert.equal((await sb.query(`SELECT count(*)::int AS n FROM apsomh_user_app_access ua JOIN apsomh_users u ON u.id = ua.user_id
      WHERE u.email = $1 AND ua.level = 'write'`, [DIANA])).rows[0].n, APP_KEYS.length, "write on every app");

    // 3. the CLI: the real `sbx login`, confirmed the way the hub's Sandbox app does it
    assert.match(await feedOne(URL_!, KEY!, { railway: { token: "railway-cli-test-token", at: new Date().toISOString() } }), /Railway token replaced/);
    const env = { ...process.env, USERPROFILE: home, HOME: home, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@apsoparts.example",
      GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@apsoparts.example" };
    const login = spawn("node", [SBX, "login", "--url", URL_!, "--no-browser"], { env, cwd: work });
    let out = "";
    login.stdout.on("data", (d) => { out += String(d); });
    login.stderr.on("data", (d) => { out += String(d); });
    const done = new Promise<number>((r) => login.on("exit", (c) => r(c ?? 1)));
    for (let i = 0; i < 50 && !/Code: [A-Z2-9]{4}-[A-Z2-9]{4}/.test(out); i++) await new Promise((r) => setTimeout(r, 200));
    const code = /Code: ([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(out)?.[1];
    assert.ok(code, out);
    assert.match(out, new RegExp(`/sandbox\\?cli=${base.split("/").pop()}:${code}`), "it shows the hub's page to confirm on, naming this sandbox as the hub knows it");
    await assert.rejects(approveCli(URL_!, KEY!, code!, "stranger@apsoparts.example"), /does not name/);
    await assert.rejects(approveCli(URL_!, KEY!, "AAAA-BBBB", DIANA), /no such code/);
    await approveCli(URL_!, KEY!, code!, DIANA);
    assert.equal(await done, 0, out);
    assert.match(out, new RegExp(`Signed in as ${DIANA}`));
    await assert.rejects(approveCli(URL_!, KEY!, code!, DIANA), /already used|no such code/, "a code lets one terminal in, once");
    const session = JSON.parse(readFileSync(path.join(home, ".apsohub-sandbox", "session.json"), "utf8")) as { token: string };

    // a browser session never opens the CLI, and the CLI token never opens a page
    const web = await new SignJWT({ uid: 1, username: "x", role: "admin", typ: "session" }).setProtectedHeader({ alg: "HS256" })
      .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    assert.equal((await fetch(`${URL_}/api/sbx/railway`, { headers: { authorization: `Bearer ${web}` } })).status, 401);
    assert.equal((await fetch(`${URL_}/api/sandbox`, { headers: { cookie: `apsomarketinghub_session=${session.token}` } })).status, 401);

    // 4. the CLI at work
    const sbx = (args: string[], cwd = work) => spawnSync("node", [SBX, ...args], { cwd, env, encoding: "utf8" });
    assert.match(sbx(["whoami"]).stdout, new RegExp(`${DIANA} on `));
    const r = await (await fetch(`${URL_}/api/sbx/railway`, { headers: { authorization: `Bearer ${session.token}` } })).json() as { token: string; service: string; environment: string };
    assert.equal(r.token, "railway-cli-test-token");
    assert.equal(r.service, "sandbox-diana");
    assert.equal(r.environment, "a8472f7f-7ddd-4f49-8506-53246f8dab8d");
    const rv = sbx(["railway", "--version"]);
    assert.equal(rv.status, 0, rv.stderr);

    const ask = sbx(["ask", "--sql", "SELECT 1 AS one", "--reason", "a test"]);
    const id = Number(/Ask (\d+) filed/.exec(ask.stdout)?.[1]);
    assert.ok(id > 0, ask.stdout + ask.stderr);
    assert.match(sbx(["ask-status", String(id)]).stdout, new RegExp(`Ask ${id}: new`));

    // 5. pull: no code yet, then the release step's upload, then the code on branch base and a branch to work on
    assert.match(sbx(["pull"]).stderr, /No code here yet/);
    const src = mkdtempSync(path.join(tmpdir(), "sbx-src-"));
    writeFileSync(path.join(src, "README.md"), "released\n");
    const tar = spawnSync("tar", ["-czf", "-", "-C", src, "."]).stdout;
    const up = await fetch(`${URL_}/api/sandbox-link/snapshot`, { method: "POST", body: tar,
      headers: { authorization: `Bearer ${KEY}`, "x-snapshot-sha": "abc1234" } });
    assert.equal(up.status, 200, await up.text());
    const pull = sbx(["pull"]);
    assert.match(pull.stdout, /release abc1234 is on branch base/i, pull.stdout + pull.stderr);
    assert.equal(spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: work, encoding: "utf8" }).stdout.trim(), "work");
    assert.ok(existsSync(path.join(work, "README.md")));

    // 6. review: this branch against base, with the files and the patch
    writeFileSync(path.join(work, "README.md"), "released\nand changed\n");
    spawnSync("git", ["commit", "-qam", "a change"], { cwd: work, env });
    const review = sbx(["review", "--title", "A test change", "--summary", "why it matters"]);
    assert.match(review.stdout, /Review \d+ sent: 1 file/, review.stdout + review.stderr);
    const row = (await sb.query(`SELECT title, base, files, patch FROM sandbox_reviews ORDER BY id DESC LIMIT 1`)).rows[0];
    assert.equal(row.title, "A test change");
    assert.equal(row.base, "abc1234");
    assert.deepEqual(row.files, [{ path: "README.md", added: 1, removed: 0 }]);
    assert.match(row.patch, /\+and changed/);
    rmSync(src, { recursive: true, force: true });
  } finally {
    await sb.end();
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});
