"use client";

// ASSOCIATIONS > GQS follow-ups (SARCLA 04.11.2026: "migrate this to association tickets as another simple table").
// An ESO / TSA ticket linked to a GQS request carries "Type of sales ticket" = GQS - set by the hub every 3 minutes
// (src/lib/ticketAssoc/gqsType.ts). One table: the links the hub found since it started looking. Off / Preview / Live
// is with the app's other modes, in Settings.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Grid from "@mui/material/Grid";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { BarList } from "@/app/charts/BarList";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import type { GqsMode, GqsRow, GqsRun } from "@/lib/ticketAssoc/gqsType";

type Data = { mode: GqsMode; last: GqsRun | null; rows: GqsRow[]; admin: boolean; workflowOn: boolean | null };

const WHAT: Record<GqsRow["what"], { tint: Tint; label: string }> = {
  already: { tint: "slate", label: "already GQS" },
  set: { tint: "green", label: "set to GQS" },
  would: { tint: "blue", label: "would set GQS" },
  left: { tint: "amber", label: "changed by a person - left as it is" },
  failed: { tint: "pink", label: "not set - tried again" },
};

function TicketLink({ id, subject }: { id: string; subject: string | null }) {
  return (
    <Box component="a" href={hsTicket(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>
      {subject || `Ticket ${id}`}
    </Box>
  );
}

function modeLine(mode: GqsMode): string {
  if (mode === "off") return "Off - the hub does not look.";
  if (mode === "preview") return "Preview - every 3 minutes the hub reads the tickets linked to a GQS request and lists what it would set; it writes nothing. Settings switches it Live.";
  return "Live - every 3 minutes the hub sets Type of sales ticket = GQS on every ESO / TSA ticket newly linked to a GQS request.";
}

export function GqsFollowUpsTab() {
  const [n, setN] = useState(0);
  const held = useHeld<Data>(`/api/uc/ticket-associations/gqs${n ? `?n=${n}` : ""}`, [n]);
  const r = held.result;
  const rows = r?.state === "ok" ? r.data.rows : [];
  const { slice, pager } = usePaged(rows, 20);
  if (r === null) return <LoadingPanel label="Reading the GQS follow-ups…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Associations" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const { mode, last, workflowOn } = r.data;
  const notGqs = last ? last.linked - last.carrying : 0;
  const count = (w: GqsRow["what"]) => rows.filter((x) => x.what === w).length;
  const types = Object.entries(last?.types ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k === "none" ? "(empty)" : k, value: v }));
  return (
    <>
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="purple" label="GQS requests" value={last ? full(last.requests) : "—"} note="in the GQS pipeline, all time" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<LinkOutlinedIcon />} tint="blue" label="Linked ESO tickets" value={last?.eso !== undefined ? full(last.eso) : "—"} note="linked to a GQS request" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<LinkOutlinedIcon />} tint="blue" label="Linked TSA tickets" value={last?.tsa !== undefined ? full(last.tsa) : "—"} note="linked to a GQS request" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Carry GQS" value={last ? full(last.carrying) : "—"} note={last ? `of ${full(last.linked)} linked ESO / TSA tickets` : "after the first look"} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<AutoFixHighOutlinedIcon />} tint="green" label={mode === "live" ? "Set by the hub" : "Would set (Preview)"} value={full(mode === "live" ? count("set") : count("would"))} note="new links since the hub started looking" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<EditOutlinedIcon />} tint="amber" label="Changed by a person" value={full(count("left"))} note="carried GQS, a person chose another type - left alone" /></Grid>
    </Grid>
    <GlassCard>
      <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="The workflow, as the hub runs it" note={`SARCLA | GQS ESO/TSA SETS ASSOCIATION (3887968475) - ${workflowOn === true ? "still switched ON in HubSpot" : workflowOn === false ? "switched off in HubSpot, the hub does it" : "its state could not be read"}`} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
        {([
          { t: "1. A GQS request", n: last ? full(last.requests) : "—", tint: "purple", w: "A ticket in the GQS pipeline - Sales asks for a special price" },
          { t: "2. Linked to an ESO / TSA ticket", n: last ? full(last.linked) : "—", tint: "blue", w: "The Sales ticket it belongs to, linked as a ticket association" },
          { t: "3. Type of sales ticket = GQS", n: last ? full(last.carrying) : "—", tint: "green", w: "Once, when the link appears or the ticket moves into ESO / TSA - every 3 minutes" },
          { t: "4. A person changes it", n: full(count("left")), tint: "amber", w: "Left as it is - the hub never sets it back (as the workflow)" },
        ] as { t: string; n: string; tint: Tint; w: string }[]).map((s) => (
          <Box key={s.t} sx={{ p: 1.5, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: TINT[s.tint].bg + "66" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: TINT[s.tint].fg }}>{s.t}</Typography>
            <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{s.n}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{s.w}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1.25 }}>Off / Preview / Live in Settings. Preview lists what the hub would set and writes nothing.</Typography>
    </GlassCard>
    {types.length > 0 && (
      <GlassCard>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="blue" title="Type of sales ticket on the linked ESO / TSA tickets" note={`At the last look, ${when(last!.at)}`} />
        <BarList rows={types} format={(v) => (v === null ? "-" : full(v))} />
      </GlassCard>
    )}
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<LinkOutlinedIcon />} tint="purple" title="ESO / TSA tickets linked to a GQS request"
          note="Each carries Type of sales ticket = GQS - the links found since the hub started looking, newest first" />
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.5 }}>
          {modeLine(mode)}
          {last ? ` Last look ${when(last.at)}: ${full(last.requests)} GQS requests, ${full(last.linked)} ESO / TSA tickets linked to them - ${notGqs ? `${full(notGqs)} without GQS` : "all carry GQS"}.` : " Not looked yet."}
        </Typography>
        {last?.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mb: 1.5 }}>Last look failed: {last.error} - tried again in 3 minutes.</Typography>}
      </Box>
      <Table size="small">
        <TableHead><TableRow>{["Ticket", "Pipeline", "GQS request", "Type of sales ticket", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {!rows.length && (
            <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>
              No new link since the hub started looking{last && !last.error ? ` - the ${full(last.linked)} linked before ${notGqs ? `include ${full(notGqs)} without GQS` : "all carry GQS"}` : ""}.
            </TableCell></TableRow>
          )}
          {slice.map((x) => (
            <TableRow key={`${x.ticketId}-${x.at}`} hover>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketLink id={x.ticketId} subject={x.subject} /></TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{x.pipeline}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{x.requestId ? <TicketLink id={x.requestId} subject={x.requestSubject} /> : "-"}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                <Chip tint={WHAT[x.what].tint}>{WHAT[x.what].label}</Chip>
                {x.what !== "already" && x.before && x.before !== "GQS" ? <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}> was {x.before}</Typography> : null}
                {x.error && <Typography sx={{ fontSize: "0.74rem", color: RED }}>{x.error}</Typography>}
              </TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(x.at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </GlassCard>
    </>
  );
}
