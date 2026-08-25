"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditNote from "@mui/icons-material/EditNote";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import Search from "@mui/icons-material/Search";

import {
  GSC_PAIR_ROW_LIMIT,
  GSC_SUPPORTS_DIMENSION_PAIR,
  type GscPairRow,
} from "./gscClient";
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
import { cannibalTopic, createHref } from "./queue";
import {
  EmptyState,
  Explainer,
  HAIRLINE,
  HairlineCard,
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
  TableHeading,
  Tag,
  UpstreamError,
  fmtCtr,
  fmtInt,
  fmtPosition,
  shortPath,
} from "./ui";

/** The pairs call resolves to exactly one of these — never a partial guess. */
export type CannibalisationState =
  | { status: "not-connected"; missing: string[]; detail?: string }
  | { status: "error"; error: string; httpStatus: number | null }
  | { status: "ready"; rows: GscPairRow[] };

const WILL_SHOW =
  "Once Search Console is connected this tab pulls query+page pairs for the property and lists every query answered by two or more of your own URLs, with the clicks and positions each URL takes and which page to keep.";

/** Stable identity so the not-ready states do not re-derive on every render. */
const NO_PAIRS: GscPairRow[] = [];

/* ── formatting local to this view ─────────────────────────────────────── */

function fmtSpread(spread: number | null): string {
  if (spread === null || !Number.isFinite(spread)) return "—";
  return spread.toFixed(1);
}

function fmtShare(clicks: number, totalClicks: number): string {
  if (totalClicks <= 0) return "—";
  return `${((clicks / totalClicks) * 100).toFixed(0)}%`;
}

/* ── recommendation presentation ───────────────────────────────────────── */

type Badge = { label: string; color: string; bg: string };

function badgeOf(rec: CannibalRecommendation): Badge {
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
      <Box
        component="code"
        sx={{
          fontFamily: MONO,
          fontSize: "0.85em",
          color: NAVY,
          cursor: "help",
          wordBreak: "break-all",
        }}
      >
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
        one <Url href={rec.keep} />. One URL already takes at least{" "}
        {Math.round(CANNIBAL_CLICK_DOMINANCE * 100)}% of the clicks and ranks at least {CANNIBAL_POSITION_LEAD}{" "}
        positions ahead, so the second listing only splits the signal.
      </>
    );
  }
  if (rec.kind === "assign-intent") {
    return (
      <>
        <strong>Assign intent:</strong> keep the product page <Url href={rec.product} /> for the transactional query and
        retune the article <Url href={rec.editorial} /> to the informational variant. These two answer different
        intents, so merging them would destroy one of them.
      </>
    );
  }
  return (
    <>
      <strong>Differentiate:</strong> <Url href={rec.keep} /> and <Url href={rec.retarget} /> rank and earn comparably —
      the two pages target the same intent. Retarget one to an adjacent query, or merge them into a single stronger
      page.
    </>
  );
}

/* ── table chrome ──────────────────────────────────────────────────────── */

const HEAD_CELL = {
  bgcolor: SURFACE,
  borderBottom: `1px solid ${HAIRLINE}`,
  color: MUTED,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  py: 1.25,
  whiteSpace: "nowrap" as const,
};

const BODY_CELL = {
  borderBottom: `1px solid ${HAIRLINE}`,
  color: INK,
  fontSize: "0.85rem",
  py: 1.25,
};

type ColumnSpec = { id: string; label: string; numeric?: boolean; width?: number; hint?: string };

