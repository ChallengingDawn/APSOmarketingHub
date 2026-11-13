// OTD Reports > Customers (lib/reporting/otdLines.ts): every customer's OTD in the period and filters asked, or - with ?c= -
// one customer's lines, for its KPIs, orders and articles; with ?view= every supplier's lead times, GLC's customers, every
// article or the lead-time bands. Read by OTD Reports and by Back-Office Reports > OTD. The
// lines are kept by erp_revenue's run on each ERP delivery (otdStore.ts KV_OTD_LINES).

import { NextResponse, type NextRequest } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { otdLinesNow } from "@/lib/reporting/otdStore";
import { articleList, customerLines, customerList, glcCustomers, leadBands, supplierList, type LineFilter } from "@/lib/reporting/otdLines";
import { OTD_PAGES } from "@/lib/reporting/otdPages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YM = /^\d{4}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // an OTD Reports page, or Back-Office Reports > OTD, which draws the same views (SARCLA 12.11.2026)
  const opens = (href: string) => accessAt(href, access.levels).level !== "none";
  if (!OTD_PAGES.some((p) => opens(p.href)) && !opens("/reporting/back-office/otd")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const from = q.get("from") ?? "", to = q.get("to") ?? "";
  if (!YM.test(from) || !YM.test(to)) return NextResponse.json({ error: "from and to (YYYY-MM) are needed" }, { status: 400 });
  const list = (k: string) => q.getAll(k).filter(Boolean);
  const f: LineFilter = { from, to, axis: q.get("axis") === "delivered" ? "delivered" : "promised", src: list("src"), company: list("mandant"), st: list("st"), pc: list("pc") };
  try {
    const store = await otdLinesNow();
    if (!store) return NextResponse.json({ at: null, customers: [] });
    const c = q.get("c"), view = q.get("view");
    if (c) return NextResponse.json({ at: store.at, customer: customerLines(store, f, c) });
    // ?view=suppliers: every supplier's on time and lead times; ?view=glc: GLC's kinds and the customers who received them
    if (view === "suppliers") return NextResponse.json({ at: store.at, suppliers: supplierList(store, f) });
    if (view === "glc") return NextResponse.json({ at: store.at, ...glcCustomers(store, f) });
    if (view === "articles") return NextResponse.json({ at: store.at, articles: articleList(store, f) });
    if (view === "leads") return NextResponse.json({ at: store.at, dist: leadBands(store, f) });
    // the list draws no month: the month map stays home (about a third of the answer)
    return NextResponse.json({ at: store.at, customers: customerList(store, f).map(({ m: _m, ...x }) => x) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
