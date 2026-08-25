"use client";

/**
 * The scannable worst-first list of stored pieces.
 *
 * A row states four things and no more: the score, what the piece is, the ONE
 * reason it scores that, and the one action worth taking. Twenty rows have to
 * be readable in about five seconds, so the full per-check breakdown — seven
 * verdicts, their measured values and their fixes — is behind "Details" and
 * closed by default.
 *
 * Every score was computed from a stored body. Nothing here is illustrative.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Link from "next/link";
import { derivedTitle, GEO_BAND_LABELS, type GeoBand, type GeoCheckResult } from "@/lib/geo/audit";
import { geoImproveHref, recoverablePoints } from "@/lib/geo/fixQueue";
import type { ScoredPiece } from "./useGeoLibrary";
import {
  C,
  DISPLAY_FONT,
  GeoFilterBar,
  Panel,
  ScoreBadge,
  SectionLabel,
  VERDICT_COLOR,
} from "./geoUi";
import CheckResults from "./CheckResults";

/** The check costing this piece the most points — the row's one-line reason. */
function worstCheck(checks: readonly GeoCheckResult[]): GeoCheckResult | null {
  let worst: GeoCheckResult | null = null;
  for (const c of checks) {
    if (c.verdict === "pass") continue;
    if (!worst || recoverablePoints(c) > recoverablePoints(worst)) worst = c;
  }
  return worst;
}

function Row({ scored }: { scored: ScoredPiece }) {
  const [open, setOpen] = useState(false);
  const { item, audit } = scored;
  const title = item.title?.trim() || derivedTitle(item.body) || `Piece #${item.id}`;
  const worst = worstCheck(audit.checks);
  const problems = audit.checks.filter((c) => c.verdict !== "pass").length;

  return (
    <Box sx={{ borderTop: `1px solid ${C.hairline}` }}>
      <Box
        sx={{
          display: "grid",
          alignItems: "center",
          columnGap: { xs: 2, lg: 3 },
          rowGap: 1.5,
          px: { xs: 2, md: 2.5 },
          py: 2.25,
          gridTemplateColumns: {
            xs: "auto minmax(0, 1fr)",
            lg: "auto minmax(220px, 1fr) minmax(0, 1.5fr) auto",
          },
          gridTemplateAreas: {
            xs: `"score meta" "reason reason" "action action"`,
            lg: `"score meta reason action"`,
          },
          "&:hover": { bgcolor: C.surface },
        }}
      >
        <Box sx={{ gridArea: "score" }}>
          <ScoreBadge score={audit.score} />
        </Box>

        <Box sx={{ gridArea: "meta", minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: 15,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title}
          >
            {title}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.5 }}>
            {item.channel} · {GEO_BAND_LABELS[audit.band]} · {audit.stats.words} words
          </Typography>
        </Box>

        <Box sx={{ gridArea: "reason", minWidth: 0 }}>
          {worst ? (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, minWidth: 0 }}>
              <Tooltip
                title={`${worst.label} scores ${worst.score}/100 at weight ${worst.weight}, so ${recoverablePoints(
                  worst
                ).toFixed(1)} of this piece's 100 points are unearned.`}
              >
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: VERDICT_COLOR[worst.verdict],
                    whiteSpace: "nowrap",
                    cursor: "help",
                  }}
                >
                  −{recoverablePoints(worst).toFixed(1)}
                </Typography>
              </Tooltip>
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: C.muted,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`${worst.label}: ${worst.measured}`}
              >
                <strong style={{ color: C.ink, fontWeight: 600 }}>{worst.label}</strong> — {worst.measured}
              </Typography>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: VERDICT_COLOR.pass, fontWeight: 600 }}>
              All seven checks pass — an answer engine can lift this piece as written.
            </Typography>
          )}
          {problems > 1 && (
            <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.5 }}>
              {audit.failing.length} failing, {audit.warning.length} warning
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            gridArea: "action",
            display: "flex",
            alignItems: "center",
            gap: 1,
            justifyContent: { xs: "flex-start", lg: "flex-end" },
            flexShrink: 0,
          }}
        >
          <Button
            size="small"
            onClick={() => setOpen((v) => !v)}
            endIcon={
              <ExpandMoreIcon
                fontSize="small"
                sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            }
            sx={{
              textTransform: "none",
              color: C.muted,
              fontWeight: 600,
              fontSize: 12.5,
              px: 0.75,
              minWidth: 0,
              whiteSpace: "nowrap",
              "&:hover": { color: C.navy, bgcolor: "transparent" },
            }}
          >
            Details
          </Button>
          {problems > 0 && (
            <Button
              component={Link}
              href={geoImproveHref({ channel: item.channel, pieceId: item.id, audit })}
              size="small"
              variant="contained"
              disableElevation
              startIcon={<AutoFixHighIcon fontSize="small" />}
              sx={{
                bgcolor: C.navy,
                borderRadius: "2px",
                textTransform: "none",
                fontWeight: 600,
                fontSize: 12.5,
                px: 1.75,
                whiteSpace: "nowrap",
                "&:hover": { bgcolor: "#1a3a4c" },
              }}
            >
              Fix in Studio
            </Button>
          )}
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 3, pt: 0.5, bgcolor: C.white }}>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mb: 1 }}>
            {item.status} · created {item.createdAt.slice(0, 10)} · piece #{item.id}
          </Typography>
          <CheckResults audit={audit} />
        </Box>
      </Collapse>
    </Box>
  );
}

export default function ContentReadinessPanel({
  visible,
  total,
  channel,
  band,
  channels,
  onChannel,
  onBand,
}: {
  /** Pieces passing the current filters, worst first. */
  visible: ScoredPiece[];
  /** Pieces scored in total, before filtering. */
  total: number;
  channel: string;
  band: "all" | GeoBand;
  channels: readonly string[];
  onChannel: (v: string) => void;
  onBand: (v: "all" | GeoBand) => void;
}) {
  return (
    <Panel>
      <GeoFilterBar
        channel={channel}
        band={band}
        channels={channels}
        onChannel={onChannel}
        onBand={onBand}
        left={
          <SectionLabel>
            Worst first · {visible.length} of {total} shown
          </SectionLabel>
        }
      />

      {visible.length === 0 ? (
        <Box sx={{ p: 5, textAlign: "center", borderTop: `1px solid ${C.hairline}` }}>
          <Typography sx={{ fontSize: 13.5, color: C.muted }}>
            No piece matches this channel and score band. Widen the filters — nothing is hidden beyond them.
          </Typography>
        </Box>
      ) : (
        visible.map((s) => <Row key={s.item.id} scored={s} />)
      )}
    </Panel>
  );
}
