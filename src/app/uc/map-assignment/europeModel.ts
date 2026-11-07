// MAP ASSIGNMENT - Europe's map, the model (pure: no React, no canvas). SARCLA 07.11.2026: "est-ce possible d'avoir une
// map de l'Europe complète? Toute l'Europe, Europe with ESO, Europe TSA".
//   buildEurope  every country with a map in one picture: their regions (cantons, départements, Länder ...) and outlines,
//                in an equal-area view centred on Europe (buildBase with opts.europe), each region knowing its country
//   joinEurope   the engine's EuropeData (GET ?europe=1: every country's companies per REGION) laid on those regions -
//                all companies, or only those the rules give someone of ESO, or of TSA (datatracker/rosters.ts teamOf);
//                the figures per person summed over the countries for the summary
// Europe is the countries the hub has a map of (public/geo) - not more: a country without one is named, not drawn.

import type { Geometry } from "geojson";
import { teamOf } from "@/lib/datatracker/rosters";
import type { EuropeData, OwnerLoad, PersonStat, PostcodeStat } from "@/lib/mapAssign/api";
import { buildBase, type MapBase, type Priority, type ValueLayer } from "./mapModel";

/** The country picker's entry for Europe. */
export const EUROPE = "EU";

export type TeamPick = "all" | "ESO" | "TSA";
export const TEAM_PICKS: { key: TeamPick; label: string }[] = [{ key: "all", label: "All" }, { key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }];
type TeamKey = "ESO" | "TSA" | "Other";
const teamKey = (owner: string): TeamKey => teamOf(owner) ?? "Other";
export const inTeam = (owner: string, team: TeamPick) => team === "all" || teamOf(owner) === team;

export type CountryShapes = { country: string; outline: Geometry | null; regions: { code: string; name: string; geometry: Geometry }[] };

export type EuropeBase = {
  base: MapBase;
  /** per region: its country */
  country: string[];
  /** per country: its regions and where its name goes (map units), the width of its regions together */
  countries: { cc: string; regions: number[]; label: [number, number] | null; w: number }[];
};

/** Every country's regions and outline in one map; null without any. */
export function buildEurope(files: CountryShapes[]): EuropeBase | null {
  const regions: CountryShapes["regions"] = [];
  const from: string[] = [];
  const outlines: Geometry[] = [];
  for (const f of files) {
    for (const r of f.regions) { regions.push(r); from.push(f.country); }
    if (f.outline) outlines.push(f.outline);
  }
  if (!regions.length) return null;
  const base = buildBase({ points: null, shapes: { outline: outlines.length ? { type: "GeometryCollection", geometries: outlines } : null, regions } }, EUROPE, { europe: true });
  if (!base) return null;
  // buildBase keeps the regions in the order given
  const country = base.regions.map((_, i) => from[i] ?? "");
  const by = new Map<string, number[]>();
  country.forEach((cc, i) => { const l = by.get(cc); if (l) l.push(i); else by.set(cc, [i]); });
  const countries = [...by].map(([cc, ix]) => {
    // the name: on the region label nearest the middle of the country's region labels, weighed by their size (an
    // island inset or a small enclave does not pull it off the land)
    let sx = 0, sy = 0, sw = 0, x0 = Infinity, x1 = -Infinity;
    for (const i of ix) {
      const r = base.regions[i];
      x0 = Math.min(x0, r.box[0]); x1 = Math.max(x1, r.box[2]);
      if (!r.label) continue;
      const wgt = r.km2 ?? Math.max(1e-6, (r.box[2] - r.box[0]) * (r.box[3] - r.box[1]));
      sx += r.label[0] * wgt; sy += r.label[1] * wgt; sw += wgt;
    }
    let label: [number, number] | null = null;
    if (sw > 0) {
      const mx = sx / sw, my = sy / sw;
      let best = Infinity;
      for (const i of ix) {
        const l = base.regions[i].label;
        if (!l) continue;
        const dd = (l[0] - mx) ** 2 + (l[1] - my) ** 2;
        if (dd < best) { best = dd; label = [l[0], l[1]]; }
      }
    }
    return { cc, regions: ix, label, w: Number.isFinite(x1 - x0) ? x1 - x0 : 0 };
  });
  return { base, country, countries };
}

/* ── the figures ── */

export type Figure = { companies: number; customers: number; newCustomers: number; revenue: number; potential: number };
const zero = (): Figure => ({ companies: 0, customers: 0, newCustomers: 0, revenue: 0, potential: 0 });

/** One region under the team picked. */
export type RegionFig = Figure & {
  priority: Record<string, number>;
  /** companies per person (by the rules), most first */
  owners: [string, number][];
  /** the same figures per team - "All" shows the split */
  teams: Record<TeamKey, Figure>;
};

