"use client";

// TSA DISTRIBUTION (SARCLA 13-14.11.2026: "TSA, we need to create a sub app TSA Distribution - and an ESO distribution
// for later. The back office should run as today to classify the ticket and point it again to the correct team, but
// today we have a lot of TSA non qualified - this should be really split; and see it as a funnel"). Two tabs:
// - Funnel: every TSA ticket of the last 90 days by how it came in and what became of it, week by week, and the old
//   one label "TSA NON QUALIFIED" split into what it was ("Outbound - TSA call", "Finance reminder");
// - Routing: for the last 7 days, what the hub would do with each ticket next to what the workflow did.
// Reads only, from /api/uc/tsa-distribution (src/lib/tsaDistribution); the hub's routing goes Live in a second round.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { State } from "@/lib/tsaDistribution/engine";
import { OUTCOMES, type Outcome, type Path } from "@/lib/tsaDistribution/rules";

type Data = { state: State | null; admin: boolean };
type Tab = "funnel" | "routing";
const TAB_HASH: Record<Tab, string> = { funnel: "#funnel", routing: "#routing" };
const SUB: Record<Tab, string> = {
  funnel: "Every TSA ticket of the last 90 days: how it came in, and what became of it",
  routing: "What the hub would do with each new TSA ticket, next to what the workflow did - the last 7 days",
};
const PATH: Record<Path, string> = {
  helpline: "Helpline e-mail → Back Office", lead: "AP lead form → Back Office", finance: "Finance reminder",
  outbound: "Outbound - TSA call, closed", none: "Not routed",
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

function FunnelTab({ s }: { s: State }) {
  const f = s.funnel;
  const sum = (o: Outcome) => f.ways.reduce((n, w) => n + w.outcomes[o], 0);
  const toBo = sum("Sent to the Back Office"), notReq = sum("Not a request"), ordered = sum("Ordered");
  const data = f.weeks.map((w) => ({ x: w.week, bo: w["Sent to the Back Office"], closed: w["Closed by TSA"] + w.Ordered, not: w["Not a request"], open: w.Open }));
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<InboxOutlinedIcon />} tint="slate" label="TSA tickets" value={full(f.total)} note={`created in the last ${s.days} days`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ForwardToInboxOutlinedIcon />} tint="blue" label="Sent to the Back Office" value={full(toBo)} note={`${pct(toBo, f.total)} - classified there and sent to the right team`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Ordered" value={full(ordered)} note={`${pct(ordered, f.total)} of the tickets`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DoNotDisturbOnOutlinedIcon />} tint="amber" label="Not a request" value={full(notReq)} note={`${full(f.nonQualified.outbound)} outbound · ${full(f.nonQualified.finance)} finance${f.nonQualified.other ? ` · ${full(f.nonQualified.other)} other` : ""}`} /></Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="Week by week" note="The TSA tickets created each week, by what became of them. Closed by TSA counts the ordered ones too." />
        <StackedColumns data={data} parts={[{ key: "bo", label: "Sent to the Back Office" }, { key: "closed", label: "Closed by TSA" }, { key: "not", label: "Not a request" }, { key: "open", label: "Still open" }]}
          format={(v) => full(v ?? 0)} xFormat={(x) => `wk ${dm(x)}`} />
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="How they came in, and what became of them"
          note="Each way in, and where its tickets went. A helpline e-mail goes to the Back Office, which classifies it and sends it to the right team; an AP lead form goes there as a lead; an outbound ticket (an agent wrote to the customer first) and a finance reminder are not requests." />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow>{["Came in as", "Tickets", ...OUTCOMES].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {f.ways.map((w) => (
                <TableRow key={w.way}>
                  <TableCell sx={{ ...bodyCell, fontWeight: 700, color: INK }}>{w.way}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontWeight: 700 }}>{full(w.n)}</TableCell>
                  {OUTCOMES.map((o) => (
                    <TableCell key={o} sx={{ ...bodyCell, textAlign: "right", color: w.outcomes[o] ? INK : FAINT }}>
                      {w.outcomes[o] ? <>{full(w.outcomes[o])} <span style={{ color: MUTED, fontSize: "0.74rem" }}>{pct(w.outcomes[o], w.n)}</span></> : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CallSplitOutlinedIcon />} tint="amber" title="TSA NON QUALIFIED, split into what it was"
          note="The workflow gave both the same label. Once the hub routes, each gets its own, and neither counts as a customer request or against the resolution rate. An outbound ticket stays closed as today - it opens again by itself when the customer answers." />
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {[{ k: "Outbound - TSA call", n: f.nonQualified.outbound, t: "an agent wrote to the customer first - HubSpot opened a ticket for the e-mail" },
            { k: "Finance reminder", n: f.nonQualified.finance, t: "a payment reminder (Mahnung) that came to the helpline" }].map((x) => (
            <Box key={x.k} sx={{ minWidth: 240 }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: INK, lineHeight: 1.1 }}>{full(x.n)}</Typography>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{x.k}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, maxWidth: 320 }}>{x.t}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
    </>
  );
}

function RoutingTab({ s }: { s: State }) {
  const [only, setOnly] = useState<"all" | "differ">("all");
  const rows = useMemo(() => s.side.rows.filter((r) => only === "all" || !r.same), [s, only]);
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Info>Reads only: the HubSpot workflow “SARCLA | TSA/HELPLINE MAIL TICKET CREATION” still routes. The hub takes over once the AP lead form&apos;s code is in the hub too - then each label below is written as the hub would.</Info>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><KpiTile icon={<AltRouteOutlinedIcon />} tint="slate" label="New TSA tickets" value={full(s.side.rows.length)} note={`the last ${s.side.days} days`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><KpiTile icon={<ForwardToInboxOutlinedIcon />} tint="green" label="The hub does the same" value={full(s.side.same)} note={pct(s.side.same, s.side.rows.length)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><KpiTile icon={<CallSplitOutlinedIcon />} tint="amber" label="Different" value={full(s.side.differ)} note="look at each below" /></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Ticket by ticket" note="The way each came in, what the workflow did (read from its subject) and what the hub would do. The hub writes the two new labels where the workflow wrote TSA NON QUALIFIED." />
        <Box sx={{ mb: 1.5 }}>
          <Choice<"all" | "differ"> value={only} onChange={setOnly} options={[{ key: "all", label: "All", count: s.side.rows.length }, { key: "differ", label: "Different", count: s.side.differ }]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "32%" }} /><col style={{ width: "16%" }} /><col style={{ width: "22%" }} /><col style={{ width: "22%" }} /><col style={{ width: "8%" }} /></colgroup>
            <TableHead><TableRow>{["Ticket", "Came in as", "The workflow did", "The hub would", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(360) }}>{r.subject || r.id}</Box>
                    <Box sx={{ fontSize: "0.72rem", color: FAINT }}>{when(r.created)}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.way}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PATH[r.workflow]}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PATH[r.hub]}{r.hubDid.resolution ? <Box sx={{ fontSize: "0.72rem", color: MUTED }}>label: {r.hubDid.resolution}</Box> : null}</TableCell>
                  <TableCell sx={bodyCell}>{r.same ? <Chip tint="green">same</Chip> : <Chip tint="amber">differs</Chip>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{only === "differ" ? "The hub does the same with every one." : "No new TSA ticket in the last days."}</Typography>}
      </GlassCard>
    </>
  );
}

export default function TsaDistribution() {
  const [tab, setTab] = useHashTab<Tab>(TAB_HASH, "funnel");
  const [n, setN] = useState(0);
  const url = `/api/uc/tsa-distribution${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const s = r?.state === "ok" ? r.data.state : null;
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the TSA tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="TSA Distribution" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (!s) body = <Info>The TSA tickets are read within minutes of the deploy, then every 15 minutes.</Info>;
  else body = tab === "funnel" ? <FunnelTab s={s} /> : <RoutingTab s={s} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="TSA Distribution" subtitle={`${SUB[tab]}${s ? ` · read ${when(s.at)}` : ""}`} />
      <Box>
        <ReportTabs name="tsadist" tab={tab} onSelect={setTab} tabs={[
          { id: "funnel", label: "Funnel", count: null },
          { id: "routing", label: "Routing", count: s?.side.differ ? `${full(s.side.differ)} differ` : null },
        ]} />
      </Box>
      <Box id={`tsadist-panel-${tab}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
