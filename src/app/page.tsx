"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ArticleIcon from "@mui/icons-material/Article";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PublishIcon from "@mui/icons-material/Publish";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InsightsIcon from "@mui/icons-material/Insights";
import CableIcon from "@mui/icons-material/Cable";
import Link from "next/link";
import AdvisorHero from "./overview/AdvisorHero";
import { brainSignalsFrom, createStudioHref, type AdvisorBrainSignals } from "@/lib/advisor";

/* ── types ── */

type LibItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  /** Null when the piece has never been given a visual — the visual editor
   *  opens blank for these, so they must not be linked to /editor. */
  imageUrl: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

type Trend = { term: string; signal: string };

/** A library item placed on a calendar day — on its plan date, or failing that
 *  on the day it was created. The two are never presented as the same thing. */
type CalEntry = { item: LibItem; kind: "scheduled" | "created"; at: number };

const CH_COLORS: Record<string, string> = {
  linkedin: "#0077b5",
  newsletter: "#274e64",
  blog: "#ed1b2f",
  ad: "#9334e6",
  product: "#34a853",
  seo: "#fbbc04",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#fff4e0", fg: "#c77700" },
  approved: { bg: "#e5f3ea", fg: "#1e7e45" },
  published: { bg: "#e3edf7", fg: "#2563a8" },
  archived: { bg: "#f0f1f3", fg: "#5b6470" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HAIRLINE = "#e3e6ea";

/** Every day cell is the same height, so a week reads as one band. */
const DAY_MIN_HEIGHT = 112;

/** How long a dashboard source gets before it is treated as unavailable. */
const SOURCE_TIMEOUT_MS = 12_000;

/**
 * A calendar entry, an approval-queue row and a day-dialog row all open the
 * SAME thing: the piece's detail in the Library. The visual editor is a
 * different tool — it renders a blank canvas for any piece without an image —
 * so it is only ever offered as a secondary affordance on pieces that have one.
 */
function libraryHref(id: number): string {
  return `/library?item=${id}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/* ── page ── */

export default function MissionControl() {
  const [items, setItems] = useState<LibItem[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [contentGap, setContentGap] = useState<string>("");
  const [greeting, setGreeting] = useState("Welcome back");
  const [today, setToday] = useState("");
  // The advisor must never read a failed fetch as "you have zero drafts", so a
  // dead source is tracked separately from an empty one.
  const [contentFailed, setContentFailed] = useState(false);
  const [brainSignals, setBrainSignals] = useState<AdvisorBrainSignals | null>(null);
  const [contentSettled, setContentSettled] = useState(false);
  const [brainSettled, setBrainSettled] = useState(false);
  // Month cursor stays null until mount — "now" differs between server render
  // and client, so the grid is client-only by construction.
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // The calendar needs the widest window the API allows (MAX_LIMIT = 200).
  const loadItems = useCallback(() => {
    fetch("/api/content?limit=200", { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setItems(Array.isArray(d.items) ? d.items : []);
        setContentFailed(false);
      })
      .catch(() => setContentFailed(true))
      .finally(() => setContentSettled(true));
  }, []);

  useEffect(() => {
    loadItems();
    // A source that never answers must not leave the advisor and the signals
    // spinning forever — an endless "reading…" is just a slower way of saying
    // nothing. Time it out and fall through to the honest unavailable state.
    fetch("/api/personality", { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((brain) => {
        setTrends(brain?.keywordSignals?.internalSearchTrends?.slice(0, 4) ?? []);
        setContentGap(brain?.categoryIntelligence?.contentGap ?? "");
        setBrainSignals(brainSignalsFrom(brain));
      })
      .catch(() => setBrainSignals(null))
      .finally(() => setBrainSettled(true));
    const now = new Date();
    const h = now.getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setToday(
      now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    );
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    setTodayKey(dayKey(now));
  }, [loadItems]);

  const drafts = useMemo(() => items.filter((i) => i.status === "draft"), [items]);
  const counts = useMemo(
    () => ({
      total: items.filter((i) => i.status !== "archived").length,
      drafts: drafts.length,
      approved: items.filter((i) => i.status === "approved").length,
      published: items.filter((i) => i.status === "published").length,
    }),
    [items, drafts]
  );
  const pipeline = useMemo(
    () => [
      { status: "Draft", count: counts.drafts, color: "#f59e0b" },
      { status: "Approved", count: counts.approved, color: "#10b981" },
      { status: "Published", count: counts.published, color: "#3b82f6" },
    ],
    [counts]
  );
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0);

  /* ── Content calendar — real library records only ── */

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalEntry[]>();
    for (const it of items) {
      if (it.status === "archived") continue;
      const at = new Date(it.scheduledFor ?? it.createdAt);
      if (Number.isNaN(at.getTime())) continue;
      const entry: CalEntry = {
        item: it,
        kind: it.scheduledFor ? "scheduled" : "created",
        at: at.getTime(),
      };
      const key = dayKey(at);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.kind === b.kind ? a.at - b.at : a.kind === "scheduled" ? -1 : 1));
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => {
    if (!cursor) return [] as Date[][];
    const mondayOffset = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
    const out: Date[][] = [];
    for (let i = 0; i < cells; i += 7) {
      out.push(
        Array.from({ length: 7 }, (_, j) => new Date(cursor.y, cursor.m, 1 - mondayOffset + i + j))
      );
    }
    return out;
  }, [cursor]);

  const monthStats = useMemo(() => {
    let scheduled = 0;
    let created = 0;
    if (cursor) {
      for (const bucket of entriesByDay.values()) {
        for (const e of bucket) {
          const d = new Date(e.at);
          if (d.getFullYear() !== cursor.y || d.getMonth() !== cursor.m) continue;
          if (e.kind === "scheduled") scheduled += 1;
          else created += 1;
        }
      }
    }
    return { scheduled, created, total: scheduled + created };
  }, [entriesByDay, cursor]);

  const monthLabel = cursor
    ? new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  // Normalised through Date so December→January rolls the year over and the
  // month comparisons above stay in 0-11.
  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      if (!c) return c;
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
  };

  const selectedEntries = selectedDay ? entriesByDay.get(selectedDay) ?? [] : [];
  const selectedLabel = selectedDay
    ? new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  /* Nothing on this page generates content any more. The Overview reports and
   * routes; Create Studio writes. A demand signal therefore becomes a deep link
   * into the studio carrying the term AND the evidence behind it as the topic. */
  const signalHref = (t: Trend) => createStudioHref("blog", `${t.term} — ${t.signal}`);

  const kpis = [
    { label: "In Library", value: counts.total, period: "active items", icon: <ArticleIcon />, color: "#274e64", bg: "#e8f0f4", href: "/library" },
    { label: "Drafts Pending", value: counts.drafts, period: "awaiting review", icon: <PendingActionsIcon />, color: "#ed1b2f", bg: "#fdebed", href: "/library" },
    { label: "Approved", value: counts.approved, period: "ready to publish", icon: <CheckCircleIcon />, color: "#1e7e45", bg: "#e5f3ea", href: "/library" },
    { label: "Published", value: counts.published, period: "live content", icon: <PublishIcon />, color: "#2563a8", bg: "#e3edf7", href: "/library" },
  ];

  return (
    <Box>
      {/* ── Hero: the AI advisor. It reports and routes — it never generates. ── */}
      <AdvisorHero
        greeting={greeting}
        today={today}
        items={contentFailed ? null : items}
        brain={brainSignals}
        ready={contentSettled && brainSettled}
      />

      {/* ── KPI row (all live) ── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {kpis.map((k) => (
          <Grid key={k.label} size={{ xs: 6, lg: 3 }}>
            <Card
              component={Link}
              href={k.href}
              className="hover-lift"
              sx={{ display: "block", textDecoration: "none", borderTop: `3px solid ${k.color}`, height: "100%" }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", "& svg": { fontSize: 19 } }}>
                    {k.icon}
                  </Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {k.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 30, fontWeight: 700, color: "#1a1d21", mt: 1, lineHeight: 1 }}>
                  {k.value}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#5b6470", mt: 0.5 }}>{k.period}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Content calendar (live library records) ── */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>
              Content Calendar
            </Typography>
            <Chip
              icon={<CalendarMonthIcon sx={{ fontSize: 14, color: "#274e64 !important" }} />}
              label={`${monthStats.total} this month`}
              size="small"
              sx={{ fontWeight: 700, fontSize: 10.5, bgcolor: "#e8f0f4", color: "#274e64" }}
            />
            <Box sx={{ flex: 1, minWidth: 12 }} />
            <Button
              onClick={goToday}
              size="small"
              sx={{ fontSize: 12, fontWeight: 700, color: "#274e64", minWidth: 0, px: 1 }}
            >
              Today
            </Button>
            <IconButton size="small" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeftIcon sx={{ fontSize: 20, color: "#5b6470" }} />
            </IconButton>
            <Typography
              suppressHydrationWarning
              sx={{
                fontFamily: "var(--font-outfit)",
                fontSize: 15,
                fontWeight: 700,
                color: "#1a1d21",
                minWidth: 148,
                textAlign: "center",
              }}
            >
              {monthLabel || " "}
            </Typography>
            <IconButton size="small" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRightIcon sx={{ fontSize: 20, color: "#5b6470" }} />
            </IconButton>
          </Box>

          {/* legend + honest per-month counts */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: 1.75, mb: 1.75, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 18, height: 10, borderRadius: 0.75, bgcolor: "#274e64" }} />
              <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
                Scheduled — a planned date is set ({monthStats.scheduled})
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 18, height: 10, borderRadius: 0.75, border: "1px solid #274e64" }} />
              <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
                Not scheduled — shown on its creation date ({monthStats.created})
              </Typography>
            </Box>
          </Box>

          {/* weekday header */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", mb: 0.75 }}>
            {WEEKDAYS.map((w) => (
              <Typography
                key={w}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#5b6470",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                }}
              >
                {w}
              </Typography>
            ))}
          </Box>

          {/* Month grid. Each week is its OWN row bounded by a hairline above and
              below — the outer frame draws the first row's top rule and the last
              row's bottom rule, every other rule is a row's borderTop. Without
              these the seven columns read as stripes, not as a calendar. */}
          <Box
            sx={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 1.5,
              overflow: "hidden",
              bgcolor: "#ffffff",
            }}
          >
            {weeks.map((week, wi) => (
              <Box
                key={`w${week[0].getTime()}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  borderTop: wi === 0 ? "none" : `1px solid ${HAIRLINE}`,
                }}
              >
                {week.map((d, di) => {
                  const key = dayKey(d);
                  const inMonth = cursor
                    ? d.getMonth() === cursor.m && d.getFullYear() === cursor.y
                    : false;
                  const dayEntries = entriesByDay.get(key) ?? [];
                  const isToday = key === todayKey;
                  return (
                    <Box
                      key={key}
                      onClick={() => dayEntries.length && setSelectedDay(key)}
                      sx={{
                        minHeight: DAY_MIN_HEIGHT,
                        p: 0.75,
                        borderRight: di < 6 ? `1px solid ${HAIRLINE}` : "none",
                        bgcolor: inMonth ? "#ffffff" : "#fafbfc",
                        cursor: dayEntries.length ? "pointer" : "default",
                        transition: "background-color 0.15s ease",
                        "&:hover": { bgcolor: dayEntries.length ? "#f5f6f8" : undefined },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                        <Box
                          sx={{
                            width: 21,
                            height: 21,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: isToday ? "#ed1b2f" : "transparent",
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 11.5,
                              fontWeight: isToday ? 700 : 600,
                              color: isToday ? "#fff" : inMonth ? "#1a1d21" : "#a7aeb8",
                            }}
                          >
                            {d.getDate()}
                          </Typography>
                        </Box>
                        {dayEntries.length > 0 && (
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#a7aeb8" }}>
                            {dayEntries.length}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                        {dayEntries.slice(0, 3).map((e) => {
                          const color = CH_COLORS[e.item.channel] ?? "#5b6470";
                          const scheduled = e.kind === "scheduled";
                          return (
                            <Tooltip
                              key={`${e.kind}-${e.item.id}`}
                              title={`${e.item.channel} · ${scheduled ? "scheduled" : "created"} · ${e.item.status} — opens this piece in the Library`}
                            >
                              <Box
                                component={Link}
                                href={libraryHref(e.item.id)}
                                onClick={(ev: React.MouseEvent) => ev.stopPropagation()}
                                sx={{
                                  display: "block",
                                  textDecoration: "none",
                                  px: 0.75,
                                  py: 0.3,
                                  borderRadius: 0.75,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  lineHeight: 1.35,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  bgcolor: scheduled ? color : "transparent",
                                  color: scheduled ? "#ffffff" : color,
                                  border: `1px solid ${color}`,
                                  opacity: inMonth ? 1 : 0.55,
                                }}
                              >
                                {e.item.title || e.item.body.slice(0, 40)}
                              </Box>
                            </Tooltip>
                          );
                        })}
                        {dayEntries.length > 3 && (
                          <Typography
                            sx={{ fontSize: 10.5, fontWeight: 700, color: "#274e64", px: 0.75, cursor: "pointer" }}
                          >
                            +{dayEntries.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>

          {cursor && monthStats.total === 0 && (
            <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 2 }}>
              Nothing scheduled or created in {monthLabel}.
            </Typography>
          )}
          {!cursor && (
            <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 2 }}>
              Loading the month…
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ── Integrations strip ── */}
      <Card sx={{ mb: 2.5, bgcolor: "#fbfbfc" }}>
        <CardContent sx={{ py: 1.5, px: 2.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <CableIcon sx={{ fontSize: 18, color: "#5b6470" }} />
          <Typography sx={{ fontSize: 13, color: "#3c4043", flex: 1, minWidth: 240 }}>
            <strong>Traffic & ranking metrics are one connection away</strong> — GA4, Search Console and HubSpot integrations are prepared and waiting for credentials.
          </Typography>
          {["GA4", "Search Console", "HubSpot"].map((n) => (
            <Chip key={n} label={n} size="small" sx={{ fontWeight: 600, bgcolor: "#f0f1f3", color: "#5b6470" }} />
          ))}
        </CardContent>
      </Card>

      {/* ── Approval queue + Demand signals ── */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#fbbc04" }} />
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Approval Queue</Typography>
                </Box>
                <Chip label={`${counts.drafts} pending`} size="small" sx={{ fontWeight: 700, bgcolor: "#fef7e0", color: "#b06000" }} />
              </Box>
              {drafts.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 4 }}>
                  Queue is clear — nothing is waiting for review.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {drafts.slice(0, 5).map((d) => (
                    <Box
                      key={d.id}
                      sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 1.5, border: "1px solid #f1f3f4", "&:hover": { bgcolor: "#fafbfc" } }}
                    >
                      <Box sx={{ width: 3, height: 30, borderRadius: 2, bgcolor: CH_COLORS[d.channel] ?? "#5b6470", flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: "#1a1d21" }}>
                          {d.title || d.body.slice(0, 90)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#5b6470" }}>
                          <Box component="span" sx={{ color: CH_COLORS[d.channel], fontWeight: 700, textTransform: "uppercase" }}>{d.channel}</Box>
                          {" · "}{timeAgo(d.createdAt)}
                        </Typography>
                      </Box>
                      {/* Review opens THIS piece in the Library, not the whole
                          library and not the visual editor. The editor is
                          offered separately, and only when there is a design to
                          edit — it renders blank for an image-less piece. */}
                      <Button component={Link} href={libraryHref(d.id)} size="small" variant="contained" sx={{ bgcolor: "#1e7e45", fontSize: 11.5, px: 1.5, py: 0.4, "&:hover": { bgcolor: "#17643a" } }}>
                        Review
                      </Button>
                      {d.imageUrl && (
                        <Tooltip title="Edit this piece's design in the visual editor">
                          <IconButton
                            component={Link}
                            href={`/editor?item=${d.id}`}
                            size="small"
                            aria-label="Edit design"
                            sx={{ color: "#5b6470" }}
                          >
                            <DesignServicesIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
              <Box sx={{ mt: 1.5, textAlign: "center" }}>
                <Button component={Link} href="/library" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} sx={{ fontSize: 12.5, fontWeight: 600, color: "#274e64" }}>
                  Open the Content Library
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#ed1b2f" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Demand Signals</Typography>
                <Chip label="from real shop search data" size="small" sx={{ fontWeight: 600, fontSize: 10.5, bgcolor: "#e5f3ea", color: "#1e7e45" }} />
              </Box>
              <Typography sx={{ fontSize: 12.5, color: "#5b6470", ml: 1.75, mb: 1.5 }}>
                What APSOparts customers are actually searching — send a signal straight to Create
                Studio with the term and its evidence as the topic.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {trends.map((t) => (
                  <Box key={t.term} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 1.5, border: "1px solid #f1f3f4" }}>
                    <TrendingUpIcon sx={{ fontSize: 18, color: "#ed1b2f", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#1a1d21" }}>{t.term}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>{t.signal}</Typography>
                    </Box>
                    <Tooltip title="Open Create Studio with this signal as the topic">
                      <Button
                        component={Link}
                        href={signalHref(t)}
                        size="small"
                        startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                        sx={{ fontSize: 11.5, fontWeight: 700, color: "#ed1b2f", whiteSpace: "nowrap" }}
                      >
                        Create
                      </Button>
                    </Tooltip>
                  </Box>
                ))}
                {trends.length === 0 && (
                  <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 3 }}>
                    Loading signals…
                  </Typography>
                )}
              </Box>
              {contentGap && (
                <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: "#fdf6ec", border: "1px solid #f5e3c4", display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <InsightsIcon sx={{ fontSize: 17, color: "#c77700", mt: 0.2 }} />
                  <Typography sx={{ fontSize: 12, color: "#7a5200", lineHeight: 1.5 }}>{contentGap}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Pipeline + Recent activity ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#34a853" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Content Pipeline</Typography>
                <Chip label={`${pipelineTotal} items`} size="small" sx={{ fontWeight: 700, bgcolor: "#f0f1f3", color: "#3c4043" }} />
              </Box>
              {pipeline.map((stage) => (
                <Box key={stage.status} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Typography sx={{ width: 84, fontSize: 12.5, fontWeight: 600, color: "#3c4043" }}>{stage.status}</Typography>
                  <Box sx={{ flex: 1, height: 22, bgcolor: "#f0f1f3", borderRadius: 1, overflow: "hidden" }}>
                    <Box
                      sx={{
                        width: pipelineTotal ? `${Math.max(6, (stage.count / pipelineTotal) * 100)}%` : "0%",
                        height: "100%",
                        bgcolor: stage.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        pr: 1,
                        transition: "width 0.6s ease",
                      }}
                    >
                      {stage.count > 0 && (
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#fff" }}>{stage.count}</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
              {pipelineTotal === 0 && (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 2 }}>
                  Pipeline is empty — everything starts with a generation.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Recent Activity</Typography>
              </Box>
              {items.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 4 }}>
                  No activity yet.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {items.slice(0, 6).map((i) => {
                    const sc = STATUS_COLORS[i.status] ?? STATUS_COLORS.archived;
                    return (
                      <Box key={i.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75, borderBottom: "1px solid #f5f6f8", "&:last-child": { borderBottom: "none" } }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CH_COLORS[i.channel] ?? "#5b6470", flexShrink: 0 }} />
                        <Typography noWrap sx={{ flex: 1, fontSize: 13, color: "#1a1d21", minWidth: 0 }}>
                          {i.title || i.body.slice(0, 80)}
                        </Typography>
                        <Chip label={i.status} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: sc.bg, color: sc.fg }} />
                        <Typography sx={{ fontSize: 11.5, color: "#5b6470", whiteSpace: "nowrap" }}>{timeAgo(i.updatedAt)}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── One day's content ── */}
      <Dialog open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17 }}>{selectedLabel}</DialogTitle>
        <DialogContent dividers>
          {selectedEntries.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "#5b6470", py: 2 }}>
              Nothing on this day.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {selectedEntries.map((e) => {
                const color = CH_COLORS[e.item.channel] ?? "#5b6470";
                const sc = STATUS_COLORS[e.item.status] ?? STATUS_COLORS.archived;
                return (
                  <Box
                    key={`${e.kind}-${e.item.id}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: `1px solid ${HAIRLINE}`,
                      "&:hover": { bgcolor: "#fafbfc" },
                    }}
                  >
                    <Box sx={{ width: 3, height: 34, borderRadius: 2, bgcolor: color, flexShrink: 0 }} />
                    {/* The piece itself opens in the Library. */}
                    <Box
                      component={Link}
                      href={libraryHref(e.item.id)}
                      sx={{ flex: 1, minWidth: 0, textDecoration: "none" }}
                    >
                      <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, color: "#1a1d21" }}>
                        {e.item.title || e.item.body.slice(0, 90)}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
                        <Box component="span" sx={{ color, fontWeight: 700, textTransform: "uppercase" }}>
                          {e.item.channel}
                        </Box>
                        {e.kind === "scheduled" ? " · scheduled for this day" : " · created this day, not scheduled"}
                      </Typography>
                    </Box>
                    <Chip
                      label={e.item.status}
                      size="small"
                      sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: sc.bg, color: sc.fg }}
                    />
                    {/* Only a piece that HAS a design can have its design edited. */}
                    {e.item.imageUrl && (
                      <Button
                        component={Link}
                        href={`/editor?item=${e.item.id}`}
                        size="small"
                        startIcon={<DesignServicesIcon sx={{ fontSize: 15 }} />}
                        sx={{ fontSize: 11.5, fontWeight: 700, color: "#274e64", whiteSpace: "nowrap" }}
                      >
                        Edit design
                      </Button>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button component={Link} href="/library" sx={{ fontWeight: 600, color: "#274e64" }}>
            Open the Library
          </Button>
          <Button onClick={() => setSelectedDay(null)}>Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
