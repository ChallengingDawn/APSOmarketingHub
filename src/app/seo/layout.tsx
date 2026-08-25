"use client";

/**
 * SEO COCKPIT SHELL.
 *
 * Five sub-apps, five routes, one data load. This layout owns the Search
 * Console connection and the window switch; Next keeps it mounted while you
 * move between the five siblings, so navigating does NOT refetch, and the
 * window you chose survives the move.
 *
 *   /seo                  Performance     what the site earns now
 *   /seo/quick-wins       Quick wins      queries within reach of page one
 *   /seo/cannibalisation  Cannibalisation queries split across your own URLs
 *   /seo/decay            Decay           pages losing clicks
 *   /seo/work-queue       Work queue      everything actionable, ranked
 *
 * Layout is full-bleed: this is a data surface, so the gutter is the only thing
 * between a table and the viewport edge. Wide content scrolls inside its own
 * container — the page never scrolls sideways.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";

import { fetchGsc, fetchGscPairs } from "./gscClient";
import {
  SeoDataProvider,
  queueFrom,
  reduceResponses,
  type SeoContextValue,
  type SeoState,
  type WindowDays,
} from "./SeoData";
import { SubNav, WindowSwitch, type NavCounts } from "./Shell";
import { GUTTER } from "./ui";

export default function SeoLayout({ children }: { children: ReactNode }) {
  const [windowDays, setWindowDays] = useState<WindowDays>(28);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<SeoState>({ status: "loading" });

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

  const value = useMemo<SeoContextValue>(
    () => ({ windowDays, setWindowDays, state, loading, data, queue, retry }),
    [windowDays, state, loading, data, queue, retry],
  );

  /**
   * Badges on the rail come from the queue's own coverage record, so a rail
   * number can never disagree with the sub-app it points at. An analysis that
   * could not run shows no badge rather than a zero — a zero would be a claim.
   */
  const counts = useMemo<NavCounts>(() => {
    if (!queue) return {};
    const found = (n: number) => n;
    const qw = queue.coverage["quick-win"];
    const can = queue.coverage.cannibalisation;
    const dec = queue.coverage.decay;
    return {
      "quick-wins": qw.status === "available" ? found(qw.found) : null,
      cannibalisation: can.status === "available" ? found(can.found) : null,
      decay: dec.status === "available" ? found(dec.found) : null,
      "work-queue": queue.items.length,
    };
  }, [queue]);

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="SEO Cockpit"
        subtitle="Live Google Search Console — five focused sub-apps over one connection"
        rightSlot={
          <WindowSwitch
            windowDays={windowDays}
            onChange={setWindowDays}
            loading={loading}
            siteUrl={data ? data.siteUrl : null}
          />
        }
      />

      <SubNav counts={counts} />

      <SeoDataProvider value={value}>{children}</SeoDataProvider>
    </Box>
  );
}
