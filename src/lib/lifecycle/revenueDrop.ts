// UC12 REVENUE DROP - the rules. A company in APSOcore or APSOgrowth with Prio 1 or Prio 2 with €10,000 or more of
// revenue plus order intake in the 12 months before gets one ticket, to its company owner, in one of two steps:
// step 1, lost business - nothing at all in the last 12 months; step 2, revenue drop - still buying, but 30% or more
// below the 12 months before. Rolling: the 12 months end at the last month BOTH series are loaded for (like for like -
// complete months against the same months), and move on as soon as the next month is. Pure: no HubSpot, no clock -
// the read (revenueDropRead.ts) hands in the companies' properties and today.
// (UC12 rebuilt on order intake, Diana 30.10.2026: "company level not contacts, on a rolling basis, only APSOcore and
// APSOgrowth and prio 1 and prio 2, comparing last 12 months (rolling) to the 12 month before that, include OI (it
// should add to revenue), create tickets to the company owner if the revenue drop is 30% or more"; capped the same
// day: "Step 1 fully lost businesses where revenue before was over 10k euro, step 2 revenue drop where earlier 12
// months 10k euro or more"). Order intake per month is the ERP workbook's oi_<y>_<month> total, as the customer
// KPIs read it; the profit-centre blob only where that total is empty (2024, before the workbook wrote it) - the
// blob stops when the revenue load stops keeping order intake (OI_FROM_CSV off), the total does not.
// Article erosion first (Diana 05.11.2026: "make sure that this UC checks against Article Erosion and if for one
// company both need to be triggered we only do it for the article erosion. Only trigger UC12 when no erosion on
// article level is appearing"): a company with an article-erosion ticket (UC16, erosion_key set) in the 12 months up
// to the run gets no UC12 ticket that run - counted as left to Article erosion, not remembered, so it is ticketed in
// a later run once no erosion ticket is that recent. The floor by country, and no internal company (Diana 05.11.2026:
// "can we keep the 10k euro for Switzerland but do 5k euro threshold for other countries"; the 12 months and the
// match on the customer number confirmed the same day): Switzerland by the company's Country/Region - the customer
// key's mandant 100 only where that is empty, as it also carries export customers - and APSOparts' and A+P's own
// companies left out, as Article erosion leaves them out. The ticket reads like an article-erosion ticket (Diana
// 11.11.2026, on the mockup: "ticket looks good"): "REVENUE DROP | -67% | 43'470 EUR | name", the description in
// erosion's order, the "Revenue drop" fields (revenueDropFields.ts), Tags revenue_drop, priority by the amount at risk.

import { MONTHS, monthTotal, parsePcMonthly, prioOf } from "../reporting/esoRules";
import { ESO_OWNERS, PIPE_STAGE, TSA_OWNERS, teamOf } from "../datatracker/rosters";
import { isInternalCompany } from "../datatracker/rules";
import { pyRound, swissInt } from "../erosion/detector";
import { RD_TAG } from "./revenueDropFields";
import { shiftMonth } from "./rules";

/** The segments and priorities in scope - both must match. */
export const SEGMENTS = ["APSOcore", "APSOgrowth"] as const;
export const PRIOS = ["Prio 1", "Prio 2"] as const;
/** The HubSpot values of those priorities, for the search. */
export const PRIO_VALUES = ["1-Prio 1 - Pot >25000€", "2-Prio 2 - Pot btw 2500 & 24999€"] as const;
/** Step 2: a ticket when the last 12 months are this share or more below the 12 before. */
export const DROP_LINE = 0.3;
/** Both steps: revenue plus order intake in the 12 months before, at least (€) - a Swiss company, and any other. */
export const MIN_PREV_CH = 10_000;
export const MIN_PREV_OTHER = 5_000;
/** An article-erosion ticket this many months back, up to the run, leaves the company to Article erosion. */
export const EROSION_MONTHS = 12;
/** A company is ticketed at most once per step in this many months. */
export const COOLDOWN_MONTHS = 12;
/** 1 = lost business (nothing in the last 12 months), 2 = revenue drop (still buying, 30% or more down). */
export type Step = 1 | 2;
export const STEP_NAME: Record<Step, string> = { 1: "Lost business", 2: "Revenue drop" };
/** A month counts as loaded once at least this share as many companies have a figure as a year earlier (as the ESO benchmark). */
export const LOADED_SHARE = 0.6;
/** The read's version - a cached read of another shape is read again. */
export const DROP_SHAPE = 8;

