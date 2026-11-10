// COMPANY DUPLICATES > Performis - one company, several customer numbers (pure: the tests compile it on its own).
// SARCLA 10.11.2026: "a main toggle - switch to Performis: the list of companies that are true ERP duplicates, two or
// more ERP numbers ... export Company unique number | company name | new company name. MAIN ACCOUNT: the account that
// buys; SIDE ACCOUNT: several accounts buy - the main gets main, the others this tag; DUPLICATE DON'T USE: they make no
// new orders any more. The title is the only thing we can change in Performis to help the colleagues find the companies."
//   - One company = the same name at the same postcode, or the same website under the same name. A website shared under
//     other names is a group's companies (sisters, brands) - left out.
//   - Within a Mandant with two accounts or more (AG and GmbH are two ledgers - never against each other): the account
//     that buys (an order in the last 12 months - Last Order Date, else Compass's last order year = this year) with the
//     most revenue this year (then last year, then the latest order) is MAIN, the others that buy SIDE, the rest
//     DUPLICATE DON'T USE. None buys: the one that ordered last. (Historical Number of Orders is empty on these accounts.)

import { countryKey, groupKey, nameKey, zipKey, type Company } from "./rules";

export type Role = "main" | "side" | "duplicate";
export const ROLE_TAG: Record<Role, string> = { main: "MAIN ACCOUNT", side: "SIDE ACCOUNT", duplicate: "DUPLICATE DON'T USE" };
export type Account = Company & { role: Role; newName: string; buying: boolean; uniqueNumber: string | null; derived: boolean };
export type PerfFamily = { key: string; why: string; accounts: Account[] };

const TAG_RE = /\s*\((MAIN ACCOUNT|SIDE ACCOUNT|DUPLICATE DON'?T USE)\)\s*$/i;
/** The name without a tag given before - the export can be made again. */
export const baseName = (name: string) => name.replace(TAG_RE, "").trim();
/** Performis's key: the Company Unique Number, else Mandant and number ("100-715700" = M100, 715700). */
export const uniqueOf = (c: Company) => c.unique ?? (c.erp && c.mandant && /^M\d+$/.test(c.mandant) ? `${c.mandant.slice(1)}-${c.erp}` : null);

export function isBuying(c: Company, now = Date.now()): boolean {
  if (c.lastOrder) return Date.parse(c.lastOrder) >= now - 365 * 86400_000;
  return !!c.lastYear && c.lastYear >= new Date(now).getUTCFullYear();
}
const lastOf = (c: Company) => c.lastOrder ?? (c.lastYear ? `${c.lastYear}-01-01` : "");
const ORDER: Role[] = ["main", "side", "duplicate"];

/** The roles of one Mandant's accounts of a company. */
export function rolesOf(accounts: Company[], now = Date.now()): Account[] {
  const buying = new Set(accounts.filter((c) => isBuying(c, now)).map((c) => c.id));
  const rank = [...accounts].sort((a, b) =>
    Number(buying.has(b.id)) - Number(buying.has(a.id)) || b.revenue - a.revenue || b.revenuePy - a.revenuePy || lastOf(b).localeCompare(lastOf(a)) || (a.createdate ?? "").localeCompare(b.createdate ?? ""));
  const main = rank[0]?.id;
  return accounts.map((c) => {
    const role: Role = c.id === main ? "main" : buying.has(c.id) ? "side" : "duplicate";
    const u = uniqueOf(c);
    return { ...c, role, buying: buying.has(c.id), newName: `${baseName(c.name)} (${ROLE_TAG[role]})`, uniqueNumber: u, derived: !c.unique && !!u };
  });
}

/** Every company with two customer numbers or more in one Mandant, and its accounts' roles. */
export function performisFamilies(list: Company[], now = Date.now()): PerfFamily[] {
  const numbered = list.filter((c) => c.erp && c.mandant);
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x); if (!p || p === x) return x; const r = find(p); parent.set(x, r); return r; };
  const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const buckets = new Map<string, Company[]>();
  for (const c of numbered) {
    const n = nameKey(c.name), z = zipKey(c.zip), k = countryKey(c.country);
    const keys = [n && z && k ? `p|${n}|${z}|${k}` : null, n && c.domain ? `w|${c.domain}|${n}` : null].filter((x): x is string => !!x);
    for (const key of keys) (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(c);
  }
  const why = new Map<string, string>();
  const linked = new Set<string>();
  for (const [key, g] of buckets) {
    if (g.length < 2 || new Set(g.map((c) => `${c.erp}|${c.mandant}`)).size < 2) continue;
    for (const c of g) { join(g[0].id, c.id); linked.add(c.id); }
    const text = key.startsWith("p|") ? `Same name at ${g[0].zip}${g[0].city ? ` ${g[0].city}` : ""}, ${g[0].country}` : `Same name and website ${g[0].domain}`;
    for (const c of g) if (!why.has(c.id)) why.set(c.id, text);
  }
  const comps = new Map<string, Company[]>();
  for (const c of numbered) if (linked.has(c.id)) { const r = find(c.id); (comps.get(r) ?? comps.set(r, []).get(r)!).push(c); }
  const out: PerfFamily[] = [];
  for (const g of comps.values()) {
    const byMandant = new Map<string, Company[]>();
    for (const c of g) (byMandant.get(c.mandant!) ?? byMandant.set(c.mandant!, []).get(c.mandant!)!).push(c);
    const accounts = [...byMandant.values()].filter((m) => new Set(m.map((c) => c.erp)).size >= 2).flatMap((m) => rolesOf(m, now));
    if (accounts.length < 2) continue;
    accounts.sort((a, b) => (a.mandant ?? "").localeCompare(b.mandant ?? "") || ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || b.revenue - a.revenue);
    out.push({ key: groupKey(accounts.map((c) => c.id)), why: why.get(accounts[0].id) ?? "Same name", accounts });
  }
  return out.sort((a, b) => b.accounts.length - a.accounts.length || a.accounts[0].name.localeCompare(b.accounts[0].name));
}

/** The export for Performis: Company unique number; Company name; New company name - the accounts with a number. */
export function performisCsv(families: PerfFamily[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [["Company unique number", "Company name", "New company name"].map(q).join(";")];
  for (const f of families) for (const a of f.accounts) if (a.uniqueNumber) lines.push([a.uniqueNumber, a.name, a.newName].map(q).join(";"));
  return `﻿${lines.join("\r\n")}`;
}
