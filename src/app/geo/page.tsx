"use client";

/**
 * SUB-APP · READINESS — the cockpit's landing route.
 *
 * One question, answered in one screen: how quotable is the library today, and
 * how much of what it is losing can be got back? The hero states the portfolio
 * score and the recoverable points; the two cards under it say how that score
 * is spread and which single check drags it down hardest. Everything
 * diagnostic sits behind a Details disclosure.
 *
 * Every number is computed from a stored body by the shared auditor. When the
 * library is empty or unreachable the page says so — it never shows an example.
 */

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  GEO_BAND_LABELS,
  GEO_CHECKS,
  geoBand,
  geoCheckDefinition,
  type GeoBand,
} from "@/lib/geo/audit";
import { geoPortfolioFixes, totalRecoverable } from "@/lib/geo/fixQueue";
import { useGeoContext } from "./GeoLibraryContext";
import { FETCH_LIMIT } from "./useGeoLibrary";
import {
  BAND_COLOR,
  BAND_ORDER,
  bandRangeLabel,
  C,
  Card,
  Details,
  DISPLAY_FONT,
  DistributionBar,
  EmptyStateCard,
  LoadingCard,
  Measure,
  MeterBar,
  PageIntro,
  PrimaryAction,
  QuietAction,
  SectionLabel,
  Stat,
  UpstreamErrorCard,
} from "./geoUi";

const PURPOSE =
  "How quotable the stored library is today: one portfolio score, how it is spread, the single check dragging it down hardest — and the points you can get back.";

