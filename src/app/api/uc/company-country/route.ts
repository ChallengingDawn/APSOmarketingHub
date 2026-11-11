// DUPLICATES & MERGES > Companies > Country (src/lib/companyCountry). Replaces the HubSpot workflow "SARCLA | REGION TO COUNTRY CUSTOM",
// SARCLA 11.11.2026.
// GET: how it runs, the figures, the companies still without a value (the rule's value, or none: for a person), the
// values written (30 days) and the dropdown's values.
// POST {action: "set", id, value} (UC users): a person picks the value for one company. POST {action: "run"} and
// PUT {mode} (admins): look now (started, not waited for); live / shadow / off.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, setCountry, type Mode } from "@/lib/companyCountry/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_LIST = 1500;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const rows = s.state?.rows ?? [];
    const done = rows.filter((r) => r.written && !r.written.error).sort((a, b) => b.written!.at.localeCompare(a.written!.at));
    const waiting = rows.filter((r) => !(r.written && !r.written.error)).sort((a, b) => Number(!!a.value) - Number(!!b.value) || b.created.localeCompare(a.created));
    return NextResponse.json({ configured: true, ok: true, data: {
      settings: s.settings, last: s.last, workflowOn: s.workflowOn, writing: s.writing, admin: access.role === "admin",
      at: s.state?.at ?? null, withCountry: s.state?.withCountry ?? null, withValue: s.state?.withValue ?? null,
      waiting: waiting.slice(0, PER_LIST), waitingCount: waiting.length, forPerson: waiting.filter((r) => !r.value).length,
      done: done.slice(0, PER_LIST), doneCount: done.length, options: s.options,
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
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; value?: string };
  if (b.action === "set") {
    if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
    const id = String(b.id ?? "").trim(), value = String(b.value ?? "").trim();
    if (!/^\d+$/.test(id) || !value) return NextResponse.json({ ok: false, error: "A company and a value, please" }, { status: 400 });
    try {
      const r = await setCountry(id, value, `user ${access.userId}`);
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.ok ? 200 : 409 });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 502 });
    }
  }
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  void runOnce().catch((e) => console.warn(`[company-country] ${(e as Error).message}`));
  return NextResponse.json({ ok: true, data: { started: true } });
}
