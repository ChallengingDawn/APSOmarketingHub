"use client";

/**
 * WORK QUEUE — the merged, ranked list of everything actionable.
 *
 * Every row is a finding one of the other analyses already produced. This
 * sub-app adds no metric of its own: it merges, normalises (see queue.ts), and
 * hands each row off to Create Studio with the topic prefilled. Each row names
 * the analysis that produced it, and the normalisation rule is stated in full.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { GSC_PAIR_ROW_LIMIT, GSC_ROW_LIMIT } from "./gscClient";
import FindingList, { DetailGrid, DetailNote, type Finding } from "./Finding";
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
import { useSeoData } from "./SeoData";
import { Disclosure, HeroStat, SubAppFrame } from "./Shell";
import {
  AllClear,
  HAIRLINE,
  INK,
  MUTED,
  Methodology,
  NAVY,
  NUMERIC,
  RED,
  SURFACE,
  SectionLabel,
  SourceNote,
  Tag,
  fmtCtr,
  fmtInt,
  fmtPct,
  fmtPosition,
  fmtSigned,
  shortPath,
} from "./ui";

const WILL_SHOW =
  "Once Search Console is connected this sub-app merges every actionable finding from Quick wins, Cannibalisation and Decay into one ranked list, each row naming the analysis behind it and opening Create Studio with the topic prefilled.";

const SOURCE_TONE: Record<WorkSource, { color: string; bg: string }> = {
  "quick-win": { color: NAVY, bg: "#eaf0f4" },
  cannibalisation: { color: RED, bg: "#fdebed" },
  decay: { color: MUTED, bg: SURFACE },
};

/**
 * What an empty result from each analysis means, in plain words. Used only for
 * analyses that actually ran — a failed call is never reported as "found nothing".
 */
const CLEAR_CLAIM: Record<WorkSource, string> = {
  "quick-win": "no query sits in the quick-win position band",
  cannibalisation: "no query is answered by two or more of your own URLs",
  decay: "no page earns fewer clicks than it did in the previous period",
};

/* ── evidence, rendered straight from the analysis output ──────────────── */

function evidenceGrid(detail: WorkDetail): { label: string; value: string; note?: string }[] {
  if (detail.source === "quick-win") {
    const w = detail.win;
    return [
      { label: "Impressions", value: fmtInt(w.impressions), note: "Score input 1" },
      { label: "Position", value: fmtPosition(w.position), note: "Score input 2" },
      { label: "Proximity", value: w.proximity.toFixed(2), note: "Closeness to page one" },
      { label: "Clicks now", value: fmtInt(w.clicks), note: `CTR ${fmtCtr(w.ctr)}` },
    ];
  }
  if (detail.source === "cannibalisation") {
    const g = detail.group;
    return [
      { label: "Competing URLs", value: fmtInt(g.pageCount), note: "Your own pages on one query" },
      { label: "Impressions split", value: fmtInt(g.totalImpressions), note: "Severity input 1" },
      {
        label: "Spread",
        value: g.positionSpread === null ? "—" : g.positionSpread.toFixed(1),
        note: `Closeness ${g.closeness.toFixed(2)}`,
      },
      { label: "Clicks split", value: fmtInt(g.totalClicks), note: `Best position ${fmtPosition(g.bestPosition)}` },
    ];
  }
  const r = detail.row;
  return [
    { label: "Previous clicks", value: fmtInt(r.previousClicks), note: "Derived by subtraction" },
    { label: "Current clicks", value: fmtInt(r.currentClicks), note: "As reported" },
    { label: "Δ clicks", value: fmtSigned(r.deltaClicks), note: r.deltaPct === null ? "No previous base" : fmtPct(r.deltaPct) },
    {
      label: "Impressions",
      value: `${fmtInt(r.previousImpressions)} → ${fmtInt(r.currentImpressions)}`,
      note: `Position ${fmtPosition(r.currentPosition)}`,
    },
  ];
}

/** One compact line of the figures the analysis reported for this finding. */
function evidenceLine(detail: WorkDetail): string {
  if (detail.source === "quick-win") {
    const w = detail.win;
    return `position ${fmtPosition(w.position)} · ${fmtInt(w.impressions)} impressions · proximity ${w.proximity.toFixed(2)}`;
  }
  if (detail.source === "cannibalisation") {
    const g = detail.group;
    return `${fmtInt(g.pageCount)} competing URLs · ${fmtInt(g.totalImpressions)} impressions split · spread ${g.positionSpread === null ? "—" : g.positionSpread.toFixed(1)}`;
  }
  const r = detail.row;
  const pct = r.deltaPct === null ? "" : ` (${fmtPct(r.deltaPct)})`;
  return `${fmtInt(r.previousClicks)} → ${fmtInt(r.currentClicks)} clicks${pct} · impressions ${fmtInt(r.previousImpressions)} → ${fmtInt(r.currentImpressions)}`;
}

