"use client";
// A ROW OF THE PLAN, OPENED: every column of the workbook under its own name, changed in place (saved when
// the field is left), its sub-actions, and - for a topic or a group - a new row under it. Sits beside the
// Gantt rather than over it, so the bar moves while the dates are typed.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Portal from "@mui/material/Portal";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { PLAN_STATES, STATE_LABEL, type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanSub, type Rolled } from "@/lib/reporting/actionPlanRules";
import { STATE_COLOR, SUB_COLOR, dmy } from "./planUi";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "10px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const KIND_LABEL: Record<PlanKind, string> = { goal: "The goal", topic: "Topic", group: "Group", action: "Action" };

/** A text field that saves when it is left, and follows the row when someone else changed it. */
function Field({ label, value, onSave, canWrite, multiline = false, rows, half = false }: {
  label: string; value: string; onSave: (v: string) => void; canWrite: boolean; multiline?: boolean; rows?: number; half?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField size="small" label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }}
      disabled={!canWrite} multiline={multiline} minRows={multiline ? rows ?? 2 : undefined} maxRows={multiline ? 14 : undefined}
      sx={{ ...field, gridColumn: half ? "auto" : "1 / -1" }} />
  );
}

/**
 * Who does it - HubSpot's users, picked (SARCLA 01.11.2026: "assignment should be done by user, not names like
 * Sales leader"). The workbook's words stay underneath until somebody is chosen.
 */
function Owners({ item, people, peopleError, canWrite, onSave }: {
  item: PlanItem; people: PlanOwner[]; peopleError: string | null; canWrite: boolean; onSave: (owners: PlanOwner[]) => void;
}) {
  // the people already on it stay choosable even if HubSpot's list has not come
  const options = [...item.owners.filter((o) => !people.some((p) => p.id === o.id)), ...people];
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Autocomplete multiple size="small" options={options} value={item.owners} disabled={!canWrite || (!people.length && !item.owners.length)}
        getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id} filterSelectedOptions
        onChange={(_, v) => onSave(v.map((o) => ({ id: o.id, name: o.name })))}
        renderInput={(p) => <TextField {...p} label="Assigned to" placeholder={item.owners.length ? "" : "Pick the people who do it"} sx={field} />} />
      {item.responsible && (
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
          The workbook says: “{item.responsible}”{item.owners.length ? "" : " - pick the people it means"}
        </Typography>
      )}
      {peopleError && <Typography sx={{ fontSize: "0.78rem", color: RED }}>HubSpot&apos;s users could not be read: {peopleError}</Typography>}
    </Box>
  );
}

