"use client";
// A TO-DO'S STUDIO - THE FRAME EVERY KIND SHARES (SARCLA 08.11.2026: "each type of content should be different";
// "the canvas and the options need a rework ... come with a high-end technology product").
//
// The whole window (no hub panel). The bar says what this is and where it stands, and carries what the team does with it:
// its status moves (ask for review, approve, ask for changes, mark live), who does it, its date, the versions and
// "saved". Under it, the kind's own studio (studio/registry.tsx) - built from studio/parts.tsx.
// The AI at work shows here for every kind (SARCLA 08.11.2026: "an AI animation as soon as it starts working"): from the
// click, a light runs along the bar's lower edge and "AI is writing…" / "Making the picture…" stands beside "Saved".
// (A slow action that is not the AI - reading the shop's pages, a send - is in api.working too, for its studio to show.)
// Content v7 (SARCLA 10.11.2026): "Changes made here" is the bar's history icon (a timeline, with its count; a click shows
// each change with its Undo) for every studio that keeps one, and the bar's Download gives what the kind gives as files
// (./frame.tsx, registry.tsx DOWNLOADS). Who does it opens prefilled: the owner who makes it, the reviewer Claudio.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import BookmarkBorderOutlinedIcon from "@mui/icons-material/BookmarkBorderOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import Popover from "@mui/material/Popover";

import { INK, MUTED, Notice, HAIRLINE } from "@/app/uc/report/ui";
import { STUDIO_LABEL } from "@/lib/content/studio/kinds";
import { versionName, type VersionRow } from "@/lib/content/studio/versionNames";
import type { PieceStatus } from "@/lib/content/pieceRules";
import { KindTile, kindLabel } from "../work/kinds";
import { moves } from "../work/TodoList";
import { Faces, PersonPick, StatusChip, dayLabel } from "../work/ui";
import { ReviewerPick } from "../work/ReviewerPick";
import { InlineTitle } from "../work/InlineTitle";
import { AiLine, AiWorking, PINK, STUDIO_BAR, btn, field, mainBtn } from "./parts";
import { DOWNLOADS, STUDIOS } from "./registry";
import { DownloadButton, FrameProvider, TimelineButton, useFrameStore } from "./frame";
import { missingPeople } from "@/lib/content/people";
import { lookApi, useStudio, type StudioApi } from "./useStudio";

function SaveBadge({ api }: { api: StudioApi }) {
  const s = api.save;
  return (
    <Tooltip title={s === "error" ? api.saveError ?? "Not saved" : s === "saved" ? "Every change is saved" : "Saving your changes"}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.8rem", fontWeight: 600, color: s === "error" ? "#c5221f" : s === "saved" ? "#1b7a55" : MUTED, minWidth: 74 }}>
        {s === "saved" ? <CheckCircleOutlineIcon sx={{ fontSize: 17 }} /> : s === "error" ? <ErrorOutlineIcon sx={{ fontSize: 17 }} /> : <CircularProgress size={13} thickness={6} sx={{ color: MUTED }} />}
        {s === "saved" ? "Saved" : s === "error" ? "Not saved" : "Saving…"}
      </Box>
    </Tooltip>
  );
}

type Look = { v: VersionRow; doc: unknown };

/**
 * VERSIONS (SARCLA 09.11.2026: "Versions is not working correctly as it should"). Each says what it is and when ("Kept
 * by Claudio · 10:12", "Before the AI wrote the page" - lib/content/studio/versionNames.ts). A click LOOKS at it: the
 * studio shows it read-only, and the bar says "Bring it back" / "Close" - nothing is brought back by a slip of the mouse.
 */
