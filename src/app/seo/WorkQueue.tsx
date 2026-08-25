"use client";

/**
 * WORK QUEUE — the single ranked list the ACTIONS half exists for.
 *
 * Every row is a finding one of the three analyses already produced. This view
 * adds no metric of its own: it merges, normalises (see queue.ts), and
 * hands each row off to Create Studio with the topic prefilled. The evidence
 * columns are rendered straight from the analysis output carried on the row.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditNote from "@mui/icons-material/EditNote";
import { GSC_PAIR_ROW_LIMIT, GSC_ROW_LIMIT } from "./gscClient";
import DataTable, { type Column } from "./DataTable";
import {
  SOURCE_META,
  WORK_SOURCES,
  availableSources,
  createHref,
  listPhrase,
  unavailableSources,
  type WorkDetail,
  type WorkItem,
  type WorkQueueResult,
  type WorkSource,
} from "./queue";
import {
  AllClear,
  Explainer,
  HAIRLINE,
  HairlineCard,
  INK,
  MONO,
  MUTED,
  Methodology,
  NAVY,
  NUMERIC,
  RED,
  SURFACE,
  SectionLabel,
  SourceNote,
  TableHeading,
  Tag,
  fmtCtr,
  fmtInt,
  fmtPct,
  fmtPosition,
  fmtSigned,
  shortPath,
} from "./ui";

/* ── row presentation ──────────────────────────────────────────────────── */

const SOURCE_TONE: Record<WorkSource, { color: string; bg: string }> = {
  "quick-win": { color: NAVY, bg: "#eaf0f4" },
  cannibalisation: { color: RED, bg: "#fdebed" },
  decay: { color: MUTED, bg: SURFACE },
};

/**
 * What an empty result from each analysis means, in plain words. Used only for
 * analyses that actually ran — a failed call is never reported as "found
 * nothing".
 */
const CLEAR_CLAIM: Record<WorkSource, string> = {
  "quick-win": "no query sits in the quick-win position band",
  cannibalisation: "no query is answered by two or more of your own URLs",
  decay: "no page earns fewer clicks than it did in the previous period",
};

/** One compact line of the figures the analysis reported for this finding. */
function Evidence({ detail }: { detail: WorkDetail }): ReactNode {
  const parts: string[] =
    detail.source === "quick-win"
      ? [
          `position ${fmtPosition(detail.win.position)}`,
          `proximity ${detail.win.proximity.toFixed(2)}`,
          `${fmtInt(detail.win.clicks)} clicks now`,
          `CTR ${fmtCtr(detail.win.ctr)}`,
        ]
      : detail.source === "cannibalisation"
        ? [
            `${fmtInt(detail.group.pageCount)} competing URLs`,
            `best position ${fmtPosition(detail.group.bestPosition)}`,
            `spread ${detail.group.positionSpread === null ? "—" : detail.group.positionSpread.toFixed(1)}`,
            `${fmtInt(detail.group.totalClicks)} clicks split`,
          ]
        : [
            `${fmtInt(detail.row.previousClicks)} → ${fmtInt(detail.row.currentClicks)} clicks`,
            // The percentage is omitted rather than shown as an em-dash in
            // brackets when the previous period had no clicks to divide by.
            detail.row.deltaPct === null
              ? fmtSigned(detail.row.deltaClicks)
              : `${fmtSigned(detail.row.deltaClicks)} (${fmtPct(detail.row.deltaPct)})`,
            `impressions ${fmtInt(detail.row.previousImpressions)} → ${fmtInt(detail.row.currentImpressions)}`,
          ];

  return (
    <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.55, ...NUMERIC }}>
      {parts.join(" · ")}
    </Typography>
  );
}

