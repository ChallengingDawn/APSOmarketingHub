// APSOconvert > Problems > one page's customers. A product page (key product:<8 digits>): every company that opened one
// of its articles in the period and the step it stopped at, from the shop's own record. Any other page (key page:<path>):
// the contacts HubSpot last saw on it.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { integrationStatus, describeIntegrationError } from "@/lib/integrations/status";
import { pageCustomers, productCustomers } from "@/lib/convert/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const product = /^product:(\d{8})$/.exec(key)?.[1] ?? null;
  const path = key.startsWith("page:") ? key.slice(5) : null;
  try {
    if (product) {
      if (!ISO.test(from) || !ISO.test(to)) return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD.", status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await productCustomers(product, from, to) });
    }
    if (path && path.startsWith("/") && path.length <= 300) {
      const hs = integrationStatus().hubspot;
      if (!hs.configured) return NextResponse.json({ configured: false, missing: hs.missing, detail: hs.detail });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        return NextResponse.json({ configured: true, ok: true, data: await pageCustomers(path, controller.signal) });
      } finally {
        clearTimeout(timer);
      }
    }
    return NextResponse.json({ configured: true, ok: false, error: "key must be product:<8 digits> or page:<path>.", status: 400 });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(e) }, { status: 200 });
  }
}
