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
import Chip from "@mui/material/Chip";
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import {
  DISPLAY, GUTTER, HAIRLINE, INK, LoadingPanel, MUTED, NotConnectedPanel, Section, UpstreamPanel,
} from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { DELTA, SEQUENTIAL, SERIES } from "@/app/charts/palette";
import { full, percent } from "@/app/charts/format";
import {
  WON_RESOLUTIONS, average, dayCells, daysBetween, forecastTicketCount, isClosed, isWon, localDay, outcomeLabel,
  resolutionTally, resolutionText, scoreboard, topReason, winRate,
  type DayCell, type ErosionForecast, type ErosionTicket, type ErosionTickets, type ForecastItem, type OwnerRow,
  type ScoreRow, type Team,
} from "@/lib/erosion/model";

const PORTAL = "26492587";
const hsTicket = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;

const BLUE = SERIES[0];
const ORANGE = SERIES[1];
const GREEN = SERIES[2];
const AMBER = "#b26a00";
const OPEN_FILL = "#f3d9b1";
const TRACK = "#eef0f3";

/** Tickets raised (green) and forecast (blue), five steps each, light to dark. */
const CREATED_RAMP = ["#ddf3ea", "#b3e4cf", "#7ccfae", "#3cb889", "#16875f"];
const FORECAST_RAMP = [SEQUENTIAL[0], SEQUENTIAL[1], SEQUENTIAL[2], SEQUENTIAL[3], SEQUENTIAL[5]];
const DARK = new Set([CREATED_RAMP[3], CREATED_RAMP[4], FORECAST_RAMP[3], FORECAST_RAMP[4]]);

function ramp(colors: string[], count: number, max: number): string | null {
  if (count <= 0) return null;
  const i = Math.min(colors.length - 1, Math.max(0, Math.ceil((count / Math.max(max, 1)) * colors.length) - 1));
  return colors[i];
}

const eur = (n: number) => full(Math.round(n));
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE = 20;
const POLL_MS = 5 * 60_000;

/* ── small pieces ─────────────────────────────────────────────────────── */

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
      <Typography sx={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: "1.02rem", color: INK, flex: 1, minWidth: 180 }}>
        {title}
      </Typography>
      {right}
    </Box>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", mb: 1 }}>
      {children}
    </Typography>
  );
}

/** Status reads in words and an icon, never in colour alone. */
function StageChip({ t }: { t: ErosionTicket }) {
  const closed = isClosed(t);
  const fresh = !closed && /new/i.test(t.stage);
  return (
    <Chip
      size="small"
      icon={closed ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
      label={t.stage || "—"}
      sx={{
        height: 22, fontSize: "0.7rem", fontWeight: 600,
        bgcolor: closed ? "#e6f6ef" : fresh ? "#e8f0f9" : "#fdf1e2",
        color: closed ? "#11704f" : fresh ? "#1f5486" : AMBER,
        "& .MuiChip-icon": { fontSize: 14, color: "inherit", ml: 0.6 },
      }}
    />
  );
}

function TeamChip({ team }: { team: Team | null }) {
  return (
    <Chip
      size="small"
      label={team ?? "—"}
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: team === "ESO" ? "#e8f0f9" : team === "TSA" ? "#fdeee6" : "#f1f3f5", color: INK }}
    />
  );
}

function HsLink({ id }: { id: string }) {
  return (
    <Tooltip title="Open in HubSpot">
      <IconButton size="small" href={hsTicket(id)} target="_blank" rel="noreferrer" aria-label="Open in HubSpot">
        <OpenInNewIcon sx={{ fontSize: 15, color: BLUE }} />
      </IconButton>
    </Tooltip>
  );
}

function Notice({ tone, children }: { tone: "bad" | "warn"; children: React.ReactNode }) {
  const c = tone === "bad" ? DELTA.bad : AMBER;
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1.5, mb: 2, border: `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${c}`, borderRadius: 2, bgcolor: "#fff" }}>
      <WarningAmberIcon sx={{ fontSize: 18, color: c, mt: "1px" }} />
      <Typography sx={{ fontSize: "0.84rem", color: INK }}>{children}</Typography>
    </Box>
  );
}

