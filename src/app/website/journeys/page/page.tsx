"use client";

// Website > Journeys > PAGE FLOW: one page of the shop - where its visitors came from (other shop pages, other sites,
// no page before) and where they went next, or that they left (src/lib/journeys/read.ts buildPageFlow, from Google
// Analytics' page-to-page steps on that page alone). A shop page on either side opens its own flow; the page itself
// opens in APSOconvert's Preview and Problems. Without a page: the most viewed ones to start from, or any address.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import EastOutlinedIcon from "@mui/icons-material/EastOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import WestOutlinedIcon from "@mui/icons-material/WestOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, Notice, clip } from "@/app/uc/report/ui";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { JKINDS, KIND_NAME, type TopPage } from "@/lib/journeys/model";
import type { JourneysData, PageFlowData } from "@/lib/journeys/read";
import { KindTag, PROBLEMS_HREF, PageFlowChart, SideList, pct } from "../parts";
import { flowHref, journeysBase, useInConvert } from "@/app/website/ai-personalization/base";

const linkSx = { color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;

/** What someone typed or pasted, as a path of the shop: the whole address or the path, without query or anchor. */
function toPath(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const p = /^https?:\/\//i.test(s) ? new URL(s).pathname : s.split(/[?#]/)[0];
    const path = p.startsWith("/") ? p : `/${p}`;
    return path.length <= 300 && !/\s/.test(path) ? path : null;
  } catch {
    return null;
  }
}

function PathBox({ initial }: { initial: string }) {
  const router = useRouter();
  const inConvert = useInConvert();
  const [q, setQ] = useState(initial);
  const path = toPath(q);
  const go = () => { if (path) router.push(flowHref(inConvert, path)); };
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
      <TextField size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }}
        placeholder="/de-CH/dichtungstechnik.html - or paste the whole address" inputProps={{ "aria-label": "A page of the shop", maxLength: 400 }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "6px", bgcolor: "rgba(255,255,255,.8)", fontSize: "0.88rem" } }} />
      <Button variant="contained" size="small" onClick={go} disabled={!path} startIcon={<SearchOutlinedIcon />} sx={{ borderRadius: "6px", textTransform: "none", boxShadow: "none", whiteSpace: "nowrap" }}>Show</Button>
    </Box>
  );
}

