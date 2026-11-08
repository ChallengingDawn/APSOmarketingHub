// CERTIFICATES - UC & HubSpot Apps > Certificates (src/lib/certificates), run by the hub (SARCLA 04-07.11.2026).
// GET: the mode, the people, the last look, the open tickets with their step, what the hub did (or would do), the year.
// PUT (admins) {mode} or {people}: off / preview (lists, writes nothing) / live (writes);
//      the Back Office rotation, the conformity experts, who gets a ticket after 15 days.
// PUT (admins) {mails: {owner?, team?, created?, avor?}} the console's mail switches (avor = the card's "Send to AVOR"); {timing: {...} | "default"} the times
//      and waits (rules.ts TIMING_BOUNDS); {hold: ticketId} / {release: ticketId} - the hub leaves a ticket alone;
//      {teamTo: [ownerId]} who also gets the reminder on every other ticket in Remind - its owner always does (never a
//      queue user - its address is an inbox);
//      {erpDates: "off" | "show" | "write"} follow the ERP's delivery date; {shop: "off" | "preview" | "live"} tickets
//      from the shop's orders with the declaration line.
// PUT (admins) {steps: {avor?, bo?, expert?, handover?}} the step groups on / off (off = skipped, not taken later).
// GET ?preview=<bo3days|boToday|bo48|bo96|boWeek|boRose|team|created|avor|declCustomer|declEda>[&lang=de]: that mail as it would go out, nothing sent.
// POST (admins) {action: "run"} = look now; {action: "sample", mail?} = that mail (default "due today") for an open request, to
//      the admin asking (never an inbox).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { MAIL_KEYS, pageState, previewMail, runOnce, saveSettings, sendSample, type MailKey, type Mails, type Mode, type SettingsPatch } from "@/lib/certificates/engine";
import { timingProblem, type People, type Timing } from "@/lib/certificates/rules";
import { INBOX_OWNERS, isInbox } from "@/lib/notify/teamRecipients";
import { DEFAULT_STEPS, type StepSwitches } from "@/lib/certificates/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function me(userId: number): Promise<string> {
  const r = await query<{ full_name: string | null; username: string | null }>(`SELECT full_name, username FROM apsomh_users WHERE id = $1`, [userId]).catch(() => ({ rows: [] }));
  const u = r.rows[0];
  return u?.full_name?.trim() || u?.username || `user ${userId}`;
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    // ?preview=<mail>: that mail as it would go out today, on a real ticket (the Mails tab) - nothing is sent
    const preview = req.nextUrl.searchParams.get("preview");
    if (preview !== null) {
      if (!MAIL_KEYS.includes(preview as MailKey)) return NextResponse.json({ ok: false, error: "Unknown mail" }, { status: 400 });
      return NextResponse.json({ ok: true, data: await previewMail(preview as MailKey, { lang: req.nextUrl.searchParams.get("lang") }) });
    }
    return NextResponse.json({ configured: true, ok: true, data: { ...(await pageState()), admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= 12 && v.every((x) => typeof x === "string" && /^\d+$/.test(x));

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; people?: Partial<People>; mails?: Partial<Mails>; timing?: Partial<Timing> | "default"; hold?: string; release?: string; teamTo?: string[]; erpDates?: string; shop?: string; steps?: Partial<StepSwitches>; makerSend?: string };
  if (b.mode !== undefined && !["off", "preview", "live"].includes(b.mode)) return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  if (b.erpDates !== undefined && !["off", "show", "write"].includes(b.erpDates)) return NextResponse.json({ ok: false, error: "ERP dates: off, show or write" }, { status: 400 });
  if (b.shop !== undefined && !["off", "preview", "live"].includes(b.shop)) return NextResponse.json({ ok: false, error: "Shop tickets: off, preview or live" }, { status: 400 });
  if (b.makerSend !== undefined && !["off", "live"].includes(b.makerSend)) return NextResponse.json({ ok: false, error: "Declarations made on the ticket: off or live" }, { status: 400 });
  const patch: SettingsPatch = { mode: b.mode, erpDates: b.erpDates as SettingsPatch["erpDates"], shop: b.shop as SettingsPatch["shop"], makerSend: b.makerSend as SettingsPatch["makerSend"] };
  if (b.steps !== undefined) {
    const s: Partial<StepSwitches> = {};
    for (const [k, v] of Object.entries(b.steps ?? {})) {
      if (!(k in DEFAULT_STEPS) || typeof v !== "boolean") return NextResponse.json({ ok: false, error: `steps.${k}: on or off` }, { status: 400 });
      s[k as keyof StepSwitches] = v;
    }
    patch.steps = s;
  }
  if (b.mails !== undefined) {
    const m: Partial<Mails> = {};
    for (const k of ["owner", "team", "created", "avor"] as const) if (b.mails[k] !== undefined) { if (typeof b.mails[k] !== "boolean") return NextResponse.json({ ok: false, error: `mails.${k}: on or off` }, { status: 400 }); m[k] = b.mails[k]; }
    patch.mails = m;
  }
  if (b.timing !== undefined) {
    if (b.timing !== "default") { const why = timingProblem(b.timing); if (why) return NextResponse.json({ ok: false, error: `Timing - ${why}` }, { status: 400 }); }
    patch.timing = b.timing;
  }
  if (b.teamTo !== undefined) {
    if (!Array.isArray(b.teamTo) || b.teamTo.length > 12 || !b.teamTo.every((x) => typeof x === "string" && /^\d+$/.test(x))) return NextResponse.json({ ok: false, error: "Recipients: up to 12 owners" }, { status: 400 });
    if (b.teamTo.some((x) => INBOX_OWNERS.has(x))) return NextResponse.json({ ok: false, error: "Not a queue user - its address is a HubSpot inbox, a mail there comes back as a ticket" }, { status: 400 });
    patch.teamTo = b.teamTo;
  }
  for (const k of ["hold", "release"] as const) if (b[k] !== undefined) { if (!/^\d+$/.test(String(b[k]))) return NextResponse.json({ ok: false, error: `${k}: a ticket id` }, { status: 400 }); patch[k] = String(b[k]); }
  let people: Partial<People> | undefined;
  if (b.people !== undefined) {
    people = {};
    if (b.people.backOffice !== undefined) { if (!isIds(b.people.backOffice)) return NextResponse.json({ ok: false, error: "Back Office rotation: at least one owner" }, { status: 400 }); people.backOffice = b.people.backOffice; }
    if (b.people.experts !== undefined) { if (!isIds(b.people.experts)) return NextResponse.json({ ok: false, error: "Conformity experts: at least one owner" }, { status: 400 }); people.experts = b.people.experts; }
    if (b.people.escalation !== undefined) { if (!/^\d+$/.test(String(b.people.escalation))) return NextResponse.json({ ok: false, error: "After 15 days: one owner" }, { status: 400 }); people.escalation = String(b.people.escalation); }
  }
  patch.people = people;
  return NextResponse.json({ ok: true, data: await saveSettings(patch, await me(access.userId)) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; mail?: string };
  try {
    if (b.action === "sample") {
      const r = await query<{ email: string | null; full_name: string | null; username: string | null }>(`SELECT email, full_name, username FROM apsomh_users WHERE id = $1`, [access.userId]).catch(() => ({ rows: [] }));
      const u = r.rows[0];
      if (!u?.email) return NextResponse.json({ ok: false, error: "Your account has no e-mail address" });
      if (await isInbox(u.email)) return NextResponse.json({ ok: false, error: "That address is a HubSpot inbox - a mail there comes back as a ticket" });
      const key = MAIL_KEYS.includes(b.mail as MailKey) ? (b.mail as MailKey) : "boToday";
      const sent = await sendSample({ name: u.full_name?.trim() || u.username || u.email, email: u.email }, key);
      return NextResponse.json(sent.ok ? { ok: true, data: { text: `${sent.text} (${u.email})` } } : { ok: false, error: sent.text });
    }
    if (b.action === "run") {
      const info = await runOnce();
      return NextResponse.json(info ? { ok: true, data: info } : { ok: false, error: "Not run - switched off, or a look is running" });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
