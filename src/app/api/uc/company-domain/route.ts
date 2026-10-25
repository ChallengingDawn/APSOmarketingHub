// COMPANY DOMAIN - Map assignment > Domains (src/lib/companyDomain). Replaces the HubSpot workflow "SARCLA | COMPANY
// SETS DOMAIN", SARCLA 25.10.2026.
// GET: the mode, the last run, every company without a domain and what the hub gives it, the old name guesses.
// PUT (admins) {mode}: off, shadow (works it out, writes nothing) or live (writes once the workflow is switched off).
// POST (admins) {action}: "run" = look now, "scan" = find the old guesses, "clear" = clear the ones that do not exist.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, startClear, startGuessScan, type Mode } from "@/lib/companyDomain/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A list's rows sent to the page - the counts are always whole (after the dead guesses are cleared ~13,000 companies have
 *  no domain; the page needs the figures and a first page of each list, not every row). */
const PER_LIST = 1500;
type CoRow = Awaited<ReturnType<typeof pageState>>["state"]["rows"][number];
/** The tab's filters on the companies without a domain (DomainsView.tsx shows them). */
const FILTERS: Record<string, (x: CoRow) => boolean> = {
  all: () => true, found: (x) => !!x.v.domain, micro: (x) => x.v.micro, written: (x) => !!x.written && !x.written.error,
  generic: (x) => x.v.kind === "generic", noemail: (x) => x.v.kind === "noemail", nocontacts: (x) => x.v.kind === "nocontacts",
  contacts: (x) => x.v.kind === "contacts", website: (x) => x.v.kind === "website", deadsite: (x) => x.v.kind === "deadsite",
};

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    // companies without a domain: every filter counted, the newest rows of each sent
    const newest = [...s.state.rows].sort((a, b) => b.created.localeCompare(a.created));
    const counts: Record<string, number> = {};
    const keep = new Set<string>();
    for (const [k, f] of Object.entries(FILTERS)) {
      const hit = newest.filter(f);
      counts[k] = hit.length;
      for (const x of hit.slice(0, PER_LIST)) keep.add(x.id);
    }
    const state = { at: s.state.at, rows: newest.filter((x) => keep.has(x.id)), counts };
    // the old name guesses: a guess that exists and matches its contacts (or has none to say otherwise) is the firm's own
    // domain - counted, not listed; the ones to look at are those whose contacts write from another domain
    const g = s.guesses;
    const rows = g?.rows ?? [];
    const suspect = (r: (typeof rows)[number]) => r.exists === true && !!r.real && r.real !== r.domain;
    const dead = rows.filter((r) => r.exists === false).sort((a, b) => Number(!!b.real) - Number(!!a.real));
    const guesses = g && {
      ...g,
      counts: {
        total: rows.length, dead: dead.length, alive: rows.filter((r) => r.exists === true).length, suspect: rows.filter(suspect).length,
        unsure: rows.filter((r) => r.exists === null).length, deadWithReal: dead.filter((r) => r.real).length,
        cleared: rows.filter((r) => r.cleared && !r.cleared.error).length,
      },
      rows: [...dead.slice(0, PER_LIST), ...rows.filter(suspect).slice(0, PER_LIST), ...rows.filter((r) => r.exists === null).slice(0, PER_LIST)],
    };
    return NextResponse.json({ configured: true, ok: true, data: { ...s, state, guesses, admin: access.role === "admin" } });
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
  try {
    if (b.action === "run") {
      const r = await runOnce();
      return NextResponse.json({ ok: true, data: r ?? { skipped: "Off, or a run is already going" } });
    }
    if (b.action === "scan") { const r = await startGuessScan(`user ${access.userId}`); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    if (b.action === "clear") { const r = await startClear(`user ${access.userId}`); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
