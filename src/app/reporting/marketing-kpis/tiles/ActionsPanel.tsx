"use client";
// A TILE'S ACTIONS - a large window over the page (SARCLA 18.10.2026: "put the modal bigger and user
// friendly"): on the left a new task - what will be done (it names the ticket), who, by when, who it
// is shared with, and its "From Scroll to Sale" ticket inside it (none, new and prefilled, or open
// ones linked); on the right the tile's tasks with their tickets. In the header: whether the tile
// shows In a nutshell. The owner and the people shared with get a mail from the hub; the ticket is
// shared with them in HubSpot too. Escape or the cross closes it. As wide as the action plan's window (SARCLA
// 01.11.2026: "the modal should be wider, like the modal"); "Create with AI" fills the new task and its ticket from a
// description; existing tickets are found open, closed (to trace back) or all.

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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { Badge, FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { FORMAT_LABEL } from "./store";
import type { KpiTask, Placement, TaskStatus, TileFormat } from "@/lib/reporting/kpiActions";
import type { AiFill, S2sField } from "@/lib/reporting/scrollToSaleRules";
import { refreshActions, send } from "./store";
import type { TileInfo } from "./TileActions";
import { refreshPlanKpis, usePlanKpis } from "./planKpis";
import { PLAN_KPI_TEAMS, teamOfPage, viewOf, type PlanKpiTeam } from "@/lib/reporting/planKpiTeams";

export type Opt = { value: string; label: string };
export type Linked = { id: string; subject: string; stageLabel: string; open: boolean; ownerName: string; roadmapId: string; url: string; createdHere: boolean; taskId: number | null };
type Form = { fields: S2sField[]; stages: Opt[]; owners: Opt[]; teams: Opt[] };
export type TicketsAnswer = { ok: boolean; canWrite: boolean; linked: Linked[]; form: Form; prefill: Record<string, string>; me: { id: string; name: string } | null; error?: string; message?: string };

const STATUS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "open", label: "Open", color: "#2459d1" },
  { id: "doing", label: "Doing", color: "#a96a12" },
  { id: "done", label: "Done", color: GREEN },
];
/**
 * A form's text box, the same in every window of the plan and on the tiles (SARCLA 03.11.2026: "design padding still
 * shit"): a text over several lines starts where a one-line one does - the theme pads both the box and its text area,
 * which put it twice as far in.
 */
export const field = {
  "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" },
  "& .MuiInputBase-multiline": { padding: "10px 13px" }, "& .MuiInputBase-multiline.MuiInputBase-sizeSmall": { padding: "7px 11px" },
  "& .MuiInputBase-inputMultiline": { padding: 0 },
  // a people picker's text too, beside its chips
  "& .MuiInputBase-root.MuiAutocomplete-inputRoot.MuiInputBase-sizeSmall .MuiAutocomplete-input": { paddingLeft: "5px" },
};

/** A task's note at the head of its ticket's description - the ticket has no next steps any more (SARCLA 03.11.2026). */
const withNote = (values: Record<string, string>, note: string): Record<string, string> => {
  const n = note.trim();
  return n && !String(values.content ?? "").includes(n) ? { ...values, content: [n, values.content].filter(Boolean).join("\n\n") } : values;
};
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "10px", fontSize: "0.9rem" } as const;
const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join(".");
const section = { fontSize: "0.74rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
// "Create with AI" in violet, apart from the form's blue (the action plan's sub-actions use it too)
export const AI_INK = "#6a46c9", AI_SOFT = "rgba(106,70,201,.06)", AI_LINE = "rgba(106,70,201,.35)";

/** The people a task is shared with - HubSpot owners, by name. */
export function People({ owners, value, onChange, label = "Shared with" }: { owners: Opt[]; value: string[]; onChange: (v: string[]) => void; label?: string }) {
  return (
    <Autocomplete multiple size="small" options={owners} value={owners.filter((o) => value.includes(o.value))}
      getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
      onChange={(_, v) => onChange(v.map((o) => o.value))} filterSelectedOptions
      renderInput={(p) => <TextField {...p} label={label} placeholder={value.length ? "" : "Colleagues to inform - they get a mail, and the ticket in HubSpot"} sx={field}
        InputLabelProps={{ ...p.InputLabelProps, shrink: true }} />} />
  );
}

/**
 * The action plan's actions, read once per page visit, for the picker below - or null when the plan is not
 * this person's (admins only, SARCLA 01.11.2026): then nothing of the plan shows on the tile.
 */
type PlanOption = { id: number; title: string; code: string; topic: string; who: string };
let planOptions: Promise<PlanOption[] | null> | null = null;
function loadPlanOptions(): Promise<PlanOption[] | null> {
  if (!planOptions) {
    planOptions = fetch("/api/action-plan").then(async (r) => {
      if (r.status === 401 || r.status === 403) return null;
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      const items = j.items as { id: number; parentId: number | null; kind: string; title: string; code: string; responsible: string }[];
      const byId = new Map(items.map((i) => [i.id, i]));
      const topicOf = (id: number | null): string => {
        for (let x = id == null ? undefined : byId.get(id); x; x = x.parentId == null ? undefined : byId.get(x.parentId)) if (x.kind === "topic") return x.title;
        return "";
      };
      return items.filter((i) => i.kind === "action").map((i) => ({ id: i.id, title: i.title, code: i.code, topic: topicOf(i.parentId), who: i.responsible }));
    });
    planOptions.catch(() => { planOptions = null; });
  }
  return planOptions;
}

/** Whether this person has the action plan (null while asking). */
function usePlanAccess(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { loadPlanOptions().then((o) => setOk(!!o), () => setOk(false)); }, []);
  return ok;
}

