"use client";

// WEB ORDER SYNC — does every web shop order reach HubSpot? The Magento
// connector's order records per week, against GA4 purchases for the same weeks.
// GA4 counts only visitors who allowed statistics, so the real number of web
// orders is never below it: a week with fewer records than GA4 purchases is
// missing orders in HubSpot. Whole Monday-to-Sunday weeks that overlap the
// reporting window, from the day the connector went live.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote } from "../Shell";
import { metricOf, useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { dayLabel, full } from "@/app/charts/format";
import { isoDay, mondayOf, shiftIso } from "../tracking/health";
import { TONE } from "../tracking/AttributionNotice";
import { WEB_ORDERS_LIVE_FROM, type WebOrders } from "@/lib/integrations/webOrders";

const weekLabel = (w: string) => `w/c ${dayLabel(w)}`;

type WeekRow = { week: string; records: number | null; purchases: number | null; running: boolean };

export default function WebOrderSyncPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { window: win } = useReportingWindow();
  const [nowMs] = useState(() => Date.now());
  const today = isoDay(nowMs);
  const yesterday = isoDay(nowMs - 86_400_000);

  const q = `from=${win.from}&to=${win.to}`;
  const orders = useHeld<WebOrders>(`/api/integrations/hubspot?report=webOrders&${q}`, [q, tick]);
  const weeks = orders.result?.state === "ok" ? orders.result.data.weeks : null;
  const gaFrom = weeks && weeks.length > 0 ? weeks[0].week : null;
  const lastSunday = weeks && weeks.length > 0 ? shiftIso(weeks[weeks.length - 1].week, 6) : null;
  const gaTo = lastSunday ? (lastSunday < yesterday ? lastSunday : yesterday) : null;
  const gaUrl = gaFrom && gaTo && gaFrom <= gaTo ? `/api/integrations/ga4?report=transactionsDaily&from=${gaFrom}&to=${gaTo}` : null;
  const purchases = useHeld<Ga4TableReport>(gaUrl, [gaUrl, tick]);

  const rows = useMemo<WeekRow[] | null>(() => {
    if (!weeks) return null;
    const p = purchases.result;
    const byWeek = new Map<string, number>();
    if (p && p.state === "ok") {
      const tx = metricOf(p.data, "transactions");
      for (const row of p.data.rows) {
        const v = tx(row);
        if (v === null) continue;
        const wk = mondayOf(row.keys[0].length === 8 ? `${row.keys[0].slice(0, 4)}-${row.keys[0].slice(4, 6)}-${row.keys[0].slice(6)}` : row.keys[0]);
        byWeek.set(wk, (byWeek.get(wk) ?? 0) + v);
      }
    }
    return weeks.map((w) => ({ week: w.week, records: w.records, purchases: byWeek.get(w.week) ?? null, running: shiftIso(w.week, 6) >= today }));
  }, [weeks, purchases.result, today]);

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
  const num = { ...cell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };

  const body = (stale: boolean) => {
    if (!rows) return null;
    if (rows.length === 0) {
      return (
        <Section sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>
            The connector has written web orders since {dayLabel(WEB_ORDERS_LIVE_FROM)}. Pick a window that ends after that day.
          </Typography>
        </Section>
      );
    }
    const complete = rows.filter((r) => !r.running && r.records !== null && r.purchases !== null);
    const short = complete.filter((r) => (r.records as number) < (r.purchases as number));
    const worst = short.reduce<WeekRow | null>(
      (a, r) => (a === null || (r.purchases as number) - (r.records as number) > (a.purchases as number) - (a.records as number) ? r : a),
      null,
    );
    const sum = (pick: (r: WeekRow) => number | null) => rows.reduce((a, r) => a + (pick(r) ?? 0), 0);
    const pts = rows.map((r) => ({ x: r.week, value: r.records, compare: r.purchases }));
    const check = (r: WeekRow) =>
      r.running ? "week still running" : r.records === null || r.purchases === null ? "—" : r.records < r.purchases ? "orders missing" : "complete or more";

    return (
      <Box sx={{ opacity: stale ? 0.7 : 1 }}>
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile label="Order records in HubSpot" value={full(sum((r) => r.records))} note={`Written by the connector · ${rows.length} week${rows.length === 1 ? "" : "s"}`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile label="GA4 purchases" value={full(sum((r) => r.purchases))} note="Only visitors who allowed statistics" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile label="Weeks with missing orders" value={`${short.length} of ${complete.length}`} note="Full weeks with fewer records than GA4 purchases" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile
              label="Largest shortfall"
              value={worst ? `at least ${full((worst.purchases as number) - (worst.records as number))}` : "—"}
              note={worst ? `${weekLabel(worst.week)} · ${full(worst.records)} records vs ${full(worst.purchases)} purchases` : "No full week below GA4"}
            />
          </Grid>
        </Grid>

        <Section sx={{ mb: 2.5 }}>
          <ChartFrame
            title="Web order records vs GA4 purchases, by week"
            caption={`Whole weeks that overlap the window. The real number of web orders is never below the grey line, so a week where the blue line falls under it is missing orders in HubSpot.${rows[rows.length - 1].running ? " The last week is still running." : ""}`}
            stale={stale}
            empty={pts.filter((p) => p.value !== null).length < 2 ? "Fewer than two weeks in this window." : null}
            table={{
              columns: ["Week", "Order records", "GA4 purchases", "Check"],
              numeric: [1, 2],
              rows: rows.map((r) => [weekLabel(r.week), full(r.records), full(r.purchases), check(r)]),
            }}
          >
            <TrendChart
              data={pts}
              seriesLabel="Order records in HubSpot"
              compareLabel="GA4 purchases (consenting visitors only)"
              height={240}
              format={(v) => full(v)}
              xFormat={weekLabel}
            />
          </ChartFrame>
        </Section>

        <Section sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.25 }}>Week by week</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Week", "Order records", "GA4 purchases", "Missing, at least", "Check"].map((h, i) => (
                    <TableCell key={h} sx={{ ...(i === 0 ? cell : num), fontWeight: 600, color: MUTED }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...rows].reverse().map((r) => {
                  const missing = !r.running && r.records !== null && r.purchases !== null && r.records < r.purchases ? r.purchases - r.records : null;
                  return (
                    <TableRow key={r.week}>
                      <TableCell sx={{ ...cell, color: INK, fontWeight: 600 }}>{weekLabel(r.week)}</TableCell>
                      <TableCell sx={num}>{full(r.records)}</TableCell>
                      <TableCell sx={num}>{full(r.purchases)}</TableCell>
                      <TableCell sx={{ ...num, color: missing ? TONE.bad.fg : MUTED, fontWeight: missing ? 600 : 400 }}>{full(missing)}</TableCell>
                      <TableCell sx={{ ...num, color: r.running ? MUTED : missing ? TONE.bad.fg : TONE.good.fg, fontWeight: 600 }}>{check(r)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Section>
      </Box>
    );
  };

  return (
    <Box>
      <Gate held={orders} source="HubSpot" loadingLabel="Counting web order records week by week…" onRetry={retry}>
        {(_o, stale) =>
          gaUrl ? (
            <Gate held={purchases} source="Google Analytics 4" loadingLabel="Reading GA4 purchases for the same weeks…" onRetry={retry}>
              {() => body(stale)}
            </Gate>
          ) : (
            body(stale)
          )
        }
      </Gate>
      <SourceNote>
        HubSpot Orders with order_source_system = magento since {dayLabel(WEB_ORDERS_LIVE_FROM)}, when the connector went live, counted per week by order date (the connector writes it as a UTC day), and GA4
        purchases (transactions) per day summed into the same weeks (GA4 days are Swiss time), so a few orders can shift across a week
        edge. Not checked against Magento’s own order count yet, so there is no total of real web orders here. Refreshed at most every 5
        minutes.
      </SourceNote>
    </Box>
  );
}
