"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  TOP_RECOMMENDATIONS,
  buildAdvice,
  type AdvisorAction,
  type AdvisorBrainSignals,
  type AdvisorContentItem,
  type Recommendation,
  type Severity,
} from "@/lib/advisor";

/* The hero sits on the navy gradient, so EVERY text colour here is stated
 * explicitly in a light value — inheriting MUI's default ink once left dark
 * text unreadable on the dark panel. */
const ON_NAVY = "#ffffff";
const ON_NAVY_SOFT = "rgba(255,255,255,0.78)";
const ON_NAVY_FAINT = "rgba(255,255,255,0.55)";
const ON_NAVY_LINE = "rgba(255,255,255,0.14)";
const ON_NAVY_PANEL = "rgba(255,255,255,0.08)";
const ON_NAVY_PANEL_LINE = "rgba(255,255,255,0.18)";
const INK = "#1a1d21";
const RED = "#ed1b2f";

/** Severity dots, tuned for contrast against the navy panel. */
const SEVERITY_DOT: Record<Severity, string> = {
  critical: "#ff5f6d",
  attention: "#ffc247",
  opportunity: "#79d6ae",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Blocking",
  attention: "Needs you",
  opportunity: "Opportunity",
};

type AdvisorReply = {
  answer: string;
  actions: AdvisorAction[];
  sources: { content: boolean; brain: boolean };
};

type Props = {
  greeting: string;
  /** Pre-formatted date line; the page owns it so the hero stays pure. */
  today: string;
  /** `null` means the library could not be read — never "empty". */
  items: AdvisorContentItem[] | null;
  /** `null` means the brand brain could not be read. */
  brain: AdvisorBrainSignals | null;
  /** False while the two sources are still in flight. */
  ready: boolean;
};

function ActionButton({ action, dense }: { action: AdvisorAction; dense?: boolean }) {
  return (
    <Button
      component={Link}
      href={action.href}
      size="small"
      variant="outlined"
      endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
      sx={{
        flexShrink: 0,
        whiteSpace: "nowrap",
        fontSize: dense ? 11.5 : 12,
        fontWeight: 700,
        color: ON_NAVY,
        borderColor: ON_NAVY_PANEL_LINE,
        bgcolor: "rgba(255,255,255,0.06)",
        px: 1.5,
        "&:hover": { borderColor: ON_NAVY, bgcolor: "rgba(255,255,255,0.16)" },
      }}
    >
      {action.label}
    </Button>
  );
}

function RecommendationRow({ rec, first }: { rec: Recommendation; first: boolean }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        py: 1.25,
        borderTop: first ? "none" : `1px solid ${ON_NAVY_LINE}`,
        flexWrap: { xs: "wrap", sm: "nowrap" },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          bgcolor: SEVERITY_DOT[rec.severity],
          mt: 0.7,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: ON_NAVY, lineHeight: 1.35 }}>
          <Box
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: SEVERITY_DOT[rec.severity],
              mr: 1,
            }}
          >
            {SEVERITY_LABEL[rec.severity]}
          </Box>
          {rec.headline}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: ON_NAVY_SOFT, mt: 0.25, lineHeight: 1.5 }}>
          {rec.evidence}
        </Typography>
      </Box>
      <ActionButton action={rec.action} />
    </Box>
  );
}

/**
 * The Overview hero: an advisor, not a prompt box.
 *
 * It opens with what the deterministic engine (src/lib/advisor.ts) says needs
 * attention — each row carrying the figure it was derived from — and only then
 * offers a free-text question. Nothing here generates content: every route to
 * generation goes through Create Studio.
 */
