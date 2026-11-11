// UC12's ticket fields in HubSpot (src/lib/lifecycle/revenueDropFieldsHubspot.ts): GET says what is there and what is
// missing, POST creates what is missing - admins only. UC & HubSpot Apps' own grant, like the pages. In the sandbox the
// POST's writes are held back: the answer says so.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotToken } from "@/lib/integrations/status";
import { createRevenueDropFields, revenueDropFieldsPlan } from "@/lib/lifecycle/revenueDropFieldsHubspot";
import { isSandbox } from "@/lib/sandbox/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failed = (e: unknown) => NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ ok: false, error: "HubSpot is not connected" });
  try {
    return NextResponse.json({ ok: true, admin: access.role === "admin", plan: await revenueDropFieldsPlan() });
  } catch (e) {
    return failed(e);
  }
}

export async function POST() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ ok: false, error: "HubSpot is not connected" });
  try {
    const run = await createRevenueDropFields();
    return NextResponse.json({ ok: true, admin: true, run, heldBack: isSandbox(), plan: await revenueDropFieldsPlan() });
  } catch (e) {
    return failed(e);
  }
}
