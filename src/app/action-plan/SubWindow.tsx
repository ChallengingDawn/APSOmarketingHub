"use client";
// A SUB-ACTION'S OWN WINDOW (SARCLA 02.11.2026: "I click on a sub-action and I'm redirected to the main action - this
// should not happen"). Opened from its row in the Gantt or its line in the action's window: its fields as a small
// action's - status and status note, priority, who, planned and go-live dates, description, who it is shared with, its
// tickets when Digital Growth leads the action - saved as they change; the way back to its action at the top. It can be
// made an action again, beside the one it was under (SARCLA 02.11.2026: "move a sub-action back into a main action").

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import CallMadeIcon from "@mui/icons-material/CallMade";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { PlanItem, PlanOwner } from "@/lib/reporting/actionPlanRules";
import { useTileActions, type Opt } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import { SubEditor, planTile } from "./SubActions";

export function SubWindow({ id, parent, people, canWrite, onClose, onOpenParent, onChanged, onMadeAction, onDuplicated }: {
  id: number; parent: PlanItem; people: PlanOwner[]; canWrite: boolean;
  onClose: () => void; onOpenParent: () => void;
  /** made an action again: the plan opens it */
  onMadeAction: (itemId: number) => void;
  /** a copy made beside it: the plan opens it (SARCLA 02.11.2026: "duplicate and drag and drop") */
  onDuplicated: (id: number) => void;
  /** the plan reads itself again */
  onChanged: () => void;
}) {
  const tile = useMemo(() => planTile(parent), [parent.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { t, tasks, err, setErr, loadTasks, loadTickets } = useTileActions(tile, true);
  const k = tasks?.find((x) => x.id === id) ?? null;
  const owners: Opt[] = people.length ? people.map((p) => ({ value: p.id, label: p.name })) : t?.form.owners ?? [];
  const linked = (t?.linked ?? []).filter((x) => x.taskId === id);
  const [busy, setBusy] = useState(false);
  // a copy under the same action - to drag where it also serves
  const duplicate = async () => {
    if (!k) return;
    setBusy(true);
    try { const j = await send("/api/action-plan", "POST", { action: "copysub", taskId: k.id, target: parent.id }); onDuplicated((j.task as { id: number }).id); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  // an action of its own again, in the category its action is in
  const back = async () => {
    if (!k || parent.parentId == null || !confirm(`Make “${k.title}” an action of its own again, beside “${parent.title}”?

Its name, description, status, priority, person, dates, status note and tickets go with it.`)) return;
    setBusy(true);
    try { const j = await send("/api/action-plan", "POST", { action: "unsub", taskId: k.id, target: parent.parentId }); onMadeAction((j.item as PlanItem).id); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
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
        {canWrite && k && (
          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} disabled={busy} onClick={() => void duplicate()} title="A copy under the same action - drag it onto the action it also serves"
            sx={{ textTransform: "none", fontWeight: 700, color: MUTED, borderRadius: "6px", whiteSpace: "nowrap" }}>Duplicate</Button>
        )}
        {canWrite && k && k.tile.startsWith("plan:") && parent.parentId != null && (
          <Button size="small" startIcon={<CallMadeIcon sx={{ fontSize: 17 }} />} disabled={busy} onClick={() => void back()}
            sx={{ textTransform: "none", fontWeight: 700, color: MUTED, borderRadius: "6px", whiteSpace: "nowrap" }}>Make it an action again</Button>
        )}
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
