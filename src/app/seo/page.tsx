"use client";

/**
 * SEO COCKPIT — two sub-apps over one live Search Console connection.
 *
 *   ANALYSIS  what is happening      → Search performance · Cannibalisation · Decay
 *   ACTIONS   what to do about it    → Work queue · Quick wins
 *
 * The split is the point: the diagnostic views answer "what is going on", and
 * the action views turn those same findings into work. The Work queue is the
 * join — it merges every actionable finding the analyses produced into one
 * ranked list (see queue.ts) and adds no metric of its own.
 *
 * Layout: full-bleed. The shell caps nothing, because this is a data surface
 * and the horizontal room is the point. Wide tables scroll inside their own
 * container so the page itself never scrolls sideways.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import CloudDone from "@mui/icons-material/CloudDone";
import QueryStats from "@mui/icons-material/QueryStats";
import PlaylistAddCheck from "@mui/icons-material/PlaylistAddCheck";
import PageHeader from "@/app/PageHeader";

import {
  fetchGsc,
  fetchGscPairs,
  type GscApiResponse,
  type GscPairApiResponse,
  type GscRow,
} from "./gscClient";
import { cannibalisationOf, decayOf, quickWinsOf, type CannibalGroup, type DecayRow, type QuickWin } from "./analysis";
import { buildWorkQueue, type SourceInput, type WorkQueueResult } from "./queue";
import SearchPerformance from "./SearchPerformance";
import QuickWins from "./QuickWins";
import Cannibalisation, { type CannibalisationState } from "./Cannibalisation";
import Decay from "./Decay";
import WorkQueue from "./WorkQueue";
import { GUTTER, HAIRLINE, INK, MUTED, NAVY, NotConnected, SURFACE, SectionLabel, UpstreamError } from "./ui";

type WindowDays = 28 | 90;

type Loaded = {
  siteUrl: string;
  range: { startDate: string; endDate: string } | null;
  queries: GscRow[];
  pages: GscRow[];
  /** Same dimension as `pages`, over a 2× window — used to derive the previous period. */
  pagesExtended: GscRow[];
  /** Set when only the wider comparison call failed; the other views still work. */
  extendedError: string | null;
  /**
   * The query+page pair call, resolved to the Cannibalisation view's own three
   * states. Kept separate so a failure there degrades to that view alone — the
   * same containment the wider Decay window gets.
   */
  pairs: CannibalisationState;
};

type State =
  | { status: "loading" }
  | { status: "not-configured"; missing: string[]; detail?: string }
  | { status: "error"; error: string; httpStatus: number | null }
  | { status: "ready"; data: Loaded };

/* ── information architecture ──────────────────────────────────────────── */

type SubApp = "analysis" | "actions";
type AnalysisView = "performance" | "cannibalisation" | "decay";
type ActionView = "queue" | "quick-wins";

const ANALYSIS_VIEWS: { id: AnalysisView; label: string }[] = [
  { id: "performance", label: "Search performance" },
  { id: "cannibalisation", label: "Cannibalisation" },
  { id: "decay", label: "Decay" },
];

const ACTION_VIEWS: { id: ActionView; label: string }[] = [
  { id: "queue", label: "Work queue" },
  { id: "quick-wins", label: "Quick wins" },
];

const SUB_APP_COPY: Record<SubApp, { label: string; tagline: string; views: string }> = {
  analysis: {
    label: "Analysis",
    tagline: "What is happening",
    views: "Search performance · Cannibalisation · Decay",
  },
  actions: {
    label: "Actions",
    tagline: "What to do about it",
    views: "Work queue · Quick wins",
  },
};

/** Stable identity for the window in which the pairs call has not answered yet. */
const PAIRS_PENDING: CannibalisationState = { status: "ready", rows: [] };

const WILL_SHOW =
  "Once Search Console is connected this page reports live clicks, impressions, CTR and average position for your property, ranks the queries closest to page one, flags pages losing clicks against the previous period, and merges every finding into one ranked work queue.";

