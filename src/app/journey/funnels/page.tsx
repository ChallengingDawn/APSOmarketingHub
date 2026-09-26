"use client";

// FUNNELS — the lifecycle paths the business asked to see, from the workbook's
// "KPIsNeeded" sheet: MQL → SQL → Lost Lead, New Customer → New Customer Lost,
// Churn/Reactivate → Not Reactivated, and back again.
//
// This screen shows the paths as the business wrote them. Filling each step
// with a company count comes next, from the lifecycle history HubSpot keeps —
// until then the screen says so rather than drawing an empty funnel.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import type { JourneyModel } from "@/lib/journey/model";

export default function JourneyFunnelsPage() {
  const [model, setModel] = useState<JourneyModel | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/journey")
      .then((r) => r.json())
      .then((j) => setModel(j?.model ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <Typography sx={{ color: MUTED }}>Reading the journey…</Typography>;

  if (!model?.funnels?.length) {
    return (
      <Section>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 1 }}>No funnels imported</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 2 }}>
          The lifecycle paths come from the “KPIsNeeded” sheet of the workbook, one per line, written as
          “MQL → SQL → Lost Lead: why it matters”.
        </Typography>
        <Typography component={Link} href="/journey/import" sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#1b4a80" }}>
          Import the workbook →
        </Typography>
      </Section>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Section>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
          These are the paths the business wants measured, exactly as written in the workbook. The company counts for each step
          come from the lifecycle history in HubSpot and are not wired yet — the shape is here first, so the definitions can be
          agreed before anyone argues about a number.
        </Typography>
      </Section>

      {model.funnels.map((funnel) => (
        <Section key={funnel.id}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
            {funnel.path.map((stage, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.9,
                    borderRadius: 2,
                    border: `1px solid ${HAIRLINE}`,
                    bgcolor: i === funnel.path.length - 1 ? "#fdf3f2" : "#fff",
                  }}
                >
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: i === funnel.path.length - 1 ? "#9e1b18" : INK }}>
                    {stage}
                  </Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>count to come</Typography>
                </Box>
                {i < funnel.path.length - 1 && <Typography sx={{ color: MUTED }}>→</Typography>}
              </Box>
            ))}
          </Box>
          {funnel.note && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{funnel.note}</Typography>}
        </Section>
      ))}

      <Section>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.75 }}>What these stages mean here</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          The lifecycle stages in the paths above are HubSpot company stages. Two of them are already computed elsewhere in the hub
          from our own orders rather than from the stage field: a company is <strong>active</strong> when it ordered within twelve
          months and <strong>reactivated</strong> when it came back after longer. Where the stage field and the orders disagree,
          the orders win — the stage is a label someone set, the order happened.
        </Typography>
      </Section>
    </Box>
  );
}
