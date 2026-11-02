// Smart Segmentation: what a run did day by day, and the companies it changed (?action=sweep|potential|web|yearly|watch).

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { runHistory, type RunAction } from "@/lib/integrations/segmentation";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: RunAction[] = ["sweep", "potential", "web", "yearly", "watch"];

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action") ?? "";
  if (!(ACTIONS as string[]).includes(action)) return NextResponse.json({ ok: false, error: "action: sweep, potential, web, yearly or watch" }, { status: 400 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: await runHistory(action as RunAction) });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
