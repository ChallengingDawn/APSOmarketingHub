import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PROXY_HEADER, verifyProxy } from "@/lib/sandbox/proxy";

const SESSION_COOKIE = "apsomarketinghub_session";
const PUBLIC_PREFIXES = [
  "/signin",
  "/signup",
  "/invite",
  "/login",
  "/login/totp",
  "/enroll",
  "/api/auth/",
  "/api/health",
  "/api/sandbox-link/", // the hub's own key, not a session; 404 anywhere but the sandbox copy
  "/api/sbx/", // the sandbox CLI relay: a code confirmed on the hub, then its token; 404 anywhere but the sandbox copy
  "/sbx.mjs", // the sandbox CLI itself, so a new person can fetch it (only the sandbox's code has it in public/)
  "/_next",
  "/favicon",
  "/icon",
  "/dev-canvas", // E2E canvas harness — the page itself is gated on NEXT_PUBLIC_E2E=1
];

// A sandbox is served at /sandbox/run/<name>/... on the hub's address (src/lib/sandbox/proxy.ts). Its pages keep their
// own calls under that path; a call from one of them to the hub's own API - the real data - is refused here.
const SANDBOX_RUN = "/sandbox/run/";
function fromSandboxPage(req: NextRequest): boolean {
  const ref = req.headers.get("referer");
  if (!ref) return false;
  try { return new URL(ref).pathname.startsWith(SANDBOX_RUN); } catch { return false; }
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("SESSION_SECRET (or AUTH_SECRET) is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Turning somebody away.
 *
 * A PAGE gets the sign-in screen. An API call gets 401 and a JSON body — it used
 * to get the sign-in screen too, which is HTML, which is why a session that
 * expired while a page was open surfaced as
 *
 *   SyntaxError: Unexpected token '<', "<html> <h"... is not valid JSON
 *
 * on whatever the person clicked next. Every fetch in the hub reads JSON; none
 * of them asked for a login page.
 */
function turnAway(req: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Your session has ended. Sign in again." },
      { status: 401 },
    );
  }
  // a sandbox copy runs under its base path (/sandbox/run/<name>): so does its sign-in page
  const url = new URL(`${req.nextUrl.basePath}/signin`, req.url);
  if (pathname !== "/") url.searchParams.set("next", `${req.nextUrl.basePath}${pathname}`);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const full = `${req.nextUrl.basePath}${pathname}`;

  // the hub: nothing outside a sandbox's own path answers a sandbox page's calls - its API, or a page's data fetched
  // by script; only following a link back to the hub (a navigation) leaves the sandbox
  const mode = req.headers.get("sec-fetch-mode");
  if (!full.startsWith(SANDBOX_RUN) && fromSandboxPage(req) && (pathname.startsWith("/api/") || (mode !== null && mode !== "navigate"))) {
    return NextResponse.json({ ok: false, error: "A sandbox page cannot call the hub." }, { status: 403 });
  }

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // a sandbox copy: the hub's signed request is the only way in (no key set - the hub itself - lets nobody in this way)
  const proxied = req.headers.get(PROXY_HEADER);
  if (proxied) {
    if (await verifyProxy(proxied, process.env.SANDBOX_LINK_KEY_SHA256)) return NextResponse.next();
    return turnAway(req, pathname);
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return turnAway(req, pathname);

  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (payload.typ !== "session") throw new Error("wrong type");
    return NextResponse.next();
  } catch {
    return turnAway(req, pathname);
  }
}

export const config = {
  matcher: [
    // the front page by itself: under a sandbox's base path its address is /sandbox/run/<name> with no slash, which
    // the pattern below (prefixed with that path) does not match - and the page opened for anybody
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
