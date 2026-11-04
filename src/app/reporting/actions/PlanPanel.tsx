"use client";
// THE ACTION PLAN BESIDE A KPI (SARCLA 04.11.2026: "on the left side create an action, like a collapsible, and we bring
// the same table view that is on the action plan, and allow to create from the KPI directly"; "to pick the main and the
// sub, a dropdown will not work"). The plan's own table (Gantt, its calendar off) - the same rows, colours, tags and
// columns, the viewer's own hidden rows hidden here too. The + beside a row opens the plan's own form (AddDialog.AddForm)
// in this panel: under an action a sub-action, under a category an action. What is made tracks the KPI when the KPI is
// on the plan's KPIs tab (round 40's rule - only those can be tracked); the KPI tracking column does the same for a
// row already there. A row's name opens it on the Action plan.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { LIVE, S2S_CHOICES, actionMatches, rollup, subMatches, type PlanFields, type PlanFilter, type PlanItem, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { Gantt, type GRow } from "@/app/action-plan/Gantt";
import { AddForm, type TrackKpi } from "@/app/action-plan/AddDialog";
import type { TrackChoice, TrackTarget } from "@/app/action-plan/KpiPicker";
import { PROJECT_COLORS, readPref, send, stageColor, todayIso, writePref, type PlanData } from "@/app/action-plan/planUi";

