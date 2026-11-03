"use client";
// AN ACTION'S SUB-ACTIONS, IN ITS WINDOW - each one a small action (SARCLA 01.11.2026: a sub-action "should be a small
// action": the action's own fields - the pipeline's stage, priority, who does it, planned and go-live dates - and its
// own row with a bar under the action in the Gantt). A new one is written in the form on top, or described to the AI
// ("Create with AI"); each one below is a line that opens into the same fields, saved as they change. They are the KPI
// tiles' tasks (tile "plan:<id>"), so a KPI tile's task tied to this action shows here too. When Digital Growth leads
// the action a sub-action can carry a "From Scroll to Sale" ticket - its stage, priority and dates go into the ticket,
// the form asks for the rest of the ticket's properties at once ("at this level only the ticket creation information is
// needed if Digital Growth is on") - and the action's own tickets are found open, closed or all and linked at the bottom.
// The + beside an action's row opens the same form in a small window of its own (AddDialog.tsx). A sub-action has a
// description ("description should be part of the sub-action creation") - the ticket's own description when it has one.
// The action's window lists them, each one changed in place; a new one is made only by the + beside the action in the
// plan (SARCLA 02.11.2026: "don't allow sub-action creation inside the action page, only by the + outside"). A sub-action
// has its status note right under its status (SARCLA 02.11.2026: "status note should directly appear on the sub-action")
// - the ticket's status note when it has one.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { IDEA, PRIORITIES, STAGES, priorityLabel, stageOf, subLate, subPct, subSoon, subStage, takesTicket, type PlanItem } from "@/lib/reporting/actionPlanRules";
import type { KpiTask } from "@/lib/reporting/kpiActions";
import type { AiFill } from "@/lib/reporting/scrollToSaleRules";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import type { TileInfo } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { AI_INK, AI_LINE, AI_SOFT, FindTickets, People, TicketFields, TicketLine, field, useTileActions, type Linked, type Opt, type TicketsAnswer } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { LATE, PRIORITY_COLOR, dmy, stageColor } from "./planUi";

const cta = { textTransform: "none", fontWeight: 700, borderRadius: "6px", fontSize: "0.86rem" } as const;
/** A label over its tags, the same on every form. */
export const label = { fontSize: "0.78rem", color: MUTED, fontWeight: 600 } as const;
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const TAG = { flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px" } as const;
/** A square choice - one size on every form (the action's window, a sub-action's, a new one). */
export const square = (on: boolean, fg: string, bg: string, can: boolean) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.78rem",
  fontWeight: on ? 800 : 600, px: 1, py: 0.4, borderRadius: "4px", cursor: can ? "pointer" : "default", whiteSpace: "nowrap" as const,
});
const nonEmpty = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).filter(([, x]) => String(x ?? "").trim()));

/** What a sub-action is, as an action: its name, stage, priority, who does it, planned and go-live dates. */
type Small = { title: string; stage: string; priority: string; owner: string; start: string; due: string; statusNote: string };
const smallOf = (k: KpiTask): Small => ({ title: k.title, stage: k.stage ?? "", priority: k.priority, owner: k.owner, start: k.start ?? "", due: k.due ?? "", statusNote: k.statusNote ?? "" });

/** A whole date - a year from 2000: typing it does not give 0002, 0020, 0202 on the way. */
export const wholeDay = (v: string) => /^(2\d{3})-\d{2}-\d{2}$/.test(v);
/**
 * A date handed up once it is settled (SARCLA 03.11.2026: "date on creation and on the plan sometimes change, it's
 * really weird"): typing 19 over 09 made 01 on the way, saved at once, and the two saves could land in either order; the
 * saved one coming back also reset the box while it was still being typed. Now a whole date is handed up when typing
 * has stopped for a moment, when the box is left, or when its window closes - one picked and the window closed is kept
 * (02.11.2026: "planned, go-live dates are not updating") - and the box follows the row only when it is not being typed in.
 */
function DayField({ label: l, value, min, max, canWrite, onSave }: { label: string; value: string; min?: string; max?: string; canWrite: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const sent = useRef(value);
  const typing = useRef(false);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ v: value, onSave });
  last.current.onSave = onSave;
  useEffect(() => { if (!typing.current) { setV(value); last.current.v = value; } sent.current = value; }, [value]);
  const hand = (x: string) => {
    if (wait.current) { clearTimeout(wait.current); wait.current = null; }
    if (x !== sent.current && (x === "" || wholeDay(x))) { sent.current = x; last.current.onSave(x); }
  };
  // the window closed while a date waited: it is kept
  useEffect(() => () => { if (wait.current) { clearTimeout(wait.current); if (last.current.v !== sent.current && wholeDay(last.current.v)) last.current.onSave(last.current.v); } }, []);
  return (
    <TextField size="small" type="date" label={l} value={v} disabled={!canWrite}
      onFocus={() => { typing.current = true; }}
      onChange={(e) => {
        const x = e.target.value;
        setV(x); last.current.v = x;
        if (wait.current) clearTimeout(wait.current);
        wait.current = wholeDay(x) ? setTimeout(() => hand(x), 900) : null;
      }}
      onBlur={() => { typing.current = false; hand(v); }}
      sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: min || undefined, max: max || undefined } }} />
  );
}

/** A text handed up when it is left, as the dates. */
function NoteField({ label: l, value, placeholder, canWrite, onSave }: { label: string; value: string; placeholder?: string; canWrite: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField size="small" label={l} value={v} placeholder={placeholder} disabled={!canWrite} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }}
      sx={field} multiline minRows={1} slotProps={{ inputLabel: { shrink: true } }} />
  );
}

