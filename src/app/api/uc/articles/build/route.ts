// Rebuild Articles CY/LY now. It also rebuilds by itself once a day, after the
// night's order data is in; this is for an admin who cannot wait for that.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { startBuild } from "@/lib/integrations/articleReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const r = await startBuild(`by ${user.username}`);
  return NextResponse.json({ configured: true, ok: true, data: r });
}
