"use client";

// SMEC TARGETS — the agency KPIs against their 2026 goals. This sub-app is
// deliberately pinned to the 2026 year-to-date (targets are annual), so the
// hub-wide window picker does not apply here and the header says so. Live
// figures appear only where GA4 or HubSpot genuinely measures them; every
// other target states plainly where its number lives instead.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useState } from "react";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote, SubAppHead } from "../Shell";
import { metricOf, useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { compact, full, percent } from "@/app/charts/format";
import { SMEC_TARGETS, SMEC_YEAR } from "./targets";

type GclidStatus = { gclidContacts: number | null; consentContacts: number | null };

function ytdRange(): { from: string; to: string; elapsed: number } {
  const now = new Date();
  const from = `${SMEC_YEAR}-01-01`;
  const to = now.toISOString().slice(0, 10);
  const start = Date.UTC(SMEC_YEAR, 0, 1);
  const end = Date.UTC(SMEC_YEAR + 1, 0, 1);
  const elapsed = Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
  return { from, to, elapsed };
}

/** Ahead/behind the straight-line pace toward an annual goal. */
function paceLabel(actual: number | null, goal: number, elapsed: number): { text: string; tone: "ahead" | "behind" | "flat" } {
  if (actual === null || elapsed <= 0) return { text: "no pace yet", tone: "flat" };
  const expected = goal * elapsed;
  if (expected <= 0) return { text: "no pace yet", tone: "flat" };
  const ratio = actual / expected;
  if (ratio >= 1) return { text: `${percent(ratio - 1)} ahead of pace`, tone: "ahead" };
  return { text: `${percent(1 - ratio)} behind pace`, tone: "behind" };
}

const TONE_STYLE: Record<"ahead" | "behind" | "flat", { bg: string; fg: string }> = {
  ahead: { bg: "#e5f3ea", fg: "#155d33" },
  behind: { bg: "#fdf3f2", fg: "#9e1b18" },
  flat: { bg: "#eef0f3", fg: "#3c4043" },
};

export default function SmecTargetsPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { from, to, elapsed } = ytdRange();
  const q = `from=${from}&to=${to}`;

  const signups = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=keyEventsByName&${q}`, [q, tick]);
  const revenue = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=revenueTotals&${q}`, [q, tick]);
  const channels = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=acquisitionChannels&${q}`, [q, tick]);
  const gclid = useHeld<GclidStatus>(`/api/integrations/hubspot?report=gclidStatus`, [tick]);

  const signupGoal = SMEC_TARGETS.find((t) => t.measure === "signups")?.goalValue ?? null;
  const revenueGoal = SMEC_TARGETS.find((t) => t.measure === "revenue")?.goalValue ?? null;

  return (
    <Box>
      <SubAppHead
        title="SMEC targets"
        purpose="The agency KPIs from KPIs_SMEC_2026 against their 2026 goals — live where this hub can honestly measure them, and plainly sourced where it cannot."
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Chip
          label={`${SMEC_YEAR} year-to-date · Jan 1 → ${to} · ${percent(elapsed)} of the year gone`}
          size="small"
          sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
        />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
          Targets are annual, so this page ignores the hub-wide window on purpose.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={signups} source="Google Analytics 4" loadingLabel="Counting sign-ups…" onRetry={retry}>
            {(report, stale) => {
              const get = metricOf(report, "keyEvents");
              const row = report.rows.find((r) => r.keys[0] === "sign_up") ?? null;
              const value = row ? get(row) : null;
              const pace = signupGoal ? paceLabel(value, signupGoal, elapsed) : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile
                    label="Sign-ups YTD"
                    value={value === null ? "—" : full(value)}
                    note={
                      value === null
                        ? "No sign_up key event returned for the year so far"
                        : `Goal ${full(signupGoal)} · ${pace?.text ?? ""}`
                    }
                  />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={revenue} source="Google Analytics 4" loadingLabel="Summing revenue…" onRetry={retry}>
            {(report, stale) => {
              const row = report.rows[0] ?? null;
              const value = row ? metricOf(report, "totalRevenue")(row) : null;
              const tx = row ? metricOf(report, "transactions")(row) : null;
              const pace = revenueGoal ? paceLabel(value, revenueGoal, elapsed) : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile
                    label="Webshop revenue YTD"
                    value={compact(value)}
                    note={
                      value === null
                        ? "GA4 returned no revenue for the year so far"
                        : `Goal ${compact(revenueGoal)} · ${pace?.text ?? ""} · ${compact(tx)} transactions`
                    }
                  />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={channels} source="Google Analytics 4" loadingLabel="Reading SEA share…" onRetry={retry}>
            {(report, stale) => {
              const sess = metricOf(report, "sessions");
              const kev = metricOf(report, "keyEvents");
              const paid = report.rows.find((r) => r.keys[0] === "Paid Search") ?? null;
              let totalKev = 0;
              let any = false;
              for (const r of report.rows) {
                const v = kev(r);
                if (v !== null) {
                  totalKev += v;
                  any = true;
                }
              }
              const share = paid && any && totalKev > 0 ? (kev(paid) ?? 0) / totalKev : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile
                    label="Paid Search share YTD"
                    value={percent(share)}
                    note={
                      paid
                        ? `${compact(sess(paid))} paid sessions · share of all key events`
                        : "GA4 returned no Paid Search channel row"
                    }
                  />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={gclid} source="HubSpot" loadingLabel="Checking gclid capture…" onRetry={retry}>
            {(data, stale) => (
              <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                <StatTile
                  label="Contacts carrying a gclid"
                  value={data.gclidContacts === null ? "—" : full(data.gclidContacts)}
                  note={
                    (data.gclidContacts ?? 0) > 0
                      ? `Google Ads click ids captured · ${full(data.consentContacts)} with consent flags`
                      : "0 — the HubSpot properties are ready; the GTM tag is not live yet"
                  }
                />
              </Box>
            )}
          </Gate>
        </Grid>
      </Grid>

      {(["Acquisition", "Retention & Reactivation", "Revenue"] as const).map((area) => (
        <Section key={area} sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.25 }}>{area}</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.82rem" } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>KPI</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Baseline 2025</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Goal 2026</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Live here</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SMEC_TARGETS.filter((t) => t.area === area).map((t) => {
                  let live: { value: string; pace?: ReturnType<typeof paceLabel> } | null = null;
                  if (t.measure === "signups" && signups.result?.state === "ok") {
                    const rep = signups.result.data;
                    const row = rep.rows.find((r) => r.keys[0] === "sign_up") ?? null;
                    const v = row ? metricOf(rep, "keyEvents")(row) : null;
                    live = { value: v === null ? "—" : `${full(v)} YTD`, pace: t.goalValue ? paceLabel(v, t.goalValue, elapsed) : undefined };
                  }
                  if (t.measure === "revenue" && revenue.result?.state === "ok") {
                    const rep = revenue.result.data;
                    const row = rep.rows[0] ?? null;
                    const v = row ? metricOf(rep, "totalRevenue")(row) : null;
                    live = { value: v === null ? "—" : `${compact(v)} YTD`, pace: t.goalValue ? paceLabel(v, t.goalValue, elapsed) : undefined };
                  }
                  return (
                    <TableRow key={t.kpi}>
                      <TableCell sx={{ fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{t.kpi}</TableCell>
                      <TableCell sx={{ color: INK, whiteSpace: "nowrap" }}>{t.baseline}</TableCell>
                      <TableCell sx={{ color: INK }}>{t.goal}</TableCell>
                      <TableCell>
                        {live ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{live.value}</Typography>
                            {live.pace && (
                              <Chip
                                label={live.pace.text}
                                size="small"
                                sx={{ height: 19, fontSize: "0.66rem", bgcolor: TONE_STYLE[live.pace.tone].bg, color: TONE_STYLE[live.pace.tone].fg }}
                              />
                            )}
                            {t.note && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{t.note}</Typography>}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.unavailable ?? "—"}</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Section>
      ))}

      <SourceNote>
        Targets transcribed from KPIs_SMEC_2026.xlsx (sheet “SMEC Targets”). Live figures: GA4 key events, revenue and
        channel splits for {from} → {to}; HubSpot counts of contacts carrying the gclid / consent properties. Pace compares
        year-to-date actuals with the straight-line share of the annual goal ({percent(elapsed)} of the year). Where a
        number lives in Google Ads or Compass, the row says so instead of estimating.
      </SourceNote>
    </Box>
  );
}
