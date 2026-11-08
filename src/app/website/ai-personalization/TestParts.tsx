"use client";

// APSOconvert's test pieces, shared by Page tests (Website > A/B testing), Personalise and Ship: the chips, the honest
// "not connected" line, the confirm that says what goes live where, the interval bars, the P(best) gauge, the day by
// day chart, the audience builder and the page picker. UC design kit; filters are squared (SquareChoice).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ACCENT, FAINT, GREEN, HAIRLINE, INK, MUTED, Notice, RED, TRACK } from "@/app/uc/report/ui";
import { CHROME, FONT } from "@/app/charts/palette";
import { STATUS_LABEL, STATUS_TINT, normAllocation, type Allocation, type Audience, type Host, type TestKind, type TestStatus } from "@/lib/convert/contract";
import { VERDICT_TINT, type ArmStats, type DailyPoint, type Interval, type VerdictKey } from "@/lib/convert/stats";
import type { Env, PageKind } from "@/lib/convert/model";
import { SquareChoice } from "./SquareChoice";

/** The original in a quiet slate, the version in the accent - the version is the point. */
export const COLOR = { a: "#7d8aa3", b: ACCENT } as const;
export const NAME = { a: "Original", b: "Version" } as const;

export const pct = (r: number | null | undefined, d?: number) => (r === null || r === undefined ? "–" : `${(r * 100).toFixed(d ?? (Math.abs(r) < 0.1 ? 1 : 0))}%`);
export const signed = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)}%`);
export const day = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "–");
export const dayTime = (iso: string | null | undefined) => {
  if (!iso) return "–";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const nf = new Intl.NumberFormat("en-US");
export const n = (x: number | null | undefined) => (x === null || x === undefined ? "–" : nf.format(x));

/* ── what the routes answer ──────────────────────────────────────────── */

export type Figures = {
  counted: boolean;
  a: ArmStats; b: ArmStats; uplift: Interval; pB: number | null; days: number;
  verdict: { key: VerdictKey; text: string; why: string; decided: boolean; moreDays: number | null } | null;
  at: string | null; live: boolean; error: string | null; applyMisses: number; weights: { a: number; b: number } | null;
};
export type TestView = {
  id: string; name: string; kind: TestKind; versionId: string | null; versionRev: number; changeCount: number; ideaId: string | null;
  env: Env; host: Host; pages: string[]; allocation: Allocation; audience: Audience; goal: "add_to_cart"; mde: number; v: number;
  status: TestStatus; winner: "a" | "b" | "none" | null; fromTest: string | null;
  createdBy: string | null; createdAt: string; startedBy: string | null; startedAt: string | null; stoppedBy: string | null; stoppedAt: string | null;
  decidedBy: string | null; decidedAt: string | null; syncedAt: string | null; syncError: string | null; resultsAt: string | null; notes: string; updatedAt: string;
  pageKind: PageKind;
  figures?: Figures | null; drift?: "missing" | "behind" | null; weights?: { a: number; b: number } | null;
};
export type CandidateView = { versionId: string; rev: number; env: Env; path: string; kind: PageKind; summary: string; approvedBy: string | null; approvedAt: string | null; ideaId: string; title: string };
export type GatewayView = { configured: boolean; missing: string[]; error?: string | null };

/** The split a person picks: half and half, 30% get the version, or the bandit with a floor. */
export type SplitKey = "half" | "30" | "bandit";
export const splitOf = (k: SplitKey, floor: number): Allocation =>
  normAllocation(k === "bandit" ? { mode: "bandit", split: { b: 50 }, floor } : { mode: "split", split: { b: k === "30" ? 30 : 50 } });
export const splitKeyOf = (a: Allocation): SplitKey => (a.mode === "bandit" ? "bandit" : a.split.b === 30 ? "30" : "half");

/* ── chips and lines ─────────────────────────────────────────────────── */

export function StatusChip({ status, kind }: { status: TestStatus; kind: TestKind }) {
  const label = kind === "personalisation"
    ? ({ draft: "Not switched on", running: "On", paused: "Off", stopped: "Ended", shipped: "Shipped" } as const)[status]
    : STATUS_LABEL[status];
  return <Chip tint={STATUS_TINT[status]}>{label}</Chip>;
}
export function VerdictChip({ v }: { v: { key: VerdictKey; text: string } | null | undefined }) {
  if (!v) return <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>–</Typography>;
  return <Chip tint={VERDICT_TINT[v.key]}>{v.text}</Chip>;
}
export const envChip = (env: Env) => <Chip tint={env === "prod" ? "green" : "amber"}>{env === "prod" ? "Production" : "ACC"}</Chip>;

/** The gateway's state in one line: not connected (drafts still work), or did not answer. */
export function GatewayNotice({ g, what = "tests" }: { g: GatewayView; what?: string }) {
  if (!g.configured) {
    return (
      <Notice tone="warn">
        The shop&apos;s gateway is not connected on this hub ({g.missing.join(", ")} is not set): {what} can be prepared as drafts, but nothing can be started and no figure is shown until it is.
      </Notice>
    );
  }
  if (g.error) return <Notice tone="bad">The shop&apos;s gateway did not answer: {g.error}. The figures shown are the last ones read.</Notice>;
  return null;
}

/* ── the confirm ─────────────────────────────────────────────────────── */

export type Confirm = { title: string; lines: React.ReactNode[]; go: string; tone?: "go" | "stop"; run: () => Promise<boolean> };

/** A confirm that says what happens where - starting is the approval that puts a version on the shop. */
export function ConfirmDialog({ c, onClose }: { c: Confirm | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!c) setBusy(false); }, [c]);
  return (
    <Dialog open={!!c} onClose={() => (busy ? null : onClose())} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "18px", m: { xs: 1.5, sm: 4 }, width: { xs: "calc(100% - 24px)", sm: undefined } } } }}>
      {c && (
        <>
          <DialogTitle sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, pb: 1 }}>{c.title}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 1 }}>
            {c.lines.map((l, i) => <Typography key={i} component="div" sx={{ fontSize: "0.86rem", color: i === 0 ? INK : MUTED, wordBreak: "break-word" }}>{l}</Typography>)}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="contained" disableElevation color={c.tone === "stop" ? "error" : "primary"} disabled={busy}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
              onClick={async () => { setBusy(true); const done = await c.run(); setBusy(false); if (done) onClose(); }}>
              {c.go}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

/** The list of pages, for a confirm. */
export const pagesLine = (host: string, pages: string[]) => (
  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
    {pages.slice(0, 8).map((p) => <li key={p}><Box component="span" sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.78rem" }}>{host}{p}</Box></li>)}
    {pages.length > 8 && <li>and {pages.length - 8} more</li>}
  </Box>
);

/* ── the charts ──────────────────────────────────────────────────────── */

/** Each variant's cart rate with its 95% interval, on one scale. */
export function IntervalBars({ a, b }: { a: ArmStats; b: ArmStats }) {
  const top = Math.max(0.01, a.high ?? 0, b.high ?? 0) * 1.12;
  const at = (x: number | null) => `${Math.min(100, Math.max(0, ((x ?? 0) / top) * 100))}%`;
  const ticks = [0, top / 2, top].map((t) => ({ t, label: pct(t, 1) }));
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {(["a", "b"] as const).map((k) => {
        const s = k === "a" ? a : b;
        return (
          <Box key={k} sx={{ display: "grid", gridTemplateColumns: { xs: "64px minmax(0,1fr)", sm: "84px minmax(0,1fr) 150px" }, gap: { xs: 1, sm: 1.5 }, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: COLOR[k] }}>{NAME[k]}</Typography>
            <Box sx={{ position: "relative", height: 26 }} role="img" aria-label={`${NAME[k]}: ${pct(s.rate)} (95% between ${pct(s.low)} and ${pct(s.high)})`}>
              <Box sx={{ position: "absolute", left: 0, right: 0, top: 12, height: 2, bgcolor: TRACK, borderRadius: 2 }} />
              {s.rate !== null && (
                <>
                  <Box sx={{ position: "absolute", left: at(s.low), width: `calc(${at(s.high)} - ${at(s.low)})`, top: 6, height: 14, borderRadius: 7, bgcolor: COLOR[k], opacity: 0.22 }} />
                  <Box sx={{ position: "absolute", left: `calc(${at(s.rate)} - 7px)`, top: 6, width: 14, height: 14, borderRadius: "50%", bgcolor: COLOR[k], border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(21,34,58,.15)" }} />
                </>
              )}
            </Box>
            <Typography sx={{ gridColumn: { xs: "2", sm: "auto" }, fontSize: "0.82rem", color: INK, fontVariantNumeric: "tabular-nums", mt: { xs: -0.75, sm: 0 } }}>
              <b>{pct(s.rate, 2)}</b> <Box component="span" sx={{ color: MUTED }}>{s.rate === null ? "no visitor yet" : `${pct(s.low, 1)} – ${pct(s.high, 1)}`}</Box>
            </Typography>
          </Box>
        );
      })}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "64px minmax(0,1fr)", sm: "84px minmax(0,1fr) 150px" }, gap: { xs: 1, sm: 1.5 } }}>
        <Box />
        <Box sx={{ position: "relative", height: 14 }}>
          {ticks.map((t, i) => (
            <Typography key={i} sx={{ position: "absolute", left: at(t.t), transform: i === 0 ? "none" : i === 2 ? "translateX(-100%)" : "translateX(-50%)", fontSize: "0.68rem", color: FAINT, whiteSpace: "nowrap" }}>{t.label}</Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** The uplift of the version over the original, with its 95% interval, around zero. */
export function UpliftBar({ u, mde }: { u: Interval; mde: number }) {
  if (u.mid === null || u.low === null || u.high === null) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The uplift shows once both have visitors with an add-to-cart.</Typography>;
  const span = Math.max(Math.abs(u.low), Math.abs(u.high), mde * 1.5, 0.05) * 1.15;
  const at = (x: number) => `${50 + (Math.max(-span, Math.min(span, x)) / span) * 50}%`;
  const tone = u.low > 0 ? GREEN : u.high < 0 ? RED : MUTED;
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: tone, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{signed(u.mid)}</Typography>
      <Box sx={{ position: "relative", height: 30 }} role="img" aria-label={`Uplift ${signed(u.mid)}, 95% between ${signed(u.low)} and ${signed(u.high)}`}>
        <Box sx={{ position: "absolute", left: at(-mde), width: `calc(${at(mde)} - ${at(-mde)})`, top: 4, height: 22, bgcolor: "rgba(21,34,58,.04)", borderRadius: "4px" }} />
        <Box sx={{ position: "absolute", left: 0, right: 0, top: 14, height: 2, bgcolor: TRACK }} />
        <Box sx={{ position: "absolute", left: "50%", top: 2, height: 26, width: 1.5, bgcolor: FAINT }} />
        <Box sx={{ position: "absolute", left: at(u.low), width: `calc(${at(u.high)} - ${at(u.low)})`, top: 8, height: 14, borderRadius: 7, bgcolor: tone, opacity: 0.25 }} />
        <Box sx={{ position: "absolute", left: `calc(${at(u.mid)} - 7px)`, top: 8, width: 14, height: 14, borderRadius: "50%", bgcolor: tone, border: "2px solid #fff" }} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>worse</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, textAlign: "center" }}>95% between {signed(u.low)} and {signed(u.high)} · grey band = ±{Math.round(mde * 100)}%, too small to count</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>better</Typography>
      </Box>
    </Box>
  );
}

/** P(the version is the better one) as a half gauge, with the 95% mark a winner needs. */
export function Gauge({ p }: { p: number | null }) {
  const R = 70, cx = 90, cy = 86;
  const pt = (f: number) => [cx - R * Math.cos(Math.PI * f), cy - R * Math.sin(Math.PI * f)] as const;
  const arc = (f0: number, f1: number) => { const [x0, y0] = pt(f0), [x1, y1] = pt(f1); return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`; };
  const v = p ?? 0;
  const tone = p === null ? FAINT : v >= 0.95 ? GREEN : v <= 0.05 ? RED : ACCENT;
  const [mx, my] = pt(0.95), [mx2, my2] = [cx - (R + 9) * Math.cos(Math.PI * 0.95), cy - (R + 9) * Math.sin(Math.PI * 0.95)];
  return (
    <Box sx={{ display: "grid", justifyItems: "center" }}>
      <Box component="svg" viewBox="0 0 180 100" sx={{ width: "100%", maxWidth: 220, height: "auto", display: "block" }} role="img" aria-label={`The version is the better one: ${p === null ? "not known yet" : pct(p, 0)}`}>
        <path d={arc(0, 1)} fill="none" stroke={TRACK} strokeWidth={14} strokeLinecap="round" />
        {p !== null && v > 0.002 && <path d={arc(0, Math.min(0.999, v))} fill="none" stroke={tone} strokeWidth={14} strokeLinecap="round" />}
        <line x1={mx} y1={my} x2={mx2} y2={my2} stroke={INK} strokeWidth={1.5} />
        <text x={cx} y={cy - 12} textAnchor="middle" style={{ fontSize: 24, fontWeight: 700, fill: tone, fontFamily: FONT }}>{p === null ? "–" : pct(p, 0)}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: 9.5, fill: MUTED, fontFamily: FONT }}>the version is better</text>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>A winner needs 95% (the mark)</Typography>
    </Box>
  );
}

