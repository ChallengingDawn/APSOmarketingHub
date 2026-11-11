"use client";
// "WRITE IT ALL AGAIN" IN FOUR WAYS, FOR THE FILM (cv16, 11.11.2026). As the Page builder's (page/WriteAgain.tsx - its words
// are a page's, so the film has its own here, the same look):
//   From the topic   the brief and the features picked - the film made fresh (the storyboard task)
//   Directly         the film as it stands, every line written again better - the same scenes, pictures and timing
//   Ask              "What should change?" - the whole film written with it (the revise task)
//   Start again      an empty film - every scene out, the end card's words too; its features, length and format kept.
//                    Undo brings it back
// Each is listed under "Changes made here" with its Undo (the bar's history).

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

export type FilmWriteMode = "topic" | "better" | "ask" | "reset";
const WAYS: { mode: FilmWriteMode; label: string; line: string }[] = [
  { mode: "topic", label: "From the topic", line: "The brief and the features you picked - the film made fresh" },
  { mode: "better", label: "Directly", line: "The film as it stands, every line written again better - its scenes, pictures and timing kept" },
  { mode: "ask", label: "Ask", line: "Say what should change - the whole film is written with it" },
  { mode: "reset", label: "Start again", line: "An empty film - every scene out; its features, length and format kept. Undo brings it back" },
];
/** What the change list says once it is done. */
export const FILM_WROTE: Record<FilmWriteMode, string> = { topic: "Made again from the topic", better: "Written again, better", ask: "Written again as you asked", reset: "Started again - the film is empty" };

export function FilmWriteAgain({ disabled, busy, onRun }: { disabled: boolean; busy: boolean; onRun: (mode: FilmWriteMode, ask?: string) => void }) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const close = () => { setAt(null); setAsking(false); };
  const go = (mode: FilmWriteMode, request?: string) => { close(); setAsk(""); onRun(mode, request); };
  return (
    <>
      <Button size="small" disabled={disabled} onClick={(e) => setAt(e.currentTarget)} aria-haspopup="dialog"
        startIcon={busy ? <CircularProgress size={12} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />}
        sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0, "& .MuiButton-endIcon": { ml: 0.25 } }}>Write it all again</Button>
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
                sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>Write the film with this</Button>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
