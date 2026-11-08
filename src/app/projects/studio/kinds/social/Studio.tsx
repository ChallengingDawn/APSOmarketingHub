"use client";
// The social studio - a first shape (08.11.2026); its own session builds it out.
import Typography from "@mui/material/Typography";
import { Field, Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";

export default function Studio({ api }: StudioProps) {
  const doc = (api.doc ?? {}) as { notes?: string };
  return (
    <StudioPanes
      build={<Pane title="Build"><Field label="Notes" multiline rows={8} value={doc.notes ?? ""} onChange={(v) => api.setDoc({ ...doc, notes: v })} disabled={!api.data.access.canEdit} /></Pane>}
      preview={<Pane tone="stage" title="Preview"><Typography sx={{ color: "#5d6b85", p: 2 }}>This studio is being built.</Typography></Pane>}
    />
  );
}
