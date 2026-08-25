"use client";

/**
 * Loads the stored content library once and scores every piece, so every
 * sub-app of the cockpit reads from one identical set of numbers.
 *
 * Five routes fetching separately would be five portfolios: moving between
 * them could change the average. This hook makes that impossible — one request,
 * one audit pass, every view. It is called once, by the GEO layout's
 * `GeoLibraryProvider`, which App Router keeps mounted across /geo/*.
 *
 * Nothing is scored that was not stored. Pieces with an empty body are counted
 * and reported as skipped rather than given a score of zero.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { auditGeoReadiness, type GeoAuditResult, type GeoBand } from "@/lib/geo/audit";

/** Matches the library's own ceiling — the most recent N pieces. */
export const FETCH_LIMIT = 200;

export type ContentItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ScoredPiece = {
  item: ContentItem;
  audit: GeoAuditResult;
};

export type GeoLibraryState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      /** Scored worst first — the piece an engine is least able to quote leads. */
      pieces: ScoredPiece[];
      /** Rows the library returned in total, before empty bodies were dropped. */
      fetched: number;
      /** Rows dropped because they carry no body text to audit. */
      skipped: number;
    };

export type GeoLibrary = {
  state: GeoLibraryState;
  reload: () => void;
  /** Distinct channels present in the scored set, alphabetical. */
  channels: string[];
  pieces: ScoredPiece[];
};

function isContentItem(value: unknown): value is ContentItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "number" && typeof v.channel === "string" && typeof v.body === "string";
}

export function useGeoLibrary(): GeoLibrary {
  const [state, setState] = useState<GeoLibraryState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/content?limit=${FETCH_LIMIT}`);
      if (!res.ok) throw new Error(`The content service replied ${res.status}.`);
      const data: unknown = await res.json();
      const raw = (data as { items?: unknown }).items;
      const items = Array.isArray(raw) ? raw.filter(isContentItem) : [];
      const auditable = items.filter((i) => i.body.trim().length > 0);
      const pieces: ScoredPiece[] = auditable
        .map((item) => ({
          item,
          audit: auditGeoReadiness(item.body, { channel: item.channel, title: item.title }),
        }))
        .sort((a, b) => a.audit.score - b.audit.score || b.item.id - a.item.id);

      setState({
        phase: "ready",
        pieces,
        fetched: items.length,
        skipped: items.length - auditable.length,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "The content service could not be reached.",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pieces = state.phase === "ready" ? state.pieces : [];

  const channels = useMemo(
    () => Array.from(new Set(pieces.map((p) => p.item.channel))).sort((a, b) => a.localeCompare(b)),
    [pieces]
  );

  return { state, reload: load, channels, pieces };
}

/** The shared channel + score-band filter, applied identically in both halves. */
export type GeoFilters = { channel: string; band: "all" | GeoBand };

export function applyGeoFilters(pieces: readonly ScoredPiece[], filters: GeoFilters): ScoredPiece[] {
  return pieces.filter(
    (p) =>
      (filters.channel === "all" || p.item.channel === filters.channel) &&
      (filters.band === "all" || p.audit.band === filters.band)
  );
}
