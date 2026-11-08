"use client";
// THE POST'S PICTURE (08.11.2026): none, one of the shop's photos, a brand card (words and a photo in the shop's look),
// or a carousel of slides - added, moved, each with its layout and few words. Pictures come from the shop's media only:
// the hub has no store of its own for pictures yet, and a picture pasted as data would be too heavy to keep.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { Choice } from "@/app/connectors/parts";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LAYOUTS, LAYOUT_LABEL, MAX_SLIDES, SLIDE_SIZE, newSlide, type MediaKind, type Picture, type Slide, type SlideSize, type SocialDoc,
} from "@/lib/content/studio/kinds/social/model";
import { slideCss, slideHtml } from "@/lib/content/studio/kinds/social/slides";
import { Field, PINK, btn, field, newId } from "../../parts";
import { Hint, PhotoPicker, Scaled, pictureProblem } from "../banner/ui";
import type { SocialBuildProps } from "./BuildPane";

const KINDS: { key: MediaKind; label: string }[] = [
  { key: "none", label: "None" }, { key: "image", label: "Photo" }, { key: "card", label: "Brand card" }, { key: "carousel", label: "Carousel" },
];

/** A picture from the shop: pick one of its photos or give its address; and say what it shows. */
function PictureFields({ value, onChange, canEdit, alt = true, lang = "EN" }: { value: Picture | null; onChange: (p: Picture | null) => void; canEdit: boolean; alt?: boolean; lang?: string }) {
  const url = value?.url ?? "";
  const problem = pictureProblem(url);
  return (
    <Box>
      <PhotoPicker lang={lang} selected={url ? [url] : []} onPick={(p) => canEdit && onChange({ url: p.url, alt: value?.alt ?? "" })} />
      <TextField size="small" fullWidth label="Or the address of a shop picture" value={url} disabled={!canEdit} sx={{ ...field, mt: 1.25, mb: 1.25 }}
        placeholder="https://www.apsoparts.com/media/…" error={!!problem} helperText={problem ?? undefined}
        onChange={(e) => { const u = e.target.value.trim(); onChange(u ? { url: u, alt: value?.alt ?? "" } : value?.alt ? { url: "", alt: value.alt } : null); }} />
      {alt && url && (
        <Field label="What it shows (alt text)" value={value?.alt ?? ""} onChange={(v) => onChange({ url, alt: v })} max={250} disabled={!canEdit}
          helper="Read aloud to people who cannot see it." />
      )}
      {url && <Button size="small" disabled={!canEdit} onClick={() => onChange(null)} sx={{ ...btn, color: MUTED, mt: -0.5 }}>No photo</Button>}
    </Box>
  );
}

/** One slide's (or the card's) layout and words. */
export function SlideFields({ s, onChange, canEdit, card }: { s: Slide; onChange: (s: Slide) => void; canEdit: boolean; card?: boolean }) {
  const photoMatters = s.layout === "cover" || s.layout === "photo" || card;
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Choice value={s.layout} onChange={(k) => canEdit && onChange({ ...s, layout: k })} options={LAYOUTS.map((k) => ({ key: k, label: LAYOUT_LABEL[k] }))} />
      </Box>
      <Field label={s.layout === "photo" ? "Label on the photo" : "Eyebrow"} value={s.eyebrow} onChange={(v) => onChange({ ...s, eyebrow: v })} max={40} placeholder="Sealing technology" disabled={!canEdit} />
      <Field label="Headline" value={s.headline} onChange={(v) => onChange({ ...s, headline: v })} max={90} placeholder="One idea, a few words" disabled={!canEdit} />
      <Field label={s.layout === "list" ? "Points - one per line" : "Text (optional)"} value={s.text} onChange={(v) => onChange({ ...s, text: v })} max={s.layout === "list" ? 320 : 200}
        multiline rows={s.layout === "list" ? 4 : 2} disabled={!canEdit} />
      {photoMatters ? (
        <PictureFields value={s.image} onChange={(p) => onChange({ ...s, image: p })} canEdit={canEdit} />
      ) : (
        <Hint>{s.layout === "end" ? "The last slide's button carries the link's words (or the shop's name)." : "This layout has no photo - choose Cover or Photo for one."}</Hint>
      )}
    </Box>
  );
}