function findingOf(item: WorkItem): Finding {
  const meta = SOURCE_META[item.source];
  const tone = SOURCE_TONE[item.source];

  return {
    id: item.id,
    score: String(Math.round(item.priority)),
    scoreCaption: "priority",
    scoreTone: tone.color,
    subject: item.source === "decay" ? shortPath(item.subject) : item.subject,
    subjectMono: item.source === "decay",
    tag: <Tag label={meta.label} color={tone.color} bg={tone.bg} />,
    reason: item.action,
    action: { href: createHref(item.topic), label: "Open in Create" },
    searchText: `${item.subject} ${item.action} ${meta.label}`,
    details: (
      <>
        <DetailNote>
          Ranked <strong>#{item.rank}</strong> by <strong>{meta.analysis}</strong>. Its native score is{" "}
          <strong>{fmtInt(item.nativeScore)}</strong> ({meta.formula}) and the leader of that analysis in this window
          scores 100, so this finding normalises to <strong>{Math.round(item.priority)}</strong>. {meta.unit}
        </DetailNote>
        <DetailGrid items={evidenceGrid(item.detail)} />
        <Typography sx={{ mt: 2, fontSize: "0.78rem", color: MUTED, lineHeight: 1.6, ...NUMERIC }}>
          Evidence as the analysis reported it: {evidenceLine(item.detail)}.
        </Typography>
      </>
    ),
  };
}

/* ── coverage: which analyses are represented in this queue ────────────── */

