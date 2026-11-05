"use client";
// A GRAPH'S SIZE AND STYLE IN THE BUC VIEW, as buttons - the same on its Actions page and on the tile itself (SARCLA
// 05.11.2026: "we should be able also to switch view and design on the KPI itself"). Size = the placement's format
// (Small tile / Half width / Full width); style = tileStyles' ways to draw the same figures, for a KPI with its months.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import { FAINT, HAIRLINE, MUTED, TINT } from "@/app/uc/report/ui";
import type { TileFormat } from "@/lib/reporting/kpiActions";
import { TILE_STYLES, stylesFor, styleShown, type TileStyle } from "@/lib/reporting/tileStyles";
import { buildViews, upToOf, useMarketingKpis, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { FORMAT_LABEL } from "./store";
import { shapeOf } from "./KpiStyled";

/** The plan's square choices (SubActions.square). */
export const opt = (on: boolean, off = false) => ({
  border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.5, borderRadius: "4px", cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.4 : 1, whiteSpace: "nowrap" as const,
});

/** A KPI of the Digital Growth KPIs: its figures, to draw it in any style. */
export function useKpiView(kpiId: string | undefined): { v: KpiView | null; upTo: string; loading: boolean } {
  const [state] = useMarketingKpis();
  const year = new Date().getFullYear();
  const v = useMemo(() => {
    if (!kpiId || !state?.inputs) return null;
    return buildViews(state.inputs, state.live?.value, year)[kpiId] ?? null;
  }, [kpiId, state, year]);
  return { v, upTo: v && state ? upToOf(v, state, year) : "", loading: !state };
}

/** The sizes it may take in the BUC View. */
export function SizeChoices({ formats, format, disabled, pick }: { formats: TileFormat[]; format: TileFormat; disabled: boolean; pick: (f: TileFormat) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {formats.map((f) => (
        <Box key={f} component="button" type="button" disabled={disabled} aria-pressed={format === f} onClick={() => pick(f)} sx={opt(format === f)}>{FORMAT_LABEL[f]}</Box>
      ))}
    </Box>
  );
}

/** Which styles the KPI can take - read from its figures, so the choices are only those it has. */
export function StyleChoices({ kpiId, format, style, disabled, pick }: { kpiId: string | undefined; format: TileFormat; style: TileStyle | null; disabled: boolean; pick: (s: TileStyle | null) => void }) {
  const { v, loading } = useKpiView(kpiId);
  if (loading) return <CircularProgress size={16} />;
  if (!v) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>This graph keeps its own look - styles are for the KPIs with their figures by month.</Typography>;
  const can = stylesFor(format, shapeOf(v));
  const shown = styleShown(style, format, shapeOf(v));
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      <Box component="button" type="button" disabled={disabled} aria-pressed={!shown} onClick={() => pick(null)} sx={opt(!shown)}>As today</Box>
      {TILE_STYLES.map((s) => {
        const ok = can.includes(s.id);
        return (
          <Box key={s.id} component="button" type="button" disabled={disabled || !ok} aria-pressed={shown === s.id}
            title={ok ? undefined : s.needs === "sum" && shapeOf(v).months ? "Only for a KPI that adds up month by month - not a rate" : format === "tile" ? "Too small for a small tile" : "This KPI has no months to draw"}
            onClick={() => pick(s.id)} sx={opt(shown === s.id, !ok)}>{s.label}</Box>
        );
      })}
    </Box>
  );
}
