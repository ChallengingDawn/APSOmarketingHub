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
// In the action's window the form starts as one line and opens when it is used, the sub-actions under it.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SearchIcon from "@mui/icons-material/Search";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { IDEA, PRIORITIES, STAGES, priorityLabel, stageOf, subPct, type PlanItem, type PlanOwner } from "@/lib/reporting/actionPlanRules";
import type { KpiTask } from "@/lib/reporting/kpiActions";
import type { AiFill } from "@/lib/reporting/scrollToSaleRules";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import type { TileInfo } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { AI_INK, AI_LINE, AI_SOFT, FindTickets, People, TicketFields, TicketLine, useTileActions, type Linked, type Opt, type TicketsAnswer } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { LATE, PRIORITY_COLOR, SUB_COLOR, dmy, stageColor } from "./planUi";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "6px", fontSize: "0.86rem" } as const;
const label = { fontSize: "0.78rem", color: MUTED, fontWeight: 600 } as const;
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const TAG = { flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px" } as const;
/** A square choice, as the action's. */
const square = (on: boolean, fg: string, bg: string, can: boolean) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.78rem",
  fontWeight: on ? 800 : 600, px: 1, py: 0.4, borderRadius: "4px", cursor: can ? "pointer" : "default", whiteSpace: "nowrap" as const,
});
const nonEmpty = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).filter(([, x]) => String(x ?? "").trim()));

/** What a sub-action is, as an action: its name, stage, priority, who does it, planned and go-live dates. */
type Small = { title: string; stage: string; priority: string; owner: string; start: string; due: string };
const smallOf = (k: KpiTask): Small => ({ title: k.title, stage: k.stage ?? "", priority: k.priority, owner: k.owner, start: k.start ?? "", due: k.due ?? "" });

/** A date handed up when it is left - typing the year does not hand up 0002, 0020, 0202 on the way. */
function DayField({ label: l, value, min, max, canWrite, onSave }: { label: string; value: string; min?: string; max?: string; canWrite: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <TextField size="small" type="date" label={l} value={v} disabled={!canWrite} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }}
      sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: min || undefined, max: max || undefined } }} />
  );
}

