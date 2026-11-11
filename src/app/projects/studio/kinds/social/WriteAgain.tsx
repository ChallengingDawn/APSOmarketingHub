"use client";
// "WRITE IT ALL AGAIN" IN FOUR WAYS, AND ONE PAGE AGAIN (cv16, the Page builder's points 4 and 2 - page/WriteAgain.tsx and
// page/modules/Panel.tsx; SARCLA 11.11.2026: "compare the evolution of this page to the other content types and improve
// them"). The map's header: From the topic / Directly / Ask / Start again - every page and every caption, with one Undo.
// A page's own "Write it again with AI" (its row's menu): the box "What should change? Empty: write it from the post",
// applied at once, its Undo under the box.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { WRITE_WAYS, type WriteMode } from "@/lib/content/studio/kinds/social/rewrite";
import type { LogEntry } from "@/lib/content/studio/kinds/social/model";
import { PINK, btn, mainBtn } from "../../parts";
import { T } from "./look";
import { writeAgain } from "./writeAll";
import type { StudioCtx } from "./Studio";

/** What it did, with the Undo of exactly that. */
function Said({ ctx, text, entry, warn }: { ctx: StudioCtx; text: string; entry: LogEntry | null; warn?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
      <Typography sx={{ flex: 1, fontSize: "0.76rem", color: warn ? "#a96a12" : "#1b7a55", lineHeight: 1.4 }}>{text}</Typography>
      {entry && ctx.ai.canUndo(entry) && (
        <Button size="small" onClick={() => void ctx.ai.undo(entry)} sx={{ ...btn, px: 1, py: 0, minWidth: 0, color: PINK, border: `1px solid ${T.line}`, borderRadius: "6px", flexShrink: 0, fontSize: "0.74rem" }}>Undo</Button>
      )}
    </Box>
  );
}

