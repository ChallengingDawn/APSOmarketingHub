"use client";
// A TILE'S ACTIONS - a window over the page like the Filters one (SARCLA 18.10.2026):
//   Tasks    what is done to correct the KPI: what, who, by when, open / doing / done
//   Tickets  "From Scroll to Sale" tickets: a new one with every field of the pipeline, prefilled
//            from the tile, or one or more existing ones linked
// The charts behind stay live; Escape or the cross closes it.

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

import { Badge, FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import type { KpiTask, TaskStatus } from "@/lib/reporting/kpiActions";
import type { S2sField } from "@/lib/reporting/scrollToSaleRules";
import { refreshActions, send } from "./store";
import type { TileInfo } from "./TileActions";

type Opt = { value: string; label: string };
type Linked = { id: string; subject: string; stageLabel: string; ownerName: string; roadmapId: string; url: string; createdHere: boolean };
type TicketsAnswer = { ok: boolean; canWrite: boolean; linked: Linked[]; form: { fields: S2sField[]; stages: Opt[]; owners: Opt[]; teams: Opt[] }; prefill: Record<string, string>; me: { id: string; name: string } | null; error?: string; message?: string };

const STATUS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "open", label: "Open", color: "#2459d1" },
  { id: "doing", label: "Doing", color: "#a96a12" },
  { id: "done", label: "Done", color: GREEN },
];
const small = { "& .MuiInputBase-root": { fontSize: "0.86rem", borderRadius: "10px" }, "& .MuiInputLabel-root": { fontSize: "0.84rem" } };

export function ActionsPanel({ tile, open, start, onClose }: { tile: TileInfo; open: boolean; start: "tasks" | "tickets"; onClose: () => void }) {
  const [tab, setTab] = useState<"tasks" | "tickets">(start);
  useEffect(() => { if (open) setTab(start); }, [open, start]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  // the owners and the ticket form come with the tickets' answer; the tasks use the same owners
  const [t, setT] = useState<TicketsAnswer | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);
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
  useEffect(() => { if (open && !t) void loadTickets(); }, [open, t, loadTickets]);

  return (
    <Box role="dialog" aria-modal="false" aria-label={`Actions for ${tile.title}`} aria-hidden={!open}
      sx={{
        position: "fixed", top: 16, right: 16, bottom: 16, width: { xs: "calc(100vw - 32px)", sm: 460 }, zIndex: 1300,
        display: "flex", flexDirection: "column", borderRadius: "22px", overflow: "hidden", bgcolor: "#fff",
        border: "1px solid rgba(21,34,58,.08)", boxShadow: "0 24px 60px rgba(21,34,58,.22), 0 4px 14px rgba(21,34,58,.08)",
        transformOrigin: "top right", transform: open ? "none" : "translate3d(28px, -6px, 0) scale(.96)",
        opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden",
        transition: open ? "transform .42s cubic-bezier(.16, 1, .3, 1), opacity .24s ease, visibility 0s" : "transform .22s ease, opacity .18s ease, visibility 0s linear .22s",
        "@media (prefers-reduced-motion: reduce)": { transition: "opacity .1s linear", transform: "none" },
      }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.75, borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg, #f6f8fc, #fff)" }}>
        <Badge icon={<TaskAltIcon />} tint="green" size={34} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{tile.title}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{tile.summary || "What is done to move this KPI"}</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)", "&:hover": { bgcolor: "rgba(21,34,58,.1)" } }}><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
      </Box>
      <Box sx={{ px: 2, pt: 1.25 }}>
        <ReportTabs name={`act-${tile.key.replace(/[^a-z0-9]/gi, "-")}`} tab={tab} onSelect={setTab}
          tabs={[{ id: "tasks", label: "Tasks", count: null }, { id: "tickets", label: "Scroll to Sale tickets", count: t?.linked.length ? String(t.linked.length) : null }]} />
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {open && tab === "tasks" && <Tasks tile={tile} owners={t?.form.owners ?? []} me={t?.me ?? null} canWrite={t?.canWrite ?? true} />}
        {open && tab === "tickets" && (
          tErr ? <Typography sx={{ fontSize: "0.86rem", color: RED }}>Could not read HubSpot: {tErr} <Button size="small" onClick={() => void loadTickets()}>Try again</Button></Typography>
            : !t ? <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Reading the pipeline…</Typography></Box>
              : <Tickets tile={tile} t={t} reload={loadTickets} />
        )}
      </Box>
    </Box>
  );
}

/* ── tasks ─────────────────────────────────────────────────────────────── */

