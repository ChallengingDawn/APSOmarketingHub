// THE LIFECYCLE REPORTS' RULES - dates, windows, cohorts, what counts as
// converted, which company an email belongs to, and the February mark.
//
// Pure: no database, no HubSpot, so the definitions on the pages and the
// numbers under them are tested together (tests/lifecycle.test.ts).
//
// Days are "yyyy-mm-dd" strings throughout. A HubSpot datetime becomes the
// Zurich calendar day it happened on (a ticket raised at 00:30 on 1 April in
// Zurich is an April ticket, not a March one); a HubSpot date stays as it is.

import { FEB_RESTAGE, STAGE } from "./config";

/* ── days and months ───────────────────────────────────────────────────── */

const ZURICH = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });

/** A HubSpot value as a day: epoch ms or an ISO datetime -> the Zurich day; "yyyy-mm-dd" stays. Null when unreadable. */
export function toDay(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ms = /^\d+$/.test(s) ? Number(s) : Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return ZURICH.format(new Date(ms));
}

const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const monthOf = (d: string) => d.slice(0, 7);
export const addDays = (d: string, n: number) => iso(utc(d) + n * 86_400_000);
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86_400_000);

/** The same day n months later; the 31st becomes the month's last day when the month is shorter. */
export function addMonths(d: string, n: number): string {
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) - 1 + n, dd = Number(d.slice(8, 10));
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m, Math.min(dd, last)));
}

/** "2026-02" -> "2026-03". */
export function nextMonth(m: string): string {
  const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}
export function shiftMonth(m: string, n: number): string {
  const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(mo / 12), mm = ((mo % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/** Every month from one to the other, both included. */
export function monthsFrom(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7) && out.length < 600; m = nextMonth(m)) out.push(m);
  return out;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-02" -> "Feb 26", marked when it is the re-stage month. */
export function monthLabel(m: string, mark = true): string {
  const label = `${MON[Number(m.slice(5, 7)) - 1] ?? "?"} ${m.slice(2, 4)}`;
  return mark && isRestageMonth(m) ? `${label} *` : label;
}
export const isRestageMonth = (m: string) => m.slice(0, 7) === FEB_RESTAGE;
/** The words under any chart that includes February 2026. */
export const RESTAGE_NOTE = "* February 2026: mass re-stage of companies.";
export const touchesRestage = (months: string[]) => months.some(isRestageMonth);

/** One entry of a property's history, as HubSpot gives it. */
type Hist = { value?: string | null; timestamp?: string; sourceType?: string; updatedByUserId?: number | string | null };

/**
 * "Qualified by Company Owner" now, and the person who set that value - the
 * latest change made by a user; a merge or a workflow copying it names no one.
 */
export function qualOf(hist: Hist[]): { v: string; by: string | null; day: string | null } | null {
  const h = [...hist].sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));
  const v = h[0]?.value?.trim();
  if (!v) return null;
  const byUser = h.find((e) => e.value?.trim() === v && e.updatedByUserId !== null && e.updatedByUserId !== undefined && String(e.updatedByUserId) !== "");
  return { v, by: byUser ? String(byUser.updatedByUserId) : null, day: toDay((byUser ?? h[0]).timestamp) };
}

/* ── the reporting window ──────────────────────────────────────────────── */

/** The hub-wide period: inclusive days. */
export type Win = { from: string; to: string };

export const inWin = (d: string | null | undefined, w: Win) => !!d && d.slice(0, 10) >= w.from && d.slice(0, 10) <= w.to;

/** A window from the query string, or the last 28 days - never longer than 366 days, never inverted. */
export function parseWin(from: string | null, to: string | null, today: string): Win {
  const ok = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let t = ok(to) ? to : today;
  if (t > today) t = today;
  let f = ok(from) ? from : addDays(t, -27);
  if (f > t) f = t;
  if (daysBetween(f, t) > 366) f = addDays(t, -366);
  return { from: f, to: t };
}

/* ── following a company after it entered a flow ───────────────────────── */

export type Follow = "yes" | "no" | "open";

