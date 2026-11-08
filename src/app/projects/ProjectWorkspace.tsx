"use client";
// ONE CONTENT PROJECT AS THE TEAM'S WORK (SARCLA 07.11.2026: "this should look like a collaborative project").
//
//   the head      what it is, where it stands (its pieces decide), who is on it, its place in the action plan
//   the brief     one shared page everybody writes against
//   the pieces    what it puts out - each with a writer, a reviewer, a status and a date; the reviewer approves or asks
//                 for changes, and the people concerned get a mail
//   the to-dos    Action plan sub-actions, each with its Scroll to Sale ticket made here or linked
//   conversation  comments and everything that happened, in one stream; "@Name" tags someone and mails them
// The studio and every version stay one click away ("Versions" on a piece).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import CheckIcon from "@mui/icons-material/Check";

import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { TicketFields, field, type TicketsAnswer } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { CONTENT_TYPES } from "@/lib/content/contentTypes";
import { LANGUAGES } from "@/lib/content/languages";
import { STAGES, STAGE_LABEL, STATUS_LABEL, moveError, type PieceStatus, type Stage } from "@/lib/content/pieceRules";
import ShareDialog from "./ShareDialog";
import { Face, Faces, PINK, PersonPick, STAGE_DOT, StageChip, StatusChip, dayLabel, dueSoon, postWork, type PersonOpt } from "./work/ui";

type Piece = {
  id: number; contentType: string | null; language: string | null; title: string; writer: string | null; reviewer: string | null;
  status: PieceStatus; dueDate: string | null; versions: number; lastVersionAt: string | null; lastVersionBy: string | null;
};
type Brief = { goal: string; audience: string; message: string; keywords: string[]; channels: string[] };
type EventRow = { id: number; pieceId: number | null; actor: string; kind: string; detail: Record<string, unknown>; createdAt: string };
type CommentRow = { id: number; author: string; body: string; createdAt: string };
type Todo = {
  id: number; title: string; done: boolean; stageLabel: string; assignee: string | null; assigneeName: string; due: string | null;
  ticket: { id: string; subject: string; stageLabel: string; open: boolean; url: string } | null; takesTicket: boolean;
};
type Place = { id: number; title: string; path: string; dg: boolean };
type Member = { username: string; name: string; role: string };
type Work = {
  ok: boolean; error?: string; me: string; isAdmin: boolean; access: { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };
  project: { id: number; title: string; brief: string | null; createdBy: string | null; contentType: string | null; dueDate: string | null };
  comments: CommentRow[]; pieces: Piece[]; events: EventRow[]; brief: Brief; source: string | null; stage: Stage;
  members: Member[]; todos: Todo[]; place: Place | null; ticketsError: string | null; people: PersonOpt[];
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } };

/** The line an event leaves in the stream. */
function eventLine(e: EventRow, name: (u: string) => string): string | null {
  const d = e.detail as Record<string, string | null | undefined>;
  switch (e.kind) {
    case "status": return `moved ${d.piece ?? "a piece"} to ${STATUS_LABEL[(d.to ?? "todo") as PieceStatus] ?? d.to}`;
    case "assign": return `asked ${name(d.to ?? "")} to ${d.role === "reviewer" ? "review" : "write"} ${d.piece ?? "a piece"}`;
    case "piece": return `added ${d.piece ?? "a piece"}`;
    case "piece-removed": return `removed ${d.piece ?? "a piece"}`;
    case "stage": return `moved the project to ${STAGE_LABEL[(d.to ?? "planned") as Stage] ?? d.to}`;
    case "brief": return "changed the brief";
    case "place": return d.planItem ? "placed the project in the action plan" : "took the project out of the action plan";
    case "todo": return `added the to-do “${d.todo}”${d.to ? ` for ${name(d.to)}` : ""}`;
    case "todo-done": return `ticked off “${d.todo}”`;
    case "todo-open": return `opened “${d.todo}” again`;
    default: return null;
  }
}

