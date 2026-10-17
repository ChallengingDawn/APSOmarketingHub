// One AI answer (AEO run): its text, citations and search queries - read when opened.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { aeoRunDetail } from "@/lib/aeo/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("marketing")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, run: await aeoRunDetail(id) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 502 });
  }
}
