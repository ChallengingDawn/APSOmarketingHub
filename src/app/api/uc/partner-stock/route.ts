// STOCK TO PARTNERS - a HubSpot app (UC & HubSpot Apps > HubSpot apps): every morning at 07:00 Zurich a partner
// gets its article list with our stock, MOQ and status as an Excel file (src/lib/partnerStock, SARCLA 18.10.2026).
// GET ?partner=itafran: settings, today's lines, the last sends. GET ?partner=itafran&download=1: today's file.
// PUT (admins): mode (off / test / live), send to, copy, test address, reply-to, Monday to Friday only.
// POST (admins) {action: "send-test"}: the file now, to the admin who asked; their address becomes the test
// address when none is set, so the next test mornings reach them too.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { emailOfUser, fileName, getPartnerSettings, partnerOf, partnerReport, readLines, sendPartner, setPartnerSettings, workbook } from "@/lib/partnerStock/engine";
import { zurich } from "@/lib/partnerStock/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const p = partnerOf(sp.get("partner"));
  try {
    if (sp.get("download")) {
      const at = new Date();
      const file = await workbook(p, await readLines(p), at);
      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName(p, zurich(at).day)}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json({ configured: true, ok: true, data: { ...(await partnerReport(p.key)), admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const s = await setPartnerSettings(partnerOf(b.partner as string).key, {
      mode: b.mode, to: b.to, cc: b.cc, testTo: b.testTo, weekdaysOnly: b.weekdaysOnly, replyTo: b.replyTo,
    }, `user ${access.userId}`);
    return NextResponse.json({ ok: true, data: s });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { partner?: string; action?: string };
  if (b.action !== "send-test") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  const p = partnerOf(b.partner);
  const me = await emailOfUser(access.userId);
  if (!me) return NextResponse.json({ ok: false, error: "Your account has no e-mail address - add one under Settings > You." }, { status: 400 });
  const s = await getPartnerSettings(p.key);
  if (!s.testTo.length) await setPartnerSettings(p.key, { testTo: [me] }, `user ${access.userId}`);
  const r = await sendPartner(p.key, "test", me);
  return NextResponse.json({ ok: r.ok, data: r, ...(r.ok ? {} : { error: r.error }) });
}
