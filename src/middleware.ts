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
  const url = new URL("/signin", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // A SANDBOX (src/lib/sandbox/) runs on the person's own computer and is theirs alone: `npm run sandbox` starts it on
  // 127.0.0.1 for them, with no sign-in, and a request naming any other host - a web page that points a name of its
  // own at 127.0.0.1 - is refused.
  if (process.env.APSOHUB_SANDBOX === "1") {
    const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return NextResponse.json({ ok: false, error: "This sandbox answers on localhost only." }, { status: 403 });
    return NextResponse.next();
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
