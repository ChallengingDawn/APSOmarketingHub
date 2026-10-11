"use client";

/**
 * /seo — THE FRONT DOOR OF THE COCKPIT.
 *
 * There was not one before. /seo rendered the work queue while the tab above
 * it said "Performance" and the sidebar said "What to do next", so the first
 * thing the area showed was 187 rows of detail under a heading that disagreed
 * with itself twice.
 *
 * A front door answers three questions in one screen, in this order:
 *
 *   1. How are we doing?            four numbers, each against the previous
 *                                   equivalent window, so they mean something
 *   2. Where is the work?           three analyses, how much each one found
 *   3. What do I do first?          the top of the ranked queue, with the
 *                                   button that fits each finding
 *
 * Everything here is a summary of a page that already exists. It computes no
 * new analysis and makes no claim the sub-apps do not already make — if a
 * number is missing it says so rather than showing a zero, because a zero
 * would be a claim.
 *
 * The look is the UC report kit — frosted cards, tinted badges, one accent —
 * so the cockpit reads as the same product as Erosion and Price checks rather
 * than as a separate tool that happens to live in the same sidebar.
 */

import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import MouseOutlinedIcon from "@mui/icons-material/MouseOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PercentIcon from "@mui/icons-material/Percent";
import MilitaryTechOutlinedIcon from "@mui/icons-material/MilitaryTechOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import {
  CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, Kicker, MUTED, type Tint,
} from "@/app/uc/report/ui";

import CountryLabels from "./CountryLabels";
import { useSeoData } from "./SeoData";
import { SEO_BY_ID } from "./nav";
import { actionFor, type SourceCoverage, type WorkSource } from "./queue";
import { fmtCtr, fmtInt, fmtPosition, shortPath } from "./ui";
import { NotConnected, UpstreamError } from "./ui";
import type { GscRow } from "./gscClient";

/** How many of the ranked findings the front door shows before handing over. */
const PREVIEW = 5;

type Totals = { clicks: number; impressions: number };

function totalsOf(rows: GscRow[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      clicks: acc.clicks + (r.clicks ?? 0),
      impressions: acc.impressions + (r.impressions ?? 0),
    }),
    { clicks: 0, impressions: 0 },
  );
}

/**
 * The impression-weighted average position.
 *
 * Weighted, not a plain mean: a query seen 40,000 times says far more about
 * where the site sits than one seen twice, and averaging them evenly lets the
 * long tail drag the figure wherever it likes.
 */
function avgPosition(rows: GscRow[]): number | null {
  let weight = 0;
  let sum = 0;
  for (const r of rows) {
    if (r.position === null || r.impressions === null) continue;
    weight += r.impressions;
    sum += r.position * r.impressions;
  }
  return weight > 0 ? sum / weight : null;
}

/** `null` when the base is zero — a change from nothing is not a percentage. */
function ratio(now: number, before: number): number | null {
  if (before <= 0) return null;
  return (now - before) / before;
}

const SOURCE_CARDS: {
  source: WorkSource;
  navId: "quick-wins" | "cannibalisation" | "decay";
  icon: React.ReactNode;
  tint: Tint;
}[] = [
  { source: "quick-win", navId: "quick-wins", icon: <BoltIcon />, tint: "amber" },
  { source: "cannibalisation", navId: "cannibalisation", icon: <CallSplitIcon />, tint: "purple" },
  { source: "decay", navId: "decay", icon: <TrendingDownIcon />, tint: "pink" },
];

