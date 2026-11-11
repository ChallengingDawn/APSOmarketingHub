"use client";
// "WRITE IT ALL AGAIN" IN THREE WAYS (Content v12, 10.11.2026). SARCLA: "on content when write back should be able to write
// from topic or direct or ask". The BlockList header's button opens a choice:
//   From the topic   the to-do's subject and brief - the page written fresh (its blocks kept, its words not)
//   Directly         the page as it stands, written again better - nothing asked
//   Ask              "What should change?" - then the whole page is written with that
// Each is the same whole-page write as before (fill_page with its modules, lib .../server.ts WRITE_MODE_TELL); what it did
// is said under the header with its Undo (everything since, the modules filled after it too).

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
  { mode: "topic", label: "From the topic", line: "The to-do's subject and brief - the page written fresh, its blocks kept" },
  { mode: "better", label: "Directly", line: "The page as it stands, written again better - nothing asked" },
  { mode: "ask", label: "Ask", line: "Say what should change - the whole page is written with it" },
  // SARCLA 11.11.2026: "it can't start over - a start new, to reset completely the page"
  { mode: "reset", label: "Start again", line: "An empty page - every block and module out; its address, store views and pages in Magento kept. Undo brings it back" },
];
/** What the line under the header says once it is done. */
export const WROTE: Record<WriteMode, string> = { topic: "Written again from the topic", better: "Written again, better", ask: "Written again as you asked", reset: "Started again - the page is empty" };

export function WriteAgain({ label, disabled, busy, onRun }: {
  label: string; disabled: boolean; busy: boolean;
  onRun: (mode: WriteMode, request?: string) => void;
}) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const close = () => { setAt(null); setAsking(false); };
  const go = (mode: WriteMode, request?: string) => { close(); setAsk(""); onRun(mode, request); };
  return (
    <>
      <Button size="small" disabled={disabled} onClick={(e) => setAt(e.currentTarget)} aria-haspopup="dialog"
        startIcon={busy ? <CircularProgress size={12} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />}
        sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0, "& .MuiButton-endIcon": { ml: 0.25 } }}>{label}</Button>
      <Popover open={!!at} anchorEl={at} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
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
                sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>Write the page with this</Button>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