function Tasks({ tile, owners, me, canWrite }: { tile: TileInfo; owners: Opt[]; me: { id: string; name: string } | null; canWrite: boolean }) {
  const [list, setList] = useState<KpiTask[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/reporting/kpi-actions/tasks?tile=${encodeURIComponent(tile.key)}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? `the hub answered ${r.status}`);
      setList(j.tasks); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [tile.key]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!owner && me) setOwner(me.id); }, [me, owner]);
  const ownerName = (id: string) => owners.find((o) => o.value === id)?.label ?? "";

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await send("/api/reporting/kpi-actions/tasks", "POST", { tile: tile.key, page: tile.page, title, note, due: due || undefined, owner, ownerName: ownerName(owner) });
      setTitle(""); setNote(""); setDue("");
      await load(); void refreshActions(tile.page);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const change = async (id: number, p: Partial<{ status: TaskStatus }>) => {
    try { await send("/api/reporting/kpi-actions/tasks", "PATCH", { id, ...p }); await load(); void refreshActions(tile.page); } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (id: number) => {
    if (!confirm("Remove this task?")) return;
    try { await send(`/api/reporting/kpi-actions/tasks?id=${id}`, "DELETE"); await load(); void refreshActions(tile.page); } catch (e) { setErr((e as Error).message); }
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {canWrite && (
        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", bgcolor: "#f7f9fc", border: `1px solid ${HAIRLINE}` }}>
          <TextField size="small" label="What will be done" value={title} onChange={(e) => setTitle(e.target.value)} sx={small} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void add(); } }} />
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 150px" }}>
            <TextField select size="small" label="Who" value={owners.some((o) => o.value === owner) ? owner : ""} onChange={(e) => setOwner(e.target.value)} sx={small}>
              {owners.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.86rem" }}>{o.label}</MenuItem>)}
            </TextField>
            <TextField size="small" type="date" label="By" value={due} onChange={(e) => setDue(e.target.value)} sx={small} InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={small} multiline minRows={1} maxRows={4} />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" disableElevation disabled={busy || !title.trim()} onClick={() => void add()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Add the task</Button>
          </Box>
        </Box>
      )}
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {!list ? <CircularProgress size={16} /> : !list.length ? (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No task on this KPI yet.</Typography>
      ) : list.map((k) => {
        const late = k.status !== "done" && k.due && k.due < today;
        return (
          <Box key={k.id} sx={{ display: "grid", gap: 0.5, p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, opacity: k.status === "done" ? 0.7 : 1 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: 650, color: INK, textDecoration: k.status === "done" ? "line-through" : "none" }}>{k.title}</Typography>
              {canWrite && <IconButton size="small" aria-label="Remove the task" onClick={() => void remove(k.id)}><DeleteOutlineIcon sx={{ fontSize: 18, color: FAINT }} /></IconButton>}
            </Box>
            {k.note && <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "pre-wrap" }}>{k.note}</Typography>}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
              {STATUS.map((s) => (
                <Box key={s.id} component="button" type="button" disabled={!canWrite} onClick={() => k.status !== s.id && void change(k.id, { status: s.id })}
                  sx={{ border: `1px solid ${k.status === s.id ? s.color : HAIRLINE}`, bgcolor: k.status === s.id ? s.color : "transparent", color: k.status === s.id ? "#fff" : MUTED,
                    font: "inherit", fontSize: "0.72rem", fontWeight: 700, px: 1, py: 0.25, borderRadius: 99, cursor: canWrite ? "pointer" : "default" }}>
                  {s.label}
                </Box>
              ))}
              <Typography sx={{ fontSize: "0.74rem", color: late ? RED : FAINT, fontWeight: late ? 700 : 500 }}>
                {[k.ownerName, k.due ? `by ${k.due.split("-").reverse().join(".")}${late ? " - late" : ""}` : "", k.status === "done" && k.doneAt ? `done ${k.doneAt.slice(0, 10).split("-").reverse().join(".")}` : ""].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/* ── tickets ───────────────────────────────────────────────────────────── */

function Tickets({ tile, t, reload }: { tile: TileInfo; t: TicketsAnswer; reload: () => Promise<void> }) {
  const [mode, setMode] = useState<"list" | "new" | "link">("list");
  const [err, setErr] = useState<string | null>(null);
  const unlink = async (id: string) => {
    try { await send("/api/reporting/kpi-actions/tickets", "POST", { action: "unlink", tile: tile.key, id }); await reload(); void refreshActions(tile.page); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {t.canWrite && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant={mode === "new" ? "contained" : "outlined"} disableElevation onClick={() => setMode(mode === "new" ? "list" : "new")} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>New ticket</Button>
          <Button variant={mode === "link" ? "contained" : "outlined"} disableElevation onClick={() => setMode(mode === "link" ? "list" : "link")} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Link existing</Button>
        </Box>
      )}
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {mode === "new" && <NewTicket tile={tile} t={t} done={async () => { setMode("list"); await reload(); void refreshActions(tile.page); }} />}
      {mode === "link" && <LinkTickets tile={tile} already={t.linked.map((x) => x.id)} done={async () => { setMode("list"); await reload(); void refreshActions(tile.page); }} />}
      {mode === "list" && (!t.linked.length ? (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No ticket linked to this KPI yet.</Typography>
      ) : t.linked.map((k) => (
        <Box key={k.id} sx={{ display: "flex", gap: 1, alignItems: "center", p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{k.subject || `Ticket ${k.id}`}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{[k.roadmapId, k.stageLabel, k.ownerName, k.createdHere ? "created here" : "linked"].filter(Boolean).join(" · ")}</Typography>
          </Box>
          <IconButton size="small" component="a" href={k.url} target="_blank" rel="noreferrer" aria-label="Open in HubSpot"><OpenInNewIcon sx={{ fontSize: 18 }} /></IconButton>
          {t.canWrite && <IconButton size="small" aria-label="Unlink" onClick={() => void unlink(k.id)}><LinkOffIcon sx={{ fontSize: 18, color: FAINT }} /></IconButton>}
        </Box>
      )))}
    </Box>
  );
}

function NewTicket({ tile, t, done }: { tile: TileInfo; t: TicketsAnswer; done: () => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>(t.prefill);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }));
  const optionsOf = (f: S2sField): Opt[] => f.kind === "stage" ? t.form.stages : f.kind === "owner" ? t.form.owners : f.kind === "team" ? t.form.teams : f.options ?? [];
  const missing = useMemo(() => t.form.fields.filter((f) => f.required && !String(v[f.name] ?? "").trim()).map((f) => f.label), [t.form.fields, v]);
  const create = async () => {
    setBusy(true); setErr(null);
    try { await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, values: v }); await done(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ display: "grid", gap: 1.1, p: 1.5, borderRadius: "14px", bgcolor: "#f7f9fc", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Every field of the pipeline, filled in from the tile where it says so - check and change what is wrong.</Typography>
      {t.form.fields.map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        if (f.kind === "multi") {
          const chosen = (v[f.name] ?? "").split(";").filter(Boolean);
          return (
            <Box key={f.name}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, mb: 0.25 }}>{label}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {optionsOf(f).map((o) => {
                  const on = chosen.includes(o.value);
                  return (
                    <Box key={o.value} component="button" type="button" onClick={() => set(f.name, (on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value]).join(";"))}
                      sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED, font: "inherit", fontSize: "0.76rem", fontWeight: on ? 700 : 500, px: 1, py: 0.3, borderRadius: 99, cursor: "pointer" }}>
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
            <TextField key={f.name} select size="small" label={label} value={opts.some((o) => o.value === v[f.name]) ? v[f.name] : ""} onChange={(e) => set(f.name, e.target.value)} sx={small}>
              {!f.required && <MenuItem value="" sx={{ fontSize: "0.86rem", color: FAINT }}>-</MenuItem>}
              {opts.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.86rem" }}>{o.label}</MenuItem>)}
            </TextField>
          );
        }
        return (
          <TextField key={f.name} size="small" label={label} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} sx={small}
            type={f.kind === "date" ? "date" : "text"} multiline={f.kind === "textarea"} minRows={f.kind === "textarea" ? 2 : undefined} maxRows={8}
            InputLabelProps={f.kind === "date" ? { shrink: true } : undefined} />
        );
      })}
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.74rem", color: missing.length ? RED : FAINT, flex: 1 }}>{missing.length ? `Still to fill in: ${missing.join(", ")}` : "Ready - it goes to HubSpot in From Scroll to Sale"}</Typography>
        <Button variant="contained" disableElevation disabled={busy || missing.length > 0} onClick={() => void create()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>{busy ? "Creating…" : "Create the ticket"}</Button>
      </Box>
    </Box>
  );
}

function LinkTickets({ tile, already, done }: { tile: TileInfo; already: string[]; done: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Linked[] | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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
  const link = async () => {
    setBusy(true);
    try { await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, ids: pick }); await done(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", bgcolor: "#f7f9fc", border: `1px solid ${HAIRLINE}` }}>
      <TextField size="small" label="Search the pipeline - name or roadmap ID" value={q} onChange={(e) => setQ(e.target.value)} sx={small} autoFocus />
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {!rows ? <CircularProgress size={16} /> : !rows.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No ticket found.</Typography> : (
        <Box sx={{ display: "grid", gap: 0.25, maxHeight: 320, overflowY: "auto" }}>
          {rows.map((k) => {
            const has = already.includes(k.id);
            return (
              <Box key={k.id} component="label" sx={{ display: "flex", gap: 0.5, alignItems: "center", px: 0.5, borderRadius: "10px", cursor: has ? "default" : "pointer", "&:hover": { bgcolor: has ? "transparent" : "rgba(21,34,58,.04)" } }}>
                <Checkbox size="small" disabled={has} checked={has || pick.includes(k.id)} onChange={(e) => setPick((p) => e.target.checked ? [...p, k.id] : p.filter((x) => x !== k.id))} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{k.subject || `Ticket ${k.id}`}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{[k.roadmapId, k.stageLabel, k.ownerName, has ? "already linked" : ""].filter(Boolean).join(" · ")}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" disableElevation disabled={busy || !pick.length} onClick={() => void link()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>
          {pick.length > 1 ? `Link these ${pick.length} tickets` : "Link the ticket"}
        </Button>
      </Box>
    </Box>
  );
}
