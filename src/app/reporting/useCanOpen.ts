"use client";
// May the person (or the person being previewed) open this report's page?
//
// Advanced reporting lists reports that belong to other apps, so its pages show
// only the ones this person's grants reach - the same rule the side panel draws
// with. While the answer is loading everything shows: each report's own guard
// is what refuses, this only stops advertising it. `ready` says when the answer
// is in, for a page that acts on it (a category page sends you straight into its
// first report, and must not send you into one you cannot open).

import { useEffect, useState } from "react";
import { appForPath } from "@/lib/auth/access";
import { useViewAs } from "@/app/ViewAs";

export function useReportAccess(): { canOpen: (href: string) => boolean; ready: boolean } {
  const { viewed, canOpen } = useViewAs();
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setOpen(j.open as Record<string, boolean>);
        else setFailed(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return {
    canOpen: (href: string) => {
      const app = appForPath(href.split("?")[0]);
      if (!app) return true;
      if (viewed) return canOpen(app);
      return !open || !!open[app];
    },
    // a failed read leaves the reports' own guards to answer, as before
    ready: !!viewed || open !== null || failed,
  };
}

export function useCanOpen(): (href: string) => boolean {
  return useReportAccess().canOpen;
}
