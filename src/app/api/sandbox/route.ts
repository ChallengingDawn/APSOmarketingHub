// THE SANDBOX BAR'S THREE BUTTONS - Bring data, Bring requested data, Delete all - and the counts it shows.
// Answers 404 anywhere but the sandbox copy, so the real hub has no such route at all.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { isSandbox } from "@/lib/sandbox/mode";
import { askForMisses, askForRequested, deleteAll, sandboxState } from "@/lib/sandbox/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function GET() {
  const refused = await gate();
  if (refused) return refused;
  return NextResponse.json(await sandboxState());
}

export async function POST(req: NextRequest) {
  const refused = await gate();
  if (refused) return refused;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (action === "bring") return NextResponse.json({ asked: await askForMisses(), state: await sandboxState() });
    if (action === "bring-requested") return NextResponse.json({ asked: await askForRequested(), state: await sandboxState() });
    if (action === "delete-all") return NextResponse.json({ ...(await deleteAll()), state: await sandboxState() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
