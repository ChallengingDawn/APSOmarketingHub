// MY SALES REPORTS: who the person signed in is in HubSpot - the owner with their email - where they stand in the
// hierarchy (Settings > Hierarchy: their unit, everyone under them), and the targets they set (SARCLA 01.11.2026:
// "display the figures based on user email so it only shows each one's sales"; "Adem should only see his KPIs, all ESO,
// and all with TSA - a TSA person vice versa"; a manager also their team; "he should not be able to see other teams").
// The figures are the ESO reports' own reads, drawn by the pages for these people.
//
// An admin previewing someone (View as, ?as=<hub user id>) is answered as that person - their email, their role.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { asRole } from "@/lib/auth/access";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { hierarchyNow } from "@/lib/hierarchy/store";
import { reportsOfUnit, under } from "@/lib/hierarchy/rules";
import { getLeads, getTeams } from "@/lib/mapAssign/leads";
import { checkTarget, checkWeights, cleanAll, isTargetId, type PersonTargets } from "@/lib/reporting/mySalesRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["targets", "figures", "visits", "registrations", "shop", "new-customers", "customers", "tickets", "system-tickets"].map((p) => `/reporting/my-sales/${p}`);
const opens = (a: MyAccess, href: string) => accessAt(href, a.levels).level !== "none";
/** one key per person, so two people saving at once never overwrite each other */
const keyOf = (year: number, owner: string) => `mySales:targets:${year}:${owner}`;

async function readTargets(year: number, owner: string): Promise<PersonTargets> {
  return cleanAll({ [owner]: (await kvGet<unknown>(keyOf(year, owner))) ?? {} })[owner] ?? {};
}

/** The person asking - or, for an admin previewing someone, that person: their email and their role. */
async function asking(access: MyAccess, as: string | null) {
  const u = await getOptionalUser();
  if (access.role === "admin" && as && /^\d+$/.test(as)) {
    const r = await query<{ email: string | null; role: string; username: string }>(`SELECT email, role, username FROM apsomh_users WHERE id = $1`, [Number(as)]);
    if (r.rows[0]) return { email: r.rows[0].email, role: asRole(r.rows[0].role), username: r.rows[0].username, previewing: true };
  }
  return { email: u?.email ?? null, role: access.role, username: u?.username ?? "", previewing: false };
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // any of the pages given is enough to know who you are; the targets only with the Targets page
  if (!PAGES.some((p) => opens(access, p))) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const who = await asking(access, req.nextUrl.searchParams.get("as"));
    const year = new Date().getUTCFullYear();
    const h = await hierarchyNow();
    const byId = new Map(h.people.map((p) => [p.id, p]));
    const email = (who.email ?? "").trim().toLowerCase();
    const mine = email ? h.people.find((p) => p.active && p.email?.toLowerCase() === email) ?? h.people.find((p) => p.email?.toLowerCase() === email) : undefined;
    const me = mine ? { id: mine.id, name: mine.name } : null;
    // only an admin looks at anyone (SARCLA 01.11.2026: "he should not be able to see other teams")
    const canPick = who.role === "admin";
    const asked = req.nextUrl.searchParams.get("owner");
    const pick = canPick && asked && byId.has(asked) ? byId.get(asked)! : null;
    const subject = pick ? { id: pick.id, name: pick.name } : me;
    const placed = subject ? h.placed[subject.id] : undefined;
    const unit = placed?.unit ?? null;
    // their team: a leader's is them and everyone under them, at any depth; anyone else's is their leader's - the leader
    // and everyone under the leader (SARCLA 01.11.2026, on Adem's page: "missing a my team KPI overall")
    const leader = subject ? (under(h.placed, subject.id).length ? subject.id : placed?.manager ?? null) : null;
    let ids = leader ? [leader, ...under(h.placed, leader)] : [];
    // nobody placed them yet: Map assignment's line manager's team, as the ESO reports have it (SARCLA 01.11.2026: "still
    // missing my team")
    if (!ids.length && subject) {
      const leads = await getLeads(await getTeams());
      const mine = leads[subject.id];
      if (mine) ids = Object.keys(leads).filter((id) => leads[id] === mine);
    }
    const team = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ id: p.id, name: p.name }));
    const showTargets = PAGES.slice(0, 1).some((p) => opens(access, p)) && !!subject;
    return NextResponse.json({
      ok: true, year, me, subject, canPick, previewing: who.previewing,
      unit, reports: reportsOfUnit(unit),
      team,
      canEdit: showTargets && (who.role === "admin" || (!!me && subject?.id === me.id)),
      targets: showTargets ? await readTargets(year, subject!.id) : null,
      // the people an admin picks from: those with a unit in the hierarchy
      people: canPick ? h.people.filter((p) => p.active && h.placed[p.id]?.unit).map((p) => ({ id: p.id, name: p.name, unit: h.placed[p.id]?.unit ?? null })) : [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/**
 * { owner, target, value } - one target of one person; value null clears it. { owner, target, weights } - that target's
 * quarter weights in % (four, together 100); null back to the sheet's.
 */
export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!opens(access, PAGES[0])) return NextResponse.json({ error: "No access" }, { status: 403 });
  const u = await getOptionalUser();
  const b = (await req.json().catch(() => ({}))) as { owner?: unknown; target?: unknown; value?: unknown; weights?: unknown };
  const owner = String(b.owner ?? "");
  if (!/^\d+$/.test(owner) || !isTargetId(b.target)) return NextResponse.json({ ok: false, error: "That change is not valid." }, { status: 400 });
  try {
    if (access.role !== "admin") {
      // the person themselves: the owner with their own email
      const h = await hierarchyNow();
      const email = (u?.email ?? "").trim().toLowerCase();
      const mine = email ? h.people.find((p) => p.email?.toLowerCase() === email && p.id === owner) : undefined;
      if (!mine) return NextResponse.json({ ok: false, error: "Only the person themselves or an admin sets their targets." }, { status: 403 });
    }
    const year = new Date().getUTCFullYear();
    const now = await readTargets(year, owner);
    const next: PersonTargets = { ...now, by: u?.username ?? "", at: new Date().toISOString() };
    if (b.weights !== undefined) {
      const weights = { ...(now.weights ?? {}) };
      if (b.weights === null) delete weights[b.target];
      else {
        const w = checkWeights(b.weights);
        if (!w.ok) return NextResponse.json({ ok: false, error: w.error }, { status: 400 });
        weights[b.target] = w.value;
      }
      next.weights = weights;
    } else {
      const c = checkTarget(b.target, b.value);
      if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 400 });
      if (c.value == null) delete next[b.target]; else next[b.target] = c.value;
    }
    await kvSet(keyOf(year, owner), next);
    await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [u?.username ?? "", "my-sales.target", JSON.stringify({ owner, target: b.target, ...(b.weights !== undefined ? { weights: next.weights?.[b.target] ?? null } : { value: next[b.target] ?? null }), year })]).catch(() => { /* never fail the change because the log did */ });
    return NextResponse.json({ ok: true, targets: next });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
