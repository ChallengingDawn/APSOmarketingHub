"use client";

// COOKIE CONSENT — Cookiebot's consent log for the reporting window: how many
// answers the banner got, how many allowed statistics (what Google Analytics
// can see) and marketing (what Google Ads can use), per day and by country.
// Cookiebot keeps these records as proof of consent anyway, so reading them
// tracks nobody.

import { useMemo, useState } from "react";
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
import type { ConsentDay, ConsentStats } from "@/lib/integrations/cookiebot";

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function View({ stats, stale }: { stats: ConsentStats; stale: boolean }) {
  const t = useMemo(() => {
    const sum = (key: keyof Omit<ConsentDay, "date">) => stats.days.reduce((a, d) => a + (d[key] ?? 0), 0);
    const optIn = sum("optIn");
    const optOut = sum("optOut");
    const strict = sum("optInStrict");
    const answers = optIn + optOut;
    return {
      answers,
      strict,
      optOut,
      implied: sum("optInImplied"),
      statistics: answers > 0 ? sum("optInStatistics") / answers : null,
      marketing: answers > 0 ? sum("optInMarketing") / answers : null,
      declinedByClick: strict + optOut > 0 ? optOut / (strict + optOut) : null,
    };
  }, [stats]);

  if (t.answers === 0) {
    return (
      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>
          Cookiebot returned no consent answers for {stats.domain} between {dayLabel(stats.from)} and {dayLabel(stats.to)}.
        </Typography>
      </Section>
    );
  }

  const daily = stats.days.map((d) => {
    const answers = (d.optIn ?? 0) + (d.optOut ?? 0);
    return {
      date: d.date,
      answers,
      strict: d.optInStrict,
      optOut: d.optOut,
      implied: d.optInImplied,
      statistics: answers > 0 && d.optInStatistics !== null ? d.optInStatistics / answers : null,
      marketing: answers > 0 && d.optInMarketing !== null ? d.optInMarketing / answers : null,
    };
  });
  const countryTotal = stats.countries.reduce((a, c) => a + c.count, 0);

  return (
    <Box sx={{ opacity: stale ? 0.7 : 1 }}>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile
            label="Consent answers"
            value={full(t.answers)}
            note={`${full(t.strict)} accepted by click · ${full(t.optOut)} declined · ${full(t.implied)} without a click`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Allowed statistics" value={percent(t.statistics)} note="Google Analytics can see at most this share of the visitors who answered" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Allowed marketing" value={percent(t.marketing)} note="Google Ads and remarketing can use at most this share" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Declined by click" value={percent(t.declinedByClick)} note="Of the visitors who clicked a banner button" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section sx={{ height: "100%" }}>
            <ChartFrame
              title="Share of answers allowing statistics and marketing, by day"
              caption={`${stats.domain} · ${dayLabel(stats.from)} – ${dayLabel(stats.to)}. Today arrives tomorrow.`}
              stale={stale}
              empty={daily.length < 2 ? "Cookiebot returned fewer than two days." : null}
              table={{
                columns: ["Day", "Answers", "Accepted by click", "Declined", "Without a click", "Statistics", "Marketing"],
                numeric: [1, 2, 3, 4, 5, 6],
                rows: daily.map((d) => [dayLabel(d.date), full(d.answers), full(d.strict), full(d.optOut), full(d.implied), percent(d.statistics), percent(d.marketing)]),
              }}
            >
              <TrendChart
                data={daily.map((d) => ({ x: d.date, value: d.statistics, compare: d.marketing }))}
                seriesLabel="Allowed statistics"
                compareLabel="Allowed marketing"
                height={240}
                format={(v) => percent(v)}
                tickFormat={(v) => percent(v, 0)}
              />
            </ChartFrame>
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section sx={{ height: "100%" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Answers by country</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25, mb: 1.75 }}>Where the visitors who answered the banner were.</Typography>
            <BarList
              rows={stats.countries.slice(0, 12).map((c) => ({
                label: countryName(c.code),
                value: c.count,
                secondary: countryTotal > 0 ? percent(c.count / countryTotal, 0) : undefined,
              }))}
              format={(v) => full(v)}
              labelWidth={130}
              emptyMessage="Cookiebot returned no countries for this window."
            />
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function CookieConsentPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { window: win } = useReportingWindow();
  const q = `from=${win.from}&to=${win.to}`;
  const consent = useHeld<ConsentStats>(`/api/integrations/cookiebot?${q}`, [q, tick]);

  return (
    <Box>
      <Gate held={consent} source="Cookiebot" loadingLabel="Reading the Cookiebot consent log…" onRetry={retry}>
        {(stats, stale) => <View stats={stats} stale={stale} />}
      </Gate>
      <SourceNote>
        Cookiebot data API, consent statistics per day for the shop domain. Cookiebot writes one record each time consent is given,
        renewed or changed, not one per visitor, so a returning visitor who renews counts again. Consent recorded without a click (implied)
        counts as accepted in Cookiebot’s figures and is shown separately. Visitors who leave without answering are not in the log.
        Refreshed at most every 5 minutes.
      </SourceNote>
    </Box>
  );
}
