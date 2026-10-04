// Operator test: one order's real declaration email, PDFs attached, sent through
// HubSpot SMTP to ONE internal address. Nothing is stamped, logged or counted.
// It proves the whole chain - shop, AP-Link via PricingHub, SMTP from this
// deployment - before the hub takes the work over from C2S V1.
//
// Admins only, and only to our own domains: a customer's declaration must never
// be sent to an outside address by a slip of the keyboard.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { sendTest } from "@/lib/doc/engine";
import { magentoConfigured, smtpConfigured } from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const INTERNAL = /^[^@\s]+@(apsoparts\.com|angst-pfister\.com)$/i;

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!smtpConfigured() || !magentoConfigured()) {
    return NextResponse.json({ ok: false, error: "SMTP, Magento or the PricingHub key is not configured on this deployment." }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const web = (sp.get("web") ?? "").replace(/\D/g, "");
  const to = (sp.get("to") ?? "").trim();
  if (!web) return NextResponse.json({ ok: false, error: "web=<shop order number> is required." }, { status: 400 });
  if (!INTERNAL.test(to)) {
    return NextResponse.json({ ok: false, error: "to= must be an @apsoparts.com or @angst-pfister.com address." }, { status: 400 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await sendTest(web, to, sp.get("lang"))) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
