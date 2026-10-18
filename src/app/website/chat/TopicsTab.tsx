"use client";

// APSOassistant Chat > Topics (SARCLA 18.10.2026: "this detection doesn't work really well today, we should have a
// different tab to keep this updated always"). Every real chat filed by the hub AFTER it ended, from the whole chat in
// HubSpot (src/lib/chat/topics.ts): the topics in the period, how many the AI solved alone, how many went to a person
// and whether a person then wrote in the chat. A topic opens to its chats with the one-line summary; anyone with
// Website can put a chat under another topic - that sticks, the job never files over a person.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import { full } from "@/app/charts/format";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, HsLink, INK, KpiTile, MUTED, Notice, TRACK, bodyCell, headCell } from "@/app/uc/report/ui";
import { TOPICS, topicLabel, type TopicsRun } from "@/lib/chat/shape";
import { HandlerChip, Loaded, pct, pill, post, when } from "./shared";

type TopicRow = { topic: string; chats: number; handed: number; agentWrote: number; byPerson: number };
type Summary = { rows: TopicRow[]; filed: number; byPerson: number; run: TopicsRun | null; from: string; isAdmin: boolean };
type TopicChat = {
  session_hash: string; ticket_id: string | null; started_at: string | null; last_at: string | null; language: string | null;
  handed: boolean; team: string | null; agent_wrote: boolean | null; topic: string; summary: string; service_category: string | null; by: string;
};

