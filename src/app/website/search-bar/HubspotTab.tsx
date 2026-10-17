"use client";

// Search bar > HubSpot jobs: what the search bar writes into HubSpot and reads from it, each with its switch and
// "Run now" (SARCLA 17.10.2026: the jobs stay on the gateway - the shop's tags call it - and are switched and
// watched from here). A switch stops the automatic runs; "Run now" always runs. Admins only.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, Notice, RED, type Tint } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import type { HubspotJobName, HubspotJobs } from "@/lib/searchbar/gateway";
import { Loaded, pill, post, when } from "./shared";

type Data = HubspotJobs & { isAdmin: boolean };

/** One status line: a label, a value, optionally coloured. */
function Line({ label, children, colour }: { label: string; children: React.ReactNode; colour?: string }) {
  return (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
      {label}: <Box component="span" sx={{ color: colour ?? INK, fontWeight: 600 }}>{children}</Box>
    </Typography>
  );
}

function Job({ name, d, icon, tint, title, what, offNote, runLabel, runAsk, children, reload }: {
  name: HubspotJobName; d: Data; icon: React.ReactNode; tint: Tint; title: string; what: string; offNote: string;
  runLabel: string; runAsk?: string; children: React.ReactNode; reload: () => void;
}) {
  const sw = d.switches[name];
  const [busy, setBusy] = useState<"switch" | "run" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (on: boolean) => {
    if (!on && !confirm(`Switch "${title}" off? ${offNote}`)) return;
    setBusy("switch"); setMsg(null);
    const r = await post({ action: "hubspot-job", job: name, on });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: on ? "On." : "Off." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const run = async () => {
    if (runAsk && !confirm(runAsk)) return;
    setBusy("run"); setMsg(null);
    const r = await post({ action: "hubspot-job-run", job: name });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: "Started - read again in a moment for the result." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) setTimeout(reload, 4000);
  };
  return (
    <GlassCard sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
      <CardTitle icon={icon} tint={tint} title={title} note={what}
        right={d.isAdmin ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {busy === "switch" && <CircularProgress size={14} />}
            <Switch checked={sw.on} disabled={busy !== null} onChange={(e) => void flip(e.target.checked)} slotProps={{ input: { "aria-label": title } }} />
          </Box>
        ) : undefined} />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        <Chip tint={sw.on ? "green" : "slate"}>{sw.on ? "On" : "Off - runs only with Run now"}</Chip>
        <Chip tint="slate">{sw.set ? `switched ${when(sw.set_at)}` : "as set on Railway"}</Chip>
      </Box>
      <Box sx={{ display: "grid", gap: 0.35, flex: 1 }}>{children}</Box>
      {d.isAdmin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" variant="outlined" sx={pill} disabled={busy !== null} onClick={() => void run()}>
            {busy === "run" ? <CircularProgress size={14} /> : runLabel}
          </Button>
          {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
        </Box>
      )}
    </GlassCard>
  );
}

