// MAP ASSIGNMENT - changing the draft rules from the map (SARCLA 19.10.2026: "pick a zip code on the map to change it to
// someone ... allow also editing more broadly like départements, regions"). Pure: the map calls it, the page puts the
// returned rule in its draft (MapPanel's onAssign), Save sends it as always.
//
// Give postcodes to X: each postcode becomes a prefix of X's zone (X's first zone, a new one when X has none) and
// leaves every other zone - unless X already gets it without (a shorter prefix of X's, X's region, X the default).
// Give regions to X: the region codes move to X's zone (Zone.regions) and, since a prefix beats a region in zoneFor,
// every prefix inside the region goes too: the region's postcodes are covered by the fewest prefixes that hold only
// the region's postcodes (a trie over the country's postcode file), other zones lose what lies inside those (a range is
// cut, never dropped whole when it reaches outside), and X gets such a prefix only where something shorter would still
// give it to someone else. Then the result is checked on every postcode of the file: the picked ones go to X, every
// other one keeps its person - else nothing changes.

import { cleanZip, type CountryRule, type OwnerId, type Zone } from "@/lib/mapAssign/rules";
import { rulePicker } from "./mapModel";

export type MapChange =
  | { kind: "postcodes"; zips: string[] }
  | { kind: "regions"; regions: string[] };

/** What the map hands the page (onAssign): the country's rule after the change, to put in the draft as it is. */
export type MapAssign = {
  kind: MapChange["kind"];
  /** the postcodes or region codes given */
  keys: string[];
  owner: OwnerId;
  rule: CountryRule;
  /** one line for the page: "80331 München to Jan Kalt" */
  text: string;
};

export type EditResult =
  | { ok: true; rule: CountryRule; added: string[]; removed: string[]; changed: boolean }
  | { ok: false; error: string };

type FilePoint = { clean: string; region: string | null };

const isNum = (s: string) => /^\d+$/.test(s);
const pad = (n: number, len: number) => String(n).padStart(len, "0");

/** A zone token parsed as zoneFor reads it. */
function parse(t: string): { kind: "prefix"; q: string } | { kind: "range"; a: string; b: string; n: number } | null {
  const r = /^(\w+)-(\w+)$/.exec(t.trim());
  if (r && r[1].length === r[2].length) return { kind: "range", a: r[1], b: r[2], n: r[1].length };
  const q = cleanZip(t);
  return q ? { kind: "prefix", q } : null;
}

/**
 * The token with everything inside prefix P taken out: [] = it lay all inside, [t] = untouched, else what is left of
 * a range. A token shorter than P (it holds P, it does not lie inside) stays.
 */
function cutInside(t: string, P: string): string[] {
  const p = parse(t);
  if (!p) return [t];
  if (p.kind === "prefix") return p.q.startsWith(P) ? [] : [t];
  if (p.n < P.length || !isNum(p.a + p.b) || !isNum(P)) {
    // a range of shorter heads holds P, a non-numeric one is compared as text: inside only when both ends start with P
    if (p.n >= P.length && p.a.toUpperCase().startsWith(P) && p.b.toUpperCase().startsWith(P)) return [];
    return [t];
  }
  const a = Number(p.a), b = Number(p.b);
  const lo = Number(P + "0".repeat(p.n - P.length)), hi = Number(P + "9".repeat(p.n - P.length));
  const from = Math.max(a, lo), to = Math.min(b, hi);
  if (from > to) return [t];
  const out: string[] = [];
  const part = (x: number, y: number) => out.push(x === y ? pad(x, p.n) : `${pad(x, p.n)}-${pad(y, p.n)}`);
  if (a < from) part(a, from - 1);
  if (to < b) part(to + 1, b);
  return out;
}

/** The fewest prefixes that hold only postcodes of `T` (every file postcode starting with one is in T). */
export function coverOf(all: FilePoint[], T: Set<string>): string[] {
  const total = new Map<string, number>(), inT = new Map<string, number>();
  for (const p of all) {
    const z = p.clean;
    if (!z) continue;
    const mine = T.has(z);
    for (let L = 1; L <= z.length; L++) {
      const k = z.slice(0, L);
      total.set(k, (total.get(k) ?? 0) + 1);
      if (mine) inT.set(k, (inT.get(k) ?? 0) + 1);
    }
  }
  const nodes = new Set<string>();
  for (const z of T) {
    if (!z) continue;
    let node = z;
    for (let L = 1; L <= z.length; L++) {
      const k = z.slice(0, L);
      if ((total.get(k) ?? 0) === (inT.get(k) ?? 0) && (total.get(k) ?? 0) > 0) { node = k; break; }
    }
    nodes.add(node);
  }
  return [...nodes].sort();
}

