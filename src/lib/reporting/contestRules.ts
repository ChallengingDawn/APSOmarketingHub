// THE NEW CUSTOMER CONTEST'S RULES - which ESO brings the most order intake from customers new to us (Diana Fehr
// 06.11.2026: "a contest to see which ESOs can bring more Order intake ... doesnt matter when they registered BUT no
// revenue orders or order intake before 5th of october ... per eso per team (sarcla, falu, rabe) per month ... only
// include companies that have a recorded sales action on HubSpot - can be a call, an email, a customer visit").
// Her picks the same day: Compass's first order date decides, first_order_date_fehdia only gives the day where Compass
// has none; the order intake counts for the company's Performis SAE, as ESO Reports > Figures credits it; a sales action
// counts whenever it was logged - by someone in ESO ("the activity need to be logged by the ESO not backoffice for
// example"); HubSpot's meetings count too ("cold visits also count and generally hubspot meetings count"); 09.11.2026: only
// a sales action before the company's first order counts (orderBound). No HubSpot here - the read is ./contestReport.ts, tests/my-sales-contest.test.ts.

import { MONTHS, monthTotal, parsePcMonthly } from "./esoRules";

export const CONTEST = { year: 2026, start: "2026-10-05", end: "2026-12-31", label: "5 Oct – 31 Dec 2026" } as const;
/** The contest's months (0 = January): October from the 5th, November, December. */
export const CONTEST_MONTHS = [9, 10, 11] as const;
export const MONTH_HEADS = ["5–31 Oct", "Nov", "Dec"] as const;
/** Compass's monthly figures on the company start here (oi_2015_jan, rev_2015_pc_monthly). */
export const FIRST_YEAR = 2015;
/** "Visit and Report complete": the only visits that count (SARCLA 12.10). */
export const VISIT_DONE = "3972587738";
export const NO_TEAM = "No team";
export const NOT_ESO = "Not ESO";

type Props = Record<string, string | null | undefined>;
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const dayOf = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test(v ?? "") ? v!.slice(0, 10) : null);

/** Everything a company is read with: the first order, the monthly order intake and revenue of every year Compass has. */
export function companyProps(year: number = CONTEST.year): string[] {
  const out = ["name", "createdate", "sae_performis", "order_first_order_date", "first_order_date_fehdia", "compass_first_order_year"];
  for (let y = FIRST_YEAR; y <= year; y++) out.push(`rev_${y}_pc_monthly`, ...MONTHS.map((m) => `oi_${y}_${m}`));
  return out;
}

/** Why a company is not a new customer of the contest. */
export const LEFT_OUT = [
  "Performis SAE is the TSA Team",
  "First order year before 2026",
  "Order intake before October",
  "Revenue before October",
  "First order before 5 October",
  "Day of the first order not known",
] as const;
export type LeftOut = (typeof LEFT_OUT)[number];
/** Where the day of the first order comes from: Compass, else the shop's first order (first_order_date_fehdia), else the company created after the start. */
export type DayFrom = "compass" | "shop" | "created";
export type Standing = { day: string | null; from: DayFrom } | { out: LeftOut };

/**
 * A new customer: no Compass order intake and no revenue in any month before October, no first order year before
 * this one, and the first order on or after 5 October - the EARLIER of Compass's day and the shop's (SARCLA with Diana
 * Fehr 10.11.2026: "no purchases before 5th October this year" - 17 companies had a Compass day after the start but a
 * shop first order before it, some in 2021 with dozens of won deals). A company with neither day counts only when it
 * was created on or after 5 October: Compass's October holds the 1st to the 4th too. The TSA Team's customers are left
 * out (10.11.2026: "TSA exclude yes") - the contest is ESO's.
 */
