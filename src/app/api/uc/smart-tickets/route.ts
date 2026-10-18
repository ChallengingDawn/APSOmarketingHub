// SMART SUB-TICKETS - the hub's page for the HubSpot app that creates sub-tickets from a ticket (cards in the hub's
// HubSpot app since 18.10.2026).
// GET ?from&to: the sub-tickets created in the period, by pipeline, GQS complete or not.
// GET ?form=1: the Create form's design - the draft, what is published, HubSpot's ticket properties, pipelines and
// owners to choose from, what is wrong with the draft.
// PUT (admins) {section, key?, value}: one piece of the draft (a section, or one GQS / PM form) - small, the hub
// refuses request bodies over 8 KB. POST (admins) {action: publish | discard | built-in}.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { smartTicketReport } from "@/lib/smartTickets/report";
import { BUILT_IN, catalog, changedPieces, discardDraft, draftToBuiltIn, getDraft, getPublished, history, problems, publishDraft, saveDraftPiece, type Section } from "@/lib/smartTickets/form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

async function formState() {
  const [draft, published, c, hist] = await Promise.all([getDraft(), getPublished(), catalog(), history()]);
  const live = published?.form ?? BUILT_IN;
  return {
    draft, live: published ? { version: published.version, at: published.at, by: published.by } : null,
    changed: changedPieces(draft, live), problems: problems(draft, c), history: hist,
    catalog: { properties: c.properties.map((p) => ({ name: p.name, label: p.label, fieldType: p.fieldType, options: p.options.slice(0, 60) })), pipelines: c.pipelines, owners: c.owners },
  };
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("form")) return NextResponse.json({ configured: true, ok: true, data: { ...(await formState()), admin: access.role === "admin" } });
    const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today();
    const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : to;
    return NextResponse.json({ configured: true, ok: true, data: { ...(await smartTicketReport(from, to)), from, to } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { section?: Section; key?: string | null; value?: unknown };
  try {
    if (!b.section) throw new Error("section?");
    const draft = await saveDraftPiece(b.section, b.key ?? null, b.value ?? null);
    const published = await getPublished();
    return NextResponse.json({ ok: true, data: { changed: changedPieces(draft, published?.form ?? BUILT_IN), problems: problems(draft, await catalog()) } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (b.action === "publish") {
      const r = await publishDraft(`user ${access.userId}`);
      return NextResponse.json({ ok: r.ok, data: r, ...(r.ok ? {} : { error: `${r.problems.length} thing(s) to fix first` }) });
    }
    if (b.action === "discard") { await discardDraft(); return NextResponse.json({ ok: true }); }
    if (b.action === "built-in") { await draftToBuiltIn(); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = (err as Error).message;
    // the hub's app needs the "files" permission, accepted once in HubSpot
    const scope = /scope|403|MISSING_SCOPES|permission/i.test(msg) ? " - the hub's HubSpot app needs the 'files' permission: accept the app's updated permissions in HubSpot." : "";
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) + scope }, { status: 500 });
  }
}
