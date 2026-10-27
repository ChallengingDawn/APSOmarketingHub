// A SANDBOX IS SERVED BY THE HUB (SARCLA 27.10.2026: "it should be hosted on the hub, only using Railway as a relay for
// the CLI"). People open it at the hub's own address - /sandbox/run/<name>/... - behind the hub's sign-in and TOTP; the
// hub fetches each request from the Railway copy, which runs under the SAME path (Next basePath), so nothing is
// rewritten on the way. Railway is the engine for the builders' code and the relay for their CLI; its own address
// answers nobody but the hub.
//
// Pure: both sides use it (the hub to forward, the sandbox to recognise the hub), and the tests pin it.

import { SignJWT, jwtVerify } from "jose";

/** The header the hub signs every forwarded request with: who is asking, for one minute. */
export const PROXY_HEADER = "x-sandbox-proxy";
const TYP = "sbx-proxy";

export type Target = { slug: string; origin: string; basePath: string; base: string };

/**
 * One SANDBOX_URLS entry. With a path, that path is the sandbox's base path; without one it is /sandbox/run/<name>,
 * the name being its Railway host without the word "sandbox" (sandbox-diana-fehr-sandbox.up.railway.app -> diana-fehr).
 */
export function targetOf(raw: string): Target | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return null;
  const path = u.pathname.replace(/\/+$/, "");
  const slug = path
    ? path.split("/").pop()!
    : u.hostname.split(".")[0].split("-").filter((w) => w && w !== "sandbox").join("-");
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) return null;
  const basePath = path || `/sandbox/run/${slug}`;
  if (!/^\/sandbox\/run\/[a-z0-9-]+$/.test(basePath)) return null;
  return { slug, origin: u.origin, basePath, base: `${u.origin}${basePath}` };
}

/** The key the hub signs with and the sandbox checks with: the link key's SHA-256, which both sides already hold. */
const keyOf = (linkKeySha256: string) => new TextEncoder().encode(`sandbox-proxy:${linkKeySha256}`);

export async function signProxy(email: string, linkKeySha256: string, ttlS = 60): Promise<string> {
  return new SignJWT({ email: email.toLowerCase(), typ: TYP }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${ttlS}s`).sign(keyOf(linkKeySha256));
}

/** Who the hub says is asking, or null - also null when this copy has no key (it then lets nobody in this way). */
export async function verifyProxy(token: string | null | undefined, linkKeySha256: string | undefined): Promise<string | null> {
  if (!token || !linkKeySha256 || !/^[0-9a-f]{64}$/i.test(linkKeySha256)) return null;
  try {
    const { payload } = await jwtVerify(token, keyOf(linkKeySha256), { algorithms: ["HS256"] });
    return payload.typ === TYP && typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// What crosses from the browser to the sandbox: what a page needs to be drawn and Next needs to navigate - never the
// hub's cookies (its session would leave the hub) and nothing that names the hub's own address.
const UP = ["accept", "accept-language", "content-type", "user-agent", "range", "if-none-match", "if-modified-since",
  "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "next-action",
  "x-requested-with"];
export function upstreamHeaders(from: Headers): Headers {
  const h = new Headers();
  for (const k of UP) { const v = from.get(k); if (v !== null) h.set(k, v); }
  return h;
}

// What comes back: the page and how to keep it - never a cookie (the sandbox's would land on the hub and overwrite its
// session), and no encoding the hub's own fetch has already undone.
const DOWN = ["content-type", "cache-control", "etag", "last-modified", "vary", "content-disposition", "content-language",
  "x-nextjs-cache", "x-nextjs-prerender", "x-nextjs-stale-time", "x-nextjs-postponed", "x-action-redirect",
  "x-action-revalidated", "x-snapshot-sha", "x-snapshot-at"];
export function downstreamHeaders(from: Headers, origin: string): Headers {
  const h = new Headers();
  for (const k of DOWN) { const v = from.get(k); if (v !== null) h.set(k, v); }
  const loc = from.get("location");
  if (loc) h.set("location", localLocation(loc, origin));
  return h;
}

/** A redirect the sandbox gives names the hub's path, never Railway's address. */
export function localLocation(loc: string, origin: string): string {
  if (loc.startsWith(origin)) return loc.slice(origin.length) || "/";
  try {
    const u = new URL(loc);
    // the server's own name inside Railway (0.0.0.0:3000) - only its path means anything
    if (/^(0\.0\.0\.0|localhost|127\.0\.0\.1)$/.test(u.hostname) || u.hostname.endsWith(".railway.internal")) return `${u.pathname}${u.search}`;
  } catch { /* already a path */ }
  return loc;
}

/**
 * The first thing a sandbox page runs: every request it makes stays under its own path. Its code was written for the
 * hub's root - fetch("/api/...") - and on the hub's address that root IS the real hub; pinned, it is the sandbox.
 * Links that mean to leave (back to the hub) carry data-leave-sandbox.
 */
export function pinScript(basePath: string): string {
  const B = JSON.stringify(basePath);
  return `(function(){var B=${B};function fix(u){try{var x=new URL(u,location.href);if(x.origin===location.origin&&x.pathname!==B&&x.pathname.indexOf(B+"/")!==0){x.pathname=B+x.pathname;return x.toString()}}catch(e){}return u}`
    + `var F=window.fetch;window.fetch=function(i,o){if(typeof i==="string"||i instanceof URL){i=fix(String(i))}else if(i&&i.url){var n=fix(i.url);if(n!==i.url){i=new Request(n,i)}}return F.call(this,i,o)};`
    + `var O=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=fix(u);return O.apply(this,arguments)};`
    + `if(window.EventSource){var E=window.EventSource;var P=function(u,c){return new E(fix(u),c)};P.prototype=E.prototype;window.EventSource=P}`
    + `document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||a.hasAttribute("data-leave-sandbox"))return;var h=a.getAttribute("href");var n=fix(h);if(n!==h&&n!==a.href){a.setAttribute("href",n)}},true);`
    + `})();`;
}
