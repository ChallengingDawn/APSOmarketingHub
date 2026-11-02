// THE HIERARCHY - who reports to whom, and in which unit (SARCLA 01.11.2026: "teams are set on Map assignment, but bring
// another sub-app to Settings to define the hierarchy - keep the existing; Back Office is under Rose, Italy is Luca as
// sales leader, also reporting directly to Alexandre, the CEO"). Every HubSpot owner has a place: a manager (or none, at
// the top) and a unit (ESO, TSA, Back Office…). My Sales Reports reads it: "My team" is everyone under a person, "All
// ESO" / "All TSA" their unit's.
//
// What is not set takes what the hub knew before - the unit from the rosters or the person's HubSpot team, the manager
// from Map assignment's line managers' teams - so nothing changes until an admin says so. No HubSpot or database here.

/**
 * A person's tags (SARCLA 02.11.2026: "I should also be able to select BUC member and/or sales leader" - his pick: tags
 * only, no access changes; the hub roles stay in Settings > Roles).
 */
export const TAGS = [{ id: "leader", label: "Sales leader" }, { id: "buc", label: "BUC member" }] as const;
export type Tag = (typeof TAGS)[number]["id"];
const isTag = (x: unknown): x is Tag => TAGS.some((t) => t.id === x);

/** One person's place; undefined = not set here (what was known before stands), null = set to none. Tags only as set here. */
export type Placement = { manager?: string | null; unit?: string | null; tags?: Tag[] };
/** owner id -> their place */
export type Hierarchy = Record<string, Placement>;

/** Tags as kept: known ones, each once, in TAGS' order. */
export const cleanTags = (x: unknown): Tag[] => (Array.isArray(x) ? TAGS.map((t) => t.id).filter((id) => x.some((v) => v === id && isTag(v))) : []);

export const DEFAULT_UNITS = ["Management", "ESO", "TSA", "Back Office", "Italy"];
const ID = /^\d+$/;
/** A unit's name as kept: trimmed, single spaces, at most 40 characters. */
export const tidyUnit = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 40);

/** As kept: owner ids only, a manager an owner id or null, a unit a name or null. */
export function cleanHierarchy(x: unknown): Hierarchy {
  const out: Hierarchy = {};
  if (!x || typeof x !== "object") return out;
  for (const [id, raw] of Object.entries(x as Record<string, unknown>)) {
    if (!ID.test(id) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const p: Placement = {};
    if (r.manager === null || (typeof r.manager === "string" && ID.test(r.manager) && r.manager !== id)) p.manager = r.manager as string | null;
    if (r.unit === null || (typeof r.unit === "string" && tidyUnit(r.unit))) p.unit = r.unit === null ? null : tidyUnit(r.unit as string);
    const tags = cleanTags(r.tags);
    if (tags.length) p.tags = tags;
    if (p.manager !== undefined || p.unit !== undefined || p.tags) out[id] = p;
  }
  return out;
}

/** Each person's place as it stands: set here, else what was known before; their tags as set here. */
export function effective(saved: Hierarchy, seed: Hierarchy): Record<string, { manager: string | null; unit: string | null; tags: Tag[] }> {
  const out: Record<string, { manager: string | null; unit: string | null; tags: Tag[] }> = {};
  for (const id of new Set([...Object.keys(seed), ...Object.keys(saved)])) {
    const s = saved[id] ?? {}, d = seed[id] ?? {};
    out[id] = { manager: s.manager !== undefined ? s.manager : d.manager ?? null, unit: s.unit !== undefined ? s.unit : d.unit ?? null, tags: s.tags ?? [] };
  }
  return out;
}

type Placed = Record<string, { manager: string | null }>;
/** Would putting `id` under `manager` close a loop - the manager under `id` already, or `id` itself? */
export function wouldLoop(h: Placed, id: string, manager: string | null): boolean {
  const seen = new Set<string>();
  for (let m = manager; m; m = h[m]?.manager ?? null) {
    if (m === id) return true;
    if (seen.has(m)) return true;
    seen.add(m);
  }
  return false;
}

/** Everyone under a person, at any depth (not the person). */
export function under(h: Placed, id: string): string[] {
  const kids = new Map<string, string[]>();
  for (const [x, p] of Object.entries(h)) if (p.manager) kids.set(p.manager, [...(kids.get(p.manager) ?? []), x]);
  const out: string[] = [], seen = new Set([id]);
  const walk = (x: string) => { for (const k of kids.get(x) ?? []) if (!seen.has(k)) { seen.add(k); out.push(k); walk(k); } };
  walk(id);
  return out;
}

/** The reports a unit's people are drawn in: ESO's, TSA's, or none (Back Office, Management…). */
export const reportsOfUnit = (unit: string | null | undefined): "eso" | "tsa" | null =>
  /^\s*ESO\b/i.test(unit ?? "") ? "eso" : /^\s*TSA\b/i.test(unit ?? "") ? "tsa" : null;

/** The unit known before: the rosters' ESO / TSA, else the person's HubSpot team (its ESO / TSA, else its name). */
export function seedUnit(roster: "ESO" | "TSA" | null, hsTeam: string | null): string | null {
  if (roster) return roster;
  if (!hsTeam) return null;
  return /\bTSA\b/i.test(hsTeam) ? "TSA" : /\bESO\b/i.test(hsTeam) ? "ESO" : tidyUnit(hsTeam) || null;
}