/**
 * Who does it: HubSpot's users in one box - one person on a sub-action, several ticked on an action - the same box on
 * every form (SARCLA 03.11.2026: "depending on main, sub-actions or actions the way you give the owner is different, this
 * should be uniform"; of the sub-action's: "this is the correct way I like").
 */
export function AssignedTo({ value, multiple = false, options, canWrite, onChange }: {
  value: string[]; multiple?: boolean; options: Opt[]; canWrite: boolean; onChange: (ids: string[]) => void;
}) {
  const shown = value.filter((id) => options.some((o) => o.value === id));
  const name = (id: string) => options.find((o) => o.value === id)?.label ?? id;
  return (
    <TextField select size="small" label="Assigned to" value={multiple ? shown : shown[0] ?? ""} disabled={!canWrite}
      onChange={(e) => { const x = e.target.value as string | string[]; onChange(Array.isArray(x) ? x : x ? [x] : []); }} sx={field}
      slotProps={{ inputLabel: { shrink: true }, select: { multiple, displayEmpty: true, renderValue: (x) => {
        const ids = (Array.isArray(x) ? x : x ? [x] : []) as string[];
        return ids.length ? ids.map(name).join(", ") : <Box component="span" sx={{ color: FAINT }}>Pick who does it</Box>;
      } } }}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.88rem" }}>
          {multiple && <Checkbox size="small" checked={value.includes(o.value)} sx={{ p: 0.25, mr: 1 }} />}{o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * The fields an action, a sub-action and a new one share - one order, one look (SARCLA 03.11.2026: "this should be
 * uniform", "can't you see the form design is really not good?"): the status with its note under it, the priority,
 * then who does it beside the planned and go-live dates - and what a row adds beside them (an action's % complete) or
 * under them. Each change handed up at once, a text when it is left.
 */
export function CoreFields({ canWrite, stage, onStage, stageLocked = false, stageNote, statusNote, onStatusNote, priority, onPriority,
  owners, multiple = false, people, onOwners, start, due, onStart, onDue, startLocked = false, dueLocked = false, beside, below }: {
  canWrite: boolean; stage: string; onStage: (s: string) => void; stageLocked?: boolean; stageNote?: string;
  statusNote: string; onStatusNote: (v: string) => void; priority: string; onPriority: (p: string) => void;
  owners: string[]; multiple?: boolean; people: Opt[]; onOwners: (ids: string[]) => void;
  start: string; due: string; onStart: (d: string) => void; onDue: (d: string) => void; startLocked?: boolean; dueLocked?: boolean;
  beside?: ReactNode; below?: ReactNode;
}) {
  const can = canWrite && !stageLocked;
  return (
    // room between a text box and the tags under it (SARCLA 02.11.2026: "give more padding between the text box and the tags")
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        <Typography sx={label}>Status</Typography>
        <Box role="radiogroup" aria-label="Status" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
          {STAGES.map((s) => {
            const on = stage === s.id;
            const c = stageColor(s.id);
            return (
              <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} disabled={!can} onClick={() => !on && onStage(s.id)}
                sx={{ ...square(on, c.ink, c.soft, can), ...(on ? { bgcolor: c.bar, color: "#fff", borderColor: c.bar } : {}) }}>
                {s.label}
              </Box>
            );
          })}
          {stageNote && <Typography sx={{ fontSize: "0.78rem", color: FAINT, ml: 0.5 }}>{stageNote}</Typography>}
        </Box>
      </Box>
      <NoteField label="Status note" value={statusNote} placeholder="Where it stands - what is done, what is in the way" canWrite={canWrite} onSave={onStatusNote} />
      <Box sx={{ display: "grid", gap: 0.75 }}>
        <Typography sx={label}>Priority</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {[...PRIORITIES].reverse().map((p) => {
            const on = priority === p.value;
            const c = PRIORITY_COLOR[p.value];
            return <Box key={p.value} component="button" type="button" aria-pressed={on} disabled={!canWrite} onClick={() => onPriority(on ? "" : p.value)} sx={square(on, c.fg, c.bg, canWrite)}>{p.label}</Box>;
          })}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: beside ? "1.4fr 1fr 1fr 0.6fr" : "1.4fr 1fr 1fr" } }}>
        <AssignedTo value={owners} multiple={multiple} options={people} canWrite={canWrite} onChange={onOwners} />
        {/* no min / max between the two (SARCLA 03.11.2026: "when creating a sub-action dates are really messed up"): the
            planned date, handed up as its box is left, gave the go-live box a new min in the very click into it - Chrome
            rebuilds a date box's parts when its min changes, the click's part was gone, the focus too, and the go-live
            typed went nowhere; the order is said in red instead */}
        <DayField label="Planned date" value={start} canWrite={canWrite && !startLocked} onSave={onStart} />
        <DayField label="Go-live date" value={due} canWrite={canWrite && !dueLocked} onSave={onDue} />
        {beside}
      </Box>
      {(below || (start && due && start > due)) && (
        <Box sx={{ display: "grid", gap: 0.5, mt: -0.75 }}>
          {start && due && start > due && <Typography sx={{ fontSize: "0.78rem", color: RED }}>The go-live date comes before the planned date</Typography>}
          {below}
        </Box>
      )}
    </Box>
  );
}

/** A sub-action's: one person. */
function SmallFields({ v, set, owners, canWrite }: { v: Small; set: (p: Partial<Small>) => void; owners: Opt[]; canWrite: boolean }) {
  return (
    <CoreFields canWrite={canWrite} stage={v.stage} onStage={(x) => set({ stage: x })} statusNote={v.statusNote} onStatusNote={(x) => set({ statusNote: x })}
      priority={v.priority} onPriority={(x) => set({ priority: x })} owners={v.owner ? [v.owner] : []} people={owners} onOwners={(ids) => set({ owner: ids[0] ?? "" })}
      start={v.start} due={v.due} onStart={(d) => set({ start: d })} onDue={(d) => set({ due: d })} />
  );
}

/** The ticket fields a sub-action fills: its name, owner, stage, status note, priority, dates and description are the
 *  ticket's too - the ticket's form shows only the rest. */
const OWN = ["hubspot_owner_id", "hs_pipeline_stage", "mkt_status_note", "hs_ticket_priority", "mkt_planned_date", "mkt_golive_date", "content"];
const restOf = (form: TicketsAnswer["form"]): TicketsAnswer["form"] => ({ ...form, fields: form.fields.filter((f) => !OWN.includes(f.name)) });
const ticketOwn = (v: Small, note: string, href?: string): Record<string, string> => ({
  subject: v.title.trim().slice(0, 200),
  ...(/^\d+$/.test(v.owner) ? { hubspot_owner_id: v.owner } : {}),
  ...(v.stage ? { hs_pipeline_stage: v.stage } : {}),
  ...(v.priority ? { hs_ticket_priority: v.priority } : {}),
  ...(v.start ? { mkt_planned_date: v.start } : {}),
  ...(v.due ? { mkt_golive_date: v.due } : {}),
  // its own, even empty: never the action's, hidden under it
  mkt_status_note: v.statusNote.trim(),
  // its description, with the way back to the action as the plan's tickets carry it
  ...(note.trim() ? { content: `${note.trim()}${href ? `\n\nOpen it: ${href}` : ""}` } : {}),
});

/* ── "Create with AI" - the button and the box, on a new sub-action and a new action alike ─────── */

export function AiButton({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} onClick={toggle}
      sx={{ ...cta, color: AI_INK, bgcolor: on ? AI_SOFT : "transparent", "&:hover": { bgcolor: AI_SOFT } }}>
      Create with AI
    </Button>
  );
}

