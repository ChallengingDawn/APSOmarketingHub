"use client";

// One connection, five sub-apps. The provider reads the hub-wide reporting
// window and owns the GA4 overview; each sub-app asks for the named reports
// it needs through useGa4Report, keyed on the same window so every figure on
// screen agrees. While a window change reloads, the previous result is held
// and flagged stale rather than dropped — charts dim instead of collapsing.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
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

export type Held<T> = { result: IntegrationResult<T> | null; stale: boolean };

type Ctx = {
  /** Inclusive length of the shared window, in days. */
  windowDays: number;
  windowLabel: string;
  windowFrom: string;
  windowTo: string;
  reloadKey: number;
  reload: () => void;
  overview: Held<Ga4Overview>;
  hubspot: Held<HubspotPayload>;
};

const AnalyticsContext = createContext<Ctx | null>(null);

/** Fetch with hold-and-dim semantics: the last good result survives a refetch. */
export function useHeld<T>(url: string | null, deps: unknown[]): Held<T> {
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
  const { window: win, days, label } = useReportingWindow();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  const q = windowQuery(win);

  const overview = useHeld<Ga4Overview>(`/api/integrations/ga4?${q}`, [q, reloadKey]);
  // The CRM summary counts "new contacts" over the same span as the window.
  const hubspot = useHeld<HubspotPayload>(`/api/integrations/hubspot?days=${days}`, [days, reloadKey]);

  const value = useMemo<Ctx>(
    () => ({
      windowDays: days,
      windowLabel: label,
      windowFrom: win.from,
      windowTo: win.to,
      reloadKey,
      reload,
      overview,
      hubspot,
    }),
    [days, label, win.from, win.to, reloadKey, reload, overview, hubspot],
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
  const { windowFrom, windowTo, reloadKey } = useAnalytics();
  return useHeld<Ga4TableReport>(
    `/api/integrations/ga4?report=${name}&from=${windowFrom}&to=${windowTo}`,
    [name, windowFrom, windowTo, reloadKey],
  );
}

export function useHubspotWeekly(): Held<HubspotWeekly> {
  const { windowFrom, windowTo, reloadKey } = useAnalytics();
  return useHeld<HubspotWeekly>(
    `/api/integrations/hubspot?report=weekly&from=${windowFrom}&to=${windowTo}`,
    [windowFrom, windowTo, reloadKey],
  );
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