function CoverageCard({
  icon, tint, label, blurb, href, coverage,
}: {
  icon: React.ReactNode; tint: Tint; label: string; blurb: string; href: string;
  coverage: SourceCoverage | null;
}) {
  const unavailable = coverage?.status === "unavailable";
  return (
    <GlassCard sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardTitle icon={icon} tint={tint} title={label} note={blurb} />

      {coverage === null ? (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Still counting…</Typography>
      ) : unavailable ? (
        // Named, not hidden. "This analysis could not run" and "this analysis
        // found nothing" are different facts and a reader has to tell them apart.
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.6 }}>
          Could not run for this window. {coverage.reason}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography sx={{ fontSize: "2.1rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em" }}>
            {fmtInt(coverage.found)}
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
            {coverage.found === 1 ? "finding" : "findings"}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />
      <Button
        component={Link}
        href={href}
        endIcon={<ArrowForwardIcon />}
        sx={{ mt: 2, alignSelf: "flex-start", textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
      >
        Look at {label.toLowerCase()}
      </Button>
    </GlassCard>
  );
}

export default function Overview() {
  const { state, data, queue, retry } = useSeoData();

  if (state.status === "not-configured") {
    return (
      <NotConnected
        source="Google Search Console"
        missing={state.missing}
        detail={state.detail}
        willShow="Clicks, impressions and average position for the property, and the three analyses that feed the work queue."
      />
    );
  }
  if (state.status === "error") {
    return <UpstreamError error={state.error} status={state.httpStatus} onRetry={retry} />;
  }

  const now = data ? totalsOf(data.pages) : null;
  // The wide call spans the current window AND the one before it, so the
  // previous period is what is left after taking the current one out.
  const wide = data ? totalsOf(data.pagesExtended) : null;
  const before =
    now && wide && !data?.extendedError
      ? { clicks: Math.max(0, wide.clicks - now.clicks), impressions: Math.max(0, wide.impressions - now.impressions) }
      : null;

  const ctrNow = now && now.impressions > 0 ? now.clicks / now.impressions : null;
  const ctrBefore = before && before.impressions > 0 ? before.clicks / before.impressions : null;
  const position = data ? avgPosition(data.queries) : null;
  const versus = "the previous equivalent window";

  const top = queue ? queue.items.slice(0, PREVIEW) : [];

  return (
    <Box>
      <Kicker>How the site is doing</Kicker>
      <Grid container spacing={2} sx={{ mt: 0.5, mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            icon={<MouseOutlinedIcon />} tint="blue" label="Clicks"
            value={now ? fmtInt(now.clicks) : "—"}
            delta={before ? { ratio: ratio(now!.clicks, before.clicks), versus } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            icon={<VisibilityOutlinedIcon />} tint="slate" label="Impressions"
            value={now ? fmtInt(now.impressions) : "—"}
            delta={before ? { ratio: ratio(now!.impressions, before.impressions), versus } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            icon={<PercentIcon />} tint="green" label="Click-through rate"
            value={ctrNow === null ? "—" : fmtCtr(ctrNow)}
            delta={ctrNow !== null && ctrBefore ? { ratio: ratio(ctrNow, ctrBefore), versus } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            icon={<MilitaryTechOutlinedIcon />} tint="purple" label="Average position"
            value={fmtPosition(position)}
            // No change figure: position cannot be recovered by subtracting one
            // window's totals from another's, and a made-up delta here would be
            // the easiest number on the page to believe.
            note="Weighted by impressions"
          />
        </Grid>
      </Grid>

      <Kicker>Where the work is</Kicker>
      <Grid container spacing={2} sx={{ mt: 0.5, mb: 4 }}>
        {SOURCE_CARDS.map((card) => {
          const entry = SEO_BY_ID[card.navId];
          return (
            <Grid key={card.source} size={{ xs: 12, md: 4 }}>
              <CoverageCard
                icon={card.icon} tint={card.tint} label={entry.label} blurb={entry.blurb} href={entry.href}
                coverage={queue ? queue.coverage[card.source] : null}
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Above the queue deliberately. It is one fault, not 187, and it is
          worth more than most of them: it decides which of our own homepages
          Google shows in which country. */}
      <Kicker>Country labels</Kicker>
      <Box sx={{ mt: 0.5, mb: 4 }}>
        <CountryLabels />
      </Box>

      <Kicker>What to do first</Kicker>
      <GlassCard sx={{ mt: 0.5 }}>
        <CardTitle
          icon={<PlaylistAddCheckIcon />}
          tint="blue"
          title={SEO_BY_ID["work-queue"].label}
          note={
            queue
              ? `${fmtInt(queue.items.length)} findings waiting, highest priority first.`
              : "Merging the three analyses…"
          }
          right={
            <Button
              component={Link}
              href={SEO_BY_ID["work-queue"].href}
              variant="contained"
              disableElevation
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
            >
              See all
            </Button>
          }
        />

        {top.length === 0 ? (
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
            {queue ? "Nothing is waiting in this window." : "Still working it out…"}
          </Typography>
        ) : (
          <Box>
            {top.map((item, i) => {
              const act = actionFor(item);
              return (
                <Box
                  key={item.id}
                  sx={{
                    display: "flex", alignItems: "center", gap: 2, py: 1.6, flexWrap: "wrap",
                    borderTop: i === 0 ? "none" : `1px solid ${HAIRLINE}`,
                  }}
                >
                  <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, width: 40, flexShrink: 0 }}>
                    {Math.round(item.priority)}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 220 }}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: INK }}>
                      {item.source === "decay" ? shortPath(item.subject) : item.subject}
                    </Typography>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{item.action}</Typography>
                  </Box>
                  <Button
                    {...(act.href.startsWith("http")
                      ? { component: "a" as const, href: act.href, target: "_blank", rel: "noopener noreferrer" }
                      : { component: Link, href: act.href })}
                    size="small"
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" }}
                  >
                    {act.label}
                  </Button>
                </Box>
              );
            })}
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}