/**
 * Maps the pairs response onto the Cannibalisation view's own three states. It
 * is deliberately NOT folded into the page-level state: only that view and the
 * work queue need pairs, so its failure must not blank the others.
 */
function pairsStateOf(res: GscPairApiResponse): CannibalisationState {
  if (!res.configured) return { status: "not-connected", missing: res.missing, detail: res.detail };
  if (!res.ok) return { status: "error", error: res.error, httpStatus: res.status };
  return { status: "ready", rows: res.data.rows };
}

/** Reduces the four responses into a single explicit state — never a partial guess. */
function reduceResponses(
  queriesRes: GscApiResponse,
  pagesRes: GscApiResponse,
  extendedRes: GscApiResponse,
  pairsRes: GscPairApiResponse,
): State {
  for (const res of [queriesRes, pagesRes, extendedRes]) {
    if (!res.configured) {
      return { status: "not-configured", missing: res.missing, detail: res.detail };
    }
  }

  if (queriesRes.configured && !queriesRes.ok) {
    return { status: "error", error: queriesRes.error, httpStatus: queriesRes.status };
  }
  if (pagesRes.configured && !pagesRes.ok) {
    return { status: "error", error: pagesRes.error, httpStatus: pagesRes.status };
  }
  if (!(queriesRes.configured && queriesRes.ok) || !(pagesRes.configured && pagesRes.ok)) {
    return { status: "error", error: "Search Console returned an unexpected response shape.", httpStatus: null };
  }

  const extendedOk = extendedRes.configured && extendedRes.ok;

  return {
    status: "ready",
    data: {
      siteUrl: queriesRes.data.siteUrl,
      range: queriesRes.data.range.startDate ? queriesRes.data.range : null,
      queries: queriesRes.data.rows,
      pages: pagesRes.data.rows,
      pagesExtended: extendedOk ? extendedRes.data.rows : [],
      // Only the comparison call can fail on its own here — the not-configured
      // and primary-failure cases already returned above.
      extendedError: extendedRes.configured && !extendedRes.ok ? extendedRes.error : null,
      pairs: pairsStateOf(pairsRes),
    },
  };
}

/**
 * Builds the merged queue from whatever the four calls produced. A source that
 * could not run is passed through as `ok: false` with its reason, so the queue
 * can say so instead of reporting a smaller list as if it were complete.
 */
function queueFrom(data: Loaded, windowDays: number): WorkQueueResult {
  const quickWins: SourceInput<QuickWin> = { ok: true, rows: quickWinsOf(data.queries) };

  const cannibalisation: SourceInput<CannibalGroup> =
    data.pairs.status === "ready"
      ? { ok: true, rows: cannibalisationOf(data.pairs.rows) }
      : {
          ok: false,
          reason:
            data.pairs.status === "error"
              ? `the query+page pair call failed (${data.pairs.error})`
              : "Search Console is not connected for the query+page pair call",
        };

  const decay: SourceInput<DecayRow> = data.extendedError
    ? { ok: false, reason: `the ${windowDays * 2}-day comparison window failed (${data.extendedError})` }
    : { ok: true, rows: decayOf(data.pages, data.pagesExtended).rows };

  return buildWorkQueue(quickWins, cannibalisation, decay);
}

/* ── the primary switch ────────────────────────────────────────────────── */

