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
import PageHeader from "@/app/PageHeader";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { compact, full, percent, signedPercent } from "@/app/charts/format";
import { useReportingWindow, WindowPicker, windowQuery, windowSentence } from "@/app/window/ReportingWindow";
import type { JourneyMetrics } from "@/lib/journey/metrics";
import type { JourneyBusiness } from "@/lib/journey/business";
import type { JourneyFunnels } from "@/lib/journey/funnels";
import type { SalesPotential } from "@/lib/journey/salesPotential";

const GOOD = "#1d7f45";
const BAD = "#9e1b18";

/** Measures nothing here can answer yet. Named, because a named gap gets closed. */
/**
 * Things we could measure and have not wired yet. They are NOT platform limits:
 * each one is a tag change or a decision, which is why they are listed apart
 * from the real gaps — a list that mixes "impossible" with "nobody has done it"
 * teaches people to stop reading it.
 */
const POSSIBLE: { measure: string; how: string }[] = [
  {
    measure: "Which pages a given customer read",
    how: "Our own Google tag already does this in the other apps, and the shop session identifies the logged-in customer — that is how the Ads buyer-bucket lookup knows who is ordering. Performis also counts views and logins per customer number. What is missing is the decision to keep the history against a person, and the consent basis for it.",
  },
  {
    measure: "Stock and MOQ at the moment a customer looked",
    how: "When a customer opens an article we can ask HubSpot for that article's stock and minimum order quantity on Products & Pricing and record what was true at that moment. The shop renders stock from the ERP and keeps no history; this would be our own record, not the shop's.",
  },
  {
    measure: "Time on product pages, datasheet downloads",
    how: "Neither is a GA4 event today. Both are a tag change in GTM, not a platform limit.",
  },
];

/** Measures nothing here can answer yet, for a reason outside our control. */
const GAPS: { measure: string; why: string }[] = [
  { measure: "Abandoned registration (started, not finished)", why: "The shop emits no event for it, and it is the shop's form rather than ours." },
];

