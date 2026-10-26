// The hub's round, every minute: GET what the sandbox asked for, POST the coded answers. Key-authenticated (no session:
// the hub is not a person); 404 anywhere but the sandbox copy. See src/lib/sandbox/link.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { asked, deliver, hubKeyOk, type Delivery } from "@/lib/sandbox/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gate(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hubKeyOk(req.headers.get("authorization"), process.env.SANDBOX_LINK_KEY_SHA256)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const refused = gate(req);
  if (refused) return refused;
  return NextResponse.json(await asked());
}

export async function POST(req: NextRequest) {
  const refused = gate(req);
  if (refused) return refused;
  const body = (await req.json().catch(() => null)) as Delivery | null;
  if (!body) return NextResponse.json({ error: "Bad delivery" }, { status: 400 });
  try {
    return NextResponse.json(await deliver(body));
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
