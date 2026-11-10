"use client";
// ADD A BLOCK HERE (Content v5, SARCLA 09.11.2026: "I should be able to add more elements by + next to sections, or in the
// photo"). The "+" between two rows of the map and the "+" between two blocks of the page open the same squared menu: the
// blocks the page knows how to draw. The block lands at that place, selected, its fields open - the AI can write it alone.
// A block the page has once (the intro, the tiles, the links, the questions, the call to action) is moved there instead.

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import VerticalSplitOutlinedIcon from "@mui/icons-material/VerticalSplitOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { NewBlock } from "@/lib/content/studio/kinds/page/fields";
import { PINK } from "../../parts";

export const ADD_CHOICES: { kind: NewBlock; name: string; note: string; Icon: typeof NotesOutlinedIcon }[] = [
  { kind: "text", name: "Text and picture", note: "A heading, words and a picture beside them", Icon: VerticalSplitOutlinedIcon },
  { kind: "benefits", name: "Proof tiles", note: "Short reasons to order here, side by side", Icon: GridViewOutlinedIcon },
  { kind: "links", name: "Links to the shop", note: "Categories and products of the shop", Icon: LinkOutlinedIcon },
  { kind: "faq", name: "Questions", note: "What buyers ask, with the answers", Icon: HelpOutlineOutlinedIcon },
  { kind: "cta", name: "Call to action", note: "One line and a button: the next step", Icon: AdsClickOutlinedIcon },
  { kind: "intro", name: "Intro", note: "A paragraph: what the visitor finds here", Icon: NotesOutlinedIcon },
];

export type AddAt = { at: number; anchor?: HTMLElement | null; pos?: { top: number; left: number } };

/** The squared menu of blocks. `onPage` = the blocks the page has (a single one is moved, not added twice). */
export function AddBlockMenu({ where, onClose, onPick, onPage, onGallery }: {
  where: AddAt | null; onClose: () => void; onPick: (kind: NewBlock, at: number) => void; onPage: string[];
  /** the library opened for this place - the side bar's Modules tab since Content v7 (./modules/ModulesTab.tsx) */
  onGallery?: (at: number) => void;
}) {
  const open = !!where && (!!where.anchor || !!where.pos);
  return (
    <Popover open={open} onClose={onClose}
      anchorReference={where?.pos ? "anchorPosition" : "anchorEl"} anchorPosition={where?.pos} anchorEl={where?.anchor ?? null}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{ paper: { sx: { p: 1.5, borderRadius: "10px", width: 420, maxWidth: "calc(100vw - 32px)", boxShadow: "0 18px 50px rgba(21,34,58,.22)" } } }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 1, px: 0.25 }}>Add a block here</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
        {ADD_CHOICES.map(({ kind, name, note, Icon }) => {
          const has = kind !== "text" && onPage.includes(kind);
          return (
            <Box key={kind} component="button" type="button" data-add={kind} onClick={() => { if (where) onPick(kind, where.at); onClose(); }} sx={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", gap: 1, alignItems: "flex-start", p: 1.1, borderRadius: "6px",
              border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", transition: "border-color .12s, background-color .12s",
              "&:hover": { borderColor: PINK, bgcolor: "rgba(194,44,110,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
            }}>
              <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: has ? "#f1f3f6" : "rgba(194,44,110,.08)", color: has ? MUTED : PINK }}>
                <Icon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{name}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: has ? "#a96a12" : MUTED, lineHeight: 1.35 }}>{has ? "On the page already - moves it here" : note}</Typography>
              </Box>
            </Box>
          );
        })}
        {onGallery && (
          <Box component="button" type="button" data-add="gallery" onClick={() => { if (where) onGallery(where.at); onClose(); }} sx={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", gridColumn: "1 / -1", display: "flex", gap: 1, alignItems: "center", p: 1.1, borderRadius: "6px",
            border: `1px dashed ${PINK}`, bgcolor: "rgba(194,44,110,.03)", "&:hover": { bgcolor: "rgba(194,44,110,.07)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
          }}>
            <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: "rgba(194,44,110,.08)", color: PINK }}>
              <DashboardCustomizeOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>A module from the gallery</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>Bentos, product rows, mosaics, banners - filled from the shop</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Popover>
  );
}