const chip = (on: boolean, color: string = TINT.blue.fg, soft: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? color : HAIRLINE}`, bgcolor: on ? soft : "#fff", color: on ? color : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});

/** The rows that track this KPI: actions and sub-actions, by the KPI's key. */
export function trackingOf(data: PlanData | null, key: string): { items: PlanItem[]; subs: PlanSub[] } {
  if (!data) return { items: [], subs: [] };
  return { items: data.items.filter((i) => i.tracked && i.trackKpi === key), subs: data.subs.filter((s) => s.tracked && s.trackKpi === key) };
}

export function PlanPanel({ data, kpi, onTracked, reload, open, setOpen, adding, setAdding }: {
  data: PlanData; kpi: TrackKpi;
  /** the KPI is on the plan's KPIs tab: what is made here tracks it */
  onTracked: boolean;
  reload: () => Promise<void>;
  open: boolean; setOpen: (o: boolean) => void;
  /** the row whose + was clicked: its form fills the panel */
  adding: PlanItem | null; setAdding: (i: PlanItem | null) => void;
}) {
  const today = useMemo(() => todayIso(), []);
  const [q, setQ] = useState("");
  const [dg, setDg] = useState(false);
  const [mine, setMine] = useState(false);
  const [hideLive, setHideLive] = useState(false);
  const [compact, setCompact] = useState(() => readPref<boolean>("kpiPage.compact", false));
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  // the viewer's hidden rows, the plan's own (actionPlan.hidden.v1)
  const [hidden, setHidden] = useState<Set<number>>(() => new Set(readPref<number[]>("hidden.v1", [])));
  const [rowDg, setRowDg] = useState(false);
  const { items, subs } = data;
  // closed at first but where this KPI is tracked - those rows are open to see
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const keep = new Set<number>();
    const up = (id: number | null) => { for (let p = id; p != null; p = byId.get(p)?.parentId ?? null) keep.add(p); };
    for (const i of items) if (i.tracked && i.trackKpi === kpi.key) up(i.parentId);
    for (const s of subs) if (s.tracked && s.trackKpi === kpi.key) up(s.item);
    return new Set(items.filter((i) => i.kind !== "goal" && !keep.has(i.id) && (i.kind !== "action" || subs.some((s) => s.item === i.id))).map((i) => `i${i.id}`));
  });
  const flip = (key: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const f: PlanFilter = useMemo(() => ({ q, prios: [], stages: [], dg, late: false, soon: false, owner: "", hideLive }), [q, dg, hideLive]);
  const filtering = !!q.trim() || dg || hideLive || mine;
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
    const tracksSub = (s: PlanSub) => !!s.tracked && s.trackKpi === kpi.key;
    const subOk = (s: PlanSub, a: PlanItem) => subMatches(s, a, f, today) && (!mine || tracksSub(s));
    const actOk = (a: PlanItem) => actionMatches(a, subsOf.get(a.id) ?? [], f, today) && (!mine || (!!a.tracked && a.trackKpi === kpi.key));
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
  }, [items, subs, f, mine, filtering, collapsed, hidden, today, kpi.key]);

  const patch = async (id: number, p: Partial<PlanFields>) => {
    try { await send("/api/action-plan", "PATCH", { id, ...p }); setNote(null); } catch (e) { setNote({ text: `Not saved: ${(e as Error).message}`, ok: false }); }
    await reload();
  };
  // the KPI tracking column: Yes tracks this KPI - one on the plan's KPIs tab - and No takes it off
  const track = async (t: TrackTarget, c: TrackChoice) => {
    if (c === "pick" && !onTracked) { setNote({ text: `“${kpi.title}” is not on the Action plan's KPIs tab yet - save its target and turn on “Action plan · KPIs” on the right, then it can be tracked.`, ok: false }); return; }
    const p = c === "no" ? { tracked: false, trackKpi: "", trackKpiTitle: "" } : { tracked: true, trackKpi: kpi.key, trackKpiTitle: kpi.title };
    try {
      if (t.kind === "item") await send("/api/action-plan", "PATCH", { id: t.id, ...p });
      else await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: t.id, ...p });
      setNote({ text: c === "no" ? `“${t.title}” no longer tracks a KPI` : `“${t.title}” tracks ${kpi.title} now`, ok: true });
    } catch (e) { setNote({ text: `Not saved: ${(e as Error).message}`, ok: false }); }
    await reload();
  };

  if (!open) {
    return (
      <Box sx={{ flex: "0 0 auto", width: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, py: 1.25, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", alignSelf: "flex-start", minHeight: 300 }}>
        <Tooltip title="Open the action plan" placement="right">
          <IconButton size="small" aria-label="Open the action plan" onClick={() => setOpen(true)} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px" }}><ChevronRightIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Box component="button" type="button" onClick={() => setOpen(true)}
          sx={{ writingMode: "vertical-rl", transform: "rotate(180deg)", border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: TINT.blue.fg }}>
          Action plan · create an action
        </Box>
      </Box>
    );
  }

  const parent = adding ? items.find((i) => i.id === adding.id) ?? adding : null;
  return (
    <Box sx={{ flex: "0 0 auto", width: "min(860px, 50%)", minWidth: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Tooltip title="Fold the action plan away">
          <IconButton size="small" aria-label="Fold the action plan away" onClick={() => setOpen(false)} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", mt: 0.25 }}><ChevronLeftIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Create an action from this KPI</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            The + beside an action adds a sub-action, beside a category an action. {onTracked ? `What you make tracks ${kpi.title}.` : `To have it track ${kpi.title}, put the KPI on the Action plan's KPIs on the right first.`}
          </Typography>
        </Box>
      </Box>
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
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{onTracked ? "Made from this KPI - tracked against it on the plan" : "This KPI is not on the Action plan's KPIs - share it on the right to track it"}</Typography>
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
            <Box component="button" type="button" aria-pressed={mine} onClick={() => setMine((v) => !v)} sx={chip(mine)}>Tracking this KPI</Box>
            <Box component="button" type="button" aria-pressed={hideLive} onClick={() => setHideLive((v) => !v)} sx={chip(hideLive, stageColor(LIVE).ink, stageColor(LIVE).soft)}>Hide live</Box>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => setCollapsed(new Set())} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Open all</Button>
            <Button size="small" onClick={() => setCollapsed(new Set(items.filter((i) => i.kind !== "goal").map((i) => `i${i.id}`)))} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Close all</Button>
          </Box>
          <Gantt calendar={false} rows={rows} rolled={rolled} today={today} zoom="month" canWrite={data.canWrite} collapsed={filtering ? new Set() : collapsed} toggle={flip}
            selected={null} onOpen={(i) => window.open(`/action-plan?item=${i.id}`, "_blank", "noopener")} onSubs={(i) => window.open(`/action-plan?item=${i.id}`, "_blank", "noopener")}
            onOpenSub={(id) => window.open(`/action-plan?sub=${id}`, "_blank", "noopener")} onPatch={patch} onTrack={(t, c) => void track(t, c)}
            canDrop={() => false} onDrop={async () => undefined} height="calc(100vh - 300px)" colorOf={(i) => colors.get(i.id) ?? null}
            compact={compact} onCompact={() => setCompact((v) => { writePref("kpiPage.compact", !v); return !v; })}
            onAdd={(i) => { setAdding(i); setRowDg(false); setNote(null); }}
            hidden={hidden} onHide={(i, h) => setHidden((x) => { const n = new Set(x); if (h) n.add(i.id); else n.delete(i.id); writePref("hidden.v1", [...n]); return n; })} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The Action plan&apos;s table, without its calendar. A name opens the row on the Action plan in a new tab; KPI tracking set to Yes on a row tracks this KPI.</Typography>
        </>
      )}
    </Box>
  );
}
