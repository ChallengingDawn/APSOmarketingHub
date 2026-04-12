import { NextRequest, NextResponse } from "next/server";
import {
  isEmailAllowed,
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check email domain + password — generic error to prevent enumeration
    if (!isEmailAllowed(email) || !verifyPassword(password)) {
      console.log("[auth] login failed", { email, reason: "invalid credentials" });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = await createSessionToken(email);

    console.log("[auth] login success", { email });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return res;
  } catch (e) {
    console.error("[auth] login error:", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
