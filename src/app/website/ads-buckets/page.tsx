"use client";

// GOOGLE ADS BUCKETS - Website > Microservices > Google Ads buckets (SARCLA 17.10.2026: "Google Ads buckets should
// be a separate microservice"). The Ads Gateway on Railway holds, in memory only, whether each web buyer's company
// is new, active or reactivated (read nightly from HubSpot orders) and answers the GTM cart tag; it also writes the
// live shop activity of signed-in buyers onto their company. This page reads it (src/lib/adsbuckets/gateway.ts),
// with the switches and Run now for admins. Same UC kit as the other microservices.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import FiberNewOutlinedIcon from "@mui/icons-material/FiberNewOutlined";
import AutorenewOutlinedIcon from "@mui/icons-material/AutorenewOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, INK, KpiTile, MUTED, Notice, RED, bodyCell } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import { when } from "@/app/website/directup/shared";
import type { AdsGatewaySetting, AdsHealth, AdsJob, AdsStatus } from "@/lib/adsbuckets/gateway";

type Data = { status: AdsStatus; health: AdsHealth | null; setting: AdsGatewaySetting; isAdmin: boolean };
const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };

async function post(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/website/ads-buckets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string };
}

/** What the cart tag was answered, in words (the gateway's reasons). */
const ANSWERS: [string, string, string?][] = [
  ["ok", "Answered new / active / reactivated", GREEN],
  ["unknown_buyer", "Buyer not on the list (no answer - Google decides)"],
  ["no_table", "List not built yet (after a restart)"],
  ["stale_table", "List too old (no answer)"],
  ["switched_off", "Switched off here"],
  ["bad_origin", "Not from the shop (refused)"],
  ["rate_limited", "Too many asks from one address"],
  ["bad_body", "Malformed ask"],
  ["error", "Error", RED],
];