/** A comment with its tags in bold: "@Anna Rossi" for any person the hub knows. */
function Tagged({ text, people }: { text: string; people: PersonOpt[] }) {
  const names = people.map((p) => p.name).filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(@(?:${names.map(esc).join("|")}))`, "gi"));
  return <>{parts.map((x, i) => (i % 2 ? <b key={i} style={{ color: "#a3245c" }}>{x}</b> : x))}</>;
}

/** The text box that tags: "@" and a few letters offer the people; picking one writes "@Their Name". */
function Composer({ people, onSend }: { people: PersonOpt[]; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const at = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(text);
  const offer = at ? people.filter((p) => `${p.name} ${p.username}`.toLowerCase().includes(at[2].toLowerCase())).slice(0, 6) : [];
  const pick = (p: PersonOpt) => {
    if (!at) return;
    setText(`${text.slice(0, text.length - at[2].length - 1)}@${p.name} `);
    ref.current?.focus();
  };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    if (await onSend(text.trim())) setText("");
    setBusy(false);
  };
  return (
    <Box sx={{ position: "relative" }}>
      <TextField inputRef={ref} fullWidth multiline minRows={3} placeholder="Write to the team. Type @ to tag someone - they get a mail."
        value={text} onChange={(e) => setText(e.target.value)} sx={field}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(); }} />
      {offer.length > 0 && (
        <Box role="listbox" aria-label="People to tag" sx={{ position: "absolute", zIndex: 5, left: 8, right: 8, top: "100%", mt: 0.5, bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 12px 28px rgba(31,45,78,.14)", overflow: "hidden" }}>
          {offer.map((p) => (
            <Box key={p.username} component="button" type="button" role="option" aria-selected={false} onClick={() => pick(p)} sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", px: 1.25, py: 0.9, border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", textAlign: "left", "&:hover": { bgcolor: "#f3f5f9" } }}>
              <Face username={p.username} name={p.name} size={24} /><Typography sx={{ fontSize: "0.88rem" }}>{p.name}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>Ctrl+Enter sends</Typography>
        <Button variant="contained" disableElevation disabled={busy || !text.trim()} onClick={send} sx={{ ...mainBtn, ml: "auto" }}>Send</Button>
      </Box>
    </Box>
  );
}

function BriefCard({ w, onSaved, setErr }: { w: Work; onSaved: () => void; setErr: (e: string | null) => void }) {
  const [edit, setEdit] = useState(false);
  const [b, setB] = useState<Brief>(w.brief);
  useEffect(() => setB(w.brief), [w.brief]);
  const empty = !w.brief.goal && !w.brief.audience && !w.brief.message && !w.brief.keywords.length && !w.brief.channels.length;
  const save = async () => {
    const r = await postWork(w.project.id, { action: "brief", brief: b });
    if (!r.ok) return setErr(r.error ?? "The brief did not save.");
    setEdit(false); onSaved();
  };
  const row = (label: string, value: React.ReactNode) => (
    <Box><Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>{label}</Typography>
      <Box sx={{ fontSize: "0.9rem", color: INK, mt: 0.4, lineHeight: 1.5 }}>{value || <Box component="span" sx={{ color: MUTED }}>-</Box>}</Box></Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<DescriptionOutlinedIcon />} tint="pink" title="Brief" note="What everybody writes against"
        right={w.access.canEdit && !edit ? <Button size="small" onClick={() => setEdit(true)} sx={btn}>{empty ? "Write the brief" : "Edit the brief"}</Button> : undefined} />
      {edit ? (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <TextField size="small" label="Goal" multiline minRows={2} value={b.goal} onChange={(e) => setB({ ...b, goal: e.target.value })} sx={field} />
          <TextField size="small" label="Who it is for" multiline minRows={2} value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })} sx={field} />
          <TextField size="small" label="Key message" multiline minRows={2} value={b.message} onChange={(e) => setB({ ...b, message: e.target.value })} sx={field} />
          <Autocomplete multiple freeSolo size="small" options={[]} value={b.keywords} onChange={(_, v) => setB({ ...b, keywords: v as string[] })}
            renderInput={(p) => <TextField {...p} label="Keywords" placeholder="Type one, Enter" sx={field} />} />
          <Autocomplete multiple freeSolo size="small" options={["Website", "LinkedIn", "Google Ads", "Newsletter", "Blog", "Video"]} value={b.channels}
            onChange={(_, v) => setB({ ...b, channels: v as string[] })} renderInput={(p) => <TextField {...p} label="Channels" sx={field} />} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", justifyContent: "flex-end" }}>
            <Button onClick={() => { setB(w.brief); setEdit(false); }} sx={btn}>Cancel</Button>
            <Button variant="contained" disableElevation onClick={save} sx={mainBtn}>Save the brief</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {row("Goal", w.brief.goal)}
          {row("Who it is for", w.brief.audience)}
          {row("Key message", w.brief.message)}
          {row("Keywords", w.brief.keywords.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{w.brief.keywords.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box> : null)}
          {row("Channels", w.brief.channels.join(" · "))}
          {w.project.brief && row("Notes", <Box sx={{ whiteSpace: "pre-wrap" }}>{w.project.brief}</Box>)}
        </Box>
      )}
    </GlassCard>
  );
}

/** The buttons a piece offers this person now - only the moves the rules allow them. */
function moves(p: Piece, w: Work): { to: PieceStatus; label: string; main?: boolean; note?: boolean }[] {
  const who = { username: w.me, canEdit: w.access.canEdit, lead: w.isAdmin || w.project.createdBy === w.me };
  const all: { to: PieceStatus; label: string; main?: boolean; note?: boolean }[] =
    p.status === "todo" ? [{ to: "writing", label: "Start writing" }, { to: "review", label: "Ask for review", main: true }]
      : p.status === "writing" || p.status === "changes" ? [{ to: "review", label: "Ask for review", main: true }]
        : p.status === "review" ? [{ to: "approved", label: "Approve", main: true }, { to: "changes", label: "Ask for changes", note: true }]
          : p.status === "approved" ? [{ to: "live", label: "Mark live", main: true }, { to: "writing", label: "Reopen" }]
            : [{ to: "writing", label: "Reopen" }];
  return all.filter((m) => !moveError(p, m.to, who) || (m.to === "review" && !p.reviewer && w.access.canEdit));
}

function PiecesCard({ w, reload, setErr }: { w: Work; reload: () => void; setErr: (e: string | null) => void }) {
  const [adding, setAdding] = useState(false);
  const [np, setNp] = useState({ contentType: w.project.contentType ?? "landing-page", language: "DE", writer: null as string | null, reviewer: null as string | null, dueDate: "" });
  const [asking, setAsking] = useState<{ piece: Piece; to: PieceStatus } | null>(null);
  const [note, setNote] = useState("");
  const canEdit = w.access.canEdit;
  const send = async (body: Record<string, unknown>) => {
    const r = await postWork(w.project.id, body);
    if (!r.ok) setErr(r.error ?? "That did not save."); else { setErr(null); reload(); }
    return r.ok;
  };
  const move = (p: Piece, to: PieceStatus, withNote?: string) => send({ action: "piece-move", pieceId: p.id, to, note: withNote ?? null });

  return (
    <GlassCard>
      <CardTitle icon={<LayersOutlinedIcon />} tint="blue" title="Pieces" note="What this project puts out, and who does each one"
        right={canEdit ? <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding((a) => !a)} sx={btn}>Add a piece</Button> : undefined} />
      {adding && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center", mb: 2, p: 1.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.7)", border: `1px solid ${HAIRLINE}` }}>
          <TextField select size="small" label="Piece" value={np.contentType} onChange={(e) => setNp({ ...np, contentType: e.target.value })} sx={{ ...field, minWidth: 200 }}>
            {CONTENT_TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Language" value={np.language} onChange={(e) => setNp({ ...np, language: e.target.value })} sx={{ ...field, minWidth: 130 }}>
            {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
          </TextField>
          <PersonPick label="Writes" value={np.writer} onChange={(u) => setNp({ ...np, writer: u })} people={w.people} />
          <PersonPick label="Reviews" value={np.reviewer} onChange={(u) => setNp({ ...np, reviewer: u })} people={w.people} />
          <TextField size="small" type="date" label="Due" value={np.dueDate} onChange={(e) => setNp({ ...np, dueDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, width: 160 }} />
          <Button variant="contained" disableElevation sx={mainBtn}
            onClick={async () => { if (await send({ action: "piece-add", ...np, dueDate: np.dueDate || null })) setAdding(false); }}>Add</Button>
        </Box>
      )}
      {w.pieces.length === 0 ? (
        <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>No piece yet. Add what this project puts out - a landing page, a post, the ads - and who writes and reviews each.</Typography>
      ) : (
        <Box sx={{ display: "grid" }}>
          {w.pieces.map((p) => (
            // one row per piece, wrapping on a narrow screen - never a table that scrolls its names out of sight
            <Box key={p.id} id={`piece-${p.id}`} sx={{ py: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.1, "&:target": { bgcolor: "#fff7e8", borderRadius: "12px", px: 1 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 650 }}>{p.title}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                    {p.versions ? `${p.versions} version${p.versions === 1 ? "" : "s"}${p.lastVersionAt ? ` · last ${when(p.lastVersionAt)}` : ""}` : "No version yet"}
                  </Typography>
                </Box>
                <StatusChip status={p.status} />
                {canEdit ? (
                  <TextField size="small" type="date" label="Due" value={p.dueDate ?? ""} slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ ...field, width: 160, "& input": { color: dueSoon(p.dueDate) && p.status !== "live" ? "#c5221f" : INK } }}
                    onChange={(e) => send({ action: "piece-edit", pieceId: p.id, dueDate: e.target.value || null })} />
                ) : p.dueDate ? <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Due {dayLabel(p.dueDate)}</Typography> : null}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {canEdit ? (
                  <>
                    <PersonPick label="Writes" value={p.writer} onChange={(u) => send({ action: "piece-edit", pieceId: p.id, writer: u })} people={w.people} />
                    <PersonPick label="Reviews" value={p.reviewer} onChange={(u) => send({ action: "piece-edit", pieceId: p.id, reviewer: u })} people={w.people} />
                  </>
                ) : (
                  <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
                    Writes <b style={{ color: INK }}>{p.writer ? w.people.find((x) => x.username === p.writer)?.name ?? p.writer : "nobody yet"}</b>
                    {" · "}Reviews <b style={{ color: INK }}>{p.reviewer ? w.people.find((x) => x.username === p.reviewer)?.name ?? p.reviewer : "nobody yet"}</b>
                  </Typography>
                )}
                <Box sx={{ ml: "auto", display: "inline-flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {moves(p, w).map((m) => (
                    <Button key={m.to} size="small" variant={m.main ? "contained" : "outlined"} disableElevation sx={m.main ? (m.to === "approved" ? { ...btn, bgcolor: "#1b7a55", "&:hover": { bgcolor: "#155c40" } } : mainBtn) : btn}
                      onClick={() => (m.note ? (setNote(""), setAsking({ piece: p, to: m.to })) : m.to === "review" && !p.reviewer ? setErr("Give it a reviewer first.") : move(p, m.to))}>{m.label}</Button>
                  ))}
                  <Button size="small" component={Link} href={`/projects/${w.project.id}/versions?piece=${p.id}`} sx={btn}>Versions</Button>
                  {canEdit && <Button size="small" component={Link} href={`/create?project=${w.project.id}&piece=${p.id}${p.contentType ? `&type=${p.contentType}` : ""}`} sx={btn}>Write it</Button>}
                  {canEdit && (
                    <Tooltip title="Remove the piece (its versions stay in the project)">
                      <IconButton size="small" aria-label={`Remove ${p.title}`} onClick={() => send({ action: "piece-remove", pieceId: p.id })}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Dialog open={!!asking} onClose={() => setAsking(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>What should change in {asking?.piece.title}?</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField autoFocus fullWidth multiline minRows={4} value={note} onChange={(e) => setNote(e.target.value)} sx={field}
            placeholder="The writer gets this in a mail, and it stays in the conversation." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAsking(null)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={!note.trim()} sx={mainBtn}
            onClick={async () => { if (asking && (await move(asking.piece, asking.to, note.trim()))) setAsking(null); }}>Send it back</Button>
        </DialogActions>
      </Dialog>
    </GlassCard>
  );
}

type Found = { id: string; subject: string; stageLabel: string; ownerName: string; url: string };

/** A to-do's ticket: a new one, filled from the action as the plan fills it, or an existing one of From Scroll to Sale. */
function TicketDialog({ projectId, todo, onClose, onDone }: { projectId: number; todo: Todo | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"new" | "link">("new");
  const [draft, setDraft] = useState<{ form: TicketsAnswer["form"]; values: Record<string, string> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  useEffect(() => {
    if (!todo) return;
    setMode("new"); setDraft(null); setErr(null); setFound(null); setQ(todo.title);
    fetch(`/api/content/projects/${projectId}/work?ticketDraft=${todo.id}`).then((r) => r.json())
      .then((j) => (j.ok ? setDraft({ form: j.form, values: j.values }) : setErr(j.error ?? "The ticket form could not be read.")))
      .catch((e) => setErr(String(e)));
  }, [todo, projectId]);
  const search = async () => {
    setBusy(true);
    const j = await fetch(`/api/content/projects/${projectId}/work?search=${encodeURIComponent(q)}&state=all`).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.ok) return setErr(j?.error ?? "The search did not answer.");
    setFound(j.tickets);
  };
  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    const r = await postWork(projectId, { ...body, todoId: todo!.id });
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "That did not work.");
    onDone();
  };
  return (
    <Dialog open={!!todo} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>A ticket for “{todo?.title}”</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant={mode === "new" ? "contained" : "outlined"} disableElevation onClick={() => setMode("new")} sx={mode === "new" ? mainBtn : btn}>New ticket</Button>
          <Button variant={mode === "link" ? "contained" : "outlined"} disableElevation onClick={() => setMode("link")} sx={mode === "link" ? mainBtn : btn}>Link an existing one</Button>
        </Box>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>The ticket is the to-do's in From Scroll to Sale, under the project's action in the plan; the hub keeps the two in step.</Typography>
        {err && <Notice tone="bad">{err}</Notice>}
        {mode === "new" && draft && (
          <TicketFields form={draft.form} values={draft.values} set={(k, v) => setDraft((d) => (d ? { ...d, values: { ...d.values, [k]: v } } : d))} />
        )}
        {mode === "new" && !draft && !err && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Filling the ticket from the action…</Typography>}
        {mode === "link" && (
          <Box sx={{ display: "grid", gap: 1.25 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" fullWidth label="Search the tickets" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} sx={field} />
              <Button variant="outlined" onClick={search} disabled={busy} sx={btn}>Search</Button>
            </Box>
            {found?.length === 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>No ticket matches.</Typography>}
            {found?.map((t) => (
              <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>{t.subject}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.stageLabel}{t.ownerName ? ` · ${t.ownerName}` : ""} · #{t.id}</Typography>
                </Box>
                <Button size="small" variant="contained" disableElevation disabled={busy} onClick={() => act({ action: "ticket-link", ticketId: t.id })} sx={mainBtn}>Link it</Button>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={btn}>Close</Button>
        {mode === "new" && <Button variant="contained" disableElevation disabled={busy || !draft} onClick={() => act({ action: "ticket-create", values: draft!.values })} sx={mainBtn}>{busy ? "Making it…" : "Make the ticket"}</Button>}
      </DialogActions>
    </Dialog>
  );
}

function TodosCard({ w, reload, setErr }: { w: Work; reload: () => void; setErr: (e: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [who, setWho] = useState<string | null>(null);
  const [due, setDue] = useState("");
  const [ticketFor, setTicketFor] = useState<Todo | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const canEdit = w.access.canEdit;
  const send = async (body: Record<string, unknown>) => {
    const r = await postWork(w.project.id, body);
    if (!r.ok) setErr(r.error ?? "That did not save."); else { setErr(null); reload(); }
    return r.ok;
  };
  useEffect(() => {
    if (!w.isAdmin || places) return;
    fetch(`/api/content/projects/${w.project.id}/work?places`).then((r) => r.json()).then((j) => j.ok && setPlaces(j.places)).catch(() => undefined);
  }, [w.isAdmin, w.project.id, places]);
  const open = w.todos.filter((t) => !t.done).length;

  return (
    <GlassCard>
      <CardTitle icon={<ChecklistOutlinedIcon />} tint="green" title="To-dos" note={`${open} open · each one a sub-action of the action plan, with its ticket`} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 1.5, p: 1.25, borderRadius: "12px", bgcolor: "rgba(255,255,255,.65)", border: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED }}>In the action plan</Typography>
        {w.isAdmin && places ? (
          <Autocomplete size="small" sx={{ flex: "1 1 360px" }} options={places} value={places.find((p) => p.id === w.place?.id) ?? null}
            groupBy={(p) => p.path} getOptionLabel={(p) => p.title} isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, p) => <li {...props} key={p.id}>{p.title}{p.dg && <Box component="span" sx={{ ml: 1 }}><Chip tint="purple">Digital Growth</Chip></Box>}</li>}
            onChange={(_, p) => send({ action: "place", planItem: p?.id ?? null })}
            renderInput={(p) => <TextField {...p} placeholder="Pick its action - its to-dos become that action's sub-actions" sx={field} />} />
        ) : w.place ? (
          <Typography sx={{ fontSize: "0.88rem", color: INK }}>{w.place.path ? `${w.place.path} › ` : ""}<b>{w.place.title}</b>{w.place.dg ? " · Digital Growth" : ""}</Typography>
        ) : (
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Not placed yet - an admin picks its action; until then its to-dos take no ticket.</Typography>
        )}
      </Box>
      {w.ticketsError && <Notice tone="warn">HubSpot did not answer for the tickets: {w.ticketsError}</Notice>}
      {w.todos.map((t) => (
        <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, minHeight: 48, borderBottom: `1px solid ${HAIRLINE}`, flexWrap: "wrap" }}>
          <Checkbox checked={t.done} disabled={!canEdit} onChange={(e) => send({ action: "todo-done", todoId: t.id, done: e.target.checked })}
            slotProps={{ input: { "aria-label": `${t.done ? "Open again" : "Tick off"}: ${t.title}` } }} sx={{ p: 0.5, "&.Mui-checked": { color: "#1b7a55" } }} />
          <Typography sx={{ flex: "1 1 180px", minWidth: 0, fontSize: "0.9rem", color: t.done ? MUTED : INK, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</Typography>
          {canEdit ? (
            <PersonPick label="Who" value={t.assignee} onChange={(u) => send({ action: "todo-edit", todoId: t.id, assignee: u })} people={w.people} width={140} />
          ) : t.assigneeName ? <Typography sx={{ fontSize: "0.85rem" }}>{t.assigneeName}</Typography> : null}
          {canEdit ? (
            <TextField size="small" type="date" value={t.due ?? ""} aria-label={`Due date of ${t.title}`} onChange={(e) => send({ action: "todo-edit", todoId: t.id, due: e.target.value || null })}
              sx={{ ...field, width: 140, "& input": { color: !t.done && dueSoon(t.due) ? "#c5221f" : INK } }} />
          ) : <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{dayLabel(t.due)}</Typography>}
          {t.ticket ? (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <Button size="small" href={t.ticket.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} sx={btn}>
                {t.ticket.stageLabel ? `Ticket · ${t.ticket.stageLabel}` : `Ticket #${t.ticket.id}`}
              </Button>
              {canEdit && <Tooltip title="Unlink the ticket (it stays in HubSpot)"><IconButton size="small" aria-label="Unlink the ticket" onClick={() => send({ action: "ticket-unlink", todoId: t.id, ticketId: t.ticket!.id })}><LinkOffIcon fontSize="small" /></IconButton></Tooltip>}
            </Box>
          ) : t.takesTicket && canEdit ? (
            <Button size="small" variant="outlined" onClick={() => setTicketFor(t)} sx={btn}>Ticket</Button>
          ) : (
            <Tooltip title={w.place ? "Only a to-do under an action led by Digital Growth, or a Digital Growth person's, takes a ticket" : "No ticket until the project has its place in the plan"}>
              <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>No ticket</Typography>
            </Tooltip>
          )}
          {canEdit && <IconButton size="small" aria-label={`Remove ${t.title}`} onClick={() => send({ action: "todo-remove", todoId: t.id })}><DeleteOutlineIcon fontSize="small" /></IconButton>}
        </Box>
      ))}
      {canEdit && (
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap", mt: 1.5 }}>
          <TextField size="small" label="New to-do" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ ...field, flex: "1 1 260px" }} />
          <PersonPick label="Who" value={who} onChange={setWho} people={w.people} />
          <TextField size="small" type="date" label="Due" value={due} onChange={(e) => setDue(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, width: 160 }} />
          <Button variant="contained" disableElevation disabled={!title.trim()} startIcon={<AddIcon />} sx={mainBtn}
            onClick={async () => { if (await send({ action: "todo-add", title, assignee: who, due: due || null })) { setTitle(""); setDue(""); } }}>Add</Button>
        </Box>
      )}
      <TicketDialog projectId={w.project.id} todo={ticketFor} onClose={() => setTicketFor(null)} onDone={() => { setTicketFor(null); reload(); }} />
    </GlassCard>
  );
}

