// The sales side of the yearly potential: every change a person made (or a form
// copied for one), who set each company's current potential, and the names of the
// people. Filled by the nightly history scan and, between scans, by the watcher.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { potentialEditsData } from "@/lib/integrations/segmentation";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: await potentialEditsData() });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
