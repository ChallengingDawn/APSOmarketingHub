"use client";

// Pages > PUBLISHED BY THE HUB (SARCLA 11.11.2026: "own pages should also be a tab, to measure only the pages that have
// been published via the hub"). The pages Content's Page builder wrote into Magento (its last step, "To Magento" - the
// to-do's own record of what it wrote: src/lib/convert/pages.ts hubPublished), each with what it does on the shop in the
// reporting window: its views and add-to-carts (Google Analytics), how Google shows it (Search Console - production
// only), its optimizations, and the to-do it came from.

import { useMemo } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, KpiTile, MUTED, Notice, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { useReportingWindow, WindowPicker } from "@/app/window/ReportingWindow";
import type { HubPage } from "@/lib/convert/pages";
import { testState, type TestBrief } from "@/lib/convert/testState";
import type { ProblemsData } from "@/lib/convert/problems";
import type { SeoData } from "@/lib/convert/seo";
import type { Env } from "@/lib/convert/model";
import { Chip } from "../Tag";
import { previewHref } from "../Flow";
import { AiButton } from "../AiButton";

export type Published = {
  pages: HubPage[]; work: Record<Env, Record<string, { waiting: number; approved: number; blocks: number }>>;
  /** each page's test - of its to-do or its address (src/lib/convert/tests.ts testsOfPages), keyed "env path" */
  tests?: Record<string, TestBrief>;
};

const pct = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);

