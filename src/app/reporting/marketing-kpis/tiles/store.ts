"use client";
// THE TILE TOOLBAR'S STATE, one read per page shared by all its tiles: per tile its tasks and
// tickets counted, every promoted or demoted tile, the page's saved views. A tile's change asks again.

import { useEffect, useState } from "react";
import type { Placement, SavedView, TileSpec } from "@/lib/reporting/kpiActions";

export type Counts = Record<string, { open: number; tasks: number; tickets: number }>;
export type Placed = { spec: TileSpec; placement: Placement; by: string; at: string };
export type ActionsState = { canWrite: boolean; counts: Counts; placements: Placed[]; views: SavedView[] };

type Store = { state: ActionsState | null; error: string | null; listeners: Set<() => void>; loading: Promise<void> | null };
const stores = new Map<string, Store>();

const storeOf = (page: string): Store => {
  let s = stores.get(page);
  if (!s) { s = { state: null, error: null, listeners: new Set(), loading: null }; stores.set(page, s); }
  return s;
};

async function load(page: string): Promise<void> {
  const s = storeOf(page);
  if (s.loading) return s.loading;
  s.loading = (async () => {
    try {
      const r = await fetch(`/api/reporting/kpi-actions?page=${encodeURIComponent(page)}`);
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      s.state = { canWrite: !!j.canWrite, counts: j.counts ?? {}, placements: j.placements ?? [], views: j.views ?? [] };
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

/** Ask again - every page that shows tiles (the nutshell sees every page's). */
export function refreshActions(page?: string): Promise<void> {
  const pages = page ? [page, "nutshell"] : [...stores.keys()];
  return Promise.all(pages.filter((p) => stores.has(p)).map(load)).then(() => undefined);
}

export function useActions(page: string): { state: ActionsState | null; error: string | null } {
  const s = storeOf(page);
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    s.listeners.add(f);
    if (!s.state && !s.loading) void load(page);
    return () => { s.listeners.delete(f); };
  }, [page, s]);
  return { state: s.state, error: s.error };
}

/** Where a tile is shown: what someone chose, else where it starts. */
export function placementOf(state: ActionsState | null, key: string, start: Placement): Placement {
  return state?.placements.find((p) => p.spec.key === key)?.placement ?? start;
}

export async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok || !j?.ok) throw new Error(String(j?.error ?? j?.message ?? `the hub answered ${r.status}`));
  return j;
}
