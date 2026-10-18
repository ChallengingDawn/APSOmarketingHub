"use client";
// A TILE'S TASKS - a window over the page like the Filters one (SARCLA 18.10.2026): what is done to
// correct the KPI (what, who, by when, open / doing / done), and inside each task its "From Scroll to
// Sale" tickets ("the scroll to sale ticket should be inside of the task"): a new one with every field
// of the pipeline, prefilled from the task and the tile, or open ones linked. The charts behind stay
// live; Escape or the cross closes it.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";

import { Badge, FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { KpiTask, TaskStatus } from "@/lib/reporting/kpiActions";
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
const field = { "& .MuiInputBase-root": { fontSize: "0.92rem", borderRadius: "10px" }, "& .MuiInputLabel-root": { fontSize: "0.9rem" } };
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "10px", fontSize: "0.9rem" } as const;
const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join(".");

export function ActionsPanel({ tile, open, onClose }: { tile: TileInfo; open: boolean; onClose: () => void }) {
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

  const canWrite = t?.canWrite ?? true;
  const ticketsOf = (id: number) => (t?.linked ?? []).filter((x) => x.taskId === id);
  const loose = (t?.linked ?? []).filter((x) => x.taskId == null);

  return (
    <Box role="dialog" aria-modal="false" aria-label={`Tasks for ${tile.title}`} aria-hidden={!open}
      sx={{
        position: "fixed", top: 16, right: 16, bottom: 16, width: { xs: "calc(100vw - 32px)", sm: 520 }, zIndex: 1300,
        display: "flex", flexDirection: "column", borderRadius: "22px", overflow: "hidden", bgcolor: "#fff",
        border: "1px solid rgba(21,34,58,.08)", boxShadow: "0 24px 60px rgba(21,34,58,.22), 0 4px 14px rgba(21,34,58,.08)",
        transformOrigin: "top right", transform: open ? "none" : "translate3d(28px, -6px, 0) scale(.96)",
        opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden",
        transition: open ? "transform .42s cubic-bezier(.16, 1, .3, 1), opacity .24s ease, visibility 0s" : "transform .22s ease, opacity .18s ease, visibility 0s linear .22s",
        "@media (prefers-reduced-motion: reduce)": { transition: "opacity .1s linear", transform: "none" },
      }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2.5, py: 2, borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg, #f6f8fc, #fff)" }}>
        <Badge icon={<TaskAltIcon />} tint="green" size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{tile.title}</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{tile.summary || "What is done to move this KPI"}</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)", "&:hover": { bgcolor: "rgba(21,34,58,.1)" } }}><CloseIcon sx={{ fontSize: 22 }} /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2, display: "grid", gap: 1.75, alignContent: "start" }}>
        {open && canWrite && <AddTask tile={tile} t={t} tErr={tErr} retry={loadTickets} done={reload} />}
        {(err || tErr) && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err ?? `HubSpot could not be read: ${tErr}`}</Typography>}
        {!tasks ? <CircularProgress size={18} /> : !tasks.length && !loose.length ? (
          <Typography sx={{ fontSize: "0.92rem", color: FAINT }}>No task on this KPI yet.</Typography>
        ) : (
          <>
            {tasks.map((k) => <TaskRow key={k.id} tile={tile} k={k} t={t} tickets={ticketsOf(k.id)} canWrite={canWrite} reload={reload} setErr={setErr} />)}
            {loose.length > 0 && (
              <Box sx={{ display: "grid", gap: 0.75 }}>
                <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tickets without a task</Typography>
                {loose.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

/* ── a new task, with its ticket ───────────────────────────────────────── */

function AddTask({ tile, t, tErr, retry, done }: { tile: TileInfo; t: TicketsAnswer | null; tErr: string | null; retry: () => Promise<void>; done: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [ticket, setTicket] = useState<"none" | "new" | "link">("none");
  const [values, setValues] = useState<Record<string, string>>({});
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (t?.me && !owner) setOwner(t.me.id); }, [t, owner]);
  useEffect(() => { if (t) setValues((v) => (Object.keys(v).length ? v : t.prefill)); }, [t]);
  // the ticket follows the task: its name, owner and planned date, until someone changes them there
  useEffect(() => {
    setValues((v) => ({
      ...v,
      ...(!subjectTouched && title.trim() ? { subject: `${tile.kpiId ? `${tile.kpiId} ` : ""}${title.trim()}`.slice(0, 200) } : {}),
      ...(owner ? { hubspot_owner_id: owner } : {}),
      ...(due ? { mkt_planned_date: due } : {}),
      ...(note.trim() ? { mkt_next_steps: note.trim() } : {}),
    }));
  }, [title, owner, due, note, subjectTouched, tile.kpiId]);
  const owners = t?.form.owners ?? [];
  const missing = useMemo(() => (ticket === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : []), [ticket, t, values]);
  const ready = !!title.trim() && !busy && (ticket !== "new" || !missing.length) && (ticket !== "link" || pick.length > 0);

  const add = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    try {
      const j = await send("/api/reporting/kpi-actions/tasks", "POST", { tile: tile.key, page: tile.page, title, note, due: due || undefined, owner, ownerName: owners.find((o) => o.value === owner)?.label ?? "" });
      const taskId = (j.task as KpiTask).id;
      if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId, values });
      if (ticket === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId, ids: pick });
      setTitle(""); setNote(""); setDue(""); setTicket("none"); setPick([]); setSubjectTouched(false); setValues(t?.prefill ?? {});
      await done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.1, p: 1.75, borderRadius: "16px", bgcolor: "#f7f9fc", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>New task</Typography>
      <TextField size="small" label="What will be done" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} autoFocus />
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 160px" }}>
        <TextField select size="small" label="Who" value={owners.some((o) => o.value === owner) ? owner : ""} onChange={(e) => setOwner(e.target.value)} sx={field}>
          {owners.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.9rem" }}>{o.label}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="By" value={due} onChange={(e) => setDue(e.target.value)} sx={field} InputLabelProps={{ shrink: true }} />
      </Box>
      <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={field} multiline minRows={1} maxRows={4} />

      {/* its Scroll to Sale ticket, inside the task */}
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", pt: 0.25 }}>
        <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: FAINT }} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: MUTED, mr: 0.5 }}>Scroll to Sale ticket</Typography>
        {([["none", "None"], ["new", "New ticket"], ["link", "Link existing"]] as const).map(([id, label]) => (
          <Box key={id} component="button" type="button" onClick={() => setTicket(id)}
            sx={{ border: `1px solid ${ticket === id ? TINT.blue.fg : HAIRLINE}`, bgcolor: ticket === id ? TINT.blue.bg : "#fff", color: ticket === id ? TINT.blue.fg : MUTED, font: "inherit", fontSize: "0.84rem", fontWeight: ticket === id ? 700 : 600, px: 1.25, py: 0.45, borderRadius: 99, cursor: "pointer" }}>
            {label}
          </Box>
        ))}
      </Box>
      {ticket !== "none" && !t && (
        tErr ? <Typography sx={{ fontSize: "0.86rem", color: RED }}>HubSpot could not be read: {tErr} <Button size="small" onClick={() => void retry()}>Try again</Button></Typography>
          : <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Reading the pipeline…</Typography></Box>
      )}
      {ticket === "new" && t && <TicketFields form={t.form} values={values} set={(k, x) => { if (k === "subject") setSubjectTouched(true); setValues((v) => ({ ...v, [k]: x })); }} />}
      {ticket === "link" && <OpenTickets pick={pick} setPick={setPick} already={(t?.linked ?? []).map((x) => x.id)} />}

      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.8rem", color: missing.length ? RED : FAINT, flex: 1 }}>
          {missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : ticket === "new" ? "The ticket goes to HubSpot, in From Scroll to Sale" : ""}
        </Typography>
        <Button variant="contained" disableElevation disabled={!ready} onClick={() => void add()} sx={cta}>
          {busy ? "Saving…" : ticket === "new" ? "Add the task and its ticket" : ticket === "link" ? "Add the task and link" : "Add the task"}
        </Button>
      </Box>
    </Box>
  );
}

