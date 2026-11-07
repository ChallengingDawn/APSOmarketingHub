// APSOconvert > IDEAS: every idea on every page with its version, newest work first (src/lib/convert/studio.ts board).
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { board } from "@/lib/convert/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: { ideas: await board() } });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
