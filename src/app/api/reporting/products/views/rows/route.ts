// Products Reports > Views against orders: every product viewed under the period and the filters, a page at a time - searched
// and sorted on the server, 25 a page (the products are too many to send with the page's figures). Also the Filters window's
// product search (size=8).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { productPlaces, viewsSource } from "@/lib/products/viewsOrdersRead";
import { clampWin, productPage, productsOf, vFiltersOf, type ProductSort } from "@/lib/products/viewsOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const monthIn = (s: string | null, year: number) => (s && /^\d{4}-\d{2}$/.test(s) && Number(s.slice(0, 4)) === year ? Number(s.slice(5, 7)) - 1 : undefined);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const sp = req.nextUrl.searchParams;
    const [state, { places }] = await Promise.all([viewsSource(), productPlaces()]);
    const d = state.value;
    if (!d?.products) return NextResponse.json({ configured: true, ok: true, data: { total: 0, page: 0, size: 25, rows: [] } });
    const win = clampWin(d.monthsDone, { start: monthIn(sp.get("from"), d.year), end: monthIn(sp.get("to"), d.year) });
    const desc = sp.get("desc");
    const data = productPage(productsOf(d, places, win), vFiltersOf((x) => sp.getAll(x)), {
      q: (sp.get("q") ?? "").slice(0, 80), sort: (sp.get("sort") as ProductSort | null) ?? null,
      desc: desc === "1" ? true : desc === "0" ? false : undefined,
      page: Math.max(0, Number(sp.get("page")) || 0), size: Math.max(1, Math.min(50, Number(sp.get("size")) || 25)),
    });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
