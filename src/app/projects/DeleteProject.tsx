"use client";
// DELETING A PROJECT, AND THE ADMINS' WAY BACK (SARCLA 08.11.2026: "I should be able to delete projects").
//   DeleteProject    the confirm: what goes with it (its to-dos, what was made in their studios) and what stays (its HubSpot
//                    tickets - never touched - and the versions in the Content Library); the owner or an admin deletes
//   DeletedProjects  for admins, at the foot of the board: every deleted project, each brought back by a click
// The rules: lib/content/deleteRules.ts; a soft delete - lib/content/deleting.ts.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestoreIcon from "@mui/icons-material/Restore";

import { GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";

const RED = "#c5221f";
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "8px", whiteSpace: "nowrap" as const };

/** May this person delete it - the owner or an admin (the server asks deleteRules.ts again). */
export const canDelete = (p: { owner: string | null }, me: string, admin: boolean) => admin || (!!p.owner && p.owner === me);

type Preview = { ok: boolean; error?: string; title: string; goes: string[]; stays: string[] };

export function DeleteProject({ project, onClose, onDeleted }: { project: { id: number; title: string } | null; onClose: () => void; onDeleted: (id: number) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!project) return;
    setPreview(null); setErr(null); setBusy(false);
    fetch(`/api/content/projects/${project.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-preview" }) })
      .then((r) => r.json()).then((j: Preview) => (j.ok ? setPreview(j) : setErr(j.error ?? "It cannot be deleted.")))
      .catch(() => setErr("The hub did not answer."));
  }, [project]);
  const go = async () => {
    if (!project) return;
    setBusy(true); setErr(null);
    const j = await fetch(`/api/content/projects/${project.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    if (!j.ok) { setBusy(false); setErr(j.error ?? "It was not deleted."); return; }
    onDeleted(project.id);
  };
  const list = (items: string[], tone: string) => (
    <Box component="ul" sx={{ m: 0, pl: 2.25, display: "grid", gap: 0.4 }}>
      {items.map((t) => <Typography component="li" key={t} sx={{ fontSize: "0.88rem", color: tone, lineHeight: 1.45 }}>{t}</Typography>)}
    </Box>
  );
  return (
    <Dialog open={!!project} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Delete “{project?.title}”?</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5 }}>
        {!preview && !err && <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.86rem" }}><CircularProgress size={14} /> Looking at what it holds…</Box>}
        {preview && (
          <>
            <Box>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: ".05em", mb: 0.5 }}>Goes with it</Typography>
              {list(preview.goes, INK)}
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1b7a55", textTransform: "uppercase", letterSpacing: ".05em", mb: 0.5 }}>Stays</Typography>
              {list(preview.stays, INK)}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>It leaves the board, the calendar and Ideas for everyone. An admin can bring it back, whole, from “Deleted projects”.</Typography>
          </>
        )}
        {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={btn}>Keep it</Button>
        <Button variant="contained" disableElevation disabled={!preview || busy} onClick={() => void go()}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
          sx={{ ...btn, bgcolor: RED, color: "#fff", "&:hover": { bgcolor: "#a51b18" } }}>
          {busy ? "Deleting…" : "Delete the project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type Deleted = { id: number; title: string; ownerName: string | null; deletedAt: string; deletedByName: string | null; todos: number };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Admins: the deleted projects, folded, each brought back by a click. `bump` reads them again (a project just deleted). */
export function DeletedProjects({ bump, onRestored }: { bump: number; onRestored: (id: number) => void }) {
  const [rows, setRows] = useState<Deleted[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch("/api/content/projects/deleted").then((r) => r.json()).then((j) => setRows(j.ok ? j.projects : [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load, bump]);
  const restore = async (id: number) => {
    setBusy(id); setErr(null);
    const j = await fetch("/api/content/projects/deleted", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", id }) })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    setBusy(null);
    if (!j.ok) return setErr(j.error ?? "Not brought back.");
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
    onRestored(id);
  };
  if (!rows || rows.length === 0) return null;
  return (
    <GlassCard>
      <Box component="button" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <DeleteOutlineIcon sx={{ fontSize: 19, color: MUTED }} />
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>Deleted projects</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{rows.length} · admins bring one back, whole</Typography>
        <ExpandMoreIcon sx={{ ml: "auto", color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </Box>
      {open && (
        <Box sx={{ mt: 1.25, display: "grid" }}>
          {rows.map((x) => (
            <Box key={x.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderTop: `1px solid ${HAIRLINE}`, flexWrap: "wrap" }}>
              <Box sx={{ flex: "1 1 280px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK }}>{x.title}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                  {x.todos} to-do{x.todos === 1 ? "" : "s"} · owner {x.ownerName ?? "nobody"} · deleted {when(x.deletedAt)}{x.deletedByName ? ` by ${x.deletedByName}` : ""}
                </Typography>
              </Box>
              <Button size="small" variant="outlined" disabled={busy !== null} onClick={() => void restore(x.id)}
                startIcon={busy === x.id ? <CircularProgress size={13} /> : <RestoreIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, color: INK, borderColor: HAIRLINE }}>
                Bring it back
              </Button>
            </Box>
          ))}
          {err && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1 }}>{err}</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}
