"use client";

// BACK OFFICE DISTRIBUTION - the tickets waiting for an owner (SARCLA 19.10.2026: "the unassigned tickets should always
// be distributed, as well as Backoffice Team"). Open Back Office and GQS tickets with no owner, the Backoffice Team
// queue or a deactivated owner, and who the hub gives each one: the person who had it when on the team and available,
// else the distribution's pick; nobody available = it waits. Live only with its own switch (Settings).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, hsTicket } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { Stray } from "@/lib/boDistribution/engine";
import type { Data } from "./shared";

const PIPE = { bo: "Back Office", gqs: "GQS", eso: "ESO", tsa: "TSA" } as const;
const WHY_TINT = { "no owner": "pink", "Backoffice Team": "amber", "TSA Team": "amber", "deactivated owner": "purple" } as const;
const days = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400_000)) : null);

function Outcome({ s, live }: { s: Stray; live: boolean }) {
  if (s.error) return <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Not read: {s.error}</Typography>;
  if (s.wrote?.ok) return <Chip tint="green">Given to {s.wrote.ownerName}</Chip>;
  if (s.wrote?.error) return <Chip tint="pink">Write failed: {s.wrote.error}</Chip>;
  if (!s.hub?.ownerId) return s.pipeline === "eso" || s.pipeline === "tsa"
    ? <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{s.hub?.method ?? "The company has no owner"}</Typography>
    : <Chip tint="slate">Waits - nobody available</Chip>;
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>{s.hub.ownerName}</Typography>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
        {s.hub.method}{s.hub.reasons.length ? ` · ${s.hub.reasons.slice(0, 2).join("; ")}` : ""}
        {s.wrote?.skipped ? ` · not written: ${s.wrote.skipped}` : live ? "" : " · shadow: not written"}
      </Typography>
    </Box>
  );
}

export function StraysCard({ d }: { d: Data }) {
  const st = d.strays;
  const live = !!d.settings.live.strays;
  const items = st?.items ?? [];
  const waits = items.filter((s) => !s.hub?.ownerId && !s.error).length;
  const given = items.filter((s) => s.wrote?.ok).length;
  const note = !st
    ? "Read every 5 minutes - nothing read yet"
    : `Read ${when(st.at)} · every 5 minutes · ${live ? "LIVE: the hub gives them an owner" : "shadow: the hub only shows who it would give them to (Settings switches it live)"}`;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PersonOffOutlinedIcon />} tint="pink"
        title={st ? `Waiting for an owner: ${full(st.total)}${given ? ` · ${full(given)} given one` : ""}${waits ? ` · ${full(waits)} wait for someone available` : ""}` : "Waiting for an owner"}
        note={note} />
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
        Open Back Office and GQS tickets nobody really owns - no owner, only the Backoffice Team queue, or someone who has left. Every 5 minutes
        each one gets an owner: the person who had it if available, else the distribution&apos;s pick. ESO / TSA tickets without an owner are on the Wrong owners page.
      </Typography>
      {!items.length ? (
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{st ? "None - every open ticket has a real owner." : "The first look runs within 5 minutes of the deploy."}</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760, "& td, & th": { borderColor: HAIRLINE, verticalAlign: "top" } }}>
            <TableHead>
              <TableRow>
                {["Ticket", "Where", "Owner now", "Waiting", "The hub gives it to"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.ticketId}>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <a href={hsTicket(s.ticketId)} target="_blank" rel="noreferrer" style={{ color: INK, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>{s.ticketId}</a>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.subject}>{s.subject || "(no subject)"}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.78rem", color: INK }}>{PIPE[s.pipeline]}<br /><span style={{ color: MUTED }}>{s.stageLabel ?? s.stage}</span></TableCell>
                  <TableCell>
                    <Chip tint={WHY_TINT[s.why]}>{s.why}</Chip>
                    {s.was && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>had: {s.was}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.78rem", color: INK, whiteSpace: "nowrap" }}>
                    <Tooltip title={s.since ? `In this stage since ${s.since.slice(0, 16).replace("T", " ")}` : ""}><span>{days(s.since) === null ? "—" : `${days(s.since)} days`}</span></Tooltip>
                  </TableCell>
                  <TableCell><Outcome s={s} live={live} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {st && st.total > items.length && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75 }}>{full(st.total - items.length)} more - 25 are decided per look.</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}
