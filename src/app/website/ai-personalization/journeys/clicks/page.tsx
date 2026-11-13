"use client";

// APSOconvert > Journeys > CLICK MAP (SARCLA 08.11.2026: "visualize the journey of the customer here, click like
// Microsoft Clarity" - asked Clarity or our own: "our own click map"). Since 10.11.2026 the shop counts on EVERY page,
// every visit with statistics consent - nobody switches a page on (SARCLA: "every session where we are allowed to track -
// I'm not getting how we can only have these clicks"). Here: the add-to-carts by where they were made (the search bar,
// the chat, the pages' own buttons), and the pages clicked most, each opening its clicks drawn on it in Preview. The
// shop's gateway counts (src/lib/convert/clicks.ts); when it does not answer, this page says so and shows nothing made up.
// 13.11.2026: the three-step explanation on top is gone (SARCLA: "take out this"), and each page has "Find optimizations"
// beside its clicks (SARCLA: "also here button find optimization") - the Preview opened with the AI asked (&ask=1).

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import type { Env } from "@/lib/convert/model";
import type { CartsFrom } from "@/lib/convert/clicks";
import { CartsBySource } from "@/app/website/ai-personalization/CartsBySource";
import { AiButton } from "@/app/website/ai-personalization/AiButton";

type Total = { host: string; path: string; n: number; d: number; m: number; days: number };
type MapsData = { deployed: boolean; error: string | null; totals: { from: string; to: string; pages: Total[] } | null; canEdit: boolean };

const envOf = (host: string): Env => (host === "acc.apsoparts.com" ? "acc" : "prod");
const day = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
function pageName(path: string): string {
  if (path === "/" || /^\/[a-z]{2}-[A-Z]{2}\/?$/.test(path)) return `Home page${path.length > 1 ? ` · ${path.slice(1, 6)}` : ""}`;
  const last = path.replace(/\.html$/, "").split("/").filter(Boolean).pop() ?? path;
  const words = last.replace(/^\d{8}-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}
const clicksHref = (env: Env, path: string) => `${previewHref(env, path)}&clicks=1`;
const findHref = (env: Env, path: string) => `${previewHref(env, path)}&ask=1`;

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
  const [tick, setTick] = useState(0);
  const mapsUrl = `/api/website/ai-personalization/clicks?n=${tick}`;
  const held = useHeld<MapsData>(mapsUrl, [mapsUrl]);
  const cartsUrl = `/api/website/ai-personalization/clicks?carts=1&days=28&n=${tick}`;
  const cartsHeld = useHeld<{ carts: CartsFrom | null }>(cartsUrl, [cartsUrl]);
  const carts = cartsHeld.result === null ? undefined : cartsHeld.result.state === "ok" ? cartsHeld.result.data.carts : null;
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const top = [...(d?.totals?.pages ?? [])].sort((a, b) => b.n - a.n).slice(0, 12);

  let body: React.ReactNode;
  if (!r) body = <LoadingPanel label="Asking the shop's gateway what it counted…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="The shop's gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else if (d) {
    body = (
      <>
        {!d.deployed && (d.error
          ? <Notice tone="warn">The shop&apos;s gateway could not be read: {d.error}</Notice>
          : <Notice tone="warn">The shop&apos;s gateway does not answer for the click map right now - nothing is counted, and no number here is guessed.</Notice>)}

        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<AddShoppingCartOutlinedIcon />} tint="green" title="Put in the cart - from where" note="The last 28 days" />
          <Box sx={{ mt: 1.5 }}><CartsBySource carts={carts} /></Box>
        </GlassCard>

        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<TouchAppOutlinedIcon />} tint="amber" title="The pages clicked most" note={d.totals ? `${day(d.totals.from)} - ${day(d.totals.to)}` : undefined} />
          {top.length === 0
            ? <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 1.5 }}>{d.deployed ? "No click counted yet - they come in as visitors click." : "Nothing counted."}</Typography>
            : (
              <Box sx={{ display: "grid", gap: 2, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" } }}>
                {top.map((x) => {
                  const env = envOf(x.host);
                  return (
                    <PageCard key={`${x.host}:${x.path}`} env={env} path={x.path}
                      note={<><Chip tint="amber">{full(x.n)} click{x.n === 1 ? "" : "s"} · {full(x.d)} desktop · {full(x.m)} phone</Chip>{env === "acc" && <Chip tint="slate">ACC</Chip>}</>}>
                      <Button component={Link} href={clicksHref(env, x.path)} size="small" variant="contained" color="warning" disableElevation startIcon={<TouchAppOutlinedIcon sx={{ fontSize: 16 }} />}
                        sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>See the clicks on the page</Button>
                      <AiButton size="small" href={findHref(env, x.path)}>Find optimizations</AiButton>
                    </PageCard>
                  );
                })}
              </Box>
            )}
        </GlassCard>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Click map" subtitle="Where people click on every page of the shop, and where they put things in the cart"
        rightSlot={<Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {body}
    </Box>
  );
}
