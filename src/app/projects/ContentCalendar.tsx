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
//
// Other apps put their own dated entries here too (08.11.2026, lib/content/calendarEvents.ts): AI testing &
// personalization's page tests - when one starts, its planned end, a winner published - squared and named after the
// app they come from, so a page change is planned with the content around it.

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
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";

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
import { STATUS_LABEL, type PieceStatus } from "@/lib/content/pieceRules";
import { KIND_LABEL, SOURCE_NAME, type CalendarEvent } from "@/lib/content/calendarEventRules";
import { TINT } from "@/app/uc/report/ui";
import { STATUS_TINT } from "./work/ui";
import { KindTile } from "./work/kinds";

/** A piece of a project on its own date (07.11.2026: the calendar is Content's first page, and the pieces are the work). */
type DatedPiece = { id: number; projectId: number; projectTitle: string; title: string; status: PieceStatus; dueDate: string | null; contentType: string | null };
type Drag = { kind: "project" | "piece"; id: number } | null;

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
  // a studio's "Open the calendar" sends the to-do's day (?day=2026-12-03): open on its month
  useEffect(() => {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(new URLSearchParams(window.location.search).get("day") ?? "");
    if (m) setAt({ year: Number(m[1]), month: Number(m[2]) });
  }, []);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pieces, setPieces] = useState<DatedPiece[]>([]);
  const [dragging, setDragging] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(() => {
    fetch("/api/content/projects?scope=visible")
      .then((r) => r.json())
      .then((j) => setProjects(j.ok ? j.projects : []))
      .catch(() => setProjects([]));
    fetch("/api/content/board")
      .then((r) => r.json())
      .then((j) => setPieces(j.ok ? (j.board as { id: number; title: string; pieces: Omit<DatedPiece, "projectId" | "projectTitle">[] }[])
        .flatMap((p) => p.pieces.map((x) => ({ ...x, projectId: p.id, projectTitle: p.title }))) : []))
      .catch(() => setPieces([]));
  }, []);
  useEffect(load, [load]);

  const weeks = useMemo(() => monthGrid(at.year, at.month), [at]);
  // the other apps' entries for the days on screen
  useEffect(() => {
    const days = weeks.flat();
    if (!days.length) return;
    let gone = false;
    fetch(`/api/content/calendar/events?from=${days[0].iso}&to=${days[days.length - 1].iso}`)
      .then((r) => r.json())
      .then((j) => { if (!gone) setEvents(j.ok ? j.events : []); })
      .catch(() => { if (!gone) setEvents([]); });
    return () => { gone = true; };
  }, [weeks]);
  const eventsOn = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) (m.get(e.day) ?? m.set(e.day, []).get(e.day)!).push(e);
    return m;
  }, [events]);
  // a project whose pieces have their dates shows through them, not a second time on its own date
  const dated = useMemo(() => {
    const withPieces = new Set(pieces.filter((x) => x.dueDate).map((x) => x.projectId));
    return byDueDate((projects ?? []).filter((p) => !withPieces.has(p.id)));
  }, [projects, pieces]);
  const loose = useMemo(() => unscheduled(projects ?? []), [projects]);
  const piecesOn = useMemo(() => {
    const m = new Map<string, DatedPiece[]>();
    for (const x of pieces) if (x.dueDate) (m.get(x.dueDate) ?? m.set(x.dueDate, []).get(x.dueDate)!).push(x);
    return m;
  }, [pieces]);
  const loosePieces = useMemo(() => pieces.filter((x) => !x.dueDate && x.status !== "live"), [pieces]);

  const schedulePiece = async (x: DatedPiece, iso: string | null) => {
    setPieces((all) => all.map((y) => (y.id === x.id ? { ...y, dueDate: iso } : y)));
    await fetch(`/api/content/projects/${x.projectId}/work`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "piece-edit", pieceId: x.id, dueDate: iso }),
    }).catch(() => {});
    load();
  };
  const drop = (iso: string | null) => {
    if (dragging?.kind === "project") void schedule(dragging.id, iso);
    if (dragging?.kind === "piece") { const x = pieces.find((y) => y.id === dragging.id); if (x) void schedulePiece(x, iso); }
    setDragging(null);
  };

  const pieceChip = (x: DatedPiece, late: boolean) => {
    const t = TINT[late ? "pink" : STATUS_TINT[x.status]];
    return (
      <Box key={`p${x.id}`} draggable onDragStart={() => setDragging({ kind: "piece", id: x.id })} onDragEnd={() => { setDragging(null); setOver(null); }}
        component={Link} href={`/projects/${x.projectId}#piece-${x.id}`}
        title={`${x.title} · ${x.projectTitle} · ${STATUS_LABEL[x.status]}`}
        sx={{
          display: "block", textDecoration: "none", cursor: "grab", px: 0.75, py: 0.4, mb: 0.4, borderRadius: "4px",
          fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          bgcolor: t.bg, color: t.fg, borderLeft: `3px solid ${t.fg}`, opacity: dragging?.kind === "piece" && dragging.id === x.id ? 0.4 : 1,
        }}>
        <Box component="span" sx={{ display: "inline-flex", verticalAlign: "-3px", mr: 0.5 }}><KindTile kind={x.contentType} size={15} /></Box>
        {x.title} <Box component="span" sx={{ fontWeight: 500, opacity: 0.8 }}>· {x.projectTitle}</Box>
      </Box>
    );
  };

  // another app's entry: squared, in petrol, named after its app; a click opens it there, the small square its Content project
  const eventChip = (e: CalendarEvent) => (
    <Box key={`e${e.source}:${e.key}`} sx={{
      display: "flex", alignItems: "center", gap: 0.4, mb: 0.4, borderRadius: "3px", border: "1px solid rgba(39,78,100,.35)",
      bgcolor: "rgba(39,78,100,.07)", color: "#274e64", overflow: "hidden",
    }}>
      <Box component={Link} href={e.href} title={`${SOURCE_NAME[e.source]} · ${KIND_LABEL[e.kind]}\n${e.title}${e.path ? `\n${e.env === "acc" ? "ACC " : ""}${e.path}` : ""}`}
        sx={{ flex: 1, minWidth: 0, px: 0.75, py: 0.35, textDecoration: "none", color: "inherit", fontSize: "0.7rem", fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <Box component="span" sx={{ fontWeight: 800, letterSpacing: ".02em" }}>{e.kind === "winner-published" ? "WINNER" : "TEST"}</Box> {e.title}
      </Box>
      {e.projectId && (
        <Tooltip title="Its Content project">
          <Box component={Link} href={`/projects/${e.projectId}`} aria-label="Its Content project"
            sx={{ flex: "0 0 auto", alignSelf: "stretch", display: "grid", placeItems: "center", px: 0.5, borderLeft: "1px solid rgba(39,78,100,.25)", color: "inherit", textDecoration: "none", fontSize: "0.66rem", fontWeight: 800 }}>
            <FolderOpenOutlinedIcon sx={{ fontSize: 13 }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );

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
      onDragStart={() => setDragging({ kind: "project", id: p.id })}
      onDragEnd={() => { setDragging(null); setOver(null); }}
      component={Link}
      href={`/projects/${p.id}`}
      sx={{
        display: "block", textDecoration: "none", cursor: "grab",
        px: 0.75, py: 0.4, mb: 0.4, borderRadius: "4px",
        fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        // Chosen is decided, late is late, everything else is ordinary work.
        bgcolor: p.chosenVariantId ? "rgba(27,122,85,.12)" : late ? "rgba(197,34,31,.1)" : "rgba(45,111,168,.1)",
        color: p.chosenVariantId ? "#17633f" : late ? "#a3211e" : "#245a88",
        opacity: dragging?.kind === "project" && dragging.id === p.id ? 0.4 : 1,
      }}
      title={`${p.title}${p.folder ? ` · ${p.folder}` : ""} · ${p.variantCount} version${p.variantCount === 1 ? "" : "s"}`}
    >
      {p.title}
    </Box>
  );

  const monthDays = weeks.flat().filter((d) => d.inMonth && ((dated.get(d.iso)?.length ?? 0) + (piecesOn.get(d.iso)?.length ?? 0) + (eventsOn.get(d.iso)?.length ?? 0)) > 0);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1, rowGap: 0.5, mb: 2 }}>
        <Tooltip title="Previous month">
          <IconButton onClick={() => setAt(shiftMonth(at.year, at.month, -1))}><ChevronLeftIcon /></IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK, minWidth: { xs: 0, sm: 180 }, whiteSpace: "nowrap" }}>
          {monthLabel(at.year, at.month)}
        </Typography>
        <Tooltip title="Next month">
          <IconButton onClick={() => setAt(shiftMonth(at.year, at.month, 1))}><ChevronRightIcon /></IconButton>
        </Tooltip>
        <Button
          size="small"
          onClick={() => { const d = new Date(); setAt({ year: d.getFullYear(), month: d.getMonth() + 1 }); }}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          This month
        </Button>
        <Typography sx={{ flex: "1 1 320px", textAlign: { xs: "left", md: "right" }, fontSize: "0.78rem", color: FAINT, minWidth: 0 }}>
          Projects and their pieces on their dates, with AI testing &amp; personalization&apos;s page tests. Drag one onto a day to plan it.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" }, alignItems: "start" }}>
        <GlassCard sx={{ p: { xs: 1.25, sm: 1.5 } }}>
          {projects !== null && monthDays.length === 0 && (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, px: 0.5, pb: 1 }}>
              Nothing planned in {monthLabel(at.year, at.month)} yet. Give a to-do its day in its project, or drag one here from &ldquo;No date yet&rdquo;.
            </Typography>
          )}
          {/* a phone: the days with something on them, as a list (seven columns of 45 px say nothing) */}
          <Box sx={{ display: { xs: "grid", sm: "none" }, gap: 1 }}>
            {monthDays.map((day) => (
              <Box key={day.iso} sx={{ display: "grid", gridTemplateColumns: "54px minmax(0, 1fr)", gap: 1, alignItems: "start", py: 0.75, borderTop: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: day.iso === today ? "#2d6fa8" : INK, pt: 0.4 }}>
                  {new Date(`${day.iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  {(eventsOn.get(day.iso) ?? []).map(eventChip)}
                  {(dated.get(day.iso) ?? []).map((p) => chip(p, isPast(day.iso, today) && !p.chosenVariantId))}
                  {(piecesOn.get(day.iso) ?? []).map((x) => pieceChip(x, isPast(day.iso, today) && x.status !== "approved" && x.status !== "live"))}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5, mb: 0.5 }}>
            {WEEKDAYS.map((d) => (
              <Typography key={d} sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {d}
              </Typography>
            ))}
          </Box>
          <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
            {weeks.flat().map((day) => {
              const here = dated.get(day.iso) ?? [];
              const herePieces = piecesOn.get(day.iso) ?? [];
              const hereEvents = eventsOn.get(day.iso) ?? [];
              const room = Math.max(0, 4 - here.length - Math.min(2, hereEvents.length));
              const isToday = day.iso === today;
              return (
                <Box
                  key={day.iso}
                  onDragOver={(e) => { e.preventDefault(); setOver(day.iso); }}
                  onDragLeave={() => setOver((o) => (o === day.iso ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    drop(day.iso);
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
                  {hereEvents.slice(0, 2).map(eventChip)}
                  {here.slice(0, 4 - Math.min(2, hereEvents.length)).map((p) => chip(p, isPast(day.iso, today) && !p.chosenVariantId))}
                  {herePieces.slice(0, room).map((x) => pieceChip(x, isPast(day.iso, today) && x.status !== "approved" && x.status !== "live"))}
                  {here.length + herePieces.length + hereEvents.length > 4 && (
                    <Typography sx={{ fontSize: "0.68rem", color: FAINT, pl: 0.75 }}>
                      + {here.length + herePieces.length + hereEvents.length - 4} more
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
            drop(null);
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
            <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{loose.length + loosePieces.length}</Typography>
          </Box>
          {projects === null ? (
            <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Loading&hellip;</Typography>
          ) : loose.length + loosePieces.length === 0 ? (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
              Everything has a date. Drop a project here to take its date off again.
            </Typography>
          ) : (
            <>
              {loose.map((p) => chip(p, false))}
              {loosePieces.map((x) => pieceChip(x, false))}
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