export default function GeoReadinessPage() {
  const { state, reload, pieces } = useGeoContext();

  const summary = useMemo(() => {
    if (!pieces.length) return null;
    const avg = Math.round(pieces.reduce((sum, p) => sum + p.audit.score, 0) / pieces.length);
    const counts: Record<GeoBand, number> = { strong: 0, workable: 0, weak: 0, poor: 0 };
    for (const p of pieces) counts[p.audit.band] += 1;
    const queue = pieces.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass"));
    const recoverable = queue.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);
    const ranked = geoPortfolioFixes(pieces.map((p) => p.audit));
    return { avg, counts, queued: queue.length, recoverable, ranked };
  }, [pieces]);

  return (
    <Box>
      <PageIntro
        title="Readiness"
        purpose={PURPOSE}
        right={
          summary && summary.queued > 0 ? (
            <PrimaryAction href="/geo/fix-queue" icon={<ArrowForwardIcon fontSize="small" />}>
              Open the fix queue
            </PrimaryAction>
          ) : undefined
        }
      />

      {state.phase === "loading" && <LoadingCard label="Scoring every stored piece against the seven checks…" />}

      {state.phase === "error" && (
        <UpstreamErrorCard source="The content library" error={state.message} onRetry={reload} />
      )}

      {state.phase === "ready" && !summary && (
        <EmptyStateCard
          title="No content pieces to score"
          body="The content library returned zero stored pieces with body text, so there is no portfolio to report on. Generate or save a piece in the Create studio and it will appear here with its GEO score."
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

      {state.phase === "ready" && summary && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
          {/* ── the headline ── */}
          <Card sx={{ p: 0 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 0.85fr) minmax(0, 1.15fr)" },
              }}
            >
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  display: "flex",
                  gap: 2.5,
                  alignItems: "center",
                  borderBottom: { xs: `1px solid ${C.hairline}`, md: "none" },
                  borderRight: { md: `1px solid ${C.hairline}` },
                }}
              >
                <Box
                  sx={{
                    width: 96,
                    height: 96,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${BAND_COLOR[geoBand(summary.avg)]}`,
                    borderLeft: `4px solid ${BAND_COLOR[geoBand(summary.avg)]}`,
                    borderRadius: "2px",
                    bgcolor: `${BAND_COLOR[geoBand(summary.avg)]}0f`,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 38,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: BAND_COLOR[geoBand(summary.avg)],
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {summary.avg}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 10.5, letterSpacing: "0.1em", color: BAND_COLOR[geoBand(summary.avg)], mt: 0.75 }}
                  >
                    / 100
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <SectionLabel>Portfolio readiness</SectionLabel>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 22,
                      fontWeight: 500,
                      color: C.ink,
                      mt: 1,
                      lineHeight: 1.15,
                    }}
                  >
                    {GEO_BAND_LABELS[geoBand(summary.avg)]}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 0.75, lineHeight: 1.5 }}>
                    Mean of {pieces.length} scored {pieces.length === 1 ? "piece" : "pieces"}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 3, md: 4 } }}>
                <SectionLabel>Recoverable right now</SectionLabel>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mt: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: { xs: 46, md: 58 },
                      fontWeight: 600,
                      color: C.navy,
                      lineHeight: 1,
                      letterSpacing: "-0.035em",
                    }}
                  >
                    +{Math.round(summary.recoverable)}
                  </Typography>
                  <Typography sx={{ fontSize: 15, color: C.muted, fontWeight: 500 }}>
                    weighted points
                  </Typography>
                </Box>
                <Measure sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>
                    Spread across{" "}
                    <strong style={{ color: C.ink }}>
                      {summary.queued} {summary.queued === 1 ? "piece" : "pieces"}
                    </strong>{" "}
                    that fail or warn on at least one check. A passing check always scores 100, so this is
                    exactly the distance between the library as written and a library an answer engine can
                    quote from end to end.
                  </Typography>
                </Measure>
                {summary.queued > 0 && (
                  <Box sx={{ mt: 3, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <PrimaryAction href="/geo/fix-queue" icon={<ArrowForwardIcon fontSize="small" />}>
                      See what to fix first
                    </PrimaryAction>
                    <QuietAction href="/geo/content">Browse the audit</QuietAction>
                  </Box>
                )}
              </Box>
            </Box>
          </Card>

          {/* ── how it is spread, and what drags it ── */}
          <Box
            sx={{
              display: "grid",
              gap: { xs: 3, md: 4 },
              alignItems: "stretch",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
            }}
          >
            <Card>
              <SectionLabel sx={{ mb: 2 }}>Distribution by band</SectionLabel>
              <DistributionBar
                total={pieces.length}
                segments={BAND_ORDER.map((b) => ({
                  label: `${GEO_BAND_LABELS[b]} (${bandRangeLabel(b)})`,
                  count: summary.counts[b],
                  color: BAND_COLOR[b],
                }))}
              />
              <Box sx={{ display: "flex", gap: 5, mt: 4, flexWrap: "wrap" }}>
                <Stat value={pieces.length} label="Pieces scored" size="sm" />
                <Stat
                  value={summary.queued}
                  label="With at least one problem"
                  size="sm"
                  color={summary.queued ? BAND_COLOR.weak : BAND_COLOR.strong}
                />
                <Stat
                  value={summary.counts.poor + summary.counts.weak}
                  label="Below workable"
                  size="sm"
                  color={summary.counts.poor + summary.counts.weak ? BAND_COLOR.poor : BAND_COLOR.strong}
                />
              </Box>
            </Card>

            <Card>
              <SectionLabel sx={{ mb: 2 }}>Biggest drag across the library</SectionLabel>
              {summary.ranked.length === 0 ? (
                <Typography sx={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
                  Every check passes on every scored piece — the library is forfeiting no points.
                </Typography>
              ) : (
                <>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 24,
                      fontWeight: 600,
                      color: C.navy,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {summary.ranked[0].label}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 5, mt: 2.5, flexWrap: "wrap" }}>
                    <Stat
                      value={`+${Math.round(summary.ranked[0].points)}`}
                      label="Points if fixed everywhere"
                      color={C.navy}
                    />
                    <Stat
                      value={`+${summary.ranked[0].averageLift.toFixed(1)}`}
                      label="On the portfolio average"
                      hint="Total points this check forfeits, divided by the number of scored pieces."
                    />
                    <Stat
                      value={`${summary.ranked[0].failing} / ${summary.ranked[0].pieces}`}
                      label="Failing outright"
                      color={BAND_COLOR.poor}
                    />
                  </Box>
                  <Measure sx={{ mt: 2.5 }}>
                    <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
                      {geoCheckDefinition(summary.ranked[0].id).why}
                    </Typography>
                  </Measure>
                  <Box sx={{ mt: 2.5 }}>
                    <Details label="All seven checks, ranked by points lost">
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {summary.ranked.map((r) => (
                          <Box key={r.id}>
                            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 0.75 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0 }}>
                                {r.label}
                              </Typography>
                              <Typography sx={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>
                                {r.pieces} {r.pieces === 1 ? "piece" : "pieces"} · weight {r.weight}
                              </Typography>
                              <Typography
                                sx={{
                                  fontFamily: DISPLAY_FONT,
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: r.id === summary.ranked[0].id ? C.navy : C.ink,
                                  minWidth: 44,
                                  textAlign: "right",
                                }}
                              >
                                {Math.round(r.points)}
                              </Typography>
                            </Box>
                            <MeterBar
                              value={r.points}
                              max={summary.ranked[0].points}
                              color={r.id === summary.ranked[0].id ? C.navy : `${C.navy}59`}
                            />
                          </Box>
                        ))}
                      </Box>
                      <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 2, lineHeight: 1.55 }}>
                        Points are the score each check is not earning, summed over every scored piece —
                        weight × the distance from a pass. Checks already passing everywhere are not listed.
                      </Typography>
                    </Details>
                  </Box>
                </>
              )}
            </Card>
          </Box>

          {/* ── the shared vocabulary, out of the scanning path ── */}
          <Card>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
              <SectionLabel sx={{ mr: "auto" }}>How the 100 points are built</SectionLabel>
              <Typography sx={{ fontSize: 12, color: C.muted }}>
                Scored in the browser from the stored body of each piece · {FETCH_LIMIT} most recent loaded ·{" "}
                {state.fetched} returned
                {state.skipped > 0 ? ` · ${state.skipped} skipped for having no body text` : ""}
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Details label="Show the seven checks and their weights">
                <Box
                  sx={{
                    display: "grid",
                    gap: 2.5,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                  }}
                >
                  {GEO_CHECKS.map((c) => (
                    <Box key={c.id} sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                        <Typography
                          sx={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 600, color: C.navy, lineHeight: 1 }}
                        >
                          {c.weight}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{c.label}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.75, lineHeight: 1.55 }}>
                        {c.question}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Details>
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
}