function Coverage({ result }: { result: WorkQueueResult }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
        mb: { xs: 3, md: 4 },
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
              px: 2.5,
              py: 2.25,
              border: `1px solid ${HAIRLINE}`,
              borderLeft: `3px solid ${bad ? RED : NAVY}`,
              borderRadius: 2,
              bgcolor: "#fff",
              minWidth: 0,
            }}
          >
            <SectionLabel>{meta.analysis}</SectionLabel>
            {cov.status === "available" ? (
              <Typography sx={{ mt: 0.75, fontSize: "0.86rem", color: INK, lineHeight: 1.6 }}>
                <Box component="span" sx={{ fontWeight: 700, ...NUMERIC }}>
                  {fmtInt(cov.found)}
                </Box>{" "}
                {cov.found === 1 ? "finding" : "findings"} in the queue
                {cov.found > 0 && (
                  <Box component="span" sx={{ color: MUTED }}> · leader scores {fmtInt(result.leaders[source])}</Box>
                )}
              </Typography>
            ) : (
              <Typography sx={{ mt: 0.75, fontSize: "0.82rem", color: RED, lineHeight: 1.6 }}>
                Not in this queue — {cov.reason}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── quiet secondary filter ────────────────────────────────────────────── */

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
            aria-pressed={active}
            sx={{
              cursor: "pointer",
              border: `1px solid ${active ? "#c3ced6" : HAIRLINE}`,
              bgcolor: active ? SURFACE : "#fff",
              color: active ? INK : MUTED,
              borderRadius: 1.5,
              px: 1.4,
              py: 0.6,
              fontSize: "0.78rem",
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              "&:hover": { borderColor: "#c9d0d8", color: INK },
            }}
          >
            {chip.label}
            <Box component="span" sx={{ ml: 0.75, opacity: 0.7, ...NUMERIC }}>
              {chip.count}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/* ── sub-app ───────────────────────────────────────────────────────────── */

export default function WorkQueue() {
  const { queue, loading, windowDays } = useSeoData();
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => queue?.items ?? [], [queue]);

  const counts = useMemo(() => {
    const c: Record<WorkSource, number> = { "quick-win": 0, cannibalisation: 0, decay: 0 };
    for (const item of items) c[item.source] += 1;
    return c;
  }, [items]);

  const rows = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.source === filter)),
    [items, filter],
  );

  const findings = useMemo(() => rows.map(findingOf), [rows]);

  const emptyFor = useCallback(
    (result: WorkQueueResult): ReactNode => {
      const ran = availableSources(result.coverage);
      const missing = unavailableSources(result.coverage);
      const claims = ran.map((s) => CLEAR_CLAIM[s]);

      return (
        <AllClear title="Nothing to act on in this window">
          {ran.length > 0 ? (
            <>
              Over the last {windowDays} days, {listPhrase(claims)}. <strong>That is the good result</strong> — the queue
              is empty because {ran.length === 1 ? "the analysis that ran" : "the analyses that ran"} found nothing to
              fix, not because a number is missing.
            </>
          ) : (
            <>No analysis could run for this window, so the queue is empty for lack of data rather than lack of work.</>
          )}
          {missing.length > 0 && (
            <Box component="span" sx={{ display: "block", mt: 1.5, color: RED }}>
              One caveat: {listPhrase(missing.map((s) => SOURCE_META[s].analysis.toLowerCase()))} did not run for this
              window, so findings of that kind are not represented and the all-clear does not cover them.
            </Box>
          )}
        </AllClear>
      );
    },
    [windowDays],
  );

  const filterLabel = filter === "all" ? "findings" : `${SOURCE_META[filter].label.toLowerCase()} findings`;

  return (
    <SubAppFrame
      title="Work queue"
      purpose="Every actionable finding from the other sub-apps, merged and ranked into one list to work top-down. No new analysis — the diagnostic half, sorted by what to do first."
      willShow={WILL_SHOW}
    >
      <HeroStat
        label={`Findings waiting · last ${windowDays} days`}
        value={loading ? "—" : fmtInt(items.length)}
        note={
          <>
            Merged from Quick wins, Cannibalisation and Decay. Priority is a share-of-leader within each analysis, so the
            order is honest inside an analysis and deliberately makes no cross-analysis revenue claim.
          </>
        }
        supporting={[
          {
            label: "Quick wins",
            value: loading ? "—" : fmtInt(counts["quick-win"]),
            hint: SOURCE_META["quick-win"].unit,
          },
          {
            label: "Cannibalisation",
            value: loading ? "—" : fmtInt(counts.cannibalisation),
            hint: SOURCE_META.cannibalisation.unit,
          },
          { label: "Decay", value: loading ? "—" : fmtInt(counts.decay), hint: SOURCE_META.decay.unit },
          {
            label: "Top priority",
            value: loading || items.length === 0 ? "—" : String(Math.round(items[0].priority)),
            hint: "The leading finding of its own analysis always normalises to 100.",
          },
        ]}
      />

      {queue && <Coverage result={queue} />}

      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden", mb: { xs: 3, md: 4 } }}>
        <Disclosure summary="How the merged ranking is computed">
          <Methodology
            label="Normalisation rule"
            formula={
              <>
                priority = 100 × score ÷ (largest score of the same analysis in this window)
                <br />
                quick win&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;score = impressions × proximity
                <br />
                cannibalisation score = impressions × closeness
                <br />
                decay&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;score = previous clicks − current
                clicks
              </>
            }
            caveat={
              <>
                The three scores are not in the same unit — two count impressions, one counts clicks — and converting
                between them would mean assuming a click-through rate. This cockpit does not assume one. So priority is a
                share-of-leader <em>within</em> each analysis: it is exact to say a 40 is 40% as big as the biggest
                finding of its own kind, and it is <strong>not</strong> a claim that a 70 from decay outranks a 60 from
                quick wins in revenue. The native score behind every row is under its Details.
              </>
            }
          >
            Each analysis already ranks its own findings. The queue keeps those scores untouched and expresses each one
            as a percentage of the biggest finding of its kind, which is the only normalisation available without
            inventing a conversion. The leader of each analysis therefore scores 100. Rows that tie — including those
            three leaders — are ordered by the impressions the analysis attached to them, then by a stable id, so the
            list never reshuffles between renders.
          </Methodology>
        </Disclosure>
      </Box>

      <FindingList
        heading="Ranked work queue"
        caption={
          loading
            ? "Loading…"
            : `${rows.length} of ${items.length} finding${items.length === 1 ? "" : "s"} · last ${windowDays} days · highest priority first`
        }
        items={findings}
        loading={loading}
        maxHeight={820}
        searchPlaceholder="Search findings"
        filters={<FilterChips value={filter} counts={counts} total={items.length} onChange={setFilter} />}
        empty={
          queue && items.length === 0 ? (
            emptyFor(queue)
          ) : (
            <AllClear label="Filtered" title={`No ${filterLabel} in this window`}>
              Nothing of that kind is queued for the last {windowDays} days. Switch back to “All findings” to see the{" "}
              {items.length} item{items.length === 1 ? "" : "s"} the other analyses produced.
            </AllClear>
          )
        }
      />

      <SourceNote>
        Source: Google Search Console. Quick-win and decay findings come from single-dimension calls capped at{" "}
        {GSC_ROW_LIMIT} rows; cannibalisation findings come from the query+page pair call capped at {GSC_PAIR_ROW_LIMIT}{" "}
        pair rows. The queue therefore covers the head of the tail, not every long-tail query. Every figure shown is a
        value one of the analyses computed from rows Search Console returned.
      </SourceNote>
    </SubAppFrame>
  );
}