export function HubPublished({ data }: { data: Published }) {
  const { window: win } = useReportingWindow();
  const probUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const prob = useHeld<ProblemsData>(probUrl, [probUrl]);
  const seoUrl = `/api/website/ai-personalization/seo?from=${win.from}&to=${win.to}`;
  const seoHeld = useHeld<SeoData>(seoUrl, [seoUrl]);
  const problems = prob.result?.state === "ok" ? prob.result.data : null;
  const seo = seoHeld.result?.state === "ok" ? seoHeld.result.data : null;

  // Google Analytics counts production's addresses; a product's languages are one problem, its addresses each kept
  const ga = useMemo(() => {
    const m = new Map<string, { views: number; addToCarts: number }>();
    for (const p of problems?.pages ?? []) for (const a of p.paths) m.set(a.path, { views: a.views, addToCarts: a.addToCarts });
    return m;
  }, [problems]);
  const google = useMemo(() => new Map((seo?.rows ?? []).map((r) => [r.path, r])), [seo]);

  const rows = data.pages.map((p) => {
    const g = p.env === "prod" ? ga.get(p.path) ?? null : null;
    const s = p.env === "prod" ? google.get(p.path) ?? null : null;
    return { p, views: g?.views ?? null, carts: g?.addToCarts ?? null, shown: s?.impressions ?? null, clicks: s?.clicks ?? null, ctr: s?.ctr ?? null, work: data.work[p.env]?.[p.path] ?? null };
  });
  const prod = rows.filter((x) => x.p.env === "prod");
  const sum = (f: (x: (typeof rows)[number]) => number | null) => prod.reduce((t, x) => t + (f(x) ?? 0), 0);
  const views = sum((x) => x.views), carts = sum((x) => x.carts), clicks = sum((x) => x.clicks);

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PublishedWithChangesOutlinedIcon />} tint="green" label="Published by the hub" value={full(prod.length)} note={`on production · ${rows.length - prod.length} on ACC`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<VisibilityOutlinedIcon />} tint="blue" label="Views" value={problems ? full(views) : "–"} note={`${win.from} to ${win.to} · Google Analytics`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="pink" label="Add-to-carts" value={problems ? full(carts) : "–"} note={problems ? `${pct(views ? carts / views : null)} of the views` : "reading Google Analytics…"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TravelExploreOutlinedIcon />} tint="purple" label="Clicks from Google" value={seo ? full(clicks) : "–"} note="Search Console, two days behind" /></Grid>
      </Grid>
      {problems && !problems.ga4.ok && <Notice tone="warn">Google Analytics did not answer{problems.ga4.error ? ` (${problems.ga4.error})` : ""} - the views and add-to-carts are missing.</Notice>}
      {prob.result?.state === "error" && <UpstreamPanel source="Google Analytics" error={prob.result.error} status={prob.result.status ?? null} onRetry={() => {}} />}

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <CardTitle icon={<PublishedWithChangesOutlinedIcon />} tint="green" title={`Published by the hub · ${full(rows.length)}`}
              note="The pages Content's Page builder wrote into Magento - each store view's page once, the newest write" />
          </Box>
          <WindowPicker />
        </Box>
        <Box sx={{ overflowX: "auto", mt: 1.5 }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                {["Page", "Store view", "Shop", "Written", "Views", "Add-to-carts", "Google", "Optimizations", "A/B test", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={10} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>
                  The hub has published no page yet - a Page builder to-do&apos;s last step, To Magento, puts its page here.
                </TableCell></TableRow>
              )}
              {rows.map(({ p, views: v, carts: c, shown, clicks: k, ctr, work }) => (
                <TableRow key={`${p.env}${p.path}`} hover sx={{ borderTop: `1px solid ${HAIRLINE}` }}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                    <Box sx={{ ...clip(420), display: "block", fontWeight: 700 }}>{p.title}</Box>
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                      <Typography component="span" sx={{ ...clip(380), display: "block", fontSize: "0.76rem", color: MUTED }}>{p.path}</Typography>
                      <Box component="a" href={p.url} target="_blank" rel="noopener" aria-label="Open on the shop" sx={{ color: MUTED, display: "inline-flex" }}><OpenInNewIcon sx={{ fontSize: 13 }} /></Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{p.store}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={p.env === "prod" ? "green" : "amber"}>{p.env === "prod" ? "Production" : "ACC"}</Chip></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: MUTED }}>{ago(Date.parse(p.at) / 1000)}{p.action === "updated" ? " · updated" : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.env === "acc" ? "–" : v === null ? (problems ? "0" : "…") : full(v)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{p.env === "acc" ? "–" : c === null ? (problems ? "0" : "…") : `${full(c)}${v ? ` · ${pct(c / v)}` : ""}`}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{p.env === "acc" ? "–" : shown === null ? (seo ? "not shown yet" : "…") : `${full(shown)} shown · ${full(k ?? 0)} clicks (${pct(ctr)})`}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {work && (work.waiting || work.approved) ? (
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {work.waiting > 0 && <Chip tint="amber">{work.waiting} waiting</Chip>}
                        {work.approved > 0 && <Chip tint="green">{work.approved} approved</Chip>}
                      </Box>
                    ) : <Typography component="span" sx={{ color: MUTED, fontSize: "0.84rem" }}>–</Typography>}
                  </TableCell>
                  {/* its A/B test, where it stands (13.11.2026 - the loop as one product) */}
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {(() => { const tb = data.tests?.[`${p.env} ${p.path}`]; if (!tb) return <Typography component="span" sx={{ color: MUTED, fontSize: "0.84rem" }}>–</Typography>; const ts = testState(tb); return (
                      <Box component={Link} href={`/website/ai-personalization/tests/${tb.id}`} sx={{ display: "inline-flex", textDecoration: "none" }}><Chip tint={ts.tint}>{ts.label}</Chip></Box>
                    ); })()}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: "flex-end" }}>
                      {work && (work.waiting || work.approved)
                        ? <Button size="small" variant="outlined" component={Link} href={previewHref(p.env, p.path)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px" }}>Preview</Button>
                        : <AiButton size="small" href={`${previewHref(p.env, p.path)}&ask=1`}>Find optimizations</AiButton>}
                      {/* a real button, not a link of text (SARCLA 13.11.2026) */}
                      <Button size="small" variant="outlined" component={Link} href={`/projects/${p.projectId}/pieces/${p.pieceId}`} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px", whiteSpace: "nowrap" }}>Open its to-do</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>
    </>
  );
}

/** The tab while the list is read. */
export function HubPublishedLoading() {
  return <LoadingPanel label="Reading the pages the hub published…" />;
}
