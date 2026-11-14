"use client";
// Website > A/B testing > ONE TEST - its record, whichever tool ran it: where, since when, what it changes, each version
// against the control with its 95% range, the outcome, what the tool itself said, and a person's word on it - the
// hypothesis, the decision, what we learned, a result another tool reported (Webyn's dashboard) - with the log of who
// changed what. The test's own controls stay in its tool (APSOconvert's page test, the chat's setting). 14.11.2026 (SARCLA:
// "don't have navigation here"): the way back to where the test belongs, and the tests before and after it on the same
// page or service (the chat's rounds one after the other); the chat's round opens the chat's page on that round.

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GlassCard, GREEN, HAIRLINE, INK, MUTED, Notice, RED } from "@/app/uc/report/ui";
import { DECISION_LABEL, OUTCOME_LABEL, SOURCE_LABEL, daysOf, iceScore, readArms, type Experiment } from "@/lib/experiments/model";
import { ArmBars, OutcomeChip, SourceTag, StatusChip, XpDialog, XpLoaded, day, keyHref, liftText, pct, post, whereOf, type OneData } from "../../xp/parts";

/** Where a test belongs in the side panel: its section, to go back to. */
function homeOf(e: Experiment): { label: string; href: string } {
  if (e.source === "pagebuilder" || e.status === "idea" || e.status === "planned") return { label: "Ideas", href: "/website/ab-testing/ideas" };
  if (e.category === "microservice") return { label: "Microservices", href: "/website/ab-testing/microservices" };
  if (e.status === "ended") return { label: "History", href: "/website/ab-testing/history" };
  return { label: "Page tests", href: "/website/ab-testing/pages" };
}

/** A/B testing > section > this test, and the tests before and after it on the same page or service. */
function Trail({ d }: { d: OneData }) {
  const e = d.experiment, home = homeOf(e);
  const sib = d.siblings ?? [];
  const i = sib.findIndex((s) => s.key === e.key);
  const prev = i > 0 ? sib[i - 1] : null, next = i >= 0 && i < sib.length - 1 ? sib[i + 1] : null;
  const crumb = { fontSize: "0.8rem", color: MUTED, textDecoration: "none", "&:hover": { color: INK, textDecoration: "underline" } };
  const step = (s: NonNullable<typeof prev>, dir: "prev" | "next") => (
    <Button component={Link} href={keyHref(s.key)} size="small" variant="outlined" title={s.name}
      startIcon={dir === "prev" ? <ChevronLeftIcon /> : undefined} endIcon={dir === "next" ? <ChevronRightIcon /> : undefined}
      sx={{ textTransform: "none", borderRadius: "999px", maxWidth: 300, "& .MuiButton-startIcon, & .MuiButton-endIcon": { m: 0 } }}>
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dir === "prev" ? "Before: " : "After: "}{s.name}</Box>
    </Button>
  );
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Box component={Link} href="/website/ab-testing" sx={crumb}>A/B testing</Box>
        <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>›</Typography>
        <Box component={Link} href={home.href} sx={crumb}>{home.label}</Box>
        {e.category === "microservice" && e.service === "chat" && <><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>›</Typography><Box component={Link} href="/website/ab-testing/chat" sx={crumb}>Chat: the e-mail</Box></>}
        {sib.length > 1 && <Typography sx={{ fontSize: "0.76rem", color: FAINT, ml: 0.5 }}>· test {i + 1} of {sib.length} on this {e.category === "microservice" ? "service" : "page"}</Typography>}
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{prev && step(prev, "prev")}{next && step(next, "next")}</Box>
    </Box>
  );
}

export default function TestPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <XpLoaded<OneData> url={`/api/website/ab-testing/experiments?key=${encodeURIComponent(decodeURIComponent(key))}`}>{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</Typography>
      <Box sx={{ fontSize: "0.88rem", color: INK, mt: 0.25 }}>{v}</Box>
    </Box>
  );
}