export function standingOf(p: Props, c: { year: number; start: string } = CONTEST): Standing {
  if ((p.sae_performis ?? "").trim().toLowerCase() === "tsa team") return { out: "Performis SAE is the TSA Team" };
  const fy = num(p.compass_first_order_year);
  if (fy && fy < c.year) return { out: "First order year before 2026" };
  const cut = CONTEST_MONTHS[0];
  for (let y = FIRST_YEAR; y <= c.year; y++) {
    const months = y < c.year ? 12 : cut;
    for (let m = 0; m < months; m++) if (num(p[`oi_${y}_${MONTHS[m]}`])) return { out: "Order intake before October" };
  }
  for (let y = FIRST_YEAR; y <= c.year; y++) {
    const blob = parsePcMonthly(p[`rev_${y}_pc_monthly`]);
    const months = y < c.year ? 12 : cut;
    for (let m = 0; m < months; m++) if (monthTotal(blob, m)) return { out: "Revenue before October" };
  }
  const compass = dayOf(p.order_first_order_date), shop = dayOf(p.first_order_date_fehdia);
  // the earlier of the two is the first order: a shop order before the start is a purchase before it
  const day = compass && shop ? (shop < compass ? shop : compass) : compass ?? shop;
  if (day) return day < c.start ? { out: "First order before 5 October" } : { day, from: day === compass ? "compass" : "shop" };
  const created = dayOf(p.createdate);
  return created && created >= c.start ? { day: null, from: "created" } : { out: "Day of the first order not known" };
}

/** The company's order intake in the contest's months, as Compass writes it on the company (oi_2026_oct …). */
export const intakeOf = (p: Props, year: number = CONTEST.year): number[] => CONTEST_MONTHS.map((m) => num(p[`oi_${year}_${MONTHS[m]}`]));

/* ── the sales actions ─────────────────────────────────────────────────── */

export type ActionKind = "call" | "email" | "meeting" | "visit";
/** A meeting that did not take place. */
const NOT_HELD = new Set(["CANCELED", "NO_SHOW", "RESCHEDULED"]);
/**
 * A sales action by someone in ESO (`isEso` - Back Office, TSA and the rest do not count): a call, an e-mail they sent
 * (HubSpot's EMAIL or a forward - an answer received is the customer's doing, as on the Activities chart), a HubSpot
 * meeting of any type (Cold Visit, C2S …) unless cancelled, missed or moved, a completed visit. A call, meeting or visit
 * is the record owner's; an e-mail is its sender's - only one sent from the address of someone in ESO (`ownerOf`) is
 * theirs: the shared mailboxes (support@, helpline@, sales@, the newsletter) and an e-mail with no sender are automated
 * or the team's, whoever owns the record (Diana Fehr 09.11.2026: "exclude all automated emails - only actual emails by
 * esos count"). Its day: the call's, e-mail's or meeting's time, the visit's date. Up to `end` - the contest's last day,
 * or today while it runs: a meeting still to come is not one held.
 */
export function actionDay(
  kind: ActionKind, p: Props, isEso: (owner: string) => boolean, end: string = CONTEST.end,
  ownerOf: (email: string) => string | null = () => null,
): string | null {
  const who = kind === "email" ? ownerOf((p.hs_email_from_email ?? "").trim().toLowerCase()) : p.hubspot_owner_id;
  if (!who || !isEso(String(who))) return null;
  let day: string | null = null;
  if (kind === "call") day = dayOf(p.hs_timestamp);
  if (kind === "email" && (p.hs_email_direction === "EMAIL" || p.hs_email_direction === "FORWARDED_EMAIL")) day = dayOf(p.hs_timestamp);
  if (kind === "meeting" && !NOT_HELD.has(p.hs_meeting_outcome ?? "")) day = dayOf(p.hs_timestamp);
  if (kind === "visit" && p.hs_pipeline_stage === VISIT_DONE) day = dayOf(p.meeting_date_with_time) ?? dayOf(p.hs_createdate);
  return day && day <= end ? day : null;
}

/**
 * The day a company's sales actions must come before - its first order (Diana Fehr 09.11.2026: "the sales actions ...
 * needs to be before OI date (order date) not after"). The order's own day counts ("same day works too, if it was before
 * the actual order"): the first order dates carry no time, so a sales action that day is taken as before it. With no
 * first order date: up to the 1st of the first month with order intake; with neither, no bound.
 */
export function orderBound(c: { day: string | null; intake: number[] }, year: number = CONTEST.year): string | null {
  if (c.day) return c.day;
  const i = c.intake.findIndex((v) => v > 0);
  return i < 0 ? null : `${year}-${String(CONTEST_MONTHS[i] + 1).padStart(2, "0")}-01`;
}
export const beforeOrder = (action: string, bound: string | null) => !bound || action <= bound;

