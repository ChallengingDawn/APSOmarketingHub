// My Sales Reports > New customer contest (src/lib/reporting/contestReport.ts): which ESO brings the most order intake
// from customers new since 5 October. Started by the first request, answered from the finished read after that. The
// page's own grant.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { mySalesContest } from "@/lib/reporting/contestReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (accessAt("/reporting/my-sales/contest", access.levels).level === "none") return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await mySalesContest()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
