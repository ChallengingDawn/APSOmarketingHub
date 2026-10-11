// THE SHOP-ORDER SYNC (connectors/magento/sync.ts) for its pages: the mode, the overview's
// charts (with the web orders reaching HubSpot per day, counted in HubSpot), the sweeps, the
// staged orders, the held ones and the contacts still to link, and the side-by-side test
// against what the old connector wrote (GET, anyone who may open Connectors & Integration);
// the mode switch and the per-order retry / set aside / link again (POST, admins only).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { act, compareWithHubSpot, overview, readBack, rows, setMode, status, sweeps, type Mode, type SweepFilter } from "@/lib/connectors/magento/sync";
import { flowStale, shopFlow } from "@/lib/connectors/flow";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const view = req.nextUrl.searchParams.get("view") ?? "status";
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  try {
    if (view === "orders" || view === "held" || view === "contacts") {
      return NextResponse.json({ ok: true, data: await rows(view, page, { state: sp.get("state") ?? undefined, find: sp.get("q")?.slice(0, 80) }) });
    }
    if (view === "overview") {
      // the daily count is made in the background and kept an hour - read what is there
      const f = await shopFlow.held();
      if (flowStale(f) && !shopFlow.running(f)) shopFlow.refresh();
      const flow = { days: f?.days ?? [], at: f?.at || null, counting: shopFlow.running(f) || flowStale(f), error: f?.error ?? null };
      return NextResponse.json({ ok: true, data: { ...(await overview()), flow } });
    }
    if (view === "sweeps") {
      const filter = (["busy", "failed", "all"].includes(sp.get("filter") ?? "") ? sp.get("filter") : "busy") as SweepFilter;
      return NextResponse.json({ ok: true, data: await sweeps(filter, page) });
    }
    if (view === "compare") return NextResponse.json({ ok: true, data: await compareWithHubSpot() });
    return NextResponse.json({ ok: true, data: { ...(await status()), admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; mode?: string; id?: string };
  try {
    if (b.action === "mode" && (b.mode === "off" || b.mode === "stage" || b.mode === "active")) {
      const r = await setMode(b.mode as Mode);
      console.log(`[magento] mode -> ${b.mode} by user ${access.userId}${r.marked ? ` (${r.marked} staged orders marked as written by the old connector)` : ""}`);
      return NextResponse.json({ ok: true, data: { note: `Shop orders: ${b.mode === "active" ? "the hub writes them now" : b.mode === "stage" ? "the hub reads only" : "switched off"}${r.marked ? ` - ${r.marked} orders the old connector already wrote are marked as done` : ""}` } });
    }
    if (b.action === "readback") {
      // a few minutes for a week of orders - longer than a request may wait, so in the background
      void readBack(7).catch((e) => console.warn(`[magento] read back: ${(e as Error).message}`));
      return NextResponse.json({ ok: true, data: { note: "Reading back the last 7 days of shop orders - a few minutes; nothing is written to HubSpot. Then Compare now." } });
    }
    if ((b.action === "retry" || b.action === "cancel" || b.action === "relink") && b.id && /^\d+$/.test(b.id)) {
      const done = await act(b.id, b.action);
      return NextResponse.json({ ok: done, data: { note: done ? "Done - the next sweep takes it up" : "Nothing to do for this order" } }, { status: done ? 200 : 409 });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
