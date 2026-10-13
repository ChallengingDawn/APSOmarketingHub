// 3D files > Calls to AP-Link: the 3D Gateway's counts the hub keeps (by day, source, store view and kind),
// the last caller of each kind and the gateway's own status. Website's grant; read-only. Opening the tab
// also asks the gateway for what is new (at most every two minutes), so the figures are not 15 minutes old.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { adminKeySet, collectNow, readCalls } from "@/lib/threeD/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminKeySet()) return NextResponse.json({ configured: false, missing: ["THREED_ADMIN_KEY"] });
  const sp = req.nextUrl.searchParams;
  const to = isDay(sp.get("to")) ? sp.get("to")! : new Date().toISOString().slice(0, 10);
  const from = isDay(sp.get("from")) ? sp.get("from")! : new Date(Date.now() - 27 * 86_400_000).toISOString().slice(0, 10);
  try {
    await collectNow().catch(() => {});
    return NextResponse.json({ configured: true, ok: true, data: await readCalls(from, to) });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: null });
  }
}
