"use client";
// THE GANTT (SARCLA 31.10.2026: "I need to create a Gantt here like I showed you in the photo" - Planner's
// Gantt chart). Left, the tree: task name, planned date, go-live date, status, % complete, assigned to - in the
// "From Scroll to Sale" ticket's terms since 01.11.2026 - dates and % typed in the cell, every column resized by
// its edge, the columns after the name folded away by the name's button. Beside the handle a + that opens a small
// window to make what goes under the row - a sub-action under an action, an action under a sub-category (SARCLA
// 01.11.2026: "the plus on the left should always mean a sub-action"; "if I click the plus on [a sub-category] an
// action needs to be created"; nothing is made before Create, AddDialog.tsx) - and an eye to hide it ("an eye-cut
// symbol to hide certain rows - this should also be a filter"). Right,
// the time line in the main category's colour: a bracket over a topic or group from its first to its last
// date, a bar for an action with a start and a due (its done part solid), a diamond for one with only a due,
// a thinner bar per sub-action from its planned to its go-live date (a square with only one of them).
// Rows are dragged by their handle onto another topic or group, or before a row; an action dropped on another action
// becomes its sub-action (SARCLA 02.11.2026), its top edge still placing it before; bars are dragged to
// move their dates, or by their right end to change the due. The two halves scroll together.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import type { PlanItem, PlanKind, PlanSub, Rolled } from "@/lib/reporting/actionPlanRules";
import { KILLED, dueSoon, isClosed, isLate, priorityLabel, stageOf, subLate, subPct, subSoon, subStage } from "@/lib/reporting/actionPlanRules";
import { SUMMIT } from "@/lib/reporting/summitRules";
import { LATE, PRIORITY_COLOR, SUMMARY, dayOf, dmy, isoOf, stageColor } from "./planUi";
import type { TrackChoice, TrackTarget } from "./KpiPicker";

export const ROW = 34;
const HEAD = 52;
export type Zoom = "week" | "month" | "quarter";
const PX: Record<Zoom, number> = { week: 6, month: 2.6, quarter: 1.1 };
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type GRow =
  | { key: string; type: "item"; item: PlanItem; depth: number; hasKids: boolean }
  | { key: string; type: "sub"; sub: PlanSub; parent: PlanItem; depth: number };

export type Where = "into" | "before" | "after" | "sub";

/** What the + beside a row makes, said on it. */
const ADD_TITLE: Record<PlanKind, string> = { goal: "Add a main category", topic: "Add an action or a sub-category in it", group: "Add an action in it", action: "Add a sub-action" };
/** The columns: the handle, the + and the eye, the name (sized to what is open), and - unless folded away - planned, go-live,
 *  status, %, who, and KPI tracking (SARCLA 04.11.2026: "another column, just a dropdown you can select from the column, yes
 *  or no"). */
const HANDLE = 66;
const DETAIL = [92, 92, 136, 104, 124, 112];
/** The narrowest each detail column may be: its heading on one line. */
const DETAIL_MIN = [84, 84, 96, 104, 100, 106];
const HEADS = ["", "Task name", "Planned", "Go-live", "Status", "% complete", "Assigned to", "KPI tracking"];

