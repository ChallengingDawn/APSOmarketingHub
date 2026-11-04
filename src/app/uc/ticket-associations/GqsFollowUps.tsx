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
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import type { GqsMode, GqsRow, GqsRun } from "@/lib/ticketAssoc/gqsType";

type Data = { mode: GqsMode; last: GqsRun | null; rows: GqsRow[]; admin: boolean };

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
  const { mode, last } = r.data;
  const notGqs = last ? last.linked - last.carrying : 0;
  return (
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
  );
}
