// BACK-OFFICE REPORTS: the months and the GQS tasks kept so far (src/lib/reporting/boReport.ts - asking starts the counter
// on what is missing or due; every GQS task on its own for the GQS page in full, boGqs.ts); the ESO's and the TSA's inbound tickets from the ESO Reports' own read (the sales actions
// left out) and, from the same read, their win rate, first contact and the rest (boInbound.ts); and what HubSpot does not
// hold, typed in per month - the hours the Back Office
// worked (on Team totals) and the OTD, the pass rate, the manual price adjustments and the stopped orders (on their pages),
// the workbook's own figures until someone types a month in (SARCLA 02.11.2026: "Live, file = the KPI list"). GET for
// anyone with one of the report's pages; PUT for whoever may change the page the figure is typed on. And the delivery speed
// the chain's order_sync keeps from the ERP's order file (boDelivery.ts) for OTD > Delivery speed.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { boReportNow, type KeptCompanies } from "@/lib/reporting/boReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { hierarchyNow } from "@/lib/hierarchy/store";
import { esoTickets } from "@/lib/reporting/ticketsReport";
import { T } from "@/lib/reporting/ticketsRules";
import { inboundDetail } from "@/lib/reporting/boInbound";
import { deliveryNow } from "@/lib/reporting/boDeliveryStore";
import { TYPED, WORKBOOK_TYPED, checkTyped, inboundByMonth, typedKey, type Typed } from "@/lib/reporting/boReportRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["figures", "topics", "sales-tickets", "gqs", "otd", "autonomy", "stopped"].map((p) => `/reporting/back-office/${p}`).concat("/reporting/back-office");
const FIGURES = PAGES[0];
/** the page each typed series is typed in on - its edit right decides */
const SERIES_PAGE: Record<string, string> = { otd: "/reporting/back-office/otd", pass: "/reporting/back-office/autonomy", price: "/reporting/back-office/autonomy", stopped: "/reporting/back-office/stopped" };
const HOURS = "boReport:hours", TYPED_KV = "boReport:typed";
/** the workbook's own hours (BO KPI, "Hours worked", January to September 2026) until someone types the months in here */
const WORKBOOK_HOURS: Record<string, number> = {
  "2026-01": 908.6, "2026-02": 935.1, "2026-03": 909.9, "2026-04": 799.5, "2026-05": 690, "2026-06": 911.5, "2026-07": 597.54, "2026-08": 606.04, "2026-09": 678.63,
};
const level = (a: MyAccess, href: string) => accessAt(href, a.levels).level;

/** The Back Office team: everyone placed in the Back Office unit (Settings > hierarchy) - the People graphs show them, the
 *  other owners of Back Office tickets folded away (SARCLA 03.11.2026: "limit to Back Office, a hidden row for wrong owners"). */
async function boTeam(): Promise<string[]> {
  try {
    const h = await hierarchyNow();
    return Object.entries(h.placed).filter(([, p]) => /back\s*office/i.test(p.unit ?? "")).map(([id]) => id);
  } catch {
    return [];
  }
}

/** The answers to the survey sent after a Back Office ticket is closed (SARCLA 03.11.2026: "the survey we send the customer
 *  randomly after the ticket is closed ... integrated to the sentiment tab") - from last January, the newest first. */
export type BoSurvey = { day: string; value: number | null; sentiment: string | null; comment: string | null; ticket: string | null; company: string | null };
async function surveys(fromYear: number): Promise<BoSurvey[]> {
  try {
    const r = await query<BoSurvey>(
      `SELECT to_char(created_at AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD') AS day, value::float AS value, sentiment, comment, ticket_id AS ticket, company_name AS company
         FROM apsomh_feedback
        WHERE (survey_name ILIKE '%BO\_TICKET%' OR ticket_pipeline = '1726786777') AND created_at >= make_date($1, 1, 1)
        ORDER BY created_at DESC`, [fromYear]);
    return r.rows;
  } catch {
    return []; // the survey copy not there yet
  }
}

/** the ESO's and the TSA's incoming tickets per month, and their figures in detail - none while the ESO Reports' read is
 *  still counting */
async function inbound() {
  try {
    const st = await esoTickets();
    const d = st.value;
    return d ? { counts: inboundByMonth(d.tickets, d.year, { year: T.year, month: T.month, group: T.group, pipe: T.pipe }), detail: inboundDetail(d) } : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAGES.some((p) => level(access, p) !== "none")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [st, hours, typed, inb, cos, owners, team, delivery] = await Promise.all([boReportNow(), kvGet<Record<string, number>>(HOURS), kvGet<Typed>(TYPED_KV), inbound(),
      kvGet<KeptCompanies>("boReport:companies"), ownerNames().catch(() => new Map<string, string>()), boTeam(), deliveryNow()]);
    const answers = await surveys(new Date().getFullYear() - 1);
    // the names of the tickets' owners, and the facts of their companies the filters read
    const ids = new Set(st.months.flatMap((m) => m.rows?.dict ?? []));
    // and of the GQS tasks' owners, requesters and line managers
    for (const t of st.gqsTasks?.tasks ?? []) for (const x of [t.o, t.rq, t.lm]) if (x) ids.add(x);
    const names = Object.fromEntries([...owners].filter(([id]) => ids.has(id)));
    return NextResponse.json({
      state: { computing: st.counting, progress: st.progress, error: st.error, computedAt: st.generatedAt },
      // nothing kept yet: the page says it is counting; else the months there are, the rest named as pending
      data: st.months.length ? { ...st, hours: hours ?? WORKBOOK_HOURS, typed: typed ?? WORKBOOK_TYPED, inbound: inb?.counts ?? null, inDetail: inb?.detail ?? null, names, companies: cos?.facts ?? {}, team, surveys: answers, delivery } : null,
      canEdit: level(access, FIGURES) === "write", canEditTyped: Object.fromEntries(TYPED.map((s) => [s.id, level(access, SERIES_PAGE[s.id]) === "write"])),
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/** { ym, hours } - the hours on Team totals; { ym, series, row, value } - a figure on OTD, KPI autonomy or Stopped orders. */
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
      const series = TYPED.find((x) => x.id === b.series);
      const row = series?.rows.find((x) => x.id === b.row);
      if (!series || !row) return NextResponse.json({ ok: false, error: "That figure is not on the page." }, { status: 400 });
      if (level(access, SERIES_PAGE[series.id]) !== "write") return NextResponse.json({ ok: false, error: "Only someone who may change this page types these in." }, { status: 403 });
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
    if (level(access, FIGURES) !== "write") return NextResponse.json({ ok: false, error: "Only someone who may change Team totals types in the hours." }, { status: 403 });
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
