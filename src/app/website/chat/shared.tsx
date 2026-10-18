"use client";

// Chat page: the pieces its tabs share. The look is the UC apps' kit, as on the search bar and DirectCut.

import { useState } from "react";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Chip } from "@/app/connectors/parts";
import type { Tint } from "@/app/uc/report/ui";
import { handlerOf, type Conversation } from "@/lib/chat/shape";

export { when, pct, Bars } from "@/app/website/directup/shared";
export { pill, PagedBars, Empty, Num } from "@/app/website/search-bar/shared";

/** One tab's data: loading, not configured, orchestrator failed, or the panel. */
export function Loaded<T>({ url, what, children }: {
  url: string; what: string; children: (data: T, reload: () => void, stale: boolean) => React.ReactNode;
}) {
  const [n, setN] = useState(0);
  const u = `${url}${url.includes("?") ? "&" : "?"}n=${n}`;
  const held = useHeld<T>(u, [u]);
  const reload = () => setN((x) => x + 1);
  const r = held.result;
  if (r === null) return <LoadingPanel label={`Reading ${what} from the chat's orchestrator…`} />;
  if (r.state === "not-configured") return <NotConnectedPanel source="Chat orchestrator" missing={r.missing} />;
  if (r.state === "error") return <UpstreamPanel source="Chat orchestrator" error={r.error} status={r.status} onRetry={reload} />;
  return <>{children(r.data, reload, held.stale)}</>;
}

export async function post<T = unknown>(body: unknown): Promise<{ ok: boolean; error?: string; data?: T }> {
  const r = await fetch("/api/website/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: T };
}

const HANDLER: Record<string, { label: string; tint: Tint }> = {
  AI: { label: "AI", tint: "slate" }, TSA: { label: "TSA", tint: "green" }, BO: { label: "Back Office", tint: "blue" },
};
/** Who handled it: the AI alone, or the team it was handed to. */
export function HandlerChip({ c }: { c: Pick<Conversation, "escalated" | "routing_team" | "handler"> }) {
  const h = handlerOf(c);
  const m = HANDLER[h] ?? { label: h, tint: "purple" as Tint };
  return <Chip tint={m.tint}>{m.label}</Chip>;
}

export const LANGUAGES = ["en", "de", "fr", "it", "nl", "pl"] as const;
export const COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"] as const;

/** The orchestrator's categories read as they are; a missing one says so. */
export const category = (c: string | null | undefined) => c || "Not classified";
