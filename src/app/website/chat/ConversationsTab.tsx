"use client";

// Chat > Conversations and Chat > Hand-overs: the old dashboard's Conversations and Escalation Debug pages. A page
// of chats at a time from the orchestrator's log; a row opens to the messages (while the chat memory still holds
// them), why the AI handed over and to whom, and the AI's own notes on the turn (its debug log).

import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import { full } from "@/app/charts/format";
import { Choice } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, HAIRLINE, HsLink, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import type { Conversation, ConversationDetail, Conversations } from "@/lib/chat/shape";
import { HandlerChip, LANGUAGES, Loaded, category, when } from "./shared";

const PER = 25;

export default function ConversationsTab({ handedOnly }: { handedOnly: boolean }) {
  const [page, setPage] = useState(0);
  const [lang, setLang] = useState<string>("all");
  const url = `/api/website/chat?part=conversations&limit=${PER}&offset=${page * PER}${handedOnly ? "&escalated=1" : ""}${lang !== "all" ? `&language=${lang}` : ""}`;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={handedOnly ? <SupportAgentOutlinedIcon /> : <ForumOutlinedIcon />} tint={handedOnly ? "green" : "purple"}
        title={handedOnly ? "Chats handed to a person" : "All chats"}
        note={handedOnly
          ? "Every chat the AI passed to TSA or Back Office: why, to whom, and the AI's notes on the turn - to check a hand-over went where it should."
          : "Newest first. Open a row for the messages and what the AI decided."} />
      <Choice value={lang} onChange={(k) => { setLang(k); setPage(0); }}
        options={[{ key: "all", label: "All languages" }, ...LANGUAGES.map((l) => ({ key: l, label: l.toUpperCase() }))]} />
      <Loaded<Conversations> key={url} url={url} what="the conversations">
        {(r) => (
          <>
            {r.unit === "messages" && <Notice tone="warn">One row per message until the orchestrator has its update (APSOAssistant feat/chat-dry-run): a chat appears once for each of its messages.</Notice>}
            <Table size="small">
              <TableHead><TableRow>
                {["", "Last message", "Language", "About", "Handled by", "Messages", "Ticket"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {r.conversations.map((c) => <Row key={c.id} c={c} />)}
                {!r.conversations.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No chats here.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <TablePagination component="div" count={r.total} page={page} onPageChange={(_, n) => setPage(n)} rowsPerPage={PER} rowsPerPageOptions={[PER]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${full(count)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
          </>
        )}
      </Loaded>
    </GlassCard>
  );
}

function Row({ c }: { c: Conversation }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow hover onClick={() => setOpen((o) => !o)} sx={{ cursor: "pointer", "& > td": { borderBottom: open ? "none" : undefined } }}>
        <TableCell sx={{ ...bodyCell, width: 36, p: 0.5 }}>
          <IconButton size="small" aria-label={open ? "Close" : "Open"}>{open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}</IconButton>
        </TableCell>
        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(c.last_at ?? c.started_at)}</TableCell>
        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{(c.language_code || "?").toUpperCase()}</TableCell>
        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{category(c.category_code)}{c.sub_l1 ? <Box component="span" sx={{ color: FAINT }}> · {c.sub_l1}</Box> : null}</TableCell>
        <TableCell sx={bodyCell}><HandlerChip c={c} /></TableCell>
        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: "right" }}>{c.messages ?? c.turns_count}</TableCell>
        <TableCell sx={bodyCell} onClick={(e) => e.stopPropagation()}>{c.hubspot_ticket_id ? <HsLink id={c.hubspot_ticket_id} /> : <Box component="span" sx={{ color: FAINT }}>–</Box>}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, borderColor: HAIRLINE, borderBottomWidth: open ? 1 : 0 }}>
          <Collapse in={open} unmountOnExit><Detail c={c} /></Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function Detail({ c }: { c: Conversation }) {
  return (
    <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(36,89,209,.03)", display: "grid", gap: 1.25 }}>
      {c.escalated && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", fontSize: "0.8rem", color: INK }}>
          <span><b>Handed to:</b> {c.routing_team ? c.routing_team.replace(/_/g, " ") : "no team set"}</span>
          <span><b>Why:</b> {c.escalation_reason || "not given"}</span>
          {c.escalated && !c.routing_team && <Notice tone="warn">Handed over without a team.</Notice>}
        </Box>
      )}
      <Loaded<ConversationDetail> url={`/api/website/chat?part=conversation&hash=${c.session_hash}`} what="the messages">
        {(d) => {
          const turns = d.session?.turns ?? [];
          const notes = debugNotes(d.log?.debug_log ?? c.debug_log);
          return (
            <>
              {turns.length ? (
                <Box sx={{ display: "grid", gap: 0.75, maxHeight: 420, overflow: "auto" }} title="The chat memory keeps the last 10 messages">
                  {turns.map((t, i) => {
                    const me = t.role === "user";
                    return (
                      <Box key={i} sx={{ justifySelf: me ? "start" : "end", maxWidth: "78%", px: 1.25, py: 0.75, borderRadius: "12px", fontSize: "0.82rem", lineHeight: 1.45, whiteSpace: "pre-wrap",
                        bgcolor: me ? "#fff" : "#efe8fd", border: `1px solid ${HAIRLINE}`, color: INK }}>
                        <Box sx={{ fontSize: "0.68rem", fontWeight: 700, color: me ? MUTED : "#6a46c9", mb: 0.25 }}>{me ? "Customer" : "AI"}</Box>
                        {t.content ?? t.text ?? ""}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                  The chat memory no longer holds these messages (it keeps the last 10 of a chat, for a limited time). The whole chat is in HubSpot{c.hubspot_ticket_id ? <> - <HsLink id={c.hubspot_ticket_id} /></> : ""}.
                </Typography>
              )}
              {notes.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>What the AI noted on the last turn</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: "0.78rem", color: MUTED, display: "grid", gap: 0.25 }}>
                    {notes.slice(0, 40).map((n, i) => <li key={i}>{n}</li>)}
                  </Box>
                </Box>
              )}
            </>
          );
        }}
      </Loaded>
    </Box>
  );
}

/** The orchestrator keeps its turn notes as a JSON list of strings (or objects); anything else reads as one line. */
function debugNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : [String(raw)];
  } catch { return [String(raw)]; }
}

