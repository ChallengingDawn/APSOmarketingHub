// APSOconvert > THE SHOP'S FILES THROUGH THE HUB - the preview's frame takes the shop's styles, scripts, fonts and
// pictures from the hub, not from the shop (SARCLA 08.11.2026: the live preview showed a raw page in his browser while
// the same page drew fine elsewhere - something on the way blocked the shop's files inside the locked frame). The hub
// reads each file once from the shop (production or ACC), keeps it, and answers the frame itself, so the frame needs
// nothing but the hub.
//
// Who may read: the frame has an origin of its own and sends no hub cookie, so the address carries a KEY instead - an
// HMAC of the day made with the hub's session secret, written into the page by the signed-in preview route; today's
// and yesterday's keys open. What may be read: the shop's own /static/ and /media/ files, GET, nothing else - public
// files of the public shop, behind the hub's address whitelist.

import crypto from "node:crypto";
import https from "node:https";
import zlib from "node:zlib";
import { ENVS, type Env } from "./model";

/**
 * One file from the shop with Node's LENIENT parser: the shop sends large files with malformed chunk sizes, which
 * fetch stops on ("terminated" - the theme's script bundles, 08.11.2026; the same as readPage in
 * src/lib/directup/check.ts). Bytes, its type and status; gzip undone.
 */
export function shopGet(url: string, timeoutMs = 20_000, max = 6_000_000): Promise<{ status: number; type: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { insecureHTTPParser: true, headers: { "User-Agent": "APSOhub-preview", "Accept-Encoding": "gzip" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        if (!next.startsWith(ENVS.prod.base) && !next.startsWith(ENVS.acc.base)) return reject(new Error("moved off the shop"));
        return shopGet(next, timeoutMs, max).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (d: Buffer) => { size += d.length; if (size > max * 4) { req.destroy(new Error("too big")); return; } chunks.push(d); });
      res.on("error", reject);
      res.on("end", () => {
        let body = Buffer.concat(chunks);
        if (res.headers["content-encoding"] === "gzip") {
          try { body = zlib.gunzipSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch (e) { return reject(e as Error); }
        }
        resolve({ status: res.statusCode ?? 0, type: String(res.headers["content-type"] ?? "application/octet-stream"), body });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`no answer in ${timeoutMs / 1000} s`)));
    req.on("error", reject);
  });
}

const TTL_STATIC = 24 * 3600_000;
const TTL_MEDIA = 3600_000;
const MAX_FILE = 6_000_000;
const MAX_HELD = 90_000_000;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || "";
}
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The key for the shop's files on a day (today's by default). */
export function assetKey(env: Env, at = Date.now()): string {
  return crypto.createHmac("sha256", secret()).update(`apsoconvert-asset|${env}|${dayOf(at)}`).digest("base64url").slice(0, 24);
}
export function keyOk(env: Env, key: string, now = Date.now()): boolean {
  if (!secret() || !/^[\w-]{24}$/.test(key)) return false;
  const eq = (a: string) => a.length === key.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(key));
  return eq(assetKey(env, now)) || eq(assetKey(env, now - 86_400_000));
}

/** A file the hub may read for the frame: under /static/ or /media/, plain characters, no way up. */
export function assetPath(parts: string[]): string | null {
  if (!parts.length || parts.length > 20) return null;
  if (parts.some((p) => !p || p === "." || p === ".." || !/^[\w.@%+-]{1,160}$/.test(p))) return null;
  if (parts[0] !== "static" && parts[0] !== "media") return null;
  return `/${parts.join("/")}`;
}

/** The address base the frame takes the shop's files from, for one environment. */
export function assetBase(hubOrigin: string, env: Env): string {
  return `${hubOrigin}/api/website/ai-personalization/asset/${assetKey(env)}/${env}`;
}

/**
 * The shop's file addresses pointed at the hub, in a page, a stylesheet or a script: plain, and as JSON writes them
 * ("https:\/\/www..."), for production's and ACC's /static/ and /media/.
 */
// the third way a page writes an address: a JS string with unicode escapes for ":" and "/" - Magento's script loader
// takes its folder from "var require = { baseUrl: ... }" written that way (built from character codes: an escape typed
// here was once turned into the character itself by an editor)
const BS = String.fromCharCode(92);
const jsEscaped = (s: string) => s.split(":").join(`${BS}u003A`).split("/").join(`${BS}u002F`);

export function rewriteShopUrls(text: string, hubOrigin: string): string {
  let out = text;
  for (const env of ["prod", "acc"] as Env[]) {
    const shop = ENVS[env].base;
    const to = assetBase(hubOrigin, env);
    for (const dir of ["static", "media"]) {
      out = out.split(`${shop}/${dir}/`).join(`${to}/${dir}/`);
      out = out.split(jsEscaped(`${shop}/${dir}/`)).join(jsEscaped(`${to}/${dir}/`));
      out = out.split(`${shop.replace(/\//g, "\\/")}\\/${dir}\\/`).join(`${to.replace(/\//g, "\\/")}\\/${dir}\\/`);
    }
  }
  return out;
}

