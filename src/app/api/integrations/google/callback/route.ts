// COMING BACK FROM GOOGLE.
//
// Everything that can go wrong here goes wrong in the browser, in front of the
// person who clicked — so every failure returns to Settings → Integrations with
// a sentence saying what happened, never a blank page or a raw stack.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { STATE_COOKIE, completeConnection } from "@/lib/integrations/googleUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: NextRequest, params: Record<string, string>) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const url = new URL("/settings/integrations", `${proto}://${host}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const me = await requireAdmin();
  const sp = req.nextUrl.searchParams;

  // Google's own refusal — usually the person pressing Cancel on the consent
  // screen, which is not an error worth alarming them about.
  const refused = sp.get("error");
  if (refused) {
    return back(req, {
      google: refused === "access_denied" ? "cancelled" : "error",
      detail: sp.get("error_description") ?? refused,
    });
  }

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  const state = sp.get("state");
  if (!expected || !state || state !== expected) {
    return back(req, {
      google: "error",
      detail: "That sign-in did not start here, or it took too long. Press Connect again.",
    });
  }

  const code = sp.get("code");
  if (!code) return back(req, { google: "error", detail: "Google sent no authorisation code." });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;

  try {
    const conn = await completeConnection(code, `${proto}://${host}`, me.username);
    await query(
      `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [me.username, "google.connected", JSON.stringify({ email: conn.email, scopes: conn.scopes })],
    ).catch(() => {});
    return back(req, { google: "connected", detail: conn.email });
  } catch (e) {
    return back(req, { google: "error", detail: e instanceof Error ? e.message : String(e) });
  }
}
