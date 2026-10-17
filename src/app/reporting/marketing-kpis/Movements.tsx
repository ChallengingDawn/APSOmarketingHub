"use client";
// SEGMENT MOVEMENTS (KPI C08) on Who are our customers: in the chosen months, how
// many companies moved up or down in sales priority, APSO segment and yearly
// potential, against the same months a year earlier; month by month as a chart;
// and which moves they were ("Prio 2 → Prio 1"). Read from each company's
// property history (src/lib/marketingKpis/movements.ts).

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, glass } from "@/app/uc/report/ui";
import { MONTH_NAMES, windowLabel, yearOfMonth, type Cube, type Win } from "@/lib/marketingKpis/cube";
import { PRIO_RANK, segmentRank, type MoveKind, type Movements, type MonthCount } from "@/lib/marketingKpis/moves";
import { useSlow } from "./data";

export const useMovements = () => {
  const { value, ...rest } = useSlow<Movements>("/api/reporting/marketing-kpis/movements", "movements");
  return { m: value, ...rest };
};

const KIND: Record<MoveKind, { name: string; up: string; down: string }> = {
  prio: { name: "Sales priority", up: "Up a priority", down: "Down a priority" },
  segment: { name: "APSO customer", up: "Up a segment", down: "Down a segment" },
  potential: { name: "Potential", up: "Potential raised", down: "Potential lowered" },
};
const int = (n: number) => Math.round(n).toLocaleString("en");
const keyOf = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const zero = (): MonthCount => ({ up: 0, down: 0, set: 0, upPerson: 0, downPerson: 0 });
/** The from -> to moves of priority or segment in the given months, summed. */
export function movesIn(m: Movements, cube: Cube, months: number[], kind: "prio" | "segment"): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const k of months) for (const [t, n] of Object.entries(m.transitions[kind][keyOf(cube, k)] ?? {})) sum[t] = (sum[t] ?? 0) + n;
  return sum;
}
/** Per value: how many moves arrived in it and how many left it - the nutshell's graph. */
export function inOut(sum: Record<string, number>): Map<string, { in: number; out: number }> {
  const out = new Map<string, { in: number; out: number }>();
  const at = (l: string) => { let x = out.get(l); if (!x) { x = { in: 0, out: 0 }; out.set(l, x); } return x; };
  for (const [t, n] of Object.entries(sum)) {
    const [from, to] = t.split(" → ");
    if (!from || !to) continue;
    at(from).out += n;
    at(to).in += n;
  }
  return out;
}
const rankOf = (kind: "prio" | "segment", l: string) => (kind === "prio" ? PRIO_RANK[l] ?? 9 : l === "ESO customers" ? 1 : segmentRank(l) ?? 9);

const add = (a: MonthCount, b?: MonthCount) => { if (b) { a.up += b.up; a.down += b.down; a.set += b.set; a.upPerson += b.upPerson; a.downPerson += b.downPerson; } return a; };

