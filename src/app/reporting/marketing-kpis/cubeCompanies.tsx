"use client";
// A graph of the customers' cube and its companies (CompanyList.tsx): the graph's filters, period and figure, read a page
// at a time from the companies kept beside the cube (ledger.ts) - so the list adds up to the graph. Who are our customers,
// the ESO Figures and New customers hand their graphs these.

import type { Filters, Win } from "@/lib/marketingKpis/cube";
import type { CompanyBy, CompanyPage } from "@/lib/marketingKpis/ledger";
import type { CompanySource } from "@/app/reporting/CompanyList";
import { change, withChange } from "./ExplorerKit";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;

export type CubeList = {
  filters: Filters; win: Win; by: CompanyBy;
  /** the ERP's own year or month to date, as the graph on those periods */
  erp?: "ytd" | "mtd" | null;
  /** the customers chosen in Filters */
  ids?: string[];
  /** the cube read the graph stands on - a new read, a new list */
  generatedAt: string;
  /** "year to date", "Q2 2026" - in the columns' names */
  period: string;
  /** what the figures are, under the list's title */
  note?: string;
};

/** The graph's companies, its figure first: the revenue (or one profit centre's), or the order intake. */
export function cubeCompanies(l: CubeList): CompanySource {
  const pc = l.by.startsWith("pc:");
  const oiFirst = l.by === "oi";
  const rev = pc ? `Revenue ${l.period}, this profit center` : `Revenue ${l.period}`;
  const oi = `Order intake ${l.period}`;
  // the figures first, beside the name - a list in half a row shows them without scrolling sideways
  const head = [...(pc ? [rev] : oiFirst ? [oi, rev] : [rev, oi]), "Country", "Company owner", "Performis SAE"];
  const figs = pc ? 1 : 2;
  const body = { filters: l.filters, win: l.win, by: l.by, erp: l.erp ?? null, ids: l.ids ?? [] };
  return {
    key: JSON.stringify({ ...body, at: l.generatedAt }),
    head, left: [figs + 1, figs + 2, figs + 3],
    note: l.note ?? "Each company's figure, the change against a year earlier under it - the largest first",
    load: async (page, q) => {
      const r = await fetch("/api/reporting/marketing-kpis/customers/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, page, q }) });
      const j = (await r.json().catch(() => ({}))) as Partial<CompanyPage> & { ok?: boolean; pending?: boolean; error?: string };
      if (!r.ok || j.ok === false) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (j.pending) return "pending";
      const revCell = (x: { rev: number; revPy: number }) => withChange(eur(x.rev), change(x.rev, x.revPy));
      const oiCell = (x: { oi: number; oiPy: number }) => withChange(eur(x.oi), change(x.oi, x.oiPy));
      return {
        total: j.total ?? 0,
        rows: (j.rows ?? []).map((x) => ({
          id: x.id, name: x.name,
          cells: [...(pc ? [revCell(x)] : oiFirst ? [oiCell(x), revCell(x)] : [revCell(x), oiCell(x)]), x.country, x.owner, x.sae],
        })),
      };
    },
  };
}
