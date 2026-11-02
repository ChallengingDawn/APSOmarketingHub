// NEW COMPANIES - the rules and the figures (pure; the reads and writes are in ../integrations/newCompanies.ts).
//
// SARCLA 02.11.2026: "give Smart Segmentation a fully new tab for the scanning of new companies and their evolution".
// Until now the HubSpot workflow "SARCLA | COMPANY SMARTSEGMENTATION" (3339386054, code secret COMPANYSEG, writes as
// app 26291976) gave every new company its first APSO segment 20 minutes after it was created - measured 02.11: 296 of
// the 316 companies of the last 14 days got it from there, nothing in the hub did. The hub's watcher now does the same,
// 1:1: a free mail domain or 1-5 employees -> APSOmicro, any other -> APSOprospect, only where the segment is empty
// (the APIC from the industry, the workflow's second step, the watcher's enrich already did). And every company created
// in the last two years is followed: where it came from, who gave it its first segment, and what became of it.

import { GENERIC_DOMAINS, TLD_COUNTRY } from "./engine";
import type { HistoryEntry } from "./engine";

export const WORKFLOW_ID = "3339386054";
/** the workflow's custom code writes with the COMPANYSEG token - this private app */
export const WORKFLOW_APP = "26291976";
/** the workflow waits 20 minutes before it decides - the domain and the size often come a little after the company */
export const SEGMENT_AFTER_MIN = 20;
/** how far back the companies are followed: a year, and the year before it to compare with */
export const FOLLOW_DAYS = 731;

/** Which of the three rules decided: a free mail domain, 1-5 employees, any other company */
export type RuleKey = "freemail" | "small" | "other";
export const RULES: RuleKey[] = ["freemail", "small", "other"];
export const RULE_LABEL: Record<RuleKey, string> = { freemail: "A free mail domain → APSOmicro", small: "1–5 employees → APSOmicro", other: "Any other company → APSOprospect" };
export type FirstSegment = { segment: "APSOmicro" | "APSOprospect"; why: string; rule: RuleKey };

/** The workflow's own test, word for word: the domain IS a free mail domain or ends in ".<one of them>"; then 1-5 employees. */
export function firstSegment(p: { domain?: string | null; numberofemployees?: string | null }): FirstSegment {
  const domain = (p.domain ?? "").toLowerCase().trim();
  const employees = parseFloat(p.numberofemployees ?? "") || 0;
  if (domain && [...GENERIC_DOMAINS].some((g) => domain === g || domain.endsWith(`.${g}`))) return { segment: "APSOmicro", why: `free mail domain ${domain}`, rule: "freemail" };
  if (employees > 0 && employees <= 5) return { segment: "APSOmicro", why: `${employees} employees`, rule: "small" };
  return { segment: "APSOprospect", why: "a new company", rule: "other" };
}

/** Who gave a company its first APSO segment. */
export type SetBy = "workflow" | "hub" | "scripts" | "dataset" | "person" | "import" | "flow" | "other" | "none";
export const SET_BYS: SetBy[] = ["workflow", "hub", "scripts", "dataset", "person", "import", "flow", "other", "none"];
export const SET_BY_LABEL: Record<SetBy, string> = {
  workflow: "The HubSpot workflow (COMPANYSEG)", hub: "The hub", scripts: "The old segmentation (SARCLA Reports app)", dataset: "A HubSpot data sync (dataset)",
  person: "A person", import: "An import", flow: "Another HubSpot workflow", other: "Another app", none: "No segment yet",
};
/** the SARCLA Reports app - the segmentation scripts (May 2026) and the Compass connector wrote with it until 05.10.2026 */
const SCRIPTS_APP = "36826356";

export function setByOf(e: HistoryEntry | undefined, hubApps: Set<string>): SetBy {
  if (!e) return "none";
  const src = e.sourceType ?? "", id = String(e.sourceId ?? "");
  if (src === "INTEGRATION" && id === WORKFLOW_APP) return "workflow";
  if (src === "INTEGRATION" && hubApps.has(id)) return "hub";
  if (src === "INTEGRATION" && id === SCRIPTS_APP) return "scripts";
  // measured 02.11.2026: the February 2026 import got its segments from two HubSpot datasets (105132819, 105141115)
  if (src === "DATASET") return "dataset";
  if (src === "AUTOMATION_PLATFORM") return "flow";
  if (src === "CRM_UI" || src === "CRM_UI_BULK_ACTION" || src.startsWith("MOBILE")) return "person";
  if (src === "IMPORT") return "import";
  return "other";
}

/** The first value a property ever had (oldest history entry with a value). */
export function firstValue(hist: HistoryEntry[] | undefined): HistoryEntry | undefined {
  return [...(hist ?? [])].filter((h) => (h.value ?? "").trim()).sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""))[0];
}

