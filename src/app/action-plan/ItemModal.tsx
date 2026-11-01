"use client";
// A ROW OF THE PLAN, OPENED - a full modal per action with its tracking and its KPIs (SARCLA 01.11.2026: "in a
// full modal per action with tracking and KPI"). The fields are the "From Scroll to Sale" ticket's, the ones made
// with the agency (01.11.2026: "follow at the maximum what we use on the From Scroll to Sale pipeline ... copy the
// HubSpot one and delete those not needed"): the pipeline's stages, HubSpot's priorities, planned and go-live
// dates, channels, countries, agency, roadmap year, KPIs, next steps, status note, report link. Where the ticket
// picks a business goal ("Awareness"), an action picks its place in the plan's tree. Each field saves when it is
// left; every change lands in the tracking on the right.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import HistoryIcon from "@mui/icons-material/History";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { PRIORITIES, STAGES, isClosed, type Opt, type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanSub, type Rolled } from "@/lib/reporting/actionPlanRules";
import { PRIORITY_COLOR, SUB_COLOR, dmy, stageColor, type PlanData } from "./planUi";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const card = { display: "grid", gap: 1.25, p: 2, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, alignContent: "start" } as const;
export const KIND_LABEL: Record<PlanKind, string> = { goal: "The goal", topic: "Main category", group: "Sub-category", action: "Action" };
/** A square choice, as the tags (SARCLA 01.11.2026: "tags not round, square"). */
const square = (on: boolean, fg: string, bg: string, can: boolean) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.8rem",
  fontWeight: on ? 800 : 600, px: 1.1, py: 0.45, borderRadius: "4px", cursor: can ? "pointer" : "default", whiteSpace: "nowrap" as const,
});

/** A text field that saves when it is left, and follows the row when someone else changed it. */
function Field({ label, value, onSave, canWrite, multiline = false, rows, placeholder, span = true }: {
  label: string; value: string; onSave: (v: string) => void; canWrite: boolean; multiline?: boolean; rows?: number; placeholder?: string; span?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField size="small" label={label} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }}
      disabled={!canWrite} multiline={multiline} minRows={multiline ? rows ?? 2 : undefined} maxRows={multiline ? 16 : undefined}
      sx={{ ...field, gridColumn: span ? "1 / -1" : "auto" }} slotProps={{ inputLabel: { shrink: true } }} />
  );
}

/** The name, large, saved when it is left. */
function Title({ value, canWrite, onSave }: { value: string; canWrite: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField variant="standard" fullWidth multiline maxRows={3} value={v} disabled={!canWrite} aria-label="Name"
      onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim() && v !== value) onSave(v); else setV(value); }}
      sx={{ mt: 0.5, "& .MuiInputBase-root": { fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.3 }, "& .MuiInput-underline:before": { borderBottomColor: "transparent" } }} />
  );
}

/** A date saved when it is left - typing the year does not save 0002, 0020, 0202 on the way. */
function DateField({ label, value, min, max, canWrite, onSave }: { label: string; value: string | null; min?: string | null; max?: string | null; canWrite: boolean; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <TextField size="small" type="date" label={label} value={v} disabled={!canWrite} onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = v || null; if (n !== value) onSave(n); }}
      sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: min ?? undefined, max: max ?? undefined } }} />
  );
}

/** Several of the ticket's choices, as square toggles. */
function Choices({ label, options, value, canWrite, onSave }: { label: string; options: Opt[]; value: string[]; canWrite: boolean; onSave: (v: string[]) => void }) {
  // a value HubSpot no longer offers stays visible until it is taken off
  const all = [...options, ...value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))];
  return (
    <Box sx={{ display: "grid", gap: 0.6, gridColumn: "1 / -1" }}>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {all.map((o) => {
          const on = value.includes(o.value);
          return (
            <Box key={o.value} component="button" type="button" aria-pressed={on} disabled={!canWrite}
              onClick={() => onSave(on ? value.filter((x) => x !== o.value) : [...value, o.value])} sx={square(on, TINT.blue.fg, TINT.blue.bg, canWrite)}>
              {o.label}
            </Box>
          );
        })}
      </Box>
    </Box>
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
    <Box sx={{ display: "grid", gap: 0.5, gridColumn: "1 / -1" }}>
      <Autocomplete multiple size="small" options={options} value={item.owners} disabled={!canWrite || (!people.length && !item.owners.length)}
        getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id} filterSelectedOptions
        onChange={(_, v) => onSave(v.map((o) => ({ id: o.id, name: o.name })))}
        renderInput={(p) => <TextField {...p} label="Assigned to" placeholder={item.owners.length ? "" : "Pick the people who do it"} sx={field} />} />
      {item.responsible && !item.owners.length && (
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>The workbook says: “{item.responsible}” - pick the people it means</Typography>
      )}
      {peopleError && <Typography sx={{ fontSize: "0.78rem", color: RED }}>HubSpot&apos;s users could not be read: {peopleError}</Typography>}
    </Box>
  );
}