function PriorityCell({ item }: { item: WorkItem }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
      <Box sx={{ width: 60, height: 5, borderRadius: 3, bgcolor: "#eef0f3", overflow: "hidden" }}>
        <Box
          sx={{
            width: `${Math.max(2, Math.min(100, item.priority))}%`,
            height: "100%",
            bgcolor: SOURCE_TONE[item.source].color,
          }}
        />
      </Box>
      <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: INK, minWidth: 28, ...NUMERIC }}>
        {Math.round(item.priority)}
      </Typography>
    </Box>
  );
}

/* ── coverage strip ────────────────────────────────────────────────────── */

function Coverage({ result }: { result: WorkQueueResult }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        gap: 1.5,
        mb: 2.5,
      }}
    >
      {WORK_SOURCES.map((source) => {
        const cov = result.coverage[source];
        const meta = SOURCE_META[source];
        const bad = cov.status === "unavailable";
        return (
          <Box
            key={source}
            sx={{
              px: 2,
              py: 1.5,
              border: `1px solid ${HAIRLINE}`,
              borderLeft: `3px solid ${bad ? RED : NAVY}`,
              borderRadius: 1.5,
              bgcolor: "#fff",
              minWidth: 0,
            }}
          >
            <SectionLabel>{meta.analysis}</SectionLabel>
            {cov.status === "available" ? (
              <Typography sx={{ mt: 0.4, fontSize: "0.82rem", color: INK, lineHeight: 1.5 }}>
                <Box component="span" sx={{ fontWeight: 700, ...NUMERIC }}>
                  {fmtInt(cov.found)}
                </Box>{" "}
                {cov.found === 1 ? "finding" : "findings"} in the queue
                {cov.found > 0 && (
                  <Box component="span" sx={{ color: MUTED }}>
                    {" "}
                    · leader scores {fmtInt(result.leaders[source])}
                  </Box>
                )}
              </Typography>
            ) : (
              <Typography sx={{ mt: 0.4, fontSize: "0.8rem", color: RED, lineHeight: 1.55 }}>
                Not in this queue — {cov.reason}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── filter chips ──────────────────────────────────────────────────────── */

type Filter = WorkSource | "all";

function FilterChips({
  value,
  counts,
  total,
  onChange,
}: {
  value: Filter;
  counts: Record<WorkSource, number>;
  total: number;
  onChange: (f: Filter) => void;
}) {
  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All findings", count: total },
    ...WORK_SOURCES.map((s) => ({ id: s as Filter, label: SOURCE_META[s].label, count: counts[s] })),
  ];

  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <Box
            key={chip.id}
            component="button"
            type="button"
            onClick={() => onChange(chip.id)}
            sx={{
              cursor: "pointer",
              border: `1px solid ${active ? NAVY : HAIRLINE}`,
              bgcolor: active ? NAVY : "#fff",
              color: active ? "#fff" : MUTED,
              borderRadius: 1.25,
              px: 1.25,
              py: 0.55,
              fontSize: "0.76rem",
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              "&:hover": { borderColor: active ? NAVY : "#c9d0d8" },
            }}
          >
            {chip.label}
            <Box component="span" sx={{ ml: 0.75, opacity: 0.75, ...NUMERIC }}>
              {chip.count}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the view ──────────────────────────────────────────────────────────── */

export default function WorkQueue({
  result,
  loading,
  days,
}: {
  result: WorkQueueResult | null;
  loading: boolean;
  days: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const items = result?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<WorkSource, number> = { "quick-win": 0, cannibalisation: 0, decay: 0 };
    for (const item of items) c[item.source] += 1;
    return c;
  }, [items]);

  const rows = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.source === filter)),
    [items, filter],
  );

  const rowKey = useCallback((r: WorkItem) => r.id, []);
  const searchText = useCallback(
    (r: WorkItem) => `${r.subject} ${r.action} ${SOURCE_META[r.source].label}`,
    [],
  );

  const columns: Column<WorkItem>[] = [
    {
      id: "rank",
      label: "#",
      numeric: true,
      width: 54,
      sortValue: (r) => r.rank,
      hint: "Position in the merged ranking. Stays with the row if you re-sort the table.",
      render: (r) => <Typography sx={{ fontSize: "0.8rem", color: MUTED, ...NUMERIC }}>{r.rank}</Typography>,
    },
    {
      id: "priority",
      label: "Priority",
      numeric: true,
      width: 128,
      sortValue: (r) => r.priority,
      hint: "100 × this finding's score ÷ the largest score of the same analysis in this window. Comparable within an analysis, not across analyses.",
      render: (r) => <PriorityCell item={r} />,
    },
    {
      id: "source",
      label: "Analysis",
      width: 132,
      sortValue: (r) => SOURCE_META[r.source].label,
      hint: "Which analysis produced this finding.",
      render: (r) => <Tag label={SOURCE_META[r.source].label} {...SOURCE_TONE[r.source]} />,
    },
    {
      id: "subject",
      label: "Finding",
      sortValue: (r) => r.subject.toLowerCase(),
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Tooltip title={r.subject} placement="top-start">
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: INK,
                fontFamily: r.source === "decay" ? MONO : undefined,
                maxWidth: { xs: 220, sm: 300, lg: 420, xl: 560 },
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.source === "decay" ? shortPath(r.subject) : r.subject}
            </Typography>
          </Tooltip>
          <Typography sx={{ mt: 0.3, fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{r.action}</Typography>
        </Box>
      ),
    },
    {
      id: "evidence",
      label: "Evidence",
      hint: "The figures the analysis reported for this finding, unmodified.",
      render: (r) => <Evidence detail={r.detail} />,
    },
    {
      id: "impressions",
      label: "Impressions",
      numeric: true,
      width: 118,
      sortValue: (r) => r.impressions,
      hint: "Impressions the analysis attached to this finding. Also the tie-break when two rows share a priority.",
      render: (r) => fmtInt(r.impressions),
    },
    {
      id: "score",
      label: "Native score",
      numeric: true,
      width: 130,
      sortValue: (r) => r.nativeScore,
      hint: "The analysis's own score, in its own unit — the number the priority column normalises. Hover a row's Analysis tag to see which formula applies.",
      render: (r) => (
        <Tooltip title={`${SOURCE_META[r.source].formula} — ${SOURCE_META[r.source].unit}`} placement="top">
          <Box component="span" sx={{ cursor: "help" }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: NAVY, ...NUMERIC }}>
              {fmtInt(r.nativeScore)}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      id: "action",
      label: "Action",
      width: 168,
      render: (r) => (
        <Button
          component={Link}
          href={createHref(r.topic)}
          size="small"
          variant="contained"
          disableElevation
          startIcon={<EditNote sx={{ fontSize: 17 }} />}
          sx={{
            bgcolor: NAVY,
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "#1d3c4e" },
          }}
        >
          Open in Create
        </Button>
      ),
    },
  ];

  const methodology = (
    <Methodology
      label="How the merged ranking is computed"
      formula={
        <>
          priority = 100 × score ÷ (largest score of the same analysis in this window)
          <br />
          quick win&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;score = impressions × proximity
          <br />
          cannibalisation score = impressions × closeness
          <br />
          decay&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;score = previous clicks − current clicks
        </>
      }
      caveat={
        <>
          The three scores are not in the same unit — two count impressions, one counts clicks — and converting between
          them would mean assuming a click-through rate. This cockpit does not assume one. So priority is a
          share-of-leader <em>within</em> each analysis: it is exact to say a 40 is 40% as big as the biggest finding of
          its own kind, and it is <strong>not</strong> a claim that a 70 from decay outranks a 60 from quick wins in
          revenue. The native score behind every row is shown next to it.
        </>
      }
    >
      Each analysis already ranks its own findings. The queue keeps those scores untouched and expresses each one as a
      percentage of the biggest finding of its kind, which is the only normalisation available without inventing a
      conversion. The leader of each analysis therefore scores 100. Rows that tie — including those three leaders — are
      ordered by the impressions the analysis attached to them, then by a stable id, so the list never reshuffles between
      renders.
    </Methodology>
  );

  const explainer = (
    <Explainer title="Work queue">
      Every actionable finding from all three analyses, merged and ranked into one list to work top-down. Each row states
      which analysis produced it, the evidence figures behind it, and opens Create Studio with the topic already filled
      in. Nothing here is new analysis — it is the diagnostic half, sorted by what to do first.
    </Explainer>
  );

  /* Genuinely nothing to do — a good outcome, and worded as one. */
  if (!loading && result && items.length === 0) {
    const ran = availableSources(result.coverage);
    const missing = unavailableSources(result.coverage);
    // Only claim the all-clear for analyses that actually ran. An analysis that
    // failed must never be reported as "found nothing".
    const claims = ran.map((s) => CLEAR_CLAIM[s]);

    return (
      <Box>
        {explainer}
        <Coverage result={result} />
        <HairlineCard>
          {methodology}
          <AllClear title="Nothing is waiting to be acted on">
            {ran.length > 0 ? (
              <>
                Over the last {days} days, {listPhrase(claims)}. <strong>That is the good result</strong> — the queue is
                empty because {ran.length === 1 ? "the analysis that ran" : "the analyses that ran"} found nothing to
                fix, not because a number is missing.
              </>
            ) : (
              <>No analysis could run for this window, so the queue is empty for lack of data rather than lack of work.</>
            )}
            {missing.length > 0 && (
              <Box component="span" sx={{ display: "block", mt: 1.25, color: RED }}>
                One caveat: {listPhrase(missing.map((s) => SOURCE_META[s].analysis.toLowerCase()))} did not run for this
                window, so findings of that kind are not represented above and the all-clear does not cover them.
              </Box>
            )}
          </AllClear>
        </HairlineCard>
        <SourceNote>
          Source: Google Search Console. The queue merges the output of the analyses in the Analysis half and adds no
          metric of its own.
        </SourceNote>
      </Box>
    );
  }

  const filterLabel = filter === "all" ? "findings" : `${SOURCE_META[filter].label.toLowerCase()} findings`;

  return (
    <Box>
      {explainer}

      {result && <Coverage result={result} />}

      <HairlineCard>
        {methodology}

        <DataTable<WorkItem>
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          searchText={searchText}
          searchPlaceholder="Search findings"
          initialSort={{ id: "rank", dir: "asc" }}
          loading={loading}
          maxHeight={680}
          skeletonRows={10}
          emptyTitle={`No ${filterLabel} in this window`}
          emptyBody={
            filter === "all"
              ? `The analyses returned no actionable finding for the last ${days} days.`
              : `Nothing of that kind is queued for the last ${days} days. Switch back to “All findings” to see the ${items.length} item${items.length === 1 ? "" : "s"} the other analyses produced.`
          }
          toolbarLeft={
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <TableHeading
                label="Ranked work queue"
                caption={
                  loading
                    ? "Loading…"
                    : `${rows.length} of ${items.length} finding${items.length === 1 ? "" : "s"} · last ${days} days · highest priority first`
                }
              />
              <FilterChips value={filter} counts={counts} total={items.length} onChange={setFilter} />
            </Box>
          }
        />
      </HairlineCard>

      <SourceNote>
        Source: Google Search Console. Quick-win and decay findings come from single-dimension calls capped at{" "}
        {GSC_ROW_LIMIT} rows; cannibalisation findings come from the query+page pair call capped at {GSC_PAIR_ROW_LIMIT}{" "}
        pair rows. The queue therefore covers the head of the tail, not every long-tail query. Every figure shown is a
        value one of the analyses computed from rows Search Console returned.
      </SourceNote>
    </Box>
  );
}
