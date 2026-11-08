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
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED, clip } from "@/app/uc/report/ui";
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

const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);
const KIND_TINT: Record<PageKind, "green" | "blue" | "purple" | "amber" | "slate"> = { product: "green", category: "blue", home: "purple", cms: "amber", system: "slate" };

function Step({ n, icon, title, value, line, href, tint, last }: {
  n: number; icon: React.ReactNode; title: string; value: string; line: string; href: string; tint: string; last?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
      <Box component={Link} href={href} sx={{
        flex: 1, minWidth: 0, display: "grid", gap: 0.5, p: 1.75, borderRadius: "14px", textDecoration: "none", color: "inherit",
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
  const p = prob.result?.state === "ok" ? prob.result.data : null;
  const ideas = board.result?.state === "ok" ? board.result.data.ideas : null;
  const t = tests.result?.state === "ok" ? tests.result.data.tests.filter((x) => x.kind === "test") : null;

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

  const num = (v: number | null) => (v === null ? "…" : full(v));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Overview" subtitle="Where the shop loses buyers, what is being fixed, tested and shipped - the whole loop on one page" rightSlot={<WindowPicker />} />

      <Box sx={{ display: "grid", gap: { xs: 1.25, lg: 0 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(5, minmax(0,1fr))" } }}>
        <Step n={1} icon={<TroubleshootOutlinedIcon />} tint="#c2185b" title="Insights" value={num(n.flagged)} line={n.flagged === null ? "Reading Google Analytics…" : `pages losing buyers · ${full(n.missed)} add-to-carts missed`} href={`${CONVERT}/problems`} />
        <Step n={2} icon={<TipsAndUpdatesOutlinedIcon />} tint="#a96a12" title="Ideas" value={num(n.waiting)} line={`waiting for a yes or no · ${n.approved} approved, no version yet`} href={`${CONVERT}/ideas`} />
        <Step n={3} icon={<PreviewOutlinedIcon />} tint="#6a46c9" title="Versions" value={num(n.ready)} line={`ready to test · ${n.shaping} being shaped`} href={`${CONVERT}/preview`} />
        <Step n={4} icon={<CompareOutlinedIcon />} tint="#2459d1" title="Tests" value={num(n.running)} line={`running on the shop · ${n.drafts} ${n.drafts === 1 ? "draft" : "drafts"}`} href={`${CONVERT}/tests`} />
        <Step n={5} icon={<RocketLaunchOutlinedIcon />} tint="#1b7a55" title="Ship" value={num(n.won)} line={`winners to ship · ${n.shipped} shipped`} href={`${CONVERT}/ship`} last />
      </Box>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", xl: "minmax(0,2fr) minmax(0,1fr)" }, alignItems: "start" }}>
        <GlassCard>
          <CardTitle icon={<ReportProblemOutlinedIcon />} tint="pink" title="The pages losing the most"
            note={p ? `${full(n.lost)} customers opened a product and did not order, in this period` : "Reading Google Analytics and the shop's record…"}
            right={<Button size="small" component={Link} href={`${CONVERT}/problems`} sx={{ textTransform: "none", fontWeight: 600 }}>All insights</Button>} />
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

        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <GlassCard>
            <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Pages in work" note="Their ideas and versions" />
            <Box sx={{ display: "grid", gap: 0.5, mt: 1.25 }}>
              {ideas && worked.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No page in work yet - start from Insights.</Typography>}
              {worked.map((w) => (
                <Box key={`${w.env}${w.path}`} component={Link} href={previewHref(w.env, w.path)} sx={{ display: "grid", gap: 0.25, p: 1, borderRadius: "8px", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0 }}>
                    <Chip tint={w.env === "prod" ? "green" : "amber"}>{ENVS[w.env].label}</Chip>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, ...clip(9999) }}>{w.top}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(9999) }}>{w.ideas} {w.ideas === 1 ? "idea" : "ideas"}{w.ready ? ` · ${w.ready} ready to test` : ""} · {ago(Date.parse(w.last) / 1000)} · {w.path}</Typography>
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
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        Nothing reaches the shop until a person approves it: ideas, versions, the start of a test and the winner each wait for a yes. <Box component={Link} href={`${CONVERT}/pages`} sx={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>The shop&apos;s pages</Box> are read from its sitemaps.
      </Typography>
    </Box>
  );
}