/** The stage, the priority, who and the two dates - square choices as on the action; each change handed up at once. */
function SmallFields({ v, set, owners, canWrite }: { v: Small; set: (p: Partial<Small>) => void; owners: Opt[]; canWrite: boolean }) {
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={label}>Status</Typography>
        <Box role="radiogroup" aria-label="Status" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {STAGES.map((s) => {
            const on = v.stage === s.id;
            const c = stageColor(s.id);
            return (
              <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} disabled={!canWrite} onClick={() => !on && set({ stage: s.id })}
                sx={{ ...square(on, c.ink, c.soft, canWrite), ...(on ? { bgcolor: c.bar, color: "#fff", borderColor: c.bar } : {}) }}>
                {s.label}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={label}>Priority</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {[...PRIORITIES].reverse().map((p) => {
            const on = v.priority === p.value;
            const c = PRIORITY_COLOR[p.value];
            return <Box key={p.value} component="button" type="button" aria-pressed={on} disabled={!canWrite} onClick={() => set({ priority: on ? "" : p.value })} sx={square(on, c.fg, c.bg, canWrite)}>{p.label}</Box>;
          })}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 1.1, gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr 1fr" } }}>
        <TextField select size="small" label="Assigned to" value={owners.some((o) => o.value === v.owner) ? v.owner : ""} disabled={!canWrite}
          onChange={(e) => set({ owner: e.target.value })} sx={field} slotProps={{ inputLabel: { shrink: true } }}>
          {owners.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.88rem" }}>{o.label}</MenuItem>)}
        </TextField>
        <DayField label="Planned date" value={v.start} max={v.due} canWrite={canWrite} onSave={(d) => set({ start: d })} />
        <DayField label="Go-live date" value={v.due} min={v.start} canWrite={canWrite} onSave={(d) => set({ due: d })} />
      </Box>
    </Box>
  );
}

/** The ticket fields a sub-action fills: its name, owner, stage, priority, dates and note are the ticket's too - the
 *  ticket's form shows only the rest. */
const OWN = ["hubspot_owner_id", "hs_pipeline_stage", "hs_ticket_priority", "mkt_planned_date", "mkt_golive_date", "content"];
const restOf = (form: TicketsAnswer["form"]): TicketsAnswer["form"] => ({ ...form, fields: form.fields.filter((f) => !OWN.includes(f.name)) });
const ticketOwn = (v: Small, note: string, href?: string): Record<string, string> => ({
  subject: v.title.trim().slice(0, 200),
  ...(/^\d+$/.test(v.owner) ? { hubspot_owner_id: v.owner } : {}),
  ...(v.stage ? { hs_pipeline_stage: v.stage } : {}),
  ...(v.priority ? { hs_ticket_priority: v.priority } : {}),
  ...(v.start ? { mkt_planned_date: v.start } : {}),
  ...(v.due ? { mkt_golive_date: v.due } : {}),
  // its description, with the way back to the action as the plan's tickets carry it
  ...(note.trim() ? { content: `${note.trim()}${href ? `\n\nOpen it: ${href}` : ""}` } : {}),
});

/* ── a new one ─────────────────────────────────────────────────────────── */

export function NewSub({ item, tile, t, tErr, retry, owners, tickets, focus, compact = false, wide = false, done }: {
  item: PlanItem; tile: TileInfo; t: TicketsAnswer | null; tErr: string | null; retry: () => Promise<void>; owners: Opt[]; tickets: boolean; focus: boolean;
  /** one line until it is used (the action's window) */
  compact?: boolean;
  /** the + window opened wide: the ticket beside the sub-action */
  wide?: boolean;
  done: () => Promise<void>;
}) {
  const blank = (): Small => ({ title: "", stage: IDEA, priority: item.priority, owner: t?.me?.id ?? "", start: "", due: "" });
  const [v, setV] = useState<Small>(blank);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState<string[]>([]);
  // with Digital Growth the ticket comes first: its properties are asked at once
  const first = tickets ? "new" : "none";
  const [ticket, setTicket] = useState<"none" | "new" | "link">(first);
  useEffect(() => { setTicket(tickets ? "new" : "none"); }, [tickets]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [ai, setAi] = useState<{ open: boolean; text: string; busy: boolean; msg: string | null; err: string | null }>({ open: false, text: "", busy: false, msg: null, err: null });
  const set = (p: Partial<Small>) => setV((x) => ({ ...x, ...p }));
  const [used, setUsed] = useState(!compact);
  const open = used || !!v.title.trim() || ai.open;
  useEffect(() => { if (t?.me) setV((x) => (x.owner ? x : { ...x, owner: t.me!.id })); }, [t]);
  // the pipeline's prefill under what is typed, the sub-action's own fields over it
  useEffect(() => { if (t) setValues((x) => ({ ...t.prefill, ...nonEmpty(x) })); }, [t]);
  useEffect(() => { setValues((x) => ({ ...x, ...ticketOwn(v, note, tile.href) })); }, [v, note, tile.href]);
  const missing = ticket === "new" && t ? t.form.fields.filter((f) => f.required && f.name !== "subject" && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const ready = !!v.title.trim() && !busy && (ticket !== "new" || !missing.length) && (ticket !== "link" || pick.length > 0);

  const fill = async () => {
    setAi((a) => ({ ...a, busy: true, msg: null, err: null }));
    try {
      const j = await send("/api/reporting/kpi-actions/ai", "POST", { tile: tile.key, describe: ai.text, ctx: { title: tile.title, summary: tile.summary }, values });
      const f = j.fill as AiFill;
      const g = f.values ?? {};
      set({
        ...(f.title ? { title: f.title } : {}), ...(f.due ? { due: f.due } : {}), ...(f.owner ? { owner: f.owner } : {}),
        ...(g.hs_pipeline_stage ? { stage: g.hs_pipeline_stage } : {}), ...(g.hs_ticket_priority ? { priority: g.hs_ticket_priority } : {}), ...(g.mkt_planned_date ? { start: g.mkt_planned_date } : {}),
      });
      if (f.note) setNote(f.note);
      if (f.shared.length) setShared((s) => [...new Set([...s, ...f.shared])]);
      if (f.ticket && tickets) setTicket("new");
      if (Object.keys(g).length) setValues((x) => ({ ...x, ...g }));
      const n = [f.title, f.note, f.due, f.owner].filter(Boolean).length + f.shared.length + Object.keys(g).length;
      setAi((a) => ({ ...a, busy: false, msg: `${n} field${n === 1 ? "" : "s"} filled in${f.ticket && tickets ? ", with a new ticket" : ""} - check each one before adding. Nothing is saved yet.` }));
    } catch (e) { setAi((a) => ({ ...a, busy: false, err: (e as Error).message })); }
  };

  const add = async () => {
    if (!ready) return;
    setBusy(true); setErr(null); setSent(null);
    try {
      const j = await send("/api/reporting/kpi-actions/tasks", "POST", {
        tile: tile.key, page: "plan", title: v.title, note, owner: v.owner, ownerName: owners.find((o) => o.value === v.owner)?.label ?? "", shared,
        stage: v.stage || null, priority: v.priority, start: v.start || null, due: v.due || undefined,
        href: `${window.location.pathname}${window.location.search}`, kpi: tile.title, summary: tile.summary,
      });
      const taskId = (j.task as KpiTask).id;
      if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId, values });
      if (ticket === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId, ids: pick });
      const mailed = Number(j.mailed ?? 0);
      setSent(`“${v.title.trim()}” added${ticket === "new" ? ", with its ticket in HubSpot" : ticket === "link" ? ", with its linked tickets" : ""}${mailed ? ` · ${mailed} mail${mailed === 1 ? "" : "s"} sent` : ""}`);
      setV(blank()); setNote(""); setShared([]); setTicket(first); setPick([]); setValues(t?.prefill ?? {});
      setAi((a) => ({ ...a, open: false, text: "", msg: null }));
      if (compact) setUsed(false);
      await done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.75, borderRadius: "10px", border: `1px solid ${TINT.blue.fg}`, bgcolor: "#fbfcfe" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ ...section, flex: 1 }}>New sub-action</Typography>
        <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} onClick={() => setAi((a) => ({ ...a, open: !a.open }))}
          sx={{ ...cta, color: AI_INK, bgcolor: ai.open ? AI_SOFT : "transparent", "&:hover": { bgcolor: AI_SOFT } }}>
          Create with AI
        </Button>
      </Box>
      {ai.open && (
        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "8px", border: `1px solid ${AI_LINE}`, bgcolor: AI_SOFT }}>
          <TextField multiline minRows={3} maxRows={10} autoFocus value={ai.text} onChange={(e) => setAi((a) => ({ ...a, text: e.target.value }))}
            label="Describe it to the AI" placeholder={`What should be done, by whom, by when, how urgent${tickets ? " - and whether it needs a Scroll to Sale ticket" : ""}`}
            sx={field} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ai.text.trim().length >= 5 && !ai.busy) void fill(); }} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography sx={{ flex: 1, fontSize: "0.8rem", color: ai.err ? RED : ai.msg ? GREEN : FAINT, fontWeight: ai.msg ? 600 : 400 }}>
              {ai.err ?? ai.msg ?? "The AI fills in the sub-action from your words - only choices the form offers, nothing made up. You check it, then add it."}
            </Typography>
            <Button variant="contained" disableElevation disabled={ai.busy || ai.text.trim().length < 5} onClick={() => void fill()}
              startIcon={ai.busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
              sx={{ ...cta, bgcolor: AI_INK, "&:hover": { bgcolor: "#5a3ab0" } }}>
              {ai.busy ? "Filling in…" : "Fill in the form"}
            </Button>
          </Box>
        </Box>
      )}
      {/* side by side when the window is wide and a ticket is to be filled (SARCLA 01.11.2026: "with Digital Growth the
          window should expand to display everything correctly") */}
      <Box sx={{ display: "grid", gap: 1.75, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: wide && tickets && open ? "minmax(0, 1fr) minmax(0, 1.15fr)" : "minmax(0, 1fr)" } }}>
        <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
          <TextField size="small" label="Sub-action" placeholder={open ? "What will be done - written as an action" : "+ Add a sub-action - what will be done"} value={v.title} onChange={(e) => set({ title: e.target.value })}
            onFocus={() => setUsed(true)} autoFocus={focus} sx={field} slotProps={{ inputLabel: { shrink: true } }}
            onKeyDown={(e) => { if (e.key === "Enter" && ready) void add(); }} />
          {open && (<>
            <TextField size="small" label="Description" placeholder="What it is about, what done looks like" value={note} onChange={(e) => setNote(e.target.value)}
              sx={field} multiline minRows={2} maxRows={8} slotProps={{ inputLabel: { shrink: true } }} />
            <SmallFields v={v} set={set} owners={owners} canWrite />
            <People owners={owners} value={shared} onChange={setShared} />
          </>)}
        </Box>
        {/* its Scroll to Sale ticket - only when Digital Growth leads the action */}
        {open && tickets && (
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
            {ticket === "link" && <FindTickets pick={pick} setPick={setPick} already={(t?.linked ?? []).map((x) => x.id)} />}
          </Box>
        )}
      </Box>
      {open && (<>
        {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ flex: 1, fontSize: "0.82rem", color: missing.length ? RED : sent ? GREEN : FAINT, fontWeight: sent && !missing.length ? 600 : 400 }}>
            {missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : sent ?? (shared.length ? `${shared.length} colleague${shared.length === 1 ? "" : "s"} will get a mail` : "")}
          </Typography>
          {compact && <Button disabled={busy} onClick={() => { setUsed(false); set({ title: "" }); setNote(""); setAi((a) => ({ ...a, open: false })); }} sx={{ ...cta, color: MUTED }}>Cancel</Button>}
          <Button variant="contained" disableElevation disabled={!ready} onClick={() => void add()} sx={{ ...cta, fontSize: "0.9rem", px: 2 }}>
            {busy ? "Saving…" : ticket === "new" ? "Add it and its ticket" : ticket === "link" ? "Add it and link" : "Add the sub-action"}
          </Button>
        </Box>
      </>)}
      {!open && sent && <Typography sx={{ fontSize: "0.82rem", color: GREEN, fontWeight: 600 }}>{sent}</Typography>}
    </Box>
  );
}

