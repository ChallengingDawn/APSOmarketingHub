// CONTACT LINK - Duplicates & merges > Contacts > By e-mail domain (src/lib/contactLink). Replaces the HubSpot workflow
// "SARCLA | UNASSIGNED CONTACTS -> COMPANIES", SARCLA 10.11.2026.
// GET: how it runs, the figures, the contacts it links (or would link) next, those whose domain has several companies, and
// the links it made. PUT (admins) {mode}: off / shadow (works it out, links nothing) / live. POST (admins) {action:"run"}.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, type Mode } from "@/lib/contactLink/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_LIST = 1500;
const DAY = 86400_000;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const rows = s.state?.rows ?? [];
    const byNewest = (a: { created: string }, b: { created: string }) => b.created.localeCompare(a.created);
    const next = rows.filter((r) => r.v.company).sort(byNewest);
    const several = rows.filter((r) => r.v.kind === "several").sort(byNewest);
    const since = Date.now() - 30 * DAY;
    return NextResponse.json({ configured: true, ok: true, data: {
      settings: s.settings, last: s.last, workflowOn: s.workflowOn, writing: s.writing, admin: access.role === "admin",
      at: s.state?.at ?? null, total: s.state?.total ?? 0, counts: s.state?.counts ?? null,
      next: next.slice(0, PER_LIST), nextCount: next.length, several: several.slice(0, PER_LIST), severalCount: s.state?.counts.several ?? several.length,
      links: s.links.slice(0, PER_LIST), linked30: s.links.filter((l) => Date.parse(l.at) >= since).length,
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
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  // a run reads every contact without a company (a minute or two): started, not waited for
  void runOnce().catch((e) => console.warn(`[contact-link] ${(e as Error).message}`));
  return NextResponse.json({ ok: true, data: { started: true } });
}
