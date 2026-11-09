"use client";

// APSOconvert > OVERVIEW - the whole loop on one page, the way Webyn opens (SARCLA 08.11.2026: "look at Webyn even menu
// speaking"): where buyers are lost (Insights), what is proposed (Ideas), what is built (Preview), what is tested
// (Tests), what won (Ship) - each a number that opens its page; then the pages that lose the most, shown as they look,
// the pages in work and the tests. Reads the same data as those pages, nothing of its own.

import { useMemo } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import TroubleshootOutlinedIcon from "@mui/icons-material/TroubleshootOutlined";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import CompareOutlinedIcon from "@mui/icons-material/CompareOutlined";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { TrendChart } from "@/app/charts/TrendChart";
import type { Performance } from "@/lib/convert/perf";
import type { Brief } from "@/lib/convert/brief";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, clip } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { ENVS, KIND_LABEL, type Env, type PageKind } from "@/lib/convert/model";
import type { ProblemsData } from "@/lib/convert/problems";
import type { BoardRow } from "@/lib/convert/studio";
import { Chip } from "./Tag";
import { PageShot } from "./PageShot";
import { StatusChip, type TestView } from "./TestParts";
import { previewHref } from "./Flow";
import { CONVERT } from "./base";

const pctOf = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(2)}%`);
const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);
const KIND_TINT: Record<PageKind, "green" | "blue" | "purple" | "amber" | "slate"> = { product: "green", category: "blue", home: "purple", cms: "amber", system: "slate" };

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

export default function ConvertOverview() {
  const { window: win } = useReportingWindow();
  const probUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const prob = useHeld<ProblemsData>(probUrl, [probUrl]);
  const board = useHeld<{ ideas: BoardRow[] }>("/api/website/ai-personalization/ideas", []);
  const tests = useHeld<{ tests: TestView[] }>("/api/website/ab-testing/pages", []);
  const perfHeld = useHeld<Performance>("/api/website/ai-personalization/performance", []);
  const perf = perfHeld.result?.state === "ok" ? perfHeld.result.data : null;
  const p = prob.result?.state === "ok" ? prob.result.data : null;
  const ideas = board.result?.state === "ok" ? board.result.data.ideas : null;
  const t = tests.result?.state === "ok" ? tests.result.data.tests.filter((x) => x.kind === "test") : null;
  // the AI's reading of the period's problem pages (Insights > What stops buyers), when somebody asked for it
  const briefUrl = `/api/website/ai-personalization/problems/brief?from=${win.from}&to=${win.to}`;
  const briefHeld = useHeld<{ brief: Brief | null }>(briefUrl, [briefUrl]);
  const brief = briefHeld.result?.state === "ok" ? briefHeld.result.data.brief : null;

  const n = useMemo(() => {
    const flagged = (p?.pages ?? []).filter((x) => x.reasons.length > 0);
    const live = (ideas ?? []).filter((i) => i.status !== "dropped");
    return {
      flagged: p ? flagged.length : null,
      missed: flagged.reduce((s, x) => s + x.missed, 0),
      lost: (p?.pages ?? []).reduce((s, x) => s + (x.shop?.lost ?? 0), 0),
      top: [...flagged].sort((a, b) => b.missed - a.missed || (b.shop?.lost ?? 0) - (a.shop?.lost ?? 0)).slice(0, 3),
      waiting: ideas ? live.filter((i) => i.status === "proposed").length : null,
      approved: live.filter((i) => i.status === "approved" && !i.version).length,
      shaping: live.filter((i) => i.version && i.version.status !== "approved").length,
      ready: ideas ? live.filter((i) => i.version?.status === "approved").length : null,
      running: t ? t.filter((x) => x.status === "running").length : null,
      drafts: (t ?? []).filter((x) => x.status === "draft").length,
      won: t ? t.filter((x) => x.winner === "b" && x.status !== "shipped").length : null,
      shipped: (t ?? []).filter((x) => x.status === "shipped").length,
    };
  }, [p, ideas, t]);

  // the pages in work, newest first (their ideas and versions)
  const worked = useMemo(() => {
    const by = new Map<string, { env: Env; path: string; kind: PageKind; ideas: number; ready: number; last: string; top: string }>();
    for (const r of ideas ?? []) {
      if (r.status === "dropped") continue;
      const k = `${r.env}${r.path}`;
      const at = r.version?.updatedAt ?? r.decidedAt ?? r.createdAt;
      const g = by.get(k) ?? { env: r.env, path: r.path, kind: r.kind, ideas: 0, ready: 0, last: at, top: r.title };
      g.ideas += 1;
      if (r.version?.status === "approved") g.ready += 1;
      if (at > g.last) { g.last = at; g.top = r.title; }
      by.set(k, g);
    }
    return [...by.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 5);
  }, [ideas]);

  // WAITING FOR YOU - the next yes each step needs, as Webyn's recommendations read: the page's ideas to decide, a
  // version ready for its test, a winner to ship - each with the button that does it
  const todo = useMemo(() => {
    const out: { key: string; tone: string; head: string; line: string; href: string; go: string }[] = [];
    const withTest = new Set((t ?? []).map((x) => x.versionId).filter(Boolean));
    for (const x of t ?? []) {
      if (x.winner === "b" && x.status !== "shipped") out.push({ key: `w${x.id}`, tone: "#1b7a55", head: "A version won", line: x.name, href: `${CONVERT}/ship`, go: "Hand it to Content" });
    }
    for (const r of ideas ?? []) {
      if (r.version?.status === "approved" && !withTest.has(r.version.id)) out.push({ key: `v${r.version.id}`, tone: "#2459d1", head: "Ready for its test", line: r.title, href: `${CONVERT}/tests?make=${r.version.id}`, go: "Make the test" });
    }
    const waiting = new Map<string, { env: Env; path: string; n: number; top: string }>();
    for (const r of ideas ?? []) {
      if (r.status !== "proposed") continue;
      const k = `${r.env}${r.path}`;
      const g = waiting.get(k) ?? { env: r.env, path: r.path, n: 0, top: r.title };
      g.n += 1;
      waiting.set(k, g);
    }
    for (const [k, g] of waiting) out.push({ key: `i${k}`, tone: "#a96a12", head: `${g.n} ${g.n === 1 ? "optimization waits" : "optimizations wait"} for a yes or no`, line: `${g.path} - first: ${g.top}`, href: previewHref(g.env, g.path), go: "Decide" });
    return out.slice(0, 6);
  }, [ideas, t]);

  const num = (v: number | null) => (v === null ? "…" : full(v));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Performance" subtitle="What the tests did, and the whole loop: where buyers are lost, what is being fixed, tested and published" rightSlot={<WindowPicker />} />

      {/* PERFORMANCE - Webyn's first page (SARCLA 08.11.2026: "performance KPIs on the app"), src/lib/convert/perf.ts */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" } }}>
        <KpiTile icon={<ScienceOutlinedIcon />} tint="blue" label="Tests launched" value={perf ? full(perf.launched) : "…"} note={perf ? `${perf.drafts} ${perf.drafts === 1 ? "draft" : "drafts"} not started` : undefined} />
        <KpiTile icon={<EmojiEventsOutlinedIcon />} tint="green" label="Winning versions" value={perf ? full(perf.winning) : "…"} note="the version beat the page as it is" />
        <KpiTile icon={<TimerOutlinedIcon />} tint="purple" label="Tests in progress" value={perf ? full(perf.inProgress) : "…"} note="running or paused on the shop" />
      </Box>
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

      <Box sx={{ display: "grid", gap: { xs: 1.25, lg: 0 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(5, minmax(0,1fr))" } }}>
        <Step n={1} icon={<TroubleshootOutlinedIcon />} tint="#c2185b" title="Problem pages" value={num(n.flagged)} line={n.flagged === null ? "Reading Google Analytics…" : `pages losing buyers · ${full(n.missed)} add-to-carts missed`} href={`${CONVERT}/problems`} />
        <Step n={2} icon={<TipsAndUpdatesOutlinedIcon />} tint="#a96a12" title="Optimizations" value={num(n.waiting)} line={`waiting for a yes or no · ${n.approved} approved, no version yet`} href={`${CONVERT}/insights`} />
        <Step n={3} icon={<PreviewOutlinedIcon />} tint="#6a46c9" title="Versions" value={num(n.ready)} line={`ready to test · ${n.shaping} being shaped`} href={`${CONVERT}/preview`} />
        <Step n={4} icon={<CompareOutlinedIcon />} tint="#2459d1" title="Tests" value={num(n.running)} line={`running on the shop · ${n.drafts} ${n.drafts === 1 ? "draft" : "drafts"}`} href={`${CONVERT}/tests`} />
        <Step n={5} icon={<RocketLaunchOutlinedIcon />} tint="#1b7a55" title="Winners" value={num(n.won)} line={`to publish from Content · ${n.shipped} published`} href={`${CONVERT}/ship`} last />
      </Box>

      {brief && (
        <GlassCard sx={{ borderLeft: "3px solid #6a46c9" }}>
          <CardTitle icon={<PsychologyOutlinedIcon />} tint="purple" title="What stops buyers" note={`The AI's reading of ${brief.pages} problem pages · ${ago(Date.parse(brief.at) / 1000)}`}
            right={<Button size="small" component={Link} href={`${CONVERT}/problems`} sx={{ textTransform: "none", fontWeight: 600 }}>Problem pages</Button>} />
          {brief.headline && <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mt: 1 }}>{brief.headline}</Typography>}
          <Box sx={{ display: "grid", gap: 1.25, mt: 1.25, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" } }}>
            {brief.themes.slice(0, 3).map((x, i) => (
              <Box key={i} sx={{ display: "grid", gap: 0.5, alignContent: "start", p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{i + 1}. {x.title}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: INK }}><b>Test first</b> {x.test}</Typography>
              </Box>
            ))}
          </Box>
        </GlassCard>
      )}

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

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", xl: "minmax(0,2fr) minmax(0,1fr)" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        <GlassCard>
          <CardTitle icon={<ReportProblemOutlinedIcon />} tint="pink" title="The pages losing the most"
            note={p ? `${full(n.lost)} customers opened a product and did not order, in this period` : "Reading Google Analytics and the shop's record…"}
            right={<Button size="small" component={Link} href={`${CONVERT}/problems`} sx={{ textTransform: "none", fontWeight: 600 }}>All problem pages</Button>} />
          {p && n.top.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 1.5 }}>No page crosses the problem line in this period.</Typography>}
          <Box sx={{ display: "grid", gap: 1.5, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" } }}>
            {n.top.map((x) => (
              <Box key={x.key} component={Link} href={previewHref("prod", x.path)} sx={{
                display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "12px", overflow: "hidden", textDecoration: "none", color: "inherit",
                border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", transition: "box-shadow .15s", "&:hover": { boxShadow: "0 10px 26px rgba(21,34,58,.12)" },
              }}>
                <Box sx={{ position: "relative" }}>
                  <PageShot env="prod" path={x.path} label={x.name || x.path} />
                  <Box sx={{ position: "absolute", top: 8, left: 8 }}><Chip tint={KIND_TINT[x.kind]}>{KIND_LABEL[x.kind]}</Chip></Box>
                </Box>
                <Box sx={{ p: 1.25, display: "grid", gap: 0.5 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, ...clip(9999) }} title={x.name || x.path}>{x.name || x.path}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35 }}>{x.reasons[0]}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: INK }}>
                    <Box component="span" sx={{ color: RED, fontWeight: 700 }}>{full(x.missed)}</Box> carts missed · cart rate {pct(x.rate)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </GlassCard>
        <GlassCard>
          <CardTitle icon={<CompareOutlinedIcon />} tint="blue" title="Tests" note="A version against the page as it is"
            right={<Button size="small" component={Link} href={`${CONVERT}/tests`} sx={{ textTransform: "none", fontWeight: 600 }}>All tests</Button>} />
          <Box sx={{ display: "grid", gap: 0.5, mt: 1.25 }}>
            {t && t.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No test yet - a version that is ready goes to Tests from the Preview.</Typography>}
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

        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <GlassCard>
            <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Pages in work" note="Their optimizations and versions" />
            <Box sx={{ display: "grid", gap: 0.5, mt: 1.25 }}>
              {ideas && worked.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No page in work yet - start from Insights.</Typography>}
              {worked.map((w) => (
                <Box key={`${w.env}${w.path}`} component={Link} href={previewHref(w.env, w.path)} sx={{ display: "grid", gap: 0.25, p: 1, borderRadius: "8px", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0 }}>
                    <Chip tint={w.env === "prod" ? "green" : "amber"}>{ENVS[w.env].label}</Chip>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, ...clip(9999) }}>{w.top}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(9999) }}>{w.ideas} {w.ideas === 1 ? "optimization" : "optimizations"}{w.ready ? ` · ${w.ready} ready to test` : ""} · {ago(Date.parse(w.last) / 1000)} · {w.path}</Typography>
                </Box>
              ))}
            </Box>
          </GlassCard>
        </Box>
      </Box>
    </Box>
  );
}
