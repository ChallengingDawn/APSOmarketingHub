"use client";
// THE PRODUCTS REPORTS' FUNNEL (SARCLA 01.11.2026: "it would be interesting to have a funnel diagram in each of the sub
// topic"): drawn as the potential funnel of the Tickets he accepted (eso-benchmark/TicketsCharts.tsx PotentialFunnel) - a
// plain bar a step, its count beside it and its share of the first step, and between two steps what stopped there. The stop
// a page is about is marked in red with the page's name; the others stay quiet. One unit a funnel (memory: one unit a tile).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import { FAINT, INK, MUTED, RED } from "@/app/uc/report/ui";
import { SEQUENTIAL } from "@/app/charts/palette";

export type FunnelStep = {
  label: string; n: number;
  /** a line under the label */
  sub?: string;
  color?: string;
  /** the same step's share of the first, the period before - written beside this one */
  before?: { share: number | null; words: string } | null;
};
/** What stopped between a step and the next: `mine` marks the page's own, named `tag`. */
export type FunnelStop = { n: number; label: string; mine?: boolean } | null;

const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`);

export function StepFunnel({ steps, stops, unit, tag, top: topWords = "of the first step" }: {
  steps: FunnelStep[];
  /** stops[i] stopped between steps[i] and steps[i + 1] */
  stops: FunnelStop[];
  /** the unit in words: (n) => "1,234 looks" */
  unit: (n: number) => string;
  /** the page's name on its own stop */
  tag?: string;
  /** what the shares are of, in words */
  top?: string;
}) {
  const top = steps[0]?.n || 1;
  const blues = [SEQUENTIAL[2], SEQUENTIAL[3], SEQUENTIAL[4], SEQUENTIAL[5], SEQUENTIAL[5], SEQUENTIAL[6]];
  return (
    <Box sx={{ display: "grid", gap: 0.5, containerType: "inline-size" }}>
      {steps.map((x, i) => (
        <Box key={x.label} sx={{ display: "grid", gap: 0.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.75, "@container (min-width: 640px)": { gridTemplateColumns: "170px minmax(0, 1fr) 210px", alignItems: "center", gap: 1.75 } }}>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
              {x.sub && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{x.sub}</Typography>}
            </Box>
            <Box sx={{ display: "grid", justifyItems: "center" }}>
              <Box role="img" aria-label={`${x.label}: ${unit(x.n)}, ${pct(x.n / top)} ${topWords}`}
                sx={{ width: `${Math.max(2, (x.n / top) * 100)}%`, height: 34, borderRadius: "8px", bgcolor: x.color ?? blues[Math.min(i, blues.length - 1)], transition: "width .3s" }} />
            </Box>
            <Box sx={{ textAlign: "right", "@container (max-width: 639px)": { textAlign: "left" } }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{int(x.n)}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                {i === 0 ? unit(x.n).replace(/^[\d,.]+\s*/, "") : `${pct(x.n / top)} ${topWords}`}
                {i > 0 && x.before ? <span style={{ color: FAINT }}>{` · ${pct(x.before.share)} ${x.before.words}`}</span> : null}
              </Typography>
            </Box>
          </Box>
          {stops[i] && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.75, pl: { xs: 0.75, sm: 2 }, pr: 0.75, borderRadius: "8px",
              ...(stops[i]!.mine ? { bgcolor: "rgba(197,34,31,.07)", borderLeft: `3px solid ${RED}` } : {}) }}>
              <ArrowDownwardIcon sx={{ fontSize: 16, color: stops[i]!.mine ? RED : MUTED }} />
              <Typography sx={{ fontSize: "0.8rem", color: stops[i]!.mine ? INK : MUTED }}>
                <b style={{ color: stops[i]!.mine ? RED : INK, fontVariantNumeric: "tabular-nums" }}>{int(stops[i]!.n)}</b> {stops[i]!.label}
                {` · ${pct(x.n ? stops[i]!.n / x.n : null)} of this step`}
                {stops[i]!.mine && tag ? <b style={{ color: RED }}>{` · ${tag}`}</b> : null}
              </Typography>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
