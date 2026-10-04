"use client";

// EROSION ON ARTICLE LEVEL - moved here from the APSOAssistant micro apps.
//
// Two sources, deliberately kept apart so one can fail without the other: the
// tickets come live out of HubSpot, the forecast comes from the detector on the
// Compass connector. The calendar draws both - green for tickets raised, blue for
// tickets the detector expects - and everything below it is about what ESO and
// TSA did with the ones raised.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import EuroIcon from "@mui/icons-material/Euro";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { SEQUENTIAL, SERIES } from "@/app/charts/palette";
import { full, percent } from "@/app/charts/format";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import {
  dayCells, daysBetween, forecastTicketCount, isClosed, isWon, localDay, resolutionText,
  type DayCell, type ErosionForecast, type ErosionTicket, type ErosionTickets, type ForecastItem,
} from "@/lib/erosion/model";
import { OutcomeReport, TeamsReport } from "@/app/uc/report/OutcomeReport";
import {
  CardTitle, GlassCard, HAIRLINE, HsLink, INK, KpiTile, Kicker, MUTED, Notice, StageChip, TeamChip,
  clip, eur, glass, headCell,
} from "@/app/uc/report/ui";


const BLUE = SERIES[0];
const ORANGE = SERIES[1];
const AMBER = "#b26a00";

/** Tickets raised (green) and forecast (blue), five steps each, light to dark. */
const CREATED_RAMP = ["#ddf3ea", "#b3e4cf", "#7ccfae", "#3cb889", "#16875f"];
const FORECAST_RAMP = [SEQUENTIAL[0], SEQUENTIAL[1], SEQUENTIAL[2], SEQUENTIAL[3], SEQUENTIAL[5]];
const DARK = new Set([CREATED_RAMP[3], CREATED_RAMP[4], FORECAST_RAMP[3], FORECAST_RAMP[4]]);

function ramp(colors: string[], count: number, max: number): string | null {
  if (count <= 0) return null;
  const i = Math.min(colors.length - 1, Math.max(0, Math.ceil((count / Math.max(max, 1)) * colors.length) - 1));
  return colors[i];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE = 20;
const POLL_MS = 5 * 60_000;

/* ── calendar ─────────────────────────────────────────────────────────── */

type Month = { year: number; month: number; label: string };

function monthsBetween(from: Date, to: Date): Month[] {
  const out: Month[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) });
  }
  return out;
}

