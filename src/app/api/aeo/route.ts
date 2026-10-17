// AI answers (AEO): HubSpot's AEO prompts, every answer kept in the hub, recommendations
// (src/lib/aeo/read.ts). Marketing & Content's grant, as GEO.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { aeoData } from "@/lib/aeo/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("marketing")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, aeo: await aeoData() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
