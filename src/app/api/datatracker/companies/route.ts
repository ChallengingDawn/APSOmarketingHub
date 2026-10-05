// Full customer rows for named companies - the customers who ORDERED in the
// window but did not come back from the activity search.
//
// Those rows used to be built from the order read alone, with revenue, the
// year-by-year history, address, phone and conditions left blank although the
// company carries them (SARCLA, 05.10). The table asks for them by id once it
// knows which they are; nothing is listed here that the orders did not name.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { ESHOP_YEARS, fetchCompanyRows, type EshopYear } from "@/lib/integrations/eshopActivity";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** One table's worth; the client asks in slices of this. */
const MAX_IDS = 200;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const sp = req.nextUrl.searchParams;
  const ids = [...new Set((sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d{1,20}$/.test(s)))];
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const yearNum = Number(sp.get("year") ?? 2026);
  if (!ids.length || ids.length > MAX_IDS) {
    return NextResponse.json({ ok: false, error: `Between 1 and ${MAX_IDS} numeric company ids are required.` }, { status: 400 });
  }
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ ok: false, error: "from and to must be YYYY-MM-DD, from on or before to." }, { status: 400 });
  }
  const year = ((ESHOP_YEARS as readonly number[]).includes(yearNum) ? yearNum : 2026) as EshopYear;

  try {
    const rows = await fetchCompanyRows(ids, { year, from, to });
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 200 });
  }
}
