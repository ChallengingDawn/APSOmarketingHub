"use client";
// THE ACTION PLAN (SARCLA 31.10.2026): "APSOparts Business Improvement Action Plan" as a Gantt, the way
// Planner draws one - by topic, opened and closed level by level, a row dragged to another topic or group
// (or, grouped by main topic, to another main topic). Sub-actions are added on an action, or on any KPI
// tile's Actions and linked to it; only actions Digital Growth leads take a "From Scroll to Sale" ticket.
// At the top, where APSOparts stands on the climb to 30 M€ by 2031.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";

import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ActionsPanel } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { STATE_LABEL, isLate, reorder, rollup, type PlanFields, type PlanItem, type PlanKind, type PlanState, type Rolled } from "@/lib/reporting/actionPlanRules";
import { Gantt, type GRow, type Where, type Zoom } from "./Gantt";
import { ItemDrawer } from "./ItemDrawer";
import { SummitFigures, SummitMountain, useSummit } from "./Summit";
import { LATE, STATE_COLOR, readPref, send, todayIso, writePref, type PlanData } from "./planUi";

type Mode = "topic" | "main";
const NO_MAIN = "No main topic";
const chip = (on: boolean, color: string = TINT.blue.fg, soft: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? color : HAIRLINE}`, bgcolor: on ? soft : "#fff", color: on ? color : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.4, borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap" as const,
});

/** The people of "Responsible of action": "FEHDIA/SARCLA" is two of them, "Sales leaders" one. */
const peopleOf = (who: string) => who.split(/\s*(?:\/|,|;|&|\+|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);

function ActionPlan() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = useMemo(() => todayIso(), []);
  const { data: summit, error: summitErr } = useSummit();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reporting/action-plan");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setData({ canWrite: !!j.canWrite, items: j.items, subs: j.subs });
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // the viewer's own settings
  const [zoom, setZoom] = useState<Zoom>("week");
  const [mode, setMode] = useState<Mode>("topic");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setZoom(readPref<Zoom>("zoom", "week"));
    setMode(readPref<Mode>("mode", "topic"));
    setCollapsed(new Set(readPref<string[]>("collapsed", [])));
  }, []);
  const toggle = (key: string) => setCollapsed((c) => {
    const n = new Set(c);
    if (n.has(key)) n.delete(key); else n.add(key);
    writePref("collapsed", [...n]);
    return n;
  });

  // filters
  const [q, setQ] = useState("");
  const [prios, setPrios] = useState<string[]>([]);
  const [states, setStates] = useState<(PlanState | "none")[]>([]);
  const [dgOnly, setDgOnly] = useState(false);
  const [lateOnly, setLateOnly] = useState(false);
  const [owner, setOwner] = useState("");
  const filtering = !!q.trim() || prios.length > 0 || states.length > 0 || dgOnly || lateOnly || !!owner;

  const items = useMemo(() => data?.items ?? [], [data]);
  const subs = useMemo(() => data?.subs ?? [], [data]);
  const rolled = useMemo(() => rollup(items, subs, today), [items, subs, today]);
  const owners = useMemo(() => [...new Set(items.filter((i) => i.kind === "action").flatMap((i) => peopleOf(i.responsible)))].sort((a, b) => a.localeCompare(b)), [items]);

  const passes = useCallback((i: PlanItem) => {
    if (i.kind !== "action") return false;
    const w = q.trim().toLowerCase();
    if (w && ![i.title, i.detail, i.responsible, i.code, i.mainTopic, i.status].some((x) => x.toLowerCase().includes(w))) return false;
    if (prios.length && !prios.includes(i.priority)) return false;
    if (states.length && !states.includes(i.state ?? "none")) return false;
    if (dgOnly && !i.dg) return false;
    if (lateOnly && !isLate(i, today)) return false;
    if (owner && !peopleOf(i.responsible).includes(owner)) return false;
    return true;
  }, [q, prios, states, dgOnly, lateOnly, owner, today]);

  // the rows, top to bottom
  const rows = useMemo<GRow[]>(() => {
    const kids = new Map<number | null, PlanItem[]>();
    const ids = new Set(items.map((i) => i.id));
    for (const i of items) {
      const p = i.parentId != null && ids.has(i.parentId) ? i.parentId : null;
      (kids.get(p) ?? kids.set(p, []).get(p)!).push(i);
    }
    for (const list of kids.values()) list.sort((a, b) => a.sort - b.sort || a.id - b.id);
    const subsOf = new Map<number, typeof subs>();
    for (const s of subs) (subsOf.get(s.item) ?? subsOf.set(s.item, []).get(s.item)!).push(s);
    const out: GRow[] = [];

    if (mode === "main") {
      const buckets = new Map<string, PlanItem[]>();
      for (const i of items) if (i.kind === "action" && (!filtering || passes(i))) {
        const k = i.mainTopic.trim() || NO_MAIN;
        (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(i);
      }
      const names = [...buckets.keys()].sort((a, b) => (a === NO_MAIN ? 1 : b === NO_MAIN ? -1 : a.localeCompare(b)));
      for (const name of names) {
        const list = buckets.get(name)!;
        const rs = list.map((i) => rolled.get(i.id)).filter(Boolean) as Rolled[];
        const pcts = rs.map((r) => r.percent).filter((p): p is number => p != null);
        const froms = rs.map((r) => r.from).filter(Boolean) as string[], tos = rs.map((r) => r.to).filter(Boolean) as string[];
        const key = `b${name}`;
        out.push({ key, type: "bucket", label: name, value: name === NO_MAIN ? "" : name, depth: 0, hasKids: true, count: list.length,
          from: froms.length ? froms.sort()[0] : null, to: tos.length ? tos.sort()[tos.length - 1] : null,
          percent: pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : null });
        if (collapsed.has(key)) continue;
        for (const i of list) {
          const mine = subsOf.get(i.id) ?? [];
          out.push({ key: `i${i.id}`, type: "item", item: i, depth: 1, hasKids: mine.length > 0 });
          if (!collapsed.has(`i${i.id}`)) for (const s of mine) out.push({ key: `s${s.id}`, type: "sub", sub: s, parent: i, depth: 2 });
        }
      }
      return out;
    }

    // by topic: a row shows when it passes the filters or something under it does
    const shown = new Map<number, boolean>();
    const visible = (i: PlanItem): boolean => {
      if (shown.has(i.id)) return shown.get(i.id)!;
      shown.set(i.id, false);
      const v = !filtering ? true : i.kind === "action" ? passes(i) : (kids.get(i.id) ?? []).some(visible);
      shown.set(i.id, v);
      return v;
    };
    const walk = (i: PlanItem, depth: number) => {
      const under = (kids.get(i.id) ?? []).filter(visible);
      const mine = i.kind === "action" ? subsOf.get(i.id) ?? [] : [];
      const key = `i${i.id}`;
      out.push({ key, type: "item", item: i, depth, hasKids: under.length > 0 || mine.length > 0 });
      if (collapsed.has(key)) return;
      for (const s of mine) out.push({ key: `s${s.id}`, type: "sub", sub: s, parent: i, depth: depth + 1 });
      for (const c of under) walk(c, depth + 1);
    };
    for (const root of (kids.get(null) ?? []).filter(visible)) walk(root, 0);
    return out;
  }, [items, subs, rolled, mode, collapsed, filtering, passes]);

  const actions = items.filter((i) => i.kind === "action");
  const counts = {
    all: actions.length,
    done: actions.filter((i) => i.state === "done").length,
    doing: actions.filter((i) => i.state === "doing").length,
    late: actions.filter((i) => isLate(i, today)).length,
    undated: actions.filter((i) => !i.due && i.state !== "done").length,
  };

  // the row opened beside the Gantt, and the action whose sub-actions are open
  const [openId, setOpenId] = useState<number | null>(null);
  const [subsFor, setSubsFor] = useState<PlanItem | null>(null);
  // a link to one row (?item=, as a KPI tile's task links here) opens it once - not again after every save
  const handled = useRef<number | null>(null);
  useEffect(() => {
    const id = Number(params.get("item"));
    if (!data || !Number.isInteger(id) || id <= 0 || handled.current === id) return;
    const it = data.items.find((i) => i.id === id);
    if (!it) return;
    handled.current = id;
    setOpenId(id);
    // its topic and group open, so the row is there to see
    setCollapsed((c) => {
      const n = new Set(c);
      for (let p = it.parentId; p != null; p = data.items.find((x) => x.id === p)?.parentId ?? null) n.delete(`i${p}`);
      return n;
    });
  }, [data, params]);
  const opened = openId != null ? items.find((i) => i.id === openId) ?? null : null;
  const openRow = (i: PlanItem) => {
    handled.current = i.id;
    setOpenId(i.id);
    router.replace(`/reporting/action-plan?item=${i.id}`, { scroll: false });
  };
  const closeRow = useCallback(() => { setOpenId(null); router.replace("/reporting/action-plan", { scroll: false }); }, [router]);

  // changes
  const patch = async (id: number, p: Partial<PlanFields>) => {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
    try {
      const j = await send("/api/reporting/action-plan", "PATCH", { id, ...p });
      const item = j.item as PlanItem;
      setData((d) => d && { ...d, items: d.items.map((i) => (i.id === id ? item : i)) });
      setNote(null);
    } catch (e) { setNote(`Not saved: ${(e as Error).message}`); void load(); }
  };
  const canDrop = (drag: GRow, target: GRow, where: Where) => {
    if (!data?.canWrite || drag.type !== "item" || drag.key === target.key) return false;
    if (mode === "main") {
      if (drag.item.kind !== "action") return false;
      const to = target.type === "bucket" ? target.value : target.type === "item" ? target.item.mainTopic.trim() : null;
      return to != null && to !== drag.item.mainTopic.trim();
    }
    return target.type === "item" && reorder(items, drag.item.id, target.item.id, where) != null;
  };
  const onDrop = async (drag: GRow, target: GRow, where: Where) => {
    if (drag.type !== "item") return;
    if (mode === "main") {
      const to = target.type === "bucket" ? target.value : target.type === "item" ? target.item.mainTopic.trim() : "";
      await patch(drag.item.id, { mainTopic: to });
      return;
    }
    if (target.type !== "item") return;
    try {
      await send("/api/reporting/action-plan", "POST", { action: "move", id: drag.item.id, target: target.item.id, where });
      setNote(null);
      if (where === "into") setCollapsed((c) => { const n = new Set(c); n.delete(target.key); return n; });
    } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
    await load();
  };
  const add = async (parent: PlanItem, kind: PlanKind, title: string) => {
    try {
      const j = await send("/api/reporting/action-plan", "POST", { action: "add", parentId: parent.id, kind, title });
      await load();
      setCollapsed((c) => { const n = new Set(c); n.delete(`i${parent.id}`); return n; });
      openRow(j.item as PlanItem);
    } catch (e) { setNote(`Not added: ${(e as Error).message}`); }
  };
  const remove = async (i: PlanItem) => {
    const under = items.filter((x) => x.parentId === i.id).length;
    if (!confirm(under ? `Remove "${i.title}" and the ${under} row${under === 1 ? "" : "s"} under it?` : `Remove "${i.title}"?`)) return;
    try { await send(`/api/reporting/action-plan?id=${i.id}`, "DELETE"); closeRow(); await load(); } catch (e) { setNote(`Not removed: ${(e as Error).message}`); }
  };
  const foldAll = (fold: boolean) => {
    const keys = fold
      ? [...items.filter((i) => i.kind !== "goal" && (i.kind !== "action" || subs.some((s) => s.item === i.id))).map((i) => `i${i.id}`), ...rows.filter((r) => r.type === "bucket").map((r) => r.key)]
      : [];
    const n = new Set(keys);
    writePref("collapsed", keys);
    setCollapsed(n);
  };

  const goal = items.find((i) => i.kind === "goal");
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <PageHeader title="Action plan" subtitle={goal ? goal.title : "APSOparts Business Improvement Action Plan"} />

      {/* where we stand on the climb */}
      <GlassCard sx={{ display: "grid", gap: 2.5, alignItems: "center", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 560px" } }}>
        {summit?.base ? <SummitFigures s={summit} /> : (
          <Typography sx={{ fontSize: "0.9rem", color: summitErr ? RED : MUTED }}>{summitErr ? `The revenue could not be read: ${summitErr}` : "Reading the revenue…"}</Typography>
        )}
        <Box sx={{ justifySelf: { lg: "end" }, width: "100%", maxWidth: 560 }}>
          <SummitMountain s={summit} width={560} height={190} labels />
        </Box>
      </GlassCard>

      {/* the counts, the filters, the view */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 700, mr: 1 }}>
          {counts.all} actions
          <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {counts.done} done · {counts.doing} in progress · </Box>
          <Box component="span" sx={{ color: counts.late ? LATE : MUTED, fontWeight: counts.late ? 700 : 500 }}>{counts.late} late</Box>
          <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {counts.undated} without a due date</Box>
        </Typography>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v: Mode | null) => { if (v) { setMode(v); writePref("mode", v); } }} aria-label="Group by"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 650, fontSize: "0.8rem", px: 1.4, py: 0.45 } }}>
          <ToggleButton value="topic">By topic</ToggleButton>
          <ToggleButton value="main">By main topic</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_, v: Zoom | null) => { if (v) { setZoom(v); writePref("zoom", v); } }} aria-label="Time scale"
          sx={{ display: { xs: "none", md: "flex" }, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 650, fontSize: "0.8rem", px: 1.4, py: 0.45 } }}>
          <ToggleButton value="week">Weeks</ToggleButton>
          <ToggleButton value="month">Months</ToggleButton>
          <ToggleButton value="quarter">Quarters</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" startIcon={<UnfoldMoreIcon />} onClick={() => foldAll(false)} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Open all</Button>
        <Button size="small" startIcon={<UnfoldLessIcon />} onClick={() => foldAll(true)} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Close all</Button>
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <TextField size="small" placeholder="Search the actions" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ width: 240, "& .MuiInputBase-root": { borderRadius: "10px", bgcolor: "#fff", fontSize: "0.86rem" } }} />
        <TextField select size="small" value={owner} onChange={(e) => setOwner(e.target.value)} SelectProps={{ displayEmpty: true }}
          sx={{ width: 190, "& .MuiInputBase-root": { borderRadius: "10px", bgcolor: "#fff", fontSize: "0.86rem" } }}>
          <MenuItem value="" sx={{ fontSize: "0.86rem" }}>Everyone</MenuItem>
          {owners.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: "0.86rem" }}>{o}</MenuItem>)}
        </TextField>
        {["1", "2", "3"].map((p) => (
          <Box key={p} component="button" type="button" aria-pressed={prios.includes(p)} onClick={() => setPrios((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))} sx={chip(prios.includes(p))}>Priority {p}</Box>
        ))}
        <Box sx={{ width: 8 }} />
        {(["todo", "doing", "done", "hold", "none"] as const).map((s) => {
          const c = STATE_COLOR[s];
          return (
            <Box key={s} component="button" type="button" aria-pressed={states.includes(s)} onClick={() => setStates((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} sx={chip(states.includes(s), c.ink, c.soft)}>
              <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: c.bar, mr: 0.6 }} />
              {s === "none" ? "No status" : STATE_LABEL[s]}
            </Box>
          );
        })}
        <Box sx={{ width: 8 }} />
        <Box component="button" type="button" aria-pressed={lateOnly} onClick={() => setLateOnly((v) => !v)} sx={chip(lateOnly, LATE, "#fde7e7")}>Late</Box>
        <Box component="button" type="button" aria-pressed={dgOnly} onClick={() => setDgOnly((v) => !v)} sx={chip(dgOnly)}>Digital Growth</Box>
        {filtering && <Button size="small" onClick={() => { setQ(""); setPrios([]); setStates([]); setDgOnly(false); setLateOnly(false); setOwner(""); }} sx={{ textTransform: "none", fontWeight: 650 }}>Clear</Button>}
      </Box>

      {note && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{note}</Typography>}
      {!data ? (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The plan could not be read: ${error}` : "Loading the plan…"}</Typography>
        </Box></GlassCard>
      ) : (
        <Gantt rows={rows} rolled={rolled} today={today} zoom={zoom} canWrite={data.canWrite} collapsed={collapsed} toggle={toggle}
          selected={openId} onOpen={openRow} onSubs={setSubsFor} onPatch={patch} canDrop={canDrop} onDrop={onDrop}
          height="max(480px, calc(100vh - 150px))" />
      )}
      <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
        Drag a row by its handle onto another {mode === "main" ? "main topic" : "topic or group"}; drag a bar to move its dates, its right end to change the due.
        A diamond is an action with only a due date; a dot is a sub-action. Sub-actions come from the action itself or from a KPI tile&apos;s Actions.
      </Typography>

      {opened && (
        <ItemDrawer item={opened} rolled={rolled.get(opened.id)} subs={subs.filter((s) => s.item === opened.id)} canWrite={!!data?.canWrite}
          onClose={closeRow} onPatch={patch} onSubs={setSubsFor} onAdd={add} onDelete={remove} />
      )}
      {subsFor && (
        <ActionsPanel open onClose={() => setSubsFor(null)} canWrite={!!data?.canWrite}
          tile={{ key: `plan:${subsFor.id}`, page: "plan", title: subsFor.title, summary: [subsFor.code, subsFor.responsible, subsFor.due ? `due ${subsFor.due.split("-").reverse().join(".")}` : ""].filter(Boolean).join(" · "), href: `${window.location.origin}/reporting/action-plan?item=${subsFor.id}` }}
          placed="tab" format="tile" formats={[]} onMove={async () => {}}
          plan={{ tickets: subsFor.dg }} onChanged={() => void load()} />
      )}
    </Box>
  );
}

export default function ActionPlanPage() {
  // drawn in the browser only: the plan, the viewer's own settings and the revenue are all read there, and a
  // server copy of the empty page only gave React a draft to disagree with - an intermittent hydration error
  // (#418, 3 loads in 8 when arriving from another page)
  const [here, setHere] = useState(false);
  useEffect(() => { setHere(true); }, []);
  if (!here) return null;
  return (
    <Suspense fallback={null}>
      <ActionPlan />
    </Suspense>
  );
}
