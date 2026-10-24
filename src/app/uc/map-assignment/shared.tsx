"use client";

// MAP ASSIGNMENT - what the views share: the views, names, the person colours, the postcode -> person lookup the map
// draws with (the same longest-prefix rule as zoneFor in rules.ts, compiled once per edit so 8,000 postcodes redraw
// while typing), the rule checks before a save, and the static geo files (public/geo/...).

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import type { Geometry } from "geojson";
import { cleanZip, saeKey, type AssignRules, type CountryRule, type OwnerId, type Zone } from "@/lib/mapAssign/rules";
import type { MapData, Owner } from "@/lib/mapAssign/api";

// Rules and Performis are the map's Options panel since 20.10.2026 (SARCLA: "merge in one simpler map")
// The SAE table of every country: a view of its own since 20.10.2026 ("put it on a completely separate tab")
// Redirections left the page 20.10.2026 (SARCLA: "the redirection tab should not be needed as you can redirect on the
// map"); Owner redirection's own rules keep running until switched off
// Differences became Contacts 21.10.2026 (SARCLA: "instead of Differences I want to see the KPI of new contacts ... and
// the contact association"); the differences by topic are folded inside it
// Wrong Performis Owners 24.10.2026 (SARCLA: "change it in Performis but create a tab Wrong Performis Owners so we can
// list the deviation")
export type View = "map" | "sae" | "performis" | "contacts" | "nocompany" | "live";
export const VIEW_HASH: Record<View, string> = {
  map: "#map", sae: "#sae-table", performis: "#wrong-performis-owners", contacts: "#contacts", nocompany: "#no-company", live: "#live",
};
/** Old links: #differences opens Contacts (and the address becomes #contacts). */
export const OLD_VIEW_HASH = { differences: "#differences" } as const;

