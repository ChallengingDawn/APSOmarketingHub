"use client";

// Website > A/B testing > ONE PAGE TEST. The verdict first, in one sentence; then each variant's cart rate with its 95%
// interval, the uplift with its interval, how likely the version is the better one, day by day (and the split over
// time under the bandit), the segments (device, store view, signed in or not, new or returning, where they came from);
// the settings, the version that runs, and who did what. Starting is the approval that puts the version on the shop:
// its confirm says what goes live where (src/lib/convert/tests.ts).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import PieChartOutlineOutlinedIcon from "@mui/icons-material/PieChartOutlineOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ReportGmailerrorredOutlinedIcon from "@mui/icons-material/ReportGmailerrorredOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ENVS, KIND_LABEL } from "@/lib/convert/model";
import { allocationWords, audienceWords, shareWords, type Audience, type Results } from "@/lib/convert/contract";
import { RULES, SEGMENT_LABEL, VERDICT_TINT, type Analysis, type SegmentDim } from "@/lib/convert/stats";
import { OP_LABEL, describe, type Change } from "@/lib/convert/versions";
import { convertPost, previewHref } from "../../../ai-personalization/Flow";
import { SquareChoice } from "../../../ai-personalization/SquareChoice";
import { testsBase, useInConvert } from "../../../ai-personalization/base";
import {
  AudienceBuilder, COLOR, ConfirmDialog, DailyCharts, Gauge, GatewayNotice, IntervalBars, NAME, PagePicker, StatusChip, UpliftBar,
  dayTime, envChip, n, pagesLine, pct, signed, splitKeyOf, splitOf, type Confirm, type GatewayView, type SplitKey, type TestView,
} from "../../../ai-personalization/TestParts";

const API = "/api/website/ab-testing/pages";
type Detail = {
  test: TestView & { changes: Change[] };
  idea: { id: string; title: string; why: string; change: string; expect: string; numbers: { rate?: number | null } | null } | null;
  version: { rev: number; status: string; summary: string; approvedBy: string | null; approvedAt: string | null; path: string; env: string } | null;
  results: Results | null; resultsAt: string | null; resultsLive: boolean; resultsError: string | null;
  analysis: Analysis | null;
  liveWeights: { a: number; b: number } | null;
  drift: "missing" | "behind" | null;
  gateway: GatewayView;
  history: { at: string; by: string | null; action: string; detail: string }[];
  shippedAs: { id: string; status: string } | null;
  copies: { id: string; env: string; status: string; name: string }[];
  canEdit: boolean;
};
const since = (iso: string | null) => (iso ? ago(Date.parse(iso) / 1000) : "–");
const MDES = [{ key: "0.05", label: "5%" }, { key: "0.1", label: "10%" }, { key: "0.2", label: "20%" }, { key: "0.3", label: "30%" }];
const LABEL = { fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" as const, letterSpacing: ".04em" };

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "160px minmax(0,1fr)" }, gap: { xs: 0.25, sm: 1.5 }, py: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>{k}</Typography>
      <Box sx={{ fontSize: "0.84rem", color: INK, minWidth: 0, wordBreak: "break-word" }}>{children}</Box>
    </Box>
  );
}

/** A draft's conditions, changed before it starts. */
function DraftSettings({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const t = d.test;
  const [env, setEnv] = useState(t.env);
  const [pages, setPages] = useState<string[]>(t.pages);
  const [split, setSplit] = useState<SplitKey>(splitKeyOf(t.allocation));
  const [floor, setFloor] = useState(String(t.allocation.floor || 10));
  const [aud, setAud] = useState<Audience>(t.audience);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const r = await convertPost(API, { action: "settings", id: t.id, env, pages, allocation: splitOf(split, Number(floor)), audience: aud });
    setBusy(false);
    if (!r.ok) setErr(r.error); else onSaved();
  };
  return (
    <Box sx={{ display: "grid", gap: 1.5, mt: 1 }}>
      <SquareChoice label="Where" value={env} onChange={(e) => { setEnv(e); setPages([]); }} options={[{ key: "acc", label: "ACC first" }, { key: "prod", label: "Production" }]} />
      {t.versionId && <PagePicker api={API} versionId={t.versionId} env={env} value={pages} onChange={setPages} />}
      <SquareChoice<SplitKey> label="Visitors" value={split} onChange={setSplit} options={[{ key: "half", label: "Half and half" }, { key: "30", label: "30% get it" }, { key: "bandit", label: "More to the better one" }]} />
      {split === "bandit" && <SquareChoice label="Each keeps at least" value={floor} onChange={setFloor} options={[{ key: "5", label: "5%" }, { key: "10", label: "10%" }, { key: "20", label: "20%" }]} />}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={LABEL}>Who takes part</Typography>
        <AudienceBuilder value={aud} onChange={setAud} stores={["de-CH", "fr-CH", "it-CH", "en-CH", "fr-FR", "it-IT", "nl-NL", "pl-PL"]} />
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="small" variant="contained" disableElevation disabled={busy} onClick={() => void save()} startIcon={busy ? <CircularProgress size={13} color="inherit" /> : undefined}>Save the draft</Button>
        {err && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{err}</Typography>}
      </Box>
    </Box>
  );
}

