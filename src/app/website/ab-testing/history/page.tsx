"use client";
// Website > A/B testing > HISTORY (SARCLA 13.11.2026: "it should record the past tests as well"). Every test that ended -
// whichever tool ran it - with its result against the control, what was decided and what we learned; a past test of
// another tool (an earlier Webyn test, one from before the hub) is typed in with "Record a past test".

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { OUTCOME_LABEL, SOURCE_LABEL, readArms, type Outcome, type Source } from "@/lib/experiments/model";
import { SyncLine, XpDialog, XpLoaded, XpTable, keyHref, type ListData } from "../xp/parts";

export default function History() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Body({ d, reload }: { d: ListData; reload: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<"all" | "page" | "microservice">("all");
  const [src, setSrc] = useState<"all" | Source>("all");
  const [out, setOut] = useState<"all" | Outcome>("all");
  const [q, setQ] = useState("");
  const ended = useMemo(() => d.experiments.filter((e) => e.status === "ended")
    .sort((a, b) => Date.parse(b.endedAt ?? b.updatedAt) - Date.parse(a.endedAt ?? a.updatedAt)), [d.experiments]);
  const list = ended.filter((e) => (cat === "all" || e.category === cat) && (src === "all" || e.source === src) && (out === "all" || readArms(e.arms).outcome === out)
    && (!q || `${e.name} ${e.surface} ${e.learning} ${e.hypothesis}`.toLowerCase().includes(q.toLowerCase())));
  const outcomes = ended.map((e) => readArms(e.arms).outcome);
  return (
    <>
      <PageHeader title="History" subtitle="Every test that ended: what it changed, what came out, what we decided and what we learned"
        rightSlot={d.canEdit ? <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={() => setAdding(true)} sx={{ textTransform: "none", borderRadius: "999px" }}>Record a past test</Button> : undefined} />
      <SyncLine d={d} reload={reload} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HistoryOutlinedIcon />} tint="purple" label="Tests ended" value={String(ended.length)} note={`${ended.filter((e) => e.category === "page").length} on pages · ${ended.filter((e) => e.category === "microservice").length} in microservices`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EmojiEventsOutlinedIcon />} tint="green" label="A version won" value={String(outcomes.filter((o) => o === "won").length)} note="Clearly better than the control (under 5% likely by chance)" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TrendingDownOutlinedIcon />} tint="pink" label="Lost or no difference" value={String(outcomes.filter((o) => o === "lost" || o === "flat").length)} note={`${outcomes.filter((o) => o === "too-early" || o === "no-data").length} ended too early or without figures`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SchoolOutlinedIcon />} tint="amber" label="Learning written down" value={`${ended.filter((e) => e.learning).length} of ${ended.length}`} note="A test is only worth its lesson - write it on the test's page" /></Grid>
      </Grid>
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Ended tests" note="Newest first. Click a test for its figures, its decision and its log." />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <TextField size="small" label="Search" value={q} onChange={(x) => setQ(x.target.value)} sx={{ minWidth: 220 }} />
          <TextField size="small" select label="Kind" value={cat} onChange={(x) => setCat(x.target.value as typeof cat)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Pages and services</MenuItem><MenuItem value="page">Shop pages</MenuItem><MenuItem value="microservice">Microservices</MenuItem>
          </TextField>
          <TextField size="small" select label="Tool" value={src} onChange={(x) => setSrc(x.target.value as typeof src)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Every tool</MenuItem>{(Object.keys(SOURCE_LABEL) as Source[]).map((s) => <MenuItem key={s} value={s}>{SOURCE_LABEL[s]}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Outcome" value={out} onChange={(x) => setOut(x.target.value as typeof out)} sx={{ minWidth: 170 }}>
            <MenuItem value="all">Any outcome</MenuItem>{(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => <MenuItem key={o} value={o}>{OUTCOME_LABEL[o]}</MenuItem>)}
          </TextField>
        </Box>
        <XpTable list={list} empty={ended.length ? "No ended test matches." : "No test ended yet - the chat's round 2 shows here once the record is refreshed."}
          cols={["test", "where", "dates", "visitors", "result", "decision", "learning"]} />
      </GlassCard>
      {adding && <XpDialog open preset={{ status: "ended" }} onClose={() => setAdding(false)} onSaved={(k) => router.push(keyHref(k))} />}
    </>
  );
}