export function ItemDrawer({ item, rolled, subs, canWrite, people, peopleError, onClose, onPatch, onSubs, onAdd, onDelete }: {
  item: PlanItem; rolled: Rolled | undefined; subs: PlanSub[]; canWrite: boolean; onClose: () => void;
  people: PlanOwner[]; peopleError: string | null;
  onPatch: (id: number, p: Partial<PlanFields>) => Promise<void>;
  onSubs: (item: PlanItem) => void;
  onAdd: (parent: PlanItem, kind: PlanKind, title: string) => Promise<void>;
  onDelete: (item: PlanItem) => Promise<void>;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const save = (p: Partial<PlanFields>) => void onPatch(item.id, p);
  const action = item.kind === "action";
  const fromSubs = action && subs.length > 0 && item.state !== "done" && item.percent !== 100;
  const [pct, setPct] = useState(item.percent == null ? "" : String(item.percent));
  useEffect(() => { setPct(item.percent == null ? "" : String(item.percent)); }, [item.percent]);
  const [adding, setAdding] = useState<{ kind: PlanKind; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const kinds: PlanKind[] = item.kind === "goal" ? ["topic"] : item.kind === "topic" ? ["action", "group"] : item.kind === "group" ? ["action"] : [];

  return (
    <Portal>
      <Box role="dialog" aria-label={item.title}
        sx={{
          position: "fixed", top: 12, bottom: 12, right: 12, width: "min(500px, calc(100vw - 24px))", zIndex: 1250, display: "flex", flexDirection: "column",
          borderRadius: "20px", bgcolor: "#fbfcfe", border: "1px solid rgba(21,34,58,.08)", boxShadow: "0 24px 60px rgba(21,34,58,.22), 0 4px 14px rgba(21,34,58,.08)", overflow: "hidden",
        }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 2.5, py: 2, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {[KIND_LABEL[item.kind], item.code].filter(Boolean).join(" · ")}
            </Typography>
            <Typography sx={{ fontSize: "1.08rem", fontWeight: 700, color: INK, lineHeight: 1.3, mt: 0.25 }}>{item.title}</Typography>
          </Box>
          {canWrite && item.kind !== "goal" && (
            <IconButton aria-label="Remove this row" onClick={() => void onDelete(item)}><DeleteOutlineIcon sx={{ color: FAINT }} /></IconButton>
          )}
          <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2, display: "grid", gap: 1.5, alignContent: "start" }}>
          {action ? (
            <>
              <Owners item={item} people={people} peopleError={peopleError} canWrite={canWrite} onSave={(owners) => save({ owners })} />
              {/* where it stands */}
              <Typography sx={section}>Progress</Typography>
              <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                {PLAN_STATES.map((s) => {
                  const on = item.state === s;
                  const c = STATE_COLOR[s];
                  return (
                    <Box key={s} component="button" type="button" disabled={!canWrite} onClick={() => !on && save({ state: s })}
                      sx={{ border: `1px solid ${on ? c.bar : HAIRLINE}`, bgcolor: on ? c.bar : "#fff", color: on ? "#fff" : MUTED, font: "inherit", fontSize: "0.82rem", fontWeight: 700, px: 1.3, py: 0.45, borderRadius: 99, cursor: canWrite ? "pointer" : "default" }}>
                      {STATE_LABEL[s]}
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "1fr 1fr 110px" }}>
                <TextField size="small" type="date" label="Start" value={item.start ?? ""} disabled={!canWrite} onChange={(e) => save({ start: e.target.value || null })}
                  sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: item.due ?? undefined } }} />
                <TextField size="small" type="date" label="Due" value={item.due ?? ""} disabled={!canWrite} onChange={(e) => save({ due: e.target.value || null })}
                  sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: item.start ?? undefined } }} />
                <TextField size="small" label="% complete" value={fromSubs ? String(rolled?.percent ?? 0) : pct} disabled={!canWrite || fromSubs}
                  onChange={(e) => setPct(e.target.value)} helperText={fromSubs ? "From its sub-actions" : undefined}
                  onBlur={() => { const s = pct.trim(); const n = s === "" ? null : Math.max(0, Math.min(100, Math.round(Number(s)))); if (n !== item.percent && (n == null || Number.isFinite(n))) save({ percent: n }); }}
                  sx={field} slotProps={{ htmlInput: { inputMode: "numeric" } }} />
              </Box>
              {item.dueNote && <Typography sx={{ fontSize: "0.8rem", color: FAINT, mt: -0.5 }}>Deadline in the workbook: “{item.dueNote}”</Typography>}

              {/* its sub-actions - the KPI tiles' tasks */}
              <Box sx={{ display: "grid", gap: 0.75, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ ...section, flex: 1 }}>Sub-actions{subs.length ? ` · ${subs.filter((s) => s.status === "done").length} of ${subs.length} done` : ""}</Typography>
                  <Button size="small" startIcon={<TaskAltIcon sx={{ fontSize: 18 }} />} onClick={() => onSubs(item)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>
                    {canWrite ? "Add or change" : "Open"}
                  </Button>
                </Box>
                {!subs.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>None yet. A sub-action can be added here or from a KPI tile&apos;s Actions{item.dg ? ", with its Scroll to Sale ticket" : ""}.</Typography>}
                {subs.map((s) => (
                  <Box key={s.id} sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: SUB_COLOR[s.status].bar, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", color: INK, textDecoration: s.status === "done" ? "line-through" : "none" }} noWrap>{s.title}</Typography>
                    {s.kpiHref && <Box component="a" href={s.kpiHref} title="Made on a KPI tile - open it" sx={{ color: TINT.blue.fg, display: "flex" }}><FlagOutlinedIcon sx={{ fontSize: 16 }} /></Box>}
                    <Typography sx={{ fontSize: "0.76rem", color: FAINT, flexShrink: 0 }}>{[s.ownerName, dmy(s.due)].filter(Boolean).join(" · ")}</Typography>
                  </Box>
                ))}
              </Box>

              <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, borderRadius: "14px", border: `1px solid ${item.dg ? TINT.blue.fg : HAIRLINE}`, bgcolor: item.dg ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: item.dg ? TINT.blue.fg : INK }}>Led by Digital Growth</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Its sub-actions can take a “From Scroll to Sale” ticket - the sales actions have no pipeline</Typography>
                </Box>
                <Switch checked={item.dg} disabled={!canWrite} onChange={(e) => save({ dg: e.target.checked })} />
              </Box>
            </>
          ) : (
            <Box sx={{ display: "grid", gap: 0.5, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
              <Typography sx={section}>Underneath</Typography>
              <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                {rolled?.percent == null ? "No progress recorded yet" : `${rolled.percent} % complete on average`}
                {rolled?.from && rolled.to ? ` · ${dmy(rolled.from)} – ${dmy(rolled.to)}` : ""}
              </Typography>
              {(rolled?.late ?? 0) > 0 && <Typography sx={{ fontSize: "0.84rem", color: RED, fontWeight: 600 }}>{rolled!.late} action{rolled!.late === 1 ? "" : "s"} past due</Typography>}
              {(rolled?.subs ?? 0) > 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{rolled!.subs - rolled!.subsOpen} of {rolled!.subs} sub-actions done</Typography>}
            </Box>
          )}

          <Typography sx={{ ...section, mt: 0.5 }}>From the workbook</Typography>
          <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Name" value={item.title} canWrite={canWrite} onSave={(v) => save({ title: v })} />
            <Field label="Action and description of main steps" value={item.detail} canWrite={canWrite} multiline rows={4} onSave={(v) => save({ detail: v })} />
            {action && (
              <>
                <Field half label="Priority" value={item.priority} canWrite={canWrite} onSave={(v) => save({ priority: v })} />
                <Field half label="BUC referent / challenger" value={item.referent} canWrite={canWrite} onSave={(v) => save({ referent: v })} />
              </>
            )}
          </Box>
          {/* the columns the workbook keeps hidden (its tab shows Priority, Topic, Sub task, Action, Responsible, Deadline
              and BUC referent): kept, folded away - never a category of the plan (SARCLA 01.11.2026: "you read wrong main
              categories") */}
          {action && (
            <Box component="details" sx={{ "& > summary": { cursor: "pointer", listStyle: "revert" } }}>
              <Typography component="summary" sx={{ ...section, py: 0.5 }}>Hidden columns of the workbook</Typography>
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "1fr 1fr", pt: 1 }}>
                <Field label="Status of action" value={item.status} canWrite={canWrite} multiline onSave={(v) => save({ status: v })} />
                <Field label="Result of action" value={item.result} canWrite={canWrite} multiline onSave={(v) => save({ result: v })} />
                <Field label="Expected result" value={item.expected} canWrite={canWrite} multiline onSave={(v) => save({ expected: v })} />
                <Field half label="Main topic" value={item.mainTopic} canWrite={canWrite} onSave={(v) => save({ mainTopic: v })} />
                <Field half label="Perimeter" value={item.perimeter} canWrite={canWrite} onSave={(v) => save({ perimeter: v })} />
                <Field half label="Impact of code freeze?" value={item.codeFreeze} canWrite={canWrite} onSave={(v) => save({ codeFreeze: v })} />
                <Field half label="Complexity" value={item.complexity} canWrite={canWrite} onSave={(v) => save({ complexity: v })} />
                <Field half label="Planned release" value={item.release} canWrite={canWrite} onSave={(v) => save({ release: v })} />
              </Box>
            </Box>
          )}

          {canWrite && kinds.length > 0 && (
            <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
              <Typography sx={section}>Add under it</Typography>
              {!adding ? (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {kinds.map((k) => (
                    <Button key={k} variant="outlined" size="small" onClick={() => setAdding({ kind: k, title: "" })} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>
                      New {k}
                    </Button>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField size="small" autoFocus label={`The new ${adding.kind}`} value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} sx={{ ...field, flex: 1 }}
                    onKeyDown={(e) => { if (e.key === "Escape") setAdding(null); }} />
                  <Button variant="contained" disableElevation disabled={busy || !adding.title.trim()}
                    onClick={async () => { setBusy(true); try { await onAdd(item, adding.kind, adding.title); setAdding(null); } finally { setBusy(false); } }}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Add</Button>
                </Box>
              )}
            </Box>
          )}
          <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>
            {item.updatedBy ? `Last changed by ${item.updatedBy}` : ""}
          </Typography>
        </Box>
      </Box>
    </Portal>
  );
}
