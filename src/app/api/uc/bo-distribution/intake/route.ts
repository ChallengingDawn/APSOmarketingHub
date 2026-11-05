// THE WAY IN - Back Office distribution > Settings, "SARCLA | Back Office Ticket Created | Notification" in the hub
// (src/lib/boDistribution/intake.ts, intakeRun.ts; SARCLA 05.11.2026).
// GET: the workflow's state, since when the hub writes it, the last pass, the comparison with the workflow (7 days) and
// the latest tickets. Read-only - the switch is the workflow itself (off = the hub writes, on again = the roll-back).

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { intakeState } from "@/lib/boDistribution/intakeRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: await intakeState() });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
