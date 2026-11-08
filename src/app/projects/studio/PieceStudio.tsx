"use client";
// A TO-DO'S STUDIO - THE FRAME EVERY KIND SHARES (SARCLA 08.11.2026: "each type of content should be different";
// "the canvas and the options need a rework ... come with a high-end technology product").
//
// The whole window (no hub panel). The bar says what this is and where it stands, and carries what the team does with it:
// its status moves (ask for review, approve, ask for changes, mark live), who does it, its date, the versions and
// "saved". Under it, the kind's own studio (studio/registry.tsx) - built from studio/parts.tsx.

import { useState } from "react";
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
import HistoryIcon from "@mui/icons-material/History";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import Popover from "@mui/material/Popover";

import { INK, MUTED, Notice, HAIRLINE } from "@/app/uc/report/ui";
import { STUDIO_LABEL } from "@/lib/content/studio/kinds";
import type { PieceStatus } from "@/lib/content/pieceRules";
import { KindTile } from "../work/kinds";
import { moves } from "../work/TodoList";
import { Face, Faces, PersonPick, StatusChip, dayLabel } from "../work/ui";
import { InlineTitle } from "../work/InlineTitle";
import { STUDIO_BAR, btn, field, mainBtn } from "./parts";
import { STUDIOS } from "./registry";
import { useStudio, type StudioApi } from "./useStudio";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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

function Versions({ api }: { api: StudioApi }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const v = api.data.versions;
  return (
    <>
      <Button size="small" startIcon={<HistoryIcon sx={{ fontSize: 18 }} />} onClick={(e) => setAnchor(e.currentTarget)} sx={{ ...btn, color: INK }}>
        Versions{v.length ? ` · ${v.length}` : ""}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 320, borderRadius: "14px" } } }}>
        <MenuItem disabled={!api.data.access.canEdit} onClick={() => { setAnchor(null); setLabel(""); setNaming(true); }} sx={{ fontWeight: 600 }}>Keep this as a version…</MenuItem>
        {v.length > 0 && <Divider />}
        {v.length === 0 && <MenuItem disabled sx={{ fontSize: "0.85rem" }}>No version kept yet</MenuItem>}
        {v.map((x) => (
          <MenuItem key={x.id} disabled={!api.data.access.canEdit} onClick={async () => { setAnchor(null); await api.restore(x.id); }} sx={{ display: "block" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{x.label || "Version"}</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{when(x.at)}{x.by ? ` · ${api.data.people.find((p) => p.username === x.by)?.name ?? x.by}` : ""} · bring it back</Typography>
          </MenuItem>
        ))}
      </Menu>
      <Dialog open={naming} onClose={() => setNaming(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Keep this as a version</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField autoFocus fullWidth size="small" label="Its name (optional)" placeholder="Shorter subject" value={label} onChange={(e) => setLabel(e.target.value)} sx={field}
            onKeyDown={async (e) => { if (e.key === "Enter") { setNaming(false); await api.saveVersion(label.trim() || undefined); } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNaming(false)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation onClick={async () => { setNaming(false); await api.saveVersion(label.trim() || undefined); }} sx={mainBtn}>Keep it</Button>
        </DialogActions>
      </Dialog>
    </>
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

/** Who does it and who checks it, changed here (SARCLA 08.11.2026: "the owner directly") - a click on the faces. */
function People({ api, onError }: { api: StudioApi; onError: (e: string | null) => void }) {
  const d = api.data;
  const p = d.piece;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
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

/** "Ask for review" with nobody to ask: the people, a click sends it (one mail to them). */
function PickReviewer({ api, open, onClose, onPick }: { api: StudioApi; open: boolean; onClose: () => void; onPick: (u: string) => void }) {
  const d = api.data;
  const others = d.people.filter((x) => x.username !== d.piece.writer);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Who reviews it?</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.5 }}>They get a mail with the link, and approve it or send it back with a note.</Typography>
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {others.map((x) => (
            <Box key={x.username} component="button" type="button" onClick={() => onPick(x.username)} sx={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.9,
              border: `1px solid ${HAIRLINE}`, borderRadius: "6px", fontSize: "0.88rem", fontWeight: 600, color: INK,
              "&:hover": { borderColor: INK, bgcolor: "rgba(15,23,42,.03)" }, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 1 },
            }}>
              <Face username={x.username} name={x.name} size={28} />{x.name}
            </Box>
          ))}
          {!others.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Nobody else has Marketing & Content in the hub yet - an admin gives it under Users.</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={btn}>Cancel</Button></DialogActions>
    </Dialog>
  );
}

function Bar({ api }: { api: StudioApi }) {
  const d = api.data;
  const p = d.piece;
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
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
      bgcolor: "rgba(255,255,255,.88)", backdropFilter: "blur(16px) saturate(140%)", borderBottom: `1px solid ${HAIRLINE}`,
    }}>
      <Tooltip title={`Back to ${d.project?.title ?? "the project"}`}>
        <Button component={Link} href={`/projects/${p.projectId}#piece-${p.id}`} sx={{ minWidth: 0, p: 1, borderRadius: "10px", color: INK }} aria-label="Back to the project"><ArrowBackIcon /></Button>
      </Tooltip>
      <KindTile kind={p.contentType} size={34} />
      <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {d.project?.title} · {STUDIO_LABEL[d.kind]}{p.language ? ` · ${p.language}` : ""}
        </Typography>
        <InlineTitle value={p.title} canEdit={d.access.canEdit} maxWidth={{ xs: 160, md: 380 }}
          onSave={async (title) => { const r = await api.edit({ title }); if (!r.ok) setErr(r.error ?? "Not renamed."); }} />
      </Box>
      <StatusChip status={p.status} />
      <OnCalendar api={api} />
      <Box sx={{ display: { xs: "none", md: "block" } }}><People api={api} onError={setErr} /></Box>
      <Box sx={{ flex: 1 }} />
      {err && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", maxWidth: 260 }}>{err}</Typography>}
      <SaveBadge api={api} />
      <Versions api={api} />
      {moves(p, w).map((m) => (
        <Button key={m.to} size="small" variant={m.main ? "contained" : "outlined"} disableElevation disabled={!!busy}
          onClick={() => (m.to === "review" && !p.reviewer ? setPicking(true) : m.note ? (setNote(""), setAsking(true)) : go(m.to))}
          sx={m.main ? (m.to === "approved" ? { ...btn, bgcolor: "#1b7a55", color: "#fff", "&:hover": { bgcolor: "#155c40" } } : mainBtn) : btn}>
          {busy === m.to ? <CircularProgress size={14} color="inherit" /> : m.label}
        </Button>
      ))}
      <PickReviewer api={api} open={picking} onClose={() => setPicking(false)} onPick={(u) => { setPicking(false); void go("review", undefined, u); }} />
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
    <Box sx={{ minHeight: "100vh" }}>
      <Bar api={api} />
      {!api.data.access.canEdit && (
        <Box sx={{ px: 1.5, pt: 1.5 }}><Notice tone="warn">You can read this and comment on the project; changing it is for its editors.</Notice></Box>
      )}
      <Studio api={api} />
    </Box>
  );
}
