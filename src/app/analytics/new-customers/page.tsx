"use client";

// NEW CUSTOMERS — who just arrived and what they become. Exact portal counts
// for the window (no sampling): how many contacts and companies are new, the
// channels that brought the contacts, the lifecycle stages they already hold,
// and the site-side signals GA4 counts. Two sources, never divided into each
// other.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { useHeld, metricOf, useAnalytics, useGa4Report, useHubspotWeekly } from "../AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "../Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { compact, dayLabel, full, percent } from "@/app/charts/format";
import type { ContactsCreated, SegmentCounts } from "@/lib/integrations/hubspotJourney";

type Journey = { contacts: ContactsCreated; segments: SegmentCounts };

function prettySource(code: string): string {
  return code.toLowerCase().replace(/_/g, " ");
}

export default function NewCustomersPage() {
  const { hubspot, windowDays, windowFrom, windowTo, reloadKey, reload } = useAnalytics();
  const weekly = useHubspotWeekly();
  const journey = useHeld<Journey>(
    `/api/integrations/hubspot?report=journey&from=${windowFrom}&to=${windowTo}`,
    [windowFrom, windowTo, reloadKey],
  );
  const keyEvents = useGa4Report("keyEventsByName");

  return (
    <Box>
      <SubAppHead
        title="New customers"
        purpose="Who arrived in the window — exact portal counts of new contacts and companies, the channels that brought them, and what they already are."
      />

      <Gate held={journey} source="HubSpot" loadingLabel="Counting the window's new contacts — exact counts take a moment…" onRetry={reload}>
        {(j, stale) => {
          const ker = keyEvents.result;
          const events =
            ker && ker.state === "ok"
              ? new Map(ker.data.rows.map((r) => [r.keys[0], metricOf(ker.data, "keyEvents")(r)]))
              : null;
          const signUps = events ? events.get("sign_up") ?? null : null;
          const newCompanies =
            weekly.result?.state === "ok"
              ? weekly.result.data.weeks.reduce((acc: number, w) => acc + (w.newCompanies ?? 0), 0)
              : null;
          const totalContacts = j.contacts.total;
          const share = (count: number) =>
            totalContacts && totalContacts > 0 ? `${percent(count / totalContacts)} of new` : "";

          return (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="New contacts" value={compact(totalContacts)} note={`Created in the window · exact portal count`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="New companies" value={compact(newCompanies)} note="Summed over the window's weekly buckets" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Accounts created on site"
                    value={compact(signUps)}
                    note={signUps === null ? "No sign_up key event returned · GA4" : "sign_up key events · GA4"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Gate held={hubspot} source="HubSpot" loadingLabel="Reading the CRM…" onRetry={reload}>
                    {(h) => <StatTile label="Contacts in the CRM" value={compact(h.summary.contacts)} note="All-time, readable by this app" />}
                  </Gate>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Where the new contacts come from"
                      caption="HubSpot's original source, one exact count per channel"
                      stale={stale}
                      empty={j.contacts.bySource.length === 0 ? "No source counts returned." : null}
                      table={{
                        columns: ["Source", "New contacts", "Share"],
                        numeric: [1, 2],
                        rows: j.contacts.bySource.map((s) => [prettySource(s.source), full(s.count), share(s.count)]),
                      }}
                    >
                      <BarList
                        rows={j.contacts.bySource.map((s) => ({ label: prettySource(s.source), value: s.count, secondary: share(s.count) }))}
                        labelWidth={180}
                      />
                    </ChartFrame>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="What the new contacts already are"
                      caption="Lifecycle stage today of contacts created in the window — exact counts, portal labels"
                      stale={stale}
                      empty={j.contacts.byLifecycle.length === 0 ? "No lifecycle counts returned." : null}
                      table={{
                        columns: ["Lifecycle stage", "New contacts"],
                        numeric: [1],
                        rows: j.contacts.byLifecycle.map((s) => [s.stage, full(s.count)]),
                      }}
                    >
                      <BarList rows={j.contacts.byLifecycle.map((s) => ({ label: s.stage, value: s.count }))} labelWidth={190} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>

              <Section>
                <Gate held={weekly} source="HubSpot" loadingLabel="Counting the window week by week…" onRetry={reload}>
                  {(data, wStale) => {
                    const contacts = data.weeks.map((w) => ({ x: w.start, value: w.newContacts }));
                    const companies = data.weeks.map((w) => ({ x: w.start, value: w.newCompanies }));
                    return (
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, lg: 6 }}>
                          <ChartFrame
                            title="New contacts per week"
                            caption={`${data.weeks.length} weeks, most recent last`}
                            stale={wStale}
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
                            stale={wStale}
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

              <SourceNote>
                Sources: HubSpot CRM search — one exact count per source and lifecycle option for contacts created between{" "}
                {windowFrom} and {windowTo} ({windowDays} days) — and the GA4 eventName dimension for site-side sign-ups.
                Weekly buckets are UTC weeks ending at the close of the selected window. Nothing here is estimated, modelled or
                sampled.
              </SourceNote>
            </Box>
          );
        }}
      </Gate>
    </Box>
  );
}
