"use client";
// MARKETING KPIS - the shared parts of the nutshell and the stage pages: the
// data (monthly inputs + the hub's live read), a KPI's year so far against
// last year or its target, a card, a monthly chart, and the "not connected
// yet" list that keeps every catalogue KPI visible, measured or not.

import type { AssistantWindows } from "@/lib/aeo/model";
import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { ChartFrame } from "@/app/charts/ChartFrame";
import type { SlowState } from "@/lib/integrations/slowReport";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import HubIconGlyph from "@/app/HubIcon";
import { Badge, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { STAGE_ICON } from "@/lib/reporting/categories";
import { JOURNEY, KPIS, STAGES, type CatalogueKpi } from "@/lib/marketingKpis/catalogue";
import { MEASURES, derive, fmtValue, total, type Measure, type Series } from "@/lib/marketingKpis/measures";
import type { Inputs } from "@/lib/marketingKpis/seed";
import type { LiveKpis } from "@/lib/marketingKpis/live";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Live = { value?: LiveKpis; computing?: boolean; progress?: string; computedAt?: string; error?: string };
export type MkState = { ok?: boolean; inputs?: Inputs; live?: Live; canEdit?: boolean; error?: string; aeoAssistants?: AssistantWindows | null };

/**
 * JSON from one of the hub's own routes. During a deployment the load balancer
 * answers a request that reaches a stopping task with its own HTML page (13.10:
 * "Unexpected token '<'"): that is a moment, not an answer, so it is retried.
 */
export async function hubJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { throw new Error(`the hub answered ${r.status} without data - it may be restarting`); }
}
/** Asks again every 5 s while the hub is busy or restarting; says so only after 2 minutes of failing. */
export const RETRY_MS = 5000, RETRIES = 24;

/** How often an open page asks again - a new ERP delivery or a new read shows without a reload (SARCLA 17.10). */
export const REFRESH_MS = 10 * 60 * 1000;
/**
 * Calls `fn` every REFRESH_MS while the page is in view, and at once when it
 * comes back into view (another tab, a laptop woken up). Returns the stop.
 */
export function everyWhileSeen(fn: () => void): () => void {
  const seen = () => document.visibilityState === "visible";
  const t = setInterval(() => { if (seen()) fn(); }, REFRESH_MS);
  const back = () => { if (seen()) fn(); };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("focus", back);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
}

/**
 * A background read the hub keeps (slowReport): asked until it is done, and asked
 * again through a deployment's error page. The page shows what it has meanwhile,
 * so a slow read never holds the rest of the page back.
 */
export function useSlow<T>(url: string, field: string): { value: T | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<T>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (tries = 0) => hubJson<Record<string, unknown>>(url)
      .then((j) => {
        if (!alive) return;
        const state = j?.[field] as SlowState<T> | undefined;
        setSt({ state, error: typeof j?.error === "string" ? j.error : undefined });
        timer = state?.computing ? setTimeout(() => { timer = undefined; load(); }, RETRY_MS) : undefined;
      })
      .catch((e) => {
        if (!alive) return;
        if (tries < RETRIES) { timer = setTimeout(() => load(tries + 1), RETRY_MS); return; }
        setSt((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) }));
      });
    load();
    // and again while the page stays open, so it moves on by itself
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, [url, field]);
  return { value: st?.state?.value ?? null, computing: !!st?.state?.computing || st === null, progress: st?.state?.progress, error: st?.error ?? st?.state?.error };
}

export function useMarketingKpis(): [MkState | null, () => void] {
  const [state, setState] = useState<MkState | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (tries = 0) => hubJson<MkState>("/api/reporting/marketing-kpis")
      .then((j) => { if (!alive) return; setState(j); timer = j.live?.computing ? setTimeout(() => { timer = undefined; load(); }, RETRY_MS) : undefined; })
      .catch((e) => {
        if (!alive) return;
        if (tries < RETRIES) { timer = setTimeout(() => load(tries + 1), RETRY_MS); return; }
        setState((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) }));
      });
    load();
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, [tick]);
  return [state, () => setTick((t) => t + 1)];
}

