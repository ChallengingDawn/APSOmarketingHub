import { NextRequest, NextResponse } from "next/server";
import { isEmailAllowed, createMagicLinkToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Always return a generic success — never reveal whether the address is allowed.
    // This protects against email enumeration.
    if (!isEmailAllowed(email)) {
      return NextResponse.json({ ok: true });
    }

    const token = await createMagicLinkToken(email);

    // Use APP_URL env var when set (required on Railway where req.nextUrl.origin
    // resolves to the internal container address, e.g. localhost:8080).
    // Falls back to the request origin for local development.
    const origin = process.env.APP_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
    const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

    // Strip any stray wrapping quotes that Railway / .env files sometimes leave on values.
    const apiKey = (process.env.RESEND_API_KEY || "").replace(/^["']|["']$/g, "").trim();
    const from =
      (process.env.AUTH_EMAIL_FROM || "APSOparts Marketing Hub <onboarding@resend.dev>")
        .replace(/^["']|["']$/g, "")
        .trim();

    // Dev-mode bypass: when AUTH_DEV_MODE=true, return the link in the response so the
    // admin can sign in even if corporate mail filters are silently dropping the email.
    // Should be disabled once the mail delivery is working for real users.
    const devMode = (process.env.AUTH_DEV_MODE || "").toLowerCase() === "true";

    console.log("[auth] send-magic-link attempt", { to: email, from, hasKey: !!apiKey, devMode });

    // Dev fallback: if Resend isn't configured, log the link to the server console
    // so the developer can still sign in without email delivery set up.
    if (!apiKey) {
      console.warn(
        "[auth] RESEND_API_KEY not set — magic link (dev only):",
        link
      );
      return NextResponse.json({ ok: true });
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
        subject: "Sign in to APSOparts Marketing Hub",
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
          <div style="font-size:12px;color:#5f6368;">APSOparts · Sealings &amp; Plastics</div>
        </div>
      </div>
      <h1 style="font-size:20px;font-weight:600;color:#1f1f1f;margin:24px 0 8px;letter-spacing:-0.01em;">Sign in to your account</h1>
      <p style="font-size:14px;line-height:1.5;color:#3c4043;margin:0 0 24px;">
        Click the button below to sign in to the APSOparts Marketing Hub. This link expires in 15 minutes and can only be used once.
      </p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#ed1b2f;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">
        Sign in
      </a>
      <p style="font-size:12px;line-height:1.5;color:#5f6368;margin:32px 0 0;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <span style="color:#1a73e8;word-break:break-all;">${link}</span>
      </p>
      <hr style="border:none;border-top:1px solid #ececec;margin:24px 0;">
      <p style="font-size:11px;color:#9aa0a6;margin:0;">
        If you didn't request this sign-in link, you can safely ignore this email. No one can access the hub without clicking this link.
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
      // Return the Resend error text to the client so the issue is visible
      // without needing Railway log access. Safe: no secrets are exposed.
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
    return NextResponse.json({ ok: true, ...(devMode ? { dev_link: link } : {}) });
  } catch (e) {
    console.error("[auth] send-magic-link error:", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
