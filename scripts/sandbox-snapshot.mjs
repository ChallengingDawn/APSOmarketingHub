#!/usr/bin/env node
// THE CODE DIANA AND DANIEL GET - a released commit of the hub, scrubbed (SARCLA 26.10.2026: "absolutely no real data
// should appear or be stored"), for their sandbox repository on GitHub (SARCLA 28.10.2026: "another github ... we can
// copy the project there"). The release step runs it once the release is verified:
//
//   node scripts/sandbox-snapshot.mjs <sha> [--out <file.tar.gz>] [--names <file>]
//     [--publish <git url> [--branch base] [--viewer <sandbox-viewer.json>] [--title "<commit message>"]]
//
// git archive <sha> -> drop what is not the app (docs, Office and data files, .env files, the ad and geo scripts) ->
// STOP on a real secret -> replace e-mail addresses, phone numbers and customer names (any name with a legal form -
// AG, GmbH, SA, Sàrl, SpA, Ltd, Inc, BV, KG - except the placeholders below; --names adds names without one, one per
// line) -> add the sandbox kit (sandbox-kit/CLAUDE.md becomes CLAUDE.md, sandbox-kit/.env.example) -> .tar.gz.
// The report counts what was replaced and never prints a value. --publish puts it on the sandbox repository's branch
// `base` (one commit "release <sha>" holding exactly that code); the builders branch from it and send pull requests.
// --viewer adds the door's address and the builders' viewer keys as sandbox-viewer.json (SARCLA 29.10.2026: "viewer
// keys should be on repo" - the repository is private; a key only reads, and VIEWER_KEYS on the gateway retires it).

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const sha = args.find((a) => /^[0-9a-f]{7,40}$/.test(a));
if (!sha) { console.error("usage: node scripts/sandbox-snapshot.mjs <sha> [--out file.tar.gz] [--names file] [--publish <git url> [--branch base]]"); process.exit(1); }
const out = path.resolve(flag("--out") ?? `sandbox-snapshot-${sha.slice(0, 7)}.tar.gz`);
const repo = process.cwd();

// ---- what is not the app ----
// .github/: the hub's own CI (checks, the deploy to AWS) - nothing of it belongs in the sandbox repository
const DROP_DIRS = ["docs/", ".github/", "scripts/geo/", "scripts/google-ads/", "scripts/microsoft-ads/", "tests/browser/", "sandbox-kit/"];
const DROP_FILES = [/\.(pptx|ppt|xlsx|xls|csv|pdf|docx|doc|zip|7z|bak)$/i, /(^|\/)\.env[^/]*$/, /^preview-linkedin\.html$/, /^scripts\/test-aws-db\.mjs$/];
const TEXT = /\.(ts|tsx|js|mjs|cjs|jsx|json|md|css|scss|html|txt|yml|yaml|sql|py|gs|sh|svg|xml|toml|ini)$|(^|\/)(Dockerfile|Caddyfile|entrypoint\.sh)$/i;

// ---- what stops the snapshot: a real secret has no place in the code, it is fixed at the source ----
const SECRETS = [
  ["HubSpot token", /pat-(eu|na)1-[0-9a-f-]{30,}/i], ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{40,}/],
  ["AWS key", /AKIA[0-9A-Z]{16}/], ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----\s*\r?\n[A-Za-z0-9+/=]{40,}/],
  ["GitHub token", /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/], ["Slack token", /xox[abp]-[A-Za-z0-9-]{20,}/],
  ["database password", /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1|postgres\.railway\.internal)/],
];

