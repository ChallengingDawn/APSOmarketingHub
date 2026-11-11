"use client";
// "WRITE IT ALL AGAIN" IN FOUR WAYS - THE NEWSLETTER'S (cv16, 11.11.2026; the Page builder's ../page/WriteAgain.tsx, in the
// e-mail's words). SARCLA 10.11.2026 on the Page builder: "on content when write back should be able to write from topic or
// direct or ask"; 11.11.2026: "a start new, to reset completely". The same four here, at the top of the assistant while
// the whole e-mail is worked on:
//   From the topic   the to-do's subject and brief - the e-mail written fresh, its blocks kept (its words not shown)
//   Directly         the e-mail as it stands, written again better - nothing asked
//   Ask              "What should change?" - the whole e-mail written with it
//   Start again      its layout's empty blocks - every word out; Undo brings it back
// Each writes the blocks the person added too (the server's draft `extra`); what it did is a change with its Undo.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PINK, btn, mainBtn } from "../../parts";

export type WriteMode = "topic" | "better" | "ask" | "reset";
const WAYS: { mode: WriteMode; label: string; line: string }[] = [
  { mode: "topic", label: "From the topic", line: "The to-do's subject and brief - the e-mail written fresh, its blocks kept" },
  { mode: "better", label: "Directly", line: "The e-mail as it stands, written again better - nothing asked" },
  { mode: "ask", label: "Ask", line: "Say what should change - the whole e-mail is written with it" },
  { mode: "reset", label: "Start again", line: "Its layout's empty blocks - every word out, its other languages kept. Undo brings it back" },
];

export function WriteAgain({ disabled, busy, onRun, label = "Write it all again" }: {
  disabled: boolean; busy: boolean; label?: string;
  onRun: (mode: WriteMode, request?: string) => void;
}) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const close = () => { setAt(null); setAsking(false); };
  const go = (mode: WriteMode, request?: string) => {
    close(); setAsk("");
    if (mode === "reset" && !window.confirm("Start the e-mail again, empty? Every word goes - Undo brings them back; its other languages stay.")) return;
    onRun(mode, request);
  };
  return (
    <>
      <Button size="small" variant="outlined" disabled={disabled} onClick={(e) => setAt(e.currentTarget)} aria-haspopup="dialog" fullWidth
        startIcon={busy ? <CircularProgress size={12} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />}
        sx={{ ...btn, color: PINK, borderColor: "rgba(194,44,110,.35)", borderRadius: "7px", height: 32, fontSize: "0.8rem", justifyContent: "flex-start", "& .MuiButton-endIcon": { ml: "auto" }, "&:hover": { borderColor: PINK, bgcolor: "rgba(194,44,110,.04)" } }}>{label}</Button>
      <Popover open={!!at} anchorEl={at} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.5, width: 320, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 14px 36px rgba(21,34,58,.18)" } } }}>
        <Box role="dialog" aria-label="Write it all again" sx={{ p: 0.75 }}>
          <Typography sx={{ px: 1, pt: 0.5, pb: 0.5, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Write it all again</Typography>
          {WAYS.map((w) => (
            <Box key={w.mode} component="button" type="button" onClick={() => (w.mode === "ask" ? setAsking(true) : go(w.mode))}
              sx={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer", px: 1, py: 0.75, borderRadius: "7px",
                bgcolor: w.mode === "ask" && asking ? "rgba(194,44,110,.06)" : "transparent", "&:hover": { bgcolor: "rgba(194,44,110,.06)" }, "&:focus-visible": { outline: `2px solid ${PINK}` } }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{w.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 }}>{w.line}</Typography>
            </Box>
          ))}
          {asking && (
            <Box sx={{ px: 1, pb: 0.75, pt: 0.25 }}>
              <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1.1, py: 0.5, "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
                <InputBase autoFocus fullWidth multiline minRows={2} maxRows={6} value={ask} placeholder="What should change?" inputProps={{ "aria-label": "What should change?" }}
                  onChange={(e) => setAsk(e.target.value.slice(0, 1500))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && ask.trim()) { e.preventDefault(); go("ask", ask.trim()); } }}
                  sx={{ fontSize: "0.84rem", lineHeight: 1.45, color: INK }} />
              </Box>
              <Button fullWidth variant="contained" disableElevation disabled={!ask.trim()} onClick={() => go("ask", ask.trim())}
                sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>Write the e-mail with this</Button>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
