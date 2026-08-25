"use client";

/**
 * QUICK WINS — queries you already rank for, just off the money.
 *
 * The list is scannable: opportunity score, the query, one line naming the two
 * score inputs, one dominant action. The full arithmetic per row is behind
 * Details, and the formula itself is behind a disclosure — available, verbatim,
 * but not competing with the data for attention.
 */

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { GscRow } from "./gscClient";
import { GSC_ROW_LIMIT } from "./gscClient";
import {
  QW_MIN_IMPRESSIONS,
  QW_POSITION_MAX,
  QW_POSITION_MIN,
  quickWinsOf,
  type QuickWin,
} from "./analysis";
import FindingList, { DetailGrid, DetailNote, type Finding } from "./Finding";
import { createHref, quickWinTopic } from "./queue";
import { useSeoData } from "./SeoData";
import { Disclosure, HeroStat, SubAppFrame } from "./Shell";
import {
  AllClear,
  HAIRLINE,
  MUTED,
  Methodology,
  NAVY,
  SourceNote,
  fmtCtr,
  fmtInt,
  fmtPosition,
} from "./ui";

const WILL_SHOW = `Once Search Console is connected this sub-app lists every query the property ranks for between position ${QW_POSITION_MIN} and ${QW_POSITION_MAX} with at least ${QW_MIN_IMPRESSIONS} impressions, ranked by impressions × proximity to page one.`;

const NO_ROWS: GscRow[] = [];

function findingOf(win: QuickWin): Finding {
  return {
    id: win.key,
    score: fmtInt(win.score),
    scoreCaption: "opportunity",
    scoreTone: NAVY,
    subject: win.key,
    reason: `Position ${fmtPosition(win.position)} · ${fmtInt(win.impressions)} impressions · proximity ${win.proximity.toFixed(2)} · ${fmtInt(win.clicks)} clicks today`,
    action: { href: createHref(quickWinTopic(win.key)), label: "Create content" },
    searchText: win.key,
    details: (
      <>
        <DetailNote>
          Opportunity = <strong>{fmtInt(win.impressions)}</strong> impressions ×{" "}
          <strong>{win.proximity.toFixed(2)}</strong> proximity = <strong>{fmtInt(win.score)}</strong>. Proximity is (
          {QW_POSITION_MAX + 1} − {fmtPosition(win.position)}) ÷ {QW_POSITION_MAX + 1 - QW_POSITION_MIN}. Open the page
          that already ranks for this query, deepen it against the query&apos;s intent, then republish — Google already
          trusts you here, so this is cheaper than a net-new topic.
        </DetailNote>
        <DetailGrid
          items={[
            { label: "Impressions", value: fmtInt(win.impressions), note: "Score input 1 — demand in the window" },
            { label: "Position", value: fmtPosition(win.position), note: "Score input 2 — lower is better" },
            { label: "Proximity", value: win.proximity.toFixed(2), note: `1.00 at position ${QW_POSITION_MIN}` },
            { label: "Opportunity", value: fmtInt(win.score), note: "impressions × proximity" },
            { label: "Clicks now", value: fmtInt(win.clicks), note: "What the query earns today" },
            { label: "CTR", value: fmtCtr(win.ctr), note: "As reported by Search Console" },
          ]}
        />
      </>
    ),
  };
}

export default function QuickWins() {
  const { data, loading, windowDays } = useSeoData();

  const queries = data?.queries ?? NO_ROWS;
  const wins = useMemo(() => quickWinsOf(queries), [queries]);
  const findings = useMemo(() => wins.map(findingOf), [wins]);

  // Both figures are plain sums / minima over rows the analysis already kept.
  const impressionsInBand = useMemo(() => wins.reduce((sum, w) => sum + w.impressions, 0), [wins]);
  const bestPosition = useMemo(
    () => (wins.length === 0 ? null : wins.reduce((best, w) => Math.min(best, w.position), wins[0].position)),
    [wins],
  );

  return (
    <SubAppFrame
      title="Quick wins"
      purpose={`Queries you already rank for between position ${QW_POSITION_MIN} and ${QW_POSITION_MAX}, where a small ranking gain converts into real clicks.`}
      willShow={WILL_SHOW}
    >
      <HeroStat
        label={`Queries within reach · last ${windowDays} days`}
        value={loading ? "—" : fmtInt(wins.length)}
        note={
          <>
            Queries sitting between position {QW_POSITION_MIN} and {QW_POSITION_MAX} with at least{" "}
            {QW_MIN_IMPRESSIONS} impressions in the window. Work the list top-down — the highest opportunity score is the
            most demand closest to page one.
          </>
        }
        supporting={[
          {
            label: "Impressions in band",
            value: loading ? "—" : fmtInt(impressionsInBand),
            hint: "Sum of the impressions of the qualifying queries — the demand this list is competing for.",
          },
          {
            label: "Best position",
            value: loading ? "—" : fmtPosition(bestPosition),
            hint: "Closest any qualifying query already sits to the top of page one.",
          },
          {
            label: "Top opportunity",
            value: loading || wins.length === 0 ? "—" : fmtInt(wins[0].score),
            hint: "impressions × proximity for the leading row.",
          },
          {
            label: "Queries scanned",
            value: loading ? "—" : fmtInt(queries.length),
            hint: `Query rows Search Console returned for this window, capped at ${GSC_ROW_LIMIT}.`,
          },
        ]}
      />

      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden", mb: { xs: 3, md: 4 } }}>
        <Disclosure summary="How the opportunity score is computed">
          <Methodology
            label="Formula"
            formula={
              <>
                proximity = ({QW_POSITION_MAX + 1} − position) ÷ {QW_POSITION_MAX + 1 - QW_POSITION_MIN}
                <br />
                opportunity = impressions × proximity
              </>
            }
          >
            Demand weighted by how close the query already is to the top: a query at position {QW_POSITION_MIN} scores
            its full impressions, one at position {QW_POSITION_MAX} scores about a tenth of them. Both inputs appear on
            every row and again under Details, so the score is never a black box. Filter: position between{" "}
            {QW_POSITION_MIN} and {QW_POSITION_MAX}, at least {QW_MIN_IMPRESSIONS} impressions in the window. This is
            also the score the Work queue normalises when it ranks quick wins against the other analyses.
          </Methodology>
        </Disclosure>
      </Box>

      <FindingList
        heading="Ranked opportunities"
        caption={
          loading
            ? "Loading…"
            : `${wins.length} qualifying quer${wins.length === 1 ? "y" : "ies"} · last ${windowDays} days · highest opportunity first`
        }
        items={findings}
        loading={loading}
        searchPlaceholder="Search queries"
        empty={
          <AllClear title="Nothing to act on in this window">
            None of the {fmtInt(queries.length)} queries Search Console returned for the last {windowDays} days sit
            between position {QW_POSITION_MIN} and {QW_POSITION_MAX} with at least {QW_MIN_IMPRESSIONS} impressions.
            Nothing is within one nudge of page one right now. The 90-day window pulls in queries with thinner daily
            volume if you want a wider net.
          </AllClear>
        }
      />

      <SourceNote>
        <Typography component="span" sx={{ fontSize: "inherit", color: MUTED }}>
          Source: Google Search Console, dimension query, capped at {GSC_ROW_LIMIT} rows. Rows are filtered and ranked,
          never generated.
        </Typography>
      </SourceNote>
    </SubAppFrame>
  );
}