const PORTAL = "26492587";
export const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
export const hsContact = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-1/${id}`;

export const API = "/api/uc/map-assignment";

/** The hub's request-body limit (a WAF rule in front of it: a bigger body gets a bare 403 the route never sees). */
export const MAX_BODY = 8000;
export const bodyBytes = (body: object) => new TextEncoder().encode(JSON.stringify(body)).length;

/** PUT / POST to the route; the answer as {ok, error, data}, whatever came back. */
export async function send(method: "PUT" | "POST", body: object): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const size = bodyBytes(body);
  if (size > MAX_BODY) return { ok: false, error: `too big to send in one go (${Math.ceil(size / 1024)} KB; the hub takes 8 KB)` };
  try {
    const r = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await r.text();
    let j: { ok?: boolean; error?: string; data?: unknown } = {};
    try { j = JSON.parse(text) as typeof j; } catch { return { ok: false, error: r.status === 403 ? "refused (HTTP 403) - signed out, or the request was too big" : `HTTP ${r.status} - the route did not answer in JSON` }; }
    if (j.ok === true) return { ok: true, data: j.data };
    return { ok: false, error: j.error ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Saving the edited rules: one PUT {patch} per part that changed - the SAE table and the default (TSA Team), each
 * country - since the whole rules are past 8 KB (8.4 KB as seeded). Every part's size is checked before anything is
 * sent; then they go one after the other, and a failure says which parts were saved before it.
 */
export async function saveRules(draft: AssignRules, saved: AssignRules, target: "live" | "sandbox" = "live"): Promise<{ ok: boolean; text: string }> {
  const parts: { what: string; body: object }[] = [];
  // the sandbox (SARCLA 24.10.2026): the same patches, sent as {sandbox: {patch}}
  const wrap = (patch: object) => (target === "sandbox" ? { sandbox: { patch } } : { patch });
  const saeChanged = canon(draft.sae) !== canon(saved.sae);
  const defaultChanged = String(draft.defaultOwner) !== String(saved.defaultOwner);
  if (saeChanged || defaultChanged) {
    parts.push({
      what: saeChanged && defaultChanged ? "the SAE table and the default" : saeChanged ? "the SAE table" : "the default",
      body: wrap({ ...(saeChanged ? { sae: draft.sae } : {}), ...(defaultChanged ? { defaultOwner: draft.defaultOwner } : {}) }),
    });
  }
  for (const cc of [...new Set([...Object.keys(draft.countries), ...Object.keys(saved.countries)])].sort()) {
    const a = draft.countries[cc] ?? null, b = saved.countries[cc] ?? null;
    if (canon(a) !== canon(b)) parts.push({ what: countryName(cc), body: wrap({ countries: { [cc]: a } }) });
  }
  if (!parts.length) return { ok: true, text: "Nothing to save." };
  const big = parts.find((p) => bodyBytes(p.body) > MAX_BODY);
  if (big) return { ok: false, text: `Not saved: ${big.what} is ${Math.ceil(bodyBytes(big.body) / 1024)} KB, the hub takes 8 KB in one request - split its key accounts or zones.` };
  const done: string[] = [];
  for (const p of parts) {
    const r = await send("PUT", p.body);
    if (!r.ok) return { ok: false, text: `${done.length ? `Saved ${done.join(", ")}; ` : "Not saved: "}${p.what} failed - ${r.error ?? "?"}` };
    done.push(p.what);
  }
  return { ok: true, text: target === "sandbox" ? `Saved in the sandbox: ${done.join(", ")}.` : `Saved ${done.join(", ")}. Every company is decided again with these rules.` };
}

/** Where two sets of rules differ, part by part as they are saved: "sae" (the SAE table and the default) and countries. */
export function rulesParts(a: AssignRules, b: AssignRules): string[] {
  const out: string[] = [];
  if (canon(a.sae) !== canon(b.sae) || String(a.defaultOwner) !== String(b.defaultOwner)) out.push("sae");
  for (const cc of [...new Set([...Object.keys(a.countries), ...Object.keys(b.countries)])].sort()) {
    if (canon(a.countries[cc] ?? null) !== canon(b.countries[cc] ?? null)) out.push(cc);
  }
  return out;
}
export const partName = (part: string) => (part === "sae" ? "the SAE table" : countryName(part));

/* ── countries ── */

let regionNames: Intl.DisplayNames | null = null;
export function countryName(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc ?? "")) return "No country"; // the engine's "??"
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** The countries in the rules and in the data, biggest first. */
export function countryList(d: MapData, rules: AssignRules): { cc: string; companies: number }[] {
  const m = new Map<string, number>();
  for (const c of d.countries) m.set(c.country, c.companies);
  for (const cc of [...Object.keys(rules.countries), ...Object.keys(d.rules.countries)]) if (!m.has(cc)) m.set(cc, 0);
  return [...m].filter(([cc]) => /^[A-Z]{2}$/.test(cc)).map(([cc, companies]) => ({ cc, companies })).sort((a, b) => b.companies - a.companies || a.cc.localeCompare(b.cc));
}

/* ── people ── */

export type Names = {
  name: (id: OwnerId | null | undefined) => string;
  active: (id: OwnerId) => boolean;
  /** active people, by name - the pickers' list */
  pickable: Owner[];
};
export function namesOf(owners: Owner[]): Names {
  const m = new Map(owners.map((o) => [String(o.id), o]));
  return {
    name: (id) => (id ? m.get(String(id))?.name ?? `owner ${id}` : "nobody"),
    active: (id) => m.get(String(id))?.active !== false,
    pickable: owners.filter((o) => o.active).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** The people a country's rule names (zones, default, key accounts, its SAE redirects) - TSA Team, the default
 *  everywhere, excluded: it is grey. */
export function ruleOwners(rule: CountryRule | undefined, globalDefault: OwnerId): OwnerId[] {
  if (!rule) return [];
  const s = new Set<string>();
  for (const z of rule.zones) if (z.owner) s.add(String(z.owner));
  if (rule.defaultOwner) s.add(String(rule.defaultOwner));
  for (const k of rule.keyAccounts ?? []) if (k.owner) s.add(String(k.owner));
  for (const o of Object.values(rule.saeOverride ?? {})) if (o) s.add(String(o));
  s.delete(String(globalDefault));
  return [...s];
}

/* ── colours ──
   One colour per person, the same in every country and view. The hues are the hub's validated categorical order
   (dataviz reference palette, light mode); a map puts every colour beside every other, so past the first few the
   legend, the hover and the highlight carry identity too. A 9th to 16th person in one country gets the same hues as
   rings (white middle), never a made-up hue. TSA Team - the team that gets whatever no rule places, in every country -
   is grey; a person who has left keeps the colour with a red edge, and the legend stripes them. */

export const HUES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;
const SLOTS = HUES.length * 2;
export const GREY = "#8d97a6";
export const NOBODY = "#c9ced6";
export const LEFT_EDGE = "#9e1b18";

export type Paint = { color: string; ring: boolean; grey: boolean; left: boolean; none: boolean };
export type Palette = (owner: OwnerId | null | undefined) => Paint;

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/**
 * Colours as on a political map: two people who meet in any country never share a colour (up to 16 neighbours).
 * The people the rules name (they own dots on the map) choose first, then the others the scan gives companies to, and
 * within each in the order of the biggest country they appear in, then by id - so the big countries get the plain
 * hues. All of that is fixed while editing (nobody changes colour while you type); whoever the edits add comes last.
 */
export function buildPalette(d: MapData, draft: AssignRules, names: Names): Palette {
  const order = countryList(d, draft).map((c) => c.cc);
  const globalDefault = String(draft.defaultOwner);
  const members = new Map<string, Set<string>>();
  const real = (o: unknown) => !!o && String(o) !== globalDefault;
  const ruled = (cc: string) => [...ruleOwners(d.seeded.countries[cc], globalDefault), ...ruleOwners(d.rules.countries[cc], globalDefault)];
  const scanned = (cc: string) => (d.countries.find((c) => c.country === cc)?.byOwner ?? []).map((b) => String(b.owner ?? "")).filter(real);
  const edited = (cc: string) => ruleOwners(draft.countries[cc], globalDefault);
  const join = (pick: (cc: string) => string[]) => {
    const first = new Map<string, number>();
    order.forEach((cc, i) => {
      for (const o of pick(cc)) {
        const s = members.get(cc);
        if (s) s.add(o); else members.set(cc, new Set([o]));
        if (!first.has(o)) first.set(o, i);
      }
    });
    return [...first].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([o]) => o);
  };
  const slot = new Map<string, number>();
  const colour = (people: string[]) => {
    for (const o of people) {
      if (slot.has(o)) continue;
      const used = new Set<number>();
      for (const m of members.values()) if (m.has(o)) for (const p of m) { const s = slot.get(p); if (s !== undefined) used.add(s); }
      let s = 0;
      while (used.has(s) && s < SLOTS) s++;
      slot.set(o, s < SLOTS ? s : hash(o) % SLOTS);
    }
  };
  const tierA = join(ruled), tierB = join(scanned);
  colour(tierA);
  colour(tierB);
  colour(join(edited));
  return (owner) => {
    if (!owner) return { color: NOBODY, ring: false, grey: false, left: false, none: true };
    const o = String(owner);
    if (o === globalDefault) return { color: GREY, ring: false, grey: true, left: false, none: false };
    const s = slot.get(o) ?? hash(o) % SLOTS;
    return { color: HUES[s % HUES.length], ring: s >= HUES.length, grey: false, left: !names.active(o), none: false };
  };
}

/** A person's colour as a small mark: filled, a ring, or striped with a red edge when they have left. */
export function Swatch({ paint, size = 12 }: { paint: Paint; size?: number }) {
  const bg = paint.left
    ? `repeating-linear-gradient(45deg, ${paint.color} 0 3px, #ffffff 3px 5px)`
    : paint.ring ? "#ffffff" : paint.color;
  return (
    <Box component="span" aria-hidden sx={{
      display: "inline-block", width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bg,
      border: paint.left ? `2px solid ${LEFT_EDGE}` : paint.ring ? `3px solid ${paint.color}` : "1px solid rgba(255,255,255,.9)",
      boxShadow: "0 0 0 1px rgba(21,34,58,.12)", boxSizing: "border-box",
    }} />
  );
}

