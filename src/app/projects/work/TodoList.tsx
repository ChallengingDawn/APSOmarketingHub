"use client";
// A PROJECT'S TO-DOS (SARCLA 08.11.2026: "for me a piece is a to-do"; "try to change the ticket - it's not possible";
// "action plan and association should also be assisted and AI assistant as in the other model").
//
// One list. Each to-do is a piece of content of its kind - a page, a post, a newsletter, a banner, a video - or a plain
// ACTION (SARCLA 08.11.2026: "don't call it task, call it action"); each has its OWNER right on the line, who reviews it,
// a status and a date, and ONE ticket - an Action plan sub-action. "Linking to the action plan and the ticket should be
// the same": one control on the line, "Plan & ticket", opens one window - where the project sits in the plan, then the
// line's ticket. The AI proposes both; a person picks. Every change shows at once; the tickets arrive after the page.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";

import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { TicketFields, field, type TicketsAnswer } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { LANGUAGES } from "@/lib/content/languages";
import { moveError, TASK_KIND, type PieceStatus } from "@/lib/content/pieceRules";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { InlineTitle } from "./InlineTitle";
import { KINDS, KindTile, kindLabel } from "./kinds";
import { pieceStep } from "@/lib/content/nextStep";
import { Chip, PINK, PersonPick, StatusChip, dayLabel, dueSoon, postWork } from "./ui";
import type { Piece, Place, TodoTicket, Tickets, Work } from "./types";

const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export type Act = (body: Record<string, unknown>, optimistic?: (w: Work) => Work) => Promise<{ ok: boolean; error?: string; [k: string]: unknown }>;

/** The moves this person may make on a to-do now - only what the rules allow them. */
export function moves(p: Piece, w: Pick<Work, "me" | "access" | "isAdmin" | "project">): { to: PieceStatus; label: string; main?: boolean; note?: boolean }[] {
  const who = { username: w.me, canEdit: w.access.canEdit, lead: w.isAdmin || w.project.createdBy === w.me };
  const task = p.contentType === TASK_KIND;
  const all: { to: PieceStatus; label: string; main?: boolean; note?: boolean }[] =
    task
      ? p.status === "live" ? [{ to: "writing", label: "Reopen" }] : [{ to: "live", label: "Done", main: true }]
      : p.status === "todo" ? [{ to: "writing", label: "Start" }, { to: "review", label: "Ask for review", main: true }]
        : p.status === "writing" || p.status === "changes" ? [{ to: "review", label: "Ask for review", main: true }]
          : p.status === "review" ? [{ to: "approved", label: "Approve", main: true }, { to: "changes", label: "Ask for changes", note: true }]
            : p.status === "approved" ? [{ to: "live", label: "Mark live", main: true }, { to: "writing", label: "Reopen" }]
              : [{ to: "writing", label: "Reopen" }];
  // a task is done by whoever may edit; the rules' review gate is for content
  if (task) return w.access.canEdit ? all : [];
  return all.filter((m) => !moveError(p, m.to, who) || (m.to === "review" && !p.reviewer && w.access.canEdit));
}

/* ── where the project sits in the plan ─────────────────────────────────────────────────────────────────────────── */

type Hint = Place & { why: string };