/** "2026-06". */
export type Month = string;

/** One company as the rules take it: its months' revenue and order intake, aligned on `months` of the read. */
export type DropCompany = {
  id: string; name: string; owner: string | null; segment: string; prio: string;
  /** company_unique_number - what an article-erosion ticket names its customer by */
  un: string | null;
  /** in Switzerland: the €10,000 floor, else €5,000 */
  swiss: boolean;
  /** APSOparts' or Angst + Pfister's own company - never in scope */
  internal: boolean;
  /** Country/Region as HubSpot holds it, Major Profit Center, Profit Center Split, Last Order Date - for the ticket */
  country: string | null; major: string | null; split: string | null; lastOrder: string | null;
  rev: number[]; oi: number[];
};

/** The two 12-month windows, by the month the last one ends. */
export type Window = { end: Month; last: [Month, Month]; prev: [Month, Month] };

export function windowOf(end: Month): Window {
  return { end, last: [shiftMonth(end, -11), end], prev: [shiftMonth(end, -23), shiftMonth(end, -12)] };
}

/** Every month of the given years, January first. */
export function monthsOfYears(years: number[]): Month[] {
  return [...years].sort().flatMap((y) => MONTHS.map((_, i) => `${y}-${String(i + 1).padStart(2, "0")}`));
}

/** The properties a company is read with for the given years. */
export function propsFor(years: number[]): string[] {
  return ["name", "hubspot_owner_id", "apso_customer", "sales_priority", "company_unique_number", "country", "domain",
    "major_profit_center", "profit_center_split", "order_last_order_date",
    ...years.flatMap((y) => [`rev_${y}_pc_monthly`, `oi_${y}_pc_monthly`, ...MONTHS.map((m) => `oi_${y}_${m}`)])];
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** A company record's revenue and order intake per month: revenue from rev_<y>_pc_monthly (all profit centres), order
 *  intake from the oi_<y>_<month> total, or oi_<y>_pc_monthly where that total is empty. */
export function companyOf(id: string, p: Record<string, string | null | undefined>, years: number[]): DropCompany {
  const ys = [...years].sort();
  const series = (kind: "rev" | "oi") => ys.flatMap((y) => {
    const blob = parsePcMonthly(p[`${kind}_${y}_pc_monthly`]);
    return MONTHS.map((m, i) => {
      const total = kind === "oi" ? p[`oi_${y}_${m}`] : null;
      return cents(total != null && total !== "" && Number.isFinite(Number(total)) ? Number(total) : monthTotal(blob, i));
    });
  });
  return {
    id: String(id), name: (p.name ?? "").trim() || `Company ${id}`, owner: p.hubspot_owner_id?.trim() || null,
    segment: p.apso_customer ?? "", prio: prioOf(p.sales_priority), un: p.company_unique_number?.trim() || null,
    swiss: swissOf(p.country, p.company_unique_number), internal: isInternalCompany(p.name, p.domain),
    country: p.country?.trim() || null, major: p.major_profit_center?.trim() || null, split: p.profit_center_split?.trim() || null,
    lastOrder: p.order_last_order_date?.trim().slice(0, 10) || null,
    rev: series("rev"), oi: series("oi"),
  };
}

/** Switzerland by Country/Region ("Switzerland" or "CH" as HubSpot holds it); with none, a customer key of mandant 100. */
export function swissOf(country: string | null | undefined, un: string | null | undefined): boolean {
  const c = (country ?? "").trim();
  if (c) return /^(ch|che|switzerland|schweiz|suisse|svizzera)$/i.test(c);
  return (un ?? "").trim().startsWith("100-");
}

/** The company's floor for both steps. */
export const floorOf = (c: { swiss: boolean }) => (c.swiss ? MIN_PREV_CH : MIN_PREV_OTHER);

export const inScope = (c: { segment: string; prio: string; internal?: boolean }) =>
  !c.internal && (SEGMENTS as readonly string[]).includes(c.segment) && (PRIOS as readonly string[]).includes(c.prio);

/**
 * The last month whose revenue AND order intake are loaded: a complete month (before today's) with at least
 * LOADED_SHARE as many companies with a figure as the same month a year earlier. Null when none is.
 * `filled` counts, per month of `months`, the companies with a figure.
 */
export function loadedTo(months: Month[], filled: { rev: number[]; oi: number[] }, today: string): Month | null {
  const running = today.slice(0, 7);
  const ok = (counts: number[], i: number) => counts[i] > 0 && (i < 12 || counts[i] >= LOADED_SHARE * counts[i - 12]);
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i] >= running) continue;
    if (ok(filled.rev, i) && ok(filled.oi, i)) return months[i];
  }
  return null;
}

