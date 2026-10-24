// THE ESO FIGURES' RULES - with no HubSpot in them, so the tests compile them (esoFigures.ts reads; this decides).
// What each figure is: see esoFigures.ts (SARCLA 24.10.2026).

import { teamOf } from "../datatracker/rosters";
import { MONTHS, parsePcMonthly } from "./esoRules";

export type MPair = { cy: number; py: number };
export type Team = "ESO" | "TSA" | "Other" | "None";
export type Book = {
  /** the HubSpot owner id; "" for the companies with no owner */
  id: string; name: string; team: Team; active: boolean;
  /** companies with ERP figures under this owner */
  companies: number;
  /** 12 months, index 0 = January; the running month is month-to-date (ERP), later months 0 */
  rev: { months: MPair[]; mtd: MPair; ytd: MPair };
  oi: { months: MPair[]; mtd: MPair; ytd: MPair };
};
export type EsoFigures = {
  generatedAt: string;
  /** the ERP file's day, as the companies carry it ("2026-10-23") */
  asOf: string | null;
  year: number; py: number;
  /** the running month, 1-12 (the ERP's): its figures are month-to-date */
  month: number;
  /** the months of order intake loaded per company (the monthly load lags the ERP) */
  oiMonths: number;
  books: Book[];
  /** the whole company, from the KPI series - 12 months each */
  total: { rev: MPair[]; oi: MPair[]; forecast: number[] };
  companies: number;
  errors: string[];
};

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const months12 = (): MPair[] => Array.from({ length: 12 }, () => ({ cy: 0, py: 0 }));
const add = (a: MPair, cy: number, py: number) => { a.cy += cy; a.py += py; };

export type CompanyIn = Record<string, string | null | undefined>;
export const companyProps = (year: number) => [
  "hubspot_owner_id", "erp_rev_as_of",
  "erp_rev_mtd_cy", "erp_rev_mtd_py", "erp_rev_ytd_cy", "erp_rev_ytd_py",
  "erp_oi_mtd_cy", "erp_oi_mtd_py", "erp_oi_ytd_cy", "erp_oi_ytd_py",
  `rev_${year}_pc_monthly`, `rev_${year - 1}_pc_monthly`,
  ...MONTHS.map((m) => `oi_${year}_${m}`), ...MONTHS.map((m) => `oi_${year - 1}_${m}`),
];

/** The month the ERP figures stand at: the most common erp_rev_as_of among the companies (a straggler from an older file does not move it). */
export function asOfOf(companies: CompanyIn[]): string | null {
  const n = new Map<string, number>();
  for (const c of companies) { const d = String(c.erp_rev_as_of ?? "").slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) n.set(d, (n.get(d) ?? 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
}

/**
 * The companies' figures per owner. `month` is the running month (1-12): before it the monthly loads, in it the
 * ERP's month-to-date for both years (cut on the same day), after it nothing.
 */
export function booksOf(companies: CompanyIn[], year: number, month: number, names: Map<string, { name: string; active: boolean }>): Book[] {
  const by = new Map<string, Book>();
  for (const c of companies) {
    const id = String(c.hubspot_owner_id ?? "").trim();
    let b = by.get(id);
    if (!b) {
      const who = names.get(id);
      const team: Team = !id ? "None" : teamOf(id) ?? "Other";
      b = { id, name: id ? who?.name ?? `Owner ${id}` : "No owner", team, active: id ? who?.active !== false : true, companies: 0,
        rev: { months: months12(), mtd: { cy: 0, py: 0 }, ytd: { cy: 0, py: 0 } }, oi: { months: months12(), mtd: { cy: 0, py: 0 }, ytd: { cy: 0, py: 0 } } };
      by.set(id, b);
    }
    b.companies += 1;
    add(b.rev.mtd, num(c.erp_rev_mtd_cy), num(c.erp_rev_mtd_py));
    add(b.rev.ytd, num(c.erp_rev_ytd_cy), num(c.erp_rev_ytd_py));
    add(b.oi.mtd, num(c.erp_oi_mtd_cy), num(c.erp_oi_mtd_py));
    add(b.oi.ytd, num(c.erp_oi_ytd_cy), num(c.erp_oi_ytd_py));
    const cy = parsePcMonthly(c[`rev_${year}_pc_monthly`]), py = parsePcMonthly(c[`rev_${year - 1}_pc_monthly`]);
    const total = (m: Record<string, number>) => Object.values(m).reduce((s, x) => s + x, 0);
    for (let i = 0; i < month - 1; i++) {
      add(b.rev.months[i], total(cy[i]), total(py[i]));
      add(b.oi.months[i], num(c[`oi_${year}_${MONTHS[i]}`]), num(c[`oi_${year - 1}_${MONTHS[i]}`]));
    }
    add(b.rev.months[month - 1], num(c.erp_rev_mtd_cy), num(c.erp_rev_mtd_py));
    add(b.oi.months[month - 1], num(c.erp_oi_mtd_cy), num(c.erp_oi_mtd_py));
  }
  return [...by.values()].sort((a, b) => b.rev.ytd.cy - a.rev.ytd.cy);
}

/** A KPI series summed per month, this year and last; `only` keeps one year (the forecast). */
export function monthsOfSeries(rows: { year: number | null; month: number | null; value: number }[], year: number): MPair[] {
  const out = months12();
  for (const r of rows) {
    if (!r.month || r.month < 1 || r.month > 12) continue;
    if (r.year === year) out[r.month - 1].cy += r.value;
    else if (r.year === year - 1) out[r.month - 1].py += r.value;
  }
  return out;
}

/** The months of order intake the companies carry before the running one: a month counts once it holds 60% of last year's. */
export function oiLoaded(books: Book[], month: number): number {
  let n = 0;
  for (let i = 0; i < month - 1; i++) {
    const cy = books.reduce((s, b) => s + b.oi.months[i].cy, 0), py = books.reduce((s, b) => s + b.oi.months[i].py, 0);
    if (!(cy > 0) || cy < 0.6 * py) break;
    n = i + 1;
  }
  return n;
}