/** The words for the AI, and the button that fills the form from them - `fill` answers what it did; nothing is saved. */
export function AiBox({ placeholder, hint, fill }: { placeholder: string; hint: string; fill: (text: string) => Promise<string> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try { setMsg(await fill(text)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "8px", border: `1px solid ${AI_LINE}`, bgcolor: AI_SOFT }}>
      <TextField multiline minRows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)}
        label="Describe it to the AI" placeholder={placeholder}
        sx={field} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim().length >= 5 && !busy) void go(); }} />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ flex: 1, fontSize: "0.8rem", color: err ? RED : msg ? GREEN : FAINT, fontWeight: msg ? 600 : 400 }}>{err ?? msg ?? hint}</Typography>
        <Button variant="contained" disableElevation disabled={busy || text.trim().length < 5} onClick={() => void go()}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          sx={{ ...cta, bgcolor: AI_INK, "&:hover": { bgcolor: "#5a3ab0" } }}>
          {busy ? "Filling in…" : "Fill in the form"}
        </Button>
      </Box>
    </Box>
  );
}

/* ── a ticket picked to link: what is made takes its fields ───────────────── */

/** A ticket's description without its way back to the plan ("Open it: <link>"). */
export const ticketText = (content: string | undefined) => String(content ?? "").replace(/\s*Open it: \S+\s*$/, "");

/** The last ticket picked to link, read: its fields handed to `fill` (SARCLA 02.11.2026: "here it doesn't inherit the
 *  fields from the ticket"). A ticket that cannot be read leaves the form as it is. */
export function useTicketFill(pick: string[], fill: (fields: Record<string, string>) => void) {
  const last = pick[pick.length - 1];
  const cb = useRef(fill);
  cb.current = fill;
  useEffect(() => {
    if (!last) return;
    let gone = false;
    void (async () => {
      try {
        const r = await fetch(`/api/reporting/kpi-actions/tickets?read=${encodeURIComponent(last)}`);
        const j = await r.json();
        if (!gone && r.ok && j.ok) cb.current(j.fields as Record<string, string>);
      } catch { /* the form stays as it is */ }
    })();
    return () => { gone = true; };
  }, [last]);
}

/* ── a new one ─────────────────────────────────────────────────────────── */