function Detailed({ d, reload }: { d: Detail; reload: () => void }) {
  const base = testsBase(useInConvert());
  const t = d.test;
  const an = d.analysis;
  const c = an?.comparison ?? null;
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dim, setDim] = useState<SegmentDim>("device");
  const [editing, setEditing] = useState(false);
  const [mdeBusy, setMdeBusy] = useState(false);

  const run = async (body: Record<string, unknown>, after?: (data: { id: string | null }) => void): Promise<boolean> => {
    setErr(null);
    const r = await convertPost<{ id: string | null }>(API, { id: t.id, ...body });
    if (!r.ok) { setErr(r.error); return true; }
    if (after) after(r.data); else reload();
    return true;
  };
  const changesLine = `revision ${t.status === "draft" && d.version ? d.version.rev : t.versionRev}, ${t.changeCount} ${t.changeCount === 1 ? "change" : "changes"}`;
  const startLines = [
    <>The version ({changesLine}) goes live on <b>{t.host}</b> for <b>{shareWords(t.allocation)}</b> who give statistics consent (or where none is asked){audienceWords(t.audience) === "Everyone" ? "" : <> - only <b>{audienceWords(t.audience)}</b></>}, on:</>,
    pagesLine(t.host, t.pages),
    "Starting is the approval: the shop's gateway runs it within a minute. Pause or stop it any time; the page is then as it is for everyone.",
    // SARCLA 08.11.2026: "Webyn doesn't change any page until a human says so and accepts" - so the one rule is a person's
    "Webyn: accept no Webyn change on these pages while the test runs - both at once and the figures cannot say which one did it.",
  ];
  const ask = {
    start: () => setConfirm({ title: `Start the test on ${ENVS[t.env].label}?`, lines: startLines, go: "Start the test", run: () => run({ action: "start" }) }),
    pause: () => setConfirm({ title: "Pause the test?", lines: ["Every visitor sees the page as it is until it is resumed. The figures stay and go on when it is resumed."], go: "Pause", run: () => run({ action: "pause" }) }),
    resume: () => setConfirm({ title: `Resume the test on ${ENVS[t.env].label}?`, lines: startLines, go: "Resume", run: () => run({ action: "resume" }) }),
    stop: () => setConfirm({ title: "Stop the test?", lines: ["Every visitor sees the page as it is from now on. The figures stay; it can be restarted (counted from zero)."], go: "Stop the test", tone: "stop", run: () => run({ action: "stop" }) }),
    restart: () => setConfirm({ title: "Restart, counted from zero?", lines: [<>A new round (round {t.v + 1}): every visitor gets a variant again and the figures start from zero. It runs the version as it is approved now.</>, ...startLines.slice(0, 2)], go: "Restart", run: () => run({ action: "restart" }) }),
    sync: () => setConfirm({ title: "Send it to the shop's gateway again?", lines: ["The hub's record of this test is handed to the gateway as it is - for when the gateway lost it or holds an older round."], go: "Send again", run: () => run({ action: "sync" }) }),
    remove: () => setConfirm({ title: "Take it off the shop's gateway?", lines: ["Its setting is removed from the gateway; the visitors counted stay there for the record and the figures here stay as last read."], go: "Take it off", tone: "stop", run: () => run({ action: "remove" }) }),
    del: () => setConfirm({ title: "Delete this draft?", lines: ["It never ran - nothing on the shop changes. The version stays approved and waits for a test again."], go: "Delete", tone: "stop", run: () => run({ action: "delete" }, () => { window.location.href = base; }) }),
    decide: (w: "a" | "b" | "none") => setConfirm({
      title: w === "b" ? "End it: the version won?" : w === "a" ? "End it: the page as it is won?" : "End it: no real difference?",
      lines: [
        t.status !== "stopped" ? "The test stops - every visitor sees the page as it is." : "The test is stopped already.",
        w === "b" ? "The version then waits in Ship: kept on for everyone, as code for dotSource, or written into a Magento CMS page." : "The version is not shipped; its figures stay here.",
        c ? `So far: ${pct(c.a.rate, 2)} for the original, ${pct(c.b.rate, 2)} for the version, ${c.pBest ? `${pct(c.pBest.b, 0)} likely the version is better` : "no comparison yet"}.` : "",
      ].filter(Boolean),
      go: "End it", tone: w === "b" ? "go" : "stop", run: () => run({ action: "decide", winner: w }),
    }),
    copy: (env: "acc" | "prod") => setConfirm({ title: `Copy it as a new draft on ${ENVS[env].label}?`, lines: [`The same version, pages and split, as a draft on ${env === "prod" ? "www.apsoparts.com" : "acc.apsoparts.com"} - nothing starts until somebody starts it.`], go: "Make the copy", run: () => run({ action: "copy", env }, (x) => { if (x.id) window.location.href = `${base}/${x.id}`; }) }),
  };

  const verdictLine = (() => {
    if (t.status === "draft") return { tint: "slate" as const, head: "Not started", text: `Nothing is on the shop yet. Starting it puts the version on ${t.pages.length} ${t.pages.length === 1 ? "page" : "pages"} of ${ENVS[t.env].label}, for ${shareWords(t.allocation)}.` };
    if (t.winner) return {
      tint: t.winner === "b" ? "green" as const : "slate" as const,
      head: t.winner === "b" ? "The version won" : t.winner === "a" ? "The original won" : "No real difference",
      text: `Decided by ${t.decidedBy ?? "someone"} on ${dayTime(t.decidedAt)}.${t.winner === "b" ? (t.status === "shipped" ? " It is shipped - see Ship." : " It waits in Ship.") : ""}`,
    };
    if (!an) return { tint: "slate" as const, head: t.status === "paused" ? "Paused" : "No figures yet", text: d.resultsError ?? "The shop's gateway has counted nobody in this round yet." };
    return { tint: VERDICT_TINT[an.verdict.key], head: an.verdict.text, text: an.verdict.why };
  })();
  const bandit = t.allocation.mode === "bandit";
  const segs = (an?.segments ?? []).filter((s) => s.dim === dim);
  const dims = useMemo(() => (["device", "store", "login", "visitor", "source"] as SegmentDim[]).map((k) => ({ key: k, label: SEGMENT_LABEL[k], count: (an?.segments ?? []).filter((s) => s.dim === k).length })), [an]);
  const weights = d.liveWeights ?? d.results?.weights ?? null;

  return (
    <>
      <GatewayNotice g={d.gateway} />
      {d.drift && <Notice tone="bad">{d.drift === "missing" ? "The shop's gateway does not hold this test although it is running here" : "The shop's gateway holds an older round or another state of this test"} - send it again (below).</Notice>}
      {t.syncError && <Notice tone="bad">The last hand-over to the shop&apos;s gateway failed: {t.syncError}</Notice>}
      {d.resultsError && t.status !== "draft" && d.gateway.configured && <Notice tone="warn">{d.resultsError}{d.resultsAt ? ` - the figures below are from ${dayTime(d.resultsAt)}.` : ""}</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}

      {/* the verdict, and what can be done */}
      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 420px", minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 0.75 }}>
              <StatusChip status={t.status} kind={t.kind} />
              {envChip(t.env)}
              <Chip tint="slate">{KIND_LABEL[t.pageKind]}</Chip>
              {t.status !== "draft" && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Round {t.v} · started {dayTime(t.startedAt)}{t.startedBy ? ` by ${t.startedBy}` : ""}</Typography>}
            </Box>
            <Typography sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" }, fontWeight: 700, color: verdictLine.tint === "green" ? GREEN : verdictLine.tint === "pink" ? RED : INK, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {verdictLine.head}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: INK, mt: 0.5 }}>{verdictLine.text}</Typography>
            {an && t.status !== "draft" && !t.winner && an.verdict.key === "running" && an.verdict.moreDays !== null && an.verdict.moreDays > 0 && (
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>At the traffic so far: about {n(an.verdict.moreDays)} more {an.verdict.moreDays === 1 ? "day" : "days"}.</Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flex: "1 1 300px" }}>
            <Button size="small" component={Link} href={previewHref(t.env, t.pages[0], t.ideaId ?? undefined)}>See it</Button>
            {d.canEdit && t.status === "draft" && <>
              <Button size="small" onClick={() => setEditing((x) => !x)}>{editing ? "Close the settings" : "Change the settings"}</Button>
              <Button size="small" color="error" onClick={ask.del}>Delete</Button>
              <Button size="small" variant="contained" disableElevation disabled={!d.gateway.configured} onClick={ask.start}>Start the test</Button>
            </>}
            {d.canEdit && t.status === "running" && <>
              <Button size="small" onClick={ask.pause}>Pause</Button>
              <Button size="small" onClick={ask.restart}>Restart</Button>
              <Button size="small" color="error" onClick={ask.stop}>Stop</Button>
            </>}
            {d.canEdit && t.status === "paused" && <>
              <Button size="small" onClick={ask.restart}>Restart</Button>
              <Button size="small" color="error" onClick={ask.stop}>Stop</Button>
              <Button size="small" variant="contained" disableElevation onClick={ask.resume}>Resume</Button>
            </>}
            {d.canEdit && t.status === "stopped" && <>
              <Button size="small" onClick={ask.restart}>Restart</Button>
              <Button size="small" onClick={() => ask.copy(t.env === "acc" ? "prod" : "acc")}>{t.env === "acc" ? "Copy to production" : "Copy to ACC"}</Button>
              <Button size="small" onClick={ask.remove}>Take it off the gateway</Button>
            </>}
            {d.canEdit && d.drift && <Button size="small" variant="outlined" onClick={ask.sync}>Send it again</Button>}
            {(t.status === "shipped" || (t.winner === "b" && t.status === "stopped")) && <Button size="small" variant="contained" disableElevation component={Link} href="/website/ai-personalization/ship">Open in Ship</Button>}
          </Box>
        </Box>
        {d.canEdit && !t.winner && (t.status === "running" || t.status === "paused" || t.status === "stopped") && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", mt: 1.5, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mr: 0.5 }}>End it with a decision:</Typography>
            <Button size="small" variant={an?.verdict.key === "b-wins" ? "contained" : "outlined"} color="success" disableElevation onClick={() => ask.decide("b")}>The version won</Button>
            <Button size="small" variant={an?.verdict.key === "a-wins" || an?.verdict.key === "harm" ? "contained" : "outlined"} disableElevation onClick={() => ask.decide("a")}>The original won</Button>
            <Button size="small" variant={an?.verdict.key === "no-difference" ? "contained" : "outlined"} disableElevation onClick={() => ask.decide("none")}>No difference</Button>
            {an && !an.verdict.decided && <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>The figures have not decided yet - a winner needs {Math.round(RULES.winP * 100)}% certainty, a small risk if it is the wrong pick, {RULES.minVisitors} visitors each, {RULES.minCarts} add-to-carts in all and {RULES.minDays} days.</Typography>}
          </Box>
        )}
        {editing && t.status === "draft" && <DraftSettings d={d} onSaved={() => { setEditing(false); reload(); }} />}
      </GlassCard>

      {c && (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="blue" label="Visitors" value={n(c.a.visitors + c.b.visitors)} note={`original ${n(c.a.visitors)} · version ${n(c.b.visitors)}`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="green" label="Put something in the cart" value={n(c.a.carts + c.b.carts)} note={`original ${n(c.a.carts)} · version ${n(c.b.carts)}`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CalendarMonthOutlinedIcon />} tint="purple" label="Days running" value={n(an!.days)} note={`a winner needs ${RULES.minDays}+ days`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ReportGmailerrorredOutlinedIcon />} tint={(d.results?.variants ?? []).some((v) => v.applyMisses) ? "amber" : "slate"} label="Changes that missed" value={n((d.results?.variants ?? []).reduce((s, v) => s + v.applyMisses, 0))} note="page views where a change found no element" /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title="Cart rate" note="Visitors who put something in the cart on the page - the dot, and where the true rate lies with 95% certainty" />
                <IntervalBars a={c.a} b={c.b} />
                <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
                  <Typography sx={{ ...LABEL, mb: 0.75 }}>The version against the original</Typography>
                  <UpliftBar u={c.uplift} mde={t.mde} />
                </Box>
              </GlassCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<GavelOutlinedIcon />} tint="purple" title="How sure" note="From every visitor counted so far" />
                <Gauge p={c.pBest?.b ?? null} />
                <Box sx={{ display: "grid", gap: 0.75, mt: 2 }}>
                  {c.loss && (
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                      If we keep the version and it is the wrong pick, we give away {(c.loss.b * 100).toFixed(2)} percentage points of cart rate on average; keeping the original, {(c.loss.a * 100).toFixed(2)}.
                    </Typography>
                  )}
                  <SquareChoice label="Smallest uplift worth it" value={String(t.mde)} onChange={async (v) => {
                    if (!d.canEdit) return;
                    setMdeBusy(true);
                    await run({ action: "settings", mde: Number(v) });
                    setMdeBusy(false);
                  }} options={MDES.map((m) => ({ ...m, disabled: !d.canEdit || mdeBusy }))} />
                  <Typography sx={{ fontSize: "0.8rem", color: INK }}>
                    {an!.verdict.needed === null
                      ? "The visitors needed show once the original has an add-to-cart rate."
                      : <>To see {Math.round(t.mde * 100)}% more add-to-carts takes about <b>{n(an!.verdict.needed)}</b> visitors per variant{t.status !== "running" && t.status !== "paused" ? "" : an!.verdict.more.a || an!.verdict.more.b ? <> - <b>{n(Math.max(an!.verdict.more.a, an!.verdict.more.b))}</b> more to come</> : " - reached"}.</>}
                  </Typography>
                </Box>
              </GlassCard>
            </Grid>
          </Grid>

          <GlassCard>
            <CardTitle icon={<TimelineOutlinedIcon />} tint="green" title="Day by day" note={bandit ? `Under the bandit the version's share moves with the results (now ${weights ? pct(weights.b, 0) : "–"}); never under ${t.allocation.floor}% for either` : "Visitors counted each day, and each variant's cart rate up to that day"} />
            <DailyCharts daily={an!.daily} bandit={bandit} history={d.results?.weightsHistory ?? []} />
          </GlassCard>

          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25 }}>
              <CardTitle icon={<PieChartOutlineOutlinedIcon />} tint="amber" title="By segment" note="Where the version does better or worse - a segment with fewer than 100 visitors in a variant says little" />
              <SquareChoice<SegmentDim> label="By" value={dim} onChange={setDim} options={dims} />
            </Box>
            <Box sx={{ overflowX: "auto", mt: 1.5 }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow>{["Segment", "Visitors (original · version)", "Cart rate (original / version)", "Uplift", "Version better"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {segs.length === 0 && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>Nothing counted by {SEGMENT_LABEL[dim].toLowerCase()} yet.</TableCell></TableRow>}
                  {segs.map((s) => (
                    <TableRow key={`${s.dim}:${s.value}`} sx={{ opacity: s.few ? 0.62 : 1 }}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600 }}>{s.label}{s.few && <Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 400 }}> · few</Typography>}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n(s.a.visitors)} · {n(s.b.visitors)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(s.a.rate, 1)} / <b style={{ color: COLOR.b }}>{pct(s.b.rate, 1)}</b></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontWeight: 700, color: s.uplift === null ? MUTED : s.uplift >= 0 ? GREEN : RED, fontVariantNumeric: "tabular-nums" }}>{signed(s.uplift)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.pB === null ? "–" : pct(s.pB, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>
        </>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
            <CardTitle icon={<TuneOutlinedIcon />} tint="slate" title="The settings" note={t.status === "draft" ? "A draft's settings can change until it starts" : "A test keeps the settings it started with - copy it to change them"} />
            <Row k="Where">{t.host} {envChip(t.env)}</Row>
            <Row k={`Pages · ${t.pages.length}`}>
              <Box sx={{ display: "grid", gap: 0.25 }}>
                {t.pages.map((p) => <Box key={p} component={Link} href={previewHref(t.env, p, t.ideaId ?? undefined)} sx={{ color: ACCENT, textDecoration: "none", fontSize: "0.8rem", ...clip(560) }} title={p}>{p}</Box>)}
              </Box>
            </Row>
            <Row k="Visitors">{allocationWords(t.allocation)}{bandit && weights ? ` · now ${pct(weights.b, 0)} get the version` : ""}</Row>
            <Row k="Who takes part">{audienceWords(t.audience)} <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>· with statistics consent only</Typography></Row>
            <Row k="Goal">The first add-to-cart on the page view</Row>
            <Row k="Made">{t.createdBy ?? "–"} · {dayTime(t.createdAt)}</Row>
            {d.copies.length > 0 && <Row k="Copies">{d.copies.map((x) => <Box key={x.id} component={Link} href={`${base}/${x.id}`} sx={{ color: ACCENT, textDecoration: "none", mr: 1.5, fontSize: "0.82rem" }}>#{x.id} on {x.env === "prod" ? "production" : "ACC"} ({x.status})</Box>)}</Row>}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
            <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="purple" title={`The version · revision ${t.versionRev}`} note={d.idea?.title ?? "The change list the shop lays over the page"} />
            {d.version && t.status === "draft" && d.version.status !== "approved" && <Box sx={{ mb: 1 }}><Notice tone="warn">The version was changed after it was approved - approve it again in the Preview before starting.</Notice></Box>}
            {d.version && t.status !== "draft" && d.version.rev !== t.versionRev && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>The version is at revision {d.version.rev} now; this test runs revision {t.versionRev}, as it was approved when it started.</Typography>}
            {d.version?.summary && <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 1 }}>{d.version.summary}</Typography>}
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {t.changes.map((ch, i) => (
                <Box key={i} sx={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 1, alignItems: "center" }}>
                  <Chip tint="slate">{OP_LABEL[ch.op]}</Chip>
                  <Typography sx={{ fontSize: "0.8rem", color: INK, ...clip(520) }} title={"selector" in ch ? ch.selector : undefined}>{describe(ch)}</Typography>
                </Box>
              ))}
            </Box>
            {d.idea?.why && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}><b>Why</b> {d.idea.why}</Typography>}
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Who did what" />
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {d.history.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing yet.</Typography>}
          {d.history.map((h, i) => (
            <Box key={i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "150px 150px minmax(0,1fr)" }, gap: { xs: 0, sm: 1.5 }, py: 0.6, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{dayTime(h.at)}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: INK, fontWeight: 600 }}>{h.by ?? "–"} · {h.action}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, wordBreak: "break-word" }}>{h.detail}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
        Counted by the shop&apos;s gateway: one visitor per browser, only with statistics consent; no name, e-mail or address is kept. {d.resultsAt ? `Figures read ${since(d.resultsAt)}.` : ""} {NAME.a} = the page as it is.
      </Typography>
      <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

export default function PageTest() {
  const base = testsBase(useInConvert());
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const [tick, setTick] = useState(0);
  const url = /^\d+$/.test(id) ? `${API}/${id}?n=${tick}` : null;
  const held = useHeld<Detail>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  let body: React.ReactNode;
  if (!url) body = <Notice tone="bad">No such test.</Notice>;
  else if (r === null) body = <LoadingPanel label="Reading the test and its figures…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Page test" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  else body = <Detailed d={r.data} reload={() => setTick((x) => x + 1)} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title={d ? d.test.name : "Page test"}
        subtitle={d ? `Page test #${d.test.id} on ${ENVS[d.test.env].label} · ${d.test.pages.length} ${d.test.pages.length === 1 ? "page" : "pages"} · ${allocationWords(d.test.allocation).toLowerCase()}` : undefined}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button size="small" component={Link} href={base}>All page tests</Button>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
