"use client";
// THE GQS TAB OF THE INCOMING TICKETS PAGE - its read and its drawings (SARCLA 05.11.2026: "another tab on ESO and Sales
// leader on customer tickets - a new, really developed tab to show the results of GQS to the sales leader, and to be able
// to report it also on my reports"; "GQS to line manager on GQS win rate and so forth"). The rules are esoGqs.ts; the
// tab, its boards and its place in My Sales and Sales Leader Reports are ./Tickets.tsx's, as its other tabs.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { Sankey } from "@/app/charts/Sankey";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { MUTED } from "@/app/uc/report/ui";
import { FLOW_COLUMNS, STAGE_LABEL, WORK, flowOf, type FlowNode, type GqsTask } from "@/lib/reporting/boGqs";
import { type EsoGqs, type GMonths, type GOpen, openBy } from "@/lib/reporting/esoGqs";

export type GqsState = { v: EsoGqs | null; counting: boolean; error?: string };

/** The GQS tasks - read only where the page needs them (the Incoming tickets page, a BUC View holding one of its graphs). */
export function useEsoGqs(on: boolean): GqsState | null {
  const [st, setSt] = useState<GqsState | null>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-gqs").then((r) => r.json())
      .then((j: { value?: EsoGqs | null; counting?: boolean; error?: string }) => {
        if (!alive) return;
        // the same read again is kept as it is: nothing drawn again
        setSt((was) => (was?.v && j.value && was.v.at === j.value.at && was.counting === !!j.counting ? was : { v: j.value ?? null, counting: !!j.counting, error: j.error }));
        timer = !j.value && j.counting ? setTimeout(() => { timer = undefined; load(); }, 5000) : undefined;
      })
      .catch((e) => { if (alive) setSt((s) => ({ v: s?.v ?? null, counting: false, error: String((e as Error)?.message ?? e) })); });
    load();
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, [on]);
  return st;
}

const int = (n: number) => Math.round(n).toLocaleString("en");
const days = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} days`);

/** Where the read stands while there is nothing to draw. */
export function GqsWaiting({ st }: { st: GqsState | null | undefined }) {
  const text = st?.error ? `The GQS tasks could not be read: ${st.error}` : "The GQS tasks are being read from HubSpot - these graphs show in a minute.";
  return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{text}</Typography>;
}

const TONE: Record<FlowNode["tone"], string> = { source: SERIES[0], good: SERIES[2], bad: SERIES[1], wait: SERIES[3], none: DEEMPHASIS };
/** The period's requests from the request to the result: how each was approved, where it stands, what came of the offer. */
export function GqsFlow({ req, height = 420 }: { req: GqsTask[]; height?: number }) {
  const fl = flowOf(req);
  const label = new Map(fl.nodes.map((n) => [n.id, n.label]));
  return (
    <ChartFrame table={{ columns: ["From", "To", "Requests"], rows: fl.links.map((l) => [label.get(l.from) ?? l.from, label.get(l.to) ?? l.to, l.value]), numeric: [2] }} empty={req.length ? null : "No GQS request for this choice."}>
      <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
        <Box sx={{ minWidth: 820 }}>
          <Sankey height={height} columns={FLOW_COLUMNS} label="GQS, from the request to the result" links={fl.links} format={(v) => int(v)}
            nodes={fl.nodes.map((n) => ({ id: n.id, column: n.column, label: n.label, color: TONE[n.tone] }))} />
        </Box>
      </Box>
    </ChartFrame>
  );
}

/** The offers sent each month by what came of them - and the requests that came in, in the table under the chart. */
export function GqsMonths({ m, labels }: { m: GMonths; labels: string[] }) {
  const data = labels.map((x, i) => ({ x, won: m.won[i], lost: m.lost[i], wait: m.wait[i] }));
  return (
    <ChartFrame table={{ columns: ["Month", "Requests", "Offers sent", "Won", "Lost", "No result yet"], rows: labels.map((x, i) => [x, m.req[i], m.offers[i], m.won[i], m.lost[i], m.wait[i]]), numeric: [1, 2, 3, 4, 5] }}
      empty={m.offers.some((x) => x) || m.req.some((x) => x) ? null : "No GQS request for this choice."}>
      <StackedColumns height={280} format={(v) => (v == null ? "—" : int(v))} data={data}
        parts={[{ key: "won", label: "Won", color: SERIES[2] }, { key: "lost", label: "Lost", color: SERIES[1] }, { key: "wait", label: "No result yet", color: DEEMPHASIS }]} />
    </ChartFrame>
  );
}

/** Every open task by a breakdown - how many, how long in their stage (the median), how many there over four weeks. */
export function GqsOpenBars({ open, by, labelWidth = 200 }: { open: GOpen[]; by: (o: GOpen) => string; labelWidth?: number }) {
  const rows = openBy(open, by).map((r) => ({
    label: r.label, value: r.n,
    secondary: `${r.days == null ? "—" : r.days.toFixed(1)} d in stage${r.old ? ` · ${int(r.old)} over 4 wks` : ""}`,
  }));
  return <BarList rows={rows} format={(v) => int(v ?? 0)} labelWidth={labelWidth} emptyMessage="No GQS task open for this choice." />;
}
/** Every open task by the stage it waits in, in the pipeline's order. */
export function GqsOpenStages({ open }: { open: GOpen[] }) {
  const rows = openBy(open, (o) => STAGE_LABEL[o.t.s]);
  const order = WORK.map((s) => STAGE_LABEL[s]);
  rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return <BarList rows={rows.map((r) => ({ label: r.label, value: r.n, secondary: `${r.old ? `${int(r.old)} there over 4 weeks · ` : ""}${days(r.days)} there, the median` }))}
    format={(v) => int(v ?? 0)} labelWidth={200} emptyMessage="No GQS task open for this choice." />;
}
