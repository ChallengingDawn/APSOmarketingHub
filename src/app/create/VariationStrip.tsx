"use client";

/**
 * THE PROJECT'S OTHER VERSIONS, DOWN THE RIGHT-HAND SIDE.
 *
 * Express keeps the pages of a document in a column beside the canvas, so you
 * always know how much exists and can move between parts without leaving the
 * editor. Our equivalent is not pages — it is the other variations in the
 * project: the short one, the German one, the one somebody disagreed with.
 *
 * Without it the studio shows one draft and no evidence that anything else
 * exists, which is why writing a second version meant going back to the board
 * and coming in again. A column that is empty on a new project is honest and
 * fills as the work does.
 *
 * Clicking one loads it into the draft panel. It does NOT overwrite anything:
 * the variation you were on is already saved under the project, which is the
 * whole point of saving there.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

import { CONTENT_BY_KEY } from "@/lib/content/contentTypes";

export type StripVariant = {
  id: number;
  label: string | null;
  contentType: string | null;
  language: string | null;
  title: string | null;
  body: string;
  createdBy: string | null;
  createdAt: string;
  /** Present once the assistant or the studio has drawn one. */
  imageUrl?: string | null;
};

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const ACCENT = "#2459d1";

/** The first real line, which is the only honest thumbnail text we have. */
function firstLine(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/[*_`>]/g, "").trim())
    .find((l) => l.length > 0);
  return line ?? "";
}

export default function VariationStrip({
  projectId,
  activeId,
  onOpen,
  refreshKey,
}: {
  projectId: number;
  /** The draft currently on screen, when it is one of these. */
  activeId?: number | null;
  onOpen: (v: StripVariant) => void;
  /** Bump after saving so the new version appears without a reload. */
  refreshKey?: number;
}) {
  const [variants, setVariants] = useState<StripVariant[] | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  /** The two being held up against each other. */
  const [pair, setPair] = useState<[number | null, number | null]>([null, null]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/content/projects/${projectId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setVariants([]);
        setVariants(j.variants ?? []);
        setChosenId(j.project?.chosenVariantId ?? null);
      })
      .catch(() => setVariants([]));
  }, [projectId]);

  useEffect(load, [load, refreshKey]);

  /**
   * Opening the comparison picks the two most recent by default.
   *
   * Asking somebody to choose two before showing them anything is a form to
   * fill in; the pair they most likely mean is the last two they made.
   */
  const openCompare = () => {
    const all = variants ?? [];
    setPair([all[0]?.id ?? null, all[1]?.id ?? null]);
    setComparing(true);
  };

  const left = useMemo(() => (variants ?? []).find((v) => v.id === pair[0]) ?? null, [variants, pair]);
  const right = useMemo(() => (variants ?? []).find((v) => v.id === pair[1]) ?? null, [variants, pair]);

  /** Choosing from inside the comparison: that is the decision it exists for. */
  const choose = async (id: number) => {
    setBusy(true);
    try {
      await fetch(`/api/content/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "choose", variantId: chosenId === id ? null : id }),
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ width: 168, flexShrink: 0, display: { xs: "none", lg: "block" } }}>
      <Box sx={{
        position: "sticky", top: 8, p: 1, borderRadius: "16px",
        bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, maxHeight: "calc(100vh - 32px)", overflowY: "auto",
      }}>
        <Typography sx={{
          fontSize: 10.5, fontWeight: 700, color: FAINT, textTransform: "uppercase",
          letterSpacing: "0.07em", px: 0.5, pb: 0.75,
        }}>
          Versions{variants ? ` · ${variants.length}` : ""}
        </Typography>

        {variants === null && (
          <Typography sx={{ fontSize: 11, color: FAINT, px: 0.5 }}>Loading…</Typography>
        )}

        {variants?.length === 0 && (
          <Typography sx={{ fontSize: 11, color: FAINT, px: 0.5, lineHeight: 1.5 }}>
            Nothing saved yet. Press Save and this fills up.
          </Typography>
        )}

        {variants?.map((v, i) => {
          const on = activeId === v.id;
          const type = v.contentType ? CONTENT_BY_KEY[v.contentType] : undefined;
          return (
            <Tooltip key={v.id} title={`${v.label ?? type?.label ?? "Version"} — ${v.createdBy ?? "somebody"}`} placement="left">
              <Box
                component="button"
                type="button"
                onClick={() => onOpen(v)}
                aria-pressed={on}
                sx={{
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit", p: 0, mb: 1, borderRadius: "10px", overflow: "hidden",
                  border: `1px solid ${on ? ACCENT : HAIRLINE}`,
                  boxShadow: on ? `0 0 0 1px ${ACCENT}` : "none",
                  bgcolor: "#fff",
                  "&:hover": { borderColor: ACCENT },
                }}
              >
                {/* The picture when there is one, the words when there is not.
                    Never a grey rectangle pretending to be a thumbnail — the
                    actual first line tells you more than a placeholder. */}
                {v.imageUrl ? (
                  <Box
                    component="img"
                    src={v.imageUrl}
                    alt=""
                    sx={{
                      display: "block", width: "100%", height: 94, objectFit: "cover",
                      borderBottom: `1px solid ${HAIRLINE}`,
                    }}
                  />
                ) : (
                  <Box sx={{
                    height: 94, p: 1, bgcolor: "#f7f8fa", borderBottom: `1px solid ${HAIRLINE}`,
                    fontSize: 8.5, lineHeight: 1.5, color: MUTED, overflow: "hidden",
                    // The first line set as a headline, so the column reads as
                    // a set of pages rather than a list of paragraphs.
                    fontWeight: 600,
                  }}>
                    {firstLine(v.body).slice(0, 150)}
                  </Box>
                )}
                <Box sx={{ px: 0.75, py: 0.6, display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Typography sx={{
                    fontSize: 10.5, fontWeight: on ? 700 : 600, color: INK, flex: 1,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {v.label ?? type?.label ?? `Version ${i + 1}`}
                  </Typography>
                  {chosenId === v.id && <CheckCircleIcon sx={{ fontSize: 13, color: "#1b7a55" }} />}
                  {v.language && v.language !== "EN" && (
                    <Typography sx={{ fontSize: 9, color: FAINT }}>{v.language}</Typography>
                  )}
                </Box>
              </Box>
            </Tooltip>
          );
        })}

        {/* Only when there IS something to compare. Offering it with nothing
            saved is how it came to be pressed first and do nothing. */}
        {(variants?.length ?? 0) >= 2 && (
          <Box
            component="button"
            type="button"
            onClick={openCompare}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
              width: "100%", mt: 0.5, py: 0.75, borderRadius: "10px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 10.5, fontWeight: 600, color: MUTED,
              bgcolor: "transparent", border: `1px dashed ${HAIRLINE}`,
              "&:hover": { color: ACCENT, borderColor: ACCENT },
            }}
          >
            <CompareArrowsIcon sx={{ fontSize: 14 }} />
            Compare them
          </Box>
        )}
      </Box>

      {/* Two drafts beside each other, which is the decision this whole app
          exists to support. Previously this was a link that left the editor. */}
      <Dialog open={comparing} onClose={() => setComparing(false)} fullWidth maxWidth="xl"
        PaperProps={{ sx: { borderRadius: "18px", height: "88vh" } }}>
        <Box sx={{
          px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}>
          <CompareArrowsIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, flex: 1 }}>
            Two versions, side by side
          </Typography>
          <IconButton size="small" onClick={() => setComparing(false)} aria-label="Close">
            <CloseIcon sx={{ fontSize: 18, color: FAINT }} />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0, display: "flex", minHeight: 0 }}>
          {([0, 1] as const).map((side) => {
            const v = side === 0 ? left : right;
            return (
              <Box
                key={side}
                sx={{
                  flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                  borderRight: side === 0 ? `1px solid ${HAIRLINE}` : 0,
                }}
              >
                {/* Each side picks its own version, so you can hold any two
                    against each other rather than only the newest pair. */}
                <Box sx={{ px: 1.5, py: 1, display: "flex", gap: 0.5, flexWrap: "wrap", borderBottom: `1px solid ${HAIRLINE}` }}>
                  {(variants ?? []).map((cand) => {
                    const on = cand.id === (side === 0 ? pair[0] : pair[1]);
                    return (
                      <Box
                        key={cand.id}
                        component="button"
                        type="button"
                        onClick={() => setPair((cur) => (side === 0 ? [cand.id, cur[1]] : [cur[0], cand.id]))}
                        sx={{
                          cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: on ? 700 : 500,
                          px: 1, py: 0.4, borderRadius: "999px", border: `1px solid ${on ? ACCENT : HAIRLINE}`,
                          bgcolor: on ? "#eef3ff" : "#fff", color: on ? ACCENT : MUTED,
                          maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {cand.label ?? `Version ${(variants ?? []).indexOf(cand) + 1}`}
                      </Box>
                    );
                  })}
                </Box>

                <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                  {!v ? (
                    <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>
                      Pick a version above.
                    </Typography>
                  ) : (
                    <>
                      {v.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={v.imageUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 14, display: "block" }} />
                      )}
                      {v.title && (
                        <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK, mb: 1 }}>
                          {v.title}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: "0.9rem", color: INK, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                        {v.body}
                      </Typography>
                    </>
                  )}
                </Box>

                {v && (
                  <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontSize: 11, color: FAINT, flex: 1 }}>
                      {v.createdBy ?? "somebody"}
                      {v.language ? ` · ${v.language}` : ""}
                      {` · ${Math.max(1, v.body.trim().split(/\s+/).length)} words`}
                    </Typography>
                    <Button
                      size="small"
                      disabled={busy}
                      variant={chosenId === v.id ? "contained" : "outlined"}
                      onClick={() => void choose(v.id)}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}
                    >
                      {chosenId === v.id ? "Chosen" : "Choose this"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => { onOpen(v); setComparing(false); }}
                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                    >
                      Open it
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
