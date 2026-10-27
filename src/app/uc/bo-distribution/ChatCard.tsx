"use client";

// BACK OFFICE DISTRIBUTION - the chat's call-backs (SARCLA 26.10.2026: no more parking in the chat pipeline's "New BO
// Topic", no more Rose; the stage "CHAT/C2S Issue", an owner from the distribution, a call within the hour - live since
// 27.10.2026 with the subject "PLEASE CALL CHAT CUSTOMER | 1 HOUR | <company>"). Every chat ticket of the last 7 days
// that came to the Back Office: who calls, by when, and what the hub wrote (engine.ts row.chat, row.wrote).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, hsTicket } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { Row } from "@/lib/boDistribution/engine";
import type { Data } from "./shared";

function Caller({ c }: { c: NonNullable<Row["chat"]> }) {
  if (!c.owner.ownerId) return (
    <Box sx={{ display: "grid", gap: 0.25, justifyItems: "start" }}>
      <Chip tint="slate">Waits - nobody available</Chip>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>CHAT/C2S Issue · the hour to call starts when someone gets it</Typography>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>{c.owner.ownerName}</Typography>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
        CHAT/C2S Issue · {c.owner.method}{c.owner.reasons.length ? ` · ${c.owner.reasons.slice(0, 2).join("; ")}` : ""}
      </Typography>
      {c.callBy && <Typography sx={{ fontSize: "0.72rem", color: INK }}>Calls the customer by {when(c.callBy)}</Typography>}
    </Box>
  );
}

/** what the live step did with it - or why it left it */
function Written({ w }: { w: Row["wrote"] }) {
  if (!w) return <Chip tint="slate">Not written - live mode off</Chip>;
  if (w.ok) return <Chip tint="green">{w.ownerName ? `Given to ${w.ownerName}` : "Moved - waits for an owner"}</Chip>;
  return (
    <Box sx={{ display: "grid", gap: 0.25, justifyItems: "start" }}>
      <Chip tint="amber">Left</Chip>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{w.skipped ?? w.error ?? ""}</Typography>
    </Box>
  );
}

export function ChatCard({ d }: { d: Data }) {
  const rows = d.rows.filter((r) => r.chat).sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
  const waits = rows.filter((r) => !r.chat!.owner.ownerId).length;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<ForumOutlinedIcon />} tint="purple"
        title={`Chat call-backs for the Back Office: ${full(rows.length)}${waits ? ` · ${full(waits)} waited for someone available` : ""}`}
        note="Every chat ticket that came to the Back Office in these 7 days" />
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
        A chat topic the AI cannot finish and that is not about sales comes to the Back Office: the stage CHAT/C2S Issue, the subject
        &quot;PLEASE CALL CHAT CUSTOMER | 1 HOUR | company&quot;, the account&apos;s ERP sales agent (else the SA Sub, else the least busy) as
        owner, and a call to the customer within the hour. Nobody available: it waits in CHAT/C2S Issue and gets the next one available.
      </Typography>
      {!rows.length ? (
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No chat ticket has come to the Back Office in these 7 days. Each new one shows here within two minutes.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760, "& td, & th": { borderColor: HAIRLINE, verticalAlign: "top" } }}>
            <TableHead>
              <TableRow>
                {["Ticket", "Came in", "Who calls", "Written"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <a href={hsTicket(r.ticketId)} target="_blank" rel="noreferrer" style={{ color: INK, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>{r.ticketId}</a>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.subject}>{r.subject || "(no subject)"}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.78rem", color: INK, whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                  <TableCell><Caller c={r.chat!} /></TableCell>
                  <TableCell><Written w={r.wrote} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </GlassCard>
  );
}
