"use client";
// WHO A REPORT SHOWS, WHEN MY SALES REPORTS DECIDES IT (SARCLA 01.11.2026: "the other sub-reports on ESO should be brought
// to give value to the sales - all with filtering and saving views"). The ESO pages are drawn whole inside My Sales
// Reports - their tabs, Filters, saved views - and this says whose figures they are: the person, everyone under them in
// the hierarchy, their unit, or all (src/lib/reporting/mySalesScope.ts). The pages' own team switches (ESO | TSA | Total,
// the line managers' teams) give way to My Sales' switch; with no scope around them the pages are as they always were.

import { createContext, useContext } from "react";
import type { ScopeOf } from "@/lib/reporting/mySalesScope";

export { SCOPE_LEAD, scopedPeople, type ScopeLeads } from "@/lib/reporting/mySalesScope";

export type Scope = ScopeOf & {
  /** My Sales' switch, drawn where a page has its team switch */
  bar: React.ReactNode;
};

const ScopeCtx = createContext<Scope | null>(null);
export const ScopeProvider = ScopeCtx.Provider;
/** The scope a page is drawn in, or null on its own page. */
export const useScoped = () => useContext(ScopeCtx);
