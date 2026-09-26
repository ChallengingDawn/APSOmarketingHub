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
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

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

      {/* The steps, in the order a buyer takes them. */}
      <Section sx={{ mb: 2.5, overflowX: "auto" }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.5 }}>What the buyer actually does</Typography>
        <Box sx={{ display: "flex", gap: 1, minWidth: "min-content", pb: 1 }}>
          {model.steps.map((step) => {
            const stage = model.stages.find((s) => s.id === step.stageId);
            return (
              <Box
                key={step.index}
                sx={{
                  minWidth: 170,
                  flex: "0 0 auto",
                  p: 1.25,
                  borderRadius: 2,
                  border: `1px solid ${HAIRLINE}`,
                  bgcolor: "#fff",
                }}
              >
                <Typography sx={{ fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {step.index}. {stage?.name.split("–")[0].trim()}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5, lineHeight: 1.35 }}>{step.label}</Typography>
              </Box>
            );
          })}
        </Box>
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
