// Who confirmed a CLI code on the hub's Sandbox app (behind the hub's TOTP): the terminal that showed the code then
// collects its token here. The hub's link key; 404 anywhere but the sandbox copy. See src/lib/sandbox/door.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { hubKeyOk } from "@/lib/sandbox/link";
import { grantCli } from "@/lib/sandbox/door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hubKeyOk(req.headers.get("authorization"), process.env.SANDBOX_LINK_KEY_SHA256)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { code?: string; email?: string };
  if (!b.email || !b.code) return NextResponse.json({ error: "which code, and who?" }, { status: 400 });
  const refused = await grantCli(b.code, b.email);
  return refused ? NextResponse.json({ error: refused }, { status: 403 }) : NextResponse.json({ ok: true });
}
