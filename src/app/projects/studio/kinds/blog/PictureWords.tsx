"use client";
// A BLOG PICTURE'S WORDS, AND MAKING IT FROM THEM (cv16, SARCLA 11.11.2026: "compare the evolution of this page to the other
// content types and improve them" - the Page builder's PicturePop, Content v13). Under the picture's slot (ui.tsx
// PictureSlot: the picture, Upload, Gallery, Remove):
//   New picture   "What should the picture show?" - the AI's idea to start from, the person's own words after; "Make it"
//                 / "Make another" always uses the box's CURRENT words
//   Fine-tune     "What should change in this picture?" (or one of the usual changes) - the same picture with one change
//   while it is made   the frame in the page breathes; here "Making it… 0:12", "From: <the words>", and - when the box says
//                 something else now - "Make it from these words instead": a new ask; the newest ask's picture is the one
//                 that lands (page/pictureJobs.ts), an older one only reaches the gallery.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { madeFrom, makeButton } from "@/lib/content/studio/kinds/page/pictureJobs";
import { PINK, field } from "../../parts";
import { PICTURE_TUNES } from "../../pictures";
import { toolBtn } from "./ui";

export type PictureMaking = { from: string; since: number; how: "make" | "tune" };

function useSecs(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (since === null) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [since]);
  return since === null ? 0 : Math.max(0, Math.round((now - since) / 1000));
}

export function PictureWords({ words, onWords, hasPicture, canTune, making, error, disabled, onMake, onTune }: {
  /** the words the picture is (to be) made from - kept with the picture */
  words: string; onWords: (w: string) => void;
  hasPicture: boolean;
  /** the picture is the hub's own: it can be fine-tuned */
  canTune: boolean;
  making: PictureMaking | null;
  error: string | null;
  disabled: boolean;
  onMake: (words: string) => void;
  onTune: (ask: string) => void;
}) {
  const [how, setHow] = useState<"make" | "tune">("make");
  const [ask, setAsk] = useState("");
  const secs = useSecs(making ? making.since : null);
  const tune = how === "tune" && canTune;
  const draft = tune ? ask : words;
  const b = makeButton({ hasPicture, making: !!making, makingFrom: making?.from ?? null, draft, canMake: !disabled });
  const label = tune && !making ? "Fine-tune it" : tune && b.label === "Make it from these words instead" ? "Fine-tune it from these words instead" : b.label;
  const go = () => (tune ? onTune(ask.trim()) : onMake(words.trim()));
  return (
    <Box sx={{ mt: 1.25 }}>
      {canTune && hasPicture && (
        <Box sx={{ mb: 1 }}>
          <SquareChoice value={how} onChange={setHow} options={[{ key: "make", label: "New picture" }, { key: "tune", label: "Fine-tune" }]} />
        </Box>
      )}
      <TextField fullWidth multiline minRows={2} maxRows={6} size="small" disabled={disabled}
        label={tune ? "What should change in this picture?" : "What should the picture show?"}
        placeholder={tune ? "e.g. the same part, closer, on a workbench" : "The part, the hands, the place, the light - in plain words"}
        value={draft} onChange={(e) => (tune ? setAsk(e.target.value) : onWords(e.target.value))} sx={field} />
      {tune && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
          {PICTURE_TUNES.map((t) => <Button key={t.label} size="small" disabled={disabled} onClick={() => setAsk(t.ask)} sx={{ ...toolBtn, height: 26, fontSize: "0.72rem" }}>{t.label}</Button>)}
        </Box>
      )}
      <Button size="small" disabled={b.disabled} onClick={go} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
        sx={{ ...toolBtn, mt: 1, ...(b.disabled ? {} : { bgcolor: PINK, color: "#fff", borderColor: PINK, "&:hover": { bgcolor: "#a3245c", borderColor: "#a3245c", color: "#fff" } }) }}>
        {label}
      </Button>
      {making && (
        <Box role="status" sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 650, color: PINK }}>
            {making.how === "tune" ? "Fine-tuning the picture…" : "Making the picture…"} <Box component="span" sx={{ color: MUTED, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>0:{String(secs).padStart(2, "0")} · up to 40 seconds</Box>
          </Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.4, mt: 0.25 }}>From: {madeFrom(making.from)}</Typography>
          <LinearProgress sx={{ mt: 0.5, height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
        </Box>
      )}
      {error && !making && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f", mt: 0.75 }}>{error}</Typography>}
    </Box>
  );
}
