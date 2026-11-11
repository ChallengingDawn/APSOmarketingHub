// SEALING BUSINESS REVIEW - the commercial priorities' statuses (SARCLA 11.11.2026: "should be able to accept, refuse,
// and more come, or give it a status"; src/lib/apHub/sealingPriorities.ts).
//   GET   every status given, and whether the person may change them - the Angst+Pfister hub's people
//   POST  { kind, entity, rule, status: "accepted" | "in_progress" | "done" | "refused" | null, title } - a cross-admin
//         only (an admin of both hubs). A cross-user views and changes nothing: the middleware refuses their POST at the
//         door (src/lib/auth/access.ts crossUserMaySend), and this refuses it again.
import { NextRequest, NextResponse } from "next/server";
import { asCross } from "@/lib/auth/access";
import type { UserRow } from "@/lib/db/init";
import { readPriorityMarks, setPriorityMark } from "@/lib/apHub/sealingPriorities";
import { isPriorityStatus, priorityKeyOf } from "@/lib/apHub/sealingRules";
import { apHubUser } from "../../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who may give a card a status: a cross-admin - an admin with the Angst+Pfister mark "admin". */
const mayEdit = (u: UserRow) => u.role === "admin" && asCross(u.cross_access) === "admin";

export async function GET() {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  try {
    return NextResponse.json({ ok: true, marks: await readPriorityMarks(), canEdit: mayEdit(gate.user) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The statuses could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  if (!mayEdit(gate.user)) return NextResponse.json({ ok: false, error: "Only a cross-admin gives a priority its status." }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { kind?: unknown; entity?: unknown; rule?: unknown; status?: unknown; title?: unknown } | null;
  const key = priorityKeyOf(b?.kind, b?.entity, b?.rule);
  if (!key) return NextResponse.json({ ok: false, error: "Which priority?" }, { status: 400 });
  const st = b?.status;
  const to = st === null ? null : isPriorityStatus(st) ? st : undefined;
  if (to === undefined) return NextResponse.json({ ok: false, error: "Accepted, in progress, done, refused - or none." }, { status: 400 });
  const title = typeof b?.title === "string" ? b.title : "";
  const by = gate.user.full_name || gate.user.email || gate.user.username;
  try {
    const r = await setPriorityMark(key, to, title, by);
    if (!r.moved && r.status !== to) {
      return NextResponse.json({ ok: false, error: "This priority cannot go there from where it is.", status: r.status }, { status: 409 });
    }
    return NextResponse.json({ ok: true, id: key.id, status: r.status, setBy: by });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The status could not be kept: ${(e as Error).message}` }, { status: 500 });
  }
}
