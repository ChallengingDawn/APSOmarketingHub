"use client";

// CONNECTORS & INTEGRATION - the overview. Four answers at a glance: did the last
// ERP delivery run through, what came in, did any step fail, and is anybody waiting
// in the review queue. The Compass sync runs in the hub since 10.10.2026; the old
// connector on Railway is a backup that writes nothing. Detail lives on the Compass pages.

import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CableOutlinedIcon from "@mui/icons-material/CableOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice } from "@/app/uc/report/ui";
import { stepName } from "@/lib/connectors/compass";
import { chainVerdict, lastDelivery } from "@/lib/connectors/snapshot";
import type { HubChain } from "@/lib/connectors/chainStatus";
import { Chip, ConnectorsPage, TONE, ago, useHubSteps, when, type Snapshot } from "./parts";

/** The hub's own chain, in the connector verdict's shape. */
function hubVerdict(c: HubChain): ReturnType<typeof chainVerdict> {
  const at = c.ts || null;
  if (c.status === "running") return { tone: "warn", label: "Running", at, failed: [] };
  if (c.status === "failed") return { tone: "bad", label: "Failed", at, failed: c.step ? [c.step] : [] };
  const failed = c.steps.filter((x) => !x.ok).map((x) => x.step);
  return { tone: failed.length ? "warn" : "good", label: failed.length ? "Done, with failures" : "Done", at, failed };
}

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
  const hub = useHubSteps();
  const hubPulls = hub?.connectorPulls === false;
  const c = hubPulls ? hub?.chain ?? null : null;
  const v = c ? hubVerdict(c) : chainVerdict(s);
  const connectorDelivery = lastDelivery(s);
  const mb = (c?.files ?? []).reduce((t, f) => t + f.mb, 0);
  const files = c ? { n: c.pulled, at: c.ts || null, note: `${Math.round(mb).toLocaleString("en-US")} MB${c.pullSeconds !== undefined ? ` in ${c.pullSeconds} s` : ""}` }
    : { n: connectorDelivery.files, at: connectorDelivery.at, note: "" };
  const failed = c ? c.steps.filter((x) => !x.ok).map((x) => x.step) : v.failed;
  return (
    <>
      {s.stateError && !hubPulls && <Notice tone="warn">Only the chain status can be read for now: {s.stateError}.</Notice>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SyncAltOutlinedIcon />} tint={TONE[v.tone]} label="Compass sync" value={v.label}
            note={v.at ? `${when(v.at)} · ${ago(v.at)}` : "no run reported"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CloudDownloadOutlinedIcon />} tint="blue" label="Last ERP delivery" value={files.at ? `${files.n} files` : "—"}
            note={files.at ? [files.note, ago(files.at)].filter(Boolean).join(" · ") : "none received yet"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ErrorOutlineIcon />} tint={failed.length ? "pink" : "green"} label="Steps failed" value={String(failed.length)}
            note={failed.length ? failed.map(stepName).join(", ") : c ? `of ${c.steps.length} in the last run` : "in the last run"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FactCheckOutlinedIcon />} tint={s.review?.pending ? "amber" : "green"} label="Review queue" value={s.review ? full(s.review.pending) : "—"}
            note="ERP customers without a company" />
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<CableOutlinedIcon />} tint="green" title="Connections" />
        <Row name="Compass (ERP)" status={<Chip tint={TONE[v.tone]}>{v.label}</Chip>}
          note={failed.length ? `Failed: ${failed.map(stepName).join(", ")}` : `ERP files → SFTP → ${hubPulls ? "the hub" : "the old connector"} → HubSpot`}
          href="/connectors/compass" link="The chain" />
        <Row name="Old connector (Railway)" status={<Chip tint={hubPulls ? "slate" : "amber"}>{hubPulls ? "Backup" : "Running"}</Chip>}
          note={hubPulls ? "Writes nothing since 10.10 - kept as a backup until it is switched off" : "Reads the ERP's files at the moment - the hub's ERP steps wait"}
          href="/connectors/files" link="Files & runs" />
        <Row name="Shop orders" status={<Chip tint="slate">Magento</Chip>} note="apsoparts.com → the Magento connector → HubSpot orders" href="/analytics/web-orders" link="Web order sync" />
        <Row name="HubSpot, GA4, GSC" status={<Chip tint="slate">Tokens</Chip>} note="The hub's own reads" href="/settings/integrations" link="Integrations" />
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
