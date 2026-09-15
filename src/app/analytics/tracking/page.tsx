"use client";

// TRACKING HEALTH — does GA4 credit visits to the right channel, and has the
// GTM consent fix passed the acceptance test agreed for it (see health.ts)?
//
// Two parts on purpose. The test always reads the latest data (the last ten
// weekdays and two full weeks through yesterday) whatever the reporting window
// says, so the verdict never moves with the picker. Everything under it follows
// the hub-wide window and is set against the eight weeks before the fault: per
// day up to about three months, per full week beyond that.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { Gate, HAIRLINE, INK, MUTED, NotConnectedPanel, Section, SourceNote } from "../Shell";
import { useHeld, type Held } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { CHROME, DELTA, SERIES } from "@/app/charts/palette";
import { dayLabel, decimal, full, percent, signedPercent } from "@/app/charts/format";
import {
  ACCEPT,
  BASELINE,
  BASELINE_WEEKS,
  INCIDENT_DATE,
  clicksByDate,
  dailyMix,
  describeHealth,
  fullWeeks,
  isWeekday,
  mondayOf,
  pvPerUser,
  shareOf,
  shiftIso,
  sumClicks,
  sumMix,
  trafficWeeks,
  type HealthDay,
  type HealthState,
  type HealthWeek,
} from "./health";
import { combineHeld, useTrackingHealth } from "./useTrackingHealth";
import { HealthChip, TONE } from "./AttributionNotice";

type GclidStatus = {
  gclidContacts: number | null;
  consentContacts: number | null;
  consentGranted: number | null;
  consentDenied: number | null;
};

type Row = {
  key: string;
  sessions: number;
  direct: number | null;
  paid: number | null;
  organic: number | null;
  newDirect: number | null;
  paidPerClick: number | null;
  pvPerUser: number | null;
  /** Inside the pass limit; null for weekends (the test ignores them) or when GA4 returned no sessions. */
  pass: boolean | null;
};

/** Up to about three months the window is read per day, beyond that per full week. */
const DAILY_UP_TO_DAYS = 92;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayOf = (iso: string) => WEEKDAYS[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];
const weekLabel = (monday: string) => `w/c ${dayLabel(monday)}`;
const baselineLabel = `${dayLabel(BASELINE.from)} – ${dayLabel(BASELINE.to)}`;
const fault = dayLabel(INCIDENT_DATE);

const LEAD: Record<HealthState, string> = {
  healthy: "Visits are credited to the right channels again.",
  recovering: "Direct is coming down, but not yet for long enough to count as fixed.",
  degraded: `Visits from Google Ads and search are still recorded as Direct, as they have been since ${fault}.`,
  alert: "Page views per user jumped. Google Analytics may be counting page views twice.",
  insufficient: "There is not enough data for the test yet.",
};

function okData<T>(held: Held<T>): T | null {
  return held.result && held.result.state === "ok" ? held.result.data : null;
}

/* ── the three checks ─────────────────────────────────────────────────── */

const dashMark = <Box sx={{ width: 16, borderTop: `1.5px dashed ${INK}` }} />;
const swatch = (color: string) => <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />;

function Key({ items }: { items: { mark: ReactNode; label: string }[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1.25 }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          {it.mark}
          <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{it.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Status is never colour alone: the pill carries an icon and the words. */
function TestCard({ pass, title, result, rule, children }: { pass: boolean; title: string; result: string; rule: string; children: ReactNode }) {
  const tone = pass ? TONE.good : TONE.bad;
  const Icon = pass ? CheckCircleIcon : HighlightOffIcon;
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2.4,
        p: 2.25,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED }}>{title}</Typography>
          <Typography
            sx={{ fontSize: "1.7rem", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.03em", color: INK, fontVariantNumeric: "tabular-nums", mt: 0.25 }}
          >
            {result}
          </Typography>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: 5, bgcolor: tone.bg, flexShrink: 0 }}>
          <Icon sx={{ fontSize: 15, color: tone.fg }} />
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: tone.fg }}>{pass ? "Met" : "Not met"}</Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>{children}</Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, borderTop: `1px solid ${HAIRLINE}`, pt: 1.25 }}>{rule}</Typography>
    </Box>
  );
}

