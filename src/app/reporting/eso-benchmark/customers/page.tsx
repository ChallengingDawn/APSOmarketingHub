"use client";
// ESO DASHBOARD - CUSTOMER DEVELOPMENT: existing customers, counted the same
// way in both years - active, new, reactivated, slowing, lost, churn, and the
// potential that went with the lost ones.

import Box from "@mui/material/Box";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import EuroIcon from "@mui/icons-material/Euro";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { Breakdown, EsoPage, Gaps, PairTable, change, grid, money, moneyShort, n0, perRep, ratio } from "../shared";

export default function CustomersPage() {
  return (
    <EsoPage title="Customer development" line="existing customers">
      {({ rep, b, reps }) => {
        const c = rep.customers;
        const churn = { cy: (ratio(c.lost.cy, c.base.cy) ?? 0) * 100, py: (ratio(c.lost.py, c.base.py) ?? 0) * 100 };
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<GroupsIcon />} tint="green" label="Active customers" value={n0(c.active.cy)} delta={{ ratio: change(c.active), versus: `${n0(c.active.py)} last year` }} />
              <KpiTile icon={<TrendingDownIcon />} tint="pink" label="Lost customers" value={n0(c.lost.cy)} delta={{ ratio: change(c.lost), versus: `${n0(c.lost.py)} last year`, goodWhenUp: false }} />
              <KpiTile icon={<TrendingDownIcon />} tint="amber" label="Churn rate" value={`${churn.cy.toFixed(1)}%`} note={`Lost of those who bought the year before · last year ${churn.py.toFixed(1)}%`} />
              <KpiTile icon={<EuroIcon />} tint="purple" label="Potential of lost customers" value={moneyShort(c.lostPotential.cy)} delta={{ ratio: change(c.lostPotential), versus: `${moneyShort(c.lostPotential.py)} last year`, goodWhenUp: false }} />
            </Box>
            <GlassCard>
              <CardTitle icon={<GroupsIcon />} tint="green" title="Where the customers stand" note="Counted the same way in both years" />
              <Box sx={grid(380)}>
                <PairTable head="Customers" rows={[
                  { label: "Active", note: "bought in the months compared", p: c.active },
                  { label: "New", note: "first order ever in the months compared", p: c.new },
                  { label: "Reactivated", note: "bought again after a whole year without", p: c.reactivated },
                  { label: "Slowing", note: "bought less than half of the year before", p: c.slowing, goodWhenUp: false },
                  { label: "Lost", note: "bought the year before, nothing since", p: c.lost, goodWhenUp: false },
                  { label: "Churn rate %", note: "lost of those who bought the year before", p: churn, fmt: (x) => `${x.toFixed(1)}%`, goodWhenUp: false, points: true },
                  { label: "Potential of lost customers", p: c.lostPotential, fmt: money, goodWhenUp: false },
                  { label: "Ø revenue per active customer", p: { cy: ratio(rep.revenue.ytd.cy, c.active.cy) ?? 0, py: ratio(rep.revenue.ytd.py, c.active.py) ?? 0 }, fmt: money },
                ]} />
                <Breakdown head="Active, by customer category" rec={c.activeByCategory} />
              </Box>
            </GlassCard>
            <Box sx={grid(420)}>
              <GlassCard>
                <CardTitle icon={<GroupsIcon />} tint="green" title="Active customers per sales rep" note="This year, change against last year" />
                <ChartFrame><BarList rows={perRep(reps, (r) => r.customers.active.cy, (r) => { const x = change(r.customers.active); return x === null ? "—" : `${x > 0 ? "↑" : "↓"} ${Math.abs(x * 100).toFixed(1)}%`; })} /></ChartFrame>
              </GlassCard>
              <GlassCard>
                <CardTitle icon={<TrendingDownIcon />} tint="pink" title="Lost customers per sales rep" note="Bought last year, nothing this year so far" />
                <ChartFrame><BarList rows={perRep(reps, (r) => r.customers.lost.cy, (r) => `churn ${(((ratio(r.customers.lost.cy, r.customers.base.cy) ?? 0) * 100)).toFixed(1)}%`)} /></ChartFrame>
              </GlassCard>
            </Box>
            <Gaps b={b} match={/CURRENT owner/i} />
          </>
        );
      }}
    </EsoPage>
  );
}
