// The companies behind a Customer Reports graph (SARCLA 31.10.2026: "allow to see the companies ... paginated by 25"): the
// graph's list, its filters, period and amount "at least" in, a page of 25 out - the cube's lists (ledger.ts companiesOf),
// with the Customer Reports' own: won back, lost, at risk, decreasing, the top 10%, one profit centre … (customerRules.ts).
// A small POST (the 8 KB rule). Advanced reporting's grant to read, as the cube itself.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customersCube, customersLedger } from "@/lib/marketingKpis/customers";
import { COMPANY_SORTS, companiesOf, type CompanyBy, type CompanyQuery, type CompanySort } from "@/lib/marketingKpis/ledger";
import { DIMS, lastMonth, type Filters } from "@/lib/marketingKpis/cube";
import { CUSTOMER_BY } from "@/lib/marketingKpis/customerRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BY = /^(cust|new)$/;
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
    const start = Number(win?.start), end = Number(win?.end), min = Number(b.min ?? 0);
    const by = String(b.by ?? "");
    const cohort = b.cohort == null ? null : Number(b.cohort);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || !(BY.test(by) || CUSTOMER_BY.test(by)) || !Number.isFinite(min) || min < 0
      || (cohort != null && !Number.isInteger(cohort))) return NextResponse.json({ ok: false, error: "Bad query" }, { status: 400 });
    const raw = (b.filters ?? {}) as Record<string, unknown>;
    const filters: Filters = {};
    for (const d of DIMS) { const v = strings(raw[d], 500); if (v.length) filters[d] = v; }
    const cube = (await customersCube()).value;
    const ledger = cube ? await customersLedger(cube) : null;
    if (!cube || !ledger || (/^(lost|rec:3|recall|custlost)$/.test(by) && !ledger.orders)) return NextResponse.json({ ok: true, pending: true });
    // inside the three years read: the 12 months to a month may start before the first one a period can (in12)
    const last = lastMonth(cube);
    const q: CompanyQuery = {
      filters, win: { start: Math.max(0, Math.min(start, last)), end: Math.max(0, Math.min(end, last)) }, by: by as CompanyBy,
      ids: strings(b.ids, 50).filter((x) => /^\d+$/.test(x)),
      q: typeof b.q === "string" ? b.q.slice(0, 80) : "",
      sort: sortOf(b.sort), min: Math.min(min, 10_000_000), cohort,
      page: Number.isInteger(b.page) ? Number(b.page) : 0, size: 25,
    };
    return NextResponse.json({ ok: true, ...companiesOf(cube, ledger, q) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