/** "#3b6fe0" at a given opacity, for the lighter bars of actions not done yet. */
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
/** A tag: square corners (SARCLA 01.11.2026: "tags not round, square"). */
const TAG = { flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px" } as const;
// the same things in the same place on every row, a column each (SARCLA 02.11.2026: "the design is not even"): the
// priority before the name, then on the right the Digital Growth tag and the sub-actions' count (a sub-action's KPI flag
// and its ticket in the same two places) - kept empty where a row has none
const PRIO_SLOT = { width: 54, flexShrink: 0, display: "flex" } as const;
const PRIO_TAG = { ...TAG, width: "100%", px: 0, textAlign: "center" } as const;
const MARK_SLOT = { width: 28, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center" } as const;
const COUNT_SLOT = { width: 72, flexShrink: 0, display: "flex", justifyContent: "flex-end", alignItems: "center" } as const;
/** The count's chip: one width for "0/1" and "12/18" alike, as tall as a tag (TAG). */
const COUNT_CHIP = { width: 66, height: 17, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", px: 0, borderRadius: "3px", fontSize: "0.7rem", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

/**
 * The width the names need, as the browser will draw them - so the table grows and shrinks with what is opened
 * and closed (SARCLA 01.11.2026: "the table should evolve depending on collapsible, not predefined").
 */
function useNameWidth(rows: GRow[], rolled: Map<number, Rolled>, today: string): number {
  return useMemo(() => {
    if (typeof document === "undefined") return 360;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return 360;
    const family = getComputedStyle(document.body).fontFamily || "Inter, sans-serif";
    const measure = (text: string, weight: number, size: number) => { ctx.font = `${weight} ${size}px ${family}`; return ctx.measureText(text).width; };
    let need = 260;
    for (const r of rows) {
      const indent = 6 + r.depth * 18 + 24;
      // the slots are there whether filled or not: the priority's, the mark's and the count's (PRIO_SLOT, MARK_SLOT, COUNT_SLOT)
      if (r.type === "sub") { need = Math.max(need, indent + 20 + 17 + 58 + measure(r.sub.title, 400, 13.4) + 28 + 72 + 16); continue; }
      const it = r.item, ro = rolled.get(it.id);
      // the goal's sentence is the page's headline: its row may cut it short rather than widen every row
      if (it.kind === "goal") continue;
      const [w, size] = it.kind === "topic" ? [800, 13.4] : it.kind === "group" ? [700, 13.8] : [500, 13.8];
      let chips = it.kind === "topic" ? 16 : 0;
      if (it.kind === "action") chips += 58 + 28 + 72;
      if (it.kind === "action" && ro?.lateSelf) chips += 40;
      if (it.kind !== "action" && (ro?.late ?? 0) > 0) chips += 52;
      need = Math.max(need, indent + chips + measure(it.title, w, size) + 16);
    }
    // never more than 40 % of the window, so the time line keeps room on a laptop
    return Math.round(Math.min(760, Math.max(360, window.innerWidth * 0.4), need));
  }, [rows, rolled, today]);
}

export function Gantt({ rows, rolled, today, zoom, canWrite, collapsed, toggle, selected, onOpen, onSubs, onOpenSub, onPatch, onTrack, canDrop, onDrop, height, colorOf, compact, onCompact, onAdd, onDuplicate, hidden, onHide, calendar = true, pick, flash = null }: {
  rows: GRow[]; rolled: Map<number, Rolled>; today: string; zoom: Zoom; canWrite: boolean;
  collapsed: Set<string>; toggle: (key: string) => void; selected: number | null;
  onOpen: (item: PlanItem) => void; onSubs: (item: PlanItem) => void;
  /** a sub-action's row or bar: its own window */
  onOpenSub: (id: number) => void;
  onPatch: (id: number, p: Partial<Pick<PlanItem, "start" | "due" | "percent" | "tracked">>) => Promise<void>;
  /** KPI tracking on an action's or a sub-action's row: off, or Yes - the plan asks which KPI (KpiPicker.tsx) */
  onTrack: (t: TrackTarget, c: TrackChoice) => void;
  canDrop: (drag: GRow, target: GRow, where: Where) => boolean;
  /** `copy`: Ctrl, Alt or Cmd held - a sub-action is copied there, not moved */
  onDrop: (drag: GRow, target: GRow, where: Where, copy: boolean) => Promise<void>;
  /** the most it takes; with fewer rows open it is as tall as they are. "fit": down to the bottom of the screen from where
   *  it starts - the plan scrolls in its own window and the page stays put (SARCLA 07.11.2026: "bloquer la fenêtre du plan
   *  d'action par rapport à la fenêtre globale - quand tu scrolles tout bouge, tu ne vois plus les titres") */
  height: number | string | "fit";
  /** a row to bring into sight and light up for a moment (after a drag and drop: where it went); n = a new request */
  flash?: { key: string; n: number } | null;
  /** a main category's colour, carried by everything under it (SARCLA 01.11.2026: "Gantt colours per project"); null for the goal */
  colorOf: (item: PlanItem) => string | null;
  /** planned, go-live, status, % and who folded away, the names alone */
  compact: boolean; onCompact: () => void;
  /** the + beside a row: the small window to make what goes under it */
  onAdd: (row: PlanItem) => void;
  /** in the +'s place on a sub-action's row: duplicate it onto another action, its ticket the same */
  onDuplicate?: (sub: PlanSub, parent: PlanItem) => void;
  /** the rows this viewer hid, drawn faded when they are shown again; the eye hides or shows one */
  hidden: Set<number>; onHide: (row: PlanItem, hide: boolean) => void;
  /** the time line beside the table; off where the table alone is wanted (a KPI's Actions page: the plan to pick from) */
  calendar?: boolean;
  /** a tick in the drag handle's place, on the rows that take one (a KPI's Actions page: the plan's rows to link to it) */
  pick?: { can: (r: GRow) => boolean; on: (r: GRow) => boolean; toggle: (r: GRow) => void; note?: (r: GRow) => string | undefined };
}) {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // the table takes the width its columns add up to: the name column sized to the open rows (until someone drags
  // it, and again after the next fold or unfold), the others as wide as the viewer last dragged them (SARCLA
  // 01.11.2026: "columns should also be resizable")
  const autoName = useNameWidth(rows, rolled, today);
  const [nameManual, setNameManual] = useState<number | null>(null);
  useEffect(() => { setNameManual(null); }, [rows.length, compact]);
  const [detailW, setDetailW] = useState<number[]>(DETAIL);
  useEffect(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem("actionPlan.cols") ?? "null");
      if (Array.isArray(v) && v.length === DETAIL.length && v.every((n) => typeof n === "number" && n >= 48 && n <= 400)) setDetailW(v.map((n: number, k: number) => Math.max(n, DETAIL_MIN[k])));
    } catch { /* the defaults */ }
  }, []);
  // without the calendar (a KPI's Actions page) the table is all there is, in a narrower room: the names give way to the
  // columns, cut short at the end with their whole name on hover
  // (with the columns folded away there, the names take the whole room)
  const nameW = nameManual ?? (calendar || compact ? autoName : Math.min(autoName, 430));
  const leftW = HANDLE + nameW + (compact ? 0 : detailW.reduce((s, w) => s + w, 0)) + 2;
  const COLS = compact ? `${HANDLE}px ${calendar ? `${nameW}px` : `minmax(${Math.min(nameW, 360)}px, 1fr)`}` : `${HANDLE}px ${nameW}px ${detailW.map((w) => `${w}px`).join(" ")}`;
  const GRID_MIN = !calendar && compact ? HANDLE + Math.min(nameW, 360) + 2 : leftW;
  /** Drag a column's right edge: 0 is the name, 1-6 planned, go-live, status, %, who and KPI tracking. */
  const startColResize = (e: React.PointerEvent, col: number) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = col === 0 ? nameW : detailW[col - 1];
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let last = detailW;
    const move = (ev: PointerEvent) => {
      const w = Math.round(col === 0 ? Math.max(200, Math.min(900, w0 + ev.clientX - x0)) : Math.max(DETAIL_MIN[col - 1], Math.min(400, w0 + ev.clientX - x0)));
      if (col === 0) setNameManual(w);
      else setDetailW((d) => { last = d.map((x, k) => (k === col - 1 ? w : x)); return last; });
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
      if (col > 0) { try { window.localStorage.setItem("actionPlan.cols", JSON.stringify(last)); } catch { /* the defaults next time */ } }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  // the time line: a month before the first date, and on to the end of the goal's year at least (SARCLA
  // 01.11.2026: "the calendar stops at 2028"), today always on it
  const span = useMemo(() => {
    const ds: number[] = [dayOf(today)];
    for (const r of rows) {
      if (r.type === "item") { const x = rolled.get(r.item.id); for (const d of [r.item.start, r.item.due, x?.from, x?.to]) if (d) ds.push(dayOf(d)); }
      if (r.type === "sub") for (const d of [r.sub.start, r.sub.due]) if (d) ds.push(dayOf(d));
    }
    const lo = new Date(Math.min(...ds) * 86_400_000), hi = new Date(Math.max(...ds) * 86_400_000);
    const start = Math.round(Date.UTC(lo.getUTCFullYear(), lo.getUTCMonth() - 1, 1) / 86_400_000);
    const end = Math.round(Date.UTC(hi.getUTCFullYear(), hi.getUTCMonth() + 3, 0) / 86_400_000);
    const goalEnd = Math.round(Date.UTC(SUMMIT.year, 11, 31) / 86_400_000);
    return { start, end: Math.max(end, goalEnd, start + 180) };
  }, [rows, rolled, today]);
  const px = PX[zoom];
  const X = (iso: string) => (dayOf(iso) - span.start) * px;
  const width = (span.end - span.start + 1) * px;

  // the two header bands and the lines under them
  const bands = useMemo(() => {
    const top: { x: number; w: number; label: string }[] = [];
    const low: { x: number; w: number; label: string }[] = [];
    const s = new Date(span.start * 86_400_000), endMs = (span.end + 1) * 86_400_000;
    const push = (arr: typeof top, a: number, b: number, label: string) => arr.push({ x: (a - span.start) * px, w: (b - a) * px, label });
    const dayN = (ms: number) => Math.round(ms / 86_400_000);
    // months (top for weeks; bottom for months)
    for (let y = s.getUTCFullYear(), m = s.getUTCMonth(); Date.UTC(y, m, 1) < endMs; m++) {
      const a = dayN(Date.UTC(y, m, 1)), b = dayN(Date.UTC(y, m + 1, 1));
      const d = new Date(Date.UTC(y, m, 1));
      if (zoom === "week") push(top, a, b, `${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
      if (zoom === "month") push(low, a, b, MONTH[d.getUTCMonth()]);
    }
    if (zoom !== "week") {
      for (let y = s.getUTCFullYear(); Date.UTC(y, 0, 1) < endMs; y++) push(top, Math.max(span.start, dayN(Date.UTC(y, 0, 1))), dayN(Date.UTC(y + 1, 0, 1)), String(y));
    }
    if (zoom === "quarter") {
      for (let y = s.getUTCFullYear(), q = Math.floor(s.getUTCMonth() / 3); Date.UTC(y, q * 3, 1) < endMs; q++) {
        const a = dayN(Date.UTC(y, q * 3, 1)), b = dayN(Date.UTC(y, q * 3 + 3, 1));
        push(low, a, b, `Q${(((q % 4) + 4) % 4) + 1}`);
      }
    }
    if (zoom === "week") {
      // Mondays
      let d = span.start;
      while (new Date(d * 86_400_000).getUTCDay() !== 1) d++;
      for (; d <= span.end; d += 7) push(low, d, d + 7, isoOf(d).slice(8, 10));
    }
    return { top: top.filter((b) => b.x + b.w > 0), low };
  }, [span, px, zoom]);

  // scroll together: the time line scrolls, the tree follows; a wheel over the tree moves the time line - and never the
  // page behind it (React's wheel listener is passive: it could not stop the page, which scrolled away with the plan's
  // titles - SARCLA 07.11.2026)
  const sync = () => { if (left.current && right.current) left.current.scrollTop = right.current.scrollTop; };
  useEffect(() => {
    const l = left.current;
    if (!l || !calendar) return;
    const onWheel = (e: WheelEvent) => {
      const r = right.current;
      if (!r || !r.offsetParent || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      r.scrollTop += e.deltaMode === 1 ? e.deltaY * ROW : e.deltaY;
    };
    l.addEventListener("wheel", onWheel, { passive: false });
    return () => l.removeEventListener("wheel", onWheel);
  }, [calendar]);
  // "fit": as tall as the screen below where the plan starts (the page's own scroller, the window or a box)
  const [fitPx, setFitPx] = useState<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (height !== "fit") return;
    const on = () => setTick((t) => t + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [height]);
  useLayoutEffect(() => {
    const b = box.current;
    if (height !== "fit" || !b) return;
    let sc: HTMLElement | null = b.parentElement;
    while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    const top = sc ? b.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop : b.getBoundingClientRect().top + window.scrollY;
    const view = sc ? sc.clientHeight : window.innerHeight;
    const px = Math.max(320, Math.round(view - top - 16));
    if (fitPx === null || Math.abs(px - fitPx) > 2) setFitPx(px);
  });
  // a row asked for: into sight in the plan's own window, lit for a moment
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const i = rows.findIndex((r) => r.key === flash.key);
    if (i < 0) return;
    const r = right.current && right.current.offsetParent ? right.current : left.current;
    if (r) r.scrollTop = Math.max(0, i * ROW - Math.max(0, r.clientHeight - HEAD) / 2);
    sync();
    setLit(flash.key);
    const h = setTimeout(() => setLit(null), 3500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.n]);
  // land on today the first time, and again on every change of scale (the old position means another date)
  const landed = useRef<Zoom | null>(null);
  useEffect(() => {
    if (landed.current === zoom || !right.current || !rows.length) return;
    landed.current = zoom;
    right.current.scrollLeft = Math.max(0, X(today) - 120);
  });

  const [drag, setDrag] = useState<GRow | null>(null);
  const [over, setOver] = useState<{ key: string; where: Where; copy: boolean } | null>(null);
  // onto a category: into it; onto an action an action becomes its sub-action, but on the row's top edge it goes before
  const whereFor = (r: GRow, e: React.DragEvent): Where => {
    // a sub-action: onto an action it moves under it, onto a category it becomes an action there (SARCLA 02.11.2026: "I
    // should be able to move a sub-action back into a main action if needed")
    // up or down among the sub-actions: above a sub-action on its top half, below it on the bottom half (03.11.2026)
    if (drag?.type === "sub" && r.type === "sub") {
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      return e.clientY - box.top > box.height / 2 ? "after" : "before";
    }
    if (drag?.type === "sub") return r.type === "item" && r.item.kind === "action" ? "sub" : "into";
    // a category onto one of its kind: on the row's top edge above it, else into it (a main category into another - a
    // third level, 07.11.2026)
    if (r.type === "item" && r.item.kind !== "action") {
      if (drag?.type === "item" && drag.item.kind === r.item.kind) {
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (e.clientY - box.top < box.height * 0.35) return "before";
      }
      return "into";
    }
    if (r.type === "item" && drag?.type === "item" && drag.item.kind === "action") {
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (e.clientY - box.top > box.height * 0.35) return "sub";
    }
    return "before";
  };

  // a bar being dragged: how far, and whether it moves or stretches
  const [bar, setBar] = useState<{ id: number; mode: "move" | "end" | "due"; dx: number } | null>(null);
  const startBarDrag = (e: React.PointerEvent, item: PlanItem, mode: "move" | "end" | "due") => {
    // read only: a press on a bar opens its row
    if (!canWrite) { onOpen(item); return; }
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let dx = 0;
    // a press that barely moves is a click: it opens the row and moves nothing (SARCLA 03.11.2026: "date on the plan
    // sometimes change, it's really weird" - at Months a day is 2.6 px, at Quarters 1.1 px, so a click's 2 px wobble
    // moved the bar a day or two and saved it); a drag starts beyond 6 px
    const SLOP = 6;
    const move = (ev: PointerEvent) => { dx = ev.clientX - x0; if (Math.abs(dx) >= SLOP) setBar({ id: item.id, mode, dx }); };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setBar(null);
      if (Math.abs(dx) < SLOP) { onOpen(item); return; }
      const days = Math.round(dx / px);
      if (!days) return;
      const sh = (d: string | null) => (d ? isoOf(dayOf(d) + days) : d);
      if (mode === "move") void onPatch(item.id, { start: sh(item.start), due: sh(item.due) });
      else if (mode === "due") void onPatch(item.id, { due: sh(item.due) });
      else if (item.due && item.start) {
        const due = isoOf(Math.max(dayOf(item.start), dayOf(item.due) + days));
        void onPatch(item.id, { due });
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  // the line between the halves widens or narrows the name column
  const startResize = (e: React.PointerEvent) => startColResize(e, 0);
  const heads = compact ? HEADS.slice(0, 2) : HEADS;

  const todayX = X(today);
  const bodyH = rows.length * ROW;
  // as tall as the open rows (and the scroll bar), up to the screen (SARCLA 01.11.2026: "the table should evolve
  // depending on the collapsible rows, not predefined")
  const most = height === "fit" ? `${fitPx ?? 320}px` : typeof height === "number" ? `${height}px` : height;
  const fitH = `min(${HEAD + Math.max(2, rows.length) * ROW + 20}px, ${most})`;

  return (
    <Box ref={box} sx={{ display: "flex", height: fitH, minHeight: HEAD + ROW * 2 + 20, border: `1px solid ${HAIRLINE}`, borderRadius: "16px", overflow: "hidden", bgcolor: "#fff" }}>
      {/* ── the tree ── */}
      <Box ref={left}
        sx={calendar ? { width: { xs: "100%", md: leftW }, flexShrink: 0, overflowX: "scroll", overflowY: { xs: "auto", md: "hidden" }, overscrollBehavior: "contain" } : { flex: 1, minWidth: 0, overflow: "auto", overscrollBehavior: "contain" }}>
        <Box sx={{ minWidth: GRID_MIN }}>
          <Box sx={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: COLS, height: HEAD, alignItems: "end", bgcolor: "#f7f9fc", borderBottom: `1px solid ${HAIRLINE}` }}>
            {heads.map((h, i) => (
              <Box key={i} sx={{ position: "relative", px: 1, pb: 0.75, borderLeft: i > 1 ? `1px solid ${HAIRLINE}` : "none", alignSelf: "stretch", display: "flex", alignItems: "flex-end", gap: 0.5, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 700, lineHeight: 1.2, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", flex: 1, minWidth: 0 }}>{h}</Typography>
                {/* fold the date, % and who columns away, or back */}
                {i === 1 && (
                  <Tooltip title={compact ? "Show planned, go-live, status, % complete, assigned to and KPI tracking" : "Fold away planned, go-live, status, % complete, assigned to and KPI tracking"}>
                    <Box component="button" type="button" onClick={onCompact} aria-label={compact ? "Show the columns" : "Fold the columns away"} aria-pressed={!compact}
                      sx={{ border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "3px", width: 22, height: 20, p: 0, display: "grid", placeItems: "center", cursor: "pointer", color: MUTED, mb: "-2px" }}>
                      {compact ? <KeyboardDoubleArrowRightIcon sx={{ fontSize: 15 }} /> : <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 15 }} />}
                    </Box>
                  </Tooltip>
                )}
                {/* drag the right edge to resize the column */}
                {i > 0 && <Box onPointerDown={(e: React.PointerEvent) => startColResize(e, i - 1)} role="separator" aria-orientation="vertical" aria-label={`Resize ${h}`}
                  sx={{ position: "absolute", right: -4, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 3, "&:hover": { bgcolor: "rgba(36,89,209,.18)" } }} />}
              </Box>
            ))}
          </Box>
          {rows.map((r) => (
            <TreeRow key={r.key} r={r} cols={COLS} compact={compact} onAdd={canWrite && r.type === "item" ? () => onAdd(r.item) : undefined}
              onDuplicate={canWrite && onDuplicate && r.type === "sub" && !r.sub.kpiTile ? () => onDuplicate(r.sub, r.parent) : undefined}
              hidden={r.type === "item" && hidden.has(r.item.id)} onHide={r.type === "item" && r.item.kind !== "goal" ? (h) => onHide(r.item, h) : undefined} color={r.type === "item" ? colorOf(r.item) : colorOf(r.parent)} rolled={rolled} today={today} canWrite={canWrite} folded={collapsed.has(r.key)} toggle={toggle}
              selected={(r.type === "item" && r.item.id === selected) || lit === r.key} onOpen={onOpen} onSubs={onSubs} onOpenSub={onOpenSub} onPatch={onPatch} onTrack={onTrack}
              dragging={drag?.key === r.key} over={over?.key === r.key ? over.where : null} copying={over?.key === r.key && over.copy}
              pick={pick && pick.can(r) ? { on: pick.on(r), toggle: () => pick.toggle(r), note: pick.note?.(r) } : undefined}
              draggable={!pick && canWrite && ((r.type === "item" && (r.item.kind === "action" || r.item.kind === "group" || r.item.kind === "topic")) || r.type === "sub")}
              onDragStart={() => setDrag(r)} onDragEnd={() => { setDrag(null); setOver(null); }}
              onDragOver={(e) => {
                if (!drag) return;
                const w = whereFor(r, e);
                if (!canDrop(drag, r, w)) { if (over?.key === r.key) setOver(null); return; }
                e.preventDefault();
                const copy = drag.type === "sub" && w === "sub" && (e.ctrlKey || e.altKey || e.metaKey);
                e.dataTransfer.dropEffect = copy ? "copy" : "move";
                if (over?.key !== r.key || over.where !== w || over.copy !== copy) setOver({ key: r.key, where: w, copy });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const d = drag, w = whereFor(r, e);
                setDrag(null); setOver(null);
                if (d && canDrop(d, r, w)) void onDrop(d, r, w, d.type === "sub" && w === "sub" && (e.ctrlKey || e.altKey || e.metaKey));
              }} />
          ))}
          {!rows.length && <Typography sx={{ p: 3, color: MUTED, fontSize: "0.9rem" }}>Nothing matches these filters.</Typography>}
        </Box>
      </Box>

      {/* the line between the halves, dragged to give one more room */}
      {calendar && <><Box onPointerDown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize the task list"
        sx={{ display: { xs: "none", md: "block" }, width: 6, flexShrink: 0, cursor: "col-resize", bgcolor: "#f1f4f9", borderLeft: `1px solid ${HAIRLINE}`, borderRight: `1px solid ${HAIRLINE}`, "&:hover": { bgcolor: TINT.blue.bg } }} />

      {/* ── the time line ── */}
      <Box ref={right} onScroll={sync} sx={{ display: { xs: "none", md: "block" }, flex: 1, minWidth: 0, overflow: "scroll", overscrollBehavior: "contain" }}>
        <Box sx={{ width, position: "relative" }}>
          <Box sx={{ position: "sticky", top: 0, zIndex: 2, height: HEAD, bgcolor: "#f7f9fc", borderBottom: `1px solid ${HAIRLINE}` }}>
            {bands.top.map((b) => (
              <Typography key={`t${b.x}`} sx={{ position: "absolute", left: Math.max(0, b.x), width: b.w, top: 0, height: 26, lineHeight: "26px", px: 1, fontSize: "0.76rem", fontWeight: 700, color: INK, borderLeft: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap", overflow: "hidden" }}>{b.label}</Typography>
            ))}
            {bands.low.map((b) => (
              <Typography key={`l${b.x}`} sx={{ position: "absolute", left: b.x, width: b.w, top: 26, height: 26, lineHeight: "26px", textAlign: "center", fontSize: "0.7rem", color: FAINT, borderLeft: `1px solid ${HAIRLINE}`, borderTop: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap", overflow: "hidden" }}>{b.w >= 18 ? b.label : ""}</Typography>
            ))}
          </Box>
          <Box sx={{ position: "relative", height: bodyH }}>
            {/* the columns' lines, the rows' lines, today */}
            {bands.low.map((b) => <Box key={`g${b.x}`} sx={{ position: "absolute", left: b.x, top: 0, bottom: 0, borderLeft: `1px solid rgba(21,34,58,.05)` }} />)}
            {bands.top.map((b) => <Box key={`G${b.x}`} sx={{ position: "absolute", left: b.x, top: 0, bottom: 0, borderLeft: `1px solid rgba(21,34,58,.11)` }} />)}
            {rows.map((r, i) => (
              <Box key={`r${r.key}`} sx={{ position: "absolute", left: 0, right: 0, top: i * ROW, height: ROW, borderBottom: "1px solid rgba(21,34,58,.05)", bgcolor: r.type === "item" && r.item.id === selected ? "rgba(36,89,209,.06)" : "transparent" }} />
            ))}
            <Box sx={{ position: "absolute", left: todayX + px / 2, top: 0, bottom: 0, width: 2, bgcolor: LATE, opacity: 0.55, zIndex: 1 }} />
            {rows.map((r, i) => {
              const cy = i * ROW + ROW / 2;
              if (r.type === "item" && r.item.kind !== "action") {
                const from = rolled.get(r.item.id)?.from;
                const to = rolled.get(r.item.id)?.to;
                if (!from || !to) return null;
                const x = X(from), w = Math.max(px, X(to) - x + px);
                const c = colorOf(r.item) ?? SUMMARY;
                return (
                  <Box key={`b${r.key}`} title={`${dmy(from)} – ${dmy(to)}`} sx={{ position: "absolute", left: x, top: cy - 4, width: w, height: 6, bgcolor: c, borderRadius: "1px", zIndex: 2,
                    "&::before, &::after": { content: '""', position: "absolute", top: 0, borderTop: `7px solid ${c}`, borderLeft: "4px solid transparent", borderRight: "4px solid transparent" },
                    "&::before": { left: -4, top: 4 }, "&::after": { right: -4, top: 4 } }} />
                );
              }
              if (r.type === "sub") {
                const at = r.sub.due ?? r.sub.start;
                if (!at) return null;
                // the project's colour: filled when done, a ring while open
                const c = colorOf(r.parent) ?? SUMMARY;
                const sb = r.sub;
                const done = sb.status === "done";
                const tipS = [sb.title, sb.start && sb.due ? `${dmy(sb.start)} – ${dmy(sb.due)}` : dmy(sb.due ?? sb.start), subStage(sb)?.label ?? "No status", subPct(sb) != null ? `${subPct(sb)} %` : ""].filter(Boolean).join(" · ");
                // a small action: a thinner bar from its planned to its go-live date, its done part solid
                if (sb.start && sb.due) {
                  const x = X(sb.start), w = Math.max(px * 2, X(sb.due) - x + px);
                  return (
                    <Tooltip key={`s${r.key}`} title={tipS} placement="top" disableInteractive>
                      <Box onClick={() => onOpenSub(sb.id)} sx={{ position: "absolute", left: x, top: cy - 5, width: w, height: 10, borderRadius: "3px", bgcolor: alpha(c, 0.18), border: `1.5px solid ${c}`, overflow: "hidden", cursor: "pointer", zIndex: 2 }}>
                        <Box sx={{ width: `${Math.max(0, Math.min(100, subPct(sb) ?? 0))}%`, height: "100%", bgcolor: c }} />
                      </Box>
                    </Tooltip>
                  );
                }
                return <Box key={`s${r.key}`} title={tipS} onClick={() => onOpenSub(sb.id)}
                  sx={{ position: "absolute", left: X(at) + px / 2 - 5, top: cy - 5, width: 10, height: 10, borderRadius: "2px", bgcolor: done ? c : sb.status === "doing" ? alpha(c, 0.45) : "#fff", border: `2px solid ${c}`, cursor: "pointer", zIndex: 2 }} />;
              }
              const it = r.item;
              const ro = rolled.get(it.id);
              // the project's colour, its done part solid; waiting or killed paler still
              const c = colorOf(it) ?? SUMMARY;
              const st = { bar: c, soft: alpha(c, it.stage === KILLED || it.state === "hold" ? 0.12 : 0.22) };
              const late = !!ro?.lateSelf;
              const dx = bar?.id === it.id ? bar.dx : 0;
              const tip = [it.title, it.start ? `${dmy(it.start)} – ${dmy(it.due)}` : it.due ? `due ${dmy(it.due)}` : "", ro?.percent != null ? `${ro.percent} %` : "", late ? "late" : ""].filter(Boolean).join(" · ");
              if (it.start && it.due) {
                const x = X(it.start), w = Math.max(px * 2, X(it.due) - x + px);
                const moveDx = bar?.id === it.id && bar.mode === "move" ? dx : 0;
                const endDx = bar?.id === it.id && bar.mode === "end" ? dx : 0;
                const pct = Math.max(0, Math.min(100, ro?.percent ?? 0));
                return (
                  <Tooltip key={`a${r.key}`} title={tip} placement="top" disableInteractive>
                    <Box onPointerDown={(e) => startBarDrag(e, it, "move")}
                      sx={{ position: "absolute", left: x + moveDx, top: cy - 8, width: Math.max(px * 2, w + endDx), height: 16, borderRadius: "5px", bgcolor: st.soft, overflow: "hidden", zIndex: 3,
                        border: `1.5px solid ${late ? LATE : st.bar}`, cursor: canWrite ? "grab" : "pointer", touchAction: "none" }}>
                      <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: st.bar }} />
                      {canWrite && <Box onPointerDown={(e) => startBarDrag(e, it, "end")} sx={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 7, cursor: "ew-resize" }} />}
                    </Box>
                  </Tooltip>
                );
              }
              if (it.due) {
                return (
                  <Tooltip key={`a${r.key}`} title={tip} placement="top" disableInteractive>
                    <Box onPointerDown={(e) => startBarDrag(e, it, "due")}
                      sx={{ position: "absolute", left: X(it.due) + px / 2 - 7 + dx, top: cy - 7, width: 14, height: 14, transform: "rotate(45deg)", borderRadius: "2px",
                        bgcolor: isClosed(it.stage) && it.stage !== KILLED ? st.bar : alpha(c, 0.4), border: `2px solid ${late ? LATE : "#fff"}`, boxShadow: `0 0 0 1px ${late ? LATE : st.bar}`, cursor: canWrite ? "grab" : "pointer", zIndex: 3, touchAction: "none" }} />
                  </Tooltip>
                );
              }
              if (ro?.from && ro.to) {
                // no date of its own, but its sub-actions have some
                const x = X(ro.from), w = Math.max(px, X(ro.to) - x + px);
                return <Box key={`a${r.key}`} title={tip} sx={{ position: "absolute", left: x, top: cy - 5, width: w, height: 10, borderRadius: "4px", border: `1.5px dashed ${st.bar}`, zIndex: 2 }} />;
              }
              return null;
            })}
          </Box>
        </Box>
      </Box></>}
    </Box>
  );
}

/* ── a row of the tree ─────────────────────────────────────────────────── */

function TreeRow({ r, cols, compact, color, onAdd, onDuplicate, hidden, onHide, rolled, today, canWrite, folded, toggle, selected, onOpen, onSubs, onOpenSub, onPatch, onTrack, dragging, over, copying, draggable, onDragStart, onDragEnd, onDragOver, onDrop, pick }: {
  r: GRow; cols: string; compact: boolean; color: string | null; onAdd?: () => void; onDuplicate?: () => void; hidden: boolean; onHide?: (hide: boolean) => void;
  pick?: { on: boolean; toggle: () => void; note?: string };
  rolled: Map<number, Rolled>; today: string; canWrite: boolean; folded: boolean; toggle: (key: string) => void; selected: boolean;
  onOpen: (item: PlanItem) => void; onSubs: (item: PlanItem) => void; onOpenSub: (id: number) => void;
  onPatch: (id: number, p: Partial<Pick<PlanItem, "start" | "due" | "percent" | "tracked">>) => Promise<void>;
  onTrack: (t: TrackTarget, c: TrackChoice) => void;
  dragging: boolean; over: Where | null; copying: boolean; draggable: boolean;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
}) {
  const cell = { px: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` } as const;
  const indent = 6 + r.depth * 18;
  const caret = (has: boolean) => (
    <Box component="button" type="button" aria-label={folded ? "Open" : "Close"} aria-expanded={!folded} onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (has) toggle(r.key); }}
      sx={{ width: 20, height: 20, mr: 0.25, p: 0, border: 0, bgcolor: "transparent", display: "grid", placeItems: "center", cursor: has ? "pointer" : "default", color: has ? MUTED : "transparent", flexShrink: 0 }}>
      <ChevronRightIcon sx={{ fontSize: 18, transform: folded ? "none" : "rotate(90deg)", transition: "transform .15s" }} />
    </Box>
  );
  const base = {
    display: "grid", gridTemplateColumns: cols, height: ROW, alignItems: "center", borderBottom: "1px solid rgba(21,34,58,.06)",
    bgcolor: selected || pick?.on ? "rgba(36,89,209,.06)" : over === "into" || over === "sub" ? TINT.blue.bg : "transparent", opacity: dragging ? 0.4 : hidden ? 0.5 : 1,
    boxShadow: over === "before" ? `inset 0 2px 0 ${TINT.blue.fg}` : over === "after" ? `inset 0 -2px 0 ${TINT.blue.fg}` : over === "sub" ? `inset 0 0 0 2px ${TINT.blue.fg}` : "none", position: "relative",
    // what the drop will do
    ...(over === "sub" ? { "&::after": { content: copying ? '"Drop: a copy goes under it"' : '"Drop: becomes its sub-action"', position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", px: 0.75, py: 0.2, borderRadius: "4px", bgcolor: TINT.blue.fg, color: "#fff", fontSize: "0.7rem", fontWeight: 800, pointerEvents: "none", zIndex: 2 } } : {}),
    "&:hover": { bgcolor: selected ? "rgba(36,89,209,.08)" : "rgba(21,34,58,.025)" }, "&:hover .add": { opacity: 1 },
  } as const;
  // the handle to drag the row, beside it the + for what goes under it and the eye that hides the row
  const small = { width: 20, height: 20, p: 0, border: `1px solid ${HAIRLINE}`, borderRadius: "4px", bgcolor: "#fff", color: MUTED, display: "grid", placeItems: "center", cursor: "pointer", transition: "opacity .15s", "&:hover, &:focus-visible": { opacity: 1, color: TINT.blue.fg, borderColor: TINT.blue.fg } } as const;
  const handle = (
    <Box sx={{ display: "grid", gridTemplateColumns: "22px 22px 22px", height: "100%", alignItems: "center" }}>
      {pick ? (
        <Box sx={{ display: "grid", placeItems: "center", height: "100%" }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Box component="input" type="checkbox" checked={pick.on} onChange={pick.toggle}
            aria-label={`${pick.on ? "Untick" : "Tick"} ${r.type === "sub" ? r.sub.title : r.item.title}`} title={pick.note}
            sx={{ width: 15, height: 15, m: 0, cursor: "pointer", accentColor: TINT.blue.fg }} />
        </Box>
      ) : draggable ? (
        <Box draggable onDragStart={(e: React.DragEvent) => { e.dataTransfer.effectAllowed = r.type === "sub" ? "copyMove" : "move"; e.dataTransfer.setData("text/plain", r.key); onDragStart(); }} onDragEnd={onDragEnd}
          title={r.type === "sub" ? (r.sub.kpiTile ? "Drag up or down among its action's sub-actions" : "Drag up or down among the sub-actions, onto another action to move it there (Ctrl held: a copy), onto a category to make it an action again") : "Drag onto another main category or sub-category"} sx={{ display: "grid", placeItems: "center", color: FAINT, cursor: "grab", height: "100%" }}>
          <DragIndicatorIcon sx={{ fontSize: 17 }} />
        </Box>
      ) : <Box />}
      {onAdd && r.type === "item" ? (
        <Box component="button" type="button" className="add" aria-label={ADD_TITLE[r.item.kind]} title={ADD_TITLE[r.item.kind]}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAdd(); }} sx={{ ...small, opacity: 0.45 }}>
          <AddIcon sx={{ fontSize: 15 }} />
        </Box>
      ) : onDuplicate ? (
        // a sub-action's row: duplicate it onto another action, the same ticket (SARCLA 02.11.2026: "the duplicate should
        // also be an icon next to the plus")
        <Box component="button" type="button" className="add" aria-label="Duplicate onto another action" title="Duplicate onto another action - the same ticket goes with it"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDuplicate(); }} sx={{ ...small, opacity: 0.45 }}>
          <ContentCopyOutlinedIcon sx={{ fontSize: 13 }} />
        </Box>
      ) : <Box />}
      {onHide ? (
        <Box component="button" type="button" className="add" aria-label={hidden ? "Show this row again" : "Hide this row"} title={hidden ? "Show this row again" : "Hide this row - Hidden rows brings it back"}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onHide(!hidden); }} sx={{ ...small, opacity: hidden ? 1 : 0.45 }}>
          {hidden ? <VisibilityOutlinedIcon sx={{ fontSize: 14 }} /> : <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />}
        </Box>
      ) : <Box />}
    </Box>
  );

  if (r.type === "sub") {
    const s = r.sub;
    const c = color ?? SUMMARY;
    const late = subLate(s, today);
    // planned within a week: the reason its action is "Due within a week", in amber
    const soon = !late && subSoon(s, today);
    // its status in the actions' words (SARCLA 02.11.2026: "the status should stay the same even on sub-actions")
    const sStage = subStage(s);
    const sPrio = priorityLabel(s.priority);
    const sPct = subPct(s);
    return (
      <Box sx={{ ...base, cursor: "pointer" }} onClick={() => onOpenSub(s.id)} onDragOver={onDragOver} onDrop={onDrop}>
        {handle}
        <Box sx={{ ...cell, borderLeft: "none", pl: `${indent + 20}px`, gap: 0.75 }}>
          <Box sx={PRIO_SLOT}>{sPrio && <Box sx={{ ...PRIO_TAG, bgcolor: PRIORITY_COLOR[s.priority].bg, color: PRIORITY_COLOR[s.priority].fg }}>{sPrio}</Box>}</Box>
          <Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: s.status === "done" ? c : s.status === "doing" ? alpha(c, 0.45) : "#fff", border: `1.5px solid ${c}`, flexShrink: 0 }} />
          <Typography noWrap title={s.title} sx={{ fontSize: "0.84rem", color: MUTED, minWidth: 0, textDecoration: s.status === "done" ? "line-through" : "none" }}>{s.title}</Typography>
          <Box sx={{ flex: 1 }} />
          <Box sx={MARK_SLOT}>{s.kpiTile && <Tooltip title="Made on a KPI tile"><FlagOutlinedIcon sx={{ fontSize: 15, color: TINT.blue.fg }} /></Tooltip>}</Box>
          <Box sx={COUNT_SLOT}>
            {s.tickets > 0 && <Tooltip title={`${s.tickets} Scroll to Sale ticket${s.tickets === 1 ? "" : "s"}`}><Box sx={{ ...COUNT_CHIP, color: TINT.amber.fg }}><ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />{s.tickets}</Box></Tooltip>}
          </Box>
        </Box>
        {!compact && <>
          <Box sx={cell}><Typography title={soon ? "Due within a week" : undefined} sx={{ fontSize: "0.8rem", color: late ? LATE : soon ? TINT.amber.fg : MUTED, fontWeight: late || soon ? 700 : 400 }}>{dmy(s.start)}</Typography></Box>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{dmy(s.due)}</Typography></Box>
          <Box sx={cell}>
            {sStage ? <Box sx={{ ...TAG, bgcolor: stageColor(sStage.id).soft, color: stageColor(sStage.id).ink }}>{sStage.label}</Box>
              : <Typography sx={{ fontSize: "0.78rem", color: FAINT, fontStyle: "italic" }}>No status</Typography>}
          </Box>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{sPct == null ? "—" : `${sPct} %`}</Typography></Box>
          <Box sx={cell}><Typography noWrap sx={{ fontSize: "0.8rem", color: MUTED }}>{s.ownerName}</Typography></Box>
          {/* its own KPI tracking - not its action's (SARCLA 04.11.2026) */}
          <TrackCell tracked={!!s.tracked} title={s.trackKpiTitle ?? ""} canWrite={canWrite}
            onChoose={(c) => onTrack({ kind: "sub", id: s.id, title: s.title, tracked: !!s.tracked, kpi: s.trackKpi ?? "" }, c)} />
        </>}
      </Box>
    );
  }

  const it = r.item;
  const ro = rolled.get(it.id);
  const summary = it.kind !== "action";
  const late = !!ro?.lateSelf;
  const fromSubs = it.kind === "action" && (ro?.subs ?? 0) > 0 && !isClosed(it.stage) && it.percent !== 100;
  const prio = it.kind === "action" ? priorityLabel(it.priority) : "";
  const stage = stageOf(it.stage);
  const name = it.kind === "goal"
    ? { fontSize: "0.9rem", fontWeight: 800, color: INK }
    : it.kind === "topic" ? { fontSize: "0.84rem", fontWeight: 800, color: INK, letterSpacing: "0.01em" }
      : it.kind === "group" ? { fontSize: "0.86rem", fontWeight: 700, color: INK }
        : { fontSize: "0.86rem", fontWeight: 500, color: INK };
  return (
    <Box sx={{ ...base, cursor: "pointer" }} onClick={() => onOpen(it)} onDragOver={onDragOver} onDrop={onDrop}>
      {handle}
      <Box sx={{ ...cell, borderLeft: "none", pl: `${indent}px`, gap: 0.5 }}>
        {caret(r.hasKids)}
        {/* the project's colour, as its bars carry it */}
        {it.kind === "topic" && color && <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: color, flexShrink: 0, mr: 0.25 }} />}
        {/* HubSpot's priority (SARCLA 01.11.2026: "priority as HubSpot's Low / Medium / High / Urgent") */}
        {it.kind === "action" && <Box sx={PRIO_SLOT}>{prio && <Box sx={{ ...PRIO_TAG, bgcolor: PRIORITY_COLOR[it.priority].bg, color: PRIORITY_COLOR[it.priority].fg }}>{prio}</Box>}</Box>}
        <Tooltip title={it.detail && it.detail !== it.title ? <Box sx={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: 320, overflow: "hidden" }}>{it.detail}</Box> : ""} placement="bottom-start" enterDelay={600} disableInteractive>
          <Typography noWrap title={it.title} sx={{ ...name, minWidth: 0, ...(it.stage === KILLED ? { textDecoration: "line-through", color: FAINT } : {}) }}>{it.title}</Typography>
        </Tooltip>
        {late && <Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>LATE</Box>}
        {summary && (ro?.late ?? 0) > 0 && <Tooltip title={`${ro!.late} action${ro!.late === 1 ? "" : "s"} past the planned date and not live`}><Box sx={{ ...TAG, bgcolor: "#fde7e7", color: LATE }}>{ro!.late} late</Box></Tooltip>}
        <Box sx={{ flex: 1 }} />
        {it.kind === "action" && <>
          <Box sx={MARK_SLOT}>{it.dg && <Tooltip title="Led by Digital Growth - its sub-actions can take a Scroll to Sale ticket"><Box sx={{ ...TAG, bgcolor: TINT.blue.bg, color: TINT.blue.fg }}>DG</Box></Tooltip>}</Box>
          {/* how many of its sub-actions are done - a count, not a second + (the + on the left adds one) */}
          <Box sx={COUNT_SLOT}>
            {(ro?.subs ?? 0) > 0 && (
              <Tooltip title={`${ro!.subs - ro!.subsOpen} of ${ro!.subs} sub-action${ro!.subs === 1 ? "" : "s"} done - open them`}>
                <Box component="button" type="button" aria-label="Sub-actions" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSubs(it); }}
                  sx={{ font: "inherit", ...COUNT_CHIP, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", cursor: "pointer", color: MUTED }}>
                  <TaskAltIcon sx={{ fontSize: 13 }} />{`${ro!.subs - ro!.subsOpen}/${ro!.subs}`}
                </Box>
              </Tooltip>
            )}
          </Box>
        </>}
      </Box>
      {compact ? null : summary ? (
        <>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(ro?.from ?? null)}</Typography></Box>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(ro?.to ?? null)}</Typography></Box>
          <Box sx={cell} />
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT, fontWeight: 600 }}>{ro?.percent == null ? "" : `${ro.percent} %`}</Typography></Box>
          <Box sx={cell} />
          <Box sx={cell} />
        </>
      ) : (
        <>
          {/* a main action's dates are its sub-actions' first to last (SARCLA 02.11.2026: "go-live and planned date do not go as planned") */}
          <DateCell value={it.start} late={late} soon={!late && !ro?.startFromSubs && !ro?.dueFromSubs && dueSoon(it, [], today)} canWrite={canWrite && !ro?.startFromSubs} max={it.due} fromSubs={ro?.startFromSubs} onSave={(v) => onPatch(it.id, { start: v })} />
          <DateCell value={it.due} note={it.dueNote} canWrite={canWrite && !ro?.dueFromSubs} min={it.start} fromSubs={ro?.dueFromSubs} onSave={(v) => onPatch(it.id, { due: v })} />
          {/* the pipeline's stage, as a square tag in its colour */}
          <Box sx={cell}>
            {stage
              ? <Box title={stage.label} sx={{ ...TAG, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", bgcolor: stageColor(stage.id).soft, color: stageColor(stage.id).ink }}>{stage.label}</Box>
              : <Typography sx={{ fontSize: "0.78rem", color: FAINT, fontStyle: "italic" }}>No status</Typography>}
          </Box>
          {fromSubs
            ? <Box sx={cell}><Tooltip title="From its sub-actions"><Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>{ro?.percent ?? 0} %</Typography></Tooltip></Box>
            : <PercentCell value={it.percent} canWrite={canWrite} onSave={(v) => onPatch(it.id, { percent: v })} />}
          {/* people; while nobody is given it, the workbook's words in grey - a click opens the row to pick someone */}
          <Box sx={cell}>
            {it.owners.length
              ? <Typography noWrap title={it.owners.map((o) => o.name).join(", ")} sx={{ fontSize: "0.8rem", color: INK }}>{it.owners.map((o) => o.name).join(", ")}</Typography>
              : <Typography noWrap title={it.responsible ? `Not assigned yet - the workbook says "${it.responsible}"` : "Not assigned yet"} sx={{ fontSize: "0.78rem", color: FAINT, fontStyle: "italic" }}>{it.responsible || "Not assigned"}</Typography>}
          </Box>
          <TrackCell tracked={!!it.tracked} title={it.trackKpiTitle ?? ""} canWrite={canWrite}
            onChoose={(c) => onTrack({ kind: "item", id: it.id, title: it.title, tracked: !!it.tracked, kpi: it.trackKpi ?? "" }, c)} />
        </>
      )}
    </Box>
  );
}

