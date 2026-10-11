"use client";

// CONNECTORS & INTEGRATION - the overview of the Compass sync, and only of it (SARCLA,
// 10.10.2026: other connectors are not considered here). Four answers at a glance: did
// the last ERP delivery run through, what came in, did any step fail, and is anybody
// waiting in the review queue. Then four pictures: the new ERP orders reaching HubSpot
// each day (is it flowing?), the ERP customers waiting for a company and what holds each
// back, what the sync wrote per run since the hub took over, and what the last run
// wrote, step by step. Detail lives on the Compass pages.

import { useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { full } from "@/app/charts/format";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { GlassCard, KpiTile, Notice } from "@/app/uc/report/ui";
import { GROUPS, STEPS, stepName, type Group } from "@/lib/connectors/compass";
import { chainVerdict, lastDelivery } from "@/lib/connectors/snapshot";
import type { HubChain } from "@/lib/connectors/chainStatus";
import { useHeld } from "@/app/analytics/AnalyticsData";
import type { CheckRow, CheckVerdict } from "@/lib/connectors/reviewRule";
import { ConnectorsPage, TONE, ago, useHubSteps, when, type Snapshot } from "./parts";

/** The hub's own chain, in the connector verdict's shape. */
function hubVerdict(c: HubChain): ReturnType<typeof chainVerdict> {
  const at = c.ts || null;
  if (c.status === "running") return { tone: "warn", label: "Running", at, failed: [] };
  if (c.status === "failed") return { tone: "bad", label: "Failed", at, failed: c.step ? [c.step] : [] };
  const failed = c.steps.filter((x) => !x.ok).map((x) => x.step);
  return { tone: failed.length ? "warn" : "good", label: failed.length ? "Done, with failures" : "Done", at, failed };
}

/** "2026-10-10" -> "10.10" */
const dd = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

/** What holds a waiting customer back, in a word or two. */
function blocker(v: CheckVerdict | undefined): string {
  if (!v) return "not checked yet";
  switch (v.kind) {
    case "linked": return "linked - matches next run";
    case "can_link": return "found - link it";
    case "conflict": return "company has another key";
    case "several": return `${v.ids.length} companies`;
    case "missing": return "not in HubSpot";
    default: return "not a customer key";
  }
}

/** The ERP customers with revenue but no HubSpot company, the biggest first, and what holds each back. */
function Waiting({ s }: { s: Snapshot }) {
  const check = useHeld<{ rows: CheckRow[]; checking: boolean; at: string | null }>("/api/connectors/review", ["overview"]);
  const verdicts = useMemo(() => {
    const m = new Map<string, CheckVerdict>();
    if (check.result?.state === "ok") for (const r of check.result.data.rows) m.set(r.un, r.verdict);
    return m;
  }, [check.result]);
  const waiting = (s.review?.items ?? []).filter((i) => i.status !== "resolved" && i.un)
    .sort((a, b) => (b.revenue_eur ?? 0) - (a.revenue_eur ?? 0));
  const found = waiting.filter((i) => verdicts.get(i.un as string)?.kind === "can_link").length;
  const missing = waiting.filter((i) => verdicts.get(i.un as string)?.kind === "missing").length;
  const total = waiting.reduce((a, i) => a + (i.revenue_eur ?? 0), 0);
  const rows = waiting.slice(0, 10).map((i) => ({
    label: i.un as string, value: Math.round(i.revenue_eur ?? 0), secondary: blocker(verdicts.get(i.un as string)), href: "/connectors/review",
  }));
  return (
    <ChartFrame
      title="Companies waiting"
      caption={waiting.length
        ? `${waiting.length} ERP customers with € ${full(total)} revenue have no HubSpot company yet${found ? ` - ${found} can be linked in one click` : ""}${missing ? `, ${missing} are not in HubSpot` : ""}. The ten biggest, in euros; click one for the review queue.`
        : undefined}
      empty={!waiting.length ? "Nobody is waiting." : null}
      table={{ columns: ["Customer", "Revenue €", "What holds it back"], rows: waiting.map((i) => [i.un as string, Math.round(i.revenue_eur ?? 0), blocker(verdicts.get(i.un as string))]), numeric: [1] }}
    >
      <BarList rows={rows} format={(n) => full(n)} labelWidth={110} />
    </ChartFrame>
  );
}

/** The Compass groups, in the chain page's order - one colour each, never cycled. */
const AREAS = [...GROUPS].sort((a, b) => a.order - b.order).filter((g) => STEPS.some((x) => x.group === g.key));
const GROUP_OF = new Map(STEPS.map((x) => [x.key, x.group as Group]));

function Overview({ s }: { s: Snapshot }) {
  const [tick, setTick] = useState(0);
  const hub = useHubSteps(tick);
  // the daily order count is made in the background: read again until it is there
  const counting = !!hub?.flow?.counting;
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [counting, tick]);

  const hubPulls = hub?.connectorPulls === false;
  const c = hubPulls ? hub?.chain ?? null : null;
  const v = c ? hubVerdict(c) : chainVerdict(s);
  const connectorDelivery = lastDelivery(s);
  // a run recorded before the hub noted file sizes has no list: no "0 MB", just nothing
  const mb = c?.files?.length ? c.files.reduce((t, f) => t + f.mb, 0) : null;
  const files = c
    ? { n: c.pulled, at: c.ts || null, note: [mb !== null ? `${Math.round(mb).toLocaleString("en-US")} MB` : "", c.pullSeconds !== undefined ? `in ${c.pullSeconds} s` : ""].filter(Boolean).join(" ") }
    : { n: connectorDelivery.files, at: connectorDelivery.at, note: "" };
  const failed = c ? c.steps.filter((x) => !x.ok).map((x) => x.step) : v.failed;

  const flow = hub?.flow?.days ?? [];
  const history = hub?.history ?? [];
  const last = history[history.length - 1];
  const perRun = history.map((h) => {
    const row: { x: string } & Record<string, number | string> = { x: h.day };
    for (const g of AREAS) row[g.key] = 0;
    for (const [k, n] of Object.entries(h.written)) {
      const g = GROUP_OF.get(k);
      if (g) row[g] = (row[g] as number) + n;
    }
    return row;
  });
  const lastRows = last
    ? Object.entries(last.written).map(([k, n]) => ({ label: stepName(k), value: n })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    : [];

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

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="New ERP orders reaching HubSpot, per day"
              caption={`The last 30 days, counted in HubSpot: orders created that day that did not come from the shop. A day at zero is a day without an ERP delivery - weekends usually are.${hub?.flow?.at ? ` Counted ${when(hub.flow.at)}.` : ""}`}
              stale={counting && flow.length > 0}
              empty={!flow.length ? (hub?.flow?.error ? `Could not count: ${hub.flow.error}` : "Counting in HubSpot…") : null}
              table={{ columns: ["Day", "New ERP orders"], rows: flow.map((d) => [dd(d.day), d.orders]), numeric: [1] }}
            >
              <StackedColumns data={flow.map((d) => ({ x: d.day, orders: d.orders }))} parts={[{ key: "orders", label: "New ERP orders" }]}
                height={220} format={(n) => full(n)} xFormat={dd} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <Waiting s={s} />
          </GlassCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="Records written per ERP run"
              caption="Each column is one ERP delivery the hub ran, split by area, since the hub took over on 10.10. The first run rewrote every company's revenue once; later runs write only what changed."
              empty={!perRun.length ? "No run recorded yet." : null}
              table={{
                columns: ["Run", ...AREAS.map((g) => g.name)],
                rows: perRun.map((r) => [dd(String(r.x)), ...AREAS.map((g) => r[g.key] as number)]),
                numeric: AREAS.map((_, i) => i + 1),
              }}
            >
              <StackedColumns data={perRun} parts={AREAS.map((g) => ({ key: g.key, label: g.name }))} height={240} format={(n) => full(n)} xFormat={dd} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="What the last run wrote"
              caption={last ? `Records written by each step on ${dd(last.day)}. A step at zero found nothing to change.` : undefined}
              empty={!lastRows.length ? "No run recorded yet." : null}
              table={{ columns: ["Step", "Records written"], rows: lastRows.map((r) => [r.label, r.value ?? 0]), numeric: [1] }}
            >
              <BarList rows={lastRows} format={(n) => full(n)} labelWidth={190} />
            </ChartFrame>
          </GlassCard>
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