const shortDay = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** Day by day: visitors per variant, and the cart rate so far per variant. */
export function DailyCharts({ daily, bandit, history }: { daily: DailyPoint[]; bandit: boolean; history: { at: string; a: number; b: number }[] }) {
  if (!daily.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No day counted yet.</Typography>;
  const axis = { tick: { fontSize: 11, fill: CHROME.label }, axisLine: { stroke: CHROME.axis }, tickLine: false } as const;
  const tip = { contentStyle: { borderRadius: 10, border: `1px solid ${HAIRLINE}`, fontSize: 12 }, labelFormatter: (l: unknown) => day(String(l)) };
  const rates = daily.map((d) => ({ day: d.day, a: d.rateA === null ? null : d.rateA * 100, b: d.rateB === null ? null : d.rateB * 100 }));
  const share = bandit ? (() => {
    const byDay = new Map<string, number>();
    for (const h of history) byDay.set(h.at.slice(0, 10), h.b / Math.max(1e-9, h.a + h.b));
    return daily.map((d) => ({ day: d.day, planned: byDay.has(d.day) ? byDay.get(d.day)! * 100 : null, actual: d.shareB === null ? null : d.shareB * 100 }));
  })() : null;
  const Legend = ({ items }: { items: { c: string; l: string; dash?: boolean }[] }) => (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
      {items.map((x) => <Box key={x.l} sx={{ display: "flex", gap: 0.75, alignItems: "center" }}><Box sx={{ width: 16, height: 0, borderTop: `2.5px ${x.dash ? "dashed" : "solid"} ${x.c}` }} /><Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{x.l}</Typography></Box>)}
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: share ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))" } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mb: 0.5 }}>Visitors a day</Typography>
        <Box sx={{ height: 200, fontFamily: FONT }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHROME.grid} />
              <XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={18} />
              <YAxis {...axis} axisLine={false} allowDecimals={false} width={50} />
              <Tooltip {...tip} formatter={(v: unknown, name: unknown) => [n(Number(v)), name === "a" ? NAME.a : NAME.b]} />
              <Line type="monotone" dataKey="a" stroke={COLOR.a} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="b" stroke={COLOR.b} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Legend items={[{ c: COLOR.a, l: NAME.a }, { c: COLOR.b, l: NAME.b }]} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mb: 0.5 }}>Cart rate so far</Typography>
        <Box sx={{ height: 200, fontFamily: FONT }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rates} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHROME.grid} />
              <XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={18} />
              <YAxis {...axis} axisLine={false} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} width={50} />
              <Tooltip {...tip} formatter={(v: unknown, name: unknown) => [v === null ? "–" : `${Number(v).toFixed(2)}%`, name === "a" ? NAME.a : NAME.b]} />
              <Line type="monotone" dataKey="a" stroke={COLOR.a} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="b" stroke={COLOR.b} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Legend items={[{ c: COLOR.a, l: NAME.a }, { c: COLOR.b, l: NAME.b }]} />
      </Box>
      {share && (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mb: 0.5 }}>The version&apos;s share of the visitors</Typography>
          <Box sx={{ height: 200, fontFamily: FONT }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={share} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHROME.grid} />
                <XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={18} />
                <YAxis {...axis} axisLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} width={50} />
                <Tooltip {...tip} formatter={(v: unknown, name: unknown) => [v === null ? "–" : `${Math.round(Number(v))}%`, name === "planned" ? "Set by the bandit" : "Visitors that day"]} />
                <Line type="stepAfter" dataKey="planned" stroke={COLOR.b} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="actual" stroke={COLOR.b} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Legend items={[{ c: COLOR.b, l: "Set by the bandit", dash: true }, { c: COLOR.b, l: "Visitors that day" }]} />
        </Box>
      )}
    </Box>
  );
}

