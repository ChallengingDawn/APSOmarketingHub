"use client";

/**
 * SUB-APP · FIX QUEUE.
 *
 * Every piece that is not fully passing, ranked by the weighted points a fix
 * would recover, with the exact edits and a hand-off into the Create studio.
 *
 * The ordering is not invented here. `geoFixRanking` reads `geoFixList` — the
 * auditor's own ranking — so the queue, the edits listed in a row and the brief
 * handed to the studio are one list in one order. Every number is a score a
 * check is not currently earning; none of it is a projection.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import Link from "next/link";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { derivedTitle } from "@/lib/geo/audit";
import {
  geoFixRanking,
  geoImproveHref,
  geoPortfolioFixes,
  totalRecoverable,
  type GeoFixEntry,
} from "@/lib/geo/fixQueue";
import { useGeoContext } from "../GeoLibraryContext";
import type { ScoredPiece } from "../useGeoLibrary";
import {
  BAND_COLOR,
  C,
  Card,
  DISPLAY_FONT,
  EmptyStateCard,
  GeoFilterBar,
  LoadingCard,
  Measure,
  PageIntro,
  Panel,
  ScoreBadge,
  SectionLabel,
  Stat,
  UpstreamErrorCard,
  VERDICT_COLOR,
} from "../geoUi";

const PURPOSE =
  "Every piece that is not fully passing, ranked by the weighted points a fix would recover. The edits are the auditor's own ranking, and that exact list is what the Create studio receives.";

/** One edit, with the points it recovers. Shown inside a row's Details. */
function FixLine({ entry, rank }: { entry: GeoFixEntry; rank: number }) {
  const color = VERDICT_COLOR[entry.check.verdict];
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0 }}>
      <Typography
        sx={{
          fontFamily: DISPLAY_FONT,
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          mt: 0.25,
          width: 14,
          flexShrink: 0,
        }}
      >
        {rank}
      </Typography>
      <Box sx={{ width: 2, alignSelf: "stretch", bgcolor: color, flexShrink: 0, borderRadius: "1px" }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{entry.check.label}</Typography>
          <Tooltip
            title={`Scoring ${entry.check.score}/100 at weight ${entry.check.weight}. Measured: ${entry.check.measured}`}
          >
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color, cursor: "help" }}>
              +{entry.points.toFixed(1)} pts
            </Typography>
          </Tooltip>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, mt: 0.375 }}>
          {entry.check.fix}
        </Typography>
      </Box>
    </Box>
  );
}

