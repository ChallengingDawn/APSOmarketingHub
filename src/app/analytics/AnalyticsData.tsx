"use client";

// One connection, five sub-apps. The provider owns the window and the GA4
// overview; each sub-app asks for the named reports it needs through
// useGa4Report, keyed on the same window so every figure on screen agrees.
// While a window switch reloads, the previous result is held and flagged
// stale rather than dropped — charts dim instead of collapsing.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchIntegration,
  type Ga4Overview,
  type Ga4ReportName,
  type Ga4TableReport,
  type Ga4TableRow,
  type HubspotPayload,
  type HubspotWeekly,
  type IntegrationResult,
} from "./integrationApi";

export const WINDOWS = [28, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

export const HUBSPOT_RECENT_DAYS = 30;

export type Held<T> = { result: IntegrationResult<T> | null; stale: boolean };

type Ctx = {
  windowDays: WindowDays;
  setWindowDays: (d: WindowDays) => void;
  reloadKey: number;
  reload: () => void;
  overview: Held<Ga4Overview>;
  hubspot: Held<HubspotPayload>;
};

const AnalyticsContext = createContext<Ctx | null>(null);

/** Fetch with hold-and-dim semantics: the last good result survives a refetch. */
function useHeld<T>(url: string | null, deps: unknown[]): Held<T> {
  const [held, setHeld] = useState<Held<T>>({ result: null, stale: false });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setHeld((h) => ({ result: h.result, stale: h.result !== null }));
    fetchIntegration<T>(url, controller.signal)
      .then((result) => setHeld({ result, stale: false }))
      .catch(() => {
        /* aborted by a newer request */
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return held;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [windowDays, setWindowDays] = useState<WindowDays>(28);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const overview = useHeld<Ga4Overview>(`/api/integrations/ga4?days=${windowDays}`, [windowDays, reloadKey]);
  const hubspot = useHeld<HubspotPayload>(`/api/integrations/hubspot?days=${HUBSPOT_RECENT_DAYS}`, [reloadKey]);

  const value = useMemo<Ctx>(
    () => ({ windowDays, setWindowDays, reloadKey, reload, overview, hubspot }),
    [windowDays, reloadKey, reload, overview, hubspot],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): Ctx {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used inside AnalyticsProvider");
  return ctx;
}

/** A named GA4 report for the current window. */
export function useGa4Report(name: Ga4ReportName): Held<Ga4TableReport> {
  const { windowDays, reloadKey } = useAnalytics();
  return useHeld<Ga4TableReport>(`/api/integrations/ga4?report=${name}&days=${windowDays}`, [name, windowDays, reloadKey]);
}

export function useHubspotWeekly(weeks = 8): Held<HubspotWeekly> {
  const { reloadKey } = useAnalytics();
  return useHeld<HubspotWeekly>(`/api/integrations/hubspot?report=weekly&weeks=${weeks}`, [weeks, reloadKey]);
}

/* ── row helpers ───────────────────────────────────────────────────────── */

/** Reads one metric off a report row by name; null when the report lacks it. */
export function metricOf(report: Ga4TableReport, metric: string): (row: Ga4TableRow) => number | null {
  const idx = report.metrics.indexOf(metric);
  return (row) => (idx === -1 ? null : row.values[idx] ?? null);
}

export function sumOf(report: Ga4TableReport, metric: string): number | null {
  const get = metricOf(report, metric);
  let any = false;
  let total = 0;
  for (const row of report.rows) {
    const v = get(row);
    if (v !== null) {
      any = true;
      total += v;
    }
  }
  return any ? total : null;
}
