// The journey as the application holds it: the imported definition, its
// history, and nothing computed. Numbers come from the analytics routes.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { isSeeded, loadHistory, loadJourney } from "@/lib/journey/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [model, history, seeded] = await Promise.all([loadJourney(), loadHistory(), isSeeded()]);
  return NextResponse.json({ ok: true, model, history, seeded });
}
