// OTD Reports > Customers - every OTD line the cube counts, kept one by one, so a customer opens down to its orders and
// articles (SARCLA 10.11.2026: "a sub app is missing customer, which is list where you can find the detail of the OTD then
// by click customer KPI article order and so forth"). Pure: the rows, their dictionaries and the reads of them; kept by
// otdStore.ts (columnar, gzipped, one kv entry) and read by /api/reporting/otd/customers.

import { lateDays, srcOf, type OtdLine } from "./otdRules";

/* ── the days: whole numbers from 1 January 2020 (-1: none) ─────────────────────────── */

const D0 = Date.UTC(2020, 0, 1), DAY = 86_400_000;
export const dayNo = (d?: string): number => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - D0) / DAY) : -1);
export const dayOf = (n: number): string => (n < 0 ? "" : new Date(D0 + n * DAY).toISOString().slice(0, 10));

/** what the nightly article master says of an article: its text, main group, sub group and product (dim_article.csv) */
export type ArtInfo = { t?: string; g?: string; s?: string; p?: string };

/** One line: [customer, order, line, article, mandant (0 = 100, 1 = 110), source (0 eShop, 1 the others), type (0 standard,
 *  1 special), profit centre, supplier (-1: none - GLC), product group (-1: none), planned (0 yes, 1 no, 2 not known), GLC kind
 *  (0: -, 1 leftover, 2 cut to size), the order's day, the first confirmed, the last confirmed, shipped, at the customer, the
 *  customer's wish (days, -1: none), late days (the file's rule: working days from the first confirmed date)] */
export type Row = [number, string, string, number, number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number];
export type LineStore = {
  v: 1; at: string;
  cust: string[]; art: string[]; sup: string[]; pc: string[]; grp: string[];
  /** customer -> [its company's name, the company's owner] in HubSpot */
  names: Record<string, [string, string]>;
  /** article -> [text, sub group, product] from the nightly article master */
  info: Record<string, [string, string, string]>;
  rows: Row[];
};

/** a line as the pages read it */
export type StoredLine = {
  c: string; order: string; line: string; a: string; company: string; src: "e" | "m"; st: "S" | "P"; pc: string;
  /** "" = GLC (no supplier in the ERP) */
  sup: string; group: string; planned: "J" | "N" | ""; glc: "" | "L" | "C";
  orderDay: string; firstDay: string; confDay: string; shipDay: string; atCustomer: string; wishDay: string;
  late: number;
};

function dict() {
  const list: string[] = [], at = new Map<string, number>();
  return { list, of: (s: string) => { let i = at.get(s); if (i === undefined) { i = list.length; list.push(s); at.set(s, i); } return i; } };
}

/** The lines the cube counts (a first confirmed date, at the customer by `today`) with a customer -> the store. */
export function buildLineStore(lines: OtdLine[], today: string, opts: {
  namesOf?: (customer: string) => { name?: string; owner?: string } | undefined;
  infoOf?: (article: string) => ArtInfo | undefined;
  glcOf?: (order: string) => "L" | "C" | undefined;
} = {}): LineStore {
  const cust = dict(), art = dict(), sup = dict(), pc = dict(), grp = dict();
  const names: LineStore["names"] = {}, info: LineStore["info"] = {};
  const rows: Row[] = [];
  for (const l of lines) {
    if (!l.customer || !l.firstDay || !l.atCustomer || l.atCustomer > today) continue;
    const ci = cust.of(l.customer);
    if (!(l.customer in names)) { const n = opts.namesOf?.(l.customer); names[l.customer] = [n?.name ?? "", n?.owner ?? ""]; }
    const ai = art.of(l.article);
    if (!(l.article in info)) { const x = opts.infoOf?.(l.article); info[l.article] = [x?.t ?? "", x?.s ?? "", x?.p ?? ""]; }
    const kind = l.supplier ? undefined : l.glc ?? opts.glcOf?.(l.order);
    rows.push([ci, l.order, l.line, ai, l.company === "110" ? 1 : 0, srcOf(l.source) === "e" ? 0 : 1, l.st === "P" ? 1 : 0, pc.of(l.pc),
      l.supplier ? sup.of(l.supplier) : -1, l.group ? grp.of(l.group) : -1, l.planned === "J" ? 0 : l.planned === "N" ? 1 : 2,
      kind === "L" ? 1 : kind === "C" ? 2 : 0,
      dayNo(l.orderDay), dayNo(l.firstDay), dayNo(l.confDay), dayNo(l.shipDay), dayNo(l.atCustomer), dayNo(l.wishDay),
      lateDays(l.firstDay, l.atCustomer)]);
  }
  for (const k of Object.keys(info)) if (!info[k].some(Boolean)) delete info[k];
  for (const k of Object.keys(names)) if (!names[k].some(Boolean)) delete names[k];
  return { v: 1, at: new Date().toISOString(), cust: cust.list, art: art.list, sup: sup.list, pc: pc.list, grp: grp.list, names, info, rows };
}

