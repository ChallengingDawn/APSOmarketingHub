// Delete all, pressed on the hub's Sandbox app: the hub's link key, like the feed; 404 anywhere but the sandbox copy.
// The same three locks as the sandbox's own button (src/lib/sandbox/store.ts deleteAll).

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { hubKeyOk } from "@/lib/sandbox/link";
import { deleteAll, sandboxState } from "@/lib/sandbox/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hubKeyOk(req.headers.get("authorization"), process.env.SANDBOX_LINK_KEY_SHA256)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ...(await deleteAll()), state: await sandboxState() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
