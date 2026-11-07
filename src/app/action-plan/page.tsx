"use client";
// THE ACTION PLAN (SARCLA 31.10.2026): "APSOparts Business Improvement Action Plan" as a Gantt, the way
// Planner draws one - the workbook's tree as its first tab shows it: the goal on top, the main categories (the
// bold rows), their sub-categories (the green rows), the actions; opened and closed level by level, a row dragged
// to another category. Sub-actions are added on an action, or on any KPI tile's Actions and linked to it; only
// actions Digital Growth leads take a "From Scroll to Sale" ticket, and the sub-actions of the Digital Growth team's own.
// An application of its own, admins only, the whole width (SARCLA 01.11.2026): the hub's bar on top, the goal's
// statement first, where APSOparts stands on the climb to 30 M€ by 2031, then the Gantt.

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { KILLED, LIVE, NOBODY, PRIORITIES, S2S_CHOICES, STAGES, actionMatches, dueSoon, isClosed, isFiltering, isLate, placeSub, reorder, rollup, searchWords, treeOrder, subClosed, subOrder, subsFound, ticketsShown, type PlanFields, type PlanFilter, type PlanItem, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { Gantt, type GRow, type Where, type Zoom } from "./Gantt";
import { ItemModal } from "./ItemModal";
import { AddDialog } from "./AddDialog";
import { SubWindow } from "./SubWindow";
import { DuplicateSub } from "./DuplicateSub";
import { SummitFigures, SummitMountain, useSummit } from "./Summit";
import { KpiPicker, type TrackChoice, type TrackTarget } from "./KpiPicker";
import { LATE, PRIORITY_COLOR, PROJECT_COLORS, readPref, send, stageColor, todayIso, writePref, type PlanData } from "./planUi";

/** A title cut for a question or a line - the whole of a long one buried what the question asked (07.11.2026). */
const cut = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

// square, as the tags (SARCLA 01.11.2026: "tags not round, square")
const chip = (on: boolean, color: string = TINT.blue.fg, soft: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? color : HAIRLINE}`, bgcolor: on ? soft : "#fff", color: on ? color : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});

/** Every row closed but the goal: the main categories alone (SARCLA 01.11.2026: "default close all"). */
const foldKeys = (items: PlanItem[], subs: { item: number }[]) =>
  items.filter((i) => i.kind !== "goal" && (i.kind !== "action" || subs.some((s) => s.item === i.id))).map((i) => `i${i.id}`);

function ActionPlan() {
  const params = useSearchParams();
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
  // the rows this viewer hid with the eye beside the +, and whether "Hidden rows" shows them again, faded (SARCLA
  // 01.11.2026: "an eye-cut symbol to allow the user to hide certain rows - this should also be a filter then")
  const [hidden, setHidden] = useState<Set<number>>(() => new Set(readPref<number[]>("hidden.v1", [])));
  const [showHidden, setShowHidden] = useState(false);
  // where a dragged row went (SARCLA 07.11.2026: a sub-action dropped on "Increase efficiency of Sales" became an action at
  // the end of it - out of sight below the screen, and "Hide live" hid it: "j'ai perdu mon action"): once the plan is read
  // again, its categories open, the plan scrolls to it and it lights up - or the line says what hides it
  const [reveal, setReveal] = useState<{ id: number; key: string } | null>(null);
  const [flash, setFlash] = useState<{ key: string; n: number } | null>(null);
  const show = (id: number, key?: string) => setReveal({ id, key: key ?? `i${id}` });
  const hide = (i: PlanItem, h: boolean) => setHidden((x) => {
    const n = new Set(x);
    if (h) n.add(i.id); else n.delete(i.id);
    writePref("hidden.v1", [...n]);
    return n;
  });
  const flip = (key: string) => setCollapsed((c) => {
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
      setData({ canWrite: !!j.canWrite, items: j.items, subs: j.subs, own: j.own ?? {}, people: j.people ?? [], peopleError: j.peopleError ?? null, choices: j.choices ?? S2S_CHOICES });
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
  // due within a week (SARCLA 03.11.2026: "we have the filter late but we should have also 1 week to deadline")
  const [soonOnly, setSoonOnly] = useState(false);
  const [owner, setOwner] = useState("");
  // the live ones out of sight (SARCLA 02.11.2026: "another filter: hide live, to hide the live actions"), kept per browser
  const [hideLive, setHideLive] = useState(() => readPref<boolean>("hideLive.v1", false));
  const liveOff = (v: boolean) => { setHideLive(v); writePref("hideLive.v1", v); };
  // the box answers each key at once; the plan follows when React has a moment (a long plan never holds the typing up)
  const dq = useDeferredValue(q);
  const f: PlanFilter = useMemo(() => ({ q: dq, prios, stages, dg: dgOnly, late: lateOnly, soon: soonOnly, owner, hideLive }), [dq, prios, stages, dgOnly, lateOnly, soonOnly, owner, hideLive]);
  const filtering = isFiltering(f);
  // a search or a person picked opens what they find - the plan is closed by default, and a sub-action found under a
  // closed action did not show (SARCLA 04.11.2026: "when searching for names the sub-actions are not appearing"); what
  // is closed while they are on is closed for them alone, the plan's own folds come back with them off
  const opening = searchWords(dq).length > 0 || !!owner;
  const [filterFold, setFilterFold] = useState<Set<string>>(() => new Set());
  useEffect(() => { setFilterFold(new Set()); }, [dq, owner]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const subs = useMemo(() => data?.subs ?? [], [data]);
  const subsByItem = useMemo(() => {
    const m = new Map<number, typeof subs>();
    for (const s of subs) (m.get(s.item) ?? m.set(s.item, []).get(s.item)!).push(s);
    return m;
  }, [subs]);
  const rolled = useMemo(() => rollup(items, subs, today), [items, subs, today]);
  // each category's colour, carried by everything under it; the goal has none - in the plan's order, so a category put
  // into a main category keeps its colour (07.11.2026)
  const colors = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const topics = treeOrder(items).filter((i) => i.kind === "topic");
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
  // the people actions and sub-actions are given to, for the filter - one with sub-actions only was not in it
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) if (i.kind === "action") for (const o of i.owners) m.set(o.id, o.name);
    for (const s of subs) if (/^\d+$/.test(s.owner) && !m.has(s.owner)) m.set(s.owner, s.ownerName || s.owner);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, subs]);

  // an action and its sub-actions, by the same filters (actionPlanRules.actionMatches / subsFound); its own tickets' numbers
  // are searched with it
  const own = data?.own;
  const passes = useCallback((i: PlanItem) => actionMatches(i, subsByItem.get(i.id) ?? [], f, today, own?.[i.id] ?? []), [f, subsByItem, today, own]);
  const found = useCallback((a: PlanItem) => subsFound(a, subsByItem.get(a.id) ?? [], f, today, own?.[a.id] ?? []), [f, subsByItem, today, own]);
  const folds = opening ? filterFold : collapsed;
  const toggle = (key: string) => {
    if (!opening) { flip(key); return; }
    setFilterFold((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  // the rows, top to bottom
  const { rows, lateShown, acts, subsShown } = useMemo(() => {
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
    // what the filters show, closed or open: the actions found and the sub-actions shown under them, for the counts
    const acts: PlanItem[] = [];
    const subsShown: PlanSub[] = [];

    // the workbook's own tree - the goal first, its main categories (the bold rows), their sub-categories (the green
    // rows), the actions; a row shows when it passes the filters or something under it does
    const shown = new Map<number, boolean>();
    // an action's sub-actions found, once per draw
    const foundOf = new Map<number, PlanSub[]>();
    const foundUnder = (a: PlanItem): PlanSub[] => {
      let x = foundOf.get(a.id);
      if (!x) { x = found(a); foundOf.set(a.id, x); }
      return x;
    };
    const visible = (i: PlanItem): boolean => {
      if (shown.has(i.id)) return shown.get(i.id)!;
      shown.set(i.id, false);
      const v = hidden.has(i.id) && !showHidden ? false : !filtering ? true
        // an action: found itself, or one of its sub-actions is
        : i.kind === "action" ? passes(i) || foundUnder(i).length > 0
          : (kids.get(i.id) ?? []).some(visible);
      shown.set(i.id, v);
      return v;
    };
    const walk = (i: PlanItem, depth: number, closed: boolean) => {
      const under = (kids.get(i.id) ?? []).filter(visible);
      // with a filter on, the sub-actions it finds - all of them without one
      const mine = i.kind === "action" ? (filtering ? foundUnder(i) : subsOf.get(i.id) ?? []) : [];
      if (i.kind === "action") {
        if (!filtering || passes(i)) acts.push(i);
        subsShown.push(...mine);
      }
      const key = `i${i.id}`;
      if (!closed) out.push({ key, type: "item", item: i, depth, hasKids: under.length > 0 || mine.length > 0 });
      const shut = closed || folds.has(key);
      if (!shut) for (const s of mine) out.push({ key: `s${s.id}`, type: "sub", sub: s, parent: i, depth: depth + 1 });
      for (const c of under) walk(c, depth + 1, shut);
    };
    for (const root of (kids.get(null) ?? []).filter(visible)) walk(root, 0, false);
    // a category's "N late": the late actions under it that show - with a filter on, or rows hidden, the others are not
    // there to find (SARCLA 03.11.2026: "MARKETING & AUTOMATION" said 2 late over three actions none of them late)
    const lateShown = new Map<number, number>();
    const lateIn = (i: PlanItem): number => {
      if (lateShown.has(i.id)) return lateShown.get(i.id)!;
      lateShown.set(i.id, 0);
      const n = (kids.get(i.id) ?? []).filter(visible).reduce((sum, c) => sum + (rolled.get(c.id)?.lateSelf ? 1 : 0) + lateIn(c), 0);
      lateShown.set(i.id, n);
      return n;
    };
    for (const i of items) lateIn(i);
    return { rows: out, lateShown, acts, subsShown };
  }, [items, subs, folds, filtering, passes, found, hidden, showHidden, rolled]);
  // the row asked for (show): its categories opened first, then into sight - or the line says what hides it
  useEffect(() => {
    if (!reveal) return;
    const it = items.find((x) => x.id === reveal.id);
    if (!it) return; // the plan is not read again yet
    const up: string[] = [];
    for (let p = it.parentId; p != null; p = items.find((x) => x.id === p)?.parentId ?? null) up.push(`i${p}`);
    if (reveal.key !== `i${it.id}`) up.push(`i${it.id}`); // a sub-action: its action open too
    const shut = up.filter((k) => folds.has(k));
    if (shut.length) {
      const open = (c: Set<string>) => { const n = new Set(c); for (const k of shut) n.delete(k); return n; };
      if (opening) setFilterFold(open); else setCollapsed(open);
      return;
    }
    setReveal(null);
    if (rows.some((r) => r.key === reveal.key)) { setFlash({ key: reveal.key, n: Date.now() }); return; }
    const why = hidden.has(it.id) && !showHidden ? "the eye hides it - Hidden rows shows it"
      : hideLive && it.stage === LIVE ? "it is Live and Hide live hides it - Clear shows it"
      : "the filters hide it - Clear shows it";
    setSaid((x) => `${x ? `${x}. ` : ""}Not in sight: ${why}`);
  }, [reveal, items, rows, folds, opening, hidden, showHidden, hideLive]);
  // the Gantt's figures with those counts; the rows' windows keep the whole plan's
  const rolledShown = useMemo(() => {
    const m = new Map(rolled);
    for (const [id, n] of lateShown) { const r = m.get(id); if (r && r.late !== n + (r.lateSelf ? 1 : 0)) m.set(id, { ...r, late: n + (r.lateSelf ? 1 : 0) }); }
    return m;
  }, [rolled, lateShown]);

  const hiddenN = items.filter((i) => hidden.has(i.id)).length;
  // the counts of what shows: with a filter on, of the actions it finds, the sub-actions shown and their tickets, each
  // once (SARCLA 04.11.2026: "the filter per person doesn't give the total number of tickets") - the plan's whole
  // count beside them
  const counts = {
    all: items.filter((i) => i.kind === "action").length,
    shown: acts.length,
    done: acts.filter((i) => isClosed(i.stage) && i.stage !== KILLED).length,
    doing: acts.filter((i) => !!i.stage && !isClosed(i.stage) && i.stage !== STAGES[0].id).length,
    late: acts.filter((i) => isLate(i, today, subsByItem.get(i.id))).length,
    soon: acts.filter((i) => dueSoon(i, subsByItem.get(i.id) ?? [], today)).length,
    undated: acts.filter((i) => !i.due && !isClosed(i.stage)).length,
    subs: subsShown.length,
    tickets: ticketsShown(acts, subsShown, data?.own ?? {}),
  };

  // the row opened over the Gantt, and the row whose + was clicked (its small window)
  const [openId, setOpenId] = useState<number | null>(null);
  const [addFor, setAddFor] = useState<PlanItem | null>(null);
  // a sub-action in its own window (SARCLA 02.11.2026: "I click on a sub-action and I'm redirected to the main action")
  const [subId, setSubId] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => { if (!said) return; const h = setTimeout(() => setSaid(null), said.includes(" hides it") ? 20000 : 8000); return () => clearTimeout(h); }, [said]);
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
  const subHandled = useRef<number | null>(null);
  useEffect(() => {
    const id = Number(params.get("sub"));
    if (!data || !Number.isInteger(id) || id <= 0 || subHandled.current === id || !data.subs.some((x) => x.id === id)) return;
    subHandled.current = id;
    setSubId(id);
  }, [data, params]);
  const openSub = (id: number) => {
    subHandled.current = id;
    setOpenId(null); setSubId(id);
    window.history.replaceState(null, "", `/action-plan?sub=${id}`);
  };
  const closeSub = () => { setSubId(null); window.history.replaceState(null, "", "/action-plan"); };
  const sub = subId != null ? subs.find((x) => x.id === subId) ?? null : null;
  const subParent = sub ? items.find((i) => i.id === sub.item) ?? null : null;
  // the address follows the row opened without asking the server for the page again (router.replace did, on every
  // open and close); Next keeps useSearchParams in step with history.replaceState
  const openRow = (i: PlanItem) => {
    handled.current = i.id;
    setOpenId(i.id);
    window.history.replaceState(null, "", `/action-plan?item=${i.id}`);
  };
  const closeRow = useCallback(() => { setOpenId(null); window.history.replaceState(null, "", "/action-plan"); }, []);

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
  // KPI tracking, an action's or a sub-action's own (SARCLA 04.11.2026): off at once; Yes - or another KPI - asks which
  // KPI of the plan first (KpiPicker.tsx), and Cancel leaves it as it was
  const [trackFor, setTrackFor] = useState<TrackTarget | null>(null);
  const saveTrack = async (t: TrackTarget, k: { key: string; title: string } | null) => {
    const p = { tracked: !!k, trackKpi: k?.key ?? "", trackKpiTitle: k?.title ?? "" };
    if (t.kind === "item") { await patch(t.id, p); return; }
    setData((d) => d && { ...d, subs: d.subs.map((s) => (s.id === t.id ? { ...s, ...p } : s)) });
    try { await send("/api/reporting/kpi-actions/tasks", "PATCH", { id: t.id, ...p }); setNote(null); }
    catch (e) { setNote(`Not saved: ${(e as Error).message}`); void load(); }
  };
  const track = (t: TrackTarget, c: TrackChoice) => { if (c === "no") void saveTrack(t, null); else setTrackFor(t); };
  const canDrop = (drag: GRow, target: GRow, where: Where) => {
    // a sub-action: up or down among the sub-actions, the open ones above the closed ones (SARCLA 03.11.2026) - by another
    // action's, it moves there (one made on the plan)
    if (drag.type === "sub" && target.type === "sub") {
      return !!data?.canWrite && target.key !== drag.key && subClosed(target.sub) === subClosed(drag.sub) && (target.parent.id === drag.parent.id || !drag.sub.kpiTile);
    }
    // a sub-action made on the plan: under another action, or an action of its own in a category
    if (drag.type === "sub") {
      if (!data?.canWrite || target.type !== "item" || drag.sub.kpiTile) return false;
      return where === "sub" ? target.item.kind === "action" && target.item.id !== drag.parent.id : where === "into" && (target.item.kind === "group" || target.item.kind === "topic");
    }
    if (!data?.canWrite || drag.type !== "item" || drag.key === target.key) return false;
    // a category goes into a category or above one, never by an action
    if (drag.item.kind === "topic" && (target.type !== "item" || target.item.kind === "action")) return false;
    // an action onto another action: it becomes its sub-action
    if (where === "sub") return target.type === "item" && drag.item.kind === "action" && target.item.kind === "action";
    return target.type === "item" && where !== "after" && reorder(items, drag.item.id, target.item.id, where) != null;
  };
  // a sub-action duplicated onto another action (the icon on its row, its window, or Ctrl-drag): that action opened to show it
  // (from its window: the window gives way to it - two windows closing at once left the lower one on the screen - and
  // comes back on Cancel)
  const [dupFor, setDupFor] = useState<{ sub: (typeof subs)[number]; parent: PlanItem; back?: boolean } | null>(null);
  const duplicated = (to: PlanItem, tickets: number, title: string) => {
    setSaid(`A copy of “${title}” is under “${to.title}” now${tickets ? " - the same ticket, kept in step with both" : ""}`);
    setCollapsed((c) => {
      const n = new Set(c);
      for (let p: number | null = to.id; p != null; p = items.find((x) => x.id === p)?.parentId ?? null) n.delete(`i${p}`);
      return n;
    });
  };
  const onDrop = async (drag: GRow, target: GRow, where: Where, copy = false) => {
    if (drag.type === "sub" && target.type === "sub") {
      const s = drag.sub, to = target.parent, away = to.id !== drag.parent.id;
      if (away && !confirm(`Move it under “${cut(to.title)}”?\n\n“${cut(s.title)}”`)) return;
      // in its place at once, under the same action
      const order = away ? null : placeSub(subOrder(subs.filter((x) => x.item === to.id)).map((x) => x.id), s.id, target.sub.id, where === "after" ? "after" : "before");
      if (order) {
        const at = new Map(order.map((id, k) => [id, k + 1]));
        setData((d) => d && { ...d, subs: subOrder(d.subs.map((x) => (at.has(x.id) ? { ...x, sort: at.get(x.id)! } : x))) });
      }
      try {
        await send("/api/action-plan", "POST", { action: "ordersub", taskId: s.id, target: target.sub.id, where });
        setNote(null);
        if (away) { setSaid(`“${cut(s.title)}” is a sub-action of “${cut(to.title)}” now`); show(to.id, `s${s.id}`); }
        if (!away) return;
      } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
      await load();
      return;
    }
    if (drag.type === "sub" && target.type === "item") {
      const s = drag.sub, into = target.item, back = where === "into";
      // Ctrl held: a copy goes under the action with the same ticket, the sub-action stays where it is
      if (copy && !back) {
        try {
          const j = await send("/api/action-plan", "POST", { action: "copysub", taskId: s.id, target: into.id });
          setNote(null); duplicated(into, Number(j.tickets ?? 0), s.title);
        } catch (e) { setNote(`Not copied: ${(e as Error).message}`); }
        await load();
        return;
      }
      if (!confirm(back ? `Make it an ACTION in “${cut(into.title)}”? It goes first in it.\n\n“${cut(s.title)}”`
        : `Move it under “${cut(into.title)}”?\n\n“${cut(s.title)}”`)) return;
      try {
        const j = await send("/api/action-plan", "POST", { action: back ? "unsub" : "movesub", taskId: s.id, target: into.id });
        setNote(null);
        setSaid(back ? `“${cut(s.title)}” is an action in “${cut(into.title)}” now - first in it` : `“${cut(s.title)}” is a sub-action of “${cut(into.title)}” now`);
        const made = (j as { item?: { id?: number } }).item?.id;
        if (back && Number.isInteger(made)) show(made as number); else if (!back) show(into.id, `s${s.id}`);
        setCollapsed((c) => { const n = new Set(c); n.delete(target.key); return n; });
      } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
      await load();
      return;
    }
    if (drag.type !== "item" || target.type !== "item") return;
    if (where === "sub") {
      const a = drag.item, into = target.item;
      if (!confirm(`Make it a SUB-ACTION of “${cut(into.title)}”? Its own sub-actions go there too.\n\n“${cut(a.title)}”`)) return;
      try {
        const j = await send("/api/action-plan", "POST", { action: "sub", id: a.id, target: into.id });
        setNote(null);
        setSaid(`“${cut(a.title)}” is a sub-action of “${cut(into.title)}” now`);
        const t = (j as { task?: { id?: number } }).task?.id;
        show(into.id, Number.isInteger(t) ? `s${t}` : undefined);
        setCollapsed((c) => { const n = new Set(c); n.delete(target.key); return n; });
      } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
      await load();
      return;
    }
    // a category moves with everything in it: asked first, in two short lines (07.11.2026)
    const to = where === "into" ? target.item : items.find((x) => x.id === target.item.parentId);
    if (drag.item.kind === "topic" && to) {
      const q = to.id === drag.item.parentId ? `Move it ${where === "before" ? `above “${cut(target.item.title)}”` : "to the end"}?`
        : to.kind === "goal" ? "Make it a MAIN CATEGORY of its own? Everything in it goes with it."
          : `Put it INTO “${cut(to.title)}”? Everything in it goes with it - its actions stay actions.`;
      if (!confirm(`${q}\n\n“${cut(drag.item.title)}”`)) return;
    }
    try {
      await send("/api/action-plan", "POST", { action: "move", id: drag.item.id, target: target.item.id, where });
      setNote(null);
      if (where === "into") setCollapsed((c) => { const n = new Set(c); n.delete(target.key); return n; });
      if (drag.item.kind === "topic" && to && to.id !== drag.item.parentId) setSaid(to.kind === "goal" ? `“${cut(drag.item.title)}” is a main category now` : `“${cut(drag.item.title)}” is in “${cut(to.title)}” now`);
      show(drag.item.id);
    } catch (e) { setNote(`Not moved: ${(e as Error).message}`); }
    await load();
  };
  const remove = async (i: PlanItem) => {
    const under = items.filter((x) => x.parentId === i.id).length;
    if (!confirm(under ? `Remove "${i.title}" and the ${under} row${under === 1 ? "" : "s"} under it?` : `Remove "${i.title}"?`)) return;
    try { await send(`/api/action-plan?id=${i.id}`, "DELETE"); closeRow(); await load(); } catch (e) { setNote(`Not removed: ${(e as Error).message}`); }
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
    if (opening) { setFilterFold(new Set(keys)); return; }
    writePref("collapsed.v2", keys);
    setCollapsed(new Set(keys));
  };

  const goal = items.find((i) => i.kind === "goal");
  // the goal's statement as the workbook writes it: its first line the headline, the rest the why
  const statement = goal ? goal.detail.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      {/* an application of its own: the hub's bar, no panel - the whole width is the plan's */}
      <HomeBar on="Action plan" plan />

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
          {counts.shown === counts.all ? `${counts.all} actions` : `${counts.shown} of ${counts.all} actions`}
          <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {counts.done} done · {counts.doing} in progress · </Box>
          <Box component="span" sx={{ color: counts.late ? LATE : MUTED, fontWeight: counts.late ? 700 : 500 }}>{counts.late} late</Box>
          <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · </Box>
          <Box component="span" sx={{ color: counts.soon ? TINT.amber.fg : MUTED, fontWeight: counts.soon ? 700 : 500 }}>{counts.soon} due within a week</Box>
          <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {counts.undated} without a due date · </Box>
          {counts.subs} sub-action{counts.subs === 1 ? "" : "s"} · {counts.tickets} ticket{counts.tickets === 1 ? "" : "s"}
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
        <TextField size="small" placeholder="Search names, people, ticket numbers" value={q} onChange={(e) => setQ(e.target.value)}
          title="Every word must be in the row, in any order - a name, a person, a ticket's number"
          sx={{ width: 270, "& .MuiInputBase-root": { borderRadius: "10px", bgcolor: "#fff", fontSize: "0.86rem" } }} />
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
        <Box component="button" type="button" aria-pressed={soonOnly} onClick={() => setSoonOnly((v) => !v)} title="Planned for today or the next 7 days and not live yet - the action or one of its sub-actions"
          sx={chip(soonOnly, TINT.amber.fg, TINT.amber.bg)}>Due within a week</Box>
        <Box component="button" type="button" aria-pressed={dgOnly} onClick={() => setDgOnly((v) => !v)} sx={chip(dgOnly)}>Digital Growth</Box>
        <Box component="button" type="button" aria-pressed={hideLive} onClick={() => liveOff(!hideLive)} sx={chip(hideLive, stageColor(LIVE).ink, stageColor(LIVE).soft)}>Hide live</Box>
        {hiddenN > 0 && (
          <Box component="button" type="button" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)} title={showHidden ? "Hide them again" : "Show the rows you hid, faded - the eye on one shows it for good"}
            sx={{ ...chip(showHidden, MUTED, "#eef1f6"), display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <VisibilityOffOutlinedIcon sx={{ fontSize: 15 }} />Hidden rows · {hiddenN}
          </Box>
        )}
        {showHidden && hiddenN > 0 && <Button size="small" onClick={() => { setHidden(new Set()); writePref("hidden.v1", []); setShowHidden(false); }} sx={{ textTransform: "none", fontWeight: 650 }}>Show them all again</Button>}
        {filtering && <Button size="small" onClick={() => { setQ(""); setPrios([]); setStages([]); setDgOnly(false); setLateOnly(false); setSoonOnly(false); setOwner(""); liveOff(false); }} sx={{ textTransform: "none", fontWeight: 650 }}>Clear</Button>}
      </Box>

      {note && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{note}</Typography>}
      {said && <Typography sx={{ fontSize: "0.88rem", color: GREEN, fontWeight: 600 }}>{said}</Typography>}
      {!data ? (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The plan could not be read: ${error}` : "Loading the plan…"}</Typography>
        </Box></GlassCard>
      ) : (
        <Gantt rows={rows} rolled={rolledShown} today={today} zoom={zoom} canWrite={data.canWrite} collapsed={folds} toggle={toggle}
          selected={openId} onOpen={(i) => openRow(i)} onSubs={(i) => openRow(i)} onOpenSub={openSub} onPatch={patch} onTrack={track} canDrop={canDrop} onDrop={onDrop}
          height="fit" flash={flash} colorOf={colorOf}
          compact={compact} onCompact={() => setCompact((v) => { writePref("compact", !v); return !v; })} onAdd={setAddFor}
          onDuplicate={(s, parent) => setDupFor({ sub: s, parent })} hidden={hidden} onHide={hide} />
      )}
      <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
        Drag a row by its handle onto another main category or sub-category - a category dropped on a main category goes into it with everything in it, on a category's top edge it goes above it; an action dropped on another action becomes its sub-action, on its top edge it goes before it; a sub-action dropped above or below another takes that place (the closed ones stay at the end), dropped on another action it moves there (Ctrl held: a copy goes there), on a category it becomes an action again, and the copy icon on its row duplicates it onto another action - the same ticket, not a new one; the + beside a row adds what goes under it - a sub-action under an action, an action in a category - and the eye hides a row (Hidden rows shows them again); drag a bar to move its dates, its right end to change the go-live date.
        A bar runs from the planned date to the go-live date, a diamond is an action with only a go-live date, a square a sub-action. The statuses and priorities are the &ldquo;From Scroll to Sale&rdquo; pipeline&apos;s.
      </Typography>

      {opened && (
        // keyed by the row: a tile opens another row with its own view and fields
        <ItemModal key={opened.id} item={opened} items={items} rolledAll={rolled} subs={subs.filter((s) => s.item === opened.id)} allSubs={subs} canWrite={!!data?.canWrite}
          people={data?.people ?? []} peopleError={data?.peopleError ?? null} choices={data?.choices ?? S2S_CHOICES} colorOf={colorOf}
          onClose={closeRow} onOpen={(i) => openRow(i)} onOpenSub={openSub} onPatch={patch} onChanged={() => void load()} onAddUnder={setAddFor} onDelete={remove} onMoveTo={moveTo}
          onTrack={(c) => track({ kind: "item", id: opened.id, title: opened.title, tracked: !!opened.tracked, kpi: opened.trackKpi ?? "" }, c)} />
      )}
      {sub && subParent && (
        <SubWindow key={sub.id} id={sub.id} parent={subParent} people={data?.people ?? []} canWrite={!!data?.canWrite}
          tracking={{ tracked: !!sub.tracked, title: sub.trackKpiTitle ?? "" }}
          onTrack={(c) => track({ kind: "sub", id: sub.id, title: sub.title, tracked: !!sub.tracked, kpi: sub.trackKpi ?? "" }, c)}
          onClose={closeSub} onOpenParent={() => { closeSub(); openRow(subParent); }} onChanged={() => void load()}
          onDuplicate={() => { closeSub(); setDupFor({ sub, parent: subParent, back: true }); }}
          onMadeAction={(itemId) => { closeSub(); setSaid("Made an action again"); void load().then(() => { setOpenId(itemId); window.history.replaceState(null, "", `/action-plan?item=${itemId}`); }); }} />
      )}
      {dupFor && (
        <DuplicateSub key={dupFor.sub.id} sub={dupFor.sub} parent={dupFor.parent} items={items}
          onClose={() => { const d = dupFor; setDupFor(null); if (d.back) openSub(d.sub.id); }}
          onDone={(_, to, tickets) => { const t = dupFor.sub.title; setDupFor(null); duplicated(to, tickets, t); void load(); }} />
      )}
      {addFor && (
        // the row as the plan has it now: its Digital Growth switched in the window shows at once
        <AddDialog key={addFor.id} parent={items.find((i) => i.id === addFor.id) ?? addFor} people={data?.people ?? []} choices={data?.choices ?? S2S_CHOICES}
          onPatch={patch} onClose={() => setAddFor(null)}
          onDone={(s) => {
            const at = addFor;
            setAddFor(null); setSaid(s); void load();
            // what was made shows: its parent opens
            setCollapsed((c) => { const n = new Set(c); n.delete(`i${at.id}`); return n; });
          }} />
      )}
      {/* last, so it opens over the window it was asked from */}
      {trackFor && (
        <KpiPicker key={`${trackFor.kind}${trackFor.id}`} target={trackFor} onClose={() => setTrackFor(null)}
          onPick={(k) => { const t = trackFor; setTrackFor(null); void saveTrack(t, k); }} />
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