function Versions({ api, onLook, opening }: { api: StudioApi; onLook: (v: VersionRow) => void; opening: number | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const d = api.data;
  const v = d.versions;
  const nameOf = (u: string) => d.people.find((p) => p.username === u)?.name ?? u;
  const keep = async (name?: string) => {
    setBusy("Keeping it…");
    try { await api.saveVersion(name); } finally { setBusy(null); }
  };
  return (
    <>
      <Button size="small" disabled={!!busy || opening !== null} startIcon={busy || opening !== null ? <CircularProgress size={14} thickness={6} color="inherit" /> : <BookmarkBorderOutlinedIcon sx={{ fontSize: 18 }} />} onClick={(e) => setAnchor(e.currentTarget)} sx={{ ...btn, color: INK }}>
        {busy ?? (opening !== null ? "Opening it…" : `Versions${v.length ? ` · ${v.length}` : ""}`)}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 360, borderRadius: "12px", maxHeight: "70vh" } } }}>
        <MenuItem disabled={!d.access.canEdit} onClick={() => { setAnchor(null); setLabel(""); setNaming(true); }} sx={{ fontWeight: 600, gap: 1 }}>
          <BookmarkAddOutlinedIcon sx={{ fontSize: 18 }} />Keep this as a version…
        </MenuItem>
        {v.length > 0 && <Divider />}
        {v.length > 0 && <Typography sx={{ px: 2, pt: 0.5, pb: 0.75, fontSize: "0.72rem", color: MUTED }}>Click one to look at it - then bring it back, or close it.</Typography>}
        {v.length === 0 && <MenuItem disabled sx={{ fontSize: "0.85rem" }}>No version kept yet</MenuItem>}
        {v.map((x) => {
          const n = versionName(x, { nameOf, me: d.me });
          return (
            <MenuItem key={x.id} onClick={() => { setAnchor(null); onLook(x); }} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, whiteSpace: "normal", py: 1 }}>
              {n.auto ? <AutoAwesomeOutlinedIcon sx={{ fontSize: 17, color: MUTED, mt: 0.2 }} /> : <BookmarkBorderOutlinedIcon sx={{ fontSize: 17, color: INK, mt: 0.2 }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, lineHeight: 1.35 }}>{n.title}</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{n.sub}</Typography>
              </Box>
              <Typography component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: MUTED, mt: 0.2, flexShrink: 0 }}>Look</Typography>
            </MenuItem>
          );
        })}
      </Menu>
      <Dialog open={naming} onClose={() => setNaming(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Keep this as a version</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField autoFocus fullWidth size="small" label="Its name (optional)" placeholder="Shorter subject" value={label} onChange={(e) => setLabel(e.target.value)} sx={field}
            onKeyDown={async (e) => { if (e.key === "Enter") { setNaming(false); await keep(label.trim() || undefined); } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNaming(false)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation onClick={async () => { setNaming(false); await keep(label.trim() || undefined); }} sx={mainBtn}>Keep it</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** The bar while a version is looked at: what it is, and the two ways out. */
function LookBar({ api, look, busy, onBringBack, onClose }: { api: StudioApi; look: Look; busy: boolean; onBringBack: () => void; onClose: () => void }) {
  const d = api.data;
  const n = versionName(look.v, { nameOf: (u) => d.people.find((p) => p.username === u)?.name ?? u, me: d.me });
  // an AI answer still coming would be laid over the version brought back - it waits for the AI
  const aiAtWork = !!api.working && api.working.kind !== "work";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <VisibilityOutlinedIcon sx={{ fontSize: 19, color: PINK, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: PINK, lineHeight: 1.2 }}>Looking at a version · read-only</Typography>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 }}>{n.title} <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}>· {n.sub}</Box></Typography>
      </Box>
      <Button size="small" variant="outlined" onClick={onClose} disabled={busy} sx={{ ...btn, color: INK, borderColor: HAIRLINE }}>Close</Button>
      <Tooltip title={!d.access.canEdit ? "Bringing a version back is for the project's editors" : aiAtWork ? "The AI is still writing - bring it back once it is done" : "The to-do becomes this version - what is there now is kept in Versions first"}>
        <span>
          <Button size="small" variant="contained" disableElevation onClick={onBringBack} disabled={busy || !d.access.canEdit || aiAtWork}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <RestoreIcon sx={{ fontSize: 18 }} />} sx={mainBtn}>
            {busy ? "Bringing it back…" : "Bring it back"}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}

