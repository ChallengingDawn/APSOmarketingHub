"use client";

// WHERE COMPANIES SIT, AND WHERE THEY MOVED.
//
// The earlier version divided one stage's arrivals by another's and printed
// "250.4% of the step before". That number could not mean anything: entering
// Lost Lead is not a subset of entering SQL, so the two are not a funnel. They
// are two separate flows into two separate stages.
//
// So this screen shows two honest things per path:
//   · how many companies SIT in each stage today — the size of the problem
//   · how many ARRIVED in the window — the direction it is moving
// and one plain sentence saying what that means for the business.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import PageHeader from "@/app/PageHeader";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import type { JourneyModel } from "@/lib/journey/model";
import type { FunnelResult, JourneyFunnels } from "@/lib/journey/funnels";
import { useReportingWindow, WindowPicker, windowQuery, windowLabel } from "@/app/window/ReportingWindow";
import { full } from "@/app/charts/format";

/** Stages where sitting still is bad news. */
const DANGER = /lost|not reactivated|churn/i;

export default function JourneyFunnelsPage() {
  const [model, setModel] = useState<JourneyModel | null>(null);
  const [counts, setCounts] = useState<JourneyFunnels | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { window: reportingWindow } = useReportingWindow();
  // The dates are not a choice this screen made: they are whatever the picker
  // beside them says. Naming the preset stops "why these dates?".
  const presetLabel = windowLabel(reportingWindow);

  useEffect(() => {
    fetch("/api/journey").then((r) => r.json()).then((j) => setModel(j?.model ?? null)).catch(() => {});
  }, []);

  // "Arrived" only means something against a stated window, so it follows the same
  // hub-wide one every other screen reads.
  useEffect(() => {
    const ctrl = new AbortController();
    setCounts(null);
    setError(null);
    fetch(`/api/journey/funnels?${windowQuery(reportingWindow)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => (j?.ok && j.data ? setCounts(j.data as JourneyFunnels) : setError(j?.error ?? "The counts could not be read.")))
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [reportingWindow]);

  if (!model) return <Typography sx={{ color: MUTED }}>Reading the journey…</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <PageHeader title="Lifecycle funnels" subtitle="Where companies sit today, and where they moved in the window" />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <WindowPicker />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
          {counts
            ? `“${presetLabel}” is ${counts.from} to ${counts.to} — arrivals are counted over exactly those dates. Change the picker to change them.`
            : "Counting…"}
        </Typography>
      </Box>
      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, mb: 0.5 }}>How to read this</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
          Each stage shows two numbers. <strong style={{ color: INK }}>Sitting there</strong> is how many companies are in that
          lifecycle stage today — the size of the pile. <strong style={{ color: INK }}>Arrived</strong> is how many moved into it
          {counts ? ` between ${counts.from} and ${counts.to}, which is what the picker above resolves “${presetLabel}” to` : " in the window"}
          {" "}— the direction of travel.
          {" "}They are not a conversion rate: a company reaching SQL this quarter may have become an MQL two years ago, so
          dividing one by the other would produce a number that means nothing.
        </Typography>
        {error && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18", mt: 1 }}>{error}</Typography>}
      </Section>

      {model.funnels.map((funnel) => {
        const measured: FunnelResult | undefined = counts?.funnels.find((f) => f.id === funnel.id);
        const biggest = Math.max(1, ...(measured?.path.map((p) => p.inStageNow ?? 0) ?? [1]));
        const last = measured?.path[measured.path.length - 1];
        const first = measured?.path[0];
        return (
          <Section key={funnel.id}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, mb: 0.25 }}>
              {funnel.path.join("  →  ")}
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2 }}>{funnel.note}</Typography>

            <Box sx={{ display: "grid", gap: 1.25 }}>
              {(measured?.path ?? funnel.path.map((label) => ({ label, inStageNow: null, entered: null, stageValue: null }))).map((step, i) => {
                const danger = DANGER.test(step.label);
                const width = step.inStageNow ? Math.max(1.5, (step.inStageNow / biggest) * 100) : 0;
                return (
                  <Box key={i} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "210px 1fr 150px" }, gap: 1.25, alignItems: "center" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{i + 1}</Typography>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: danger ? "#9e1b18" : INK }}>{step.label}</Typography>
                    </Box>

                    <Tooltip title={step.inStageNow != null ? `${full(step.inStageNow)} companies are in this stage today` : "not counted"} describeChild>
                      <Box sx={{ position: "relative", height: 30, bgcolor: "#f1f3f6", borderRadius: 1, overflow: "hidden" }}>
                        <Box sx={{ position: "absolute", inset: 0, width: `${width}%`, bgcolor: danger ? "#ff375f" : "#0a84ff", opacity: danger ? 0.85 : 0.9 }} />
                        <Typography
                          sx={{
                            position: "absolute",
                            left: 10,
                            top: 0,
                            lineHeight: "30px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: width > 22 ? "#fff" : INK,
                          }}
                        >
                          {step.inStageNow != null ? full(step.inStageNow) : "—"}
                        </Typography>
                      </Box>
                    </Tooltip>

                    <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
                      {step.entered != null ? (
                        <Chip
                          size="small"
                          label={`${full(step.entered)} arrived`}
                          sx={{ bgcolor: danger ? "#fdf3f2" : "#eef4fb", color: danger ? "#9e1b18" : "#1b4a80", fontWeight: 600, fontSize: "0.72rem" }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{counts ? "no such stage" : "counting…"}</Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* The sentence a reader should leave with. */}
            {measured && last?.inStageNow != null && first?.entered != null && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.84rem", color: INK }}>
                  <strong>{full(last.inStageNow)}</strong> companies sit in <strong>{last.label}</strong> today
                  {last.entered != null && <> and <strong>{full(last.entered)}</strong> joined them in this window</>}
                  , while <strong>{full(first.entered)}</strong> entered <strong>{first.label}</strong>.
                </Typography>
              </Box>
            )}
          </Section>
        );
      })}

      <Section>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.75 }}>What these stages mean here</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          These are HubSpot lifecycle stages on the company — a label somebody or some workflow set. Two of them are also
          computed from our own orders elsewhere in the hub: a company is <strong>active</strong> when it ordered within twelve
          months and <strong>reactivated</strong> when it came back after longer. Where the label and the orders disagree, trust
          the orders: the label is an opinion, the order happened.
        </Typography>
      </Section>
    </Box>
  );
}