export function PlaceAssist({ w, place, act, compact }: { w: Work; place: Place | null; act: Act; compact?: boolean }) {
  const [hints, setHints] = useState<Hint[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [all, setAll] = useState<Place[] | null>(null);
  const [changing, setChanging] = useState(false);
  const open = !place || changing;
  useEffect(() => {
    if (!w.isAdmin || !open || all) return;
    fetch(`/api/content/projects/${w.project.id}/work?places`).then((r) => r.json()).then((j) => j.ok && setAll(j.places)).catch(() => undefined);
  }, [w.isAdmin, w.project.id, open, all]);
  const suggest = async () => {
    setBusy(true); setErr(null);
    const r = await postWork(w.project.id, { action: "ai-place" });
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "The AI did not answer.");
    setHints(r.hints as Hint[]);
  };
  const put = async (p: Place | null) => {
    const r = await act({ action: "place", planItem: p?.id ?? null }, (x) => ({ ...x, place: p }));
    if (r.ok) { setChanging(false); setHints(null); }
  };
  return (
    <Box sx={{ p: compact ? 1.25 : 1.5, borderRadius: "14px", border: `1px solid ${place ? HAIRLINE : "#f0d6a8"}`, bgcolor: place ? "rgba(255,255,255,.7)" : "#fff8ec", display: "grid", gap: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <PlaceOutlinedIcon sx={{ fontSize: 18, color: place ? "#1b7a55" : "#a96a12" }} />
        {place ? (
          <Typography sx={{ fontSize: "0.88rem", color: INK, flex: 1, minWidth: 0 }}>
            In the action plan: {place.path ? <Box component="span" sx={{ color: MUTED }}>{place.path} › </Box> : null}<b>{place.title}</b>
            {place.dg && <Box component="span" sx={{ ml: 1 }}><Chip tint="purple">Digital Growth</Chip></Box>}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "0.88rem", color: "#7f4f0b", flex: 1, minWidth: 0 }}>
            <b>Not in the action plan yet.</b> Its to-dos become sub-actions with their ticket once it is.
          </Typography>
        )}
        {w.isAdmin && place && !changing && <Button size="small" onClick={() => setChanging(true)} sx={btn}>Change</Button>}
        {w.isAdmin && open && (
          <Button size="small" variant="outlined" onClick={suggest} disabled={busy}
            startIcon={busy ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />} sx={btn}>
            {busy ? "Reading the plan…" : "Suggest with AI"}
          </Button>
        )}
        {!w.isAdmin && !place && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>An admin places it.</Typography>}
      </Box>
      {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>{err}</Typography>}
      {open && hints && (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
          {hints.length === 0 && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No action of the plan fits plainly - pick one below.</Typography>}
          {hints.map((h, i) => (
            <Box key={h.id} sx={{ p: 1.25, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75, animation: `riseIn .35s ease ${i * 0.06}s backwards`, "@keyframes riseIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } } }}>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{h.path}</Typography>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, lineHeight: 1.3 }}>{h.title}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: "#3d4a63", lineHeight: 1.45 }}>{h.why}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {h.dg && <Chip tint="purple">Digital Growth</Chip>}
                <Button size="small" variant="contained" disableElevation onClick={() => put(h)} sx={{ ...mainBtn, ml: "auto" }}>Put it here</Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {w.isAdmin && open && all && (
        <Autocomplete size="small" options={all} value={null} groupBy={(p) => p.path} getOptionLabel={(p) => p.title}
          isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, p) => p && put(p)}
          renderOption={(props, p) => <li {...props} key={p.id}>{p.title}{p.dg && <Box component="span" sx={{ ml: 1 }}><Chip tint="purple">DG</Chip></Box>}</li>}
          renderInput={(p) => <TextField {...p} placeholder="Or pick its action yourself" sx={field} />} />
      )}
    </Box>
  );
}

/** The project's place in the plan, one quiet line over the list; "Change" opens the same window as a line's ticket. */
function PlanLine({ place, isAdmin, onOpen }: { place: Place | null; isAdmin: boolean; onOpen: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.9, borderRadius: "8px", border: `1px solid ${place ? HAIRLINE : "#f0d6a8"}`, bgcolor: place ? "rgba(255,255,255,.6)" : "#fff8ec" }}>
      <PlaceOutlinedIcon sx={{ fontSize: 17, color: place ? "#1b7a55" : "#a96a12" }} />
      <Typography sx={{ fontSize: "0.84rem", color: place ? INK : "#7f4f0b", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {place
          ? <>Action plan: {place.path ? <Box component="span" sx={{ color: MUTED }}>{place.path} › </Box> : null}<b>{place.title}</b></>
          : <><b>Not in the action plan yet</b> - its lines take their ticket once it is.</>}
      </Typography>
      {place?.dg && <Chip tint="purple">Digital Growth</Chip>}
      {isAdmin
        ? <Button size="small" onClick={onOpen} sx={btn}>{place ? "Change" : "Place it"}</Button>
        : !place ? <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>An admin places it.</Typography> : null}
    </Box>
  );
}

/* ── a to-do's plan & ticket ────────────────────────────────────────────────────────────────────────────────────── */

type Found = { id: string; subject: string; stageLabel: string; ownerName: string; url: string; why?: string };

function PlanTicketDialog({ w, open, piece, ticket, place, act, onClose, onDone }: {
  w: Work; open: boolean; piece: Piece | null; ticket: TodoTicket | undefined; place: Place | null; act: Act; onClose: () => void; onDone: () => void;
}) {
  const [tab, setTab] = useState<"suggested" | "search" | "new">("suggested");
  const [draft, setDraft] = useState<{ form: TicketsAnswer["form"]; values: Record<string, string> } | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hints, setHints] = useState<Found[] | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [describe, setDescribe] = useState("");
  const pid = w.project.id;

  const loadDraft = async (p: Piece) => {
    setDraft(null); setRefused(null);
    const j = await fetch(`/api/content/projects/${pid}/work?ticketDraft=${p.id}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setDraft({ form: j.form, values: j.values }); else setRefused(j?.error ?? "The ticket form could not be read.");
  };
  useEffect(() => {
    if (!open || !piece || ticket || !place) return;
    setTab("suggested"); setErr(null); setHints(null); setFound(null); setQ(piece.title); setDescribe("");
    void loadDraft(piece);
    setBusy("suggest");
    postWork(pid, { action: "ai-tickets", pieceId: piece.id }).then((r) => { setBusy(null); if (r.ok) setHints(r.hints as Found[]); else setErr(r.error ?? null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, piece?.id, place?.id, ticket?.id]);

  const run = async (label: string, body: Record<string, unknown>) => {
    setBusy(label); setErr(null);
    const r = await act({ ...body, pieceId: piece!.id });
    setBusy(null);
    if (!r.ok) return setErr(r.error ?? "That did not work.");
    onDone();
  };
  const search = async () => {
    setBusy("search");
    const j = await fetch(`/api/content/projects/${pid}/work?search=${encodeURIComponent(q)}&state=all`).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!j?.ok) return setErr(j?.error ?? "The search did not answer.");
    setFound(j.tickets);
  };
  const fill = async () => {
    if (!draft) return;
    setBusy("fill"); setErr(null);
    const r = await postWork(pid, { action: "ai-fill", pieceId: piece!.id, describe, values: draft.values });
    setBusy(null);
    if (!r.ok) return setErr(r.error ?? "The AI did not answer.");
    const f = r.fill as { title: string; values: Record<string, string> };
    setDraft((d) => (d ? { ...d, values: { ...d.values, ...f.values, ...(f.title ? { subject: f.title } : {}) } } : d));
  };

  const row = (t: Found) => (
    <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
      <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>{t.subject}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.stageLabel}{t.ownerName ? ` · ${t.ownerName}` : ""} · #{t.id}</Typography>
        {t.why && <Typography sx={{ fontSize: "0.8rem", color: "#3d4a63", mt: 0.3 }}>{t.why}</Typography>}
      </Box>
      <IconButton size="small" component="a" href={t.url} target="_blank" rel="noreferrer" aria-label="Open in HubSpot"><OpenInNewIcon fontSize="small" /></IconButton>
      <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={() => run("link", { action: "ticket-link", ticketId: t.id })} sx={mainBtn}>Link it</Button>
    </Box>
  );
  const step = (n: number, title: string, done: boolean) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "6px", display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 800, bgcolor: done ? "#1b7a55" : "#eef1f6", color: done ? "#fff" : MUTED }}>{done ? <CheckIcon sx={{ fontSize: 15 }} /> : n}</Box>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>{title}</Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={busy && busy !== "suggest" ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1.25 }}>
        {piece ? <><KindTile kind={piece.contentType} size={30} />Plan & ticket - “{piece.title}”</> : <>Where this project sits in the action plan</>}
      </DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        {step(1, "In the action plan", !!place)}
        <PlaceAssist w={w} place={place} act={act} compact />
        {piece && (
          <>
            {step(2, "Its ticket", !!ticket)}
            {ticket ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: "8px", border: "1px solid #bfe3d2", bgcolor: "#f1faf5" }}>
                <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: "#1b7a55" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>Ticket #{ticket.id}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{ticket.stageLabel || "In From Scroll to Sale"} · the line&apos;s owner owns its action in the plan</Typography>
                </Box>
                <Button size="small" href={ticket.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={btn}>Open in HubSpot</Button>
                {w.access.canEdit && (
                  <Button size="small" startIcon={<LinkOffIcon sx={{ fontSize: 16 }} />} disabled={!!busy} onClick={() => run("unlink", { action: "ticket-unlink", ticketId: ticket.id })} sx={{ ...btn, color: MUTED }}>Unlink</Button>
                )}
              </Box>
            ) : !place ? (
              <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Once the project has its place above, this line gets its ticket here.</Typography>
            ) : refused ? (
              <Notice tone="warn">{refused}</Notice>
            ) : (
              <>
                <SquareChoice value={tab} onChange={setTab} options={[{ key: "suggested", label: "Suggested" }, { key: "search", label: "Search the tickets" }, { key: "new", label: "New ticket" }]} />
                {err && <Notice tone="bad">{err}</Notice>}
                {tab === "suggested" && (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {busy === "suggest" && <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.88rem" }}><CircularProgress size={16} /> The AI is looking for this work in From Scroll to Sale…</Box>}
                    {hints?.length === 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>No ticket tracks this yet - make a new one.</Typography>}
                    {hints?.map(row)}
                    {hints && <Button onClick={() => setTab("new")} sx={{ ...btn, justifySelf: "start" }}>None of these - make a new ticket</Button>}
                  </Box>
                )}
                {tab === "search" && (
                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <TextField size="small" fullWidth label="Words of the ticket" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} sx={field} />
                      <Button variant="outlined" onClick={search} disabled={!!busy} sx={btn}>Search</Button>
                    </Box>
                    {found?.length === 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>No ticket matches.</Typography>}
                    {found?.map(row)}
                  </Box>
                )}
                {tab === "new" && (
                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                      <TextField size="small" fullWidth multiline minRows={2} label="Say what the ticket is for - the AI fills the form" value={describe} onChange={(e) => setDescribe(e.target.value)} sx={field} />
                      <Button variant="outlined" onClick={fill} disabled={!!busy || !draft}
                        startIcon={busy === "fill" ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, mt: 0.25 }}>Fill with AI</Button>
                    </Box>
                    {draft ? <TicketFields form={draft.form} values={draft.values} set={(k, v) => setDraft((d) => (d ? { ...d, values: { ...d.values, [k]: v } } : d))} />
                      : <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Filling the ticket from the project&apos;s action…</Typography>}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={!!busy && busy !== "suggest"} sx={btn}>Close</Button>
        {piece && place && !ticket && !refused && tab === "new" && (
          <Button variant="contained" disableElevation disabled={!!busy || !draft} onClick={() => run("create", { action: "ticket-create", values: draft!.values })} sx={mainBtn}>
            {busy === "create" ? "Making it…" : "Make the ticket"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/* ── one to-do ──────────────────────────────────────────────────────────────────────────────────────────────────── */

function TodoRow({ p, w, ticket, takes, ticketsLoading, act, onTicket, onAskChanges }: {
  p: Piece; w: Work; ticket: TodoTicket | undefined; takes: boolean | undefined; ticketsLoading: boolean; act: Act;
  onTicket: (p: Piece) => void; onAskChanges: (p: Piece) => void;
}) {
  const canEdit = w.access.canEdit;
  const task = p.contentType === TASK_KIND;
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const set = (patch: Partial<Piece>, body: Record<string, unknown>) =>
    act({ action: "piece-edit", pieceId: p.id, ...body }, (x) => ({ ...x, pieces: x.pieces.map((y) => (y.id === p.id ? { ...y, ...patch } : y)) }));
  const move = (to: PieceStatus) => act({ action: "piece-move", pieceId: p.id, to }, (x) => ({ ...x, pieces: x.pieces.map((y) => (y.id === p.id ? { ...y, status: to } : y)) }));
  const go = (m: ReturnType<typeof moves>[number]) => (m.note ? onAskChanges(p) : m.to === "review" && !p.reviewer ? void act({ action: "piece-move", pieceId: p.id, to: "review" }) : void move(m.to));
  // ONE next step on the line, by where it stands and who is looking (lib/content/nextStep.ts): "Write it" / "Review it" /
  // "Make the changes" / "Publish it" open the studio, "Ask for review" / "Done" move it here; what someone else has to do
  // is said, not offered. The other moves the rules allow - and removing it - stay in its "…" menu.
  const all = p.pending ? [] : moves(p, w);
  const step = p.pending ? null : pieceStep(p, w.me, canEdit, (u) => w.people.find((x) => x.username === u)?.name ?? u);
  const studio = `/projects/${w.project.id}/pieces/${p.id}`;
  const toStudio = !!step && step.inStudio && step.mine && !task;
  const main = step && !step.inStudio && step.mine ? all.find((m) => m.main) : undefined;
  const more = all.filter((m) => m !== main);

  return (
    <Box id={`piece-${p.id}`} sx={{
      py: 1.25, px: 1, mx: -1, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.9, borderRadius: "10px",
      opacity: p.pending ? 0.55 : 1, transition: "background-color .25s ease, opacity .25s ease",
      "&:hover": { bgcolor: "rgba(255,255,255,.6)" }, "&:target": { bgcolor: "#fff7e8" },
      animation: "rowIn .3s ease", "@keyframes rowIn": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "none" } },
    }}>
      {/* a phone: the title takes its line, the next step and the menu go under it - always in reach */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
        <KindTile kind={p.contentType} />
        <Box sx={{ flex: { xs: "1 1 calc(100% - 52px)", sm: "1 1 auto" }, minWidth: 0 }}>
          <InlineTitle value={p.title} canEdit={canEdit && !p.pending} size="0.95rem" weight={650} maxWidth="100%"
            onSave={(t) => act({ action: "piece-edit", pieceId: p.id, title: t }, (x) => ({ ...x, pieces: x.pieces.map((y) => (y.id === p.id ? { ...y, title: t } : y)) }))} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {kindLabel(p.contentType)}{p.language ? ` · ${p.language}` : ""}
            {!task && (p.versions ? ` · ${p.versions} version${p.versions === 1 ? "" : "s"}${p.lastVersionAt ? `, last ${when(p.lastVersionAt)}` : ""}` : " · no version yet")}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}><StatusChip status={task && p.status !== "live" ? (p.status === "todo" ? "todo" : "writing") : p.status} /></Box>
        {toStudio && (
          <Button size="small" variant="contained" disableElevation component={Link} href={studio} sx={{ ...mainBtn, flexShrink: 0, borderRadius: "8px" }}>{step!.label}</Button>
        )}
        {!toStudio && !main && step?.kind === "wait" && (
          <Typography sx={{ flexShrink: 1, minWidth: 0, maxWidth: 220, fontSize: "0.8rem", color: MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.label}</Typography>
        )}
        {main && (
          <Button size="small" variant="contained" disableElevation onClick={() => go(main)}
            startIcon={main.to === "live" && task ? <TaskAltOutlinedIcon sx={{ fontSize: 17 }} /> : undefined}
            sx={{ ...(main.to === "approved" || (task && main.to === "live") ? { ...btn, bgcolor: "#1b7a55", "&:hover": { bgcolor: "#155c40" } } : mainBtn), flexShrink: 0, borderRadius: "8px" }}>
            {main.label}
          </Button>
        )}
        {!task && !p.pending && !toStudio && <Button size="small" component={Link} href={studio} variant="outlined" sx={{ ...btn, flexShrink: 0, borderRadius: "8px" }}>Open</Button>}
        {!p.pending && (more.length > 0 || canEdit) && (
          <>
            <Tooltip title="More"><IconButton size="small" aria-label={`More for ${p.title}`} onClick={(e) => setMenu(e.currentTarget)} sx={{ flexShrink: 0 }}><MoreHorizIcon fontSize="small" /></IconButton></Tooltip>
            <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "10px", minWidth: 200 } } }}>
              {more.map((m) => <MenuItem key={m.to} onClick={() => { setMenu(null); go(m); }} sx={{ fontSize: "0.88rem" }}>{m.label}</MenuItem>)}
              {more.length > 0 && canEdit && <Divider />}
              {canEdit && (
                <MenuItem sx={{ fontSize: "0.88rem", color: "#c5221f" }}
                  onClick={() => { setMenu(null); void act({ action: "piece-remove", pieceId: p.id }, (x) => ({ ...x, pieces: x.pieces.filter((y) => y.id !== p.id) })); }}>
                  <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />{task ? "Remove the line" : "Remove the line (its versions stay)"}
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pl: { md: "46px" } }}>
        {canEdit ? (
          <>
            <PersonPick label="Owner" value={p.writer} people={w.people} width={160} disabled={p.pending} onChange={(u) => set({ writer: u }, { writer: u })} />
            {!task && <PersonPick label="Reviewer" value={p.reviewer} people={w.people} width={160} disabled={p.pending} onChange={(u) => set({ reviewer: u }, { reviewer: u })} />}
            <TextField size="small" type="date" label="Due" value={p.dueDate ?? ""} slotProps={{ inputLabel: { shrink: true } }} disabled={p.pending}
              sx={{ ...field, width: 148, "& input": { color: dueSoon(p.dueDate) && p.status !== "live" ? "#c5221f" : INK } }}
              onChange={(e) => set({ dueDate: e.target.value || null }, { dueDate: e.target.value || null })} />
          </>
        ) : (
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
            Owner <b style={{ color: INK }}>{p.writer ? w.people.find((x) => x.username === p.writer)?.name ?? p.writer : "nobody yet"}</b>
            {!task && <>{" · "}Reviewer <b style={{ color: INK }}>{p.reviewer ? w.people.find((x) => x.username === p.reviewer)?.name ?? p.reviewer : "nobody yet"}</b></>}
            {p.dueDate && <>{" · "}Due <b style={{ color: INK }}>{dayLabel(p.dueDate)}</b></>}
          </Typography>
        )}
        {/* plan & ticket - one control (SARCLA 08.11.2026: "linking to the action plan and the ticket should be the same") */}
        {ticketsLoading ? <Skeleton variant="rounded" width={150} height={32} sx={{ borderRadius: "6px" }} />
          : (
            <Tooltip title={ticket ? `Ticket #${ticket.id} in From Scroll to Sale${w.place ? ` - under "${w.place.title}"` : ""}` : !w.place ? "Place the project in the action plan, then this line takes its ticket" : takes ? "Link this line's ticket, or make one - the AI suggests" : "Under this action only a Digital Growth person's line takes a ticket"}>
              <span>
                <Button size="small" variant="outlined" disabled={p.pending || (!canEdit && !ticket)} onClick={() => onTicket(p)}
                  startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 17 }} />}
                  sx={{ ...btn, borderRadius: "6px", borderStyle: ticket ? "solid" : "dashed", ...(ticket ? { color: "#1b7a55", borderColor: "#bfe3d2", bgcolor: "#f1faf5" } : { color: MUTED, borderColor: HAIRLINE }) }}>
                  {ticket ? `#${ticket.id} · ${ticket.stageLabel || "ticket"}` : "Plan & ticket"}
                </Button>
              </span>
            </Tooltip>
          )}
      </Box>
    </Box>
  );
}

