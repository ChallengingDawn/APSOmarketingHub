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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

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

        <Box
          component={Link}
          href={`/projects/${projectId}`}
          sx={{
            display: "block", textAlign: "center", mt: 0.5, py: 0.75, borderRadius: "10px",
            textDecoration: "none", fontSize: 10.5, fontWeight: 600, color: MUTED,
            border: `1px dashed ${HAIRLINE}`,
            "&:hover": { color: ACCENT, borderColor: ACCENT },
          }}
        >
          Compare them
        </Box>
      </Box>
    </Box>
  );
}
