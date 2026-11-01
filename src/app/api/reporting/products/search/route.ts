// Products Reports > Search (SARCLA 01.11.2026: "we should really create subtabs" - his pick "Search"): the search bar's own
// answers for a window that ends now - its searches, those that found nothing, its stores, its days, its terms, the texts it
// passed to its AI, the last searches one by one (src/lib/products/siteSearchRead.ts). The store choice is the page's: the
// answer is small. Advanced reporting's grant to read.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { siteSearchData } from "@/lib/products/siteSearchRead";
import { periodOf } from "@/lib/products/siteSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: await siteSearchData(periodOf(req.nextUrl.searchParams.get("period"))) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
