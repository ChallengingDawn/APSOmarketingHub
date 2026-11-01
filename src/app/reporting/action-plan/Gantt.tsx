"use client";
// THE GANTT (SARCLA 31.10.2026: "I need to create a Gantt here like I showed you in the photo" - Planner's
// Gantt chart). Left, the tree: task name, start, due, % complete, assigned to - dates and % typed in the
// cell. Right, the time line: a dark bracket over a topic or group from its first to its last date, a bar
// for an action with a start and a due (its done part filled), a diamond for one with only a due, a dot
// per sub-action. Rows are dragged by their handle onto another topic or group; bars are dragged to move
// their dates, or by their right end to change the due. The two halves scroll together.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddIcon from "@mui/icons-material/Add";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";

import { FAINT, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import type { PlanItem, PlanSub, Rolled } from "@/lib/reporting/actionPlanRules";
import { isLate } from "@/lib/reporting/actionPlanRules";
import { LATE, STATE_COLOR, SUB_COLOR, SUMMARY, dayOf, dmy, isoOf } from "./planUi";

export const ROW = 34;
const HEAD = 52;
export type Zoom = "week" | "month" | "quarter";
const PX: Record<Zoom, number> = { week: 6, month: 2.6, quarter: 1.1 };
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type GRow =
  | { key: string; type: "item"; item: PlanItem; depth: number; hasKids: boolean }
  | { key: string; type: "sub"; sub: PlanSub; parent: PlanItem; depth: number }
  /** a "Main topic" heading when the plan is grouped that way - a value, not a row of the plan */
  | { key: string; type: "bucket"; label: string; value: string; depth: number; hasKids: boolean; from: string | null; to: string | null; percent: number | null; count: number };

export type Where = "into" | "before";

const COLS = "22px minmax(300px, 1fr) 88px 88px 84px 124px";
const GRID_MIN = 22 + 300 + 88 + 88 + 84 + 124;

export function Gantt({ rows, rolled, today, zoom, canWrite, collapsed, toggle, selected, onOpen, onSubs, onPatch, canDrop, onDrop, height }: {
  rows: GRow[]; rolled: Map<number, Rolled>; today: string; zoom: Zoom; canWrite: boolean;
  collapsed: Set<string>; toggle: (key: string) => void; selected: number | null;
  onOpen: (item: PlanItem) => void; onSubs: (item: PlanItem) => void;
  onPatch: (id: number, p: Partial<Pick<PlanItem, "start" | "due" | "percent">>) => Promise<void>;
  canDrop: (drag: GRow, target: GRow, where: Where) => boolean;
  onDrop: (drag: GRow, target: GRow, where: Where) => Promise<void>;
  height: number | string;
}) {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  // the names want the room, the time line too: the task list starts at about three fifths of the width, and
  // the line between the halves moves (kept per viewer)
  const box = useRef<HTMLDivElement>(null);
  const [leftW, setLeftW] = useState(760);
  useEffect(() => {
    let saved = 0;
    try { saved = Number(window.localStorage.getItem("actionPlan.leftW")); } catch { /* default */ }
    if (saved >= 360 && saved <= 1400) setLeftW(saved);
    else if (box.current) setLeftW(Math.round(Math.max(640, Math.min(980, box.current.clientWidth * 0.62))));
  }, []);

  // the time line: a month before the first date to two after the last, today always on it
  const span = useMemo(() => {
    const ds: number[] = [dayOf(today)];
    for (const r of rows) {
      if (r.type === "item") { const x = rolled.get(r.item.id); for (const d of [r.item.start, r.item.due, x?.from, x?.to]) if (d) ds.push(dayOf(d)); }
      if (r.type === "sub" && r.sub.due) ds.push(dayOf(r.sub.due));
      if (r.type === "bucket") for (const d of [r.from, r.to]) if (d) ds.push(dayOf(d));
    }
    const lo = new Date(Math.min(...ds) * 86_400_000), hi = new Date(Math.max(...ds) * 86_400_000);
    const start = Math.round(Date.UTC(lo.getUTCFullYear(), lo.getUTCMonth() - 1, 1) / 86_400_000);
    const end = Math.round(Date.UTC(hi.getUTCFullYear(), hi.getUTCMonth() + 3, 0) / 86_400_000);
    return { start, end: Math.max(end, start + 180) };
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

  // scroll together: the time line scrolls, the tree follows; a wheel over the tree moves the time line
  const sync = () => { if (left.current && right.current) left.current.scrollTop = right.current.scrollTop; };
  const wheel = (e: React.WheelEvent) => { if (right.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) right.current.scrollTop += e.deltaY; };
  // land on today the first time, and again on every change of scale (the old position means another date)
  const landed = useRef<Zoom | null>(null);
  useEffect(() => {
    if (landed.current === zoom || !right.current || !rows.length) return;
    landed.current = zoom;
    right.current.scrollLeft = Math.max(0, X(today) - 120);
  });

  const [drag, setDrag] = useState<GRow | null>(null);
  const [over, setOver] = useState<{ key: string; where: Where } | null>(null);
  const whereFor = (r: GRow): Where => (r.type === "bucket" || (r.type === "item" && r.item.kind !== "action") ? "into" : "before");

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
    const move = (ev: PointerEvent) => { dx = ev.clientX - x0; setBar({ id: item.id, mode, dx }); };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setBar(null);
      const days = Math.round(dx / px);
      if (!days) { if (Math.abs(dx) < 3) onOpen(item); return; }
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

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = leftW;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let w = w0;
    const move = (ev: PointerEvent) => { w = Math.max(360, Math.min(1400, w0 + ev.clientX - x0)); setLeftW(w); };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
      try { window.localStorage.setItem("actionPlan.leftW", String(w)); } catch { /* default next time */ }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const todayX = X(today);
  const bodyH = rows.length * ROW;

  return (
    <Box ref={box} sx={{ display: "flex", height, minHeight: 320, border: `1px solid ${HAIRLINE}`, borderRadius: "16px", overflow: "hidden", bgcolor: "#fff" }}>
      {/* ── the tree ── */}
      <Box ref={left} onWheel={wheel}
        sx={{ width: { xs: "100%", md: leftW }, flexShrink: 0, overflowX: "scroll", overflowY: { xs: "auto", md: "hidden" } }}>
        <Box sx={{ minWidth: GRID_MIN }}>
          <Box sx={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: COLS, height: HEAD, alignItems: "end", bgcolor: "#f7f9fc", borderBottom: `1px solid ${HAIRLINE}` }}>
            {["", "Task name", "Start", "Due", "% complete", "Assigned to"].map((h, i) => (
              <Typography key={i} sx={{ px: 1, pb: 0.75, fontSize: "0.7rem", fontWeight: 700, lineHeight: 1.2, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", borderLeft: i > 1 ? `1px solid ${HAIRLINE}` : "none", alignSelf: "stretch", display: "flex", alignItems: "flex-end" }}>{h}</Typography>
            ))}
          </Box>
          {rows.map((r) => (
            <TreeRow key={r.key} r={r} rolled={rolled} today={today} canWrite={canWrite} folded={collapsed.has(r.key)} toggle={toggle}
              selected={r.type === "item" && r.item.id === selected} onOpen={onOpen} onSubs={onSubs} onPatch={onPatch}
              dragging={drag?.key === r.key} over={over?.key === r.key ? over.where : null}
              draggable={canWrite && ((r.type === "item" && (r.item.kind === "action" || r.item.kind === "group")))}
              onDragStart={() => setDrag(r)} onDragEnd={() => { setDrag(null); setOver(null); }}
              onDragOver={(e) => {
                if (!drag) return;
                const w = whereFor(r);
                if (!canDrop(drag, r, w)) { if (over?.key === r.key) setOver(null); return; }
                e.preventDefault();
                if (over?.key !== r.key || over.where !== w) setOver({ key: r.key, where: w });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const d = drag, w = whereFor(r);
                setDrag(null); setOver(null);
                if (d && canDrop(d, r, w)) void onDrop(d, r, w);
              }} />
          ))}
          {!rows.length && <Typography sx={{ p: 3, color: MUTED, fontSize: "0.9rem" }}>Nothing matches these filters.</Typography>}
        </Box>
      </Box>

      {/* the line between the halves, dragged to give one more room */}
      <Box onPointerDown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize the task list"
        sx={{ display: { xs: "none", md: "block" }, width: 6, flexShrink: 0, cursor: "col-resize", bgcolor: "#f1f4f9", borderLeft: `1px solid ${HAIRLINE}`, borderRight: `1px solid ${HAIRLINE}`, "&:hover": { bgcolor: TINT.blue.bg } }} />

      {/* ── the time line ── */}
      <Box ref={right} onScroll={sync} sx={{ display: { xs: "none", md: "block" }, flex: 1, minWidth: 0, overflow: "scroll" }}>
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
              if (r.type === "bucket" || (r.type === "item" && r.item.kind !== "action")) {
                const from = r.type === "bucket" ? r.from : rolled.get(r.item.id)?.from;
                const to = r.type === "bucket" ? r.to : rolled.get(r.item.id)?.to;
                if (!from || !to) return null;
                const x = X(from), w = Math.max(px, X(to) - x + px);
                return (
                  <Box key={`b${r.key}`} title={`${dmy(from)} – ${dmy(to)}`} sx={{ position: "absolute", left: x, top: cy - 4, width: w, height: 6, bgcolor: SUMMARY, borderRadius: "1px", zIndex: 2,
                    "&::before, &::after": { content: '""', position: "absolute", top: 0, borderTop: `7px solid ${SUMMARY}`, borderLeft: "4px solid transparent", borderRight: "4px solid transparent" },
                    "&::before": { left: -4, top: 4 }, "&::after": { right: -4, top: 4 } }} />
                );
              }
              if (r.type === "sub") {
                if (!r.sub.due) return null;
                const c = SUB_COLOR[r.sub.status];
                return <Box key={`s${r.key}`} title={`${r.sub.title} · ${dmy(r.sub.due)}`} onClick={() => onSubs(r.parent)}
                  sx={{ position: "absolute", left: X(r.sub.due) + px / 2 - 5, top: cy - 5, width: 10, height: 10, borderRadius: "50%", bgcolor: c.bar, border: "2px solid #fff", boxShadow: `0 0 0 1px ${c.bar}`, cursor: "pointer", zIndex: 2 }} />;
              }
              const it = r.item;
              const ro = rolled.get(it.id);
              const st = STATE_COLOR[it.state ?? "none"];
              const late = isLate(it, today);
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
                        bgcolor: st.bar, border: `2px solid ${late ? LATE : "#fff"}`, boxShadow: `0 0 0 1px ${late ? LATE : st.bar}`, cursor: canWrite ? "grab" : "pointer", zIndex: 3, touchAction: "none" }} />
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
      </Box>
    </Box>
  );
}

/* ── a row of the tree ─────────────────────────────────────────────────── */

function TreeRow({ r, rolled, today, canWrite, folded, toggle, selected, onOpen, onSubs, onPatch, dragging, over, draggable, onDragStart, onDragEnd, onDragOver, onDrop }: {
  r: GRow; rolled: Map<number, Rolled>; today: string; canWrite: boolean; folded: boolean; toggle: (key: string) => void; selected: boolean;
  onOpen: (item: PlanItem) => void; onSubs: (item: PlanItem) => void;
  onPatch: (id: number, p: Partial<Pick<PlanItem, "start" | "due" | "percent">>) => Promise<void>;
  dragging: boolean; over: Where | null; draggable: boolean;
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
    display: "grid", gridTemplateColumns: COLS, height: ROW, alignItems: "center", borderBottom: "1px solid rgba(21,34,58,.06)",
    bgcolor: selected ? "rgba(36,89,209,.06)" : over === "into" ? TINT.blue.bg : "transparent", opacity: dragging ? 0.4 : 1,
    boxShadow: over === "before" ? `inset 0 2px 0 ${TINT.blue.fg}` : "none", position: "relative",
    "&:hover": { bgcolor: selected ? "rgba(36,89,209,.08)" : "rgba(21,34,58,.025)" }, "&:hover .add": { opacity: 1 },
  } as const;
  const handle = draggable ? (
    <Box draggable onDragStart={(e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.key); onDragStart(); }} onDragEnd={onDragEnd}
      title="Drag onto another topic or group" sx={{ display: "grid", placeItems: "center", color: FAINT, cursor: "grab", height: "100%" }}>
      <DragIndicatorIcon sx={{ fontSize: 17 }} />
    </Box>
  ) : <Box />;

  if (r.type === "bucket") {
    return (
      <Box sx={base} onDragOver={onDragOver} onDrop={onDrop}>
        <Box />
        <Box sx={{ ...cell, borderLeft: "none", pl: `${indent}px` }}>
          {caret(r.hasKids)}
          <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 750, color: INK }}>{r.label}</Typography>
          <Typography sx={{ ml: 1, fontSize: "0.74rem", color: FAINT, flexShrink: 0 }}>{r.count}</Typography>
        </Box>
        <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(r.from)}</Typography></Box>
        <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(r.to)}</Typography></Box>
        <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{r.percent == null ? "" : `${r.percent} %`}</Typography></Box>
        <Box sx={cell} />
      </Box>
    );
  }

  if (r.type === "sub") {
    const s = r.sub;
    const c = SUB_COLOR[s.status];
    const late = s.status !== "done" && !!s.due && s.due < today;
    return (
      <Box sx={{ ...base, cursor: "pointer" }} onClick={() => onSubs(r.parent)}>
        <Box />
        <Box sx={{ ...cell, borderLeft: "none", pl: `${indent + 20}px`, gap: 0.75 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: c.bar, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: "0.84rem", color: MUTED, textDecoration: s.status === "done" ? "line-through" : "none" }}>{s.title}</Typography>
          {s.kpiTile && <Tooltip title="Made on a KPI tile"><FlagOutlinedIcon sx={{ fontSize: 15, color: TINT.blue.fg, flexShrink: 0 }} /></Tooltip>}
          {s.tickets > 0 && <Tooltip title={`${s.tickets} Scroll to Sale ticket${s.tickets === 1 ? "" : "s"}`}><Box sx={{ display: "flex", alignItems: "center", gap: 0.25, color: TINT.amber.fg, flexShrink: 0 }}><ConfirmationNumberOutlinedIcon sx={{ fontSize: 15 }} /><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{s.tickets}</Typography></Box></Tooltip>}
        </Box>
        <Box sx={cell} />
        <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: late ? LATE : MUTED, fontWeight: late ? 700 : 400 }}>{dmy(s.due)}</Typography></Box>
        <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{s.status === "done" ? "100 %" : s.status === "doing" ? "50 %" : "0 %"}</Typography></Box>
        <Box sx={cell}><Typography noWrap sx={{ fontSize: "0.8rem", color: MUTED }}>{s.ownerName}</Typography></Box>
      </Box>
    );
  }

  const it = r.item;
  const ro = rolled.get(it.id);
  const summary = it.kind !== "action";
  const late = isLate(it, today);
  const fromSubs = it.kind === "action" && (ro?.subs ?? 0) > 0 && it.state !== "done" && it.percent !== 100;
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
        {it.kind === "action" && it.priority && /^\d$/.test(it.priority) && (
          <Box sx={{ flexShrink: 0, px: 0.6, borderRadius: "6px", fontSize: "0.68rem", fontWeight: 800, lineHeight: "17px", bgcolor: it.priority === "1" ? "#fde7e7" : it.priority === "2" ? "#fdf0dc" : "#eef1f6", color: it.priority === "1" ? LATE : it.priority === "2" ? "#a96a12" : MUTED }}>P{it.priority}</Box>
        )}
        <Tooltip title={it.detail && it.detail !== it.title ? <Box sx={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: 320, overflow: "hidden" }}>{it.detail}</Box> : ""} placement="bottom-start" enterDelay={600} disableInteractive>
          <Typography noWrap sx={{ ...name, minWidth: 0 }}>{it.title}</Typography>
        </Tooltip>
        {it.kind === "action" && it.dg && <Tooltip title="Led by Digital Growth - its sub-actions can take a Scroll to Sale ticket"><Box sx={{ flexShrink: 0, px: 0.6, borderRadius: "6px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px", bgcolor: TINT.blue.bg, color: TINT.blue.fg }}>DG</Box></Tooltip>}
        {late && <Box sx={{ flexShrink: 0, px: 0.6, borderRadius: "6px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px", bgcolor: "#fde7e7", color: LATE }}>LATE</Box>}
        {summary && (ro?.late ?? 0) > 0 && <Tooltip title={`${ro!.late} action${ro!.late === 1 ? "" : "s"} past due`}><Box sx={{ flexShrink: 0, px: 0.6, borderRadius: "6px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px", bgcolor: "#fde7e7", color: LATE }}>{ro!.late} late</Box></Tooltip>}
        <Box sx={{ flex: 1 }} />
        {it.kind === "action" && canWrite && (
          <Tooltip title="Sub-actions">
            <Box component="button" type="button" className="add" aria-label="Sub-actions" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSubs(it); }}
              sx={{ opacity: (ro?.subs ?? 0) > 0 ? 1 : 0, transition: "opacity .15s", flexShrink: 0, display: "flex", alignItems: "center", gap: 0.25, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: 99, px: 0.75, height: 22, cursor: "pointer", color: MUTED, font: "inherit", fontSize: "0.72rem", fontWeight: 700 }}>
              <AddIcon sx={{ fontSize: 15 }} />{(ro?.subs ?? 0) > 0 ? `${ro!.subs - ro!.subsOpen}/${ro!.subs}` : ""}
            </Box>
          </Tooltip>
        )}
      </Box>
      {summary ? (
        <>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(ro?.from ?? null)}</Typography></Box>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{dmy(ro?.to ?? null)}</Typography></Box>
          <Box sx={cell}><Typography sx={{ fontSize: "0.8rem", color: FAINT, fontWeight: 600 }}>{ro?.percent == null ? "" : `${ro.percent} %`}</Typography></Box>
          <Box sx={cell}><Typography noWrap sx={{ fontSize: "0.8rem", color: MUTED }}>{it.responsible}</Typography></Box>
        </>
      ) : (
        <>
          <DateCell value={it.start} canWrite={canWrite} max={it.due} onSave={(v) => onPatch(it.id, { start: v })} />
          <DateCell value={it.due} note={it.dueNote} late={late} canWrite={canWrite} min={it.start} onSave={(v) => onPatch(it.id, { due: v })} />
          {fromSubs
            ? <Box sx={cell}><Tooltip title="From its sub-actions"><Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>{ro?.percent ?? 0} %</Typography></Tooltip></Box>
            : <PercentCell value={it.percent} canWrite={canWrite} onSave={(v) => onPatch(it.id, { percent: v })} />}
          <Box sx={cell}><Typography noWrap title={it.responsible} sx={{ fontSize: "0.8rem", color: MUTED }}>{it.responsible}</Typography></Box>
        </>
      )}
    </Box>
  );
}

/** A date typed in its cell, as in Planner's grid. */
function DateCell({ value, note, late, canWrite, min, max, onSave }: { value: string | null; note?: string; late?: boolean; canWrite: boolean; min?: string | null; max?: string | null; onSave: (v: string | null) => Promise<void> }) {
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
        ? <Typography sx={{ fontSize: "0.8rem", color: late ? LATE : INK, fontWeight: late ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>{dmy(value)}</Typography>
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