const COLUMNS: ColumnSpec[] = [
  { id: "expand", label: "", width: 46 },
  { id: "query", label: "Query" },
  {
    id: "pages",
    label: "URLs",
    numeric: true,
    width: 78,
    hint: `Distinct URLs of yours that took impressions for this query. Only queries with ${CANNIBAL_MIN_COMPETING_PAGES} or more appear here.`,
  },
  { id: "clicks", label: "Clicks", numeric: true, width: 92, hint: "Clicks summed across the competing URLs." },
  {
    id: "impressions",
    label: "Impressions",
    numeric: true,
    width: 116,
    hint: "Severity input 1 — the demand being split across the competing URLs.",
  },
  {
    id: "position",
    label: "Best pos.",
    numeric: true,
    width: 100,
    hint: "Best (lowest) average position among the competing URLs.",
  },
  {
    id: "spread",
    label: "Spread",
    numeric: true,
    width: 92,
    hint: `Severity input 2 — the gap between the best and second-best position. Closer means the URLs are splitting one pool of clicks; ${CANNIBAL_SPREAD_TOLERANCE} or more scores zero.`,
  },
  {
    id: "severity",
    label: "Severity",
    numeric: true,
    width: 110,
    hint: "impressions × closeness. Both inputs are columns in this row — nothing hidden.",
  },
  { id: "action", label: "Action", width: 180 },
];

