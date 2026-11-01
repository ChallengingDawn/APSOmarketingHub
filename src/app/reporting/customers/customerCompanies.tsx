"use client";
// A Customer Reports graph's companies (CompanyList.tsx, SARCLA 31.10.2026: "next to each report ... a new icon Company ...
// allow to see the companies, paginated by 25"): the graph's list, its filters, period and amount "at least", read a page
// at a time from the companies kept beside the customers' cube (ledger.ts companiesOf, customerRules.ts) - so the list adds
// up to the graph. Each list its own columns: the last order on the lost, the 12 months' revenue on the at-risk …

import type { Filters, Win } from "@/lib/marketingKpis/cube";
import type { CompanyBy, CompanyLine, CompanyPage, CompanySort } from "@/lib/marketingKpis/ledger";
import type { CompanySource } from "@/app/reporting/CompanyList";
import { change, withChange } from "@/app/reporting/marketing-kpis/ExplorerKit";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2025-03" -> "Mar 2025"; "2019-03-14" -> "14 Mar 2019" (an order before the three years read) */
export const lastWords = (s: string | undefined) => {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s ?? "");
  return !m ? "—" : m[3] ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

export type CustList = {
  by: CompanyBy; filters: Filters; win: Win;
  ids?: string[]; min?: number; cohort?: number | null;
  /** the read the graph stands on - a new read, a new list */
  generatedAt: string;
  /** "year to date", "Q2 2026" - in the columns' names */
  period: string;
  /** "Jan – 30 Oct 2025": the same months a year earlier */
  was: string;
  /** "30 Oct 2026": the period's last day (the 12 months to it) */
  end: string;
  note: string;
};

type Column = { head: string; sort: CompanySort; cell: (x: CompanyLine) => React.ReactNode; text?: boolean };

/** The columns a list shows, its figures first: what the graph counts it by. */
function columnsOf(l: CustList): Column[] {
  const kind = l.by.split(":")[0];
  const rev: Column = { head: `Revenue ${l.period}`, sort: "rev", cell: (x) => withChange(eur(x.rev), change(x.rev, x.revPy)) };
  const revPy: Column = { head: `Revenue ${l.was}`, sort: "revPy", cell: (x) => eur(x.revPy) };
  const last: Column = { head: "Last order", sort: "last", cell: (x) => lastWords(x.last) };
  const tail: Column[] = [
    { head: "Country", sort: "country", cell: (x) => x.country, text: true },
    { head: "Company owner", sort: "owner", cell: (x) => x.owner, text: true },
    { head: "Performis SAE", sort: "sae", cell: (x) => x.sae, text: true },
  ];
  if (kind === "lost" || kind === "left" || l.by === "rec:3") {
    return [last, { head: "Bought in the 12 months to it", sort: "before", cell: (x) => (x.last && x.last.length === 7 ? eur(x.before ?? 0) : "before the three years read") }, ...tail];
  }
  if (kind === "risk" || kind === "rec" || kind === "recall") return [last, { head: `Bought in the 12 months to ${l.end}`, sort: "rev12", cell: (x) => eur(x.rev12 ?? 0) }, ...tail];
  if (kind === "down" || kind === "shrank") return [rev, revPy, { head: "Less than a year earlier", sort: "drop", cell: (x) => eur(x.drop ?? 0) }, ...tail];
  if (kind === "base" || kind === "kept" || kind === "gone" || kind === "grew") return [revPy, rev, ...(kind === "gone" ? [last] : []), ...tail];
  if (kind === "pcs" || kind === "pcsany" || kind === "pcsmany" || kind === "pair" || kind === "single") return [rev, { head: "Profit centers", sort: "pcs", cell: (x) => x.pcs || "—", text: true }, ...tail];
  return [rev, ...tail];
}

/** The graph's companies, read from the Customer Reports' list API a page at a time. */
export function customerCompanies(l: CustList): CompanySource {
  const cols = columnsOf(l);
  const body = { by: l.by, filters: l.filters, win: l.win, ids: l.ids ?? [], min: l.min ?? 0, cohort: l.cohort ?? null };
  return {
    key: JSON.stringify({ ...body, at: l.generatedAt }),
    head: cols.map((c) => c.head),
    left: cols.flatMap((c, i) => (c.text ? [i + 1] : [])),
    sorts: [0, ...cols.map((_, i) => i + 1)],
    note: l.note,
    load: async (page, q, sort) => {
      const by = sort ? { key: sort.col === 0 ? ("name" as const) : cols[sort.col - 1].sort, desc: sort.desc } : null;
      const r = await fetch("/api/reporting/customer-kpis/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, page, q, sort: by }) });
      const j = (await r.json().catch(() => ({}))) as Partial<CompanyPage> & { ok?: boolean; pending?: boolean; error?: string };
      if (!r.ok || j.ok === false) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (j.pending) return "pending";
      return { total: j.total ?? 0, rows: (j.rows ?? []).map((x) => ({ id: x.id, name: x.name, cells: cols.map((c) => c.cell(x)) })) };
    },
  };
}
