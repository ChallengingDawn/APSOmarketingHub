"use client";

// THE CONTENT CALENDAR (list 104).
//
// A list sorted by "last edited" answers what somebody touched. It does not
// answer the only question a content plan exists for: what goes out next
// week, and is anything late.
//
// Two halves, on purpose. The month, and beside it everything with NO date -
// because a calendar that silently hides the undated work looks reassuringly
// empty while half the plan is missing from it. Dragging from that column
// onto a square is how a project gets scheduled, which is the one gesture
// worth building here.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EventBusyIcon from "@mui/icons-material/EventBusy";

import { FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  byDueDate,
  isoFromLocal,
  isPast,
  monthGrid,
  monthLabel,
  shiftMonth,
  unscheduled,
  WEEKDAYS,
} from "@/lib/content/calendar";

type Project = {
  id: number;
  title: string;
  status: string;
  chosenVariantId: number | null;
  dueDate: string | null;
  variantCount: number;
  folder: string | null;
  ownerName: string | null;
};

export default function ContentCalendar() {
  // Today is read once, from the local date parts. Re-reading it on every
  // render would make "today" move while somebody has the tab open overnight,
  // which is a strange thing to debug and a stranger thing to watch.
  const [today] = useState(() => isoFromLocal(new Date()));
  const [at, setAt] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/content/projects?scope=visible")
      .then((r) => r.json())
      .then((j) => setProjects(j.ok ? j.projects : []))
      .catch(() => setProjects([]));
  }, []);
  useEffect(load, [load]);

  const weeks = useMemo(() => monthGrid(at.year, at.month), [at]);
  const dated = useMemo(() => byDueDate(projects ?? []), [projects]);
  const loose = useMemo(() => unscheduled(projects ?? []), [projects]);

  const schedule = async (id: number, iso: string | null) => {
    // Optimistic: the chip lands on the square under the cursor and the
    // server catches up. A card that jumps back for 300ms reads as a bug.
    setProjects((all) => (all ?? []).map((p) => (p.id === id ? { ...p, dueDate: iso } : p)));
    await fetch(`/api/content/projects/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "due", dueDate: iso ?? "" }),
    }).catch(() => {});
    load();
  };

  const chip = (p: Project, late: boolean) => (
    <Box
      key={p.id}
      draggable
      onDragStart={() => setDragging(p.id)}
      onDragEnd={() => { setDragging(null); setOver(null); }}
      component={Link}
      href={`/projects/${p.id}`}
      sx={{
        display: "block", textDecoration: "none", cursor: "grab",
        px: 0.75, py: 0.4, mb: 0.4, borderRadius: "7px",
        fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        // Chosen is decided, late is late, everything else is ordinary work.
        bgcolor: p.chosenVariantId ? "rgba(27,122,85,.12)" : late ? "rgba(197,34,31,.1)" : "rgba(45,111,168,.1)",
        color: p.chosenVariantId ? "#17633f" : late ? "#a3211e" : "#245a88",
        opacity: dragging === p.id ? 0.4 : 1,
      }}
      title={`${p.title}${p.folder ? ` · ${p.folder}` : ""} · ${p.variantCount} version${p.variantCount === 1 ? "" : "s"}`}
    >
      {p.title}
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Tooltip title="Previous month">
          <IconButton onClick={() => setAt(shiftMonth(at.year, at.month, -1))}><ChevronLeftIcon /></IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK, minWidth: 180 }}>
          {monthLabel(at.year, at.month)}
        </Typography>
        <Tooltip title="Next month">
          <IconButton onClick={() => setAt(shiftMonth(at.year, at.month, 1))}><ChevronRightIcon /></IconButton>
        </Tooltip>
        <Button
          size="small"
          onClick={() => { const d = new Date(); setAt({ year: d.getFullYear(), month: d.getMonth() + 1 }); }}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
        >
          This month
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
          Drag a project onto a day to plan it.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" }, alignItems: "start" }}>
        <GlassCard sx={{ p: { xs: 1, sm: 1.5 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 0.5 }}>
            {WEEKDAYS.map((d) => (
              <Typography key={d} sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {d}
              </Typography>
            ))}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
            {weeks.flat().map((day) => {
              const here = dated.get(day.iso) ?? [];
              const isToday = day.iso === today;
              return (
                <Box
                  key={day.iso}
                  onDragOver={(e) => { e.preventDefault(); setOver(day.iso); }}
                  onDragLeave={() => setOver((o) => (o === day.iso ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    if (dragging !== null) void schedule(dragging, day.iso);
                    setDragging(null);
                  }}
                  sx={{
                    minHeight: 96, p: 0.5, borderRadius: "10px",
                    border: `1px solid ${over === day.iso ? "#2d6fa8" : HAIRLINE}`,
                    bgcolor: over === day.iso
                      ? "rgba(45,111,168,.08)"
                      : day.inMonth ? "rgba(255,255,255,.75)" : "rgba(21,34,58,.025)",
                    // The outside days are present but recessive: a campaign
                    // due on the 1st of next month should be visible from the
                    // end of this one without competing with it.
                    opacity: day.inMonth ? 1 : 0.65,
                  }}
                >
                  <Typography sx={{
                    fontSize: "0.72rem", fontWeight: isToday ? 800 : 600, mb: 0.4,
                    color: isToday ? "#2d6fa8" : day.inMonth ? MUTED : FAINT,
                  }}>
                    {day.day}
                  </Typography>
                  {/* Four, then a count. A square that scrolls is a square
                      nobody can read at a glance. */}
                  {here.slice(0, 4).map((p) => chip(p, isPast(day.iso, today) && !p.chosenVariantId))}
                  {here.length > 4 && (
                    <Typography sx={{ fontSize: "0.68rem", color: FAINT, pl: 0.75 }}>
                      + {here.length - 4} more
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </GlassCard>

        <Box
          onDragOver={(e) => { e.preventDefault(); setOver("none"); }}
          onDragLeave={() => setOver((o) => (o === "none" ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            // Dropping here takes the date OFF, which is how a plan gets
            // unmade without anybody having to clear a field.
            if (dragging !== null) void schedule(dragging, null);
            setDragging(null);
          }}
          sx={{ borderRadius: "18px", outline: over === "none" ? "2px solid #2d6fa8" : "none" }}
        >
        <GlassCard>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
            <EventBusyIcon sx={{ fontSize: 17, color: FAINT }} />
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>
              No date yet
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{loose.length}</Typography>
          </Box>
          {projects === null ? (
            <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Loading&hellip;</Typography>
          ) : loose.length === 0 ? (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
              Everything has a date. Drop a project here to take its date off again.
            </Typography>
          ) : (
            <>
              {loose.map((p) => chip(p, false))}
              <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1, lineHeight: 1.5 }}>
                These are the half of a plan a calendar usually hides. Drag one onto a day.
              </Typography>
            </>
          )}
        </GlassCard>
        </Box>
      </Box>
    </Box>
  );
}
