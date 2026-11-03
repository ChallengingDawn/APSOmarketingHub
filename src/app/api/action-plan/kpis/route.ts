// THE KPIS A ROW OF THE PLAN IS MEASURED BY (planKpis.ts): a row's own and, for a category, those of the actions under
// it; picked from the library, a target or a figure set, one taken off, or the AI's proposal. Admins only, as the plan.
import { NextRequest, NextResponse } from "next/server";
import { planItems } from "@/lib/reporting/actionPlan";
import { addKpis, kpisOf, proposeKpis, removeKpi, setKpi } from "@/lib/reporting/planKpis";
import { fail } from "../../reporting/kpi-actions/guard";
import { planWho as who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const id = Number(req.nextUrl.searchParams.get("item"));
  if (!Number.isInteger(id)) return fail("item is a row's id", 400);
  try {
    const items = await planItems();
    // the actions under it, at any depth - their KPIs show on a category
    const under: number[] = [];
    const walk = (p: number) => { for (const i of items) if (i.parentId === p) { if (i.kind === "action") under.push(i.id); else walk(i.id); } };
    if (items.find((i) => i.id === id)?.kind !== "action") walk(id);
    const all = await kpisOf([id, ...under]);
    return NextResponse.json({ ok: true, kpis: all.filter((k) => k.item === id), under: all.filter((k) => k.item !== id) });
  } catch (e) { return fail(e, 502); }
}

const num = (v: unknown): number | null | undefined => (v === null ? null : typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string; item?: unknown; id?: unknown; picks?: unknown; target?: unknown; goodUp?: unknown; current?: unknown };
  try {
    if (b.action === "add") {
      if (!Number.isInteger(b.item) || !Array.isArray(b.picks)) return fail("a row and what is picked for it", 400);
      const picks = (b.picks as { key?: unknown; target?: unknown; goodUp?: unknown }[])
        .filter((p) => typeof p.key === "string").slice(0, 40)
        .map((p) => ({ key: p.key as string, target: num(p.target) ?? null, goodUp: p.goodUp !== false }));
      return NextResponse.json({ ok: true, added: await addKpis(b.item as number, picks, w.name) });
    }
    if (b.action === "set") {
      if (!Number.isInteger(b.id)) return fail("which KPI", 400);
      const k = await setKpi(b.id as number, { target: num(b.target), goodUp: typeof b.goodUp === "boolean" ? b.goodUp : undefined, current: num(b.current) }, w.name);
      return k ? NextResponse.json({ ok: true, kpi: k }) : fail("no such KPI", 404);
    }
    if (b.action === "remove") {
      if (!Number.isInteger(b.id)) return fail("which KPI", 400);
      return NextResponse.json({ ok: true, removed: await removeKpi(b.id as number, w.name) });
    }
    if (b.action === "propose") {
      if (!Number.isInteger(b.item)) return fail("which row", 400);
      return NextResponse.json({ ok: true, ...(await proposeKpis(b.item as number)) });
    }
    return fail("action is add, set, remove or propose", 400);
  } catch (e) { return fail(e, 502); }
}