export function MovementsView({ cube, win, filtered }: { cube: Cube; win: Win; filtered?: boolean }) {
  const { m, computing, progress, error } = useMovements();
  const months = useMemo(() => Array.from({ length: win.end - win.start + 1 }, (_, i) => win.start + i), [win]);
  if (!m) {
    return (
      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
            {error ? `Could not read the movements: ${error}` : `Reading every company's history in HubSpot${progress ? ` - ${progress}` : ""}. About 5 minutes the first time, then kept for 12 hours.`}
          </Typography>
        </Box>
      </GlassCard>
    );
  }
  // a year earlier only where that property already had its history (priority: since May 2026)
  const covered = (kind: MoveKind, k: number) => keyOf(cube, k) >= m.from && !!m.since?.[kind] && keyOf(cube, k) >= m.since[kind]!;
  const sinceLabel = (kind: MoveKind) => {
    const s = m.since?.[kind];
    return s ? `${MONTH_NAMES[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}` : null;
  };
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<SwapVertIcon />} tint="purple" title="Segment movements" note="Companies that moved up or down in sales priority, APSO customer and potential - by the engine, workflows or a person"
        right={<Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>KPI C08</Typography>} />
      {filtered && <Typography sx={{ fontSize: "0.8rem", color: "#8a5a00", mt: -1 }}>The period applies here; the other filters do not - the movements count every company.</Typography>}
      {computing && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: -1 }}>Reading the history again{progress ? ` - ${progress}` : ""}; these figures stand until it is done.</Typography>}

      {/* the three, side by side: up and down in the window, against a year earlier */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(3, minmax(0, 1fr))" } }}>
        {(["prio", "segment", "potential"] as MoveKind[]).map((kind) => {
          const cur = months.reduce((a, k) => add(a, m.counts[kind][keyOf(cube, k)]), zero());
          const prev = months.every((k) => covered(kind, k - 12)) ? months.reduce((a, k) => add(a, m.counts[kind][keyOf(cube, k - 12)]), zero()) : null;
          const data = months.map((k) => {
            const c = m.counts[kind][keyOf(cube, k)] ?? zero();
            return { month: `${MONTH_NAMES[k % 12]} ${String(yearOfMonth(cube, k)).slice(2)}`, Up: c.up, Down: c.down };
          });
          return (
            <Box key={kind} sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1 }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{KIND[kind].name}</Typography>
              <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
                {([["up", KIND[kind].up, GREEN, cur.up, prev?.up, cur.upPerson], ["down", KIND[kind].down, RED, cur.down, prev?.down, cur.downPerson]] as const).map(([k, label, color, n, p, person]) => (
                  <Box key={k} title={`${int(person)} of them by a person in HubSpot`}>
                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: MUTED }}>{label}</Typography>
                    <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{int(n)}</Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{p != null ? `${pw}: ${int(p)}` : `in HubSpot since ${sinceLabel(kind) ?? "-"}`} · {int(person)} by a person</Typography>
                  </Box>
                ))}
              </Box>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e6e8ec" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip formatter={(v: unknown, n: unknown) => [int(Number(v)), String(n)]} contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} />
                  <Legend verticalAlign="top" align="left" height={24} iconType="circle" wrapperStyle={{ fontSize: "0.76rem" }} itemSorter={(i) => (i.value === "Up" ? 0 : 1)} />
                  <Bar dataKey="Up" fill={GREEN} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                  <Bar dataKey="Down" fill={RED} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          );
        })}
      </Box>

      {/* where they went: per value, how many left and how many arrived - and the biggest moves (SARCLA 17.10: "simplify") */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
        {(["prio", "segment"] as const).map((kind) => (
          <MoveBalance key={kind} kind={kind} title={`${KIND[kind].name}: in and out, ${w}`} sum={movesIn(m, cube, months, kind)} />
        ))}
      </Box>

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        From each company&apos;s history in HubSpot, {int(m.companies)} companies, since {m.from}; read {new Date(m.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, every 12 hours. A company that moved twice counts twice.
        Up: Prio 1 is the top priority; APSOcore (with ESO, DS and Growth Engine customers) &gt; APSOgrowth &gt; APSOprospect &gt; APSOmicro &gt; APSOlost; a larger potential.
      </Typography>
    </GlassCard>
  );
}

/** The fifteen "ESO-Customer 08 … 26" values count as one, "ESO customers" - they rank as APSOcore does. */
const gridLabel = (kind: "prio" | "segment", l: string) => (kind === "segment" && /^ESO/i.test(l) ? "ESO customers" : l);

/**
 * Per value, in rank order: the companies that left it (red, to the left) and
 * the ones that arrived (green, to the right), and what that leaves - the net.
 * Under it, the five biggest moves in words. The fifteen "ESO-Customer 08 … 26"
 * values count as one, "ESO customers".
 */
function MoveBalance({ kind, title, sum: raw }: { kind: "prio" | "segment"; title: string; sum: Record<string, number> }) {
  const sum: Record<string, number> = {};
  for (const [t, n] of Object.entries(raw)) {
    const [from, to] = t.split(" → ");
    if (!from || !to) continue;
    const f = gridLabel(kind, from), tt = gridLabel(kind, to);
    if (f === tt) continue;
    const k = `${f} → ${tt}`;
    sum[k] = (sum[k] ?? 0) + n;
  }
  const io = inOut(sum);
  const labels = [...io.keys()].sort((a, b) => rankOf(kind, a) - rankOf(kind, b) || a.localeCompare(b));
  const max = Math.max(1, ...[...io.values()].flatMap((x) => [x.in, x.out]));
  const top = Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = Object.values(sum).reduce((t, n) => t + n, 0);
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1.25 }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
      {total === 0 ? <Typography sx={{ fontSize: "0.85rem", color: FAINT }}>No moves in these months.</Typography> : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) minmax(0, 1.4fr) 2px minmax(0, 1.4fr) 72px", columnGap: 1, rowGap: 0.9, alignItems: "center" }}>
            <Box />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: RED, textAlign: "right" }}>moved out</Typography>
            <Box />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: GREEN }}>moved in</Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textAlign: "right" }}>net</Typography>
            {labels.map((l) => {
              const x = io.get(l)!;
              const net = x.in - x.out;
              return (
                <Box key={l} role="row" sx={{ display: "contents" }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{l}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.6 }}>
                    <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700, color: x.out ? RED : FAINT, fontVariantNumeric: "tabular-nums" }}>{int(x.out)}</Typography>
                    <Box sx={{ height: 12, borderRadius: "99px 0 0 99px", bgcolor: RED, opacity: 0.8, width: `${(100 * x.out) / max}%`, maxWidth: "70%" }} />
                  </Box>
                  <Box sx={{ height: 20, bgcolor: "rgba(21,34,58,.18)" }} />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                    <Box sx={{ height: 12, borderRadius: "0 99px 99px 0", bgcolor: GREEN, opacity: 0.85, width: `${(100 * x.in) / max}%`, maxWidth: "70%" }} />
                    <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700, color: x.in ? GREEN : FAINT, fontVariantNumeric: "tabular-nums" }}>{int(x.in)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, textAlign: "right", fontVariantNumeric: "tabular-nums", color: net > 0 ? GREEN : net < 0 ? RED : FAINT }}>
                    {net > 0 ? "+" : net < 0 ? "−" : ""}{int(Math.abs(net))}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1, display: "grid", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>The biggest moves</Typography>
            {top.map(([t, n]) => {
              const [from, to] = t.split(" → ");
              const up = rankOf(kind, to) < rankOf(kind, from);
              return (
                <Box key={t} sx={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: "0.84rem", color: INK }}>
                  <Box component="span" sx={{ fontWeight: 800, color: up ? GREEN : RED, width: 14 }}>{up ? "↑" : "↓"}</Box>
                  <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{from} <Box component="span" sx={{ color: FAINT }}>→</Box> {to}</Box>
                  <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{int(n)}</Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}