/* ── postcode -> person, as zoneFor does it ── */

type Compiled = { zone: Zone; prefix: string; len: number; test: (z: string) => boolean };

/** zoneFor's rule, prepared once per edit: the longest matching prefix wins, equal length the first zone listed. */
export function compileZones(zones: Zone[]): Compiled[] {
  const out: Compiled[] = [];
  for (const zone of zones) for (const p of zone.prefixes) {
    const len = p.includes("-") ? p.split("-")[0].length : cleanZip(p).length;
    const r = /^(\w+)-(\w+)$/.exec(p.trim());
    let test: (z: string) => boolean;
    if (r && r[1].length === r[2].length) {
      const n = r[1].length, a = r[1], b = r[2], lo = a.toUpperCase(), hi = b.toUpperCase();
      test = (z) => {
        const head = z.slice(0, n);
        if (head.length < n) return false;
        if (/^\d+$/.test(head + a + b)) return Number(head) >= Number(a) && Number(head) <= Number(b);
        return head >= lo && head <= hi;
      };
    } else {
      const q = cleanZip(p);
      test = (z) => !!q && z.startsWith(q);
    }
    out.push({ zone, prefix: p, len, test });
  }
  return out;
}

/** `clean` = cleanZip(postcode), done once per point. */
export function matchZone(clean: string, compiled: Compiled[]): { zone: Zone; prefix: string } | null {
  if (!clean) return null;
  let best: Compiled | null = null;
  for (const c of compiled) {
    if (!c.test(clean)) continue;
    if (!best || c.len > best.len) best = c;
  }
  return best ? { zone: best.zone, prefix: best.prefix } : null;
}

