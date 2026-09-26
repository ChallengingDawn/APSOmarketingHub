// The journey as the application holds it: the imported definition, its
// history, and nothing computed. Numbers come from the analytics routes.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { loadHistory, loadJourney } from "@/lib/journey/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [model, history] = await Promise.all([loadJourney(), loadHistory()]);
  return NextResponse.json({ ok: true, model, history });
}
