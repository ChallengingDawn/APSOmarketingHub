"use client";
// ONE ELEMENT OF THE FILM, ITS POPUP (cv16, 11.11.2026). SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the
// Page builder] to the other content types' generators, and improve them". As the Page builder's element popups
// (page/pops.tsx TextPop, ButtonPop, PicturePop), in their fixed order:
//   words      the line, its red word (the film's one look of a line: select a word, then Red)
//   Ask AI     its own box - that line only, applied at once, with Undo (the `line` task)
//   picture    a picture's: This picture / Gallery / Fine-tune, made from your own words (./PictureAsk.tsx); a part's: our parts
//   actions    Take it out · Duplicate · Move (a line of a words or steps scene changes places; else its scene moves)
// It opens beside what was clicked on the film (the film held still) - never over the words being changed.

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Typography from "@mui/material/Typography";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { btn } from "../../parts";
import { AiBox, type Done } from "./AiBox";
import { Head, WordField } from "./ui";

export function ElementPop({ anchor, name, kind, value, placeholder, words, red, multiline, disabled, aiOn, lang, onWords, onAsk, picture, onTakeOut, takeOutLabel, duplicate, up, down, onClose }: {
  anchor: HTMLElement | null;
  /** "Scene 2 · Headline" */
  name: string;
  kind: "text" | "picture";
  value: string; words?: number; red?: boolean; multiline?: boolean;
  /** in a language version: the film’s own words, shown grey while the line has none of its own */
  placeholder?: string;
  disabled: boolean; aiOn: boolean;
  /** the language the words are in, when it is not the film's own ("DE") */
  lang?: string | null;
  onWords: (v: string) => void;
  onAsk: (ask: string) => Promise<Done | string | null>;
  /** a picture's or a part's own controls */
  picture?: React.ReactNode;
  onTakeOut: (() => void) | null; takeOutLabel?: string;
  duplicate: { label: string; run: () => void } | null;
  up: { label: string; run: () => void } | null;
  down: { label: string; run: () => void } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const act = { ...btn, fontSize: "0.76rem", py: 0.25, px: 0.9, minWidth: 0, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px" };
  return (
    <Popper open={!!anchor} anchorEl={anchor} placement="right-start" sx={{ zIndex: 1300 }}
      modifiers={[{ name: "flip", options: { fallbackPlacements: ["left-start", "bottom-start", "top-start"] } }, { name: "preventOverflow", options: { padding: 8, altAxis: true } }, { name: "offset", options: { offset: [0, 10] } }]}>
      <Paper id="video-el-pop" role="dialog" aria-label={name} elevation={0} onMouseDown={(e) => e.stopPropagation()}
        sx={{ width: 340, maxHeight: "72vh", overflowY: "auto", p: 1.5, borderRadius: "12px", border: "1.5px solid #c22c6e", boxShadow: "0 18px 44px rgba(21,34,58,.26)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 750, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}{lang ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {lang}</Box> : null}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
        </Box>

        {kind === "text" && (
          <WordField key={name} label="Words" value={value} placeholder={placeholder?.replace(/\*/g, "")} words={words ?? 6} red={red} multiline={multiline} disabled={disabled} autoFocus onChange={onWords} />
        )}

        {kind === "text" && aiOn && (
          <AiBox compact title="Ask AI for this line" placeholder="E.g. shorter, warmer, about DirectCUT" button="Rewrite it" disabled={disabled} onRun={onAsk} />
        )}

        {kind === "picture" && picture}

        {(onTakeOut || duplicate || up || down) && (
          <>
            <Head mt={1.75}>{kind === "picture" ? "This picture" : "This line"}</Head>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
              {onTakeOut && <Button size="small" disabled={disabled} onClick={onTakeOut} startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />} sx={act}>{takeOutLabel ?? "Take it out"}</Button>}
              {duplicate && <Button size="small" disabled={disabled} onClick={duplicate.run} startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 14 }} />} sx={act}>{duplicate.label}</Button>}
              {up && <Button size="small" disabled={disabled} onClick={up.run} startIcon={<ArrowUpwardRoundedIcon sx={{ fontSize: 15 }} />} sx={act}>{up.label}</Button>}
              {down && <Button size="small" disabled={disabled} onClick={down.run} startIcon={<ArrowDownwardRoundedIcon sx={{ fontSize: 15 }} />} sx={act}>{down.label}</Button>}
            </Box>
          </>
        )}
      </Paper>
    </Popper>
  );
}