/**
 * Did something happen within `days` of the start? "open" while those days are
 * not over and it has not happened yet - a cohort from last week is not a failure.
 */
export function within(start: string, happened: string | null | undefined, days: number, today: string): Follow {
  const end = addDays(start, days);
  if (happened && happened >= start && happened <= end) return "yes";
  return today < end ? "open" : "no";
}

/** The same, in calendar months (the second order "within 9 months"). */
export function withinMonths(start: string, happened: string | null | undefined, months: number, today: string): Follow {
  const end = addMonths(start, months);
  if (happened && happened > start && happened <= end) return "yes";
  return today < end ? "open" : "no";
}

/** Share of the decided: yes / (yes + no). Null when nothing is decided yet. */
export function rateOf(f: Follow[]): number | null {
  const yes = f.filter((x) => x === "yes").length, no = f.filter((x) => x === "no").length;
  return yes + no ? yes / (yes + no) : null;
}

/* ── lifecycle stage history ───────────────────────────────────────────── */

/** Who set a stage: a workflow, a person's bulk edit or import, a merge, or anything else. */
export type Src = "wf" | "bulk" | "merge" | "other";
export type Entry = [stage: string, day: string, src: Src];

export function sourceOf(sourceType: string | null | undefined): Src {
  const s = String(sourceType ?? "").toUpperCase();
  if (s === "AUTOMATION_PLATFORM" || s === "WORKFLOWS") return "wf";
  if (s.includes("BULK") || s === "IMPORT") return "bulk";
  if (s.startsWith("MERGE")) return "merge";
  return "other";
}

/**
 * A company's lifecyclestage history (HubSpot gives it newest first) as the
 * stages it ENTERED since a day, oldest first. A repeated value is not a new
 * entry; an empty value ends the previous stage without starting one.
 */
export function stageEntries(history: { value?: string | null; timestamp?: string; sourceType?: string }[], since: string): Entry[] {
  const asc = [...history].filter((h) => h.timestamp).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const out: Entry[] = [];
  let prev: string | null = null;
  for (const h of asc) {
    const v = h.value ? String(h.value) : null;
    if (v && v !== prev) {
      const d = toDay(h.timestamp);
      if (d && d >= since) out.push([v, d, sourceOf(h.sourceType)]);
    }
    prev = v;
  }
  return out;
}

/** The first entry into any of `stages` on or after a day (strictly after when `strict`). */
export function nextEntry(entries: Entry[], after: string, stages: readonly string[], strict = false): Entry | null {
  for (const e of entries) {
    if ((strict ? e[1] > after : e[1] >= after) && stages.includes(e[0])) return e;
  }
  return null;
}

/**
 * Churn episodes: every entry into Churn / Reactivate, and what followed it -
 * Reactivated, Not reactivated, or still open - up to the next churn entry.
 */
export function churnEpisodes(entries: Entry[]): { start: string; src: Src; outcome: "reactivated" | "not" | "open"; on: string | null }[] {
  const out: { start: string; src: Src; outcome: "reactivated" | "not" | "open"; on: string | null }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const [stage, day, src] = entries[i];
    if (stage !== STAGE.churn) continue;
    let outcome: "reactivated" | "not" | "open" = "open";
    let on: string | null = null;
    for (let j = i + 1; j < entries.length; j++) {
      const s = entries[j][0];
      if (s === STAGE.churn) break;
      if (s === STAGE.reactivated) { outcome = "reactivated"; on = entries[j][1]; break; }
      if (s === STAGE.notReactivated) { outcome = "not"; on = entries[j][1]; break; }
    }
    out.push({ start: day, src, outcome, on });
  }
  return out;
}

/** When the company entered a UC flow: the last "Enrolled" in the outcome property's history, else its first value. */
export function enrolledOn(history: { value?: string | null; timestamp?: string }[]): string | null {
  const enrolled = history.filter((h) => h.value === "Enrolled" && h.timestamp).map((h) => String(h.timestamp)).sort();
  if (enrolled.length) return toDay(enrolled[enrolled.length - 1]);
  const any = history.filter((h) => h.timestamp).map((h) => String(h.timestamp)).sort();
  return any.length ? toDay(any[0]) : null;
}

