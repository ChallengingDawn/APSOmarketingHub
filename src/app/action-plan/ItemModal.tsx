"use client";
// A ROW OF THE PLAN, OPENED - a full modal per action with its tracking and its KPIs (SARCLA 01.11.2026: "in a
// full modal per action with tracking and KPI"). The fields are the "From Scroll to Sale" ticket's, the ones made
// with the agency (01.11.2026: "follow at the maximum what we use on the From Scroll to Sale pipeline ... copy the
// HubSpot one and delete those not needed"): the pipeline's stages, HubSpot's priorities, planned and go-live
// dates, channels, countries, agency, roadmap year, KPIs, next steps, status note (no report link - 02.11.2026). Where the ticket
// picks a business goal ("Awareness"), an action picks its place in the plan's tree. Each field saves when it is
// left; every change lands in the tracking on the right.
// One view: no Overview | KPI switch any more (SARCLA 04.11.2026: "still the old KPI appearing") - the KPIs are the KPIs
// tab's, promoted there from Advanced reporting. A main category or a sub-category shows everything in it as square tiles
// to open ("list everything like an interactive bubble", then
// "improve the design and UX - square tabs").
// The window takes the whole screen but a margin ("modal way larger"); an action's sub-actions are made, described to
// the AI and given their tickets in it, not in a second window over it ("sub-action creation still holds the old
// modal"), its form open from the start ("when I click [an action] I should see creating directly a sub-action").
// "Led by Digital Growth" opens the ticket search, the marketing channel and the agency.
// A category's window is its tiles alone, the whole width, a + tile to add under it ("kanban is broken ... the side
// is not needed, new action should be the +"); it moves by drag and drop in the Gantt. Its changes are under its tiles.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import HistoryIcon from "@mui/icons-material/History";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { BUC_MEMBERS, KILLED, isClosed, priorityLabel, stageOf, subClosed, subLate, subOrder, subSoon, subStage, type Opt, type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanSub, type Rolled } from "@/lib/reporting/actionPlanRules";
import { LATE, PRIORITY_COLOR, SUMMARY, dmy, stageColor, todayIso, type PlanData } from "./planUi";
import { ActionTicket, CoreFields, SubActions, label, planTile, square } from "./SubActions";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KpiTrackingField, type TrackChoice } from "./KpiPicker";

const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const card = { display: "grid", rowGap: 1.75, columnGap: 1.25, p: 2, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, alignContent: "start" } as const;
export const KIND_LABEL: Record<PlanKind, string> = { goal: "The goal", topic: "Main category", group: "Sub-category", action: "Action" };
/** A row's kind as said: a category inside a main category is a "Category" (07.11.2026, four main categories). */
const kindLabel = (row: PlanItem, items: PlanItem[]) =>
  row.kind === "topic" && items.find((i) => i.id === row.parentId)?.kind === "topic" ? "Category" : KIND_LABEL[row.kind];
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
      disabled={!canWrite} multiline={multiline} minRows={multiline ? rows ?? 2 : undefined}
      sx={{ ...field, gridColumn: span ? "1 / -1" : "auto" }} slotProps={{ inputLabel: { shrink: true } }} />
  );
}

/** The name, large, saved when it is left. */
function Title({ value, canWrite, onSave }: { value: string; canWrite: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField variant="standard" fullWidth multiline value={v} disabled={!canWrite} aria-label="Name"
      onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim() && v !== value) onSave(v); else setV(value); }}
      sx={{ mt: 0.5, "& .MuiInputBase-root": { fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.3 }, "& .MuiInput-underline:before": { borderBottomColor: "transparent" } }} />
  );
}

