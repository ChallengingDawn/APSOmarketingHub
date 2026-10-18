"use client";

// APSOassistant Chat > Topics (SARCLA 18.10.2026: "this detection doesn't work really well today, we should have a
// different tab to keep this updated always", then "fill it into the property, with the property's definitions, and
// backfill the previous ones"). Every chat filed by the hub AFTER it ended, from the whole chat, under the ticket
// property Enquiry Category and its sub-categories (src/lib/chat/topics.ts):
//   - the categories of the period: how many the AI solved alone, how many went to a person, whether a person then
//     wrote in the chat; a category opens to its sub-categories and its chats, where anyone with Website can put a
//     chat under another category (it sticks, and goes to the ticket);
//   - the HubSpot side: what writing into the tickets changes (old -> new), what it leaves alone because a person set it
//     in HubSpot, and the switch - off means preview, nothing is written (SARCLA: "preview first, then switch on").

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
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
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import { full } from "@/app/charts/format";
import { Chip, Choice } from "@/app/connectors/parts";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, HsLink, INK, KpiTile, MUTED, Notice, TRACK, bodyCell, headCell } from "@/app/uc/report/ui";
import { CATEGORIES, categoryLabel, categoryOf, type HsState, type TopicsRun } from "@/lib/chat/shape";
import { HandlerChip, Loaded, pct, pill, post, when } from "./shared";

type CategoryRow = { category: string; chats: number; handed: number; agentWrote: number; byPerson: number; subs: { sub1: string; chats: number }[] };
type Summary = {
  rows: CategoryRow[]; filed: number; byPerson: number; run: TopicsRun | null; from: string; isAdmin: boolean;
  hubspot: { mode: "preview" | "write"; switch: { on: boolean; by: string | null; at: string | null }; counts: Record<string, number> };
};
type FilingChat = {
  key: string; ticket_id: string | null; started_at: string | null; last_at: string | null; language: string | null; handed: boolean; team: string | null;
  agent_wrote: boolean | null; category: string; sub1: string | null; sub2: string | null; summary: string; service_category: string | null; by: string;
  hs_state: HsState | null; hs_before: Record<string, string | null> | null; hs_note: string | null;
};