export type Actions = { calls: number; emails: number; meetings: number; visits: number; last: string | null };
export const noActions = (): Actions => ({ calls: 0, emails: 0, meetings: 0, visits: 0, last: null });
export function addAction(a: Actions, kind: ActionKind, day: string): void {
  if (kind === "call") a.calls++; else if (kind === "email") a.emails++; else if (kind === "meeting") a.meetings++; else a.visits++;
  if (!a.last || day > a.last) a.last = day;
}
export const actionCount = (a: Actions) => a.calls + a.emails + a.meetings + a.visits;

/* ── what the page is drawn from ───────────────────────────────────────── */

export type ContestPerson = { name: string; ownerId: string | null; team: string; eso: boolean };
export type ContestCompany = {
  id: string; name: string;
  /** index into people: the company's Performis SAE as a person */
  person: number;
  day: string | null; from: DayFrom;
  /** order intake in the contest's months */
  intake: number[];
  actions: Actions;
};
export type ContestData = {
  generatedAt: string; today: string;
  people: ContestPerson[];
  /** the line managers' teams, in Map assignment's order */
  teams: string[];
  /** every new customer - with a sales action or not */
  companies: ContestCompany[];
  /** the companies read that are not new customers, by why */
  left: Partial<Record<LeftOut, number>>;
  read: number;
};

export const totalOf = (c: { intake: number[] }) => c.intake.reduce((a, b) => a + b, 0);
/** In the contest: a sales action on record. */
export const counts = (c: ContestCompany) => actionCount(c.actions) > 0;
/** Outside the contest, by what is missing (Diana Fehr 06.11.2026): only the sales action - it orders already - or the sales action and the order intake. */
export const onlyActionMissing = (c: ContestCompany) => !counts(c) && totalOf(c) > 0;
export const nothingYet = (c: ContestCompany) => !counts(c) && totalOf(c) <= 0;
/** A month the contest has reached (December waits for the 1st). */
export const started = (today: string, i: number, year: number = CONTEST.year) => today >= `${year}-${String(CONTEST_MONTHS[i] + 1).padStart(2, "0")}-${i === 0 ? CONTEST.start.slice(8) : "01"}`;

export type Line = { label: string; team: string; eso: boolean; customers: number; intake: number[]; total: number };
const blank = (label: string, team: string, eso: boolean): Line => ({ label, team, eso, customers: 0, intake: CONTEST_MONTHS.map(() => 0), total: 0 });
function add(l: Line, c: ContestCompany) {
  c.intake.forEach((v, i) => { l.intake[i] += v; });
  const t = totalOf(c);
  l.total += t;
  if (t > 0) l.customers++;
}

/** The contest by ESO: each person's counted customers that brought order intake, and the intake month by month. */
export function byPerson(d: ContestData): Line[] {
  const lines = d.people.map((p) => blank(p.name, p.eso ? p.team : NOT_ESO, p.eso));
  for (const c of d.companies) if (counts(c)) add(lines[c.person], c);
  return lines.filter((l) => l.total || l.customers);
}

/** The contest by team: the line managers' teams, then the ESO people in none, then everyone not in ESO. */
export function byTeam(d: ContestData): Line[] {
  const order = [...d.teams, NO_TEAM, NOT_ESO];
  const lines = new Map(order.map((t) => [t, blank(t, t, t !== NOT_ESO)]));
  for (const c of d.companies) {
    if (!counts(c)) continue;
    const p = d.people[c.person];
    add(lines.get(p.eso ? (lines.has(p.team) ? p.team : NO_TEAM) : NOT_ESO)!, c);
  }
  return order.map((t) => lines.get(t)!).filter((l, i) => i < d.teams.length || l.total || l.customers);
}

/** The figures on top, a funnel: new customers, those with a sales action, those that brought order intake, the ESO people scoring. */
export function headline(d: ContestData) {
  const counted = d.companies.filter(counts);
  const bringing = counted.filter((c) => totalOf(c) > 0);
  const esos = new Set(bringing.filter((c) => d.people[c.person].eso).map((c) => c.person));
  return { fresh: d.companies.length, counted: counted.length, bringing: bringing.length, esos: esos.size, intake: counted.reduce((a, c) => a + totalOf(c), 0) };
}
