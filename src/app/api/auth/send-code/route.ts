import { NextRequest, NextResponse } from "next/server";
import {
  isEmailAllowed,
  createVerificationCode,
  createCodeToken,
  CODE_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Always return generic success — never reveal whether the address is allowed.
    if (!isEmailAllowed(email)) {
      return NextResponse.json({ ok: true });
    }

    const code = createVerificationCode();
    const codeToken = await createCodeToken(email, code);

    const apiKey = (process.env.RESEND_API_KEY || "")
      .replace(/^["']|["']$/g, "")
      .trim();
    const from = (
      process.env.AUTH_EMAIL_FROM ||
      "APSOparts Marketing Hub <onboarding@resend.dev>"
    )
      .replace(/^["']|["']$/g, "")
      .trim();

    const devMode =
      (process.env.AUTH_DEV_MODE || "").toLowerCase() === "true";

    console.log("[auth] send-code attempt", {
      to: email,
      from,
      hasKey: !!apiKey,
      devMode,
    });

    // Dev fallback: log code to console if Resend isn't configured
    if (!apiKey) {
      console.warn("[auth] RESEND_API_KEY not set — code (dev only):", code);
      const res = NextResponse.json({
        ok: true,
        ...(devMode ? { dev_code: code } : {}),
      });
      res.cookies.set(CODE_COOKIE, codeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      });
      return res;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Your sign-in code for APSOparts Marketing Hub",
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;background:#f6f7f9;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="background:#ffffff;border:1px solid #ececec;border-radius:16px;border-top:3px solid #ed1b2f;padding:32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:50%;background:#ed1b2f;color:#ffffff;font-weight:800;font-size:12px;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;">APSO</div>
        <div>
          <div style="font-size:18px;font-weight:600;color:#1f1f1f;letter-spacing:-0.01em;">Marketing Hub</div>
          <div style="font-size:12px;color:#5f6368;">APSOparts</div>
        </div>
      </div>
      <h1 style="font-size:20px;font-weight:600;color:#1f1f1f;margin:24px 0 8px;letter-spacing:-0.01em;">Your sign-in code</h1>
      <p style="font-size:14px;line-height:1.5;color:#3c4043;margin:0 0 24px;">
        Enter this code on the sign-in page. It expires in 15 minutes.
      </p>
      <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1f1f1f;text-align:center;padding:16px 0;background:#f6f7f9;border-radius:12px;margin:0 0 24px;">
        ${code}
      </div>
      <hr style="border:none;border-top:1px solid #ececec;margin:24px 0;">
      <p style="font-size:11px;color:#9aa0a6;margin:0;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
        `.trim(),
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("[auth] Resend API error:", resp.status, err);
      return NextResponse.json(
        {
          error: "Failed to send email",
          provider: "resend",
          status: resp.status,
          detail: err.slice(0, 500),
          from,
        },
        { status: 500 }
      );
    }

    const data = await resp.json().catch(() => ({}));
    console.log("[auth] Resend send ok", data);

    const res = NextResponse.json({
      ok: true,
      ...(devMode ? { dev_code: code } : {}),
    });

    // Store code token in HTTP-only cookie for verification
    res.cookies.set(CODE_COOKIE, codeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return res;
  } catch (e) {
    console.error("[auth] send-code error:", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
