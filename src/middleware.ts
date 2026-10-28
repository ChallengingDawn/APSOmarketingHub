import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

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

  // A SANDBOX (src/lib/sandbox/). On the person's own computer (`npm run sbx -- dev`) it is theirs alone: the CLI starts
  // it on 127.0.0.1 for the one person signed in, and a request naming any other host - a web page that points a name
  // of its own at 127.0.0.1 - is refused. On Railway it is the relay: only the CLI and the hub talk to it, no page.
  if (process.env.APSOHUB_SANDBOX === "1") {
    if (process.env.SANDBOX_LOCAL === "1") {
      const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
      if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return NextResponse.json({ ok: false, error: "This sandbox answers on localhost only." }, { status: 403 });
      return NextResponse.next();
    }
    if (!pathname.startsWith("/api/") && pathname !== "/sbx.mjs") {
      return new NextResponse("This sandbox runs on your computer: npm run sbx -- dev", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
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
    // the front page by itself: under the relay's base path its address is /sandbox/run/<name> with no slash, which
    // the pattern below (prefixed with that path) does not match
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
