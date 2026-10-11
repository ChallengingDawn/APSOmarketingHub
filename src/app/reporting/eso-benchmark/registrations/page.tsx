"use client";
// ESO DASHBOARD - REGISTRATIONS: shop accounts opened at the reps' companies,
// how they came about, how many bought since and how fast.

import Box from "@mui/material/Box";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { Breakdown, EsoPage, Gaps, PairTable, change, days, grid, n0, pct, perRep, ratio, typeLabel } from "../shared";

export default function RegistrationsPage() {
  return (
    <EsoPage title="Registrations" line="shop accounts, by company">
      {({ rep, b, reps }) => {
        const g = rep.registrations;
        const conv = { cy: (ratio(g.converted.cy, g.companies.cy) ?? 0) * 100, py: (ratio(g.converted.py, g.companies.py) ?? 0) * 100 };
        const speed = { cy: g.daysToOrder.cy ?? NaN, py: g.daysToOrder.py ?? NaN };
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<HowToRegIcon />} tint="pink" label="Companies registering" value={n0(g.companies.cy)} delta={{ ratio: change(g.companies), versus: `${n0(g.companies.py)} last year` }} />
              <KpiTile icon={<ShoppingCartCheckoutIcon />} tint="green" label="Bought since" value={pct(ratio(g.converted.cy, g.companies.cy))} note={`${n0(g.converted.cy)} companies · last year ${pct(ratio(g.converted.py, g.companies.py))} (they have had longer)`} />
              <KpiTile icon={<TimerOutlinedIcon />} tint="amber" label="Median days to the first order" value={days(g.daysToOrder.cy)} note={`Last year ${days(g.daysToOrder.py)}`} />
            </Box>
            <GlassCard>
              <CardTitle icon={<HowToRegIcon />} tint="pink" title="How they registered" note="Before or after an ESO visit, as HubSpot records it on the company" />
              <Box sx={grid(380)}>
                <ChartFrame title="This year">
                  <ShareBar segments={Object.entries(g.byWay).map(([label, p]) => ({ label, value: p.cy }))} />
                </ChartFrame>
                <Breakdown head="How they registered" rec={g.byWay} />
              </Box>
            </GlassCard>
            <GlassCard>
              <CardTitle icon={<HowToRegIcon />} tint="pink" title="Registrations and what came of them" note="Shop accounts opened in the months compared" />
              <Box sx={grid(380)}>
                <PairTable head="Registrations" rows={[
                  { label: "Shop accounts opened", p: g.contacts },
                  { label: "Companies registering", p: g.companies },
                  { label: "Of which bought since", p: g.converted },
                  { label: "Conversion %", p: conv, fmt: (x) => `${x.toFixed(1)}%`, points: true },
                  { label: "Median days to first order", p: speed, fmt: (x) => days(x), goodWhenUp: false },
                ]} />
                <Breakdown head="Customer type" rec={g.byType} label={typeLabel} />
                <Breakdown head="Potential (priority)" rec={g.byPrio} />
              </Box>
            </GlassCard>
            <GlassCard>
              <CardTitle icon={<HowToRegIcon />} tint="pink" title="Registrations per sales rep" note="Companies registering this year, and how many bought since" />
              <ChartFrame><BarList rows={perRep(reps, (r) => r.registrations.companies.cy, (r) => `${pct(ratio(r.registrations.converted.cy, r.registrations.companies.cy))} bought`)} /></ChartFrame>
            </GlassCard>
            <Gaps b={b} match={/regist/i} />
          </>
        );
      }}
    </EsoPage>
  );
}
