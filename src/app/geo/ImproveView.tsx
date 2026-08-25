"use client";

/**
 * SUB-APP 02 · IMPROVE — the action half of the GEO cockpit.
 *
 * Two bands: the one check worth fixing library-wide, then the ranked fix queue
 * — one row per piece, the exact edits it needs, the points each edit recovers,
 * and a single primary action that carries all of it into the Create studio.
 *
 * The ordering is not invented here. `geoFixRanking` reads `geoFixList` — the
 * auditor's own ranking — so the queue, the chips and the brief handed to the
 * studio are one list in one order. Every number is a score a check is not
 * currently earning; none of it is a projection.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Link from "next/link";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { derivedTitle, geoCheckDefinition, type GeoBand } from "@/lib/geo/audit";
import {
  geoFixRanking,
  geoImproveHref,
  geoPortfolioFixes,
  totalRecoverable,
  type GeoFixEntry,
} from "@/lib/geo/fixQueue";
import type { GeoLibraryState, ScoredPiece } from "./useGeoLibrary";
import {
  BAND_COLOR,
  C,
  DISPLAY_FONT,
  EmptyStateCard,
  GeoFilterBar,
  LoadingCard,
  Measure,
  MeterBar,
  Panel,
  ScoreBadge,
  SectionLabel,
  SectionRule,
  Stat,
  UpstreamErrorCard,
  VERDICT_COLOR,
} from "./geoUi";

const EYEBROW = "Improve";

/* ─────────────────────── band 1 · the one biggest win ─────────────────────── */

function BiggestWinBand({ pieces, scope }: { pieces: ScoredPiece[]; scope: string }) {
  const ranked = geoPortfolioFixes(pieces.map((p) => p.audit));
  const avg = pieces.reduce((sum, p) => sum + p.audit.score, 0) / pieces.length;

  if (ranked.length === 0) {
    return (
      <Panel sx={{ p: { xs: 2.5, md: 4 } }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TaskAltIcon sx={{ color: BAND_COLOR.strong, mt: 0.25 }} />
          <Measure>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 500, color: C.ink }}>
              Nothing is queued — every check passes {scope}
            </Typography>
            <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.75, lineHeight: 1.6 }}>
              There are no points left to recover on the pieces currently in view. Widen the filters to look at
              the rest of the library.
            </Typography>
          </Measure>
        </Box>
      </Panel>
    );
  }

  const top = ranked[0];
  const maxPoints = top.points;
  const after = avg + top.averageLift;

  return (
    <Panel sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, lg: 4 },
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(300px, 0.9fr) minmax(0, 1.3fr)" },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <SectionLabel sx={{ mb: 1 }}>The one fix worth doing everywhere</SectionLabel>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: { xs: 24, md: 28 },
              fontWeight: 600,
              color: C.navy,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {top.label}
          </Typography>
          <Measure sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>
              Fixing this one check on all {top.pieces} affected {top.pieces === 1 ? "piece" : "pieces"}{" "}
              {scope} recovers <strong style={{ color: C.ink }}>{Math.round(top.points)} weighted points</strong> —
              more than any other check. {geoCheckDefinition(top.id).why}
            </Typography>
          </Measure>
          <Box sx={{ display: "flex", gap: 4, mt: 2.5, flexWrap: "wrap" }}>
            <Stat value={`+${Math.round(top.points)}`} label="Points recoverable" color={C.navy} />
            <Stat
              value={`${avg.toFixed(1)} → ${after.toFixed(1)}`}
              label="Portfolio average after"
              color={BAND_COLOR.strong}
              hint={`Each affected piece regains the points this check is not earning; the mean rises by ${top.averageLift.toFixed(1)}.`}
            />
            <Stat value={`${top.failing} / ${top.pieces}`} label="Failing outright" color={VERDICT_COLOR.fail} />
          </Box>
        </Box>

        <Box sx={{ minWidth: 0, borderLeft: { lg: `1px solid ${C.hairline}` }, pl: { lg: 4 } }}>
          <SectionLabel sx={{ mb: 1.5 }}>All seven checks · points {scope}</SectionLabel>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {ranked.map((r) => (
              <Box key={r.id}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0 }}>
                    {r.label}
                  </Typography>
                  <Tooltip
                    title={`${r.pieces} of ${pieces.length} pieces are not passing this check (${r.failing} fail outright). Weight ${r.weight} of 100.`}
                  >
                    <Typography sx={{ fontSize: 11.5, color: C.muted, cursor: "help", whiteSpace: "nowrap" }}>
                      {r.pieces} {r.pieces === 1 ? "piece" : "pieces"} · weight {r.weight}
                    </Typography>
                  </Tooltip>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: r.id === top.id ? C.navy : C.ink,
                      minWidth: 46,
                      textAlign: "right",
                    }}
                  >
                    {Math.round(r.points)}
                  </Typography>
                </Box>
                <MeterBar value={r.points} max={maxPoints} color={r.id === top.id ? C.navy : `${C.navy}59`} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 1.75, lineHeight: 1.5 }}>
            Points are the score each check is not earning, summed over the pieces in view — weight × the
            distance from a pass. Checks already passing everywhere are not listed.
          </Typography>
        </Box>
      </Box>
    </Panel>
  );
}