export function NewSub({ item, tile, t, tErr, retry, owners, tickets, focus, wide = false, done }: {
  item: PlanItem; tile: TileInfo; t: TicketsAnswer | null; tErr: string | null; retry: () => Promise<void>; owners: Opt[]; tickets: boolean; focus: boolean;
  /** the + window opened wide: the ticket beside the sub-action */
  wide?: boolean;
  done: () => Promise<void>;
}) {
  const blank = (): Small => ({ title: "", stage: IDEA, priority: item.priority, owner: t?.me?.id ?? "", start: "", due: "", statusNote: "" });
  const [v, setV] = useState<Small>(blank);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState<string[]>([]);
  // with Digital Growth the ticket comes first: its properties are asked at once
  const first = tickets ? "new" : "none";
  const [ticket, setTicket] = useState<"none" | "new" | "link">(first);
  useEffect(() => { setTicket(tickets ? "new" : "none"); }, [tickets]);
  // a Digital Growth person's sub-action takes one too, whoever leads the action (SARCLA 03.11.2026) - offered, not first
  const can = takesTicket({ dg: tickets }, owners.find((o) => o.value === v.owner)?.label);
  useEffect(() => { if (!can) setTicket("none"); }, [can]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const set = (p: Partial<Small>) => setV((x) => ({ ...x, ...p }));
  // a ticket linked: what it says becomes the sub-action's - its name and description where none is typed yet
  useTicketFill(ticket === "link" ? pick : [], (f) => {
    setV((x) => ({
      ...x, title: x.title.trim() || f.subject || "", stage: stageOf(f.hs_pipeline_stage) ? f.hs_pipeline_stage : x.stage,
      priority: PRIORITIES.some((q) => q.value === f.hs_ticket_priority) ? f.hs_ticket_priority : x.priority,
      owner: owners.some((o) => o.value === f.hubspot_owner_id) ? f.hubspot_owner_id : x.owner,
      start: f.mkt_planned_date?.slice(0, 10) || x.start, due: f.mkt_golive_date?.slice(0, 10) || x.due, statusNote: x.statusNote || f.mkt_status_note || "",
    }));
    setNote((n) => n.trim() || ticketText(f.content));
    setSent("Filled in from the ticket - check it, then add it");
  });
  useEffect(() => { if (t?.me) setV((x) => (x.owner ? x : { ...x, owner: t.me!.id })); }, [t]);
  // the pipeline's prefill under what is typed, the sub-action's own fields over it
  useEffect(() => { if (t) setValues((x) => ({ ...t.prefill, ...nonEmpty(x) })); }, [t]);
  useEffect(() => { setValues((x) => ({ ...x, ...ticketOwn(v, note, tile.href) })); }, [v, note, tile.href]);
  const missing = ticket === "new" && t ? t.form.fields.filter((f) => f.required && f.name !== "subject" && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const ready = !!v.title.trim() && !busy && (ticket !== "new" || !missing.length) && (ticket !== "link" || pick.length > 0);

  const fill = async (text: string): Promise<string> => {
    const j = await send("/api/reporting/kpi-actions/ai", "POST", { tile: tile.key, describe: text, ctx: { title: tile.title, summary: tile.summary }, values });
    const f = j.fill as AiFill;
    const g = f.values ?? {};
    set({
      ...(f.title ? { title: f.title } : {}), ...(f.due ? { due: f.due } : {}), ...(f.owner ? { owner: f.owner } : {}),
      ...(g.hs_pipeline_stage ? { stage: g.hs_pipeline_stage } : {}), ...(g.hs_ticket_priority ? { priority: g.hs_ticket_priority } : {}), ...(g.mkt_planned_date ? { start: g.mkt_planned_date } : {}),
      ...(g.mkt_status_note ? { statusNote: g.mkt_status_note } : {}),
    });
    if (f.note) setNote(f.note);
    if (f.shared.length) setShared((s) => [...new Set([...s, ...f.shared])]);
    if (f.ticket && can) setTicket("new");
    if (Object.keys(g).length) setValues((x) => ({ ...x, ...g }));
    const n = [f.title, f.note, f.due, f.owner].filter(Boolean).length + f.shared.length + Object.keys(g).length;
    return `${n} field${n === 1 ? "" : "s"} filled in${f.ticket && can ? ", with a new ticket" : ""} - check each one before adding. Nothing is saved yet.`;
  };

  const add = async () => {
    if (!ready) return;
    setBusy(true); setErr(null); setSent(null);
    try {
      const j = await send("/api/reporting/kpi-actions/tasks", "POST", {
        tile: tile.key, page: "plan", title: v.title, note, owner: v.owner, ownerName: owners.find((o) => o.value === v.owner)?.label ?? "", shared,
        stage: v.stage || null, priority: v.priority, start: v.start || null, due: v.due || undefined, statusNote: v.statusNote.trim(),
        href: `${window.location.pathname}${window.location.search}`, kpi: tile.title, summary: tile.summary,
      });
      const taskId = (j.task as KpiTask).id;
      if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId, values: { ...values, ...ticketOwn(v, note, tile.href) } });
      if (ticket === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId, ids: pick });
      const mailed = Number(j.mailed ?? 0);
      setSent(`“${v.title.trim()}” added${ticket === "new" ? ", with its ticket in HubSpot" : ticket === "link" ? ", with its linked tickets" : ""}${mailed ? ` · ${mailed} mail${mailed === 1 ? "" : "s"} sent` : ""}`);
      setV(blank()); setNote(""); setShared([]); setTicket(first); setPick([]); setValues(t?.prefill ?? {});
      setAiOpen(false);
      await done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.75, borderRadius: "10px", border: `1px solid ${TINT.blue.fg}`, bgcolor: "#fbfcfe" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ ...section, flex: 1 }}>New sub-action</Typography>
        <AiButton on={aiOpen} toggle={() => setAiOpen((o) => !o)} />
      </Box>
      {aiOpen && (
        <AiBox placeholder={`What should be done, by whom, by when, how urgent, where it stands${can ? " - and whether it needs a Scroll to Sale ticket" : ""}`}
          hint="The AI fills in the sub-action from your words - only choices the form offers, nothing made up. You check it, then add it." fill={fill} />
      )}
      {/* side by side when the window is wide and a ticket is to be filled (SARCLA 01.11.2026: "with Digital Growth the
          window should expand to display everything correctly") */}
      <Box sx={{ display: "grid", gap: 1.75, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: wide && (tickets || ticket !== "none") ? "minmax(0, 1fr) minmax(0, 1.15fr)" : "minmax(0, 1fr)" } }}>
        <Box sx={{ display: "grid", gap: 1.75, minWidth: 0 }}>
          <TextField size="small" label="Sub-action" placeholder="What will be done - written as an action" value={v.title} onChange={(e) => set({ title: e.target.value })}
            autoFocus={focus} sx={field} slotProps={{ inputLabel: { shrink: true } }}
            onKeyDown={(e) => { if (e.key === "Enter" && ready) void add(); }} />
          <TextField size="small" label="Description" placeholder="What it is about, what done looks like" value={note} onChange={(e) => setNote(e.target.value)}
            sx={field} multiline minRows={2} slotProps={{ inputLabel: { shrink: true } }} />
          <SmallFields v={v} set={set} owners={owners} canWrite />
          <People owners={owners} value={shared} onChange={setShared} />
        </Box>
        {/* its Scroll to Sale ticket - only when Digital Growth leads the action or the person is Digital Growth's */}
        {can && (
          <Box sx={{ display: "grid", gap: 1, p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
              <ConfirmationNumberOutlinedIcon sx={{ fontSize: 19, color: FAINT }} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mr: 0.5 }}>Scroll to Sale ticket</Typography>
              {([["none", "None"], ["new", "New ticket"], ["link", "Link existing"]] as const).map(([id, l]) => (
                <Box key={id} component="button" type="button" onClick={() => setTicket(id)} sx={square(ticket === id, TINT.blue.fg, TINT.blue.bg, true)}>{l}</Box>
              ))}
            </Box>
            {ticket !== "none" && !t && (
              tErr ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>HubSpot could not be read: {tErr} <Button size="small" onClick={() => void retry()}>Try again</Button></Typography>
                : <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the pipeline…</Typography></Box>
            )}
            {ticket === "new" && t && <TicketFields form={restOf(t.form)} values={values} set={(k, x) => setValues((o) => ({ ...o, [k]: x }))} />}
            {ticket === "link" && <FindTickets pick={pick} setPick={(f) => setPick((x) => f(x).slice(-1))} already={(t?.linked ?? []).map((x) => x.id)} />}
          </Box>
        )}
      </Box>
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: missing.length ? RED : sent ? GREEN : FAINT, fontWeight: sent && !missing.length ? 600 : 400 }}>
          {missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : sent ?? (shared.length ? `${shared.length} colleague${shared.length === 1 ? "" : "s"} will get a mail` : "")}
        </Typography>
        <Button variant="contained" disableElevation disabled={!ready} onClick={() => void add()} sx={{ ...cta, fontSize: "0.9rem", px: 2 }}>
          {busy ? "Saving…" : ticket === "new" ? "Add it and its ticket" : ticket === "link" ? "Add it and link" : "Add the sub-action"}
        </Button>
      </Box>
    </Box>
  );
}