export default function TopicsTab({ days, label }: { days: number; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [n, setN] = useState(0);
  return (
    <Loaded<Summary> key={`topics-${days}-${n}`} url={`/api/website/chat?part=topics&days=${days}`} what="the topics">
      {(s) => <Body s={s} days={days} label={label} open={open} setOpen={setOpen} reload={() => setN((x) => x + 1)} />}
    </Loaded>
  );
}

function Body({ s, days, label, open, setOpen, reload }: {
  s: Summary; days: number; label: string; open: string | null; setOpen: (t: string | null) => void; reload: () => void;
}) {
  const top = s.rows[0];
  const max = Math.max(1, ...s.rows.map((r) => r.chats));
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="purple" label="Chats filed" value={full(s.filed)} note={`${label} - from ${when(s.from).slice(0, 10)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CategoryOutlinedIcon />} tint="amber" label="Most asked" value={top ? topicLabel(top.topic) : "–"} note={top ? `${full(top.chats)} chats · ${pct(top.chats, s.filed)}` : "nothing filed yet"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassBottomOutlinedIcon />} tint="slate" label="Waiting to be filed" value={s.run?.waiting != null ? full(s.run.waiting) : "–"} note={s.run ? `last run ${when(s.run.at)}` : "the first run starts 6 min after a deploy"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EditNoteOutlinedIcon />} tint="green" label="Put right by a person" value={full(s.byPerson)} note="never filed over by the AI" /></Grid>
      </Grid>
      <Run s={s} reload={reload} />

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="What the chats were about"
          note="Filed by the hub after each chat, from the whole chat in HubSpot - the customer's main reason. Click a topic for its chats." />
        {!s.rows.length ? (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing filed in this period yet. The hub files every 20 minutes, 120 chats at a time; the chats since go-live take about 8 hours.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {["Topic", "Chats", "", "AI alone", "Handed to a person", "A person wrote in the chat"].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i === 0 || i === 2 ? "left" : "right" }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {s.rows.map((r) => (
                  <TableRow key={r.topic} hover selected={open === r.topic} onClick={() => setOpen(open === r.topic ? null : r.topic)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK }}>{topicLabel(r.topic)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.chats)}</TableCell>
                    <TableCell sx={{ ...bodyCell, width: "28%", minWidth: 120 }}>
                      <Box sx={{ height: 8, borderRadius: 4, bgcolor: TRACK, overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(r.chats / max) * 100}%`, bgcolor: "#a96a12" }} /></Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{pct(r.chats - r.handed, r.chats)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{full(r.handed)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", color: r.handed && r.agentWrote < r.handed / 2 ? "#c5221f" : INK }}>
                      {r.handed ? `${full(r.agentWrote)} of ${full(r.handed)}` : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </GlassCard>

      {open && <TopicChats key={`${open}-${days}`} topic={open} days={days} onMoved={reload} />}
    </>
  );
}

/** The job's last run, and "File now" for an admin. */
function Run({ s, reload }: { s: Summary; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await post<TopicsRun>({ action: "topics-run" });
    setBusy(false);
    setMsg(r.ok && r.data ? { ok: true, text: `${r.data.filed} filed now${r.data.waiting ? `, ${full(r.data.waiting)} still waiting` : ""}.` } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const last = s.run;
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      {last && (last.ok
        ? <Chip tint="slate">Last run {when(last.at)}: {last.filed} filed{last.unreadable ? ` · ${last.unreadable} no longer in HubSpot` : ""}{last.failed ? ` · ${last.failed} failed` : ""}</Chip>
        : <Chip tint="pink">Last run {when(last.at)} failed: {last.error}</Chip>)}
      {s.isAdmin && (
        <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void run()} startIcon={busy ? <CircularProgress size={14} /> : <SyncOutlinedIcon />}>
          {busy ? "Filing…" : "File 20 now"}
        </Button>
      )}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </Box>
  );
}

const PER = 20;

function TopicChats({ topic, days, onMoved }: { topic: string; days: number; onMoved: () => void }) {
  const [page, setPage] = useState(0);
  const url = `/api/website/chat?part=topic-chats&topic=${encodeURIComponent(topic)}&days=${days}&offset=${page * PER}&limit=${PER}`;
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title={topicLabel(topic)}
        note="Newest first. Wrong topic? Pick the right one - it sticks." />
      <Loaded<{ chats: TopicChat[]; total: number }> key={url} url={url} what="the chats">
        {(r, reload) => (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>
                  {["Last message", "Language", "What the customer wanted", "Handled by", "Topic", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {r.chats.map((c) => (
                    <TableRow key={c.session_hash}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(c.last_at ?? c.started_at)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{(c.language || "?").toUpperCase()}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK, minWidth: 280 }}>
                        {c.summary || <Box component="span" sx={{ color: FAINT }}>–</Box>}
                        {c.handed && c.agent_wrote === false && <Box component="span" sx={{ ml: 0.75 }}><Chip tint="pink">no person wrote</Chip></Box>}
                        {c.service_category && <Box sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>The chat itself said: {c.service_category}</Box>}
                      </TableCell>
                      <TableCell sx={bodyCell}><HandlerChip c={{ escalated: c.handed, routing_team: c.team, handler: null }} /></TableCell>
                      <TableCell sx={{ ...bodyCell, minWidth: 190 }}><TopicPick c={c} onMoved={() => { reload(); onMoved(); }} /></TableCell>
                      <TableCell sx={bodyCell}>{c.ticket_id ? <HsLink id={c.ticket_id} /> : <Box component="span" sx={{ color: FAINT }}>–</Box>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {r.total > PER && (
              <TablePagination component="div" count={r.total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={PER} rowsPerPageOptions={[PER]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${full(count)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
            )}
          </>
        )}
      </Loaded>
    </GlassCard>
  );
}

function TopicPick({ c, onMoved }: { c: TopicChat; onMoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (topic: string) => {
    if (topic === c.topic) return;
    setBusy(true); setErr(null);
    const r = await post({ action: "topic-set", session_hash: c.session_hash, topic });
    setBusy(false);
    if (r.ok) onMoved(); else setErr(r.error ?? "Did not work.");
  };
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <TextField select size="small" value={TOPICS.some((t) => t.key === c.topic) ? c.topic : ""} disabled={busy} onChange={(e) => void pick(e.target.value)}
        slotProps={{ htmlInput: { "aria-label": "Topic" } }} sx={{ "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.5 } }}>
        {TOPICS.map((t) => <MenuItem key={t.key} value={t.key} sx={{ fontSize: "0.84rem" }}>{t.label}</MenuItem>)}
      </TextField>
      <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>{c.by === "ai" ? "filed by the AI" : `put here by ${c.by}`}</Typography>
      {err && <Notice tone="bad">{err}</Notice>}
    </Box>
  );
}
