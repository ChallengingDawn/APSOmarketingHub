"use client";
// THE MOUNTAIN, DRAWN FROM THE FIGURES (SARCLA 31.10.2026: "the mountain behind should see real data and show
// what is our position until 30 millions in 2031"). Design 8 of the 30 he was shown, "Snow cap" (01.11.2026):
// the ridge is APSOparts' revenue year by year and then the path to the 30 M€ summit in 2031 at the growth a
// year it takes, snow above the path's 2029 value, the dot where this year is heading. On the home card it
// covers the card's face; at the top of the action plan it carries the years and sits beside the figures.

import { useEffect, useId, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { SUMMIT, mEur, pct1, standingOf, type Summit } from "@/lib/reporting/summitRules";

export type SummitData = Summit & { generatedAt: string };

let cache: Promise<SummitData> | null = null;
/** One read per page visit, shared by everything that draws it. */
export function useSummit(enabled = true): { data: SummitData | null; error: string | null } {
  const [data, setData] = useState<SummitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (!cache) {
      cache = fetch("/api/action-plan/summit").then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.message ?? j?.error ?? `the hub answered ${r.status}`);
        return j.summit as SummitData;
      });
      cache.catch(() => { cache = null; });
    }
    let live = true;
    cache.then((d) => live && setData(d), (e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [enabled]);
  return { data, error };
}

const GOOD = "#1b7a55";
const BEHIND = "#a96a12";

/* ── mountain 8, "Snow cap" (SARCLA 01.11.2026 picked it from 30 designs) ─────────────────────────
   A rock peak drawn from the figures: its ridge is the full years, then the path's years up to the
   summit; everything above the path's 2029 value is snow; the history drawn solid, the climb dashed;
   the dot is this year's estimate, green on or ahead of the path, amber behind. Since 01.11.2026 the ridge starts
   at the base year: one climb, no earlier peaks. */
type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Pt) => `${r1(p[0])},${r1(p[1])}`;
/** A smooth line through the points (Catmull-Rom as cubic Béziers). */
function smooth(P: Pt[]): string {
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? P[i + 1];
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
}
const closeDown = (d: string, P: Pt[], y: number) => `${d}L${r1(P[P.length - 1][0])},${y}L${r1(P[0][0])},${y}Z`;
function xAtY(P: Pt[], y: number): number | null {
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
  }
  return null;
}

/** Where things sit: the card's full face (as on the design board), or the wider band at the top of the plan. */
const LAYOUT = {
  card: { vw: 430, vh: 420, x0: 178, x1: 362, yb: 404, yt: 218, base: 424, years: false },
  band: { vw: 600, vh: 226, x0: 96, x1: 470, yb: 182, yt: 48, base: 200, years: true },
} as const;

