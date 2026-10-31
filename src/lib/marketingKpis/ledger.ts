// THE COMPANIES BEHIND A CHART (SARCLA 31.10.2026: "next to each report in every sub app where there are companies a new
// icon Company appears next to the filter (the filter inside the graph, not the general) and allows to see the companies -
// the graphs expand to show the companies, paginated by 25").
//
// The cube holds counts and sums only. The same read keeps, beside it, every company it counted: its cell in the cube and
// its own figures. A chart's list is then made with the chart's own filters, window and figures - it adds up to the chart.
// Server side only: it carries every company's name.

import { CELL, DIMS, ERP_FIELDS, masks, monthOf, partial, passes, type CompanyIn, type Cube, type Filters, type Win } from "./cube";

export type Ledger = {
  /** the cube's own read time - a list only goes with the cube it was read with */
  generatedAt: string;
  ids: string[];
  names: string[];
  /** each company's cell in the cube */
  cells: number[];
  /** [company, year index, revenue Jan…Dec] - only the years it has revenue in, to the euro */
  rev: number[][];
  /** [company, months bought in the two earlier years, months bought this year] - as the cube's buyers */
  bought: number[][];
  /** [company, year index, order intake Jan…Dec] */
  oi: number[][];
  /** [company, ...ERP_FIELDS] */
  erp: number[][];
  /** [company, month number of its first invoice] - the new customers */
  firsts: number[][];
  /** the profit centres the next rows name */
  pcLabels: string[];
  /** [company, year index (0 this year, 1 last), profit centre, revenue Jan…Dec] */
  pc: number[][];
};

/** A company as the read hands it to the ledger: its id, name and what the cube folded. */
export type LedgerIn = CompanyIn & { id: string; name: string };

const euros = (x: number) => Math.round(x || 0);

/** Keeps every company of the read beside the cube it was folded into. */
export function ledgerOf(cube: Pick<Cube, "generatedAt" | "cells">, companies: LedgerIn[]): Ledger {
  const cellIx = new Map(cube.cells.map((c, i) => [c.slice(0, DIMS.length).join(","), i]));
  const l: Ledger = { generatedAt: cube.generatedAt, ids: [], names: [], cells: [], rev: [], bought: [], oi: [], erp: [], firsts: [], pcLabels: [], pc: [] };
  companies.forEach((c, i) => {
    l.ids.push(c.id);
    l.names.push(c.name);
    l.cells.push(cellIx.get(DIMS.map((d) => c.dims[d]).join(",")) ?? -1);
    let lo = 0, hi = 0;
    c.months.forEach((months, y) => {
      months.forEach((x, m) => {
        if (!(x > 0)) return;
        const k = monthOf(y, m);
        if (k < 24) lo |= 1 << k; else hi |= 1 << (k - 24);
      });
      if (months.some((x) => x !== 0)) l.rev.push([i, y, ...months.map(euros)]);
    });
    if (lo || hi) l.bought.push([i, lo, hi]);
    (c.intake ?? []).forEach((months, y) => { if (months.some((x) => x !== 0)) l.oi.push([i, y, ...months.map(euros)]); });
    if (c.erp?.some((x) => x !== 0)) l.erp.push([i, ...c.erp.map(euros)]);
    if (c.firstInvoiceMonth != null) l.firsts.push([i, c.firstInvoiceMonth]);
    (c.pcMonths ?? []).forEach((months, y) => {
      const pcs = new Set(months.flatMap((m) => Object.keys(m)));
      for (const pc of pcs) {
        const row = months.map((m) => euros(m[pc] ?? 0));
        if (!row.some((x) => x !== 0)) continue;
        let p = l.pcLabels.indexOf(pc);
        if (p < 0) p = l.pcLabels.push(pc) - 1;
        l.pc.push([i, y, p, ...row]);
      }
    });
  });
  return l;
}

/**
 * What a list follows: "rev" the revenue, "oi" the order intake, "cust" the companies that bought in the window, "new"
 * those whose first invoice falls in it, "all" every company the filters leave, "pc:dt" one profit centre's revenue.
 */
export type CompanyBy = "rev" | "oi" | "cust" | "new" | "all" | `pc:${string}`;
export type CompanyQuery = {
  filters: Filters; win: Win;
  /** the ERP's own year or month to date - as the charts on those periods */
  erp?: "ytd" | "mtd" | null;
  by: CompanyBy;
  /** the customers chosen in Filters: only they */
  ids?: string[];
  /** part of a name */
  q?: string;
  page?: number; size?: number;
};
export type CompanyLine = { id: string; name: string; owner: string; sae: string; country: string; prio: string; rev: number; revPy: number; oi: number; oiPy: number };
export type CompanyPage = { total: number; page: number; size: number; rows: CompanyLine[]; sum: { rev: number; revPy: number; oi: number; oiPy: number } };

