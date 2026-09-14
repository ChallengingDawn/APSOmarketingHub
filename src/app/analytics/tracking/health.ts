// TRACKING HEALTH — is GA4 still putting sessions in the right channel?
//
// From about midday on 21 Aug 2026 a consent-order defect in the GTM container
// has sessions that arrived from Google Ads or search recorded as Direct. This
// module turns named GA4 reports into the acceptance test agreed for the fix:
// Direct at or under 32% of sessions on 9 of the last 10 weekdays, at or under
// 31% for two full weeks, and page views per user within ±8% of the
// pre-incident baseline (a jump means GA4 is counting twice).
//
// Pure functions only: nothing is fetched and nothing is estimated. A day GA4
// did not return is simply absent, and a ratio without a denominator is null.

import type { Ga4TableReport } from "../integrationApi";
import { dayLabel, percent, signedPercent } from "@/app/charts/format";

export const INCIDENT_DATE = "2026-08-21";
/** Eight full weeks (Mon 22 Jun → Sun 16 Aug) before the week attribution broke. */
export const BASELINE = { from: "2026-06-22", to: "2026-08-16" } as const;
export const BASELINE_WEEKS = 8;
export const ACCEPT = {
  dayMax: 0.32,
  weekdaysNeeded: 9,
  weekdaysOf: 10,
  weekMax: 0.31,
  weeksOf: 2,
  pvTolerance: 0.08,
} as const;
/** Full weeks fetched before the current one. */
export const RECENT_WEEKS = 16;

const DAY = 86_400_000;

export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const shiftIso = (iso: string, days: number): string => isoDay(Date.parse(`${iso}T00:00:00Z`) + days * DAY);
/** Monday 0 … Sunday 6. */
const weekdayIndex = (iso: string): number => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string): string => shiftIso(iso, -weekdayIndex(iso));
export const isWeekday = (iso: string): boolean => weekdayIndex(iso) < 5;

/** GA4's isoYearIsoWeek key ("202633") → the Monday that ISO week starts on. */
export function isoWeekMonday(key: string): string | null {
  const m = /^(\d{4})(\d{2})$/.exec(key);
  if (!m) return null;
  const jan4 = Date.UTC(Number(m[1]), 0, 4);
  const firstMonday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  return isoDay(firstMonday + (Number(m[2]) - 1) * 7 * DAY);
}

