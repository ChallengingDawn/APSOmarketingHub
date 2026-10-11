"use client";
// ESO DASHBOARD - TICKETS: the ESO pipeline - how many, how many ended in an
// order, how fast, from where, and the potential still open. While last
// year's pipeline held a fraction of today's tickets, only rates and speeds
// are compared: counts would only show the pipeline filling up.

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import EuroIcon from "@mui/icons-material/Euro";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { Breakdown, EsoPage, Gaps, PairTable, bodyCell, days, grid, headCell, hours, money, moneyShort, n0, num, numHead, pct, perRep, ratio } from "../shared";

export default function TicketsPage() {
  return (
    <EsoPage title="Tickets" line="the ESO pipeline">
      {({ rep, b, reps }) => {
        const t = rep.tickets;
        const comparable = t.created.py >= 0.3 * t.created.cy;
        const success = { cy: (ratio(t.ordered.cy, t.resolved.cy) ?? 0) * 100, py: (ratio(t.ordered.py, t.resolved.py) ?? 0) * 100 };
        const sp = (s: { cy: number | null; py: number | null }) => ({ cy: s.cy ?? NaN, py: s.py ?? NaN });
        const open = Object.entries(t.openByStage).sort((a, c) => c[1].potential - a[1].potential);
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<ConfirmationNumberIcon />} tint="amber" label="Tickets created" value={n0(t.created.cy)} note={comparable ? `${n0(t.created.py)} last year` : `Last year's pipeline held ${n0(t.created.py)} - not compared`} />
              <KpiTile icon={<ConfirmationNumberIcon />} tint="green" label="Ended in an order" value={pct(ratio(t.ordered.cy, t.resolved.cy))} note={`${n0(t.ordered.cy)} of ${n0(t.resolved.cy)} resolved · last year ${pct(ratio(t.ordered.py, t.resolved.py))}`} />
              <KpiTile icon={<TimerOutlinedIcon />} tint="blue" label="Median to first reply" value={hours(t.firstReplyH.cy)} note={`Last year ${hours(t.firstReplyH.py)}`} />
              <KpiTile icon={<EuroIcon />} tint="purple" label="Potential still open" value={moneyShort(open.reduce((s, [, v]) => s + v.potential, 0))} note={`${n0(open.reduce((s, [, v]) => s + v.count, 0))} open tickets from this year`} />
            </Box>
            <GlassCard>
              <CardTitle icon={<ConfirmationNumberIcon />} tint="amber" title="Success and speed" note="Ordered = Ordered or a one-shot order · speeds are medians, left empty on fewer than 20 tickets" />
              <Box sx={grid(380)}>
                <PairTable head="Tickets" rows={[
                  { label: "Created", p: t.created, noChange: !comparable },
                  { label: "Closed", p: t.closed, noChange: !comparable },
                  { label: "Ordered", p: t.ordered, noChange: !comparable },
                  { label: "Success rate %", note: "ordered of those with a resolution", p: success, fmt: (x) => `${x.toFixed(1)}%`, points: true },
                  { label: "Potential of ordered tickets", p: t.orderedPotential, fmt: money, noChange: !comparable },
                  { label: "Median to first reply", p: sp(t.firstReplyH), fmt: (x) => hours(x), goodWhenUp: false },
                  { label: "Median to work started / offer", p: sp(t.offerH), fmt: (x) => hours(x), goodWhenUp: false },
                  { label: "Median to close", p: sp(t.closeD), fmt: (x) => days(x), goodWhenUp: false },
                ]} />
                <Box>
                  <Table size="small">
                    <TableHead><TableRow><TableCell sx={headCell}>Still open, by stage</TableCell><TableCell sx={numHead}>Tickets</TableCell><TableCell sx={numHead}>Potential</TableCell></TableRow></TableHead>
                    <TableBody>
                      {open.map(([k, v]) => (
                        <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{n0(v.count)}</TableCell><TableCell sx={num}>{money(v.potential)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            </GlassCard>
            <Box sx={grid(420)}>
              <GlassCard>
                <CardTitle icon={<ConfirmationNumberIcon />} tint="amber" title="Per sales rep" note="Tickets this year, and how many ended in an order" />
                <ChartFrame><BarList rows={perRep(reps, (r) => r.tickets.created.cy, (r) => `${pct(ratio(r.tickets.ordered.cy, r.tickets.resolved.cy))} ordered`)} /></ChartFrame>
              </GlassCard>
              <GlassCard>
                <CardTitle icon={<ConfirmationNumberIcon />} tint="amber" title="Where they come from, how they end" />
                <Box sx={{ display: "grid", gap: 2 }}>
                  <Breakdown head="Source" rec={t.bySource} minBase={comparable ? 20 : Infinity} />
                  <Breakdown head="Resolution" rec={t.byResolution} minBase={comparable ? 20 : Infinity} />
                </Box>
              </GlassCard>
            </Box>
            <Gaps b={b} match={/Tickets/i} />
          </>
        );
      }}
    </EsoPage>
  );
}
