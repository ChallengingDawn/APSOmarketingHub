"use client";
// THE ACTION PLAN BESIDE A KPI (SARCLA 04.11.2026: "on the left side create an action, like a collapsible, and we bring
// the same table view that is on the action plan, and allow to create from the KPI directly"; "to pick the main and the
// sub, a dropdown will not work"). The plan's own table (Gantt, its calendar off) - the same rows, colours, tags and
// columns, the viewer's own hidden rows hidden here too. Two ways to use it:
//  - Create: the + beside a row opens the plan's own form (AddDialog.AddForm) in this panel - under an action a
//    sub-action, under a category an action;
//  - Link existing (05.11.2026: "you should also associate an existing action ... track the one or the multiple actions
//    for this KPI"): a tick on every action and sub-action, several at once, saved together; the ones behind the KPI's
//    Digital Growth tickets offered first (kpiLinks.carriersOf).
// What is made or linked tracks the KPI only when the KPI is on the plan's KPIs tab (round 40's rule - only those can be
// tracked). A row's name opens it on the Action plan.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { LIVE, S2S_CHOICES, actionMatches, rollup, subMatches, type PlanFields, type PlanFilter, type PlanItem, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { carriersOf, linkChanges, rowOf } from "@/lib/reporting/kpiLinks";
import { Gantt, type GRow } from "@/app/action-plan/Gantt";
import { AddForm, type TrackKpi } from "@/app/action-plan/AddDialog";
import type { TrackChoice, TrackTarget } from "@/app/action-plan/KpiPicker";
import { PROJECT_COLORS, readPref, send, stageColor, todayIso, writePref, type PlanData } from "@/app/action-plan/planUi";