export type KpiView = {
  id: string;
  measure: Measure;
  series: Series;
  /** months the year so far covers - typed months for the sheet, completed months for live */
  upTo: number;
  ytd: number | null;
  pyYtd: number | null;
  pyNote?: string;
  target: number | null;
  /** the running month, live only - drawn, never added to the year so far */
  partial: number | null;
  /** this year over the same months as `pyYtd`, when last year covers fewer months (like for like) */
  sameYtd?: number | null;
  /** a live KPI shown from its typed months because its source did not answer */
  fellBack?: boolean;
};

/** Every measured KPI for one year, from the inputs and the live read. */
export function buildViews(inputs: Inputs, live: LiveKpis | undefined, year: number): Record<string, KpiView> {
  const key = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;
  const typed = (id: string): Series => ({
    months: MONTHS.map((_, i) => inputs.months[id]?.[key(year, i)] ?? null),
    py: MONTHS.map((_, i) => inputs.months[id]?.[key(year - 1, i)] ?? null),
  });
  const cache: Record<string, Series> = {};
  // a live KPI whose source did not answer (Search Console's borrowed login lapses every 7 days)
  // falls back to its typed months, when there are any, rather than to nothing
  const fellBack = new Set<string>();
  const get = (id: string): Series => {
    if (cache[id]) return cache[id];
    const m = MEASURES[id];
    const liveS = m?.origin === "live" ? live?.series[id] : undefined;
    const liveHas = !!liveS?.months.some((v) => v != null);
    if (m?.origin === "live" && !liveHas && inputs.months[id]) fellBack.add(id);
    const s = !m ? { months: Array(12).fill(null), py: Array(12).fill(null) }
      : m.origin === "live" ? (liveHas ? liveS! : inputs.months[id] ? typed(id) : (liveS ?? { months: Array(12).fill(null), py: Array(12).fill(null) }))
        : m.derived ? derive(id, get) : typed(id);
    return (cache[id] = s);
  };
  const out: Record<string, KpiView> = {};
  for (const m of Object.values(MEASURES)) {
    const s = get(m.id);
    const lastTyped = s.months.reduce<number>((n, v, i) => (v != null ? i + 1 : n), 0);
    const upTo = m.origin === "live" && !fellBack.has(m.id) ? (live?.monthsDone ?? 0) : lastTyped;
    const target = inputs.targets[m.id]?.[String(year)] ?? null;
    if (m.agg.kind === "ytd") {
      const y = live?.ytd[m.id];
      out[m.id] = { id: m.id, measure: m, series: s, upTo, ytd: y?.cy ?? null, pyYtd: y?.py ?? null, pyNote: y?.pyNote, target, partial: null };
      continue;
    }
    // like for like: only the months both years have (Search Console keeps 16 months)
    const both = m.likeForLike ? s.months.map((v, i) => i < upTo && v != null && s.py[i] != null) : undefined;
    const ytd = total(m.id, s, "months", get, upTo);
    let pyYtd = both ? (both.some(Boolean) ? total(m.id, s, "py", get, upTo, both) : null) : total(m.id, s, "py", get, upTo);
    let pyNote: string | undefined;
    if (both && pyYtd != null && both.slice(0, upTo).some((x) => !x)) {
      const on = both.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
      const ytdSame = total(m.id, s, "months", get, upTo, both);
      // the change is measured on the same months; the note says which
      pyNote = `same months ${MONTHS[on[0]]}–${MONTHS[on[on.length - 1]]}`;
      out[m.id] = {
        id: m.id, measure: m, series: s, upTo, ytd, pyYtd, pyNote, target, sameYtd: ytdSame,
        partial: m.origin === "live" && live && !fellBack.has(m.id) ? live.monthsDone : null, fellBack: fellBack.has(m.id),
      };
      continue;
    }
    // A count whose last year is a fraction of this year measures the source
    // filling up (the ESO and TSA pipelines took forms and chat from mid-2025),
    // not marketing: no percentage on it.
    if (m.origin === "live" && m.agg.kind === "sum" && ytd != null && pyYtd != null && pyYtd < 0.3 * ytd) { pyYtd = null; pyNote = "too thin to compare"; }
    out[m.id] = {
      id: m.id, measure: m, series: s, upTo, ytd, pyYtd, pyNote, target,
      partial: m.origin === "live" && live && !fellBack.has(m.id) ? live.monthsDone : null, fellBack: fellBack.has(m.id),
    };
  }
  return out;
}

