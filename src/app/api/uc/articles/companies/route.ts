// The companies behind a graph of Articles CY/LY (SARCLA 01.11.2026: "Articles rebuilt like Figures" - the Companies button
// "where it is honest: the companies that bought those articles"): the graph's filters in - or its own articles, the movers -
// and a page of 25 out, each company with its revenue on those articles. The buyers are kept beside the report by its build;
// a report built before them has none (the page then shows no button). A body, not an address: a list of chosen products
// or articles can be long (the hub's WAF stops an address past ~2 KB; a body may be 8 KB).

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { loadBuyers, loadReport } from "@/lib/integrations/articleReport";
import { COMPANY_SORTS, companiesOf, filtersOf, matching, searched, type CompanySort } from "@/lib/articles/explore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const report = await loadReport();
    const buyers = report ? await loadBuyers(report) : null;
    if (!report || !buyers) return NextResponse.json({ ok: false, error: "The companies come with the next build of the report." }, { status: 404 });
    const raw = (b.filters ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(b.ids) ? new Set(b.ids.filter((x): x is string => typeof x === "string").slice(0, 100)) : null;
    // the graph's articles: its own (the movers), or those its filters and search leave
    const rows = ids?.size ? report.rows.filter((r) => ids.has(r.article))
      : searched(matching(report.rows, filtersOf((d) => raw[d])), typeof b.q === "string" ? b.q.slice(0, 80) : "");
    const s = b.sort as { key?: unknown; desc?: unknown } | null | undefined;
    const sort = s && (COMPANY_SORTS as readonly string[]).includes(String(s.key)) ? { key: s.key as CompanySort, desc: s.desc === true } : null;
    const page = companiesOf(rows, buyers, {
      q: typeof b.cq === "string" ? b.cq.slice(0, 80) : "",
      sort: sort?.key ?? null, desc: sort ? sort.desc : undefined,
      page: Number.isInteger(b.page) ? Number(b.page) : 0, size: 25,
    });
    return NextResponse.json({ ok: true, ...page });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
