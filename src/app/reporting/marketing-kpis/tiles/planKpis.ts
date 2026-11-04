"use client";
// THE ACTION PLAN'S KPIS, as a tile and the plan's KPIs tab read them: one read per page, shared; null for whoever does
// not have the plan (admins only) - then nothing of it shows on a tile. A change asks again.

import { useEffect, useState } from "react";
import type { PlanKpi } from "@/lib/reporting/planKpiTeams";
import { send } from "./store";

export type PlanKpisState = { kpis: PlanKpi[]; targets: Record<string, number> };
type Store = { state: PlanKpisState | null; denied: boolean; error: string | null; loading: Promise<void> | null; listeners: Set<() => void> };
const s: Store = { state: null, denied: false, error: null, loading: null, listeners: new Set() };

function load(): Promise<void> {
  if (s.loading) return s.loading;
  s.loading = (async () => {
    try {
      const r = await fetch("/api/action-plan/kpis");
      if (r.status === 401 || r.status === 403) { s.denied = true; s.state = null; return; }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      s.state = { kpis: j.kpis ?? [], targets: j.targets ?? {} };
      s.error = null;
    } catch (e) {
      s.error = (e as Error).message;
    } finally {
      s.loading = null;
      s.listeners.forEach((f) => f());
    }
  })();
  return s.loading;
}

export const refreshPlanKpis = (): Promise<void> => load();

/** The plan's KPIs - `denied` for someone without the plan. Read once per page; `fresh` reads again on mount. */
export function usePlanKpis(fresh = false): { state: PlanKpisState | null; denied: boolean; error: string | null } {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    s.listeners.add(f);
    if (!s.loading && (fresh || (!s.state && !s.denied))) void load();
    return () => { s.listeners.delete(f); };
  }, [fresh]);
  return { state: s.state, denied: s.denied, error: s.error };
}

/** Its words, sent once per page when its tile drew them otherwise - in the view it was promoted in. */
const sent = new Set<string>();
export function sayFigure(k: PlanKpi, summary: string, view: string): void {
  const said = `${k.key}\n${summary}`;
  if (!summary || summary === k.summary || view !== k.view || sent.has(said)) return;
  sent.add(said);
  void send("/api/action-plan/kpis", "PATCH", { key: k.key, summary, view }).then(load, () => undefined);
}
