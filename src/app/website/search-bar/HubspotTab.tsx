"use client";

// Search bar > HubSpot jobs: what the search bar writes into HubSpot and reads from it (the Google Ads buckets and
// live shop activity moved to their own service and page, 17.10.2026), each with its switch and
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
        const lo = d.live_on_shop, sc = d.stock_copy;
        return (
          <>
            <GlassCard>
              <CardTitle icon={<CloudSyncOutlinedIcon />} tint="blue" title="The search bar and HubSpot"
                note={`Two jobs on the search bar's gateway write into HubSpot or read from it, with the hub's HubSpot app. A switch stops the automatic runs; Run now always runs. The Google Ads buckets and live shop activity have their own page (Microservices > Google Ads buckets).${d.isAdmin ? "" : " Only an admin can switch or run them."}`} />
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
            </Grid>
          </>
        );
      }}
    </Loaded>
  );
}