/** The companies behind a chart, the largest first, a page at a time - with the sums of all of them. */
export function companiesOf(cube: Cube, l: Ledger, q: CompanyQuery): CompanyPage {
  const ok = passes(cube, q.filters);
  const only = q.ids?.length ? new Set(q.ids.map(String)) : null;
  const text = (q.q ?? "").trim().toLowerCase();
  const n = l.ids.length;
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ci = l.cells[i];
    keep[i] = ci >= 0 && ok[ci] && (!only || only.has(l.ids[i])) && (!text || l.names[i].toLowerCase().includes(text)) ? 1 : 0;
  }
  const { start, end } = q.win, ps = start - 12, pe = end - 12;
  // last year's month matching the one in progress counts pro rata, as on the charts
  const run = partial(cube);
  const pyRun = run ? run.month - 12 : -99;
  const share = run ? run.day / run.days : 1;
  const fig = new Map<number, { rev: number; revPy: number; oi: number; oiPy: number }>();
  const at = (i: number) => { let f = fig.get(i); if (!f) { f = { rev: 0, revPy: 0, oi: 0, oiPy: 0 }; fig.set(i, f); } return f; };
  const months = (rows: number[][], skip: number, put: (f: ReturnType<typeof at>, cur: number, prev: number) => void, pcIx = -1) => {
    for (const r of rows) {
      if (!keep[r[0]] || (pcIx >= 0 && r[2] !== pcIx)) continue;
      const base = monthOf(r[1], 0);
      let cur = 0, prev = 0;
      for (let m = 0; m < 12; m++) {
        const k = base + m;
        if (k >= start && k <= end) cur += r[skip + m];
        if (k >= ps && k <= pe) prev += r[skip + m] * (k === pyRun ? share : 1);
      }
      if (cur || prev) put(at(r[0]), cur, prev);
    }
  };
  const pcOf = q.by.startsWith("pc:") ? l.pcLabels.indexOf(q.by.slice(3)) : -1;
  if (q.by.startsWith("pc:")) {
    // one profit centre's revenue, from each customer's months (the ERP's figures know no profit centre)
    if (pcOf >= 0) months(l.pc, 3, (f, c, p) => { f.rev += c; f.revPy += p; }, pcOf);
  } else if (q.erp) {
    const F = (f: string) => 1 + ERP_FIELDS.indexOf(f as (typeof ERP_FIELDS)[number]);
    const [r, rp, o, op] = (q.erp === "ytd" ? ["revYtd", "revYtdPy", "oiYtd", "oiYtdPy"] : ["revMtd", "revMtdPy", "oiMtd", "oiMtdPy"]).map(F);
    for (const e of l.erp) if (keep[e[0]]) Object.assign(at(e[0]), { rev: e[r], revPy: e[rp], oi: e[o], oiPy: e[op] });
  } else {
    months(l.rev, 2, (f, c, p) => { f.rev += c; f.revPy += p; });
    months(l.oi, 2, (f, c, p) => { f.oi += c; f.oiPy += p; });
  }
  // who is on the list
  let list: number[];
  if (q.by === "cust") {
    const [wl, wh] = masks(start, end);
    list = l.bought.filter((b) => keep[b[0]] && ((b[1] & wl) || (b[2] & wh))).map((b) => b[0]);
  } else if (q.by === "new") {
    list = l.firsts.filter((f) => keep[f[0]] && f[1] >= start && f[1] <= end).map((f) => f[0]);
  } else if (q.by === "all") {
    list = [];
    for (let i = 0; i < n; i++) if (keep[i]) list.push(i);
  } else {
    const oiFirst = q.by === "oi";
    list = [...fig.entries()].filter(([, f]) => (oiFirst ? f.oi || f.oiPy : f.rev || f.revPy)).map(([i]) => i);
  }
  const zero = { rev: 0, revPy: 0, oi: 0, oiPy: 0 };
  const key = q.by === "oi" ? "oi" : "rev";
  list.sort((a, b) => ((fig.get(b) ?? zero)[key] - (fig.get(a) ?? zero)[key]) || ((fig.get(b) ?? zero).rev - (fig.get(a) ?? zero).rev) || l.names[a].localeCompare(l.names[b]));
  const sum = { rev: 0, revPy: 0, oi: 0, oiPy: 0 };
  for (const i of list) { const f = fig.get(i); if (f) { sum.rev += f.rev; sum.revPy += f.revPy; sum.oi += f.oi; sum.oiPy += f.oiPy; } }
  const size = Math.min(100, Math.max(1, q.size ?? 25));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(Math.max(0, q.page ?? 0), pages - 1);
  const label = (ci: number, d: (typeof DIMS)[number]) => cube.labels[d][cube.cells[ci]?.[DIMS.indexOf(d)]] ?? "Not set";
  const rows = list.slice(page * size, page * size + size).map((i) => {
    const f = fig.get(i) ?? zero, ci = l.cells[i];
    return { id: l.ids[i], name: l.names[i], owner: label(ci, "owner"), sae: label(ci, "sae"), country: label(ci, "country"), prio: label(ci, "prio"), rev: f.rev, revPy: Math.round(f.revPy), oi: f.oi, oiPy: Math.round(f.oiPy) };
  });
  return { total: list.length, page, size, rows, sum: { rev: sum.rev, revPy: Math.round(sum.revPy), oi: sum.oi, oiPy: Math.round(sum.oiPy) } };
}

/** A cell's companies, as the cube counts them - the check that a ledger goes with its cube. */
export const ledgerMatches = (cube: Cube, l: Ledger) => l.generatedAt === cube.generatedAt && l.cells.length === cube.cells.reduce((a, c) => a + c[CELL.n], 0);
