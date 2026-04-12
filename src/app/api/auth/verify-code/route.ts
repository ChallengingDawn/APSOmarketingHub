import { NextRequest, NextResponse } from "next/server";
import {
  verifyCodeToken,
  isEmailAllowed,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  CODE_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: "A 6-digit code is required" },
        { status: 400 }
      );
    }

    const codeToken = req.cookies.get(CODE_COOKIE)?.value;
    if (!codeToken) {
      return NextResponse.json(
        { error: "No pending code. Please request a new one." },
        { status: 400 }
      );
    }

    const result = await verifyCodeToken(codeToken, code);
    if (!result || !isEmailAllowed(result.email)) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = await createSessionToken(result.email);

    const res = NextResponse.json({ ok: true });

    // Set session cookie
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    // Clear the code cookie
    res.cookies.set(CODE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return res;
  } catch (e) {
    console.error("[auth] verify-code error:", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