/* ── the list ───────────────────────────────────────────────────────────────────────────────────────────────────── */

function AddTodo({ w, act }: { w: Work; act: Act }) {
  const [kind, setKind] = useState(TASK_KIND);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("DE");
  const [who, setWho] = useState<string | null>(null);
  const [due, setDue] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  const k = KINDS.find((x) => x.key === kind) ?? KINDS[0];
  const add = async () => {
    if (kind === TASK_KIND && !title.trim()) return ref.current?.focus();
    const temp: Piece = {
      id: -Date.now(), projectId: w.project.id, contentType: kind, language: k.language ? lang : null, title: title.trim() || `${k.label}${k.language ? ` · ${lang}` : ""}`,
      writer: who, reviewer: null, status: "todo", dueDate: due || null, versions: 0, lastVersionAt: null, lastVersionBy: null, taskId: null, pending: true,
    };
    setTitle(""); setDue("");
    ref.current?.focus();
    await act({ action: "piece-add", contentType: kind, title: title.trim(), language: k.language ? lang : null, writer: who, dueDate: due || null },
      (x) => ({ ...x, pieces: [...x.pieces, temp] }));
  };
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 1.5, p: 1.25, borderRadius: "14px", bgcolor: "rgba(255,255,255,.7)", border: `1px dashed ${HAIRLINE}` }}>
      <TextField select size="small" label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ ...field, width: 190 }}>
        {KINDS.map((x) => <MenuItem key={x.key} value={x.key}><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><KindTile kind={x.key} size={22} />{x.label}</Box></MenuItem>)}
      </TextField>
      <TextField inputRef={ref} size="small" label={kind === TASK_KIND ? "The action - what is to be done" : "Name (optional)"} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void add(); }} sx={{ ...field, flex: "1 1 220px" }} />
      {k.language && (
        <TextField select size="small" label="Language" value={lang} onChange={(e) => setLang(e.target.value)} sx={{ ...field, width: 130 }}>
          {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
        </TextField>
      )}
      <PersonPick label="Owner" value={who} onChange={setWho} people={w.people} width={170} />
      <TextField size="small" type="date" label="Due" value={due} onChange={(e) => setDue(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, width: 150 }} />
      <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={add} sx={mainBtn}>Add</Button>
    </Box>
  );
}

