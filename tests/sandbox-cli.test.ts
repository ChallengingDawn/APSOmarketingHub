// The CLI and the new-person path, end to end against a local sandbox copy - the real scripts/sbx.mjs, a real TOTP
// code. Opt-in, the same settings as tests/sandbox-loop.test.ts; the copy must run with
//   SANDBOX_PEOPLE="diana@apsoparts.example|user|Diana Test"  SANDBOX_PUBLIC_URL=<its own URL>
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { Secret, TOTP } from "otpauth";

const URL_ = process.env.SANDBOX_TEST_URL;
const SANDBOX_DB = process.env.SANDBOX_TEST_DATABASE_URL;
const KEY = process.env.SANDBOX_TEST_LINK_KEY;
const SECRET = process.env.SANDBOX_TEST_SESSION_SECRET;
const ready = !!(URL_ && SANDBOX_DB && KEY && SECRET);
const SBX = path.resolve(process.cwd(), "scripts/sbx.mjs");

test("a new person gets a mailed link; the CLI signs in with TOTP, asks, reviews, pulls", { skip: !ready }, async () => {
  const sb = new Client({ connectionString: SANDBOX_DB });
  await sb.connect();
  const home = mkdtempSync(path.join(tmpdir(), "sbx-home-"));
  const work = mkdtempSync(path.join(tmpdir(), "sbx-work-"));
  try {
    // 1. the copy created its person at boot and parked the link; the hub mails it, and it is gone from the sandbox
    const parked = await sb.query(`SELECT v FROM sandbox_cli WHERE k LIKE 'invite-mail:%'`);
    assert.equal(parked.rowCount, 1, "one link parked for the person in SANDBOX_PEOPLE");
    const { feedOne } = await import("../src/lib/sandboxFeed/feed");
    const mails: { email: string; url: string }[] = [];
    const line = await feedOne(URL_!, KEY!, {
      railway: { token: "railway-cli-test-token", at: new Date().toISOString() },
      sendInvite: async (i) => { mails.push({ email: i.email, url: i.url }); },
    });
    assert.match(line, /1 sign-up link mailed/, line);
    assert.equal(mails[0].email, "diana@apsoparts.example");
    assert.match(mails[0].url, /\/invite\/[A-Za-z0-9_-]{20,}$/);
    assert.equal((await sb.query(`SELECT 1 FROM sandbox_cli WHERE k LIKE 'invite-mail:%'`)).rowCount, 0, "the link is dropped once mailed");
    assert.equal((await fetch(mails[0].url)).status, 200, "the link opens the set-up page");
    const diana = (await sb.query(`SELECT awaiting_setup, role FROM apsomh_users WHERE email = 'diana@apsoparts.example'`)).rows[0];
    assert.deepEqual(diana, { awaiting_setup: true, role: "user" });
    assert.equal((await sb.query(`SELECT count(*)::int AS n FROM apsomh_user_app_access ua JOIN apsomh_users u ON u.id = ua.user_id
      WHERE u.email = 'diana@apsoparts.example' AND ua.level = 'write'`)).rows[0].n, 7, "write on every app");

    // 2. a person who has set up: password + TOTP on the CLI
    const secret = new Secret({ size: 20 });
    await sb.query(`DELETE FROM apsomh_users WHERE username = 'cli-tester'`);
    await sb.query(`INSERT INTO apsomh_users (username, email, full_name, password_hash, totp_secret, totp_enrolled, role, must_change_password)
      VALUES ('cli-tester', 'cli@apsoparts.example', 'CLI Tester', $1, $2, true, 'user', false)`, [bcrypt.hashSync("Correct-Horse-9", 4), secret.base32]);
    const login = (code: string, password = "Correct-Horse-9") => fetch(`${URL_}/api/sbx/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "cli@apsoparts.example", password, code }) });
    assert.equal((await login("000000")).status, 401, "a wrong code is refused");
    assert.equal((await login(new TOTP({ secret, digits: 6, period: 30 }).generate(), "wrong")).status, 401, "a wrong password is refused");
    const ok = await login(new TOTP({ secret, digits: 6, period: 30 }).generate());
    assert.equal(ok.status, 200);
    const session = (await ok.json()) as { token: string; user: string; expiresAt: string };

    // a browser session never opens the CLI, and the CLI token never opens a page
    const web = await new SignJWT({ uid: 1, username: "x", role: "admin", typ: "session" }).setProtectedHeader({ alg: "HS256" })
      .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    assert.equal((await fetch(`${URL_}/api/sbx/railway`, { headers: { authorization: `Bearer ${web}` } })).status, 401);
    assert.equal((await fetch(`${URL_}/api/sandbox`, { headers: { cookie: `apsomarketinghub_session=${session.token}` } })).status, 401);

    // 3. the real CLI, with the session where it keeps it
    mkdirSync(path.join(home, ".apsohub-sandbox"), { recursive: true });
    writeFileSync(path.join(home, ".apsohub-sandbox", "session.json"), JSON.stringify({ url: URL_, ...session }));
    const env = { ...process.env, USERPROFILE: home, HOME: home, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@apsoparts.example",
      GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@apsoparts.example" };
    const sbx = (args: string[], cwd = work) => spawnSync("node", [SBX, ...args], { cwd, env, encoding: "utf8" });

    assert.match(sbx(["whoami"]).stdout, /cli-tester on /);
    const r = await (await fetch(`${URL_}/api/sbx/railway`, { headers: { authorization: `Bearer ${session.token}` } })).json() as { token: string; service: string; environment: string };
    assert.equal(r.token, "railway-cli-test-token");
    assert.equal(r.service, "sandbox-cli-tester");
    assert.equal(r.environment, "a8472f7f-7ddd-4f49-8506-53246f8dab8d");
    const rv = sbx(["railway", "--version"]);
    assert.equal(rv.status, 0, rv.stderr);

    const ask = sbx(["ask", "--sql", "SELECT 1 AS one", "--reason", "a test"]);
    const id = Number(/Ask (\d+) filed/.exec(ask.stdout)?.[1]);
    assert.ok(id > 0, ask.stdout + ask.stderr);
    assert.match(sbx(["ask-status", String(id)]).stdout, new RegExp(`Ask ${id}: new`));

    // 4. pull: no code yet, then the release step's upload, then the code on branch base and a branch to work on
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

    // 5. review: this branch against base, with the files and the patch
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
