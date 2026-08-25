"use client";

/**
 * DECAY — pages that used to earn clicks and now earn fewer.
 *
 * The previous period is derived by subtraction (see analysis.ts). That method
 * is stated on the page rather than implied, because it is the one thing a
 * reader has to trust before trusting the numbers.
 */

import { useMemo } from "react";
import Box from "@mui/material/Box";

import type { GscRow } from "./gscClient";
import { GSC_ROW_LIMIT } from "./gscClient";
import { decayOf, isDecayed, type DecayRow } from "./analysis";
import FindingList, { DetailGrid, DetailNote, type Finding } from "./Finding";
import { createHref, decayTopic } from "./queue";
import { useSeoData } from "./SeoData";
import { Caveat, Disclosure, HeroStat, SubAppFrame } from "./Shell";
import {
  AllClear,
  HAIRLINE,
  INK,
  MONO,
  Methodology,
  RED,
  SourceNote,
  fmtInt,
  fmtPct,
  fmtPosition,
  fmtSigned,
  shortPath,
} from "./ui";

const WILL_SHOW =
  "Once Search Console is connected this sub-app compares each page's clicks in the selected window against the equivalent period before it, and lists the pages that lost the most, worst first.";

const NO_ROWS: GscRow[] = [];

function findingOf(row: DecayRow, days: number): Finding {
  const lostImpressions = row.currentImpressions < row.previousImpressions;
  const pctPart = row.deltaPct === null ? "" : ` (${fmtPct(row.deltaPct)})`;

  return {
    id: row.key,
    score: fmtSigned(row.deltaClicks),
    scoreCaption: "clicks",
    scoreTone: RED,
    subject: shortPath(row.key),
    subjectMono: true,
    reason: `${fmtInt(row.previousClicks)} → ${fmtInt(row.currentClicks)} clicks${pctPart} · impressions ${fmtInt(row.previousImpressions)} → ${fmtInt(row.currentImpressions)} · position ${fmtPosition(row.currentPosition)}`,
    action: { href: createHref(decayTopic(row.key)), label: "Refresh this page" },
    searchText: row.key,
    details: (
      <>
        <DetailNote>
          {lostImpressions ? (
            <>
              Impressions fell as well as clicks, so the page lost ranking — bring the content back up to date rather
              than only reworking the snippet.
            </>
          ) : (
            <>
              Impressions held while clicks fell, so the page still ranks but is no longer being chosen — rewrite the
              title and meta description first.
            </>
          )}{" "}
          Previous-period figures are derived by subtracting this {days}-day window from a {days * 2}-day window; that
          subtraction is exact for clicks and impressions, which are daily sums.
        </DetailNote>
        <DetailGrid
          items={[
            { label: `Previous ${days}d clicks`, value: fmtInt(row.previousClicks), note: "Derived by subtraction" },
            { label: `Current ${days}d clicks`, value: fmtInt(row.currentClicks), note: "As reported" },
            { label: "Δ clicks", value: fmtSigned(row.deltaClicks), note: "Current − previous" },
            { label: "Δ %", value: fmtPct(row.deltaPct), note: "Blank when the previous period had no clicks" },
            { label: "Previous impressions", value: fmtInt(row.previousImpressions), note: "Derived by subtraction" },
            { label: "Current impressions", value: fmtInt(row.currentImpressions), note: "As reported" },
            {
              label: "Current position",
              value: fmtPosition(row.currentPosition),
              note: "Averages cannot be subtracted, so no previous position exists",
            },
            { label: "URL", value: shortPath(row.key), note: "Path only — hover the row title for the full URL" },
          ]}
        />
      </>
    ),
  };
}

