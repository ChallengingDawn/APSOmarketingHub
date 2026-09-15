"use client";

// BUYING COMPANIES — companies ordering per calendar year, from the ERP values
// on HubSpot companies: how many ordered, how many were new, how many came back
// and how many have not come back yet. Business records only, so it counts
// every customer whatever they chose on the cookie banner. Calendar years, so
// the reporting window does not apply and the header has no picker.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote } from "../Shell";
import { useHeld } from "../AnalyticsData";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { full, percent } from "@/app/charts/format";
import type { BuyerYears } from "@/lib/integrations/buyers";

const PARTS = [
  { key: "returning", label: "Also ordered the year before" },
  { key: "firstOrder", label: "First order ever" },
  { key: "gap", label: "Back after a year or more without orders" },
];

function View({ data, stale }: { data: BuyerYears; stale: boolean }) {
  const rows = data.years.map((y, i) => {
    const before = i === 0 ? data.orderingBefore : data.years[i - 1].ordering;
    const gap =
      y.ordering !== null && y.returning !== null && y.firstOrder !== null ? Math.max(0, y.ordering - y.returning - y.firstOrder) : null;
    const notBack = before !== null && y.returning !== null ? Math.max(0, before - y.returning) : null;
    return { ...y, before, gap, notBack, running: y.year === data.currentYear };
  });
  const yearLabel = (r: (typeof rows)[number]) => (r.running ? `${r.year} so far` : String(r.year));
  const cur = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const backShare = cur && cur.returning !== null && cur.before ? cur.returning / cur.before : null;
  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
  const num = { ...cell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };

  if (!cur) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>HubSpot returned no years.</Typography>;

  return (
    <Box sx={{ opacity: stale ? 0.7 : 1 }}>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label={`Companies ordering in ${cur.year} so far`}
            value={full(cur.ordering)}
            note={prev ? `${full(prev.ordering)} in all of ${prev.year}` : ""}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label={`New buying companies ${cur.year}`}
            value={full(cur.firstOrder)}
            note={prev ? `First ERP order ever · ${full(prev.firstOrder)} in all of ${prev.year}` : "First ERP order ever"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label={`Back from ${cur.year - 1}`}
            value={percent(backShare)}
            note={`${full(cur.returning)} of the ${full(cur.before)} companies that ordered in ${cur.year - 1} have ordered again`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Not back yet" value={full(cur.notBack)} note={`Ordered in ${cur.year - 1}, no order in ${cur.year} so far`} />
        </Grid>
      </Grid>

      <Section sx={{ mb: 2.5 }}>
        <ChartFrame
          title="Companies ordering per year, by where they came from"
          caption={`Each column is every company with order intake that year. ${cur.year} is still running.`}
          stale={stale}
          empty={rows.length < 2 ? "HubSpot returned fewer than two years." : null}
          table={{
            columns: ["Year", "Companies ordering", ...PARTS.map((p) => p.label)],
            numeric: [1, 2, 3, 4],
            rows: rows.map((r) => [yearLabel(r), full(r.ordering), full(r.returning), full(r.firstOrder), full(r.gap)]),
          }}
        >
          <StackedColumns
            data={rows.map((r) => ({ x: yearLabel(r), returning: r.returning, firstOrder: r.firstOrder, gap: r.gap }))}
            parts={PARTS}
            height={280}
            format={(v) => full(v)}
          />
        </ChartFrame>
      </Section>

      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.25 }}>Year by year</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
          The e-shop columns come from the yearly Performis E-Shop Data Tracker exports; a year appears once its export is loaded. The
          2023 export lists every account holder, not only the active ones, so its login figure does not compare with the other years.
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  "Year",
                  "Companies ordering",
                  "Also ordered the year before",
                  "First order ever",
                  "Back after a gap",
                  "Ordered the year before, not this year",
                  "E-shop: companies logged in",
                  "E-shop: companies ordering online",
                ].map((h, i) => (
                  <TableCell key={h} sx={{ ...(i === 0 ? cell : num), fontWeight: 600, color: MUTED }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...rows].reverse().map((r) => (
                <TableRow key={r.year}>
                  <TableCell sx={{ ...cell, color: INK, fontWeight: 600 }}>{yearLabel(r)}</TableCell>
                  <TableCell sx={{ ...num, color: INK, fontWeight: 600 }}>{full(r.ordering)}</TableCell>
                  <TableCell sx={num}>{full(r.returning)}</TableCell>
                  <TableCell sx={num}>{full(r.firstOrder)}</TableCell>
                  <TableCell sx={num}>{full(r.gap)}</TableCell>
                  <TableCell sx={num}>{full(r.notBack)}</TableCell>
                  <TableCell sx={num}>{full(r.eshopLogins)}</TableCell>
                  <TableCell sx={num}>{full(r.eshopOrders)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>
    </Box>
  );
}

export default function BuyingCompaniesPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const [year] = useState(() => new Date().getFullYear());
  const buyers = useHeld<BuyerYears>(`/api/integrations/hubspot?report=buyers&year=${year}`, [tick]);

  return (
    <Box>
      <Gate held={buyers} source="HubSpot" loadingLabel="Counting buying companies year by year — about 20 seconds…" onRetry={retry}>
        {(data, stale) => <View data={data} stale={stale} />}
      </Gate>
      <SourceNote>
        HubSpot search totals on companies: order intake above zero per year (oi_YYYY) and the year of the first ERP order
        (compass_first_order_year), both written by the Compass connector, plus the E-Shop Data Tracker counts
        (n_of_logins_datatracker_YYYY, orders_datatracker_YYYY). “Back after a gap” is the companies ordering minus those that also
        ordered the year before minus first orders; a few companies whose first order was credited back have no order intake left, so
        that part can be off by a few dozen. Business records only: nothing here depends on cookies. Refreshed at most every 5 minutes.
      </SourceNote>
    </Box>
  );
}
