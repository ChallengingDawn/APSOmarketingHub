// START CONNECTING A GOOGLE ACCOUNT.
//
// Admins only. Whoever does this is lending their own Google permissions to
// every person who opens the hub, which is not a thing a viewer should be able
// to set in motion.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth/guard";
import { GSC_SCOPE } from "@/lib/integrations/gsc";
import { STATE_COOKIE, consentUrl, oauthConfigured } from "@/lib/integrations/googleUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();

  if (!oauthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set, so there is no OAuth client to send you to. " +
          "They come from the Google Cloud project, and the client's authorised redirect URI has to match this hub's /api/integrations/google/callback exactly.",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  // The origin as the browser reached it, so the redirect URI matches what the
  // person is actually looking at rather than what the container thinks it is.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return NextResponse.redirect(consentUrl(`${proto}://${host}`, GSC_SCOPE, state));
}
