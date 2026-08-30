"use client";

// LIVE — who is on apsoparts.com right now, and who is in this hub. The shop
// side is GA4 realtime (last 30 minutes); the hub side is this app's own
// audit trail. It refreshes itself every 30 seconds while the page is open.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import PageHeader from "@/app/PageHeader";
import { Gate, GUTTER, HAIRLINE, INK, MUTED, Section, SourceNote } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { compact, full } from "@/app/charts/format";
import { ACCENT, CHROME, DEEMPHASIS } from "@/app/charts/palette";
import { WorldMap } from "./WorldMap";
import type { Ga4Realtime } from "@/lib/integrations/ga4Realtime";
import type { HubActivity } from "@/lib/hubActivity";

const REFRESH_MS = 30_000;

type LiveShop = Ga4Realtime;

function MinuteBars({ minutes }: { minutes: Ga4Realtime["byMinute"] }) {
  // 30 columns, oldest left, newest right; a minute GA4 did not return is empty, not zero.
  const slots = Array.from({ length: 30 }, (_, i) => {
    const m = 29 - i;
    const row = minutes.find((r) => r.minutesAgo === m);
    return { m, v: row ? row.activeUsers : null };
  });
  const max = Math.max(1, ...slots.map((s) => s.v ?? 0));
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 72 }}>
      {slots.map((s) => (
        <Tooltip key={s.m} title={s.v === null ? `${s.m} min ago · not returned` : `${s.m} min ago · ${s.v}`} placement="top">
          <Box
            sx={{
              flex: 1,
              height: s.v === null ? 2 : `${Math.max(4, (s.v / max) * 100)}%`,
              bgcolor: s.v === null ? DEEMPHASIS : s.m === 0 ? ACCENT : "rgba(45,111,168,0.55)",
              borderRadius: "3px 3px 0 0",
              transition: "height 220ms ease",
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

export default function LivePage() {
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, refresh]);

  const shop = useHeld<LiveShop>("/api/live?source=shop", [tick]);
  const hub = useHeld<HubActivity>("/api/live?source=hub", [tick]);

  const fetchedAt = useMemo(() => (shop.result?.state === "ok" ? shop.result.data.fetchedAt : null), [shop.result]);

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Live"
        subtitle="Who is on apsoparts.com right now — GA4 realtime, last 30 minutes — and who is working in this hub"
        badge="Live"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
              {fetchedAt ? `Updated ${ago(fetchedAt)}` : "Not updated yet"}
            </Typography>
            <Switch size="small" checked={auto} onChange={(e) => setAuto(e.target.checked)} inputProps={{ "aria-label": "Refresh every 30 seconds" }} />
            <Typography sx={{ fontSize: "0.8rem", color: INK }}>Auto-refresh</Typography>
          </Box>
        }
      />

      <Gate held={shop} source="Google Analytics 4" loadingLabel="Asking GA4 who is on the site…" onRetry={refresh}>
        {(data, stale) => {
          const countries = data.byCountry.map((c) => ({ country: c.key, value: c.activeUsers ?? 0 }));
          const topCountry = data.byCountry[0];
          return (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Active users now" value={compact(data.activeUsers)} note="On the shop in the last 30 minutes" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Countries active" value={full(data.byCountry.length)} note={topCountry ? `Most in ${topCountry.key}` : "None returned"} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="On desktop"
                    value={compact(data.byDevice.find((d) => d.key === "desktop")?.activeUsers ?? null)}
                    note={`${compact(data.byDevice.find((d) => d.key === "mobile")?.activeUsers ?? null)} on mobile`}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Busiest page now" value={data.byPage[0] ? compact(data.byPage[0].activeUsers) : "—"} note={data.byPage[0]?.key ?? "No page rows"} />
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <ChartFrame
                  title="Where visitors are right now"
                  caption="Active users by country, last 30 minutes"
                  stale={stale}
                  empty={countries.length === 0 ? "GA4 reports nobody on the site in the last 30 minutes." : null}
                  table={{ columns: ["Country", "Active users"], numeric: [1], rows: data.byCountry.map((c) => [c.key, full(c.activeUsers)]) }}
                >
                  <WorldMap points={countries} />
                </ChartFrame>
              </Section>

              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame title="Minute by minute" caption="Active users in each of the last 30 minutes; the newest minute is on the right" stale={stale}>
                      <MinuteBars minutes={data.byMinute} />
                    </ChartFrame>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Cities"
                      caption="Top cities by active users"
                      stale={stale}
                      empty={data.byCity.length === 0 ? "No city rows in the last 30 minutes." : null}
                      table={{ columns: ["City", "Country", "Active users"], numeric: [2], rows: data.byCity.map((c) => [c.city, c.country, full(c.activeUsers)]) }}
                    >
                      <BarList rows={data.byCity.slice(0, 10).map((c) => ({ label: `${c.city}${c.country ? `, ${c.country}` : ""}`, value: c.activeUsers }))} labelWidth={200} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <ChartFrame
                  title="Pages being viewed"
                  caption="Active users by page title, last 30 minutes"
                  stale={stale}
                  empty={data.byPage.length === 0 ? "No page rows in the last 30 minutes." : null}
                  table={{ columns: ["Page", "Active users"], numeric: [1], rows: data.byPage.map((p) => [p.key, full(p.activeUsers)]) }}
                >
                  <BarList rows={data.byPage.map((p) => ({ label: p.key, value: p.activeUsers }))} labelWidth={300} maxLabel={56} />
                </ChartFrame>
              </Section>
            </Box>
          );
        }}
      </Gate>

      <Section sx={{ mt: 2.5 }}>
        <Gate held={hub} source="The hub's audit trail" loadingLabel="Reading hub activity…" onRetry={refresh}>
          {(data, stale) => (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>This hub, last {data.minutes} minutes</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                    {data.actors.length === 0
                      ? "No one has acted in the hub in this period."
                      : `${data.actors.length} ${data.actors.length === 1 ? "person" : "people"} active · ${data.recent.length} actions · ${data.contentTouched} pieces touched`}
                  </Typography>
                </Box>
              </Box>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <BarList rows={data.actors.map((a) => ({ label: a.actor, value: a.actions, secondary: ago(a.lastAt) }))} labelWidth={180} emptyMessage="Nobody active." />
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Box sx={{ display: "grid", gap: 0.5 }}>
                    {data.recent.slice(0, 12).map((r, i) => (
                      <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "baseline", borderBottom: `1px solid ${HAIRLINE}`, py: 0.6 }}>
                        <Typography sx={{ fontSize: "0.78rem", color: MUTED, minWidth: 74, fontVariantNumeric: "tabular-nums" }}>{ago(r.at)}</Typography>
                        <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600, minWidth: 120 }}>{r.actor}</Typography>
                        <Typography sx={{ fontSize: "0.84rem", color: CHROME.muted }}>{r.action}{r.target ? ` · ${r.target}` : ""}</Typography>
                      </Box>
                    ))}
                    {data.recent.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No actions recorded.</Typography>}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </Gate>
      </Section>

      <SourceNote>
        Shop: GA4 realtime report for property {shop.result?.state === "ok" ? shop.result.data.propertyId : "…"}, last 30 minutes, refreshed every 30 s while this page is open. Hub: the
        apsomh_audit table. Nothing here is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}
