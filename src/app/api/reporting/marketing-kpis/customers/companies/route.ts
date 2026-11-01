// The companies behind a chart of the customers' cube (Who are our customers, the ESO Figures, New customers): the chart's
// filters, window and figure in, a page of 25 out (SARCLA 31.10.2026: "allow to see the companies ... paginated by 25").
// Advanced reporting's grant to read, as the cube itself.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customersCube, customersLedger } from "@/lib/marketingKpis/customers";
import { COMPANY_SORTS, companiesOf, type CompanyBy, type CompanyQuery, type CompanySort } from "@/lib/marketingKpis/ledger";
import { DIMS, type Filters } from "@/lib/marketingKpis/cube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BY = /^(rev|oi|cust|new|all|pc:[a-z0-9_-]{1,20})$/;
const sortOf = (v: unknown): CompanyQuery["sort"] => {
  const o = v as { key?: unknown; desc?: unknown } | null;
  return o && (COMPANY_SORTS as readonly string[]).includes(String(o.key)) ? { key: o.key as CompanySort, desc: o.desc === true } : null;
};
const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const win = b.win as { start?: unknown; end?: unknown } | undefined;
    const start = Number(win?.start), end = Number(win?.end);
    const by = String(b.by ?? "rev");
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || !BY.test(by)) return NextResponse.json({ ok: false, error: "Bad query" }, { status: 400 });
    const raw = (b.filters ?? {}) as Record<string, unknown>;
    const filters: Filters = {};
    for (const d of DIMS) { const v = strings(raw[d], 500); if (v.length) filters[d] = v; }
    const q: CompanyQuery = {
      filters, win: { start, end }, by: by as CompanyBy,
      erp: b.erp === "ytd" || b.erp === "mtd" ? b.erp : null,
      ids: strings(b.ids, 50).filter((x) => /^\d+$/.test(x)),
      q: typeof b.q === "string" ? b.q.slice(0, 80) : "",
      sort: sortOf(b.sort),
      page: Number.isInteger(b.page) ? Number(b.page) : 0, size: 25,
    };
    const cube = (await customersCube()).value;
    const ledger = cube ? await customersLedger(cube) : null;
    // the read before the lists: the next one brings them (it starts on its own)
    if (!cube || !ledger) return NextResponse.json({ ok: true, pending: true });
    return NextResponse.json({ ok: true, ...companiesOf(cube, ledger, q) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