/* ── real orders ───────────────────────────────────────────────────────── */

export type OrderLite = { number: string | null; date: string | null; pipeline: string | null; stage: string | null };

/** The ERP order pipeline and the stages that do not count - the same as the hub's company facts (connectors/steps/rules.ts). */
export const ORDER_RULES = { pipeline: "3687945443", creditNote: "5093087456", cancelled: "5676846286" } as const;

/**
 * The company's orders as the company facts count them: ERP-linked only (a web
 * order without an ERP number does not count yet), no credit note ("G…") and
 * nothing cancelled, and 4711.000 / 4711.001 as ONE order on its earliest day.
 * Returns each order's day, oldest first.
 */
export function orderDays(orders: OrderLite[]): string[] {
  const byKey = new Map<string, string>();
  for (const o of orders) {
    if (o.pipeline && o.pipeline !== ORDER_RULES.pipeline) continue;
    const num = (o.number ?? "").trim();
    if (!num || num.startsWith("G") || o.stage === ORDER_RULES.creditNote || o.stage === ORDER_RULES.cancelled) continue;
    const key = (num.match(/\./g) ?? []).length >= 2 ? num.slice(0, num.lastIndexOf(".")) : num;
    const d = toDay(o.date);
    if (!d) continue;
    const have = byKey.get(key);
    if (!have || d < have) byKey.set(key, d);
  }
  return [...byKey.values()].sort();
}

/** The second distinct order day after the first - null when there is no second order. */
export function secondOrderDay(orders: OrderLite[]): string | null {
  const days = orderDays(orders);
  const first = days[0];
  return days.find((d) => d > first) ?? null;
}

/* ── revenue by month ──────────────────────────────────────────────────── */

const MON_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** The company property holding a month's ERP revenue: "2026-07" -> rev_2026_jul. */
export const revProp = (m: string) => `rev_${m.slice(0, 4)}_${MON_KEYS[Number(m.slice(5, 7)) - 1]}`;

/** Revenue properties of a company record as {"2026-07": 1234.5}; empty and unreadable months are left out. */
export function revenueByMonth(props: Record<string, string | null | undefined>, months: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of months) {
    const v = Number(props[revProp(m)]);
    if (props[revProp(m)] !== null && props[revProp(m)] !== undefined && props[revProp(m)] !== "" && Number.isFinite(v) && v !== 0) out[m] = v;
  }
  return out;
}

/** Revenue over months [from, to], both included. */
export function revenueBetween(rev: Record<string, number> | undefined, from: string, to: string): number {
  if (!rev) return 0;
  let s = 0;
  for (const [m, v] of Object.entries(rev)) if (m >= from && m <= to) s += v;
  return s;
}

/**
 * After a flag in month M: revenue of the n months after it against the same
 * n months a year earlier. Null while those months are not all over (the
 * current month is never complete).
 */
export function afterVsYearBefore(rev: Record<string, number> | undefined, flagMonth: string, n: number, currentMonth: string): { after: number; before: number } | null {
  const a1 = shiftMonth(flagMonth, 1), a2 = shiftMonth(flagMonth, n);
  if (a2 >= currentMonth) return null;
  return { after: revenueBetween(rev, a1, a2), before: revenueBetween(rev, shiftMonth(a1, -12), shiftMonth(a2, -12)) };
}

/* ── tickets ───────────────────────────────────────────────────────────── */

