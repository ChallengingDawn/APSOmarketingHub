// Products Reports > Views against orders (SARCLA 01.11.2026: "we should really create subtabs" - his pick): for the period and
// the filters in the address, the page's figures, each breakdown (profit centre, main group, sub group), the months and the
// most viewed products bought online or not. From the Engage read and Articles CY/LY's hierarchy as they are kept
// (src/lib/products/viewsOrdersRead.ts) - the products' list is paged by ./rows. Advanced reporting's grant to read.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { productPlaces, viewsSource } from "@/lib/products/viewsOrdersRead";
import { summaryOf, vFiltersOf, type VSummary } from "@/lib/products/viewsOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The same filters on the same reads answer at once - a click back to a view already seen. */
const kept = new Map<string, VSummary>();
/** "2026-03" -> 2 (March), this year's only */
const monthIn = (s: string | null, year: number) => (s && /^\d{4}-\d{2}$/.test(s) && Number(s.slice(0, 4)) === year ? Number(s.slice(5, 7)) - 1 : undefined);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const sp = req.nextUrl.searchParams;
    const filters = vFiltersOf((d) => sp.getAll(d));
    const [state, { places, generated }] = await Promise.all([viewsSource(), productPlaces()]);
    const d = state.value;
    const wait = { computing: state.computing, progress: state.progress ?? null, error: state.error ?? d?.errors?.products ?? null };
    if (!d || !d.products) return NextResponse.json({ configured: true, ok: true, data: { state: wait, summary: null, filters } });
    const win = { start: monthIn(sp.get("from"), d.year), end: monthIn(sp.get("to"), d.year) };
    const key = `${d.generatedAt}|${generated ?? ""}|${win.start}-${win.end}|${JSON.stringify(filters)}`;
    let summary = kept.get(key);
    if (!summary) {
      summary = summaryOf(d, places, filters, win);
      if (kept.size >= 40) kept.delete(kept.keys().next().value!);
      kept.set(key, summary);
    }
    return NextResponse.json({ configured: true, ok: true, data: { state: wait, summary, filters, articlesBuilt: generated } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
