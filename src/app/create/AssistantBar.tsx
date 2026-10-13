"use client";

/**
 * THE ASSISTANT, AT THE TOP OF THE STUDIO, WHERE THE TYPING ALREADY HAPPENS.
 *
 * SARCLA asked for this three times in different words before I heard it. The
 * box at the top of Create Studio is where he types; putting the assistant in
 * a panel on the board, then on the rail, meant that from his seat nothing
 * had changed. So the top box is the assistant now.
 *
 * It keeps TWO actions on one box rather than becoming a pure chat window:
 *
 *   Generate — the existing pipeline. A brief in, a full draft out, with the
 *              image and the concepts it has always done. Nobody should have
 *              to ask a chatbot nicely for the thing the button did.
 *   Ask      — the assistant, which can see the project and answers in a
 *              sentence, or offers a change you can apply.
 *
 * The last exchange shows inline underneath. The whole thread lives in the
 * rail panel and on the project board — this is the surface, not the archive.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

type Proposal =
  | { kind: "rewrite-section"; variantId: number; section: string; content: string }
  | { kind: "new-version"; label: string; content: string }
  | { kind: "image"; brief: string };

export type BarTurn = {
  id: number;
  author: string;
  body: string;
  proposal: Proposal | null;
  status: "none" | "pending" | "accepted" | "dismissed";
};

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const PURPLE = "#6a46c9";

function title(p: Proposal): string {
  if (p.kind === "rewrite-section") return `Rewrite “${p.section}”`;
  if (p.kind === "new-version") return `A new version — ${p.label}`;
  return "A picture for this";
}

export default function AssistantBar({
  turn,
  busy,
  onDecide,
  onDismissView,
}: {
  /** The assistant's latest answer, or null when it has not spoken yet. */
  turn: BarTurn | null;
  busy: boolean;
  onDecide: (turnId: number, action: "accept" | "dismiss") => void;
  /** Hide the strip without deciding anything — the answer stays in the thread. */
  onDismissView: () => void;
}) {
  const [deciding, setDeciding] = useState(false);

  if (busy) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25, px: 1.5, py: 1, borderRadius: "12px", bgcolor: "#f5f3fd" }}>
        <CircularProgress size={14} sx={{ color: PURPLE }} />
        <Typography sx={{ fontSize: 12.5, color: PURPLE, fontWeight: 600 }}>Reading the project…</Typography>
      </Box>
    );
  }

  if (!turn) return null;

  const p = turn.proposal;

  return (
    <Box sx={{ mt: 1.25, px: 1.75, py: 1.25, borderRadius: "12px", bgcolor: "#f5f3fd", border: "1px solid #e3dbfa" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: PURPLE, mt: 0.25, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {turn.body}
        </Typography>
        <IconButton size="small" onClick={onDismissView} aria-label="Hide this answer">
          <CloseIcon sx={{ fontSize: 15, color: FAINT }} />
        </IconButton>
      </Box>

      {p && turn.status === "pending" && (
        <Box sx={{ mt: 1.25, pt: 1.25, borderTop: "1px solid #e3dbfa" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: INK, mb: 0.5 }}>{title(p)}</Typography>
          <Typography sx={{
            fontSize: 12.5, color: MUTED, lineHeight: 1.6, whiteSpace: "pre-wrap",
            maxHeight: 160, overflowY: "auto",
          }}>
            {p.kind === "image" ? p.brief : p.content}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              size="small" variant="contained" disableElevation disabled={deciding}
              onClick={() => { setDeciding(true); onDecide(turn.id, "accept"); }}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "9px", bgcolor: PURPLE, "&:hover": { bgcolor: "#5a39ad" } }}
            >
              {p.kind === "image" ? "Use this brief" : "Apply it"}
            </Button>
            <Button
              size="small" disabled={deciding}
              onClick={() => { setDeciding(true); onDecide(turn.id, "dismiss"); }}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px", color: MUTED }}
            >
              No thanks
            </Button>
          </Box>
        </Box>
      )}

      {p && turn.status !== "pending" && (
        <Typography sx={{ fontSize: 11.5, color: FAINT, mt: 0.75 }}>
          {turn.status === "accepted" ? "Applied." : "Declined."}
        </Typography>
      )}
    </Box>
  );
}
