"use client";
// Website > A/B testing > IDEAS - what to test next. Three parts (SARCLA 14.11.2026: "an idea, the same should be able to be
// sent from the page builder, so call it Under building pages"):
//   UNDER BUILDING PAGES  the pages Content's Page builder is building with an A/B test switched on - they come by
//                         themselves (src/lib/experiments/sync.ts, key pagebuilder-<piece>) and start ONLY from their to-do
//                         in Content; once APSOconvert runs the test it moves to Page tests / Mission control
//   PLANNED               decided to run, waiting for its turn
//   IDEAS                 scored (impact, confidence, ease - each 1 to 10, the score their mean), best first
// (The Page builder's read-only list, ../PlannedPages.tsx, is replaced by the first part.)

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard } from "@/app/uc/report/ui";
import { iceScore } from "@/lib/experiments/model";
import { SyncLine, XpDialog, XpLoaded, XpTable, keyHref, type ListData } from "../xp/parts";

export default function Ideas() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Body({ d, reload }: { d: ListData; reload: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const building = d.experiments.filter((e) => e.source === "pagebuilder").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const by = (s: "idea" | "planned") => d.experiments.filter((e) => e.status === s && e.source !== "pagebuilder").sort((a, b) => (iceScore(b.ice) ?? 0) - (iceScore(a.ice) ?? 0));
  return (
    <>
      <PageHeader title="Ideas" subtitle="What to test next: the pages being built with a test, what is planned, and the ideas scored and in order"
        rightSlot={d.canEdit ? <Button variant="contained" disableElevation startIcon={<AddCircleOutlineIcon />} onClick={() => setAdding(true)} sx={{ textTransform: "none", borderRadius: "999px" }}>Add an idea</Button> : undefined} />
      <SyncLine d={d} reload={reload} />
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<ConstructionOutlinedIcon />} tint="pink" title="Under building pages"
          note="Pages Content's Page builder is building with an A/B test switched on - they come here by themselves. A page test starts only from its to-do in the Page builder; once it runs it is under Page tests." />
        <XpTable list={building} empty="No page is being built with an A/B test - switch the A/B test on in a page to-do of the Page builder." cols={["test", "where", "status", "dates"]} />
      </GlassCard>
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<EventAvailableOutlinedIcon />} tint="blue" title="Planned" note="Decided to run - waiting for its turn on the page or the service." />
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
