"use client";
// Website > A/B testing > MISSION CONTROL (SARCLA 13.11.2026: "develop a mission control A/B testing, then completely
// different categories: pages that are sent to test, and microservices; it should record the past tests as well, and be
// connected with the tests in Webyn"). Every test the hub knows of - APSOconvert's page tests, Webyn's as the shop saw
// them, the shop chat's rounds, and any typed in (src/lib/experiments): what runs now and how it stands, what needs a
// decision, where two tests clash, every test on a timeline, and the ideas next in line. The chat's own test moved to
// /website/ab-testing/chat (its setting and figures, unchanged).

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GlassCard, GREEN, INK, KpiTile, MUTED, Notice } from "@/app/uc/report/ui";
import { SOURCE_LABEL, clashes, daysOf, iceScore, needsDecision, readArms, type Experiment } from "@/lib/experiments/model";
import { ArmBars, OutcomeChip, SourceTag, StatusChip, SyncLine, Timeline, XpLoaded, XpTable, keyHref, liftText, whereOf, type ListData } from "./xp/parts";

export default function MissionControl() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Body({ d, reload }: { d: ListData; reload: () => void }) {
  const all = d.experiments;
  const running = all.filter((e) => e.status === "running" || e.status === "paused");
  const decide = all.filter((e) => needsDecision(e));
  const ended = all.filter((e) => e.status === "ended");
  const won = ended.filter((e) => readArms(e.arms).outcome === "won" || e.decision === "ship");
  const ideas = all.filter((e) => e.status === "idea" || e.status === "planned").sort((a, b) => (iceScore(b.ice) ?? 0) - (iceScore(a.ice) ?? 0));
  const clash = clashes(all);
  const byKey = new Map(all.map((e) => [e.key, e]));
  return (
    <>
      {/* no "Record a test" here (SARCLA 14.11.2026): a page test comes from the Page builder, a past one is recorded under History */}
      <PageHeader title="A/B testing - Mission control" subtitle="Every test on the shop's pages and in its services: what runs, how it stands, what needs a decision, what comes next" />
      <SyncLine d={d} reload={reload} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PlayCircleOutlineIcon />} tint="green" label="Running now" value={String(running.length)}
          note={`${running.filter((e) => e.category === "page").length} on pages · ${running.filter((e) => e.category === "microservice").length} in microservices`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GavelOutlinedIcon />} tint={decide.length ? "pink" : "slate"} label="To decide" value={String(decide.length)}
          note="Ended, or clearly read while running, and nobody decided yet" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EmojiEventsOutlinedIcon />} tint="purple" label="Won, ever" value={`${won.length} of ${ended.length}`}
          note={ended.length ? `${Math.round((won.length / ended.length) * 100)}% of the ended tests found a better version` : "No test ended yet"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LightbulbOutlinedIcon />} tint="amber" label="Ideas waiting" value={String(ideas.length)}
          note={ideas[0] ? `Next: ${ideas[0].name}` : "Record what to test next"} /></Grid>
      </Grid>

      {clash.map((c) => (
        <Notice key={c.place} tone="warn">
          <WarningAmberOutlinedIcon sx={{ fontSize: 16, verticalAlign: "-3px", mr: 0.5 }} />
          {c.keys.map((k) => `${byKey.get(k)?.name ?? k} (${SOURCE_LABEL[byKey.get(k)?.source ?? "manual"]})`).join(" and ")} run on the same {c.place.startsWith("service:") ? "service" : "page"} at once -
          their figures cannot say which change did it. Stop one, or accept no change of the other there while it runs.
        </Notice>
      ))}

      <GlassCard sx={{ display: "grid", gap: 1.5 }}>
        <CardTitle icon={<PlayCircleOutlineIcon />} tint="green" title="Running now" note="Each version against the page or the service as it is. The whisker is the 95% range: where the version's and the control's do not overlap, the difference is real." />
        {running.length ? (
          <Grid container spacing={2}>
            {running.map((e) => <Grid key={e.key} size={{ xs: 12, lg: 6 }}><RunningCard e={e} /></Grid>)}
          </Grid>
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing runs right now. A page test starts from its to-do in Content&apos;s Page builder (those being built are under <Link href="/website/ab-testing/ideas">Ideas</Link>), a chat round from <Link href="/website/ab-testing/chat">Chat</Link>.</Typography>}
      </GlassCard>

      {decide.length > 0 && (
        <GlassCard sx={{ display: "grid", gap: 1 }}>
          <CardTitle icon={<GavelOutlinedIcon />} tint="pink" title="Waiting for a decision" note="Ship the winner, keep it as it is, or test a new version - and write down what we learned, so the next test starts from it." />
          <XpTable list={decide} empty="" cols={["test", "where", "status", "dates", "visitors", "result", "decision"]} />
        </GlassCard>
      )}

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title="Every test of the last four months" note="One line from its start to its end - pages and microservices apart, the colour is the tool that runs it."
          right={<Button component={Link} href="/website/ab-testing/by-page" size="small" sx={{ textTransform: "none" }}>Each page&apos;s tests →</Button>} />
        <Timeline list={all} />
      </GlassCard>

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title="Next up" note="The ideas with the best score (impact, confidence, ease - each 1 to 10). All of them under Ideas." />
        <XpTable list={ideas.slice(0, 5)} empty="No idea recorded yet." cols={["test", "where", "status", "score"]} />
        <Box><Button component={Link} href="/website/ab-testing/ideas" size="small" sx={{ textTransform: "none" }}>All ideas →</Button></Box>
      </GlassCard>

    </>
  );
}

function RunningCard({ e }: { e: Experiment }) {
  const r = readArms(e.arms);
  const days = daysOf(e);
  return (
    <Box sx={{ border: "1px solid rgba(21,34,58,.10)", borderRadius: "14px", p: 1.75, display: "grid", gap: 1, bgcolor: "rgba(255,255,255,.6)", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          <Box component={Link} href={keyHref(e.key)} sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{e.name}</Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 0.25 }}>
            <SourceTag s={e.source} />
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, wordBreak: "break-all" }}>{whereOf(e)}</Typography>
          </Box>
        </Box>
        <StatusChip s={e.status} />
      </Box>
      <ArmBars e={e} compact />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {r.best && <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: r.outcome === "won" ? GREEN : INK }}>{liftText(r)}</Typography>}
        <OutcomeChip o={r.outcome} />
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{r.visitors.toLocaleString("de-CH")} visitors{days !== null ? ` · day ${days}` : ""}</Typography>
      </Box>
    </Box>
  );
}
