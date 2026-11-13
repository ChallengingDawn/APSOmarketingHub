// BACK OFFICE DISTRIBUTION > Availability > Absences (src/lib/holiday/absenceEdit.ts). SARCLA 13.11.2026: "allow also
// to see the absences and to record absences for colleagues".
// GET (UC): the Back Office team and the six people of Available or Away, each with their coming absences, the last
// entries made here, and whether the asker may record. POST {action: "add", ownerId, from, to, title} /
// {action: "remove", ownerId, id} (admins and UC writers - the holiday redirection's own rule): written into the
// person's HubSpot out-of-office hours; answers with their coming absences, so the page shows it at once.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { absenceLog, absencePeople, addAbsence, removeAbsence } from "@/lib/holiday/absenceEdit";
import { PEOPLE } from "@/lib/boAvailability/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIX = PEOPLE.map((p) => p.owner);

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [people, log] = await Promise.all([absencePeople(SIX), absenceLog()]);
    return NextResponse.json({ configured: true, ok: true, data: { people, log: log.slice(0, 20), canEdit: access.role === "admin" || access.canWrite("uc") } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(access.role === "admin" || access.canWrite("uc"))) return NextResponse.json({ ok: false, error: "Recording absences needs write access" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; ownerId?: string; from?: string; to?: string; title?: string; id?: string };
  try {
    // only the people the card shows
    const person = (await absencePeople(SIX)).find((p) => p.ownerId === String(b.ownerId ?? ""));
    if (!person) return NextResponse.json({ ok: false, error: "Not one of the people shown here" }, { status: 400 });
    if (!person.userObjectId) return NextResponse.json({ ok: false, error: `${person.name} has no HubSpot user record - an absence cannot be kept for them` }, { status: 400 });
    const me = (await query<{ full_name: string | null; username: string }>("SELECT full_name, username FROM apsomh_users WHERE id = $1", [access.userId])).rows[0];
    const by = me?.full_name?.trim() || me?.username || `user ${access.userId}`;
    const who = { ownerId: person.ownerId, name: person.name, userObjectId: person.userObjectId };
    if (b.action === "add") {
      const windows = await addAbsence(who, String(b.from ?? ""), String(b.to ?? ""), String(b.title ?? ""), by);
      return NextResponse.json({ ok: true, data: { ownerId: person.ownerId, windows } });
    }
    if (b.action === "remove") {
      const windows = await removeAbsence(who, String(b.id ?? ""), by);
      return NextResponse.json({ ok: true, data: { ownerId: person.ownerId, windows } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 409 });
  }
}