export default function ProjectWorkspace({ id }: { id: number }) {
  const [w, setW] = useState<Work | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const load = useCallback(() => {
    fetch(`/api/content/projects/${id}/work`).then((r) => r.json()).then((j: Work) => (j.ok ? setW(j) : setErr(j.error ?? "The project could not be read."))).catch((e) => setErr(String(e)));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of w?.people ?? []) m[p.username] = p.name;
    for (const p of w?.members ?? []) m[p.username] = p.name;
    return m;
  }, [w]);
  const name = useCallback((u: string) => names[u] ?? u, [names]);

  const feed = useMemo(() => {
    if (!w) return [];
    const items: { at: string; who: string; comment?: string; line?: string; dot?: string }[] = [];
    for (const c of w.comments) items.push({ at: c.createdAt, who: c.author, comment: c.body });
    for (const e of w.events) {
      if (e.kind === "mention") continue;
      const line = eventLine(e, name);
      if (line) items.push({ at: e.createdAt, who: e.actor, line, dot: e.kind === "status" ? "#c97a10" : e.kind === "stage" ? STAGE_DOT[(e.detail.to as Stage) ?? "planned"] : "#5d6b85" });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [w, name]);

  if (err && !w) return <Notice tone="bad">{err}</Notice>;
  if (!w) return <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>Reading the project…</Typography>;

  const team = [...new Set([w.project.createdBy, ...w.members.map((m) => m.username), ...w.pieces.flatMap((p) => [p.writer, p.reviewer])].filter((x): x is string => !!x))];
  const approved = w.pieces.filter((p) => p.status === "approved" || p.status === "live").length;
  const at = STAGES.indexOf(w.stage);
  const sendComment = async (text: string) => {
    const r = await postWork(w.project.id, { action: "comment", body: text });
    if (!r.ok) { setErr(r.error ?? "The comment did not save."); return false; }
    setErr(null); load(); return true;
  };

  return (
    <Box sx={{ display: "grid", gap: 2.25 }}>
      <Box component={Link} href="/projects" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: MUTED, fontSize: "0.86rem", fontWeight: 600, textDecoration: "none", justifySelf: "start" }}>
        <ArrowBackIcon sx={{ fontSize: 17 }} />All projects
      </Box>

      <GlassCard>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
          <Box sx={{ flex: "1 1 420px", minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              <StageChip stage={w.stage} />
              {[...new Set(w.pieces.map((p) => p.language).filter(Boolean))].map((l) => <Chip key={l} tint="slate">{l}</Chip>)}
            </Box>
            <Typography component="h1" sx={{ mt: 1, fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.5rem", md: "1.85rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK }}>{w.project.title}</Typography>
            {w.brief.goal && <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>{w.brief.goal}</Typography>}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
            <Faces people={team} names={names} owner={w.project.createdBy} size={30} max={7} />
            {w.access.canShare && <Button variant="outlined" startIcon={<PersonAddAlt1Icon />} onClick={() => setSharing(true)} sx={btn}>Invite</Button>}
            <Button variant="outlined" component={Link} href={`/projects/${w.project.id}/versions`} sx={btn}>Versions &amp; studio</Button>
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1, md: 1.5 }, mt: 2, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          {STAGES.map((s, i) => (
            <Box key={s} sx={{ display: "contents" }}>
              {i > 0 && <Box aria-hidden sx={{ flex: "0 1 44px", height: 2, borderRadius: 2, bgcolor: i <= at ? "#1b7a55" : "#dfe4ec" }} />}
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: "0.84rem", fontWeight: 600, color: i < at ? "#17684a" : i === at ? STAGE_DOT[s] : MUTED, whiteSpace: "nowrap" }}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", boxSizing: "border-box",
                  ...(i < at ? { bgcolor: "#1b7a55", color: "#fff" } : i === at ? { border: `2px solid ${STAGE_DOT[s]}` } : { border: "2px solid #c9d0db" }) }}>
                  {i < at ? <CheckIcon sx={{ fontSize: 14 }} /> : i === at ? <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STAGE_DOT[s] }} /> : null}
                </Box>
                {STAGE_LABEL[s]}
              </Box>
            </Box>
          ))}
          <Typography sx={{ ml: "auto", fontSize: "0.82rem", color: MUTED }}>
            Owner <b style={{ color: INK }}>{name(w.project.createdBy ?? "")}</b>
            {w.project.dueDate ? <> · goes live <b style={{ color: INK }}>{dayLabel(w.project.dueDate)}</b></> : null}
            {w.pieces.length ? ` · ${approved} of ${w.pieces.length} pieces approved` : ""}
          </Typography>
        </Box>
      </GlassCard>

      {err && <Notice tone="bad">{err}</Notice>}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.25, alignItems: "flex-start" }}>
        <Box sx={{ flex: "999 1 620px", minWidth: 0, display: "grid", gap: 2.25 }}>
          <BriefCard w={w} onSaved={load} setErr={setErr} />
          <PiecesCard w={w} reload={load} setErr={setErr} />
          <TodosCard w={w} reload={load} setErr={setErr} />
        </Box>
        <Box sx={{ flex: "1 1 340px", minWidth: 0 }}>
          <GlassCard>
            <CardTitle icon={<ForumOutlinedIcon />} tint="purple" title="Conversation" note="Comments, and everything that happened" />
            {w.access.canComment && <Composer people={w.people} onSend={sendComment} />}
            <Box sx={{ mt: 1.5 }}>
              {feed.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing yet.</Typography>}
              {feed.map((f, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1.25, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
                  <Face username={f.who} name={name(f.who)} size={30} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{name(f.who)}</Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{when(f.at)}</Typography>
                    </Box>
                    {f.comment ? (
                      <Typography sx={{ mt: 0.4, fontSize: "0.9rem", lineHeight: 1.5, p: "8px 11px", borderRadius: "4px 12px 12px 12px", bgcolor: "#f3f5f9", whiteSpace: "pre-wrap", wordBreak: "break-word" }}><Tagged text={f.comment} people={w.people} /></Typography>
                    ) : (
                      <Box sx={{ mt: 0.3, display: "flex", gap: 0.75, alignItems: "center", fontSize: "0.84rem", color: "#3d4a63" }}>
                        <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: f.dot, flexShrink: 0 }} />{f.line}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </GlassCard>
        </Box>
      </Box>

      <ShareDialog projectId={w.project.id} title={w.project.title} open={sharing} onClose={() => setSharing(false)} onChanged={load} me={w.me} />
    </Box>
  );
}