/** SARCLA's note on a Journey row ("GEO", "Churn rate - learn from Erosion"). */
export const journeyNote = (id: string) => JOURNEY.find((j) => j.id === id)?.note ?? "";
/** Who KPIs are tagged for in the workbook - "Sales leader, Rose". */
export const LEADER = KPIS.find((k) => k.audience)?.audience ?? "";
/**
 * Journey rows that are new KPIs under an id the catalogue uses for something
 * else: SARCLA added "Average cart value" as K01, the catalogue's K01 being
 * "Add-to-cart rate". Shown in their stage as not connected, beside the catalogue's.
 */
const JOURNEY_ADDITIONS: Record<string, string> = { K01: "6" };
export const journeyAdditionsIn = (stage: string): CatalogueKpi[] =>
  Object.entries(JOURNEY_ADDITIONS).filter(([id, st]) => st === stage && !MEASURES[id]).map(([id]) => {
    const j = JOURNEY.find((r) => r.id === id);
    return { id, stage, name: j?.name ?? id, question: "", definition: "", unit: j?.unit ?? "", breakdowns: "", source: j?.source || "To decide",
      inSheet: "No", inHub: "No", where: "Added on the Journey tab", target: "", priority: "", audience: "", audienceAsk: "" };
  });

/** A KPI's name as SARCLA wrote it on the Journey tab, else the catalogue's. */
export const nameOf = (id: string) => JOURNEY.find((j) => j.id === id)?.name ?? KPIS.find((k) => k.id === id)?.name ?? MEASURES[id]?.label ?? id;
/**
 * The customers stage's KPIs measured by the company drill-down (Customers.tsx)
 * rather than as a monthly series: counts, revenue and share of wallet by
 * priority, segment, type, country, mandant and potential.
 */
