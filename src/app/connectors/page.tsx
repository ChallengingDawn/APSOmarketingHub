"use client";

// CONNECTORS & INTEGRATION - the overview. Is the data flowing, and how far has
// the Compass connector moved into the hub.

import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import MoveUpOutlinedIcon from "@mui/icons-material/MoveUpOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CableOutlinedIcon from "@mui/icons-material/CableOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, TRACK } from "@/app/uc/report/ui";
import { GROUPS, IN_HUB, STEPS, progress } from "@/lib/connectors/compass";
import { chainVerdict } from "@/lib/connectors/snapshot";
import { Chip, ConnectorsPage, Muted, PHASE, TONE, ago, when, type Snapshot } from "./parts";

function Connection({ name, flow, status, href, linkLabel }: { name: string; flow: string; status: React.ReactNode; href: string; linkLabel: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px minmax(0,1fr) auto auto" }, gap: { xs: 0.75, md: 2 }, alignItems: "center", py: 1.25, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
      <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{name}</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{flow}</Typography>
      <Box>{status}</Box>
      <Box component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
        {linkLabel} <ArrowForwardIcon sx={{ fontSize: 15 }} />
      </Box>
    </Box>
  );
}

function Overview({ s }: { s: Snapshot }) {
  const v = chainVerdict(s);
  const last = s.state?.sftp?.last;
  const lastWithFiles = s.state?.sftp?.last_processing;
  const moved = progress();
  const steps = s.state?.sftp?.last_processing?.processing ?? [];
  return (
    <>
      {s.stateError && <Notice tone="warn">Only the chain status can be read for now: {s.stateError}. The rest of this page fills in once it is.</Notice>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SyncAltOutlinedIcon />} tint={TONE[v.tone]} label="Compass chain" value={v.label}
            note={v.at ? `last activity ${when(v.at)} · ${ago(v.at)}` : "the connector has reported no run"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CloudDownloadOutlinedIcon />} tint="blue" label="Files from the ERP" value={lastWithFiles?.pulled?.length ? `${lastWithFiles.pulled.length} files` : "—"}
            note={lastWithFiles?.ts ? `last delivery ${when(lastWithFiles.ts)} · checked ${ago(last?.ts ?? s.chain?.sftp_last_ts ?? null)}` : `checked ${ago(s.chain?.sftp_last_ts ?? null)}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<MoveUpOutlinedIcon />} tint="green" label="Moved to the hub" value={`${moved.hub} of ${moved.total}`}
            note="steps of the connector that now run in the hub" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FactCheckOutlinedIcon />} tint={s.review?.pending ? "amber" : "green"} label="Review queue" value={s.review ? full(s.review.pending) : "—"}
            note={s.review ? "ERP customers whose revenue has no HubSpot company yet" : "not readable yet"} />
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<CableOutlinedIcon />} tint="green" title="Connections" note="Where the hub's data comes from" />
        <Connection name="Compass (ERP)" flow="ERP files → SFTP b2b.angst-pfister.com → the Compass connector (Railway) → HubSpot"
          status={<Chip tint={TONE[v.tone]}>{v.label}</Chip>} href="/connectors/compass" linkLabel="The chain" />
        <Connection name="SFTP from the hub" flow={s.sftpFromHub?.ok
            ? `The hub reaches b2b.angst-pfister.com:22 itself (${s.sftpFromHub.banner ?? "SSH"}, ${s.sftpFromHub.ms} ms) - the file steps can move here`
            : `The hub cannot reach b2b.angst-pfister.com:22 from AWS (${s.sftpFromHub?.error ?? "not checked"}) - IT has to allow 35.156.30.228 before the file steps move`}
          status={<Chip tint={s.sftpFromHub?.ok ? "green" : "amber"}>{s.sftpFromHub?.ok ? "Reachable" : "Not reachable"}</Chip>} href="/connectors/compass#files" linkLabel="Files" />
        <Connection name="Shop orders (Magento)" flow="apsoparts.com → the Magento connector → HubSpot orders"
          status={<Chip tint="slate">Own page</Chip>} href="/analytics/web-orders" linkLabel="Web order sync" />
        <Connection name="HubSpot, GA4, Search Console" flow="The hub's own reads - tokens and properties"
          status={<Chip tint="slate">Settings</Chip>} href="/settings/integrations" linkLabel="Integrations" />
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<MoveUpOutlinedIcon />} tint="purple" title="The move into the hub"
          note="One group at a time: ported, previewed against the connector row for row, then switched - never both writing, never neither" />
        <Box sx={{ display: "grid", gap: 1.75 }}>
          {GROUPS.filter((g) => g.key !== "engines").sort((a, b) => a.order - b.order).map((g) => {
            const mine = STEPS.filter((x) => x.group === g.key);
            const done = mine.filter((x) => x.phase === "hub").length;
            return (
              <Box key={g.key}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{g.order} · {g.name}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, flex: 1, minWidth: 0 }}>{g.note}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{done} of {mine.length}</Typography>
                </Box>
                <Box sx={{ height: 6, borderRadius: 99, bgcolor: TRACK, overflow: "hidden", mb: 0.75 }}>
                  <Box sx={{ width: `${(100 * done) / Math.max(1, mine.length)}%`, minWidth: done ? 4 : 0, height: "100%", bgcolor: "#1b7a55", borderRadius: 99 }} />
                </Box>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  {mine.map((x) => <Chip key={x.key} tint={PHASE[x.phase].tint}>{x.name}</Chip>)}
                </Box>
              </Box>
            );
          })}
          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.5 }}>Already in the hub</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {IN_HUB.map((x) => (
                <Box key={x.name} component={Link} href={x.href} sx={{ textDecoration: "none" }}>
                  <Chip tint="green">{x.name} · {x.note}</Chip>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<SyncAltOutlinedIcon />} title="The last run with new files" note={lastWithFiles?.ts ? `${when(lastWithFiles.ts)} - each step and how it went` : "No run with new files recorded yet"} />
        {steps.length ? (
          <Box sx={{ display: "grid", gap: 0.6 }}>
            {steps.map((x, i) => {
              const def = STEPS.find((d) => d.key === x.step);
              const nums = x.result ? Object.entries(x.result).filter(([, v]) => typeof v === "number").slice(0, 4) : [];
              return (
                <Box key={`${x.step}-${i}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 90px minmax(0,1fr)" }, gap: 1.25, alignItems: "center", py: 0.6, borderTop: i ? `1px solid ${HAIRLINE}` : "none" }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{def?.name ?? x.step}</Typography>
                  <Box>{x.error ? <Chip tint="pink">Failed</Chip> : <Chip tint="green">Done</Chip>}</Box>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {x.error ? x.error : nums.map(([k, n]) => `${k.replace(/_/g, " ")} ${full(n as number)}`).join(" · ") || "—"}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        ) : <Muted>{s.stateError ? "Readable once the connector's update is deployed." : "Nothing recorded."}</Muted>}
      </GlassCard>
    </>
  );
}

export default function ConnectorsOverview() {
  return (
    <ConnectorsPage title="Connectors & Integration" subtitle="Where the hub's data comes from - and how far the Compass connector has moved into the hub">
      {(s) => <Overview s={s} />}
    </ConnectorsPage>
  );
}