export default function TopicsTab({ days, label }: { days: number; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [n, setN] = useState(0);
  return (
    <Loaded<Summary> key={`topics-${days}-${n}`} url={`/api/website/chat?part=topics&days=${days}`} what="the filing">
      {(s) => <Body s={s} days={days} label={label} open={open} setOpen={setOpen} reload={() => setN((x) => x + 1)} />}
    </Loaded>
  );
}

function Body({ s, days, label, open, setOpen, reload }: {
  s: Summary; days: number; label: string; open: string | null; setOpen: (t: string | null) => void; reload: () => void;
}) {
  const top = s.rows.find((r) => r.category !== "unreadable");
  const max = Math.max(1, ...s.rows.map((r) => r.chats));
  const c = s.hubspot.counts;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="purple" label="Chats filed" value={full(s.filed)} note={`${label} - from ${when(s.from).slice(0, 10)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CategoryOutlinedIcon />} tint="amber" label="Most asked" value={top ? top.category : "–"} note={top ? `${full(top.chats)} chats · ${pct(top.chats, s.filed)}` : "nothing filed yet"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassBottomOutlinedIcon />} tint="slate" label="Waiting to be filed" value={s.run?.waiting != null ? full(s.run.waiting) : "–"} note={s.run ? `last run ${when(s.run.at)}` : "the first run starts 6 min after a deploy"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CloudSyncOutlinedIcon />} tint={s.hubspot.mode === "write" ? "green" : "slate"} label="In HubSpot"
          value={s.hubspot.mode === "write" ? full(c.written ?? 0) : full(c["would-write"] ?? 0)}
          note={s.hubspot.mode === "write" ? "tickets written by the hub" : "tickets that would change - preview, nothing written"} /></Grid>
      </Grid>
      <Run s={s} reload={reload} />
      <HubSpotCard s={s} reload={reload} />

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="What the chats were about"
          note="The ticket property Enquiry Category, filed by the hub after each chat from the whole conversation. Click a category for its sub-categories and chats." />
        {!s.rows.length ? (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing filed in this period yet. The hub files every 20 minutes, 120 chats at a time.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {["Enquiry Category", "Chats", "", "AI alone", "Handed to a person", "A person wrote in the chat"].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i === 0 || i === 2 ? "left" : "right" }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {s.rows.map((r) => (
                  <TableRow key={r.category} hover selected={open === r.category} onClick={() => setOpen(open === r.category ? null : r.category)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK }}>{categoryLabel(r.category)}</TableCell>
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

      {open && <CategoryChats key={`${open}-${days}`} row={s.rows.find((r) => r.category === open)!} days={days} onMoved={reload} />}
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
      {last && <Chip tint={last.failed && !last.filed ? "pink" : "slate"}>Last run {when(last.at)}: {last.filed} filed{last.failed ? ` · ${last.failed} to try again` : ""}{last.unreadable ? ` · ${last.unreadable} no longer in HubSpot` : ""}</Chip>}
      {s.isAdmin && (
        <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void run()} startIcon={busy ? <CircularProgress size={14} /> : <SyncOutlinedIcon />}>
          {busy ? "Filing…" : "File 20 now"}
        </Button>
      )}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </Box>
  );
}

/* ── the HubSpot side ───────────────────────────────────────────────────────────────────────────── */

const STATES: { key: HsState; label: string }[] = [
  { key: "would-write", label: "Would change" },
  { key: "written", label: "Written" },
  { key: "same", label: "Already right" },
  { key: "kept", label: "Kept - set by a person in HubSpot" },
  { key: "error", label: "Errors" },
];

function HubSpotCard({ s, reload }: { s: Summary; reload: () => void }) {
  const on = s.hubspot.switch.on;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<HsState>(on ? "written" : "would-write");
  const c = s.hubspot.counts;
  const flip = async (next: boolean) => {
    if (next && !confirm(`Write the filing into the chat tickets in HubSpot?\n\n${full(c["would-write"] ?? 0)} tickets change now, the rest as they are filed (every 20 minutes): Enquiry Category, its sub-categories, and the summary in the empty "add more details" box. A category a person set in HubSpot is left alone.`)) return;
    setBusy(true); setErr(null);
    const r = await post({ action: "filing-write", on: next });
    setBusy(false);
    if (r.ok) reload(); else setErr(r.error ?? "Did not work.");
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<CloudSyncOutlinedIcon />} tint={on ? "green" : "slate"} title="Into the tickets in HubSpot"
        note={on
          ? `Writing since ${when(s.hubspot.switch.at)}${s.hubspot.switch.by ? ` (${s.hubspot.switch.by})` : ""}: each filed chat's ticket gets its Enquiry Category and sub-categories, and the summary when the details box is empty.`
          : "Preview: nothing is written. This is what writing would do - switch it on when it looks right. A category a person set in HubSpot is never overwritten."}
        right={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {busy && <CircularProgress size={14} />}
            <Chip tint={on ? "green" : "slate"}>{on ? "Writing" : "Preview"}</Chip>
            <Switch checked={on} disabled={!s.isAdmin || busy} onChange={(e) => void flip(e.target.checked)} slotProps={{ input: { "aria-label": "Write the filing into HubSpot" } }} />
          </Box>
        } />
      {err && <Notice tone="bad">{err}</Notice>}
      <Choice value={state} onChange={(k) => setState(k)} options={STATES.map((x) => ({ key: x.key, label: x.label, count: c[x.key] ?? 0 }))} />
      <Changes key={`${state}-${on}`} state={state} />
    </GlassCard>
  );
}

const PER = 15;

function Changes({ state }: { state: HsState }) {
  const [page, setPage] = useState(0);
  const url = `/api/website/chat?part=hs-changes&state=${state}&offset=${page * PER}&limit=${PER}`;
  return (
    <Loaded<{ chats: FilingChat[]; total: number }> key={url} url={url} what="the tickets">
      {(r) => !r.chats.length ? <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>None.</Typography> : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {["Ticket", "In HubSpot now", "", "The filing", "What the customer wanted"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {r.chats.map((x) => {
                  const def = categoryOf(x.category);
                  const was = x.hs_before ?? {};
                  return (
                    <TableRow key={x.key}>
                      <TableCell sx={bodyCell}>{x.ticket_id ? <HsLink id={x.ticket_id} /> : "–"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>
                        {was.enquiry_category ?? "empty"}{def?.sub1 && was[def.sub1.prop] ? <Box sx={{ fontSize: "0.72rem", color: FAINT }}>{was[def.sub1.prop]}</Box> : null}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, color: FAINT, px: 0 }}>→</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 600, color: INK }}>
                        {x.category}{x.sub1 ? <Box sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 500 }}>{x.sub1}</Box> : null}
                        {x.hs_state === "kept" && <Box sx={{ fontSize: "0.72rem", color: "#2459d1", fontWeight: 500 }}>{x.hs_note}</Box>}
                        {x.hs_state === "error" && <Box sx={{ fontSize: "0.72rem", color: "#c5221f", fontWeight: 500 }}>{x.hs_note}</Box>}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: INK, minWidth: 240 }}>{x.summary}</TableCell>
                    </TableRow>
                  );
                })}
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
  );
}

