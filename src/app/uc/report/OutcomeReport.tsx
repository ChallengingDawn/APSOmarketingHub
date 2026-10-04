"use client";

// WHAT A USE CASE ACHIEVED - the outcome report every UC app shows for its tickets:
// how many were won, the win rate, the reasons given at closing, the two teams, and
// each person. It takes the tickets of the period already filtered, so the period
// picker on the page decides what every figure here describes. Erosion is the
// first user; Price checks and the rest feed it their own tickets.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PercentIcon from "@mui/icons-material/Percent";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import BarChartIcon from "@mui/icons-material/BarChart";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { BarList } from "@/app/charts/BarList";
import { full, percent } from "@/app/charts/format";
import {
  WON_RESOLUTIONS, average, daysBetween, isClosed, isWon, outcomeLabel, resolutionTally, resolutionText, topReason, winRate,
  scoreboard, type ErosionTicket, type OwnerRow, type ScoreRow, type Team,
} from "@/lib/erosion/model";
import {
  AMBER, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, HsLink, INK, KpiTile, Kicker, MUTED, TINT, TeamChip, WinBar,
  bodyCell, clip, eur, glass, headCell,
} from "./ui";

/* ── the teams ────────────────────────────────────────────────────────── */

function TeamPanel({ team, r }: { team: Team; r: ScoreRow }) {
  const avg = average(r.closeDays);
  const rate = winRate(r);
  const top = topReason(r);
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <TeamChip team={team} />
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
          {r.n} tickets · {r.open} open · {r.closed} closed{avg === null ? "" : ` · ${avg.toFixed(1)} days to close`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em", color: INK, fontVariantNumeric: "tabular-nums" }}>
          {rate === null ? "—" : percent(rate, 0)}
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>win rate · {r.won} won of {r.closed} closed</Typography>
      </Box>
      <WinBar won={r.won} closed={r.closed} height={10} />
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          <b style={{ color: INK }}>{eur(r.wonEur)} EUR</b> won back
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          Most given: <b style={{ color: INK }}>{top ? `${top.label} (${top.count})` : "—"}</b>
        </Typography>
      </Box>
    </Box>
  );
}

/* ── each person ──────────────────────────────────────────────────────── */

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
    <GlassCard>
      <CardTitle
        icon={<GroupsOutlinedIcon />}
        tint="purple"
        title="Per person"
        note="Won, win rate and the reason each person gives most"
        right={
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {([["won", "Won"], ["rate", "Win rate"], ["wonEur", "EUR won"], ["n", "Tickets"]] as const).map(([k, label]) => (
              <Chip key={k} size="small" label={label} clickable onClick={() => setSort(k)}
                sx={{ height: 26, fontSize: "0.74rem", fontWeight: 600, borderRadius: "9px",
                  bgcolor: sort === k ? TINT.blue.bg : "rgba(255,255,255,.7)", color: sort === k ? TINT.blue.fg : MUTED,
                  border: `1px solid ${sort === k ? "transparent" : HAIRLINE}` }} />
            ))}
          </Box>
        }
      />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 920 }}>
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
                  <TableCell sx={{ ...bodyCell, fontSize: "0.76rem", color: FAINT, width: 28 }}>{i + 1}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{r.owner}</TableCell>
                  <TableCell sx={bodyCell}><TeamChip team={r.team} /></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>
                    {r.n}{r.open ? <Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT }}> · {r.open} open</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{r.closed}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.won ? GREEN : FAINT }}>{r.won}</TableCell>
                  <TableCell sx={{ ...bodyCell, minWidth: 150 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 84 }}><WinBar won={r.won} closed={r.closed} height={8} /></Box>
                      <Typography sx={{ fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: rate === null ? FAINT : INK }}>
                        {rate === null ? "—" : percent(rate, 0)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: r.wonEur ? INK : FAINT }}>{eur(r.wonEur)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", ...clip(220) }} title={top ? `${top.label} (${top.count})` : ""}>
                    {top ? `${top.label} (${top.count})` : "—"}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: avg === null ? FAINT : INK }}>{avg === null ? "—" : avg.toFixed(0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

/* ── the closed tickets ───────────────────────────────────────────────── */

const CLOSED_PAGE = 10;

function ClosedList({ tickets, reason, onClear }: { tickets: ErosionTicket[]; reason: string | null; onClear: () => void }) {
  const [page, setPage] = useState(0);
  // a new reason, or a new period, is a new list: start it at its first page
  useEffect(() => setPage(0), [reason, tickets]);
  const closed = useMemo(
    () => tickets
      .filter((t) => isClosed(t) && (reason === null || outcomeLabel(t) === reason))
      .sort((a, b) => (b.closed ?? "").localeCompare(a.closed ?? "")),
    [tickets, reason],
  );
  const shown = closed.slice(page * CLOSED_PAGE, page * CLOSED_PAGE + CLOSED_PAGE);
  return (
    <GlassCard>
      <CardTitle
        icon={<TaskAltIcon />}
        tint="green"
        title={reason ? `Closed as “${reason}”` : "The closed tickets"}
        note={`${full(closed.length)} ticket${closed.length === 1 ? "" : "s"}, latest first`}
        right={reason ? <Chip size="small" label="Show all reasons" onDelete={onClear} onClick={onClear} sx={{ height: 26, fontSize: "0.74rem", borderRadius: "9px" }} /> : undefined}
      />
      {closed.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing closed in this period.</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 0.85 }}>
          {shown.map((t) => {
            const res = resolutionText(t);
            const won = isWon(t);
            const days = t.closed && t.created ? Math.max(0, daysBetween(t.created, t.closed)) : null;
            return (
              <Box key={t.id} sx={{
                display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.5, borderRadius: "14px",
                bgcolor: "rgba(255,255,255,.65)", border: `1px solid ${HAIRLINE}`,
                borderLeft: `3px solid ${won ? "#22a06b" : res.missing ? AMBER : "#c9d0db"}`,
              }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{t.company ?? "—"}</Typography>
                    {won && <Chip size="small" icon={<CheckCircleIcon />} label="Won" sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: TINT.green.bg, color: TINT.green.fg, "& .MuiChip-icon": { fontSize: 13, color: "inherit" } }} />}
                    <TeamChip team={t.team} />
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{t.owner}</Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{eur(t.amount)} EUR</Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>closed {t.closed}{days !== null ? ` · ${days} day${days === 1 ? "" : "s"} after it was raised` : ""}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.84rem", color: res.missing ? AMBER : INK, mt: 0.4 }}>{res.text}</Typography>
                </Box>
                <HsLink id={t.id} />
              </Box>
            );
          })}
        </Box>
      )}
      {closed.length > CLOSED_PAGE && (
        <TablePagination component="div" count={closed.length} page={page} rowsPerPage={CLOSED_PAGE} rowsPerPageOptions={[CLOSED_PAGE]}
          onPageChange={(_, p) => setPage(p)} sx={{ borderTop: `1px solid ${HAIRLINE}`, mt: 1.5 }} />
      )}
    </GlassCard>
  );
}

