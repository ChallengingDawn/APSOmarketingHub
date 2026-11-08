"use client";
// A TITLE YOU CHANGE WHERE YOU READ IT (SARCLA 08.11.2026: "changing title is still hard"). Click the words (or the
// pencil that shows on hover), type, Enter or click away keeps it, Escape leaves it as it was. Nothing to find, no dialog.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { INK, MUTED } from "@/app/uc/report/ui";

export function InlineTitle({ value, onSave, canEdit, size = "0.98rem", weight = 700, maxWidth, placeholder = "Give it a title", label = "Title" }: {
  value: string; onSave: (next: string) => Promise<unknown> | void; canEdit: boolean;
  size?: string; weight?: number; maxWidth?: number | string | Record<string, number | string>; placeholder?: string; label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  const done = async (keep: boolean) => {
    setEditing(false);
    const next = draft.trim();
    if (keep && next && next !== value) await onSave(next);
    else setDraft(value);
  };

  const text = { fontSize: size, fontWeight: weight, color: INK, lineHeight: 1.3 };
  if (editing) {
    return (
      <InputBase inputRef={ref} value={draft} onChange={(e) => setDraft(e.target.value)} inputProps={{ "aria-label": label, maxLength: 200 }}
        onBlur={() => void done(true)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void done(true); } if (e.key === "Escape") { e.preventDefault(); void done(false); } }}
        sx={{ ...text, maxWidth, width: "100%", px: 0.75, py: 0.1, borderRadius: "6px", bgcolor: "#fff", boxShadow: "0 0 0 2px #2459d1", "& input": { p: 0 } }} />
    );
  }
  return (
    <Box component={canEdit ? "button" : "span"} type={canEdit ? "button" : undefined} onClick={canEdit ? () => setEditing(true) : undefined}
      title={canEdit ? "Click to rename" : undefined}
      sx={{
        all: "unset", ...text, display: "inline-flex", alignItems: "center", gap: 0.5, maxWidth, minWidth: 0, cursor: canEdit ? "text" : "default",
        px: 0.75, mx: -0.75, py: 0.1, borderRadius: "6px", transition: "background-color .12s",
        "& .pen": { opacity: 0, transition: "opacity .12s" },
        ...(canEdit ? { "&:hover": { bgcolor: "rgba(36,89,209,.07)" }, "&:hover .pen, &:focus-visible .pen": { opacity: 1 }, "&:focus-visible": { outline: "2px solid #2459d1" } } : {}),
      }}>
      <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, color: value ? INK : MUTED }}>{value || placeholder}</Box>
      {canEdit && <EditOutlinedIcon className="pen" sx={{ fontSize: "1em", color: MUTED, flexShrink: 0 }} />}
    </Box>
  );
}
