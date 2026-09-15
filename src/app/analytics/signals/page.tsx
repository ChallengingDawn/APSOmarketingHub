"use client";

// COOKIE-FREE SIGNALS — what we know about customers mostly from business records
// and consent logs rather than browser tracking, so it also covers people who chose
// "necessary cookies only": ERP order intake and first orders on companies, web order
// records the Magento connector writes server to server (checked against GA4
// purchases), contact-form submissions in the CRM, e-shop account activity from the
// Performis tracker, and Cookiebot's consent log. Aggregates only; nothing modelled or
// scaled up. Sources that are not connected say so instead of showing a number.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote, SubAppHead } from "../Shell";
import { metricOf, useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { dayLabel, full, percent } from "@/app/charts/format";
import { isoDay, mondayOf } from "../tracking/health";
import type { CookieFreeSignals, WebOrders } from "@/lib/integrations/signals";
import type { ConsentDay, ConsentStats } from "@/lib/integrations/cookiebot";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(2, 4)}`;
const weekLabel = (w: string) => `w/c ${dayLabel(w)}`;

function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <Box sx={{ mb: 1.75 }}>
      <Typography sx={{ fontSize: "0.98rem", fontWeight: 600, color: INK }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25, maxWidth: 900 }}>{caption}</Typography>
    </Box>
  );
}

export default function CookieFreeSignalsPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const [nowMs] = useState(() => Date.now());
  const year = new Date(nowMs).getUTCFullYear();
  const yesterday = isoDay(nowMs - 86_400_000);
  // On 1 January there is no full day of the new year yet; asking GA4 for it would fall back to a default window.
  const yearStarted = yesterday >= `${year}-01-01`;

  const signals = useHeld<CookieFreeSignals>(`/api/integrations/hubspot?report=signals&year=${year}`, [tick]);
  const webOrders = useHeld<WebOrders>(`/api/integrations/hubspot?report=webOrders`, [tick]);
  const ads = useHeld<Ga4TableReport>(
    yearStarted ? `/api/integrations/ga4?report=adsClicksDaily&from=${year}-01-01&to=${yesterday}` : null,
    [tick],
  );
  const consent = useHeld<ConsentStats>(`/api/integrations/cookiebot?days=30`, [tick]);
  const liveFrom = webOrders.result?.state === "ok" ? webOrders.result.data.liveFrom : null;
  const purchases = useHeld<Ga4TableReport>(
    liveFrom ? `/api/integrations/ga4?report=transactionsDaily&from=${liveFrom}&to=${yesterday}` : null,
    [liveFrom, tick],
  );

  const adsTotals = useMemo(() => {
    const r = ads.result;
    if (!r || r.state !== "ok") return null;
    const costOf = metricOf(r.data, "advertiserAdCost");
    let cost = 0;
    let seen = false;
    for (const row of r.data.rows) {
      const c = costOf(row);
      if (c !== null) {
        cost += c;
        seen = true;
      }
    }
    return { cost: seen ? cost : null, truncated: r.data.truncated };
  }, [ads.result]);

  const webWeeks = useMemo(() => {
    const w = webOrders.result;
    const p = purchases.result;
    if (!w || w.state !== "ok" || !p || p.state !== "ok") return null;
    const tx = metricOf(p.data, "transactions");
    const byWeek = new Map<string, number>();
    for (const row of p.data.rows) {
      const v = tx(row);
      if (v === null) continue;
      const wk = mondayOf(row.keys[0]);
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + v);
    }
    const currentMonday = mondayOf(isoDay(nowMs));
    return w.data.weeks.map((x) => ({
      week: x.week,
      records: x.records,
      purchases: byWeek.get(x.week) ?? null,
      running: x.week === currentMonday,
    }));
  }, [webOrders.result, purchases.result, nowMs]);

  const consentTotals = useMemo(() => {
    const r = consent.result;
    if (!r || r.state !== "ok") return null;
    const sum = (key: keyof Omit<ConsentDay, "date">) => r.data.days.reduce((a, d) => a + (d[key] ?? 0), 0);
    const optIn = sum("optIn");
    const optOut = sum("optOut");
    const strict = sum("optInStrict");
    const records = optIn + optOut;
    const clicked = strict + optOut;
    return {
      records,
      strict,
      optOut,
      implied: sum("optInImplied"),
      shared: sum("bulkOptInImplied") + sum("bulkOptInStrict"),
      statisticsShare: records > 0 ? sum("optInStatistics") / records : null,
      marketingShare: records > 0 ? sum("optInMarketing") / records : null,
      declinedByClick: clicked > 0 ? optOut / clicked : null,
      trend: r.data.days.map((d) => {
        const a = (d.optIn ?? 0) + (d.optOut ?? 0);
        return {
          x: d.date,
          value: a > 0 && d.optInStatistics !== null ? d.optInStatistics / a : null,
          compare: a > 0 && d.optInMarketing !== null ? d.optInMarketing / a : null,
        };
      }),
    };
  }, [consent.result]);

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem" };
  const num = { ...cell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };

  return (
    <Box>
      <SubAppHead purpose="Mostly business records and consent logs rather than browser tracking, so it also covers customers who chose “necessary cookies only”. The one exception is marked: the no-browsing-history split reads HubSpot’s own tracking data." />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Chip label="Aggregates only" size="small" sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
          Figures are cached for up to 5 minutes — reload the page for fresh numbers. Fixed windows, so the hub-wide window does not apply.
        </Typography>
      </Box>

      {/* 1 — buying companies */}
      <Section sx={{ mb: 2.5 }}>
        <SectionTitle
          title="Buying companies — ERP order intake, all channels"
          caption="From Compass (ERP) values on HubSpot companies: order intake per year and the year of the first order. Counts every customer, whatever they chose on the cookie banner."
        />
        <Gate held={signals} source="HubSpot" loadingLabel="Counting buying companies, enquiries and e-shop accounts — about 15 seconds…" onRetry={retry}>
          {(s, stale) => {
            const b = s.buyers;
            const repeatShare = b.repeatBuyers !== null && b.buyersLastYear ? b.repeatBuyers / b.buyersLastYear : null;
            const costPerNew = adsTotals?.cost != null && b.newBuyers ? adsTotals.cost / b.newBuyers : null;
            return (
              <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile label={`Companies ordering in ${b.year} so far`} value={full(b.buyersThisYear)} note="ERP order intake above zero this year" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile
                      label="Repeat buyers so far"
                      value={percent(repeatShare)}
                      note={`${full(b.repeatBuyers)} of the ${full(b.buyersLastYear)} companies that ordered in ${b.year - 1} have ordered again in ${b.year}. The year is still running, so this rises until December — not an annual retention rate.`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile label={`New buying companies ${b.year} so far`} value={full(b.newBuyers)} note="First Compass order this year" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    {yearStarted ? (
                      <Gate held={ads} source="Google Analytics 4" loadingLabel="Summing Google Ads cost…" onRetry={retry}>
                        {() => (
                          <StatTile
                            label="Google Ads cost this year"
                            value={adsTotals?.cost == null ? "—" : `CHF ${full(Math.round(adsTotals.cost))}`}
                            note={`CH + DE accounts linked to GA4, in the property currency.${costPerNew === null ? "" : ` Divided by all ${full(b.newBuyers)} new buying companies from every channel: CHF ${full(Math.round(costPerNew))} each — a blend, not what one new customer costs.`}`}
                          />
                        )}
                      </Gate>
                    ) : (
                      <StatTile label="Google Ads cost this year" value="—" note="No full day of this year yet" />
                    )}
                  </Grid>
                </Grid>
                {b.missingProperties.length > 0 && (
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.5 }}>
                    Not in the portal yet, so shown as “—”: {b.missingProperties.join(", ")}.
                  </Typography>
                )}
              </Box>
            );
          }}
        </Gate>
      </Section>

      {/* 2 — web order records against GA4 purchases */}
      <Section sx={{ mb: 2.5 }}>
        <Gate held={webOrders} source="HubSpot" loadingLabel="Counting web order records…" onRetry={retry}>
          {(w, stale) => (
            <Gate held={purchases} source="Google Analytics 4" loadingLabel="Reading GA4 purchases for the same weeks…" onRetry={retry}>
              {() => {
                const weeks = webWeeks ?? [];
                const fullWeeks = weeks.filter((x) => !x.running && x.records !== null && x.purchases !== null);
                const short = fullWeeks.filter((x) => (x.records as number) < (x.purchases as number));
                const pts = weeks.map((x) => ({ x: x.week, value: x.records, compare: x.purchases }));
                const status = (x: (typeof weeks)[number]) =>
                  x.running ? "week still running" : x.records === null || x.purchases === null ? "—" : x.records < x.purchases ? "below GA4 — orders missing" : "at or above GA4";
                return (
                  <ChartFrame
                    title="Web order records vs GA4 purchases, by week"
                    caption={`Records the Magento connector writes into HubSpot server to server (live since ${dayLabel(w.liveFrom)}), against GA4 purchases — which only count visitors who allowed statistics, so real web orders can never be lower. ${
                      short.length > 0
                        ? `In ${short.length} of the ${fullWeeks.length} full weeks the records fall below GA4 (first: ${weekLabel(short[0].week)}), so web orders are missing in HubSpot there.`
                        : "No full week falls below GA4."
                    } Not yet checked against Magento's own order count, so there is no monthly total and no web share. HubSpot dates are UTC days, GA4 days are Swiss time, so counts can shift slightly at week edges.`}
                    stale={stale}
                    empty={pts.filter((p) => p.value !== null).length < 2 ? "Fewer than two weeks of records so far." : null}
                    table={{
                      columns: ["Week", "Web order records", "GA4 purchases", "Check"],
                      numeric: [1, 2],
                      rows: weeks.map((x) => [weekLabel(x.week), full(x.records), full(x.purchases), status(x)]),
                    }}
                  >
                    <TrendChart
                      data={pts}
                      seriesLabel="Web order records (connector)"
                      compareLabel="GA4 purchases (consenting visitors only)"
                      height={220}
                      format={(v) => full(v)}
                      xFormat={weekLabel}
                    />
                  </ChartFrame>
                );
              }}
            </Gate>
          )}
        </Gate>
      </Section>

      {/* 3 — contact and returns forms */}
      <Section sx={{ mb: 2.5 }}>
        <Gate held={signals} source="HubSpot" loadingLabel="Counting contact-form submissions…" onRetry={retry}>
          {(s, stale) => {
            const months = s.enquiries;
            const lastFull = months.length >= 2 ? months[months.length - 2] : null;
            const noHistoryShare = lastFull && lastFull.contacts && lastFull.withoutPageViews !== null ? lastFull.withoutPageViews / lastFull.contacts : null;
            const pts = months.map((m) => ({ x: m.month, value: m.contacts, compare: m.withoutPageViews }));
            return (
              <ChartFrame
                title="Contact & returns form submissions — at least"
                caption={`Contacts whose latest form in the month was a customer Contact Us / Returns form (one form serves both). Minimums: HubSpot’s searchable latest-conversion field holds only the most recent form, so automated forms (Magento order and cart summaries), internal visit forms, surveys and the consent-sync form hide an earlier one. ${
                  lastFull
                    ? `${monthLabel(lastFull.month)}: at least ${full(lastFull.contacts)}, ${percent(noHistoryShare)} of them with no page view ever recorded on the contact (this split reads HubSpot’s tracking data).`
                    : ""
                } The last month is still running.`}
                stale={stale}
                empty={pts.filter((p) => p.value !== null).length < 2 ? "HubSpot returned fewer than two months." : null}
                table={{
                  columns: ["Month", "Contact & returns forms (at least)", "No page view ever recorded"],
                  numeric: [1, 2],
                  rows: months.map((m) => [monthLabel(m.month), full(m.contacts), full(m.withoutPageViews)]),
                }}
              >
                <TrendChart data={pts} seriesLabel="Contact & returns forms" compareLabel="No page view ever recorded" height={210} format={(v) => full(v)} xFormat={monthLabel} />
              </ChartFrame>
            );
          }}
        </Gate>
      </Section>

      {/* 4 — e-shop accounts */}
      <Section sx={{ mb: 2.5 }}>
        <SectionTitle
          title="E-shop account activity — Performis E-Shop Data Tracker"
          caption="Companies with at least one e-shop login or order in the year, from the yearly tracker exports loaded into HubSpot. How the tracker records logins and views is still being confirmed with Performis, and the data protection officer has not yet ruled on per-company login counts for EU customers — so only aggregate counts are shown."
        />
        <Gate held={signals} source="HubSpot" loadingLabel="Counting e-shop accounts…" onRetry={retry}>
          {(s, stale) =>
            s.eshop.length === 0 ? (
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No tracker years are loaded in HubSpot.</Typography>
            ) : (
              <Box sx={{ overflowX: "auto", opacity: stale ? 0.7 : 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...cell, fontWeight: 600, color: MUTED }}>Year</TableCell>
                      <TableCell sx={{ ...num, fontWeight: 600, color: MUTED }}>Companies with logins</TableCell>
                      <TableCell sx={{ ...num, fontWeight: 600, color: MUTED }}>Companies with e-shop orders</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...s.eshop].reverse().map((y) => (
                      <TableRow key={y.year}>
                        <TableCell sx={{ ...cell, fontWeight: 600, color: INK }}>{y.year}</TableCell>
                        <TableCell sx={num}>{full(y.companiesWithLogins)}</TableCell>
                        <TableCell sx={num}>{full(y.companiesWithOrders)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.25 }}>
                  The 2023 export lists every account holder, so that year is not comparable with the others. The current year appears
                  once its export is loaded.
                </Typography>
              </Box>
            )
          }
        </Gate>
      </Section>

      {/* 5 — consent log */}
      <Section sx={{ mb: 2.5 }}>
        <SectionTitle
          title="Consent log — Cookiebot, last 30 days"
          caption="Cookiebot writes one record each time consent is given, renewed or changed — not one per visitor. It counts implied opt-ins (consent recorded without a click) as opt-ins; they are shown separately. Visitors who leave without answering are not in the log."
        />
        <Gate held={consent} source="Cookiebot" loadingLabel="Reading the Cookiebot consent log…" onRetry={retry}>
          {(c, stale) =>
            consentTotals === null || consentTotals.records === 0 ? (
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Cookiebot returned no consent records for {c.domain} in this window.</Typography>
            ) : (
              <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile
                      label="Consent records"
                      value={full(consentTotals.records)}
                      note={`${full(consentTotals.strict)} accepted by click · ${full(consentTotals.optOut)} declined · ${full(consentTotals.implied)} implied (no click)${consentTotals.shared > 0 ? ` · ${full(consentTotals.shared)} shared across domains` : ""}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile
                      label="Allowed statistics"
                      value={percent(consentTotals.statisticsShare)}
                      note="Of consent records, implied included. GA4 can see at most this share of the visitors who answered, and none of those who never answer."
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile label="Allowed marketing" value={percent(consentTotals.marketingShare)} note="Ad cookies allowed, of consent records, implied included" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <StatTile label="Declined by click" value={percent(consentTotals.declinedByClick)} note="Of the visitors who clicked a banner button" />
                  </Grid>
                </Grid>
                <ChartFrame
                  title="Share of consent records allowing statistics and marketing, by day"
                  caption={`${c.domain} · ${dayLabel(c.from)} – ${dayLabel(c.to)}`}
                  stale={stale}
                  empty={consentTotals.trend.length < 2 ? "Cookiebot returned fewer than two days." : null}
                  table={{
                    columns: ["Day", "Statistics", "Marketing"],
                    numeric: [1, 2],
                    rows: consentTotals.trend.map((p) => [dayLabel(p.x), percent(p.value), percent(p.compare)]),
                  }}
                >
                  <TrendChart data={consentTotals.trend} seriesLabel="Statistics" compareLabel="Marketing" height={200} format={(v) => percent(v, 0)} />
                </ChartFrame>
              </Box>
            )
          }
        </Gate>
      </Section>

      {/* 6 — server logs */}
      <Section sx={{ mb: 2.5 }}>
        <SectionTitle
          title="Page counts from server logs"
          caption="Anonymous counts of every request that reaches the web server, per URL, locale and day, read from the server’s own logs instead of a browser script."
        />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", border: `1px dashed ${HAIRLINE}`, borderRadius: 2, p: 2 }}>
          <LinkOffIcon sx={{ fontSize: 22, color: MUTED, mt: 0.25 }} />
          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>Not connected yet — no numbers until the logs arrive</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5, maxWidth: 900 }}>
              Needs the access logs of www.apsoparts.com. The shop’s public address is in Angst+Pfister’s network, so the first ask goes
              to A+P group IT; a hosting partner may hold the logs. Planned handling: IP addresses cut short when the logs are read, no
              cookies or identifiers, aggregates only. Consent-free in Switzerland; likely in France, Italy and the Netherlands;
              uncertain in Germany, Austria and Poland, so the data protection officer decides before it goes live.
            </Typography>
          </Box>
        </Box>
      </Section>

      <SourceNote>
        HubSpot search totals on companies (Compass order intake oi_{year - 1} / oi_{year}, compass_first_order_year, E-Shop Data
        Tracker n_of_logins_datatracker_YYYY and orders_datatracker_YYYY), contacts (recent_conversion_date with a “Customer Facing”
        contact form, hs_analytics_num_page_views = 0) and Orders (order_source_system = magento, by order date, per week). GA4
        purchases (transactions) per day for the same weeks. Google Ads cost from GA4 (advertiserAdCost summed over days and campaigns,
        CH and DE accounts linked to the property; CHF is the property currency
        {adsTotals?.truncated ? "; GA4 capped the report, so the sum is partial" : ""}). Cookiebot consent log from its data API.
        Nothing is sampled, scaled or modelled. This page summarises what can be measured largely without consent; it is not legal
        advice.
      </SourceNote>
    </Box>
  );
}
