// BLACK FRIDAY 2026 - the hub's page Website > Black Friday. The promotion's settings and codes live on the Ads
// Gateway (src/lib/promo/blackFriday.ts); who holds and who used a code is read from HubSpot.
//   GET  ?fresh=1                          -> { status, report | null, reportError | null, isAdmin }
//   POST { action: "settings", on?, start?, end?, discount? }        (admins)
//   POST { action: "codes", discount, codes: [...] }                 (admins; the page sends 300 a call - the
//        8 KB request limit in front of the hub)

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminToken, loadPromoCodes, promoReport, promoStatus, setPromoSettings } from "@/lib/promo/blackFriday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ configured: false, missing: ["SMART_BAR_ADMIN_TOKEN"] });
  try {
    const status = await promoStatus();
    let report = null, reportError: string | null = null;
    try { report = await promoReport(status.settings, req.nextUrl.searchParams.get("fresh") === "1"); }
    catch (e) { reportError = String((e as Error)?.message ?? e); }
    return NextResponse.json({ configured: true, ok: true, data: { status, report, reportError, isAdmin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ ok: false, error: "SMART_BAR_ADMIN_TOKEN is not set on the hub." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "settings") {
      const patch: Record<string, unknown> = {};
      for (const k of ["on", "start", "end", "discount"]) if (body[k] !== undefined) patch[k] = body[k];
      const data = await setPromoSettings(patch);
      console.log(`[black-friday] settings set by ${who}: ${JSON.stringify(patch)}`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "codes") {
      const codes = Array.isArray(body.codes) ? body.codes.map(String) : [];
      if (!codes.length || codes.length > 800) return NextResponse.json({ ok: false, error: "Send 1 to 800 codes at a time." }, { status: 400 });
      const data = await loadPromoCodes(Number(body.discount), codes);
      console.log(`[black-friday] ${data.added} codes at ${Number(body.discount)} % loaded by ${who} (${data.already} already there)`);
      return NextResponse.json({ ok: true, data });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const st = (err as { status?: number })?.status;
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: st && st < 500 ? st : 502 });
  }
}
