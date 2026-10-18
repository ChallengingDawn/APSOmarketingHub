"use client";
// A TILE'S ACTIONS - a large window over the page (SARCLA 18.10.2026: "put the modal bigger and user
// friendly"): on the left a new task - what will be done (it names the ticket), who, by when, who it
// is shared with, and its "From Scroll to Sale" ticket inside it (none, new and prefilled, or open
// ones linked); on the right the tile's tasks with their tickets. In the header: whether the tile
// shows In a nutshell. The owner and the people shared with get a mail from the hub; the ticket is
// shared with them in HubSpot too. Escape or the cross closes it.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Portal from "@mui/material/Portal";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";

import { Badge, FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { KpiTask, Placement, TaskStatus } from "@/lib/reporting/kpiActions";
import type { S2sField } from "@/lib/reporting/scrollToSaleRules";
import { refreshActions, send } from "./store";
import type { TileInfo } from "./TileActions";

type Opt = { value: string; label: string };
type Linked = { id: string; subject: string; stageLabel: string; open: boolean; ownerName: string; roadmapId: string; url: string; createdHere: boolean; taskId: number | null };
type Form = { fields: S2sField[]; stages: Opt[]; owners: Opt[]; teams: Opt[] };
type TicketsAnswer = { ok: boolean; canWrite: boolean; linked: Linked[]; form: Form; prefill: Record<string, string>; me: { id: string; name: string } | null; error?: string; message?: string };

const STATUS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "open", label: "Open", color: "#2459d1" },
  { id: "doing", label: "Doing", color: "#a96a12" },
  { id: "done", label: "Done", color: GREEN },
];
const field = { "& .MuiInputBase-root": { fontSize: "0.92rem", borderRadius: "10px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.9rem" } };
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "10px", fontSize: "0.9rem" } as const;
const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join(".");
const section = { fontSize: "0.74rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;

/** The people a task is shared with - HubSpot owners, by name. */
function People({ owners, value, onChange, label = "Shared with" }: { owners: Opt[]; value: string[]; onChange: (v: string[]) => void; label?: string }) {
  return (
    <Autocomplete multiple size="small" options={owners} value={owners.filter((o) => value.includes(o.value))}
      getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
      onChange={(_, v) => onChange(v.map((o) => o.value))} filterSelectedOptions
      renderInput={(p) => <TextField {...p} label={label} placeholder={value.length ? "" : "Colleagues to inform - they get a mail, and the ticket in HubSpot"} sx={field} />} />
  );
}

export function ActionsPanel({ tile, open, onClose, placed, onMove, canWrite }: {
  tile: TileInfo; open: boolean; onClose: () => void; placed: Placement; onMove: (to: Placement) => Promise<void>; canWrite: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  // the owners, the ticket form and the linked tickets come in one read; the tasks in another
  const [t, setT] = useState<TicketsAnswer | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<KpiTask[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const loadTickets = useCallback(async () => {
    setTErr(null);
    const ctx = { page: tile.page, tab: tile.tab, kpiId: tile.kpiId, title: tile.title, summary: tile.summary, filters: tile.filters, href: tile.href ?? (typeof window !== "undefined" ? window.location.href : undefined) };
    try {
      const r = await fetch(`/api/reporting/kpi-actions/tickets?tile=${encodeURIComponent(tile.key)}&ctx=${encodeURIComponent(JSON.stringify(ctx))}`);
      const j = (await r.json().catch(() => null)) as TicketsAnswer | null;
      if (!r.ok || !j?.ok) throw new Error(j?.message ?? j?.error ?? `the hub answered ${r.status}`);
      setT(j);
    } catch (e) { setTErr((e as Error).message); }
  }, [tile.key, tile.page, tile.tab, tile.kpiId, tile.title, tile.summary, tile.filters, tile.href]);
  const loadTasks = useCallback(async () => {
    try {
      const r = await fetch(`/api/reporting/kpi-actions/tasks?tile=${encodeURIComponent(tile.key)}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? `the hub answered ${r.status}`);
      setTasks(j.tasks); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [tile.key]);
  useEffect(() => { if (open) { void loadTasks(); if (!t) void loadTickets(); } }, [open, t, loadTasks, loadTickets]);
  const reload = async () => { await Promise.all([loadTasks(), loadTickets()]); void refreshActions(tile.page); };
  const move = async (to: Placement) => {
    setMoving(true);
    try { await onMove(to); } catch (e) { setErr(`Could not move it: ${(e as Error).message}`); } finally { setMoving(false); }
  };

  const ticketsOf = (id: number) => (t?.linked ?? []).filter((x) => x.taskId === id);
  const loose = (t?.linked ?? []).filter((x) => x.taskId == null);
  const openCount = (tasks ?? []).filter((k) => k.status !== "done").length;

  return (
    // on the page's own level (a portal to <body>): inside a card, its blur (backdrop-filter) makes the
    // card the frame of anything "fixed" - the window was clipped to the card and covered by the next
    // one (SARCLA 18.10: "modal is completely broken"; the fixed + transform trap)
    <Portal>
      {/* the page behind dims a little: this window is the work, not a side note */}
      <Box onClick={onClose} sx={{ position: "fixed", inset: 0, zIndex: 1299, bgcolor: "rgba(21,34,58,.18)" }} />
      <Box role="dialog" aria-modal="true" aria-label={`Actions for ${tile.title}`}
        sx={{
          position: "fixed", top: 24, bottom: 24, left: "50%", transform: "translateX(-50%)", width: "min(1080px, calc(100vw - 32px))", zIndex: 1300,
          display: "flex", flexDirection: "column", borderRadius: "22px", overflow: "hidden", bgcolor: "#fbfcfe",
          border: "1px solid rgba(21,34,58,.08)", boxShadow: "0 24px 60px rgba(21,34,58,.25), 0 4px 14px rgba(21,34,58,.08)",
        }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
          <Badge icon={<TaskAltIcon />} tint="green" size={44} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{tile.title}</Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>{tile.summary || "What is done to move this KPI"}</Typography>
          </Box>
          {/* promote / demote: one choice for everyone */}
          <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.75, borderRadius: "12px", border: `1px solid ${placed === "nutshell" ? TINT.blue.fg : HAIRLINE}`, bgcolor: placed === "nutshell" ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
            <Box>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: placed === "nutshell" ? TINT.blue.fg : INK }}>In a nutshell</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{placed === "nutshell" ? "Shown there for everyone" : "Only on this page"}</Typography>
            </Box>
            <Switch checked={placed === "nutshell"} disabled={!canWrite || moving} onChange={(e) => void move(e.target.checked ? "nutshell" : "tab")} />
          </Box>
          <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)", "&:hover": { bgcolor: "rgba(21,34,58,.1)" } }}><CloseIcon sx={{ fontSize: 22 }} /></IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: canWrite ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)" } }}>
          {canWrite && (
            <Box sx={{ overflowY: "auto", px: 3, py: 2.5, borderRight: { md: `1px solid ${HAIRLINE}` } }}>
              <AddTask tile={tile} t={t} tErr={tErr} retry={loadTickets} done={reload} />
            </Box>
          )}
          <Box sx={{ overflowY: "auto", px: 3, py: 2.5, display: "grid", gap: 1.5, alignContent: "start" }}>
            <Typography sx={section}>Tasks{tasks?.length ? ` · ${openCount} open of ${tasks.length}` : ""}</Typography>
            {(err || tErr) && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err ?? `HubSpot could not be read: ${tErr}`}</Typography>}
            {!tasks ? <CircularProgress size={18} /> : !tasks.length && !loose.length ? (
              <Box sx={{ p: 2.5, borderRadius: "14px", border: `1px dashed ${HAIRLINE}`, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.95rem", color: MUTED, fontWeight: 600 }}>No task on this KPI yet</Typography>
                <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{canWrite ? "Write on the left what will be done to move it." : "Nothing is being done on it yet."}</Typography>
              </Box>
            ) : (
              <>
                {tasks.map((k) => <TaskRow key={k.id} tile={tile} k={k} t={t} tickets={ticketsOf(k.id)} canWrite={canWrite} reload={reload} setErr={setErr} />)}
                {loose.length > 0 && (
                  <Box sx={{ display: "grid", gap: 0.75 }}>
                    <Typography sx={section}>Tickets without a task</Typography>
                    {loose.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}

/* ── a new task, with its ticket ───────────────────────────────────────── */

function AddTask({ tile, t, tErr, retry, done }: { tile: TileInfo; t: TicketsAnswer | null; tErr: string | null; retry: () => Promise<void>; done: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [shared, setShared] = useState<string[]>([]);
  const [ticket, setTicket] = useState<"none" | "new" | "link">("none");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => { if (t?.me && !owner) setOwner(t.me.id); }, [t, owner]);
  useEffect(() => { if (t) setValues((v) => (Object.keys(v).length ? v : t.prefill)); }, [t]);
  // the ticket follows the task: the action is its name; its owner, planned date and next steps
  useEffect(() => {
    setValues((v) => ({ ...v, subject: title.trim().slice(0, 200), ...(owner ? { hubspot_owner_id: owner } : {}), ...(due ? { mkt_planned_date: due } : {}), ...(note.trim() ? { mkt_next_steps: note.trim() } : {}) }));
  }, [title, owner, due, note]);
  const owners = t?.form.owners ?? [];
  const missing = useMemo(() => (ticket === "new" && t ? t.form.fields.filter((f) => f.required && f.name !== "subject" && !String(values[f.name] ?? "").trim()).map((f) => f.label) : []), [ticket, t, values]);
  const ready = !!title.trim() && !busy && (ticket !== "new" || !missing.length) && (ticket !== "link" || pick.length > 0);

  const add = async () => {
    if (!ready) return;
    setBusy(true); setErr(null); setSent(null);
    try {
      const j = await send("/api/reporting/kpi-actions/tasks", "POST", {
        tile: tile.key, page: tile.page, title, note, due: due || undefined, owner, ownerName: owners.find((o) => o.value === owner)?.label ?? "", shared,
        href: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined, kpi: tile.title, summary: tile.summary,
      });
      const taskId = (j.task as KpiTask).id;
      if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId, values });
      if (ticket === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId, ids: pick });
      const mailed = Number(j.mailed ?? 0);
      setSent(`Added${ticket === "new" ? ", with its ticket in HubSpot" : ticket === "link" ? ", with its linked tickets" : ""}${mailed ? ` · ${mailed} mail${mailed === 1 ? "" : "s"} sent` : ""}`);
      setTitle(""); setNote(""); setDue(""); setShared([]); setTicket("none"); setPick([]); setValues(t?.prefill ?? {});
      await done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={section}>New task</Typography>
      <TextField label="What will be done" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} autoFocus fullWidth
        helperText="Written as an action - it is also the ticket's name" />
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "1fr 170px" }}>
        <TextField select size="small" label="Who does it" value={owners.some((o) => o.value === owner) ? owner : ""} onChange={(e) => setOwner(e.target.value)} sx={field}>
          {owners.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.9rem" }}>{o.label}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="By" value={due} onChange={(e) => setDue(e.target.value)} sx={field} InputLabelProps={{ shrink: true }} />
      </Box>
      <People owners={owners} value={shared} onChange={setShared} />
      <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={field} multiline minRows={2} maxRows={5} />

      {/* its Scroll to Sale ticket, inside the task */}
      <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: FAINT }} />
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mr: 0.5 }}>Scroll to Sale ticket</Typography>
          {([["none", "None"], ["new", "New ticket"], ["link", "Link open ones"]] as const).map(([id, label]) => (
            <Box key={id} component="button" type="button" onClick={() => setTicket(id)}
              sx={{ border: `1px solid ${ticket === id ? TINT.blue.fg : HAIRLINE}`, bgcolor: ticket === id ? TINT.blue.bg : "#fff", color: ticket === id ? TINT.blue.fg : MUTED, font: "inherit", fontSize: "0.86rem", fontWeight: ticket === id ? 700 : 600, px: 1.4, py: 0.5, borderRadius: 99, cursor: "pointer" }}>
              {label}
            </Box>
          ))}
        </Box>
        {ticket !== "none" && !t && (
          tErr ? <Typography sx={{ fontSize: "0.86rem", color: RED }}>HubSpot could not be read: {tErr} <Button size="small" onClick={() => void retry()}>Try again</Button></Typography>
            : <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Reading the pipeline…</Typography></Box>
        )}
        {ticket === "new" && t && <TicketFields form={t.form} values={values} set={(k, x) => setValues((v) => ({ ...v, [k]: x }))} />}
        {ticket === "link" && <OpenTickets pick={pick} setPick={setPick} already={(t?.linked ?? []).map((x) => x.id)} />}
      </Box>

      {err && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err}</Typography>}
      {sent && <Typography sx={{ fontSize: "0.88rem", color: GREEN, fontWeight: 600 }}>{sent}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.82rem", color: missing.length ? RED : FAINT, flex: 1 }}>
          {missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : shared.length ? `${shared.length} colleague${shared.length === 1 ? "" : "s"} will get a mail` : ""}
        </Typography>
        <Button variant="contained" size="large" disableElevation disabled={!ready} onClick={() => void add()} sx={cta}>
          {busy ? "Saving…" : ticket === "new" ? "Add the task and its ticket" : ticket === "link" ? "Add the task and link" : "Add the task"}
        </Button>
      </Box>
    </Box>
  );
}

/** Every field of the pipeline but the name (the action is the name), prefilled - check and change what is wrong. */
function TicketFields({ form, values, set }: { form: Form; values: Record<string, string>; set: (k: string, v: string) => void }) {
  const optionsOf = (f: S2sField): Opt[] => f.kind === "stage" ? form.stages : f.kind === "owner" ? form.owners : f.kind === "team" ? form.teams : f.options ?? [];
  return (
    <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, pt: 0.5 }}>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, gridColumn: "1 / -1" }}>Filled in from the task and the KPI - check and change what is wrong.</Typography>
      {form.fields.filter((f) => f.name !== "subject").map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        if (f.kind === "multi") {
          const chosen = (values[f.name] ?? "").split(";").filter(Boolean);
          return (
            <Box key={f.name} sx={{ gridColumn: "1 / -1" }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: FAINT, mb: 0.4 }}>{label}</Typography>
              <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                {optionsOf(f).map((o) => {
                  const on = chosen.includes(o.value);
                  return (
                    <Box key={o.value} component="button" type="button" onClick={() => set(f.name, (on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value]).join(";"))}
                      sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED, font: "inherit", fontSize: "0.84rem", fontWeight: on ? 700 : 500, px: 1.1, py: 0.4, borderRadius: 99, cursor: "pointer" }}>
                      {o.label}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        }
        if (f.kind === "select" || f.kind === "stage" || f.kind === "owner" || f.kind === "team") {
          const opts = optionsOf(f);
          return (
            <TextField key={f.name} select size="small" label={label} value={opts.some((o) => o.value === values[f.name]) ? values[f.name] : ""} onChange={(e) => set(f.name, e.target.value)} sx={field}>
              {!f.required && <MenuItem value="" sx={{ fontSize: "0.9rem", color: FAINT }}>-</MenuItem>}
              {opts.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.9rem" }}>{o.label}</MenuItem>)}
            </TextField>
          );
        }
        return (
          <TextField key={f.name} size="small" label={label} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}
            sx={{ ...field, ...(f.kind === "textarea" ? { gridColumn: "1 / -1" } : {}) }}
            type={f.kind === "date" ? "date" : "text"} multiline={f.kind === "textarea"} minRows={f.kind === "textarea" ? 2 : undefined} maxRows={8}
            InputLabelProps={f.kind === "date" ? { shrink: true } : undefined} />
        );
      })}
    </Box>
  );
}

/** The pipeline's OPEN tickets (SARCLA 18.10: "only show open tickets"), to pick one or more. */
function OpenTickets({ pick, setPick, already }: { pick: string[]; setPick: (f: (p: string[]) => string[]) => void; already: string[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Linked[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/reporting/kpi-actions/tickets?search=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.message ?? j.error ?? `the hub answered ${r.status}`);
        setRows(j.tickets); setErr(null);
      } catch (e) { setErr((e as Error).message); }
    }, q ? 350 : 0);
    return () => clearTimeout(h);
  }, [q]);
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <TextField size="small" label="Search the open tickets - name or roadmap ID" value={q} onChange={(e) => setQ(e.target.value)} sx={field} />
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      {!rows ? <CircularProgress size={16} /> : !rows.length ? <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>No open ticket found.</Typography> : (
        <Box sx={{ display: "grid", gap: 0.25, maxHeight: 320, overflowY: "auto" }}>
          {rows.map((k) => {
            const has = already.includes(k.id);
            return (
              <Box key={k.id} component="label" sx={{ display: "flex", gap: 0.5, alignItems: "center", px: 0.5, py: 0.25, borderRadius: "10px", cursor: has ? "default" : "pointer", "&:hover": { bgcolor: has ? "transparent" : "rgba(21,34,58,.04)" } }}>
                <Checkbox disabled={has} checked={has || pick.includes(k.id)} onChange={(e) => setPick((p) => e.target.checked ? [...p, k.id] : p.filter((x) => x !== k.id))} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>{k.subject || `Ticket ${k.id}`}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{[k.roadmapId, k.stageLabel, k.ownerName, has ? "already on this KPI" : ""].filter(Boolean).join(" · ")}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/* ── a task, with its tickets ──────────────────────────────────────────── */

function TaskRow({ tile, k, t, tickets, canWrite, reload, setErr }: {
  tile: TileInfo; k: KpiTask; t: TicketsAnswer | null; tickets: Linked[]; canWrite: boolean; reload: () => Promise<void>; setErr: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState<null | "new" | "link" | "share">(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [shared, setShared] = useState<string[]>(k.shared.map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const late = k.status !== "done" && k.due && k.due < today;
  const owners = t?.form.owners ?? [];
  const change = async (p: { status: TaskStatus }) => {
    try { await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, ...p }); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const remove = async () => {
    if (!confirm(tickets.length ? "Remove this task? Its tickets stay in HubSpot." : "Remove this task?")) return;
    try { await send(`/api/reporting/kpi-actions/tasks?id=${k.id}`, "DELETE"); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const open = (mode: "new" | "link" | "share") => {
    setAdding(adding === mode ? null : mode);
    if (mode === "share") setShared(k.shared.map((p) => p.id));
    if (t) setValues({ ...t.prefill, subject: k.title.slice(0, 200), ...(k.owner && /^\d+$/.test(k.owner) ? { hubspot_owner_id: k.owner } : {}), ...(k.due ? { mkt_planned_date: k.due } : {}), ...(k.note ? { mkt_next_steps: k.note } : {}) });
  };
  const missing = adding === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const save = async () => {
    setBusy(true);
    try {
      if (adding === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId: k.id, values });
      if (adding === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId: k.id, ids: pick });
      if (adding === "share") await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, shared, kpi: tile.title, summary: tile.summary });
      setAdding(null); setPick([]); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 0.9, p: 1.75, borderRadius: "16px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, opacity: k.status === "done" ? 0.75 : 1 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Typography sx={{ flex: 1, fontSize: "1.02rem", fontWeight: 650, color: INK, textDecoration: k.status === "done" ? "line-through" : "none" }}>{k.title}</Typography>
        {canWrite && <IconButton size="small" aria-label="Remove the task" onClick={() => void remove()}><DeleteOutlineIcon sx={{ fontSize: 20, color: FAINT }} /></IconButton>}
      </Box>
      {k.note && <Typography sx={{ fontSize: "0.88rem", color: MUTED, whiteSpace: "pre-wrap" }}>{k.note}</Typography>}
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        {STATUS.map((s) => (
          <Box key={s.id} component="button" type="button" disabled={!canWrite} onClick={() => k.status !== s.id && void change({ status: s.id })}
            sx={{ border: `1px solid ${k.status === s.id ? s.color : HAIRLINE}`, bgcolor: k.status === s.id ? s.color : "transparent", color: k.status === s.id ? "#fff" : MUTED,
              font: "inherit", fontSize: "0.8rem", fontWeight: 700, px: 1.25, py: 0.35, borderRadius: 99, cursor: canWrite ? "pointer" : "default" }}>
            {s.label}
          </Box>
        ))}
        <Typography sx={{ fontSize: "0.84rem", color: late ? RED : FAINT, fontWeight: late ? 700 : 500 }}>
          {[k.ownerName, k.due ? `by ${dmy(k.due)}${late ? " - late" : ""}` : "", k.status === "done" && k.doneAt ? `done ${dmy(k.doneAt)}` : ""].filter(Boolean).join(" · ")}
        </Typography>
      </Box>
      {k.shared.length > 0 && (
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, display: "flex", gap: 0.5, alignItems: "center" }}>
          <PeopleOutlineIcon sx={{ fontSize: 17, color: FAINT }} /> Shared with {k.shared.map((p) => p.name).join(", ")}
        </Typography>
      )}

      {/* the task's Scroll to Sale tickets */}
      {tickets.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
      {canWrite && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => open("new")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "new" ? TINT.blue.fg : MUTED }}>New ticket</Button>
          <Button size="small" onClick={() => open("link")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "link" ? TINT.blue.fg : MUTED }}>Link open ones</Button>
          <Button size="small" startIcon={<PeopleOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => open("share")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "share" ? TINT.blue.fg : MUTED }}>Share</Button>
        </Box>
      )}
      {adding === "new" && t && <TicketFields form={t.form} values={values} set={(key, v) => setValues((o) => ({ ...o, [key]: v }))} />}
      {adding === "link" && <OpenTickets pick={pick} setPick={setPick} already={tickets.map((x) => x.id)} />}
      {adding === "share" && <People owners={owners} value={shared} onChange={setShared} label="Shared with - the new ones get a mail" />}
      {adding && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.82rem", color: missing.length ? RED : FAINT, flex: 1 }}>{missing.length ? `Still to fill in: ${missing.join(", ")}` : ""}</Typography>
          <Button variant="contained" disableElevation disabled={busy || missing.length > 0 || (adding === "link" && !pick.length)} onClick={() => void save()} sx={cta}>
            {busy ? "Saving…" : adding === "new" ? "Create the ticket" : adding === "share" ? "Save" : pick.length > 1 ? `Link these ${pick.length}` : "Link it"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function TicketLine({ tile, x, canWrite, reload }: { tile: TileInfo; x: Linked; canWrite: boolean; reload: () => Promise<void> }) {
  const unlink = async () => {
    try { await send("/api/reporting/kpi-actions/tickets", "POST", { action: "unlink", tile: tile.key, id: x.id }); await reload(); } catch (e) { alert((e as Error).message); }
  };
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", pl: 1.25, py: 0.5, borderLeft: `3px solid ${x.open ? TINT.amber.fg : HAIRLINE}`, opacity: x.open ? 1 : 0.6 }}>
      <ConfirmationNumberOutlinedIcon sx={{ fontSize: 18, color: x.open ? TINT.amber.fg : FAINT }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK }}>{x.subject || `Ticket ${x.id}`}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{[x.roadmapId, x.stageLabel, x.ownerName].filter(Boolean).join(" · ")}</Typography>
      </Box>
      <IconButton size="small" component="a" href={x.url} target="_blank" rel="noreferrer" aria-label="Open in HubSpot"><OpenInNewIcon sx={{ fontSize: 19 }} /></IconButton>
      {canWrite && <IconButton size="small" aria-label="Unlink" onClick={() => void unlink()}><LinkOffIcon sx={{ fontSize: 19, color: FAINT }} /></IconButton>}
    </Box>
  );
}