export type Pick = { owner: OwnerId; how: string; zoneId: string | null };
/**
 * Who a postcode goes to by the zones (a prefix first, then a zone that holds its region - `region` is the region
 * code of the postcode, "CH-BE", as zoneFor takes it), else the country's default person, else the default (TSA Team).
 */
export function postcodePicker(rule: CountryRule | undefined, rules: AssignRules): (clean: string, region?: string | null) => Pick {
  const compiled = compileZones(rule?.zones ?? []);
  const byRegion = new Map<string, Zone>();
  for (const z of rule?.zones ?? []) for (const r of z.regions ?? []) if (!byRegion.has(r)) byRegion.set(r, z);
  const fallback = rule?.defaultOwner || rules.defaultOwner;
  const how = rule?.defaultOwner ? "no zone - the country's default" : "no zone - the default";
  const label = (z: Zone) => (z.label ? ` (${z.label})` : "");
  return (clean, region) => {
    const m = matchZone(clean, compiled);
    if (m) return { owner: m.zone.owner, how: `zone ${m.prefix}${label(m.zone)}`, zoneId: m.zone.id };
    const z = region ? byRegion.get(region) : undefined;
    if (z) return { owner: z.owner, how: `region ${region}${label(z)}`, zoneId: z.id };
    return { owner: fallback, how, zoneId: null };
  };
}

