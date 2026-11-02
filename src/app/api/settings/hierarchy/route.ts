// SETTINGS > HIERARCHY: who reports to whom, and in which unit - every HubSpot owner (SARCLA 01.11.2026). Admins only:
// it decides whose figures a manager sees in My Sales Reports.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { getUnits, hierarchyNow, saveHierarchy, saveUnits } from "@/lib/hierarchy/store";
import { cleanTags, tidyUnit, wouldLoop, type Placement } from "@/lib/hierarchy/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() {
  const u = await getOptionalUser();
  if (!u) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (u.role !== "admin") return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  return { user: u };
}

export async function GET() {
  const gate = await admin();
  if (gate.error) return gate.error;
  try {
    const h = await hierarchyNow();
    return NextResponse.json({ ok: true, ...h, units: await getUnits() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/**
 * { ownerId, manager?, unit?, tags? } - an owner id or null (none), "inherit" back to what was known before; tags the
 * person's whole set (Sales leader, BUC member - tags only, SARCLA 02.11.2026); or { units }; or { moves: [{ ownerId,
 * manager }] } - several people under a new manager at once (a team handed over, SARCLA 01.11.2026: "where you can change
 * person and leader"), each checked against the tree as the moves before it left it.
 */
export async function PUT(req: NextRequest) {
  const gate = await admin();
  if (gate.error) return gate.error;
  const b = (await req.json().catch(() => ({}))) as { ownerId?: unknown; manager?: unknown; unit?: unknown; tags?: unknown; units?: unknown; moves?: unknown };
  try {
    if (b.moves !== undefined) {
      if (!Array.isArray(b.moves) || b.moves.length > 300) return NextResponse.json({ ok: false, error: "The moves are missing." }, { status: 400 });
      const h = await hierarchyNow();
      const ids = new Set(h.people.map((p) => p.id));
      const saved = { ...h.saved }, placed = { ...h.placed };
      for (const m of b.moves as { ownerId?: unknown; manager?: unknown }[]) {
        const id = String(m?.ownerId ?? ""), to = m?.manager === null ? null : String(m?.manager ?? "");
        if (!ids.has(id) || (to !== null && !ids.has(to))) return NextResponse.json({ ok: false, error: "No such HubSpot owner." }, { status: 400 });
        if (to !== null && wouldLoop(placed, id, to)) return NextResponse.json({ ok: false, error: "That would put someone under a person who reports to them." }, { status: 400 });
        saved[id] = { ...(saved[id] ?? {}), manager: to };
        placed[id] = { ...(placed[id] ?? { unit: null, tags: [] }), manager: to };
      }
      await saveHierarchy(saved);
      await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
        [gate.user!.username, "hierarchy.moves", JSON.stringify(b.moves)]).catch(() => { /* never fail the change because the log did */ });
      return NextResponse.json({ ok: true, saved });
    }
    if (b.units !== undefined) {
      if (!Array.isArray(b.units) || !b.units.every((x) => typeof x === "string")) return NextResponse.json({ ok: false, error: "The units are missing." }, { status: 400 });
      await saveUnits(b.units as string[]);
      return NextResponse.json({ ok: true, units: await getUnits() });
    }
    const id = String(b.ownerId ?? "");
    if (!/^\d+$/.test(id)) return NextResponse.json({ ok: false, error: "The person is missing." }, { status: 400 });
    const h = await hierarchyNow();
    if (!h.people.some((p) => p.id === id)) return NextResponse.json({ ok: false, error: "No such HubSpot owner." }, { status: 404 });
    const next: Placement = { ...(h.saved[id] ?? {}) };
    if (b.manager !== undefined) {
      if (b.manager === "inherit") delete next.manager;
      else if (b.manager === null) next.manager = null;
      else {
        const m = String(b.manager);
        if (!h.people.some((p) => p.id === m)) return NextResponse.json({ ok: false, error: "No such manager." }, { status: 400 });
        if (wouldLoop(h.placed, id, m)) return NextResponse.json({ ok: false, error: "That would put them under someone who reports to them." }, { status: 400 });
        next.manager = m;
      }
    }
    if (b.unit !== undefined) {
      if (b.unit === "inherit") delete next.unit;
      else if (b.unit === null) next.unit = null;
      else { const u = tidyUnit(String(b.unit)); if (!u) return NextResponse.json({ ok: false, error: "A unit needs a name." }, { status: 400 }); next.unit = u; }
    }
    if (b.tags !== undefined) {
      if (!Array.isArray(b.tags)) return NextResponse.json({ ok: false, error: "The tags are missing." }, { status: 400 });
      const tags = cleanTags(b.tags);
      if (tags.length) next.tags = tags; else delete next.tags;
    }
    const saved = { ...h.saved };
    if (next.manager === undefined && next.unit === undefined && !next.tags) delete saved[id]; else saved[id] = next;
    await saveHierarchy(saved);
    await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [gate.user!.username, "hierarchy.change", JSON.stringify({ ownerId: id, manager: b.manager, unit: b.unit, tags: b.tags })]).catch(() => { /* never fail the change because the log did */ });
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
