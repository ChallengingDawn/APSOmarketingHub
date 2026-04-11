import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function clearAndRedirect(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/signin", req.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}