/* ── one of them: a line that opens into its fields ────────────────────── */

function SubLine({ k, tile, t, owners, canWrite, tickets, linked, open, onToggle, saved, reload, setErr }: {
  k: KpiTask; tile: TileInfo; t: TicketsAnswer | null; owners: Opt[]; canWrite: boolean; tickets: boolean; linked: Linked[]; open: boolean; onToggle: () => void;
  /** after a change of its own fields; reload after a ticket */
  saved: () => Promise<void>; reload: () => Promise<void>; setErr: (e: string | null) => void;
}) {
  const [v, setV] = useState<Small>(smallOf(k));
  useEffect(() => { setV(smallOf(k)); }, [k]);
  const [note, setNote] = useState(k.note);
  useEffect(() => { setNote(k.note); }, [k.note]);
  const [adding, setAdding] = useState<null | "new" | "link">(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const late = k.status !== "done" && !!k.due && k.due < today;
  const stage = stageOf(k.stage);
  const pct = subPct(k);
  const prio = priorityLabel(k.priority);
  const fromKpi = !k.tile.startsWith("plan:");

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
    if (p.owner !== undefined) { out.owner = p.owner; out.ownerName = owners.find((o) => o.value === p.owner)?.label ?? ""; }
    void patch(out);
  };
  const remove = async () => {
    if (!confirm(linked.length ? `Remove “${k.title}”? Its tickets stay in HubSpot.` : `Remove “${k.title}”?`)) return;
    try { await send(`/api/reporting/kpi-actions/tasks?id=${k.id}`, "DELETE"); await reload(); } catch (e) { setErr((e as Error).message); }
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
    <Box sx={{ borderRadius: "8px", border: `1px solid ${open ? TINT.blue.fg : HAIRLINE}`, borderLeft: `4px solid ${stage ? stageColor(stage.id).bar : SUB_COLOR[k.status].bar}`, bgcolor: "#fff" }}>
      <Box component="button" type="button" onClick={onToggle} aria-expanded={open}
        sx={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, alignItems: "center", px: 1.25, py: 0.9, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: -2 } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.35 }}>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0 }}>
            {stage ? <Box sx={{ ...TAG, bgcolor: stageColor(stage.id).soft, color: stageColor(stage.id).ink }}>{stage.label}</Box>
              : <Box sx={{ ...TAG, bgcolor: SUB_COLOR[k.status].soft, color: SUB_COLOR[k.status].ink }}>{k.status === "done" ? "Done" : k.status === "doing" ? "In progress" : "Open"}</Box>}
            {prio && <Box sx={{ ...TAG, bgcolor: PRIORITY_COLOR[k.priority].bg, color: PRIORITY_COLOR[k.priority].fg }}>{prio}</Box>}
            {late && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>LATE</Box>}
            <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK, minWidth: 0, textDecoration: k.status === "done" ? "line-through" : "none" }}>{k.title}</Typography>
          </Box>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: FAINT }}>
            {[k.ownerName, k.start && k.due ? `${dmy(k.start)} → ${dmy(k.due)}` : k.due ? `go-live ${dmy(k.due)}` : k.start ? `planned ${dmy(k.start)}` : "",
              linked.length ? `${linked.length} ticket${linked.length === 1 ? "" : "s"}` : "", fromKpi ? "made on a KPI tile" : ""].filter(Boolean).join(" · ") || "No one, no date yet"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{pct == null ? "—" : `${pct} %`}</Typography>
          <ExpandMoreIcon sx={{ fontSize: 20, color: FAINT, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </Box>
      </Box>

      {open && (
        <Box sx={{ display: "grid", gap: 1.25, px: 1.25, pb: 1.5, pt: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
          <TextField size="small" label="Sub-action" value={v.title} disabled={!canWrite} onChange={(e) => setV((x) => ({ ...x, title: e.target.value }))}
            onBlur={() => { if (v.title.trim() && v.title !== k.title) void patch({ title: v.title }); else setV((x) => ({ ...x, title: k.title })); }}
            sx={{ ...field, mt: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
          <SmallFields v={v} set={set} owners={owners} canWrite={canWrite} />
          <Box sx={{ display: "grid", gap: 1.1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <People owners={owners} value={k.shared.map((p) => p.id)} onChange={(ids) => void patch({ shared: ids })} label="Shared with - the new ones get a mail" />
            <TextField size="small" label="Description" value={note} disabled={!canWrite} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== k.note) void patch({ note }); }}
              sx={field} multiline maxRows={5} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          {fromKpi && k.href && (
            <Typography component="a" href={k.href} sx={{ fontSize: "0.82rem", color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", display: "flex", gap: 0.5, alignItems: "center", "&:hover": { textDecoration: "underline" } }}>
              <FlagOutlinedIcon sx={{ fontSize: 17 }} /> Made on a KPI tile - open it
            </Typography>
          )}
          {linked.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
          {canWrite && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
              {tickets && <Button size="small" startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => startTicket("new")} sx={{ ...cta, color: adding === "new" ? TINT.blue.fg : MUTED }}>New ticket</Button>}
              {tickets && <Button size="small" onClick={() => startTicket("link")} sx={{ ...cta, color: adding === "link" ? TINT.blue.fg : MUTED }}>Link existing</Button>}
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => void remove()} sx={{ ...cta, color: FAINT }}>Remove</Button>
            </Box>
          )}
          {adding === "new" && t && <TicketFields form={restOf(t.form)} values={values} set={(key, x) => setValues((o) => ({ ...o, [key]: x }))} />}
          {adding === "link" && <FindTickets pick={pick} setPick={setPick} already={linked.map((x) => x.id)} />}
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

export function SubActions({ item, tile, canWrite, tickets, people, onChanged }: {
  item: PlanItem; tile: TileInfo; canWrite: boolean;
  /** Digital Growth leads the action */
  tickets: boolean;
  /** HubSpot's users, as the plan read them */
  people: PlanOwner[];
  onChanged: () => void;
}) {
  const { t, tErr, tasks, err, setErr, loadTickets, loadTasks } = useTileActions(tile, true);
  const owners: Opt[] = people.length ? people.map((p) => ({ value: p.id, label: p.name })) : t?.form.owners ?? [];
  const [openId, setOpenId] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // turned on here: the ticket search opens at once
  const was = useRef(tickets);
  useEffect(() => { if (tickets && !was.current) setFinding(true); if (!tickets) setFinding(false); was.current = tickets; }, [tickets]);
  const saved = async () => { await loadTasks(); onChanged(); };
  const reload = async () => { await Promise.all([loadTasks(), loadTickets()]); onChanged(); };
  const linked = t?.linked ?? [];
  const loose = linked.filter((x) => x.taskId == null);
  const link = async () => {
    setBusy(true);
    try {
      await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, ids: pick });
      setPick([]); setFinding(false); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {canWrite && <NewSub item={item} tile={tile} t={t} tErr={tErr} retry={loadTickets} owners={owners} tickets={tickets} focus={false} compact done={reload} />}
      {(err || (tErr && tickets)) && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err ?? `HubSpot could not be read: ${tErr}`}</Typography>}
      {!tasks ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", minHeight: 40 }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Reading its sub-actions…</Typography></Box>
      ) : !tasks.length ? (
        <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No sub-action yet{canWrite ? " - write the first step above, or add one from a KPI tile's Actions" : ""}.</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={section}>Its sub-actions · {tasks.length} · click one to change it</Typography>
          {tasks.map((k) => (
            <SubLine key={k.id} k={k} tile={tile} t={t} owners={owners} canWrite={canWrite} tickets={tickets} linked={linked.filter((x) => x.taskId === k.id)}
              open={openId === k.id} onToggle={() => setOpenId(openId === k.id ? null : k.id)} saved={saved} reload={reload} setErr={setErr} />
          ))}
        </Box>
      )}

      {/* the action's own tickets, and the search for more */}
      {(tickets || loose.length > 0) && (
        <Box sx={{ display: "grid", gap: 0.9, p: 1.5, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${tickets ? TINT.blue.fg : HAIRLINE}` }}>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
            <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: FAINT }} />
            <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: 700, color: INK }}>Scroll to Sale tickets{linked.length ? ` · ${linked.length}` : ""}</Typography>
            {tickets && canWrite && (
              <Button size="small" startIcon={<SearchIcon sx={{ fontSize: 18 }} />} onClick={() => setFinding((f) => !f)} sx={{ ...cta, color: finding ? TINT.blue.fg : MUTED }}>
                {finding ? "Close the search" : "Find a ticket"}
              </Button>
            )}
          </Box>
          {!linked.length && !finding && <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>None linked yet. Find one in the pipeline - open, closed or all - or give a sub-action a new ticket.</Typography>}
          {linked.length > loose.length && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{linked.length - loose.length} on its sub-actions, shown on each</Typography>}
          {loose.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
          {finding && (
            <>
              <FindTickets pick={pick} setPick={setPick} already={linked.map((x) => x.id)} />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="contained" disableElevation disabled={busy || !pick.length} onClick={() => void link()} sx={cta}>
                  {busy ? "Linking…" : pick.length > 1 ? `Link these ${pick.length} to the action` : "Link it to the action"}
                </Button>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
