// Website enrichment for NEW companies on or off (external lookups cost). Manual
// batches and the nightly cap are not affected.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { setWebNew } from "@/lib/integrations/segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (process.env.SEGMENTATION_ENGINE !== "live") {
    return NextResponse.json({ error: "The Compass connector still runs segmentation - the switch stays there until the hub takes over." }, { status: 409 });
  }
  const r = await setWebNew(req.nextUrl.searchParams.get("enabled") === "1");
  return NextResponse.json({ configured: true, ok: true, data: r });
}