function SubAppButton({
  id,
  active,
  count,
  onSelect,
}: {
  id: SubApp;
  active: boolean;
  count: number | null;
  onSelect: (id: SubApp) => void;
}) {
  const copy = SUB_APP_COPY[id];
  const Icon = id === "analysis" ? QueryStats : PlaylistAddCheck;

  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(id)}
      sx={{
        cursor: "pointer",
        textAlign: "left",
        minWidth: 0,
        px: 2,
        py: 1.6,
        borderRadius: 2,
        fontFamily: "inherit",
        border: `1px solid ${active ? NAVY : HAIRLINE}`,
        bgcolor: active ? NAVY : "#fff",
        transition: "background-color 120ms, border-color 120ms",
        "&:hover": { borderColor: active ? NAVY : "#c9d0d8" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon sx={{ fontSize: 18, color: active ? "#fff" : NAVY }} />
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: active ? "#fff" : INK,
          }}
        >
          {copy.label}
        </Typography>
        {count !== null && (
          <Box
            component="span"
            sx={{
              ml: 0.25,
              px: 0.75,
              py: 0.1,
              borderRadius: 1,
              fontSize: 10.5,
              fontWeight: 700,
              bgcolor: active ? "rgba(255,255,255,0.18)" : SURFACE,
              color: active ? "#fff" : MUTED,
              border: `1px solid ${active ? "rgba(255,255,255,0.28)" : HAIRLINE}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count}
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          mt: 0.4,
          fontSize: "0.82rem",
          fontWeight: 600,
          color: active ? "rgba(255,255,255,0.92)" : INK,
          lineHeight: 1.4,
        }}
      >
        {copy.tagline}
      </Typography>
      <Typography
        sx={{
          mt: 0.15,
          fontSize: "0.74rem",
          color: active ? "rgba(255,255,255,0.68)" : MUTED,
          lineHeight: 1.45,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {copy.views}
      </Typography>
    </Box>
  );
}

function ViewPill({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      sx={{
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "0.83rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
        px: 1.5,
        py: 0.7,
        borderRadius: 1.5,
        border: `1px solid ${active ? "#c3ced6" : "transparent"}`,
        bgcolor: active ? "#fff" : "transparent",
        color: active ? INK : MUTED,
        boxShadow: active ? "0 1px 2px rgba(26,29,33,0.06)" : "none",
        "&:hover": { color: INK, bgcolor: active ? "#fff" : "rgba(255,255,255,0.6)" },
      }}
    >
      {label}
    </Box>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function SeoCockpit() {
  const [subApp, setSubApp] = useState<SubApp>("analysis");
  // The last view of each half is remembered, so switching back and forth does
  // not throw the user out of the table they were reading.
  const [analysisView, setAnalysisView] = useState<AnalysisView>("performance");
  const [actionView, setActionView] = useState<ActionView>("queue");
  const [windowDays, setWindowDays] = useState<WindowDays>(28);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setState({ status: "loading" });

    (async () => {
      try {
        const [queriesRes, pagesRes, extendedRes, pairsRes] = await Promise.all([
          fetchGsc({ dimension: "query", days: windowDays }, controller.signal),
          fetchGsc({ dimension: "page", days: windowDays }, controller.signal),
          fetchGsc({ dimension: "page", days: windowDays * 2 }, controller.signal),
          fetchGscPairs({ days: windowDays }, controller.signal),
        ]);
        if (!live) return;
        setState(reduceResponses(queriesRes, pagesRes, extendedRes, pairsRes));
      } catch (err) {
        if (!live) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Could not reach /api/integrations/gsc.",
          httpStatus: null,
        });
      }
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [windowDays, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const loading = state.status === "loading";
  const data = state.status === "ready" ? state.data : null;

  const queue = useMemo(() => (data ? queueFrom(data, windowDays) : null), [data, windowDays]);

  const windowSwitch = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {loading && <CircularProgress size={15} sx={{ color: MUTED }} />}
      {data && (
        <Tooltip title={`Connected property: ${data.siteUrl}`} placement="left">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.6,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 1.5,
              bgcolor: "#fff",
              maxWidth: 280,
            }}
          >
            <CloudDone sx={{ fontSize: 15, color: NAVY }} />
            <Typography
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data.siteUrl || "Search Console"}
            </Typography>
          </Box>
        </Tooltip>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={windowDays}
        onChange={(_, v: WindowDays | null) => {
          if (v !== null) setWindowDays(v);
        }}
        sx={{
          bgcolor: "#fff",
          "& .MuiToggleButton-root": {
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: MUTED,
            borderColor: HAIRLINE,
            px: 1.75,
            py: 0.6,
          },
          "& .Mui-selected": { bgcolor: `${NAVY} !important`, color: "#fff !important" },
        }}
      >
        <ToggleButton value={28}>28 days</ToggleButton>
        <ToggleButton value={90}>90 days</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );

  const secondaryViews = subApp === "analysis" ? ANALYSIS_VIEWS : ACTION_VIEWS;
  const activeViewId: string = subApp === "analysis" ? analysisView : actionView;

  const navigation = (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "stretch", md: "flex-end" },
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 1.75,
        }}
      >
        <Box
          role="group"
          aria-label="Cockpit section"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 1fr)" },
            gap: 1.25,
            flex: "1 1 460px",
            maxWidth: 720,
          }}
        >
          <SubAppButton id="analysis" active={subApp === "analysis"} count={null} onSelect={setSubApp} />
          <SubAppButton
            id="actions"
            active={subApp === "actions"}
            count={queue ? queue.items.length : null}
            onSelect={setSubApp}
          />
        </Box>

        <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6, pb: { md: 0.5 } }}>
          {data?.range
            ? `Window ${data.range.startDate} → ${data.range.endDate} · ${windowDays} days`
            : `Window: last ${windowDays} days`}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          flexWrap: "wrap",
          px: 1,
          py: 0.75,
          mb: 3,
          borderRadius: 2,
          bgcolor: SURFACE,
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        <Box sx={{ pl: 0.75, pr: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <SectionLabel>{SUB_APP_COPY[subApp].label}</SectionLabel>
          <Box sx={{ width: "1px", height: 16, bgcolor: HAIRLINE }} />
        </Box>
        {secondaryViews.map((view) => (
          <ViewPill
            key={view.id}
            label={view.label}
            active={view.id === activeViewId}
            onSelect={() => {
              if (subApp === "analysis") setAnalysisView(view.id as AnalysisView);
              else setActionView(view.id as ActionView);
            }}
          />
        ))}
      </Box>
    </>
  );

  const extendedBanner = data?.extendedError ? (
    <Box
      sx={{
        mb: 2.5,
        px: 2,
        py: 1.5,
        border: `1px solid ${HAIRLINE}`,
        borderLeft: "3px solid #ed1b2f",
        borderRadius: 1.5,
        bgcolor: SURFACE,
      }}
    >
      <Typography sx={{ fontSize: "0.83rem", color: INK, lineHeight: 1.6 }}>
        The comparison window ({windowDays * 2} days) failed, so no previous period could be derived:{" "}
        {data.extendedError}
      </Typography>
    </Box>
  ) : null;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="SEO Cockpit"
        subtitle="Live Google Search Console — one half to understand what is happening, one half to act on it"
        rightSlot={windowSwitch}
      />

      {state.status === "not-configured" && (
        <NotConnected
          source="Google Search Console"
          missing={state.missing}
          detail={state.detail}
          willShow={WILL_SHOW}
        />
      )}

      {state.status === "error" && (
        <UpstreamError error={state.error} status={state.httpStatus} onRetry={retry} />
      )}

      {(loading || data) && (
        <>
          {navigation}

          {subApp === "analysis" && analysisView === "performance" && (
            <SearchPerformance
              queries={data?.queries ?? []}
              pages={data?.pages ?? []}
              loading={loading}
              days={windowDays}
              range={data?.range ?? null}
            />
          )}

          {subApp === "analysis" && analysisView === "cannibalisation" && (
            <Cannibalisation
              // While the window is still loading there is no response yet, so the
              // view renders skeletons over an empty ready state rather than an error.
              state={data?.pairs ?? PAIRS_PENDING}
              loading={loading}
              days={windowDays}
              onRetry={retry}
            />
          )}

          {subApp === "analysis" && analysisView === "decay" && (
            <>
              {extendedBanner}
              <Decay
                pagesCurrent={data?.pages ?? []}
                pagesExtended={data?.pagesExtended ?? []}
                loading={loading}
                days={windowDays}
              />
            </>
          )}

          {subApp === "actions" && actionView === "queue" && (
            <WorkQueue result={queue} loading={loading} days={windowDays} />
          )}

          {subApp === "actions" && actionView === "quick-wins" && (
            <QuickWins queries={data?.queries ?? []} loading={loading} days={windowDays} />
          )}
        </>
      )}
    </Box>
  );
}