export const CUSTOMER_CUBE_KPIS: ReadonlySet<string> = new Set(["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]);
export const isMeasured = (id: string) => (!!MEASURES[id] && !MEASURES[id].notCatalogue) || CUSTOMER_CUBE_KPIS.has(id);
const measures = (k: CatalogueKpi) => isMeasured(k.id);

/** Each stage's glyph (the side panel's) and badge tint. */
const STAGE_TINT: Record<string, Tint> = {
  customers: "purple", reach: "blue", visit: "blue", engage: "green", lead: "amber",
  handover: "amber", cart: "pink", purchase: "green", retain: "purple", efficiency: "slate",
};
export const stageTint = (slug: string): Tint => STAGE_TINT[slug] ?? "blue";
export const StageGlyph = ({ slug, size = 20 }: { slug: string; size?: number }) => <HubIconGlyph name={STAGE_ICON[slug] ?? "bar"} fontSize={size} />;
export const measuredIn = (stage: string) => KPIS.filter((k) => k.stage === stage && measures(k));
export const notConnectedIn = (stage: string) => KPIS.filter((k) => k.stage === stage && !measures(k));
/** Journey KPIs measured under an id the catalogue uses for something else (L02 "Leads to sales"). */
export const journeyExtrasIn = (stage: string) =>
  Object.values(MEASURES).filter((m) => m.notCatalogue && (m.extraIn === stage || KPIS.find((k) => k.id === m.id)?.stage === stage)).map((m) => m.id);
export const stageHref = (slug: string) => `/reporting/marketing-kpis/${slug}`;

/**
 * A stage's measured KPIs (with the journey's extras) and the ones not connected - a live
 * KPI whose source is not open to the hub yet (R11 until HubSpot lets the hub read marketing
 * email) counts as not connected, with what it waits for, rather than as an empty card.
 */
export function stageKpis(stage: string, live?: LiveKpis): { ids: string[]; missing: CatalogueKpi[] } {
  const waiting = live?.waiting ?? {};
  const ids = [...measuredIn(stage).map((k) => k.id), ...journeyExtrasIn(stage), ...(stage === "7" ? ["X01"] : [])].filter((id) => !waiting[id]);
  const held = measuredIn(stage).filter((k) => waiting[k.id]).map((k) => ({ ...k, inHub: "Not yet", where: waiting[k.id] }));
  return { ids, missing: [...held, ...notConnectedIn(stage), ...journeyAdditionsIn(stage)] };
}

/** "↑ 12.3% vs last year", "86% of target" - the direction in words; colour only agrees. */
export function Compare({ v, size = "0.78rem" }: { v: KpiView; size?: string }) {
  const good = v.measure.goodWhenUp !== false;
  if (v.target != null && v.ytd != null) {
    const r = v.ytd / v.target;
    // A year target for something that adds up (revenue, leads) is measured
    // against the share of the year gone: 86% after nine months is ahead.
    if (v.measure.agg.kind === "sum" && v.upTo > 0 && v.upTo < 12) {
      const pace = v.upTo / 12;
      const ok = good ? r >= pace : r <= pace;
      return <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: ok ? GREEN : RED }}>{(r * 100).toFixed(0)}% of the year&apos;s target {fmtValue(v.measure.fmt, v.target)} · {ok === good ? "ahead of" : "behind"} pace ({(pace * 100).toFixed(0)}% of the year gone)</Typography>;
    }
    const ok = good ? r >= 1 : r <= 1;
    return <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: ok ? GREEN : RED }}>{(r * 100).toFixed(0)}% of target {fmtValue(v.measure.fmt, v.target)}</Typography>;
  }
  // A year so far against a whole year is context, not a change.
  if (v.pyYtd != null && v.pyNote?.includes("whole year")) {
    return <Typography component="span" sx={{ fontSize: size, color: MUTED }}>{v.pyNote}: {fmtValue(v.measure.fmt, v.pyYtd)}</Typography>;
  }
  if (v.pyYtd != null && v.ytd != null && v.pyYtd !== 0) {
    // last year shorter than this year (Search Console keeps 16 months): both on the same months
    const same = v.sameYtd != null && v.pyNote?.startsWith("same months");
    const cur = same ? v.sameYtd! : v.ytd;
    const versus = same ? `last year, ${v.pyNote}` : v.pyNote ?? "last year";
    if (v.measure.fmt === "pct") {
      const d = (cur - v.pyYtd) * 100;
      return <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: Math.abs(d) < 0.05 ? MUTED : (d > 0) === good ? GREEN : RED }}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(1)} pts vs {versus}</Typography>;
    }
    if (v.measure.fmt === "dec1" || v.measure.fmt === "dec2") {
      const d = cur - v.pyYtd;
      return <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: Math.abs(d) < 0.05 ? MUTED : (d > 0) === good ? GREEN : RED }}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(1)} vs {versus} ({fmtValue(v.measure.fmt, v.pyYtd)})</Typography>;
    }
    const c = (cur - v.pyYtd) / Math.abs(v.pyYtd);
    return (
      <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: Math.abs(c) < 0.0005 ? MUTED : (c > 0) === good ? GREEN : RED }}>
        {c > 0 ? "↑" : "↓"} {Math.abs(c * 100).toFixed(1)}% vs {versus}
      </Typography>
    );
  }
  return <Typography component="span" sx={{ fontSize: size, color: FAINT }}>{v.measure.origin === "sheet" ? "no last year in the sheet" : v.pyNote === "too thin to compare" ? "last year too thin to compare - the source started mid-2025" : "no comparison"}</Typography>;
}

/** Twelve months as small bars - the shape of the year at a glance. */
export function Spark({ v, height = 28 }: { v: KpiView; height?: number }) {
  const vals = v.series.months;
  const max = Math.max(0, ...vals.map((x) => x ?? 0));
  if (!max) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height }} aria-hidden>
      {vals.map((x, i) => (
        <Box key={i} sx={{
          flex: 1, borderRadius: "2px 2px 0 0", minHeight: x ? 2 : 0,
          height: x ? `${Math.max(6, (x / max) * 100)}%` : 0,
          bgcolor: v.partial === i ? "rgba(45,111,168,.35)" : "#2d6fa8", opacity: x == null ? 0 : 1,
        }} />
      ))}
    </Box>
  );
}

