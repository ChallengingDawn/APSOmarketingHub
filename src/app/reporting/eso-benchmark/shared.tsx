"use client";
// THE ESO DASHBOARD'S SHARED PARTS - one read of HubSpot (esoBenchmark.ts),
// one selection of sales reps that follows you from sub-app to sub-app, and
// the tables every section uses.
//
// SARCLA 12.10: the benchmark is sub-apps in the deck's order, Visits first;
// the rep filter takes several people at once; and it should be graphic.
// Every figure is a sum over the selected reps, so the selection is just an
// addition - except medians, which are taken again over the selected reps'
// raw durations.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";

import PageHeader from "@/app/PageHeader";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import type { EsoBenchmark, RepBenchmark } from "@/lib/reporting/esoBenchmark";
import { sturdyMedians, type Pair } from "@/lib/reporting/esoRules";

export type { EsoBenchmark, RepBenchmark, Pair };

/* ── numbers ───────────────────────────────────────────────────────────── */

export const n0 = (n: number) => Math.round(n).toLocaleString("en");
export const money = (n: number) => `€${n0(n)}`;
export const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `€${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `€${Math.round(n / 1e3).toLocaleString("en")}K`;
  return money(n);
};
export const pct = (x: number | null) => (x === null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
export const ratio = (a: number, b: number) => (b ? a / b : null);
export const change = (p: Pair) => (p.py ? (p.cy - p.py) / Math.abs(p.py) : null);
export const hours = (h: number | null) => (h === null || !Number.isFinite(h) ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);
export const days = (d: number | null) => (d === null || !Number.isFinite(d) ? "—" : `${d.toFixed(1)} d`);
export const sumPairs = (ps: Pair[]): Pair => ps.reduce((t, p) => ({ cy: t.cy + p.cy, py: t.py + p.py }), { cy: 0, py: 0 });
const PC: Record<string, string> = { dt: "DT · Seals", kt: "KT · Plastics", ft: "FT · Fluid", st: "ST · Silicone & rubber", at: "AT · Anti-vibration", unknown: "Not assigned", other: "Other" };
export const pcLabel = (k: string) => PC[k] ?? k.toUpperCase();
const TYPE: Record<string, string> = {
  "Original Equipment Manufacture (OEM)": "OEM", "Turning & Miling Workshop (C2S)": "C2S workshop", "Maintenance, Repair, Operations (MRO)": "MRO",
};
export const typeLabel = (k: string) => TYPE[k] ?? k;

/* ── the data, and the selection ───────────────────────────────────────── */

type State = { ok?: boolean; value?: EsoBenchmark; computing?: boolean; progress?: string; computedAt?: string; error?: string };

export function useEso(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-benchmark")
      .then((r) => r.json())
      .then((j: State) => { if (!alive) return; setState(j); if (j.computing) timer = setTimeout(load, 5000); })
      .catch((e) => { if (alive) setState({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return state;
}

const SELECTION_KEY = "eso.selection";

/** The selected reps, kept in this browser so every sub-app opens on the same people. Empty = all ESO. */
export function useSelection(): [string[], (ids: string[]) => void] {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    try { const raw = localStorage.getItem(SELECTION_KEY); if (raw) setSel(JSON.parse(raw)); } catch { /* a private window starts on all ESO */ }
  }, []);
  const set = (ids: string[]) => {
    setSel(ids);
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify(ids)); } catch { /* still applies on this page */ }
  };
  return [sel, set];
}

function addInto(t: unknown, s: unknown): unknown {
  if (typeof s === "number") return (typeof t === "number" ? t : 0) + s;
  if (s === null || s === undefined) return t ?? s;
  if (Array.isArray(s)) {
    const out = Array.isArray(t) ? t.slice() : [];
    s.forEach((v, i) => { out[i] = addInto(out[i], v); });
    return out;
  }
  if (typeof s === "object") {
    const out: Record<string, unknown> = t && typeof t === "object" ? { ...(t as Record<string, unknown>) } : {};
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) out[k] = addInto(out[k], v);
    return out;
  }
  return t ?? s;
}

/** The selected reps as one: their figures added, their medians taken again. */
export function combine(b: EsoBenchmark, ids: string[]): RepBenchmark {
  const picked = b.reps.filter((r) => ids.includes(r.ownerId));
  if (!picked.length) return b.team;
  if (picked.length === 1) return picked[0];
  const lists: RepBenchmark["lists"] = { firstReplyH: { cy: [], py: [] }, offerH: { cy: [], py: [] }, closeD: { cy: [], py: [] }, regDays: { cy: [], py: [] } };
  let acc: unknown = null;
  for (const r of picked) {
    const { lists: l, ...rest } = r;
    acc = addInto(acc, rest);
    for (const k of Object.keys(lists) as (keyof RepBenchmark["lists"])[]) { lists[k].cy.push(...l[k].cy); lists[k].py.push(...l[k].py); }
  }
  const out = acc as RepBenchmark;
  out.ownerId = "selection";
  out.name = picked.map((p) => p.name).join(", ");
  out.lists = lists;
  out.tickets.firstReplyH = sturdyMedians(lists.firstReplyH);
  out.tickets.offerH = sturdyMedians(lists.offerH);
  out.tickets.closeD = sturdyMedians(lists.closeD);
  out.registrations.daysToOrder = sturdyMedians(lists.regDays);
  return out;
}

/** Pick sales reps: several at once, or all of ESO. */
export function RepPicker({ b, sel, setSel }: { b: EsoBenchmark; sel: string[]; setSel: (ids: string[]) => void }) {
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const chip = (on: boolean) => ({
    display: "inline-flex", alignItems: "center", gap: 0.5, border: `1px solid ${on ? TINT.purple.fg : HAIRLINE}`,
    bgcolor: on ? TINT.purple.bg : "rgba(255,255,255,.75)", color: on ? TINT.purple.fg : INK, borderRadius: "999px",
    px: 1.25, py: 0.5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 500,
    transition: "background-color .15s ease",
  });
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Sales reps {sel.length ? `· ${sel.length} selected` : "· all of ESO"}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        <Box component="button" onClick={() => setSel([])} sx={chip(!sel.length)}>{!sel.length && <CheckIcon sx={{ fontSize: 14 }} />}All ESO</Box>
        {b.reps.map((r) => {
          const on = sel.includes(r.ownerId);
          return <Box key={r.ownerId} component="button" onClick={() => toggle(r.ownerId)} aria-pressed={on} sx={chip(on)}>{on && <CheckIcon sx={{ fontSize: 14 }} />}{r.name}</Box>;
        })}
      </Box>
    </Box>
  );
}

/**
 * Every ESO sub-app: its title, the period, the rep picker, and - once the
 * read is in - the section, drawn for the selected reps.
 */
export function EsoPage({ title, line, children }: {
  title: string; line: string;
  children: (ctx: { rep: RepBenchmark; b: EsoBenchmark; reps: RepBenchmark[]; sel: string[]; span: string; last: string }) => React.ReactNode;
}) {
  const state = useEso();
  const [sel, setSel] = useSelection();
  const b = state?.value;
  const rep = useMemo(() => (b ? combine(b, sel) : undefined), [b, sel]);
  const reps = useMemo(() => (b ? (sel.length ? b.reps.filter((r) => sel.includes(r.ownerId)) : b.reps) : []), [b, sel]);
  const last = b ? b.monthLabels[b.revenueMonths - 1] : "";
  const span = b ? `Jan–${last} ${b.window.year} against Jan–${last} ${b.window.py}` : "";
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1400 }}>
      <PageHeader title={title} subtitle={b ? `ESO benchmark · ${span} · ${line}` : `ESO benchmark · ${line}`} />
      {!b && (
        <GlassCard>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {!state?.error && <CircularProgress size={18} />}
            <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>
              {state?.error ? `The benchmark could not be read: ${state.error}` : `Reading HubSpot - a few minutes the first time${state?.progress ? ` · ${state.progress}` : ""}.`}
            </Typography>
          </Box>
        </GlassCard>
      )}
      {b && rep && (
        <>
          <GlassCard sx={{ py: { xs: 1.5, md: 1.75 } }}><RepPicker b={b} sel={sel} setSel={setSel} /></GlassCard>
          {state?.computing && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Refreshing in the background - showing the last finished read.</Typography>}
          {children({ rep, b, reps, sel, span, last })}
          <Typography sx={{ fontSize: "0.75rem", color: FAINT }}>
            Read {new Date(state?.computedAt ?? b.generatedAt).toLocaleString("en-GB")} · refreshed every 12 hours · customers under their current owner in both years.
          </Typography>
        </>
      )}
    </Box>
  );
}

/* ── tables ────────────────────────────────────────────────────────────── */

/** Change from last year in words and arrow; colour only agrees. Points for rates; "—" on a base too small to compare. */
export function Delta({ p, goodWhenUp = true, points = false, minBase = 0 }: { p: Pair; goodWhenUp?: boolean; points?: boolean; minBase?: number }) {
  if (!Number.isFinite(p.cy) || !Number.isFinite(p.py) || Math.abs(p.py) < minBase || (!points && !p.py)) {
    return <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>—</Typography>;
  }
  const d = points ? p.cy - p.py : (p.cy - p.py) / Math.abs(p.py);
  const flat = points ? Math.abs(d) < 0.05 : Math.abs(d) < 0.0005;
  const good = goodWhenUp ? d > 0 : d < 0;
  return (
    <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, color: flat ? MUTED : good ? GREEN : RED, whiteSpace: "nowrap" }}>
      {flat ? "level" : points ? `${d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)} pts` : `${d > 0 ? "↑" : "↓"} ${Math.abs(d * 100).toFixed(1)}%`}
    </Typography>
  );
}

export const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
export const numHead = { ...headCell, textAlign: "right" as const };

export type PairRow = { label: string; p: Pair; fmt?: (n: number) => string; goodWhenUp?: boolean; note?: string; points?: boolean; noChange?: boolean };

/** Rows of "this year | last year | change". */
export function PairTable({ head, rows, minBase = 0 }: { head: string; minBase?: number; rows: PairRow[] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell sx={headCell}>{head}</TableCell>
          <TableCell sx={numHead}>This year</TableCell>
          <TableCell sx={numHead}>Last year</TableCell>
          <TableCell sx={numHead}>Change</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell sx={bodyCell}>
                <Typography sx={{ fontSize: "0.85rem", color: INK }}>{r.label}</Typography>
                {r.note && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{r.note}</Typography>}
              </TableCell>
              <TableCell sx={num}>{(r.fmt ?? n0)(r.p.cy)}</TableCell>
              <TableCell sx={{ ...num, color: MUTED }}>{(r.fmt ?? n0)(r.p.py)}</TableCell>
              <TableCell sx={num}><Delta p={r.p} goodWhenUp={r.goodWhenUp} points={r.points} minBase={r.noChange ? Infinity : r.fmt ? 0 : minBase} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** A breakdown kept as {key: Pair}, largest first; the long tail folds into one line. */
export function Breakdown({ head, rec, label = (k: string) => k, fmt, top = 8, minBase = 20 }: {
  head: string; rec: Record<string, Pair>; label?: (k: string) => string; fmt?: (n: number) => string; top?: number; minBase?: number;
}) {
  const all = Object.entries(rec).sort((a, b) => b[1].cy - a[1].cy || b[1].py - a[1].py);
  if (!all.length) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>{head}: none in either window.</Typography>;
  const rest = all.slice(top);
  const rows: PairRow[] = all.slice(0, top).map(([k, p]) => ({ label: label(k), p, fmt }));
  if (rest.length) rows.push({ label: `${rest.length} more`, p: sumPairs(rest.map(([, p]) => p)), fmt });
  return <PairTable head={head} rows={rows} minBase={minBase} />;
}

export const grid = (min: number) => ({ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: `repeat(auto-fit, minmax(${min}px, 1fr))` } });

export { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT, headCell, bodyCell };

/** What the data cannot answer, for this sub-app only - named, not guessed. */
export function Gaps({ b, match }: { b: EsoBenchmark; match: RegExp }) {
  const mine = b.gaps.filter((g) => match.test(g));
  if (!mine.length) return null;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5 }}>
      {mine.map((g) => <Typography component="li" key={g} sx={{ fontSize: "0.8rem", color: MUTED }}>{g}</Typography>)}
    </Box>
  );
}

/** One rep's figure beside the others', biggest first - the benchmark in one glance. */
export function perRep(reps: RepBenchmark[], value: (r: RepBenchmark) => number, secondary?: (r: RepBenchmark) => string) {
  return reps
    .map((r) => ({ label: r.name, value: value(r), secondary: secondary?.(r) }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}
