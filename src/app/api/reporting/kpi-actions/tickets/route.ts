// A tile's "From Scroll to Sale" tickets (SARCLA 18.10.2026):
//   GET ?tile=&ctx=<json>   the linked tickets as HubSpot has them, the form and its prefill
//   GET ?search=<words>     the pipeline's tickets to link (newest first when empty)
//   POST {action:"create", tile, taskId?, values}   a new ticket, linked to the tile (and its task)
//   POST {action:"link", tile, taskId?, ids}        1..n existing open tickets linked
// A ticket belongs to the task it is made for (SARCLA 18.10: "inside of the task").
//   POST {action:"unlink", tile, id}
import { NextRequest, NextResponse } from "next/server";
import { linkTickets, ticketsOf, unlinkTicket } from "@/lib/reporting/kpiActions";
import { createTicket, ownerOf, readTickets, s2sForm, searchTickets, ticketUrl } from "@/lib/reporting/scrollToSale";
import { missingRequired, prefill, type TileContext } from "@/lib/reporting/scrollToSaleRules";
import { describeIntegrationError } from "@/lib/integrations/status";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tileOk = (t: unknown): t is string => typeof t === "string" && /^[a-z0-9-]+:[^\s]{0,80}$/i.test(t);
const hsFail = (e: unknown) => NextResponse.json({ ok: false, ...describeIntegrationError(e) }, { status: 502 });

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.has("search")) return NextResponse.json({ ok: true, tickets: await searchTickets(sp.get("search") ?? "") });
    const tile = sp.get("tile");
    if (!tileOk(tile)) return fail("tile is missing", 400);
    let ctx: TileContext | null = null;
    try { ctx = JSON.parse(sp.get("ctx") ?? "null"); } catch { ctx = null; }
    const [links, form] = await Promise.all([ticketsOf(tile), s2sForm()]);
    const linked = await readTickets(links.map((l) => l.ticketId));
    const me = ownerOf(form, w.email);
    const team = me?.teams.find((t) => t.primary) ?? me?.teams[0];
    const options = Object.fromEntries(form.fields.filter((f) => f.options).map((f) => [f.name, f.options!]));
    const values = ctx ? prefill({ ...ctx, page: ctx.page || tile.split(":")[0] }, { options, ownerId: me?.id, teamId: team?.id, year: new Date().getFullYear(), takenRoadmapIds: form.takenRoadmapIds }) : {};
    return NextResponse.json({
      ok: true, canWrite: w.canWrite,
      linked: linked.map((t) => { const l = links.find((x) => x.ticketId === t.id); return { ...t, createdHere: l?.created ?? false, taskId: l?.taskId ?? null }; }),
      form: { fields: form.fields, stages: form.stages.map((s) => ({ value: s.value, label: s.label })), owners: form.owners.map((o) => ({ value: o.id, label: o.name })), teams: form.teams },
      prefill: values, me: me ? { id: me.id, name: me.name } : null,
    });
  } catch (e) {
    return hsFail(e);
  }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string; tile?: string; taskId?: number; values?: Record<string, string>; ids?: string[]; id?: string };
  if (!tileOk(b.tile)) return fail("tile is missing", 400);
  const taskId = Number.isInteger(b.taskId) ? (b.taskId as number) : null;
  try {
    if (b.action === "create") {
      const missing = missingRequired(b.values ?? {});
      if (missing.length) return fail(`still to fill in: ${missing.join(", ")}`, 400);
      const id = await createTicket(b.values ?? {});
      await linkTickets(b.tile, [id], w.name, true, taskId);
      console.log(`[kpi-actions] ticket ${id} created from tile ${b.tile} by ${w.name}`);
      return NextResponse.json({ ok: true, id, url: ticketUrl(id) });
    }
    if (b.action === "link") {
      const ids = (b.ids ?? []).map(String).filter((x) => /^\d+$/.test(x)).slice(0, 50);
      if (!ids.length) return fail("no ticket to link", 400);
      // only tickets of the pipeline: what HubSpot returns for the ids
      const found = await readTickets(ids);
      await linkTickets(b.tile, found.map((t) => t.id), w.name, false, taskId);
      return NextResponse.json({ ok: true, linked: found.length });
    }
    if (b.action === "unlink" && b.id) {
      await unlinkTicket(b.tile, String(b.id));
      return NextResponse.json({ ok: true });
    }
    return fail("action is create, link or unlink", 400);
  } catch (e) {
    return hsFail(e);
  }
}
