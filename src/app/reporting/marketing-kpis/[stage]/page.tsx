"use client";
// One stage of the customer journey as a page of its own, reached from the side
// panel and from its panel on the macro page; the link back leads to "In a
// nutshell" (SARCLA 13.10), the side panel's name for the macro page.

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Box from "@mui/material/Box";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { GUTTER } from "@/app/analytics/Shell";
import { MUTED, INK } from "@/app/uc/report/ui";
import { shownStage } from "@/lib/marketingKpis/stageNames";
import { useMarketingKpis } from "../data";
import { StageView } from "../StageView";

export default function StagePage() {
  const { stage } = useParams<{ stage: string }>();
  // the stages as shown: Purchase and the old Cart & check-out are gone (SARCLA 19.10)
  const s = shownStage(stage);
  const [state] = useMarketingKpis();
  if (!s) notFound();
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.25 }}>
      <Box component={Link} href="/reporting/marketing-kpis" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
      </Box>
      <StageView slug={s.slug} state={state} />
    </Box>
  );
}