/** "Abandoned Cart 13.563,18 €EUR | …" -> 13563.18. Either decimal mark; a 3-digit tail is thousands. */
export function cartValue(subject: string | null | undefined): number | null {
  const m = /Abandoned Cart\s+([\d.,'’ ]+)/i.exec(subject ?? "");
  if (!m) return null;
  const raw = m[1].replace(/['’ ]/g, "").replace(/[.,]+$/, "");
  if (!raw) return null;
  const dots = (raw.match(/\./g) ?? []).length, commas = (raw.match(/,/g) ?? []).length;
  let n: number;
  if (dots && commas) {
    // both marks: the later one is the decimal mark
    const dec = raw.lastIndexOf(".") > raw.lastIndexOf(",") ? "." : ",";
    const grp = dec === "." ? "," : ".";
    n = Number(raw.split(grp).join("").replace(dec, "."));
  } else if (dots + commas === 0) {
    n = Number(raw);
  } else {
    const sep = dots ? "." : ",";
    const tail = raw.slice(raw.lastIndexOf(sep) + 1);
    // one mark used twice, or followed by exactly three digits, groups thousands
    n = dots + commas > 1 || tail.length === 3 ? Number(raw.split(sep).join("")) : Number(raw.replace(sep, "."));
  }
  return Number.isFinite(n) ? n : null;
}

/** "… | Rating 3/10" -> 3. */
export function ratingOf(subject: string | null | undefined): number | null {
  const m = /Rating\s+(\d{1,2})\s*\/\s*10/i.exec(subject ?? "");
  return m ? Number(m[1]) : null;
}

/** A multi-select or free value as its parts: "A;B" -> ["A", "B"]. */
export const parts = (v: string | null | undefined) => String(v ?? "").split(";").map((s) => s.trim()).filter(Boolean);

/** Counts by value, largest first; empty values count as `empty`. */
export function tally(values: (string | null | undefined)[], empty = "Not filled in"): { label: string; n: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v && String(v).trim() ? String(v).trim() : empty;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/* ── emails ────────────────────────────────────────────────────────────── */

export type EmailName = { uc: string; step: string; version: string; lang: string };

/**
 * An email's name as the UC, the step and the language:
 * "DE_CH_UC10_Retention_2023_Email_2_Instructions_2404" -> UC 10, "Email 2 Instructions", v1, "DE_CH".
 * Null for anything that is not a UC email.
 */
export function parseEmailName(name: string | null | undefined): EmailName | null {
  const tokens = String(name ?? "").trim().split("_").filter(Boolean);
  const i = tokens.findIndex((t) => /^UC\d+$/i.test(t));
  if (i < 0) return null;
  const uc = tokens[i].slice(2);
  let rest = tokens.slice(i + 1);
  let version = "v1";
  rest = rest.filter((t) => {
    if (/^v\d+$/i.test(t)) { version = t.toLowerCase(); return false; }
    return true;
  });
  if (rest.length > 1 && /^\d{4}$/.test(rest[rest.length - 1])) rest = rest.slice(0, -1);
  // "Retention_2023_" is the UC10/11 programme's name, not the step
  if (rest[0] === "Retention" && /^20\d\d$/.test(rest[1] ?? "")) rest = rest.slice(2);
  const step = rest.join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").trim() || "Email";
  return { uc, step, version, lang: tokens.slice(0, i).join("_") || "-" };
}

/** One send: which email (index into the name list), the day, and the company it reached (-1: none). */
export type Send = [name: number, day: string, company: number];

/** The contact's primary company is HubSpot's associatedcompanyid; anything else reached no company. */
export const companyOfContact = (associatedcompanyid: string | number | null | undefined): string | null => {
  const s = associatedcompanyid === null || associatedcompanyid === undefined ? "" : String(associatedcompanyid).trim();
  return /^\d+$/.test(s) ? s : null;
};

/**
 * A contact's "last marketing email" history as the UC sends it records: each
 * value is one send of that email, on the day it became the last one. Names
 * that are not UC emails and sends before `since` are dropped.
 */
export function sendsOf(history: { value?: string | null; timestamp?: string }[], since: string): { name: string; day: string }[] {
  const out: { name: string; day: string }[] = [];
  for (const h of history) {
    const name = String(h.value ?? "").trim();
    if (!name || !parseEmailName(name)) continue;
    const d = toDay(h.timestamp);
    if (d && d >= since) out.push({ name, day: d });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** The last step of a UC that reached a company on or before a day - "which email did it buy after". */
export function lastStepBefore(sends: { step: string; day: string }[], day: string): string | null {
  let best: { step: string; day: string } | null = null;
  for (const s of sends) if (s.day <= day && (!best || s.day >= best.day)) best = s;
  return best?.step ?? null;
}