type LogLine = { at: string; by: string; field: string; before: string; after: string };
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** The tracking: every change to the row, newest first. */
function Tracking({ id, tick }: { id: number; tick: number }) {
  const [lines, setLines] = useState<LogLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/action-plan?log=${id}`).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      if (live) { setLines(j.log as LogLine[]); setErr(null); }
    }).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [id, tick]);
  return (
    <Box sx={card}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <HistoryIcon sx={{ fontSize: 18, color: FAINT }} />
        <Typography sx={section}>Tracking</Typography>
      </Box>
      {err && <Typography sx={{ fontSize: "0.82rem", color: RED }}>The changes could not be read: {err}</Typography>}
      {lines && !lines.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No change since the workbook was loaded.</Typography>}
      <Box sx={{ display: "grid", gap: 1, maxHeight: 360, overflowY: "auto" }}>
        {(lines ?? []).map((l, k) => (
          <Box key={k} sx={{ display: "grid", gridTemplateColumns: "8px 1fr", gap: 1, alignItems: "start" }}>
            <Box sx={{ width: 8, height: 8, mt: 0.7, borderRadius: "2px", bgcolor: TINT.blue.fg, opacity: 0.6 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.4 }}>
                <b>{l.field}</b>{l.field === "Created" ? ` ${l.after}` : <>: {l.before ? <Box component="span" sx={{ color: FAINT, textDecoration: "line-through" }}>{l.before.slice(0, 120)}</Box> : null}{l.before ? " → " : ""}{l.after ? l.after.slice(0, 160) : <i>cleared</i>}</>}
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{[when(l.at), l.by].filter(Boolean).join(" · ")}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ItemModal({ item, items, rolled, subs, canWrite, people, peopleError, choices, onClose, onPatch, onSubs, onAdd, onDelete, onMoveTo }: {
  item: PlanItem; items: PlanItem[]; rolled: Rolled | undefined; subs: PlanSub[]; canWrite: boolean; onClose: () => void;
  people: PlanOwner[]; peopleError: string | null; choices: PlanData["choices"];
  onPatch: (id: number, p: Partial<PlanFields>) => Promise<void>;
  onSubs: (item: PlanItem) => void;
  onAdd: (parent: PlanItem, kind: PlanKind, title: string) => Promise<void>;
  onDelete: (item: PlanItem) => Promise<void>;
  onMoveTo: (item: PlanItem, parentId: number) => Promise<void>;
}) {
  const [tick, setTick] = useState(0);
  const save = (p: Partial<PlanFields>) => { void onPatch(item.id, p).then(() => setTick((t) => t + 1)); };
  const action = item.kind === "action";
  const fromSubs = action && subs.length > 0 && !isClosed(item.stage) && item.percent !== 100;
  const [pct, setPct] = useState(item.percent == null ? "" : String(item.percent));
  useEffect(() => { setPct(item.percent == null ? "" : String(item.percent)); }, [item.percent]);
  const [adding, setAdding] = useState<{ kind: PlanKind; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const kinds: PlanKind[] = item.kind === "goal" ? ["topic"] : item.kind === "topic" ? ["group", "action"] : item.kind === "group" ? ["action"] : [];

  // its place in the plan: the path above it, and the categories it may move to (the ticket's "business goal",
  // as a tree from the plan - SARCLA 01.11.2026: "where today I select Awareness, this should be a tree from the plan")
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const path: PlanItem[] = [];
  for (let p = item.parentId != null ? byId.get(item.parentId) : undefined; p && path.length < 8; p = p.parentId != null ? byId.get(p.parentId) : undefined) path.unshift(p);
  const places = useMemo(() => {
    if (item.kind === "goal" || item.kind === "topic") return [];
    const out: { id: number; label: string; depth: number }[] = [];
    const topics = items.filter((i) => i.kind === "topic").sort((a, b) => a.sort - b.sort || a.id - b.id);
    for (const t of topics) {
      out.push({ id: t.id, label: t.title, depth: 0 });
      if (item.kind === "action") {
        for (const g of items.filter((i) => i.parentId === t.id && i.kind === "group").sort((a, b) => a.sort - b.sort || a.id - b.id)) out.push({ id: g.id, label: g.title, depth: 1 });
      }
    }
    return out;
  }, [items, item.kind]);
  // KPI tiles it is tied to: the sub-actions made on a tile
  const tiles = subs.filter((s) => s.kpiHref);
  const done = subs.filter((s) => s.status === "done").length;
  const pctShown = fromSubs ? rolled?.percent ?? 0 : action ? item.percent : rolled?.percent;

  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label={item.title}
      slotProps={{ paper: { sx: { width: "min(1320px, calc(100vw - 32px))", height: "calc(100vh - 32px)", maxHeight: "none", m: 2, borderRadius: "18px", bgcolor: "#f7f9fc", overflow: "hidden", display: "flex", flexDirection: "column" } } }}>
      {/* ── the head: where it sits, its name, its stage ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.25, pb: 1.75, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {[KIND_LABEL[item.kind], item.code].filter(Boolean).join(" · ")}
              {path.filter((p) => p.kind !== "goal").length > 0 && <Box component="span" sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}> · {path.filter((p) => p.kind !== "goal").map((p) => p.title).join(" › ")}</Box>}
            </Typography>
            <Title value={item.title} canWrite={canWrite} onSave={(v) => save({ title: v })} />
          </Box>
          {canWrite && item.kind !== "goal" && (
            <IconButton aria-label="Remove this row" title="Remove this row" onClick={() => void onDelete(item)}><DeleteOutlineIcon sx={{ color: FAINT }} /></IconButton>
          )}
          <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
        </Box>
        {action && (
          // the pipeline's stages, in its order
          <Box role="radiogroup" aria-label="Status" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {STAGES.map((s) => {
              const on = item.stage === s.id;
              const c = stageColor(s.id);
              return (
                <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} disabled={!canWrite} onClick={() => !on && save({ stage: s.id })}
                  sx={{ ...square(on, c.ink, c.soft, canWrite), ...(on ? { bgcolor: c.bar, color: "#fff", borderColor: c.bar } : {}) }}>
                  {s.label}
                </Box>
              );
            })}
            {!item.stage && <Typography sx={{ fontSize: "0.78rem", color: FAINT, alignSelf: "center", ml: 0.5 }}>No status yet</Typography>}
          </Box>
        )}
      </Box>

      {/* ── the body ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2.25, display: "grid", gap: 2.25, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.55fr) minmax(0, 1fr)" } }}>
        <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
          <Box sx={{ ...card, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <Typography sx={{ ...section, gridColumn: "1 / -1" }}>{action ? "The action" : "About it"}</Typography>
            <Field label="Description" value={item.detail} canWrite={canWrite} multiline rows={4} onSave={(v) => save({ detail: v })} />
            {action && (
              <>
                <Owners item={item} people={people} peopleError={peopleError} canWrite={canWrite} onSave={(owners) => save({ owners })} />
                <Box sx={{ display: "grid", gap: 0.6, gridColumn: "1 / -1" }}>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600 }}>Priority</Typography>
                  <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                    {[...PRIORITIES].reverse().map((p) => {
                      const on = item.priority === p.value;
                      const c = PRIORITY_COLOR[p.value];
                      return <Box key={p.value} component="button" type="button" aria-pressed={on} disabled={!canWrite} onClick={() => save({ priority: on ? "" : p.value })} sx={square(on, c.fg, c.bg, canWrite)}>{p.label}</Box>;
                    })}
                  </Box>
                </Box>
                <Box sx={{ display: "grid", gap: 1.25, gridColumn: "1 / -1", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 120px" } }}>
                  <DateField label="Planned date" value={item.start} max={item.due} canWrite={canWrite} onSave={(v) => save({ start: v })} />
                  <DateField label="Go-live date" value={item.due} min={item.start} canWrite={canWrite} onSave={(v) => save({ due: v })} />
                  <TextField size="small" label="% complete" value={fromSubs ? String(rolled?.percent ?? 0) : pct} disabled={!canWrite || fromSubs}
                    onChange={(e) => setPct(e.target.value)} helperText={fromSubs ? "From its sub-actions" : undefined}
                    onBlur={() => { const s = pct.trim(); const n = s === "" ? null : Math.max(0, Math.min(100, Math.round(Number(s)))); if (n !== item.percent && (n == null || Number.isFinite(n))) save({ percent: n }); }}
                    sx={field} slotProps={{ htmlInput: { inputMode: "numeric" }, inputLabel: { shrink: true } }} />
                </Box>
                {item.dueNote && <Typography sx={{ gridColumn: "1 / -1", fontSize: "0.8rem", color: FAINT, mt: -0.5 }}>Deadline in the workbook: “{item.dueNote}”</Typography>}
              </>
            )}
            {places.length > 0 && (
              <TextField select size="small" label={action ? "Business goal - its place in the plan" : "Main category"} value={item.parentId ?? ""} disabled={!canWrite}
                onChange={(e) => { const to = Number(e.target.value); if (to && to !== item.parentId) void onMoveTo(item, to).then(() => setTick((t) => t + 1)); }}
                sx={{ ...field, gridColumn: "1 / -1" }} slotProps={{ inputLabel: { shrink: true } }}>
                {places.map((p) => (
                  <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.86rem", pl: 2 + p.depth * 2.5, fontWeight: p.depth ? 500 : 700 }}>{p.label}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          {action && (
            <Box sx={{ ...card, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              <Typography sx={{ ...section, gridColumn: "1 / -1" }}>As on the Scroll to Sale ticket</Typography>
              <Choices label="Marketing channel" options={choices.channel} value={item.channel} canWrite={canWrite} onSave={(v) => save({ channel: v })} />
              <Choices label="Implementation country" options={choices.country} value={item.country} canWrite={canWrite} onSave={(v) => save({ country: v })} />
              <Choices label="Agency" options={choices.agency} value={item.agency} canWrite={canWrite} onSave={(v) => save({ agency: v })} />
              <TextField select size="small" label="Roadmap year" value={item.roadmapYear} disabled={!canWrite} onChange={(e) => save({ roadmapYear: e.target.value })}
                sx={field} slotProps={{ inputLabel: { shrink: true } }}>
                <MenuItem value="" sx={{ fontSize: "0.86rem", color: FAINT }}>None</MenuItem>
                {[...choices.roadmapYear, ...(item.roadmapYear && !choices.roadmapYear.some((o) => o.value === item.roadmapYear) ? [{ value: item.roadmapYear, label: item.roadmapYear }] : [])].map((o) => (
                  <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.86rem" }}>{o.label}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Roadmap ID" value={item.code} disabled helperText="The workbook's number" sx={field} slotProps={{ inputLabel: { shrink: true } }} />
              <Field label="Next steps / milestones" value={item.nextSteps} canWrite={canWrite} multiline rows={3} onSave={(v) => save({ nextSteps: v })} />
              <Field label="Status note" value={item.statusNote} canWrite={canWrite} multiline rows={3} onSave={(v) => save({ statusNote: v })} />
              <Field span={false} label="Referent / challenger" value={item.referent} canWrite={canWrite} onSave={(v) => save({ referent: v })} />
            </Box>
          )}

          {canWrite && kinds.length > 0 && (
            <Box sx={card}>
              <Typography sx={section}>Add under it</Typography>
              {!adding ? (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {kinds.map((k) => (
                    <Button key={k} variant="outlined" size="small" onClick={() => setAdding({ kind: k, title: "" })} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
                      New {KIND_LABEL[k].toLowerCase()}
                    </Button>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField size="small" autoFocus label={`The new ${KIND_LABEL[adding.kind].toLowerCase()}`} value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} sx={{ ...field, flex: 1 }}
                    onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAdding(null); } }} />
                  <Button variant="contained" disableElevation disabled={busy || !adding.title.trim()}
                    onClick={async () => { setBusy(true); try { await onAdd(item, adding.kind, adding.title); setAdding(null); } finally { setBusy(false); } }}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>Add</Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── the right: how it is measured, its sub-actions, its tracking ── */}
        <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
          <Box sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <InsightsOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
              <Typography sx={section}>KPI</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontSize: "1.9rem", fontWeight: 800, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{pctShown == null ? "—" : `${pctShown} %`}</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                complete{rolled?.late ? ` · ${rolled.late} late` : ""}{(rolled?.subs ?? 0) > 0 ? ` · ${rolled!.subs - rolled!.subsOpen} of ${rolled!.subs} sub-actions done` : ""}
              </Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: "2px", bgcolor: "#eef1f6", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${Math.max(0, Math.min(100, pctShown ?? 0))}%`, bgcolor: action ? stageColor(item.stage).bar : TINT.blue.fg }} />
            </Box>
            {!action && rolled?.from && rolled.to && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{dmy(rolled.from)} – {dmy(rolled.to)}</Typography>}
            {action && (
              <>
                <Field label="KPIs - how it is measured" value={item.kpis} canWrite={canWrite} multiline rows={3} onSave={(v) => save({ kpis: v })} />
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1 }}><Field label="Report link" value={item.reportLink} placeholder="https://" canWrite={canWrite} onSave={(v) => save({ reportLink: v.trim() })} /></Box>
                  {/^https?:\/\//i.test(item.reportLink) && (
                    <IconButton component="a" href={item.reportLink} target="_blank" rel="noreferrer" aria-label="Open the report" sx={{ mt: 0.25 }}><OpenInNewIcon sx={{ fontSize: 18 }} /></IconButton>
                  )}
                </Box>
                <Box sx={{ display: "grid", gap: 0.5 }}>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600 }}>KPI tiles it is tied to</Typography>
                  {!tiles.length && <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>None yet - a KPI tile&apos;s Actions can add a sub-action to it.</Typography>}
                  {tiles.map((s) => (
                    <Box key={s.id} component="a" href={s.kpiHref} sx={{ display: "flex", gap: 0.75, alignItems: "center", color: TINT.blue.fg, textDecoration: "none", fontSize: "0.84rem", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                      <FlagOutlinedIcon sx={{ fontSize: 16 }} />{s.title}
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>

          {action && (
            <Box sx={card}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ ...section, flex: 1 }}>Sub-actions{subs.length ? ` · ${done} of ${subs.length} done` : ""}</Typography>
                <Button size="small" startIcon={<TaskAltIcon sx={{ fontSize: 18 }} />} onClick={() => onSubs(item)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
                  {canWrite ? "Add or change" : "Open"}
                </Button>
              </Box>
              {!subs.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>None yet. A sub-action can be added here or from a KPI tile&apos;s Actions{item.dg ? ", with its Scroll to Sale ticket" : ""}.</Typography>}
              {subs.map((s) => (
                <Box key={s.id} sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: SUB_COLOR[s.status].bar, flexShrink: 0 }} />
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", color: INK, textDecoration: s.status === "done" ? "line-through" : "none" }} noWrap>{s.title}</Typography>
                  {s.tickets > 0 && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: TINT.amber.fg }}>{s.tickets} ticket{s.tickets === 1 ? "" : "s"}</Typography>}
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT, flexShrink: 0 }}>{[s.ownerName, dmy(s.due)].filter(Boolean).join(" · ")}</Typography>
                </Box>
              ))}
              <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, mt: 0.5, borderRadius: "8px", border: `1px solid ${item.dg ? TINT.blue.fg : HAIRLINE}`, bgcolor: item.dg ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: item.dg ? TINT.blue.fg : INK }}>Led by Digital Growth</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Its sub-actions can take a “From Scroll to Sale” ticket - the sales actions have no pipeline</Typography>
                </Box>
                <Switch checked={item.dg} disabled={!canWrite} onChange={(e) => save({ dg: e.target.checked })} />
              </Box>
            </Box>
          )}

          <Tracking id={item.id} tick={tick} />
        </Box>
      </Box>
    </Dialog>
  );
}
