"use client";

/**
 * The furniture every GEO sub-app sits inside: the cockpit header with the live
 * library status, and the persistent sub-navigation rail.
 *
 * The rail is rendered here, in the layout, rather than by each page — that is
 * what makes it persistent: it does not remount, does not re-animate and does
 * not lose its place when you move between the five routes.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InsightsIcon from "@mui/icons-material/Insights";
import ArticleIcon from "@mui/icons-material/Article";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ReactNode } from "react";
import PageHeader from "../PageHeader";
import { totalRecoverable } from "@/lib/geo/fixQueue";
import { C, GeoSubNav, type GeoSubApp } from "./geoUi";
import { useGeoContext } from "./GeoLibraryContext";

/** The five sub-apps. Each entry is a route, and each route has its own page. */
export const GEO_SUB_APPS: readonly GeoSubApp[] = [
  {
    href: "/geo",
    label: "Readiness",
    purpose: "Where the whole library stands and how many points are recoverable.",
    icon: <InsightsIcon fontSize="small" />,
  },
  {
    href: "/geo/content",
    label: "Content audit",
    purpose: "Every stored piece scored against the seven checks, worst first.",
    icon: <ArticleIcon fontSize="small" />,
  },
  {
    href: "/geo/live",
    label: "Live pages",
    purpose: "Score a published apsoparts.com URL exactly as an answer engine sees it.",
    icon: <TravelExploreIcon fontSize="small" />,
  },
  {
    href: "/geo/competitors",
    label: "Competitors",
    purpose: "Score a competitor's page on the same seven checks, side by side with ours.",
    icon: <CompareArrowsIcon fontSize="small" />,
  },
  {
    href: "/geo/fix-queue",
    label: "Fix queue",
    purpose: "Every piece ranked by the points a fix would recover, with the exact edits.",
    icon: <PlaylistAddCheckIcon fontSize="small" />,
  },
];

export default function GeoChrome({ children }: { children: ReactNode }) {
  const { state, reload, pieces } = useGeoContext();
  const loading = state.phase === "loading";

  const avg = pieces.length
    ? Math.round(pieces.reduce((sum, p) => sum + p.audit.score, 0) / pieces.length)
    : null;
  const queue = pieces.filter((p) => p.audit.checks.some((c) => c.verdict !== "pass"));
  const recoverable = queue.reduce((sum, p) => sum + totalRecoverable(p.audit), 0);

  const stat = (ready: string): ReactNode =>
    loading ? "Scoring…" : state.phase === "error" ? "Library unavailable" : ready;

  const items = GEO_SUB_APPS.map((app) => {
    switch (app.href) {
      case "/geo":
        return { ...app, stat: stat(avg === null ? "Nothing scored" : `Portfolio ${avg}/100`) };
      case "/geo/content":
        return {
          ...app,
          stat: stat(`${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"} scored`),
        };
      case "/geo/live":
        return { ...app, stat: "Fetch a published URL" };
      case "/geo/competitors":
        return { ...app, stat: "Two URLs, seven checks" };
      case "/geo/fix-queue":
        return {
          ...app,
          stat: stat(queue.length ? `+${Math.round(recoverable)} points queued` : "Nothing queued"),
        };
      default:
        return { ...app, stat: undefined };
    }
  });

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
    <Box sx={{ width: "100%", px: { xs: 2, md: 3, xl: 5 }, py: { xs: 2, md: 3 } }}>
      <PageHeader
        title="GEO Cockpit"
        subtitle="What makes a page quotable by AI answer engines — scored on the copy you have, not on assumptions."
        badge="GEO"
        rightSlot={headerStatus}
      />

      <GeoSubNav items={items} />

      <Box sx={{ mt: { xs: 3.5, md: 5 } }}>{children}</Box>
    </Box>
  );
}