/**
 * KPI tracking, Yes or No - a dropdown in its cell; Yes asks which KPI (SARCLA 04.11.2026: "if put yes, a pop-up to select
 * the KPI"), and once tracked it says which, with another one to pick.
 */
function TrackCell({ tracked, title, canWrite, onChoose }: { tracked: boolean; title: string; canWrite: boolean; onChoose: (c: TrackChoice) => void }) {
  const cell = { px: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` } as const;
  const tone = tracked ? { color: GREEN, bgcolor: "rgba(27,122,85,.1)", borderColor: GREEN } : { color: MUTED, bgcolor: "#fff", borderColor: HAIRLINE };
  return (
    <Box sx={cell} onClick={(e) => e.stopPropagation()}>
      <Box component="select" aria-label="KPI tracking" value={tracked ? "yes" : "no"} disabled={!canWrite} title={tracked && title ? `Tracks “${title}”` : undefined}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const v = e.target.value; if (v === "no") { if (tracked) onChoose("no"); } else onChoose("pick"); }}
        sx={{ ...tone, width: "100%", minWidth: 0, textOverflow: "ellipsis", font: "inherit", fontSize: "0.78rem", fontWeight: 700, border: "1px solid", borderRadius: "4px", px: 0.5, py: 0.25, cursor: canWrite ? "pointer" : "default", "&:disabled": { opacity: 1 } }}>
        <option value="no">No</option>
        <option value="yes">{tracked ? (title ? `Yes · ${title}` : "Yes") : "Yes"}</option>
        {tracked && <option value="pick">Another KPI…</option>}
      </Box>
    </Box>
  );
}

/** A date typed in its cell, as in Planner's grid. */
function DateCell({ value, note, late, soon, canWrite, min, max, fromSubs, onSave }: {
  value: string | null; note?: string; late?: boolean;
  /** due within a week on its own date - amber */
  soon?: boolean;
  canWrite: boolean; min?: string | null; max?: string | null; fromSubs?: boolean; onSave: (v: string | null) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const cell = { px: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` } as const;
  if (edit) {
    return (
      <Box sx={cell} onClick={(e) => e.stopPropagation()}>
        <Box component="input" type="date" autoFocus defaultValue={value ?? ""} min={min ?? undefined} max={max ?? undefined}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => { setEdit(false); const v = e.target.value || null; if (v !== value) void onSave(v); }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(false); }}
          sx={{ width: "100%", font: "inherit", fontSize: "0.78rem", border: `1px solid ${TINT.blue.fg}`, borderRadius: "6px", px: 0.5, py: 0.25 }} />
      </Box>
    );
  }
  return (
    <Box sx={{ ...cell, cursor: canWrite ? "text" : "inherit" }} onClick={(e) => { if (!canWrite) return; e.stopPropagation(); setEdit(true); }}>
      {value
        ? <Typography title={fromSubs ? "From its sub-actions" : soon ? "Due within a week" : undefined} sx={{ fontSize: "0.8rem", color: late ? LATE : soon ? TINT.amber.fg : INK, fontWeight: late || soon ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>{dmy(value)}</Typography>
        : <Typography noWrap title={note || undefined} sx={{ fontSize: "0.78rem", color: FAINT, fontStyle: note ? "italic" : "normal" }}>{note || ""}</Typography>}
    </Box>
  );
}

function PercentCell({ value, canWrite, onSave }: { value: number | null; canWrite: boolean; onSave: (v: number | null) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const cell = { px: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` } as const;
  if (edit) {
    return (
      <Box sx={cell} onClick={(e) => e.stopPropagation()}>
        <Box component="input" type="number" min={0} max={100} step={5} autoFocus defaultValue={value ?? ""}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            setEdit(false);
            const s = e.target.value.trim();
            const v = s === "" ? null : Math.max(0, Math.min(100, Math.round(Number(s))));
            if (v !== value && (v == null || Number.isFinite(v))) void onSave(v);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(false); }}
          sx={{ width: "100%", font: "inherit", fontSize: "0.8rem", border: `1px solid ${TINT.blue.fg}`, borderRadius: "6px", px: 0.5, py: 0.25 }} />
      </Box>
    );
  }
  return (
    <Box sx={{ ...cell, cursor: canWrite ? "text" : "inherit" }} onClick={(e) => { if (!canWrite) return; e.stopPropagation(); setEdit(true); }}>
      <Typography sx={{ fontSize: "0.8rem", color: value == null ? FAINT : INK, fontVariantNumeric: "tabular-nums" }}>{value == null ? "" : `${value} %`}</Typography>
    </Box>
  );
}