export type EuropeJoined = {
  regions: (RegionFig | null)[];
  /** GDP per region, null = unknown */
  gdp: (number | null)[];
  /** per person, summed over the countries: the team's people only */
  load: OwnerLoad[];
  /** companies per team (every company, the summary's) - the team switch's counts */
  teamCompanies: Record<TeamPick, number>;
  /** sales priority over the regions, under the team */
  priority: Record<string, number>;
  potential: number;
  at: string | null;
};

const addFig = (into: Figure, x: { companies?: number; customers?: number; newCustomers?: number; revenue?: number; potential?: number }) => {
  into.companies += Number(x.companies) || 0; into.customers += Number(x.customers) || 0; into.newCustomers += Number(x.newCustomers) || 0;
  into.revenue += Number(x.revenue) || 0; into.potential += Number(x.potential) || 0;
};
const addRec = (into: Record<string, number>, from: Record<string, number> | undefined) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + (Number(v) || 0);
};

function regionFig(s: PostcodeStat, team: TeamPick): RegionFig | null {
  const fig: RegionFig = { ...zero(), priority: {}, owners: [], teams: { ESO: zero(), TSA: zero(), Other: zero() } };
  const by = Object.entries(s.byOwner ?? {}) as [string, PersonStat][];
  for (const [o, x] of by) addFig(fig.teams[teamKey(o)], x);
  if (team === "all") {
    addFig(fig, s);
    addRec(fig.priority, s.priority);
  } else {
    for (const [o, x] of by) if (inTeam(o, team)) { addFig(fig, x); addRec(fig.priority, x.priority); }
  }
  fig.owners = by.filter(([o, x]) => inTeam(o, team) && x.companies > 0).map(([o, x]) => [o, x.companies] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return fig.companies > 0 || fig.owners.length ? fig : null;
}

export function joinEurope(eb: EuropeBase, data: EuropeData, team: TeamPick): EuropeJoined {
  const ix = new Map(eb.base.regions.map((r, i) => [r.code.toUpperCase(), i] as const));
  const regions: (RegionFig | null)[] = eb.base.regions.map(() => null);
  const gdp: (number | null)[] = eb.base.regions.map(() => null);
  const people = new Map<string, OwnerLoad>();
  const teamCompanies: Record<TeamPick, number> = { all: 0, ESO: 0, TSA: 0 };
  const priority: Record<string, number> = {};
  let potential = 0;
  for (const c of data.countries ?? []) {
    for (const s of c.points ?? []) {
      const i = ix.get(String(s.zip ?? "").toUpperCase());
      if (i === undefined) continue;
      const f = regionFig(s, team);
      if (!f) continue;
      regions[i] = f;
      addRec(priority, f.priority);
      potential += f.potential;
    }
    for (const g of c.gdp ?? []) {
      const i = ix.get(String(g.code).toUpperCase());
      if (i !== undefined && g.gdp !== null && Number.isFinite(Number(g.gdp))) gdp[i] = Number(g.gdp);
    }
    for (const l of c.load ?? []) {
      const o = String(l.owner);
      teamCompanies.all += l.after;
      const t = teamOf(o);
      if (t) teamCompanies[t] += l.after;
      if (!inTeam(o, team)) continue;
      const a = people.get(o) ?? (people.set(o, { owner: o, now: 0, after: 0, customers: 0, newCustomers: 0, revenue: 0, potential: 0, contacts: 0, tickets: 0, sales: 0, salesOpen: 0, priority: {}, category: {} }), people.get(o)!);
      a.now += l.now; a.after += l.after; a.customers += l.customers; a.newCustomers += l.newCustomers; a.revenue += l.revenue; a.contacts += l.contacts;
      a.tickets += l.tickets; a.sales += l.sales;
      if (l.potential !== undefined) a.potential = (a.potential ?? 0) + (Number(l.potential) || 0);
      a.salesOpen = (a.salesOpen ?? 0) + (Number(l.salesOpen) || 0);
      addRec(a.priority!, l.priority); addRec(a.category!, l.category);
    }
  }
  const load = [...people.values()].sort((a, b) => b.after - a.after || b.now - a.now);
  return { regions, gdp, load, teamCompanies, priority, potential, at: data.at ?? null };
}

export function figValue(f: RegionFig | null, layer: ValueLayer, prio: Priority): number {
  if (!f) return 0;
  if (layer === "revenue") return f.revenue;
  if (layer === "potential") return f.potential;
  if (layer === "customers") return f.customers;
  if (layer === "newCustomers") return f.newCustomers;
  if (layer === "priority") return Number(f.priority[prio]) || 0;
  return 0;
}

/** Is it EuropeData (and not the page's own data from a hub that does not know ?europe yet)? */
export function isEuropeData(x: unknown): x is EuropeData {
  const o = x as EuropeData | null;
  return !!o && typeof o === "object" && Array.isArray(o.countries);
}
