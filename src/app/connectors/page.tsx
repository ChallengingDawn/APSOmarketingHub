"use client";

// CONNECTORS & INTEGRATION - the overview. Four answers at a glance: did the
// Compass chain run, did the ERP's files arrive, how far has the move into the
// hub come, and is anybody waiting in the review queue. Detail lives on the
// Compass connector pages; this one stays short.

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
import { chainVerdict, lastDelivery } from "@/lib/connectors/snapshot";
import { Chip, ConnectorsPage, TONE, ago, when, type Snapshot } from "./parts";

function Go({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Box component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.82rem", fontWeight: 600, color: "#2459d1", textDecoration: "none", whiteSpace: "nowrap" }}>
      {children} <ArrowForwardIcon sx={{ fontSize: 15 }} />
    </Box>
  );
}

function Row({ name, status, note, href, link }: { name: string; status: React.ReactNode; note: string; href: string; link: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", md: "200px 130px minmax(0,1fr) auto" }, gap: { xs: 0.75, md: 2 }, alignItems: "center", py: 1.25, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
      <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{name}</Typography>
      <Box sx={{ justifySelf: { xs: "end", md: "start" } }}>{status}</Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, gridColumn: { xs: "1 / -1", md: "auto" } }}>{note}</Typography>
      <Box sx={{ display: { xs: "none", md: "block" } }}><Go href={href}>{link}</Go></Box>
    </Box>
  );
}

function Overview({ s }: { s: Snapshot }) {
  const v = chainVerdict(s);
  const delivery = lastDelivery(s);
  const moved = progress();
  return (
    <>
      {s.stateError && <Notice tone="warn">Only the chain status can be read for now: {s.stateError}.</Notice>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SyncAltOutlinedIcon />} tint={TONE[v.tone]} label="Compass chain" value={v.label}
            note={v.at ? `${when(v.at)} · ${ago(v.at)}` : "no run reported"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CloudDownloadOutlinedIcon />} tint="blue" label="ERP files" value={delivery.at ? `${delivery.files} files` : "—"}
            note={delivery.at ? `last delivery ${when(delivery.at)} · ${ago(delivery.at)}` : "none received yet"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<MoveUpOutlinedIcon />} tint="green" label="Moved to the hub" value={`${moved.hub} of ${moved.total}`} note="connector steps" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FactCheckOutlinedIcon />} tint={s.review?.pending ? "amber" : "green"} label="Review queue" value={s.review ? full(s.review.pending) : "—"}
            note="ERP customers without a company" />
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<CableOutlinedIcon />} tint="green" title="Connections" />
        <Row name="Compass (ERP)" status={<Chip tint={TONE[v.tone]}>{v.label}</Chip>}
          note={v.failed.length ? `Failed: ${v.failed.map((k) => STEPS.find((d) => d.key === k)?.name ?? k).join(", ")}` : "ERP files → SFTP → the Compass connector → HubSpot"}
          href="/connectors/compass" link="The chain" />
        <Row name="SFTP from the hub" status={<Chip tint={s.sftpFromHub?.ok ? "green" : "amber"}>{s.sftpFromHub?.ok ? "Reachable" : "Not reachable"}</Chip>}
          note={s.sftpFromHub?.ok ? "The hub reaches the ERP's file server itself - the file steps can move here" : `Blocked from AWS (${s.sftpFromHub?.error ?? "not checked"}) - IT has to allow 35.156.30.228`}
          href="/connectors/files" link="Files & runs" />
        <Row name="Shop orders" status={<Chip tint="slate">Magento</Chip>} note="apsoparts.com → the Magento connector → HubSpot orders" href="/analytics/web-orders" link="Web order sync" />
        <Row name="HubSpot, GA4, GSC" status={<Chip tint="slate">Tokens</Chip>} note="The hub's own reads" href="/settings/integrations" link="Integrations" />
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<MoveUpOutlinedIcon />} tint="purple" title="The move into the hub" note="One group at a time - previewed against the connector before it switches"
          right={<Go href="/connectors/compass">Every step</Go>} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {GROUPS.filter((g) => g.key !== "engines").sort((a, b) => a.order - b.order).map((g) => {
            const mine = STEPS.filter((x) => x.group === g.key);
            const done = mine.filter((x) => x.phase === "hub").length;
            return (
              <Box key={g.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", md: "220px minmax(0,1fr) 60px" }, gap: 1.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{g.order} · {g.name}</Typography>
                <Box sx={{ height: 8, borderRadius: 99, bgcolor: TRACK, overflow: "hidden", gridRow: { xs: 2, md: "auto" }, gridColumn: { xs: "1 / -1", md: "auto" } }}>
                  <Box sx={{ width: `${(100 * done) / Math.max(1, mine.length)}%`, minWidth: done ? 4 : 0, height: "100%", bgcolor: "#1b7a55", borderRadius: 99 }} />
                </Box>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, textAlign: "right" }}>{done} / {mine.length}</Typography>
              </Box>
            );
          })}
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Already in the hub: {IN_HUB.map((x, i) => (
              <span key={x.name}>{i ? " · " : ""}<Link href={x.href} style={{ color: "#2459d1", textDecoration: "none" }}>{x.name}</Link></span>
            ))}
          </Typography>
        </Box>
      </GlassCard>
    </>
  );
}

export default function ConnectorsOverview() {
  return (
    <ConnectorsPage title="Connectors & Integration" subtitle="Where the hub's data comes from, and whether it is flowing">
      {(s) => <Overview s={s} />}
    </ConnectorsPage>
  );
}
