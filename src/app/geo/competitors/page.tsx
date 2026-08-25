"use client";

/**
 * SUB-APP · COMPETITOR POSITIONING.
 *
 * Two published pages, one auditor, seven aligned checks: who would an answer
 * engine rather quote, and exactly where we lose. The comparison is only
 * meaningful because both sides go through the SAME `auditGeoReadiness` the
 * stored library and the live audit use — no separate "competitor scoring".
 *
 * Honest state: nothing is fetched, and nothing is shown, until the user
 * supplies both URLs. There is no sample comparison.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { GeoAuditResult } from "@/lib/geo/audit";
import { compareGeoAudits, type GeoComparisonRow } from "@/lib/geo/compare";
import {
  C,
  Card,
  Details,
  DISPLAY_FONT,
  LoadingCard,
  Measure,
  MeterBar,
  PageIntro,
  Panel,
  PrimaryAction,
  ScoreBadge,
  ScrollX,
  SectionHead,
  SectionLabel,
  UpstreamErrorCard,
  VERDICT_COLOR,
} from "../geoUi";
import { SchemaFlag } from "../LivePageReadinessPanel";

const PURPOSE =
  "Score a competitor's page on the same seven checks as ours and put them side by side, so you can see which page an answer engine would rather quote — and which checks decide it.";

type PageData = {
  url: string;
  finalUrl: string;
  title: string | null;
  words: number;
  audit: GeoAuditResult;
  page: {
    schemaTypes: string[];
    hasFaqPageSchema: boolean;
    hasArticleSchema: boolean;
    hasJsonLdBlock: boolean;
    machineDates: string[];
    visibleDate: string | null;
  };
};

type CompareState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "error"; message: string }
  | { phase: "done"; ours: PageData; theirs: PageData };

const OURS_COLOR = C.navy;
const THEIRS_COLOR = "#8a5a2b";

function SideHeader({
  eyebrow,
  data,
  color,
}: {
  eyebrow: string;
  data: PageData;
  color: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <SectionLabel sx={{ color }}>{eyebrow}</SectionLabel>
      <Box sx={{ display: "flex", gap: 2, mt: 1.5, alignItems: "flex-start" }}>
        <ScoreBadge score={data.audit.score} size="lg" />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: 16,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.title ?? "(page has no <title>)"}
          </Typography>
          <Typography
            component="a"
            href={data.finalUrl}
            target="_blank"
            rel="noreferrer"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 11.5,
              color: C.navy,
              mt: 0.75,
              overflowWrap: "anywhere",
            }}
          >
            {data.finalUrl}
            <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.75 }}>
            {data.words} words extracted · {data.page.schemaTypes.length || "no"} JSON-LD{" "}
            {data.page.schemaTypes.length === 1 ? "type" : "types"}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
        <SchemaFlag
          ok={data.page.hasFaqPageSchema}
          label="FAQPage"
          missingHint="No FAQPage (or QAPage) type in this page's JSON-LD."
        />
        <SchemaFlag
          ok={data.page.hasArticleSchema}
          label="Article"
          missingHint="No Article/TechArticle/BlogPosting type in this page's JSON-LD."
        />
        <SchemaFlag
          ok={data.page.visibleDate !== null || data.page.machineDates.length > 0}
          label="Date"
          missingHint="No <time datetime>, no article:published_time meta and no visible date on this page."
        />
      </Box>
    </Box>
  );
}

function WinnerChip({ row }: { row: GeoComparisonRow }) {
  const label =
    row.winner === "tie"
      ? "Level"
      : row.winner === "ours"
        ? `We win +${Math.abs(row.gap).toFixed(1)}`
        : `They win +${row.gap.toFixed(1)}`;
  const color = row.winner === "tie" ? C.muted : row.winner === "ours" ? VERDICT_COLOR.pass : VERDICT_COLOR.fail;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.375,
        border: `1px solid ${color}55`,
        bgcolor: `${color}10`,
        borderRadius: "2px",
        fontSize: 11.5,
        fontWeight: 700,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

function CheckColumn({ score, color }: { score: number; color: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{ fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 600, color, lineHeight: 1, mb: 0.75 }}
      >
        {score}
        <Typography component="span" sx={{ fontSize: 11, color: C.muted, ml: 0.5, fontWeight: 500 }}>
          /100
        </Typography>
      </Typography>
      <MeterBar value={score} max={100} color={color} />
    </Box>
  );
}

export default function GeoCompetitorsPage() {
  const [ourUrl, setOurUrl] = useState("");
  const [theirUrl, setTheirUrl] = useState("");
  const [state, setState] = useState<CompareState>({ phase: "idle" });

  const comparison = useMemo(
    () => (state.phase === "done" ? compareGeoAudits(state.ours.audit, state.theirs.audit) : null),
    [state]
  );

  const run = async () => {
    if (!ourUrl.trim() || !theirUrl.trim()) return;
    setState({ phase: "running" });
    try {
      const res = await fetch("/api/geo/compare-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ourUrl: ourUrl.trim(), theirUrl: theirUrl.trim() }),
      });
      if (res.status === 401) {
        setState({ phase: "error", message: "Your session expired. Sign in again to compare pages." });
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: { ours: PageData; theirs: PageData };
      };
      if (!body.ok || !body.data) {
        setState({ phase: "error", message: body.error ?? `The comparison route replied ${res.status}.` });
        return;
      }
      setState({ phase: "done", ours: body.data.ours, theirs: body.data.theirs });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "The comparison route could not be reached.",
      });
    }
  };

  return (
    <Box>
      <PageIntro title="Competitor positioning" purpose={PURPOSE} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
        <Card>
          <SectionLabel sx={{ mb: 2 }}>Two pages, one ruler</SectionLabel>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
            sx={{
              display: "grid",
              gap: 2,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr) auto" },
            }}
          >
            <TextField
              size="small"
              fullWidth
              label="Our page"
              placeholder="https://www.apsoparts.com/…"
              value={ourUrl}
              onChange={(e) => setOurUrl(e.target.value)}
            />
            <TextField
              size="small"
              fullWidth
              label="Competitor page"
              placeholder="https://…"
              value={theirUrl}
              onChange={(e) => setTheirUrl(e.target.value)}
            />
            <PrimaryAction
              type="submit"
              disabled={state.phase === "running" || !ourUrl.trim() || !theirUrl.trim()}
              icon={
                state.phase === "running" ? (
                  <CircularProgress size={14} sx={{ color: "inherit" }} />
                ) : (
                  <CompareArrowsIcon fontSize="small" />
                )
              }
            >
              {state.phase === "running" ? "Fetching…" : "Compare pages"}
            </PrimaryAction>
          </Box>
          <Measure sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
              Both pages are fetched by the server (15 s timeout, 3 MB cap, HTML only) and scored by the same
              auditor. Any public http(s) page is allowed here, but a URL that resolves to a private,
              loopback, link-local or cloud-metadata address is refused — including through a redirect.
            </Typography>
          </Measure>
        </Card>

        {state.phase === "idle" && (
          <Panel sx={{ p: { xs: 3, md: 4 } }}>
            <Measure>
              <Typography sx={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>
                Nothing has been fetched. Give one page of ours and one of a competitor&apos;s and both will be
                scored on the same seven checks, aligned side by side, with a plain statement of where we
                lose.
              </Typography>
            </Measure>
          </Panel>
        )}

        {state.phase === "running" && <LoadingCard label="Fetching both pages and scoring them…" />}

        {state.phase === "error" && (
          <UpstreamErrorCard source="The comparison" error={state.message} onRetry={run} />
        )}

        {state.phase === "done" && comparison && (
          <>
            <Card>
              <Box
                sx={{
                  display: "grid",
                  gap: { xs: 3, lg: 5 },
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
                }}
              >
                <SideHeader eyebrow="Our page" data={state.ours} color={OURS_COLOR} />
                <Box sx={{ borderLeft: { lg: `1px solid ${C.hairline}` }, pl: { lg: 5 } }}>
                  <SideHeader eyebrow="Competitor page" data={state.theirs} color={THEIRS_COLOR} />
                </Box>
              </Box>

              <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${C.hairline}` }}>
                <SectionLabel sx={{ mb: 1.5 }}>Verdict</SectionLabel>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: { xs: 22, md: 26 },
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: comparison.winner === "theirs" ? VERDICT_COLOR.fail : C.navy,
                      lineHeight: 1.15,
                    }}
                  >
                    {comparison.winner === "tie"
                      ? "Level on the overall score"
                      : comparison.winner === "ours"
                        ? `We lead by ${Math.abs(comparison.scoreGap)} points`
                        : `They lead by ${comparison.scoreGap} points`}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: C.muted }}>
                    {comparison.ourScore}/100 vs {comparison.theirScore}/100
                  </Typography>
                </Box>
                <Measure>
                  <Typography sx={{ fontSize: 14, color: C.ink, lineHeight: 1.7 }}>
                    {comparison.verdict}
                  </Typography>
                </Measure>
              </Box>
            </Card>

            <Box>
              <SectionHead
                title="The seven checks, aligned"
                right={
                  <Typography sx={{ fontSize: 12, color: C.muted }}>
                    Weighted points, not raw scores — a check at weight 20 moves the total five times as much
                    as one at weight 4
                  </Typography>
                }
              />
              <Panel>
                <ScrollX minWidth={760}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(190px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) 120px",
                      alignItems: "center",
                      gap: 3,
                      px: 2.5,
                      py: 1.5,
                      bgcolor: C.surface,
                    }}
                  >
                    <SectionLabel sx={{ fontSize: 10 }}>Check</SectionLabel>
                    <SectionLabel sx={{ fontSize: 10, color: OURS_COLOR }}>Our page</SectionLabel>
                    <SectionLabel sx={{ fontSize: 10, color: THEIRS_COLOR }}>Competitor</SectionLabel>
                    <SectionLabel sx={{ fontSize: 10 }}>Who wins</SectionLabel>
                  </Box>
                  {comparison.rows.map((row) => (
                    <Box
                      key={row.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(190px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) 120px",
                        alignItems: "center",
                        gap: 3,
                        px: 2.5,
                        py: 2,
                        borderTop: `1px solid ${C.hairline}`,
                        "&:hover": { bgcolor: C.surface },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
                          {row.label}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.375 }}>
                          weight {row.weight} of 100
                        </Typography>
                      </Box>
                      <CheckColumn score={row.ours?.score ?? 0} color={OURS_COLOR} />
                      <CheckColumn score={row.theirs?.score ?? 0} color={THEIRS_COLOR} />
                      <Box>
                        <WinnerChip row={row} />
                      </Box>
                    </Box>
                  ))}
                </ScrollX>
                <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${C.hairline}` }}>
                  <Details label="Show what was measured on each check">
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                      {comparison.rows.map((row) => (
                        <Box key={row.id}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: C.ink, mb: 0.75 }}>
                            {row.label}
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
                            <strong style={{ color: OURS_COLOR }}>Ours:</strong>{" "}
                            {row.ours?.measured ?? "not measured"}
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, mt: 0.5 }}>
                            <strong style={{ color: THEIRS_COLOR }}>Theirs:</strong>{" "}
                            {row.theirs?.measured ?? "not measured"}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Details>
                </Box>
              </Panel>
            </Box>

            <Box>
              <SectionHead title="Where we lose" />
              {comparison.losses.length === 0 ? (
                <Panel sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography sx={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65, maxWidth: "78ch" }}>
                    There is no check on which the competitor page scores higher than ours. Nothing on this
                    comparison needs fixing.
                  </Typography>
                </Panel>
              ) : (
                <Panel>
                  {comparison.losses.map((row) => (
                    <Box
                      key={row.id}
                      sx={{
                        display: "grid",
                        gap: { xs: 1.5, md: 3 },
                        alignItems: "start",
                        gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 0.7fr) minmax(0, 2fr)" },
                        px: { xs: 2, md: 2.5 },
                        py: 2.5,
                        borderTop: `1px solid ${C.hairline}`,
                        "&:first-of-type": { borderTop: "none" },
                      }}
                    >
                      <Box>
                        <Typography
                          sx={{ fontFamily: DISPLAY_FONT, fontSize: 15.5, fontWeight: 600, color: C.ink }}
                        >
                          {row.label}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12.5, fontWeight: 700, color: VERDICT_COLOR.fail, mt: 0.75 }}
                        >
                          −{row.gap.toFixed(1)} weighted points against us
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.5 }}>
                          {row.ours?.score ?? 0}/100 vs their {row.theirs?.score ?? 0}/100
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <SectionLabel sx={{ fontSize: 10, mb: 0.75 }}>What to change on our page</SectionLabel>
                        <Typography sx={{ fontSize: 13, color: C.ink, lineHeight: 1.65 }}>
                          {row.ours?.fix ?? "No fix recorded for this check."}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Panel>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
