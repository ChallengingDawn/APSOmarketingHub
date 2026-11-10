"use client";

// APSO TRANSLATOR - what its three pages share (Overview, Conversations, Settings & help). A main app of UC & HubSpot Apps
// since 09.11.2026 (SARCLA: "this should come back on the level of UC's as a main app - more graphs as KPIs, much more by
// tabs, and the sub apps on the side panel"); the engine is src/lib/translator.

import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { MUTED } from "@/app/uc/report/ui";
import { Chip, Info, when } from "@/app/connectors/parts";
import type { Tint } from "@/app/uc/report/ui";
import type { Day, Mode, Outcome, Row, RunInfo, Settings, Speed } from "@/lib/translator/engine";
import { LANG_NAMES } from "@/lib/translator/text";

export type Data = {
  settings: Settings; last: RunInfo | null; rows: Row[]; days: Record<string, Day>; inboxes: Record<string, string>; agents: Record<string, string>;
  usage: { used: number; limit: number | null } | null; configured: boolean; everySeconds: number; admin: boolean; speed: Speed; kept: number;
};

export const MODE: Record<Mode, { label: string; tint: Tint }> = { live: { label: "Live", tint: "green" }, preview: { label: "Preview", tint: "amber" }, off: { label: "Off", tint: "slate" } };
export const OUTCOME: Record<Outcome, { label: string; tint: Tint }> = {
  posted: { label: "Comment posted", tint: "green" }, sent: { label: "Sent to the customer", tint: "blue" }, would: { label: "Preview - not posted", tint: "amber" },
  skipped: { label: "Nothing to do", tint: "slate" }, failed: { label: "Failed", tint: "pink" },
};
export const CHANNEL: Record<Row["channel"], string> = { chat: "Chat", email: "E-mail", other: "Other" };
// XX: a language the old translator guessed on a short text and the hub does not know (the history, 10.11.2026)
export const lang = (code: string | null | undefined) => (code === "XX" ? "Other or unclear" : code ? LANG_NAMES[code.split("-")[0].toUpperCase()] ?? code : "—");
export const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
export const EMPTY: Day = { n: 0, chars: 0, replies: 0, langs: {} };
/** The last n days, oldest first, each with its figures (an empty day where there are none). */
export function lastDays(days: Record<string, Day>, n: number, endAgo = 0) {
  const out: { key: string; d: Day }[] = [];
  for (let i = n - 1 + endAgo; i >= endAgo; i--) {
    const key = dayKey(new Date(Date.now() - i * 86400_000));
    out.push({ key, d: days[key] ?? EMPTY });
  }
  return out;
}
/** dd.mm */
export const dm = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;
export const n0 = (v: number | null | undefined) => full(v ?? 0);
export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/** The page's data: the figures (Overview, Settings) or the conversations with their texts. */
export function useTranslator(part: "overview" | "rows") {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `/api/uc/translator?${part === "rows" ? "part=rows&" : ""}n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const act = useCallback(async (body: Record<string, unknown>, method: "PUT" | "POST" = "PUT") => {
    setNote(null); setBusy(true);
    const j = await fetch("/api/uc/translator", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!j?.ok) setNote(j?.error ?? "Could not save.");
    else if (method === "POST") setNote(j.data?.skipped ? `Not run: ${j.data.skipped}.` : `Looked: ${full(j.data.threads ?? 0)} conversations, ${full(j.data.translated ?? 0)} translated${j.data.error ? ` - ${j.data.error}` : ""}.`);
    setTick((n) => n + 1);
  }, []);
  let wait: React.ReactNode = null;
  if (r === null) wait = <LoadingPanel label="Reading the translations…" />;
  else if (r.state === "error") wait = <UpstreamPanel source="APSO Translator" error={r.error} status={r.status} onRetry={refresh} />;
  else if (r.state !== "ok") wait = <UpstreamPanel source="APSO Translator" error="Not available" status={null} onRetry={refresh} />;
  const d = r?.state === "ok" ? r.data : null;
  return { d, wait, refresh, act, busy, note };
}

/** Live / Preview / Off and the last look, for a page's header. */
export function ModeBadge({ d }: { d: Data | null }) {
  if (!d) return null;
  const m = MODE[d.settings.mode];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Chip tint={m.tint}>{m.label}</Chip>
      {d.settings.mode !== "off" && d.last && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>last look {when(d.last.at)}</Typography>}
    </Box>
  );
}

/** A page of the app: the header (the reporting window top right, as on every report), then its cards. */
export function Frame({ title, subtitle, d, note, controls, children }: { title: string; subtitle: string; d: Data | null; note?: string | null; controls?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title={title} subtitle={subtitle} rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <ModeBadge d={d} />
          {controls}
        </Box>
      } />
      {note && <Info>{note}</Info>}
      {children}
    </Box>
  );
}