/* ───────────────────────── band 2 · the ranked queue ──────────────────────── */

function FixLine({ entry, rank }: { entry: GeoFixEntry; rank: number }) {
  const color = VERDICT_COLOR[entry.check.verdict];
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", minWidth: 0 }}>
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
        <Typography sx={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, mt: 0.25 }}>
          {entry.check.fix}
        </Typography>
      </Box>
    </Box>
  );
}

function QueueRow({ scored, rank }: { scored: ScoredPiece; rank: number }) {
  const { item, audit } = scored;
  const title = item.title?.trim() || derivedTitle(item.body) || `Piece #${item.id}`;
  const fixes = geoFixRanking(audit);
  const recoverable = totalRecoverable(audit);

  return (
    <Box
      sx={{
        borderTop: `1px solid ${C.hairline}`,
        display: "grid",
        gap: { xs: 1.75, lg: 3 },
        alignItems: "start",
        px: { xs: 1.5, md: 2 },
        py: 2.25,
        gridTemplateColumns: {
          xs: "auto minmax(0, 1fr)",
          lg: "auto minmax(260px, 1fr) minmax(0, 1.9fr) auto",
        },
        gridTemplateAreas: {
          xs: `"rank piece" "fixes fixes" "action action"`,
          lg: `"rank piece fixes action"`,
        },
        "&:hover": { bgcolor: C.surface },
      }}
    >
      <Box sx={{ gridArea: "rank", display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontSize: 15,
            fontWeight: 700,
            color: C.muted,
            width: 26,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {String(rank).padStart(2, "0")}
        </Typography>
        <ScoreBadge score={audit.score} />
      </Box>

      <Box sx={{ gridArea: "piece", minWidth: 0 }}>
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
        <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.5 }}>
          {item.channel} · {item.status} · {audit.stats.words} words
        </Typography>
        <Box sx={{ mt: 1.25 }}>
          <Typography
            sx={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 600, color: C.navy, lineHeight: 1 }}
          >
            +{Math.round(recoverable)}
          </Typography>
          <SectionLabel sx={{ fontSize: 10, mt: 0.5 }}>
            Points recoverable · {audit.score} → {Math.round(audit.score + recoverable)}
          </SectionLabel>
        </Box>
      </Box>

      <Box sx={{ gridArea: "fixes", minWidth: 0 }}>
        <SectionLabel sx={{ fontSize: 10, mb: 1 }}>
          {fixes.length} {fixes.length === 1 ? "edit" : "edits"}, highest-value first
        </SectionLabel>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          {fixes.map((f, i) => (
            <FixLine key={f.check.id} entry={f} rank={i + 1} />
          ))}
        </Box>
      </Box>

      <Box sx={{ gridArea: "action", flexShrink: 0 }}>
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
            px: 2,
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "#1a3a4c" },
          }}
        >
          Fix in Create Studio
        </Button>
        <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.875, maxWidth: 190, lineHeight: 1.45 }}>
          Opens the studio with this piece&apos;s channel, score and the {fixes.length} edits above as the
          brief.
        </Typography>
      </Box>
    </Box>
  );
}

