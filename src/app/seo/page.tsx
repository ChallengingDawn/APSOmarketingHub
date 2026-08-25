"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import CloudDone from "@mui/icons-material/CloudDone";
import PageHeader from "@/app/PageHeader";

import {
  fetchGsc,
  fetchGscPairs,
  type GscApiResponse,
  type GscPairApiResponse,
  type GscRow,
} from "./gscClient";
import SearchPerformance from "./SearchPerformance";
import QuickWins from "./QuickWins";
import Cannibalisation, { type CannibalisationState } from "./Cannibalisation";
import Decay from "./Decay";
import { HAIRLINE, INK, MUTED, NAVY, NotConnected, SURFACE, UpstreamError } from "./ui";

type WindowDays = 28 | 90;

type Loaded = {
  siteUrl: string;
  range: { startDate: string; endDate: string } | null;
  queries: GscRow[];
  pages: GscRow[];
  /** Same dimension as `pages`, over a 2× window — used to derive the previous period. */
  pagesExtended: GscRow[];
  /** Set when only the wider comparison call failed; the other tabs still work. */
  extendedError: string | null;
  /**
   * The query+page pair call, resolved to the Cannibalisation tab's own three
   * states. Kept separate so a failure there degrades to that tab alone — the
   * same containment the wider Decay window gets.
   */
  pairs: CannibalisationState;
};

type State =
  | { status: "loading" }
  | { status: "not-configured"; missing: string[]; detail?: string }
  | { status: "error"; error: string; httpStatus: number | null }
  | { status: "ready"; data: Loaded };

const TABS = ["Search performance", "Quick wins", "Cannibalisation", "Decay"] as const;

/** Stable identity for the window in which the pairs call has not answered yet. */
const PAIRS_PENDING: CannibalisationState = { status: "ready", rows: [] };

const WILL_SHOW =
  "Once Search Console is connected this page reports live clicks, impressions, CTR and average position for your property, ranks the queries closest to page one, and flags pages losing clicks against the previous period.";

/**
 * Maps the pairs response onto the Cannibalisation tab's own three states. It is
 * deliberately NOT folded into the page-level state: only that tab needs pairs,
 * so its failure must not blank the other three.
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

export default function SeoCockpit() {
  const [tab, setTab] = useState(0);
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

  return (
    <>
      <PageHeader
        title="SEO Cockpit"
        subtitle="Live Google Search Console — performance, quick wins, cannibalisation and decay for the connected property"
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
          <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, mb: 3 }}>
            <Tabs
              value={tab}
              onChange={(_, v: number) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 42,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: MUTED,
                  minHeight: 42,
                  px: 2,
                },
                "& .Mui-selected": { color: `${INK} !important` },
                "& .MuiTabs-indicator": { backgroundColor: NAVY, height: 2 },
              }}
            >
              {TABS.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>
          </Box>

          {data?.extendedError && tab === 3 && (
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
          )}

          {tab === 0 && (
            <SearchPerformance
              queries={data?.queries ?? []}
              pages={data?.pages ?? []}
              loading={loading}
              days={windowDays}
              range={data?.range ?? null}
            />
          )}
          {tab === 1 && <QuickWins queries={data?.queries ?? []} loading={loading} days={windowDays} />}
          {tab === 2 && (
            <Cannibalisation
              // While the window is still loading there is no response yet, so the
              // tab renders skeletons over an empty ready state rather than an error.
              state={data?.pairs ?? PAIRS_PENDING}
              loading={loading}
              days={windowDays}
              onRetry={retry}
            />
          )}
          {tab === 3 && (
            <Decay
              pagesCurrent={data?.pages ?? []}
              pagesExtended={data?.pagesExtended ?? []}
              loading={loading}
              days={windowDays}
            />
          )}
        </>
      )}
    </>
  );
}