/** Where an SAE's companies go in a country under these rules - as decide() in rules.ts takes the SAE. */
export type SaeTarget = { owner: OwnerId | null; how: "redirect" | "table" | "not-in-country" | "unmapped" | "map" };
export function saeTarget(rules: AssignRules, cc: string, sae: string): SaeTarget {
  const rule = rules.countries[cc];
  if (rule?.source === "map") return { owner: null, how: "map" };
  const k = saeKey(sae);
  const local = Object.entries(rule?.saeOverride ?? {}).find(([x]) => saeKey(x) === k);
  if (local) return { owner: String(local[1]), how: "redirect" };
  const hit = Object.entries(rules.sae).find(([x]) => saeKey(x) === k);
  if (!hit) return { owner: null, how: "unmapped" };
  if (rule?.people?.length && !rule.people.map(String).includes(String(hit[1]))) return { owner: String(hit[1]), how: "not-in-country" };
  return { owner: String(hit[1]), how: "table" };
}

/** A country's SAE redirects with one set (owner) or taken out (null) - matched by saeKey, so a respelt key is replaced. */
export function withOverride(rule: CountryRule, sae: string, owner: OwnerId | null): CountryRule {
  const k = saeKey(sae);
  const next = Object.fromEntries(Object.entries(rule.saeOverride ?? {}).filter(([x]) => saeKey(x) !== k));
  if (owner) next[sae.trim()] = owner;
  const out: CountryRule = { ...rule, saeOverride: next };
  if (!Object.keys(next).length) delete out.saeOverride;
  return out;
}

/** The draft rules' setter, as the page hands it to the views. */
export type SetDraft = (f: (r: AssignRules) => AssignRules) => void;

/** MapPanel's onAssign: a postcode or region given to someone on the map - its country's whole rule after the change
 *  (MapAssign.rule) goes into the draft as it is, like an edit on Rules. */
export const assignInto = (setDraft: SetDraft) => (country: string, change: { rule: CountryRule }) =>
  setDraft((r) => ({ ...r, countries: { ...r.countries, [country]: change.rule } }));

/** An empty rule for a country, as "Add a rule" makes it: Performis decides, no zones. */
export const emptyRule = (cc: string): CountryRule => ({ country: cc, source: "sae", zones: [], defaultOwner: null, keyAccounts: [] });

/* ── editing ── */

/** "30-38, 40-49 869" -> ["30-38", "40-49", "869"]; "30 - 38" reads as one range. */
export const splitPrefixes = (s: string) => s.replace(/\s*-\s*/g, "-").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
export const splitIds = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
/** "be, fr CH-VS" in Switzerland -> ["CH-BE", "CH-FR", "CH-VS"]: the codes of public/geo/shapes/<CC>.json, the country
 *  part may be left out. */
export const splitRegions = (s: string, cc: string) => [...new Set(s.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean)
  .map((x) => (x.includes("-") ? x : `${cc}-${x}`)))];

export function prefixProblem(p: string): string | null {
  const r = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(p);
  if (r) {
    if (r[1].length !== r[2].length) return `"${p}": both ends need the same number of characters`;
    const numeric = /^\d+$/.test(r[1] + r[2]);
    if (numeric ? Number(r[1]) > Number(r[2]) : r[1].toUpperCase() > r[2].toUpperCase()) return `"${p}": the range runs backwards`;
    return null;
  }
  return /^[A-Za-z0-9]+$/.test(p) ? null : `"${p}" is not a postcode or a range`;
}

export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * What stops a save - only what the hub would refuse or could not use. No "X has left" lines (SARCLA 19.10.2026:
 * "these rules are correct but take them out - the workflow will keep going"): a person who has left is never
 * written anyway, the default gets their companies, and the map stripes them.
 */
