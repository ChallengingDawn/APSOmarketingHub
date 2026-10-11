"use client";
// ESO DASHBOARD - REVENUE & ORDER INTAKE: per sales rep and month, against the
// same months last year, by assortment. Order intake only for the months the
// ERP has loaded per company.

import Box from "@mui/material/Box";
import EuroIcon from "@mui/icons-material/Euro";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import GroupsIcon from "@mui/icons-material/Groups";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { Breakdown, EsoPage, Gaps, change, grid, money, moneyShort, pcLabel, perRep, ratio } from "../shared";

export default function RevenuePage() {
  return (
    <EsoPage title="Revenue & order intake" line="per sales rep and month">
      {({ rep, b, reps, last }) => {
        const L = b.monthLabels;
        const oiLast = b.oiMonths ? L[b.oiMonths - 1] : null;
        const perActive = { cy: ratio(rep.revenue.ytd.cy, rep.customers.active.cy) ?? 0, py: ratio(rep.revenue.ytd.py, rep.customers.active.py) ?? 0 };
        return (
          <>
            <Box sx={grid(240)}>
              <KpiTile icon={<EuroIcon />} tint="purple" label={`Revenue Jan–${last}`} value={moneyShort(rep.revenue.ytd.cy)}
                delta={{ ratio: change(rep.revenue.ytd), versus: `${moneyShort(rep.revenue.ytd.py)} last year` }} />
              <KpiTile icon={<ShoppingBagIcon />} tint="blue" label={oiLast ? `Order intake Jan–${oiLast}` : "Order intake"} value={oiLast ? moneyShort(rep.orderIntake.ytd.cy) : "—"}
                delta={oiLast ? { ratio: change(rep.orderIntake.ytd), versus: `${moneyShort(rep.orderIntake.ytd.py)} last year` } : undefined} />
              <KpiTile icon={<GroupsIcon />} tint="green" label="Ø revenue per active customer" value={money(perActive.cy)}
                delta={{ ratio: change(perActive), versus: `${money(perActive.py)} last year` }} />
            </Box>

            <GlassCard>
              <CardTitle icon={<EuroIcon />} tint="purple" title="Revenue per month, to last year" note="Invoiced revenue of the companies the selected reps own" />
              <ChartFrame table={{ columns: ["Month", "This year", "Last year"], rows: rep.revenue.months.map((p, i) => [L[i], Math.round(p.cy), Math.round(p.py)]), numeric: [1, 2] }}>
                <GroupedColumns data={rep.revenue.months.map((p, i) => ({ x: L[i], current: p.cy, prior: p.py }))}
                  currentLabel={String(b.window.year)} priorLabel={String(b.window.py)} format={(x) => (x === null ? "—" : moneyShort(x))} />
              </ChartFrame>
            </GlassCard>

            {b.oiMonths > 0 && (
              <GlassCard>
                <CardTitle icon={<ShoppingBagIcon />} tint="blue" title="Order intake per month, to last year" note={`Loaded per company through ${oiLast}`} />
                <ChartFrame table={{ columns: ["Month", "This year", "Last year"], rows: rep.orderIntake.months.map((p, i) => [L[i], Math.round(p.cy), Math.round(p.py)]), numeric: [1, 2] }}>
                  <GroupedColumns data={rep.orderIntake.months.map((p, i) => ({ x: L[i], current: p.cy, prior: p.py }))}
                    currentLabel={String(b.window.year)} priorLabel={String(b.window.py)} format={(x) => (x === null ? "—" : moneyShort(x))} />
                </ChartFrame>
              </GlassCard>
            )}

            <Box sx={grid(420)}>
              <GlassCard>
                <CardTitle icon={<EuroIcon />} tint="purple" title="Per sales rep" note={`Revenue Jan–${last}, change against last year`} />
                <BarList format={(x) => (x === null ? "—" : moneyShort(x))} rows={perRep(reps, (r) => r.revenue.ytd.cy, (r) => {
                  const c = change(r.revenue.ytd);
                  return c === null ? "—" : `${c > 0 ? "↑" : "↓"} ${Math.abs(c * 100).toFixed(1)}%`;
                })} />
              </GlassCard>
              <GlassCard>
                <CardTitle icon={<EuroIcon />} tint="purple" title="Per assortment" note="Profit centre of the invoiced revenue" />
                <Breakdown head="Assortment" rec={rep.revenue.byPc} label={pcLabel} fmt={money} />
              </GlassCard>
            </Box>
            <Gaps b={b} match={/forecast|Order intake/i} />
          </>
        );
      }}
    </EsoPage>
  );
}
