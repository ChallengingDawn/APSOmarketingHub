"use client";

/**
 * GEO cockpit — generative-engine optimisation, split into two sub-apps.
 *
 *   01 AUDIT    the diagnostic half: where the portfolio stands, which stored
 *               pieces are worst, and how a published page scores when fetched.
 *   02 IMPROVE  the action half: the ranked fix queue, the points each edit
 *               recovers, and the hand-off into the Create studio.
 *
 * Both halves read one library load and one filter state, so they can never
 * disagree about the same piece. The switch between them is the page's primary
 * control and every section rule beneath repeats the half's name.
 *
 * Data policy: every number is computed from a real stored body or returned by
 * a real API. When a source is missing or empty the page says which one and
 * what to connect — it never shows an example.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "../PageHeader";
import { GEO_CHECKS, type GeoBand } from "@/lib/geo/audit";
import { geoPortfolioFixes, totalRecoverable } from "@/lib/geo/fixQueue";
import { C, DISPLAY_FONT, Panel, SectionLabel, SubAppSwitch, type SubAppOption } from "./geoUi";
import { applyGeoFilters, useGeoLibrary } from "./useGeoLibrary";
import AuditView from "./AuditView";
import ImproveView from "./ImproveView";

type SubApp = "audit" | "improve";

/** The shared vocabulary of both halves: how the 100 points are allocated. */
function ScoringModelBand() {
  return (
    <Panel sx={{ display: "flex", flexWrap: "wrap", overflow: "hidden" }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          bgcolor: C.surface,
          borderRight: `1px solid ${C.hairline}`,
          flexShrink: 0,
        }}
      >
        <SectionLabel sx={{ lineHeight: 1.4 }}>
          Scoring model
          <br />
          weighted to 100
        </SectionLabel>
      </Box>
      {GEO_CHECKS.map((c) => (
        <Tooltip
          key={c.id}
          title={
            <Box sx={{ p: 0.5 }}>
              <Box sx={{ fontWeight: 700, mb: 0.5 }}>{c.question}</Box>
              <Box>{c.why}</Box>
            </Box>
          }
        >
          <Box
            sx={{
              flex: "1 1 150px",
              minWidth: 130,
              px: 2,
              py: 1.5,
              borderRight: `1px solid ${C.hairline}`,
              cursor: "help",
              display: "flex",
              alignItems: "baseline",
              gap: 1,
              "&:last-of-type": { borderRight: "none" },
              "&:hover": { bgcolor: C.surface },
            }}
          >
            <Typography
              sx={{
                fontFamily: DISPLAY_FONT,
                fontSize: 20,
                fontWeight: 600,
                color: C.navy,
                lineHeight: 1,
                minWidth: 24,
              }}
            >
              {c.weight}
            </Typography>
            <Typography sx={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.3 }}>
              {c.label}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Panel>
  );
}

export default function GeoPage() {
  const [subApp, setSubApp] = useState<SubApp>("audit");
  const [channel, setChannel] = useState("all");
  const [band, setBand] = useState<"all" | GeoBand>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { state, reload, channels, pieces } = useGeoLibrary();

  // A channel filter can outlive the channel it names (reload, new data). Fall
  // back to "all" rather than showing an empty list for a value that is gone.
  const effectiveChannel = channel !== "all" && !channels.includes(channel) ? "all" : channel;

  const visible = useMemo(
    () => applyGeoFilters(pieces, { channel: effectiveChannel, band }),
    [pieces, effectiveChannel, band]
  );

  const summary = useMemo(() => {
    if (!pieces.length) return null;
    const avg = Math.round(pieces.reduce((sum, p) => sum + p.audit.score, 0) / pieces.length);
    const queued = pieces.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass"));
    const points = queued.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);
    const top = geoPortfolioFixes(pieces.map((p) => p.audit))[0] ?? null;
    return { avg, queued: queued.length, points, top };
  }, [pieces]);

  const loading = state.phase === "loading";

  const options: readonly SubAppOption<SubApp>[] = [
    {
      key: "audit",
      ordinal: "01",
      title: "Audit",
      role: "Where the portfolio stands — readiness score, distribution, worst pieces, and any published URL scored as an engine finds it.",
      icon: <FactCheckIcon fontSize="small" />,
      stat: loading ? (
        "Scoring the library…"
      ) : state.phase === "error" ? (
        "Library unavailable"
      ) : summary ? (
        <>
          {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} scored · portfolio average{" "}
          <span style={{ color: C.navy }}>{summary.avg}/100</span>
        </>
      ) : (
        "No stored pieces to score"
      ),
    },
    {
      key: "improve",
      ordinal: "02",
      title: "Improve",
      role: "What to do about it — every piece ranked by the points it can recover, with the exact edits and a hand-off into the Create studio.",
      icon: <AutoFixHighIcon fontSize="small" />,
      stat: loading ? (
        "Building the fix queue…"
      ) : state.phase === "error" ? (
        "Library unavailable"
      ) : summary && summary.queued > 0 ? (
        <>
          {summary.queued} queued · <span style={{ color: C.navy }}>+{Math.round(summary.points)} points</span>{" "}
          recoverable
          {summary.top ? ` · biggest gap: ${summary.top.short}` : ""}
        </>
      ) : (
        "Nothing queued — every check passes"
      ),
    },
  ];

  const headerStatus = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {loading && <CircularProgress size={15} sx={{ color: C.muted }} />}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          border: `1px solid ${C.hairline}`,
          borderRadius: "2px",
          bgcolor: C.white,
        }}
      >
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: C.ink }}>
          {state.phase === "ready"
            ? `${state.pieces.length} of ${state.fetched} library rows scored`
            : state.phase === "error"
              ? "Content library unreachable"
              : "Loading the content library…"}
        </Typography>
      </Box>
      <Button
        size="small"
        onClick={reload}
        startIcon={<RefreshIcon fontSize="small" />}
        sx={{ textTransform: "none", color: C.navy, fontWeight: 600, fontSize: 12.5 }}
      >
        Re-audit
      </Button>
    </Box>
  );

  return (
    <Box
      sx={{
        width: "100%",
        px: { xs: 2, md: 3, xl: 5 },
        py: { xs: 2, md: 3 },
      }}
    >
      <PageHeader
        title="GEO Cockpit"
        subtitle="What makes a page quotable by AI answer engines — scored on the copy you have, not on assumptions."
        badge="GEO"
        rightSlot={headerStatus}
      />

      <Box sx={{ mb: 2 }}>
        <SubAppSwitch value={subApp} onChange={setSubApp} options={options} />
      </Box>

      <Box sx={{ mb: 4 }}>
        <ScoringModelBand />
      </Box>

      {subApp === "audit" ? (
        <AuditView
          state={state}
          reload={reload}
          visible={visible}
          channels={channels}
          channel={effectiveChannel}
          band={band}
          onChannel={setChannel}
          onBand={setBand}
          expandedId={expandedId}
          onExpand={setExpandedId}
          onGoToImprove={() => setSubApp("improve")}
        />
      ) : (
        <ImproveView
          state={state}
          reload={reload}
          visible={visible}
          channels={channels}
          channel={effectiveChannel}
          band={band}
          onChannel={setChannel}
          onBand={setBand}
        />
      )}
    </Box>
  );
}