export default function AdvisorHero({ greeting, today, items, brain, ready }: Props) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<AdvisorReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `now` is captured once per render pass of the memo; the engine is pure, so
  // the same inputs always yield the same rows.
  const advice = useMemo(
    () => (ready ? buildAdvice({ items, brain, now: Date.now() }) : []),
    [items, brain, ready]
  );
  const top = advice.slice(0, TOP_RECOMMENDATIONS);

  const ask = async () => {
    if (asking) return;
    setAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = (await res.json()) as Partial<AdvisorReply> & { error?: string };
      if (!res.ok || typeof data.answer !== "string") {
        setReply(null);
        setError(data.error ?? "The advisor could not answer — try again.");
      } else {
        setReply({
          answer: data.answer,
          actions: Array.isArray(data.actions) ? data.actions : [],
          sources: data.sources ?? { content: true, brain: true },
        });
      }
    } catch {
      setReply(null);
      setError("Network error — the advisor could not be reached.");
    } finally {
      setAsking(false);
    }
  };

  const missingSources = reply
    ? [!reply.sources.content ? "the content library" : null, !reply.sources.brain ? "the brand brain" : null]
        .filter((s): s is string => Boolean(s))
    : [];

  return (
    <Card
      sx={{
        mb: 2.5,
        background: "linear-gradient(120deg, #16303f 0%, #274e64 55%, #35657f 100%)",
        color: ON_NAVY,
        border: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: -60,
          top: -60,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(237,27,47,0.35) 0%, rgba(237,27,47,0) 70%)",
        }}
      />
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, position: "relative" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontFamily: "var(--font-outfit)",
                fontSize: { xs: 24, md: 30 },
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: ON_NAVY,
              }}
            >
              {greeting}.
            </Typography>
            <Typography sx={{ fontSize: 14, color: ON_NAVY_SOFT, mt: 0.5 }} suppressHydrationWarning>
              {today}
            </Typography>
          </Box>
          <Chip
            icon={<AutoAwesomeIcon sx={{ color: `${ON_NAVY} !important`, fontSize: 16 }} />}
            label="Advisor"
            sx={{ bgcolor: "rgba(255,255,255,0.12)", color: ON_NAVY, fontWeight: 600, fontSize: 12 }}
          />
        </Box>

        {/* ── what the numbers say needs doing ── */}
        <Typography
          sx={{
            mt: 2.5,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ON_NAVY_FAINT,
          }}
        >
          What needs you now
        </Typography>

        <Box sx={{ mt: 0.5 }}>
          {!ready && (
            <Typography sx={{ fontSize: 13.5, color: ON_NAVY_SOFT, py: 1.5 }}>
              Reading your library and demand signals…
            </Typography>
          )}
          {ready && top.length === 0 && (
            <Typography sx={{ fontSize: 13.5, color: ON_NAVY_SOFT, py: 1.5 }}>
              Nothing in your data crosses a threshold right now — no stale drafts, no unscheduled
              approvals, no open category gap. Ask below if you want a second opinion.
            </Typography>
          )}
          {ready &&
            top.map((rec, i) => <RecommendationRow key={rec.id} rec={rec} first={i === 0} />)}
        </Box>

        {/* ── ask the advisor ── */}
        <Box
          sx={{
            mt: 2.5,
            display: "flex",
            gap: 1.25,
            alignItems: "center",
            flexWrap: { xs: "wrap", md: "nowrap" },
            bgcolor: ON_NAVY_PANEL,
            border: `1px solid ${ON_NAVY_PANEL_LINE}`,
            borderRadius: 2,
            p: 1.25,
            backdropFilter: "blur(6px)",
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder={'Ask what to prioritise, e.g. "what should I publish this week?"'}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            inputProps={{ maxLength: 500, "aria-label": "Ask the advisor what to prioritise" }}
            sx={{
              "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 1.5 },
              "& .MuiOutlinedInput-input": { color: INK },
            }}
          />
          <Button
            onClick={ask}
            disabled={asking}
            variant="contained"
            startIcon={
              asking ? <CircularProgress size={16} sx={{ color: ON_NAVY }} /> : <AutoAwesomeIcon />
            }
            sx={{
              bgcolor: RED,
              whiteSpace: "nowrap",
              px: 3,
              "&:hover": { bgcolor: "#d81528" },
              "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.6)" },
            }}
          >
            {asking ? "Thinking…" : "Ask the advisor"}
          </Button>
        </Box>

        {error && (
          <Typography sx={{ fontSize: 12.5, color: "#ffb3ba", mt: 1, ml: 0.5 }}>{error}</Typography>
        )}

        {reply && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.75,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.10)",
              border: `1px solid ${ON_NAVY_PANEL_LINE}`,
            }}
          >
            <Typography
              component="p"
              sx={{ fontSize: 13.5, color: ON_NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap" }}
            >
              {reply.answer}
            </Typography>
            {missingSources.length > 0 && (
              <Typography sx={{ fontSize: 11.5, color: "#ffc247", mt: 1 }}>
                Answered without {missingSources.join(" and ")} — that source could not be read.
              </Typography>
            )}
            {reply.actions.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                {reply.actions.map((a) => (
                  <ActionButton key={a.href} action={a} dense />
                ))}
              </Box>
            )}
          </Box>
        )}

        <Typography sx={{ fontSize: 11.5, color: ON_NAVY_FAINT, mt: 1.25, ml: 0.5 }}>
          Writing happens in{" "}
          <Link href="/create" style={{ color: ON_NAVY, fontWeight: 600 }}>
            Create Studio
          </Link>
          {" — personas, keywords and images live there. Every result is saved to the Library as a draft."}
        </Typography>
      </CardContent>
    </Card>
  );
}
