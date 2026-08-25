"use client";

/**
 * AUDIT · stored pieces — the worst-first readiness list.
 *
 * Receives its scored pieces from the page (one library load feeds both halves
 * of the cockpit) and renders one row per stored body. At full width the row
 * shows *why* a piece scores what it scores: each failing check appears inline
 * with the value that was measured and the points it is forfeiting, instead of
 * being truncated into a chip you have to expand to read.
 *
 * Every score here was computed from a stored body. Nothing is illustrative.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Link from "next/link";
import {
  derivedTitle,
  GEO_BAND_LABELS,
  type GeoBand,
  type GeoCheckResult,
} from "@/lib/geo/audit";
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
  VERDICT_LABEL,
  VerdictChip,
} from "./geoUi";
import CheckResults from "./CheckResults";

/** One failing or warning check, stated with the value behind the verdict. */
function InlineCheck({ check }: { check: GeoCheckResult }) {
  const color = VERDICT_COLOR[check.verdict];
  const points = recoverablePoints(check);
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", minWidth: 0 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color, mt: 0.75, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
            {check.label}
          </Typography>
          <Tooltip
            title={`${VERDICT_LABEL[check.verdict]} — scoring ${check.score}/100 at weight ${check.weight}, so ${points.toFixed(1)} of the piece's 100 points are unearned.`}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color, cursor: "help" }}>
              −{points.toFixed(1)} pts
            </Typography>
          </Tooltip>
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.45,
            mt: 0.125,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {check.measured}
        </Typography>
      </Box>
    </Box>
  );
}

function Row({
  scored,
  expanded,
  onToggle,
}: {
  scored: ScoredPiece;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { item, audit } = scored;
  const title = item.title?.trim() || derivedTitle(item.body) || `Piece #${item.id}`;
  const problems = audit.checks.filter((c) => c.verdict !== "pass");

  return (
    <Box sx={{ borderTop: `1px solid ${C.hairline}`, "&:hover": { bgcolor: C.surface } }}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, lg: 2.5 },
          alignItems: "start",
          px: { xs: 1.5, md: 2 },
          py: 2,
          gridTemplateColumns: {
            xs: "auto minmax(0, 1fr)",
            lg: "auto minmax(240px, 1fr) minmax(0, 1.8fr) auto",
          },
          gridTemplateAreas: {
            xs: `"score meta" "checks checks" "actions actions"`,
            lg: `"score meta checks actions"`,
          },
        }}
      >
        <Box sx={{ gridArea: "score" }}>
          <ScoreBadge score={audit.score} />
        </Box>

        <Box sx={{ gridArea: "meta", minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: 15.5,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.5, lineHeight: 1.5 }}>
            {item.channel} · {item.status} · {audit.stats.words} words · {item.createdAt.slice(0, 10)}
          </Typography>
          <Box sx={{ mt: 0.875 }}>
            <VerdictChip
              verdict={problems.length === 0 ? "pass" : audit.failing.length ? "fail" : "warn"}
              label={`${GEO_BAND_LABELS[audit.band]} · ${audit.failing.length} failing, ${audit.warning.length} warning`}
            />
          </Box>
        </Box>

        <Box sx={{ gridArea: "checks", minWidth: 0 }}>
          {problems.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: VERDICT_COLOR.pass, fontWeight: 600 }}>
              All seven checks pass — an answer engine can lift this piece as written.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                columnGap: 2.5,
                rowGap: 1.25,
              }}
            >
              {problems.map((c) => (
                <InlineCheck key={c.id} check={c} />
              ))}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            gridArea: "actions",
            display: "flex",
            flexDirection: { xs: "row", lg: "column" },
            gap: 0.75,
            alignItems: "stretch",
            flexShrink: 0,
          }}
        >
          <Button
            size="small"
            onClick={onToggle}
            endIcon={
              <ExpandMoreIcon
                fontSize="small"
                sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            }
            sx={{ textTransform: "none", color: C.navy, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}
          >
            {expanded ? "Hide detail" : "Full audit"}
          </Button>
          <Button
            component={Link}
            href={geoImproveHref({ channel: item.channel, pieceId: item.id, audit })}
            size="small"
            variant="outlined"
            startIcon={<AutoFixHighIcon fontSize="small" />}
            disabled={problems.length === 0}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 12.5,
              borderRadius: "2px",
              borderColor: C.navy,
              color: C.navy,
              whiteSpace: "nowrap",
              "&:hover": { borderColor: C.navy, bgcolor: `${C.navy}0a` },
            }}
          >
            Improve
          </Button>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2.5, bgcolor: C.white }}>
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
  expandedId,
  onExpand,
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
  expandedId: number | null;
  onExpand: (id: number | null) => void;
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
        <Box sx={{ p: 4, textAlign: "center", borderTop: `1px solid ${C.hairline}` }}>
          <Typography sx={{ fontSize: 13.5, color: C.muted }}>
            No piece matches this channel and score band. Widen the filters — nothing is hidden beyond them.
          </Typography>
        </Box>
      ) : (
        visible.map((s) => (
          <Row
            key={s.item.id}
            scored={s}
            expanded={expandedId === s.item.id}
            onToggle={() => onExpand(expandedId === s.item.id ? null : s.item.id)}
          />
        ))
      )}
    </Panel>
  );
}