const headCell = { color: MUTED, fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", whiteSpace: "nowrap" as const };
const clip = (max: number) => ({ maxWidth: max, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" });

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
    <Section sx={{ mb: 2.5 }}>
      <CardHead
        title="Tickets raised and expected"
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
    </Section>
  );
}

/* ── what the action achieved ─────────────────────────────────────────── */

/** Won share of the closed tickets: green won, sand the rest. */
function WinBar({ won, closed, height = 10 }: { won: number; closed: number; height?: number }) {
  const pct = closed ? (won / closed) * 100 : 0;
  return (
    <Box sx={{ height, borderRadius: 99, overflow: "hidden", display: "flex", bgcolor: TRACK }} title={`${won} won of ${closed} closed`}>
      {won > 0 && <Box sx={{ width: `${pct}%`, bgcolor: GREEN }} />}
      {closed - won > 0 && <Box sx={{ flex: 1, bgcolor: OPEN_FILL }} />}
    </Box>
  );
}

function TeamPanel({ team, r }: { team: Team; r: ScoreRow }) {
  const avg = average(r.closeDays);
  const rate = winRate(r);
  const top = topReason(r);
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.4, p: 2, height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap", mb: 1.25 }}>
        <Typography sx={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.15rem", color: INK }}>{team}</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          {r.n} tickets · {r.open} open · {r.closed} closed{avg === null ? "" : ` · ${avg.toFixed(1)} days to close`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
        <Box sx={{ flex: 1 }}><WinBar won={r.won} closed={r.closed} height={12} /></Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {rate === null ? "—" : percent(rate, 0)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.25 }}>
        <b style={{ color: INK }}>{r.won} won</b> of {r.closed} closed · {eur(r.wonEur)} EUR won back
      </Typography>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        Most given reason: <b style={{ color: INK }}>{top ? `${top.label} (${top.count})` : "—"}</b>
      </Typography>
    </Box>
  );
}

type OwnerSort = "won" | "rate" | "wonEur" | "n";

function ByPerson({ owners }: { owners: OwnerRow[] }) {
  const [sort, setSort] = useState<OwnerSort>("won");
  const rows = useMemo(() => [...owners].sort((a, b) => {
    if (sort === "rate") {
      // an owner with nothing closed has no rate yet - last, not 0 %
      const ra = winRate(a), rb = winRate(b);
      if (ra === null || rb === null) return ra === null && rb === null ? b.n - a.n : ra === null ? 1 : -1;
      return rb - ra || b.closed - a.closed;
    }
    if (sort === "wonEur") return b.wonEur - a.wonEur || b.won - a.won;
    if (sort === "n") return b.n - a.n || b.won - a.won;
    return b.won - a.won || (winRate(b) ?? -1) - (winRate(a) ?? -1);
  }), [owners, sort]);
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.25, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1 }}><Kicker>Per person</Kicker></Box>
        {([["won", "Won"], ["rate", "Win rate"], ["wonEur", "EUR won"], ["n", "Tickets"]] as const).map(([k, label]) => (
          <Chip key={k} size="small" label={label} clickable onClick={() => setSort(k)}
            sx={{ height: 24, fontSize: "0.72rem", fontWeight: 600, bgcolor: sort === k ? INK : "#f1f3f5", color: sort === k ? "#fff" : MUTED }} />
        ))}
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow>
            {["#", "Owner", "Team", "Tickets", "Closed", "Won", "Win rate", "EUR won", "Most given reason", "Days to close"].map((h) => (
              <TableCell key={h} sx={headCell}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody>
            {rows.map((r, i) => {
              const avg = average(r.closeDays);
              const rate = winRate(r);
              const top = topReason(r);
              return (
                <TableRow key={r.owner} hover>
                  <TableCell sx={{ fontSize: "0.76rem", color: MUTED, width: 28 }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>{r.owner}</TableCell>
                  <TableCell><TeamChip team={r.team} /></TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
                    {r.n}{r.open ? <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}> · {r.open} open</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>{r.closed}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.won ? "#11704f" : MUTED }}>{r.won}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 84 }}><WinBar won={r.won} closed={r.closed} /></Box>
                      <Typography sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: rate === null ? MUTED : INK }}>
                        {rate === null ? "—" : percent(rate, 0)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: r.wonEur ? INK : MUTED }}>{eur(r.wonEur)}</TableCell>
                  <TableCell sx={{ fontSize: "0.78rem", ...clip(220) }} title={top ? `${top.label} (${top.count})` : ""}>
                    {top ? `${top.label} (${top.count})` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: avg === null ? MUTED : INK }}>{avg === null ? "—" : avg.toFixed(0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

const CLOSED_PREVIEW = 12;

function ClosedList({ tickets, reason, onClear }: { tickets: ErosionTicket[]; reason: string | null; onClear: () => void }) {
  const [all, setAll] = useState(false);
  const closed = useMemo(
    () => tickets
      .filter((t) => isClosed(t) && (reason === null || outcomeLabel(t) === reason))
      .sort((a, b) => (b.closed ?? "").localeCompare(a.closed ?? "")),
    [tickets, reason],
  );
  const shown = all ? closed : closed.slice(0, CLOSED_PREVIEW);
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Kicker>{reason ? `Closed as “${reason}” — ${closed.length}` : `The ${closed.length} closed tickets, latest first`}</Kicker>
        {reason && <Chip size="small" label="Show all reasons" onDelete={onClear} onClick={onClear} sx={{ height: 22, fontSize: "0.7rem", mb: 1 }} />}
      </Box>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {shown.map((t) => {
          const res = resolutionText(t);
          const won = isWon(t);
          const days = t.closed && t.created ? Math.max(0, daysBetween(t.created, t.closed)) : null;
          return (
            <Box key={t.id} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.25, border: `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${won ? GREEN : res.missing ? AMBER : "#c9ced6"}`, borderRadius: 2 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{t.company ?? "—"}</Typography>
                  {won && <Chip size="small" icon={<CheckCircleIcon />} label="Won" sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: "#e6f6ef", color: "#11704f", "& .MuiChip-icon": { fontSize: 13, color: "inherit" } }} />}
                  <TeamChip team={t.team} />
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{t.owner}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{eur(t.amount)} EUR</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>closed {t.closed}{days !== null ? ` · ${days} day${days === 1 ? "" : "s"} after it was raised` : ""}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.82rem", color: res.missing ? AMBER : INK, mt: 0.4 }}>{res.text}</Typography>
              </Box>
              <HsLink id={t.id} />
            </Box>
          );
        })}
      </Box>
      {closed.length > CLOSED_PREVIEW && (
        <Button size="small" onClick={() => setAll((v) => !v)} sx={{ mt: 1 }}>
          {all ? "Show fewer" : `Show all ${closed.length}`}
        </Button>
      )}
    </Box>
  );
}

