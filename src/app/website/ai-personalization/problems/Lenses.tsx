"use client";

// Problem pages' other kinds (SARCLA 09.11.2026: "you should bring another categories: SEO pages, Blog (to come), other
// pages that are not articles, block like newsletter block") and the cards' pager ("2 problems per row then paginate at
// 5 rows"). SEO pages = Google's view of the shop's pages (src/lib/convert/seoRules.ts); Blocks = the shop's blocks shown
// on many pages (src/lib/convert/blocks.ts), each optimized as one thing with many different versions side by side.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Pagination from "@mui/material/Pagination";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import ViewQuiltOutlinedIcon from "@mui/icons-material/ViewQuiltOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, AMBER, GREEN, GlassCard, KpiTile, MUTED, Notice, RED } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { KIND_LABEL, type PageKind } from "@/lib/convert/model";
import type { SeoData } from "@/lib/convert/seo";
import type { SeoRow } from "@/lib/convert/seoRules";
import { perThousand, type ShopBlock } from "@/lib/convert/blocks";
import type { Signups } from "@/lib/convert/blocksRead";
import { previewHref } from "../Flow";
import { PageShot } from "../PageShot";
import { AiButton } from "../AiButton";

export const PER_PAGE = 10;
const INK = "#15223a";
const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);

