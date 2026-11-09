"use client";

// APSO TRANSLATOR > CONVERSATIONS - every comment and reply it made (in Preview: would make), newest first, with the
// texts; a row opens the whole text, the ticket opens in HubSpot. Its own page in the app's side panel since 09.11.2026
// (SARCLA: "the sub apps on the side panel").

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { CardTitle, GlassCard, INK, MUTED, bodyCell, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { Row } from "@/lib/translator/engine";
import { CHANNEL, Frame, OUTCOME, lang, n0, useTranslator, type Data } from "../shared";

type View = "all" | "customer" | "notes" | "problems";
const isMade = (r: Row) => r.outcome !== "skipped" && r.outcome !== "failed";
const VIEWS: Record<View, (r: Row) => boolean> = {
  all: (r) => r.outcome !== "skipped",
  customer: (r) => r.kind === "incoming" && isMade(r),
  notes: (r) => r.kind === "reply" || r.kind === "lang" || r.kind === "help",
  problems: (r) => r.outcome === "failed" || r.outcome === "skipped",
};

function List({ d }: { d: Data }) {
  const [view, setView] = useState<View>("all");
  const [channel, setChannel] = useState<"any" | Row["channel"]>("any");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const agentName = (id: string | null | undefined) => (id ? d.agents[id] ?? "an agent" : null);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.rows.filter((r) => VIEWS[view](r) && (channel === "any" || r.channel === channel)
      && (!s || [r.original, r.translated, r.ticket, lang(r.from), lang(r.to), agentName(r.agent), r.inbox ? d.inboxes[r.inbox] : ""].some((x) => (x ?? "").toLowerCase().includes(s))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, view, channel, q]);
  const count = (v: View) => d.rows.filter(VIEWS[v]).length;
  const { slice, pager } = usePaged(rows, 20);
  const what = (r: Row) => r.kind === "incoming" ? `${lang(r.from)} → English` : r.kind === "lang" ? `!${r.to ?? ""} - the customer's message in ${lang(r.to)}`
    : r.kind === "reply" ? `Reply in ${lang(r.to)}` : "!help";
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1.25 }}>
        <CardTitle icon={<ForumOutlinedIcon />} tint="purple" title="Every translation" note={`Newest first, the last ${n0(d.rows.length)} - click a row for the whole text`} />
        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
          <Choice value={view} onChange={setView} options={[
            { key: "all", label: `All ${n0(count("all"))}` },
            { key: "customer", label: `Customer messages ${n0(count("customer"))}` },
            { key: "notes", label: `! notes ${n0(count("notes"))}` },
            { key: "problems", label: `Not done ${n0(count("problems"))}` },
          ]} />
          <Choice value={channel} onChange={setChannel} options={[
            { key: "any", label: "Chat and e-mail" }, { key: "chat", label: "Chat" }, { key: "email", label: "E-mail" },
          ]} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.4, borderRadius: "10px", border: "1px solid rgba(21,34,58,.14)", minWidth: 220, flex: { xs: 1, md: "0 1 280px" } }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Text, ticket, language, agent…" sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
        </Box>
      </Box>
      {rows.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820, tableLayout: "fixed" }}>
            <TableHead><TableRow>
              <TableCell sx={{ ...headCell, width: 120 }}>When</TableCell>
              <TableCell sx={{ ...headCell, width: 200 }}>Ticket</TableCell>
              <TableCell sx={{ ...headCell, width: 210 }}>What</TableCell>
              <TableCell sx={headCell}>Text</TableCell>
              <TableCell sx={{ ...headCell, width: 170 }}>Outcome</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {slice.map((r) => {
                const key = `${r.thread}-${r.msgAt}-${r.kind}`, isOpen = open === key, o = OUTCOME[r.outcome];
                return (
                  <TableRow key={key} hover onClick={() => setOpen(isOpen ? null : key)} sx={{ cursor: "pointer", verticalAlign: "top" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{when(r.msgAt)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                      {r.ticket ? <a href={hsTicket(r.ticket)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#2459d1", textDecoration: "none" }}>Ticket {r.ticket}</a> : <span style={{ color: MUTED }}>No ticket</span>}
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{CHANNEL[r.channel]}{r.inbox && d.inboxes[r.inbox] ? ` · ${d.inboxes[r.inbox]}` : ""}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK }}>
                      {what(r)}
                      {r.agent && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{agentName(r.agent)}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                      <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: isOpen ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.original}</Typography>
                      {r.translated && <Typography sx={{ fontSize: "0.8rem", color: INK, whiteSpace: isOpen ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", mt: 0.25 }}>{r.translated}</Typography>}
                    </TableCell>
                    <TableCell sx={bodyCell}>
                      <Chip tint={o.tint}>{o.label}</Chip>
                      {r.why && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>{r.why}</Typography>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{d.rows.length ? "None matches." : "Nothing yet - the first customer message in another language shows up within a minute."}</Typography></Box>}
      {pager}
    </GlassCard>
  );
}

export default function TranslatorConversations() {
  const { d, wait } = useTranslator("rows");
  return (
    <Frame title="Conversations" subtitle="Every comment and reply APSO Translator made, with the texts" d={d}>
      {d ? <List d={d} /> : wait}
    </Frame>
  );
}