/* ── one of them: a line that opens into its fields ────────────────────── */

/** A sub-action's own fields, saved as they change - in its window (SubWindow.tsx). */
export function SubEditor({ k, tile, t, owners, canWrite, tickets, linked, saved, reload, setErr, onRemoved }: {
  k: KpiTask; tile: TileInfo; t: TicketsAnswer | null; owners: Opt[]; canWrite: boolean; tickets: boolean; linked: Linked[];
  /** after a change of its own fields; reload after a ticket */
  saved: () => Promise<void>; reload: () => Promise<void>; setErr: (e: string | null) => void; onRemoved: () => void;
}) {
  const [v, setV] = useState<Small>(smallOf(k));
  useEffect(() => { setV(smallOf(k)); }, [k]);
  const [note, setNote] = useState(k.note);
  useEffect(() => { setNote(k.note); }, [k.note]);
  const [adding, setAdding] = useState<null | "new" | "link">(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fromKpi = !k.tile.startsWith("plan:");
  // "Create with AI" on a sub-action (SARCLA 02.11.2026: "on the sub-action screen allow also to write with AI to fill in
  // the properties"): what it proposes is shown first, then applied - nothing is changed before
  const [aiOpen, setAiOpen] = useState(false);
  const [proposal, setProposal] = useState<{ lines: string[]; patch: Record<string, unknown> } | null>(null);
  const fill = async (text: string): Promise<string> => {
    const j = await send("/api/reporting/kpi-actions/ai", "POST", { tile: tile.key, describe: text, ctx: { title: tile.title, summary: tile.summary }, values: ticketOwn(v, note) });
    const f = j.fill as AiFill;
    const g = f.values ?? {};
    const lines: string[] = [];
    const out: Record<string, unknown> = {};
    const take = (key: string, value: unknown, line: string) => { out[key] = value; lines.push(line); };
    if (f.title && f.title !== k.title) take("title", f.title, `Name: ${f.title}`);
    if (f.note && f.note !== k.note) take("note", f.note, `Description: ${f.note}`);
    if (stageOf(g.hs_pipeline_stage) && g.hs_pipeline_stage !== k.stage) take("stage", g.hs_pipeline_stage, `Status: ${stageOf(g.hs_pipeline_stage)!.label}`);
    if (g.mkt_status_note && g.mkt_status_note !== k.statusNote) take("statusNote", g.mkt_status_note, `Status note: ${g.mkt_status_note}`);
    if (priorityLabel(g.hs_ticket_priority ?? "") && g.hs_ticket_priority !== k.priority) take("priority", g.hs_ticket_priority, `Priority: ${priorityLabel(g.hs_ticket_priority)}`);
    const who = owners.find((o) => o.value === f.owner);
    if (who && who.value !== k.owner) { take("owner", who.value, `Assigned to: ${who.label}`); out.ownerName = who.label; }
    if (g.mkt_planned_date && g.mkt_planned_date !== k.start) take("start", g.mkt_planned_date, `Planned: ${dmy(g.mkt_planned_date)}`);
    const due = f.due || g.mkt_golive_date;
    if (due && due !== k.due) take("due", due, `Go-live: ${dmy(due)}`);
    const more = f.shared.filter((x) => !k.shared.some((p) => p.id === x));
    if (more.length) take("shared", [...k.shared.map((p) => p.id), ...more], `Shared with: ${more.map((x) => owners.find((o) => o.value === x)?.label ?? x).join(", ")}`);
    setProposal(lines.length ? { lines, patch: out } : null);
    return lines.length ? `${lines.length} change${lines.length === 1 ? "" : "s"} proposed below - apply them, or not. Nothing is changed yet.` : "Nothing to change from these words.";
  };
  const apply = async () => { if (!proposal) return; await patch(proposal.patch); setProposal(null); setAiOpen(false); };

  const patch = async (p: Record<string, unknown>) => {
    try { await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, ...p, kpi: tile.title, summary: tile.summary }); await saved(); } catch (e) { setErr((e as Error).message); setV(smallOf(k)); }
  };
  const set = (p: Partial<Small>) => {
    setV((x) => ({ ...x, ...p }));
    const out: Record<string, unknown> = {};
    if (p.stage !== undefined) out.stage = p.stage || null;
    if (p.priority !== undefined) out.priority = p.priority;
    if (p.start !== undefined) out.start = p.start || null;
    if (p.due !== undefined) out.due = p.due || null;
    if (p.statusNote !== undefined) out.statusNote = p.statusNote;
    if (p.owner !== undefined) { out.owner = p.owner; out.ownerName = owners.find((o) => o.value === p.owner)?.label ?? ""; }
    void patch(out);
  };
  const remove = async () => {
    if (!confirm(linked.length ? `Remove “${k.title}”? Its tickets stay in HubSpot.` : `Remove “${k.title}”?`)) return;
    try { await send(`/api/reporting/kpi-actions/tasks?id=${k.id}`, "DELETE"); onRemoved(); } catch (e) { setErr((e as Error).message); }
  };
  const startTicket = (mode: "new" | "link") => {
    setAdding(adding === mode ? null : mode);
    if (t) setValues({ ...t.prefill, ...ticketOwn(v, note, tile.href) });
  };
  const missing = adding === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const saveTicket = async () => {
    setBusy(true);
    try {
      if (adding === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId: k.id, values });
      if (adding === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId: k.id, ids: pick });
      setAdding(null); setPick([]); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      {canWrite && <Box sx={{ display: "flex", justifyContent: "flex-end", mb: -0.5 }}><AiButton on={aiOpen} toggle={() => setAiOpen((o) => !o)} /></Box>}
      {aiOpen && <AiBox placeholder="What changed, by whom, by when, how urgent, where it stands" hint="The AI proposes changes from your words - only choices the form offers, nothing made up. You apply them, or not." fill={fill} />}
      {proposal && (
        <Box sx={{ display: "grid", gap: 0.75, p: 1.5, borderRadius: "8px", border: `1px solid ${AI_LINE}`, bgcolor: "#fff" }}>
          <Typography sx={section}>The AI proposes</Typography>
          {proposal.lines.map((l) => <Typography key={l} sx={{ fontSize: "0.86rem", color: INK }}>{l}</Typography>)}
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button onClick={() => setProposal(null)} sx={{ ...cta, color: MUTED }}>Discard</Button>
            <Button variant="contained" disableElevation onClick={() => void apply()} sx={{ ...cta, bgcolor: AI_INK, "&:hover": { bgcolor: "#5a3ab0" } }}>Apply</Button>
          </Box>
        </Box>
      )}
      <TextField size="small" label="Sub-action" value={v.title} disabled={!canWrite} onChange={(e) => setV((x) => ({ ...x, title: e.target.value }))}
        onBlur={() => { if (v.title.trim() && v.title !== k.title) void patch({ title: v.title }); else setV((x) => ({ ...x, title: k.title })); }}
        sx={field} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" label="Description" placeholder="What it is about, what done looks like" value={note} disabled={!canWrite} onChange={(e) => setNote(e.target.value)}
        onBlur={() => { if (note !== k.note) void patch({ note }); }} sx={field} multiline minRows={2} slotProps={{ inputLabel: { shrink: true } }} />
      <SmallFields v={v} set={set} owners={owners} canWrite={canWrite} />
      <People owners={owners} value={k.shared.map((p) => p.id)} onChange={(ids) => void patch({ shared: ids })} label="Shared with - the new ones get a mail" />
      {fromKpi && k.href && (
        <Typography component="a" href={k.href} sx={{ fontSize: "0.82rem", color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", display: "flex", gap: 0.5, alignItems: "center", "&:hover": { textDecoration: "underline" } }}>
          <FlagOutlinedIcon sx={{ fontSize: 17 }} /> Made on a KPI tile - open it
        </Typography>
      )}
      {(tickets || linked.length > 0) && (
        <Box sx={{ display: "grid", gap: 0.9, p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
            <ConfirmationNumberOutlinedIcon sx={{ fontSize: 19, color: FAINT }} />
            <Typography sx={{ flex: 1, fontSize: "0.86rem", fontWeight: 700, color: INK }}>Scroll to Sale ticket{linked.length > 1 ? "s" : ""}</Typography>
            {/* one ticket per sub-action */}
            {tickets && canWrite && !linked.length && <Box component="button" type="button" onClick={() => startTicket("new")} sx={square(adding === "new", TINT.blue.fg, TINT.blue.bg, true)}>New ticket</Box>}
            {tickets && canWrite && !linked.length && <Box component="button" type="button" onClick={() => startTicket("link")} sx={square(adding === "link", TINT.blue.fg, TINT.blue.bg, true)}>Link existing</Box>}
          </Box>
          {!linked.length && !adding && <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>None yet.</Typography>}
          {linked.length > 0 && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Kept in step with the sub-action both ways: a change here goes to the ticket, a change on the ticket - its status too - comes back here.</Typography>}
          {linked.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
          {adding === "new" && t && <TicketFields form={restOf(t.form)} values={values} set={(key, x) => setValues((o) => ({ ...o, [key]: x }))} />}
          {adding === "link" && <FindTickets pick={pick} setPick={(f) => setPick((x) => f(x).slice(-1))} already={linked.map((x) => x.id)} />}
          {adding && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.82rem", color: missing.length ? RED : FAINT, flex: 1 }}>{missing.length ? `Still to fill in: ${missing.join(", ")}` : ""}</Typography>
              <Button variant="contained" disableElevation disabled={busy || missing.length > 0 || (adding === "link" && !pick.length)} onClick={() => void saveTicket()} sx={cta}>
                {busy ? "Saving…" : adding === "new" ? "Create the ticket" : pick.length > 1 ? `Link these ${pick.length}` : "Link it"}
              </Button>
            </Box>
          )}
        </Box>
      )}
      {canWrite && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => void remove()} sx={{ ...cta, color: FAINT }}>Remove the sub-action</Button>
        </Box>
      )}
    </Box>
  );
}

