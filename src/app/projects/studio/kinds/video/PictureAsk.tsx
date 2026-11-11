"use client";
// A SCENE'S PICTURE, MADE FROM YOUR OWN WORDS (cv16, 11.11.2026). SARCLA 11.11.2026 ~18:25: "compare the evolution of this
// page [the Page builder] to the other content types' generators, and improve them". The Page builder's picture popup
// (page/pops.tsx PicturePop): This picture / Gallery / Fine-tune, a box "What should the picture show?" that "Make it"
// and "Make another" read AT THE CLICK, "From: ..." under the progress while it is made, and new words in the box then
// give "Make it from these words instead" - the newest ask wins (page lib pictureJobs.ts, reused as it is). The film's
// picture slot (./map.tsx PictureSlot, which the banner studio shares) only ever made one from the scene's words.

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { isNewest, madeFrom, makeButton, startJob, type SlotJobs } from "@/lib/content/studio/kinds/page/pictureJobs";
import { PINK, btn } from "../../parts";
import { PICTURE_TUNES, makePicture, refinePicture, uploadPicture, type PictureAspect } from "../../pictures";
import { shimmer, useClock } from "./map";

type Tab = "this" | "gallery" | "tune";

export function PictureAsk({ url, idea, aspect, where, onSet, onRemove, removeLabel = "Remove", gallery, disabled, note, slot }: {
  url: string | null;
  /** the words the box starts with: the scene's own, as a picture's idea */
  idea: string;
  aspect: PictureAspect; where: { projectId: number; pieceId: number };
  onSet: (url: string) => void; onRemove?: () => void; removeLabel?: string;
  /** what "Gallery" opens: the shop's photos, ours, the products */
  gallery: React.ReactNode;
  disabled?: boolean; note?: React.ReactNode;
  /** the slot's name: a new ask for the same slot replaces an older one still being made */
  slot: string;
}) {
  const [tab, setTab] = useState<Tab>("this");
  const [draft, setDraft] = useState(idea);
  const [tune, setTune] = useState("");
  const [making, setMaking] = useState<{ since: number; from: string; tune?: boolean } | null>(null);
  const [share, setShare] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const jobs = useRef<SlotJobs>({});
  const file = useRef<HTMLInputElement | null>(null);
  const clock = useClock(making?.since ?? null);

  /** Made from the box's words as they are NOW; only the newest ask's picture goes in. */
  const make = async (words: string, tune?: string) => {
    const n = startJob(jobs.current, slot);
    setMaking({ since: Date.now(), from: tune ?? words, tune: !!tune }); setErr(null);
    const r = tune && url ? await refinePicture(url, tune, aspect, where) : await makePicture(words, aspect, where);
    if (!isNewest(jobs.current, slot, n)) return; // an older ask: its picture stays in the gallery, never in the slot
    setMaking(null);
    if (!r.ok) { setErr(r.error); return; }
    onSet(r.picture.url);
  };
  const upload = async (list: FileList | null) => {
    const f = Array.from(list ?? []).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setShare(0); setErr(null);
    const r = await uploadPicture(f, where, (s) => setShare(s));
    setShare(null);
    if (!r.ok) { setErr(r.error); return; }
    onSet(r.picture.url);
  };
  const mk = makeButton({ hasPicture: !!url, making: !!making && !making.tune, makingFrom: making?.from ?? null, draft, canMake: !disabled });
  const hub = !!url && url.startsWith("/api/content/picture/");
  const act = { ...btn, fontSize: "0.76rem", py: 0.2, px: 0.9, minWidth: 0, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px" };

  return (
    <Box>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <SquareChoice<Tab> value={tab} onChange={setTab} options={[{ key: "this", label: "This picture" }, { key: "gallery", label: "Gallery" }, { key: "tune", label: "Fine-tune", disabled: !hub }]} />
      <Box sx={{ mt: 1.25 }}>
        {making || share !== null ? (
          <Box role="status" aria-live="polite" sx={{ minHeight: 96, borderRadius: "8px", border: "1px solid rgba(194,44,110,.25)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", p: 1.25, ...shimmer, bgcolor: "#fffafc" }}>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: PINK, fontVariantNumeric: "tabular-nums" }}>{making ? `${making.tune ? "Fine-tuning" : "Making"} the picture… ${clock}` : "Uploading…"}</Typography>
              {making && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.4, mt: 0.25 }}>From: {madeFrom(making.from)}</Typography>}
            </Box>
            <LinearProgress variant={share !== null ? "determinate" : "indeterminate"} value={share !== null ? share * 100 : undefined}
              sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
          </Box>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 6, border: `1px solid ${HAIRLINE}`, background: "#eef1f6", display: "block" }} />
        ) : (
          <Box sx={{ minHeight: 72, borderRadius: "8px", border: "1.5px dashed #b9c3cf", display: "grid", placeItems: "center", color: MUTED, fontSize: "0.76rem" }}>No picture yet</Box>
        )}
      </Box>
      {tab === "this" && (
        <Box sx={{ mt: 1.25 }}>
          <Typography component="label" sx={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: MUTED, mb: 0.4 }}>What should the picture show?</Typography>
          <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1.1, py: 0.5, bgcolor: "#fff", "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
            <InputBase fullWidth multiline minRows={2} maxRows={5} value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value.slice(0, 600))}
              inputProps={{ "aria-label": "What should the picture show?" }} sx={{ fontSize: "0.82rem", lineHeight: 1.45, color: INK }} />
          </Box>
          <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mt: 0.9 }}>
            <Button size="small" variant="contained" disableElevation disabled={mk.disabled} onClick={() => void make(draft.trim())} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ ...btn, bgcolor: PINK, color: "#fff", borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>{mk.label}</Button>
            <Button size="small" disabled={disabled || share !== null} onClick={() => file.current?.click()} sx={act}>Upload</Button>
            {onRemove && <Button size="small" disabled={disabled} onClick={onRemove} sx={{ ...act, color: MUTED }}>{removeLabel}</Button>}
          </Box>
        </Box>
      )}
      <Collapse in={tab === "gallery"} timeout={200} unmountOnExit><Box sx={{ mt: 1.25 }}>{gallery}</Box></Collapse>
      {tab === "tune" && hub && (
        <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 0.75, lineHeight: 1.4 }}>The same picture with one change - the one before stays in the gallery.</Typography>
          <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
            {PICTURE_TUNES.map((t) => <Button key={t.label} size="small" disabled={disabled || !!making} onClick={() => void make(draft, t.ask)} sx={act}>{t.label}</Button>)}
          </Box>
          {/* the change in your own words (the Page builder's Fine-tune "Make it") */}
          <Box sx={{ mt: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1.1, py: 0.5, bgcolor: "#fff", "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
            <InputBase fullWidth multiline minRows={1} maxRows={4} value={tune} disabled={disabled} placeholder="Or say the change: e.g. a darker background" onChange={(e) => setTune(e.target.value.slice(0, 400))}
              inputProps={{ "aria-label": "The change, in your own words" }} sx={{ fontSize: "0.82rem", lineHeight: 1.45, color: INK }} />
          </Box>
          <Button size="small" variant="contained" disableElevation disabled={disabled || !!making || !tune.trim()} onClick={() => void make(draft, tune.trim())} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, mt: 0.75, bgcolor: PINK, color: "#fff", borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>Make it</Button>
        </Box>
      )}
      {err && <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: "#c5221f" }}>{err}</Typography>}
      {note && <Typography component="div" sx={{ mt: 0.6, fontSize: "0.72rem", color: MUTED, lineHeight: 1.4 }}>{note}</Typography>}
    </Box>
  );
}
