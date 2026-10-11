"use client";
// ESO DASHBOARD - NEW CUSTOMERS: first order ever in the months compared - how
// many, what they bring, by type, priority and assortment, and how many were
// visited before their first order.

import Box from "@mui/material/Box";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import EuroIcon from "@mui/icons-material/Euro";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { Breakdown, EsoPage, change, grid, money, moneyShort, n0, pcLabel, perRep, ratio, typeLabel } from "../shared";

export default function NewCustomersPage() {
  return (
    <EsoPage title="New customers" line="first order ever">
      {({ rep, reps }) => {
        const n = rep.newCustomers;
        const avg = { cy: ratio(n.revenue.cy, rep.customers.new.cy) ?? 0, py: ratio(n.revenue.py, rep.customers.new.py) ?? 0 };
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<PersonAddAlt1Icon />} tint="blue" label="New customers" value={n0(rep.customers.new.cy)} delta={{ ratio: change(rep.customers.new), versus: `${n0(rep.customers.new.py)} last year` }} />
              <KpiTile icon={<EuroIcon />} tint="purple" label="Their revenue" value={moneyShort(n.revenue.cy)} delta={{ ratio: change(n.revenue), versus: `${moneyShort(n.revenue.py)} last year` }} />
              <KpiTile icon={<EuroIcon />} tint="green" label="Ø revenue per new customer" value={money(avg.cy)} delta={{ ratio: change(avg), versus: `${money(avg.py)} last year` }} />
              <KpiTile icon={<DirectionsCarIcon />} tint="amber" label="Visited before their first order" value={n0(n.visitedBefore)} note="This year's new customers with a completed visit before they ordered" />
            </Box>
            <GlassCard>
              <CardTitle icon={<PersonAddAlt1Icon />} tint="blue" title="Who they are" note="By customer type, potential and the assortment they bought most" />
              <Box sx={grid(380)}>
                <Breakdown head="Customer type" rec={n.byType} label={typeLabel} />
                <Breakdown head="Potential (priority)" rec={n.byPrio} />
                <Breakdown head="Assortment" rec={n.byAssortment} label={pcLabel} />
              </Box>
            </GlassCard>
            <GlassCard>
              <CardTitle icon={<PersonAddAlt1Icon />} tint="blue" title="New customers per sales rep" note="This year, with their revenue" />
              <ChartFrame><BarList rows={perRep(reps, (r) => r.customers.new.cy, (r) => moneyShort(r.newCustomers.revenue.cy))} /></ChartFrame>
            </GlassCard>
          </>
        );
      }}
    </EsoPage>
  );
}
