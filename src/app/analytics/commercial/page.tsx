"use client";

// COMMERCIAL — what turns into business. The HubSpot CRM totals and how many
// contacts and companies arrive each week, beside the key events GA4 counts
// on the site. Two sources, each with its own honest state.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { metricOf, useAnalytics, useGa4Report, useHubspotWeekly } from "../AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "../Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { compact, dayLabel, full } from "@/app/charts/format";

export default function CommercialPage() {
  const { hubspot, windowDays, reload } = useAnalytics();
  const weekly = useHubspotWeekly();
  const keyEvents = useGa4Report("keyEventsByName");

  return (
    <Box>
      <SubAppHead
        title="Commercial"
        purpose="The CRM side of the same visitors: how many contacts and companies HubSpot holds, how many are new each week, and the key events GA4 counts on the site."
      />

      <Gate held={hubspot} source="HubSpot" loadingLabel="Reading the CRM…" onRetry={reload}>
        {(data, stale) => {
          const s = data.summary;
          return (
            <Grid container spacing={2} sx={{ mb: 2.5, opacity: stale ? 0.6 : 1, transition: "opacity 160ms ease" }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatTile label="Contacts in the CRM" value={compact(s.contacts)} note="All-time, readable by this app" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatTile label="Companies in the CRM" value={compact(s.companies)} note="All-time, readable by this app" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatTile label="New contacts" value={compact(s.newContacts)} note={`Created in the last ${s.days ?? windowDays} days`} />
              </Grid>
            </Grid>
          );
        }}
      </Gate>

      <Section sx={{ mb: 2.5 }}>
        <Gate held={weekly} source="HubSpot" loadingLabel="Counting the last eight weeks…" onRetry={reload}>
          {(data, stale) => {
            const contacts = data.weeks.map((w) => ({ x: w.start, value: w.newContacts }));
            const companies = data.weeks.map((w) => ({ x: w.start, value: w.newCompanies }));
            return (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <ChartFrame
                    title="New contacts per week"
                    caption={`${data.weeks.length} weeks, most recent last`}
                    stale={stale}
                    empty={contacts.length < 2 ? "HubSpot returned fewer than two weeks." : null}
                    table={{
                      columns: ["Week starting", "New contacts"],
                      numeric: [1],
                      rows: data.weeks.map((w) => [dayLabel(w.start), full(w.newContacts)]),
                    }}
                  >
                    <TrendChart data={contacts} seriesLabel="New contacts" height={220} xFormat={(x) => `wk of ${dayLabel(x)}`} />
                  </ChartFrame>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <ChartFrame
                    title="New companies per week"
                    caption={`${data.weeks.length} weeks, most recent last`}
                    stale={stale}
                    empty={companies.length < 2 ? "HubSpot returned fewer than two weeks." : null}
                    table={{
                      columns: ["Week starting", "New companies"],
                      numeric: [1],
                      rows: data.weeks.map((w) => [dayLabel(w.start), full(w.newCompanies)]),
                    }}
                  >
                    <TrendChart data={companies} seriesLabel="New companies" height={220} xFormat={(x) => `wk of ${dayLabel(x)}`} />
                  </ChartFrame>
                </Grid>
              </Grid>
            );
          }}
        </Gate>
      </Section>

      <Section>
        <Gate held={keyEvents} source="Google Analytics 4" loadingLabel="Reading key events…" onRetry={reload}>
          {(report, stale) => {
            const events = metricOf(report, "keyEvents");
            const count = metricOf(report, "eventCount");
            const rows = report.rows.map((r) => ({ label: r.keys[0], value: events(r), secondary: `${compact(count(r))} fired` }));
            return (
              <ChartFrame
                title="Key events on the site"
                caption={`Events GA4 counts as conversions, last ${windowDays} days`}
                stale={stale}
                empty={rows.length === 0 ? "GA4 returned no key events for this window — none are configured, or none fired." : null}
                table={{
                  columns: ["Event", "Key events", "Event count"],
                  numeric: [1, 2],
                  rows: report.rows.map((r) => [r.keys[0], full(events(r)), full(count(r))]),
                }}
              >
                <BarList rows={rows} labelWidth={180} />
              </ChartFrame>
            );
          }}
        </Gate>
      </Section>

      <SourceNote>
        Sources: HubSpot CRM search totals (portal counts as HubSpot reports them) and the GA4 eventName dimension. Weekly buckets are
        UTC weeks ending before today. Nothing here is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}
