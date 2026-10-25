// A chart's target, typed in its Actions window (SARCLA 25.10.2026: "allow to enter a threshold so we can measure the rest
// of it" - a target per chart): the chart draws it and says how far each row is from it. One for everyone; null clears.
import { NextRequest, NextResponse } from "next/server";
import { setTarget } from "@/lib/reporting/kpiActions";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
  const key = typeof b.key === "string" ? b.key.trim() : "";
  if (!/^[a-z0-9-]+:[^\s]{1,150}$/i.test(key)) return fail("the chart is missing", 400);
  const value = b.value == null || b.value === "" ? null : Number(b.value);
  if (value != null && (!Number.isFinite(value) || value < 0)) return fail("the target is a figure of 0 or more", 400);
  try { await setTarget(key, value, w.name); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
