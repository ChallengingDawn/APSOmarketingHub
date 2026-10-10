// THE ERP's SFTP FOLDER - the Data Transit Gateway on b2b.angst-pfister.com, read as the
// consumer account (hubspotacc-hub). Ported from the Compass connector's
// service/sftp_pull.py (pull, _normalize, the manifest, the key and the host-key pin;
// the chain that processes the files is not here).
//
// The host key is PINNED: ssh2 hands the server's key to hostVerifier before anything is
// authenticated, and a key whose SHA256 fingerprint is not SFTP_FINGERPRINT (default: the
// connector's pin) ends the connection - our key is never offered to a server we have not
// recognised. Files land as dest/<canonical>.part and are renamed only when complete.
//
// Env: SFTP_HOST (b2b.angst-pfister.com)  SFTP_PORT (22)  SFTP_USER (hubspotacc-hub)
//      SFTP_KEY (OpenSSH private key text)  SFTP_KEY_PASSPHRASE
//      SFTP_FINGERPRINT (SHA256 of the host key, base64)  SFTP_REMOTE_DIR (/Hubspot/delta_load)

import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import { utils as sshUtils } from "ssh2";
import { kvGet, kvSet } from "@/lib/db/init";
import { fingerprintOf, keyInfo, keyText, megabytes, pinOf, planPull, type Manifest, type RemoteEntry } from "./steps/filesRules";

const KV_MANIFEST = "connectors:hub:sftp-manifest";
const KV_LAST = "connectors:hub:sftp-last";

export type Pulled = { remote: string; as: string; mb: number };
export type PullReport = {
  pulled: Pulled[];
  /** Unchanged since the last pull (same size and mtime). */
  skipped: number;
  /** remote name -> the canonical name it was saved under. */
  renamed: Record<string, string>;
  ts: number;
  error?: string;
  /** Listed only - nothing downloaded, the manifest untouched. */
  dry?: boolean;
  /** Folders in the remote directory (the layout is flat; they are never entered). */
  folders?: number;
  /** Downloaded with a size other than the listing's - still being written; left for the next pull. */
  incomplete?: string[];
  /** With `defer`: the manifest to save once the files are processed (commitManifest). */
  manifest?: Manifest;
};

type Cfg = { host: string; port: number; username: string; remoteDir: string; pin: string; key: string; passphrase?: string };

/** The connection settings, or why there are none. Never carries the key anywhere but into ssh2. */
function config(): { cfg: Cfg } | { error: string } {
  const env = process.env;
  const raw = env.SFTP_KEY ?? "";
  if (!raw.trim()) return { error: "SFTP_KEY not configured" };
  const k = keyText(raw);
  if (!k.ok) return { error: k.error };
  const passphrase = env.SFTP_KEY_PASSPHRASE || undefined;
  const parsed = sshUtils.parseKey(k.text, passphrase);
  const bad = parsed instanceof Error ? parsed : Array.isArray(parsed) && parsed[0] instanceof Error ? (parsed[0] as Error) : null;
  if (bad) return { error: `SFTP_KEY could not be parsed: ${bad.message}`.slice(0, 200) };
  return {
    cfg: {
      host: env.SFTP_HOST || "b2b.angst-pfister.com",
      port: Number(env.SFTP_PORT || "22"),
      username: env.SFTP_USER || "hubspotacc-hub",
      remoteDir: env.SFTP_REMOTE_DIR || "/Hubspot/delta_load",
      pin: pinOf(env.SFTP_FINGERPRINT),
      key: k.text,
      passphrase,
    },
  };
}

/** The key's format, for the page - never a character of the key. */
export function sftpKeyInfo(): Record<string, unknown> {
  return keyInfo(process.env.SFTP_KEY ?? "", !!process.env.SFTP_KEY_PASSPHRASE);
}

async function connect(cfg: Cfg): Promise<SftpClient> {
  const client = new SftpClient("compass-files");
  let seen: string | null = null;
  try {
    await client.connect({
      host: cfg.host, port: cfg.port, username: cfg.username,
      privateKey: cfg.key, passphrase: cfg.passphrase,
      readyTimeout: 30_000,
      retries: 0, // a refused host key is not worth a second try 25 s later
      hostVerifier: (key: Buffer) => {
        seen = fingerprintOf(key);
        return !!cfg.pin && seen === cfg.pin;
      },
    });
  } catch (e) {
    await client.end().catch(() => {});
    if (seen !== null && seen !== cfg.pin) throw new Error(`HOST KEY MISMATCH: got SHA256:${seen} - refusing (possible MITM)`);
    throw e;
  }
  return client;
}

const entry = (f: { type: string; name: string; size: number; modifyTime: number }): RemoteEntry => ({
  name: f.name, size: Number(f.size) || 0, mtime: Math.round((Number(f.modifyTime) || 0) / 1000), type: f.type,
});