function HeadCells() {
  return (
    <TableRow>
      {COLUMNS.map((col) => (
        <TableCell
          key={col.id}
          align={col.numeric ? "right" : "left"}
          sx={{ ...HEAD_CELL, width: col.width }}
        >
          {col.hint ? (
            <Tooltip title={col.hint} placement="top">
              <Box component="span" sx={{ borderBottom: "1px dotted #b8c0c9", cursor: "help" }}>
                {col.label}
              </Box>
            </Tooltip>
          ) : (
            col.label
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}

function KindTag({ page }: { page: string }) {
  const kind = pageKindOf(page);
  if (kind === "unknown") return null;
  return (
    <Box component="span" sx={{ ml: 1 }}>
      <Tag label={kind} />
    </Box>
  );
}

/** The competing URLs for one query, with the metrics Search Console reported for each. */
function CompetingPages({ pages, totalClicks }: { pages: CompetingPage[]; totalClicks: number }) {
  const subHead = {
    color: MUTED,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    borderBottom: `1px solid ${HAIRLINE}`,
    py: 0.75,
    whiteSpace: "nowrap" as const,
  };
  const subCell = { borderBottom: `1px solid ${HAIRLINE}`, color: INK, fontSize: "0.8rem", py: 0.9 };

  return (
    <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={subHead}>Competing URL</TableCell>
          <TableCell align="right" sx={{ ...subHead, width: 88 }}>
            Clicks
          </TableCell>
          <TableCell align="right" sx={{ ...subHead, width: 96 }}>
            Share
          </TableCell>
          <TableCell align="right" sx={{ ...subHead, width: 110 }}>
            Impressions
          </TableCell>
          <TableCell align="right" sx={{ ...subHead, width: 86 }}>
            CTR
          </TableCell>
          <TableCell align="right" sx={{ ...subHead, width: 92 }}>
            Position
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {pages.map((p) => (
          <TableRow key={p.page}>
            <TableCell sx={subCell}>
              <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                <Tooltip title={p.page} placement="top-start">
                  <Typography
                    sx={{
                      fontSize: "0.8rem",
                      fontFamily: MONO,
                      color: INK,
                      maxWidth: { xs: 240, sm: 400, lg: 640, xl: 900 },
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {shortPath(p.page)}
                  </Typography>
                </Tooltip>
                <KindTag page={p.page} />
              </Box>
            </TableCell>
            <TableCell align="right" sx={{ ...subCell, ...NUMERIC }}>
              {fmtInt(p.clicks)}
            </TableCell>
            <TableCell align="right" sx={{ ...subCell, ...NUMERIC }}>
              {fmtShare(p.clicks, totalClicks)}
            </TableCell>
            <TableCell align="right" sx={{ ...subCell, ...NUMERIC }}>
              {fmtInt(p.impressions)}
            </TableCell>
            <TableCell align="right" sx={{ ...subCell, ...NUMERIC }}>
              {fmtCtr(p.ctr)}
            </TableCell>
            <TableCell align="right" sx={{ ...subCell, ...NUMERIC }}>
              {fmtPosition(p.position)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function GroupRow({ group }: { group: CannibalGroup }) {
  const [open, setOpen] = useState(false);
  const badge = badgeOf(group.recommendation);

  return (
    <Fragment>
      <TableRow sx={{ "&:hover": { bgcolor: "#fafbfc" }, cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <TableCell sx={{ ...BODY_CELL, pr: 0 }}>
          <IconButton
            size="small"
            aria-label={open ? `Hide competing URLs for ${group.query}` : `Show competing URLs for ${group.query}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            sx={{ color: MUTED }}
          >
            {open ? <KeyboardArrowDown sx={{ fontSize: 19 }} /> : <KeyboardArrowRight sx={{ fontSize: 19 }} />}
          </IconButton>
        </TableCell>

        <TableCell sx={BODY_CELL}>
          <Tooltip title={group.query} placement="top-start">
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: INK,
                maxWidth: { xs: 220, sm: 320, lg: 480, xl: 680 },
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {group.query}
            </Typography>
          </Tooltip>
          <Box sx={{ mt: 0.5 }}>
            <Tag label={badge.label} color={badge.color} bg={badge.bg} />
          </Box>
        </TableCell>

        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          {fmtInt(group.pageCount)}
        </TableCell>
        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          {fmtInt(group.totalClicks)}
        </TableCell>
        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          {fmtInt(group.totalImpressions)}
        </TableCell>
        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          {fmtPosition(group.bestPosition)}
        </TableCell>
        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          {fmtSpread(group.positionSpread)}
        </TableCell>
        <TableCell align="right" sx={{ ...BODY_CELL, ...NUMERIC }}>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: NAVY, ...NUMERIC }}>
            {fmtInt(group.severity)}
          </Typography>
        </TableCell>

        <TableCell sx={BODY_CELL} onClick={(e) => e.stopPropagation()}>
          <Button
            component={Link}
            href={createHref(cannibalTopic(group))}
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
            Brief the fix
          </Button>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={COLUMNS.length} sx={{ p: 0, borderBottom: open ? `1px solid ${HAIRLINE}` : "none" }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2.5, py: 2, bgcolor: SURFACE }}>
              <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.7, maxWidth: 900 }}>
                <RecommendationText rec={group.recommendation} />
              </Typography>
              <Box sx={{ mt: 1.75, border: `1px solid ${HAIRLINE}`, borderRadius: 1.5, bgcolor: "#fff", overflowX: "auto" }}>
                <CompetingPages pages={group.pages} totalClicks={group.totalClicks} />
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

/* ── the tab ───────────────────────────────────────────────────────────── */

export default function Cannibalisation({
  state,
  loading,
  days,
  onRetry,
}: {
  state: CannibalisationState;
  loading: boolean;
  days: number;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState("");

  const pairRows = state.status === "ready" ? state.rows : NO_PAIRS;
  const groups = useMemo(() => cannibalisationOf(pairRows), [pairRows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return groups;
    return groups.filter(
      (g) => g.query.toLowerCase().includes(q) || g.pages.some((p) => p.page.toLowerCase().includes(q)),
    );
  }, [groups, search]);

  const explainer = (
    <Explainer title="Cannibalisation">
      Where your own pages compete for the same query. When two URLs both take impressions for one search, Google splits
      the signal and usually ranks both worse than one strong page would rank alone. Work this list top-down: open a
      row, read which URL actually earns the clicks, then apply the fix it names — consolidate the weaker page into the
      stronger one, differentiate them onto separate intents, or assign the transactional query to the product page and
      retune the article. Fix the top rows first: they are the queries where the most demand is being split.
    </Explainer>
  );

  if (state.status === "not-connected") {
    return (
      <Box>
        {explainer}
        <NotConnected
          source="Google Search Console"
          missing={state.missing}
          detail={state.detail}
          willShow={WILL_SHOW}
        />
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box>
        {explainer}
        <Box
          sx={{
            mb: 2.5,
            px: 2,
            py: 1.5,
            border: `1px solid ${HAIRLINE}`,
            borderLeft: `3px solid ${RED}`,
            borderRadius: 1.5,
            bgcolor: SURFACE,
          }}
        >
          <Typography sx={{ fontSize: "0.83rem", color: INK, lineHeight: 1.6 }}>
            The query+page pair call failed, so no cannibalisation could be measured for this window. The other views
            are unaffected — they use separate calls that succeeded — and the Work queue records this analysis as
            unavailable rather than quietly ranking without it.
          </Typography>
        </Box>
        <UpstreamError error={state.error} status={state.httpStatus} onRetry={onRetry} />
      </Box>
    );
  }

  const sourceNote = GSC_SUPPORTS_DIMENSION_PAIR
    ? `Source: Google Search Console searchAnalytics.query requested with dimensions ["query", "page"] in a single call — at most ${GSC_PAIR_ROW_LIMIT} pair rows for the window. Every number below is a value Search Console returned; nothing is estimated, modelled or split by share.`
    : "Pair mode is not available from /api/integrations/gsc, so cannibalisation cannot be measured from the data this cockpit receives.";

  return (
    <Box>
      {explainer}

      <HairlineCard>
        <Methodology
          label="How severity is computed"
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
          pool of clicks — and when the demand being split is large. A URL {CANNIBAL_SPREAD_TOLERANCE} positions or more
          behind the leader is a separate, deeper listing and scores zero closeness. Both inputs are columns in the
          table, so you can always see why a row ranks where it does. Filter: at least {CANNIBAL_MIN_COMPETING_PAGES}{" "}
          distinct URLs with {CANNIBAL_MIN_IMPRESSIONS_PER_PAGE} impression or more for the same query. Where a position
          is missing for two or more of the URLs the spread cannot be measured, so closeness is scored 0 rather than
          guessed and the row sinks to the bottom. Severity is also what the Work queue normalises when it ranks
          cannibalised queries against the other analyses.
        </Methodology>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <TableHeading
            label="Split queries"
            caption={
              loading
                ? "Loading…"
                : `${groups.length} quer${groups.length === 1 ? "y" : "ies"} split across multiple URLs · ${pairRows.length} pair row${pairRows.length === 1 ? "" : "s"} scanned · last ${days} days · worst first`
            }
          />

          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries or URLs"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 17, color: MUTED }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: { xs: "100%", sm: 260 },
              "& .MuiOutlinedInput-root": { fontSize: "0.85rem", bgcolor: "#fff" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: HAIRLINE },
            }}
          />
        </Box>

        <TableContainer sx={{ maxHeight: 660 }}>
          <Table stickyHeader size="small" sx={{ "& td, & th": { borderColor: HAIRLINE } }}>
            <TableHead>
              <HeadCells />
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {COLUMNS.map((col) => (
                        <TableCell key={col.id} align={col.numeric ? "right" : "left"} sx={BODY_CELL}>
                          <Skeleton
                            variant="text"
                            width={col.numeric ? 52 : `${55 + ((i * 7) % 35)}%`}
                            sx={{ ml: col.numeric ? "auto" : 0, bgcolor: "#eef0f3" }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : visible.map((group) => <GroupRow key={group.query} group={group} />)}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && visible.length === 0 && groups.length === 0 && (
          <EmptyState
            title="No query is being split across multiple URLs in this window"
            body={`Search Console returned ${pairRows.length} query+page pair${pairRows.length === 1 ? "" : "s"} for the last ${days} days, and every query was answered by a single URL of yours. That is the healthy result — there is nothing to consolidate. Only the top ${GSC_PAIR_ROW_LIMIT} pairs are returned, so this covers the head of the tail rather than every long-tail query.`}
          />
        )}

        {!loading && visible.length === 0 && groups.length > 0 && (
          <EmptyState
            title="No rows match your search"
            body={`Nothing matched “${search.trim()}”. Clear the search box to see all ${groups.length} split quer${groups.length === 1 ? "y" : "ies"}.`}
          />
        )}

        {!loading && visible.length > 0 && (
          <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
              {visible.length === groups.length
                ? `${groups.length} row${groups.length === 1 ? "" : "s"} · click a row to see the competing URLs`
                : `${visible.length} of ${groups.length} rows`}
            </Typography>
          </Box>
        )}
      </HairlineCard>

      <SourceNote>{sourceNote}</SourceNote>
    </Box>
  );
}
