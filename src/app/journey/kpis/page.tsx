"use client";

// THE KPI SCREEN.
//
// Alexandre asked four questions: what are the conversion rates from one step to
// the next, where do we lose prospects, where do we lose customers, and what is
// working. This screen answers them in that order, and is explicit about the one
// place a percentage would be a lie.
//
// It composes three endpoints the journey already has — the GA4 steps, the
// lifecycle counts and the ERP figures — rather than adding a fourth: every
// number here is the same number the board shows, so nobody has to reconcile two
// screens.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import PageHeader from "@/app/PageHeader";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { compact, full, percent, signedPercent } from "@/app/charts/format";
import { useReportingWindow, WindowPicker, windowQuery } from "@/app/window/ReportingWindow";
import type { JourneyMetrics } from "@/lib/journey/metrics";
import type { JourneyBusiness } from "@/lib/journey/business";
import type { JourneyFunnels } from "@/lib/journey/funnels";

const GOOD = "#1d7f45";
const BAD = "#9e1b18";

/** The five reports the business asked for, in its own words (sheet "KPIsNeeded"). */
const ASKED_FOR = [
  "MQL → SQL → Lost Lead: as a funnel, to show what share of companies end up in Lost Lead.",
  "MQL → SQL → New Customer → New Customer Lost: the linear path, for conversion and drop-off.",
  "New Customer Lost → Not Reactivated: a customer who bought once and never came back.",
  "Churn/Reactivate → Not Reactivated: the danger zone — these are essentially lost.",
  "Not Reactivated → Reactivated: how many make it back.",
];

/** Measures nothing here can answer yet. Named, because a named gap gets closed. */
const GAPS: { measure: string; why: string }[] = [
  { measure: "Which pages a given contact read", why: "HubSpot's events API needs Marketing Hub Enterprise. Our own tag could do it — the shop session identifies the logged-in customer, and Performis counts views and logins per customer number. What is missing is the decision to keep that history against a person, and the consent basis for it." },
  { measure: "Brand recognition, AI/LLM visibility", why: "Comes from Miriam's study and Aleksandra's competitor work, not from a system we can query." },
  { measure: "Stock at the moment a customer looked", why: "The shop reads stock from the ERP as the page renders and keeps no history of what was shown." },
  { measure: "Abandoned registration (started, not finished)", why: "The shop emits no event for it." },
  { measure: "Time on product pages, datasheet downloads", why: "Neither is tracked as a GA4 event today. Both are a tag change, not a platform limit." },
  { measure: "Reactivation attributed to a channel", why: "Needs the three bucket conversions live in the Ads account; waiting on smec's labels." },
];

