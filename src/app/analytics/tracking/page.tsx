"use client";

// TRACKING HEALTH — is GA4 attributing sessions to the right channel? Read
// against the acceptance test agreed for the GTM consent fix (see health.ts).
// The windows are fixed — the eight weeks before 21 Aug as the baseline and
// the last sixteen full weeks — so the hub-wide window does not apply here,
// and the header says so.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { Gate, HAIRLINE, INK, MUTED, NotConnectedPanel, Section, SourceNote } from "../Shell";
import { useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { dayLabel, decimal, full, percent, signedPercent } from "@/app/charts/format";
import {
  ACCEPT,
  BASELINE,
  BASELINE_WEEKS,
  INCIDENT_DATE,
  RECENT_WEEKS,
  clicksByDate,
  dailyMix,
  describeHealth,
  fullWeeks,
  pvPerUser,
  shareOf,
  shiftIso,
  sumClicks,
  sumMix,
} from "./health";
import { combineHeld, useTrackingHealth } from "./useTrackingHealth";
import { HealthChip, TONE } from "./AttributionNotice";

type GclidStatus = {
  gclidContacts: number | null;
  consentContacts: number | null;
  consentGranted: number | null;
  consentDenied: number | null;
};

const weekLabel = (monday: string) => `w/c ${dayLabel(monday)}`;
const baselineLabel = `${dayLabel(BASELINE.from)} – ${dayLabel(BASELINE.to)}`;

function Check({ pass, label, value, children }: { pass: boolean; label: string; value: string; children?: ReactNode }) {
  const tone = pass ? TONE.good : TONE.bad;
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      {pass ? (
        <CheckCircleIcon sx={{ fontSize: 19, color: tone.fg, mt: "1px" }} />
      ) : (
        <HighlightOffIcon sx={{ fontSize: 19, color: tone.fg, mt: "1px" }} />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>
          {label}{" "}
          <Box component="span" sx={{ fontWeight: 500, color: tone.fg }}>
            — {pass ? "met" : "not met"}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        {children}
      </Box>
    </Box>
  );
}

export default function TrackingHealthPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { span, all, derived } = useTrackingHealth(tick);

  const qb = `from=${BASELINE.from}&to=${BASELINE.to}`;
  const qr = `from=${span.from}&to=${span.to}`;
  const newBaseline = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=newChannelsDaily&${qb}`, [tick]);
  const newRecent = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=newChannelsDaily&${qr}`, [qr, tick]);
  const adsBaseline = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=adsClicksDaily&${qb}`, [tick]);
  const adsRecent = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=adsClicksDaily&${qr}`, [qr, tick]);
  const gclid = useHeld<GclidStatus>(`/api/integrations/hubspot?report=gclidStatus`, [tick]);
  const detailHeld = combineHeld([newBaseline, newRecent, adsBaseline, adsRecent]);
  const everything = combineHeld([all, detailHeld]);

  const detail = useMemo(() => {
    const r = detailHeld.result;
    if (!r || r.state !== "ok") return null;
    const [nb, nr, ab, ar] = r.data;
    return {
      newBaseline: dailyMix(nb),
      newRecent: dailyMix(nr),
      clicksBaseline: clicksByDate(ab),
      clicksRecent: clicksByDate(ar),
      truncated: r.data.some((x) => x.truncated),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBaseline.result, newRecent.result, adsBaseline.result, adsRecent.result]);

  const weeks = useMemo(() => {
    if (!derived) return [];
    return fullWeeks(derived.recentDays, span).map((w) => {
      const end = shiftIso(w.monday, 6);
      const newMix = detail ? sumMix(detail.newRecent, w.monday, end) : null;
      const clicks = detail ? sumClicks(detail.clicksRecent, w.monday, end) : null;
      return {
        monday: w.monday,
        sessions: w.total,
        direct: shareOf(w.direct, w),
        paid: shareOf(w.paid, w),
        organic: shareOf(w.organic, w),
        newDirect: newMix ? shareOf(newMix.direct, newMix) : null,
        paidPerClick: clicks ? w.paid / clicks : null,
        pvPerUser: pvPerUser(derived.recentTraffic.get(w.monday)),
      };
    });
  }, [derived, detail, span]);

  const base = useMemo(() => {
    if (!derived) return null;
    const mix = sumMix(derived.baselineDays, BASELINE.from, BASELINE.to);
    const newMix = detail ? sumMix(detail.newBaseline, BASELINE.from, BASELINE.to) : null;
    const clicks = detail ? sumClicks(detail.clicksBaseline, BASELINE.from, BASELINE.to) : null;
    return {
      sessionsPerWeek: mix.total / BASELINE_WEEKS,
      direct: shareOf(mix.direct, mix),
      paid: shareOf(mix.paid, mix),
      organic: shareOf(mix.organic, mix),
      newDirect: newMix ? shareOf(newMix.direct, newMix) : null,
      paidPerClick: clicks ? mix.paid / clicks : null,
      pvPerUser: derived.health.baselinePvPerUser,
    };
  }, [derived, detail]);

  const last7From = shiftIso(span.to, -6);
  const recent7 = useMemo(() => {
    if (!derived) return null;
    const mix = sumMix(derived.recentDays, last7From, span.to);
    const newMix = detail ? sumMix(detail.newRecent, last7From, span.to) : null;
    const clicks = detail ? sumClicks(detail.clicksRecent, last7From, span.to) : null;
    return {
      direct: shareOf(mix.direct, mix),
      newDirect: newMix ? shareOf(newMix.direct, newMix) : null,
      paidPerClick: clicks ? mix.paid / clicks : null,
    };
  }, [derived, detail, last7From, span.to]);

  const health = derived?.health ?? null;
  const copy = health ? describeHealth(health) : null;
  const lastWeek = weeks.length ? weeks[weeks.length - 1] : null;
  const lastWeekPvChange = lastWeek?.pvPerUser != null && base?.pvPerUser ? lastWeek.pvPerUser / base.pvPerUser - 1 : null;
  const truncated = Boolean(derived?.truncated || detail?.truncated);
  // Without GA4 every card would repeat the same panel; say it once and keep the HubSpot section.
  const allResult = all.result;
  const ga4Missing = allResult && allResult.state === "not-configured" ? allResult.missing : null;

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
  const num = { ...cell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Chip
          label={`Baseline ${baselineLabel} · last ${RECENT_WEEKS} full weeks through ${dayLabel(span.to)}`}
          size="small"
          sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
        />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
          Fixed windows, so the hub-wide window does not apply. GA4 can still be processing the most recent day.
        </Typography>
      </Box>

      {ga4Missing ? (
        <Box sx={{ mb: 2.5 }}>
          <NotConnectedPanel source="Google Analytics 4" missing={ga4Missing} />
        </Box>
      ) : (
        <>
          <Section sx={{ mb: 2.5 }}>
            <Gate held={all} source="Google Analytics 4" loadingLabel="Running the attribution check…" onRetry={retry}>
              {(_d, stale) =>
                health && copy ? (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <Box sx={{ mb: 1 }}>
                      <HealthChip tone={copy.tone} label={copy.label} />
                    </Box>
                    <Typography sx={{ fontSize: "0.9rem", color: INK, maxWidth: 920, mb: 2 }}>{copy.sentence}</Typography>
                    <Box sx={{ display: "grid", gap: 1.75 }}>
                      <Check
                        pass={health.daysInBand >= ACCEPT.weekdaysNeeded}
                        label="Direct at or under 32% on 9 of the last 10 weekdays"
                        value={`${health.daysInBand} of ${health.days.length} weekdays in band`}
                      >
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))", gap: 0.5, mt: 0.75, maxWidth: 760 }}>
                          {health.days.map((d) => {
                            const t = d.inBand ? TONE.good : TONE.bad;
                            return (
                              <Box key={d.date} sx={{ borderRadius: 1, px: 0.5, py: 0.5, textAlign: "center", bgcolor: t.bg }}>
                                <Typography sx={{ fontSize: "0.66rem", color: MUTED }}>{dayLabel(d.date)}</Typography>
                                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: t.fg, fontVariantNumeric: "tabular-nums" }}>
                                  {percent(d.direct, 0)}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Check>
                      <Check
                        pass={health.weeksInBand}
                        label="Direct at or under 31% in each of the last two full weeks"
                        value={health.weeks.map((w) => `${weekLabel(w.monday)}: ${percent(w.direct)}`).join(" · ")}
                      />
                      <Check
                        pass={health.pvOk}
                        label="Page views per user within ±8% of baseline in both weeks"
                        value={`${health.weeks
                          .map((w) => `${weekLabel(w.monday)}: ${decimal(w.pvPerUser)} (${signedPercent(w.pvChange)})`)
                          .join(" · ")} · baseline ${decimal(health.baselinePvPerUser)}`}
                      />
                    </Box>
                    {truncated && (
                      <Typography sx={{ fontSize: "0.74rem", color: TONE.bad.fg, mt: 1.5 }}>
                        GA4 capped at least one report at its row limit, so these figures rest on partial rows.
                      </Typography>
                    )}
                  </Box>
                ) : null
              }
            </Gate>
          </Section>

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Gate held={all} source="Google Analytics 4" loadingLabel="Reading the channel mix…" onRetry={retry}>
                {(_d, stale) => (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <StatTile
                      label="Direct share · last 7 days"
                      value={percent(recent7?.direct)}
                      note={`Baseline ${percent(base?.direct)} · fixed means ≤ 31% a week`}
                      trend={weeks.slice(-12).map((w) => w.direct)}
                    />
                  </Box>
                )}
              </Gate>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Gate held={everything} source="Google Analytics 4" loadingLabel="Reading new visitors…" onRetry={retry}>
                {(_d, stale) => (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <StatTile
                      label="New visitors landing in Direct · 7 days"
                      value={percent(recent7?.newDirect)}
                      note={`Baseline ${percent(base?.newDirect)} · the share the defect moves most`}
                      trend={weeks.slice(-12).map((w) => w.newDirect)}
                    />
                  </Box>
                )}
              </Gate>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Gate held={everything} source="Google Analytics 4" loadingLabel="Matching sessions to Ads clicks…" onRetry={retry}>
                {(_d, stale) => (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <StatTile
                      label="Paid Search sessions per Ads click · 7 days"
                      value={decimal(recent7?.paidPerClick)}
                      note={`Baseline ${decimal(base?.paidPerClick)} · clicks from the Ads accounts linked to GA4`}
                      trend={weeks.slice(-12).map((w) => w.paidPerClick)}
                    />
                  </Box>
                )}
              </Gate>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Gate held={all} source="Google Analytics 4" loadingLabel="Reading page views per user…" onRetry={retry}>
                {(_d, stale) => (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <StatTile
                      label="Page views per user · last full week"
                      value={decimal(lastWeek?.pvPerUser)}
                      note={`Baseline ${decimal(base?.pvPerUser)} · ${signedPercent(lastWeekPvChange)} · the fix allows ±8%`}
                      trend={weeks.slice(-12).map((w) => w.pvPerUser)}
                    />
                  </Box>
                )}
              </Gate>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Section sx={{ height: "100%" }}>
                <Gate held={all} source="Google Analytics 4" loadingLabel="Charting the Direct share…" onRetry={retry}>
                  {(_d, stale) => {
                    const pts = weeks.map((w) => ({ x: w.monday, value: w.direct, compare: base?.direct ?? null }));
                    return (
                      <ChartFrame
                        title="Direct share of sessions, by week"
                        caption={`Attribution broke around midday on ${dayLabel(INCIDENT_DATE)}. Fixed means at or under 31% for two full weeks; grey is the ${baselineLabel} average.`}
                        stale={stale}
                        empty={pts.length < 2 ? "GA4 returned fewer than two full weeks." : null}
                        table={{
                          columns: ["Week", "Direct share", "Baseline"],
                          numeric: [1, 2],
                          rows: weeks.map((w) => [weekLabel(w.monday), percent(w.direct), percent(base?.direct)]),
                        }}
                      >
                        <TrendChart
                          data={pts}
                          seriesLabel="Direct share"
                          compareLabel={`Baseline ${baselineLabel}`}
                          height={220}
                          format={(v) => percent(v)}
                          xFormat={weekLabel}
                        />
                      </ChartFrame>
                    );
                  }}
                </Gate>
              </Section>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Section sx={{ height: "100%" }}>
                <Gate held={everything} source="Google Analytics 4" loadingLabel="Charting sessions per Ads click…" onRetry={retry}>
                  {(_d, stale) => {
                    const pts = weeks.map((w) => ({ x: w.monday, value: w.paidPerClick, compare: base?.paidPerClick ?? null }));
                    return (
                      <ChartFrame
                        title="Paid Search sessions per Google Ads click"
                        caption="Clicks come from Google Ads and do not depend on consent, so a falling ratio means GA4 is losing paid sessions, not that ads stopped working."
                        stale={stale}
                        empty={pts.filter((p) => p.value !== null).length < 2 ? "GA4 returned fewer than two weeks with Ads clicks." : null}
                        table={{
                          columns: ["Week", "Sessions per click", "Baseline"],
                          numeric: [1, 2],
                          rows: weeks.map((w) => [weekLabel(w.monday), decimal(w.paidPerClick), decimal(base?.paidPerClick)]),
                        }}
                      >
                        <TrendChart
                          data={pts}
                          seriesLabel="Sessions per click"
                          compareLabel="Baseline"
                          height={220}
                          format={(v) => decimal(v)}
                          xFormat={weekLabel}
                        />
                      </ChartFrame>
                    );
                  }}
                </Gate>
              </Section>
            </Grid>
          </Grid>

          <Section sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.25 }}>Week by week</Typography>
            <Gate held={everything} source="Google Analytics 4" loadingLabel="Building the weekly table…" onRetry={retry}>
              {(_d, stale) => (
                <Box sx={{ overflowX: "auto", opacity: stale ? 0.7 : 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Week", "Sessions", "Direct", "Paid Search", "Organic", "New visitors → Direct", "Paid sessions / Ads click", "Page views / user", "Direct ≤ 31%"].map((h, i) => (
                          <TableCell key={h} sx={{ ...(i === 0 ? cell : num), fontWeight: 600, color: MUTED }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...weeks].reverse().map((w) => {
                        const inBand = w.direct !== null && w.direct <= ACCEPT.weekMax;
                        const holdsIncident = w.monday <= INCIDENT_DATE && shiftIso(w.monday, 6) >= INCIDENT_DATE;
                        return (
                          <TableRow key={w.monday}>
                            <TableCell sx={{ ...cell, color: INK, fontWeight: 600 }}>
                              {weekLabel(w.monday)}
                              {holdsIncident && (
                                <Chip label={`break ${dayLabel(INCIDENT_DATE)}`} size="small" sx={{ ml: 1, height: 18, fontSize: "0.64rem", bgcolor: TONE.bad.bg, color: TONE.bad.fg }} />
                              )}
                            </TableCell>
                            <TableCell sx={num}>{full(w.sessions)}</TableCell>
                            <TableCell sx={{ ...num, color: INK, fontWeight: 600 }}>{percent(w.direct)}</TableCell>
                            <TableCell sx={num}>{percent(w.paid)}</TableCell>
                            <TableCell sx={num}>{percent(w.organic)}</TableCell>
                            <TableCell sx={num}>{percent(w.newDirect)}</TableCell>
                            <TableCell sx={num}>{decimal(w.paidPerClick)}</TableCell>
                            <TableCell sx={num}>{decimal(w.pvPerUser)}</TableCell>
                            <TableCell sx={{ ...num, color: inBand ? TONE.good.fg : TONE.bad.fg, fontWeight: 600 }}>{inBand ? "Yes" : "No"}</TableCell>
                          </TableRow>
                        );
                      })}
                      {base && (
                        <TableRow sx={{ bgcolor: "#f7f8fa" }}>
                          <TableCell sx={{ ...cell, color: MUTED, fontWeight: 600 }}>Baseline, weekly average</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{full(Math.round(base.sessionsPerWeek))}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED, fontWeight: 600 }}>{percent(base.direct)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{percent(base.paid)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{percent(base.organic)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{percent(base.newDirect)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{decimal(base.paidPerClick)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>{decimal(base.pvPerUser)}</TableCell>
                          <TableCell sx={{ ...num, color: MUTED }}>—</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Gate>
          </Section>
        </>
      )}

      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.5 }}>Click-id capture in HubSpot</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
          Written by the shop tag straight to HubSpot, independent of how GA4 labels channels.
        </Typography>
        <Gate held={gclid} source="HubSpot" loadingLabel="Counting captured click ids…" onRetry={retry}>
          {(g, stale) => (
            <Grid container spacing={2} sx={{ opacity: stale ? 0.7 : 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StatTile label="Contacts carrying a gclid" value={full(g.gclidContacts)} note="Includes the historical backfill of 11 Sep" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StatTile
                  label="Contacts with consent flags"
                  value={full(g.consentContacts)}
                  note={`${full(g.consentGranted)} ad storage granted · ${full(g.consentDenied)} denied · full declines are never written`}
                />
              </Grid>
            </Grid>
          )}
        </Gate>
      </Section>

      <SourceNote>
        GA4 sessions by default channel group per day, the same for new visitors only, Google Ads clicks imported into GA4 per day
        (summed over campaigns; only accounts linked to the property, so sessions per click is read against its own baseline, not
        as a click-to-session rate), and users and page views per ISO week. Baseline {BASELINE.from} → {BASELINE.to}; recent
        window {span.from} → {span.to}. The verdict is the acceptance test agreed for the GTM consent fix: Direct at or under 32% on
        9 of the last 10 weekdays, at or under 31% in each of the last two full weeks, and page views per user within ±8% of the
        baseline. GA4 does not re-attribute sessions it has already recorded, so weeks between {dayLabel(INCIDENT_DATE)} and the
        fix stay as they are. The same verdict sits above the Paid Search counters on{" "}
        <Link href="/analytics/smec" style={{ color: "#1b4a80" }}>
          SMEC targets
        </Link>
        . Contact counts from HubSpot.
      </SourceNote>
    </Box>
  );
}