/* ── one category: its sub-categories and its chats ─────────────────────────────────────────────── */

function CategoryChats({ row, days, onMoved }: { row: CategoryRow; days: number; onMoved: () => void }) {
  const [page, setPage] = useState(0);
  const url = `/api/website/chat?part=topic-chats&topic=${encodeURIComponent(row.category)}&days=${days}&offset=${page * 20}&limit=20`;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title={categoryLabel(row.category)} note="Its sub-categories, then its chats - newest first. Wrong category? Pick the right one: it sticks, and goes to the ticket." />
      {row.subs.some((x) => x.sub1) && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {row.subs.map((x) => <Chip key={x.sub1 || "none"} tint={x.sub1 ? "amber" : "slate"}>{x.sub1 || "no sub-category"} · {full(x.chats)}</Chip>)}
        </Box>
      )}
      <Loaded<{ chats: FilingChat[]; total: number }> key={url} url={url} what="the chats">
        {(r, reload) => (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>
                  {["Last message", "Language", "What the customer wanted", "Handled by", "Enquiry Category", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {r.chats.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(c.last_at ?? c.started_at)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{(c.language || "?").toUpperCase()}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK, minWidth: 260 }}>
                        {c.summary || <Box component="span" sx={{ color: FAINT }}>–</Box>}
                        {c.handed && c.agent_wrote === false && <Box component="span" sx={{ ml: 0.75 }}><Chip tint="pink">no person wrote</Chip></Box>}
                        {c.service_category && <Box sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>The chat itself said: {c.service_category}</Box>}
                      </TableCell>
                      <TableCell sx={bodyCell}><HandlerChip c={{ escalated: c.handed, routing_team: c.team, handler: null }} /></TableCell>
                      <TableCell sx={{ ...bodyCell, minWidth: 220 }}><CategoryPick c={{ key: c.key, category: c.category, sub1: c.sub1, by: c.by }} onMoved={() => { reload(); onMoved(); }} /></TableCell>
                      <TableCell sx={bodyCell}>{c.ticket_id ? <HsLink id={c.ticket_id} /> : <Box component="span" sx={{ color: FAINT }}>–</Box>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {r.total > 20 && (
              <TablePagination component="div" count={r.total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={20} rowsPerPageOptions={[20]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${full(count)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
            )}
          </>
        )}
      </Loaded>
    </GlassCard>
  );
}

/** A chat's Enquiry Category and first sub-category, as HubSpot defines them - a person's choice sticks. */
export function CategoryPick({ c, onMoved }: { c: { key: string; category: string; sub1: string | null; by: string }; onMoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const def = categoryOf(c.category);
  const save = async (category: string, sub1: string | null) => {
    setBusy(true); setErr(null);
    const r = await post({ action: "topic-set", key: c.key, category, sub1 });
    setBusy(false);
    if (r.ok) onMoved(); else setErr(r.error ?? "Did not work.");
  };
  const small = { "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.5 } };
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      <TextField select size="small" value={def ? c.category : ""} disabled={busy} onChange={(e) => void save(e.target.value, null)}
        slotProps={{ htmlInput: { "aria-label": "Enquiry Category" } }} sx={small}>
        {CATEGORIES.map((x) => <MenuItem key={x.value} value={x.value} sx={{ fontSize: "0.84rem" }}>{x.value}</MenuItem>)}
      </TextField>
      {def?.sub1 && (
        <TextField select size="small" value={c.sub1 ?? ""} disabled={busy} onChange={(e) => void save(c.category, e.target.value || null)}
          slotProps={{ htmlInput: { "aria-label": "Sub-category" }, select: { displayEmpty: true } }} sx={small}>
          <MenuItem value="" sx={{ fontSize: "0.84rem", color: FAINT }}>no sub-category</MenuItem>
          {def.sub1.options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: "0.84rem" }}>{o}</MenuItem>)}
        </TextField>
      )}
      <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>{c.by === "ai" ? "filed by the AI" : `put here by ${c.by}`}</Typography>
      {err && <Notice tone="bad">{err}</Notice>}
    </Box>
  );
}
