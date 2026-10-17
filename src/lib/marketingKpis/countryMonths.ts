// SEARCH VISIBILITY BY COUNTRY, month by month (R09, SARCLA 18.10: "we need to build
// this as well") - pure. Search Console answers clicks and impressions per country for
// a month; the hub keeps every whole month (Google drops them after 16 months) and
// draws R09 (clicks from the focus markets) and the country table from them.

import { FOCUS_A3 } from "./countries";

/** "YYYY-MM" -> country (Search Console's alpha-3, lower case) -> [clicks, impressions] */
export type CountryMonths = Record<string, Record<string, [number, number]>>;
type Monthly = { months: (number | null)[]; py: (number | null)[] };

const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/**
 * The months the hub keeps with the ones just read: a fresh month wins, a month
 * Google no longer gives comes from the keep. `complete` says which fresh months
 * are whole (not the running one, not one Google has only partly) - only those are kept.
 */
export function mergeCountryMonths(kept: CountryMonths, fresh: CountryMonths, complete: (month: string) => boolean): { months: CountryMonths; keep: CountryMonths } {
  const months: CountryMonths = { ...kept };
  const keep: CountryMonths = { ...kept };
  for (const [m, rows] of Object.entries(fresh)) {
    if (!Object.keys(rows).length) continue;           // nothing from Google for that month: the keep stands
    if (complete(m)) { months[m] = rows; keep[m] = rows; }
    else if (!kept[m]) months[m] = rows;                 // the running month, or a partial one the keep does not have
  }
  return { months, keep };
}

/** R09: clicks from the focus markets per month, this year and last. */
export function r09Series(months: CountryMonths, year: number): Monthly {
  const out: Monthly = { months: Array(12).fill(null), py: Array(12).fill(null) };
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let i = 0; i < 12; i++) {
      const rows = months[ym(y, i)];
      if (!rows) continue;
      out[side][i] = FOCUS_A3.reduce((s, c) => s + (rows[c]?.[0] ?? 0), 0);
    }
  }
  return out;
}

export type CountryRow = {
  /** Search Console's code - the pages write it out in full */
  label: string;
  clicks: number;
  impressions: number;
  /** clicks on the same months a year earlier, and this year on those months - null when last year has none of them */
  pyClicks: number | null;
  sameClicks: number | null;
  focus: boolean;
};

/**
 * The country table: this year so far (the running month included), and the change on
 * the whole months both years have. Every focus market and the largest others, by clicks.
 */
export function countryTable(months: CountryMonths, year: number, monthsDone: number, top = 15): { rows: CountryRow[]; same: number[] } {
  const same: number[] = [];
  for (let i = 0; i < monthsDone; i++) if (months[ym(year, i)] && months[ym(year - 1, i)]) same.push(i);
  const acc: Record<string, CountryRow> = {};
  const row = (c: string) => (acc[c] ??= { label: c, clicks: 0, impressions: 0, pyClicks: same.length ? 0 : null, sameClicks: same.length ? 0 : null, focus: FOCUS_A3.includes(c) });
  for (const c of FOCUS_A3) row(c);
  for (let i = 0; i < 12; i++) {
    for (const [c, [cl, im]] of Object.entries(months[ym(year, i)] ?? {})) {
      const r = row(c);
      r.clicks += cl; r.impressions += im;
      if (same.includes(i)) r.sameClicks! += cl;
    }
  }
  for (const i of same) for (const [c, [cl]] of Object.entries(months[ym(year - 1, i)] ?? {})) row(c).pyClicks! += cl;
  const all = Object.values(acc).filter((r) => r.clicks > 0 || r.focus);
  const focus = all.filter((r) => r.focus).sort((a, b) => b.clicks - a.clicks);
  const rest = all.filter((r) => !r.focus).sort((a, b) => b.clicks - a.clicks).slice(0, Math.max(0, top - focus.length));
  return { rows: [...focus, ...rest].sort((a, b) => b.clicks - a.clicks), same };
}