/** The cards, 2 a row from a laptop's width, 5 rows a page with numbered pages under them. */
export function CardPages<T>({ rows, render, keyOf, resetKey }: { rows: T[]; render: (r: T) => React.ReactNode; keyOf: (r: T) => string; resetKey: string }) {
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const p = Math.min(page, pages);
  const shown = rows.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  const go = (n: number) => { setPage(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <Box ref={top} sx={{ display: "grid", gap: 2, scrollMarginTop: 16 }}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2, minmax(0,1fr))" } }}>
        {shown.map((r) => <Box key={keyOf(r)} sx={{ minWidth: 0, display: "flex" }}>{render(r)}</Box>)}
      </Box>
      {pages > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
          <Pagination count={pages} page={p} onChange={(_, n) => go(n)} shape="rounded" color="primary" siblingCount={1}
            sx={{ "& .MuiPaginationItem-root": { borderRadius: "6px", fontWeight: 600 } }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            {(p - 1) * PER_PAGE + 1}-{Math.min(p * PER_PAGE, rows.length)} of {full(rows.length)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/** A number on a card: its name, the figure, and a line under it that wraps rather than being cut. */
export function Stat({ k, v, sub, color }: { k: string; v: string; sub?: string; color?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</Typography>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: color ?? INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 }}>{v}</Typography>
      {sub && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>{sub}</Typography>}
    </Box>
  );
}

/** A card: the page's picture on the left, what it is and its numbers on the right (one above the other on a phone). */
export function WideCard({ picture, chips, corner, children, selected }: { picture: React.ReactNode; chips: React.ReactNode; corner?: React.ReactNode; children: React.ReactNode; selected?: boolean }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,42%) minmax(0,1fr)" }, borderRadius: "14px", overflow: "hidden",
      bgcolor: "rgba(255,255,255,.94)", border: `1px solid ${selected ? ACCENT : "rgba(21,34,58,.10)"}`, boxShadow: selected ? `0 0 0 2px ${ACCENT}` : "0 6px 18px rgba(21,34,58,.06)",
      transition: "box-shadow .15s", "&:hover": { boxShadow: selected ? `0 0 0 2px ${ACCENT}` : "0 10px 26px rgba(21,34,58,.12)" },
    }}>
      <Box sx={{ position: "relative", minWidth: 0, bgcolor: "#f3f5f8", borderRight: { sm: "1px solid rgba(21,34,58,.08)" } }}>
        {picture}
        <Box sx={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 0.5, flexWrap: "wrap", maxWidth: "calc(100% - 16px)" }}>{chips}</Box>
        {corner && <Box sx={{ position: "absolute", bottom: 8, left: 8, right: 8, display: "flex" }}>{corner}</Box>}
      </Box>
      <Box sx={{ p: { xs: 1.5, md: 1.75 }, display: "grid", gap: 1.1, alignContent: "start", minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

const btn = { borderRadius: "6px", textTransform: "none", fontWeight: 600 } as const;

// ── SEO PAGES ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function SeoCard({ r, name }: { r: SeoRow; name: string | null }) {
  const low = r.typical !== null && r.ctr < r.typical / 2;
  return (
    <WideCard
      picture={<Box component={Link} href={previewHref("prod", r.path)} sx={{ display: "block" }} title="Open it in Preview"><PageShot env="prod" path={r.path} ratio={1.3} label={name ?? r.path} /></Box>}
      chips={<><Chip tint="purple">SEO</Chip><Chip tint="slate">{KIND_LABEL[r.kind as PageKind]}</Chip></>}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3, overflowWrap: "anywhere" }}>{name ?? r.path}</Typography>
        {name && <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflowWrap: "anywhere" }}>{r.path}</Typography>}
      </Box>
      {r.reasons.length
        ? r.reasons.map((t) => (
            <Box key={t} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
              <ReportProblemOutlinedIcon sx={{ fontSize: 16, color: RED, mt: "2px", flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.35 }}>{t}</Typography>
            </Box>
          ))
        : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Google sends it as many clicks as is typical at its position.</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 1 }}>
        <Stat k="Shown" v={full(r.impressions)} sub="on Google" />
        <Stat k="Clicks" v={full(r.clicks)} sub={r.missed ? `${full(r.missed)} missed` : undefined} color={r.missed ? RED : undefined} />
        <Stat k="Click rate" v={pct(r.ctr)} sub={r.typical !== null ? `typical ${pct(r.typical)}` : undefined} color={r.typical === null ? undefined : low ? RED : r.ctr < r.typical ? AMBER : GREEN} />
        <Stat k="Position" v={r.position ? r.position.toFixed(1) : "–"} sub={r.position > 10 ? "page 2+" : r.position ? "page 1" : undefined} />
      </Box>
      {r.queries.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {r.queries.slice(0, 4).map((q) => (
            <Box key={q.q} component="span" title={`${full(q.impressions)} times shown, ${full(q.clicks)} clicks${q.position ? `, position ${q.position.toFixed(1)}` : ""}`}
              sx={{ px: 0.8, py: 0.2, borderRadius: "3px", border: "1px solid rgba(106,70,201,.25)", bgcolor: "rgba(106,70,201,.06)", color: "#6a46c9", fontSize: "0.72rem", fontWeight: 600, overflowWrap: "anywhere" }}>
              {q.q} · {full(q.impressions)}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap", mt: 0.25 }}>
        <AiButton size="small" href={`${previewHref("prod", r.path)}&ask=1&seo=1`}>Find landing pages</AiButton>
        <Button size="small" component="a" href={r.url} target="_blank" rel="noopener" sx={btn}>Open on the shop</Button>
      </Box>
    </WideCard>
  );
}

export function SeoLens({ from, to, names, onlyProblems }: { from: string; to: string; names: Map<string, string>; onlyProblems: boolean }) {
  const url = `/api/website/ai-personalization/seo?from=${from}&to=${to}`;
  const held = useHeld<SeoData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const rows = useMemo(() => (d ? (onlyProblems && d.rows.some((x) => x.reasons.length) ? d.rows.filter((x) => x.reasons.length) : d.rows) : []), [d, onlyProblems]);
  if (r === null) return <LoadingPanel label="Reading Google Search Console…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Search Console" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => {}} />;
  const data = r.data;
  if (data.error) return <Notice tone="bad">Search Console did not answer: {data.error}</Notice>;
  const problems = data.rows.filter((x) => x.reasons.length);
  const shown = data.rows.reduce((s, x) => s + x.impressions, 0), clicks = data.rows.reduce((s, x) => s + x.clicks, 0);
  const top = data.bands.find((b) => b.key === "1")?.rate ?? null;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TravelExploreOutlinedIcon />} tint="purple" label="Pages losing Google clicks" value={full(problems.length)} note={`of ${full(data.rows.length)} pages Google showed`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AdsClickOutlinedIcon />} tint="pink" label="Clicks missed" value={full(problems.reduce((s, x) => s + x.missed, 0))} note="on those pages, at the shop's typical rate" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<VisibilityOutlinedIcon />} tint="blue" label="Shown on Google" value={full(shown)} note={`${full(clicks)} clicks · ${pct(shown ? clicks / shown : null)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PercentOutlinedIcon />} tint="green" label="Typical click rate at position 1" value={pct(top)} note="the shop's own pages" /></Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        A problem: shown 300+ times and clicked less than half as often as the shop&apos;s pages at the same position - or just below Google&apos;s first page. Search Console is two days behind{data.truncated ? "; its 500 most clicked pages" : ""}.
      </Typography>
      {rows.length === 0
        ? <Notice tone="warn">Google showed no page of the shop in this period.</Notice>
        : <CardPages rows={rows} keyOf={(x) => x.url} resetKey={`seo:${from}:${to}:${onlyProblems}`} render={(x) => <SeoCard r={x} name={names.get(x.path) ?? null} />} />}
    </>
  );
}

// ── BLOCKS ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

function BlockCard({ b, views, signups }: { b: ShopBlock; views: number | null; signups: Signups | null }) {
  const nl = b.measure === "signups";
  const rate = nl && signups && views ? perThousand(signups.total, views) : null;
  return (
    <WideCard
      picture={<Box component={Link} href={`${previewHref("prod", b.page)}&block=${b.key}`} sx={{ display: "block" }} title="Open it in Preview"><PageShot env="prod" path={b.page} ratio={1.3} label={b.name} focus={b.focus} /></Box>}
      chips={<><Chip tint="amber">Block</Chip><Chip tint="slate">{b.where === "every" ? "Every page" : "Home page"}</Chip></>}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{b.name}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.35 }}>{b.about}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>Goal</b> {b.goal}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1 }}>
        <Stat k={b.where === "every" ? "Views, all pages" : "Home page views"} v={views === null ? "–" : full(views)} sub="Google Analytics" />
        {nl
          ? <Stat k="Sign-ups" v={signups ? full(signups.total) : "–"} sub={signups?.error ? "HubSpot did not say" : signups ? `${signups.forms.length} newsletter ${signups.forms.length === 1 ? "form" : "forms"}` : "reading HubSpot…"} />
          : <Stat k="Clicks on it" v="–" sub="counted once switched on in Click map" />}
        {nl ? <Stat k="Per 1,000 views" v={rate === null ? "–" : rate.toFixed(2)} sub="sign-ups" /> : <Stat k="Where" v="Home" sub="de-CH page" />}
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap", mt: 0.25 }}>
        <AiButton size="small" href={`${previewHref("prod", b.page)}&block=${b.key}&ask=1`}>Find optimizations</AiButton>
        <Button size="small" component={Link} href={`${previewHref("prod", b.page)}&block=${b.key}&clicks=1`} sx={btn}>Click map</Button>
      </Box>
    </WideCard>
  );
}

/** The shop's blocks - `only` the ones of one type of change (Insights: the slider = Banner, the newsletter band =
 *  Newsletter, the home page's rows = Page builder); `compact` = the cards alone, without the tiles. */
export function BlocksLens({ from, to, totalViews, homeViews, only, compact }: { from: string; to: string; totalViews: number | null; homeViews: number | null; only?: string[]; compact?: boolean }) {
  const url = `/api/website/ai-personalization/blocks?from=${from}&to=${to}`;
  const held = useHeld<{ blocks: ShopBlock[]; signups: Signups }>(url, [url]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the shop's blocks and HubSpot's newsletter forms…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Blocks" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => {}} />;
  const { signups } = r.data;
  const blocks = only ? r.data.blocks.filter((b) => only.includes(b.key)) : r.data.blocks;
  const cards = <CardPages rows={blocks} keyOf={(b) => b.key} resetKey={`blocks:${(only ?? []).join(",")}`} render={(b) => <BlockCard b={b} views={b.where === "every" ? totalViews : homeViews} signups={b.measure === "signups" ? signups : null} />} />;
  if (compact) return cards;
  const nlRate = totalViews ? perThousand(signups.total, totalViews) : null;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ViewQuiltOutlinedIcon />} tint="amber" label="Blocks" value={full(blocks.length)} note="shown on many pages, optimized as one" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<MarkEmailReadOutlinedIcon />} tint="green" label="Newsletter sign-ups" value={signups.error && !signups.total ? "–" : full(signups.total)} note={signups.error ?? `${signups.forms.length} forms, one per language`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PercentOutlinedIcon />} tint="blue" label="Sign-ups per 1,000 views" value={nlRate === null ? "–" : nlRate.toFixed(2)} note="the newsletter band is on every page" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<VisibilityOutlinedIcon />} tint="purple" label="Home page views" value={homeViews === null ? "–" : full(homeViews)} note="every language" /></Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        A block&apos;s optimizations come as many clearly different versions side by side - pick one, then refine it - as the newsletter band was made.
      </Typography>
      {cards}
    </>
  );
}
