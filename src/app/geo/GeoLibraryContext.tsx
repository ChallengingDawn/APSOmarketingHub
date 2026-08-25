"use client";

/**
 * One library load and one filter state for the whole cockpit.
 *
 * The five sub-apps are separate routes, but they are views of ONE portfolio:
 * if each page fetched and scored the library for itself, moving between them
 * could change the average, and a channel filter set in the Content audit would
 * be forgotten by the Fix queue. This provider lives in the GEO layout, which
 * App Router keeps mounted across every /geo/* navigation, so the scores and
 * the filters survive the move.
 *
 * Nothing is scored that was not stored — see `useGeoLibrary`.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { GeoBand } from "@/lib/geo/audit";
import {
  applyGeoFilters,
  useGeoLibrary,
  type GeoLibraryState,
  type ScoredPiece,
} from "./useGeoLibrary";

export type GeoContextValue = {
  state: GeoLibraryState;
  reload: () => void;
  /** Every scored piece, worst first. */
  pieces: ScoredPiece[];
  /** Pieces passing the current channel + band filters, worst first. */
  visible: ScoredPiece[];
  channels: string[];
  channel: string;
  band: "all" | GeoBand;
  setChannel: (v: string) => void;
  setBand: (v: "all" | GeoBand) => void;
  /** True when the filters are hiding at least one scored piece. */
  filtered: boolean;
};

const GeoCtx = createContext<GeoContextValue | null>(null);

export function GeoLibraryProvider({ children }: { children: ReactNode }) {
  const { state, reload, channels, pieces } = useGeoLibrary();
  const [channel, setChannel] = useState("all");
  const [band, setBand] = useState<"all" | GeoBand>("all");

  // A channel filter can outlive the channel it names (reload, new data). Fall
  // back to "all" rather than showing an empty list for a value that is gone.
  const effectiveChannel = channel !== "all" && !channels.includes(channel) ? "all" : channel;

  const visible = useMemo(
    () => applyGeoFilters(pieces, { channel: effectiveChannel, band }),
    [pieces, effectiveChannel, band]
  );

  const value = useMemo<GeoContextValue>(
    () => ({
      state,
      reload,
      pieces,
      visible,
      channels,
      channel: effectiveChannel,
      band,
      setChannel,
      setBand,
      filtered: visible.length !== pieces.length,
    }),
    [state, reload, pieces, visible, channels, effectiveChannel, band]
  );

  return <GeoCtx.Provider value={value}>{children}</GeoCtx.Provider>;
}

export function useGeoContext(): GeoContextValue {
  const ctx = useContext(GeoCtx);
  if (!ctx) throw new Error("useGeoContext must be used inside the /geo layout.");
  return ctx;
}
