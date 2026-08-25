"use client";

/**
 * CANNIBALISATION — queries answered by two or more of your own URLs.
 *
 * Measurable only from query+page pair rows (see fetchGscPairs): two separate
 * single-dimension lists carry nothing that says which query drove which URL,
 * so they can never be rejoined. When that one call fails, this sub-app says so
 * and the other four are unaffected.
 */

import { useMemo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { GSC_PAIR_ROW_LIMIT, GSC_SUPPORTS_DIMENSION_PAIR } from "./gscClient";
import {
  CANNIBAL_CLICK_DOMINANCE,
  CANNIBAL_MIN_COMPETING_PAGES,
  CANNIBAL_MIN_IMPRESSIONS_PER_PAGE,
  CANNIBAL_POSITION_LEAD,
  CANNIBAL_SPREAD_TOLERANCE,
  cannibalisationOf,
  pageKindOf,
  type CannibalGroup,
  type CannibalRecommendation,
  type CompetingPage,
} from "./analysis";
import FindingList, { DetailNote, type Finding } from "./Finding";
import { cannibalTopic, createHref } from "./queue";
import { PAIRS_PENDING, useSeoData } from "./SeoData";
import { Caveat, Disclosure, HeroStat, SubAppFrame } from "./Shell";
import {
  AllClear,
  HAIRLINE,
  INK,
  MONO,
  MUTED,
  Methodology,
  NAVY,
  NUMERIC,
  NotConnected,
  RED,
  SURFACE,
  SourceNote,
  Tag,
  UpstreamError,
  fmtCtr,
  fmtInt,
  fmtPosition,
  shortPath,
} from "./ui";

const WILL_SHOW =
  "Once Search Console is connected this sub-app pulls query+page pairs for the property and lists every query answered by two or more of your own URLs, with the clicks and positions each URL takes and which page to keep.";

/* ── local formatting ──────────────────────────────────────────────────── */

function fmtSpread(spread: number | null): string {
  if (spread === null || !Number.isFinite(spread)) return "—";
  return spread.toFixed(1);
}

function fmtShare(clicks: number, totalClicks: number): string {
  if (totalClicks <= 0) return "—";
  return `${((clicks / totalClicks) * 100).toFixed(0)}%`;
}

/* ── recommendation presentation ───────────────────────────────────────── */

function badgeOf(rec: CannibalRecommendation): { label: string; color: string; bg: string } {
  switch (rec.kind) {
    case "consolidate":
      return { label: "Consolidate", color: RED, bg: "#fdebed" };
    case "assign-intent":
      return { label: "Assign intent", color: NAVY, bg: "#eaf0f4" };
    case "differentiate":
      return { label: "Differentiate", color: MUTED, bg: SURFACE };
  }
}

function Url({ href }: { href: string }) {
  return (
    <Tooltip title={href} placement="top">
      <Box component="code" sx={{ fontFamily: MONO, fontSize: "0.85em", color: NAVY, cursor: "help", wordBreak: "break-all" }}>
        {shortPath(href)}
      </Box>
    </Tooltip>
  );
}

/**
 * The sentence is chosen by analysis.ts from the group's own numbers; this only
 * renders it and names the two URLs involved.
 */
function RecommendationText({ rec }: { rec: CannibalRecommendation }): ReactNode {
  if (rec.kind === "consolidate") {
    return (
      <>
        <strong>Consolidate:</strong> redirect or canonicalise the weaker URL <Url href={rec.fold} /> into the stronger
        one <Url href={rec.keep} />. One URL already takes at least {Math.round(CANNIBAL_CLICK_DOMINANCE * 100)}% of the
        clicks and ranks at least {CANNIBAL_POSITION_LEAD} positions ahead, so the second listing only splits the signal.
      </>
    );
  }
  if (rec.kind === "assign-intent") {
    return (
      <>
        <strong>Assign intent:</strong> keep the product page <Url href={rec.product} /> for the transactional query and
        retune the article <Url href={rec.editorial} /> to the informational variant. These two answer different intents,
        so merging them would destroy one of them.
      </>
    );
  }
  return (
    <>
      <strong>Differentiate:</strong> <Url href={rec.keep} /> and <Url href={rec.retarget} /> rank and earn comparably —
      the two pages target the same intent. Retarget one to an adjacent query, or merge them into a single stronger page.
    </>
  );
}

/* ── the competing-URL table, shown on demand ──────────────────────────── */

const SUB_HEAD = {
  color: MUTED,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  borderBottom: `1px solid ${HAIRLINE}`,
  py: 1,
  whiteSpace: "nowrap" as const,
};

const SUB_CELL = { borderBottom: `1px solid ${HAIRLINE}`, color: INK, fontSize: "0.82rem", py: 1.1 };

function CompetingPages({ pages, totalClicks }: { pages: CompetingPage[]; totalClicks: number }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, bgcolor: "#fff", overflowX: "auto" }}>
      <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={SUB_HEAD}>Competing URL</TableCell>
            <TableCell align="right" sx={{ ...SUB_HEAD, width: 88 }}>
              Clicks
            </TableCell>
            <TableCell align="right" sx={{ ...SUB_HEAD, width: 90 }}>
              Share
            </TableCell>
            <TableCell align="right" sx={{ ...SUB_HEAD, width: 110 }}>
              Impressions
            </TableCell>
            <TableCell align="right" sx={{ ...SUB_HEAD, width: 86 }}>
              CTR
            </TableCell>
            <TableCell align="right" sx={{ ...SUB_HEAD, width: 92 }}>
              Position
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pages.map((p) => {
            const kind = pageKindOf(p.page);
            return (
              <TableRow key={p.page}>
                <TableCell sx={SUB_CELL}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <Tooltip title={p.page} placement="top-start">
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          fontFamily: MONO,
                          color: INK,
                          maxWidth: { xs: 220, sm: 380, lg: 620, xl: 880 },
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shortPath(p.page)}
                      </Typography>
                    </Tooltip>
                    {kind !== "unknown" && <Tag label={kind} />}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ ...SUB_CELL, ...NUMERIC }}>
                  {fmtInt(p.clicks)}
                </TableCell>
                <TableCell align="right" sx={{ ...SUB_CELL, ...NUMERIC }}>
                  {fmtShare(p.clicks, totalClicks)}
                </TableCell>
                <TableCell align="right" sx={{ ...SUB_CELL, ...NUMERIC }}>
                  {fmtInt(p.impressions)}
                </TableCell>
                <TableCell align="right" sx={{ ...SUB_CELL, ...NUMERIC }}>
                  {fmtCtr(p.ctr)}
                </TableCell>
                <TableCell align="right" sx={{ ...SUB_CELL, ...NUMERIC }}>
                  {fmtPosition(p.position)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function findingOf(group: CannibalGroup): Finding {
  const badge = badgeOf(group.recommendation);
  return {
    id: group.query,
    score: fmtInt(group.severity),
    scoreCaption: "severity",
    scoreTone: RED,
    subject: group.query,
    tag: <Tag label={badge.label} color={badge.color} bg={badge.bg} />,
    reason: `${fmtInt(group.pageCount)} of your URLs · ${fmtInt(group.totalImpressions)} impressions split · best position ${fmtPosition(group.bestPosition)} · spread ${fmtSpread(group.positionSpread)}`,
    action: { href: createHref(cannibalTopic(group)), label: "Brief the fix" },
    searchText: `${group.query} ${group.pages.map((p) => p.page).join(" ")}`,
    details: (
      <>
        <DetailNote>
          <RecommendationText rec={group.recommendation} />
        </DetailNote>
        <DetailNote>
          Severity = <strong>{fmtInt(group.totalImpressions)}</strong> impressions ×{" "}
          <strong>{group.closeness.toFixed(2)}</strong> closeness = <strong>{fmtInt(group.severity)}</strong>. Closeness
          comes from a spread of {fmtSpread(group.positionSpread)} positions against a tolerance of{" "}
          {CANNIBAL_SPREAD_TOLERANCE}.
        </DetailNote>
        <CompetingPages pages={group.pages} totalClicks={group.totalClicks} />
      </>
    ),
  };
}

/* ── sub-app ───────────────────────────────────────────────────────────── */

export default function Cannibalisation() {
  const { data, loading, windowDays, retry } = useSeoData();

  const pairs = data?.pairs ?? PAIRS_PENDING;
  const pairRows = pairs.status === "ready" ? pairs.rows : [];
  const groups = useMemo(() => cannibalisationOf(pairRows), [pairRows]);
  const findings = useMemo(() => groups.map(findingOf), [groups]);

  const impressionsSplit = useMemo(() => groups.reduce((sum, g) => sum + g.totalImpressions, 0), [groups]);
  const clicksSplit = useMemo(() => groups.reduce((sum, g) => sum + g.totalClicks, 0), [groups]);

  const purpose =
    "Queries where two or more of your own URLs compete. Google splits the signal, and both pages usually rank worse than one strong page would alone.";

  /* The pair call can fail on its own — contained here, never blanking the others. */
  if (pairs.status === "not-connected") {
    return (
      <SubAppFrame title="Cannibalisation" purpose={purpose} willShow={WILL_SHOW}>
        <NotConnected
          source="Google Search Console"
          missing={pairs.missing}
          detail={pairs.detail}
          willShow={WILL_SHOW}
        />
      </SubAppFrame>
    );
  }

  if (pairs.status === "error") {
    return (
      <SubAppFrame title="Cannibalisation" purpose={purpose} willShow={WILL_SHOW}>
        <Caveat>
          The query+page pair call failed, so no cannibalisation could be measured for this window. The other four
          sub-apps are unaffected — they use separate calls that succeeded — and the Work queue records this analysis as
          unavailable rather than quietly ranking without it.
        </Caveat>
        <UpstreamError error={pairs.error} status={pairs.httpStatus} onRetry={retry} />
      </SubAppFrame>
    );
  }

  const sourceNote = GSC_SUPPORTS_DIMENSION_PAIR
    ? `Source: Google Search Console searchAnalytics.query requested with dimensions ["query", "page"] in a single call — at most ${GSC_PAIR_ROW_LIMIT} pair rows for the window. Every number here is a value Search Console returned; nothing is estimated, modelled or split by share.`
    : "Pair mode is not available from /api/integrations/gsc, so cannibalisation cannot be measured from the data this cockpit receives.";

  return (
    <SubAppFrame title="Cannibalisation" purpose={purpose} willShow={WILL_SHOW}>
      <HeroStat
        label={`Split queries · last ${windowDays} days`}
        value={loading ? "—" : fmtInt(groups.length)}
        tone={groups.length > 0 ? RED : INK}
        note={
          <>
            Queries answered by {CANNIBAL_MIN_COMPETING_PAGES} or more of your own URLs. Fix the top rows first: severity
            ranks by how much demand is being split and how closely the competing URLs sit together.
          </>
        }
        supporting={[
          {
            label: "Impressions split",
            value: loading ? "—" : fmtInt(impressionsSplit),
            hint: "Sum of the impressions of every split query — the demand being divided between your own pages.",
          },
          {
            label: "Clicks split",
            value: loading ? "—" : fmtInt(clicksSplit),
            hint: "Clicks those queries earned, summed across the competing URLs.",
          },
          {
            label: "Worst severity",
            value: loading || groups.length === 0 ? "—" : fmtInt(groups[0].severity),
            hint: "impressions × closeness for the leading row.",
          },
          {
            label: "Pair rows scanned",
            value: loading ? "—" : fmtInt(pairRows.length),
            hint: `Query+page pairs Search Console returned for this window, capped at ${GSC_PAIR_ROW_LIMIT}.`,
          },
        ]}
      />

      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden", mb: { xs: 3, md: 4 } }}>
        <Disclosure summary="How severity is computed">
          <Methodology
            label="Formula"
            formula={
              <>
                spread&nbsp;&nbsp;&nbsp;&nbsp;= position(2nd best URL) − position(best URL)
                <br />
                closeness = ({CANNIBAL_SPREAD_TOLERANCE} − spread) ÷ {CANNIBAL_SPREAD_TOLERANCE}, clamped to 0–1
                <br />
                severity&nbsp;&nbsp;= impressions × closeness
              </>
            }
          >
            A split costs most when the two URLs sit close together — they alternate in the same result set and share one
            pool of clicks — and when the demand being split is large. A URL {CANNIBAL_SPREAD_TOLERANCE} positions or
            more behind the leader is a separate, deeper listing and scores zero closeness. Filter: at least{" "}
            {CANNIBAL_MIN_COMPETING_PAGES} distinct URLs with {CANNIBAL_MIN_IMPRESSIONS_PER_PAGE} impression or more for
            the same query. Where a position is missing for two or more URLs the spread cannot be measured, so closeness
            is scored 0 rather than guessed and the row sinks to the bottom. Severity is also what the Work queue
            normalises when it ranks cannibalised queries against the other analyses.
          </Methodology>
        </Disclosure>
      </Box>

      <FindingList
        heading="Split queries"
        caption={
          loading
            ? "Loading…"
            : `${groups.length} quer${groups.length === 1 ? "y" : "ies"} split across multiple URLs · ${pairRows.length} pair row${pairRows.length === 1 ? "" : "s"} scanned · worst first`
        }
        items={findings}
        loading={loading}
        searchPlaceholder="Search queries or URLs"
        empty={
          <AllClear title="Nothing to act on in this window">
            Search Console returned {fmtInt(pairRows.length)} query+page pair{pairRows.length === 1 ? "" : "s"} for the
            last {windowDays} days, and every query was answered by a single URL of yours.{" "}
            <strong>That is the healthy result</strong> — there is nothing to consolidate. Only the top{" "}
            {GSC_PAIR_ROW_LIMIT} pairs are returned, so this covers the head of the tail rather than every long-tail
            query.
          </AllClear>
        }
      />

      <SourceNote>{sourceNote}</SourceNote>
    </SubAppFrame>
  );
}
