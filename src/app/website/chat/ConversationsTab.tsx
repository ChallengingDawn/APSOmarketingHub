"use client";

// APSOassistant Chat > Conversations and > Hand-overs: the old dashboard's Conversations and Escalation Debug
// pages. A page of chats at a time from the orchestrator's log; a row opens to the WHOLE chat as HubSpot holds it
// (SARCLA 18.10.2026: "improve the conversation layout, also the hand-overs") - the customer, APSOassistant and the
// agents by name, the moment the AI let go, who took it and whether a person ever wrote in the chat. A chat without
// a ticket falls back to the orchestrator's memory (its last 10 messages, while it keeps them).

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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { full } from "@/app/charts/format";
import { Chip, Choice } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, HAIRLINE, HsLink, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import type { Conversation, ConversationDetail, Conversations, Transcript, TranscriptItem } from "@/lib/chat/shape";
import { HandlerChip, LANGUAGES, Loaded, category, when } from "./shared";

const PER = 25;

export default function ConversationsTab({ handedOnly }: { handedOnly: boolean }) {
  const [page, setPage] = useState(0);
  const [lang, setLang] = useState<string>("all");
  const url = `/api/website/chat?part=conversations&limit=${PER}&offset=${page * PER}${handedOnly ? "&escalated=1" : ""}${lang !== "all" ? `&language=${lang}` : ""}`;
  // no "why" column: the orchestrator almost never records a reason (every row said "not given", 18.10.2026)
  const heads = ["", "Last message", "Language", "About", "Handled by", "Messages", "Ticket"];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={handedOnly ? <SupportAgentOutlinedIcon /> : <ForumOutlinedIcon />} tint={handedOnly ? "green" : "purple"}
        title={handedOnly ? "Chats handed to a person" : "All chats"}
        note={handedOnly
          ? "Every chat the AI passed to TSA or Back Office. Open one for the whole chat: when the AI let go, who took it, and whether a person wrote in the chat."
          : "Newest first. Open a row for the whole chat as HubSpot holds it."} />
      <Choice value={lang} onChange={(k) => { setLang(k); setPage(0); }}
        options={[{ key: "all", label: "All languages" }, ...LANGUAGES.map((l) => ({ key: l, label: l.toUpperCase() }))]} />
      <Loaded<Conversations> key={url} url={url} what="the conversations">
        {(r) => (
          <>
            {r.unit === "messages" && <Notice tone="warn">One row per message until the orchestrator has its update: a chat appears once for each of its messages.</Notice>}
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{heads.map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {r.conversations.map((c) => <Row key={c.id} c={c} cols={heads.length} />)}
                  {!r.conversations.length && <TableRow><TableCell colSpan={heads.length} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No chats here.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
            <TablePagination component="div" count={r.total} page={page} onPageChange={(_, n) => setPage(n)} rowsPerPage={PER} rowsPerPageOptions={[PER]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${full(count)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
          </>
        )}
      </Loaded>
    </GlassCard>
  );
}

function Row({ c, cols }: { c: Conversation; cols: number }) {
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
        <TableCell colSpan={cols} sx={{ p: 0, borderColor: HAIRLINE, borderBottomWidth: open ? 1 : 0 }}>
          <Collapse in={open} unmountOnExit><Detail c={c} /></Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function Detail({ c }: { c: Conversation }) {
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1.5, bgcolor: "rgba(36,89,209,.03)", display: "grid", gap: 1.25 }}>
      {c.hubspot_ticket_id ? (
        <Loaded<{ transcript: Transcript | null }> url={`/api/website/chat?part=transcript&ticket=${c.hubspot_ticket_id}`} what="the chat from HubSpot">
          {(d) => d.transcript ? <WholeChat t={d.transcript} c={c} /> : <FromMemory c={c} note="HubSpot no longer holds this chat." />}
        </Loaded>
      ) : <FromMemory c={c} note="This chat has no ticket, so HubSpot cannot be asked." />}
      <AiNotes raw={c.debug_log} />
    </Box>
  );
}

/* ── the whole chat, from HubSpot ──────────────────────────────────────────────────────────────────── */

const mins = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / 60_000 : null);
function span(m: number | null): string {
  if (m == null) return "–";
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} s`;
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${Math.round(m % 60)} min` : `${Math.round(h / 24)} days`;
}
const clock = (iso: string) => when(iso).slice(11);
const day = (iso: string) => when(iso).slice(0, 10);