/** "801", "802", "803" -> "801-803": runs of three or more numeric siblings as one range. */
export function compact(tokens: string[]): string[] {
  const groups = new Map<string, number[]>();
  const rest: string[] = [];
  for (const t of tokens) {
    if (!isNum(t) || t.length < 2) { rest.push(t); continue; }
    const k = `${t.length}:${t.slice(0, -1)}`;
    const g = groups.get(k);
    if (g) g.push(Number(t.slice(-1))); else groups.set(k, [Number(t.slice(-1))]);
  }
  const out = [...rest];
  for (const [k, digits] of groups) {
    const parent = k.slice(k.indexOf(":") + 1);
    const ds = [...new Set(digits)].sort((a, b) => a - b);
    for (let i = 0; i < ds.length;) {
      let j = i;
      while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
      if (j - i >= 2) out.push(`${parent}${ds[i]}-${parent}${ds[j]}`);
      else for (let x = i; x <= j; x++) out.push(`${parent}${ds[x]}`);
      i = j + 1;
    }
  }
  return out.sort();
}

const cloneRule = (rule: CountryRule | undefined, cc: string): CountryRule => rule
  ? { ...rule, zones: rule.zones.map((z) => ({ ...z, prefixes: [...(z.prefixes ?? [])], ...(z.regions ? { regions: [...z.regions] } : {}) })) }
  : { country: cc, source: "sae", zones: [], defaultOwner: null, keyAccounts: [] };

/**
 * The country's rule with `change` given to `owner`. `all` = every postcode of the country's file with its region
 * code (the map's points), `globalDefault` = TSA Team.
 */
export function assignOnMap(rule: CountryRule | undefined, cc: string, globalDefault: OwnerId, all: FilePoint[], change: MapChange, owner: OwnerId, newId: () => string): EditResult {
  const X = String(owner ?? "");
  if (!X) return { ok: false, error: "No person picked" };
  const before = rulePicker(rule, globalDefault);
  const r = cloneRule(rule, cc);
  const removed: string[] = [];
  let target: Zone | null = r.zones.find((z) => String(z.owner) === X) ?? null;
  const zoneOfX = () => {
    if (!target) { target = { id: newId(), owner: X, prefixes: [], label: "on the map" }; r.zones.push(target); }
    return target;
  };

  // what is given, as postcodes of the file
  let T: Set<string>;
  let nodes: string[];
  let regionOf: (P: string) => string | null;
  if (change.kind === "postcodes") {
    const zips = [...new Set(change.zips.map(cleanZip).filter(Boolean))];
    if (!zips.length) return { ok: false, error: "No postcode picked" };
    T = new Set(zips);
    nodes = zips;
    const reg = new Map(all.map((p) => [p.clean, p.region] as const));
    regionOf = (P) => reg.get(P) ?? null;
  } else {
    const R = new Set(change.regions.map(String).filter(Boolean));
    if (!R.size) return { ok: false, error: "No region picked" };
    T = new Set(all.filter((p) => p.region && R.has(p.region)).map((p) => p.clean).filter(Boolean));
    nodes = coverOf(all, T);
    const firstUnder = (P: string) => all.find((p) => p.clean.startsWith(P) && T.has(p.clean))?.region ?? null;
    regionOf = firstUnder;
    // the region codes: out of every zone, into X's
    for (const z of r.zones) if (z.regions?.some((g) => R.has(g))) { removed.push(...z.regions.filter((g) => R.has(g))); z.regions = z.regions.filter((g) => !R.has(g)); }
    const tz = zoneOfX();
    tz.regions = [...new Set([...(tz.regions ?? []), ...R])].sort();
  }

  // everything inside the given prefixes leaves every zone - X's exact token excepted
  for (const P of nodes) {
    for (const z of r.zones) {
      const next: string[] = [];
      for (const t of z.prefixes) {
        if (String(z.owner) === X && parse(t)?.kind === "prefix" && cleanZip(t) === P) { next.push(t); continue; }
        const cut = cutInside(t, P);
        if (cut.length !== 1 || cut[0] !== t) removed.push(t);
        next.push(...cut);
      }
      z.prefixes = next;
    }
  }
  // X gets a prefix only where something else would still decide
  const mid = rulePicker(r, globalDefault);
  const add: string[] = [];
  for (const P of nodes) if (mid(P, regionOf(P)).owner !== X) add.push(P);
  const addTokens = compact(add);
  if (addTokens.length) { const tz = zoneOfX(); tz.prefixes = [...tz.prefixes, ...addTokens]; }
  // zones left with nothing go; a zone's empty region list is left out
  r.zones = r.zones.filter((z) => z.prefixes.length || (z.regions ?? []).length);
  for (const z of r.zones) if (z.regions && !z.regions.length) delete z.regions;

  // the check: the picked postcodes go to X, every other one keeps its person
  const after = rulePicker(r, globalDefault);
  let wrong = 0, moved = 0, side = 0;
  for (const p of all) {
    if (!p.clean) continue;
    const a = String(after(p.clean, p.region).owner), b = String(before(p.clean, p.region).owner);
    if (T.has(p.clean)) { if (a !== X) wrong++; else if (b !== X) moved++; } else if (a !== b) side++;
  }
  if (wrong || side) return { ok: false, error: `The change would not come out clean (${wrong} picked postcodes elsewhere, ${side} others moved) - edit the zones on Rules instead.` };
  const changed = JSON.stringify(r) !== JSON.stringify(rule ?? null);
  return { ok: true, rule: r, added: addTokens, removed: [...new Set(removed)], changed: changed && (moved > 0 || addTokens.length > 0 || removed.length > 0 || change.kind === "regions") };
}
