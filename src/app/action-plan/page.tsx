"use client";
// THE ACTION PLAN (SARCLA 31.10.2026): "APSOparts Business Improvement Action Plan" as a Gantt, the way
// Planner draws one - the workbook's tree as its first tab shows it: the goal on top, the main categories (the
// bold rows), their sub-categories (the green rows), the actions; opened and closed level by level, a row dragged
// to another category. Sub-actions are added on an action, or on any KPI tile's Actions and linked to it; only
// actions Digital Growth leads take a "From Scroll to Sale" ticket.
// An application of its own, admins only, the whole width (SARCLA 01.11.2026): the hub's bar on top, the goal's
// statement first, where APSOparts stands on the climb to 30 M€ by 2031, then the Gantt.

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

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ActionsPanel } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KILLED, PRIORITIES, S2S_CHOICES, STAGES, isClosed, isLate, reorder, rollup, type PlanFields, type PlanItem, type PlanKind } from "@/lib/reporting/actionPlanRules";
import { Gantt, type AddWhat, type GRow, type Where, type Zoom } from "./Gantt";
import { ItemModal, KIND_LABEL } from "./ItemModal";
import { SummitFigures, SummitMountain, useSummit } from "./Summit";
import { LATE, PRIORITY_COLOR, PROJECT_COLORS, readPref, send, stageColor, todayIso, writePref, type PlanData } from "./planUi";

