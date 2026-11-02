"use client";
// A SUB-ACTION DUPLICATED ONTO ANOTHER ACTION (SARCLA 02.11.2026: "the duplicate should also be an icon next to the plus;
// it should not create a new ticket but keep the same, associated to a different action"). Opened from the icon on its
// Gantt row or "Duplicate" in its window: the action it also serves is picked here, and the copy goes under it with the
// sub-action's fields and its ticket - the same ticket, kept in step with both (actionPlan.copySub).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";

import { FAINT, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { treeOrder, type PlanItem, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { send } from "./planUi";

const TAG = { px: 0.6, py: 0.1, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1.5, flexShrink: 0 } as const;

export function DuplicateSub({ sub, parent, items, onClose, onDone }: {
  sub: PlanSub; parent: PlanItem; items: PlanItem[];
  onClose: () => void;
  /** made: the copy, the action it went under, how many tickets it shares */
  onDone: (copyId: number, to: PlanItem, tickets: number) => void;
}) {
  // every other action, under its category's path, in the plan's order
  const { options, pathOf } = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const path = new Map<number, string>();
    const pathOf = (a: PlanItem) => {
      if (!path.has(a.id)) {
        const up: string[] = [];
        for (let p = a.parentId == null ? undefined : byId.get(a.parentId); p && up.length < 5; p = p.parentId == null ? undefined : byId.get(p.parentId)) if (p.kind !== "goal") up.unshift(p.title);
        path.set(a.id, up.join(" › "));
      }
      return path.get(a.id)!;
    };
    const acts = treeOrder(items).filter((i) => i.kind === "action" && i.id !== parent.id);
    // one heading per category: its actions together, in the order the first of them comes
    const first = new Map<string, number>();
    acts.forEach((a, k) => { if (!first.has(pathOf(a))) first.set(pathOf(a), k); });
    const options = acts.map((a, k) => ({ a, k })).sort((x, y) => first.get(pathOf(x.a))! - first.get(pathOf(y.a))! || x.k - y.k).map((x) => x.a);
    return { options, pathOf };
  }, [items, parent.id]);
  const [to, setTo] = useState<PlanItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loses = sub.tickets > 0 && !!to && !to.dg;
  const go = async () => {
    if (!to) return;
    setBusy(true); setErr(null);
    try {
      const j = await send("/api/action-plan", "POST", { action: "copysub", taskId: sub.id, target: to.id });
      onDone((j.task as { id: number }).id, to, Number(j.tickets ?? 0));
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} slotProps={{ paper: { sx: { width: "min(600px, calc(100vw - 32px))", m: 2, borderRadius: "14px", p: 2.25, display: "grid", gap: 1.5 } } }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>Duplicate</Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 750, color: INK, lineHeight: 1.35 }}>Which other action does “{sub.title}” serve?</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>
        The copy goes under the action you pick, with the same name, description, status, priority, person, dates and status note.
        {sub.tickets > 0 && " It keeps the same ticket - no new one is made - so a change on either sub-action or on the ticket reaches all three."}
      </Typography>
      <Autocomplete size="small" options={options} value={to} onChange={(_, v) => setTo(v)} groupBy={pathOf} getOptionLabel={(o) => o.title} isOptionEqualToValue={(a, b) => a.id === b.id}
        autoHighlight
        renderOption={({ key, ...p }, o) => (
          <Box component="li" key={key} {...p} sx={{ display: "flex", gap: 1, alignItems: "center", fontSize: "0.86rem" }}>
            <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{o.title}</Box>
            {o.dg && <Box component="span" sx={{ ...TAG, bgcolor: TINT.blue.bg, color: TINT.blue.fg }}>DG</Box>}
          </Box>
        )}
        renderInput={(p) => <TextField {...p} autoFocus label="Action" placeholder="Search the actions" slotProps={{ inputLabel: { shrink: true } }} />} />
      {loses && <Typography sx={{ fontSize: "0.82rem", color: TINT.amber.fg, lineHeight: 1.45 }}>“{to!.title}” is not led by Digital Growth: the copy goes under it without the ticket.</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: RED }}>{err ?? ""}</Typography>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={busy || !to} onClick={() => void go()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
          {busy ? "Duplicating…" : "Duplicate here"}
        </Button>
      </Box>
    </Dialog>
  );
}
