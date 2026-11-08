"use client";

// Website > Journeys > FUNNEL. The shop's steps twice, because the two sources see different people: Google Analytics'
// visits (the visitors who accepted statistics cookies - sessions with each step, and its own in-order funnel where it
// answers) and the shop's own record of every signed-in customer (each company once, at the furthest step it reached:
// opened, asked for a quantity, served from stock, the minimum met, the cart, the order). Where the most are lost is
// said in a sentence, and in red on the funnel (src/lib/journeys/read.ts).

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, GlassCard, INK, MUTED, Notice, RED } from "@/app/uc/report/ui";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { STEP_LABEL } from "@/lib/convert/model";
import { SHOP_STOP, STORE_VIEWS, dropWords, type Drop } from "@/lib/journeys/model";
import type { FunnelData } from "@/lib/journeys/read";
import { StepFunnel } from "../parts";

const linkSx = { color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
const SHOP_FROM_WORDS = "2 October 2026";
const fmt = (n: number) => full(n);

function DropLine({ who, drop, none }: { who: string; drop: Drop | null; none: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px minmax(0, 1fr)" }, columnGap: 1.5, rowGap: 0.25, alignItems: "baseline" }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{who}</Typography>
      <Typography sx={{ fontSize: { xs: "0.95rem", md: "1.05rem" }, color: drop ? INK : MUTED, fontWeight: drop ? 600 : 400, lineHeight: 1.4 }}>
        {drop ? <>{dropWords(drop, fmt)} <Box component="span" sx={{ color: RED, whiteSpace: "nowrap" }}>{full(drop.lost)} lost there.</Box></> : none}
      </Typography>
    </Box>
  );
}

export default function JourneysFunnel() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [store, setStore] = useState<string>("all");
  const [unit, setUnit] = useState<"visits" | "ordered">("visits");
  const url = `/api/website/journeys/funnel?from=${win.from}&to=${win.to}${store !== "all" ? `&store=${encodeURIComponent(store)}` : ""}&n=${tick}`;
  const held = useHeld<FunnelData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  // the shop's record still being read: ask again in twenty seconds
  useEffect(() => {
    if (d?.shop.state.state !== "computing") return;
    const t = setTimeout(() => setTick((n) => n + 1), 20_000);
    return () => clearTimeout(t);
  }, [d?.shop.state.state, tick]);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading Google Analytics and the shop's record…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="the hub" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Funnel" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const { ga4, shop } = r.data;
    const ordered = ga4.ordered?.ok ? ga4.ordered : null;
    const showOrdered = unit === "ordered" && !!ordered;
    const ga4Steps = showOrdered ? ordered!.steps : ga4.steps;
    const ga4Drop = showOrdered ? ordered!.drop : ga4.drop;
    const stops = Object.fromEntries(Object.entries(SHOP_STOP).map(([k, s]) => [k, STEP_LABEL[s].toLowerCase()]));
    const shopReady = shop.state.state === "ready" && shop.steps.length > 0;
    body = (
      <>
        <SquareChoice<string> label="Store view" value={store} onChange={setStore}
          options={[{ key: "all", label: "All stores" }, ...STORE_VIEWS.map((s) => ({ key: s, label: s }))]} />

        <GlassCard>
          <CardTitle icon={<TrendingDownOutlinedIcon />} tint="pink" title="Where the biggest drop is"
            note="The step that loses the largest part of those who reached the one before it" />
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <DropLine who="Visits" drop={ga4.ok ? ga4.drop : null}
              none={!ga4.configured ? "Google Analytics is not connected on this hub." : ga4.error ? "Google Analytics did not answer." : "No drop between the steps in this period."} />
            <DropLine who="Signed-in customers" drop={shopReady ? shop.drop : null}
              none={shop.state.state === "computing" ? "The shop's record is still being read." : shop.state.state === "error" ? "The shop's record could not be read." : "No customer opened an article in this period."} />
          </Box>
        </GlassCard>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
              <CardTitle icon={<FilterAltOutlinedIcon />} tint="blue" title="Visits, step by step"
                note={showOrdered
                  ? "Google Analytics' own funnel: the visitors who did each step after the one before, in this order"
                  : "Google Analytics: the visits with each step, whatever came before - visitors who accepted statistics cookies"} />
              {!ga4.configured && <NotConnectedPanel source="Google Analytics" missing={ga4.missing} />}
              {ga4.configured && !ga4.ok && <Notice tone="bad">Google Analytics did not answer: {ga4.error}</Notice>}
              {ga4.ok && (
                <Box sx={{ display: "grid", gap: 1.75 }}>
                  <SquareChoice<"visits" | "ordered"> label="Count" value={showOrdered ? "ordered" : "visits"} onChange={setUnit}
                    options={[{ key: "visits", label: "Visits with each step" }, { key: "ordered", label: "Visitors, in this order", disabled: !ordered }]} />
                  {ga4.ordered && !ga4.ordered.ok && (
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The in-order funnel did not answer ({ga4.ordered.error}) - the visits with each step are shown.</Typography>
                  )}
                  {ga4.notSent.length > 0 && (
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                      Left out - the shop does not send {ga4.notSent.map((e) => `"${e}"`).join(", ")} to Google Analytics.
                    </Typography>
                  )}
                  <StepFunnel steps={ga4Steps} drop={ga4Drop} unit={showOrdered ? "visitors" : "visits"} />
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.5 }}>
                    &quot;Saw articles&quot; counts a list as well as a product page: the shop sends the same signal for both.
                    {r.data.store ? ` Only the visits on ${r.data.store} pages.` : ""}
                  </Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
              <CardTitle icon={<StorefrontOutlinedIcon />} tint="green" title="Signed-in customers, step by step"
                note={`The shop's own record: every company that opened an article, at the furthest step it reached${shopReady ? ` - ${full(shop.companies)} companies, ${full(shop.looks)} looks` : ""}`} />
              {shop.state.state === "computing" && <Notice tone="warn">The shop&apos;s record is being read{shop.state.progress ? ` (${shop.state.progress})` : ""} - this page asks again by itself.</Notice>}
              {shop.state.state === "error" && <Notice tone="bad">The shop&apos;s record could not be read: {shop.state.error}</Notice>}
              {shop.state.state === "none" && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>The shop&apos;s record has no steps yet - they come with its next read.</Typography>}
              {shopReady && (
                <Box sx={{ display: "grid", gap: 1.75 }}>
                  {r.data.from < shop.since && <Notice tone="warn">The shop&apos;s record starts on {SHOP_FROM_WORDS} - the days before are not in it.</Notice>}
                  {r.data.store && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The shop&apos;s record has no store view - every signed-in customer is counted.</Typography>}
                  {shop.companies === 0
                    ? <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No signed-in customer opened an article in this period.</Typography>
                    : <StepFunnel steps={shop.steps} drop={shop.drop} unit="companies" stops={stops} />}
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.5 }}>
                    Every signed-in customer, whatever the cookie banner says - a company counts once, at the furthest step any of its articles reached.
                  </Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>
        </Grid>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Funnel"
        subtitle="The shop's steps for the visits and for the signed-in customers - and where most of them are lost"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      {body}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        See <Box component={Link} href="/website/journeys" sx={linkSx}>how visitors move</Box> between the pages, or the pages that lose buyers in{" "}
        <Box component={Link} href="/website/ai-personalization/problems" sx={linkSx}>Problems</Box>.
      </Typography>
    </Box>
  );
}