export const lineOf = (s: LineStore, r: Row): StoredLine => ({
  c: s.cust[r[0]], order: r[1], line: r[2], a: s.art[r[3]], company: r[4] ? "110" : "100", src: r[5] ? "m" : "e", st: r[6] ? "P" : "S",
  pc: s.pc[r[7]] ?? "", sup: r[8] < 0 ? "" : s.sup[r[8]], group: r[9] < 0 ? "" : s.grp[r[9]],
  planned: r[10] === 0 ? "J" : r[10] === 1 ? "N" : "", glc: r[11] === 1 ? "L" : r[11] === 2 ? "C" : "",
  orderDay: dayOf(r[12]), firstDay: dayOf(r[13]), confDay: dayOf(r[14]), shipDay: dayOf(r[15]), atCustomer: dayOf(r[16]), wishDay: dayOf(r[17]),
  late: r[18],
});

/* ── the reads: a period and the pages' filters ───────────────────────────────────────── */

export type LineFilter = {
  /** the months shown, both ends in ("2026-01".."2026-10") */
  from: string; to: string;
  /** the month a line counts in: its first confirmed date's (the Back Office's KPI) or the day it reached the customer */
  axis: "promised" | "delivered";
  /** "e" eShop, "m" the others; none = all */
  src?: string[]; company?: string[]; st?: string[]; pc?: string[];
};
/** the rows a filter keeps (the customer's own when `customer` is given) */
export function pick(s: LineStore, f: LineFilter, customer?: string): Row[] {
  const lo = dayNo(`${f.from}-01`), hiDate = new Date(Date.UTC(+f.to.slice(0, 4), +f.to.slice(5, 7), 1)), hi = dayNo(hiDate.toISOString().slice(0, 10));
  const ci = customer === undefined ? -1 : s.cust.indexOf(customer);
  if (customer !== undefined && ci < 0) return [];
  const pcs = f.pc?.length ? new Set(f.pc.map((p) => s.pc.indexOf(p))) : null;
  const srcs = f.src?.length ? new Set<number>(f.src.map((x) => (x === "e" ? 0 : 1))) : null;
  const cos = f.company?.length ? new Set<number>(f.company.map((x) => (x === "110" ? 1 : 0))) : null;
  const sts = f.st?.length ? new Set<number>(f.st.map((x) => (x === "P" ? 1 : 0))) : null;
  const day = f.axis === "delivered" ? 16 : 13;
  return s.rows.filter((r) => (ci < 0 || r[0] === ci) && r[day] >= lo && r[day] < hi && (!srcs || srcs.has(r[5])) && (!cos || cos.has(r[4]))
    && (!sts || sts.has(r[6])) && (!pcs || pcs.has(r[7])));
}

/** a customer in the list: its lines in the period, late, late days, more than 10 days late, its orders, month by month */
export type CustomerRow = {
  c: string; name: string; owner: string; company: string;
  n: number; late: number; days: number; over10: number; orders: number; lateOrders: number;
  /** month -> [lines, late] */
  m: Record<string, [number, number]>;
};
export function customerList(s: LineStore, f: LineFilter): CustomerRow[] {
  const by = new Map<number, CustomerRow & { ords: Map<string, boolean> }>();
  const day = f.axis === "delivered" ? 16 : 13;
  for (const r of pick(s, f)) {
    let x = by.get(r[0]);
    if (!x) {
      const c = s.cust[r[0]], nm = s.names[c];
      x = { c, name: nm?.[0] ?? "", owner: nm?.[1] ?? "", company: r[4] ? "110" : "100", n: 0, late: 0, days: 0, over10: 0, orders: 0, lateOrders: 0, m: {}, ords: new Map() };
      by.set(r[0], x);
    }
    const late = r[18] > 0;
    x.n++; if (late) { x.late++; x.days += r[18]; if (r[18] > 10) x.over10++; }
    const o = r[1].replace(/\.\d+$/, "");
    x.ords.set(o, (x.ords.get(o) ?? false) || late);
    const ym = dayOf(r[day]).slice(0, 7), t = (x.m[ym] ??= [0, 0]);
    t[0]++; if (late) t[1]++;
  }
  return [...by.values()].map(({ ords, ...x }) => ({ ...x, orders: ords.size, lateOrders: [...ords.values()].filter(Boolean).length }))
    .sort((a, b) => b.late - a.late || b.n - a.n);
}

/** one customer's lines in the period, with what the pages name: its company and owner, each article's text and groups */
export function customerLines(s: LineStore, f: LineFilter, customer: string): {
  c: string; name: string; owner: string; lines: StoredLine[]; info: Record<string, [string, string, string]>;
} {
  const lines = pick(s, f, customer).map((r) => lineOf(s, r));
  const info: Record<string, [string, string, string]> = {};
  for (const l of lines) if (s.info[l.a]) info[l.a] = s.info[l.a];
  const nm = s.names[customer];
  return { c: customer, name: nm?.[0] ?? "", owner: nm?.[1] ?? "", lines, info };
}