export function WriteAllAgain({ ctx }: { ctx: StudioCtx }) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; entry: LogEntry | null; warn: boolean } | null>(null);
  const close = () => { setAt(null); setAsking(false); };
  const go = async (mode: WriteMode, request = "") => {
    if (mode === "reset" && !window.confirm("Start the post again? Every page and caption goes - Undo (or the history) brings them back.")) return;
    close(); setAsk(""); setBusy(true); setDone(null);
    const r = await writeAgain(ctx, mode, request);
    setBusy(false);
    setDone(r.error ? { text: r.error, entry: null, warn: true } : { text: r.said, entry: r.entry, warn: /Left out|Not all/.test(r.said) });
  };
  const disabled = !ctx.canEdit || busy || !!ctx.ai.working;
  return (
    <Box sx={{ position: "relative" }}>
      <Button size="small" disabled={disabled} onClick={(e) => setAt(e.currentTarget)} aria-haspopup="dialog"
        startIcon={busy ? <CircularProgress size={12} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />}
        sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0, "& .MuiButton-endIcon": { ml: 0.25 } }}>{busy ? "Writing…" : "Write it all again"}</Button>
      <Popover open={!!at} anchorEl={at} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.5, width: 320, borderRadius: "10px", border: `1px solid ${T.line}`, boxShadow: "0 14px 36px rgba(21,34,58,.18)" } } }}>
        <Box role="dialog" aria-label="Write it all again" sx={{ p: 0.75 }}>
          <Typography sx={{ px: 1, pt: 0.5, pb: 0.5, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.ink3 }}>Write it all again</Typography>
          {WRITE_WAYS.map((w) => (
            <Box key={w.mode} component="button" type="button" disabled={w.mode !== "reset" && !ctx.api.data.ai} onClick={() => (w.mode === "ask" ? setAsking(true) : void go(w.mode))}
              sx={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer", px: 1, py: 0.75, borderRadius: "7px",
                bgcolor: w.mode === "ask" && asking ? "rgba(194,44,110,.06)" : "transparent", "&:hover": { bgcolor: "rgba(194,44,110,.06)" }, "&:focus-visible": { outline: `2px solid ${PINK}` }, "&:disabled": { opacity: 0.45, cursor: "default" } }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: T.ink }}>{w.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: T.ink3, lineHeight: 1.35 }}>{w.line}</Typography>
            </Box>
          ))}
          {asking && (
            <Box sx={{ px: 1, pb: 0.75, pt: 0.25 }}>
              <Box sx={{ border: `1px solid ${T.line}`, borderRadius: "8px", px: 1.1, py: 0.5, "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
                <InputBase autoFocus fullWidth multiline minRows={2} maxRows={6} value={ask} placeholder="What should change?" inputProps={{ "aria-label": "What should change?" }}
                  onChange={(e) => setAsk(e.target.value.slice(0, 1500))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && ask.trim()) { e.preventDefault(); void go("ask", ask.trim()); } }}
                  sx={{ fontSize: "0.84rem", lineHeight: 1.45, color: T.ink }} />
              </Box>
              <Button fullWidth variant="contained" disableElevation disabled={!ask.trim()} onClick={() => void go("ask", ask.trim())}
                sx={{ ...mainBtn, mt: 0.75, borderRadius: "7px", height: 34, fontSize: "0.82rem" }}>Write the post with this</Button>
            </Box>
          )}
        </Box>
      </Popover>
      {done && (
        <Box sx={{ position: "absolute", right: 0, top: "100%", width: 300, zIndex: 5, mt: 0.5, p: 1, pt: 0.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${T.line}`, boxShadow: "0 10px 28px -14px rgba(16,24,40,.35)" }}>
          <Said ctx={ctx} text={done.text} entry={done.entry} warn={done.warn} />
          <Box component="button" type="button" onClick={() => setDone(null)} sx={{ all: "unset", cursor: "pointer", mt: 0.5, fontSize: "0.72rem", color: T.ink3, "&:hover": { color: T.ink } }}>Close</Box>
        </Box>
      )}
    </Box>
  );
}

/** A page's own "Write it again with AI": the box, applied at once, its Undo under it. */
export function WritePageAgain({ ctx, index, anchor, onClose }: { ctx: StudioCtx; index: number | null; anchor: HTMLElement | null; onClose: () => void }) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; entry: LogEntry | null; warn: boolean } | null>(null);
  const run = async () => {
    if (index === null || busy) return;
    setBusy(true); setDone(null);
    const r = await writeAgain(ctx, ask.trim() ? "ask" : "topic", ask.trim(), [index]);
    setBusy(false);
    setDone(r.error ? { text: r.error, entry: null, warn: true } : { text: r.said, entry: r.entry, warn: /Left out|Not all/.test(r.said) });
    if (!r.error) setAsk("");
  };
  return (
    <Popover open={index !== null && !!anchor} anchorEl={anchor} onClose={() => { setDone(null); onClose(); }} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { mt: 0.5, width: 300, borderRadius: "10px", border: `1px solid ${T.line}`, boxShadow: "0 14px 36px rgba(21,34,58,.18)" } } }}>
      <Box role="dialog" aria-label="Write this page again" sx={{ p: 1.25 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.ink3 }}>{index !== null && ctx.doc.design.pages.length > 1 ? `Page ${index + 1}` : "The post"}</Typography>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: T.ink, mb: 1 }}>Write it again with AI</Typography>
        <Box sx={{ border: `1px solid ${T.line}`, borderRadius: "8px", px: 1.1, py: 0.5, "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
          <InputBase autoFocus fullWidth multiline minRows={2} maxRows={6} value={ask} disabled={busy} placeholder="What should change? Empty: write it again from the post's brief"
            inputProps={{ "aria-label": "What should change?" }} onChange={(e) => setAsk(e.target.value.slice(0, 1500))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }}
            sx={{ fontSize: "0.84rem", lineHeight: 1.45, color: T.ink }} />
        </Box>
        <Button fullWidth variant="contained" disableElevation disabled={busy || !ctx.canEdit || !ctx.api.data.ai} onClick={() => void run()}
          startIcon={busy ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...mainBtn, mt: 0.75, borderRadius: "7px", height: 34, fontSize: "0.82rem" }}>{busy ? "Writing…" : "Write it again"}</Button>
        {done && <Said ctx={ctx} text={done.text} entry={done.entry} warn={done.warn} />}
      </Box>
    </Popover>
  );
}
