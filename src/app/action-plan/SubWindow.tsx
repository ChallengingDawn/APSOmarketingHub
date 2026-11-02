"use client";
// A SUB-ACTION'S OWN WINDOW (SARCLA 02.11.2026: "I click on a sub-action and I'm redirected to the main action - this
// should not happen"). Opened from its row in the Gantt or its line in the action's window: its fields as a small
// action's - status and status note, priority, who, planned and go-live dates, description, who it is shared with, its
// tickets when Digital Growth leads the action - saved as they change; the way back to its action at the top.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";

import { FAINT, HAIRLINE, INK, RED, TINT } from "@/app/uc/report/ui";
import type { PlanItem, PlanOwner } from "@/lib/reporting/actionPlanRules";
import { useTileActions, type Opt } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { SubEditor, planTile } from "./SubActions";

export function SubWindow({ id, parent, people, canWrite, onClose, onOpenParent, onChanged }: {
  id: number; parent: PlanItem; people: PlanOwner[]; canWrite: boolean;
  onClose: () => void; onOpenParent: () => void;
  /** the plan reads itself again */
  onChanged: () => void;
}) {
  const tile = useMemo(() => planTile(parent), [parent.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { t, tasks, err, setErr, loadTasks, loadTickets } = useTileActions(tile, true);
  const k = tasks?.find((x) => x.id === id) ?? null;
  const owners: Opt[] = people.length ? people.map((p) => ({ value: p.id, label: p.name })) : t?.form.owners ?? [];
  const linked = (t?.linked ?? []).filter((x) => x.taskId === id);
  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label="Sub-action"
      slotProps={{ paper: { sx: { width: "min(900px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", m: 2, borderRadius: "16px", bgcolor: "#f7f9fc" } } }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 2.5, pt: 2, pb: 1.5, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline", minWidth: 0 }}>
            <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>Sub-action of</Typography>
            <Box component="button" type="button" onClick={onOpenParent} title="Open the action"
              sx={{ all: "unset", cursor: "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.78rem", fontWeight: 700, color: TINT.blue.fg, "&:hover": { textDecoration: "underline" } }}>
              {parent.title}
            </Box>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 750, color: INK, lineHeight: 1.3, mt: 0.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {k?.title ?? " "}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ overflowY: "auto", p: 2.5, display: "grid", gap: 1.25 }}>
        {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
        {!tasks ? (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", minHeight: 60 }}><CircularProgress size={18} /><Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Reading the sub-action…</Typography></Box>
        ) : !k ? (
          <Typography sx={{ fontSize: "0.9rem", color: FAINT }}>This sub-action is no longer there.</Typography>
        ) : (
          <Box sx={{ p: 2, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <SubEditor k={k} tile={tile} t={t} owners={owners} canWrite={canWrite} tickets={parent.dg} linked={linked}
              saved={async () => { await loadTasks(); onChanged(); }} reload={async () => { await Promise.all([loadTasks(), loadTickets()]); onChanged(); }}
              setErr={setErr} onRemoved={() => { onChanged(); onClose(); }} />
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
