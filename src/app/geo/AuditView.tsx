"use client";

/**
 * SUB-APP 01 · AUDIT — the diagnostic half of the GEO cockpit.
 *
 * Three bands, in the order a diagnosis is read: where the portfolio stands,
 * which stored pieces are worst, and how a published page scores when it is
 * fetched as an answer engine would find it.
 *
 * The scores come from the shared library load in the page, so this half and
 * the IMPROVE half can never disagree about the same piece.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  GEO_BAND_LABELS,
  geoBand,
  type GeoBand,
} from "@/lib/geo/audit";
import { geoPortfolioFixes } from "@/lib/geo/fixQueue";
import type { GeoLibraryState, ScoredPiece } from "./useGeoLibrary";
import { FETCH_LIMIT } from "./useGeoLibrary";
import {
  BAND_COLOR,
  BAND_ORDER,
  bandRangeLabel,
  C,
  DISPLAY_FONT,
  DistributionBar,
  EmptyStateCard,
  LoadingCard,
  Measure,
  Panel,
  ScoreBadge,
  SectionLabel,
  SectionRule,
  Stat,
  UpstreamErrorCard,
} from "./geoUi";
import ContentReadinessPanel from "./ContentReadinessPanel";
import LivePageReadinessPanel from "./LivePageReadinessPanel";

const EYEBROW = "Audit";

function PortfolioBand({
  pieces,
  onGoToImprove,
}: {
  pieces: ScoredPiece[];
  onGoToImprove: () => void;
}) {
  const avg = Math.round(pieces.reduce((sum, p) => sum + p.audit.score, 0) / pieces.length);
  const counts: Record<GeoBand, number> = { strong: 0, workable: 0, weak: 0, poor: 0 };
  for (const p of pieces) counts[p.audit.band] += 1;

  // The single check the library forfeits the most points on. Same arithmetic
  // the IMPROVE half ranks with — one source, two presentations.
  const worst = geoPortfolioFixes(pieces.map((p) => p.audit))[0] ?? null;

  const needWork = pieces.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass")).length;

  return (
    <Panel sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2.5, md: 4 },
          alignItems: "start",
          gridTemplateColumns: {
            xs: "1fr",
            md: "auto minmax(0, 1fr)",
            lg: "auto minmax(280px, 1.2fr) minmax(260px, 1fr)",
          },
        }}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <ScoreBadge score={avg} size="lg" title={`Portfolio average across ${pieces.length} scored pieces`} />
          <Box>
            <SectionLabel>Portfolio readiness</SectionLabel>
            <Typography
              sx={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 500, color: C.ink, mt: 0.5 }}
            >
              {GEO_BAND_LABELS[geoBand(avg)]}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 0.25 }}>
              Mean of {pieces.length} scored {pieces.length === 1 ? "piece" : "pieces"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <SectionLabel sx={{ mb: 1 }}>Distribution by band</SectionLabel>
          <DistributionBar
            total={pieces.length}
            segments={BAND_ORDER.map((b) => ({
              label: `${GEO_BAND_LABELS[b]} (${bandRangeLabel(b)})`,
              count: counts[b],
              color: BAND_COLOR[b],
            }))}
          />
          <Box sx={{ display: "flex", gap: 4, mt: 2.5, flexWrap: "wrap" }}>
            <Stat value={pieces.length} label="Pieces scored" size="sm" />
            <Stat
              value={needWork}
              label="With at least one problem"
              size="sm"
              color={needWork ? BAND_COLOR.weak : BAND_COLOR.strong}
            />
            <Stat
              value={counts.poor + counts.weak}
              label={`Below ${GEO_BAND_LABELS.workable.toLowerCase()}`}
              size="sm"
              color={counts.poor + counts.weak ? BAND_COLOR.poor : BAND_COLOR.strong}
            />
          </Box>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            borderLeft: { lg: `1px solid ${C.hairline}` },
            pl: { lg: 3 },
          }}
        >
          <SectionLabel sx={{ mb: 1 }}>Biggest drag across the library</SectionLabel>
          {worst ? (
            <>
              <Typography
                sx={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}
              >
                {worst.label}
              </Typography>
              <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.75, lineHeight: 1.55 }}>
                <strong style={{ color: C.ink }}>{Math.round(worst.points)} weighted points</strong> lost in
                total, across {worst.pieces} of {pieces.length}{" "}
                {pieces.length === 1 ? "piece" : "pieces"} ({worst.failing} failing outright). Worth{" "}
                <strong style={{ color: C.ink }}>+{worst.averageLift.toFixed(1)}</strong> on the portfolio
                average if fixed everywhere.
              </Typography>
              <Button
                size="small"
                onClick={onGoToImprove}
                endIcon={<ArrowForwardIcon fontSize="small" />}
                sx={{ mt: 1.25, textTransform: "none", color: C.navy, fontWeight: 700, fontSize: 12.5, px: 0 }}
              >
                See the full fix queue
              </Button>
            </>
          ) : (
            <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              Every check passes on every scored piece — the library is forfeiting no points.
            </Typography>
          )}
        </Box>
      </Box>
    </Panel>
  );
}

export default function AuditView({
  state,
  reload,
  visible,
  channels,
  channel,
  band,
  onChannel,
  onBand,
  expandedId,
  onExpand,
  onGoToImprove,
}: {
  state: GeoLibraryState;
  reload: () => void;
  visible: ScoredPiece[];
  channels: readonly string[];
  channel: string;
  band: "all" | GeoBand;
  onChannel: (v: string) => void;
  onBand: (v: "all" | GeoBand) => void;
  expandedId: number | null;
  onExpand: (id: number | null) => void;
  onGoToImprove: () => void;
}) {
  const pieces = state.phase === "ready" ? state.pieces : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <Box component="section">
        <SectionRule eyebrow={EYEBROW} title="Portfolio readiness" />
        {state.phase === "loading" && <LoadingCard label="Auditing the content library…" />}
        {state.phase === "error" && (
          <UpstreamErrorCard source="The content library" error={state.message} onRetry={reload} />
        )}
        {state.phase === "ready" &&
          (pieces.length === 0 ? (
            <EmptyStateCard
              title="No content pieces to audit"
              body="The content library returned zero stored pieces with body text, so there is nothing to score. Generate or save a piece in the Create studio and it will appear here with its GEO score."
              action={
                <Button
                  component={Link}
                  href="/create"
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: C.navy,
                    color: C.navy,
                    borderRadius: "2px",
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Open Create Studio
                </Button>
              }
            />
          ) : (
            <PortfolioBand pieces={pieces} onGoToImprove={onGoToImprove} />
          ))}
      </Box>

      {state.phase === "ready" && pieces.length > 0 && (
        <Box component="section">
          <SectionRule eyebrow={EYEBROW} title="Stored pieces · worst first" />
          <Measure sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Every stored piece scored against the seven checks before it ships. The piece at the top is the
              one an answer engine is least able to quote; each failing check is shown with the value that was
              measured and the points it is forfeiting.
            </Typography>
          </Measure>
          <ContentReadinessPanel
            visible={visible}
            total={pieces.length}
            channel={channel}
            band={band}
            channels={channels}
            onChannel={onChannel}
            onBand={onBand}
            expandedId={expandedId}
            onExpand={onExpand}
          />
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 1.5 }}>
            Scored in the browser from the stored body of each piece — the {FETCH_LIMIT} most recent are
            loaded, of which {state.fetched} came back
            {state.skipped > 0
              ? ` and ${state.skipped} carried no body text, so ${state.skipped === 1 ? "it was" : "they were"} skipped rather than scored zero`
              : ""}
            . Older pieces are not audited.
          </Typography>
        </Box>
      )}

      <Box component="section">
        <SectionRule eyebrow={EYEBROW} title="Live page readiness" />
        <Measure sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            The same seven checks run against a published page as it is served, plus what its HTML declares:
            FAQPage / Article JSON-LD and a visible date.
          </Typography>
        </Measure>
        <LivePageReadinessPanel />
      </Box>
    </Box>
  );
}