/** A KPI tile's task as a sub-action of the action plan (SARCLA 31.10.2026: "linked and triggered from the KPI actions"). */
function PlanPick({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [opts, setOpts] = useState<PlanOption[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadPlanOptions().then((o) => (o ? setOpts(o) : setDenied(true)), (e) => setErr((e as Error).message)); }, []);
  if (denied) return null;
  if (err) return <Typography sx={{ fontSize: "0.84rem", color: RED }}>The action plan could not be read: {err}</Typography>;
  return (
    <Autocomplete size="small" options={opts ?? []} loading={!opts} value={(opts ?? []).find((o) => o.id === value) ?? null}
      groupBy={(o) => o.topic} getOptionLabel={(o) => o.title} isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, v) => onChange(v?.id ?? null)}
      renderOption={(p, o) => (
        <li {...p} key={o.id}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.88rem", color: INK }}>{o.title}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{[o.code, o.who].filter(Boolean).join(" · ")}</Typography>
          </Box>
        </li>
      )}
      renderInput={(p) => <TextField {...p} label="Part of the action plan (optional)" placeholder="The action this task moves forward" sx={field} />} />
  );
}

/**
 * The tile on the action plan's KPIs (SARCLA 04.11.2026: "they need to be promoted here with a defined target ... the KPI
 * inside is defined on the Advanced reporting action"): for whoever has the plan (admins), once its target is saved, under
 * a team - its page's by default. There it stands as Target complete, Still running or Late.
 */
