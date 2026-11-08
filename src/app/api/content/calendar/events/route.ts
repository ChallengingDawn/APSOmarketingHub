// OTHER APPS ON THE CONTENT CALENDAR (08.11.2026) - lib/content/calendarEvents.ts.
//   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   the entries in that span (at most 62 days), for the calendar page
// Apps put entries through the server function putCalendarEvent; there is no write route.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { myAccess } from "@/lib/auth/appAccess";
import { eventsBetween } from "@/lib/content/calendarEvents";
import { isDay } from "@/lib/content/calendarEventRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  const me = await requireUser();
  const acc = await myAccess();
  if (me.role !== "admin" && !acc?.canOpen("marketing")) return fail("Not allowed.", 403);
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isDay(from) || !isDay(to) || to < from) return fail("from and to must be days (YYYY-MM-DD), from first.");
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS > 62) return fail("At most 62 days at a time.");
  try {
    return NextResponse.json({ ok: true, events: await eventsBetween(from, to) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}