/* ── the report ───────────────────────────────────────────────────────── */

export function OutcomeReport({ tickets, period, stale }: {
  /** The tickets RAISED in the period - already filtered by the page's picker. */
  tickets: ErosionTicket[];
  /** "Last 28 days", "1 Sep – 30 Sep 2026" … as the picker states it. */
  period: string;
  stale: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const tally = useMemo(() => resolutionTally(tickets), [tickets]);
  const board = useMemo(() => scoreboard(tickets), [tickets]);
  // a reason that is not in the new period's list would filter to nothing
  useEffect(() => { if (reason && !tally.some((r) => r.label === reason)) setReason(null); }, [tally, reason]);
  const closed = tally.reduce((s, r) => s + r.count, 0);
  const won = tally.filter((r) => r.won).reduce((s, r) => s + r.count, 0);
  const wonEur = tally.filter((r) => r.won).reduce((s, r) => s + r.eur, 0);
  const top = tally[0] ?? null;

  return (
    <Box sx={{ display: "grid", gap: 2.5, opacity: stale ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiTile icon={<EmojiEventsOutlinedIcon />} tint="green" label="Won back" value={full(won)}
            note={`${eur(wonEur)} EUR of last year's revenue · ${period}`} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiTile icon={<PercentIcon />} tint="blue" label="Win rate" value={closed ? percent(won / closed, 0) : "—"}
            note={`${won} of ${closed} closed tickets ended in an order`} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiTile icon={<ChatBubbleOutlineIcon />} tint="purple" label="Most given reason" value={top ? top.label : "—"}
            note={top ? `${top.count} of ${closed} closed tickets (${percent(top.count / Math.max(closed, 1), 0)})` : "nothing closed in this period"} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: -1 }}>
        Won = closed as {[...WON_RESOLUTIONS].join(", ")}. A one-shot order (catalogue or C2S) is a single purchase, not the customer
        coming back, and “Bought at AP” went to Angst+Pfister: all three count as lost.
      </Typography>

      <GlassCard>
        <CardTitle
          icon={<BarChartIcon />}
          title="Why the closed tickets closed"
          note="One bar per reason given at closing · click a reason to list its tickets"
          right={
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}
              sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontSize: "0.76rem", px: 1.5, py: 0.4, borderColor: HAIRLINE, borderRadius: "9px", color: MUTED },
                "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": { bgcolor: TINT.blue.bg, color: TINT.blue.fg } }}>
              <ToggleButton value="chart">Chart</ToggleButton>
              <ToggleButton value="table">Table</ToggleButton>
            </ToggleButtonGroup>
          }
        />
        {closed === 0 ? (
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing closed in this period.</Typography>
        ) : view === "chart" ? (
          <BarList
            rows={tally.map((r) => ({ label: r.label, value: r.count, secondary: `${percent(r.count / closed, 0)}${r.won ? " · won" : ""}` }))}
            format={full}
            labelWidth={260}
            onSelect={(label) => setReason((cur) => (cur === label ? null : label))}
            selectedLabel={reason}
          />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {["Reason", "Tickets", "Share of closed", "EUR", "Counts as won"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {tally.map((r) => (
                  <TableRow key={r.label} hover onClick={() => setReason((cur) => (cur === r.label ? null : r.label))} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: reason === r.label ? 700 : 500 }}>{r.label}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{r.count}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{percent(r.count / closed, 0)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{eur(r.eur)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: r.won ? GREEN : FAINT, fontWeight: r.won ? 700 : 400 }}>{r.won ? "yes" : "no"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </GlassCard>

      <Grid container spacing={2}>
        {(["ESO", "TSA"] as const).map((team) => (
          <Grid key={team} size={{ xs: 12, lg: 6 }}><TeamPanel team={team} r={board.teams[team]} /></Grid>
        ))}
      </Grid>

      <ByPerson owners={board.owners} />

      <ClosedList tickets={tickets} reason={reason} onClear={() => setReason(null)} />

      {tickets.length > 0 && <Kicker>Every figure here counts the tickets raised in the period: {period}</Kicker>}
    </Box>
  );
}