/**
 * How far a KPI's figure reaches (SARCLA 13.10: every KPI says how up to date it
 * is): the last day of its last month - typed or read - or, for a count of the
 * year so far, the day the hub read it.
 */
export function upToOf(v: KpiView, state: MkState | null, year: number): string {
  const read = state?.live?.computedAt ?? state?.live?.value?.generatedAt;
  const day = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (v.measure.agg.kind === "ytd") return read ? `Up to ${day(new Date(read))} · read by the hub` : "";
  if (!v.upTo) return "No month in yet";
  if (v.fellBack) return `Up to ${day(new Date(Date.UTC(year, v.upTo, 0)))} · monthly input - ${v.measure.liveSource ?? "the live source"} not connected`;
  return `Up to ${day(new Date(Date.UTC(year, v.upTo, 0)))} · ${v.measure.origin === "live" ? `read ${read ? day(new Date(read)) : ""}` : "monthly input"}`;
}

export const periodOf = (v: KpiView) => (v.measure.agg.kind === "ytd" ? "this year so far" : v.upTo ? `Jan–${MONTHS[v.upTo - 1]}` : "no months yet");

/** A measured KPI: its year so far, against last year or its target, and the months. */
export function KpiCard({ v, kpi, icon, tint = "blue", upTo }: { v: KpiView; kpi?: CatalogueKpi; icon?: React.ReactNode; tint?: Tint; upTo?: string }) {
  const L = MONTHS;
  const hasMonths = v.series.months.some((x) => x != null);
  const hasPy = v.series.py.some((x) => x != null);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        {icon && <Badge icon={icon} tint={tint} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600 }}>{v.id} · {v.measure.origin === "live" ? "live in the hub" : "monthly input"}</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{nameOf(v.id)}</Typography>
          <Chips note={journeyNote(v.id)} audience={kpi?.audience} />
          {kpi?.question && !v.measure.notCatalogue && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{kpi.question}</Typography>}
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{periodOf(v)}</Typography>
          {upTo && <Typography sx={{ fontSize: "0.7rem", color: FAINT, fontWeight: 600 }}>{upTo}</Typography>}
        </Box>
      </Box>
      <Compare v={v} />
      {hasMonths && v.measure.agg.kind !== "ytd" && (
        <ChartFrame table={{ columns: ["Month", "This year", "Last year"], rows: L.map((x, i) => [x, v.series.months[i] ?? "", v.series.py[i] ?? ""]), numeric: [1, 2] }}>
          <GroupedColumns height={180} format={(x) => fmtValue(v.measure.fmt, x)}
            data={L.map((x, i) => ({ x, current: v.series.months[i], prior: hasPy ? v.series.py[i] : null, partial: v.partial === i }))}
            currentLabel="This year" priorLabel="Last year" />
        </ChartFrame>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        {kpi?.audienceAsk ? `${kpi.audienceAsk} · ` : ""}{v.measure.notCatalogue ? "" : v.measure.definition ?? kpi?.definition ?? ""}{v.measure.note ? `${v.measure.notCatalogue ? "" : " · "}${v.measure.note}` : ""}{v.partial != null && v.measure.agg.kind !== "ytd" ? ` · ${MONTHS[v.partial]} is still running and not in the year so far` : ""}
      </Typography>
    </GlassCard>
  );
}

/** SARCLA's note on the KPI and who it is for, as small tags. */
export function Chips({ note, audience }: { note?: string; audience?: string }) {
  if (!note && !audience) return null;
  const chip = (text: string, tone: { bg: string; fg: string }) => (
    <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, px: 0.9, py: 0.2, borderRadius: "999px", bgcolor: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>{text}</Box>
  );
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.4 }}>
      {note && chip(note, TINT.blue)}
      {audience && chip(`For ${audience}`, TINT.purple)}
    </Box>
  );
}