export default function Decay() {
  const { data, loading, windowDays } = useSeoData();

  const pagesCurrent = data?.pages ?? NO_ROWS;
  const pagesExtended = data?.pagesExtended ?? NO_ROWS;
  const extendedError = data?.extendedError ?? null;

  const result = useMemo(() => decayOf(pagesCurrent, pagesExtended), [pagesCurrent, pagesExtended]);
  const rows = useMemo(() => result.rows.filter(isDecayed), [result.rows]);
  const findings = useMemo(() => rows.map((r) => findingOf(r, windowDays)), [rows, windowDays]);

  // A plain sum of losses the analysis already computed — nothing modelled.
  const clicksLost = useMemo(() => rows.reduce((sum, r) => sum + Math.abs(r.deltaClicks), 0), [rows]);

  return (
    <SubAppFrame
      title="Decay"
      purpose={`Pages earning fewer clicks than they did in the previous ${windowDays} days. The cheapest traffic to recover — the page already exists, already ranks, already has links.`}
      willShow={WILL_SHOW}
    >
      {extendedError !== null && (
        <Caveat>
          The comparison window ({windowDays * 2} days) failed, so no previous period could be derived and no decay can
          be measured for this window: {extendedError}
        </Caveat>
      )}

      <HeroStat
        label={`Clicks lost against the previous ${windowDays} days`}
        value={loading ? "—" : fmtSigned(-clicksLost)}
        tone={clicksLost > 0 ? RED : INK}
        note={
          <>
            Summed across every page that earned fewer clicks in the last {windowDays} days than in the {windowDays} days
            before. Start at the top — the biggest absolute loss is the biggest business loss.
          </>
        }
        supporting={[
          {
            label: "Declining pages",
            value: loading ? "—" : fmtInt(rows.length),
            hint: "Pages that lost at least one click against a previous period that had traffic.",
          },
          {
            label: "Pages compared",
            value: loading ? "—" : fmtInt(result.comparable),
            hint: "Pages present and reconcilable in both windows.",
          },
          {
            label: "Not comparable",
            value: loading ? "—" : fmtInt(result.notComparable.length),
            hint: "Pages the wider window did not return, or where the remainder came out negative. Excluded rather than zero-filled.",
          },
          {
            label: "Worst single page",
            value: loading || rows.length === 0 ? "—" : fmtSigned(rows[0].deltaClicks),
            hint: "Largest click loss on one URL in this window.",
          },
        ]}
      />

      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden", mb: { xs: 3, md: 4 } }}>
        <Disclosure summary="How the previous period is obtained">
          <Methodology
            label="Method"
            formula={
              <>
                previous = rows(days&nbsp;=&nbsp;{windowDays * 2}) − rows(days&nbsp;=&nbsp;{windowDays})
              </>
            }
            caveat={
              !loading && result.notComparable.length > 0 ? (
                <>
                  {result.notComparable.length} page{result.notComparable.length === 1 ? " was" : "s were"} excluded as
                  not comparable across the two windows ({result.comparable} compared).
                </>
              ) : undefined
            }
          >
            The route accepts a single lookback ending today, so the cockpit calls it twice and subtracts. Clicks and
            impressions are daily sums, so the subtraction is exact. CTR and position are averages and are never
            subtracted — that is why no previous position is shown anywhere in this sub-app. Pages the wider window did
            not return, or where the remainder comes out negative, are excluded rather than zero-filled. The size of the
            click loss is what the Work queue normalises when it ranks decayed pages against the other analyses.
          </Methodology>
        </Disclosure>
      </Box>

      <FindingList
        heading="Declining pages"
        caption={
          loading
            ? "Loading…"
            : `${rows.length} declining · ${result.comparable} compared · last ${windowDays} days vs the ${windowDays} before · worst first`
        }
        items={findings}
        loading={loading}
        searchPlaceholder="Search pages"
        empty={
          <AllClear title="Nothing to act on in this window">
            Across the {fmtInt(result.comparable)} page{result.comparable === 1 ? "" : "s"} comparable between the two
            windows, none earned fewer clicks in the last {windowDays} days than in the {windowDays} days before.{" "}
            <strong>That is the good result.</strong> Pages that have already fallen out of the {GSC_ROW_LIMIT}-row limit
            the API returns cannot be compared, so they are not covered by this all-clear.
          </AllClear>
        }
      />

      <SourceNote>
        Source: Google Search Console, dimension{" "}
        <Box component="code" sx={{ fontFamily: MONO }}>
          page
        </Box>
        , two calls. Deltas are computed from returned totals only.
      </SourceNote>
    </SubAppFrame>
  );
}
