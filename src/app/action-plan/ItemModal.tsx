"use client";
// A ROW OF THE PLAN, OPENED - a full modal per action with its tracking and its KPIs (SARCLA 01.11.2026: "in a
// full modal per action with tracking and KPI"). The fields are the "From Scroll to Sale" ticket's, the ones made
// with the agency (01.11.2026: "follow at the maximum what we use on the From Scroll to Sale pipeline ... copy the
// HubSpot one and delete those not needed"): the pipeline's stages, HubSpot's priorities, planned and go-live
// dates, channels, countries, agency, roadmap year, KPIs, next steps, status note (no report link - 02.11.2026). Where the ticket
// picks a business goal ("Awareness"), an action picks its place in the plan's tree. Each field saves when it is
// left; every change lands in the tracking on the right.
// Two views, switched at the top like Map assignment's Live | Sandbox (SARCLA 01.11.2026: "KPI should be a toggle like
// in map assignment - this KPI will be fed by the KPI actions later"): Overview and KPI. A main category or a
// sub-category shows everything in it as square tiles to open ("list everything like an interactive bubble", then
// "improve the design and UX - square tabs").
// The window takes the whole screen but a margin ("modal way larger"); an action's sub-actions are made, described to
// the AI and given their tickets in it, not in a second window over it ("sub-action creation still holds the old
// modal"), its form open from the start ("when I click [an action] I should see creating directly a sub-action").
// "Led by Digital Growth" opens the ticket search, the marketing channel and the agency.
// A category's window is its tiles alone, the whole width, a + tile to add under it ("kanban is broken ... the side
// is not needed, new action should be the +"); it moves by drag and drop in the Gantt. Its changes are in the KPI view.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HistoryIcon from "@mui/icons-material/History";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { BUC_MEMBERS, KILLED, PRIORITIES, STAGES, isClosed, isLate, priorityLabel, stageOf, type Opt, type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanSub, type Rolled } from "@/lib/reporting/actionPlanRules";
import { LATE, PRIORITY_COLOR, SUMMARY, dmy, stageColor, todayIso, type PlanData } from "./planUi";
import { ActionTicket, SubActions, planTile, wholeDay } from "./SubActions";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const card = { display: "grid", gap: 1.25, p: 2, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, alignContent: "start" } as const;
export const KIND_LABEL: Record<PlanKind, string> = { goal: "The goal", topic: "Main category", group: "Sub-category", action: "Action" };
/** A square choice, as the tags (SARCLA 01.11.2026: "tags not round, square"). */
const square = (on: boolean, fg: string, bg: string, can: boolean) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.8rem",
  fontWeight: on ? 800 : 600, px: 1.1, py: 0.45, borderRadius: "4px", cursor: can ? "pointer" : "default", whiteSpace: "nowrap" as const,
});
const byOrder = (a: PlanItem, b: PlanItem) => a.sort - b.sort || a.id - b.id;
/** A tag, square as the Gantt's. */
const TAG = { flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px" } as const;
/** The tiles' grid: as many columns as the window holds. */
const TILES = { display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" } as const;

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
/** A date handed up as soon as it is a whole one, or when it is left - one picked and the window closed is kept
 *  (SARCLA 02.11.2026: "planned, go-live dates are not updating"). */
function DateField({ label, value, min, max, canWrite, onSave }: { label: string; value: string | null; min?: string | null; max?: string | null; canWrite: boolean; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  const sent = useRef(value);
  useEffect(() => { setV(value ?? ""); sent.current = value; }, [value]);
  const hand = (x: string) => { const n = x || null; if (n !== sent.current) { sent.current = n; onSave(n); } };
  return (
    <TextField size="small" type="date" label={label} value={v} disabled={!canWrite} onChange={(e) => { setV(e.target.value); if (wholeDay(e.target.value)) hand(e.target.value); }}
      onBlur={() => hand(v)}
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

/**
 * The referent / challenger: one of the BUC's members, as HubSpot's users (SARCLA 01.11.2026: "should be a BUC member -
 * Alexandre, Claudio, Bernd, Marc or Rose - like a user"). Kept by name; a name typed before stays until it is changed.
 */
function Referent({ value, people, canWrite, onSave }: { value: string; people: PlanOwner[]; canWrite: boolean; onSave: (v: string) => void }) {
  const names = BUC_MEMBERS.map((m) => people.find((p) => p.id === m.id)?.name ?? m.name);
  const old = value && !names.includes(value) ? value : "";
  return (
    <TextField select size="small" label="Referent / challenger" value={value} disabled={!canWrite} onChange={(e) => onSave(e.target.value)}
      helperText={old ? "From the workbook - pick the BUC member it means" : "A BUC member"} sx={field} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
      <MenuItem value="" sx={{ fontSize: "0.86rem", color: FAINT }}>Nobody yet</MenuItem>
      {names.map((n) => <MenuItem key={n} value={n} sx={{ fontSize: "0.86rem" }}>{n}</MenuItem>)}
      {old && <MenuItem value={old} sx={{ fontSize: "0.86rem", color: FAINT }}>{old}</MenuItem>}
    </TextField>
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

type View = "overview" | "kpi";
/** Overview | KPI, at the top - Map assignment's Live | Sandbox switch (SARCLA 01.11.2026: "KPI should be a toggle like in map assignment"). */
function ViewSwitch({ view, setView }: { view: View; setView: (v: View) => void }) {
  const btn = (v: View, label: string, icon: React.ReactNode, color: string) => {
    const on = view === v;
    return (
      <Box component="button" type="button" onClick={() => setView(v)} aria-pressed={on}
        sx={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.75, py: 0.75, fontSize: "0.9rem", fontWeight: 700,
          color: on ? "#fff" : color, bgcolor: on ? color : "transparent", transition: "background-color .12s",
          "&:hover": { bgcolor: on ? color : "rgba(21,34,58,.05)" }, "&:focus-visible": { outline: `2px solid ${color}`, outlineOffset: -2 },
        }}>
        {icon}{label}
      </Box>
    );
  };
  return (
    <Box role="group" aria-label="Overview or KPI" sx={{ display: "inline-flex", flexShrink: 0, border: "1px solid rgba(21,34,58,.16)", borderRadius: "12px", overflow: "hidden", bgcolor: "#fff", boxShadow: "0 1px 4px rgba(31,45,78,.08)" }}>
      {btn("overview", "Overview", <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />, "#2459d1")}
      {btn("kpi", "KPI", <InsightsOutlinedIcon sx={{ fontSize: 18 }} />, "#1b7a55")}
    </Box>
  );
}

/** Every action under a row, at any depth. */
function actionsUnder(id: number, items: PlanItem[]): PlanItem[] {
  const out: PlanItem[] = [];
  const walk = (p: number, n: number) => {
    if (n > 8) return;
    for (const c of items.filter((i) => i.parentId === p).sort(byOrder)) { if (c.kind === "action") out.push(c); else walk(c.id, n + 1); }
  };
  walk(id, 0);
  return out;
}

/**
 * A row as a square tile (SARCLA 01.11.2026: "improve the design and UX - square tabs"): its status as the left edge and
 * a tag, its priority, its name on up to two lines, go-live and who, its % as a bar; hover for the description, click to
 * open it. A category's tile shows how many actions it holds.
 */
function Tile({ row, r, items, color, onOpen, today }: { row: PlanItem; r: Rolled | undefined; items: PlanItem[]; color: string | null; onOpen: (i: PlanItem) => void; today: string }) {
  const action = row.kind === "action";
  const c = stageColor(row.stage);
  const late = action ? (isLate(row, today) ? 1 : 0) : r?.late ?? 0;
  const n = action ? 0 : actionsUnder(row.id, items).length;
  const pct = r?.percent ?? (action ? row.percent ?? 0 : 0);
  const edge = action ? c.bar : color ?? SUMMARY;
  const prio = action ? priorityLabel(row.priority) : "";
  const meta = action ? [row.due ? `Go-live ${dmy(row.due)}` : "", row.owners.map((o) => o.name).join(", ")].filter(Boolean) : [`${n} action${n === 1 ? "" : "s"}`];
  const tip = row.detail && row.detail !== row.title ? <Box sx={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: 280, overflow: "hidden" }}>{row.detail}</Box> : row.title;
  return (
    <Tooltip title={tip} placement="top" enterDelay={600} disableInteractive>
      <Box component="button" type="button" onClick={() => onOpen(row)} aria-label={`Open ${row.title}`}
        sx={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "grid", gridTemplateRows: "auto 1fr auto", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.75, minWidth: 0, minHeight: 96,
          p: 1.25, pl: 1.5, bgcolor: "#fff", borderRadius: "4px", border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${edge}`,
          transition: "box-shadow .12s, border-color .12s", "&:hover": { boxShadow: "0 4px 14px rgba(21,34,58,.12)", borderColor: TINT.blue.fg, borderLeftColor: edge },
          "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 2 },
        }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
          <Box sx={{ ...TAG, bgcolor: action ? c.soft : "#eef1f6", color: action ? c.ink : MUTED }}>{action ? stageOf(row.stage)?.label ?? "No status" : KIND_LABEL[row.kind]}</Box>
          {prio && <Box sx={{ ...TAG, bgcolor: PRIORITY_COLOR[row.priority].bg, color: PRIORITY_COLOR[row.priority].fg }}>{prio}</Box>}
          {late > 0 && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>{action ? "LATE" : `${late} LATE`}</Box>}
        </Box>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: action ? 600 : 800, color: INK, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", textDecoration: row.stage === KILLED ? "line-through" : "none" }}>
          {row.title}
        </Typography>
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", color: FAINT }}>{meta.join(" · ")}</Typography>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{pct} %</Typography>
          </Box>
          <Box sx={{ height: 3, borderRadius: "1px", bgcolor: "#eef1f6", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, bgcolor: edge }} />
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );
}

/** The + at the end of the tiles: a new action (or, in a main category, a sub-category) - its small window. */
function AddTile({ under, onAdd }: { under: PlanItem; onAdd: (parent: PlanItem) => void }) {
  return (
    <Box component="button" type="button" onClick={() => onAdd(under)} aria-label={`Add in ${under.title}`}
      sx={{ all: "unset", boxSizing: "border-box", cursor: "pointer", minHeight: 96, borderRadius: "4px", border: `1.5px dashed ${HAIRLINE}`, display: "grid", placeItems: "center", color: MUTED,
        fontSize: "0.86rem", fontWeight: 700, transition: "border-color .12s, color .12s", "&:hover, &:focus-visible": { borderColor: TINT.blue.fg, color: TINT.blue.fg } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><AddIcon sx={{ fontSize: 20 }} />{under.kind === "topic" ? "New action or sub-category" : under.kind === "goal" ? "New main category" : "New action"}</Box>
    </Box>
  );
}

/**
 * Everything in a main category (or a sub-category, or the goal) as square tiles (SARCLA 01.11.2026: "list everything like
 * an interactive bubble", then "square tabs"): its sub-categories as headings in their colour - a click opens them - each
 * with its actions under it, then the actions directly in it.
 */
function Everything({ item, items, rolledAll, colorOf, onOpen, onAdd }: {
  item: PlanItem; items: PlanItem[]; rolledAll: Map<number, Rolled>; colorOf: (i: PlanItem) => string | null; onOpen: (i: PlanItem) => void;
  /** the + tile, for whoever may change the plan */
  onAdd?: (parent: PlanItem) => void;
}) {
  const today = todayIso();
  const kids = (id: number) => items.filter((i) => i.parentId === id).sort(byOrder);
  // its tiles, and the + that adds in `under`
  const grid = (rows: PlanItem[], under?: PlanItem) => (rows.length > 0 || (under && onAdd)) && (
    <Box sx={TILES}>
      {rows.map((row) => <Tile key={row.id} row={row} r={rolledAll.get(row.id)} items={items} color={colorOf(row)} onOpen={onOpen} today={today} />)}
      {under && onAdd && <AddTile under={under} onAdd={onAdd} />}
    </Box>
  );
  const cluster = (row: PlanItem, depth: number): React.ReactNode => {
    const inside = kids(row.id);
    const r = rolledAll.get(row.id);
    const n = actionsUnder(row.id, items).length;
    return (
      <Box key={row.id} sx={{ display: "grid", gap: 1, pl: depth > 1 ? 2 : 0 }}>
        <Box component="button" type="button" onClick={() => onOpen(row)} aria-label={`Open ${row.title}`}
          sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", pb: 0.5, borderBottom: `1px solid ${HAIRLINE}`, "&:hover .t": { color: TINT.blue.fg }, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 2 } }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: colorOf(row) ?? SUMMARY, flexShrink: 0 }} />
          <Typography className="t" sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK }}>{row.title}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            {n} action{n === 1 ? "" : "s"}{r?.percent != null ? ` · ${r.percent} %` : ""}
          </Typography>
          {(r?.late ?? 0) > 0 && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>{r!.late} LATE</Box>}
        </Box>
        {grid(inside.filter((i) => i.kind === "action"), row)}
        {depth < 2 && inside.filter((i) => i.kind !== "action").map((g) => cluster(g, depth + 1))}
        {!inside.length && !onAdd && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Nothing in it yet.</Typography>}
      </Box>
    );
  };
  const inside = kids(item.id);
  const direct = inside.filter((i) => i.kind === "action");
  const cats = inside.filter((i) => i.kind !== "action");
  const all = actionsUnder(item.id, items).length;
  return (
    <Box sx={{ ...card, gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ ...section, flex: 1 }}>Everything in it · {all} action{all === 1 ? "" : "s"}{cats.length ? ` in ${cats.length} ${item.kind === "goal" ? "main categor" : "sub-categor"}${cats.length === 1 ? "y" : "ies"}` : ""}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Left edge = status · click one to open it</Typography>
      </Box>
      {!inside.length && !onAdd && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Nothing in it yet.</Typography>}
      {cats.map((g) => cluster(g, 1))}
      {(direct.length > 0 || onAdd) && (
        <Box sx={{ display: "grid", gap: 1 }}>
          {cats.length > 0 && <Typography sx={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>{direct.length ? `Directly in this ${KIND_LABEL[item.kind].toLowerCase()}` : `Add in this ${KIND_LABEL[item.kind].toLowerCase()}`}</Typography>}
          {grid(direct, item)}
        </Box>
      )}
    </Box>
  );
}

/** The KPI view: where it stands; for a category its actions by status and priority, and what is late. The KPI
 *  actions will feed it (SARCLA 01.11.2026: "this KPI will be fed by the KPI actions, later to come"). */
function KpiView({ item, items, rolledAll, subs, canWrite, save, colorOf, onOpen }: {
  item: PlanItem; items: PlanItem[]; rolledAll: Map<number, Rolled>; subs: PlanSub[]; canWrite: boolean; save: (p: Partial<PlanFields>) => void;
  colorOf: (i: PlanItem) => string | null; onOpen: (i: PlanItem) => void;
}) {
  const today = todayIso();
  const action = item.kind === "action";
  const rolled = rolledAll.get(item.id);
  const fromSubs = action && subs.length > 0 && !isClosed(item.stage) && item.percent !== 100;
  const pct = fromSubs ? rolled?.percent ?? 0 : action ? item.percent : rolled?.percent;
  const under = action ? [] : actionsUnder(item.id, items);
  const byStage = [...STAGES.map((s) => ({ id: s.id as string | null, label: s.label, n: under.filter((i) => i.stage === s.id).length })), { id: null, label: "No status", n: under.filter((i) => !stageOf(i.stage)).length }].filter((x) => x.n);
  const late = under.filter((i) => isLate(i, today));
  const tiles = subs.filter((s) => s.kpiHref);
  const from = action ? item.start : rolled?.from ?? null;
  const to = action ? item.due : rolled?.to ?? null;
  return (
    <Box sx={{ display: "grid", gap: 2.25, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1fr)" }, alignItems: "start" }}>
      <Box sx={{ ...card, gridColumn: "1 / -1" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <InsightsOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
          <Typography sx={{ ...section, flex: 1 }}>Where it stands</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The KPI actions will feed this view</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "2.6rem", fontWeight: 800, color: INK, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pct == null ? "—" : `${pct} %`}</Typography>
          <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>
            complete{rolled?.late ? ` · ${rolled.late} late` : ""}{(rolled?.subs ?? 0) > 0 ? ` · ${rolled!.subs - rolled!.subsOpen} of ${rolled!.subs} sub-actions done` : ""}{fromSubs ? " · from its sub-actions" : ""}
          </Typography>
        </Box>
        <Box sx={{ height: 8, borderRadius: "2px", bgcolor: "#eef1f6", overflow: "hidden" }}>
          <Box sx={{ height: "100%", width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, bgcolor: action ? stageColor(item.stage).bar : colorOf(item) ?? TINT.blue.fg }} />
        </Box>
        {(from || to) && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{action ? "Planned " : ""}{dmy(from) || "…"} – {action ? "go-live " : ""}{dmy(to) || "…"}</Typography>}
      </Box>

      {action ? (
        <>
          <Box sx={card}>
            <Typography sx={section}>How it is measured</Typography>
            <Field label="KPIs" value={item.kpis} placeholder="How success is measured - what is counted or compared" canWrite={canWrite} multiline rows={3} onSave={(v) => save({ kpis: v })} />
          </Box>
          <Box sx={card}>
            <Typography sx={section}>KPI tiles it is tied to</Typography>
            {!tiles.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>None yet - a KPI tile&apos;s Actions can add a sub-action to it.</Typography>}
            {tiles.map((s) => (
              <Box key={s.id} component="a" href={s.kpiHref} sx={{ display: "flex", gap: 0.75, alignItems: "center", color: TINT.blue.fg, textDecoration: "none", fontSize: "0.86rem", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                <FlagOutlinedIcon sx={{ fontSize: 16 }} />{s.title}
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <>
          <Box sx={card}>
            <Typography sx={section}>Its {under.length} action{under.length === 1 ? "" : "s"} by status</Typography>
            {under.length > 0 && (
              <Box sx={{ display: "flex", height: 14, borderRadius: "3px", overflow: "hidden", bgcolor: "#eef1f6" }}>
                {byStage.map((s) => <Box key={s.label} title={`${s.label}: ${s.n}`} sx={{ width: `${(s.n / under.length) * 100}%`, bgcolor: stageColor(s.id).bar }} />)}
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {byStage.map((s) => (
                <Box key={s.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1, py: 0.35, borderRadius: "4px", bgcolor: stageColor(s.id).soft, fontSize: "0.8rem", fontWeight: 700, color: stageColor(s.id).ink }}>
                  {s.label}<Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{s.n}</Box>
                </Box>
              ))}
            </Box>
            <Typography sx={{ ...section, mt: 0.5 }}>By priority</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {[...PRIORITIES].reverse().map((p) => {
                const n = under.filter((i) => i.priority === p.value).length;
                const c = PRIORITY_COLOR[p.value];
                return <Box key={p.value} sx={{ display: "inline-flex", gap: 0.6, px: 1, py: 0.35, borderRadius: "4px", bgcolor: c.bg, color: c.fg, fontSize: "0.8rem", fontWeight: 700, opacity: n ? 1 : 0.45 }}>{p.label}<span>{n}</span></Box>;
              })}
            </Box>
          </Box>
          <Box sx={card}>
            <Typography sx={section}>Late · {late.length}</Typography>
            {!late.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Nothing in it is past its go-live date.</Typography>}
            <Box sx={TILES}>
              {late.map((i) => <Tile key={i.id} row={i} r={rolledAll.get(i.id)} items={items} color={colorOf(i)} onOpen={onOpen} today={today} />)}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export function ItemModal({ item, items, rolledAll, subs, canWrite, people, peopleError, choices, colorOf, onClose, onOpen, onOpenSub, onPatch, onChanged, onAddUnder, onDelete, onMoveTo }: {
  item: PlanItem; items: PlanItem[]; rolledAll: Map<number, Rolled>; subs: PlanSub[]; canWrite: boolean; onClose: () => void;
  people: PlanOwner[]; peopleError: string | null; choices: PlanData["choices"];
  colorOf: (i: PlanItem) => string | null;
  /** another row, opened from a tile */
  onOpen: (item: PlanItem) => void;
  /** a sub-action, in its own window */
  onOpenSub: (id: number) => void;
  onPatch: (id: number, p: Partial<PlanFields>) => Promise<void>;
  /** a sub-action or a ticket changed: the plan reads its counts again */
  onChanged: () => void;
  /** the + tile: the small window to add under a row */
  onAddUnder: (parent: PlanItem) => void;
  onDelete: (item: PlanItem) => Promise<void>;
  onMoveTo: (item: PlanItem, parentId: number) => Promise<void>;
}) {
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<View>("overview");
  const save = (p: Partial<PlanFields>) => { void onPatch(item.id, p).then(() => setTick((t) => t + 1)); };
  const rolled = rolledAll.get(item.id);
  const action = item.kind === "action";
  // the action as the sub-actions' "tile" (plan:<id>), as a KPI tile's Actions knows it
  const who = item.owners.map((o) => o.name).join(", ") || item.responsible;
  const tile = useMemo(() => planTile(item), [item.id, item.title, item.code, who, item.due]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromSubs = action && subs.length > 0 && !isClosed(item.stage) && item.percent !== 100;
  const [pct, setPct] = useState(item.percent == null ? "" : String(item.percent));
  useEffect(() => { setPct(item.percent == null ? "" : String(item.percent)); }, [item.percent]);

  // its place in the plan: the path above it, and the categories it may move to (the ticket's "business goal",
  // as a tree from the plan - SARCLA 01.11.2026: "where today I select Awareness, this should be a tree from the plan")
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const path: PlanItem[] = [];
  for (let p = item.parentId != null ? byId.get(item.parentId) : undefined; p && path.length < 8; p = p.parentId != null ? byId.get(p.parentId) : undefined) path.unshift(p);
  const places = useMemo(() => {
    if (item.kind === "goal" || item.kind === "topic") return [];
    const out: { id: number; label: string; depth: number }[] = [];
    const topics = items.filter((i) => i.kind === "topic").sort(byOrder);
    for (const t of topics) {
      out.push({ id: t.id, label: t.title, depth: 0 });
      if (item.kind === "action") {
        for (const g of items.filter((i) => i.parentId === t.id && i.kind === "group").sort(byOrder)) out.push({ id: g.id, label: g.title, depth: 1 });
      }
    }
    return out;
  }, [items, item.kind]);
  const done = subs.filter((s) => s.status === "done").length;

  const placeSelect = places.length > 0 && (
    <TextField select size="small" label={action ? "Business goal - its place in the plan" : "Main category"} value={item.parentId ?? ""} disabled={!canWrite}
      onChange={(e) => { const to = Number(e.target.value); if (to && to !== item.parentId) void onMoveTo(item, to).then(() => setTick((t) => t + 1)); }}
      sx={{ ...field, gridColumn: "1 / -1" }} slotProps={{ inputLabel: { shrink: true } }}>
      {places.map((p) => (
        <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.86rem", pl: 2 + p.depth * 2.5, fontWeight: p.depth ? 500 : 700 }}>{p.label}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label={item.title}
      slotProps={{ paper: { sx: { width: "calc(100vw - 32px)", height: "calc(100vh - 32px)", maxHeight: "none", m: 2, borderRadius: "18px", bgcolor: "#f7f9fc", overflow: "hidden", display: "flex", flexDirection: "column" } } }}>
      {/* ── the head: where it sits, its name, Overview | KPI, its stage ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.25, pb: 1.75, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {[KIND_LABEL[item.kind], item.code].filter(Boolean).join(" · ")}
              {path.filter((p) => p.kind !== "goal").length > 0 && <Box component="span" sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}> · {path.filter((p) => p.kind !== "goal").map((p) => p.title).join(" › ")}</Box>}
            </Typography>
            <Title value={item.title} canWrite={canWrite} onSave={(v) => save({ title: v })} />
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}>
            <ViewSwitch view={view} setView={setView} />
            {canWrite && item.kind !== "goal" && (
              <IconButton aria-label="Remove this row" title="Remove this row" onClick={() => void onDelete(item)}><DeleteOutlineIcon sx={{ color: FAINT }} /></IconButton>
            )}
            <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
          </Box>
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
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2.25 }}>
        {view === "kpi" ? (
          <Box sx={{ display: "grid", gap: 2.25 }}>
            <KpiView item={item} items={items} rolledAll={rolledAll} subs={subs} canWrite={canWrite} save={save} colorOf={colorOf} onOpen={onOpen} />
            {!action && <Tracking id={item.id} tick={tick} />}
          </Box>
        ) : !action ? (
          <Box sx={{ display: "grid", gap: 2.25 }}>
            {item.kind === "goal" && (
              <Box sx={card}>
                <Typography sx={section}>The goal&apos;s statement</Typography>
                <Field label="Description" value={item.detail} canWrite={canWrite} multiline rows={3} onSave={(v) => save({ detail: v })} />
              </Box>
            )}
            <Everything item={item} items={items} rolledAll={rolledAll} colorOf={colorOf} onOpen={onOpen} onAdd={canWrite ? onAddUnder : undefined} />
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 2.25, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.55fr) minmax(0, 1fr)" } }}>
            <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
              <Box sx={{ ...card, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <Typography sx={{ ...section, gridColumn: "1 / -1" }}>The action</Typography>
                <Field label="Description" value={item.detail} placeholder="What the action is about, what done looks like" canWrite={canWrite} multiline rows={3} onSave={(v) => save({ detail: v })} />
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
                {placeSelect}
              </Box>

                <Box sx={{ ...card, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                  {/* the head: and the switch that decides what the action carries - its ticket, the channel, the agency */}
                  <Box sx={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                    <Typography sx={{ ...section, flex: 1 }}>Details</Typography>
                    <Tooltip title={item.dg ? "Its “From Scroll to Sale” ticket, the marketing channel and the agency" : "Turn on for a “From Scroll to Sale” ticket, the marketing channel and the agency - a sales action has no pipeline"}>
                      <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.25, pl: 1, borderRadius: "999px", border: `1px solid ${item.dg ? TINT.blue.fg : HAIRLINE}`, bgcolor: item.dg ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: item.dg ? TINT.blue.fg : MUTED }}>Led by Digital Growth</Typography>
                        <Switch size="small" checked={item.dg} disabled={!canWrite} onChange={(e) => save({ dg: e.target.checked })} />
                      </Box>
                    </Tooltip>
                  </Box>
                  {/* the channel and the agency are marketing's: only when Digital Growth leads it (kept, not shown, otherwise) */}
                  {item.dg && <Choices label="Marketing channel" options={choices.channel} value={item.channel} canWrite={canWrite} onSave={(v) => save({ channel: v })} />}
                  <Choices label="Implementation country" options={choices.country} value={item.country} canWrite={canWrite} onSave={(v) => save({ country: v })} />
                  {item.dg && <Choices label="Agency" options={choices.agency} value={item.agency} canWrite={canWrite} onSave={(v) => save({ agency: v })} />}
                  <TextField select size="small" label="Roadmap year" value={item.roadmapYear} disabled={!canWrite} onChange={(e) => save({ roadmapYear: e.target.value })}
                    sx={field} slotProps={{ inputLabel: { shrink: true } }}>
                    <MenuItem value="" sx={{ fontSize: "0.86rem", color: FAINT }}>None</MenuItem>
                    {[...choices.roadmapYear, ...(item.roadmapYear && !choices.roadmapYear.some((o) => o.value === item.roadmapYear) ? [{ value: item.roadmapYear, label: item.roadmapYear }] : [])].map((o) => (
                      <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.86rem" }}>{o.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField size="small" label="Roadmap ID" value={item.code} disabled helperText="The workbook's number" sx={field} slotProps={{ inputLabel: { shrink: true } }} />
                  <Field label="Next steps / milestones" value={item.nextSteps} placeholder="The next steps or milestones - one per line" canWrite={canWrite} multiline rows={2} onSave={(v) => save({ nextSteps: v })} />
                  <Field label="Status note" value={item.statusNote} placeholder="Where it stands - what is done, what is in the way" canWrite={canWrite} multiline rows={2} onSave={(v) => save({ statusNote: v })} />
                  <Referent value={item.referent} people={people} canWrite={canWrite} onSave={(v) => save({ referent: v })} />
                </Box>
            </Box>

            {/* ── the right: its ticket, its sub-actions once there are some (SARCLA 02.11.2026: "sub-actions should only appear
                when they have been created"), its tracking ── */}
            <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
                {item.dg && (
                  <Box sx={card}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <ConfirmationNumberOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
                      <Typography sx={{ ...section, flex: 1 }}>Its Scroll to Sale ticket</Typography>
                    </Box>
                    <ActionTicket item={item} tile={tile} canWrite={canWrite} onChanged={() => { onChanged(); setTick((t) => t + 1); }} />
                  </Box>
                )}
                {subs.length > 0 && (
                  <Box sx={card}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <TaskAltIcon sx={{ fontSize: 18, color: FAINT }} />
                      <Typography sx={{ ...section, flex: 1 }}>Sub-actions · {done} of {subs.length} done</Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Click one to open it</Typography>
                    </Box>
                    <SubActions tile={tile} onOpenSub={onOpenSub} tick={tick} />
                  </Box>
                )}
              <Tracking id={item.id} tick={tick} />
            </Box>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
