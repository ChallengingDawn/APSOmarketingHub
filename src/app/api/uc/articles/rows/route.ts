// Every article, a page at a time - filtered (profit centre, main group, sub group, product, article), searched and sorted on
// the server: 25 a page (SARCLA 01.11.2026: "the articles list sortable and searchable, 25 a page"). With level=product (or
// group, sub): that level's values instead, with their figures - the products are too many to send with the page's figures.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { loadBuyers, loadReport } from "@/lib/integrations/articleReport";
import { articlePage, bucketPage, bucketsOf, filtersOf, type ArtSort, type Bucket, type BucketSort } from "@/lib/articles/explore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A level's values for the same filters on the same build, kept - the next page, a sort, a search answer at once. */
const kept = new Map<string, Bucket[]>();

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await loadReport();
  if (!report) return NextResponse.json({ configured: true, ok: true, data: { total: 0, page: 0, size: 25, rows: [], sum: { revCy: 0, revLyYtd: 0, revLy: 0 } } });
  const sp = req.nextUrl.searchParams;
  const desc = sp.get("desc");
  const filters = filtersOf((d) => sp.getAll(d));
  const o = {
    q: (sp.get("q") ?? "").slice(0, 80),
    desc: desc === "1" ? true : desc === "0" ? false : undefined,
    page: Math.max(0, Number(sp.get("page")) || 0),
    size: Math.max(1, Math.min(50, Number(sp.get("size")) || 25)),
  };
  const level = sp.get("level");
  if (level === "product" || level === "group" || level === "sub") {
    const buyers = await loadBuyers(report);
    const key = `${report.generated}|${buyers ? 1 : 0}|${level}|${JSON.stringify(filters)}`;
    let all = kept.get(key);
    if (!all) {
      all = bucketsOf(report.rows, filters, level, buyers);
      if (kept.size >= 20) kept.delete(kept.keys().next().value!);
      kept.set(key, all);
    }
    return NextResponse.json({ configured: true, ok: true, data: bucketPage(all, { ...o, sort: (sp.get("sort") as BucketSort | null) ?? null }) });
  }
  const data = articlePage(report.rows, filters, { ...o, sort: (sp.get("sort") as ArtSort | null) ?? null });
  return NextResponse.json({ configured: true, ok: true, data });
}