function WholeChat({ t, c }: { t: Transcript; c: Conversation }) {
  const handed = !!t.handedAt;
  return (
    <>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={t.status === "CLOSED" ? "slate" : "green"}>{t.status === "CLOSED" ? `Closed ${t.closedAt ? when(t.closedAt) : ""}` : "Open"}</Chip>
        {t.inbox && <Chip tint="slate">{t.inbox}</Chip>}
        {handed ? (
          <>
            <Chip tint="amber">AI let go at {clock(t.handedAt!)}{c.routing_team ? ` · ${c.routing_team.replace(/_/g, " ")}` : ""}</Chip>
            {t.agent
              ? <Chip tint="blue">Taken by {t.agent.name ?? "an agent"} after {span(mins(t.handedAt, t.agent.at))}</Chip>
              : <Chip tint="pink">Nobody took it</Chip>}
            {t.agentMessages
              ? <Chip tint="green">A person wrote {t.agentMessages} {t.agentMessages === 1 ? "message" : "messages"}, the first after {span(mins(t.handedAt, t.agentFirstReplyAt))}</Chip>
              : <Chip tint="pink">No person wrote in the chat</Chip>}
          </>
        ) : t.agentMessages ? <Chip tint="green">A person joined: {t.agentMessages} {t.agentMessages === 1 ? "message" : "messages"}</Chip> : <Chip tint="slate">The AI alone</Chip>}
        <Box component="a" href={t.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          sx={{ ml: "auto", display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.78rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
          Open in HubSpot <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Box>
      </Box>
      <Bubbles items={t.items} />
    </>
  );
}

const STYLE: Record<TranscriptItem["who"], { bg: string; fg: string; label: string; right: boolean }> = {
  customer: { bg: "#fff", fg: MUTED, label: "Customer", right: false },
  ai: { bg: "#efe8fd", fg: "#6a46c9", label: "APSOassistant", right: true },
  agent: { bg: "#e7f6ee", fg: "#1b7a55", label: "Agent", right: true },
  system: { bg: "transparent", fg: FAINT, label: "", right: false },
};

function Bubbles({ items }: { items: TranscriptItem[] }) {
  if (!items.length) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No messages in this chat.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.75, maxHeight: "72vh", overflowY: "auto", pr: 0.5 }}>
      {items.map((m, i) => {
        const newDay = i === 0 || day(items[i - 1].at) !== day(m.at);
        const st = STYLE[m.who];
        return (
          <Box key={i} sx={{ display: "contents" }}>
            {newDay && <Typography sx={{ justifySelf: "center", fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.04em" }}>{day(m.at)}</Typography>}
            {m.who === "system" ? (
              <Typography sx={{ justifySelf: "center", fontSize: "0.74rem", color: FAINT, px: 1.25, py: 0.25, borderRadius: "999px", border: `1px dashed ${HAIRLINE}` }}>
                {m.text} · {clock(m.at)}
              </Typography>
            ) : (
              <Box sx={{ justifySelf: st.right ? "end" : "start", maxWidth: { xs: "92%", md: "72%" }, px: 1.25, py: 0.75, borderRadius: st.right ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                bgcolor: st.bg, border: `1px solid ${HAIRLINE}`, color: INK, fontSize: "0.83rem", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", fontSize: "0.68rem", fontWeight: 700, color: st.fg, mb: 0.25 }}>
                  <span>{m.who === "agent" ? m.name ?? st.label : st.label}</span><Box component="span" sx={{ color: FAINT, fontWeight: 500 }}>{clock(m.at)}</Box>
                </Box>
                {m.text}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── no ticket, or HubSpot lost it: the orchestrator's memory ─────────────────────────────────────── */

function FromMemory({ c, note }: { c: Conversation; note: string }) {
  return (
    <Loaded<ConversationDetail> url={`/api/website/chat?part=conversation&hash=${c.session_hash}`} what="the messages">
      {(d) => {
        const turns = d.session?.turns ?? [];
        if (!turns.length) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{note} The AI&apos;s memory no longer holds it either (it keeps a chat&apos;s last 10 messages for a while).</Typography>;
        return (
          <>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{note} From the AI&apos;s memory - the last {turns.length} messages:</Typography>
            <Bubbles items={turns.map((t) => ({ at: c.last_at ?? c.started_at, who: t.role === "user" ? "customer" : "ai", name: null, text: t.content ?? t.text ?? "" }))} />
          </>
        );
      }}
    </Loaded>
  );
}

/** What the AI noted on the chat's last turn (its debug log): folded away, for checking a decision. */
function AiNotes({ raw }: { raw: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const notes = debugNotes(raw);
  if (!notes.length) return null;
  return (
    <Box>
      <Typography component="button" onClick={() => setOpen((o) => !o)}
        sx={{ border: 0, bgcolor: "transparent", p: 0, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {open ? "▾" : "▸"} What the AI noted on the last turn ({notes.length})
      </Typography>
      {open && (
        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5, fontSize: "0.78rem", color: MUTED, display: "grid", gap: 0.25 }}>
          {notes.slice(0, 40).map((n, i) => <li key={i}>{n}</li>)}
        </Box>
      )}
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
