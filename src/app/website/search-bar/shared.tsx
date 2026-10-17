"use client";

// Search bar page: the pieces its tabs share. The look is the UC apps' kit, as on DirectUP, 3D files and DoC.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { MUTED } from "@/app/uc/report/ui";

export { Bars, pct, when } from "@/app/website/directup/shared";
import { viewForTier } from "./views";

/** What the search bar answered with, in words: the view it showed (views.ts), else these. */
const TIER: Record<string, string> = {
  pcov: "Rubber, foam & covering sheets", "oring-catalog": "O-ring catalogue", figure: "O-ring catalogue (a number)",
  "material-fuzzy": "Material (near-miss spelling)", "temp-out-of-range": "AI assistant (temperature outside the material)",
  "plastic-aggregate": "Engineering plastics overview", gap: "Not placed", none: "Nothing found",
};
export const tierLabel = (t: string | null | undefined) => (t ? TIER[t] ?? viewForTier(t)?.name ?? t.replace(/[-_]/g, " ") : "–");

/** One tab's data: loading, not configured, gateway failed, or the panel. A new `url` reads again;
 *  `reload` asks the gateway again for the same one. */
export function Loaded<T>({ url, what, children }: {
  url: string; what: string; children: (data: T, reload: () => void, stale: boolean) => React.ReactNode;
}) {
  const [n, setN] = useState(0);
  const u = `${url}${url.includes("?") ? "&" : "?"}n=${n}`;
  const held = useHeld<T>(u, [u]);
  const reload = () => setN((x) => x + 1);
  const r = held.result;
  if (r === null) return <LoadingPanel label={`Reading ${what} from the search bar…`} />;
  if (r.state === "not-configured") return <NotConnectedPanel source="Smart-bar gateway" missing={r.missing} />;
  if (r.state === "error") return <UpstreamPanel source="Smart-bar gateway" error={r.error} status={r.status} onRetry={reload} />;
  return <>{children(r.data, reload, held.stale)}</>;
}

/** One change through the hub (admins only): the switches, the brand list. */
export async function post<T = unknown>(body: unknown): Promise<{ ok: boolean; error?: string; data?: T }> {
  const r = await fetch("/api/website/search-bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: T };
}

/** A pill button, as on the UC apps. */
export const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };

export function Empty({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 1 }}>{children}</Typography>;
}

/** A number in a table cell, right-aligned, tabular. */
export function Num({ children }: { children: React.ReactNode }) {
  return <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{children}</Box>;
}