/* ── choosing the audience and the pages ─────────────────────────────── */

const LABEL = { fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" as const, letterSpacing: ".04em" };

export function AudienceBuilder({ value, onChange, stores, disabled }: { value: Audience; onChange: (a: Audience) => void; stores: string[]; disabled?: boolean }) {
  const set = <K extends keyof Audience>(k: K, v: Audience[K]) => onChange({ ...value, [k]: v });
  const toggle = (s: string) => set("stores", value.stores.includes(s) ? value.stores.filter((x) => x !== s) : [...value.stores, s]);
  return (
    <Box sx={{ display: "grid", gap: 1.25, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={LABEL}>Store views {value.stores.length ? `· ${value.stores.length}` : "· all"}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", width: "fit-content", maxWidth: "100%", bgcolor: "rgba(255,255,255,.75)" }}>
          {[{ k: "", l: "All" }, ...stores.map((s) => ({ k: s, l: s }))].map((o, i) => {
            const on = o.k === "" ? value.stores.length === 0 : value.stores.includes(o.k);
            return (
              <Box key={o.k || "all"} component="button" type="button" role="checkbox" aria-checked={on} onClick={() => (o.k === "" ? set("stores", []) : toggle(o.k))} sx={{
                all: "unset", cursor: "pointer", px: 1.1, py: 0.5, fontSize: "0.8rem", fontWeight: 600, borderLeft: i ? `1px solid ${HAIRLINE}` : "none",
                color: on ? "#fff" : INK, bgcolor: on ? "#2459d1" : "transparent", "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: -2 },
              }}>{o.l}</Box>
            );
          })}
        </Box>
      </Box>
      <SquareChoice label="Device" value={value.device} onChange={(v) => set("device", v)} options={[{ key: "any", label: "Any" }, { key: "desktop", label: "Desktop" }, { key: "phone", label: "Phone" }]} />
      <SquareChoice label="Signed in" value={value.login} onChange={(v) => set("login", v)} options={[{ key: "any", label: "Anyone" }, { key: "customer", label: "Signed-in customers" }, { key: "guest", label: "Guests" }]} />
      <SquareChoice label="Visit" value={value.visitor} onChange={(v) => set("visitor", v)} options={[{ key: "any", label: "Any" }, { key: "new", label: "New" }, { key: "returning", label: "Returning" }]} />
      <SquareChoice label="Came from" value={value.source} onChange={(v) => set("source", v)} options={[
        { key: "any", label: "Anywhere" }, { key: "search", label: "Search" }, { key: "ads", label: "Ads" }, { key: "direct", label: "Direct" }, { key: "email", label: "E-mail" }, { key: "other", label: "Other sites" },
      ]} />
    </Box>
  );
}

/** The version's page in its other languages, to tick (its own page always in). */
export function PagePicker({ api, versionId, env, value, onChange }: { api: string; versionId: string; env: Env; value: string[]; onChange: (p: string[]) => void }) {
  const [paths, setPaths] = useState<{ path: string; store: string | null }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setPaths(null); setErr(null);
    fetch(`${api}?languages=${versionId}&env=${env}`).then((r) => r.json()).then((j: { ok?: boolean; data?: { paths: { path: string; store: string | null }[] }; error?: string }) => {
      if (!live) return;
      if (j.ok && j.data) { setPaths(j.data.paths); if (!value.length && j.data.paths[0]) onChange([j.data.paths[0].path]); } else setErr(j.error ?? "The languages could not be read.");
    }).catch(() => live && setErr("The languages could not be read."));
    return () => { live = false; };
  }, [api, versionId, env]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Typography sx={{ fontSize: "0.8rem", color: RED }}>{err}</Typography>;
  if (!paths) return <Box sx={{ display: "flex", gap: 1, alignItems: "center", color: MUTED, fontSize: "0.8rem" }}><CircularProgress size={13} /> Finding the page in its other languages…</Box>;
  const main = paths[0]?.path;
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Typography sx={LABEL}>Pages · {value.length || 1} of {paths.length}</Typography>
      {paths.length === 1 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The shop&apos;s index has this page in no other language on {env === "prod" ? "production" : "ACC"}.</Typography>}
      {paths.map((p) => (
        <FormControlLabel key={p.path} sx={{ m: 0, minWidth: 0, "& .MuiFormControlLabel-label": { minWidth: 0 } }}
          control={<Checkbox size="small" checked={p.path === main || value.includes(p.path)} disabled={p.path === main}
            onChange={(e) => onChange(e.target.checked ? [...new Set([...(value.length ? value : [main!]), p.path])] : value.filter((x) => x !== p.path))} />}
          label={<Typography sx={{ fontSize: "0.8rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.path}>{p.store ? <b>{p.store} </b> : null}{p.path}</Typography>} />
      ))}
    </Box>
  );
}
