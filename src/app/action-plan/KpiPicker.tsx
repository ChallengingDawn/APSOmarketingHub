"use client";
// KPI TRACKING, PICKED (SARCLA 04.11.2026: "KPI tracking should be available at sub-action level, but if put yes - and not
// inherited - a pop-up to select the KPI"): Yes on an action's or a sub-action's KPI tracking asks which KPI it tracks,
// from the KPIs promoted to the plan's KPIs tab (a tile's Actions in Advanced reporting, with its target) - no other list
// of KPIs. Each row picks its own: a sub-action never takes its action's. Cancel leaves it as it was.

import { useId, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { usePlanKpis } from "@/app/reporting/marketing-kpis/tiles/planKpis";
import { PLAN_KPI_TEAMS, targetText } from "@/lib/reporting/planKpiTeams";
import { figureText } from "@/lib/reporting/tileFigure";

/** The row whose KPI tracking is set: an action or a sub-action, and what it tracks now. */
export type TrackTarget = { kind: "item" | "sub"; id: number; title: string; tracked: boolean; kpi: string };
/** What the KPI tracking dropdown asks for: off, or a KPI picked (again). */
export type TrackChoice = "no" | "pick";

/** The dropdown's choices: No, Yes with the KPI's name, another KPI once one is tracked. */
const yesLabel = (title: string) => (title ? `Yes · ${title}` : "Yes");

/** KPI tracking in a window (an action's Details, a sub-action's): the table's dropdown in the forms' style. */
export function KpiTrackingField({ tracked, title, canWrite, onTrack }: { tracked: boolean; title: string; canWrite: boolean; onTrack: (c: TrackChoice) => void }) {
  return (
    <TextField select size="small" label="KPI tracking" value={tracked ? "yes" : "no"} disabled={!canWrite}
      onChange={(e) => onTrack(e.target.value === "no" ? "no" : "pick")} title={tracked && title ? `Tracks “${title}”` : undefined}
      sx={field} slotProps={{ inputLabel: { shrink: true } }}>
      <MenuItem value="no" sx={{ fontSize: "0.86rem" }}>No</MenuItem>
      <MenuItem value="yes" sx={{ fontSize: "0.86rem" }}>{tracked ? yesLabel(title) : "Yes - pick its KPI"}</MenuItem>
      {tracked && <MenuItem value="pick" sx={{ fontSize: "0.86rem", color: MUTED }}>Another KPI…</MenuItem>}
    </TextField>
  );
}

/** Which KPI it tracks: the plan's KPIs, team by team. */
export function KpiPicker({ target, onClose, onPick }: { target: TrackTarget; onClose: () => void; onPick: (k: { key: string; title: string }) => void }) {
  const { state, denied, error } = usePlanKpis(true);
  const heading = useId();
  const [pick, setPick] = useState(target.kpi);
  const kpis = state?.kpis ?? [];
  const chosen = kpis.find((k) => k.key === pick) ?? null;
  return (
    <Dialog open onClose={onClose} maxWidth={false} aria-labelledby={heading}
      slotProps={{ paper: { sx: { width: "min(560px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", m: 2, borderRadius: "14px" } } }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }}>
          KPI tracking · {target.kind === "sub" ? "sub-action" : "action"}
        </Typography>
        <Typography id={heading} sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mt: 0.4 }}>Which KPI does it track?</Typography>
        <Typography noWrap sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25 }}>{target.title}</Typography>
      </Box>
      <Box sx={{ overflowY: "auto", px: 2.5, py: 1.75, display: "grid", gap: 1.5 }}>
        {denied || error ? (
          <Typography sx={{ fontSize: "0.88rem", color: RED }}>{denied ? "Only an admin sees the plan's KPIs." : `The plan's KPIs could not be read: ${error}`}</Typography>
        ) : !state ? (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Reading the plan&apos;s KPIs…</Typography></Box>
        ) : !kpis.length ? (
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography sx={{ fontSize: "0.9rem", color: INK }}>No KPI is on the plan yet.</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>
              A KPI comes to the plan from its tile in Advanced reporting: open its Actions, save its target, then turn on &ldquo;Action plan · KPIs&rdquo;. It can be picked here after that.
            </Typography>
            <Box component={Link} href="/action-plan/kpis" sx={{ fontSize: "0.84rem", fontWeight: 700, color: TINT.blue.fg, width: "fit-content" }}>Open the KPIs tab</Box>
          </Box>
        ) : PLAN_KPI_TEAMS.map((team) => {
          const mine = kpis.filter((k) => k.team === team.id);
          if (!mine.length) return null;
          return (
            <Box key={team.id} sx={{ display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>{team.name}</Typography>
              <Box role="radiogroup" aria-label={team.name} sx={{ display: "grid", gap: 0.5 }}>
                {mine.map((k) => {
                  const on = k.key === pick;
                  const target = state.targets[k.targetKey];
                  const fig = figureText(k.summary);
                  return (
                    <Box key={k.key} component="button" type="button" role="radio" aria-checked={on} onClick={() => setPick(k.key)}
                      sx={{ font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", gap: 1.25, alignItems: "center", px: 1.25, py: 0.9, borderRadius: "8px",
                        border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff" }}>
                      <Box aria-hidden sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, border: `2px solid ${on ? TINT.blue.fg : HAIRLINE}`, boxShadow: on ? `inset 0 0 0 3px #fff` : "none", bgcolor: on ? TINT.blue.fg : "#fff" }} />
                      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: 650, color: INK }}>{k.title}</Typography>
                      <Typography sx={{ flexShrink: 0, fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {fig || "—"}{target != null ? ` · target ${targetText(target, k.unit)}` : ""}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", px: 2.5, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!chosen} onClick={() => chosen && onPick({ key: chosen.key, title: chosen.title })}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}>Track this KPI</Button>
      </Box>
    </Dialog>
  );
}