/**
 * Where a company came from, from HubSpot's own record source: "wf:<workflow name>", "person" (with the user in
 * `by`), "app:<app>", "form:<form>", "import", "chatspot", "clone", or the source's name.
 */
export function sourceOf(p: Record<string, string | null | undefined>): { src: string; by?: string } {
  const s = (p.hs_object_source ?? "").trim(), d1 = (p.hs_object_source_detail_1 ?? "").trim(), id = (p.hs_object_source_id ?? "").trim();
  if (s === "CRM_UI" || s === "CRM_UI_BULK_ACTION" || s.startsWith("MOBILE")) {
    const u = /userId:(\d+)/.exec(id)?.[1];
    return { src: "person", ...(u ? { by: u } : {}) };
  }
  if (s === "AUTOMATION_PLATFORM") return { src: `wf:${d1 || "a workflow"}` };
  if (s === "INTEGRATION") return { src: `app:${d1 || id || "an app"}` };
  if (s === "FORM") return { src: `form:${d1 || "a form"}` };
  if (s === "IMPORT") return { src: "import" };
  if (s === "CHATSPOT") return { src: "chatspot" };
  if (s === "CLONE_OBJECTS") return { src: "clone" };
  return { src: s ? s.toLowerCase() : "unknown" };
}

/** A source in words; a person's name from `users` (HubSpot user id -> name). */
export function sourceLabel(src: string, by: string | undefined, users: Record<string, string>): string {
  if (src === "person") return by ? users[by] ?? `User ${by}` : "A person";
  if (src.startsWith("wf:")) return `Workflow: ${src.slice(3)}`;
  if (src.startsWith("app:")) return `App: ${src.slice(4)}`;
  if (src.startsWith("form:")) return `Form: ${src.slice(5)}`;
  return ({ import: "An import", chatspot: "ChatSpot (HubSpot's assistant)", clone: "Copied from another company", unknown: "Not recorded" } as Record<string, string>)[src] ?? src;
}

/** One company followed - short keys, ~25,000 of them are kept. */
export type NewCo = {
  id: string; n: string;
  /** created, the day (UTC) and the time */
  d: string; t: string;
  /** country */
  k: string;
  /** where it came from (sourceOf), and the person who created it */
  src: string; by?: string;
  /** first segment, who gave it, minutes after the creation */
  f: string; fb: SetBy; fm: number | null;
  /** when the workflow or the hub gave it: which rule, from the domain and the size as they were at that moment */
  ru?: RuleKey;
  /** segment today, priority today (its first character, "" none) */
  s: string; p: string;
  /** invoiced revenue from the year it was created on */
  r: number;
  /** owner today, contacts, has a domain */
  o: string; c: number; dom: boolean;
};

export type NewDoc = { at: string; since: string; rows: NewCo[]; owners: Record<string, string>; users: Record<string, string>; hubApps: string[] };

/** The country as a name - HubSpot holds "CH" beside "Switzerland" (02.11.2026: 790 "CH", 776 "DE", 621 "IT" in a year). */
export function countryName(k: string | null | undefined): string {
  // "The Netherlands" beside "Netherlands"
  const v = (k ?? "").trim().replace(/^the\s+/i, "");
  if (!v) return "No country";
  if (/^[A-Za-z]{2}$/.test(v)) return TLD_COUNTRY[v.toLowerCase()] ?? ({ GB: "United Kingdom", US: "United States" } as Record<string, string>)[v.toUpperCase()] ?? v.toUpperCase();
  return v;
}

/* ── the figures of a period ─────────────────────────────────────────────── */

const bump = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] ?? 0) + n; };
export const NO_SEGMENT = "No APSO segment";
export const segOf = (s: string) => s || NO_SEGMENT;
export const moveOf = (x: Pick<NewCo, "f" | "s">) => (x.f === x.s ? `${segOf(x.s)}, as it came` : `${segOf(x.f)} → ${segOf(x.s)}`);
/** the first segment within the hour - the workflow's 20 minutes, the hub's watcher */
export const FAST_MIN = 60;

export type Side = {
  from: string; to: string; n: number;
  seg: Record<string, number>; first: Record<string, number>; who: Partial<Record<SetBy, number>>; moves: Record<string, number>;
  src: Record<string, number>; country: Record<string, number>; owner: Record<string, number>; prio: Record<string, number>;
  bought: number; revenue: number; fast: number; changed: number;
  /** given by the rules (the workflow or the hub), and by which rule; a customer segment today */
  byRules: number; rules: Partial<Record<RuleKey, number>>; customer: number;
};
/** the segments a customer is in */
export const CUSTOMER_SEGMENTS = new Set(["APSOcore", "APSOgrowth", "Growth Engine Customer"]);
export const byTheRules = (x: Pick<NewCo, "fb">) => x.fb === "workflow" || x.fb === "hub";
export type Bucket = { x: string; n: number; seg: Record<string, number>; first: Record<string, number>; bought: number; revenue: number; changed: number; prio: Record<string, number> };
export type NewFigures = { now: Side; before: Side; since: string; at: string; buckets: Bucket[]; byDay: boolean; owners: Record<string, string>; users: Record<string, string> };

