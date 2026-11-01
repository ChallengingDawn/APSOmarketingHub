"use client";
// THE MOUNTAIN, DRAWN FROM THE FIGURES (SARCLA 31.10.2026: "the mountain behind should see real data and show
// what is our position until 30 millions in 2031"). The solid range is APSOparts' revenue year by year, the
// running year as its estimate; the pale slope behind is the climb from the last full year to the 30 M€
// summit in 2031, at the growth a year it takes; the dot is where we are. Used on the home card (small,
// no words) and at the top of the action plan (with its figures).

import { useEffect, useId, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { SUMMIT, mEur, pct1, type Summit } from "@/lib/reporting/summitRules";

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

const GOOD = "#1f9d6b";
const BEHIND = "#d08a1e";

/** The range itself. `labels` adds the years and the three figures that matter (base, now, summit). */
export function SummitMountain({ s, width, height, labels = false }: { s: SummitData | null; width: number; height: number; labels?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const W = width, H = height;
  const padL = labels ? 34 : 6, padR = labels ? 54 : 26, padT = labels ? 34 : 22, padB = labels ? 26 : 0;

  // before the figures arrive - or if they cannot be read - the quiet range the card always had
  if (!s || !s.base) {
    return (
      <Box aria-hidden component="svg" viewBox="0 0 260 120" sx={{ width: W, height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={`m1${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#c7b8fb" /></linearGradient>
          <linearGradient id={`m2${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7aa7f5" /><stop offset="100%" stopColor="#b9d2fa" /></linearGradient>
        </defs>
        <path d="M60 120 L130 28 L200 120 Z" fill={`url(#m1${uid})`} />
        <path d="M140 120 L196 52 L252 120 Z" fill={`url(#m2${uid})`} opacity=".9" />
        <path d="M8 120 L62 60 L116 120 Z" fill={`url(#m2${uid})`} opacity=".55" />
        <path d="M130 28 L130 12" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M130 12 L148 17 L130 23 Z" fill="#ec4899" />
      </Box>
    );
  }

  const from = Math.max(s.history[0]?.year ?? s.base.year, SUMMIT.year - 10);
  const to = SUMMIT.year;
  const top = Math.max(SUMMIT.value, ...s.history.map((h) => h.value)) * 1.06;
  const X = (y: number) => padL + ((y - from) / (to - from)) * (W - padL - padR);
  const Y = (v: number) => H - padB - (v / top) * (H - padT - padB);
  const floor = H - padB;

  const actual = s.history.filter((h) => h.year >= from).map((h) => ({ year: h.year, value: h.value }));
  if (s.current) actual.push({ year: s.current.year, value: s.current.estimate });
  const area = (pts: { year: number; value: number }[]) =>
    pts.length ? `M${X(pts[0].year)},${floor} ${pts.map((p) => `L${X(p.year)},${Y(p.value)}`).join(" ")} L${X(pts[pts.length - 1].year)},${floor} Z` : "";
  const line = (pts: { year: number; value: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.year)},${Y(p.value)}`).join(" ");

  const here = s.current ? { year: s.current.year, value: s.current.estimate } : s.base;
  const ahead = s.gap == null || s.gap >= 0;
  const fx = X(SUMMIT.year), fy = Y(SUMMIT.value);
  const num = (v: number) => (v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Revenue ${s.base.year}: ${mEur(s.base.value)}${s.current ? `; ${s.current.year} estimated ${mEur(s.current.estimate)}` : ""}; goal ${mEur(SUMMIT.value)} in ${SUMMIT.year}`}
      sx={{ width: "100%", maxWidth: W, height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`a${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#d9cffc" /></linearGradient>
        <linearGradient id={`p${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7aa7f5" stopOpacity=".55" /><stop offset="100%" stopColor="#b9d2fa" stopOpacity=".25" /></linearGradient>
      </defs>
      {labels && [0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={W - padR} y1={Y(SUMMIT.value * f)} y2={Y(SUMMIT.value * f)} stroke="rgba(21,34,58,.07)" />
      ))}
      {/* the climb still to make */}
      <path d={area(s.path)} fill={`url(#p${uid})`} />
      <path d={line(s.path)} fill="none" stroke="#6b93ec" strokeWidth={labels ? 1.6 : 1.3} strokeDasharray="4 4" />
      {/* what was earned */}
      <path d={area(actual)} fill={`url(#a${uid})`} />
      <path d={line(actual)} fill="none" stroke="#8b6cf0" strokeWidth={labels ? 2 : 1.5} strokeLinejoin="round" />
      {/* the summit */}
      <path d={`M${fx},${fy} L${fx},${fy - 16}`} stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
      <path d={`M${fx},${fy - 16} L${fx + 15},${fy - 11.5} L${fx},${fy - 7} Z`} fill="#ec4899" />
      {/* where we are */}
      <circle cx={X(here.year)} cy={Y(here.value)} r={labels ? 6 : 4.5} fill="#fff" stroke={ahead ? GOOD : BEHIND} strokeWidth={labels ? 3 : 2.4} />
      {labels && (
        <g fontFamily="var(--font-inter), sans-serif" fill="#5d6b85">
          {Array.from({ length: to - from + 1 }, (_, k) => from + k).map((y) => (
            <text key={y} x={X(y)} y={H - 8} fontSize="11" textAnchor="middle" fontWeight={y === here.year ? 700 : 400} fill={y === here.year ? "#15223a" : "#8b97ac"}>{y}</text>
          ))}
          <text x={padL - 6} y={Y(SUMMIT.value) + 4} fontSize="10" textAnchor="end" fill="#8b97ac">30</text>
          <text x={padL - 6} y={Y(SUMMIT.value / 2) + 4} fontSize="10" textAnchor="end" fill="#8b97ac">15</text>
          <text x={fx + 18} y={fy - 9} fontSize="12" fontWeight="700" fill="#15223a">30 M€</text>
          <text x={X(s.base.year)} y={Y(s.base.value) - 10} fontSize="11" textAnchor="middle" fill="#5d6b85">{num(s.base.value)}</text>
          {s.current && (
            <text x={X(s.current.year)} y={Y(s.current.estimate) - 12} fontSize="12" fontWeight="700" textAnchor="middle" fill={ahead ? GOOD : BEHIND}>≈{num(s.current.estimate)}</text>
          )}
        </g>
      )}
    </Box>
  );
}

/** The figures beside the range at the top of the plan. */
export function SummitFigures({ s }: { s: SummitData }) {
  if (!s.base) return null;
  const due = s.current ? s.path.find((p) => p.year === s.current!.year) : undefined;
  const ahead = s.gap == null || s.gap >= 0;
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
        ? cell(`${s.current.year}, expected`, mEur(s.current.estimate), `${s.base.year} moved by ${s.current.monthsLabel} ${pct1(s.current.change)} on last year`, ahead ? GOOD : BEHIND)
        : cell("This year", "—", "No like-for-like months yet")}
      {due
        ? cell(`On the path in ${due.year}`, mEur(due.value), s.gap == null ? "" : `${s.gap >= 0 ? "Ahead" : "Behind"} by ${mEur(Math.abs(s.gap))}`)
        : cell("On the path", "—", "")}
      {cell(`${SUMMIT.value / 1_000_000} M€ by ${SUMMIT.year}`, s.cagr == null ? "—" : pct1(s.cagr), "The growth it takes, every year")}
    </Box>
  );
}
