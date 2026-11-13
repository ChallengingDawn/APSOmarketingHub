"use client";
// Website > A/B testing > IDEAS - what to test next, scored (impact, confidence, ease - each 1 to 10, the score their mean)
// and in that order; planned ones above the rest. An idea becomes a test where its tool runs it (a page test in APSOconvert,
// a chat round, Webyn) - the record links them by hand until then. The page tests Content's Page builder plans come below
// (./PlannedPages.tsx, read-only, as they were on the app's front page).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard } from "@/app/uc/report/ui";
import { iceScore } from "@/lib/experiments/model";
import PlannedPages from "../PlannedPages";
import { XpDialog, XpLoaded, XpTable, keyHref, type ListData } from "../xp/parts";

export default function Ideas() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d) => <Body d={d} />}</XpLoaded>
      <PlannedPages />
    </Box>
  );
}

function Body({ d }: { d: ListData }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const by = (s: "idea" | "planned") => d.experiments.filter((e) => e.status === s).sort((a, b) => (iceScore(b.ice) ?? 0) - (iceScore(a.ice) ?? 0));
  return (
    <>
      <PageHeader title="Ideas" subtitle="What to test next, scored and in order - on a page or in a service"
        rightSlot={d.canEdit ? <Button variant="contained" disableElevation startIcon={<AddCircleOutlineIcon />} onClick={() => setAdding(true)} sx={{ textTransform: "none", borderRadius: "999px" }}>Add an idea</Button> : undefined} />
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="blue" title="Planned" note="Decided to run - waiting for its turn on the page or the service." />
        <XpTable list={by("planned")} empty="Nothing planned yet." cols={["test", "where", "score", "status"]} />
      </GlassCard>
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title="Ideas" note="Best score first. Impact: how much it could move; confidence: how sure we are it will; ease: how little it takes." />
        <XpTable list={by("idea")} empty="No idea recorded yet - add the first." cols={["test", "where", "score", "status"]} />
      </GlassCard>
      {adding && <XpDialog open preset={{ status: "idea" }} onClose={() => setAdding(false)} onSaved={(k) => router.push(keyHref(k))} />}
    </>
  );
}
