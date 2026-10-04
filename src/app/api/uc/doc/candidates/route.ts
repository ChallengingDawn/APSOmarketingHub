// Orders to test with: the latest shop orders carrying the Declaration of
// Conformity line, straight from Magento - including ones from before the board
// started following them. Read-only, cached ten minutes.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { testCandidates } from "@/lib/doc/engine";
import { magentoConfigured } from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!(await getOptionalUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!magentoConfigured()) {
    return NextResponse.json({
      configured: false,
      missing: ["MAGENTO_CONSUMER_KEY", "MAGENTO_CONSUMER_SECRET", "MAGENTO_ACCESS_TOKEN", "MAGENTO_ACCESS_SECRET"],
    });
  }
  try {
    return NextResponse.json({ configured: true, ok: true, data: { rows: await testCandidates() } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: (err as Error).message, status: null });
  }
}
