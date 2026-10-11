"use client";
// May the person (or the person being previewed) open this report's page?
//
// Advanced reporting opens for anyone who may open one of its reports (see
// opensApp), so its pages list only the reports their grants reach - the same
// rule the side panel draws with. While the answer is loading everything shows:
// each report's own guard is what refuses, this only stops advertising it.

import { useEffect, useState } from "react";
import { appForPath } from "@/lib/auth/access";
import { useViewAs } from "@/app/ViewAs";

export function useCanOpen(): (href: string) => boolean {
  const { viewed, canOpen } = useViewAs();
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok) setOpen(j.open as Record<string, boolean>); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return (href: string) => {
    const app = appForPath(href.split("?")[0]);
    if (!app) return true;
    if (viewed) return canOpen(app);
    return !open || !!open[app];
  };
}
