"use client";

// APSOconvert > Journeys > CLICK MAP (SARCLA 08.11.2026: "visualize the journey of the customer here, click like
// Microsoft Clarity" - asked Clarity or our own: "our own click map"). The pages the shop counts clicks on, the pages
// worth counting (the most viewed), and the way to each page's clicks drawn on it in Preview. The shop's gateway counts
// (src/lib/convert/clicks.ts); until it runs the version that counts, this page says so and shows nothing made up.

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { HeatLegend } from "@/app/website/ai-personalization/ClicksBar";
import { convertPost, previewHref } from "@/app/website/ai-personalization/Flow";
import type { Env } from "@/lib/convert/model";
import type { ProblemsData } from "@/lib/convert/problems";

type Map = { id: string; host: string; paths: string[]; until: string | null; by: string | null };
type Total = { host: string; path: string; n: number; d: number; m: number; days: number };
type MapsData = { deployed: boolean; error: string | null; maps: Map[]; totals: { from: string; to: string; pages: Total[] } | null; canEdit: boolean };

const ORANGE = "#b45309";
const envOf = (host: string): Env => (host === "acc.apsoparts.com" ? "acc" : "prod");
const day = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "no end");
function pageName(path: string): string {
  const last = path.replace(/\.html$/, "").split("/").filter(Boolean).pop() ?? path;
  const words = last.replace(/^\d{8}-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}
const clicksHref = (env: Env, path: string) => `${previewHref(env, path)}&clicks=1`;

const STEPS = [
  { n: 1, title: "A person chooses a page", text: "Here or in Preview (\"Clicks\"): the shop counts there for 30 days - 20 pages at most at once." },
  { n: 2, title: "The shop counts, with consent", text: "Only visitors who accept statistics cookies: which element, and where inside it. No person, no text typed." },
  { n: 3, title: "Preview draws it on the page", text: "Each clicked element tinted where it was clicked, its count above it - on desktop, on a phone, or both." },
];

function PageCard({ env, path, children, note }: { env: Env; path: string; children: React.ReactNode; note: React.ReactNode }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden", bgcolor: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <PageShot env={env} path={path} ratio={0.56} />
      <Box sx={{ p: 1.5, display: "grid", gap: 0.75, flex: 1, alignContent: "start" }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{pageName(path)}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontFamily: "ui-monospace, Consolas, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={path}>{path}</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{note}</Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: "auto", pt: 0.5 }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default function ClickMapPage() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mapsUrl = `/api/website/ai-personalization/clicks?n=${tick}`;
  const held = useHeld<MapsData>(mapsUrl, [mapsUrl]);
  const probUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const prob = useHeld<ProblemsData>(probUrl, [probUrl]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const problems = prob.result?.state === "ok" ? prob.result.data : null;

  const switchIt = async (env: Env, path: string, on: boolean) => {
    if (on && !window.confirm(`Count clicks on ${path} (${env === "acc" ? "ACC" : "the live shop"}) for 30 days?\n\nOnly visitors who accept statistics cookies are counted: which element and where inside it - no person, no text typed.`)) return;
    setBusy(`${env}:${path}`); setErr(null);
    const res = await convertPost("/api/website/ai-personalization/clicks", { env, path, on });
    setBusy(null);
    if (!res.ok) setErr(res.error); else setTick((n) => n + 1);
  };

  const counted = new Set((d?.maps ?? []).flatMap((m) => m.paths.map((p) => `${envOf(m.host)}:${p}`)));
  // pages counted earlier whose map is off: their clicks stay and can still be seen
  const before = (d?.totals?.pages ?? []).filter((x) => !counted.has(`${envOf(x.host)}:${x.path}`)).slice(0, 9);
  const worth = (problems?.pages ?? []).filter((p) => p.views > 0 && !counted.has(`prod:${p.path}`)).sort((a, b) => b.views - a.views).slice(0, 6);

  let body: React.ReactNode;
  if (!r) body = <LoadingPanel label="Asking the shop's gateway which pages it counts…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="The shop's gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else if (d) {
    body = (
      <>
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ mb: 1.5 }}>
            <CardTitle icon={<TouchAppOutlinedIcon />} tint="amber" right={<HeatLegend />}
              title={d.deployed ? `${d.maps.length} page${d.maps.length === 1 ? "" : "s"} counted` : "The click map fills once the shop's gateway is deployed"} />
          </Box>
          {!d.deployed && (
            d.error
              ? <Notice tone="warn">The shop&apos;s gateway could not be read: {d.error}</Notice>
              : <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5, p: 1.25, borderRadius: "10px", bgcolor: "rgba(36,89,209,.05)", border: "1px solid rgba(36,89,209,.18)" }}>
                  The shop counts clicks once its gateway runs the new version (SARCLA deploys it). Until then nothing is counted - no number on this page is guessed. Everything else is ready: the pages below can be chosen the day it runs.
                </Typography>
          )}
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(3, minmax(0,1fr))" }, mt: d.deployed ? 0 : 1.5 }}>
            {STEPS.map((s) => (
              <Box key={s.n} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.25, borderRadius: "10px", bgcolor: "rgba(250,190,40,.07)", border: "1px solid rgba(180,83,9,.18)" }}>
                <Box sx={{ width: 24, height: 24, flex: "none", borderRadius: "4px", bgcolor: ORANGE, color: "#fff", fontWeight: 700, fontSize: "0.8rem", display: "grid", placeItems: "center" }}>{s.n}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: INK }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45 }}>{s.text}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
          {err && <Box sx={{ mt: 1.5 }}><Notice tone="warn">{err}</Notice></Box>}
        </GlassCard>

        {d.deployed && d.maps.length > 0 && (
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<TouchAppOutlinedIcon />} tint="green" title="Counting now" />
            <Box sx={{ display: "grid", gap: 2, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" } }}>
              {d.maps.flatMap((m) => m.paths.map((p) => {
                const env = envOf(m.host);
                const tot = d.totals?.pages.find((x) => x.host === m.host && x.path === p) ?? null;
                return (
                  <PageCard key={`${m.id}:${p}`} env={env} path={p}
                    note={<>
                      <Chip tint="amber">{tot ? `${full(tot.n)} click${tot.n === 1 ? "" : "s"} · ${full(tot.d)} desktop · ${full(tot.m)} phone` : "No click yet"}</Chip>
                      <Chip tint="green">Counting until {day(m.until)}</Chip>{env === "acc" && <Chip tint="slate">ACC</Chip>}{m.by && <Chip tint="slate">{m.by}</Chip>}
                    </>}>
                    <Button component={Link} href={clicksHref(env, p)} size="small" variant="contained" color="warning" disableElevation startIcon={<TouchAppOutlinedIcon sx={{ fontSize: 16 }} />}
                      sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>See the clicks on the page</Button>
                    {d.canEdit && (
                      <Button size="small" variant="outlined" color="warning" disabled={busy === `${env}:${p}`} onClick={() => void switchIt(env, p, false)}
                        sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>{busy === `${env}:${p}` ? "…" : "Stop"}</Button>
                    )}
                  </PageCard>
                );
              }))}
            </Box>
          </GlassCard>
        )}

        {before.length > 0 && (
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<TouchAppOutlinedIcon />} tint="slate" title="Counted before" note="Switched off - their clicks of the last 30 days stay" />
            <Box sx={{ display: "grid", gap: 2, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" } }}>
              {before.map((x) => {
                const env = envOf(x.host);
                return (
                  <PageCard key={`${x.host}:${x.path}`} env={env} path={x.path}
                    note={<><Chip tint="amber">{full(x.n)} click{x.n === 1 ? "" : "s"} · {full(x.d)} desktop · {full(x.m)} phone</Chip>{env === "acc" && <Chip tint="slate">ACC</Chip>}</>}>
                    <Button component={Link} href={clicksHref(env, x.path)} size="small" variant="outlined" color="warning" startIcon={<TouchAppOutlinedIcon sx={{ fontSize: 16 }} />}
                      sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>See the clicks on the page</Button>
                  </PageCard>
                );
              })}
            </Box>
          </GlassCard>
        )}

        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<VisibilityOutlinedIcon />} tint="slate" title="Pages worth counting" />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>
            The most viewed pages of the period{problems ? ` (${day(problems.from)} - ${day(problems.to)})` : ""} - where a click map says the most.
          </Typography>
          {!prob.result ? <Box sx={{ mt: 1.5 }}><LoadingPanel label="Reading the most viewed pages…" /></Box>
            : !problems ? <Box sx={{ mt: 1.5 }}><Notice tone="warn">The pages&apos; views could not be read.</Notice></Box>
              : problems.ga4.configured && !problems.ga4.ok ? <Box sx={{ mt: 1.5 }}><Notice tone="warn">GA4 could not be read{problems.ga4.error ? `: ${problems.ga4.error}` : ""} - the pages&apos; views come from there.</Notice></Box>
              : worth.length === 0 ? <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 1.5 }}>{problems.pages.some((x) => x.views > 0) ? "Every viewed page is counted already." : `No page views read for this period${problems.ga4.configured ? "" : " - GA4 is not connected on this hub"}.`}</Typography>
                : (
                  <Box sx={{ display: "grid", gap: 2, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" } }}>
                    {worth.map((p) => (
                      <PageCard key={p.key} env="prod" path={p.path}
                        note={<><Chip tint="slate">{full(p.views)} views</Chip><Chip tint="slate">{full(p.addToCarts)} add-to-carts</Chip></>}>
                        {d.deployed && d.canEdit
                          ? <Button size="small" variant="contained" color="warning" disableElevation disabled={busy === `prod:${p.path}`} onClick={() => void switchIt("prod", p.path, true)}
                              startIcon={<TouchAppOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>
                              {busy === `prod:${p.path}` ? "…" : "Count clicks here for 30 days"}
                            </Button>
                          : <Tooltip title={d.deployed ? "Counting a page needs the write access of Preview" : "Counts once the shop's gateway is deployed"}>
                              <span><Button size="small" variant="contained" color="warning" disableElevation disabled sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Count clicks here</Button></span>
                            </Tooltip>}
                        <Button component={Link} href={previewHref("prod", p.path)} size="small" variant="outlined" sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>Open in Preview</Button>
                      </PageCard>
                    ))}
                  </Box>
                )}
        </GlassCard>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Click map" subtitle="Where people click on the shop's pages - counted by the shop itself, drawn on the page in Preview"
        rightSlot={<Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {body}
    </Box>
  );
}