function Carousel({ doc, set, canEdit, slide, setSlide, prefix }: SocialBuildProps & { prefix: string }) {
  const slides = doc.media.slides;
  const size = SLIDE_SIZE[doc.media.size];
  const at = Math.min(slide, Math.max(0, slides.length - 1));
  const css = slideCss(prefix);
  const put = (fn: (l: Slide[]) => Slide[]) => set((d) => ({ ...d, media: { ...d.media, slides: fn(d.media.slides) } }));
  const add = () => {
    const last = slides.length === 0;
    put((l) => [...l, newSlide(newId(), last ? "cover" : "statement")]);
    setSlide(slides.length);
  };
  const move = (i: number, to: number) => { put((l) => { const c = [...l]; c.splice(to, 0, c.splice(i, 1)[0]); return c; }); setSlide(to); };
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Choice value={doc.media.size} onChange={(k: SlideSize) => canEdit && set((d) => ({ ...d, media: { ...d.media, size: k } }))}
          options={(Object.keys(SLIDE_SIZE) as SlideSize[]).map((k) => ({ key: k, label: SLIDE_SIZE[k].label }))} />
      </Box>
      {slides.length === 0 && <Hint sx={{ mb: 1 }}>No slides yet. Add the first, or let the assistant turn the text into a carousel.</Hint>}
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {slides.map((s, i) => (
          <Box key={s.id} onClick={() => setSlide(i)} sx={{
            display: "flex", alignItems: "center", gap: 1.25, p: 0.75, pr: 0.5, borderRadius: "12px", cursor: "pointer",
            border: `1px solid ${i === at ? PINK : HAIRLINE}`, bgcolor: i === at ? "rgba(194,44,110,.05)" : "#fff",
          }}>
            <Scaled css={css} html={slideHtml(s, { prefix, w: size.w, h: size.h, index: i, total: slides.length })} w={size.w} h={size.h} scale={46 / size.w} radius={6} shadow={false} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{i + 1} · {LAYOUT_LABEL[s.layout]}</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: s.headline ? INK : MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.headline || "No headline yet"}</Typography>
            </Box>
            {canEdit && i === at && (
              <Box sx={{ display: "flex" }} onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Earlier"><span><IconButton size="small" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                <Tooltip title="Later"><span><IconButton size="small" disabled={i === slides.length - 1} onClick={() => move(i, i + 1)}><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                <Tooltip title="Duplicate"><span><IconButton size="small" disabled={slides.length >= MAX_SLIDES} onClick={() => { put((l) => { const c = [...l]; c.splice(i + 1, 0, { ...l[i], id: newId() }); return c; }); setSlide(i + 1); }}><ContentCopyIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => { put((l) => l.filter((_, k) => k !== i)); setSlide(Math.max(0, i - 1)); }}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {canEdit && slides.length < MAX_SLIDES && (
        <Button size="small" startIcon={<AddIcon />} onClick={add} sx={{ ...btn, mt: 1, color: INK }}>Add a slide</Button>
      )}
      {slides[at] && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "14px", bgcolor: "rgba(237,240,245,.6)", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1.25 }}>Slide {at + 1}</Typography>
          <SlideFields s={slides[at]} canEdit={canEdit} onChange={(s) => put((l) => l.map((x, k) => (k === at ? s : x)))} />
        </Box>
      )}
    </Box>
  );
}

export default function MediaEditor(props: SocialBuildProps) {
  const { doc, set, canEdit } = props;
  const m = doc.media;
  const prefix = "apsthumb";
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Choice value={m.kind} onChange={(k) => canEdit && set((d) => ({ ...d, media: { ...d.media, kind: k } }))} options={KINDS} />
      </Box>
      {m.kind === "none" && <Hint>A text post. LinkedIn shows the link&apos;s preview where there is one; Instagram needs a picture.</Hint>}
      {m.kind === "image" && (
        <PictureFields value={m.image.url || m.image.alt ? m.image : null} canEdit={canEdit}
          onChange={(p) => set((d) => ({ ...d, media: { ...d.media, image: p ?? { url: "", alt: "" } } }))} />
      )}
      {m.kind === "card" && (
        <>
          <Hint sx={{ mb: 1.25 }}>One picture made of words and a photo, in the shop&apos;s look - 1200 × 627 on LinkedIn and Facebook, square on Instagram.</Hint>
          <SlideFields card s={m.card} canEdit={canEdit} onChange={(s) => set((d) => ({ ...d, media: { ...d.media, card: s } }))} />
        </>
      )}
      {m.kind === "carousel" && <Carousel {...props} prefix={prefix} />}
    </Box>
  );
}