// ---- what is replaced ----
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
// the reserved names (RFC 2606, and .internal/.local for private networks) can never be anybody's address - tests
// use them for made-up customers, and "user:pass@postgres.railway.internal" only looks like an address
const KEEP_EMAIL = /(@example\.(com|org|net)|\.(example|test|invalid|localhost|internal|local))$/i;
const PHONE = /\+(41|49|33|39|43|44|31|32|34|420)[\s0-9]{8,14}\d/g;
const LEGAL = /\b([A-ZÄÖÜ][\wÄÖÜäöüéèàç&'.-]*(?:[ -]+(?:[&+][ ]+)?[A-ZÄÖÜ][\wÄÖÜäöüéèàç&'.-]*){0,3})\s+(GmbH & Co\. KG|AG|GmbH|SA|S\.A\.|Sàrl|SARL|SàRL|Ltd\.?|S\.p\.A\.|SpA|S\.r\.l\.|Srl|BV|B\.V\.|Inc\.?|SAS|KG)\b/g;
// a placeholder word anywhere in the name ("Object Muster AG" in an error message is still Muster AG)
const PLACEHOLDER = /\b(Muster|Kunde|Kundin|ACME|Acme|Firma|Name|Example|Beispiel|Test|Demo|Sample|Zimtstern|APSOparts|APSO|Angst|Pfister)\b/;
// Our own domains carry the hub's logic (who may sign up, our own mailboxes, a reply from us is not a customer):
// they stay, and only a person in front of the @ is replaced. A role mailbox is nobody - it stays whole.
const OWN_DOMAIN = /@([a-z0-9-]+\.)*(apsoparts|angst-pfister)\.[a-z]{2,}$/i;
const ROLE = /^(info|no-?reply|support|sales|verkauf|vente|service|office|kontakt|contact|hello|helpdesk|backoffice|bo|tsa|eso|orders?|shop|webshop|marketing|hr|admin|it|billing|accounting|invoice|rechnung|news|newsletter|mail|postmaster|team|dpo|privacy|datenschutz|doc|avor|logistics|logistik|einkauf|purchasing|quality|qualitaet)$/i;
// a made-up number stays (tests use them): 123 45 67, runs of zeros, 555
const FAKE_PHONE = /123\s?45\s?67|0{4,}|00\s00|555/;
// public reference data - postcodes and their places (a German postcode can belong to a large firm, a Swiss town
// carries its canton: "Buchs AG") - is the map's, not a customer's; only addresses and secrets are checked there
const REFERENCE = [/^public\/geo\//];

// Customers named without a legal form ("the Metrohm case"): sandbox-kit/real-names.txt of the same commit (it never
// ships - sandbox-kit/ is dropped), plus any --names file. One name per line.
const listed = spawnSync("git", ["show", `${sha}:sandbox-kit/real-names.txt`], { cwd: repo, encoding: "utf8" });
const names = [listed.status === 0 ? listed.stdout : "", flag("--names") ? readFileSync(flag("--names"), "utf8") : ""]
  .join("\n").split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length >= 3);
