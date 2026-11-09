"use client";
// "WHO REVIEWS IT?" - "Ask for review" on a to-do that has nobody to ask yet (SARCLA 09.11.2026: "the reviewer is Claudio -
// keep the dropdown but prefill"). The default reviewer stands first and is picked; a click picks another; "Ask for
// review" sends it (one mail to them). The same window from the to-do's line and from its studio's bar.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { reviewerChoices } from "@/lib/content/people";
import { Face, PINK } from "./ui";
import type { PersonOpt } from "./types";

const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };

export function ReviewerPick({ open, people, writer, defaultReviewer, onClose, onPick }: {
  open: boolean; people: PersonOpt[]; writer: string | null; defaultReviewer: string | null;
  onClose: () => void; onPick: (username: string) => void;
}) {
  const { list, picked: first } = reviewerChoices(people, writer, defaultReviewer);
  const [picked, setPicked] = useState<string | null>(first);
  // each time it opens: the default reviewer picked again
  useEffect(() => { if (open) setPicked(first); }, [open, first]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Who reviews it?</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.5 }}>They get a mail with the link, and approve it or send it back with a note.</Typography>
        <Box role="radiogroup" aria-label="Reviewer" sx={{ display: "grid", gap: 0.75, maxHeight: 340, overflowY: "auto", p: 0.25 }}>
          {list.map((x) => {
            const on = picked === x.username;
            return (
              <Box key={x.username} component="button" type="button" role="radio" aria-checked={on} onClick={() => setPicked(x.username)}
                onDoubleClick={() => onPick(x.username)} sx={{
                  all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.9,
                  border: `1px solid ${on ? PINK : HAIRLINE}`, borderRadius: "6px", fontSize: "0.88rem", fontWeight: 600, color: INK,
                  bgcolor: on ? "rgba(194,44,110,.06)" : "transparent", boxShadow: on ? `inset 0 0 0 1px ${PINK}` : "none",
                  "&:hover": { borderColor: on ? PINK : INK }, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 1 },
                }}>
                <Face username={x.username} name={x.name} size={28} />
                <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</Box>
                {x.username === defaultReviewer && <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>Reviews by default</Box>}
                {on && <CheckIcon sx={{ fontSize: 18, color: PINK }} />}
              </Box>
            );
          })}
          {!list.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Nobody else has Marketing & Content in the hub yet - an admin gives it under Users.</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={btn}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!picked} onClick={() => picked && onPick(picked)} sx={mainBtn}>Ask for review</Button>
      </DialogActions>
    </Dialog>
  );
}
