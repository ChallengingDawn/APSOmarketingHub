"use client";

// THE JOURNEY — the business definition, on screen.
//
// Five stages across, the buyer's steps inside each, and under them what the
// workbook says about that stage: the objective, the touchpoints that carry it,
// the ways we lose people, and the KPIs the business asked for. Nothing here is
// invented: every line is a cell of the workbook, and an empty cell stays empty.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import type { JourneyModel, JourneyStage } from "@/lib/journey/model";
import type { JourneyMetrics, StepMetric } from "@/lib/journey/metrics";
import { full, percent } from "@/app/charts/format";

const FIELDS: { key: keyof JourneyStage; label: string; tone?: "risk" }[] = [
  { key: "objective", label: "What APSOparts must achieve" },
  { key: "touchpoints", label: "Critical touchpoints" },
  { key: "risks", label: "Where we lose them", tone: "risk" },
  { key: "questions", label: "Questions the business wants answered" },
  { key: "kpis", label: "KPIs to put in place" },
  { key: "ideas", label: "Optimisation ideas" },
];

function Lines({ value }: { value: string | null }) {
  if (!value) return <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Not filled in the workbook.</Typography>;
  const parts = value.split(/\n|,(?=\s*[A-ZÀ-Ý])/).map((p) => p.trim()).filter(Boolean);
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.2, display: "grid", gap: 0.4 }}>
      {parts.map((p, i) => (
        <Typography key={i} component="li" sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.45 }}>{p}</Typography>
      ))}
    </Box>
  );
}

export default function JourneyBoardPage() {
  const [model, setModel] = useState<JourneyModel | null>(null);
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  // The numbers are a separate request on purpose: the journey has to render
  // even when GA4 or HubSpot is having a bad day.
  useEffect(() => {
    let alive = true;
    fetch("/api/journey/metrics")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && j.data) setMetrics(j.data as JourneyMetrics);
        else setMetricsError(j?.error ?? "The numbers could not be read.");
      })
      .catch((e) => alive && setMetricsError(String(e)));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/journey")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.model) { setModel(j.model as JourneyModel); setState("ready"); }
        else setState("empty");
      })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, []);

  if (state === "loading") return <Typography sx={{ color: MUTED }}>Reading the journey…</Typography>;

  if (state !== "ready" || !model) {
    return (
      <Section>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 1 }}>No journey imported yet</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 2 }}>
          {state === "error"
            ? "The journey could not be read from the database."
            : "The stages and steps come from the workbook the business maintains. Import it once and this screen fills in."}
        </Typography>
        <Typography component={Link} href="/journey/import" sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#1b4a80" }}>
          Import the workbook →
        </Typography>
      </Section>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <Chip size="small" label={`${model.stages.length} stages · ${model.steps.length} steps`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
          From {model.source.fileName}, imported {new Date(model.source.importedAt).toLocaleDateString("en-GB")} by {model.source.importedBy}
        </Typography>
      </Box>

      {/* Where the visits go. Every bar counts visits, so the percentages compare. */}
      {metrics && metrics.funnel.some((f) => f.value) && (
        <Section sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Where we lose them</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.75 }}>
            Visits, not clicks: each bar is how many visits reached that point between {metrics.from} and {metrics.to}.
            Only visits that allowed statistics are counted.
          </Typography>
          <Box sx={{ display: "grid", gap: 1 }}>
            {metrics.funnel.map((row, i) => {
              const first = metrics.funnel.find((f) => f.value)?.value ?? null;
              const previous = metrics.funnel.slice(0, i).reverse().find((f) => f.value)?.value ?? null;
              const width = first && row.value ? Math.max(2, (row.value / first) * 100) : 0;
              const drop = previous && row.value ? 1 - row.value / previous : null;
              return (
                <Box key={row.label} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr 190px" }, gap: 1, alignItems: "center" }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{row.label}</Typography>
                  <Box sx={{ position: "relative", height: 26, bgcolor: "#eef0f3", borderRadius: 1, overflow: "hidden" }}>
                    <Box sx={{ position: "absolute", inset: 0, width: `${width}%`, bgcolor: i === 0 ? "#1b4a80" : "#2f6fb5", borderRadius: 1 }} />
                  </Box>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                    <strong style={{ color: INK }}>{full(row.value)}</strong>
                    {drop !== null && drop > 0 && ` · ${percent(drop)} lost here`}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Section>
      )}

      {/* The steps, in the order a buyer takes them. */}
      <Section sx={{ mb: 2.5, overflowX: "auto" }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.5 }}>What the buyer actually does</Typography>
        <Box sx={{ display: "flex", gap: 1, minWidth: "min-content", pb: 1 }}>
          {model.steps.map((step) => {
            const stage = model.stages.find((s) => s.id === step.stageId);
            const metric: StepMetric | undefined = metrics?.steps.find((m) => m.stepIndex === step.index);
            // Drop is only honest between two steps that are both measured.
            const previous = [...(metrics?.steps ?? [])]
              .filter((m) => m.stepIndex < step.index && m.value !== null)
              .sort((a, b) => b.stepIndex - a.stepIndex)[0];
            const ratio = metric?.value != null && previous?.value ? metric.value / previous.value : null;
            return (
              <Box
                key={step.index}
                sx={{
                  minWidth: 190,
                  flex: "0 0 auto",
                  p: 1.25,
                  borderRadius: 2,
                  border: `1px solid ${HAIRLINE}`,
                  bgcolor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography sx={{ fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {step.index}. {stage?.name.split("–")[0].trim()}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5, lineHeight: 1.35, flexGrow: 1 }}>{step.label}</Typography>
                <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
                  {metric?.value != null ? (
                    <>
                      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{full(metric.value)}</Typography>
                      <Typography sx={{ fontSize: "0.68rem", color: MUTED }}>{metric.unit}</Typography>
                      {ratio !== null && (
                        <Typography sx={{ fontSize: "0.68rem", color: ratio < 0.25 ? "#9e1b18" : MUTED, mt: 0.25 }}>
                          {percent(ratio)} of step {previous!.stepIndex}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography sx={{ fontSize: "0.68rem", color: MUTED, fontStyle: "italic" }}>
                      {metric?.gap ? "not measurable" : metrics ? "—" : "…"}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
        {metricsError && (
          <Typography sx={{ fontSize: "0.76rem", color: "#9e1b18", mt: 1 }}>
            The steps are shown without numbers: {metricsError}
          </Typography>
        )}
        {metrics && (
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1 }}>
            Numbers cover {metrics.from} to {metrics.to}. A step with no number says why on the stage panel below.
          </Typography>
        )}
      </Section>

      {/* One panel per stage. */}
      <Grid container spacing={2.5}>
        {model.stages.map((stage) => (
          <Grid key={stage.id} size={{ xs: 12, lg: 6 }}>
            <Section sx={{ height: "100%" }}>
              <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{stage.name}</Typography>
              {stage.description && (
                <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5 }}>{stage.description}</Typography>
              )}
              {stage.mindset && (
                <Typography sx={{ fontSize: "0.85rem", color: INK, mt: 1.25, fontStyle: "italic" }}>
                  “{stage.mindset}”
                </Typography>
              )}
              <Box sx={{ display: "grid", gap: 1.75, mt: 2 }}>
                {FIELDS.map((field) => (
                  <Box key={String(field.key)}>
                    <Typography
                      sx={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: field.tone === "risk" ? "#9e1b18" : MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        mb: 0.5,
                      }}
                    >
                      {field.label}
                    </Typography>
                    <Lines value={(stage[field.key] as string | null) ?? null} />
                  </Box>
                ))}
              </Box>
            </Section>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