// Kind to the shop: a page needs ~130 files, and a cold hub (a release, a day's end) would ask for all of them at once -
// at most SIX reads at a time, the rest wait their turn; a read that fails (the network, a 5xx) is tried once more.
// Learnt 08.11.2026: the burst made some reads fail, among them Magento's ".min" resolver, and every module after it
// was asked for without ".min" (404).
const MAX_PARALLEL = 6;
let running = 0;
const queue: (() => void)[] = [];
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((go) => queue.push(go));
  running++;
  try {
    return await work();
  } finally {
    running--;
    queue.shift()?.();
  }
}
async function readOnce(url: string): Promise<{ status: number; type: string; body: Buffer }> {
  try {
    const r = await inTurn(() => shopGet(url, 25_000, MAX_FILE));
    if (r.status < 500) return r;
  } catch { /* tried again below */ }
  await new Promise((w) => setTimeout(w, 400));
  return inTurn(() => shopGet(url, 25_000, MAX_FILE));
}

type Held = { at: number; status: number; type: string; body: Buffer; size: number };
const HELD = new Map<string, Held>();
let heldBytes = 0;
const INFLIGHT = new Map<string, Promise<Held>>();

function keep(key: string, h: Held) {
  const old = HELD.get(key);
  if (old) { heldBytes -= old.size; HELD.delete(key); }
  HELD.set(key, h);
  heldBytes += h.size;
  while (heldBytes > MAX_HELD && HELD.size) {
    const first = HELD.keys().next().value as string;
    heldBytes -= HELD.get(first)!.size;
    HELD.delete(first);
  }
}

const TEXT = /^(text\/css|text\/javascript|application\/javascript|application\/x-javascript|application\/json|text\/html|image\/svg\+xml)/i;

/** One shop file, from the hub's memory or read once from the shop; text files with their shop addresses pointed here. */
export async function shopFile(env: Env, path: string, hubOrigin: string): Promise<Held> {
  const key = `${env}${path}|${hubOrigin}`;
  const held = HELD.get(key);
  const ttl = path.startsWith("/static/") ? TTL_STATIC : TTL_MEDIA;
  if (held && Date.now() - held.at < ttl) {
    // most recently used last
    HELD.delete(key);
    HELD.set(key, held);
    return held;
  }
  const running = INFLIGHT.get(key);
  if (running) return running;
  const p = (async (): Promise<Held> => {
    const r = await readOnce(`${ENVS[env].base}${path}`);
    const ok = r.status >= 200 && r.status < 300;
    let body = r.body;
    if (body.length > MAX_FILE) return { at: Date.now(), status: 413, type: "text/plain", body: Buffer.from("too big"), size: 7 };
    if (ok && TEXT.test(r.type)) body = Buffer.from(rewriteShopUrls(body.toString("utf8"), hubOrigin), "utf8");
    const h: Held = { at: Date.now(), status: r.status, type: r.type, body, size: body.length };
    if (ok) keep(key, h);
    return h;
  })().finally(() => INFLIGHT.delete(key));
  INFLIGHT.set(key, p);
  return p;
}

/**
 * Start reading a page's own files (its stylesheets, scripts, fonts, first pictures) while the page itself is on its way
 * to the browser - the frame then finds them in the hub's memory instead of waiting for each in turn (SARCLA 08.11.2026:
 * the preview sat on "Reading the page from the shop…" for a minute). The same six-at-a-time queue as the browser's own
 * asks; nothing waits for it. Returns how many files were started.
 */
export function warmFiles(html: string, hubOrigin: string, max = 80): number {
  const seen = new Set<string>();
  const re = /https:\/\/(www|acc)\.apsoparts\.com(\/(?:static|media)\/[^"'\s)<>?#]+)/g;
  for (let m = re.exec(html); m && seen.size < max; m = re.exec(html)) {
    const env: Env = m[1] === "acc" ? "acc" : "prod";
    const path = assetPath(m[2].slice(1).split("/"));
    if (!path || !/\.(css|js|woff2?|ttf|svg|png|jpe?g|webp|gif)$/i.test(path)) continue;
    const k = `${env}${path}`;
    if (seen.has(k)) continue;
    seen.add(k);
    void shopFile(env, path, hubOrigin).catch(() => undefined);
  }
  return seen.size;
}

/** The hub's own address as the browser sees it (behind the load balancer: its forwarded host and scheme). */
export function hubOriginOf(headers: Headers, fallback: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  if (!host || !/^[\w.-]+(:\d+)?$/.test(host)) return fallback;
  const scheme = proto === "https" || proto === "http" ? proto : fallback.startsWith("https") ? "https" : "http";
  return `${scheme}://${host}`;
}
