"use client";
// THE TILE TOOLBAR'S STATE, one read per page shared by all its tiles: per tile its tasks and
// tickets counted, every promoted or demoted tile, the page's saved views. A tile's change asks again.

import { useEffect, useState } from "react";
import type { Placement, SavedView, TileFormat, TileSpec } from "@/lib/reporting/kpiActions";

export type Counts = Record<string, { open: number; tasks: number; tickets: number }>;
export type Placed = { spec: TileSpec; placement: Placement; format: TileFormat | null; by: string; at: string };
export type ActionsState = { canWrite: boolean; counts: Counts; placements: Placed[]; views: SavedView[]; orders: Record<string, string[]>; targets: Record<string, number> };

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
      s.state = { canWrite: !!j.canWrite, counts: j.counts ?? {}, placements: j.placements ?? [], views: j.views ?? [], orders: j.orders ?? {}, targets: j.targets ?? {} };
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
    // asked again on every visit: a move or a task made on another page (or by someone else) shows at once
    if (!s.loading) void load(page);
    return () => { s.listeners.delete(f); };
  }, [page, s]);
  return { state: s.state, error: s.error };
}

type Sized = { key: string; kind?: "kpi" | "card"; kpiId?: string };

/**
 * The sizes a graph can take in the nutshell (SARCLA 19.10: "propose several types when bringing it to
 * the nutshell"): a KPI as a small tile, half or the whole width (its page's card); a small Lead graph
 * as a tile or half the width; a page's card at half or the whole width.
 */
export function formatsFor(t: Sized): TileFormat[] {
  if (/:tile:/.test(t.key)) return ["tile", "half"];
  // an Engagements tool is a small tile in the nutshell (SARCLA 19.10: "they should be small, the services")
  if (/^engage:tools:tool-/.test(t.key)) return ["tile"];
  if ((t.kind ?? (t.kpiId ? "kpi" : "card")) === "kpi" && t.kpiId) return ["tile", "half", "card"];
  return ["half", "card"];
}
export const FORMAT_LABEL: Record<TileFormat, string> = { tile: "Small tile", half: "Half width", card: "Full width" };

/** How big a graph is in the nutshell: what someone chose, else a tile - or the whole width for a card. */
export function formatOf(state: ActionsState | null, t: Sized): TileFormat {
  const can = formatsFor(t);
  const f = state?.placements.find((p) => p.spec.key === t.key)?.format;
  return f && can.includes(f) ? f : can[0] === "tile" ? "tile" : "card";
}

/** A chart's target (typed in its Actions window), by the key the chart gives it; null when none is set. */
export const targetOf = (state: ActionsState | null, key: string | undefined): number | null => (key && state?.targets?.[key] != null ? state.targets[key] : null);

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