function Body({ d, reload }: { d: OneData; reload: () => void }) {
  const router = useRouter();
  const e: Experiment = d.experiment;
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const r = readArms(e.arms);
  const days = daysOf(e);
  const remove = async () => {
    setErr(null);
    const x = await post({ action: "remove", key: e.key });
    if (!x.ok) setErr(x.error ?? "Did not work."); else router.push("/website/ab-testing");
  };
  return (
    <>
      <Trail d={d} />
      <PageHeader title={e.name} subtitle={`${SOURCE_LABEL[e.source]} · ${e.category === "page" ? "a shop page" : "a microservice"} · ${whereOf(e)}`}
        rightSlot={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {e.link && <Button component={Link} href={e.link} variant="outlined" sx={{ textTransform: "none", borderRadius: "999px" }}>Open in {SOURCE_LABEL[e.source]}</Button>}
            {d.canEdit && <Button variant="contained" disableElevation startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)} sx={{ textTransform: "none", borderRadius: "999px" }}>{e.source === "manual" ? "Change" : "Decide / learn"}</Button>}
          </Box>
        } />
      <GlassCard sx={{ display: "grid", gap: 1.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, gap: 2 }}>
          <Fact k="Status" v={<StatusChip s={e.status} />} />
          <Fact k="Tool" v={<SourceTag s={e.source} />} />
          <Fact k="Started" v={day(e.startedAt)} />
          <Fact k="Ended" v={e.endedAt ? day(e.endedAt) : e.startedAt ? "running" : "–"} />
          <Fact k="Days" v={days ?? "–"} />
          <Fact k="Visitors" v={r.visitors ? r.visitors.toLocaleString("de-CH") : "–"} />
        </Box>
        {e.hypothesis && <Fact k="Hypothesis" v={e.hypothesis} />}
        {e.changes.length > 0 && <Fact k="What it changes" v={e.changes.join(" · ")} />}
        {e.status === "idea" || e.status === "planned" ? <Fact k="Score" v={iceScore(e.ice) !== null ? `${iceScore(e.ice)} (impact ${e.ice!.impact}, confidence ${e.ice!.confidence}, ease ${e.ice!.ease})${e.owner ? ` · ${e.owner}` : ""}` : "not scored"} /> : null}
      </GlassCard>

      {(e.arms.length > 0 || e.status !== "idea") && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <GlassCard sx={{ display: "grid", gap: 1.5, height: "100%" }}>
              <CardTitle icon={<ScienceOutlinedIcon />} tint="blue" title="The versions" note="The control is the page or the service as it is. Where a version's whisker does not overlap the control's, the difference is real." />
              <ArmBars e={e} />
              {e.secondary && <><Box sx={{ borderTop: `1px solid ${HAIRLINE}` }} /><ArmBars e={e} arms={e.secondary.arms} metric={e.secondary.metric} /></>}
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <GlassCard sx={{ display: "grid", gap: 1.25, height: "100%", alignContent: "start" }}>
              <CardTitle icon={<GavelOutlinedIcon />} tint="pink" title="Outcome" />
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography sx={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: r.outcome === "won" ? GREEN : r.outcome === "lost" ? RED : INK }}>{liftText(r)}</Typography>
                <OutcomeChip o={r.outcome} />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                {r.best ? `${r.best.name} against the control: ${r.best.diff !== null ? `${r.best.diff > 0 ? "+" : ""}${(r.best.diff * 100).toFixed(1)} points` : "–"}, ${r.best.p !== null ? `${pct(r.best.p, 1)} likely by chance` : "not testable yet"}. ` : ""}
                {OUTCOME_LABEL[r.outcome]}{r.outcome === "too-early" ? " - each version needs 100 visitors before it is read." : "."}
              </Typography>
              {e.verdict && <Fact k="The tool says" v={e.verdict} />}
              {e.reported && <Fact k="Reported by the tool's own dashboard" v={e.reported} />}
              <Fact k="Decision" v={e.decision ? `${DECISION_LABEL[e.decision]}${e.decidedBy ? ` - ${e.decidedBy}, ${day(e.decidedAt)}` : ""}` : <Box component="span" sx={{ color: FAINT }}>Not decided yet</Box>} />
              <Fact k="What we learned" v={e.learning || <Box component="span" sx={{ color: FAINT }}>Nothing written down yet</Box>} />
              {e.notes && <Fact k="Notes" v={e.notes} />}
            </GlassCard>
          </Grid>
        </Grid>
      )}

      <GlassCard sx={{ display: "grid", gap: 0.75 }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Log" note={`Recorded ${day(e.createdAt)}${e.createdBy && e.createdBy !== "sync" ? ` by ${e.createdBy}` : ` from ${SOURCE_LABEL[e.source]}`}${e.syncedAt ? ` · last refreshed ${new Date(e.syncedAt).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}` : ""}`} />
        {d.log.length ? d.log.map((l, i) => (
          <Typography key={i} sx={{ fontSize: "0.8rem", color: INK }}>
            <Box component="span" sx={{ color: FAINT }}>{new Date(l.at).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}</Box> · {l.by ?? "the hub"} · {l.action}{l.detail ? ` - ${l.detail}` : ""}
          </Typography>
        )) : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Nobody changed anything on it yet.</Typography>}
        {d.canEdit && e.source === "manual" && <Box><Button size="small" color="error" sx={{ textTransform: "none", mt: 0.5 }} onClick={() => void remove()}>Take this test out of the record</Button></Box>}
        {err && <Notice tone="bad">{err}</Notice>}
      </GlassCard>
      {editing && <XpDialog open e={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}