function PlanKpiSwitch({ tile, saved }: { tile: TileInfo; saved: boolean }) {
  const { state, denied } = usePlanKpis();
  const on = state?.kpis.find((k) => k.key === tile.key);
  const [team, setTeam] = useState<PlanKpiTeam>(on?.team ?? teamOfPage(tile.page));
  useEffect(() => { if (on) setTeam(on.team); }, [on?.team]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (denied || !state || !tile.target) return null;
  const go = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { await send("/api/action-plan/kpis", "POST", body); await refreshPlanKpis(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const promote = (t: PlanKpiTeam) => go({
    action: "promote", key: tile.key, page: tile.page, team: t, title: tile.title,
    href: tile.href ?? `${window.location.pathname}${window.location.search}`,
    targetKey: tile.target!.key, unit: tile.target!.unit, summary: tile.summary ?? "", view: viewOf(tile),
  });
  const teamName = PLAN_KPI_TEAMS.find((x) => x.id === (on?.team ?? team))?.name ?? "";
  return (
    <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.25, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 220, cursor: saved || on ? "pointer" : "default" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: on ? TINT.blue.fg : INK }}>Action plan · KPIs</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              {on ? `Tracked there under ${teamName}, against this target` : saved ? "Track it on the action plan's KPIs, against this target" : "Save a target first - a KPI goes to the plan with its target"}
            </Typography>
          </Box>
          <Switch checked={!!on} disabled={busy || (!on && !saved)} slotProps={{ input: { "aria-label": "On the action plan's KPIs" } }}
            onChange={(e) => void (e.target.checked ? promote(team) : go({ action: "demote", key: tile.key }))} />
        </Box>
        <TextField select size="small" label="Team" value={team} disabled={busy} sx={{ ...field, width: 190 }}
          onChange={(e) => { const t = e.target.value as PlanKpiTeam; setTeam(t); if (on) void promote(t); }}>
          {PLAN_KPI_TEAMS.map((x) => <MenuItem key={x.id} value={x.id} sx={{ fontSize: "0.86rem" }}>{x.name}</MenuItem>)}
        </TextField>
      </Box>
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
    </Box>
  );
}

/** A chart's target (SARCLA 25.10.2026: "allow to enter a threshold so we can measure the rest of it"): typed here, one
 *  for everyone; the chart draws it and says how far each row is from it. Shown only for a chart that can use one. */
function TargetBox({ tile, value, canWrite, current = null }: {
  tile: TileInfo; value: number | null; canWrite: boolean;
  /** what the tile shows now, in the target's terms - for a tile with no chart of its own to draw the target */
  current?: number | null;
}) {
  const t = tile.target!;
  const shown = (v: number | null) => (v == null ? "" : t.unit === "pct" ? String(Math.round(v * 1000) / 10) : String(Math.round(v)));
  const [v, setV] = useState(shown(value));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setV(shown(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = (): number | null => {
    const s = v.replace(/[\s',€%]/g, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? (t.unit === "pct" ? n / 100 : n) : null;
  };
  const save = async (val: number | null) => {
    setBusy(true); setErr(null);
    // the plan's KPIs read it too
    try { await send("/api/reporting/kpi-actions/target", "POST", { key: t.key, value: val }); await refreshActions(tile.page); void refreshPlanKpis(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const now = value == null ? "No target yet" : t.unit === "pct" ? `${(value * 100).toFixed(1)}%` : t.unit === "n" ? Math.round(value).toLocaleString("en") : `€${Math.round(value).toLocaleString("en")}`;
  return (
    <Box sx={{ p: 2, borderRadius: "14px", border: `1px solid ${value == null ? HAIRLINE : TINT.blue.fg}`, bgcolor: "#fff", display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={section}>Target</Typography>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: value == null ? FAINT : INK, fontVariantNumeric: "tabular-nums" }}>{now}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{t.label}</Typography>
      {/* how far it is, where the tile has no chart to draw the target on */}
      {current != null && value != null && value > 0 && (
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Box sx={{ height: 6, borderRadius: "3px", bgcolor: "#eef1f6", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${Math.min(1, current / value) * 100}%`, bgcolor: current >= value ? GREEN : current >= value * 0.8 ? TINT.amber.fg : RED }} />
          </Box>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: current >= value ? GREEN : current >= value * 0.8 ? TINT.amber.fg : RED }}>{Math.round((current / value) * 100)} % of the target</Typography>
        </Box>
      )}
      {canWrite && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" value={v} onChange={(e) => setV(e.target.value)} label={t.unit === "pct" ? "Target in %" : t.unit === "n" ? "Target" : "Target in EUR"}
            placeholder={t.unit === "pct" ? "100" : t.unit === "n" ? "50" : "500000"} sx={{ ...field, width: 200 }} slotProps={{ htmlInput: { inputMode: "decimal" } }}
            onKeyDown={(e) => { if (e.key === "Enter" && parsed() != null) void save(parsed()); }} />
          <Button variant="contained" disableElevation disabled={busy || parsed() == null} onClick={() => void save(parsed())} sx={cta}>Save the target</Button>
          {value != null && <Button disabled={busy} onClick={() => { setV(""); void save(null); }} sx={cta}>Clear</Button>}
        </Box>
      )}
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {canWrite && <PlanKpiSwitch tile={tile} saved={value != null} />}
    </Box>
  );
}

/** A tile's tasks, and in one other read its owners, ticket form and linked tickets - read when it opens. */
export function useTileActions(tile: TileInfo, open: boolean) {
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
  return { t, tErr, tasks, err, setErr, loadTickets, loadTasks };
}

export function ActionsPanel({ tile, open, onClose, placed, format, formats, onMove, canWrite, target = null, current = null, plan, onChanged }: {
  tile: TileInfo; open: boolean; onClose: () => void; placed: Placement; format: TileFormat; formats: TileFormat[];
  onMove: (to: Placement, format?: TileFormat) => Promise<void>; canWrite: boolean;
  /** the chart's target now, when the chart takes one */
  target?: number | null;
  /** what the tile shows now, in its target's terms */
  current?: number | null;
  /** an action of the action plan (tile "plan:<id>"): its tasks are its sub-actions, there is no BUC View, and a
   *  Scroll to Sale ticket only when Digital Growth leads the action (SARCLA 31.10.2026) */
  plan?: { tickets: boolean };
  /** told after every change, for a page that shows the tasks too */
  onChanged?: () => void;
}) {
  // how big it goes to the nutshell - a small tile, half or the whole width, as the graph allows
  // (SARCLA 19.10: "propose several types"); chosen before the switch is turned on, or changed at once there
  const choose = formats.length > 1;
  const [want, setWant] = useState<TileFormat>(format);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const { t, tErr, tasks, err, setErr, loadTickets, loadTasks } = useTileActions(tile, open);
  const [moving, setMoving] = useState(false);
  // a KPI page's counts follow its tiles; the plan counts its own (onChanged)
  const reload = async () => { await Promise.all([loadTasks(), loadTickets()]); if (!plan) void refreshActions(tile.page); onChanged?.(); };
  const tickets = plan ? plan.tickets : true;
  const move = async (to: Placement, fmt?: TileFormat) => {
    setMoving(true);
    try { await onMove(to, fmt); } catch (e) { setErr(`Could not move it: ${(e as Error).message}`); } finally { setMoving(false); }
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
          position: "fixed", top: 16, bottom: 16, left: "50%", transform: "translateX(-50%)", width: "min(1320px, calc(100vw - 32px))", zIndex: 1300,
          display: "flex", flexDirection: "column", borderRadius: "22px", overflow: "hidden", bgcolor: "#fbfcfe",
          border: "1px solid rgba(21,34,58,.08)", boxShadow: "0 24px 60px rgba(21,34,58,.25), 0 4px 14px rgba(21,34,58,.08)",
        }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
          <Badge icon={<TaskAltIcon />} tint="green" size={44} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{tile.title}</Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>{tile.summary || (plan ? "The sub-actions of this action" : "What is done to move this KPI")}</Typography>
          </Box>
          {/* promote / demote: one choice for everyone - a KPI's, not an action's */}
          {!plan && <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.75, borderRadius: "12px", border: `1px solid ${placed === "nutshell" ? TINT.blue.fg : HAIRLINE}`, bgcolor: placed === "nutshell" ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
            <Box>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: placed === "nutshell" ? TINT.blue.fg : INK }}>BUC View</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{placed === "nutshell" ? "Shown there for everyone" : "Only on this page"}</Typography>
            </Box>
            <Switch checked={placed === "nutshell"} disabled={!canWrite || moving} onChange={(e) => void move(e.target.checked ? "nutshell" : "tab", e.target.checked && choose ? want : undefined)} />
          </Box>}
          {!plan && choose && (
            <Box sx={{ display: "grid", gap: 0.35 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Shown as</Typography>
              <ToggleButtonGroup size="small" exclusive value={placed === "nutshell" ? format : want} disabled={!canWrite || moving} aria-label="How it is shown in the BUC View"
                onChange={(_, v: TileFormat | null) => { if (!v) return; setWant(v); if (placed === "nutshell") void move("nutshell", v); }}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: "0.8rem", px: 1.25, py: 0.4 } }}>
                {formats.map((f) => <ToggleButton key={f} value={f}>{FORMAT_LABEL[f]}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
          )}
          <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)", "&:hover": { bgcolor: "rgba(21,34,58,.1)" } }}><CloseIcon sx={{ fontSize: 22 }} /></IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: canWrite ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)" } }}>
          {canWrite && (
            <Box sx={{ overflowY: "auto", px: 3, py: 2.5, borderRight: { md: `1px solid ${HAIRLINE}` } }}>
              <AddTask tile={tile} t={t} tErr={tErr} retry={loadTickets} done={reload} plan={!!plan} tickets={tickets} />
            </Box>
          )}
          <Box sx={{ overflowY: "auto", px: 3, py: 2.5, display: "grid", gap: 1.5, alignContent: "start" }}>
            {tile.target && <TargetBox tile={tile} value={target} canWrite={canWrite} current={current} />}
            <Typography sx={section}>{plan ? "Sub-actions" : "Tasks"}{tasks?.length ? ` · ${openCount} open of ${tasks.length}` : ""}</Typography>
            {(err || (tErr && tickets)) && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err ?? `HubSpot could not be read: ${tErr}`}</Typography>}
            {!tasks ? <CircularProgress size={18} /> : !tasks.length && !loose.length ? (
              <Box sx={{ p: 2.5, borderRadius: "14px", border: `1px dashed ${HAIRLINE}`, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.95rem", color: MUTED, fontWeight: 600 }}>{plan ? "No sub-action yet" : "No task on this KPI yet"}</Typography>
                <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{canWrite ? (plan ? "Write on the left the first step - or add one from a KPI tile's Actions." : "Write on the left what will be done to move it.") : "Nothing is being done on it yet."}</Typography>
              </Box>
            ) : (
              <>
                {tasks.map((k) => <TaskRow key={k.id} tile={tile} k={k} t={t} tickets={ticketsOf(k.id)} canWrite={canWrite} reload={reload} setErr={setErr} plan={!!plan} allowTickets={tickets} />)}
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

function AddTask({ tile, t, tErr, retry, done, plan, tickets }: { tile: TileInfo; t: TicketsAnswer | null; tErr: string | null; retry: () => Promise<void>; done: () => Promise<void>; plan: boolean; tickets: boolean }) {
  const [title, setTitle] = useState("");
  // a KPI tile's task can be a sub-action of the action plan as well
  const [planItem, setPlanItem] = useState<number | null>(null);
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
  // "Create with AI": the description, and what came back
  const [ai, setAi] = useState<{ open: boolean; text: string; busy: boolean; msg: string | null; err: string | null }>({ open: false, text: "", busy: false, msg: null, err: null });
  useEffect(() => { if (t?.me && !owner) setOwner(t.me.id); }, [t, owner]);
  // the prefill goes under what is already typed: the task's own fields (below) are written in before HubSpot answers,
  // so "nothing yet" cannot be told by an empty object - the prefill never reached the form (seen 01.11.2026)
  useEffect(() => { if (t) setValues((v) => ({ ...t.prefill, ...Object.fromEntries(Object.entries(v).filter(([, x]) => String(x ?? "").trim())) })); }, [t]);
  // the ticket follows the task: the action is its name; its owner and planned date - its note heads the description
  // when the ticket is made (withNote)
  useEffect(() => {
    setValues((v) => ({ ...v, subject: title.trim().slice(0, 200), ...(owner ? { hubspot_owner_id: owner } : {}), ...(due ? { mkt_planned_date: due } : {}) }));
  }, [title, owner, due]);
  const owners = t?.form.owners ?? [];
  const missing = useMemo(() => (ticket === "new" && t ? t.form.fields.filter((f) => f.required && f.name !== "subject" && !String(values[f.name] ?? "").trim()).map((f) => f.label) : []), [ticket, t, values]);
  const ready = !!title.trim() && !busy && (ticket !== "new" || !missing.length) && (ticket !== "link" || pick.length > 0);

  const fill = async () => {
    setAi((a) => ({ ...a, busy: true, msg: null, err: null }));
    try {
      const j = await send("/api/reporting/kpi-actions/ai", "POST", { tile: tile.key, describe: ai.text, ctx: { title: tile.title, summary: tile.summary }, values });
      const f = j.fill as AiFill;
      if (f.title) setTitle(f.title);
      if (f.note) setNote(f.note);
      if (f.due) setDue(f.due);
      if (f.owner) setOwner(f.owner);
      if (f.shared.length) setShared((s) => [...new Set([...s, ...f.shared])]);
      if (f.ticket && tickets) setTicket("new");
      if (Object.keys(f.values).length) setValues((v) => ({ ...v, ...f.values }));
      const n = [f.title, f.note, f.due, f.owner].filter(Boolean).length + f.shared.length + (f.ticket && tickets ? Object.keys(f.values).length : 0);
      setAi((a) => ({ ...a, busy: false, msg: `${n} field${n === 1 ? "" : "s"} filled in${f.ticket && tickets ? ", with a new ticket" : ""} - check each one before adding. Nothing is saved yet.` }));
    } catch (e) { setAi((a) => ({ ...a, busy: false, err: (e as Error).message })); }
  };

  const add = async () => {
    if (!ready) return;
    setBusy(true); setErr(null); setSent(null);
    try {
      const j = await send("/api/reporting/kpi-actions/tasks", "POST", {
        tile: tile.key, page: tile.page, title, note, due: due || undefined, owner, ownerName: owners.find((o) => o.value === owner)?.label ?? "", shared,
        href: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined, kpi: tile.title, summary: tile.summary,
        ...(!plan && planItem ? { planItem } : {}),
      });
      const taskId = (j.task as KpiTask).id;
      if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId, values: withNote(values, note) });
      if (ticket === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId, ids: pick });
      const mailed = Number(j.mailed ?? 0);
      setSent(`“${title.trim()}” added${ticket === "new" ? ", with its ticket in HubSpot" : ticket === "link" ? ", with its linked tickets" : ""}${mailed ? ` · ${mailed} mail${mailed === 1 ? "" : "s"} sent` : ""}`);
      setTitle(""); setNote(""); setDue(""); setShared([]); setTicket("none"); setPick([]); setValues(t?.prefill ?? {}); setPlanItem(null);
      await done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ ...section, flex: 1 }}>{plan ? "New sub-action" : "New task"}</Typography>
        <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} onClick={() => setAi((a) => ({ ...a, open: !a.open }))}
          sx={{ ...cta, fontSize: "0.86rem", color: AI_INK, bgcolor: ai.open ? AI_SOFT : "transparent", "&:hover": { bgcolor: AI_SOFT } }}>
          Create with AI
        </Button>
      </Box>
      {ai.open && (
        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", border: `1px solid ${AI_LINE}`, bgcolor: AI_SOFT }}>
          <TextField multiline minRows={3} maxRows={10} autoFocus value={ai.text} onChange={(e) => setAi((a) => ({ ...a, text: e.target.value }))}
            label="Describe it to the AI" placeholder={`What should be done, by whom, by when${tickets ? ", for which channel and country - and whether it needs a Scroll to Sale ticket" : ""}`}
            sx={field} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ai.text.trim().length >= 5 && !ai.busy) void fill(); }} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography sx={{ flex: 1, fontSize: "0.8rem", color: ai.err ? RED : ai.msg ? GREEN : FAINT, fontWeight: ai.msg ? 600 : 400 }}>
              {ai.err ?? ai.msg ?? "The AI fills in the form below from your words - only choices the form offers, nothing made up. You check it, then add it."}
            </Typography>
            <Button variant="contained" disableElevation disabled={ai.busy || ai.text.trim().length < 5} onClick={() => void fill()}
              startIcon={ai.busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
              sx={{ ...cta, bgcolor: AI_INK, "&:hover": { bgcolor: "#5a3ab0" } }}>
              {ai.busy ? "Filling in…" : "Fill in the form"}
            </Button>
          </Box>
        </Box>
      )}
      <TextField label="What will be done" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} autoFocus fullWidth
        helperText={tickets ? "Written as an action - it is also the ticket's name" : "Written as an action"} />
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "1fr 170px" }}>
        <TextField select size="small" label="Who does it" value={owners.some((o) => o.value === owner) ? owner : ""} onChange={(e) => setOwner(e.target.value)} sx={field}>
          {owners.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.9rem" }}>{o.label}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="By" value={due} onChange={(e) => setDue(e.target.value)} sx={field} InputLabelProps={{ shrink: true }} />
      </Box>
      <People owners={owners} value={shared} onChange={setShared} />
      <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={field} multiline minRows={2} maxRows={5} />
      {!plan && <PlanPick value={planItem} onChange={setPlanItem} />}

      {/* its Scroll to Sale ticket, inside the task - on the plan only for an action Digital Growth leads */}
      {tickets && <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20, color: FAINT }} />
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mr: 0.5 }}>Scroll to Sale ticket</Typography>
          {([["none", "None"], ["new", "New ticket"], ["link", "Link existing"]] as const).map(([id, label]) => (
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
        {ticket === "link" && <FindTickets pick={pick} setPick={setPick} already={(t?.linked ?? []).map((x) => x.id)} />}
      </Box>}

      {err && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err}</Typography>}
      {sent && <Typography sx={{ fontSize: "0.88rem", color: GREEN, fontWeight: 600 }}>{sent}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.82rem", color: missing.length ? RED : FAINT, flex: 1 }}>
          {missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : shared.length ? `${shared.length} colleague${shared.length === 1 ? "" : "s"} will get a mail` : ""}
        </Typography>
        <Button variant="contained" size="large" disableElevation disabled={!ready} onClick={() => void add()} sx={cta}>
          {busy ? "Saving…" : ticket === "new" ? `Add the ${plan ? "sub-action" : "task"} and its ticket` : ticket === "link" ? `Add the ${plan ? "sub-action" : "task"} and link` : plan ? "Add the sub-action" : "Add the task"}
        </Button>
      </Box>
    </Box>
  );
}

/** Every field of the pipeline but the name (the action is the name), prefilled - check and change what is wrong. Its
 *  choices are square tags (SARCLA 01.11.2026: "all only square tags"). */
export function TicketFields({ form, values, set }: { form: Form; values: Record<string, string>; set: (k: string, v: string) => void }) {
  const optionsOf = (f: S2sField): Opt[] => f.kind === "stage" ? form.stages : f.kind === "owner" ? form.owners : f.kind === "team" ? form.teams : f.options ?? [];
  return (
    // the plan's rhythm: the same room between fields, a heading over its tags as on the left (SARCLA 03.11.2026)
    <Box sx={{ display: "grid", rowGap: 1.75, columnGap: 1.25, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, pt: 0.5 }}>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, gridColumn: "1 / -1" }}>Filled in from the task and the KPI - check and change what is wrong.</Typography>
      {form.fields.filter((f) => f.name !== "subject").map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        if (f.kind === "multi") {
          const chosen = (values[f.name] ?? "").split(";").filter(Boolean);
          return (
            <Box key={f.name} sx={{ gridColumn: "1 / -1", display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>{label}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {optionsOf(f).map((o) => {
                  const on = chosen.includes(o.value);
                  return (
                    <Box key={o.value} component="button" type="button" onClick={() => set(f.name, (on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value]).join(";"))}
                      // the plan's tags, one size (SubActions.square)
                      sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED, font: "inherit", fontSize: "0.78rem", fontWeight: on ? 800 : 600, px: 1, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" }}>
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
            <TextField key={f.name} select size="small" label={label} value={opts.some((o) => o.value === values[f.name]) ? values[f.name] : ""} onChange={(e) => set(f.name, e.target.value)} sx={field}
              slotProps={{ inputLabel: { shrink: true } }}>
              {!f.required && <MenuItem value="" sx={{ fontSize: "0.9rem", color: FAINT }}>-</MenuItem>}
              {opts.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.9rem" }}>{o.label}</MenuItem>)}
            </TextField>
          );
        }
        return (
          <TextField key={f.name} size="small" label={label} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}
            sx={{ ...field, ...(f.kind === "textarea" ? { gridColumn: "1 / -1" } : {}) }}
            type={f.kind === "date" ? "date" : "text"} multiline={f.kind === "textarea"} minRows={f.kind === "textarea" ? 2 : undefined}
            slotProps={{ inputLabel: { shrink: true } }} />
        );
      })}
    </Box>
  );
}

const TICKET_STATES = [["open", "Open"], ["closed", "Closed"], ["all", "All"]] as const;
type TicketState = (typeof TICKET_STATES)[number][0];

/** The pipeline's tickets, to pick one or more: the open ones (SARCLA 18.10: "only show open tickets"), or the closed
 *  ones too - Live, Maintaining Internally, Killed - to trace back (01.11.2026). */
export function FindTickets({ pick, setPick, already }: { pick: string[]; setPick: (f: (p: string[]) => string[]) => void; already: string[] }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<TicketState>("open");
  const [rows, setRows] = useState<Linked[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setRows(null);
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/reporting/kpi-actions/tickets?search=${encodeURIComponent(q)}&state=${state}`);
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.message ?? j.error ?? `the hub answered ${r.status}`);
        setRows(j.tickets); setErr(null);
      } catch (e) { setErr((e as Error).message); }
    }, q ? 350 : 0);
    return () => clearTimeout(h);
  }, [q, state]);
  const which = state === "all" ? "" : `${state} `;
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField size="small" label={`Search the ${which}tickets - name or roadmap ID`} value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={state} onChange={(_, v: TicketState | null) => v && setState(v)} aria-label="Which tickets"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: "0.8rem", px: 1.25, py: 0.5 } }}>
          {TICKET_STATES.map(([v, label]) => <ToggleButton key={v} value={v}>{label}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      {!rows ? <CircularProgress size={16} /> : !rows.length ? <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>No {which}ticket found.</Typography> : (
        <Box sx={{ display: "grid", gap: 0.25, maxHeight: 320, overflowY: "auto" }}>
          {rows.map((k) => {
            const has = already.includes(k.id);
            return (
              <Box key={k.id} component="label" sx={{ display: "flex", gap: 0.5, alignItems: "center", px: 0.5, py: 0.25, borderRadius: "10px", cursor: has ? "default" : "pointer", "&:hover": { bgcolor: has ? "transparent" : "rgba(21,34,58,.04)" } }}>
                <Checkbox disabled={has} checked={has || pick.includes(k.id)} onChange={(e) => setPick((p) => e.target.checked ? [...p, k.id] : p.filter((x) => x !== k.id))} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>{k.subject || `Ticket ${k.id}`}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{[k.roadmapId, k.stageLabel, k.ownerName, has ? "already linked here" : ""].filter(Boolean).join(" · ")}</Typography>
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

function TaskRow({ tile, k, t, tickets, canWrite, reload, setErr, plan, allowTickets }: {
  tile: TileInfo; k: KpiTask; t: TicketsAnswer | null; tickets: Linked[]; canWrite: boolean; reload: () => Promise<void>; setErr: (e: string | null) => void;
  /** shown on an action of the plan; allowTickets = Digital Growth leads it */
  plan: boolean; allowTickets: boolean;
}) {
  // on a KPI tile, the plan's link and button only for whoever has the plan (admins)
  const hasPlan = usePlanAccess() === true;
  const [adding, setAdding] = useState<null | "new" | "link" | "share" | "plan">(null);
  const [planPick, setPlanPick] = useState<number | null>(k.planItem);
  // a KPI tile's task: it can be linked to an action of the plan, or unlinked (one made on the plan stays with its action)
  const fromKpi = !k.tile.startsWith("plan:");
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
  const open = (mode: "new" | "link" | "share" | "plan") => {
    setAdding(adding === mode ? null : mode);
    if (mode === "share") setShared(k.shared.map((p) => p.id));
    if (mode === "plan") setPlanPick(k.planItem);
    if (t) setValues({ ...t.prefill, subject: k.title.slice(0, 200), ...(k.owner && /^\d+$/.test(k.owner) ? { hubspot_owner_id: k.owner } : {}), ...(k.due ? { mkt_planned_date: k.due } : {}) });
  };
  const missing = adding === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const save = async () => {
    setBusy(true);
    try {
      if (adding === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: tile.key, taskId: k.id, values: withNote(values, k.note) });
      if (adding === "link") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: tile.key, taskId: k.id, ids: pick });
      if (adding === "share") await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, shared, kpi: tile.title, summary: tile.summary });
      if (adding === "plan") await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: k.id, planItem: planPick });
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
      {/* where it came from, or where it also counts */}
      {plan && fromKpi && k.href && (
        <Typography component="a" href={k.href} sx={{ fontSize: "0.82rem", color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", display: "flex", gap: 0.5, alignItems: "center", "&:hover": { textDecoration: "underline" } }}>
          <FlagOutlinedIcon sx={{ fontSize: 17 }} /> Made on a KPI tile - open it
        </Typography>
      )}
      {!plan && hasPlan && k.planItem != null && (
        <Typography component="a" href={`/action-plan?item=${k.planItem}`} sx={{ fontSize: "0.82rem", color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", display: "flex", gap: 0.5, alignItems: "center", "&:hover": { textDecoration: "underline" } }}>
          <FlagOutlinedIcon sx={{ fontSize: 17 }} /> A sub-action of the action plan - open it
        </Typography>
      )}

      {/* the task's Scroll to Sale tickets */}
      {tickets.map((x) => <TicketLine key={x.id} tile={tile} x={x} canWrite={canWrite} reload={reload} />)}
      {canWrite && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {allowTickets && <Button size="small" startIcon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => open("new")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "new" ? TINT.blue.fg : MUTED }}>New ticket</Button>}
          {allowTickets && <Button size="small" onClick={() => open("link")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "link" ? TINT.blue.fg : MUTED }}>Link existing</Button>}
          <Button size="small" startIcon={<PeopleOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => open("share")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "share" ? TINT.blue.fg : MUTED }}>Share</Button>
          {!plan && hasPlan && fromKpi && <Button size="small" startIcon={<FlagOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => open("plan")} sx={{ ...cta, fontSize: "0.84rem", color: adding === "plan" ? TINT.blue.fg : MUTED }}>Action plan</Button>}
        </Box>
      )}
      {adding === "new" && t && <TicketFields form={t.form} values={values} set={(key, v) => setValues((o) => ({ ...o, [key]: v }))} />}
      {adding === "link" && <FindTickets pick={pick} setPick={setPick} already={tickets.map((x) => x.id)} />}
      {adding === "share" && <People owners={owners} value={shared} onChange={setShared} label="Shared with - the new ones get a mail" />}
      {adding === "plan" && <PlanPick value={planPick} onChange={setPlanPick} />}
      {adding && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.82rem", color: missing.length ? RED : FAINT, flex: 1 }}>{missing.length ? `Still to fill in: ${missing.join(", ")}` : ""}</Typography>
          <Button variant="contained" disableElevation disabled={busy || missing.length > 0 || (adding === "link" && !pick.length)} onClick={() => void save()} sx={cta}>
            {busy ? "Saving…" : adding === "new" ? "Create the ticket" : adding === "share" || adding === "plan" ? "Save" : pick.length > 1 ? `Link these ${pick.length}` : "Link it"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export function TicketLine({ tile, x, canWrite, reload }: { tile: TileInfo; x: Linked; canWrite: boolean; reload: () => Promise<void> }) {
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
