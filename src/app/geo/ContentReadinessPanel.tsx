"use client";

/**
 * Panel A — CONTENT READINESS.
 *
 * Audits the real library pieces returned by GET /api/content. If the content
 * service is unreachable or holds nothing, the panel says so; it never shows a
 * sample row. Every score on screen was computed from a stored body.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Link from "next/link";
import {
  auditGeoReadiness,
  derivedTitle,
  geoBand,
  geoFixList,
  GEO_BAND_LABELS,
  SCORE_BAND_STRONG,
  SCORE_BAND_WEAK,
  SCORE_BAND_WORKABLE,
  type GeoAuditResult,
  type GeoBand,
} from "@/lib/geo/audit";
import {
  BAND_COLOR,
  C,
  DISPLAY_FONT,
  DistributionBar,
  EmptyStateCard,
  LoadingCard,
  Panel,
  ScoreBadge,
  SectionLabel,
  UpstreamErrorCard,
  VerdictChip,
} from "./geoUi";
import CheckResults from "./CheckResults";

/** Matches the library's own ceiling — the most recent N pieces. */
const FETCH_LIMIT = 200;

/** Keeps the /create hand-off URL inside every browser's address-bar limit. */
const FIX_PARAM_MAX_CHARS = 1400;

type ContentItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Scored = {
  item: ContentItem;
  audit: GeoAuditResult;
};

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: ContentItem[] };

const BAND_ORDER: GeoBand[] = ["poor", "weak", "workable", "strong"];

/**
 * Hands the piece and its concrete fix list to the Create studio. The studio
 * reads `channel` (its existing param); the GEO params ride alongside so the
 * brief carries the exact edits rather than "make it better".
 */
function improveHref(scored: Scored): string {
  const fixes = geoFixList(scored.audit).join(" | ").slice(0, FIX_PARAM_MAX_CHARS);
  const params = new URLSearchParams({
    channel: scored.item.channel,
    geoPieceId: String(scored.item.id),
    geoScore: String(scored.audit.score),
    geoChecks: [...scored.audit.failing, ...scored.audit.warning].join(","),
    geoFixes: fixes,
  });
  return `/create?${params.toString()}`;
}

function Row({ scored, expanded, onToggle }: { scored: Scored; expanded: boolean; onToggle: () => void }) {
  const { item, audit } = scored;
  const title = item.title?.trim() || derivedTitle(item.body) || `Piece #${item.id}`;
  const problems = audit.checks.filter((c) => c.verdict !== "pass");

  return (
    <Box sx={{ borderTop: `1px solid ${C.hairline}` }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          p: 2,
          "&:hover": { bgcolor: C.surface },
        }}
      >
        <ScoreBadge score={audit.score} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: 15,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.375 }}>
            {item.channel} · {item.status} · {audit.stats.words} words · {item.createdAt.slice(0, 10)} ·{" "}
            {GEO_BAND_LABELS[audit.band]}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
            {problems.length === 0 ? (
              <VerdictChip verdict="pass" label="All seven checks pass" />
            ) : (
              problems.map((c) => (
                <VerdictChip key={c.id} verdict={c.verdict} label={c.label} onClick={onToggle} />
              ))
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, alignItems: "stretch" }}>
          <Button
            size="small"
            onClick={onToggle}
            endIcon={
              <ExpandMoreIcon
                fontSize="small"
                sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            }
            sx={{ textTransform: "none", color: C.navy, fontWeight: 600, fontSize: 12.5 }}
          >
            {expanded ? "Hide" : "Details"}
          </Button>
          <Button
            component={Link}
            href={improveHref(scored)}
            size="small"
            variant="outlined"
            startIcon={<AutoFixHighIcon fontSize="small" />}
            disabled={problems.length === 0}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 12.5,
              borderRadius: "2px",
              borderColor: C.navy,
              color: C.navy,
              "&:hover": { borderColor: C.navy, bgcolor: `${C.navy}0a` },
            }}
          >
            Improve
          </Button>
        </Box>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, bgcolor: C.white }}>
          <CheckResults audit={audit} />
        </Box>
      </Collapse>
    </Box>
  );
}