function Controls({ job, d, title, offAsk, runLabel, runAction, runAsk, reload }: {
  job: AdsJob; d: Data; title: string; offAsk: string; runLabel: string; runAction: "build" | "flush"; runAsk?: string; reload: () => void;
}) {
  const sw = d.status.switches[job];
  const [busy, setBusy] = useState<"switch" | "run" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (on: boolean) => {
    if (!on && !confirm(offAsk)) return;
    setBusy("switch"); setMsg(null);
    const r = await post({ action: "switch", job, on });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: on ? "On." : "Off." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const run = async () => {
    if (runAsk && !confirm(runAsk)) return;
    setBusy("run"); setMsg(null);
    const r = await post({ action: runAction });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: "Started - refresh in a moment for the result." } : { ok: false, text: r.error ?? "Did not work." });
  };
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
      <Chip tint={sw.on ? "green" : "slate"}>{sw.on ? "On" : "Off"}</Chip>
      <Chip tint="slate">{sw.set ? `switched ${when(sw.set_at)}` : "as set on Railway"}</Chip>
      {d.isAdmin && (
        <>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {busy === "switch" && <CircularProgress size={14} />}
            <Switch checked={sw.on} disabled={busy !== null} onChange={(e) => void flip(e.target.checked)} slotProps={{ input: { "aria-label": title } }} />
          </Box>
          <Button size="small" variant="outlined" sx={pill} disabled={busy !== null} onClick={() => void run()}>{busy === "run" ? <CircularProgress size={14} /> : runLabel}</Button>
        </>
      )}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </Box>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode, string?][] }) {
  return (
    <Table size="small">
      <TableBody>
        {rows.map(([label, value, colour]) => (
          <TableRow key={label}>
            <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED, pl: 0 }}>{label}</TableCell>
            <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: colour ?? INK, textAlign: "right", pr: 0, fontVariantNumeric: "tabular-nums" }}>{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Body({ d, reload }: { d: Data; reload: () => void }) {
  const b = d.status.buckets, lb = b.last_build, sa = d.status.shop_activity;
  const n = (k: string) => lb.buckets?.[k] ?? 0;
  const answered = Object.values(b.answers ?? {}).reduce((x, y) => x + y, 0);
  const stale = b.age_hours != null && b.age_hours > b.stale_hours;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={<CampaignOutlinedIcon />} tint="blue" label="Buyers known" value={full(b.keys_in_memory)} note={b.built_at ? `list built ${when(b.built_at)}` : "list not built yet"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={<FiberNewOutlinedIcon />} tint="green" label="New companies" value={full(n("new"))} note="never ordered from us" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={<AutorenewOutlinedIcon />} tint="blue" label="Active" value={full(n("active"))} note={`ordered within ${b.active_days} days`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={<HistoryOutlinedIcon />} tint="purple" label="Reactivated" value={full(n("reactivated"))} note={`last order over ${b.active_days} days ago`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={<PauseCircleOutlineIcon />} tint="slate" label="Held back" value={full(n("held"))} note="not called new without proof" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%", display: "grid", gap: 1.25, alignContent: "start" }}>
            <CardTitle icon={<ShoppingCartCheckoutOutlinedIcon />} tint="amber" title="Answer to the cart tag"
              note="Each night, from 24 months of HubSpot web orders: is the buyer's company new, active or reactivated? The GTM tag on the cart asks, so the purchase sends Google Ads the right conversion. Kept in memory only, rebuilt at every restart." />
            <Controls job="ads_buckets" d={d} reload={reload} title="Answer to the cart tag" runLabel="Build now" runAction="build"
              offAsk="Switch the answer off? The cart tag then gets no answer and Google falls back to its own guess. The nightly list goes on while live shop activity is on - it needs it."
              runAsk="Build the list again now? It reads 24 months of HubSpot orders and takes about 15 minutes; the current list keeps answering until the new one is ready." />
            <Rows rows={[
              ["Last build", b.building ? "building now" : lb.finished_at ? `${when(lb.finished_at)}${lb.duration_s != null ? ` · ${Math.round(lb.duration_s / 60)} min` : ""}` : "not since the service started", lb.ok === false ? RED : undefined],
              ...(lb.ok === false ? [["Error", lb.error ?? "", RED] as [string, React.ReactNode, string]] : []),
              ["Companies in the last build", lb.companies != null ? full(lb.companies) : "-"],
              ["Answer given until the list is", `${b.stale_hours} hours old`],
            ]} />
            {stale && <Notice tone="warn">The list is {b.age_hours} hours old: the cart tag gets no answer until it is built again.</Notice>}
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Held back: a company is only called new when nothing says it already buys from us (no ERP number, no sister contact on its domain) - a wrong "new" is the error this list exists to avoid.</Typography>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CampaignOutlinedIcon />} tint="blue" title="What the cart tag was told" note={`${full(answered)} asks since the service last started`} />
            <Rows rows={ANSWERS.filter(([k]) => (b.answers?.[k] ?? 0) > 0 || ["ok", "unknown_buyer", "no_table"].includes(k)).map(([k, label, colour]) => [label, full(b.answers?.[k] ?? 0), colour])} />
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<TouchAppOutlinedIcon />} tint="purple" title="Live shop activity"
          note="Views, logins, carts and orders of signed-in buyers, written into the company's E-shop activity every few seconds - the hub's Live page reads it. The company comes from the same buyer list." />
        <Controls job="shop_activity" d={d} reload={reload} title="Live shop activity" runLabel="Write now" runAction="flush"
          offAsk="Switch live shop activity off? New views, logins, carts and orders are then not recorded; what is already waiting still reaches HubSpot." />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Rows rows={[
              ["Events since the service started", full(sa.accepted)],
              ["Company writes", full(sa.companies_written)],
              ["Last write", sa.last_flush_at ? when(sa.last_flush_at) : "-"],
              ["Waiting to be written", full(sa.pending_companies)],
              ["Held while the list was building", `${full(sa.deferred)} · ${full(sa.deferred_recovered)} placed later · ${full(sa.deferred_expired)} expired`],
            ]} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Rows rows={[
              ["Shop sessions seen (signed in)", `${full(sa.emitter_pings)} (${full(sa.emitter_pings_signed_in)})`],
              ["Buyers it cannot place", `${full(sa.unknown_buyer)} - a company is never guessed`],
              ...(sa.switched_off ? [["Not recorded (switched off)", full(sa.switched_off)] as [string, React.ReactNode]] : []),
              ["Write errors", `${full(sa.write_errors)}${sa.retry_in_s ? ` · next try in ${sa.retry_in_s} s` : ""}`, sa.write_errors ? RED : undefined],
              ["Refused (not from the shop / malformed)", `${full(sa.dropped?.bad_origin ?? 0)} / ${full(sa.dropped?.bad_body ?? 0)}`],
            ]} />
          </Grid>
        </Grid>
        {sa.last_error && <Notice tone="warn">Last write error: {sa.last_error}</Notice>}
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<RouterOutlinedIcon />} tint="slate" title="Where it runs"
          note="Its own service since 17.10.2026 (before, inside the search bar's gateway: every search bar restart rebuilt the list). Nothing about a customer is stored there - the list and the activity buffer live in memory." />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          <Chip tint={d.health ? "green" : "pink"}>{d.health ? "Ads Gateway answering" : "Ads Gateway not answering"}</Chip>
          <Chip tint="slate">{d.setting.url.replace(/^https:\/\//, "")}{d.setting.fromDefault ? " (the Railway address)" : ""}</Chip>
          <Chip tint="slate">The shop still calls the search bar's address, which passes both calls on - GTM unchanged</Chip>
        </Box>
      </GlassCard>
    </>
  );
}

export default function AdsBucketsPage() {
  const [n, setN] = useState(0);
  const held = useHeld<Data>(`/api/website/ads-buckets?n=${n}`, [n]);
  const reload = () => setN((x) => x + 1);
  const r = held.result;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Google Ads buckets"
        subtitle="Whether a web buyer's company is new, active or reactivated, for the Google Ads conversion - and the live shop activity of signed-in buyers"
        rightSlot={<Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {r === null ? <LoadingPanel label="Reading the Ads Gateway…" />
        : r.state === "not-configured" ? <NotConnectedPanel source="Ads Gateway" missing={r.missing} />
        : r.state === "error" ? <UpstreamPanel source="Ads Gateway" error={r.error} status={r.status} onRetry={reload} />
        : <Body d={r.data} reload={reload} />}
    </Box>
  );
}