const nameRes = names.map((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"));

const tmp = mkdtempSync(path.join(tmpdir(), "sbx-snap-"));
const counts = { files: 0, dropped: 0, emails: new Map(), phones: 0, companies: new Map(), named: 0, changedFiles: 0, testsLeft: 0 };

function walk(dir, rel = "") {
  for (const f of readdirSync(dir)) {
    const abs = path.join(dir, f), r = rel ? `${rel}/${f}` : f;
    if (statSync(abs).isDirectory()) walk(abs, r); else visit(abs, r);
  }
}

function visit(abs, rel) {
  if (DROP_DIRS.some((d) => rel.startsWith(d)) || DROP_FILES.some((re) => re.test(rel))) { rmSync(abs); counts.dropped++; return; }
  counts.files++;
  if (!TEXT.test(rel)) return;
  let s = readFileSync(abs, "utf8");
  for (const [what, re] of SECRETS) {
    const m = re.exec(s);
    if (m) {
      const line = s.slice(0, m.index).split("\n").length;
      console.error(`STOP: a ${what} in ${rel}:${line} - fix it in the hub's code first; no snapshot was made.`);
      rmSync(tmp, { recursive: true, force: true });
      process.exit(2);
    }
  }
  const before = s;
  s = s.replace(EMAIL, (e) => {
    if (KEEP_EMAIL.test(e)) return e;
    const [local, domain] = [e.slice(0, e.lastIndexOf("@")), e.slice(e.lastIndexOf("@") + 1)];
    if (OWN_DOMAIN.test(e) && ROLE.test(local)) return e;
    const k = e.toLowerCase();
    if (!counts.emails.has(k)) counts.emails.set(k, counts.emails.size + 1);
    return OWN_DOMAIN.test(e) ? `person${counts.emails.get(k)}@${domain}` : `person${counts.emails.get(k)}@example.invalid`;
  });
  if (REFERENCE.some((re) => re.test(rel))) {
    if (s !== before) { writeFileSync(abs, s); counts.changedFiles++; }
    return;
  }
  s = s.replace(PHONE, (p) => { if (FAKE_PHONE.test(p)) return p; counts.phones++; return "+41 44 000 00 00"; });
  s = s.replace(LEGAL, (whole, name, form) => {
    if (PLACEHOLDER.test(name)) return whole;
    const k = `${name} ${form}`.toLowerCase();
    if (!counts.companies.has(k)) counts.companies.set(k, counts.companies.size + 1);
    return `Kunde ${counts.companies.get(k)} ${form}`;
  });
  for (const re of nameRes) s = s.replace(re, () => { counts.named++; return "Kunde"; });
  if (s === before) return;
  // a test that had to be scrubbed carried real data and asserts on it: it stays on the hub. Every test that ships
  // is the hub's own, unchanged, and passes.
  if (rel.startsWith("tests/")) { rmSync(abs); counts.files--; counts.testsLeft++; return; }
  writeFileSync(abs, s);
  counts.changedFiles++;
}

// 1. the released commit, as it is in git (nothing uncommitted, nothing ignored)
const archive = spawnSync("git", ["archive", "--format=tar", sha], { cwd: repo, maxBuffer: 512 * 1024 * 1024 });
if (archive.status !== 0) { console.error(`git archive ${sha} failed: ${archive.stderr}`); process.exit(1); }
const untar = spawnSync("tar", ["-x", "-f", "-", "-C", tmp], { input: archive.stdout });
if (untar.status !== 0) { console.error(`tar failed: ${untar.stderr}`); process.exit(1); }

// 2. scrub, then drop the folders that are empty now (docs/, the ad scripts)
walk(tmp);
(function prune(dir) {
  for (const f of readdirSync(dir)) { const abs = path.join(dir, f); if (statSync(abs).isDirectory()) prune(abs); }
  if (dir !== tmp && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
})(tmp);

// 3. the sandbox kit, from the same commit: Claude's instructions and the settings to fill in
const KIT = [["sandbox-kit/CLAUDE.md", "CLAUDE.md"], ["sandbox-kit/.env.example", ".env.example"]];
for (const [from, to] of KIT) {
  const r = spawnSync("git", ["show", `${sha}:${from}`], { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
  if (r.status === 0) writeFileSync(path.join(tmp, to), r.stdout);
  else console.warn(`note: ${from} is not in ${sha} - the snapshot has no ${to}`);
}

// 4. check the result once more: no address but the coded ones
let left = 0;
(function recheck(dir) {
  for (const f of readdirSync(dir)) {
    const abs = path.join(dir, f);
    if (statSync(abs).isDirectory()) recheck(abs);
    else if (TEXT.test(f)) {
      for (const e of readFileSync(abs, "utf8").match(EMAIL) ?? []) {
        const local = e.slice(0, e.lastIndexOf("@"));
        if (!KEEP_EMAIL.test(e) && !(OWN_DOMAIN.test(e) && (ROLE.test(local) || /^person\d+$/.test(local)))) left++;
      }
    }
  }
})(tmp);
if (left) { console.error(`STOP: ${left} address(es) still in the scrubbed code - no snapshot was made.`); process.exit(2); }

// 5. pack - through stdout: Git Bash's GNU tar reads "C:\..." as a remote host, Windows' bsdtar does not
const pack = spawnSync("tar", ["-czf", "-", "-C", tmp, "."], { maxBuffer: 1024 * 1024 * 1024 });
rmSync(tmp, { recursive: true, force: true });
if (pack.status !== 0) { console.error(`tar -czf failed: ${pack.stderr}`); process.exit(1); }
writeFileSync(out, pack.stdout);
console.log(`Snapshot of ${sha}: ${counts.files} files (${counts.dropped} dropped), ${counts.changedFiles} scrubbed - `
  + `${counts.emails.size} e-mail addresses, ${counts.phones} phone numbers, ${counts.companies.size} company names`
  + `${counts.named ? `, ${counts.named} listed names` : ""} replaced`
  + `${counts.testsLeft ? `; ${counts.testsLeft} test files with real data left on the hub` : ""}`
  + ` -> ${out} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);

// 6. onto the sandbox repository: branch `base` becomes exactly this code, in one commit
const publish = flag("--publish");
if (publish) {
  const branch = flag("--branch") ?? "base";
  const dir = mkdtempSync(path.join(tmpdir(), "sandbox-publish-"));
  const run = (cmd, a, opts = {}) => {
    const r = spawnSync(cmd, a, { cwd: dir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts });
    if (r.status !== 0 && !opts.allowFail) { console.error(`${cmd} ${a[0]} failed: ${String(r.stderr || r.stdout).trim().slice(0, 400)}`); process.exit(1); }
    return r;
  };
  // the branch as it is, or a new one when the repository has none yet
  if (run("git", ["clone", "--quiet", "--branch", branch, "--single-branch", publish, "."], { allowFail: true }).status !== 0) {
    run("git", ["init", "--quiet", "-b", branch]);
    run("git", ["remote", "add", "origin", publish]);
  }
  for (const f of readdirSync(dir)) if (f !== ".git") rmSync(path.join(dir, f), { recursive: true, force: true });
  run("tar", ["-xzf", "-"], { input: readFileSync(out), encoding: undefined });
  if (flag("--viewer")) writeFileSync(path.join(dir, "sandbox-viewer.json"), readFileSync(path.resolve(repo, flag("--viewer"))));
  run("git", ["add", "-A"]);
  if (run("git", ["diff", "--cached", "--quiet"], { allowFail: true }).status === 0) console.log(`${branch} already holds release ${sha.slice(0, 7)}`);
  else {
    run("git", ["commit", "--quiet", "-m", flag("--title") ?? `release ${sha.slice(0, 7)}`]);
    run("git", ["push", "--quiet", "origin", `HEAD:${branch}`]);
    console.log(`${publish} ${branch}: release ${sha.slice(0, 7)}`);
  }
  rmSync(dir, { recursive: true, force: true });
  if (!args.includes("--out")) rmSync(out);
}
