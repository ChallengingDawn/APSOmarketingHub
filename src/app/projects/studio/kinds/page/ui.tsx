"use client";
// SMALL PIECES THE PAGE AND BLOG STUDIOS SHARE (08.11.2026): a section heading, a quiet hint, a code box with its copy
// button, a monospace field - in the UC design kit's tokens, with the studio's pink kept for the main actions.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { btn, field } from "../../parts";

export { Chip, Choice } from "@/app/connectors/parts";

export const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.78rem", lineHeight: 1.5 };

/** A quiet line under a field or a section. */
export const Hint = ({ children, mt = 0.5 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt, lineHeight: 1.45 }}>{children}</Typography>
);

/** A block of the build pane: its title, an optional control on the right, then its content. */
export function Block({ title, right, children, first }: { title: string; right?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <Box sx={{ pt: first ? 0 : 2.25, mt: first ? 0 : 2.25, borderTop: first ? "none" : `1px solid ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, flex: 1, letterSpacing: "-0.01em" }}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** A multi-line field in a monospace face, for HTML and CSS. */
export function CodeField({ label, value, onChange, rows = 8, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; disabled?: boolean; placeholder?: string;
}) {
  return (
    <TextField fullWidth multiline minRows={rows} maxRows={24} size="small" label={label} value={value} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} sx={{ ...field, mb: 1.25, "& textarea": mono }} />
  );
}

/** Copies a text; says "Copied" for a moment. */
export function useCopy() {
  const [done, setDone] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setDone(key);
    setTimeout(() => setDone((k) => (k === key ? null : k)), 1800);
  };
  return { done, copy };
}

/** Code to paste, with how to paste it and a copy button. */
export function PasteCard({ label, steps, code, copied, onCopy }: { label: string; steps: string[]; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, mb: 1.5, bgcolor: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>{label}</Typography>
        <Button size="small" onClick={onCopy} startIcon={copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          sx={{ ...btn, color: copied ? "#1b7a55" : INK }}>{copied ? "Copied" : "Copy"}</Button>
      </Box>
      <Box component="ol" sx={{ m: 0, mb: 1, pl: 2.25, color: MUTED, fontSize: "0.8rem", lineHeight: 1.5 }}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </Box>
      <Box component="pre" sx={{ ...mono, m: 0, p: 1.25, maxHeight: 220, overflow: "auto", bgcolor: "#f6f8fb", borderRadius: "10px", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {code.length > 60_000 ? `${code.slice(0, 60_000)}\n… (the copy has it whole)` : code}
      </Box>
    </Box>
  );
}