/** The mountain. In "card" it covers the card's face, anchored bottom right; in "band" it adds the years. */
export function SummitMountain({ s, mode }: { s: SummitData | null; mode: "card" | "band" }) {
  const uid = useId().replace(/:/g, "");
  const L = LAYOUT[mode];
  const svgSx = mode === "card"
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }
    : { width: "100%", height: "auto", display: "block" };

  // before the figures arrive - or if they cannot be read - the quiet range the card always had
  if (!s || !s.base || !s.path.length) {
    return (
      <Box aria-hidden component="svg" viewBox={`0 0 ${L.vw} ${L.vh}`} preserveAspectRatio="xMaxYMax meet" sx={svgSx}>
        <defs>
          <linearGradient id={`m1${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#c7b8fb" /></linearGradient>
          <linearGradient id={`m2${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7aa7f5" /><stop offset="100%" stopColor="#b9d2fa" /></linearGradient>
        </defs>
        <g transform={`translate(${L.vw - 260} ${L.vh - 120})`}>
          <path d="M60 120 L130 28 L200 120 Z" fill={`url(#m1${uid})`} />
          <path d="M140 120 L196 52 L252 120 Z" fill={`url(#m2${uid})`} opacity=".9" />
          <path d="M8 120 L62 60 L116 120 Z" fill={`url(#m2${uid})`} opacity=".55" />
          <path d="M130 28 L130 12" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M130 12 L148 17 L130 23 Z" fill="#ec4899" />
        </g>
      </Box>
    );
  }

  // the figures in M€: the path from the last full year to the summit, and this year. One climb from the base -
  // the earlier years drew a tall narrow peak (2022) that SARCLA found obscene on the live card (01.11.2026)
  const M = 1_000_000;
  const P = s.path.map((p) => [p.year, p.value / M] as Pt);
  const N: Pt = s.current ? [s.current.year, s.current.estimate / M] : [s.base.year, s.base.value / M];
  const t0 = s.base.year, t1 = SUMMIT.year, v1 = SUMMIT.value / M;
  const v0 = Math.max(0, Math.floor(Math.min(N[1], ...P.map((q) => q[1])) - 5));
  const X = (t: number) => L.x0 + ((t - t0) * (L.x1 - L.x0)) / (t1 - t0);
  const Y = (v: number) => L.yb - ((v - v0) * (L.yb - L.yt)) / (v1 - v0);
  const XY = (q: Pt): Pt => [X(q[0]), Y(q[1])];

  // the ridge runs through this year's own figure, so the dot sits on the line (SARCLA 01.11.2026: "the circle is
  // not aligned with the line" - it ran through the path's value for this year); the path takes over after it
  const data = (s.current ? [P[0], N, ...P.filter((q) => q[0] > N[0])] : P).map(XY);
  const top = data[data.length - 1];
  const back: Pt[] = [[top[0] + 24, top[1] + 38], [top[0] + 44, top[1] + 62], [top[0] + 70, top[1] + 78]];
  const crest: Pt[] = [[L.x0 - 60, L.base - 2], [L.x0 - 28, L.yb - 22], ...data, ...back];
  const ridge = smooth(crest), rock = closeDown(ridge, crest, L.base);
  // solid up to where we are, dashed from there to the summit
  const xBase = X(N[0]);
  const now = XY(N);
  const st = standingOf(s.gap) === "behind" ? BEHIND : GOOD;

  // the snow: everything above the path's value three steps before the summit (26 M€ on today's path)
  const snowV = Math.round(P[Math.max(0, P.length - 3)][1]);
  const sy = Y(snowV);
  const snowL = X(P[Math.min(2, P.length - 1)][0]) - 8, right = L.vw + 6;
  let snow = `M${r1(snowL)},${r1(L.yt - 70)}L${right},${r1(L.yt - 70)}L${right},${r1(sy + 8)}`;
  for (let x = right - 6, j = 0; x > snowL + 6; x -= 7, j++) snow += `L${r1(x)},${r1(sy + (j % 2 ? -3 : 3.5))}`;
  snow += `L${r1(snowL)},${r1(sy)}Z`;
  const xSnow = xAtY(data, sy);
  const ridges = ([[1, 26, 40], [4, 18, 34], [2, 20, 30]] as const)
    .filter(([i]) => i < data.length)
    .map(([i, dx, dy]) => `M${r1(data[i][0])},${r1(data[i][1] + 4)}q${r1(dx * 0.3)},${r1(dy * 0.5)} ${dx},${dy}`);
  const ft = top[1] - 24;
  const label = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return (
    <Box component="svg" viewBox={`0 0 ${L.vw} ${L.vh}`} preserveAspectRatio="xMaxYMax meet" role="img"
      aria-label={`Revenue ${s.base.year}: ${mEur(s.base.value)}${s.current ? `; ${s.current.year} expected ${mEur(s.current.estimate)}` : ""}; goal ${mEur(SUMMIT.value)} in ${SUMMIT.year}`}
      sx={svgSx}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8f7cf0" /><stop offset="1" stopColor="#cbbffb" /></linearGradient>
        <clipPath id={`a${uid}`}><path d={rock} /></clipPath>
        <clipPath id={`p${uid}`}><rect x="0" y="0" width={r1(xBase)} height={L.vh} /></clipPath>
        <clipPath id={`f${uid}`}><rect x={r1(xBase)} y="0" width={r1(top[0] + 0.5 - xBase)} height={L.vh} /></clipPath>
      </defs>
      <path d={rock} fill={`url(#b${uid})`} />
      <g clipPath={`url(#a${uid})`}>
        {ridges.map((d, k) => <path key={k} d={d} fill="none" stroke="#4b37b0" strokeOpacity=".28" strokeWidth="1.1" strokeLinecap="round" />)}
        <path d={snow} fill="#ffffff" />
        <path d={`M${pt(top)}L${right},${r1(top[1] - 6)}L${right},${L.base}L${r1(top[0] - 40)},${L.base}Z`} fill="#2e1f8a" fillOpacity=".2" />
      </g>
      {/* where we have been, solid; the climb still to make, dashed */}
      <path d={ridge} fill="none" stroke="#7c5cf0" strokeWidth="1.2" clipPath={`url(#p${uid})`} />
      <path d={ridge} fill="none" stroke="#3461c9" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" clipPath={`url(#f${uid})`} />
      <line x1={r1(snowL + 8)} y1={r1(sy)} x2={r1((xSnow ?? snowL + 40) - 4)} y2={r1(sy)} stroke="#6b93ec" strokeWidth=".9" strokeDasharray="2 3" />
      <g fontFamily="var(--font-inter), Inter, sans-serif">
        <text x={r1(snowL + 8)} y={r1(sy - 14)} fontSize="7.5" fontWeight="600" fill="#8b97ac">snow line</text>
        <text x={r1(snowL + 8)} y={r1(sy - 5)} fontSize="7.5" fontWeight="700" fill="#3461c9">{snowV} M€</text>
        {/* the summit */}
        <line x1={r1(top[0])} y1={r1(top[1])} x2={r1(top[0])} y2={r1(ft)} stroke="#3c3f74" strokeOpacity=".75" strokeWidth="1.5" strokeLinecap="round" />
        <path d={`M${r1(top[0])} ${r1(ft)}L${r1(top[0] + 17)} ${r1(ft + 5.3)}L${r1(top[0])} ${r1(ft + 10.6)}Z`} fill="#ec4899" />
        <text x={r1(top[0] + 4)} y={r1(top[1] - 30)} fontSize="9.5" fontWeight="700" fill="#15223a" textAnchor="middle">{`${SUMMIT.value / M} M€ · ${SUMMIT.year}`}</text>
        {/* where we are */}
        <circle cx={r1(now[0])} cy={r1(now[1])} r="10.2" fill={st} fillOpacity=".16" />
        <circle cx={r1(now[0])} cy={r1(now[1])} r="5.2" fill="#ffffff" stroke={st} strokeWidth="2.6" />
        <text x={r1(now[0] - 9)} y={r1(now[1] - 9)} fontSize="9" fontWeight="700" fill={st} textAnchor="end">{label(N[1])}</text>
        {L.years && Array.from({ length: t1 - t0 + 1 }, (_, k) => t0 + k).map((t) => (
          <text key={t} x={r1(X(t))} y={L.vh - 8} fontSize="10" textAnchor="middle" fontWeight={t === N[0] ? 700 : 400} fill={t === N[0] ? "#15223a" : "#8b97ac"}>{t}</text>
        ))}
      </g>
    </Box>
  );
}

/** The figures beside the range at the top of the plan. */
export function SummitFigures({ s }: { s: SummitData }) {
  if (!s.base) return null;
  const due = s.current ? s.path.find((p) => p.year === s.current!.year) : undefined;
  const standing = standingOf(s.gap);
  const cell = (label: string, value: string, note: string, tone?: string) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b97ac" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: tone ?? "#15223a", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: "#5d6b85", lineHeight: 1.35 }}>{note}</Typography>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0, 1fr))" } }}>
      {cell(`${s.base.year}`, mEur(s.base.value), "The last full year: where the climb starts")}
      {s.current
        ? cell(`${s.current.year}, expected`, mEur(s.current.estimate), `${s.base.year} moved by ${s.current.monthsLabel} ${pct1(s.current.change)} on last year`, standing === "behind" ? BEHIND : GOOD)
        : cell("This year", "—", "No like-for-like months yet")}
      {due
        ? cell(`On the path in ${due.year}`, mEur(due.value), s.gap == null ? "" : standing === "on" ? "On the path" : `${standing === "ahead" ? "Ahead" : "Behind"} by ${mEur(Math.abs(s.gap))}`)
        : cell("On the path", "—", "")}
      {cell(`${SUMMIT.value / 1_000_000} M€ by ${SUMMIT.year}`, s.cagr == null ? "—" : pct1(s.cagr), "The growth it takes, every year")}
    </Box>
  );
}
