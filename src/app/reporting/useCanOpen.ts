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
import type { Level } from "@/lib/auth/access";
import { accessAt } from "@/lib/auth/tree";
import { useViewAs } from "@/app/ViewAs";

export function useReportAccess(): { canOpen: (href: string) => boolean; ready: boolean } {
  const { viewed, canOpenPath } = useViewAs();
  const [levels, setLevels] = useState<Record<string, Level> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.ok && j.levels) setLevels(j.levels as Record<string, Level>);
        else setFailed(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return {
    // the report's own sub-app decides, else its app (src/lib/auth/tree.ts): a person given TSA Reports alone sees TSA's
    canOpen: (href: string) => {
      if (viewed) return canOpenPath(href);
      if (!levels) return true;
      const a = accessAt(href, levels);
      return a.specific === null || a.level !== "none";
    },
    // a failed read leaves the reports' own guards to answer, as before
    ready: !!viewed || levels !== null || failed,
  };
}

export function useCanOpen(): (href: string) => boolean {
  return useReportAccess().canOpen;
}
