// The Customer Reports' figures (SARCLA 01.11.2026 on Customer Reports: "based on what we know, think about what kind of
// dynamic KPI would be interesting here"): one page's figures for a period and the Filters, worked out here from the
// companies kept beside the customers' cube (customerKpis.ts) - the companies never go to the browser. A small POST
// (the 8 KB rule in front of the hub). Advanced reporting's grant to read, as the cube itself.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customersCube, customersLedger } from "@/lib/marketingKpis/customers";
import { DIMS, clampWindow, type Filters } from "@/lib/marketingKpis/cube";
import { KPI_PAGES, customerKpis, type KpiOut, type KpiPage, type KpiQuery } from "@/lib/marketingKpis/customerKpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);
/** The last answers, by the read and the question - a tab or a page opened again is answered at once. */
const memo = new Map<string, KpiOut>();

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const page = String(b.page ?? "") as KpiPage;
    const win = b.win as { start?: unknown; end?: unknown } | undefined;
    const start = Number(win?.start), end = Number(win?.end), min = Number(b.min ?? 0);
    if (!KPI_PAGES.includes(page) || !Number.isInteger(start) || !Number.isInteger(end) || start > end || !Number.isFinite(min) || min < 0) {
      return NextResponse.json({ ok: false, error: "Bad query" }, { status: 400 });
    }
    const raw = (b.filters ?? {}) as Record<string, unknown>;
    const filters: Filters = {};
    for (const d of DIMS) { const v = strings(raw[d], 500); if (v.length) filters[d] = v; }
    const state = await customersCube();
    const cube = state.value;
    const ledger = cube ? await customersLedger(cube) : null;
    // the read before the lists (or before each company's first and last order): the next one brings them, on its own
    if (!cube || !ledger || ((page === "base" || page === "recency") && !ledger.orders)) return NextResponse.json({ ok: true, pending: true, progress: state.progress ?? null });
    const q: KpiQuery = { page, filters, win: clampWindow(cube, { start, end }), ids: strings(b.ids, 50).filter((x) => /^\d+$/.test(x)), min: Math.min(min, 10_000_000) };
    const key = `${cube.generatedAt}|${JSON.stringify(q)}`;
    let out = memo.get(key);
    if (!out) {
      out = customerKpis(cube, ledger, q);
      memo.set(key, out);
      if (memo.size > 60) memo.delete(memo.keys().next().value!);
    }
    return NextResponse.json({ ok: true, computing: !!state.computing, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