/** the sources of a person are counted per person ("person:<user id>") */
export const srcKey = (x: Pick<NewCo, "src" | "by">) => (x.src === "person" ? `person:${x.by ?? ""}` : x.src);

function side(rows: NewCo[], from: string, to: string): Side {
  const out: Side = { from, to, n: 0, seg: {}, first: {}, who: {}, moves: {}, src: {}, country: {}, owner: {}, prio: {}, bought: 0, revenue: 0, fast: 0, changed: 0, byRules: 0, rules: {}, customer: 0 };
  for (const x of rows) {
    if (x.d < from || x.d > to) continue;
    out.n++;
    bump(out.seg, segOf(x.s)); bump(out.first, segOf(x.f)); out.who[x.fb] = (out.who[x.fb] ?? 0) + 1; bump(out.moves, moveOf(x));
    bump(out.src, srcKey(x)); bump(out.country, countryName(x.k)); bump(out.owner, x.o); bump(out.prio, x.p);
    if (x.r > 0) { out.bought++; out.revenue += x.r; }
    if (x.fm !== null && x.fm <= FAST_MIN) out.fast++;
    if (x.f && x.f !== x.s) out.changed++;
    if (byTheRules(x)) { out.byRules++; if (x.ru) out.rules[x.ru] = (out.rules[x.ru] ?? 0) + 1; }
    if (CUSTOMER_SEGMENTS.has(x.s)) out.customer++;
  }
  return out;
}

/** The days before a period, as many as it has (the same as Back Office's). */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const day = 86_400_000, a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  const n = Math.round((b - a) / day) + 1;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(a - n * day), to: iso(a - day) };
}

export function newFigures(doc: NewDoc, from: string, to: string): NewFigures {
  const prev = previousWindow(from, to);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const byDay = days <= 62;
  const buckets = new Map<string, Bucket>();
  for (const x of doc.rows) {
    if (x.d < from || x.d > to) continue;
    const k = byDay ? x.d : x.d.slice(0, 7);
    const b = buckets.get(k) ?? { x: k, n: 0, seg: {}, first: {}, bought: 0, revenue: 0, changed: 0, prio: {} };
    b.n++; bump(b.seg, segOf(x.s)); bump(b.first, segOf(x.f)); bump(b.prio, x.p);
    if (x.r > 0) { b.bought++; b.revenue += x.r; }
    if (x.f && x.f !== x.s) b.changed++;
    buckets.set(k, b);
  }
  return {
    now: side(doc.rows, from, to), before: side(doc.rows, prev.from, prev.to), since: doc.since, at: doc.at,
    buckets: [...buckets.values()].sort((a, b) => a.x.localeCompare(b.x)), byDay, owners: doc.owners, users: doc.users,
  };
}

/** What a click on a chart narrows the list to. */
export type NewPick = { rule?: RuleKey; byRules?: boolean; fast?: boolean; changed?: boolean; customer?: boolean; seg?: string; first?: string; who?: SetBy; move?: string; src?: string; country?: string; owner?: string; prio?: string; bought?: boolean; bucket?: string; q?: string };

export function newList(doc: NewDoc, from: string, to: string, pick: NewPick, max = 300): { rows: NewCo[]; total: number } {
  const q = (pick.q ?? "").trim().toLowerCase();
  const hit = doc.rows.filter((x) => x.d >= from && x.d <= to
    && (pick.seg === undefined || segOf(x.s) === pick.seg)
    && (pick.first === undefined || segOf(x.f) === pick.first)
    && (pick.who === undefined || x.fb === pick.who)
    && (pick.move === undefined || moveOf(x) === pick.move)
    && (pick.src === undefined || srcKey(x) === pick.src)
    && (pick.country === undefined || countryName(x.k) === pick.country)
    && (pick.owner === undefined || x.o === pick.owner)
    && (pick.prio === undefined || x.p === pick.prio)
    && (pick.bought === undefined || (x.r > 0) === pick.bought)
    && (pick.bucket === undefined || x.d.startsWith(pick.bucket))
    && (pick.rule === undefined || (byTheRules(x) && x.ru === pick.rule))
    && (pick.byRules === undefined || byTheRules(x) === pick.byRules)
    && (pick.fast === undefined || (x.fm !== null && x.fm <= FAST_MIN) === pick.fast)
    && (pick.changed === undefined || (!!x.f && x.f !== x.s) === pick.changed)
    && (pick.customer === undefined || CUSTOMER_SEGMENTS.has(x.s) === pick.customer)
    && (!q || x.n.toLowerCase().includes(q) || x.id === q));
  hit.sort((a, b) => b.t.localeCompare(a.t) || b.id.localeCompare(a.id));
  return { rows: hit.slice(0, max), total: hit.length };
}
