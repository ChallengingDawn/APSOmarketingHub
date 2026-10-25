// CONTACT PHONE - Map assignment > Phone numbers (src/lib/contactPhone). Replaces the HubSpot workflow "SARCLA | Contact
// phone number correction", SARCLA 25.10.2026 - automatic since the same evening ("this should be correct once and then
// automatic"): the page shows only what needs a person.
// GET: how it runs, and the phone numbers for a person - the phones in HubSpot with no certain repair (checked once a
//      day) and the contacts whose shop phone is not a valid number.
// POST {action: "set", id, phone} (anyone who may open the tab): a person's number - checked, then written, logged.
// POST (admins) {action}: "run" = look now, "scan" = check every phone again. PUT (admins) {mode}: live / shadow / off.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, setPhone, startScan, type Mode } from "@/lib/contactPhone/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One row of "Phone numbers for a person": a phone that is not valid, or (phone "") a shop phone that is not. */
export type PersonRow = { id: string; name: string; email: string; country: string; phone: string; shop: string; hint: string | null; created: string };
const DAY = 86400_000;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const person: PersonRow[] = [];
    const seen = new Set<string>();
    for (const r of s.state.rows) {
      if (r.v.status !== "invalid" || (r.written && !r.written.error)) continue;
      seen.add(r.id);
      person.push({ id: r.id, name: r.name, email: r.email, country: r.v.country, phone: "", shop: r.shop, hint: r.v.asWorkflow ?? null, created: r.created });
    }
    for (const r of s.bad?.rows ?? []) {
      if (r.repair || (r.repaired && !r.repaired.error) || seen.has(r.id)) continue;
      person.push({ id: r.id, name: r.name, email: r.email, country: r.country, phone: r.phone, shop: r.shop, hint: null, created: r.created });
    }
    person.sort((a, b) => b.created.localeCompare(a.created));
    const since = Date.now() - 30 * DAY;
    const recent = (at?: string) => !!at && Date.parse(at) >= since;
    const done = {
      filled: s.state.rows.filter((r) => r.written && !r.written.error && recent(r.written.at)).length,
      repaired: (s.bad?.rows ?? []).filter((r) => r.repaired && !r.repaired.error && !r.repaired.by && recent(r.repaired.at)).length,
      byHand: (s.bad?.rows ?? []).filter((r) => r.repaired && !r.repaired.error && r.repaired.by && recent(r.repaired.at)).length,
    };
    return NextResponse.json({ configured: true, ok: true, data: {
      settings: s.settings, last: s.last, workflowOn: s.workflowOn, writing: s.writing, admin: access.role === "admin",
      checked: s.bad ? { at: s.bad.at, scanned: s.bad.scanned } : null, person, done,
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
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; phone?: string };
  try {
    if (b.action === "set") {
      const id = String(b.id ?? "").trim(), phone = String(b.phone ?? "").trim();
      if (!/^\d{1,20}$/.test(id) || !phone || phone.length > 40) return NextResponse.json({ ok: false, error: "A contact and a number are needed" }, { status: 400 });
      const r = await setPhone(id, phone, `user ${access.userId}`);
      return NextResponse.json({ ok: r.ok, data: r, error: r.why });
    }
    if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    if (b.action === "run") {
      const r = await runOnce();
      return NextResponse.json({ ok: true, data: r ?? { skipped: "Off, or a run is already going" } });
    }
    if (b.action === "scan") { const r = await startScan(); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
