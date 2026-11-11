// CONTACT NAMES - Duplicates & merges > Contacts > Name letters (src/lib/contactNames). Replaces the HubSpot workflow
// "SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE", SARCLA 10.11.2026.
// GET: how it runs, the names for a person, the hub's repairs of the last 30 days.
// POST {action: "set", id, first, last} / {action: "right", id} (anyone who may open the tab): a person's name, or "the name
// is right". POST (admins) {action: "run"} = look now. PUT (admins) {mode}: live / shadow / off.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { markRight, nameKey, pageState, runOnce, saveSettings, setName, type Mode } from "@/lib/contactNames/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A name for a person: what HubSpot has, and the fix's proposal when it has one it is not sure of. */
export type NameRow = { id: string; first: string; last: string; email: string; created: string; proposal: { first: string; last: string } | null };
/** A name the hub repaired (or a person wrote). */
export type DoneRow = { id: string; before: string; after: string; at: string; by: string | null; email: string };
const DAY = 86400_000;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const person: NameRow[] = [];
    const done: DoneRow[] = [];
    const since = Date.now() - 30 * DAY;
    for (const r of s.state.rows) {
      const w = r.written && !r.written.error ? r.written : null;
      if (w && Date.parse(w.at) >= since) {
        done.push({ id: r.id, before: w.before ?? `${r.first} ${r.last}`.trim(), after: `${w.first ?? r.first} ${w.last ?? r.last}`.trim(), at: w.at, by: w.by ?? null, email: r.email });
      }
      // a sure repair waits for its write (Live, the workflow off); everything else is for a person, unless they said it is
      // right (a name a person wrote counts as said right) - a repaired name HubSpot's list still flags (João) shows too
      if (r.v.status === "sure") continue;
      if (s.right[r.id]?.name === nameKey(r.first, r.last)) continue;
      person.push({ id: r.id, first: r.first, last: r.last, email: r.email, created: r.created, proposal: r.v.proposal ?? null });
    }
    person.sort((a, b) => Number(!!b.proposal) - Number(!!a.proposal) || b.created.localeCompare(a.created));
    done.sort((a, b) => b.at.localeCompare(a.at));
    const waiting = s.state.rows.filter((r) => r.v.status === "sure" && !(r.written && !r.written.error)).length;
    return NextResponse.json({ configured: true, ok: true, data: {
      settings: s.settings, last: s.last, workflowOn: s.workflowOn, writing: s.writing, admin: access.role === "admin",
      person, done, waiting, rightCount: Object.keys(s.right).length,
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode };
  if (!b.mode || !["off", "shadow", "live"].includes(b.mode)) return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  return NextResponse.json({ ok: true, data: await saveSettings(b.mode, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; first?: string; last?: string };
  const id = String(b.id ?? "").trim();
  try {
    if (b.action === "set" || b.action === "right") {
      if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ ok: false, error: "A contact is needed" }, { status: 400 });
      if (b.action === "right") { const r = await markRight(id, `user ${access.userId}`); return NextResponse.json({ ok: r.ok, data: r, error: r.why }); }
      const first = String(b.first ?? ""), last = String(b.last ?? "");
      if (first.length > 100 || last.length > 100) return NextResponse.json({ ok: false, error: "A name of up to 100 letters" }, { status: 400 });
      const r = await setName(id, first, last, `user ${access.userId}`);
      return NextResponse.json({ ok: r.ok, data: r, error: r.why });
    }
    if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    if (b.action === "run") {
      const r = await runOnce();
      return NextResponse.json({ ok: true, data: r ?? { skipped: "Off, or a run is already going" } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