/** Its day on the content calendar, set here (SARCLA 08.11.2026: "you should be able to place it on the content calendar"). */
function OnCalendar({ api }: { api: StudioApi }) {
  const p = api.data.piece;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = async (day: string | null) => {
    setErr(null);
    const r = await api.edit({ dueDate: day });
    if (!r.ok) setErr(r.error ?? "Not moved.");
    else setAnchor(null);
  };
  return (
    <>
      <Tooltip title={p.dueDate ? "Its day on the content calendar - change it" : "Put it on the content calendar"}>
        <Button size="small" onClick={(e) => setAnchor(e.currentTarget)} startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{ ...btn, color: p.dueDate ? INK : MUTED, border: `1px ${p.dueDate ? "solid" : "dashed"} ${HAIRLINE}`, borderRadius: "6px", px: 1.25 }}>
          {p.dueDate ? dayLabel(p.dueDate) : "On the calendar"}
        </Button>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, borderRadius: "10px", width: 280 } } }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em", mb: 1 }}>On the content calendar</Typography>
        <TextField type="date" size="small" fullWidth value={p.dueDate ?? ""} disabled={!api.data.access.canEdit}
          onChange={(e) => void set(e.target.value || null)} sx={field} slotProps={{ inputLabel: { shrink: true } }} label="Its day" />
        {err && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f", mt: 1 }}>{err}</Typography>}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
          {p.dueDate && api.data.access.canEdit ? <Button size="small" onClick={() => void set(null)} sx={{ ...btn, color: MUTED }}>Take it off</Button> : <span />}
          <Button size="small" component={Link} href={`/projects/calendar${p.dueDate ? `?day=${p.dueDate}` : ""}`} sx={btn}>Open the calendar</Button>
        </Box>
      </Popover>
    </>
  );
}

/** Who does it and who checks it, changed here (SARCLA 08.11.2026: "the owner directly") - a click on the faces. Content
 * v7 (SARCLA 10.11.2026: "this should be already prefilled"): a to-do that came without them gets them as it opens - the
 * owner who makes it, the reviewer Claudio (lib/content/people.ts) - so the panel always opens filled; both change here. */
function People({ api, onError }: { api: StudioApi; onError: (e: string | null) => void }) {
  const d = api.data;
  const p = d.piece;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // once per to-do, by an editor, only what is missing - what someone picked (or cleared) later is never touched again
  const filled = useRef<number | null>(null);
  useEffect(() => {
    if (filled.current === p.id || !d.access.canEdit || api.looking) return;
    filled.current = p.id;
    const fill = missingPeople({ kind: p.contentType, writer: p.writer, reviewer: p.reviewer, maker: d.project?.createdBy ?? null, me: d.me, people: d.people.map((x) => x.username), defaultReviewer: d.defaultReviewer ?? null });
    if (fill) void api.edit(fill).then((r) => { if (!r.ok) onError(r.error ?? "Who does it could not be filled in."); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);
  const names = Object.fromEntries(d.people.map((x) => [x.username, x.name]));
  const people = [p.writer, p.reviewer].filter((x): x is string => !!x);
  const set = async (f: { writer?: string | null; reviewer?: string | null }) => {
    onError(null);
    const r = await api.edit(f);
    if (!r.ok) onError(r.error ?? "Not changed.");
  };
  const who = (u: string | null) => (u ? names[u] ?? u : "nobody yet");
  return (
    <>
      <Tooltip title={`Owner: ${who(p.writer)} · Reviewer: ${who(p.reviewer)}`}>
        <Button size="small" aria-label="Owner and reviewer" onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ ...btn, minWidth: 0, px: people.length ? 0.5 : 1.25, color: people.length ? INK : MUTED, border: people.length ? "1px solid transparent" : `1px dashed ${HAIRLINE}`, borderRadius: "6px" }}>
          {people.length ? <Faces people={people} names={names} size={26} /> : "Owner · reviewer"}
        </Button>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, borderRadius: "10px", width: 290, display: "grid", gap: 1.5 } } }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>Who does it</Typography>
        <PersonPick label="Owner" value={p.writer} onChange={(u) => void set({ writer: u })} people={d.people} disabled={!d.access.canEdit} width={258} />
        <PersonPick label="Reviewer" value={p.reviewer} onChange={(u) => void set({ reviewer: u })} people={d.people} disabled={!d.access.canEdit} width={258} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Each gets a mail when it is theirs: the owner now, the reviewer when you ask for review.</Typography>
      </Popover>
    </>
  );
}


