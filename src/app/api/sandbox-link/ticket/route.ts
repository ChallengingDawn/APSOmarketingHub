// The hub's Sandbox app hands over a one-time ticket (its SHA-256 only) for a person it signed in with TOTP - the
// browser then opens /sso?t=<ticket>. Also: who confirmed a CLI code on the hub. The hub's link key; 404 anywhere but
// the sandbox copy. See src/lib/sandbox/door.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { hubKeyOk } from "@/lib/sandbox/link";
import { acceptTicket, grantCli } from "@/lib/sandbox/door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hubKeyOk(req.headers.get("authorization"), process.env.SANDBOX_LINK_KEY_SHA256)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { hash?: string; code?: string; email?: string };
  if (!b.email) return NextResponse.json({ error: "who?" }, { status: 400 });
  const refused = b.code ? await grantCli(b.code, b.email) : await acceptTicket(b.hash ?? "", b.email);
  return refused ? NextResponse.json({ error: refused }, { status: 403 }) : NextResponse.json({ ok: true });
}