export function checkRules(r: AssignRules): { errors: string[] } {
  const errors: string[] = [];
  if (!r.defaultOwner) errors.push("No default person or team (today TSA Team)");
  const seen = new Map<string, { k: string; o: string }>();
  for (const [k, o] of Object.entries(r.sae)) {
    if (!o) errors.push(`SAE "${k}" has no person`);
    if (k.length > 120) errors.push(`SAE "${k.slice(0, 40)}..." is too long`);
    const sk = saeKey(k);
    const before = seen.get(sk);
    if (before && String(before.o) !== String(o)) errors.push(`SAE "${k}" and "${before.k}" are the same SAE with two people`);
    else if (!before) seen.set(sk, { k, o: String(o) });
  }
  for (const [cc, rule] of Object.entries(r.countries)) {
    const c = countryName(cc);
    const regionIn = new Map<string, number>();
    rule.zones.forEach((z, i) => {
      const n = `${c}, zone ${i + 1}${z.label ? ` (${z.label})` : ""}`;
      if (!z.owner) errors.push(`${n}: no person`);
      if (!z.prefixes.length && !(z.regions ?? []).length) errors.push(`${n}: no postcodes and no regions`);
      for (const p of z.prefixes) {
        const e = prefixProblem(p);
        if (e) errors.push(`${n}: ${e}`);
      }
      for (const g of z.regions ?? []) {
        // as the hub's check (plan.ts): a code, and one zone per region
        if (!/^[A-Z0-9]{1,4}(-[A-Z0-9]{1,6})?$/i.test(g)) errors.push(`${n}: "${g}" is not a region code`);
        const before = regionIn.get(g.toUpperCase());
        if (before !== undefined && before !== i) errors.push(`${c}: region ${g} is in zone ${before + 1} and zone ${i + 1}`);
        else regionIn.set(g.toUpperCase(), i);
      }
    });
    for (const [k, o] of Object.entries(rule.saeOverride ?? {})) if (!o) errors.push(`${c}: the redirect of SAE "${k}" has no person`);
    (rule.keyAccounts ?? []).forEach((k, i) => {
      const n = `${c}, key accounts ${i + 1}${k.label ? ` (${k.label})` : ""}`;
      if (!k.owner) errors.push(`${n}: no person`);
      if (!k.erpIds.length) errors.push(`${n}: no ERP ids`);
      const odd = k.erpIds.filter((e) => !/^\w{1,20}$/.test(e));
      if (odd.length) errors.push(`${n}: ${odd.slice(0, 3).map((e) => `"${e}"`).join(", ")} ${odd.length === 1 ? "is not an ERP customer id" : "are not ERP customer ids"}`);
    });
  }
  return { errors };
}

/** A field that says nothing: missing, null, [] or {} - "no SAE redirects" whichever way it is written. */
const blank = (x: unknown) => x === undefined || x === null || (Array.isArray(x) ? !x.length : typeof x === "object" && !Object.keys(x as object).length);
/** Same rules? Key order does not count, nor an empty field against a missing one. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => !blank(o[k])).map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/* ── a person picker ── */

export function OwnerPicker({ value, onChange, names, disabled, placeholder = "pick a person", allowEmpty = false, sx }: {
  value: OwnerId | null | undefined; onChange: (v: OwnerId) => void; names: Names; disabled?: boolean; placeholder?: string; allowEmpty?: boolean; sx?: object;
}) {
  const options = useMemo(() => {
    const ids = names.pickable.map((o) => String(o.id));
    if (value && !ids.includes(String(value))) ids.unshift(String(value));
    return ids;
  }, [names, value]);
  return (
    <Autocomplete<string, false, boolean>
      size="small" options={options} value={value ? String(value) : null} disabled={disabled} disableClearable={!allowEmpty}
      getOptionLabel={(id) => `${names.name(id)}${names.active(id) ? "" : " (has left)"}`}
      onChange={(_, v) => onChange(v ?? "")}
      renderInput={(p) => <TextField {...p} placeholder={placeholder} />}
      sx={{ minWidth: 180, ...sx }}
    />
  );
}