const chip = (on: boolean, color: string = TINT.blue.fg, soft: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? color : HAIRLINE}`, bgcolor: on ? soft : "#fff", color: on ? color : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});

/** Create from the plan's rows, or link rows already there. */
export type PanelMode = "create" | "link";
/** One filter on top of the plan's: the rows tracking the KPI, those behind its tickets, those ticked. */
export type PanelOnly = null | "tracking" | "tickets" | "ticked";

/** The rows that track this KPI: actions and sub-actions, by the KPI's key. */
export function trackingOf(data: PlanData | null, key: string): { items: PlanItem[]; subs: PlanSub[] } {
  if (!data) return { items: [], subs: [] };
  return { items: data.items.filter((i) => i.tracked && i.trackKpi === key), subs: data.subs.filter((s) => s.tracked && s.trackKpi === key) };
}

/** The same, as the table's row keys. */
const trackingKeys = (data: PlanData, key: string): Set<string> => {
  const t = trackingOf(data, key);
  return new Set([...t.items.map((i) => `i${i.id}`), ...t.subs.map((s) => `s${s.id}`)]);
};

/** The rows behind the KPI's Digital Growth tickets - or made on it - that do not track it yet. */
export function untrackedCarriers(data: PlanData | null, key: string, tickets: string[]): number {
  if (!data) return 0;
  const tracking = trackingKeys(data, key);
  return [...carriersOf(data.items, data.subs, data.own, tickets, key)].filter((k) => !tracking.has(k)).length;
}

export function PlanPanel({ data, kpi, onTracked, reload, open, setOpen, adding, setAdding, mode, setMode, only, setOnly, kpiTickets }: {
  data: PlanData; kpi: TrackKpi;
  /** the KPI is on the plan's KPIs tab: what is made or linked here tracks it */
  onTracked: boolean;
  reload: () => Promise<void>;
  open: boolean; setOpen: (o: boolean) => void;
  /** the row whose + was clicked: its form fills the panel */
  adding: PlanItem | null; setAdding: (i: PlanItem | null) => void;
  mode: PanelMode; setMode: (m: PanelMode) => void;
  only: PanelOnly; setOnly: (o: PanelOnly) => void;
  /** the "From Scroll to Sale" tickets the KPI is linked to */
  kpiTickets: string[];
}) {
  const today = useMemo(() => todayIso(), []);
  const [q, setQ] = useState("");
  const [dg, setDg] = useState(false);
  const [hideLive, setHideLive] = useState(false);
  // the columns beside the names: shown to create, folded to link - the names are what one picks by (each kept as last set)
  const [createCompact, setCreateCompact] = useState(() => readPref<boolean>("kpiPage.compact", false));
  const [linkCompact, setLinkCompact] = useState(() => readPref<boolean>("kpiPage.linkCompact", true));
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  // the viewer's hidden rows, the plan's own (actionPlan.hidden.v1)
  const [hidden, setHidden] = useState<Set<number>>(() => new Set(readPref<number[]>("hidden.v1", [])));
  const [rowDg, setRowDg] = useState(false);
  const { items, subs } = data;

  // what tracks the KPI now, what is behind its tickets, and the ticks - as the rows were when Link was opened or saved
  const tracking = useMemo(() => trackingKeys(data, kpi.key), [data, kpi.key]);
  const carriers = useMemo(() => carriersOf(items, subs, data.own, kpiTickets, kpi.key), [items, subs, data.own, kpiTickets, kpi.key]);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(tracking));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (mode === "link") setTicked(new Set(tracking)); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const changes = useMemo(() => linkChanges(ticked, tracking), [ticked, tracking]);
  const tick = (key: string) => setTicked((t) => { const n = new Set(t); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const otherKpi = (key: string): string | null => {
    const r = rowOf(key);
    const row = r?.kind === "item" ? items.find((i) => i.id === r.id) : r ? subs.find((s) => s.id === r.id) : undefined;
    return row?.tracked && row.trackKpi && row.trackKpi !== kpi.key ? row.trackKpiTitle || "another KPI" : null;
  };
  const moving = changes.add.filter((k) => otherKpi(k));

  // closed at first but where this KPI is tracked or its tickets are - those rows are open to see
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const keep = new Set<number>();
    const up = (id: number | null) => { for (let p = id; p != null; p = byId.get(p)?.parentId ?? null) keep.add(p); };
    for (const i of items) if ((i.tracked && i.trackKpi === kpi.key) || carriers.has(`i${i.id}`)) up(i.parentId);
    for (const s of subs) if ((s.tracked && s.trackKpi === kpi.key) || carriers.has(`s${s.id}`)) up(s.item);
    return new Set(items.filter((i) => i.kind !== "goal" && !keep.has(i.id) && (i.kind !== "action" || subs.some((s) => s.item === i.id))).map((i) => `i${i.id}`));
  });
  const flip = (key: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const f: PlanFilter = useMemo(() => ({ q, prios: [], stages: [], dg, late: false, soon: false, owner: "", hideLive }), [q, dg, hideLive]);
  const filtering = !!q.trim() || dg || hideLive || !!only;
  const rolled = useMemo(() => rollup(items, subs, today), [items, subs, today]);
  const colors = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const topics = items.filter((i) => i.kind === "topic").sort((a, b) => a.sort - b.sort || a.id - b.id);
    const own = new Map(topics.map((t, k) => [t.id, PROJECT_COLORS[k % PROJECT_COLORS.length] as string]));
    const out = new Map<number, string>();
    for (const i of items) {
      for (let p: PlanItem | undefined = i, n = 0; p && n < 12; p = p.parentId != null ? byId.get(p.parentId) : undefined, n++) {
        const c = own.get(p.id);
        if (c) { out.set(i.id, c); break; }
      }
    }
    return out;
  }, [items]);

  // the plan's rows, as the plan walks them: a row shows when it passes or something under it does
  const rows = useMemo(() => {
    const kids = new Map<number | null, PlanItem[]>();
    const ids = new Set(items.map((i) => i.id));
    for (const i of items) { const p = i.parentId != null && ids.has(i.parentId) ? i.parentId : null; (kids.get(p) ?? kids.set(p, []).get(p)!).push(i); }
    for (const l of kids.values()) l.sort((a, b) => a.sort - b.sort || a.id - b.id);
    const subsOf = new Map<number, PlanSub[]>();
    for (const s of subs) (subsOf.get(s.item) ?? subsOf.set(s.item, []).get(s.item)!).push(s);
    const keep = (key: string) => !only || (only === "tracking" ? tracking.has(key) : only === "tickets" ? carriers.has(key) : ticked.has(key));
    const subOk = (s: PlanSub, a: PlanItem) => subMatches(s, a, f, today) && keep(`s${s.id}`);
    const actOk = (a: PlanItem) => actionMatches(a, subsOf.get(a.id) ?? [], f, today) && keep(`i${a.id}`);
    const shown = new Map<number, boolean>();
    const visible = (i: PlanItem): boolean => {
      if (shown.has(i.id)) return shown.get(i.id)!;
      shown.set(i.id, false);
      const v = hidden.has(i.id) ? false : !filtering ? true
        : i.kind === "action" ? actOk(i) || (subsOf.get(i.id) ?? []).some((s) => subOk(s, i)) : (kids.get(i.id) ?? []).some(visible);
      shown.set(i.id, v);
      return v;
    };
    const out: GRow[] = [];
    const walk = (i: PlanItem, depth: number, closed: boolean) => {
      const under = (kids.get(i.id) ?? []).filter(visible);
      const mineSubs = i.kind === "action" ? (subsOf.get(i.id) ?? []).filter((x) => !filtering || subOk(x, i) || actOk(i)) : [];
      const key = `i${i.id}`;
      if (!closed) out.push({ key, type: "item", item: i, depth, hasKids: under.length > 0 || mineSubs.length > 0 });
      const shut = closed || (!filtering && collapsed.has(key));
      if (!shut) for (const s of mineSubs) out.push({ key: `s${s.id}`, type: "sub", sub: s, parent: i, depth: depth + 1 });
      for (const c of under) walk(c, depth + 1, shut);
    };
    for (const root of (kids.get(null) ?? []).filter(visible)) walk(root, 0, false);
    return out;
  }, [items, subs, f, only, filtering, collapsed, hidden, today, tracking, carriers, ticked]);

  const patch = async (id: number, p: Partial<PlanFields>) => {
    try { await send("/api/action-plan", "PATCH", { id, ...p }); setNote(null); } catch (e) { setNote({ text: `Not saved: ${(e as Error).message}`, ok: false }); }
    await reload();
  };
  const notOnPlan = `“${kpi.title}” is not on the Action plan's KPIs tab yet - save its target and turn on “Action plan · KPIs”, then it can be tracked.`;
  // the KPI tracking column: Yes tracks this KPI - one on the plan's KPIs tab - and No takes it off
  const track = async (t: TrackTarget, c: TrackChoice) => {
    if (c === "pick" && !onTracked) { setNote({ text: notOnPlan, ok: false }); return; }
    const p = c === "no" ? { tracked: false, trackKpi: "", trackKpiTitle: "" } : { tracked: true, trackKpi: kpi.key, trackKpiTitle: kpi.title };
    try {
      if (t.kind === "item") await send("/api/action-plan", "PATCH", { id: t.id, ...p });
      else await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: t.id, ...p });
      setNote({ text: c === "no" ? `“${t.title}” no longer tracks a KPI` : `“${t.title}” tracks ${kpi.title} now`, ok: true });
    } catch (e) { setNote({ text: `Not saved: ${(e as Error).message}`, ok: false }); }
    await reload();
  };

  // the ticks saved: the newly ticked track the KPI, the unticked stop - one after the other, what failed said
  const saveLinks = async () => {
    if (!onTracked && changes.add.length) { setNote({ text: notOnPlan, ok: false }); return; }
    setSaving(true); setNote(null);
    const failed: string[] = [];
    for (const [keys, on] of [[changes.add, true], [changes.drop, false]] as const) {
      for (const k of keys) {
        const r = rowOf(k);
        if (!r) continue;
        const p = on ? { tracked: true, trackKpi: kpi.key, trackKpiTitle: kpi.title } : { tracked: false, trackKpi: "", trackKpiTitle: "" };
        try { await send(r.kind === "item" ? "/api/action-plan" : "/api/reporting/kpi-actions/tasks", "PATCH", { id: r.id, ...p }); }
        catch (e) { failed.push((e as Error).message); }
      }
    }
    await reload();
    setSaving(false);
    const n = changes.add.length, m = changes.drop.length;
    setNote(failed.length
      ? { text: `${failed.length} not saved: ${failed[0]}`, ok: false }
      : { text: [n ? `${n} now track${n === 1 ? "s" : ""} ${kpi.title}` : "", m ? `${m} no longer track${m === 1 ? "s" : ""} it` : ""].filter(Boolean).join(" · "), ok: true });
  };
  // after a save the rows are read again: the ticks start from what tracks it now
  useEffect(() => { if (!saving) setTicked(new Set(tracking)); }, [tracking]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) {
    return (
      <Box sx={{ flex: "0 0 auto", width: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, py: 1.25, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", alignSelf: "flex-start", minHeight: 300 }}>
        <Tooltip title="Open the action plan" placement="right">
          <IconButton size="small" aria-label="Open the action plan" onClick={() => setOpen(true)} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px" }}><ChevronRightIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Box component="button" type="button" onClick={() => setOpen(true)}
          sx={{ writingMode: "vertical-rl", transform: "rotate(180deg)", border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: TINT.blue.fg }}>
          Action plan · create or link
        </Box>
      </Box>
    );
  }

  const parent = adding ? items.find((i) => i.id === adding.id) ?? adding : null;
  const link = mode === "link";
  return (
    <Box sx={{ flex: "0 0 auto", width: "min(860px, 50%)", minWidth: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {/* create from the plan's rows, or link those already there */}
        <Box role="group" aria-label="What to do from this KPI" sx={{ display: "flex", gap: 0.5 }}>
          <Box component="button" type="button" aria-pressed={!link} onClick={() => { setMode("create"); if (only === "ticked" || only === "tickets") setOnly(null); }} sx={{ ...chip(!link), fontSize: "0.86rem", px: 1.5, py: 0.6 }}>Create an action</Box>
          <Box component="button" type="button" aria-pressed={link} onClick={() => { setAdding(null); setMode("link"); }} sx={{ ...chip(link), fontSize: "0.86rem", px: 1.5, py: 0.6 }}>Link existing actions</Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        {/* folds the panel away - not a way back (the header has those) */}
        <Button size="small" onClick={() => setOpen(false)} startIcon={<KeyboardDoubleArrowLeftIcon sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Fold the plan</Button>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.5 }}>
        {link
          ? `Tick the actions and sub-actions that work on ${kpi.title} - one or several - then save. ${carriers.size ? `The ${carriers.size} behind its Digital Growth tickets are under “Its Digital Growth tickets”.` : ""}`
          : `The + beside an action adds a sub-action, beside a category an action.`}
        {" "}{onTracked ? (link ? "" : `What you make tracks ${kpi.title}.`) : `To have them track ${kpi.title}, put the KPI on the Action plan's KPIs first (its target, then the switch).`}
      </Typography>
      {note && <Typography sx={{ fontSize: "0.84rem", color: note.ok ? GREEN : RED, fontWeight: note.ok ? 600 : 400 }}>{note.text}</Typography>}

      {parent ? (
        // the plan's own form, in the panel
        <Box sx={{ display: "grid", gap: 1.5, p: 2, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "#f7f9fc" }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />} onClick={() => setAdding(null)} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Back to the plan</Button>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {parent.kind === "action" ? "New sub-action of" : parent.kind === "goal" ? "New main category under" : `New in this ${parent.kind === "topic" ? "main category" : "sub-category"}`}
              </Typography>
              <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 750, color: INK }}>{parent.title}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: 1.1, borderRadius: "8px", border: `1px solid ${onTracked ? TINT.blue.fg : HAIRLINE}`, bgcolor: onTracked ? TINT.blue.bg : "#fff" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: onTracked ? TINT.blue.fg : MUTED, flex: 1 }}>
              {onTracked ? `KPI tracking: ${kpi.title}` : "KPI tracking: No"}
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{onTracked ? "Made from this KPI - tracked against it on the plan" : "This KPI is not on the Action plan's KPIs - share it to track it"}</Typography>
          </Box>
          <AddForm key={parent.id} parent={parent} people={data.people} choices={data.choices ?? S2S_CHOICES} rowDg={rowDg} setRowDg={setRowDg}
            track={onTracked ? kpi : null} onPatch={patch}
            onDone={(said) => {
              setAdding(null); setRowDg(false); setNote({ text: said, ok: true });
              setCollapsed((c) => { const n = new Set(c); n.delete(`i${parent.id}`); return n; });
              void reload();
            }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
            <TextField size="small" placeholder="Search actions and sub-actions" value={q} onChange={(e) => setQ(e.target.value)}
              sx={{ width: 230, "& .MuiInputBase-root": { borderRadius: "10px", bgcolor: "#fff", fontSize: "0.86rem" } }} />
            <Box component="button" type="button" aria-pressed={dg} onClick={() => setDg((v) => !v)} sx={chip(dg)}>Digital Growth</Box>
            {link && (
              <Tooltip title={carriers.size ? "The actions and sub-actions holding a Scroll to Sale ticket this KPI is linked to, or made on this KPI" : "No ticket of this KPI is on the plan's rows"}>
                <Box component="button" type="button" aria-pressed={only === "tickets"} onClick={() => setOnly(only === "tickets" ? null : "tickets")} sx={chip(only === "tickets", TINT.amber.fg, TINT.amber.bg)}>
                  Its Digital Growth tickets · {carriers.size}
                </Box>
              </Tooltip>
            )}
            <Box component="button" type="button" aria-pressed={only === (link ? "ticked" : "tracking")} onClick={() => { const o = link ? "ticked" : "tracking"; setOnly(only === o ? null : o); }} sx={chip(only === (link ? "ticked" : "tracking"))}>
              {link ? `Ticked · ${ticked.size}` : "Tracking this KPI"}
            </Box>
            <Box component="button" type="button" aria-pressed={hideLive} onClick={() => setHideLive((v) => !v)} sx={chip(hideLive, stageColor(LIVE).ink, stageColor(LIVE).soft)}>Hide live</Box>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => setCollapsed(new Set())} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Open all</Button>
            <Button size="small" onClick={() => setCollapsed(new Set(items.filter((i) => i.kind !== "goal").map((i) => `i${i.id}`)))} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Close all</Button>
          </Box>

          {link && (
            // what saving does, and the button - above the table so it is seen
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", p: 1.1, borderRadius: "10px", border: `1px solid ${changes.add.length + changes.drop.length ? TINT.blue.fg : HAIRLINE}`, bgcolor: changes.add.length + changes.drop.length ? TINT.blue.bg : "#fff" }}>
              <Typography sx={{ flex: 1, minWidth: 200, fontSize: "0.84rem", color: INK }}>
                {changes.add.length + changes.drop.length === 0
                  ? `${ticked.size} ticked - the rows tracking ${kpi.title} now. Tick or untick, then save.`
                  : [changes.add.length ? `${changes.add.length} to track ${kpi.title}` : "", changes.drop.length ? `${changes.drop.length} to take off` : "", moving.length ? `${moving.length} of them track${moving.length === 1 ? "s" : ""} another KPI now and move${moving.length === 1 ? "s" : ""} to this one` : ""].filter(Boolean).join(" · ")}
              </Typography>
              {carriers.size > 0 && [...carriers].some((k) => !ticked.has(k)) && (
                <Button size="small" onClick={() => setTicked((t) => new Set([...t, ...carriers]))} sx={{ textTransform: "none", fontWeight: 650 }}>Tick its ticket&apos;s actions ({carriers.size})</Button>
              )}
              {changes.add.length + changes.drop.length > 0 && <Button size="small" disabled={saving} onClick={() => setTicked(new Set(tracking))} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Undo</Button>}
              <Button size="small" variant="contained" disableElevation disabled={saving || !data.canWrite || changes.add.length + changes.drop.length === 0 || (!onTracked && changes.add.length > 0)}
                onClick={() => void saveLinks()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}>
                {saving ? "Saving…" : `Save - track ${kpi.title}`}
              </Button>
            </Box>
          )}

          <Gantt calendar={false} rows={rows} rolled={rolled} today={today} zoom="month" canWrite={data.canWrite} collapsed={filtering ? new Set() : collapsed} toggle={flip}
            selected={null}
            onOpen={(i) => { if (link) { if (i.kind === "action") tick(`i${i.id}`); else flip(`i${i.id}`); } else window.open(`/action-plan?item=${i.id}`, "_blank", "noopener"); }}
            onSubs={(i) => window.open(`/action-plan?item=${i.id}`, "_blank", "noopener")}
            onOpenSub={(id) => { if (link) tick(`s${id}`); else window.open(`/action-plan?sub=${id}`, "_blank", "noopener"); }}
            onPatch={patch} onTrack={(t, c) => void track(t, c)}
            canDrop={() => false} onDrop={async () => undefined} height="calc(100vh - 340px)" colorOf={(i) => colors.get(i.id) ?? null}
            compact={link ? linkCompact : createCompact}
            onCompact={() => (link ? setLinkCompact : setCreateCompact)((v) => { writePref(link ? "kpiPage.linkCompact" : "kpiPage.compact", !v); return !v; })}
            onAdd={(i) => { setMode("create"); setAdding(i); setRowDg(false); setNote(null); }}
            hidden={hidden} onHide={(i, h) => setHidden((x) => { const n = new Set(x); if (h) n.add(i.id); else n.delete(i.id); writePref("hidden.v1", [...n]); return n; })}
            pick={link && data.canWrite ? {
              can: (r) => r.type === "sub" || r.item.kind === "action",
              on: (r) => ticked.has(r.key),
              toggle: (r) => tick(r.key),
              note: (r) => { const o = otherKpi(r.key); return [carriers.has(r.key) ? "Holds one of this KPI's Digital Growth tickets" : "", o ? `Tracks “${o}” now - ticked and saved, it tracks ${kpi.title} instead` : ""].filter(Boolean).join(" · ") || undefined; },
            } : undefined} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            {link
              ? "A click on a row ticks it. A row tracks one KPI: ticking one that tracks another moves it here."
              : "The Action plan's table, without its calendar. A name opens the row on the Action plan in a new tab; KPI tracking set to Yes on a row tracks this KPI."}
          </Typography>
        </>
      )}
    </Box>
  );
}
