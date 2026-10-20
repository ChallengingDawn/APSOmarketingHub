// Retain & grow: the erosion at stake (src/lib/marketingKpis/retain.ts). Advanced reporting's grant to read.
// The erosion tickets are no longer read here (SARCLA 20.10.2026: "here you are only measuring the erosion
// articles - take it out").
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { retainData } from "@/lib/marketingKpis/retain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, retain: await retainData() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
