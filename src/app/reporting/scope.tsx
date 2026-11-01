"use client";
// WHO A REPORT SHOWS, WHEN MY SALES REPORTS DECIDES IT (SARCLA 01.11.2026: "the other sub-reports on ESO should be brought
// to give value to the sales - all with filtering and saving views"). The ESO pages are drawn whole inside My Sales
// Reports - their tabs, Filters, saved views - and this says whose figures they are: the person, everyone under them in
// the hierarchy, their unit, or all (src/lib/reporting/mySalesScope.ts). The pages' own team switches (ESO | TSA | Total,
// the line managers' teams) give way to My Sales' switch; with no scope around them the pages are as they always were.

import { createContext, useContext } from "react";
import Box from "@mui/material/Box";
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

/**
 * Inside My Sales Reports a page shows its most important charts only - no tabs, no tables (SARCLA 01.11.2026: "way too
 * much information for the ESO here - not the entire thing but one page per sub-app with the most important KPIs per
 * topic"). Two across; a month-by-month chart the whole width.
 */
export function KeyCharts({ ids, draw }: { ids: string[]; draw: (id: string) => React.ReactNode }) {
  const wide = (id: string) => /:(months|mon[a-z]*|days|flow)$/.test(id);
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
      {ids.map((id) => <Box key={id} sx={{ minWidth: 0, display: "grid", ...(wide(id) ? { gridColumn: "1 / -1" } : {}) }}>{draw(id)}</Box>)}
    </Box>
  );
}