function WeekdayColumns({ days }: { days: HealthDay[] }) {
  const BARS = 92;
  const LABEL = 16;
  const top = Math.max(0.5, Math.ceil(Math.max(0, ...days.map((d) => d.direct ?? 0)) * 10) / 10);
  const px = (v: number) => `${(Math.max(0, v) / top) * BARS}px`;
  const columns = { display: "grid", gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, columnGap: "6px" };
  return (
    <Box>
      <Box sx={{ position: "relative", height: `${BARS + LABEL}px`, borderBottom: `1px solid ${CHROME.axis}` }}>
        <Box
          aria-hidden
          sx={{ position: "absolute", left: 0, right: 0, bottom: px(ACCEPT.dayMax), borderTop: `1.5px dashed ${INK}`, zIndex: 1, pointerEvents: "none" }}
        />
        <Box sx={{ position: "absolute", inset: 0, alignItems: "end", ...columns }}>
          {days.map((d) => (
            <Tooltip
              key={d.date}
              arrow
              title={`${weekdayOf(d.date)} ${dayLabel(d.date)}: Direct ${percent(d.direct)}, ${d.inBand ? "within" : "above"} the 32% limit`}
            >
              <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <Typography
                  sx={{ fontSize: "0.68rem", fontWeight: 600, color: INK, textAlign: "center", lineHeight: `${LABEL}px`, fontVariantNumeric: "tabular-nums" }}
                >
                  {percent(d.direct, 0)}
                </Typography>
                <Box sx={{ height: px(d.direct ?? 0), minHeight: "2px", bgcolor: d.inBand ? DELTA.good : DELTA.bad, borderRadius: "4px 4px 0 0" }} />
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
      <Box sx={{ mt: 0.5, ...columns }}>
        {days.map((d) => (
          <Box key={d.date} sx={{ textAlign: "center", minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.64rem", color: MUTED, lineHeight: 1.25 }}>{weekdayOf(d.date)}</Typography>
            <Typography sx={{ fontSize: "0.64rem", color: MUTED, lineHeight: 1.25, whiteSpace: "nowrap" }}>{dayLabel(d.date)}</Typography>
          </Box>
        ))}
      </Box>
      <Key
        items={[
          { mark: dashMark, label: "32% limit" },
          { mark: swatch(DELTA.good), label: "Within" },
          { mark: swatch(DELTA.bad), label: "Above" },
        ]}
      />
    </Box>
  );
}

function WeekBars({ weeks }: { weeks: HealthWeek[] }) {
  const top = Math.max(0.5, Math.ceil(Math.max(0, ...weeks.map((w) => w.direct ?? 0)) * 10) / 10);
  const at = (v: number) => `${Math.min(100, (Math.max(0, v) / top) * 100)}%`;
  return (
    <Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {weeks.map((w) => (
          <Tooltip key={w.monday} arrow title={`${weekLabel(w.monday)}: Direct ${percent(w.direct)}, ${w.inBand ? "within" : "above"} the 31% limit`}>
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{weekLabel(w.monday)}</Typography>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{percent(w.direct)}</Typography>
              </Box>
              <Box sx={{ position: "relative", height: "14px", bgcolor: CHROME.grid, borderRadius: "4px" }}>
                <Box
                  sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: at(w.direct ?? 0), bgcolor: w.inBand ? DELTA.good : DELTA.bad, borderRadius: "0 4px 4px 0" }}
                />
                <Box aria-hidden sx={{ position: "absolute", left: at(ACCEPT.weekMax), top: "-4px", bottom: "-4px", borderLeft: `1.5px dashed ${INK}` }} />
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Key items={[{ mark: dashMark, label: "31% limit" }]} />
    </Box>
  );
}

function PvBand({ weeks, baseline }: { weeks: HealthWeek[]; baseline: number | null }) {
  const tol = ACCEPT.pvTolerance;
  const range = Math.ceil(Math.max(tol * 1.5, ...weeks.map((w) => Math.abs(w.pvChange ?? 0) * 1.2)) * 20) / 20;
  const at = (c: number) => `${((Math.max(-range, Math.min(range, c)) + range) / (2 * range)) * 100}%`;
  const edge = Math.round(range * 100);
  return (
    <Box>
      <Box sx={{ position: "relative", height: "34px", mx: "7px" }}>
        <Box aria-hidden sx={{ position: "absolute", left: 0, right: 0, top: "16px", height: "2px", bgcolor: CHROME.grid }} />
        <Box
          aria-hidden
          sx={{ position: "absolute", left: at(-tol), width: `${(tol / range) * 100}%`, top: "6px", height: "22px", bgcolor: TONE.good.bg, borderRadius: "4px" }}
        />
        <Box aria-hidden sx={{ position: "absolute", left: at(0), top: "2px", height: "30px", borderLeft: `1.5px solid ${CHROME.muted}` }} />
        {weeks.map((w, i) =>
          w.pvChange === null ? null : (
            <Tooltip
              key={w.monday}
              arrow
              title={`${weekLabel(w.monday)}: ${decimal(w.pvPerUser)} page views per user, ${signedPercent(w.pvChange)} against before the fault`}
            >
              <Box
                sx={{
                  position: "absolute",
                  left: at(w.pvChange),
                  top: i === 0 ? "3px" : "19px",
                  width: "12px",
                  height: "12px",
                  ml: "-6px",
                  borderRadius: "50%",
                  bgcolor: SERIES[i],
                  border: "2px solid #fff",
                  boxShadow: `0 0 0 1px ${CHROME.axis}`,
                }}
              />
            </Tooltip>
          ),
        )}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
        <Typography sx={{ fontSize: "0.64rem", color: MUTED }}>−{edge}%</Typography>
        <Typography sx={{ fontSize: "0.64rem", color: MUTED }}>{decimal(baseline)} before the fault</Typography>
        <Typography sx={{ fontSize: "0.64rem", color: MUTED }}>+{edge}%</Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 0.5, mt: 1 }}>
        {weeks.map((w, i) => (
          <Box key={w.monday} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: SERIES[i], flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{weekLabel(w.monday)}</Typography>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: INK, ml: "auto", fontVariantNumeric: "tabular-nums" }}>
              {decimal(w.pvPerUser)} ({signedPercent(w.pvChange)})
            </Typography>
          </Box>
        ))}
      </Box>
      <Key items={[{ mark: swatch(TONE.good.bg), label: "±8% allowed" }]} />
    </Box>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

export default function TrackingHealthPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { span, all, derived } = useTrackingHealth(tick);
  const { window: win, label: windowName, days: windowDays } = useReportingWindow();
  const byWeek = windowDays > DAILY_UP_TO_DAYS;

  const qw = `from=${win.from}&to=${win.to}`;
  const qb = `from=${BASELINE.from}&to=${BASELINE.to}`;
  const channels = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=channelsDaily&${qw}`, [qw, tick]);
  const newVisitors = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=newChannelsDaily&${qw}`, [qw, tick]);
  const adsClicks = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=adsClicksDaily&${qw}`, [qw, tick]);
  const traffic = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=trafficWeekly&${qw}`, [qw, tick]);
  const newBaseline = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=newChannelsDaily&${qb}`, [tick]);
  const adsBaseline = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=adsClicksDaily&${qb}`, [tick]);
  const gclid = useHeld<GclidStatus>(`/api/integrations/hubspot?report=gclidStatus`, [tick]);
  const windowHeld = combineHeld<unknown>([all, channels, newVisitors, adsClicks, traffic, newBaseline, adsBaseline]);

  const view = useMemo(() => {
    const ch = okData(channels);
    const nv = okData(newVisitors);
    const ad = okData(adsClicks);
    const tr = okData(traffic);
    const nb = okData(newBaseline);
    const ab = okData(adsBaseline);
    if (!derived || !ch || !nv || !ad || !tr || !nb || !ab) return null;

    const days = dailyMix(ch).filter((d) => d.date >= win.from && d.date <= win.to);
    const newDays = dailyMix(nv);
    const newByDate = new Map(newDays.map((d) => [d.date, d]));
    const clicks = clicksByDate(ad);
    const weeksTraffic = trafficWeeks(tr);

    const baseMix = sumMix(derived.baselineDays, BASELINE.from, BASELINE.to);
    const baseNew = sumMix(dailyMix(nb), BASELINE.from, BASELINE.to);
    const baseClicks = sumClicks(clicksByDate(ab), BASELINE.from, BASELINE.to);
    const base = {
      sessionsPerDay: baseMix.total / (BASELINE_WEEKS * 7),
      sessionsPerWeek: baseMix.total / BASELINE_WEEKS,
      direct: shareOf(baseMix.direct, baseMix),
      paid: shareOf(baseMix.paid, baseMix),
      organic: shareOf(baseMix.organic, baseMix),
      newDirect: shareOf(baseNew.direct, baseNew),
      paidPerClick: baseClicks > 0 ? baseMix.paid / baseClicks : null,
      pvPerUser: derived.health.baselinePvPerUser,
    };

    const windowWeeks = fullWeeks(days, win);
    const rows: Row[] = byWeek
      ? windowWeeks.map((w) => {
          const end = shiftIso(w.monday, 6);
          const n = sumMix(newDays, w.monday, end);
          const c = sumClicks(clicks, w.monday, end);
          const direct = shareOf(w.direct, w);
          return {
            key: w.monday,
            sessions: w.total,
            direct,
            paid: shareOf(w.paid, w),
            organic: shareOf(w.organic, w),
            newDirect: shareOf(n.direct, n),
            paidPerClick: c > 0 ? w.paid / c : null,
            pvPerUser: pvPerUser(weeksTraffic.get(w.monday)),
            pass: direct === null ? null : direct <= ACCEPT.weekMax,
          };
        })
      : days.map((d) => {
          const n = newByDate.get(d.date);
          const c = clicks.get(d.date) ?? 0;
          const direct = shareOf(d.direct, d);
          return {
            key: d.date,
            sessions: d.total,
            direct,
            paid: shareOf(d.paid, d),
            organic: shareOf(d.organic, d),
            newDirect: n ? shareOf(n.direct, n) : null,
            paidPerClick: c > 0 ? d.paid / c : null,
            pvPerUser: null,
            pass: !isWeekday(d.date) || direct === null ? null : direct <= ACCEPT.dayMax,
          };
        });

    const mix = sumMix(days, win.from, win.to);
    const newMix = sumMix(newDays, win.from, win.to);
    const windowClicks = sumClicks(clicks, win.from, win.to);
    const weekPv = windowWeeks.map((w) => pvPerUser(weeksTraffic.get(w.monday))).filter((v): v is number => v !== null);
    const totals = {
      direct: shareOf(mix.direct, mix),
      newDirect: shareOf(newMix.direct, newMix),
      paidPerClick: windowClicks > 0 ? mix.paid / windowClicks : null,
      pvPerUser: weekPv.length ? weekPv.reduce((a, b) => a + b, 0) / weekPv.length : null,
      fullWeeks: weekPv.length,
    };
    const truncated = [ch, nv, ad, tr, nb, ab].some((r) => r.truncated);
    return { rows, totals, base, truncated };
    // The held objects are rebuilt every render; their results are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.result, newVisitors.result, adsClicks.result, traffic.result, newBaseline.result, adsBaseline.result, derived, byWeek, win.from, win.to]);

  const health = derived?.health ?? null;
  const copy = health ? describeHealth(health) : null;
  const checksMet = health ? [health.daysInBand >= ACCEPT.weekdaysNeeded, health.weeksInBand, health.pvOk].filter(Boolean).length : 0;
  // Without GA4 every block would repeat the same panel; say it once and keep the HubSpot section.
  const allResult = all.result;
  const ga4Missing = allResult && allResult.state === "not-configured" ? allResult.missing : null;

  const xFormat = byWeek ? weekLabel : dayLabel;
  const markers = [{ x: byWeek ? mondayOf(INCIDENT_DATE) : INCIDENT_DATE, label: `Fault ${fault}` }];
  const rowLabel = (key: string) => (byWeek ? weekLabel(key) : `${weekdayOf(key)} ${dayLabel(key)}`);
  const holdsFault = (key: string) => (byWeek ? key <= INCIDENT_DATE && shiftIso(key, 6) >= INCIDENT_DATE : key === INCIDENT_DATE);

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
  const num = { ...cell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };
  const headers = [
    byWeek ? "Week" : "Day",
    "Sessions",
    "Direct",
    "Paid Search",
    "Organic",
    "New visitors → Direct",
    "Paid sessions / Ads click",
    ...(byWeek ? ["Page views / user"] : []),
    byWeek ? "Direct ≤ 31%" : "Direct ≤ 32%",
  ];

  return (
    <Box>
      {ga4Missing ? (
        <Box sx={{ mb: 2.5 }}>
          <NotConnectedPanel source="Google Analytics 4" missing={ga4Missing} />
        </Box>
      ) : (
        <>
          {/* 1 — the acceptance test, always on the latest data */}
          <Section sx={{ mb: 3.5 }}>
            <Gate held={all} source="Google Analytics 4" loadingLabel="Running the consent-fix test…" onRetry={retry}>
              {(_d, stale) =>
                health && copy ? (
                  <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 2.25 }}>
                      <Box sx={{ minWidth: 0, maxWidth: 820 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
                          <HealthChip tone={copy.tone} label={copy.label} />
                          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Consent-fix test · data through {dayLabel(span.to)}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                          {LEAD[health.state]}
                        </Typography>
                        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>
                          The fix counts as passed when all three checks are met. The test always reads the latest data, so the reporting
                          window does not change it.
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontSize: "2rem", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em", color: INK }}>
                          {checksMet} of 3
                        </Typography>
                        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>checks met</Typography>
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <TestCard
                          pass={health.daysInBand >= ACCEPT.weekdaysNeeded}
                          title="Direct share on weekdays"
                          result={`${health.daysInBand} of ${health.days.length}`}
                          rule="Needs Direct at or under 32% of sessions on at least 9 of the last 10 weekdays."
                        >
                          <WeekdayColumns days={health.days} />
                        </TestCard>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <TestCard
                          pass={health.weeksInBand}
                          title="Direct share per full week"
                          result={`${health.weeks.filter((w) => w.inBand).length} of ${health.weeks.length}`}
                          rule={`Needs 31% or less in both of the last two full weeks. Before the fault it was ${percent(health.baselineDirect)}.`}
                        >
                          <WeekBars weeks={health.weeks} />
                        </TestCard>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <TestCard
                          pass={health.pvOk}
                          title="Page views per user, largest change"
                          result={signedPercent(health.worstPvChange)}
                          rule={`Needs both weeks within ±8% of the ${decimal(health.baselinePvPerUser)} before the fault. A jump would mean double counting.`}
                        >
                          <PvBand weeks={health.weeks} baseline={health.baselinePvPerUser} />
                        </TestCard>
                      </Grid>
                    </Grid>
                    {derived?.truncated && (
                      <Typography sx={{ fontSize: "0.74rem", color: TONE.bad.fg, mt: 1.5 }}>
                        GA4 capped at least one report at its row limit, so the test rests on partial rows.
                      </Typography>
                    )}
                  </Box>
                ) : null
              }
            </Gate>
          </Section>

          {/* 2 — the reporting window against the eight weeks before the fault */}
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 1.75 }}>
            <Typography component="h2" sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
              {windowName}
              {win.preset !== "custom" && (
                <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}>
                  {" "}
                  · {dayLabel(win.from)} – {dayLabel(win.to)}
                </Box>
              )}
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
              {byWeek ? "By full week" : "By day"}, against the 8 weeks before the fault ({baselineLabel})
            </Typography>
          </Box>

          <Gate held={windowHeld} source="Google Analytics 4" loadingLabel="Reading the reporting window…" onRetry={retry}>
            {(_d, stale) => {
              if (!view) return null;
              const { rows, totals, base } = view;
              const trend = (pick: (r: Row) => number | null) => rows.map(pick);
              const directPts = rows.map((r) => ({ x: r.key, value: r.direct, compare: base.direct }));
              const clickPts = rows.map((r) => ({ x: r.key, value: r.paidPerClick, compare: base.paidPerClick }));
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <Grid container spacing={2} sx={{ mb: 2.5 }}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile label="Direct share" value={percent(totals.direct)} note={`Before the fault ${percent(base.direct)}`} trend={trend((r) => r.direct)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile
                        label="New visitors arriving as Direct"
                        value={percent(totals.newDirect)}
                        note={`Before the fault ${percent(base.newDirect)} · moves most with the fault`}
                        trend={trend((r) => r.newDirect)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile
                        label="Paid Search sessions per Ads click"
                        value={decimal(totals.paidPerClick)}
                        note={`Before the fault ${decimal(base.paidPerClick)}`}
                        trend={trend((r) => r.paidPerClick)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile
                        label="Page views per user"
                        value={decimal(totals.pvPerUser)}
                        note={
                          totals.fullWeeks > 0
                            ? `Before the fault ${decimal(base.pvPerUser)} · ${totals.fullWeeks} full week${totals.fullWeeks === 1 ? "" : "s"}`
                            : "Needs a full week inside the window"
                        }
                        trend={byWeek ? trend((r) => r.pvPerUser) : undefined}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                      <Section sx={{ height: "100%" }}>
                        <ChartFrame
                          title={`Direct share of sessions, ${byWeek ? "by week" : "by day"}`}
                          caption={
                            byWeek
                              ? "The dashed line is the pass limit of 31% a week; grey is the level before the fault."
                              : "The dashed line is the pass limit of 32% (weekends do not count); grey is the level before the fault."
                          }
                          stale={stale}
                          empty={directPts.length < 2 ? (byWeek ? "The window holds fewer than two full weeks." : "GA4 returned fewer than two days.") : null}
                          table={{
                            columns: [byWeek ? "Week" : "Day", "Direct share", "Before the fault"],
                            numeric: [1, 2],
                            rows: rows.map((r) => [rowLabel(r.key), percent(r.direct), percent(base.direct)]),
                          }}
                        >
                          <TrendChart
                            data={directPts}
                            seriesLabel="Direct share"
                            compareLabel="Before the fault"
                            height={240}
                            format={(v) => percent(v)}
                            tickFormat={(v) => percent(v, 0)}
                            xFormat={xFormat}
                            markers={markers}
                            threshold={{ value: byWeek ? ACCEPT.weekMax : ACCEPT.dayMax, label: byWeek ? "31% limit" : "32% limit" }}
                          />
                        </ChartFrame>
                      </Section>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                      <Section sx={{ height: "100%" }}>
                        <ChartFrame
                          title="Paid Search sessions per Google Ads click"
                          caption="Ads clicks do not depend on consent, so a lower ratio means GA4 is losing paid sessions, not that ads stopped working."
                          stale={stale}
                          empty={clickPts.filter((p) => p.value !== null).length < 2 ? "Fewer than two points with Ads clicks in the window." : null}
                          table={{
                            columns: [byWeek ? "Week" : "Day", "Sessions per click", "Before the fault"],
                            numeric: [1, 2],
                            rows: rows.map((r) => [rowLabel(r.key), decimal(r.paidPerClick), decimal(base.paidPerClick)]),
                          }}
                        >
                          <TrendChart
                            data={clickPts}
                            seriesLabel="Sessions per click"
                            compareLabel="Before the fault"
                            height={240}
                            format={(v) => decimal(v)}
                            xFormat={xFormat}
                            markers={markers}
                          />
                        </ChartFrame>
                      </Section>
                    </Grid>
                  </Grid>

                  <Section sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.25 }}>{byWeek ? "Week by week" : "Day by day"}</Typography>
                    {rows.length === 0 ? (
                      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                        {byWeek ? "The window holds no full week." : "GA4 returned no days for this window."}
                      </Typography>
                    ) : (
                      <Box sx={{ overflow: "auto", maxHeight: 460 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {headers.map((h, i) => (
                                <TableCell key={h} sx={{ ...(i === 0 ? cell : num), fontWeight: 600, color: MUTED, bgcolor: "#fff" }}>
                                  {h}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {[...rows].reverse().map((r) => (
                              <TableRow key={r.key}>
                                <TableCell sx={{ ...cell, color: INK, fontWeight: 600 }}>
                                  {rowLabel(r.key)}
                                  {holdsFault(r.key) && (
                                    <Chip
                                      label={`fault ${fault}`}
                                      size="small"
                                      sx={{ ml: 1, height: 18, fontSize: "0.64rem", bgcolor: TONE.bad.bg, color: TONE.bad.fg }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell sx={num}>{full(r.sessions)}</TableCell>
                                <TableCell sx={{ ...num, color: INK, fontWeight: 600 }}>{percent(r.direct)}</TableCell>
                                <TableCell sx={num}>{percent(r.paid)}</TableCell>
                                <TableCell sx={num}>{percent(r.organic)}</TableCell>
                                <TableCell sx={num}>{percent(r.newDirect)}</TableCell>
                                <TableCell sx={num}>{decimal(r.paidPerClick)}</TableCell>
                                {byWeek && <TableCell sx={num}>{decimal(r.pvPerUser)}</TableCell>}
                                <TableCell
                                  sx={{ ...num, fontWeight: 600, color: r.pass === null ? MUTED : r.pass ? TONE.good.fg : TONE.bad.fg }}
                                >
                                  {r.pass === null ? (byWeek ? "—" : "weekend") : r.pass ? "Yes" : "No"}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: "#f7f8fa" }}>
                              <TableCell sx={{ ...cell, color: MUTED, fontWeight: 600 }}>Before the fault, per {byWeek ? "week" : "day"}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED }}>{full(Math.round(byWeek ? base.sessionsPerWeek : base.sessionsPerDay))}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED, fontWeight: 600 }}>{percent(base.direct)}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED }}>{percent(base.paid)}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED }}>{percent(base.organic)}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED }}>{percent(base.newDirect)}</TableCell>
                              <TableCell sx={{ ...num, color: MUTED }}>{decimal(base.paidPerClick)}</TableCell>
                              {byWeek && <TableCell sx={{ ...num, color: MUTED }}>{decimal(base.pvPerUser)}</TableCell>}
                              <TableCell sx={{ ...num, color: MUTED }}>—</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                    {view.truncated && (
                      <Typography sx={{ fontSize: "0.74rem", color: TONE.bad.fg, mt: 1.5 }}>
                        GA4 capped at least one report at its row limit, so these figures rest on partial rows.
                      </Typography>
                    )}
                  </Section>
                </Box>
              );
            }}
          </Gate>
        </>
      )}

      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.5 }}>Click ids captured in HubSpot</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
          Written by the shop tag straight to HubSpot, whatever GA4 does with the channel. All time, not the window.
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
        GA4 sessions by default channel group per day (all visitors and new visitors only), Google Ads clicks imported into GA4 per day
        (summed over campaigns; only the Ads accounts linked to the property, so sessions per click is read against its own level before
        the fault, not as a click-to-session rate), and users and page views per ISO week. The test: Direct at or under 32% on 9 of the
        last 10 weekdays, at or under 31% in each of the last two full weeks, and page views per user within ±8% of {baselineLabel}, on
        data through {span.to}. GA4 can still be processing the most recent day, and it does not re-attribute sessions it has already
        recorded, so days between {fault} and the fix stay as recorded. The same verdict sits above the Paid Search counters on{" "}
        <Link href="/analytics/smec" style={{ color: "#1b4a80" }}>
          SMEC targets
        </Link>
        . Click-id counts from HubSpot.
      </SourceNote>
    </Box>
  );
}