export default function HubspotTab() {
  return (
    <Loaded<Data> url="/api/website/search-bar?part=hubspot" what="the HubSpot jobs">
      {(d, reload) => {
        const lo = d.live_on_shop, sc = d.stock_copy, ab = d.ads_buckets, sa = d.shop_activity;
        const lb = ab.last_build;
        return (
          <>
            <GlassCard>
              <CardTitle icon={<CloudSyncOutlinedIcon />} tint="blue" title="The search bar and HubSpot"
                note={`Four jobs on the search bar's gateway write into HubSpot or read from it, with the hub's HubSpot app. A switch stops the automatic runs; Run now always runs.${d.isAdmin ? "" : " Only an admin can switch or run them."}`} />
            </GlassCard>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Job name="live_on_shop" d={d} reload={reload} icon={<StorefrontOutlinedIcon />} tint="green" title="Live on shop in HubSpot"
                  what="The shop's own pages say which articles it sells; the answer goes to Products & Pricing > Live on shop, after each night's page reading."
                  offNote="HubSpot's Live on shop then stops following the shop until it is switched on again or run by hand."
                  runLabel="Send the changes now">
                  <Line label="Articles live in HubSpot">{lo.live != null ? full(lo.live) : "-"}</Line>
                  <Line label="Changes waiting" colour={lo.pending ? undefined : GREEN}>{lo.pending != null ? full(lo.pending) : "-"}</Line>
                  <Line label="Last run">{lo.sync.running ? "running now" : lo.sync.last ? `${when(lo.sync.last.at)}${lo.sync.last.skipped ? ` - waited (${lo.sync.last.skipped})` : lo.sync.last.error ? ` - failed: ${lo.sync.last.error}` : ` - ${full(lo.sync.last.wrote ?? lo.sync.last.done ?? 0)} written`}` : "not since the gateway started"}</Line>
                </Job>
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Job name="stock_copy" d={d} reload={reload} icon={<Inventory2OutlinedIcon />} tint="blue" title="Stock copy from HubSpot"
                  what={`Every ${sc.every_min} minutes: stock that Compass wrote straight into HubSpot reaches the search bar (only what changed).`}
                  offNote="Stock changed in HubSpot then no longer reaches the search bar; the nightly check and the order refresh still read the shop."
                  runLabel="Copy now">
                  <Line label="Last run">{sc.running ? "running now" : sc.last ? (sc.last.error ? <Box component="span" sx={{ color: RED }}>{when(sc.last.at)} - failed: {sc.last.error}</Box> : `${when(sc.last.at)} - ${full(sc.last.seen ?? 0)} changed in HubSpot, ${full(sc.last.updated ?? 0)} copied`) : "not since the gateway started"}</Line>
                  <Line label="Changes read up to">{sc.watermark ? when(sc.watermark) : "-"}</Line>
                </Job>
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Job name="ads_buckets" d={d} reload={reload} icon={<CampaignOutlinedIcon />} tint="amber" title="Google Ads buckets"
                  what="Each night: whether a web buyer's company is new, active or reactivated, read from HubSpot orders, so the cart tag sends Google Ads the right conversion. Kept in the gateway's memory only."
                  offNote="The cart tag then gets no answer (Google falls back to its own guess). The nightly build goes on while Live shop activity is on - it needs the same list."
                  runLabel="Build now" runAsk="Build the list again now? It reads 24 months of HubSpot orders and takes a few minutes.">
                  <Line label="Buyers known">{full(ab.keys_in_memory)}{ab.built_at ? ` · built ${when(ab.built_at)}` : ""}</Line>
                  {lb.buckets && <Line label="Companies">{Object.entries(lb.buckets).map(([k, n]) => `${full(n)} ${k}`).join(" · ")}</Line>}
                  <Line label="Last build" colour={lb.ok === false ? RED : undefined}>{ab.building ? "building now" : lb.finished_at ? `${when(lb.finished_at)}${lb.ok === false ? ` - failed: ${lb.error}` : lb.duration_s != null ? ` - ${lb.duration_s} s` : ""}` : "not since the gateway started"}</Line>
                  {ab.age_hours != null && ab.age_hours > ab.stale_hours && <Notice tone="warn">The list is {ab.age_hours} hours old: the cart tag gets no answer until it is built again.</Notice>}
                </Job>
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Job name="shop_activity" d={d} reload={reload} icon={<TouchAppOutlinedIcon />} tint="purple" title="Live shop activity"
                  what="Views, logins, carts and orders of signed-in buyers, written into the company's E-shop activity every few seconds - the hub's Live page reads it."
                  offNote="New shop activity is then not recorded; what is already waiting still reaches HubSpot."
                  runLabel="Write now">
                  <Line label="Since the gateway started">{full(sa.accepted)} events · {full(sa.companies_written)} company writes{sa.switched_off ? ` · ${full(sa.switched_off)} not recorded (off)` : ""}</Line>
                  <Line label="Last write">{sa.last_flush_at ? when(sa.last_flush_at) : "-"}{sa.pending_companies ? ` · ${full(sa.pending_companies)} waiting` : ""}</Line>
                  {(sa.write_errors > 0 || sa.consecutive_failures > 0) && <Line label="Errors" colour={RED}>{full(sa.write_errors)}{sa.retry_in_s ? ` · next try in ${sa.retry_in_s} s` : ""}{sa.last_error ? ` · ${sa.last_error}` : ""}</Line>}
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Buyers it cannot place: {full(sa.unknown_buyer)} - a company is never guessed.</Typography>
                </Job>
              </Grid>
            </Grid>
          </>
        );
      }}
    </Loaded>
  );
}