function Results({ tickets, board, stale }: { tickets: ErosionTicket[]; board: ReturnType<typeof scoreboard>; stale: boolean }) {
  const [reason, setReason] = useState<string | null>(null);
  const tally = useMemo(() => resolutionTally(tickets), [tickets]);
  const closed = tally.reduce((s, r) => s + r.count, 0);
  const won = tally.filter((r) => r.won).reduce((s, r) => s + r.count, 0);
  const wonEur = tally.filter((r) => r.won).reduce((s, r) => s + r.eur, 0);
  const top = tally[0] ?? null;
  return (
    <Section sx={{ mb: 2.5, opacity: stale ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <CardHead title="What the action achieved" />
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatTile label="Won back" value={full(won)} note={`${eur(wonEur)} EUR of last year's revenue on those articles`} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatTile label="Win rate" value={closed ? percent(won / closed, 0) : "—"} note={`${won} of ${closed} closed tickets ended in an order`} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatTile label="Most given reason" value={top ? top.label : "—"}
            note={top ? `${top.count} of ${closed} closed tickets (${percent(top.count / Math.max(closed, 1), 0)})` : undefined} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 2.5 }}>
        Won = closed as {[...WON_RESOLUTIONS].join(", ")}. “Bought at AP” is not counted: that customer bought from Angst+Pfister, not from APSOparts.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <ChartFrame
          title="Why the closed tickets closed"
          caption="One bar per reason given when the ticket was closed · click a reason to list its tickets"
          table={{
            columns: ["Reason", "Tickets", "Share of closed", "EUR", "Counts as won"],
            rows: tally.map((r) => [r.label, r.count, percent(r.count / Math.max(closed, 1), 0), eur(r.eur), r.won ? "yes" : "no"]),
            numeric: [1, 2, 3],
          }}
          empty={closed ? null : "Nothing closed yet."}
        >
          <BarList
            rows={tally.map((r) => ({
              label: r.label,
              value: r.count,
              secondary: `${percent(r.count / Math.max(closed, 1), 0)}${r.won ? " · won" : ""}`,
            }))}
            format={full}
            labelWidth={260}
            onSelect={(label) => setReason((cur) => (cur === label ? null : label))}
            selectedLabel={reason}
          />
        </ChartFrame>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(["ESO", "TSA"] as const).map((team) => (
          <Grid key={team} size={{ xs: 12, lg: 6 }}>
            <TeamPanel team={team} r={board.teams[team]} />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 3 }}>
        <ByPerson owners={board.owners} />
      </Box>

      <ClosedList tickets={tickets} reason={reason} onClear={() => setReason(null)} />
    </Section>
  );
}

/* ── all tickets ──────────────────────────────────────────────────────── */

