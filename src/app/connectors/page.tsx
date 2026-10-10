"use client";

// CONNECTORS & INTEGRATION - the overview of the Compass sync, and only of it (SARCLA,
// 10.10.2026: other connectors are not considered here). Four answers at a glance: did
// the last ERP delivery run through, what came in, did any step fail, and is anybody
// waiting in the review queue. Detail lives on the Compass pages.

import Grid from "@mui/material/Grid";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { full } from "@/app/charts/format";
import { KpiTile, Notice } from "@/app/uc/report/ui";
import { stepName } from "@/lib/connectors/compass";
import { chainVerdict, lastDelivery } from "@/lib/connectors/snapshot";
import type { HubChain } from "@/lib/connectors/chainStatus";
import { ConnectorsPage, TONE, ago, useHubSteps, when, type Snapshot } from "./parts";

/** The hub's own chain, in the connector verdict's shape. */
function hubVerdict(c: HubChain): ReturnType<typeof chainVerdict> {
  const at = c.ts || null;
  if (c.status === "running") return { tone: "warn", label: "Running", at, failed: [] };
  if (c.status === "failed") return { tone: "bad", label: "Failed", at, failed: c.step ? [c.step] : [] };
  const failed = c.steps.filter((x) => !x.ok).map((x) => x.step);
  return { tone: failed.length ? "warn" : "good", label: failed.length ? "Done, with failures" : "Done", at, failed };
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

    </>
  );
}

export default function ConnectorsOverview() {
  return (
    <ConnectorsPage title="Compass sync" subtitle="Whether the ERP's data is flowing into HubSpot">
      {(s) => <Overview s={s} />}
    </ConnectorsPage>
  );
}
