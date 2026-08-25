"use client";

/**
 * SUB-APP · CONTENT AUDIT.
 *
 * Every stored piece scored against the seven checks before it ships, worst
 * first. The page owns the scanning list; the diagnostics live behind each
 * row's "Details". Channel and band filters are the layout's, so a filter set
 * here is still set in the Fix queue.
 */

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";
import { GEO_BAND_LABELS } from "@/lib/geo/audit";
import { totalRecoverable } from "@/lib/geo/fixQueue";
import { useGeoContext } from "../GeoLibraryContext";
import { FETCH_LIMIT } from "../useGeoLibrary";
import {
  BAND_COLOR,
  C,
  Card,
  EmptyStateCard,
  LoadingCard,
  PageIntro,
  Stat,
  UpstreamErrorCard,
} from "../geoUi";
import ContentReadinessPanel from "../ContentReadinessPanel";

const PURPOSE =
  "Every stored piece scored on the seven checks that decide whether an answer engine can quote it. The row tells you what is wrong in one line; the full measured breakdown is behind Details.";

export default function GeoContentPage() {
  const { state, reload, pieces, visible, channels, channel, band, setChannel, setBand } = useGeoContext();

  const stats = useMemo(() => {
    if (!visible.length) return null;
    const avg = Math.round(visible.reduce((sum, p) => sum + p.audit.score, 0) / visible.length);
    const problems = visible.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass"));
    const belowWorkable = visible.filter((p) => p.audit.band === "weak" || p.audit.band === "poor").length;
    const recoverable = problems.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);
    return { avg, problems: problems.length, belowWorkable, recoverable };
  }, [visible]);

  return (
    <Box>
      <PageIntro title="Content audit" purpose={PURPOSE} />

      {state.phase === "loading" && <LoadingCard label="Scoring the stored library…" />}

      {state.phase === "error" && (
        <UpstreamErrorCard source="The content library" error={state.message} onRetry={reload} />
      )}

      {state.phase === "ready" && pieces.length === 0 && (
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
      )}

      {state.phase === "ready" && pieces.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
          <Card>
            <Box sx={{ display: "flex", gap: { xs: 4, md: 6 }, flexWrap: "wrap", alignItems: "flex-start" }}>
              <Stat
                value={`${visible.length}`}
                label={visible.length === pieces.length ? "Pieces in the library" : `In view of ${pieces.length}`}
                size="lg"
              />
              {stats && (
                <>
                  <Stat value={`${stats.avg}/100`} label="Average score in view" />
                  <Stat
                    value={stats.problems}
                    label="Not fully passing"
                    color={stats.problems ? BAND_COLOR.weak : BAND_COLOR.strong}
                  />
                  <Stat
                    value={stats.belowWorkable}
                    label={`Below ${GEO_BAND_LABELS.workable.toLowerCase()}`}
                    color={stats.belowWorkable ? BAND_COLOR.poor : BAND_COLOR.strong}
                  />
                  <Stat
                    value={`+${Math.round(stats.recoverable)}`}
                    label="Points recoverable in view"
                    color={C.navy}
                    hint="A passing check always scores 100, so this is the exact distance from these pieces to a full pass."
                  />
                </>
              )}
            </Box>
          </Card>

          <Box>
            <ContentReadinessPanel
              visible={visible}
              total={pieces.length}
              channel={channel}
              band={band}
              channels={channels}
              onChannel={setChannel}
              onBand={setBand}
            />
            <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 2, lineHeight: 1.6 }}>
              Scored in the browser from the stored body of each piece — the {FETCH_LIMIT} most recent are
              loaded, of which {state.fetched} came back
              {state.skipped > 0
                ? ` and ${state.skipped} carried no body text, so ${
                    state.skipped === 1 ? "it was" : "they were"
                  } skipped rather than scored zero`
                : ""}
              . Older pieces are not audited.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