/** Every catalogue KPI of a stage the hub does not measure yet - named, with what it waits for. */
export function NotConnected({ list }: { list: CatalogueKpi[] }) {
  if (!list.length) return null;
  const tint = (p: string) => (p === "Must" ? TINT.pink : p === "Should" ? TINT.amber : TINT.slate);
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}>Not connected yet</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>From the KPI catalogue - what each needs before the hub can show it.</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {["ID", "KPI", "Question", "Source", "In the hub today / what is missing", "Priority"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {list.map((k) => (
              <TableRow key={`${k.id}-${k.name}`}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: FAINT }}>{k.id}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK, minWidth: 160 }}>{k.name}<Chips note={journeyNote(k.id) && JOURNEY.find((j) => j.id === k.id)?.name === k.name ? journeyNote(k.id) : ""} audience={k.audience} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, minWidth: 200 }}>{k.question}{k.audienceAsk ? <><br /><i>{k.audienceAsk}</i></> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, minWidth: 160 }}>{k.source}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, minWidth: 200 }}>{k.inHub}{k.where ? ` - ${k.where}` : ""}</TableCell>
                <TableCell sx={bodyCell}>
                  <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, px: 1, py: 0.25, borderRadius: "999px", bgcolor: tint(k.priority).bg, color: tint(k.priority).fg }}>{k.priority}</Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

export function LiveNote({ state }: { state: MkState }) {
  const live = state.live;
  const errs = Object.entries(live?.value?.errors ?? {});
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {live?.computing && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Reading HubSpot, GA4 and Search Console{live.progress ? ` · ${live.progress}` : ""} - live figures appear when it is done.</Typography>}
      {errs.map(([k, e]) => <Typography key={k} sx={{ fontSize: "0.78rem", color: RED }}>Live source "{k}" could not be read: {e}</Typography>)}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Monthly inputs {state.inputs?.updatedAt ? `last saved ${new Date(state.inputs.updatedAt).toLocaleString("en-GB")} by ${state.inputs.updatedBy}` : "as in SARCLA's Dashboard 2026 sheet"}
        {live?.value ? ` · live figures read ${new Date(live.computedAt ?? live.value.generatedAt).toLocaleString("en-GB")}, every 6 hours` : ""}
        {" · "}<Link href="/reporting/marketing-kpis/inputs" style={{ color: MUTED }}>Monthly inputs</Link>
      </Typography>
    </Box>
  );
}

export { STAGES, KPIS, HAIRLINE };

/**
 * A KPI's twelve months as a real chart, small enough for the macro page: this
 * year's bars over last year's (grey, behind), the running month faded, month
 * initials under, the exact value on hover.
 */
export function MiniBars({ v, height = 92 }: { v: KpiView; height?: number }) {
  const cy = v.series.months, py = v.series.py;
  const max = Math.max(0, ...cy.map((x) => x ?? 0), ...py.map((x) => x ?? 0));
  if (!max) return null;
  const h = (x: number | null) => (x == null ? 0 : Math.max(3, (x / max) * 100));
  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px", alignItems: "end", height }} role="img"
        aria-label={`${nameOf(v.id)} by month: ${cy.map((x, i) => (x == null ? null : `${MONTHS[i]} ${fmtValue(v.measure.fmt, x)}`)).filter(Boolean).join(", ")}`}>
        {MONTHS.map((m, i) => (
          <Box key={m} title={`${m}: ${fmtValue(v.measure.fmt, cy[i])}${py[i] != null ? ` · last year ${fmtValue(v.measure.fmt, py[i])}` : ""}`}
            sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {py[i] != null && <Box sx={{ position: "absolute", bottom: 0, left: "8%", right: "8%", height: `${h(py[i])}%`, bgcolor: "#dfe3ea", borderRadius: "3px 3px 0 0" }} />}
            {cy[i] != null && <Box sx={{ position: "relative", width: "62%", height: `${h(cy[i])}%`, bgcolor: v.partial === i ? "rgba(45,111,168,.4)" : "#2d6fa8", borderRadius: "3px 3px 0 0" }} />}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px", mt: 0.4 }}>
        {MONTHS.map((m) => <Typography key={m} sx={{ fontSize: "0.62rem", color: FAINT, textAlign: "center" }}>{m[0]}</Typography>)}
      </Box>
    </Box>
  );
}