// square, as the tags (SARCLA 01.11.2026: "tags not round, square")
const chip = (on: boolean, color: string = TINT.blue.fg, soft: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? color : HAIRLINE}`, bgcolor: on ? soft : "#fff", color: on ? color : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});

/** Every row closed but the goal: the main categories alone (SARCLA 01.11.2026: "default close all"). */
const foldKeys = (items: PlanItem[], subs: { item: number }[]) =>
  items.filter((i) => i.kind !== "goal" && (i.kind !== "action" || subs.some((s) => s.item === i.id))).map((i) => `i${i.id}`);

/** The filter's choice for the actions nobody has been given to yet. */
const NOBODY = "__nobody";

function ActionPlan() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = useMemo(() => todayIso(), []);
  const { data: summit, error: summitErr } = useSummit();

  // the viewer's own settings (the page is drawn in the browser only, so they are read before the first draw).
  // By default months and every main category closed (SARCLA 01.11.2026: "default calendar per month, default
  // close all") - under new keys, so the weeks and the open tree saved before do not win over them
  const [zoom, setZoom] = useState<Zoom>(() => readPref<Zoom>("zoom.v2", "month"));
  const savedFold = useRef(readPref<string[] | null>("collapsed.v2", null));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(savedFold.current ?? []));
  const [compact, setCompact] = useState(() => readPref<boolean>("compact", false));
  const toggle = (key: string) => setCollapsed((c) => {
    const n = new Set(c);
    if (n.has(key)) n.delete(key); else n.add(key);
    writePref("collapsed.v2", [...n]);
    return n;
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/action-plan");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setData({ canWrite: !!j.canWrite, items: j.items, subs: j.subs, people: j.people ?? [], peopleError: j.peopleError ?? null, choices: j.choices ?? S2S_CHOICES });
      // nothing saved yet: closed, in the same draw as the plan, so it never shows open first
      if (savedFold.current == null) { savedFold.current = []; setCollapsed(new Set(foldKeys(j.items, j.subs))); }
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // filters
  const [q, setQ] = useState("");
  const [prios, setPrios] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [dgOnly, setDgOnly] = useState(false);
  const [lateOnly, setLateOnly] = useState(false);
  const [owner, setOwner] = useState("");
  const filtering = !!q.trim() || prios.length > 0 || stages.length > 0 || dgOnly || lateOnly || !!owner;

  const items = useMemo(() => data?.items ?? [], [data]);
  const subs = useMemo(() => data?.subs ?? [], [data]);
  const rolled = useMemo(() => rollup(items, subs, today), [items, subs, today]);
  // each main category's colour, carried by everything under it; the goal has none
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
  const colorOf = useCallback((i: PlanItem) => colors.get(i.id) ?? null, [colors]);
  // the people actions are given to, for the filter
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) if (i.kind === "action") for (const o of i.owners) m.set(o.id, o.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const passes = useCallback((i: PlanItem) => {
    if (i.kind !== "action") return false;
    const w = q.trim().toLowerCase();
    if (w && ![i.title, i.detail, i.responsible, i.code, i.statusNote, i.kpis, i.nextSteps, ...i.channel, ...i.agency, ...i.owners.map((o) => o.name)].some((x) => x.toLowerCase().includes(w))) return false;
    if (prios.length && !prios.includes(i.priority)) return false;
    if (stages.length && !stages.includes(i.stage ?? "none")) return false;
    if (dgOnly && !i.dg) return false;
    if (lateOnly && !isLate(i, today)) return false;
    if (owner === NOBODY ? i.owners.length > 0 : !!owner && !i.owners.some((o) => o.id === owner)) return false;
    return true;
  }, [q, prios, stages, dgOnly, lateOnly, owner, today]);

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

    // the workbook's own tree - the goal first, its main categories (the bold rows), their sub-categories (the green
    // rows), the actions; a row shows when it passes the filters or something under it does
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
  }, [items, subs, collapsed, filtering, passes]);

  const actions = items.filter((i) => i.kind === "action");
  const counts = {
    all: actions.length,
    done: actions.filter((i) => isClosed(i.stage) && i.stage !== KILLED).length,
    doing: actions.filter((i) => !!i.stage && !isClosed(i.stage) && i.stage !== STAGES[0].id).length,
    late: actions.filter((i) => isLate(i, today)).length,
    undated: actions.filter((i) => !i.due && !isClosed(i.stage)).length,
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
    router.replace(`/action-plan?item=${i.id}`, { scroll: false });
  };
  const closeRow = useCallback(() => { setOpenId(null); router.replace("/action-plan", { scroll: false }); }, [router]);

  // changes
  const patch = async (id: number, p: Partial<PlanFields>) => {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
    try {
      // people go by their HubSpot owner id
      const j = await send("/api/action-plan", "PATCH", { id, ...p, ...(p.owners ? { owners: p.owners.map((o) => o.id) } : {}) });
      const item = j.item as PlanItem;
      setData((d) => d && { ...d, items: d.items.map((i) => (i.id === id ? item : i)) });
      setNote(null);
    } catch (e) { setNote(`Not saved: ${(e as Error).message}`); void load(); }
  };
  const canDrop = (drag: GRow, target: GRow, where: Where) => {
    if (!data?.canWrite || drag.type !== "item" || drag.key === target.key) return false;
    return target.type === "item" && reorder(items, drag.item.id, target.item.id, where) != null;
  };
  const onDrop = async (drag: GRow, target: GRow, where: Where) => {
    if (drag.type !== "item" || target.type !== "item") return;
    try {
      await send("/api/action-plan", "POST", { action: "move", id: drag.item.id, target: target.item.id, where });
      setNote(null);
      if (where === "into") setCollapsed((c) => { const n = new Set(c); n.delete(target.key); return n; });
    } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
    await load();
  };
  const add = async (parent: PlanItem, kind: PlanKind, title: string) => {
    try {
      const j = await send("/api/action-plan", "POST", { action: "add", parentId: parent.id, kind, title });
      await load();
      setCollapsed((c) => { const n = new Set(c); n.delete(`i${parent.id}`); return n; });
      openRow(j.item as PlanItem);
    } catch (e) { setNote(`Not added: ${(e as Error).message}`); }
  };
  const remove = async (i: PlanItem) => {
    const under = items.filter((x) => x.parentId === i.id).length;
    if (!confirm(under ? `Remove "${i.title}" and the ${under} row${under === 1 ? "" : "s"} under it?` : `Remove "${i.title}"?`)) return;
    try { await send(`/api/action-plan?id=${i.id}`, "DELETE"); closeRow(); await load(); } catch (e) { setNote(`Not removed: ${(e as Error).message}`); }
  };
  // the + beside a row: the new row goes in it or beside it, named for now and opened to be named properly
  const addAt = async (row: PlanItem, kind: AddWhat["kind"]) => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const up = (i: PlanItem, k: PlanKind) => { let p: PlanItem | undefined = i; while (p && p.kind !== k) p = p.parentId != null ? byId.get(p.parentId) : undefined; return p; };
    const parent = kind === "topic" ? items.find((i) => i.kind === "goal")
      : kind === "group" ? up(row, "topic")
        : row.kind === "action" ? (row.parentId != null ? byId.get(row.parentId) : undefined) : row;
    if (!parent) { setNote("There is no place for it here"); return; }
    await add(parent, kind, `New ${KIND_LABEL[kind].toLowerCase()}`);
  };
  const moveTo = async (i: PlanItem, parentId: number) => {
    try {
      await send("/api/action-plan", "POST", { action: "move", id: i.id, target: parentId, where: "into" });
      setNote(null);
    } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
    await load();
  };
  const foldAll = (fold: boolean) => {
    const keys = fold ? foldKeys(items, subs) : [];
    writePref("collapsed.v2", keys);
    setCollapsed(new Set(keys));
  };

  const goal = items.find((i) => i.kind === "goal");
  // the goal's statement as the workbook writes it: its first line the headline, the rest the why
  const statement = goal ? goal.detail.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      {/* an application of its own: the hub's bar, no panel - the whole width is the plan's */}
      <HomeBar on="Action plan" />

      {/* the goal, where we stand and the climb - one block, about half as tall as it was: the headline and the figures on
          the left, the mountain on the right with the goal's why in its sky (SARCLA 01.11.2026: "put the sub text on top of
          the mountain to decrease the length of this first block to about half") */}
      <GlassCard sx={{ display: "grid", gap: { xs: 2, lg: 3 }, alignItems: "stretch", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 0.92fr) minmax(0, 1.08fr)" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 2, alignContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>Action plan</Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.4rem", md: "1.62rem" }, fontWeight: 650, letterSpacing: "-0.025em", lineHeight: 1.2, color: INK, mt: 0.5, textWrap: "balance" }}>
              {statement[0] ?? "APSOparts Business Improvement Action Plan"}
            </Typography>
          </Box>
          <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.75 }}>
            {summit?.base ? <SummitFigures s={summit} /> : (
              <Typography sx={{ fontSize: "0.9rem", color: summitErr ? RED : MUTED }}>{summitErr ? `The revenue could not be read: ${summitErr}` : "Reading the revenue…"}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ position: "relative", minWidth: 0, minHeight: { lg: 232 }, display: "flex", flexDirection: "column", gap: 1 }}>
          {/* the mountain fills the right, anchored bottom right; on a phone it sits under the words */}
          <Box sx={{ position: { xs: "relative", lg: "absolute" }, inset: { lg: 0 }, order: { xs: 2, lg: 0 }, aspectRatio: { xs: "1000 / 250", lg: "auto" }, width: "100%", maxWidth: "100%" }}>
            <SummitMountain s={summit} mode="hero" />
          </Box>
          {statement.length > 1 && (
            <Box sx={{ position: "relative", zIndex: 1, display: "grid", gap: 0.5, maxWidth: { lg: "54%" }, order: { xs: 1, lg: 0 } }}>
              {statement.slice(1).map((l, k) => (
                <Typography key={k} sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45, textShadow: "0 0 6px rgba(255,255,255,.9)" }}>{l}</Typography>
              ))}
            </Box>
          )}
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
        <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_, v: Zoom | null) => { if (v) { setZoom(v); writePref("zoom.v2", v); } }} aria-label="Time scale"
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
          <MenuItem value={NOBODY} sx={{ fontSize: "0.86rem", fontStyle: "italic" }}>Not assigned yet</MenuItem>
          {owners.map((o) => <MenuItem key={o.id} value={o.id} sx={{ fontSize: "0.86rem" }}>{o.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={stages} onChange={(e) => setStages(typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]))}
          SelectProps={{ multiple: true, displayEmpty: true, renderValue: (v) => ((v as string[]).length ? (v as string[]).map((x) => STAGES.find((s) => s.id === x)?.label ?? "No status").join(", ") : "Every status") }}
          sx={{ width: 220, "& .MuiInputBase-root": { borderRadius: "8px", bgcolor: "#fff", fontSize: "0.86rem" } }}>
          {[...STAGES.map((s) => ({ id: s.id, label: s.label })), { id: "none", label: "No status" }].map((s) => (
            <MenuItem key={s.id} value={s.id} sx={{ fontSize: "0.86rem", gap: 1 }}>
              <Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: stageColor(s.id === "none" ? null : s.id).bar, flexShrink: 0 }} />
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        {[...PRIORITIES].reverse().map((p) => (
          <Box key={p.value} component="button" type="button" aria-pressed={prios.includes(p.value)} onClick={() => setPrios((x) => (x.includes(p.value) ? x.filter((y) => y !== p.value) : [...x, p.value]))}
            sx={chip(prios.includes(p.value), PRIORITY_COLOR[p.value].fg, PRIORITY_COLOR[p.value].bg)}>{p.label}</Box>
        ))}
        <Box sx={{ width: 8 }} />
        <Box component="button" type="button" aria-pressed={lateOnly} onClick={() => setLateOnly((v) => !v)} sx={chip(lateOnly, LATE, "#fde7e7")}>Late</Box>
        <Box component="button" type="button" aria-pressed={dgOnly} onClick={() => setDgOnly((v) => !v)} sx={chip(dgOnly)}>Digital Growth</Box>
        {filtering && <Button size="small" onClick={() => { setQ(""); setPrios([]); setStages([]); setDgOnly(false); setLateOnly(false); setOwner(""); }} sx={{ textTransform: "none", fontWeight: 650 }}>Clear</Button>}
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
          height="max(480px, calc(100vh - 150px))" colorOf={colorOf}
          compact={compact} onCompact={() => setCompact((v) => { writePref("compact", !v); return !v; })} onAdd={(row, kind) => void addAt(row, kind)} />
      )}
      <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
        Drag a row by its handle onto another main category or sub-category, or add one with the + beside it; drag a bar to move its dates, its right end to change the go-live date.
        A bar runs from the planned date to the go-live date, a diamond is an action with only a go-live date, a square a sub-action. The statuses and priorities are the &ldquo;From Scroll to Sale&rdquo; pipeline&apos;s.
      </Typography>

      {opened && (
        <ItemModal item={opened} items={items} rolled={rolled.get(opened.id)} subs={subs.filter((s) => s.item === opened.id)} canWrite={!!data?.canWrite}
          people={data?.people ?? []} peopleError={data?.peopleError ?? null} choices={data?.choices ?? S2S_CHOICES}
          onClose={closeRow} onPatch={patch} onSubs={setSubsFor} onAdd={add} onDelete={remove} onMoveTo={moveTo} />
      )}
      {subsFor && (
        <ActionsPanel open onClose={() => setSubsFor(null)} canWrite={!!data?.canWrite}
          tile={{ key: `plan:${subsFor.id}`, page: "plan", title: subsFor.title, summary: [subsFor.code, subsFor.owners.map((o) => o.name).join(", ") || subsFor.responsible, subsFor.due ? `due ${subsFor.due.split("-").reverse().join(".")}` : ""].filter(Boolean).join(" · "), href: `${window.location.origin}/action-plan?item=${subsFor.id}` }}
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
