// MY SALES REPORTS: who the person signed in is in HubSpot - the owner with their email - and the targets they set
// (SARCLA 01.11.2026: "display the figures based on user email so it only shows each one's sales"; the targets "set by
// themselves", an admin able to set or correct anyone's, a sales leader viewing). The figures themselves are the ESO
// reports' reads (the customers' cube, the visits), drawn by the pages for the person's SAE name.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { getLeads, getTeams } from "@/lib/mapAssign/leads";
import { checkTarget, cleanAll, isTargetId, type PersonTargets } from "@/lib/reporting/mySalesRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["/reporting/my-sales/targets", "/reporting/my-sales/figures", "/reporting/my-sales/visits"];
const opens = (a: MyAccess, href: string) => accessAt(href, a.levels).level !== "none";
/** one key per person, so two people saving at once never overwrite each other */
const keyOf = (year: number, owner: string) => `mySales:targets:${year}:${owner}`;

async function readTargets(year: number, owner: string): Promise<PersonTargets> {
  return cleanAll({ [owner]: (await kvGet<unknown>(keyOf(year, owner))) ?? {} })[owner] ?? {};
}

/** The HubSpot owner with this email - an active one first - and the name the reports know them by. */
async function ownerOf(email: string | null | undefined) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  const all = await readOwners();
  const o = all.find((x) => x.active && x.email?.toLowerCase() === e) ?? all.find((x) => x.email?.toLowerCase() === e);
  if (!o) return null;
  const names = await ownerNames().catch(() => new Map<string, string>());
  return { id: o.id, name: names.get(o.id) ?? o.name };
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // any of the three pages given is enough to know who you are; the targets only with the Targets page
  if (!PAGES.some((p) => opens(access, p))) return NextResponse.json({ error: "No access" }, { status: 403 });
  const u = await getOptionalUser();
  try {
    const year = new Date().getUTCFullYear();
    const me = await ownerOf(u?.email);
    const canPick = access.role === "admin" || access.role === "sales_leader";
    const asked = req.nextUrl.searchParams.get("owner");
    const names = canPick ? await ownerNames().catch(() => new Map<string, string>()) : null;
    // an admin or a sales leader may look at anyone; everyone else at themselves
    const subject = canPick && asked && /^\d+$/.test(asked) ? { id: asked, name: names?.get(asked) ?? `Owner ${asked}` } : me;
    const teams = await getTeams();
    const leads = await getLeads(teams);
    const showTargets = opens(access, PAGES[0]) && !!subject;
    return NextResponse.json({
      ok: true, year, me, subject, canPick,
      canEdit: showTargets && (access.role === "admin" || (!!me && subject?.id === me.id)),
      targets: showTargets ? await readTargets(year, subject!.id) : null,
      // the person's line manager's team, as Map assignment's SAE table has it
      team: me ? leads[me.id] ?? null : null, teams,
      // the people to choose from: ESO's - in a line manager's team, or in HubSpot's ESO team - by owner id and the name
      // the reports carry
      people: canPick && names ? [...new Set([...Object.keys(leads), ...(await readOwners()).filter((o) => o.active && /\bESO\b/i.test(o.team ?? "")).map((o) => o.id)])]
        .map((id) => ({ id, name: names.get(id) ?? `Owner ${id}` })) : [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/** { owner, target, value } - one target of one person; value null clears it. */
export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!opens(access, PAGES[0])) return NextResponse.json({ error: "No access" }, { status: 403 });
  const u = await getOptionalUser();
  const b = (await req.json().catch(() => ({}))) as { owner?: unknown; target?: unknown; value?: unknown };
  const owner = String(b.owner ?? "");
  if (!/^\d+$/.test(owner) || !isTargetId(b.target)) return NextResponse.json({ ok: false, error: "That change is not valid." }, { status: 400 });
  try {
    const me = await ownerOf(u?.email);
    if (access.role !== "admin" && me?.id !== owner) {
      return NextResponse.json({ ok: false, error: "Only the person themselves or an admin sets their targets." }, { status: 403 });
    }
    const c = checkTarget(b.target, b.value);
    if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 400 });
    const year = new Date().getUTCFullYear();
    const now = await readTargets(year, owner);
    const next: PersonTargets = { ...now, by: u?.username ?? "", at: new Date().toISOString() };
    if (c.value == null) delete next[b.target]; else next[b.target] = c.value;
    await kvSet(keyOf(year, owner), next);
    await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [u?.username ?? "", "my-sales.target", JSON.stringify({ owner, target: b.target, value: c.value, year })]).catch(() => { /* never fail the change because the log did */ });
    return NextResponse.json({ ok: true, targets: next });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