function DayDetail({ day, cell, onClose }: { day: string; cell: DayCell; onClose: () => void }) {
  const groups = [...cell.forecast].sort((a, b) => b.amount - a.amount);
  return (
    <Box sx={{ gridColumn: "1 / -1", border: `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${ORANGE}`, borderRadius: 2, bgcolor: "#fff", p: 1.75, mb: "4px" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>
          {day}
          {cell.created.length ? ` — ${cell.created.length} ticket${cell.created.length > 1 ? "s" : ""} raised` : ""}
          {cell.forecast.length
            ? `${cell.created.length ? " · " : " — "}${cell.forecast.length} expected (${eur(cell.forecastEur)} EUR)`
            : ""}
        </Typography>
        <Button size="small" onClick={onClose} sx={{ minWidth: 0, fontSize: "0.74rem", color: MUTED }}>Close</Button>
      </Box>
      {cell.created.length > 0 && (
        <Box sx={{ overflowX: "auto", mb: groups.length ? 2 : 0 }}>
          <Table size="small">
            <TableHead><TableRow>
              {["Company", "Articles", "Last year EUR", "Owner", "Team", "Status", "Resolution", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {cell.created.map((t) => {
                const res = resolutionText(t);
                return (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ fontSize: "0.8rem", ...clip(220) }} title={t.subject}>{t.company ?? "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.76rem", ...clip(170) }} title={t.article ?? ""}>{t.article ?? "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{eur(t.amount)}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{t.owner}</TableCell>
                    <TableCell><TeamChip team={t.team} /></TableCell>
                    <TableCell><StageChip t={t} /></TableCell>
                    <TableCell sx={{ fontSize: "0.76rem", color: res.missing ? AMBER : MUTED, ...clip(220) }} title={res.text}>{res.text}</TableCell>
                    <TableCell sx={{ p: 0.25 }}><HsLink id={t.id} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {groups.length > 0 && (
        <>
          <Kicker>Expected — one ticket per company, its lapsed articles summed; a repurchase before the day removes the article</Kicker>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {["Company", "Articles", "Ticket total EUR", "Owner", "Team"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.un} hover>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{g.company}</TableCell>
                    <TableCell sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.76rem", ...clip(300) }} title={g.articles.join(", ")}>
                      {g.articles.length === 1 ? g.articles[0] : `${g.articles.length} articles: ${g.articles.slice(0, 3).join(", ")}${g.articles.length > 3 ? "…" : ""}`}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{eur(g.amount)}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{g.owner}</TableCell>
                    <TableCell><TeamChip team={g.team} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}
    </Box>
  );
}

function Calendar({ tickets, items, horizonDays, forecastNote }: {
  tickets: ErosionTicket[];
  items: ForecastItem[];
  horizonDays: number;
  forecastNote: React.ReactNode;
}) {
  const [nowMs] = useState(() => Date.now());
  const today = useMemo(() => { const d = new Date(nowMs); d.setHours(12, 0, 0, 0); return d; }, [nowMs]);
  const todayKey = localDay(today);
  const cells = useMemo(() => dayCells(tickets, items), [tickets, items]);
  const maxCreated = Math.max(1, ...[...cells.values()].map((c) => c.created.length));
  const maxForecast = Math.max(1, ...[...cells.values()].map((c) => c.forecast.length));

  const lastDue = items.reduce((m, it) => (it.due > m ? it.due : m), todayKey);
  const horizon = useMemo(() => {
    const byDays = new Date(today.getTime() + horizonDays * 86_400_000);
    const byItems = new Date(`${lastDue}T12:00:00`);
    return byDays > byItems ? byDays : byItems;
  }, [today, horizonDays, lastDue]);
  const firstCreated = tickets.reduce((m, t) => (t.created && t.created < m ? t.created : m), todayKey);
  const months = useMemo(
    () => monthsBetween(new Date(`${firstCreated}T12:00:00`), horizon),
    [firstCreated, horizon],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const thisMonth = Math.max(0, months.findIndex((m) => m.year === today.getFullYear() && m.month === today.getMonth()));
  const idx = Math.min(picked ?? thisMonth, months.length - 1);
  const mo = months[idx];

  const weeks = useMemo(() => {
    if (!mo) return [];
    const first = new Date(mo.year, mo.month, 1);
    const lead = (first.getDay() + 6) % 7;
    const n = new Date(mo.year, mo.month + 1, 0).getDate();
    const flat: (Date | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: n }, (_, i) => new Date(mo.year, mo.month, i + 1, 12)),
    ];
    while (flat.length % 7) flat.push(null);
    const out: (Date | null)[][] = [];
    for (let i = 0; i < flat.length; i += 7) out.push(flat.slice(i, i + 7));
    return out;
  }, [mo]);

  const go = (to: number) => { setPicked(to); setSelected(null); };

  return (
    <GlassCard>
      <CardTitle
        icon={<CalendarMonthOutlinedIcon />}
        title="Tickets raised and expected"
        note="Green: raised · blue: what the detector expects next · every day since the start, whatever the period"
        right={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton size="small" disabled={idx <= 0} onClick={() => go(idx - 1)} aria-label="Previous month"><ChevronLeftIcon fontSize="small" /></IconButton>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, minWidth: 140, textAlign: "center", color: INK }}>{mo?.label ?? "—"}</Typography>
            <IconButton size="small" disabled={idx >= months.length - 1} onClick={() => go(idx + 1)} aria-label="Next month"><ChevronRightIcon fontSize="small" /></IconButton>
          </Box>
        }
      />
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 560 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", mb: 0.5 }}>
            {WEEKDAYS.map((d) => (
              <Typography key={d} sx={{ fontSize: "0.68rem", color: MUTED, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</Typography>
            ))}
          </Box>
          {weeks.map((week, wi) => {
            const selectedHere = selected !== null && week.some((d) => d && localDay(d) === selected);
            return (
              <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", mb: "4px" }}>
                {week.map((day, ci) => {
                  if (!day) return <Box key={ci} sx={{ minHeight: 74 }} />;
                  const k = localDay(day);
                  const c = cells.get(k);
                  const nCreated = c?.created.length ?? 0;
                  const future = k > todayKey;
                  // An expected ticket on a past day that has none raised is still worth
                  // its number - it is one the detector has not got to - but only the
                  // future is shaded as forecast.
                  const nForecast = future || nCreated === 0 ? (c?.forecast.length ?? 0) : 0;
                  const bg = nCreated
                    ? ramp(CREATED_RAMP, nCreated, maxCreated)
                    : future && nForecast ? ramp(FORECAST_RAMP, nForecast, maxForecast) : null;
                  const dark = bg !== null && DARK.has(bg);
                  const clickable = nCreated > 0 || (c?.forecast.length ?? 0) > 0;
                  const isSel = selected === k;
                  const isToday = k === todayKey;
                  const beyond = day > horizon;
                  return (
                    <Box
                      key={k}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable ? `${k}: ${nCreated} raised, ${nForecast} expected` : undefined}
                      onClick={() => clickable && setSelected(isSel ? null : k)}
                      onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelected(isSel ? null : k); } }}
                      sx={{
                        minHeight: 74, borderRadius: 1.6, p: 0.9, display: "flex", flexDirection: "column",
                        cursor: clickable ? "pointer" : "default",
                        bgcolor: bg ?? (beyond ? "#fff" : "#fafbfc"),
                        opacity: beyond ? 0.45 : 1,
                        border: isSel ? `2px solid ${ORANGE}` : isToday ? `2px solid ${INK}` : `1px solid ${HAIRLINE}`,
                        transition: "box-shadow 0.12s",
                        "&:hover": clickable ? { boxShadow: "0 2px 8px rgba(26,29,33,0.12)" } : {},
                      }}
                    >
                      <Typography sx={{ fontSize: "0.7rem", lineHeight: 1, color: dark ? "rgba(255,255,255,0.9)" : MUTED }}>
                        {day.getDate()}{isToday ? " · today" : ""}
                      </Typography>
                      {(nCreated > 0 || nForecast > 0) && (
                        <Box sx={{ mt: "auto", display: "flex", alignItems: "baseline", gap: 0.6 }}>
                          {nCreated > 0 && <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.1, color: dark ? "#fff" : "#11704f" }}>{nCreated}</Typography>}
                          {nCreated > 0 && nForecast > 0 && <Typography sx={{ fontSize: "0.72rem", color: dark ? "#fff" : MUTED }}>+</Typography>}
                          {nForecast > 0 && <Typography sx={{ fontSize: nCreated ? "0.82rem" : "1.1rem", fontWeight: 700, lineHeight: 1.1, color: dark ? "#fff" : "#1f5486" }}>{nForecast}</Typography>}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                {selectedHere && selected && cells.get(selected) && (
                  <DayDetail day={selected} cell={cells.get(selected) as DayCell} onClose={() => setSelected(null)} />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap", mt: 1.25 }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>raised</Typography>
        {CREATED_RAMP.map((c) => <Box key={c} sx={{ width: 16, height: 10, bgcolor: c, borderRadius: "2px" }} />)}
        <Box sx={{ width: 12 }} />
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>expected</Typography>
        {FORECAST_RAMP.map((c) => <Box key={c} sx={{ width: 16, height: 10, bgcolor: c, borderRadius: "2px" }} />)}
        <Box sx={{ width: 12 }} />
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>numbers are tickets, one per company · click a day for the list</Typography>
      </Box>
      {forecastNote}
    </GlassCard>
  );
}

/* ── all tickets ──────────────────────────────────────────────────────── */

function AllTickets({ tickets, period }: { tickets: ErosionTicket[]; period: string }) {
  const [page, setPage] = useState(0);
  // a new period is a new list: start it at its first page
  useEffect(() => setPage(0), [tickets]);
  const rows = tickets.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <GlassCard>
      <CardTitle icon={<ListAltIcon />} tint="slate" title="All erosion tickets"
        note={`${full(tickets.length)} raised · ${period} · newest first, status and owner live from HubSpot`} />
      {tickets.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No ticket was raised in this period.</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                {["Raised", "Company", "Articles", "Last year EUR", "Owner", "Team", "Status", "Resolution", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {rows.map((t) => {
                  const res = resolutionText(t);
                  return (
                    <TableRow key={t.id} hover>
                      <TableCell sx={{ fontSize: "0.78rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{t.created}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", ...clip(220) }} title={t.subject}>{t.company ?? "—"}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.76rem", ...clip(200) }} title={t.article ?? ""}>{t.article ?? "—"}</Typography>
                        {t.articleDescription && (
                          <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(240) }} title={t.articleDescription}>{t.articleDescription}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{eur(t.amount)}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{t.owner}</TableCell>
                      <TableCell><TeamChip team={t.team} /></TableCell>
                      <TableCell><StageChip t={t} /></TableCell>
                      <TableCell sx={{ fontSize: "0.76rem", color: res.missing ? AMBER : MUTED, ...clip(220) }} title={res.text}>{res.text}</TableCell>
                      <TableCell sx={{ p: 0.25 }}><HsLink id={t.id} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={tickets.length} page={page} rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]}
            onPageChange={(_, p) => setPage(p)} />
        </>
      )}
    </GlassCard>
  );
}

/* ── the page ─────────────────────────────────────────────────────────── */

/* ── tabs ─────────────────────────────────────────────────────────────── */

type TabId = "calendar" | "results" | "people" | "tickets";

/** Each tab has its own address, so a link can open the one that matters. */
const TAB_HASH: Record<TabId, string> = { calendar: "#calendar", results: "#win-rate", people: "#people", tickets: "#tickets" };

/** A frosted segmented control, a count on each tab saying what is behind it before anyone clicks. */
function ErosionTabs({ tab, onSelect, tabs }: {
  tab: TabId;
  onSelect: (t: TabId) => void;
  tabs: { id: TabId; label: string; count: string | null }[];
}) {
  const move = (from: TabId, step: number) => {
    const i = tabs.findIndex((t) => t.id === from);
    const next = tabs[(i + step + tabs.length) % tabs.length].id;
    onSelect(next);
    document.getElementById(`erosion-tab-${next}`)?.focus();
  };
  return (
    <Box
      role="tablist"
      aria-label="Erosion views"
      sx={{ ...glass, display: "inline-flex", flexWrap: "wrap", gap: 0.5, p: 0.6, borderRadius: "16px", boxShadow: "0 1px 2px rgba(31,45,78,.04)" }}
    >
      {tabs.map(({ id, label, count }) => {
        const on = tab === id;
        return (
          <Box
            key={id}
            id={`erosion-tab-${id}`}
            role="tab"
            aria-selected={on}
            aria-controls={`erosion-panel-${id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(id, 1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); move(id, -1); }
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); }
            }}
            sx={{
              display: "flex", alignItems: "center", gap: 0.85, px: 1.75, py: 0.9, borderRadius: "12px",
              cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
              fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
              color: on ? "#2459d1" : MUTED,
              bgcolor: on ? "#e6edfd" : "transparent",
              transition: "background-color .12s, color .12s",
              "&:hover": { color: on ? "#2459d1" : INK, bgcolor: on ? "#e6edfd" : "rgba(255,255,255,0.75)" },
              "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
            }}
          >
            {label}
            {count !== null && (
              <Typography component="span" sx={{
                fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, px: 0.75, py: 0.4, borderRadius: "7px",
                bgcolor: on ? "#ffffff" : "rgba(21,34,58,.06)", color: on ? "#2459d1" : MUTED,
              }}>{count}</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default function ErosionApp() {
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const [tab, setTab] = useState<TabId>("calendar");
  // Read on load AND whenever the #fragment changes (a link to another tab on
  // this same page, the back button) - neither reloads the page.
  useEffect(() => {
    const apply = () => {
      const want = (Object.entries(TAB_HASH) as [TabId, string][]).find(([, h]) => h === window.location.hash)?.[0];
      if (want) setTab(want);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const selectTab = (t: TabId) => {
    setTab(t);
    window.history.replaceState(null, "", TAB_HASH[t]);
  };

  // The hub-wide period (presets and custom), the same one every report uses.
  // It picks the tickets by the day they were RAISED; the calendar is the one
  // view that keeps every day, since paging through months is its whole point.
  const { window: win, label: periodLabel } = useReportingWindow();

  // A click on Refresh asks HubSpot again; the five-minute poll reads the shared cache.
  const ticketsUrl = forced ? `/api/uc/erosion/tickets?refresh=1&n=${forced}` : "/api/uc/erosion/tickets";
  const ticketsHeld = useHeld<ErosionTickets>(ticketsUrl, [ticketsUrl, tick]);
  const forecastHeld = useHeld<ErosionForecast>("/api/uc/erosion/forecast", [tick, forced]);
  const refresh = () => setForced((n) => n + 1);

  const tr = ticketsHeld.result;
  const fr = forecastHeld.result;
  const tickets = useMemo(() => (tr?.state === "ok" ? tr.data.tickets : []), [tr]);
  const inPeriod = useMemo(
    () => tickets.filter((t) => t.created >= win.from && t.created <= win.to),
    [tickets, win.from, win.to],
  );
  const forecast = fr?.state === "ok" ? fr.data : null;
  const items = useMemo(() => forecast?.items ?? [], [forecast]);

  const busy = tr === null || fr === null || ticketsHeld.stale || forecastHeld.stale;
  const header = (
    <PageHeader
      title="Erosion on article level"
      subtitle="Customers whose yearly reorder has lapsed, the tickets raised for them, and what ESO and TSA did"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <WindowPicker />
          <Tooltip title="Ask HubSpot and the connector again">
            <IconButton size="small" onClick={refresh} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
          </Tooltip>
        </Box>
      }
    />
  );

  if (tr === null && fr === null) {
    return <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>{header}<LoadingPanel label="Reading the erosion tickets from HubSpot…" /></Box>;
  }

  const ok = tr?.state === "ok";
  const open = inPeriod.filter((t) => !isClosed(t)).length;
  const closed = inPeriod.length - open;
  const wonCount = inPeriod.filter(isWon).length;
  const atRisk = items.reduce((s, it) => s + it.amount, 0);
  const summary = forecast?.summary ?? null;
  const idleDays = summary?.lastRun ? daysBetween(summary.lastRun, localDay(new Date())) : null;

  const forecastNote =
    fr === null ? (
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.5 }}>Reading the forecast…</Typography>
    ) : fr.state === "not-configured" ? (
      <Notice tone="warn">
        The forecast is not connected, so only tickets already raised are drawn. It lives on the Compass connector and is read with
        {" "}{fr.missing.join(", ") || "the connector's read-only key"}, which this deployment does not have yet.
      </Notice>
    ) : fr.state === "error" ? (
      <Notice tone="warn">The forecast could not be read, so only tickets already raised are drawn. {fr.error}</Notice>
    ) : null;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2.5 }}>
      <Box>
        {header}

        {idleDays !== null && idleDays > 1 && (
          <Notice tone="bad">
            The detector last ran on {summary?.lastRun}, {idleDays} days ago. It runs after each nightly Compass delta on the connector; if this
            persists, check the connector&apos;s chain.
          </Notice>
        )}

        {tr?.state === "not-configured" && <NotConnectedPanel source="HubSpot" missing={tr.missing} />}
        {tr?.state === "error" && <UpstreamPanel source="HubSpot (erosion tickets)" error={tr.error} status={tr.status} onRetry={refresh} />}
        {ok && tr.data.notesError && <Notice tone="warn">{tr.data.notesError}. Closed tickets show their resolution field only.</Notice>}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ConfirmationNumberOutlinedIcon />} label="Tickets raised" value={ok ? full(inPeriod.length) : "—"}
            note={`${periodLabel} · ${ok ? full(tickets.length) : "—"} since the start`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<HourglassEmptyIcon />} tint="amber" label="Open now" value={ok ? full(open) : "—"}
            note="of those, not yet in a closed stage" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<TaskAltIcon />} tint="green" label="Closed" value={ok ? full(closed) : "—"}
            note={inPeriod.length ? `${percent(closed / inPeriod.length, 0)} of them · ${wonCount} won` : "of those"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EuroIcon />} tint="pink" label="At stake to 31 December" value={forecast ? `${eur(atRisk)} EUR` : "—"}
            note={forecast ? `${full(forecastTicketCount(items))} tickets expected · ahead, whatever the period` : "needs the forecast"} />
        </Grid>
      </Grid>

      <Box>
        <ErosionTabs
          tab={tab}
          onSelect={selectTab}
          tabs={[
            { id: "calendar", label: "Calendar", count: forecast ? full(forecastTicketCount(items)) : null },
            { id: "results", label: "Win rate & resolution", count: ok && closed ? percent(wonCount / closed, 0) : null },
            { id: "people", label: "Teams & people", count: ok ? full(new Set(inPeriod.map((t) => t.owner)).size) : null },
            { id: "tickets", label: "All erosion tickets", count: ok ? full(inPeriod.length) : null },
          ]}
        />
      </Box>

      <Box role="tabpanel" id={`erosion-panel-${tab}`} aria-labelledby={`erosion-tab-${tab}`}>
        {tab === "calendar" && (
          <Calendar tickets={tickets} items={items} horizonDays={forecast?.horizonDays ?? 0} forecastNote={forecastNote} />
        )}
        {tab !== "calendar" && !ok && (
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
            This view needs the tickets from HubSpot, which did not load - the reason is shown above.
          </Typography>
        )}
        {tab === "results" && ok && <OutcomeReport tickets={inPeriod} period={periodLabel} stale={ticketsHeld.stale} />}
        {tab === "people" && ok && <TeamsReport tickets={inPeriod} period={periodLabel} stale={ticketsHeld.stale} />}
        {tab === "tickets" && ok && <AllTickets tickets={inPeriod} period={periodLabel} />}
      </Box>

      <Box>
        {summary && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
            Detector last ran {summary.lastRun ?? "—"}
            {summary.createdToday !== null ? ` and raised ${summary.createdToday}` : ""}
            {summary.mergedToday ? `, added ${summary.mergedToday} article${summary.mergedToday === 1 ? "" : "s"} to tickets raised earlier this month` : ""}
            {summary.skippedOpenOrderToday ? `, held back ${summary.skippedOpenOrderToday} on orders not invoiced yet` : ""}
            {summary.skippedOwnerToday ? `, skipped ${summary.skippedOwnerToday} whose owner is on neither roster` : ""}.
          </Typography>
        )}
        {ok && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>
            Tickets read from HubSpot {new Date(tr.data.generatedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}; status and
            owner are live, amounts are last year&apos;s invoiced revenue on the lapsed articles.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
