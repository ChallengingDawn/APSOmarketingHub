// Where APSOparts stands on the way to 30 M€ by 2031 - the home card's mountain and the plan's header
// (src/lib/reporting/summit.ts). Advanced reporting's grant, like the plan.
import { NextResponse } from "next/server";
import { summit } from "@/lib/reporting/summit";
import { describeIntegrationError } from "@/lib/integrations/status";
import { who } from "../../kpi-actions/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const w = await who();
  if (w instanceof NextResponse) return w;
  try {
    return NextResponse.json({ ok: true, summit: await summit() });
  } catch (e) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(e) }, { status: 502 });
  }
}
