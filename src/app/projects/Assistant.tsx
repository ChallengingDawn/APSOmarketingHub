"use client";

/**
 * THE PROJECT'S ASSISTANT, ON THE PROJECT.
 *
 * Shared, because SARCLA chose shared: the conversation is part of the record
 * like the comments beside each version, and "why is the headline like that"
 * should be answerable from the project six months later rather than from
 * somebody's memory.
 *
 * It proposes and a person accepts. That is not timidity — it is what makes
 * it usable by more than one person. A proposal here is a thing you can read
 * before it exists, argue with, and refuse on the record; an assistant that
 * silently rewrote section four while a colleague was reading it would be
 * worse than no assistant.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";

type Proposal =
  | { kind: "rewrite-section"; variantId: number; section: string; content: string }
  | { kind: "new-version"; label: string; content: string }
  | { kind: "image"; brief: string };

type Turn = {
  id: number;
  author: string;
  body: string;
  proposal: Proposal | null;
  status: "none" | "pending" | "accepted" | "dismissed";
  decidedBy: string | null;
  createdAt: string;
};

const ACCENT = "#2459d1";

/** Things worth asking that somebody would not think to type. */
const OPENERS = [
  // Writing comes first now. With the brief bar gone this is how work
  // starts, and nobody should have to guess the words that start it.
  "Write the first draft",
  "Make a picture for it",
  "What is missing from the best version?",
  "Is this written for the audience in the brief?",
];

function proposalTitle(p: Proposal): string {
  if (p.kind === "rewrite-section") return `Rewrite “${p.section}”`;
  if (p.kind === "new-version") return `A new version — ${p.label}`;
  return "A picture for this";
}

function proposalBody(p: Proposal): string {
  if (p.kind === "image") return p.brief;
  return p.content;
}

export default function Assistant({
  projectId,
  canEdit,
  onApplied,
  bare = false,
}: {
  projectId: number;
  /** A commenter may ask, but may not accept. */
  canEdit: boolean;
  onApplied: () => void;
  /**
   * Inside the floating window, which already has its own frame and title.
   * A card and a heading in there would be a box in a box with the name
   * written twice.
   */
  bare?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    fetch(`/api/content/projects/${projectId}/assistant`)
      .then((r) => r.json())
      .then((j) => setTurns(j.ok ? j.turns : []))
      .catch(() => setTurns([]));
  }, [projectId]);
  useEffect(load, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    try {
      const j = await fetch(`/api/content/projects/${projectId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", body: question }),
      }).then((r) => r.json());
      if (j.ok) setTurns(j.turns);
      else setError(j.error ?? "That did not go through.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (turnId: number, action: "accept" | "dismiss") => {
    setDeciding(turnId);
    setError(null);
    try {
      const j = await fetch(`/api/content/projects/${projectId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, turnId }),
      }).then((r) => r.json());
      if (!j.ok) setError(j.error ?? "That could not be applied.");
      else if (action === "accept") onApplied();
      load();
    } finally {
      setDeciding(null);
    }
  };

  const body = (
    <>
      {!bare && (
      <CardTitle
        icon={<AutoAwesomeIcon />}
        tint="purple"
        title="Assistant"
        note="It can see this whole project — the brief, every version, and what people said. It proposes; you accept."
      />
      )}

      <Box sx={{ maxHeight: 420, overflowY: "auto", pr: 0.5 }}>
        {turns === null && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Loading…</Typography>}

        {turns?.length === 0 && (
          <Box sx={{ pb: 1 }}>
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6, mb: 1.5 }}>
              Ask it anything about this project. It reads the type&rsquo;s required sections, so it can tell you
              what is missing rather than only what is there.
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {OPENERS.map((o) => (
                <Box
                  key={o}
                  component="button"
                  type="button"
                  onClick={() => ask(o)}
                  sx={{
                    cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem",
                    px: 1.1, py: 0.6, borderRadius: "999px",
                    border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: MUTED,
                    "&:hover": { borderColor: ACCENT, color: ACCENT },
                  }}
                >
                  {o}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {turns?.map((t) => {
          const mine = t.author !== "assistant";
          return (
            <Box key={t.id} sx={{ mb: 1.75 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: mine ? MUTED : ACCENT, mb: 0.25 }}>
                {mine ? t.author : "Assistant"}
              </Typography>
              <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {t.body}
              </Typography>

              {t.proposal && (
                <Box sx={{
                  mt: 1, p: 1.5, borderRadius: "12px",
                  border: `1px solid ${t.status === "pending" ? ACCENT : HAIRLINE}`,
                  bgcolor: t.status === "pending" ? "#f7f9ff" : "rgba(21,34,58,.03)",
                }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, mb: 0.5 }}>
                    {proposalTitle(t.proposal)}
                  </Typography>
                  <Typography sx={{
                    fontSize: "0.82rem", color: MUTED, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    maxHeight: 220, overflowY: "auto",
                  }}>
                    {proposalBody(t.proposal)}
                  </Typography>

                  {t.status === "pending" ? (
                    canEdit ? (
                      <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
                        <Button
                          size="small" variant="contained" disableElevation
                          disabled={deciding === t.id}
                          onClick={() => decide(t.id, "accept")}
                          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px" }}
                        >
                          {t.proposal.kind === "image" ? "Draw it" : "Apply it"}
                        </Button>
                        <Button
                          size="small" disabled={deciding === t.id}
                          onClick={() => decide(t.id, "dismiss")}
                          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px", color: MUTED }}
                        >
                          No thanks
                        </Button>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>
                        An editor on this project can apply this.
                      </Typography>
                    )
                  ) : (
                    <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>
                      {t.status === "accepted" ? "Applied" : "Declined"}
                      {t.decidedBy ? ` by ${t.decidedBy}` : ""}.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
        <div ref={endRef} />
      </Box>

      {error && (
        <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mt: 1 }}>{error}</Typography>
      )}

      <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
        <TextField
          size="small" fullWidth multiline maxRows={5}
          placeholder="Ask it something, or tell it what to change…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: 13.5, borderRadius: "10px" } }}
        />
        <Button
          onClick={() => ask(text)}
          disabled={busy || !text.trim()}
          variant="contained" disableElevation
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", flexShrink: 0, minWidth: 44 }}
        >
          {busy ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
        </Button>
      </Box>
    </>
  );

  // The window supplies its own frame; the board needs one.
  return bare ? body : <GlassCard>{body}</GlassCard>;
}
