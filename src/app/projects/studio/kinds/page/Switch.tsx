"use client";
// "CHANGE IT INTO ANOTHER MODULE" (Content v10, SARCLA 10.11.2026 point 4: "when I edit a block I should be able to change it
// into other module compatible, in this to other Q&A"). The modules of the library that hold the same kind of content as
// the block - its family (lib .../modules/switch.ts) - each with its thumbnail, its own category first. A click switches:
// the content stays (the questions, the products, the words and picture, the points), the look changes; Undo brings the
// old one back. Shown in a block's settings and in its own popup (the row's More: "Change it into another module").

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import UndoIcon from "@mui/icons-material/Undo";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { thumbOf } from "@/lib/content/studio/kinds/page/modules/registry";
import { categoryName, type SwitchOption } from "@/lib/content/studio/kinds/page/modules/switch";
import { PINK } from "../../parts";

const AMBER = "#a96a12";

/** The compatible modules, as thumbnails: a click makes the block that module. `first`: how many show before "Show all". */
export function SwitchList({ options, keeps, onPick, disabled, first = 6, columns = 2 }: {
  options: SwitchOption[];
  /** what is kept, in words ("its questions") */
  keeps: string;
  onPick: (type: string) => void;
  disabled?: boolean;
  first?: number;
  columns?: number;
}) {
  const [all, setAll] = useState(false);
  if (!options.length) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No other module of the library holds this kind of content.</Typography>;
  const shown = all ? options : options.slice(0, first);
  return (
    <Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45, mb: 1 }}>
        {options.length} module{options.length === 1 ? "" : "s"} of the same kind - it keeps {keeps}, only the look changes. Undo brings the old one back.
      </Typography>
      <Box role="list" sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
        {shown.map((o) => (
          <Tooltip key={o.def.id} title={o.def.note} placement="top">
            <Box role="listitem" component="button" type="button" disabled={disabled} onClick={() => onPick(o.def.id)} aria-label={`Change it into ${o.def.name}`}
              sx={{
                all: "unset", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "8px", overflow: "hidden",
                border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", transition: "border-color .12s, box-shadow .12s, transform .12s",
                "&:hover": disabled ? {} : { borderColor: PINK, boxShadow: "0 8px 20px -12px rgba(194,44,110,.55)", transform: "translateY(-1px)" },
                "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
              }}>
              <Box sx={{ aspectRatio: "16 / 10", bgcolor: "#f3f5f7", display: "grid", placeItems: "center", borderBottom: `1px solid ${HAIRLINE}`, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbOf(o.def.id)} alt="" loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
              </Box>
              <Box sx={{ px: 0.9, py: 0.7, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.def.name}</Typography>
                <Typography sx={{ fontSize: "0.68rem", color: o.note ? (o.short ? AMBER : MUTED) : MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: o.short ? 650 : 400 }}>
                  {o.note || categoryName(o.def)}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
      {options.length > first && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 650, fontSize: "0.78rem", color: PINK, px: 0.5, mt: 0.75 }}>
          {all ? "Show fewer" : `Show all ${options.length}`}
        </Button>
      )}
    </Box>
  );
}

/** Said over a module just switched: what happened, and its Undo. */
export function SwitchedBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, pl: 1.5, pr: 0.75, py: 0.75, borderRadius: "10px", bgcolor: "#15223a", color: "#fff", boxShadow: "0 12px 30px rgba(21,34,58,.28)" }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, flex: 1, minWidth: 0, lineHeight: 1.35 }}>{label}</Typography>
      <Button size="small" onClick={onUndo} startIcon={<UndoIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem", color: "#fff", bgcolor: "rgba(255,255,255,.12)", borderRadius: "7px", px: 1.1, "&:hover": { bgcolor: "rgba(255,255,255,.2)" } }}>Undo</Button>
    </Box>
  );
}