export default function ContentReadinessPanel() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [channel, setChannel] = useState("all");
  const [band, setBand] = useState<"all" | GeoBand>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/content?limit=${FETCH_LIMIT}`);
      if (!res.ok) throw new Error(`The content service replied ${res.status}.`);
      const data: unknown = await res.json();
      const items = (data as { items?: unknown }).items;
      setState({ phase: "ready", items: Array.isArray(items) ? (items as ContentItem[]) : [] });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "The content service could not be reached.",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scored = useMemo<Scored[]>(() => {
    if (state.phase !== "ready") return [];
    return state.items
      .filter((i) => typeof i.body === "string" && i.body.trim().length > 0)
      .map((item) => ({
        item,
        audit: auditGeoReadiness(item.body, { channel: item.channel, title: item.title }),
      }))
      .sort((a, b) => a.audit.score - b.audit.score || b.item.id - a.item.id);
  }, [state]);

  const channels = useMemo(() => {
    const set = new Set(scored.map((s) => s.item.channel));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scored]);

  const visible = useMemo(
    () =>
      scored.filter(
        (s) => (channel === "all" || s.item.channel === channel) && (band === "all" || s.audit.band === band)
      ),
    [scored, channel, band]
  );

  const portfolio = useMemo(() => {
    if (!scored.length) return null;
    const avg = Math.round(scored.reduce((sum, s) => sum + s.audit.score, 0) / scored.length);
    const counts: Record<GeoBand, number> = { strong: 0, workable: 0, weak: 0, poor: 0 };
    for (const s of scored) counts[s.audit.band] += 1;
    // The single check that drags the portfolio down the most, by lost weight.
    const lost = new Map<string, number>();
    for (const s of scored) {
      for (const c of s.audit.checks) {
        lost.set(c.label, (lost.get(c.label) ?? 0) + ((100 - c.score) * c.weight) / 100);
      }
    }
    const worst = Array.from(lost.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    return { avg, counts, worst };
  }, [scored]);

  if (state.phase === "loading") return <LoadingCard label="Auditing the content library…" />;

  if (state.phase === "error") {
    return <UpstreamErrorCard source="The content library" error={state.message} onRetry={load} />;
  }

  if (!scored.length) {
    return (
      <EmptyStateCard
        title="No content pieces to audit"
        body="The content library returned zero stored pieces, so there is nothing to score. Generate or save a piece in the Create studio and it will appear here with its GEO score."
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
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {portfolio && (
        <Panel sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <ScoreBadge score={portfolio.avg} size="lg" title={`Portfolio average across ${scored.length} pieces`} />
              <Box>
                <SectionLabel>Portfolio readiness</SectionLabel>
                <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5, maxWidth: 340 }}>
                  Mean score across {scored.length} stored {scored.length === 1 ? "piece" : "pieces"} ·{" "}
                  {GEO_BAND_LABELS[geoBand(portfolio.avg)]}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 260 }}>
              <SectionLabel sx={{ mb: 1 }}>Distribution</SectionLabel>
              <DistributionBar
                total={scored.length}
                segments={BAND_ORDER.map((b) => ({
                  label: `${GEO_BAND_LABELS[b]} (${
                    b === "strong"
                      ? `${SCORE_BAND_STRONG}+`
                      : b === "workable"
                        ? `${SCORE_BAND_WORKABLE}–${SCORE_BAND_STRONG - 1}`
                        : b === "weak"
                          ? `${SCORE_BAND_WEAK}–${SCORE_BAND_WORKABLE - 1}`
                          : `<${SCORE_BAND_WEAK}`
                  })`,
                  count: portfolio.counts[b],
                  color: BAND_COLOR[b],
                }))}
              />
              {portfolio.worst && (
                <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 1.5 }}>
                  Biggest drag across the library: <strong style={{ color: C.ink }}>{portfolio.worst[0]}</strong> —{" "}
                  {Math.round(portfolio.worst[1])} weighted points lost in total.
                </Typography>
              )}
            </Box>
          </Box>
        </Panel>
      )}

      <Panel>
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            flexWrap: "wrap",
            alignItems: "center",
            p: 2,
          }}
        >
          <SectionLabel sx={{ mr: "auto" }}>
            Worst first · {visible.length} of {scored.length} shown
          </SectionLabel>
          <TextField
            select
            size="small"
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All channels</MenuItem>
            {channels.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Score band"
            value={band}
            onChange={(e) => setBand(e.target.value as "all" | GeoBand)}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="all">All bands</MenuItem>
            {BAND_ORDER.map((b) => (
              <MenuItem key={b} value={b}>
                {GEO_BAND_LABELS[b]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {visible.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", borderTop: `1px solid ${C.hairline}` }}>
            <Typography sx={{ fontSize: 13.5, color: C.muted }}>
              No piece matches this channel and score band. Widen the filters — nothing is hidden beyond them.
            </Typography>
          </Box>
        ) : (
          visible.map((s) => (
            <Row
              key={s.item.id}
              scored={s}
              expanded={expandedId === s.item.id}
              onToggle={() => setExpandedId((cur) => (cur === s.item.id ? null : s.item.id))}
            />
          ))
        )}
      </Panel>

      <Typography sx={{ fontSize: 11.5, color: C.muted }}>
        Scores are computed in the browser from the stored body of each piece — the {FETCH_LIMIT} most recent
        are loaded. Older pieces are not audited.
      </Typography>
    </Box>
  );
}