/** How many companies have a figure in each month. */
export function filledOf(companies: DropCompany[], n: number): { rev: number[]; oi: number[] } {
  const rev = Array(n).fill(0), oi = Array(n).fill(0);
  for (const c of companies) for (let i = 0; i < n; i++) { if (c.rev[i]) rev[i]++; if (c.oi[i]) oi[i]++; }
  return { rev, oi };
}

/** The earliest month a window can end in: its 12 months before need to be read too. */
export const firstEnd = (months: Month[]) => (months.length >= 24 ? months[23] : null);

/** A company's two windows: revenue and order intake each, and the change of their sum. */
export type Measure = {
  revLast: number; oiLast: number; revPrev: number; oiPrev: number;
  last: number; prev: number;
  /** (last - prev) / prev; null when the 12 months before had nothing (there is nothing to drop from). */
  change: number | null;
};

export function measureOf(c: DropCompany, months: Month[], w: Window): Measure {
  const sum = (xs: number[], [from, to]: [Month, Month]) => {
    let s = 0;
    for (let i = 0; i < months.length; i++) if (months[i] >= from && months[i] <= to) s += xs[i] ?? 0;
    return cents(s);
  };
  const revLast = sum(c.rev, w.last), oiLast = sum(c.oi, w.last), revPrev = sum(c.rev, w.prev), oiPrev = sum(c.oi, w.prev);
  const last = cents(revLast + oiLast), prev = cents(revPrev + oiPrev);
  return { revLast, oiLast, revPrev, oiPrev, last, prev, change: prev > 0 ? (last - prev) / prev : null };
}

/** Down by DROP_LINE or more - compared in whole cents, so 70.00 against 100.00 is exactly 30%. */
export function dropped(m: Measure): boolean {
  if (!(m.prev > 0)) return false;
  return Math.round(m.last * 100) * 100 <= Math.round(m.prev * 100) * Math.round((1 - DROP_LINE) * 100);
}

/** The ticket's team, by the company owner's roster; null = the owner is on neither (no ticket, named in the report). */
export const teamOfOwner = (owner: string | null) => teamOf(owner);
export const rosterName = (owner: string | null) => (owner ? ESO_OWNERS[owner] ?? TSA_OWNERS[owner] ?? null : null);

/** Big enough before: the company's floor or more in the 12 months before - in whole cents. */
export const bigBefore = (m: Measure, floor: number) => Math.round(m.prev * 100) >= floor * 100;

/** The step a company's two windows put it in, or null: no ticket. */
export function stepOf(m: Measure, floor: number): Step | null {
  if (!bigBefore(m, floor)) return null;
  if (m.last <= 0) return 1;
  return dropped(m) ? 2 : null;
}

/** One company the rules looked at in a window. */
export type Verdict = { id: string; owner: string | null; team: "ESO" | "TSA" | null; m: Measure; step: Step | null };

export function verdictOf(c: DropCompany, months: Month[], w: Window): Verdict {
  const m = measureOf(c, months, w);
  return { id: c.id, owner: c.owner, team: teamOfOwner(c.owner), m, step: inScope(c) ? stepOf(m, floorOf(c)) : null };
}