/* ──────────────────────────────── the sub-app ─────────────────────────────── */

export default function ImproveView({
  state,
  reload,
  visible,
  channels,
  channel,
  band,
  onChannel,
  onBand,
}: {
  state: GeoLibraryState;
  reload: () => void;
  visible: ScoredPiece[];
  channels: readonly string[];
  channel: string;
  band: "all" | GeoBand;
  onChannel: (v: string) => void;
  onBand: (v: "all" | GeoBand) => void;
}) {
  if (state.phase === "loading") return <LoadingCard label="Auditing the content library…" />;
  if (state.phase === "error") {
    return <UpstreamErrorCard source="The content library" error={state.message} onRetry={reload} />;
  }
  if (state.pieces.length === 0) {
    return (
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
    );
  }

  const filtered = visible.length !== state.pieces.length;
  const scope = filtered
    ? `across the ${visible.length} of ${state.pieces.length} pieces in view`
    : `across all ${state.pieces.length} stored ${state.pieces.length === 1 ? "piece" : "pieces"}`;

  // Worst first is most-recoverable first: a passing check always scores 100, so
  // the points a piece can regain are exactly 100 minus its score.
  const queue = visible.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass"));
  const queuedPoints = queue.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <Box component="section">
        <SectionRule eyebrow={EYEBROW} title="Where the points are" />
        {visible.length === 0 ? (
          <Panel sx={{ p: 4 }}>
            <Typography sx={{ fontSize: 13.5, color: C.muted }}>
              No piece matches this channel and score band, so there is nothing to rank. Widen the filters
              below — nothing is hidden beyond them.
            </Typography>
          </Panel>
        ) : (
          <BiggestWinBand pieces={visible} scope={scope} />
        )}
      </Box>

      <Box component="section">
        <SectionRule
          eyebrow={EYEBROW}
          title="Fix queue · highest recovery first"
          right={
            queue.length > 0 ? (
              <Typography sx={{ fontSize: 12, color: C.muted }}>
                <strong style={{ color: C.ink }}>{Math.round(queuedPoints)} points</strong> queued across{" "}
                {queue.length} {queue.length === 1 ? "piece" : "pieces"}
              </Typography>
            ) : undefined
          }
        />
        <Measure sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            One row per piece that is not fully passing, ordered by the points it can regain. Within a row the
            edits are in the auditor&apos;s own ranking — weight × distance from a pass — and that is the exact
            order handed to the Create studio.
          </Typography>
        </Measure>

        <Panel>
          <GeoFilterBar
            channel={channel}
            band={band}
            channels={channels}
            onChannel={onChannel}
            onBand={onBand}
            left={
              <SectionLabel>
                {queue.length} queued · {visible.length} of {state.pieces.length} pieces in view
              </SectionLabel>
            }
          />
          {queue.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", borderTop: `1px solid ${C.hairline}` }}>
              <Typography sx={{ fontSize: 13.5, color: C.muted }}>
                {visible.length === 0
                  ? "No piece matches this channel and score band."
                  : "Every piece in view passes all seven checks — the queue is empty because there is nothing left to recover."}
              </Typography>
            </Box>
          ) : (
            queue.map((p, i) => <QueueRow key={p.item.id} scored={p} rank={i + 1} />)
          )}
        </Panel>
      </Box>
    </Box>
  );
}