/** RECENT_WEEKS full weeks plus the current one, through yesterday (local calendar day). */
export function recentWindow(nowMs: number): { from: string; to: string } {
  const now = new Date(nowMs);
  const today = isoDay(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const to = shiftIso(today, -1);
  return { from: shiftIso(mondayOf(to), -RECENT_WEEKS * 7), to };
}

/* ── channel mix ───────────────────────────────────────────────────────── */

export type Mix = { total: number; direct: number; paid: number; organic: number };
export type DayMix = Mix & { date: string };
export type WeekMix = Mix & { monday: string };

const emptyMix = (): Mix => ({ total: 0, direct: 0, paid: 0, organic: 0 });

function addInto(target: Mix, from: Mix): void {
  target.total += from.total;
  target.direct += from.direct;
  target.paid += from.paid;
  target.organic += from.organic;
}

export const shareOf = (part: number, mix: Mix | null | undefined): number | null =>
  mix && mix.total > 0 ? part / mix.total : null;

/** A date × sessionDefaultChannelGroup → sessions report, one row per day, oldest first. */
export function dailyMix(report: Ga4TableReport): DayMix[] {
  const i = report.metrics.indexOf("sessions");
  const byDate = new Map<string, DayMix>();
  for (const row of report.rows) {
    const [date, channel] = row.keys;
    const n = row.values[i] ?? 0;
    const day = byDate.get(date) ?? { date, ...emptyMix() };
    day.total += n;
    if (channel === "Direct") day.direct += n;
    else if (channel === "Paid Search") day.paid += n;
    else if (channel === "Organic Search") day.organic += n;
    byDate.set(date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Sum of the days between from and to, inclusive. */
export function sumMix(days: DayMix[], from: string, to: string): Mix {
  const out = emptyMix();
  for (const d of days) if (d.date >= from && d.date <= to) addInto(out, d);
  return out;
}

/** Monday-to-Sunday weeks that lie wholly inside the window, oldest first. */
export function fullWeeks(days: DayMix[], window: { from: string; to: string }): WeekMix[] {
  const byMonday = new Map<string, WeekMix>();
  for (const d of days) {
    const monday = mondayOf(d.date);
    if (monday < window.from || shiftIso(monday, 6) > window.to) continue;
    const week = byMonday.get(monday) ?? { monday, ...emptyMix() };
    addInto(week, d);
    byMonday.set(monday, week);
  }
  return [...byMonday.values()].sort((a, b) => a.monday.localeCompare(b.monday));
}

/* ── Google Ads clicks and page views per user ─────────────────────────── */

/** adsClicksDaily (date × campaign → clicks) summed per day. */
export function clicksByDate(report: Ga4TableReport): Map<string, number> {
  const i = report.metrics.indexOf("advertiserAdClicks");
  const out = new Map<string, number>();
  for (const row of report.rows) out.set(row.keys[0], (out.get(row.keys[0]) ?? 0) + (row.values[i] ?? 0));
  return out;
}

export function sumClicks(clicks: Map<string, number>, from: string, to: string): number {
  let n = 0;
  for (const [date, c] of clicks) if (date >= from && date <= to) n += c;
  return n;
}

export type TrafficWeek = { monday: string; users: number; pageViews: number; sessions: number };

export function trafficWeeks(report: Ga4TableReport): Map<string, TrafficWeek> {
  const u = report.metrics.indexOf("totalUsers");
  const pv = report.metrics.indexOf("screenPageViews");
  const s = report.metrics.indexOf("sessions");
  const out = new Map<string, TrafficWeek>();
  for (const row of report.rows) {
    const monday = isoWeekMonday(row.keys[0]);
    if (!monday) continue;
    out.set(monday, { monday, users: row.values[u] ?? 0, pageViews: row.values[pv] ?? 0, sessions: row.values[s] ?? 0 });
  }
  return out;
}

export const pvPerUser = (w: TrafficWeek | null | undefined): number | null =>
  w && w.users > 0 ? w.pageViews / w.users : null;

/* ── the acceptance test ───────────────────────────────────────────────── */

export type HealthState = "healthy" | "recovering" | "degraded" | "alert" | "insufficient";

export type HealthDay = { date: string; direct: number | null; inBand: boolean };
export type HealthWeek = { monday: string; direct: number | null; inBand: boolean; pvPerUser: number | null; pvChange: number | null };

export type Health = {
  state: HealthState;
  baselineDirect: number | null;
  baselinePvPerUser: number | null;
  /** The last ten weekdays in the window, oldest first. */
  days: HealthDay[];
  daysInBand: number;
  /** The last two full weeks, oldest first. */
  weeks: HealthWeek[];
  weeksInBand: boolean;
  lastWeekDirect: number | null;
  pvOk: boolean;
  /** The larger (by size) of the two weeks' page-views-per-user changes, signed. */
  worstPvChange: number | null;
  /** First weekday of the current in-band run, when that run follows an out-of-band weekday after the incident. */
  backInBandSince: string | null;
};

export function assessHealth(input: {
  baseline: DayMix[];
  recent: DayMix[];
  baselineTraffic: Map<string, TrafficWeek>;
  recentTraffic: Map<string, TrafficWeek>;
  window: { from: string; to: string };
}): Health {
  const base = sumMix(input.baseline, BASELINE.from, BASELINE.to);
  const baselineDirect = shareOf(base.direct, base);

  const basePv: number[] = [];
  for (const w of input.baselineTraffic.values()) {
    if (w.monday < BASELINE.from || shiftIso(w.monday, 6) > BASELINE.to) continue;
    const v = pvPerUser(w);
    if (v !== null) basePv.push(v);
  }
  const baselinePvPerUser = basePv.length ? basePv.reduce((a, b) => a + b, 0) / basePv.length : null;

  const days: HealthDay[] = input.recent
    .filter((d) => isWeekday(d.date))
    .slice(-ACCEPT.weekdaysOf)
    .map((d) => {
      const direct = shareOf(d.direct, d);
      return { date: d.date, direct, inBand: direct !== null && direct <= ACCEPT.dayMax };
    });
  const daysInBand = days.filter((d) => d.inBand).length;

  const weeks: HealthWeek[] = fullWeeks(input.recent, input.window)
    .slice(-ACCEPT.weeksOf)
    .map((w) => {
      const direct = shareOf(w.direct, w);
      const pv = pvPerUser(input.recentTraffic.get(w.monday));
      const pvChange = pv !== null && baselinePvPerUser ? pv / baselinePvPerUser - 1 : null;
      return { monday: w.monday, direct, inBand: direct !== null && direct <= ACCEPT.weekMax, pvPerUser: pv, pvChange };
    });
  const weeksInBand = weeks.length === ACCEPT.weeksOf && weeks.every((w) => w.inBand);
  const lastWeekDirect = weeks.length ? weeks[weeks.length - 1].direct : null;

  const changes = weeks.map((w) => w.pvChange).filter((c): c is number => c !== null);
  const pvOk = changes.length === ACCEPT.weeksOf && changes.every((c) => Math.abs(c) <= ACCEPT.pvTolerance);
  const pvHigh = changes.some((c) => c > ACCEPT.pvTolerance);
  const worstPvChange = changes.length ? changes.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : null;

  let backInBandSince: string | null = null;
  let sawOutOfBand = false;
  for (const d of input.recent) {
    if (d.date <= INCIDENT_DATE || !isWeekday(d.date)) continue;
    const direct = shareOf(d.direct, d);
    if (direct !== null && direct <= ACCEPT.dayMax) {
      if (backInBandSince === null && sawOutOfBand) backInBandSince = d.date;
    } else {
      sawOutOfBand = true;
      backInBandSince = null;
    }
  }

  const enough = baselineDirect !== null && days.length === ACCEPT.weekdaysOf && weeks.length === ACCEPT.weeksOf;
  const state: HealthState = !enough
    ? "insufficient"
    : pvHigh
      ? "alert"
      : daysInBand >= ACCEPT.weekdaysNeeded && weeksInBand && pvOk
        ? "healthy"
        : daysInBand >= 3 || (lastWeekDirect !== null && lastWeekDirect <= ACCEPT.weekMax)
          ? "recovering"
          : "degraded";

  return { state, baselineDirect, baselinePvPerUser, days, daysInBand, weeks, weeksInBand, lastWeekDirect, pvOk, worstPvChange, backInBandSince };
}

export type HealthTone = "good" | "warn" | "bad" | "flat";
export type HealthCopy = { label: string; tone: HealthTone; sentence: string };

export function describeHealth(h: Health): HealthCopy {
  const incident = dayLabel(INCIDENT_DATE);
  switch (h.state) {
    case "healthy":
      return {
        label: "Attribution healthy",
        tone: "good",
        sentence: `Direct is at ${percent(h.lastWeekDirect)} of sessions (baseline ${percent(h.baselineDirect)}): ${h.daysInBand} of the last 10 weekdays at or under 32%, the last two full weeks at or under 31%, and page views per user within ±8% of baseline.`,
      };
    case "recovering":
      return {
        label: "Recovering",
        tone: "warn",
        sentence: `${h.daysInBand} of the last 10 weekdays had Direct at or under 32%${h.backInBandSince ? `, in band since ${dayLabel(h.backInBandSince)}` : ""}. It counts as fixed at 9 of 10, with the last two full weeks at or under 31% and page views per user within ±8% of baseline.`,
      };
    case "degraded":
      return {
        label: `Attribution off since ${incident}`,
        tone: "bad",
        sentence: `Direct was ${percent(h.lastWeekDirect)} of sessions in the last full week against ${percent(h.baselineDirect)} before ${incident} — the pattern of the consent defect, where visits from Google Ads and search are recorded as Direct. ${h.daysInBand} of the last 10 weekdays were at or under 32%.`,
      };
    case "alert":
      return {
        label: "Check for double counting",
        tone: "bad",
        sentence: `Page views per user moved ${signedPercent(h.worstPvChange)} against baseline in one of the last two full weeks — more than the ±8% the fix allows. If that follows a GTM publish, check whether GA4 sends two page views per page, and roll the publish back if it does.`,
      };
    default:
      return {
        label: "Not enough data yet",
        tone: "flat",
        sentence: "The check needs ten weekdays and two full weeks inside the window, plus the pre-incident baseline.",
      };
  }
}