/** Every field of the pipeline, prefilled - the person checks and changes what is wrong. */
function TicketFields({ form, values, set }: { form: Form; values: Record<string, string>; set: (k: string, v: string) => void }) {
  const optionsOf = (f: S2sField): Opt[] => f.kind === "stage" ? form.stages : f.kind === "owner" ? form.owners : f.kind === "team" ? form.teams : f.options ?? [];
  return (
    <Box sx={{ display: "grid", gap: 1.1, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Filled in from the task and the KPI - check and change what is wrong.</Typography>
      {form.fields.map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        if (f.kind === "multi") {
          const chosen = (values[f.name] ?? "").split(";").filter(Boolean);
          return (
            <Box key={f.name}>
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
          <TextField key={f.name} size="small" label={label} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} sx={field}
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
    <Box sx={{ display: "grid", gap: 0.75, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
      <TextField size="small" label="Search the open tickets - name or roadmap ID" value={q} onChange={(e) => setQ(e.target.value)} sx={field} />
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      {!rows ? <CircularProgress size={16} /> : !rows.length ? <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>No open ticket found.</Typography> : (
        <Box sx={{ display: "grid", gap: 0.25, maxHeight: 300, overflowY: "auto" }}>
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
  const [adding, setAdding] = useState<null | "new" | "link">(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const late = k.status !== "done" && k.due && k.due < today;
  const change = async (p: { status: TaskStatus }) => {
    try { await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, ...p }); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const remove = async () => {
    if (!confirm(tickets.length ? "Remove this task? Its tickets stay in HubSpot." : "Remove this task?")) return;
    try { await send(`/api/reporting/kpi-actions/tasks?id=${k.id}`, "DELETE"); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const open = (mode: "new" | "link") => {
    setAdding(adding === mode ? null : mode);
    if (t) setValues({ ...t.prefill, subject: `${tile.kpiId ? `${tile.kpiId} ` : ""}${k.title}`.slice(0, 200), ...(k.owner && /^\d+$/.test(k.owner) ? { hubspot_owner_id: k.owner } : {}), ...(k.due ? { mkt_planned_date: k.due } : {}), ...(k.note ? { mkt_next_steps: k.note } : {}) });
  };
  const missing = adding === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const save = async () => {
    setBusy(true);
    try {
      if (adding === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId: k.id, values });
      if (adding === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId: k.id, ids: pick });
      setAdding(null); setPick([]); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 0.75, p: 1.5, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, opacity: k.status === "done" ? 0.75 : 1 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 650, color: INK, textDecoration: k.status === "done" ? "line-through" : "none" }}>{k.title}</Typography>
        {canWrite && <IconButton size="small" aria-label="Remove the task" onClick={() => void remove()}><DeleteOutlineIcon sx={{ fontSize: 20, color: FAINT }} /></IconButton>}
      </Box>
      {k.note && <Typography sx={{ fontSize: "0.86rem", color: MUTED, whiteSpace: "pre-wrap" }}>{k.note}</Typography>}
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        {STATUS.map((s) => (
          <Box key={s.id} component="button" type="button" disabled={!canWrite} onClick={() => k.status !== s.id && void change({ status: s.id })}
            sx={{ border: `1px solid ${k.status === s.id ? s.color : HAIRLINE}`, bgcolor: k.status === s.id ? s.color : "transparent", color: k.status === s.id ? "#fff" : MUTED,
              font: "inherit", fontSize: "0.8rem", fontWeight: 700, px: 1.25, py: 0.35, borderRadius: 99, cursor: canWrite ? "pointer" : "default" }}>
            {s.label}
          </Box>
        ))}
        <Typography sx={{ fontSize: "0.82rem", color: late ? RED : FAINT, fontWeight: late ? 700 : 500 }}>
          {[k.ownerName, k.due ? `by ${dmy(k.due)}${late ? " - late" : ""}` : "", k.status === "done" && k.doneAt ? `done ${dmy(k.doneAt)}` : ""].filter(Boolean).join(" · ")}
        </Typography>
      </Box>

      {/* the task's Scroll to Sale tickets */}
      {tickets.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
      {canWrite && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => open("new")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "new" ? TINT.blue.fg : MUTED }}>New ticket</Button>
          <Button size="small" onClick={() => open("link")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "link" ? TINT.blue.fg : MUTED }}>Link existing</Button>
        </Box>
      )}
      {adding === "new" && t && <TicketFields form={t.form} values={values} set={(key, v) => setValues((o) => ({ ...o, [key]: v }))} />}
      {adding === "link" && <OpenTickets pick={pick} setPick={setPick} already={tickets.map((x) => x.id)} />}
      {adding && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.8rem", color: missing.length ? RED : FAINT, flex: 1 }}>{missing.length ? `Still to fill in: ${missing.join(", ")}` : ""}</Typography>
          <Button variant="contained" disableElevation disabled={busy || missing.length > 0 || (adding === "link" && !pick.length)} onClick={() => void save()} sx={cta}>
            {busy ? "Saving…" : adding === "new" ? "Create the ticket" : pick.length > 1 ? `Link these ${pick.length}` : "Link it"}
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