/**
 * The runs the calendar replays: a first run 11 months before `end` (or as early as the read allows), then every month
 * to `end`. Not 12: a year after the first run its companies are due again all at once, and that one month would
 * read as the monthly pace.
 */
export function historyEnds(months: Month[], end: Month): Month[] {
  const first = firstEnd(months);
  if (!first || end < first) return [];
  const from = shiftMonth(end, -(COOLDOWN_MONTHS - 1));
  const out: Month[] = [];
  for (let m = from < first ? first : from; m <= end; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** May a company be ticketed in a run ending `end`, given the window end of its last ticket in the same step? */
export function due(lastTicket: Month | undefined, end: Month): boolean {
  return !lastTicket || lastTicket <= shiftMonth(end, -COOLDOWN_MONTHS);
}

/** The memory's key: a company per step - a revenue drop that turns into lost business is ticketed again. */
export const memoryKey = (id: string, step: Step) => `${id}:${step}`;

/** The months each company's article-erosion tickets were created in, by company id. */
export type Erosion = Record<string, Month[]>;

/** From the article-erosion tickets (erosion_customer_number, created month) to the companies they name. */
export function erosionOf(companies: Pick<DropCompany, "id" | "un">[], tickets: { un: string | null; created: Month | null }[]): Erosion {
  const byUn = new Map<string, string>();
  for (const c of companies) if (c.un) byUn.set(c.un, c.id);
  const out: Erosion = {};
  for (const t of tickets) {
    const id = t.un ? byUn.get(t.un.trim()) : undefined;
    if (!id || !t.created) continue;
    (out[id] ??= []).push(t.created);
  }
  return out;
}

/** A run on the window ending `end` is made the month after: an erosion ticket in the 12 months up to that month holds UC12 back. */
export function erodedAt(created: Month[] | undefined, end: Month): boolean {
  if (!created?.length) return false;
  const run = shiftMonth(end, 1), from = shiftMonth(run, -(EROSION_MONTHS - 1));
  return created.some((m) => m >= from && m <= run);
}

/** One run: the window, who it tickets, how many in each step were found, and of them who was held back - by the
 *  cooldown, or left to Article erosion. */
export type Run = { end: Month; tickets: Verdict[]; found: ByStep; heldCooldown: number; eroded: Verdict[] };

/**
 * The runs month by month, as if UC12 had run once at the end of each month in `ends` (ascending), with the memory
 * of every ticket before (memoryKey -> window end). The first run tickets every company in a step; each run after it,
 * only those not ticketed in the same step in the COOLDOWN_MONTHS before - the companies that newly came into it. A
 * company with an article-erosion ticket that recent is left to Article erosion and not remembered.
 */
export function runs(companies: DropCompany[], months: Month[], ends: Month[], memory: Record<string, Month> = {}, erosion: Erosion = {}): Run[] {
  const seen: Record<string, Month> = { ...memory };
  const out: Run[] = [];
  for (const end of ends) {
    const w = windowOf(end);
    const tickets: Verdict[] = [];
    const eroded: Verdict[] = [];
    const found: ByStep = [0, 0];
    let held = 0;
    for (const c of companies) {
      if (!inScope(c)) continue;
      const v = verdictOf(c, months, w);
      if (!v.step) continue;
      found[v.step - 1]++;
      const k = memoryKey(c.id, v.step);
      if (!due(seen[k], end)) { held++; continue; }
      if (erodedAt(erosion[c.id], end)) { eroded.push(v); continue; }
      seen[k] = end;
      tickets.push(v);
    }
    out.push({ end, tickets, found, heldCooldown: held, eroded });
  }
  return out;
}

/** The ticket UC12 would write for a company - what the preview shows and the writer sends. `props` is the whole
 *  ticket as HubSpot takes it: subject, description, pipeline, owner, Tags, priority and the "Revenue drop" fields. */
export type Draft = {
  key: string; companyId: string; owner: string; team: "ESO" | "TSA"; step: Step;
  pipeline: string; stage: string; subject: string; content: string; priority: Priority;
  props: Record<string, string | number>;
};

export type Priority = "HIGH" | "MEDIUM" | "LOW";
/** Priority by the amount at risk: High from €15,000, Medium from €5,000 (erosion's €5,000 / €1,000 would make three in four High). */
export const PRIORITY_FROM: Record<Exclude<Priority, "LOW">, number> = { HIGH: 15_000, MEDIUM: 5_000 };
export const priorityOf = (atRisk: number): Priority => (atRisk >= PRIORITY_FROM.HIGH ? "HIGH" : atRisk >= PRIORITY_FROM.MEDIUM ? "MEDIUM" : "LOW");

/** Euros as erosion writes them: whole, half to even, ' between thousands. */
const amount = (n: number) => swissInt(pyRound(n));
const pctOf = (x: number | null) => (x == null ? "-" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: Month) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const spanName = ([from, to]: [Month, Month]) => `${monthName(from)} - ${monthName(to)}`;

/** What the ticket needs of a company. */
export type TicketCompany = Pick<DropCompany, "id" | "name" | "segment" | "prio" | "un" | "swiss" | "country" | "major" | "split" | "lastOrder">;

/** Null when the company is in no step, or has no owner on the ESO or TSA roster. */
export function draftOf(c: TicketCompany, v: Verdict, w: Window): Draft | null {
  if (!v.step || !v.owner || !v.team) return null;
  const { pipeline, stage } = PIPE_STAGE[v.team];
  const m = v.m;
  const atRisk = pyRound(m.prev - m.last);
  const what = v.step === 1 ? "LOST BUSINESS" : "REVENUE DROP";
  const subject = `${what} | ${v.step === 1 ? "-100%" : pctOf(m.change)} | ${amount(atRisk)} EUR | ${c.name}`;
  const before = `12 months before:  ${amount(m.prev)} EUR (${spanName(w.prev)}) - revenue ${amount(m.revPrev)} + order intake ${amount(m.oiPrev)}\n`;
  const figures = v.step === 1
    ? `The customer bought nothing in the last 12 months (${spanName(w.last)}): no revenue, no order intake.\n\n` + before +
      (m.last < 0 ? `Last 12 months:  ${amount(m.last)} EUR (credit notes)\n` : "") +
      (c.lastOrder ? `Last order:  ${c.lastOrder}\n` : "")
    : `Revenue plus order intake is ${Math.round(-(m.change ?? 0) * 100)}% below the 12 months before.\n\n` +
      `Last 12 months:  ${amount(m.last)} EUR (${spanName(w.last)}) - revenue ${amount(m.revLast)} + order intake ${amount(m.oiLast)}\n` +
      before + `Down by:  ${amount(atRisk)} EUR\n`;
  const content =
    `${what} - Win-back\n\n` + figures + "\n" +
    (c.major ? `Major profit center:  ${c.major}${c.split && c.split !== c.major ? ` (${c.split})` : ""}\n` : "") +
    `Company:  ${c.name}${c.un ? ` (${c.un})` : ""}\n` +
    `Segment:  ${c.segment} · ${c.prio} · ${c.country ?? "no country"} (floor ${swissInt(floorOf(c))} EUR)\n` +
    `Team:  ${v.team} (${rosterName(v.owner)})\n\n` +
    `Action: contact the customer, understand why the business ${v.step === 1 ? "stopped" : "dropped"}, offer follow-up or alternative.\n` +
    "Source: Revenue drop (automated, ERP revenue and order intake)";
  const priority = priorityOf(atRisk);
  const key = `${c.un ?? `id-${c.id}`}|${v.step}|${w.end}`;
  return {
    key, companyId: c.id, owner: v.owner, team: v.team, step: v.step, pipeline, stage, subject, content, priority,
    props: {
      subject, content, hs_pipeline: pipeline, hs_pipeline_stage: stage, hubspot_owner_id: v.owner,
      tags: RD_TAG.value, source_type: "AUTOMATION", hs_ticket_priority: priority,
      revenue_drop_key: key,
      revenue_drop_step: v.step === 1 ? "lost_business" : "revenue_drop",
      revenue_drop_amount_at_risk: atRisk,
      revenue_drop_change_pct: v.step === 1 ? -100 : Math.round((m.change ?? 0) * 100),
      revenue_drop_last_12: pyRound(m.last),
      revenue_drop_prev_12: pyRound(m.prev),
      revenue_drop_window: spanName(w.last),
      revenue_drop_company: c.name.slice(0, 200),
      revenue_drop_customer_number: c.un ?? "",
      revenue_drop_major_profit_center: c.major ?? "",
    },
  };
}

/** Two counts, one per step: [step 1, step 2]. */
export type ByStep = [number, number];

/** Per person: today's tickets per step, and what each earlier month's run would have added per step. */
export type PersonRow = {
  owner: string; team: "ESO" | "TSA" | null; inScope: number;
  /** companies at their floor or more in the 12 months before */
  big: number;
  today: ByStep;
  /** in a step today, left to Article erosion */
  erosion: ByStep;
  /** tickets per earlier run and step, in the order of `ends` (the first run's backlog left out) */
  months: ByStep[];
  /** the earlier runs' tickets per month and step, on average */
  perMonth: ByStep;
};

/**
 * The calendar: each person's tickets in today's first run (window ending `end`), and - from the runs that could
 * have been made before, with memory - how many a month they would have had after a first run. `history` are the
 * runs from the earliest possible window end to `end`, with memory; its first run is the backlog and is left out.
 */
export function calendarOf(companies: DropCompany[], months: Month[], today: Run, history: Run[]): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  const later = history.slice(1);
  const w = windowOf(today.end);
  const row = (owner: string | null) => {
    const k = owner ?? "";
    let r = rows.get(k);
    if (!r) { r = { owner: k, team: teamOfOwner(owner), inScope: 0, big: 0, today: [0, 0], erosion: [0, 0], months: later.map((): ByStep => [0, 0]), perMonth: [0, 0] }; rows.set(k, r); }
    return r;
  };
  for (const c of companies) {
    if (!inScope(c)) continue;
    const r = row(c.owner);
    r.inScope++;
    if (bigBefore(measureOf(c, months, w), floorOf(c))) r.big++;
  }
  for (const v of today.tickets) if (v.step) row(v.owner).today[v.step - 1]++;
  for (const v of today.eroded) if (v.step) row(v.owner).erosion[v.step - 1]++;
  later.forEach((run, i) => { for (const v of run.tickets) if (v.step) row(v.owner).months[i][v.step - 1]++; });
  for (const r of rows.values()) {
    if (!later.length) continue;
    r.perMonth = [r.months.reduce((a, b) => a + b[0], 0) / later.length, r.months.reduce((a, b) => a + b[1], 0) / later.length];
  }
  const all = (r: PersonRow) => r.today[0] + r.today[1];
  return [...rows.values()].sort((a, b) => all(b) - all(a) || b.big - a.big || a.owner.localeCompare(b.owner));
}

/** A company today's run tickets (or would, with an owner on a roster) - one row of the page. */
export type DropRow = Verdict & TicketCompany & { step: Step };

/** What the page gets (revenueDropRead.ts builds it, the page draws it - no monthly series). */
export type DropData = {
  shape: number; readAt: string; today: string; read: number;
  /** the last month each series is loaded to, and the window's end (both) */
  revTo: Month | null; oiTo: Month | null; end: Month | null;
  /** in scope -> bought in the 12 months before -> €10,000 or more before -> in step 1 / step 2 -> of them left to
   *  Article erosion, and of the rest the owner on a roster */
  funnel: { inScope: number; bought: number; big: number; found: ByStep; erosion: ByStep; routed: ByStep };
  /** the article-erosion tickets read, and the companies in scope they name */
  erosionRead: { tickets: number; companies: number };
  rows: DropRow[]; people: PersonRow[];
  /** the replayed runs after the first, oldest first: each person's `months` follow them */
  ends: Month[];
  /** each replayed run's tickets per step, all people */
  perRun: { end: Month; tickets: ByStep }[];
  owners: Record<string, string>;
};
