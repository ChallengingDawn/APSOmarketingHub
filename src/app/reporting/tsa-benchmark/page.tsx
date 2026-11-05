"use client";
// THE TSA BUC VIEW - the first page of TSA Reports, as ESO's (SARCLA 01.11.2026: "move BUC view with the same principle to
// TSA reports"): a panel per page in TSA's order, Figures first, each opening on TSA with its figures - and only the
// graphs people send here from TSA's pages with Actions (its own keys, "tsa-…": a chart sent from ESO's pages stays in
// ESO's BUC View). No graph of their own: an empty panel says how to send one.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { GUTTER } from "@/app/analytics/Shell";
import { FAINT } from "@/app/uc/report/ui";
import { useActions } from "@/app/reporting/marketing-kpis/tiles/store";
import { FiguresPanel } from "@/app/reporting/eso-benchmark/Figures";
import { CallsPanel } from "@/app/reporting/eso-benchmark/Calls";
import { SalesActivityPanel } from "@/app/reporting/eso-benchmark/SalesActivity";
import { RegistrationsPanel } from "@/app/reporting/eso-benchmark/Registrations";
import { CustomerDevPanel } from "@/app/reporting/eso-benchmark/CustomerDev";
import { ShopPanel } from "@/app/reporting/eso-benchmark/Shop";
import { NewCustomersPanel } from "@/app/reporting/eso-benchmark/NewCustomers";
import { TicketsPanel } from "@/app/reporting/eso-benchmark/Tickets";

export default function TsaBucView() {
  const { state: acts } = useActions("nutshell");
  return (
    // no title: the panels straight away, as ESO's BUC View
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {/* in ESO's order (SARCLA 01.11.2026: "the order of apps on TSA is not the same as in ESO"), Calls where ESO has Visits */}
      <FiguresPanel acts={acts} home="tsa" />
      <CallsPanel acts={acts} />
      <SalesActivityPanel acts={acts} home="tsa" />
      <RegistrationsPanel acts={acts} home="tsa" />
      <ShopPanel acts={acts} home="tsa" />
      <NewCustomersPanel acts={acts} home="tsa" />
      <CustomerDevPanel acts={acts} home="tsa" />
      <TicketsPanel acts={acts} group="incoming" home="tsa" />
      <TicketsPanel acts={acts} group="system" home="tsa" />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Each panel opens on TSA · a graph joins its page&apos;s panel here with Actions on a TSA Reports page, BUC View switched on.
      </Typography>
    </Box>
  );
}