export default function JourneyKpisPage() {
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [business, setBusiness] = useState<JourneyBusiness | null>(null);
  const [counts, setCounts] = useState<JourneyFunnels | null>(null);
  const [potential, setPotential] = useState<SalesPotential | null>(null);
  const [potentialProgress, setPotentialProgress] = useState<string | null>(null);
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

    // The ticket potential is a background report - a quarter is around ten
    // thousand rows - so poll it until it lands rather than blocking the page.
    setPotential(null);
    setPotentialProgress("starting");
    let tries = 0;
    const pollPotential = () => {
      fetch(`/api/journey/potential?${q}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => {
          if (j?.value) { setPotential(j.value as SalesPotential); setPotentialProgress(null); return; }
          if (j?.error) { setPotentialProgress(String(j.error)); return; }
          setPotentialProgress(j?.progress ? String(j.progress) : "counting");
          if (j?.computing && tries++ < 40) setTimeout(pollPotential, 3000);
        })
        .catch((e) => { if ((e as Error)?.name !== "AbortError") setPotentialProgress(String(e)); });
    };
    pollPotential();
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

  const intake = figure("erp_order_intake");
  const bookToBill = figure("erp_book_to_bill");
  const leads = enteredStage(/^mql/i);
  const opportunities = enteredStage(/^sql/i);

  const commercial: { label: string; value: string; basis: string; change: number | null; ratio?: string }[] = [
    { label: "Leads", value: full(leads), basis: "companies that entered MQL in the window", change: null },
    {
      label: "Opportunities", value: full(opportunities), basis: "companies that entered SQL in the window", change: null,
      // Asked for explicitly. It is a ratio of two flows through the SAME
      // window, not a cohort rate — the caption under the table says so, and
      // the label here says "of leads in this window" rather than "conversion".
      ratio: leads && opportunities != null ? `${percent(opportunities / leads)} of leads in this window` : undefined,
    },
    {
      label: "Orders", value: full(orders?.value ?? null), basis: "visits that ended in a purchase, GA4", change: null,
      ratio: opportunities && orders?.value != null ? `${percent(orders.value / opportunities)} of opportunities in this window` : undefined,
    },
    {
      label: "Revenue", value: revenue?.value != null ? `€${compact(revenue.value)}` : "—",
      basis: revenue ? `invoiced, ${revenue.months}` : "ERP", change: revenue?.change ?? null,
    },
    {
      label: "Order intake", value: intake?.value != null ? `€${compact(intake.value)}` : "—",
      basis: intake ? `ordered, net of cancellations, ${intake.months}` : "ERP", change: intake?.change ?? null,
      ratio: bookToBill?.value != null ? `${percent(bookToBill.value)} book-to-bill — ordered against invoiced` : undefined,
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
        {/* The preset AND its dates: the dates are the picker's choice, not
            this screen's, and saying only the dates invites "why these?". */}
        <Chip size="small" label={windowSentence(reportingWindow)} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
          Set by the picker beside it, and remembered in this browser. Up to 365 days.
        </Typography>
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
                {row.ratio && (
                  <Typography sx={{ fontSize: "0.74rem", color: "#1b4a80", fontWeight: 600 }}>{row.ratio}</Typography>
                )}
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
          <strong style={{ color: INK }}>Read the blue ratios carefully.</strong> They divide two flows through the same window,
          which is useful for watching a trend and is <em>not</em> a conversion rate: a company entering SQL this quarter may have
          become an MQL two years ago, and the orders are visits while the new customers are companies. The percentages in the shop
          funnel above are conversion rates — those five steps are the same visits, narrowing.
        </Typography>
      </Section>

      {/* 3 ── new or returning */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>New, or coming back</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>
          Companies, counted from our own orders — not from a lifecycle label somebody set.
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
        {/* Asked for as a KPI rather than a footnote: it is the number that
            would tell us whether paid media brings customers BACK, and it has a
            named blocker rather than a technical one. */}
        <Box sx={{ mt: 2, p: 1.75, borderRadius: 2, border: `1px dashed ${HAIRLINE}`, bgcolor: "#fbfcfe" }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: INK }}>
              Reactivations attributed to a channel
            </Typography>
            <Chip size="small" label="waiting on smec" sx={{ bgcolor: "#fdf4e3", color: "#7a5b12", fontWeight: 700, fontSize: "0.68rem" }} />
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5, lineHeight: 1.5 }}>
            We can already tell a new buyer from a returning one at the moment of purchase — the gateway resolves the bucket and the
            tag carries it. What is missing is the three bucket conversion actions in the Ads account, which need the labels from
            smec. Until they exist, {cameBack?.value != null ? full(cameBack.value) : "the"} companies that came back are counted
            here but cannot be credited to the campaign that brought them.
          </Typography>
        </Box>

        {business && (
          <Typography sx={{ fontSize: "0.88rem", color: INK, mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            {business.verdict}
          </Typography>
        )}
      </Section>

      {/* 4 ── the potential sitting in tickets */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>Sales potential in tickets</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>
          Every ticket carries a potential value. This is what was raised and what was won in this window, by pipeline —
          the enquiries that came in and never turned into an order are the difference between this page and the revenue above.
        </Typography>
        {!potential ? (
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
            {potentialProgress ? `Counting — ${potentialProgress}. A quarter is around ten thousand ticket rows.` : "Counting…"}
          </Typography>
        ) : potential.pipelines.length === 0 ? (
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No ticket rows in this window.</Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 1 }}>
            {potential.pipelines.map((row) => (
              <Box key={row.pipeline} sx={{ py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, minWidth: 54 }}>{row.pipeline}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, flexGrow: 1 }}>
                    {full(row.ticketsRaised)} raised · {full(row.ticketsClosed)} closed
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                    potential raised{" "}
                    <strong style={{ color: INK }}>{row.potentialRaised == null ? "—" : `€${compact(row.potentialRaised)}`}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                    won <strong style={{ color: GOOD }}>{row.potentialWon == null ? "—" : `€${compact(row.potentialWon)}`}</strong>
                  </Typography>
                </Box>
                {row.incomplete && (
                  <Typography sx={{ fontSize: "0.72rem", color: BAD, mt: 0.4 }}>Not summed: {row.incomplete}</Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

        {potential && potential.open.length > 0 && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Still open, as of {potential.openAsOf}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 0.75 }}>
              {potential.open.map((o) => (
                <Typography key={o.pipeline} sx={{ fontSize: "0.9rem", color: INK }}>
                  {o.pipeline} <strong>€{compact(o.value)}</strong>
                </Typography>
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75 }}>
              This snapshot is dated because it is not necessarily last night&apos;s — check it against the date above before quoting it.
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 2 }}>
          <strong style={{ color: INK }}>Raised minus won is not &ldquo;lost&rdquo;.</strong> They are two flows through the same
          window: a ticket raised in July may be won in October, and one won in July was probably raised in May. The figure that
          answers &ldquo;came in and never converted&rdquo; is the open snapshot above, not a subtraction.
        </Typography>
      </Section>

      {/* 5 ── the honest list, in two halves */}
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>Measurable, not yet wired</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 1.5 }}>
          Each of these is a tag change or a decision, not a platform limit. They are listed apart from the real gaps on purpose.
        </Typography>
        <Box sx={{ display: "grid", gap: 1, mb: 3 }}>
          {POSSIBLE.map((item) => (
            <Box key={item.measure} sx={{ py: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK }}>{item.measure}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{item.how}</Typography>
            </Box>
          ))}
        </Box>

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
