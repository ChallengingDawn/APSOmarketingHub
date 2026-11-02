// BACK-OFFICE REPORTS: the months and the GQS tasks kept so far (src/lib/reporting/boReport.ts - asking starts the counter
// on what is missing or due); the ESO's and the TSA's inbound tickets from the ESO Reports' own read (the sales actions
// left out, as the workbook counts them); and what HubSpot does not hold, typed in per month - the hours the Back Office
// worked (on Figures) and the OTD, the pass rate, the manual price adjustments and the stopped orders (on OTD & autonomy),
// the workbook's own figures until someone types a month in (SARCLA 02.11.2026: "Live, file = the KPI list"). GET for
// anyone with one of the report's pages; PUT for whoever may change the page the figure is typed on.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { boReportNow } from "@/lib/reporting/boReport";
import { esoTickets } from "@/lib/reporting/ticketsReport";
import { T } from "@/lib/reporting/ticketsRules";
import { TYPED, WORKBOOK_TYPED, checkTyped, inboundByMonth, typedKey, type Typed } from "@/lib/reporting/boReportRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["figures", "topics", "sales-tickets", "gqs", "otd"].map((p) => `/reporting/back-office/${p}`).concat("/reporting/back-office");
const FIGURES = PAGES[0], OTD = PAGES[4];
const HOURS = "boReport:hours", TYPED_KV = "boReport:typed";
/** the workbook's own hours (BO KPI, "Hours worked", January to September 2026) until someone types the months in here */
const WORKBOOK_HOURS: Record<string, number> = {
  "2026-01": 908.6, "2026-02": 935.1, "2026-03": 909.9, "2026-04": 799.5, "2026-05": 690, "2026-06": 911.5, "2026-07": 597.54, "2026-08": 606.04, "2026-09": 678.63,
};
const level = (a: MyAccess, href: string) => accessAt(href, a.levels).level;

/** the ESO's and the TSA's incoming tickets per month - none while the ESO Reports' read is still counting */
async function inbound() {
  try {
    const st = await esoTickets();
    const d = st.value;
    return d ? inboundByMonth(d.tickets, d.year, { year: T.year, month: T.month, group: T.group, pipe: T.pipe }) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAGES.some((p) => level(access, p) !== "none")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [st, hours, typed, inb] = await Promise.all([boReportNow(), kvGet<Record<string, number>>(HOURS), kvGet<Typed>(TYPED_KV), inbound()]);
    return NextResponse.json({
      state: { computing: st.counting, progress: st.progress, error: st.error, computedAt: st.generatedAt },
      // nothing kept yet: the page says it is counting; else the months there are, the rest named as pending
      data: st.months.length ? { ...st, hours: hours ?? WORKBOOK_HOURS, typed: typed ?? WORKBOOK_TYPED, inbound: inb } : null,
      canEdit: level(access, FIGURES) === "write", canEditTyped: level(access, OTD) === "write",
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/** { ym, hours } - the hours on Figures; { ym, series, row, value } - a figure on OTD & autonomy. */
export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { ym?: unknown; hours?: unknown; series?: unknown; row?: unknown; value?: unknown };
  const ym = String(b.ym ?? "");
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(ym)) return NextResponse.json({ ok: false, error: "That is not a month." }, { status: 400 });
  const u = await getOptionalUser();
  const audit = (action: string, detail: unknown) => query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [u?.username ?? "", action, JSON.stringify(detail)]).catch(() => { /* never fail the change because the log did */ });
  try {
    if (b.series !== undefined) {
      if (level(access, OTD) !== "write") return NextResponse.json({ ok: false, error: "Only someone who may change OTD & autonomy types these in." }, { status: 403 });
      const series = TYPED.find((x) => x.id === b.series);
      const row = series?.rows.find((x) => x.id === b.row);
      if (!series || !row) return NextResponse.json({ ok: false, error: "That figure is not on the page." }, { status: 400 });
      const c = checkTyped(series.unit, b.value);
      if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 400 });
      const typed: Typed = { ...((await kvGet<Typed>(TYPED_KV)) ?? WORKBOOK_TYPED) };
      const key = typedKey(series.id, row.id);
      const months = { ...(typed[key] ?? {}) };
      if (c.value === null) delete months[ym]; else months[ym] = c.value;
      typed[key] = months;
      await kvSet(TYPED_KV, typed);
      await audit("back-office.typed", { key, ym, value: c.value });
      return NextResponse.json({ ok: true, typed });
    }
    if (level(access, FIGURES) !== "write") return NextResponse.json({ ok: false, error: "Only someone who may change Figures types in the hours." }, { status: 403 });
    const value = b.hours === null || b.hours === "" ? null : Number(b.hours);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100_000)) return NextResponse.json({ ok: false, error: "That is not a number of hours." }, { status: 400 });
    const hours = { ...((await kvGet<Record<string, number>>(HOURS)) ?? WORKBOOK_HOURS) };
    if (value === null) delete hours[ym]; else hours[ym] = Math.round(value * 100) / 100;
    await kvSet(HOURS, hours);
    await audit("back-office.hours", { ym, hours: value });
    return NextResponse.json({ ok: true, hours });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