/** Several of the ticket's choices, as square toggles. */
function Choices({ label: title, options, value, canWrite, onSave }: { label: string; options: Opt[]; value: string[]; canWrite: boolean; onSave: (v: string[]) => void }) {
  // a value HubSpot no longer offers stays visible until it is taken off
  const all = [...options, ...value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))];
  return (
    <Box sx={{ display: "grid", gap: 0.75, gridColumn: "1 / -1" }}>
      <Typography sx={label}>{title}</Typography>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
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
 * The referent / challenger: one of the BUC's members, as HubSpot's users (SARCLA 01.11.2026: "should be a BUC member -
 * Alexandre, Claudio, Bernd, Marc or Rose - like a user"). Kept by name; a name typed before stays until it is changed.
 */
function Referent({ value, people, canWrite, onSave }: { value: string; people: PlanOwner[]; canWrite: boolean; onSave: (v: string) => void }) {
  const names = BUC_MEMBERS.map((m) => people.find((p) => p.id === m.id)?.name ?? m.name);
  const old = value && !names.includes(value) ? value : "";
  return (
    <TextField select size="small" label="Referent / challenger" value={value} disabled={!canWrite} onChange={(e) => onSave(e.target.value)}
      helperText={old ? "From the workbook - pick the BUC member it means" : undefined} sx={field} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
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
  const late = action ? (r?.lateSelf ? 1 : 0) : r?.late ?? 0;
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
          <Box sx={{ ...TAG, bgcolor: action ? c.soft : "#eef1f6", color: action ? c.ink : MUTED }}>{action ? stageOf(row.stage)?.label ?? "No status" : kindLabel(row, items)}</Box>
          {prio && <Box sx={{ ...TAG, bgcolor: PRIORITY_COLOR[row.priority].bg, color: PRIORITY_COLOR[row.priority].fg }}>{prio}</Box>}
          {late > 0 && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>{action ? "LATE" : `${late} LATE`}</Box>}
        </Box>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: action ? 600 : 800, color: INK, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", textDecoration: row.stage === KILLED ? "line-through" : "none" }}>
          {row.title}
        </Typography>
        {/* held to the tile's width: a long list of people ends in "…" (SARCLA 02.11.2026: "kanban still broken on main category") */}
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.5, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", minWidth: 0 }}>
            <Typography noWrap title={meta.join(" · ")} sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", color: FAINT }}>{meta.join(" · ")}</Typography>
            <Typography sx={{ flexShrink: 0, fontSize: "0.74rem", fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{pct} %</Typography>
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
        {depth < 3 && inside.filter((i) => i.kind !== "action").map((g) => cluster(g, depth + 1))}
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
        <Typography sx={{ ...section, flex: 1 }}>Everything in it · {all} action{all === 1 ? "" : "s"}{cats.length ? ` in ${cats.length} ${item.kind === "goal" ? "main categor" : cats.some((c) => c.kind === "topic") ? "categor" : "sub-categor"}${cats.length === 1 ? "y" : "ies"}` : ""}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Left edge = status · click one to open it</Typography>
      </Box>
      {!inside.length && !onAdd && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Nothing in it yet.</Typography>}
      {cats.map((g) => cluster(g, 1))}
      {(direct.length > 0 || onAdd) && (
        <Box sx={{ display: "grid", gap: 1 }}>
          {cats.length > 0 && <Typography sx={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>{direct.length ? `Directly in this ${kindLabel(item, items).toLowerCase()}` : `Add in this ${kindLabel(item, items).toLowerCase()}`}</Typography>}
          {grid(direct, item)}
        </Box>
      )}
    </Box>
  );
}

/** A sub-action in a category's window: one line, as in its action's window - its status, priority, who, when. */
function CategorySubLine({ s, today, onOpen }: { s: PlanSub; today: string; onOpen: () => void }) {
  const stage = subStage(s);
  const late = subLate(s, today);
  const soon = !late && subSoon(s, today);
  const prio = priorityLabel(s.priority);
  const closed = subClosed(s);
  return (
    <Box component="button" type="button" onClick={onOpen} title="Open the sub-action"
      sx={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "grid", gap: 0.35, px: 1.25, py: 0.9, borderRadius: "8px", border: `1px solid ${HAIRLINE}`,
        borderLeft: `4px solid ${stage ? stageColor(stage.id).bar : HAIRLINE}`, bgcolor: "#fff", minWidth: 0,
        "&:hover": { borderColor: TINT.blue.fg }, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: -2 } }}>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0 }}>
        {stage ? <Box sx={{ ...TAG, bgcolor: stageColor(stage.id).soft, color: stageColor(stage.id).ink }}>{stage.label}</Box>
          : <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", color: FAINT, fontStyle: "italic" }}>No status</Typography>}
        {prio && <Box sx={{ ...TAG, bgcolor: PRIORITY_COLOR[s.priority].bg, color: PRIORITY_COLOR[s.priority].fg }}>{prio}</Box>}
        {late && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>LATE</Box>}
        {soon && <Box sx={{ ...TAG, bgcolor: TINT.amber.bg, color: TINT.amber.fg }}>DUE SOON</Box>}
        <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 650, color: closed ? MUTED : INK, minWidth: 0, textDecoration: closed ? "line-through" : "none" }}>{s.title}</Typography>
      </Box>
      <Typography noWrap sx={{ fontSize: "0.76rem", color: FAINT }}>
        {[s.ownerName, s.start && s.due ? `${dmy(s.start)} → ${dmy(s.due)}` : s.due ? `go-live ${dmy(s.due)}` : s.start ? `planned ${dmy(s.start)}` : "",
          s.tickets ? `${s.tickets} ticket${s.tickets === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "No one, no date yet"}
      </Typography>
    </Box>
  );
}

/**
 * A category's sub-actions, its actions' one under the other (SARCLA 03.11.2026: "on main categories we should also see
 * sub-actions"): each action a heading that opens it, its sub-actions as in its own window - open first, then the closed
 * ones - each opening in its own window.
 */
function CategorySubs({ item, items, allSubs, onOpen, onOpenSub }: {
  item: PlanItem; items: PlanItem[]; allSubs: PlanSub[]; onOpen: (i: PlanItem) => void; onOpenSub: (id: number) => void;
}) {
  const today = todayIso();
  const groups = actionsUnder(item.id, items).map((a) => ({ a, ss: subOrder(allSubs.filter((s) => s.item === a.id)) })).filter((g) => g.ss.length);
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.ss);
  const done = all.filter(subClosed).length;
  return (
    <Box sx={card}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <TaskAltIcon sx={{ fontSize: 18, color: FAINT }} />
        <Typography sx={{ ...section, flex: 1 }}>Sub-actions · {done} of {all.length} done</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Click one to open it</Typography>
      </Box>
      {groups.map(({ a, ss }) => (
        <Box key={a.id} sx={{ display: "grid", gap: 0.75 }}>
          <Box component="button" type="button" onClick={() => onOpen(a)}
            sx={{ all: "unset", cursor: "pointer", display: "flex", gap: 0.75, alignItems: "baseline", "&:hover .t": { color: TINT.blue.fg, textDecoration: "underline" } }}>
            <Typography className="t" sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>{a.title}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{ss.filter(subClosed).length} of {ss.length} done</Typography>
          </Box>
          <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
            {ss.map((x) => <CategorySubLine key={x.id} s={x} today={today} onOpen={() => onOpenSub(x.id)} />)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function ItemModal({ item, items, rolledAll, subs, allSubs, canWrite, people, peopleError, choices, colorOf, onClose, onOpen, onOpenSub, onPatch, onChanged, onAddUnder, onDelete, onMoveTo, onTrack }: {
  /** its KPI tracking: off, or Yes - the plan asks which KPI (KpiPicker.tsx) */
  onTrack: (c: TrackChoice) => void;
  item: PlanItem; items: PlanItem[]; rolledAll: Map<number, Rolled>; subs: PlanSub[]; canWrite: boolean; onClose: () => void;
  /** every sub-action of the plan - a category's window lists its actions' */
  allSubs: PlanSub[];
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
  const save = (p: Partial<PlanFields>) => { void onPatch(item.id, p).then(() => setTick((t) => t + 1)); };
  const rolled = rolledAll.get(item.id);
  const action = item.kind === "action";
  // the action as the sub-actions' "tile" (plan:<id>), as a KPI tile's Actions knows it
  const who = item.owners.map((o) => o.name).join(", ") || item.responsible;
  const tile = useMemo(() => planTile(item), [item.id, item.title, item.code, who, item.due]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromSubs = action && subs.length > 0 && !isClosed(item.stage) && item.percent !== 100;
  const [pct, setPct] = useState(item.percent == null ? "" : String(item.percent));
  useEffect(() => { setPct(item.percent == null ? "" : String(item.percent)); }, [item.percent]);

  // its place in the plan: the path above it, and the categories it may move to, as a tree from the plan (SARCLA
  // 01.11.2026: "where today I select Awareness, this should be a tree from the plan")
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const path: PlanItem[] = [];
  for (let p = item.parentId != null ? byId.get(item.parentId) : undefined; p && path.length < 8; p = p.parentId != null ? byId.get(p.parentId) : undefined) path.unshift(p);
  const places = useMemo(() => {
    if (item.kind === "goal" || item.kind === "topic") return [];
    // the plan's categories as its tree: a category in a main category one step in, its sub-categories one more (07.11.2026)
    const out: { id: number; label: string; depth: number; kind: PlanKind }[] = [];
    const seen = new Set<number>();
    const walk = (parent: number | null, depth: number) => {
      for (const c of items.filter((i) => i.parentId === parent).sort(byOrder)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (c.kind === "goal") { walk(c.id, depth); continue; }
        if (c.kind === "topic") { out.push({ id: c.id, label: c.title, depth, kind: c.kind }); walk(c.id, depth + 1); }
        else if (c.kind === "group" && item.kind === "action") out.push({ id: c.id, label: c.title, depth, kind: c.kind });
      }
    };
    walk(null, 0);
    return out;
  }, [items, item.kind]);
  const done = subs.filter((s) => s.status === "done").length;
  // who may do it: HubSpot's users, and the people already on it even if HubSpot's list has not come
  const ownerOptions = useMemo(() => [...item.owners.filter((o) => !people.some((p) => p.id === o.id)), ...people].map((p) => ({ value: p.id, label: p.name })), [item.owners, people]);
  // what the shared fields cannot say themselves, one line each under them
  const notes = [
    item.responsible && !item.owners.length ? `The workbook says: “${item.responsible}” - pick the people it means` : "",
    rolled?.startFromSubs || rolled?.dueFromSubs || fromSubs ? `${[rolled?.startFromSubs || rolled?.dueFromSubs ? "Its dates" : "", fromSubs ? "its % complete" : ""].filter(Boolean).join(" and ")} from its sub-actions` : "",
    item.dueNote ? `Deadline in the workbook: “${item.dueNote}”` : "",
    peopleError ? `HubSpot's users could not be read: ${peopleError}` : "",
  ].filter(Boolean).map((n) => n[0].toUpperCase() + n.slice(1));

  const placeSelect = places.length > 0 && (
    <TextField select size="small" label={action ? "Its place in the plan" : "Main category"} value={item.parentId ?? ""} disabled={!canWrite}
      onChange={(e) => { const to = Number(e.target.value); if (to && to !== item.parentId) void onMoveTo(item, to).then(() => setTick((t) => t + 1)); }}
      sx={{ ...field, gridColumn: "1 / -1" }} slotProps={{ inputLabel: { shrink: true } }}>
      {places.map((p) => (
        <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.86rem", pl: 2 + p.depth * 2.5, fontWeight: p.depth === 0 ? 700 : p.kind === "topic" ? 650 : 500 }}>{p.label}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label={item.title}
      slotProps={{ paper: { sx: { width: "calc(100vw - 32px)", height: "calc(100vh - 32px)", maxHeight: "none", m: 2, borderRadius: "18px", bgcolor: "#f7f9fc", overflow: "hidden", display: "flex", flexDirection: "column" } } }}>
      {/* ── the head: where it sits, its name ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.25, pb: 1.75, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {[kindLabel(item, items), item.code].filter(Boolean).join(" · ")}
              {path.filter((p) => p.kind !== "goal").length > 0 && <Box component="span" sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}> · {path.filter((p) => p.kind !== "goal").map((p) => p.title).join(" › ")}</Box>}
            </Typography>
            <Title value={item.title} canWrite={canWrite} onSave={(v) => save({ title: v })} />
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}>
            {canWrite && item.kind !== "goal" && (
              <IconButton aria-label="Remove this row" title="Remove this row" onClick={() => void onDelete(item)}><DeleteOutlineIcon sx={{ color: FAINT }} /></IconButton>
            )}
            <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
          </Box>
        </Box>
      </Box>

      {/* ── the body ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2.25 }}>
        {!action ? (
          <Box sx={{ display: "grid", gap: 2.25 }}>
            {item.kind === "goal" && (
              <Box sx={card}>
                <Typography sx={section}>The goal&apos;s statement</Typography>
                <Field label="Description" value={item.detail} canWrite={canWrite} multiline rows={3} onSave={(v) => save({ detail: v })} />
              </Box>
            )}
            <Everything item={item} items={items} rolledAll={rolledAll} colorOf={colorOf} onOpen={onOpen} onAdd={canWrite ? onAddUnder : undefined} />
            <CategorySubs item={item} items={items} allSubs={allSubs} onOpen={onOpen} onOpenSub={onOpenSub} />
            {/* its changes, as an action's */}
            <Tracking id={item.id} tick={tick} />
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 2.25, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.55fr) minmax(0, 1fr)" } }}>
            <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
              <Box sx={card}>
                <Typography sx={section}>The action</Typography>
                <Field label="Description" value={item.detail} placeholder="What the action is about, what done looks like" canWrite={canWrite} multiline rows={3} onSave={(v) => save({ detail: v })} />
                {/* the sub-action's fields, in its order and look - several people here (SARCLA 03.11.2026: "uniform") */}
                <CoreFields canWrite={canWrite}
                  stage={item.stage ?? ""} onStage={(s) => save({ stage: s })} stageLocked={!!rolled?.stageFromSubs}
                  stageNote={rolled?.stageFromSubs ? "From its sub-actions - change theirs" : !item.stage ? "No status yet" : undefined}
                  statusNote={item.statusNote} onStatusNote={(v) => save({ statusNote: v })}
                  priority={item.priority} onPriority={(p) => save({ priority: p })}
                  owners={item.owners.map((o) => o.id)} multiple people={ownerOptions}
                  onOwners={(ids) => save({ owners: ids.map((id) => ({ id, name: ownerOptions.find((o) => o.value === id)?.label ?? id })) })}
                  start={item.start ?? ""} due={item.due ?? ""} onStart={(d) => save({ start: d || null })} onDue={(d) => save({ due: d || null })}
                  startLocked={!!rolled?.startFromSubs} dueLocked={!!rolled?.dueFromSubs}
                  beside={
                    <TextField size="small" label="% complete" value={fromSubs ? String(rolled?.percent ?? 0) : pct} disabled={!canWrite || fromSubs}
                      onChange={(e) => setPct(e.target.value)}
                      onBlur={() => { const s = pct.trim(); const n = s === "" ? null : Math.max(0, Math.min(100, Math.round(Number(s)))); if (n !== item.percent && (n == null || Number.isFinite(n))) save({ percent: n }); }}
                      sx={field} slotProps={{ htmlInput: { inputMode: "numeric" }, inputLabel: { shrink: true } }} />
                  }
                  below={notes.length ? notes.map((n) => <Typography key={n} sx={{ fontSize: "0.78rem", color: n.startsWith("HubSpot") ? RED : FAINT }}>{n}</Typography>) : undefined} />
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
                  <TextField size="small" label="Roadmap ID" value={item.code} disabled title="The workbook's number" sx={field} slotProps={{ inputLabel: { shrink: true } }} />
                  <Referent value={item.referent} people={people} canWrite={canWrite} onSave={(v) => save({ referent: v })} />
                  {/* the table's KPI tracking column, here too (SARCLA 04.11.2026) */}
                  <KpiTrackingField tracked={!!item.tracked} title={item.trackKpiTitle ?? ""} canWrite={canWrite} onTrack={onTrack} />
                </Box>
            </Box>

            {/* ── the right: its ticket, its sub-actions once there are some (SARCLA 02.11.2026: "sub-actions should only appear
                when they have been created"), its tracking ── */}
            <Box sx={{ display: "grid", gap: 2.25, minWidth: 0 }}>
                {/* its own ticket - none on a main action: its sub-actions carry theirs */}
                {item.dg && <ActionTicket item={item} tile={tile} canWrite={canWrite} main={subs.length > 0} onChanged={() => { onChanged(); setTick((t) => t + 1); }} />}
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