function AllTickets({ tickets }: { tickets: ErosionTicket[] }) {
  const [page, setPage] = useState(0);
  const rows = tickets.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <Section>
      <CardHead title={`All erosion tickets (${tickets.length})`} />
      {tickets.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No tickets yet. They appear here as soon as the detector raises them.</Typography>
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
    </Section>
  );
}

/* ── the page ─────────────────────────────────────────────────────────── */

export default function ErosionApp() {
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);

  // A click on Refresh asks HubSpot again; the five-minute poll reads the shared cache.
  const ticketsUrl = forced ? `/api/uc/erosion/tickets?refresh=1&n=${forced}` : "/api/uc/erosion/tickets";
  const ticketsHeld = useHeld<ErosionTickets>(ticketsUrl, [ticketsUrl, tick]);
  const forecastHeld = useHeld<ErosionForecast>("/api/uc/erosion/forecast", [tick, forced]);
  const refresh = () => setForced((n) => n + 1);

  const tr = ticketsHeld.result;
  const fr = forecastHeld.result;
  const tickets = useMemo(() => (tr?.state === "ok" ? tr.data.tickets : []), [tr]);
  const forecast = fr?.state === "ok" ? fr.data : null;
  const items = useMemo(() => forecast?.items ?? [], [forecast]);
  const board = useMemo(() => scoreboard(tickets), [tickets]);

  const busy = tr === null || fr === null || ticketsHeld.stale || forecastHeld.stale;
  const header = (
    <PageHeader
      title="Erosion on article level"
      subtitle="Customers whose yearly reorder has lapsed, the tickets raised for them, and what ESO and TSA did"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
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

  const open = tickets.filter((t) => !isClosed(t)).length;
  const closed = tickets.length - open;
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
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      {header}

      {idleDays !== null && idleDays > 1 && (
        <Notice tone="bad">
          The detector last ran on {summary?.lastRun}, {idleDays} days ago. It runs after each nightly Compass delta on the connector; if this
          persists, check the connector&apos;s chain.
        </Notice>
      )}

      {tr?.state === "not-configured" && <Box sx={{ mb: 2.5 }}><NotConnectedPanel source="HubSpot" missing={tr.missing} /></Box>}
      {tr?.state === "error" && (
        <Box sx={{ mb: 2.5 }}><UpstreamPanel source="HubSpot (erosion tickets)" error={tr.error} status={tr.status} onRetry={refresh} /></Box>
      )}
      {tr?.state === "ok" && tr.data.notesError && <Notice tone="warn">{tr.data.notesError}. Closed tickets show their resolution field only.</Notice>}

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Tickets raised" value={tr?.state === "ok" ? full(tickets.length) : "—"}
            note={summary?.watermark ? `since the detector started on ${summary.watermark}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Open now" value={tr?.state === "ok" ? full(open) : "—"} note="not yet in a closed stage" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Closed" value={tr?.state === "ok" ? full(closed) : "—"}
            note={tickets.length ? `${percent(closed / tickets.length, 0)} of all tickets` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="At stake to 31 December" value={forecast ? `${eur(atRisk)} EUR` : "—"}
            note={forecast ? `${full(forecastTicketCount(items))} tickets expected · last year's revenue on the lapsed articles` : "needs the forecast"} />
        </Grid>
      </Grid>

      <Calendar tickets={tickets} items={items} horizonDays={forecast?.horizonDays ?? 0} forecastNote={forecastNote} />

      {tr?.state === "ok" && (
        <>
          <Results tickets={tickets} board={board} stale={ticketsHeld.stale} />
          <AllTickets tickets={tickets} />
        </>
      )}

      {summary && (
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 3 }}>
          Detector last ran {summary.lastRun ?? "—"}
          {summary.createdToday !== null ? ` and raised ${summary.createdToday}` : ""}
          {summary.mergedToday ? `, added ${summary.mergedToday} article${summary.mergedToday === 1 ? "" : "s"} to tickets raised earlier this month` : ""}
          {summary.skippedOpenOrderToday ? `, held back ${summary.skippedOpenOrderToday} on orders not invoiced yet` : ""}
          {summary.skippedOwnerToday ? `, skipped ${summary.skippedOwnerToday} whose owner is on neither roster` : ""}.
        </Typography>
      )}
      {tr?.state === "ok" && (
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: summary ? 0.5 : 3 }}>
          Tickets read from HubSpot {new Date(tr.data.generatedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}; status and
          owner are live, amounts are last year&apos;s invoiced revenue on the lapsed articles.
        </Typography>
      )}
    </Box>
  );
}
