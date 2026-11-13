"use client";

// APSOconvert > PERFORMANCE - what the tests did, then the path every optimization takes, in the app's own structure
// (SARCLA 09.11.2026: "improve the Performance page to match the new structure"): Insights (the AI's optimizations, by type
// of content change) -> Preview (its version, before | after) -> Content (sent to be rebuilt) -> Tests -> Winners - each
// step a number that opens its page; the same optimizations by type of change; and the next yes each step waits for.
// Reads the same data as those pages, nothing of its own.

import { useMemo } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CompareOutlinedIcon from "@mui/icons-material/CompareOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { TrendChart } from "@/app/charts/TrendChart";
import type { Performance } from "@/lib/convert/perf";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, clip } from "@/app/uc/report/ui";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { ENVS } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";
import { CHANGE_TYPES, typeOfIdea, type ChangeType } from "@/lib/convert/changeTypes";
import { StatusChip, type TestView } from "./TestParts";
import { previewHref } from "./Flow";
import { CONVERT } from "./base";

const pctOf = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(2)}%`);
const TYPE_TONE: Record<ChangeType, string> = { "page-refresh": "#2459d1", "landing-page": "#6a46c9", banner: "#a96a12", newsletter: "#1b7a55", "blog-article": "#7a8699" };

function Step({ n, icon, title, value, line, href, tint, last }: {
  n: number; icon: React.ReactNode; title: string; value: string; line: string; href: string; tint: string; last?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
      <Box component={Link} href={href} sx={{
        flex: 1, minWidth: 0, display: "grid", alignContent: "start", gap: 0.5, p: 1.75, borderRadius: "14px", textDecoration: "none", color: "inherit",
        bgcolor: "rgba(255,255,255,.88)", border: `1px solid ${HAIRLINE}`, transition: "border-color .15s, transform .15s",
        "&:hover": { borderColor: tint, transform: "translateY(-1px)" },
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 26, height: 26, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: `${tint}1a`, color: tint, "& svg": { fontSize: 17 } }}>{icon}</Box>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>{n} · {title}</Typography>
        </Box>
        <Typography sx={{ fontSize: "1.7rem", fontWeight: 700, color: INK, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.35 }}>{line}</Typography>
      </Box>
      {!last && <Box sx={{ display: { xs: "none", lg: "grid" }, placeItems: "center", px: 0.5, color: "#c3cad6" }}><ArrowForwardIosIcon sx={{ fontSize: 14 }} /></Box>}
    </Box>
  );
}

export default function ConvertPerformance() {
  const board = useHeld<{ ideas: BoardRow[] }>("/api/website/ai-personalization/ideas", []);
  const tests = useHeld<{ tests: TestView[] }>("/api/website/ab-testing/pages", []);
  const perfHeld = useHeld<Performance>("/api/website/ai-personalization/performance", []);
  const perf = perfHeld.result?.state === "ok" ? perfHeld.result.data : null;
  const ideas = board.result?.state === "ok" ? board.result.data.ideas : null;
  const t = tests.result?.state === "ok" ? tests.result.data.tests.filter((x) => x.kind === "test") : null;

  const n = useMemo(() => {
    const live = (ideas ?? []).filter((i) => i.status !== "dropped");
    const sent = live.filter((i) => !!i.sentAt);
    return {
      waiting: ideas ? live.filter((i) => i.status === "proposed").length : null,
      pages: new Set(live.filter((i) => i.status === "proposed").map((i) => `${i.env}${i.path}`)).size,
      inWork: ideas ? live.filter((i) => i.status === "approved" && !i.sentAt).length : null,
      versions: live.filter((i) => !i.sentAt).reduce((s, i) => s + i.versions, 0),
      sent: ideas ? sent.length : null,
      sentVersions: sent.reduce((s, i) => s + i.versions, 0),
      running: t ? t.filter((x) => x.status === "running").length : null,
      drafts: (t ?? []).filter((x) => x.status === "draft").length,
      won: t ? t.filter((x) => x.winner === "b" && x.status !== "shipped").length : null,
      shipped: (t ?? []).filter((x) => x.status === "shipped").length,
      byType: CHANGE_TYPES.map((ct) => {
        const of = live.filter((i) => typeOfIdea(i) === ct.key);
        return { ...ct, waiting: of.filter((i) => i.status === "proposed").length, work: of.filter((i) => i.status === "approved" && !i.sentAt).length, sent: of.filter((i) => !!i.sentAt).length };
      }),
    };
  }, [ideas, t]);

  // WAITING FOR YOU - the next yes each step needs, with the button that does it
  const todo = useMemo(() => {
    const out: { key: string; tone: string; head: string; line: string; href: string; go: string }[] = [];
    const withTest = new Set((t ?? []).map((x) => x.versionId).filter(Boolean));
    for (const x of t ?? []) {
      if (x.winner === "b" && x.status !== "shipped") out.push({ key: `w${x.id}`, tone: "#1b7a55", head: "A version won its test", line: x.name, href: `${CONVERT}/ship?test=${x.id}`, go: "Publish it" });
    }
    for (const r of ideas ?? []) {
      if (r.status === "dropped") continue;
      // ready for its test while the optimization has none - any of its versions, or the one Content made for its to-do
      if (r.sentAt && r.version && r.kind !== "cms" && !r.test && !withTest.has(r.version.id)) out.push({ key: `t${r.id}`, tone: "#2459d1", head: "In Content - ready for its test", line: r.title, href: `${CONVERT}/tests?make=${r.version.id}`, go: "Make the test" });
      else if (!r.sentAt && r.versions > 0) out.push({ key: `s${r.id}`, tone: "#6a46c9", head: `${r.versions === 1 ? "Its version is" : `Its ${r.versions} versions are`} ready - send it to Content`, line: r.title, href: previewHref(r.env, r.path, r.id), go: "Open it" });
    }
    const waiting = (ideas ?? []).filter((r) => r.status === "proposed");
    if (waiting.length) out.push({ key: "decide", tone: "#a96a12", head: `${waiting.length} ${waiting.length === 1 ? "optimization waits" : "optimizations wait"} for a yes or no`, line: `on ${n.pages} ${n.pages === 1 ? "page" : "pages"} - the AI's, by type of change`, href: `${CONVERT}/insights`, go: "Insights" });
    return out.slice(0, 6);
  }, [ideas, t, n.pages]);

  const num = (v: number | null) => (v === null ? "…" : full(v));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Performance" subtitle="What the tests did - and the path of every optimization: Insights, Preview, Content, Tests, Winners" rightSlot={<WindowPicker />} />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" } }}>
        <KpiTile icon={<ScienceOutlinedIcon />} tint="blue" label="Tests launched" value={perf ? full(perf.launched) : "…"} note={perf ? `${perf.drafts} ${perf.drafts === 1 ? "draft" : "drafts"} not started` : undefined} />
        <KpiTile icon={<EmojiEventsOutlinedIcon />} tint="green" label="Winning versions" value={perf ? full(perf.winning) : "…"} note="the version beat the page as it is" />
        <KpiTile icon={<TimerOutlinedIcon />} tint="purple" label="Tests in progress" value={perf ? full(perf.inProgress) : "…"} note="running or paused on the shop" />
      </Box>

      {/* the path, in the app's order */}
      <Box sx={{ display: "grid", gap: { xs: 1.25, lg: 0 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(5, minmax(0,1fr))" } }}>
        <Step n={1} icon={<AutoAwesomeOutlinedIcon />} tint="#6a46c9" title="Insights" value={num(n.waiting)} line={`optimizations to decide, on ${n.pages} ${n.pages === 1 ? "page" : "pages"}`} href={`${CONVERT}/insights`} />
        <Step n={2} icon={<PreviewOutlinedIcon />} tint="#2459d1" title="Preview" value={num(n.inWork)} line={`in work · ${full(n.versions)} ${n.versions === 1 ? "version" : "versions"} made`} href={`${CONVERT}/insights`} />
        <Step n={3} icon={<SendOutlinedIcon />} tint="#c2185b" title="Content" value={num(n.sent)} line={`sent to Content to be rebuilt · ${full(n.sentVersions)} ${n.sentVersions === 1 ? "version" : "versions"}`} href="/projects" />
        <Step n={4} icon={<CompareOutlinedIcon />} tint="#a96a12" title="Tests" value={num(n.running)} line={`running on the shop · ${n.drafts} ${n.drafts === 1 ? "draft" : "drafts"}`} href={`${CONVERT}/tests`} />
        <Step n={5} icon={<EmojiEventsOutlinedIcon />} tint="#1b7a55" title="Winners" value={num(n.won)} line={`to publish from Content · ${n.shipped} published`} href={`${CONVERT}/ship`} last />
      </Box>

      {todo.length > 0 && (
        <GlassCard>
          <CardTitle icon={<PendingActionsOutlinedIcon />} tint="amber" title={`Waiting for you · ${todo.length}`} note="Nothing moves on the shop without a person's yes - these are the next ones" />
          <Box sx={{ display: "grid", gap: 0.75, mt: 1.25, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2, minmax(0,1fr))" } }}>
            {todo.map((x) => (
              <Box key={x.key} sx={{ display: "flex", gap: 1.25, alignItems: "center", p: 1.1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)", minWidth: 0 }}>
                <Box sx={{ width: 4, alignSelf: "stretch", borderRadius: "2px", bgcolor: x.tone, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{x.head}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, ...clip(9999) }} title={x.line}>{x.line}</Typography>
                </Box>
                <Button size="small" variant="outlined" component={Link} href={x.href} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700, flexShrink: 0 }}>{x.go}</Button>
              </Box>
            ))}
          </Box>
        </GlassCard>
      )}

      {/* the same optimizations, by type of content change - Content's own types */}
      <GlassCard>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="By type of change" note="The AI's optimizations as Content makes them - each opens Insights on its type" />
        <Box sx={{ display: "grid", gap: 1.25, mt: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" } }}>
          {n.byType.map((x) => {
            const tone = TYPE_TONE[x.key];
            const total = x.waiting + x.work + x.sent;
            return (
              <Box key={x.key} component={x.soon ? "div" : Link} href={x.soon ? undefined : `${CONVERT}/insights?type=${x.key}`} sx={{
                display: "grid", gap: 0.5, alignContent: "start", p: 1.5, borderRadius: "12px", textDecoration: "none", color: "inherit",
                border: `1px solid ${HAIRLINE}`, borderTop: `3px solid ${tone}`, bgcolor: "rgba(255,255,255,.8)", opacity: x.soon ? 0.6 : 1,
                transition: "box-shadow .15s", "&:hover": x.soon ? {} : { boxShadow: "0 8px 22px rgba(21,34,58,.1)" },
              }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: tone }}>{x.label}</Typography>
                <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: INK, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{x.soon ? "–" : full(total)}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 }}>{x.soon ? "to come on the shop" : `${x.waiting} to decide · ${x.work} in work · ${x.sent} in Content`}</Typography>
              </Box>
            );
          })}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="Add-to-cart rate" note="The versions against the pages as they are - every test's visitors with statistics consent; the tests count add-to-carts, not revenue" />
        <Box sx={{ display: "grid", gap: 1.5, mt: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" } }}>
          {[
            { k: "With the versions", v: pctOf(perf?.rateB ?? null), sub: `${full(perf?.visitors.b ?? 0)} visitors` },
            { k: "On the pages as they are", v: pctOf(perf?.rateA ?? null), sub: `${full(perf?.visitors.a ?? 0)} visitors` },
            { k: "Extra add-to-carts", v: perf?.extra == null ? "–" : `${perf.extra >= 0 ? "+" : ""}${full(perf.extra)}`, sub: "the versions brought" },
            { k: "Uplift", v: perf?.uplift == null ? "–" : `${perf.uplift >= 0 ? "+" : ""}${(perf.uplift * 100).toFixed(1)}%`, sub: "cart rate, version / original" },
          ].map((c) => (
            <Box key={c.k} sx={{ p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)", textAlign: "center" }}>
              <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{c.v}</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: INK }}>{c.k}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{c.sub}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2 }}>
          {perf && perf.weeks.length > 0
            ? <TrendChart data={perf.weeks.map((w) => ({ x: w.week, value: w.rateB, compare: w.rateA }))} seriesLabel="With the versions" compareLabel="As they are" format={(v) => pctOf(v)} xFormat={(x) => `Week of ${x.slice(8, 10)}.${x.slice(5, 7)}.`} height={240} />
            : <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2, textAlign: "center" }}>{perf ? "No test has counted visitors yet - the weekly curve starts with the first test on the shop." : "Reading the tests…"}</Typography>}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<CompareOutlinedIcon />} tint="blue" title="Tests" note="A version against the page as it is"
          right={<Button size="small" component={Link} href={`${CONVERT}/tests`} sx={{ textTransform: "none", fontWeight: 600 }}>All tests</Button>} />
        <Box sx={{ display: "grid", gap: 0.5, mt: 1.25 }}>
          {t && t.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No test yet - an optimization in Content goes to a test from its Preview.</Typography>}
          {(t ?? []).slice(0, 5).map((x) => (
            <Box key={x.id} component={Link} href={`${CONVERT}/tests/${x.id}`} sx={{ display: "flex", gap: 1, alignItems: "center", p: 1, borderRadius: "8px", textDecoration: "none", color: "inherit", minWidth: 0, "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
              <StatusChip status={x.status} kind={x.kind} />
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clip(9999), flex: 1 }}>{x.name}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{ENVS[x.env].label}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
    </Box>
  );
}
