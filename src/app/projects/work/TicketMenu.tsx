"use client";
// A TO-DO'S TICKET CHIP AND ITS STAGES (SARCLA 10.11.2026: "on clicking the ticket I should be able to move it from stage").
//
// The chip says where the ticket stands ("#4512 · In Progress"); a click opens a small SQUARED menu with the pipeline's
// stages in their order - the one it is at marked - then "Open in HubSpot" and the to-do's "Plan & ticket" window
// (where it is unlinked). Picking a stage shows it on the chip at once; HubSpot is asked behind it, and when it refuses the
// chip goes back and says why, in plain words. The pipeline's own moves (planned -> Ready to roll, live -> Live) come
// from the server (lib/content/ticketMoves.ts) and land on the same chip.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

import { HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import type { TicketStage, TodoTicket } from "./types";

const btn = { textTransform: "none" as const, fontWeight: 600, whiteSpace: "nowrap" as const };

/** A stage's colour, by its name - the content pages' stage colours (ui.tsx STAGE_DOT), so the menu reads like the board. */
export function stageColour(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("idea")) return "#4a5a70";
  if (l.includes("progress")) return "#2459d1";
  if (l.includes("waiting")) return "#c97a10";
  if (l.includes("ready")) return "#1b7a55";
  if (l.includes("maintain")) return "#0e7c8c";
  if (l.includes("kill")) return "#9aa3b2";
  if (l.includes("live")) return "#6a46c9";
  return MUTED;
}

/** A stage's small square in its colour - one stage among them, so no box to tick. */
const Square = ({ colour }: { colour: string }) => (
  <Box component="span" sx={{ width: 10, height: 10, borderRadius: "2px", flexShrink: 0, bgcolor: colour }} />
);

/**
 * The menu's items - the ticket's stages, the current one marked. A list, not a component: the menu moves its focus over
 * its own children (the stage it is at first); on its own so a static page can show it open.
 */
export function ticketStageItems({ ticket, stages, canEdit, onPick, onHubSpot, onPlan }: {
  ticket: TodoTicket; stages: TicketStage[]; canEdit: boolean; onPick: (s: TicketStage) => void; onHubSpot?: () => void; onPlan: () => void;
}): React.ReactElement[] {
  return [
    <Box key="head" sx={{ px: 1.75, pt: 0.75, pb: 1, maxWidth: 300 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>Ticket #{ticket.id} · From Scroll to Sale</Typography>
      {ticket.subject && <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600, mt: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ticket.subject}</Typography>}
    </Box>,
    <Divider key="d1" />,
    ...(stages.length ? [] : [<Typography key="none" sx={{ px: 1.75, py: 1, fontSize: "0.84rem", color: MUTED, maxWidth: 280 }}>HubSpot did not give its stages just now - move it there, or try again in a moment.</Typography>]),
    ...stages.map((s) => {
      const on = s.value === ticket.stage;
      const colour = stageColour(s.label);
      return (
        <MenuItem key={s.value} selected={on} disabled={!canEdit && !on} onClick={() => onPick(s)} aria-current={on ? "true" : undefined}
          sx={{ fontSize: "0.88rem", gap: 1.25, py: 0.8, borderRadius: 0, fontWeight: on ? 700 : 500, color: on ? INK : "#2d3a52",
            "&.Mui-selected": { bgcolor: "rgba(27,122,85,.08)" }, "&.Mui-selected:hover": { bgcolor: "rgba(27,122,85,.12)" } }}>
          <Square colour={colour} />
          <Box component="span" sx={{ flex: 1 }}>{s.label}</Box>
          {on && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: "0.72rem", fontWeight: 700, color: "#1b7a55" }}><CheckIcon sx={{ fontSize: 15 }} />now</Box>}
        </MenuItem>
      );
    }),
    <Divider key="d2" />,
    <MenuItem key="hubspot" component="a" href={ticket.url} target="_blank" rel="noreferrer" onClick={onHubSpot} sx={{ fontSize: "0.88rem", gap: 1.25, py: 0.8, borderRadius: 0 }}>
      <OpenInNewIcon sx={{ fontSize: 16, color: MUTED }} />Open in HubSpot
    </MenuItem>,
    <MenuItem key="plan" onClick={onPlan} sx={{ fontSize: "0.88rem", gap: 1.25, py: 0.8, borderRadius: 0 }}>
      <PlaceOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />Plan &amp; ticket…
    </MenuItem>,
  ];
}

/**
 * The chip on a to-do's line. `onMove` asks for the move and answers null, or what HubSpot said when it refused (the
 * page has put the chip back by then).
 */
export function TicketChip({ ticket, stages, canEdit, disabled, under, onMove, onPlan }: {
  ticket: TodoTicket; stages: TicketStage[]; canEdit: boolean; disabled?: boolean; under?: string | null;
  onMove: (s: TicketStage) => Promise<string | null>; onPlan: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const colour = stageColour(ticket.stageLabel);
  const pick = async (s: TicketStage) => {
    setAnchor(null);
    if (s.value === ticket.stage || !canEdit) return;
    setErr(null);
    const e = await onMove(s);
    if (e) setErr(e);
  };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
      <Tooltip title={anchor ? "" : `Ticket #${ticket.id} in From Scroll to Sale${under ? ` - under "${under}"` : ""}. Click to move it.`}>
        <span>
          <Button size="small" variant="outlined" disabled={disabled} onClick={(e) => { setErr(null); setAnchor(e.currentTarget); }}
            aria-haspopup="menu" aria-expanded={anchor ? "true" : undefined} aria-label={`Ticket #${ticket.id}: ${ticket.stageLabel || "its stage"} - move it`}
            startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 17 }} />} endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ ...btn, borderRadius: "6px", color: INK, borderColor: HAIRLINE, bgcolor: "#fff", pl: 1, "&:hover": { borderColor: colour, bgcolor: "#fafbfd" } }}>
            <Box component="span" sx={{ color: MUTED, mr: 0.75 }}>#{ticket.id}</Box>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: colour, mr: 0.75, flexShrink: 0 }} />
            {ticket.stageLabel || "ticket"}
          </Button>
        </span>
      </Tooltip>
      {err && <Typography role="alert" sx={{ fontSize: "0.8rem", color: RED, maxWidth: 420, lineHeight: 1.35 }}>{err}</Typography>}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { borderRadius: "6px", minWidth: 250, border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 30px rgba(21,34,58,.14)" } }, list: { dense: true, sx: { py: 0.5 } } }}>
        {ticketStageItems({ ticket, stages, canEdit, onPick: (s) => void pick(s), onHubSpot: () => setAnchor(null), onPlan: () => { setAnchor(null); onPlan(); } })}
      </Menu>
    </Box>
  );
}