export default function JourneyKpisPage() {
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [business, setBusiness] = useState<JourneyBusiness | null>(null);
  const [counts, setCounts] = useState<JourneyFunnels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { window: reportingWindow } = useReportingWindow();

  useEffect(() => {
    const ctrl = new AbortController();
    const q = windowQuery(reportingWindow);
    setMetrics(null);
    setBusiness(null);
    setCounts(null);
    setError(null);
    const read = <T,>(path: string, set: (v: T) => void) =>
      fetch(`${path}?${q}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && j.data) set(j.data as T);
          else if (j?.error) setError(j.error as string);
        })
        .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    read<JourneyMetrics>("/api/journey/metrics", setMetrics);
    read<JourneyBusiness>("/api/journey/business", setBusiness);
    read<JourneyFunnels>("/api/journey/funnels", setCounts);
    return () => ctrl.abort();
  }, [reportingWindow]);

  // ── 1. the shop funnel, where a conversion rate is a real proportion ──
  const first = metrics?.funnel[0]?.value ?? null;
  const funnelRows = (metrics?.funnel ?? []).map((step, i, all) => {
    const before = i === 0 ? null : all[i - 1].value;
    const share = step.value != null && before ? step.value / before : null;
    return { ...step, share, ofAll: step.value != null && first ? step.value / first : null };
  });
  // Where we lose most people: the step with the worst survival, ignoring the first.
  const worst = funnelRows
    .slice(1)
    .filter((r) => r.share != null)
    .sort((a, b) => (a.share as number) - (b.share as number))[0] ?? null;
  const worstFrom = worst ? funnelRows[funnelRows.indexOf(worst) - 1] : null;

  // ── 2. the commercial funnel, in the shape the group slide uses ──
  const enteredStage = (needle: RegExp): number | null => {
    for (const funnel of counts?.funnels ?? []) {
      const hit = funnel.path.find((s) => needle.test(s.label));
      if (hit?.entered != null) return hit.entered;
    }
    return null;
  };
  const figure = (key: string) => business?.headline.find((h) => h.key === key) ?? null;
  const revenue = figure("erp_revenue");
  const newCustomers = figure("erp_new_customers");
  const cameBack = figure("erp_reactivated");
  const orders = metrics?.steps.find((s) => s.stepIndex === 9) ?? null;

  const commercial: { label: string; value: string; basis: string; change: number | null }[] = [
    { label: "Leads", value: full(enteredStage(/^mql/i)), basis: "companies that entered MQL in the window", change: null },
    { label: "Opportunities", value: full(enteredStage(/^sql/i)), basis: "companies that entered SQL in the window", change: null },
    { label: "Orders", value: full(orders?.value ?? null), basis: "visits that ended in a purchase, GA4", change: null },
    {
      label: "Revenue", value: revenue?.value != null ? `€${compact(revenue.value)}` : "—",
      basis: revenue ? `invoiced, ${revenue.months}` : "ERP", change: revenue?.change ?? null,
    },
    {
      label: "New customers", value: full(newCustomers?.value ?? null),
      basis: newCustomers ? `first ever order, ${newCustomers.months}` : "ERP", change: newCustomers?.change ?? null,
    },
  ];

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <PageHeader title="KPIs" subtitle="Where they arrive, where we lose them, and what came of it" />

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <WindowPicker />
        {metrics && <Chip size="small" label={`${metrics.from} to ${metrics.to}`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />}
        {error && <Typography sx={{ fontSize: "0.78rem", color: BAD }}>{error}</Typography>}
      </Box>

      {/* 1 ── conversion, step to step */}
      <Section>
        <ChartFrame
          title="From arriving to buying"
          caption={
            metrics
              ? `Visits in which each step happened, ${metrics.from} to ${metrics.to}. Every step is the same unit, so each percentage is a real share of the step above it.`
              : "Reading the steps from GA4…"
          }
          empty={metrics && funnelRows.every((r) => r.value == null) ? "GA4 returned no events for this window." : null}
          table={{
            columns: ["Step", "Visits", "Of the step before", "Of all visits"],
            rows: funnelRows.map((r) => [r.label, r.value ?? "—", percent(r.share), percent(r.ofAll)]),
            numeric: [1, 2, 3],
          }}
        >
          <BarList
            rows={funnelRows.map((r, i) => ({
              label: r.label,
              value: r.value,
              secondary: i === 0 ? "every visit" : `${percent(r.share)} of the step before · ${percent(r.ofAll)} of all visits`,
            }))}
            format={full}
            labelWidth={200}
            maxLabel={30}
          />
        </ChartFrame>

        {worst && worstFrom && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: BAD, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Where we lose most of them
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: INK, mt: 0.5 }}>
              Between <strong>{worstFrom.label}</strong> and <strong>{worst.label}</strong>: only{" "}
              <strong>{percent(worst.share)}</strong> get through, so{" "}
              <strong>{full((worstFrom.value ?? 0) - (worst.value ?? 0))}</strong> visits stop there.
            </Typography>
          </Box>
        )}
      </Section>

      {/* 2 ── the commercial funnel */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>The commercial funnel</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>
          The shape the group uses — leads, opportunities, orders, revenue, new customers. Each row states what it counts and
          over which window, because they do not all use the same one: the lifecycle counts follow the picker exactly, and the
          ERP figures can only move a whole month at a time.
        </Typography>
        <Box sx={{ display: "grid", gap: 1 }}>
          {commercial.map((row) => (
            <Box key={row.label} sx={{ display: "flex", gap: 1.5, alignItems: "baseline", py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{row.label}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{row.basis}</Typography>
              </Box>
              {row.change != null && (
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: row.change > 0 ? GOOD : BAD }}>
                  {signedPercent(row.change)}
                </Typography>
              )}
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", minWidth: 96, textAlign: "right" }}>
                {row.value}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.5 }}>
          <strong style={{ color: INK }}>No percentage between these rows.</strong> A company entering SQL this quarter may have
          become an MQL two years ago, and the orders are visits while the new customers are companies. Dividing one by the next
          would produce a number that looks like a conversion rate and is not one. The percentages above, inside the shop funnel,
          are real: those five steps are the same visits, narrowing.
        </Typography>
      </Section>

      {/* 3 ── new or returning */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>New, or coming back</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>
          Alexandre&apos;s first question. These are companies, counted from our own orders — not lifecycle labels somebody set.
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
          {[newCustomers, cameBack, revenue].filter(Boolean).map((f) => (
            <Box key={f!.key} sx={{ p: 1.75, borderRadius: 2, border: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600 }}>{f!.label}</Typography>
              <Typography sx={{ fontSize: "1.7rem", fontWeight: 700, color: INK, lineHeight: 1.2, mt: 0.25 }}>
                {f!.unit === "eur" ? (f!.value == null ? "—" : `€${compact(f!.value)}`) : full(f!.value)}
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: f!.change == null ? MUTED : f!.change > 0 ? GOOD : BAD }}>
                {signedPercent(f!.change)} · {f!.months}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.5, lineHeight: 1.4 }}>{f!.note}</Typography>
            </Box>
          ))}
        </Box>
        {business && (
          <Typography sx={{ fontSize: "0.88rem", color: INK, mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            {business.verdict}
          </Typography>
        )}
      </Section>

      {/* 4 ── the five reports asked for */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>The five reports asked for</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 1.5 }}>
          From the workbook, in the words they were written in. All five are lifecycle paths, so they are counted on{" "}
          <Link href="/journey/funnels" style={{ color: "#1b4a80", fontWeight: 600 }}>Lifecycle funnels</Link>, where each stage
          shows how many companies sit in it and how many arrived.
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75 }}>
          {ASKED_FOR.map((line) => (
            <Typography key={line} component="li" sx={{ fontSize: "0.85rem", color: INK, lineHeight: 1.5 }}>{line}</Typography>
          ))}
        </Box>
      </Section>

      {/* 5 ── the honest list */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>What nothing here can answer yet</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 1.5 }}>
          Each one is a decision or a tag change, not a mystery. This list is the work.
        </Typography>
        <Box sx={{ display: "grid", gap: 1 }}>
          {GAPS.map((gap) => (
            <Box key={gap.measure} sx={{ py: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK }}>{gap.measure}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{gap.why}</Typography>
            </Box>
          ))}
        </Box>
      </Section>
    </Box>
  );
}