/** A sub-action in its action's window: one line - its status as an action's, who, when - that opens its own window. */
function SubLine({ k, linked, onOpen }: { k: KpiTask; linked: Linked[]; onOpen: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const late = subLate(k, today);
  const soon = !late && subSoon(k, today);
  const stage = subStage(k);
  const pct = subPct(k);
  const prio = priorityLabel(k.priority);
  const fromKpi = !k.tile.startsWith("plan:");
  return (
    <Box component="button" type="button" onClick={onOpen} title="Open the sub-action"
      sx={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, alignItems: "center", px: 1.25, py: 0.9,
        borderRadius: "8px", border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${stage ? stageColor(stage.id).bar : HAIRLINE}`, bgcolor: "#fff",
        "&:hover": { borderColor: TINT.blue.fg }, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: -2 } }}>
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.35 }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0 }}>
          {stage ? <Box sx={{ ...TAG, bgcolor: stageColor(stage.id).soft, color: stageColor(stage.id).ink }}>{stage.label}</Box>
            : <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", color: FAINT, fontStyle: "italic" }}>No status</Typography>}
          {prio && <Box sx={{ ...TAG, bgcolor: PRIORITY_COLOR[k.priority].bg, color: PRIORITY_COLOR[k.priority].fg }}>{prio}</Box>}
          {late && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>LATE</Box>}
          {soon && <Box title="Planned within the next 7 days, not live yet" sx={{ ...TAG, bgcolor: TINT.amber.bg, color: TINT.amber.fg }}>DUE SOON</Box>}
          <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK, minWidth: 0, textDecoration: k.status === "done" ? "line-through" : "none" }}>{k.title}</Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: FAINT }}>
          {[k.ownerName, k.start && k.due ? `${dmy(k.start)} → ${dmy(k.due)}` : k.due ? `go-live ${dmy(k.due)}` : k.start ? `planned ${dmy(k.start)}` : "",
            linked.length ? `${linked.length} ticket${linked.length === 1 ? "" : "s"}` : "", fromKpi ? "made on a KPI tile" : ""].filter(Boolean).join(" · ") || "No one, no date yet"}
        </Typography>
        {k.statusNote && <Typography noWrap title={k.statusNote} sx={{ fontSize: "0.78rem", color: MUTED }}><b>Status note</b> · {k.statusNote}</Typography>}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{pct == null ? "—" : `${pct} %`}</Typography>
        <ChevronRightIcon sx={{ fontSize: 20, color: FAINT }} />
      </Box>
    </Box>
  );
}

/** The action as its sub-actions' "tile" (plan:<id>), as a KPI tile's Actions knows it. */
export function planTile(item: PlanItem): TileInfo {
  const who = item.owners.map((o) => o.name).join(", ") || item.responsible;
  return {
    key: `plan:${item.id}`, page: "plan", title: item.title,
    summary: [item.code, who, item.due ? `due ${dmy(item.due)}` : ""].filter(Boolean).join(" · "),
    href: `${window.location.origin}/action-plan?item=${item.id}`,
  };
}

/* ── all of it ─────────────────────────────────────────────────────────── */

/** An action's sub-actions in its window, once there are some: each opens its own window (SARCLA 02.11.2026: "I click on
 *  a sub-action and I'm redirected to the main action - this should not happen"). */
export function SubActions({ tile, onOpenSub, tick }: {
  tile: TileInfo; onOpenSub: (id: number) => void;
  /** read again when it changes */
  tick: number;
}) {
  const { t, tasks, err, loadTasks, loadTickets } = useTileActions(tile, true);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } void loadTasks(); void loadTickets(); }, [tick, loadTasks, loadTickets]);
  const linked = t?.linked ?? [];
  if (err) return <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>;
  if (!tasks) return <Box sx={{ display: "flex", gap: 1, alignItems: "center", minHeight: 40 }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Reading its sub-actions…</Typography></Box>;
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      {tasks.map((k) => <SubLine key={k.id} k={k} linked={linked.filter((x) => x.taskId === k.id)} onOpen={() => onOpenSub(k.id)} />)}
    </Box>
  );
}

/** The ticket fields an action gives its ticket itself - kept in step with it, so the ticket's form does not ask them. */
const ACTION_GIVES = ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority", "hubspot_owner_id", "mkt_planned_date", "mkt_golive_date",
  "mkt_channel", "mkt_implementation_country", "mkt_agency", "mkt_roadmap_year", "mkt_status_note",
  "mkt_plan_category", "mkt_plan_subcategory", "mkt_plan_action"];

/**
 * An action's own "From Scroll to Sale" ticket - one per action, kept in step with it both ways (SARCLA 02.11.2026: "if
 * a ticket is associated to an action - only one per action - the properties communicate with each other"): a new one
 * made from the action (only what it does not say is asked), or one found in the pipeline.
 */
export function ActionTicket({ item, tile, canWrite, main, onChanged }: {
  item: PlanItem; tile: TileInfo; canWrite: boolean;
  /** it has sub-actions: no ticket of its own - they carry theirs (SARCLA 02.11.2026: "because they are main") */
  main: boolean;
  onChanged: () => void;
}) {
  const { t, tErr, loadTickets } = useTileActions(tile, true);
  const [adding, setAdding] = useState<null | "new" | "link">(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const own = (t?.linked ?? []).filter((x) => x.taskId == null);
  // the action as it is now - changed on the left while this is open, it is what the ticket gets
  const values: Record<string, string> = {
    ...(t?.prefill ?? {}), ...extra, subject: item.title.slice(0, 200), content: item.detail || item.title, hs_pipeline_stage: item.stage ?? IDEA,
    hs_ticket_priority: item.priority, hubspot_owner_id: item.owners[0]?.id ?? "", mkt_planned_date: item.start ?? "", mkt_golive_date: item.due ?? "",
    mkt_channel: item.channel.join(";"), mkt_implementation_country: item.country.join(";"), mkt_agency: item.agency.join(";"),
    mkt_roadmap_year: item.roadmapYear, mkt_status_note: item.statusNote,
  };
  const required = adding === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()) : [];
  const missing = required.map((f) => f.label);
  // what is missing on the action itself, on the left, and what this form asks
  const onAction = required.filter((f) => ACTION_GIVES.includes(f.name)).map((f) => (f.name === "hubspot_owner_id" ? "Assigned to" : f.label));
  const here = required.filter((f) => !ACTION_GIVES.includes(f.name)).map((f) => f.label);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (adding === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, values });
      else await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, ids: pick.slice(-1) });
      setAdding(null); setPick([]); setExtra({}); await loadTickets(); onChanged();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  // a main action shows a ticket only when an old one is still on it - to take it off
  if (main && !own.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 1, p: 2, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <ConfirmationNumberOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
        <Typography sx={{ ...section, flex: 1 }}>Its Scroll to Sale ticket</Typography>
      </Box>
      {main && <Typography sx={{ fontSize: "0.82rem", color: RED }}>A main action takes no ticket - its sub-actions carry theirs. Unlink this one, or link it to one of its sub-actions.</Typography>}
      {tErr && <Typography sx={{ fontSize: "0.84rem", color: RED }}>HubSpot could not be read: {tErr} <Button size="small" onClick={() => void loadTickets()}>Try again</Button></Typography>}
      {!t && !tErr && <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the pipeline…</Typography></Box>}
      {own.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={async () => { await loadTickets(); onChanged(); }} />)}
      {own.length > 1 && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>One ticket per action: the latest linked is the one kept in step - unlink the others.</Typography>}
      {own.length > 0 && !main && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Kept in step with the action both ways: a change here goes to the ticket, a change on the ticket - its status too - comes back here.</Typography>}
      {t && !own.length && !main && canWrite && (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ flex: 1, fontSize: "0.82rem", color: FAINT }}>None yet - make it from the action, or link one from the pipeline.</Typography>
          <Box component="button" type="button" onClick={() => setAdding(adding === "new" ? null : "new")} sx={square(adding === "new", TINT.blue.fg, TINT.blue.bg, true)}>New ticket</Box>
          <Box component="button" type="button" onClick={() => setAdding(adding === "link" ? null : "link")} sx={square(adding === "link", TINT.blue.fg, TINT.blue.bg, true)}>Link existing</Box>
        </Box>
      )}
      {adding === "new" && t && <TicketFields form={{ ...t.form, fields: t.form.fields.filter((f) => !ACTION_GIVES.includes(f.name)) }} values={values} set={(k, x) => setExtra((o) => ({ ...o, [k]: x }))} />}
      {adding === "link" && <FindTickets pick={pick} setPick={(f) => setPick((p) => f(p).slice(-1))} already={[]} />}
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {adding && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ flex: 1, fontSize: "0.82rem", color: missing.length ? RED : FAINT }}>
            {missing.length
              ? [here.length ? `Still to fill in here: ${here.join(", ")}` : "", onAction.length ? `on the action, at the left: ${onAction.join(", ")}` : ""].filter(Boolean).join(" - ")
              : adding === "new" ? "Its name, description, status, priority, owner, dates, channels, countries, agency, KPIs and notes come from the action." : ""}
          </Typography>
          <Button variant="contained" disableElevation disabled={busy || missing.length > 0 || (adding === "link" && !pick.length)} onClick={() => void save()} sx={cta}>
            {busy ? "Saving…" : adding === "new" ? "Create the ticket" : "Link it"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
