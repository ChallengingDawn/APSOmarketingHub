"use client";
// "ASK AI" WHERE THE THING IS (cv16, 11.11.2026). The Page builder's popups each carry their own AI box, applied at once
// with an Undo beside what it did (page/modules/Panel.tsx "Write it again with AI" - "What should change? Empty: fill it
// from the page"; page/pops.tsx's element box). Here: a scene's (and the end card's) "Write it again with AI", and a
// line's own box in its popup on the film. The bar's "Ask AI" puts the cursor in the box of what is selected
// (page lib barAi.ts AI_BOX_ATTR - the same mark).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { PINK, btn } from "../../parts";

/** What an ask did, said under the box with its Undo. */
export type Done = { text: string; undo?: () => void };

export function AiBox({ title, placeholder, button, disabled, onRun, compact }: {
  title: string; placeholder: string; button: string; disabled?: boolean;
  /** runs the ask (the words, "" = from the film); answers what it did, with its Undo - or the reason it did nothing */
  onRun: (ask: string) => Promise<Done | string | null>;
  compact?: boolean;
}) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    if (busy) return;
    setBusy(true); setMsg(null); setDone(null);
    try {
      const r = await onRun(ask.trim());
      if (typeof r === "string") setMsg(r);
      else if (r) { setDone(r); setAsk(""); }
    } finally { setBusy(false); }
  };
  return (
    <Box sx={{ mt: compact ? 1 : 2, p: compact ? 0 : 1.25, borderRadius: "10px", border: compact ? "none" : "1px solid rgba(194,44,110,.22)", bgcolor: compact ? "transparent" : "rgba(194,44,110,.035)" }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: PINK, mb: 0.6, display: "flex", alignItems: "center", gap: 0.5 }}>
        <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />{title}
      </Typography>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1.1, py: 0.5, bgcolor: "#fff", "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
        <InputBase fullWidth multiline minRows={1} maxRows={5} value={ask} disabled={disabled || busy} placeholder={placeholder}
          inputProps={{ "aria-label": title, [AI_BOX_ATTR]: "1" }}
          onChange={(e) => setAsk(e.target.value.slice(0, 800))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void go(); } }}
          sx={{ fontSize: "0.82rem", lineHeight: 1.45, color: INK }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
        <Button size="small" variant="contained" disableElevation disabled={disabled || busy} onClick={() => void go()}
          startIcon={busy ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, bgcolor: PINK, color: "#fff", borderRadius: "6px", fontSize: "0.78rem", "&:hover": { bgcolor: "#a3245c" } }}>{busy ? "Writing…" : button}</Button>
        {done && (
          <Typography component="span" sx={{ fontSize: "0.74rem", color: "#1b7a55", fontWeight: 600 }}>
            {done.text}
            {done.undo && <Box component="button" type="button" onClick={() => { done.undo?.(); setDone(null); }} sx={{ all: "unset", cursor: "pointer", color: PINK, fontWeight: 700, ml: 0.75, "&:hover": { textDecoration: "underline" } }}>Undo</Box>}
          </Typography>
        )}
      </Box>
      {msg && <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 0.75, borderRadius: "6px" }}>{msg}</Typography>}
      {!done && !msg && <Typography sx={{ mt: 0.5, fontSize: "0.7rem", color: MUTED }}>Applied at once - Undo puts it back.</Typography>}
    </Box>
  );
}
