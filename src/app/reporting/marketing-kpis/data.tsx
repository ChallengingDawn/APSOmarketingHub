"use client";
// MARKETING KPIS - the shared parts of the nutshell and the stage pages: the
// data (monthly inputs + the hub's live read), a KPI's year so far against
// last year or its target, a card, a monthly chart, and the "not connected
// yet" list that keeps every catalogue KPI visible, measured or not.

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
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { JOURNEY, KPIS, STAGES, type CatalogueKpi } from "@/lib/marketingKpis/catalogue";
import { MEASURES, derive, fmtValue, total, type Measure, type Series } from "@/lib/marketingKpis/measures";
import type { Inputs } from "@/lib/marketingKpis/seed";
import type { LiveKpis } from "@/lib/marketingKpis/live";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Live = { value?: LiveKpis; computing?: boolean; progress?: string; computedAt?: string; error?: string };
export type MkState = { ok?: boolean; inputs?: Inputs; live?: Live; canEdit?: boolean; error?: string };

export function useMarketingKpis(): [MkState | null, () => void] {
  const [state, setState] = useState<MkState | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/marketing-kpis").then((r) => r.json())
      .then((j: MkState) => { if (!alive) return; setState(j); if (j.live?.computing) timer = setTimeout(load, 5000); })
      .catch((e) => { if (alive) setState({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
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
};

/** Every measured KPI for one year, from the inputs and the live read. */
export function buildViews(inputs: Inputs, live: LiveKpis | undefined, year: number): Record<string, KpiView> {
  const key = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;
  const typed = (id: string): Series => ({
    months: MONTHS.map((_, i) => inputs.months[id]?.[key(year, i)] ?? null),
    py: MONTHS.map((_, i) => inputs.months[id]?.[key(year - 1, i)] ?? null),
  });
  const cache: Record<string, Series> = {};
  const get = (id: string): Series => {
    if (cache[id]) return cache[id];
    const m = MEASURES[id];
    const s = !m ? { months: Array(12).fill(null), py: Array(12).fill(null) }
      : m.origin === "live" ? (live?.series[id] ?? { months: Array(12).fill(null), py: Array(12).fill(null) })
        : m.derived ? derive(id, get) : typed(id);
    return (cache[id] = s);
  };
  const out: Record<string, KpiView> = {};
  for (const m of Object.values(MEASURES)) {
    const s = get(m.id);
    const lastTyped = s.months.reduce<number>((n, v, i) => (v != null ? i + 1 : n), 0);
    const upTo = m.origin === "live" ? (live?.monthsDone ?? 0) : lastTyped;
    const target = inputs.targets[m.id]?.[String(year)] ?? null;
    if (m.agg.kind === "ytd") {
      const y = live?.ytd[m.id];
      out[m.id] = { id: m.id, measure: m, series: s, upTo, ytd: y?.cy ?? null, pyYtd: y?.py ?? null, pyNote: y?.pyNote, target, partial: null };
      continue;
    }
    const ytd = total(m.id, s, "months", get, upTo);
    let pyYtd = total(m.id, s, "py", get, upTo);
    let pyNote: string | undefined;
    // A count whose last year is a fraction of this year measures the source
    // filling up (the ESO and TSA pipelines took forms and chat from mid-2025),
    // not marketing: no percentage on it.
    if (m.origin === "live" && m.agg.kind === "sum" && ytd != null && pyYtd != null && pyYtd < 0.3 * ytd) { pyYtd = null; pyNote = "too thin to compare"; }
    out[m.id] = {
      id: m.id, measure: m, series: s, upTo, ytd, pyYtd, pyNote, target,
      partial: m.origin === "live" && live ? live.monthsDone : null,
    };
  }
  return out;
}

/** A KPI's name as SARCLA wrote it on the Journey tab, else the catalogue's. */
export const nameOf = (id: string) => JOURNEY.find((j) => j.id === id)?.name ?? KPIS.find((k) => k.id === id)?.name ?? MEASURES[id]?.label ?? id;
const measures = (k: CatalogueKpi) => !!MEASURES[k.id] && !MEASURES[k.id].notCatalogue;
export const measuredIn = (stage: string) => KPIS.filter((k) => k.stage === stage && measures(k));
export const notConnectedIn = (stage: string) => KPIS.filter((k) => k.stage === stage && !measures(k));
/** Journey KPIs measured under an id the catalogue uses for something else (L02 "Leads to sales"). */
export const journeyExtrasIn = (stage: string) =>
  Object.values(MEASURES).filter((m) => m.notCatalogue && KPIS.find((k) => k.id === m.id)?.stage === stage).map((m) => m.id);
export const stageHref = (slug: string) => `/reporting/marketing-kpis/${slug}`;

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
    if (v.measure.fmt === "pct") {
      const d = (v.ytd - v.pyYtd) * 100;
      return <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: Math.abs(d) < 0.05 ? MUTED : (d > 0) === good ? GREEN : RED }}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(1)} pts vs last year</Typography>;
    }
    const c = (v.ytd - v.pyYtd) / Math.abs(v.pyYtd);
    return (
      <Typography component="span" sx={{ fontSize: size, fontWeight: 700, color: Math.abs(c) < 0.0005 ? MUTED : (c > 0) === good ? GREEN : RED }}>
        {c > 0 ? "↑" : "↓"} {Math.abs(c * 100).toFixed(1)}% vs {v.pyNote ?? "last year"}
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

export const periodOf = (v: KpiView) => (v.measure.agg.kind === "ytd" ? "this year so far" : v.upTo ? `Jan–${MONTHS[v.upTo - 1]}` : "no months yet");

/** A measured KPI: its year so far, against last year or its target, and the months. */
export function KpiCard({ v, kpi }: { v: KpiView; kpi?: CatalogueKpi }) {
  const L = MONTHS;
  const hasMonths = v.series.months.some((x) => x != null);
  const hasPy = v.series.py.some((x) => x != null);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600 }}>{v.id} · {v.measure.origin === "live" ? "live in the hub" : "monthly input"}</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{nameOf(v.id)}</Typography>
          {kpi?.question && !v.measure.notCatalogue && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{kpi.question}</Typography>}
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{periodOf(v)}</Typography>
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
        {v.measure.notCatalogue ? "" : kpi?.definition ?? ""}{v.measure.note ? `${v.measure.notCatalogue ? "" : " · "}${v.measure.note}` : ""}{v.partial != null && v.measure.agg.kind !== "ytd" ? ` · ${MONTHS[v.partial]} is still running and not in the year so far` : ""}
      </Typography>
    </GlassCard>
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
              <TableRow key={k.id}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: FAINT }}>{k.id}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK, minWidth: 160 }}>{k.name}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, minWidth: 200 }}>{k.question}</TableCell>
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