/** Several people (a country's people): the active ones to pick from, anyone already in the list kept. */
export function PeoplePicker({ value, onChange, names, disabled, placeholder = "anyone", sx }: {
  value: OwnerId[]; onChange: (v: OwnerId[]) => void; names: Names; disabled?: boolean; placeholder?: string; sx?: object;
}) {
  const picked = useMemo(() => value.map(String), [value]);
  const options = useMemo(() => {
    const ids = names.pickable.map((o) => String(o.id));
    for (const v of picked) if (!ids.includes(v)) ids.unshift(v);
    return ids;
  }, [names, picked]);
  return (
    <Autocomplete<string, true, false>
      multiple size="small" options={options} value={picked} disabled={disabled} filterSelectedOptions
      getOptionLabel={(id) => `${names.name(id)}${names.active(id) ? "" : " (has left)"}`}
      onChange={(_, v) => onChange(v)}
      slotProps={{ chip: { size: "small" } }}
      renderInput={(p) => <TextField {...p} placeholder={picked.length ? "" : placeholder} />}
      sx={{ minWidth: 220, ...sx }}
    />
  );
}

/* ── the geo files (public/geo) ── */

export type PostcodeRow = [string, number, number, ...unknown[]];
export type PostcodeFile = { country: string; points: PostcodeRow[] };
export type ShapeFile = { country: string; outline: Geometry | null; regions: { code: string; name: string; geometry: Geometry }[] };
export type GeoFiles = { points: PostcodeFile | null; shapes: ShapeFile | null };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

let index: Promise<Set<string> | null> | null = null;
/** public/geo/index.json, read loosely: a list of codes, of {country|code}, or an object keyed by code. Null = no index. */
function geoIndex(): Promise<Set<string> | null> {
  index ??= getJson<unknown>("/geo/index.json").then((j) => {
    const codes = new Set<string>();
    const take = (x: unknown) => {
      if (typeof x === "string" && /^[A-Za-z]{2}$/.test(x)) codes.add(x.toUpperCase());
      else if (x && typeof x === "object") { const o = x as Record<string, unknown>; take(o.country ?? o.code ?? o.cc); }
    };
    if (Array.isArray(j)) j.forEach(take);
    else if (j && typeof j === "object") {
      const o = j as Record<string, unknown>;
      if (Array.isArray(o.countries)) o.countries.forEach(take);
      else Object.keys(o).forEach(take);
    }
    return codes.size ? codes : null;
  });
  return index;
}

const geoCache = new Map<string, Promise<GeoFiles>>();
export function loadGeo(cc: string): Promise<GeoFiles> {
  let p = geoCache.get(cc);
  if (!p) {
    p = geoIndex().then(async (have) => {
      if (have && !have.has(cc)) return { points: null, shapes: null };
      const [points, shapes] = await Promise.all([getJson<PostcodeFile>(`/geo/postcodes/${cc}.json`), getJson<ShapeFile>(`/geo/shapes/${cc}.json`)]);
      return {
        points: points && Array.isArray(points.points) ? points : null,
        shapes: shapes && (shapes.outline || Array.isArray(shapes.regions)) ? { ...shapes, outline: shapes.outline ?? null, regions: Array.isArray(shapes.regions) ? shapes.regions.filter((x) => x && x.geometry) : [] } : null,
      };
    });
    geoCache.set(cc, p);
  }
  return p;
}

/** The country's files; null while they load. */
export function useCountryGeo(cc: string | null): GeoFiles | null {
  const [got, setGot] = useState<{ cc: string; files: GeoFiles } | null>(null);
  useEffect(() => {
    if (!cc) return;
    let live = true;
    void loadGeo(cc).then((files) => { if (live) setGot({ cc, files }); });
    return () => { live = false; };
  }, [cc]);
  return got && got.cc === cc ? got.files : null;
}

export const FLAG_LABEL: Record<string, string> = {
  "sae-unmapped": "SAE not in the table",
  "owner-deactivated": "person has left",
  "no-country": "no country",
  "no-zip": "no postcode",
  "not-in-country": "SAE person does not work this country",
};
export const VIA_LABEL: Record<string, string> = { key: "key account", sae: "SAE", zone: "postcode zone", default: "default", redirection: "owner redirection" };