export default function TodoList({ w, t, act, onTicketChanged }: { w: Work; t: Tickets | null; act: Act; onTicketChanged: () => void }) {
  const [ticketFor, setTicketFor] = useState<Piece | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [asking, setAsking] = useState<Piece | null>(null);
  const [note, setNote] = useState("");
  const open = w.pieces.filter((p) => p.status !== "live").length;
  const place = w.place ?? t?.place ?? null;
  return (
    <GlassCard>
      <CardTitle icon={<TaskAltOutlinedIcon />} tint="pink" title="To-dos"
        note={`${open} open · each line is a piece of content or an action, with its owner and its ticket`} />
      <PlanLine place={place} isAdmin={w.isAdmin} onOpen={() => setPlanOpen(true)} />
      {t?.error && <Box sx={{ mt: 1.5 }}><Notice tone="warn">HubSpot did not answer for the tickets: {t.error}</Notice></Box>}
      <Box sx={{ mt: 1.5 }}>
        {w.pieces.length === 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED, py: 1 }}>No to-do yet. Add the pieces this project puts out - a page, a post, the newsletter - and the actions around them.</Typography>}
        {w.pieces.map((p) => (
          <TodoRow key={p.id} p={p} w={w} ticket={t?.tickets[p.id]} takes={t?.takes[p.id]} ticketsLoading={!t && !p.pending}
            act={act} onTicket={setTicketFor} onAskChanges={(x) => { setNote(""); setAsking(x); }} />
        ))}
      </Box>
      {w.access.canEdit && <AddTodo w={w} act={act} />}
      <PlanTicketDialog w={w} open={!!ticketFor || planOpen} piece={ticketFor} ticket={ticketFor ? t?.tickets[ticketFor.id] : undefined} place={place} act={act}
        onClose={() => { setTicketFor(null); setPlanOpen(false); }} onDone={() => { setTicketFor(null); setPlanOpen(false); onTicketChanged(); }} />
      <Dialog open={!!asking} onClose={() => setAsking(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>What should change in {asking?.title}?</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField autoFocus fullWidth multiline minRows={4} value={note} onChange={(e) => setNote(e.target.value)} sx={field}
            placeholder="The writer gets this in a mail, and it stays in the conversation." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAsking(null)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={!note.trim()} sx={mainBtn}
            onClick={async () => {
              const p = asking!;
              setAsking(null);
              await act({ action: "piece-move", pieceId: p.id, to: "changes", note: note.trim() }, (x) => ({ ...x, pieces: x.pieces.map((y) => (y.id === p.id ? { ...y, status: "changes" } : y)) }));
            }}>Send it back</Button>
        </DialogActions>
      </Dialog>
    </GlassCard>
  );
}
