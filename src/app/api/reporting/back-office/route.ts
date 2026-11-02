// BACK-OFFICE REPORTS: the months and the GQS tasks kept so far (src/lib/reporting/boReport.ts - asking starts the counter
// on what is missing or due) and the hours the Back Office worked - typed in
// per month on Figures, not in HubSpot (SARCLA 02.11.2026: "Live, file = the KPI list ... hours worked, OTD and stopped
// orders are typed in"). GET for anyone with one of the report's pages; PUT (the hours) for whoever may change Figures.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { boReportNow } from "@/lib/reporting/boReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["figures", "topics", "sales-tickets", "gqs"].map((p) => `/reporting/back-office/${p}`);
const HOURS = "boReport:hours";
/** the workbook's own hours (BO KPI, "Hours worked", January to September 2026) until someone types the months in here */
const WORKBOOK_HOURS: Record<string, number> = {
  "2026-01": 908.6, "2026-02": 935.1, "2026-03": 909.9, "2026-04": 799.5, "2026-05": 690, "2026-06": 911.5, "2026-07": 597.54, "2026-08": 606.04, "2026-09": 678.63,
};
const level = (a: MyAccess, href: string) => accessAt(href, a.levels).level;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAGES.some((p) => level(access, p) !== "none")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [st, hours] = await Promise.all([boReportNow(), kvGet<Record<string, number>>(HOURS)]);
    return NextResponse.json({
      state: { computing: st.counting, progress: st.progress, error: st.error, computedAt: st.generatedAt },
      // nothing kept yet: the page says it is counting; else the months there are, the rest named as pending
      data: st.months.length ? { ...st, hours: hours ?? WORKBOOK_HOURS } : null,
      canEdit: level(access, PAGES[0]) === "write",
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (level(access, PAGES[0]) !== "write") return NextResponse.json({ ok: false, error: "Only someone who may change Figures types in the hours." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { ym?: unknown; hours?: unknown };
  const ym = String(b.ym ?? "");
  const value = b.hours === null || b.hours === "" ? null : Number(b.hours);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(ym) || (value !== null && (!Number.isFinite(value) || value < 0 || value > 100_000))) {
    return NextResponse.json({ ok: false, error: "That is not a month and a number of hours." }, { status: 400 });
  }
  try {
    const u = await getOptionalUser();
    const hours = { ...((await kvGet<Record<string, number>>(HOURS)) ?? WORKBOOK_HOURS) };
    if (value === null) delete hours[ym]; else hours[ym] = Math.round(value * 100) / 100;
    await kvSet(HOURS, hours);
    await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [u?.username ?? "", "back-office.hours", JSON.stringify({ ym, hours: value })]).catch(() => { /* never fail the change because the log did */ });
    return NextResponse.json({ ok: true, hours });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
