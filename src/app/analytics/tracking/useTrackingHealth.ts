"use client";

// One fetch set, two readers: Tracking health draws the whole picture and
// SMEC targets reads only the verdict, so the two pages always agree on it.

import { useMemo, useState } from "react";
import { useHeld, type Held } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import {
  BASELINE,
  assessHealth,
  dailyMix,
  recentWindow,
  trafficWeeks,
  type DayMix,
  type Health,
  type TrafficWeek,
} from "./health";

/** Several held results as one: loading until all answer, the first failure wins, dimmed while any refetches. */
export function combineHeld<T>(helds: Held<T>[]): Held<T[]> {
  const stale = helds.some((h) => h.stale);
  const data: T[] = [];
  for (const h of helds) {
    const r = h.result;
    if (r === null) return { result: null, stale };
    if (r.state !== "ok") return { result: r, stale };
    data.push(r.data);
  }
  return { result: { state: "ok", data }, stale };
}

export type TrackingDerived = {
  baselineDays: DayMix[];
  recentDays: DayMix[];
  baselineTraffic: Map<string, TrafficWeek>;
  recentTraffic: Map<string, TrafficWeek>;
  health: Health;
  /** True when GA4 capped any of the four reports — the verdict would rest on partial rows. */
  truncated: boolean;
};

export function useTrackingHealth(tick: number) {
  const [nowMs] = useState(() => Date.now());
  const span = useMemo(() => recentWindow(nowMs), [nowMs]);
  const qb = `from=${BASELINE.from}&to=${BASELINE.to}`;
  const qr = `from=${span.from}&to=${span.to}`;

  const baseline = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=channelsDaily&${qb}`, [tick]);
  const recent = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=channelsDaily&${qr}`, [qr, tick]);
  const baselineTraffic = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=trafficWeekly&${qb}`, [tick]);
  const recentTraffic = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=trafficWeekly&${qr}`, [qr, tick]);
  const all = combineHeld([baseline, recent, baselineTraffic, recentTraffic]);

  const derived = useMemo<TrackingDerived | null>(() => {
    const r = all.result;
    if (!r || r.state !== "ok") return null;
    const [b, rc, bt, rt] = r.data;
    const baselineDays = dailyMix(b);
    const recentDays = dailyMix(rc);
    const bTraffic = trafficWeeks(bt);
    const rTraffic = trafficWeeks(rt);
    return {
      baselineDays,
      recentDays,
      baselineTraffic: bTraffic,
      recentTraffic: rTraffic,
      health: assessHealth({ baseline: baselineDays, recent: recentDays, baselineTraffic: bTraffic, recentTraffic: rTraffic, window: span }),
      truncated: r.data.some((x) => x.truncated),
    };
    // The combined result is rebuilt every render; the four underlying results are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline.result, recent.result, baselineTraffic.result, recentTraffic.result, span]);

  return { span, all, derived };
}
