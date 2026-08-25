"use client";

/**
 * The GEO cockpit shell.
 *
 * Everything shared by the five sub-apps lives here — the header, the
 * persistent sub-navigation rail and the single scored library — so each page
 * file can be nothing but its own job. App Router keeps this layout mounted
 * across /geo, /geo/content, /geo/live, /geo/competitors and /geo/fix-queue,
 * which is what makes the rail persistent and the library load happen once.
 */

import type { ReactNode } from "react";
import { GeoLibraryProvider } from "./GeoLibraryContext";
import GeoChrome from "./GeoChrome";

export default function GeoLayout({ children }: { children: ReactNode }) {
  return (
    <GeoLibraryProvider>
      <GeoChrome>{children}</GeoChrome>
    </GeoLibraryProvider>
  );
}
