"use client";

/**
 * GETTING A DRAFT OUT OF YOUR OWN BROWSER.
 *
 * The studio generated a draft and that was the end of it: a second opinion
 * meant pasting into Teams, a second language meant starting again, and
 * tomorrow morning it was gone. This is the one control that was missing —
 * the draft joins a project, where other people can read it, argue with it in
 * writing, and put their own version beside it.
 *
 * It attaches the existing draft rather than saving a copy. Create Studio has
 * already written the row; two rows with the same text and different ids is
 * how a library fills with things nobody can tell apart.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

type Project = { id: number; title: string; variantCount?: number };

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

export default function SaveToProject({
  draftId, defaultLabel, projectId, projectTitle, onSaved, onDark = false,
}: {
  /** The content row the studio already wrote. Null while nothing is drafted. */
  draftId: number | null;
  defaultLabel: string;
  /** Set when the studio was opened from a project: save goes straight back. */
  projectId?: number;
  projectTitle?: string;
  /** Called after a successful save so the versions strip can catch up. */
  onSaved?: () => void;
  /**
   * Rendered on the editor's dark chrome. A button keeps the colours it would
   * have on a white page, so on dark navy the label — and worse, the disabled
   * label — comes out dark grey on dark navy and cannot be read at all.
   */
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [label, setLabel] = useState(defaultLabel);
  const [newTitle, setNewTitle] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/content/projects?scope=editable")
      .then((r) => r.json())
      .then((j) => setProjects(j.ok ? j.projects : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => { if (open) { load(); setLabel(defaultLabel); setDone(null); } }, [open, load, defaultLabel]);

  const attach = async (projectId: number) => {
    if (draftId === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/content/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", contentId: draftId, label: label.trim() || null }),
      });
      const j = await res.json();
      setDone(j.ok ? "Saved into the project." : (j.error ?? "That did not save."));
      if (j.ok) onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const createAndAttach = async () => {
    if (!newTitle.trim() || draftId === null) return;
    setBusy(true);
    try {
      const made = await fetch("/api/content/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      }).then((r) => r.json());
      if (!made.ok) { setDone(made.error ?? "The project could not be created."); return; }
      setNewTitle("");
      await attach(made.project.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Opened from a project, saving is one press: the question "which
          project" has an answer already and asking it again is a form in the
          way. The dialog is still there for saving somewhere else. */}
      <Button
        onClick={() => (projectId ? attach(projectId) : setOpen(true))}
        disabled={draftId === null || busy}
        startIcon={<FolderOpenIcon />}
        sx={{
          textTransform: "none", fontWeight: 700, flexShrink: 0,
          ...(onDark
            ? {
                color: "#e8edf6",
                "&:hover": { bgcolor: "rgba(255,255,255,.08)" },
                "&.Mui-disabled": { color: "rgba(232,237,246,.42)" },
              }
            : {}),
        }}
      >
        {projectId ? (done ? "Saved" : `Save to ${projectTitle ?? "project"}`) : "Save to project"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: "18px" } } }}>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>Save to a project</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5, mb: 2 }}>
            Variations live together so people can compare them and say what they think.
          </Typography>

          <TextField
            size="small" fullWidth label="Call this version something"
            helperText="Readable at a glance beside the others — “Shorter hero”, not “Variant 4”."
            value={label} onChange={(e) => setLabel(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          {done && (
            <Typography sx={{ fontSize: "0.85rem", color: INK, p: 1.25, borderRadius: "10px", bgcolor: "#eef1f5", mb: 2 }}>
              {done}
            </Typography>
          )}

          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.08em", mb: 1 }}>
            EXISTING
          </Typography>
          {projects?.length === 0 && (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 2 }}>No projects yet.</Typography>
          )}
          {projects?.map((p) => (
            <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderTop: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ flex: 1, fontSize: "0.88rem", color: INK }}>{p.title}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{p.variantCount ?? 0}</Typography>
              <Button size="small" disabled={busy} onClick={() => attach(p.id)}
                sx={{ textTransform: "none", fontWeight: 600 }}>
                Save here
              </Button>
            </Box>
          ))}

          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.08em", mt: 2.5, mb: 1 }}>
            OR START ONE
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" fullWidth placeholder="What are we working on?"
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Button disabled={busy || !newTitle.trim()} onClick={createAndAttach}
              variant="contained" disableElevation
              sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}>
              Create
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
