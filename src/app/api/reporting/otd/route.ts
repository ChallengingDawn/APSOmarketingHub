// OTD Reports' figures (lib/reporting/otdStore.ts): the morning file's order lines, and the OTD analysis file's months
// before them, as one cube - read by every OTD Reports page.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { otdNow } from "@/lib/reporting/otdStore";
import { OTD_PAGES } from "@/lib/reporting/otdPages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OTD_PAGES.some((p) => accessAt(p.href, access.levels).level !== "none")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ cube: await otdNow() });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
