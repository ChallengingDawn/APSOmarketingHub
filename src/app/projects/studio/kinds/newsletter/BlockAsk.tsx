"use client";
// A BLOCK'S OWN AI, FROM ITS TOOLS BESIDE THE E-MAIL (cv16, 11.11.2026) - the Page builder's block popup
// (../page/modules/Panel.tsx: "Write it again with AI" and its box "What should change? Empty: fill it from the page",
// applied at once with Undo). The sparkle beside the picked block opens it: the block written again - as asked, or from
// the e-mail when the box is empty - applied at once; its Undo is that change's.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { PINK, btn, mainBtn } from "../../parts";

export function BlockAsk({ anchor, title, onClose, onRun, onUndo }: {
  anchor: HTMLElement | null; title: string; onClose: () => void;
  /** the block written again (an empty ask: from the e-mail); null when it went in, else what went wrong */
  onRun: (ask: string) => Promise<string | null>;
  /** the change just made, taken back */
  onUndo: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    if (busy) return;
    setBusy(true); setSaid(null);
    const e = await onRun(q.trim());
    setBusy(false);
    setSaid(e ? { ok: false, text: e } : { ok: true, text: q.trim() ? "Written as you asked - it is in the e-mail." : "Written again - it is in the e-mail." });
    if (!e) setQ("");
  };
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => { setSaid(null); onClose(); }} anchorOrigin={{ vertical: "top", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { ml: 1, width: 320, borderRadius: "12px", border: "1px solid rgba(21,34,58,.10)", boxShadow: "0 18px 48px rgba(21,34,58,.20)" } } }}>
      <Box role="dialog" aria-label={`Ask AI about ${title}`} sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>{title}</Typography>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 1 }}>Write it again with AI</Typography>
        <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1.1, py: 0.5, "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
          <InputBase autoFocus fullWidth multiline minRows={2} maxRows={6} value={q} disabled={busy} placeholder="What should change? Empty: write it again from the e-mail"
            inputProps={{ [AI_BOX_ATTR]: "1", "aria-label": "What should change?" }} onChange={(e) => setQ(e.target.value.slice(0, 1500))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }} sx={{ fontSize: "0.84rem", lineHeight: 1.45, color: INK }} />
        </Box>
        <Button fullWidth variant="contained" disableElevation disabled={busy} onClick={() => void run()}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>{busy ? "Writing…" : "Write it again with AI"}</Button>
        {said && (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
            <Typography sx={{ flex: 1, fontSize: "0.78rem", color: said.ok ? "#1b7a55" : "#a96a12", lineHeight: 1.4 }}>{said.text}</Typography>
            {said.ok && <Button size="small" onClick={() => { onUndo(); setSaid({ ok: true, text: "Taken back." }); }} sx={{ ...btn, px: 1, py: 0, minWidth: 0, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", fontSize: "0.76rem" }}>Undo</Button>}
          </Box>
        )}
      </Box>
    </Popover>
  );
}