function QueueRow({ scored, rank }: { scored: ScoredPiece; rank: number }) {
  const [open, setOpen] = useState(false);
  const { item, audit } = scored;
  const title = item.title?.trim() || derivedTitle(item.body) || `Piece #${item.id}`;
  const fixes = geoFixRanking(audit);
  const recoverable = totalRecoverable(audit);
  const top = fixes[0] ?? null;

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
            lg: "auto auto minmax(220px, 1fr) minmax(0, 1.4fr) auto",
          },
          gridTemplateAreas: {
            xs: `"rank meta" "points points" "next next" "action action"`,
            lg: `"rank points meta next action"`,
          },
          "&:hover": { bgcolor: C.surface },
        }}
      >
        <Box sx={{ gridArea: "rank", display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: 14,
              fontWeight: 700,
              color: C.muted,
              width: 24,
              textAlign: "right",
            }}
          >
            {String(rank).padStart(2, "0")}
          </Typography>
          <ScoreBadge score={audit.score} />
        </Box>

        <Box sx={{ gridArea: "points", minWidth: 0 }}>
          <Typography
            sx={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 600, color: C.navy, lineHeight: 1 }}
          >
            +{Math.round(recoverable)}
          </Typography>
          <SectionLabel sx={{ fontSize: 9.5, mt: 0.625 }}>
            pts · {audit.score} → {Math.round(audit.score + recoverable)}
          </SectionLabel>
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
            {item.channel} · {fixes.length} {fixes.length === 1 ? "edit" : "edits"} · {audit.stats.words} words
          </Typography>
        </Box>

        <Box sx={{ gridArea: "next", minWidth: 0 }}>
          {top ? (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: VERDICT_COLOR[top.check.verdict],
                  whiteSpace: "nowrap",
                }}
              >
                +{top.points.toFixed(1)}
              </Typography>
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: C.muted,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={top.check.fix}
              >
                <strong style={{ color: C.ink, fontWeight: 600 }}>{top.check.label}</strong> — {top.check.fix}
              </Typography>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: VERDICT_COLOR.pass }}>Nothing left to fix.</Typography>
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
            Fix in Create Studio
          </Button>
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 3, pt: 0.5 }}>
          <SectionLabel sx={{ fontSize: 10, mb: 1.5 }}>
            {fixes.length} {fixes.length === 1 ? "edit" : "edits"}, highest-value first — this exact list is
            what the Create studio receives
          </SectionLabel>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, maxWidth: "88ch" }}>
            {fixes.map((f, i) => (
              <FixLine key={f.check.id} entry={f} rank={i + 1} />
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export default function GeoFixQueuePage() {
  const { state, reload, pieces, visible, channels, channel, band, setChannel, setBand, filtered } =
    useGeoContext();

  const queue = useMemo(
    () => visible.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass")),
    [visible]
  );
  const queuedPoints = queue.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);
  const topLever = useMemo(() => geoPortfolioFixes(visible.map((p) => p.audit))[0] ?? null, [visible]);

  return (
    <Box>
      <PageIntro title="Fix queue" purpose={PURPOSE} />

      {state.phase === "loading" && <LoadingCard label="Building the fix queue…" />}

      {state.phase === "error" && (
        <UpstreamErrorCard source="The content library" error={state.message} onRetry={reload} />
      )}

      {state.phase === "ready" && pieces.length === 0 && (
        <EmptyStateCard
          title="Nothing to improve yet"
          body="The content library returned zero stored pieces with body text, so there is no fix queue to build. Generate or save a piece in the Create studio and its edits will be ranked here."
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
      )}

      {state.phase === "ready" && pieces.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
          <Card>
            <Box
              sx={{
                display: "grid",
                gap: { xs: 3, md: 5 },
                alignItems: "start",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.2fr)" },
              }}
            >
              <Box>
                <SectionLabel>Queued for repair</SectionLabel>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mt: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: { xs: 40, md: 48 },
                      fontWeight: 600,
                      color: C.navy,
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    +{Math.round(queuedPoints)}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>
                    points across {queue.length} {queue.length === 1 ? "piece" : "pieces"}
                  </Typography>
                </Box>
                <Measure sx={{ mt: 1.75 }}>
                  <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
                    {filtered
                      ? `Counted over the ${visible.length} of ${pieces.length} pieces the filters leave in view.`
                      : `Counted over all ${pieces.length} stored ${pieces.length === 1 ? "piece" : "pieces"}.`}{" "}
                    A passing check always scores 100, so a piece&apos;s recoverable points are exactly its
                    distance from 100.
                  </Typography>
                </Measure>
              </Box>

              {topLever && (
                <Box sx={{ borderLeft: { md: `1px solid ${C.hairline}` }, pl: { md: 5 } }}>
                  <SectionLabel>The one edit worth making everywhere</SectionLabel>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 20,
                      fontWeight: 600,
                      color: C.ink,
                      mt: 1,
                      lineHeight: 1.2,
                    }}
                  >
                    {topLever.label}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 4, mt: 2, flexWrap: "wrap" }}>
                    <Stat value={`+${Math.round(topLever.points)}`} label="Points in view" color={C.navy} size="sm" />
                    <Stat
                      value={`${topLever.pieces}`}
                      label="Pieces affected"
                      size="sm"
                      color={BAND_COLOR.weak}
                    />
                    <Stat
                      value={`+${topLever.averageLift.toFixed(1)}`}
                      label="On the average"
                      size="sm"
                      hint="Points this check forfeits, divided by the pieces in view."
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Card>

          <Panel>
            <GeoFilterBar
              channel={channel}
              band={band}
              channels={channels}
              onChannel={setChannel}
              onBand={setBand}
              left={
                <SectionLabel>
                  Highest recovery first · {queue.length} queued of {visible.length} in view
                </SectionLabel>
              }
            />
            {queue.length === 0 ? (
              <Box sx={{ p: 5, textAlign: "center", borderTop: `1px solid ${C.hairline}` }}>
                <Typography sx={{ fontSize: 13.5, color: C.muted }}>
                  {visible.length === 0
                    ? "No piece matches this channel and score band. Widen the filters — nothing is hidden beyond them."
                    : "Every piece in view passes all seven checks — the queue is empty because there is nothing left to recover."}
                </Typography>
              </Box>
            ) : (
              queue
                .slice()
                .sort((a, b) => totalRecoverable(b.audit) - totalRecoverable(a.audit))
                .map((p, i) => <QueueRow key={p.item.id} scored={p} rank={i + 1} />)
            )}
          </Panel>
        </Box>
      )}
    </Box>
  );
}
