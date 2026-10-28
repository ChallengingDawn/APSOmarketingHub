// A sandbox's relay and its CLI, end to end against a local relay - the real scripts/sbx.mjs, let in by a code confirmed
// the way the hub's Sandbox app does it. Opt-in, the same settings as tests/sandbox-loop.test.ts; the relay must run
// with SANDBOX_PEOPLE="diana@apsoparts.example|user|Diana Test", under its path (SANDBOX_TEST_URL ends in it).
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import { SignJWT } from "jose";
import { hubspotKey, sqlKey } from "../src/lib/sandbox/canon";

const URL_ = process.env.SANDBOX_TEST_URL;
const SANDBOX_DB = process.env.SANDBOX_TEST_DATABASE_URL;
const KEY = process.env.SANDBOX_TEST_LINK_KEY;
const SECRET = process.env.SANDBOX_TEST_SESSION_SECRET;
const ready = !!(URL_ && SANDBOX_DB && KEY && SECRET);
const SBX = path.resolve(process.cwd(), "scripts/sbx.mjs");
const DIANA = "diana@apsoparts.example";

test("a relay serves no page; its CLI is let in by a code confirmed on the hub, then pulls data, passes misses up, asks, pulls code, reviews", { skip: !ready }, async () => {
  const sb = new Client({ connectionString: SANDBOX_DB });
  await sb.connect();
  const home = mkdtempSync(path.join(tmpdir(), "sbx-home-"));
  const work = mkdtempSync(path.join(tmpdir(), "sbx-work-"));
  const { approveCli, deleteAllIn } = await import("../src/lib/sandboxFeed/feed");
  try {
    await deleteAllIn(URL_!, KEY!);

    // 1. the relay serves no page and has no sign-in of its own - the sandbox runs on the person's computer
    const base = new URL(URL_!).pathname.replace(/\/$/, "");
    for (const p of ["", "/signin", "/reporting"]) {
      const r = await fetch(`${URL_}${p}`, { redirect: "manual" });
      assert.equal(r.status, 404, `page ${p || "/"}`);
      assert.match(await r.text(), /runs on your computer/);
    }
    const pw = await fetch(`${URL_}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: DIANA, password: "x" }) });
    assert.equal(pw.status, 404, "no password sign-in on a sandbox");
    assert.equal((await fetch(`${URL_}/api/sandbox`)).status, 401, "nobody is signed in on a relay");
    assert.equal((await fetch(`${URL_}/api/health`)).status, 200);

    // 2. the CLI: the real `sbx login`, confirmed the way the hub's Sandbox app does it
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
    const session = JSON.parse(readFileSync(path.join(home, ".apsohub-sandbox", "session.json"), "utf8")) as { token: string; hub: string | null };
    assert.ok(session.hub, "it keeps the hub's address for the band");
    const cli = { authorization: `Bearer ${session.token}` };

    // a browser session never opens the CLI, the CLI token never opens a page, and nobody deploys from a sandbox
    const web = await new SignJWT({ uid: 1, username: "x", role: "admin", typ: "session" }).setProtectedHeader({ alg: "HS256" })
      .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    assert.equal((await fetch(`${URL_}/api/sbx/whoami`, { headers: { authorization: `Bearer ${web}` } })).status, 401);
    assert.equal((await fetch(`${URL_}/api/sandbox`, { headers: { cookie: `apsomarketinghub_session=${session.token}` } })).status, 401);
    assert.equal((await fetch(`${URL_}/api/sbx/railway`, { headers: cli })).status, 404, "no Railway token any more");

    const sbx = (args: string[], cwd = work) => spawnSync("node", [SBX, ...args], { cwd, env, encoding: "utf8" });
    assert.match(sbx(["whoami"]).stdout, new RegExp(`${DIANA} on `));
    assert.match(sbx(["dev"]).stderr, /pull the code first|run it in the folder you pulled/, "dev needs the code it runs");

    // 3. data: the coded answers the hub brought, copied down a page at a time, each row once, the refusals last
    const now = new Date().toISOString();
    for (let i = 0; i < 130; i++) {
      await sb.query(`INSERT INTO sandbox_replay (key, kind, request, response, brought_at) VALUES ($1, 'sql', $2, $3, $4)`,
        [`k${String(i).padStart(3, "0")}`, JSON.stringify({ text: `SELECT ${i}`, params: [] }), JSON.stringify({ rows: [{ n: i }] }), now]);
    }
    await sb.query(`INSERT INTO sandbox_misses (key, kind, request, state, note) VALUES ('refused-one', 'hs', '{}', 'refused', 'not served')`);
    const p1 = await (await fetch(`${URL_}/api/sbx/data`, { headers: cli })).json() as { rows: { key: string }[]; next: string; more: boolean; refused: unknown[] };
    assert.equal(p1.rows.length, 100);
    assert.equal(p1.more, true);
    assert.deepEqual(p1.refused, [], "the refusals come with the last page");
    const p2 = await (await fetch(`${URL_}/api/sbx/data?after=${encodeURIComponent(p1.next)}`, { headers: cli })).json() as typeof p1;
    assert.equal(p2.rows.length, 30);
    assert.equal(p2.more, false);
    assert.deepEqual(p2.refused, [{ key: "refused-one", note: "not served" }]);
    assert.equal(new Set([...p1.rows, ...p2.rows].map((r) => r.key)).size, 130, "rows written at the same time, each once");
    const p3 = await (await fetch(`${URL_}/api/sbx/data?after=${encodeURIComponent(p2.next)}`, { headers: cli })).json() as typeof p1;
    assert.equal(p3.rows.length, 0, "nothing new");
    await sb.query(`UPDATE sandbox_replay SET brought_at = now() WHERE key = 'k005'`);
    const p4 = await (await fetch(`${URL_}/api/sbx/data?after=${encodeURIComponent(p2.next)}`, { headers: cli })).json() as typeof p1;
    assert.deepEqual(p4.rows.map((r) => r.key), ["k005"], "an answer brought again is copied down again");
    assert.equal((await fetch(`${URL_}/api/sbx/data`)).status, 401, "never without the CLI's sign-in");

    // 4. misses: what the computer could not answer - reads only, keyed by the relay, not again once brought
    const hs = { method: "POST", url: "/crm/v3/objects/companies/search", body: '{"limit":2}' };
    const sql = { text: "SELECT company_id FROM erp_fixture", params: [] };
    const m = await (await fetch(`${URL_}/api/sbx/misses`, { method: "POST", headers: { ...cli, "content-type": "application/json" }, body: JSON.stringify({ misses: [
      { kind: "hs", request: hs, key: "forged" },
      { kind: "sql", request: sql },
      { kind: "hs", request: { method: "PATCH", url: "/crm/v3/objects/companies/1", body: {} } },
      { kind: "sql", request: { text: "SELECT * FROM apsomh_users", params: [] } },
    ] }) })).json() as { noted: number; skipped: number; next: string };
    assert.deepEqual([m.noted, m.skipped], [2, 2], JSON.stringify(m));
    assert.match(m.next, /Bring data/);
    const keys = (await sb.query(`SELECT key FROM sandbox_misses WHERE state = 'new' ORDER BY key`)).rows.map((r) => r.key).sort();
    assert.deepEqual(keys, [hubspotKey("POST", hs.url, hs.body), sqlKey(sql.text, [])].sort());
    await sb.query(`INSERT INTO sandbox_replay (key, kind, request, response) VALUES ($1, 'sql', '{}', '{"rows":[]}')`, [sqlKey("SELECT 6", [])]);
    const again = await (await fetch(`${URL_}/api/sbx/misses`, { method: "POST", headers: { ...cli, "content-type": "application/json" },
      body: JSON.stringify({ misses: [{ kind: "sql", request: { text: "SELECT 6", params: [] } }] }) })).json() as { noted: number };
    assert.equal(again.noted, 0, "already brought: the next copy-down carries it");

    // 5. asks
    const ask = sbx(["ask", "--sql", "SELECT 1 AS one", "--reason", "a test"]);
    const id = Number(/Ask (\d+) filed/.exec(ask.stdout)?.[1]);
    assert.ok(id > 0, ask.stdout + ask.stderr);
    assert.match(sbx(["ask-status", String(id)]).stdout, new RegExp(`Ask ${id}: new`));

    // 6. pull: no code yet, then the release step's upload, then the code on branch base and a branch to work on
    assert.match(sbx(["pull"]).stderr, /No code here yet/);
    const src = mkdtempSync(path.join(tmpdir(), "sbx-src-"));
    writeFileSync(path.join(src, "README.md"), "released\n");
    const tar = spawnSync("tar", ["-czf", "-", "-C", src, "."]).stdout;
    const up = await fetch(`${URL_}/api/sandbox-link/snapshot`, { method: "POST", body: tar,
      headers: { authorization: `Bearer ${KEY}`, "x-snapshot-sha": "abc1234" } });
    assert.equal(up.status, 200, await up.text());
    const pull = sbx(["pull"]);
    assert.match(pull.stdout, /release abc1234 is on branch base.*npm run sbx -- dev/i, pull.stdout + pull.stderr);
    assert.equal(spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: work, encoding: "utf8" }).stdout.trim(), "work");
    assert.ok(existsSync(path.join(work, "README.md")));

    // 7. review: this branch against base, with the files and the patch, and no preview to link to
    writeFileSync(path.join(work, "README.md"), "released\nand changed\n");
    spawnSync("git", ["commit", "-qam", "a change"], { cwd: work, env });
    const review = sbx(["review", "--title", "A test change", "--summary", "why it matters"]);
    assert.match(review.stdout, /Review \d+ sent: 1 file/, review.stdout + review.stderr);
    const row = (await sb.query(`SELECT title, base, files, patch, preview_url FROM sandbox_reviews ORDER BY id DESC LIMIT 1`)).rows[0];
    assert.equal(row.title, "A test change");
    assert.equal(row.base, "abc1234");
    assert.equal(row.preview_url, null);
    assert.deepEqual(row.files, [{ path: "README.md", added: 1, removed: 0 }]);
    assert.match(row.patch, /\+and changed/);
    rmSync(src, { recursive: true, force: true });
  } finally {
    await deleteAllIn(URL_!, KEY!).catch(() => {});
    await sb.end();
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});
