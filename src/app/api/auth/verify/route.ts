import { NextRequest, NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  createSessionToken,
  isEmailAllowed,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/signin?error=missing_token", req.url));
  }

  const payload = await verifyMagicLinkToken(token);
  if (!payload || !isEmailAllowed(payload.email)) {
    return NextResponse.redirect(new URL("/signin?error=invalid_token", req.url));
  }

  const sessionToken = await createSessionToken(payload.email);
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
