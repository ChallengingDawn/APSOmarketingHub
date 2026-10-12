"use client";
// One stage of the customer journey as a page of its own, reached from the side
// panel; the nutshell opens the same view in a large window.

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Box from "@mui/material/Box";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { MUTED, INK } from "@/app/uc/report/ui";
import { stageBySlug } from "@/lib/marketingKpis/catalogue";
import { useMarketingKpis } from "../data";
import { StageView } from "../StageView";

export default function StagePage() {
  const { stage } = useParams<{ stage: string }>();
  const s = stageBySlug(stage);
  const [state] = useMarketingKpis();
  if (!s) notFound();
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2, maxWidth: 1400 }}>
      <Box component={Link} href="/reporting/marketing-kpis" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to the journey
      </Box>
      <StageView slug={s.slug} state={state} />
    </Box>
  );
}
