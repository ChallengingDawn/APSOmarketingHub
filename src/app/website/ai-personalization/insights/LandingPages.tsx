"use client";

// Insights > SEO landing page: THE LANDING PAGES THERE ARE, TO OPTIMIZE (SARCLA 11.11.2026: "SEO landing page has product
// pages and is missing a lot: landing pages we create ourselves and the ones on the system already that could be
// optimized"; he chose "existing + new"). First the pages the hub itself published (Content's Page builder, written into
// Magento - Pages > Published by the hub), then the shop's own content pages Google shows; each with its Google numbers
// and its optimizations, and the way to more: Find optimizations reads it for block optimizations in the Preview. No
// product page (their layout is the theme's code). The new pages proposed come after, in Insights' own list.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import type { SeoData } from "@/lib/convert/seo";
import type { HubPage } from "@/lib/convert/pages";
import type { BoardRow } from "@/lib/convert/studio";
import type { Env } from "@/lib/convert/model";
import { landingRows } from "@/lib/convert/landing";
import { Chip } from "../Tag";
import { previewHref } from "../Flow";
import { AiButton } from "../AiButton";

type Published = { pages: HubPage[]; work: Record<Env, Record<string, { waiting: number; approved: number; blocks: number }>> };
const pct = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
const SHOW = 12;

export function LandingPages({ from, to, ideas }: { from: string; to: string; ideas: BoardRow[] }) {
  const [more, setMore] = useState(false);
  const seoUrl = `/api/website/ai-personalization/seo?from=${from}&to=${to}`;
  const seoHeld = useHeld<SeoData>(seoUrl, [seoUrl]);
  const pubUrl = "/api/website/ai-personalization/pages?published=1";
  const pubHeld = useHeld<Published>(pubUrl, [pubUrl]);
  const seo = seoHeld.result?.state === "ok" ? seoHeld.result.data : null;
  const pub = pubHeld.result?.state === "ok" ? pubHeld.result.data : null;
  const rows = useMemo(() => landingRows(pub?.pages ?? [], seo, ideas), [pub, seo, ideas]);
  if (seoHeld.result === null && pubHeld.result === null) return <LoadingPanel label="Reading the landing pages and Google's numbers…" />;
  const ours = rows.filter((r) => r.ours).length;
  const shown = more ? rows : rows.slice(0, SHOW);

  return (
    <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
      <CardTitle icon={<TravelExploreOutlinedIcon />} tint="purple" title={`Landing pages to optimize · ${rows.length}`}
        note={`${ours} published by the hub, then the shop's content pages Google shows - each can get block optimizations like any page`} />
      {seo?.error && <Box sx={{ mt: 1 }}><Notice tone="warn">Search Console did not answer ({seo.error}) - the Google numbers are missing.</Notice></Box>}
      {rows.length === 0 && <Typography sx={{ mt: 1, fontSize: "0.84rem", color: MUTED }}>No landing page yet - the hub has published none, and Google showed no content page of the shop in this period.</Typography>}
      <Box sx={{ display: "grid", mt: 1 }}>
        {shown.map((r) => (
          <Box key={`${r.env}${r.path}`} sx={{
            display: "grid", gap: 1, alignItems: "center", py: 1, borderTop: `1px solid ${HAIRLINE}`,
            gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,2.2fr) repeat(4, minmax(0,0.7fr)) minmax(0,1.4fr)" },
          }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tint={r.ours ? "green" : "slate"}>{r.ours ? "Published by the hub" : "The shop's"}</Chip>
                {r.env === "acc" && <Chip tint="amber">ACC</Chip>}
                {r.store && <Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED }}>{r.store}</Typography>}
              </Box>
              {r.title && <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mt: 0.25, overflowWrap: "anywhere" }}>{r.title}</Typography>}
              <Typography sx={{ fontSize: "0.76rem", color: r.title ? MUTED : INK, fontWeight: r.title ? 400 : 600, overflowWrap: "anywhere" }}>{r.path}</Typography>
            </Box>
            <Stat k="Shown on Google" v={r.shown === null ? "–" : full(r.shown)} />
            <Stat k="Clicks" v={r.clicks === null ? "–" : `${full(r.clicks)} · ${pct(r.ctr)}`} />
            <Stat k="Position" v={r.position === null ? "–" : r.position.toFixed(1)} />
            <Stat k="Missed" v={r.shown === null ? "–" : full(Math.round(r.missed))} />
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
              {r.open > 0
                ? <Button size="small" variant="outlined" component={Link} href={previewHref(r.env, r.path)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px" }}>{r.open} {r.open === 1 ? "optimization" : "optimizations"}</Button>
                : <AiButton size="small" href={`${previewHref(r.env, r.path)}&ask=1`}>Find optimizations</AiButton>}
            </Box>
          </Box>
        ))}
      </Box>
      {rows.length > SHOW && (
        <Button size="small" onClick={() => setMore((m) => !m)} sx={{ mt: 0.5, textTransform: "none", fontWeight: 600 }}>
          {more ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </GlassCard>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700 }}>{k}</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</Typography>
    </Box>
  );
}