function Bar({ api, look, lookBusy, opening, onLook, onBringBack, onCloseLook }: {
  api: StudioApi; look: Look | null; lookBusy: boolean; opening: number | null;
  onLook: (v: VersionRow) => void; onBringBack: () => void; onCloseLook: () => void;
}) {
  const d = api.data;
  const p = d.piece;
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // the AI writing, or a picture being made - not the quiet reads and saves a studio does on its own
  const ai = api.working && api.working.kind !== "work" ? api.working : null;
  const w = { me: d.me, isAdmin: d.isAdmin, access: d.access, project: { id: p.projectId, title: d.project?.title ?? "", brief: null, createdBy: d.project?.createdBy ?? null, contentType: null, dueDate: d.project?.dueDate ?? null } };
  const go = async (to: PieceStatus, n?: string, reviewer?: string) => {
    setBusy(to); setErr(null);
    const r = await api.move(to, n, reviewer);
    setBusy(null);
    if (!r.ok) setErr(r.error ?? "That did not work.");
  };
  return (
    <Box component="header" sx={{
      position: "sticky", top: 0, zIndex: 20, height: STUDIO_BAR, boxSizing: "border-box", px: 1.5, display: "flex", alignItems: "center", gap: 1.25,
      bgcolor: look ? "rgba(253,242,247,.95)" : "rgba(255,255,255,.88)", backdropFilter: "blur(16px) saturate(140%)",
      borderBottom: `1px solid ${look ? "rgba(194,44,110,.35)" : HAIRLINE}`,
    }}>
      <Tooltip title={`Back to ${d.project?.title ?? "the project"}`}>
        <Button component={Link} href={`/projects/${p.projectId}#piece-${p.id}`} sx={{ minWidth: 0, p: 1, borderRadius: "10px", color: INK }} aria-label="Back to the project"><ArrowBackIcon /></Button>
      </Tooltip>
      <KindTile kind={p.contentType} size={34} />
      <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {d.project?.title} · {p.contentType ? kindLabel(p.contentType) : STUDIO_LABEL[d.kind]}{p.language ? ` · ${p.language}` : ""}
        </Typography>
        <InlineTitle value={p.title} canEdit={d.access.canEdit} maxWidth={{ xs: 160, md: 380 }}
          onSave={async (title) => { const r = await api.edit({ title }); if (!r.ok) setErr(r.error ?? "Not renamed."); }} />
      </Box>
      <StatusChip status={p.status} />
      <OnCalendar api={api} />
      <Box sx={{ display: { xs: "none", md: "block" } }}><People api={api} onError={setErr} /></Box>
      <Box sx={{ flex: 1 }} />
      {err && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", maxWidth: 260 }}>{err}</Typography>}
      {look && <LookBar api={api} look={look} busy={lookBusy} onBringBack={onBringBack} onClose={onCloseLook} />}
      {!look && ai && <AiWorking variant="inline" label={ai.label} />}
      {!look && <SaveBadge api={api} />}
      {!look && <TimelineButton />}
      {!look && <DownloadButton api={api} kind={d.kind} load={DOWNLOADS[d.kind]} />}
      {!look && <Versions api={api} onLook={onLook} opening={opening} />}
      {!look && moves(p, w).map((m) => (
        <Button key={m.to} size="small" variant={m.main ? "contained" : "outlined"} disableElevation disabled={!!busy}
          onClick={() => (m.to === "review" && !p.reviewer ? setPicking(true) : m.note ? (setNote(""), setAsking(true)) : go(m.to))}
          sx={m.main ? (m.to === "approved" ? { ...btn, bgcolor: "#1b7a55", color: "#fff", "&:hover": { bgcolor: "#155c40" } } : mainBtn) : btn}>
          {busy === m.to ? <CircularProgress size={14} color="inherit" /> : m.label}
        </Button>
      ))}
      <Box sx={{ position: "absolute", left: 0, right: 0, bottom: -1 }}><AiLine on={!!ai} /></Box>
      {/* "Ask for review" with nobody to ask: the default reviewer picked (SARCLA 09.11.2026), a click picks another */}
      <ReviewerPick open={picking} people={d.people} writer={p.writer} defaultReviewer={d.defaultReviewer ?? null}
        onClose={() => setPicking(false)} onPick={(u) => { setPicking(false); void go("review", undefined, u); }} />
      <Dialog open={asking} onClose={() => setAsking(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>What should change?</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField autoFocus fullWidth multiline minRows={4} value={note} onChange={(e) => setNote(e.target.value)} sx={field} placeholder="The writer gets this in a mail, and it stays in the conversation." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAsking(false)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={!note.trim()} onClick={async () => { setAsking(false); await go("changes", note.trim()); }} sx={mainBtn}>Send it back</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function PieceStudio({ pieceId }: { pieceId: number }) {
  const { api, error } = useStudio(pieceId);
  // what the kind's studio hands to the bar: its "Changes made here" (./frame.tsx)
  const frame = useFrameStore();
  // a version looked at, read-only (SARCLA 09.11.2026: Versions "not working correctly")
  const [look, setLook] = useState<Look | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [lookBusy, setLookBusy] = useState(false);
  const [lookErr, setLookErr] = useState<string | null>(null);
  const openLook = async (v: VersionRow) => {
    setOpening(v.id); setLookErr(null);
    const r = await fetch(`/api/content/pieces/${pieceId}?version=${v.id}`).then((x) => x.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    setOpening(null);
    if (r.ok) setLook({ v, doc: r.doc }); else setLookErr(r.error ?? "That version could not be opened.");
  };
  // what is there now is kept first (QA 09.11.2026), then the version becomes the to-do; the studio opens again on it
  const bringBack = async () => {
    if (!api || !look) return;
    setLookBusy(true); setLookErr(null);
    const name = versionName(look.v, { nameOf: (u) => api.data.people.find((p) => p.username === u)?.name ?? u, me: api.data.me }).title;
    try {
      await api.saveVersion(`Before bringing back “${name}”`.slice(0, 120));
      if (await api.restore(look.v.id)) setLook(null);
      else setLookErr("It was not brought back - try again.");
    } finally { setLookBusy(false); }
  };
  if (error) return <Box sx={{ p: 3 }}><Notice tone="bad">{error}</Notice></Box>;
  if (!api) {
    return (
      <Box sx={{ height: "100vh", display: "grid", placeItems: "center", color: MUTED }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}><CircularProgress size={18} /> Opening the studio…</Box>
      </Box>
    );
  }
  const Studio = STUDIOS[api.data.kind];
  return (
    <FrameProvider value={frame}>
    <Box sx={{ minHeight: "100vh" }}>
      <Bar api={api} look={look} lookBusy={lookBusy} opening={opening} onLook={(v) => void openLook(v)} onBringBack={() => void bringBack()} onCloseLook={() => setLook(null)} />
      {!api.data.access.canEdit && (
        <Box sx={{ px: 1.5, pt: 1.5 }}><Notice tone="warn">You can read this and comment on the project; changing it is for its editors.</Notice></Box>
      )}
      {lookErr && <Box sx={{ px: 1.5, pt: 1.5 }}><Notice tone="bad">{lookErr}</Notice></Box>}
      {/* the kind's studio opens again on a version brought back (epoch) or looked at - a studio's own state never keeps the old one */}
      <Studio key={look ? `look-${look.v.id}` : `live-${api.epoch ?? 0}`} api={look ? lookApi(api, look.v, look.doc) : api} />
    </Box>
    </FrameProvider>
  );
}