/** No page asked yet: the most viewed pages of the period to start from. */
function Start() {
  const { window: win } = useReportingWindow();
  const url = `/api/website/journeys?from=${win.from}&to=${win.to}`;
  const held = useHeld<JourneysData>(url, [url]);
  const r = held.result;
  const inConvert = useInConvert();
  const top = useMemo(() => {
    if (r?.state !== "ok") return [] as TopPage[];
    return JKINDS.flatMap((k) => r.data.pages[k] ?? []).sort((a, b) => b.views - a.views).slice(0, 16);
  }, [r]);
  return (
    <GlassCard>
      <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="purple" title="Which page?" note="Any page of the shop - or start from the most viewed ones of the period" />
      <Box sx={{ display: "grid", gap: 2 }}>
        <PathBox initial="" />
        {r === null && <LoadingPanel label="Reading the most viewed pages…" />}
        {r?.state === "not-configured" && <NotConnectedPanel source="Google Analytics" missing={r.missing} />}
        {r?.state === "error" && <Notice tone="bad">Google Analytics did not answer: {r.error}</Notice>}
        {r?.state === "ok" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 3, rowGap: 0.25 }}>
            {top.map((p) => (
              <Box key={p.path} component={Link} href={flowHref(inConvert, p.path)} sx={{
                display: "flex", alignItems: "center", gap: 1.25, py: 0.9, px: 1, borderRadius: "8px", textDecoration: "none", color: INK, minWidth: 0,
                "&:hover": { bgcolor: "rgba(36,89,209,.06)" },
              }}>
                <KindTag kind={p.kind} label="" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ ...clip(9999), fontSize: "0.86rem", fontWeight: 600 }}>{p.name}</Typography>
                  <Typography sx={{ ...clip(9999), fontSize: "0.74rem", color: MUTED }}>{p.path}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{full(p.views)} views</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

function Flow({ path }: { path: string }) {
  const router = useRouter();
  const inConvert = useInConvert();
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const url = `/api/website/journeys/page?path=${encodeURIComponent(path)}&from=${win.from}&to=${win.to}&n=${tick}`;
  const held = useHeld<PageFlowData>(url, [url]);
  const r = held.result;

  const head = (
    <PageHeader
      title="Page flow"
      subtitle="Where one page's visitors came from, and where they went next"
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
  );

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading this page's steps from Google Analytics…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="Google Analytics" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Google Analytics" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const { flow, page, landing } = r.data;
    const steps = Math.max(0, flow.views - flow.again);
    const went = flow.to.reduce((a, x) => a + x.views, 0);
    const views = page?.views ?? flow.views;
    body = (
      <>
        {r.data.truncated && <Notice tone="warn">Google Analytics gave the most viewed steps only - the rarest ones are missing.</Notice>}
        {flow.views === 0 && <Notice tone="warn">Google Analytics has no view of this page in this period - check the address, or choose a longer period.</Notice>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<VisibilityOutlinedIcon />} tint="blue" label="Views" value={full(views)}
            note={page ? `${full(page.sessions)} visits · ${full(page.addToCarts)} put in the cart on it` : undefined} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LoginOutlinedIcon />} tint="purple" label="Came in here" value={full(landing.sessions)}
            note={landing.sessions ? `${pct(landing.carts / landing.sessions)} of them put something in the cart, ${pct(landing.orders / landing.sessions)} ordered` : "no visit started on this page"} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EastOutlinedIcon />} tint="green" label="Went on in the shop" value={steps ? pct(Math.min(1, went / steps)) : "—"}
            note={`${full(went)} next pages after it`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LogoutOutlinedIcon />} tint="amber" label="Left here" value={steps ? pct(flow.left / steps) : "—"}
            note={`${full(flow.left)} views with no next page`} /></Grid>
        </Grid>

        {flow.views > 0 && (
          <GlassCard sx={{ display: { xs: "none", md: "block" } }}>
            <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="purple" title="Came from, went next"
              note="Built from page-to-page steps: each view of this page and the page before it, each page after it with this one before. A shop page opens its own flow." />
            <PageFlowChart flow={flow} onOpen={(p) => router.push(flowHref(inConvert, p))} />
          </GlassCard>
        )}

        {flow.views > 0 && (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<WestOutlinedIcon />} tint="blue" title="Came from" note={`The page before, for ${full(steps)} views${flow.again ? ` - ${full(flow.again)} more were this page again (a reload, a filter)` : ""}`} />
                <SideList items={flow.from} total={steps} empty="No view of this page in this period." />
              </GlassCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<EastOutlinedIcon />} tint="green" title="Went next" note="The next page in the shop - or none: they left" />
                <SideList items={[...flow.to, ...(flow.left > 0 ? [{ key: "left", label: "Left the shop", kind: "left" as const, path: null, views: flow.left }] : [])]}
                  total={Math.max(steps, went)} empty="No next page recorded." />
              </GlassCard>
            </Grid>
          </Grid>
        )}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {head}
      <GlassCard sx={{ py: { xs: 1.75, md: 2 } }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, rowGap: 1, minWidth: 0 }}>
          <KindTag kind={r?.state === "ok" ? r.data.flow.kind : "other"} label={r?.state === "ok" ? KIND_NAME[r.data.flow.kind] : "Page"} strong />
          <Box sx={{ minWidth: 0, flex: "1 1 260px" }}>
            <Typography sx={{ ...clip(9999), fontSize: "0.98rem", fontWeight: 600, color: INK }}>{r?.state === "ok" ? r.data.flow.name : path}</Typography>
            <Typography sx={{ ...clip(9999), fontSize: "0.78rem", color: MUTED }} title={path}>{path}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", fontSize: "0.84rem" }}>
            <Box component={Link} href={previewHref("prod", path)} sx={linkSx}>Preview</Box>
            {inConvert && <Box component={Link} href={`${previewHref("prod", path)}&clicks=1`} sx={linkSx}>Clicks</Box>}
            <Box component={Link} href={PROBLEMS_HREF} sx={linkSx}>Problem pages</Box>
            <Box component={Link} href={journeysBase(inConvert)} sx={linkSx}>Main journeys</Box>
          </Box>
        </Box>
        <Box sx={{ mt: 1.5 }}><PathBox key={path} initial={path} /></Box>
      </GlassCard>
      {body}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Google Analytics sees the visitors who accepted statistics cookies. &quot;Left&quot; is a view no next page follows: they closed the tab, went to another site, or the next page was not recorded.
      </Typography>
    </Box>
  );
}

function PageFlowInner() {
  const sp = useSearchParams();
  const inConvert = useInConvert();
  const path = toPath(sp.get("path") ?? "");
  if (path) return <Flow key={path} path={path} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Page flow" subtitle="Where one page's visitors came from, and where they went next" rightSlot={<WindowPicker />} />
      <Start />
    </Box>
  );
}

export default function PageFlowPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Opening the page flow…" />}>
      <PageFlowInner />
    </Suspense>
  );
}
