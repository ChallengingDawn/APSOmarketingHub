"use client";
// "WRITE IT ALL AGAIN" FOR A BANNER, IN THE PAGE BUILDER'S FOUR WAYS (cv16, 11.11.2026; SARCLA: "compare the evolution of
// this page to the other content types and improve them"). The Page builder's menu (page/WriteAgain.tsx) in the banner's
// own words - its lines speak of a page's blocks and modules, which a banner has not:
//   From the topic   the project's brief - the banner written fresh (its words left out of the question)
//   Directly         the banner as it stands, written again better - nothing asked
//   Ask              "What should change?" - every word written with it
//   Start again      every word out - its design, places and picture kept
// What it did is said under the map's header with its Undo (Map.tsx).

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
import type { WriteMode } from "../page/WriteAgain";

const WAYS: { mode: WriteMode; label: string; line: string }[] = [
  { mode: "topic", label: "From the topic", line: "The project's brief - the banner written fresh, its design and places kept" },
  { mode: "better", label: "Directly", line: "The banner as it stands, written again better - nothing asked" },
  { mode: "ask", label: "Ask", line: "Say what should change - every word is written with it" },
  { mode: "reset", label: "Start again", line: "Every word out - its design, places, picture and the button's page kept. Undo brings it back" },
];
/** What the line under the map's header says once it is done. */
export const WROTE: Record<WriteMode, string> = { topic: "Written again from the topic", better: "Written again, better", ask: "Written again as you asked", reset: "Started again - every word out" };

export function WriteAgain({ label, disabled, busy, onRun }: { label: string; disabled: boolean; busy: boolean; onRun: (mode: WriteMode, request?: string) => void }) {
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
                  onChange={(e) => setAsk(e.target.value.slice(0, 1200))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && ask.trim()) { e.preventDefault(); go("ask", ask.trim()); } }}
                  sx={{ fontSize: "0.84rem", lineHeight: 1.45, color: INK }} />
              </Box>
              <Button fullWidth variant="contained" disableElevation disabled={!ask.trim()} onClick={() => go("ask", ask.trim())}
                sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>Write the banner with this</Button>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
