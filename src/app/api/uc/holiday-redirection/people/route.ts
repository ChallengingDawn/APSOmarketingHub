// The people behind Holiday redirection: GET lists ESO, TSA and Back Office with their
// status and deputies, read live from HubSpot. POST changes a deputy - admins and
// anyone who may write in UC & HubSpot Apps - and logs who did it.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { readPeople, setDeputy } from "@/lib/holiday/people";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const people = await readPeople();
    return NextResponse.json({ ok: true, data: { people, canEdit: access.role === "admin" || access.canWrite("uc") } });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(access.role === "admin" || access.canWrite("uc"))) return NextResponse.json({ error: "No write access" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { ownerId?: unknown; slot?: unknown; deputy?: unknown };
  const ownerId = String(b.ownerId ?? "");
  const slot = b.slot === 2 ? 2 : b.slot === 1 ? 1 : null;
  const deputy = b.deputy === null || b.deputy === "" ? null : String(b.deputy ?? "");
  if (!/^\d{1,20}$/.test(ownerId) || !slot || (deputy !== null && !/^\d{1,20}$/.test(deputy))) {
    return NextResponse.json({ ok: false, error: "ownerId, slot (1 or 2) and a deputy owner id (or null) are required." }, { status: 400 });
  }
  if (deputy === ownerId) return NextResponse.json({ ok: false, error: "Nobody can be their own deputy." }, { status: 400 });

  try {
    // Re-read rather than trust the page: the user record is what gets written, and both
    // ids must still be people the screen lists.
    const people = await readPeople();
    const person = people.find((p) => p.ownerId === ownerId);
    if (!person) return NextResponse.json({ ok: false, error: "That person is not in ESO, TSA or Back Office." }, { status: 404 });
    if (!person.userObjectId) return NextResponse.json({ ok: false, error: `${person.name} has no HubSpot user record, so there is nowhere to store a deputy.` }, { status: 409 });
    if (deputy && !people.some((p) => p.ownerId === deputy)) {
      return NextResponse.json({ ok: false, error: "The deputy must be someone in ESO, TSA or Back Office." }, { status: 400 });
    }
    const before = slot === 1 ? person.deputy1 : person.deputy2;
    await setDeputy(person.userObjectId, slot, deputy);
    await query(
      `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [String(access.userId), "holiday.deputy", JSON.stringify({ ownerId, name: person.name, slot, from: before, to: deputy })],
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