/** Read-only listing of a remote directory (nothing is downloaded): folders first, then by name. */
export async function listRemote(dir?: string): Promise<{ dir: string; entries?: { name: string; size: number; mtime: number; dir: boolean }[]; error?: string }> {
  const c = config();
  const d = dir || ("cfg" in c ? c.cfg.remoteDir : process.env.SFTP_REMOTE_DIR || "/Hubspot/delta_load");
  if ("error" in c) return { dir: d, error: c.error };
  let client: SftpClient | null = null;
  try {
    client = await connect(c.cfg);
    const out = (await client.list(d)).map(entry).map((e) => ({ name: e.name, size: e.size, mtime: e.mtime, dir: e.type === "d" }));
    out.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return { dir: d, entries: out };
  } catch (e) {
    return { dir: d, error: String((e as Error).message ?? e).slice(0, 300) };
  } finally {
    await client?.end().catch(() => {});
  }
}

/** One file to dest/<name>.part; true when the bytes on disk match the listed size. */
async function download(client: SftpClient, remote: string, tmp: string, size: number): Promise<boolean> {
  const out = createWriteStream(tmp);
  const closed = once(out, "close");
  try {
    await client.get(remote, out);
    await closed;
  } catch (e) {
    out.destroy();
    await closed.catch(() => {});
    await unlink(tmp).catch(() => {});
    throw e;
  }
  if ((await stat(tmp)).size === size) return true;
  await unlink(tmp).catch(() => {});
  return false;
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Download what is new or changed in SFTP_REMOTE_DIR into `dest`. One pull at a time in
 * this process. The manifest ({remote: [size, mtime]}) is saved only when the whole
 * listing went through; a file that fails stops the pull and is fetched again next time.
 * `defer`: the manifest is NOT saved but returned, for the caller to commit once the files
 * are processed - the files sit on this copy's temporary disk, and a copy that restarts
 * mid-run (out of memory) loses them; a saved manifest would then skip the delivery.
 */
export function pullDelta(opts: { dest: string; dry?: boolean; defer?: boolean }): Promise<PullReport> {
  const run = chain.then(() => pullOnce(opts));
  chain = run.catch(() => {});
  return run;
}

/**
 * The latest files, whatever the manifest says, into `dest` - for a PREVIEW of the file
 * steps. The manifest and the last-pull record are left alone, so a preview can never
 * make the real chain skip a delivery.
 */
export function fetchLatest(dest: string): Promise<PullReport> {
  const run = chain.then(() => pullOnce({ dest, ignoreManifest: true }));
  chain = run.catch(() => {});
  return run;
}

/** Save the manifest a deferred pull returned - after its files were processed. */
export async function commitManifest(m: Manifest): Promise<void> {
  await kvSet(KV_MANIFEST, m);
}

async function pullOnce({ dest, dry = false, ignoreManifest = false, defer = false }: { dest: string; dry?: boolean; ignoreManifest?: boolean; defer?: boolean }): Promise<PullReport> {
  const rep: PullReport = { pulled: [], skipped: 0, renamed: {}, ts: Math.floor(Date.now() / 1000), ...(dry ? { dry: true } : {}) };
  const c = config();
  if ("error" in c) return { ...rep, error: c.error };
  const cfg = c.cfg;
  let client: SftpClient | null = null;
  try {
    const manifest: Manifest = ignoreManifest ? {} : (await kvGet<Manifest>(KV_MANIFEST)) ?? {};
    if (!dry) await mkdir(dest, { recursive: true });
    client = await connect(cfg);
    const plan = planPull((await client.list(cfg.remoteDir)).map(entry), manifest);
    rep.skipped = plan.skipped;
    if (plan.folders) rep.folders = plan.folders;
    for (const f of plan.todo) {
      if (!dry) {
        const dst = path.join(dest, f.as);
        const tmp = `${dst}.part`;
        if (!(await download(client, `${cfg.remoteDir}/${f.remote}`, tmp, f.size))) {
          (rep.incomplete ??= []).push(f.remote);
          continue;
        }
        await rename(tmp, dst);
        manifest[f.remote] = [f.size, f.mtime];
      }
      rep.pulled.push({ remote: f.remote, as: f.as, mb: megabytes(f.size) });
      if (f.as !== f.remote) rep.renamed[f.remote] = f.as;
    }
    if (!dry && !ignoreManifest) {
      if (defer) rep.manifest = manifest;
      else await kvSet(KV_MANIFEST, manifest);
    }
  } catch (e) {
    rep.error = String((e as Error).message ?? e).slice(0, 300);
  } finally {
    await client?.end().catch(() => {});
  }
  if (!ignoreManifest) await kvSet(KV_LAST, { last: rep, host: cfg.host, dir: cfg.remoteDir }).catch(() => {});
  return rep;
}

/** The last pull's report, for the page. */
export async function lastPull(): Promise<{ last: PullReport; host: string; dir: string } | null> {
  return (await kvGet<{ last: PullReport; host: string; dir: string }>(KV_LAST)) ?? null;
}
