"use client";
// ADD AN ELEMENT HERE - a page of the shop (Content v6, SARCLA 09.11.2026 point 9: "we should really be able to add
// elements"). The "+" between two elements of the page (hover shows it, like the new page's "+") opens this small menu:
//   Text and picture        a block in the kit's way at once (a heading, words, a photo of the page) - its words written
//                           in place or by the AI after
//   Ask the AI for a block  what it should show, in a line - the AI designs it for that place (./block.ts, then checked)
// THE ENTRY POINT FOR THE MODULE GALLERY (builder B, feat/cv6-gallery): the gallery plugs in here. It gets the same
// `place` and hands back a change through `onInsert` - an insert at the place (model.ts insertChange(place.selector,
// place.where, html, { module: { type, settings } })) - so it lands, is checked and is undone like any other.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import VerticalSplitOutlinedIcon from "@mui/icons-material/VerticalSplitOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { textPictureBlock, prefixOf } from "@/lib/content/studio/kinds/page/block";
import { changeId, insertChange, type PageChange } from "@/lib/content/studio/kinds/page/model";
import { PINK, btn } from "../../parts";
import type { AddPlace } from "./Frame";

export type AddElementProps = {
  place: AddPlace | null;
  onClose: () => void;
  /** a finished change for this place (the gallery's modules hand theirs in the same way) */
  onInsert: (c: PageChange, label: string) => void;
  /** the AI asked for a block at this place */
  onAskAi: (request: string, place: AddPlace) => void;
  canAi: boolean;
};

/** The block "Text and picture" at a place: in the kit's way, a photo of the page beside the words. */
export function textPictureAt(place: AddPlace): PageChange {
  const id = changeId();
  return insertChange(place.selector, place.where, textPictureBlock(prefixOf(id), place.img), { id, note: "Text and picture" });
}

export function AddElementMenu({ place, onClose, onInsert, onAskAi, canAi }: AddElementProps) {
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (!place) { setAsking(false); setText(""); } }, [place]);
  useEffect(() => { if (asking) setTimeout(() => input.current?.focus(), 40); }, [asking]);
  const ask = () => { if (!place || !text.trim()) return; onAskAi(text.trim(), place); onClose(); };
  const choice = (o: { key: string; name: string; note: string; Icon: typeof VerticalSplitOutlinedIcon; disabled?: boolean; onClick: () => void }) => (
    <Box key={o.key} component="button" type="button" data-addel={o.key} disabled={o.disabled} onClick={o.onClick} sx={{
      all: "unset", boxSizing: "border-box", cursor: o.disabled ? "default" : "pointer", display: "flex", gap: 1, alignItems: "flex-start", p: 1.1, borderRadius: "6px",
      border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", opacity: o.disabled ? 0.5 : 1, transition: "border-color .12s, background-color .12s",
      "&:hover": o.disabled ? {} : { borderColor: PINK, bgcolor: "rgba(194,44,110,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
    }}>
      <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: "rgba(194,44,110,.08)", color: PINK }}><o.Icon sx={{ fontSize: 18 }} /></Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{o.name}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>{o.note}</Typography>
      </Box>
    </Box>
  );
  return (
    <Popover open={!!place} onClose={onClose} anchorReference="anchorPosition" anchorPosition={place?.pos}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{ paper: { sx: { p: 1.5, borderRadius: "10px", width: 420, maxWidth: "calc(100vw - 32px)", boxShadow: "0 18px 50px rgba(21,34,58,.22)" } } }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, px: 0.25 }}>Add an element here</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1, px: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{place?.label}</Typography>
      {!asking ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
          {choice({ key: "text-picture", name: "Text and picture", note: place?.img ? "A heading, words and a photo of this page" : "A heading and words, in the shop's look", Icon: VerticalSplitOutlinedIcon,
            onClick: () => { if (place) onInsert(textPictureAt(place), "Added text and picture"); onClose(); } })}
          {choice({ key: "ai", name: "Ask the AI for a block", note: "Say what it should show - designed for this place", Icon: AutoAwesomeOutlinedIcon, disabled: !canAi, onClick: () => setAsking(true) })}
        </Box>
      ) : (
        <Box>
          <Box component="textarea" ref={input} value={text} rows={3} placeholder="What should the block show? (e.g. our four promises as small cards)"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); } }}
            sx={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", p: 1, font: "inherit", fontSize: "0.86rem", color: INK, outline: "none", "&:focus": { borderColor: PINK } }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
            <Button size="small" onClick={() => setAsking(false)} sx={{ ...btn, color: INK }}>Back</Button>
            <Button size="small" variant="contained" disableElevation disabled={!text.trim()} onClick={ask} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ ...btn, bgcolor: PINK, borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>Make it</Button>
          </Box>
        </Box>
      )}
    </Popover>
  );
}
