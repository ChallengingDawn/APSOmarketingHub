"use client";

// CONTACT REQUESTS — customers who wrote in through the Contact Us / Returns
// form on apsoparts.com in the reporting window, per week (up to about three
// months) or per month, and by the language of the form. Counted on HubSpot
// contacts, so it does not depend on cookies. Every figure is a minimum; the
// reason is stated once on the page.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { Gate, INK, MUTED, Section, SourceNote } from "../Shell";
import { useHeld } from "../AnalyticsData";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { dayLabel, full, percent } from "@/app/charts/format";
import type { ContactRequests, FormLanguage, RequestBucket } from "@/lib/integrations/contactRequests";

const LANGUAGE_NAMES: Record<FormLanguage, string> = { DE: "German", FR: "French", EN: "English", IT: "Italian", PL: "Polish", NL: "Dutch" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const daysIn = (b: RequestBucket) => Math.round((Date.parse(b.to) - Date.parse(b.from)) / 86_400_000) + 1;
const monthDays = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();

function View({ data, stale, windowDays }: { data: ContactRequests; stale: boolean; windowDays: number }) {
  const weekly = data.granularity === "week";
  const isPart = (b: RequestBucket) => (weekly ? daysIn(b) < 7 : daysIn(b) < monthDays(b.from));
  const bucketLabel = (b: RequestBucket) =>
    weekly ? `${dayLabel(b.from)} – ${dayLabel(b.to)}` : `${MONTHS[Number(b.from.slice(5, 7)) - 1]} ${b.from.slice(0, 4)}`;
  const axisLabel = (from: string) => (weekly ? dayLabel(from) : `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(2, 4)}`);

  const total = data.total;
  const languages = [...data.byLanguage].sort((a, b) => (b.requests ?? -1) - (a.requests ?? -1));
  const top = languages[0] ?? null;
  const matched = data.byLanguage.reduce((a, l) => a + (l.requests ?? 0), 0);
  const unmatched = total !== null ? Math.max(0, total - matched) : 0;
  const perWeek = total !== null && windowDays > 0 ? total / (windowDays / 7) : null;
  const busiest = data.buckets.reduce<RequestBucket | null>((a, b) => (b.requests !== null && (a === null || b.requests > (a.requests ?? -1)) ? b : a), null);
  const pts = data.buckets.map((b) => ({ x: b.from, value: b.requests }));
  const partial = data.buckets.filter(isPart).length;

  return (
    <Box sx={{ opacity: stale ? 0.7 : 1 }}>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Requests, at least" value={full(total)} note="Contact Us and Returns form on apsoparts.com" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Per week" value={perWeek === null ? "—" : full(Math.round(perWeek))} note="Average over the window" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label="Largest language"
            value={top && top.requests !== null ? LANGUAGE_NAMES[top.language] : "—"}
            note={top && total ? `${percent((top.requests ?? 0) / total, 0)} of requests · ${full(top.requests)}` : ""}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label={weekly ? "Busiest week" : "Busiest month"}
            value={full(busiest?.requests)}
            note={busiest ? `${bucketLabel(busiest)}${isPart(busiest) ? " (part)" : ""}` : ""}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section sx={{ height: "100%" }}>
            <ChartFrame
              title={`Requests per ${weekly ? "week" : "month"}`}
              caption={
                partial > 0
                  ? `The first or last ${weekly ? "week" : "month"} is cut by the window, so it holds fewer days.`
                  : `Whole ${weekly ? "weeks" : "months"} inside the window.`
              }
              stale={stale}
              empty={pts.length < 2 ? `The window holds fewer than two ${weekly ? "weeks" : "months"}.` : null}
              table={{
                columns: [weekly ? "Week" : "Month", "Requests, at least"],
                numeric: [1],
                rows: data.buckets.map((b) => [`${bucketLabel(b)}${isPart(b) ? " (part)" : ""}`, full(b.requests)]),
              }}
            >
              <TrendChart data={pts} seriesLabel="Requests" height={240} format={(v) => full(v)} xFormat={axisLabel} />
            </ChartFrame>
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section sx={{ height: "100%" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>By form language</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25, mb: 1.75 }}>
              Each shop language has its own copy of the form, so this is where the customer was on the site.
            </Typography>
            <BarList
              rows={languages.map((l) => ({
                label: `${LANGUAGE_NAMES[l.language]} (${l.language})`,
                value: l.requests,
                secondary: total && l.requests !== null ? percent(l.requests / total, 0) : undefined,
              }))}
              format={(v) => full(v)}
              labelWidth={120}
              emptyMessage="No requests in this window."
            />
            {unmatched > 0 && (
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.25 }}>
                {full(unmatched)} request{unmatched === 1 ? "" : "s"} came from a form copy without a language code.
              </Typography>
            )}
          </Section>
        </Grid>
      </Grid>

      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.5 }}>Why these are minimums</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, maxWidth: 900 }}>
          HubSpot can only search each contact’s latest form. When a customer sends a request and later gets an automated order or cart
          e-mail (also a form in HubSpot), the request is no longer the latest and drops out of these counts. It is still on the contact
          record in HubSpot.
        </Typography>
      </Section>
    </Box>
  );
}

export default function ContactRequestsPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { window: win, days } = useReportingWindow();
  const q = `from=${win.from}&to=${win.to}`;
  const requests = useHeld<ContactRequests>(`/api/integrations/hubspot?report=contactRequests&${q}`, [q, tick]);

  return (
    <Box>
      <Gate held={requests} source="HubSpot" loadingLabel="Counting contact requests…" onRetry={retry}>
        {(data, stale) => <View data={data} stale={stale} windowDays={days} />}
      </Gate>
      <SourceNote>
        HubSpot search totals on contacts whose latest form (recent_conversion_event_name) is one of the customer-facing Contact Us form
        copies, “&lt;page&gt;: &lt;language&gt;_Customer Facing | Contact Us Form_2507”, by the date of that form
        (recent_conversion_date, UTC days); sandbox test copies are left out. Contacts, not messages: a customer who writes twice counts
        once. Refreshed at most every 5 minutes.
      </SourceNote>
    </Box>
  );
}
