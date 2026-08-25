"use client";

/**
 * SHARED DATA LAYER FOR THE SEO COCKPIT.
 *
 * The five sub-apps under /seo are five real routes, not five tab states. They
 * must not each fetch Search Console. So the four live calls happen exactly once
 * — in src/app/seo/layout.tsx, which does not remount when you navigate between
 * sibling routes — and every sub-app reads the result from this context.
 *
 * That also means every sub-app inherits the identical three states:
 *   not-connected  → which secrets are missing
 *   upstream error → the real message, with a retry
 *   ready          → live rows, or an honest empty
 *
 * Nothing in this file invents a row. Reducers map API envelopes onto explicit
 * states; a call that failed is carried as a failure, never as an empty list.
 */

import { createContext, useContext } from "react";

import type { GscApiResponse, GscPairApiResponse, GscPairRow, GscRow } from "./gscClient";
import {
  cannibalisationOf,
  decayOf,
  quickWinsOf,
  type CannibalGroup,
  type DecayRow,
  type QuickWin,
} from "./analysis";
import { buildWorkQueue, type SourceInput, type WorkQueueResult } from "./queue";

export type WindowDays = 28 | 90;

/** The pairs call resolves to exactly one of these — never a partial guess. */
export type CannibalisationState =
  | { status: "not-connected"; missing: string[]; detail?: string }
  | { status: "error"; error: string; httpStatus: number | null }
  | { status: "ready"; rows: GscPairRow[] };

/** Stable identity for the window in which the pairs call has not answered yet. */
export const PAIRS_PENDING: CannibalisationState = { status: "ready", rows: [] };

export type Loaded = {
  siteUrl: string;
  range: { startDate: string; endDate: string } | null;
  queries: GscRow[];
  pages: GscRow[];
  /** Same dimension as `pages`, over a 2× window — used to derive the previous period. */
  pagesExtended: GscRow[];
  /** Set when only the wider comparison call failed; the other sub-apps still work. */
  extendedError: string | null;
  /**
   * The query+page pair call, resolved to Cannibalisation's own three states.
   * Kept separate so a failure there degrades that sub-app alone.
   */
  pairs: CannibalisationState;
};

export type SeoState =
  | { status: "loading" }
  | { status: "not-configured"; missing: string[]; detail?: string }
  | { status: "error"; error: string; httpStatus: number | null }
  | { status: "ready"; data: Loaded };

/* ── reducers ──────────────────────────────────────────────────────────── */

function pairsStateOf(res: GscPairApiResponse): CannibalisationState {
  if (!res.configured) return { status: "not-connected", missing: res.missing, detail: res.detail };
  if (!res.ok) return { status: "error", error: res.error, httpStatus: res.status };
  return { status: "ready", rows: res.data.rows };
}

/** Reduces the four responses into a single explicit state — never a partial guess. */
export function reduceResponses(
  queriesRes: GscApiResponse,
  pagesRes: GscApiResponse,
  extendedRes: GscApiResponse,
  pairsRes: GscPairApiResponse,
): SeoState {
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
 * says so instead of reporting a smaller list as if it were complete.
 */
export function queueFrom(data: Loaded, windowDays: number): WorkQueueResult {
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

/* ── context ───────────────────────────────────────────────────────────── */

export type SeoContextValue = {
  windowDays: WindowDays;
  setWindowDays: (days: WindowDays) => void;
  state: SeoState;
  /** True while the four calls for the current window are in flight. */
  loading: boolean;
  /** Rows for the current window, or null while loading / not connected / failed. */
  data: Loaded | null;
  /** The merged queue for the current window — derived once, shared by all sub-apps. */
  queue: WorkQueueResult | null;
  retry: () => void;
};

const SeoContext = createContext<SeoContextValue | null>(null);

export const SeoDataProvider = SeoContext.Provider;

export function useSeoData(): SeoContextValue {
  const value = useContext(SeoContext);
  if (value === null) {
    throw new Error("useSeoData() must be called inside the /seo layout.");
  }
  return value;
}
