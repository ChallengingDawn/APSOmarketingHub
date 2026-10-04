"use client";

// SEPTEMBER PUSH - the order-intake push of 14 to 30 September 2026.
//
// Moved from the APSOAssistant micro apps (05.10.2026); every account checked
// against the connector's /push/status on the day of the move. Two levels: the
// company month against the 2.1 M target, and the 517 target accounts against
// the ask each one was given. The plan's `tier` field holds the call WAVE
// (Week 1/2/3, E-mail) - the old screen filtered it as tiers A/B/C, which matched nothing.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import RefreshIcon from "@mui/icons-material/Refresh";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ViewWeekOutlinedIcon from "@mui/icons-material/ViewWeekOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { compact, full } from "@/app/charts/format";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { ACCENT, CardTitle, GlassCard, GREEN, HAIRLINE, HsLink, INK, KpiTile, MUTED, TINT, TRACK, bodyCell, clip, eur, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { CAMPAIGNS, PUSH_STATUS_LABEL, pushSummary, type PushData, type PushStatus, type PushSummary } from "@/lib/oneshot/model";
import { CompanyLink, FilterChips, Meter, PeriodLine, SearchBox, dm, dmy, pctText } from "./parts";

const POLL_MS = 15 * 60_000;
type TabId = "score" | "accounts";
const TAB_HASH: Record<TabId, string> = { score: "#scoreboard", accounts: "#accounts" };

function StatusChip({ s }: { s: PushStatus }) {
  const c = s === "done" ? TINT.green : s === "partial" ? TINT.blue : s === "closed" ? TINT.amber : TINT.slate;
  return <Chip size="small" label={PUSH_STATUS_LABEL[s]} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />;
}

function Bar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 130 }}>
      <Box sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
        <Box sx={{ width: `${w}%`, height: "100%", bgcolor: pct >= 100 ? GREEN : ACCENT, borderRadius: 99 }} />
      </Box>
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: INK, width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</Typography>
    </Box>
  );
}

type Row = PushSummary["cards"][number];

function AccountTable({ rows }: { rows: Row[] }) {
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(25);
  useEffect(() => setPage(0), [rows, per]);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Account</TableCell>
              <TableCell sx={headCell}>Rep</TableCell>
              <TableCell sx={headCell}>Wave</TableCell>
              <TableCell sx={headCell} align="right">Ask EUR</TableCell>
              <TableCell sx={headCell} align="right">Booked EUR</TableCell>
              <TableCell sx={headCell}>Of the ask</TableCell>
              <TableCell sx={headCell}>Result</TableCell>
              <TableCell sx={headCell}>Why on the list</TableCell>
              <TableCell sx={headCell}>Ticket</TableCell>
              <TableCell sx={headCell} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(page * per, page * per + per).map((c) => (
              <TableRow key={c.un} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clip(240) }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{c.un} · Prio {c.prio || "-"}{c.country ? ` · ${c.country}` : ""}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{c.rep}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: MUTED }}>{c.tier}{c.call_on ? ` · ${c.call_on}` : ""}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{eur(c.to_get)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: c.booked > 0 ? 700 : 400, color: c.booked > 0 ? GREEN : INK }} align="right">
                  {c.booked ? eur(c.booked) : ""}
                </TableCell>
                <TableCell sx={bodyCell}>{c.pct !== null && <Bar pct={c.pct} />}</TableCell>
                <TableCell sx={bodyCell}><StatusChip s={c.status} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.76rem", color: MUTED, ...clip(220) }} title={c.reasons.join(" · ")}>{c.reasons.join(" · ")}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: c.ticket?.closed ? MUTED : INK, ...clip(200) }}
                  title={c.ticket?.resolutionDetail ?? undefined}>
                  {c.ticket ? `${c.ticket.stage}${c.ticket.resolution ? ` · ${c.ticket.resolution}` : ""}` : "no ticket"}
                </TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} align="right">
                  <CompanyLink id={c.id} />
                  {c.ticket && <HsLink id={c.ticket.id} />}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={10} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No account matches.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <TablePagination component="div" count={rows.length} page={page} onPageChange={(_, p) => setPage(p)}
        rowsPerPage={per} onRowsPerPageChange={(e) => setPer(parseInt(e.target.value, 10))} rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Accounts per page" sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
    </>
  );
}

export function PushBoard() {
  const camp = CAMPAIGNS.sept;
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);
  const url = forced ? `/api/uc/oneshot/sept?refresh=1&n=${forced}` : "/api/uc/oneshot/sept";
  const held = useHeld<PushData>(url, [url, tick]);
  const refresh = () => setForced((n) => n + 1);

  const { window: win } = useReportingWindow();
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "score");
  const [rep, setRep] = useState("all");
  const [wave, setWave] = useState("all");
  const [status, setStatus] = useState<"all" | PushStatus>("all");
  const [q, setQ] = useState("");

  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  const s = useMemo(() => (data ? pushSummary(data, win.from, win.to) : null), [data, win.from, win.to]);
  const filtered = useMemo(() => {
    if (!s) return [];
    const needle = q.trim().toLowerCase();
    return s.cards.filter((c) => (rep === "all" || c.rep === rep) && (wave === "all" || c.tier === wave) && (status === "all" || c.status === status)
      && (!needle || c.name.toLowerCase().includes(needle) || c.un.includes(needle)));
  }, [s, rep, wave, status, q]);

  const header = (
    <PageHeader
      title={camp.name}
      subtitle={`${camp.line}. Company order intake against the 2.1 M month target, and each target account against its ask.`}
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <WindowPicker />
          <Tooltip title="Ask HubSpot again">
            <IconButton size="small" onClick={refresh} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
          </Tooltip>
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>{header}{children}</Box>
  );

  if (r === null) return shell(<LoadingPanel label="Reading September's orders and the SEPT PUSH tickets from HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (September push)" error={r.error} status={r.status} onRetry={refresh} />);
  if (!data || !s) return shell(null);

  const meta = data.meta;
  const daily = data.daily.map((d) => ({
    x: d.date,
    before: d.date < meta.start ? Math.round(d.rev) : null,
    push: d.date >= meta.start && d.date <= meta.end ? Math.round(d.rev) : null,
  }));
  const waves = [...new Set(s.cards.map((c) => c.tier))].sort();

  return shell(
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FlagOutlinedIcon />} label={s.monthOver ? "September booked" : "Booked this month"} value={`${compact(s.bookedMonth)} EUR`}
            note={`${pctText(s.bookedMonth, s.target)} of the ${compact(s.target)} target · ${eur(s.perDay)} EUR a working day`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<TrendingDownIcon />} tint={s.gap > 0 ? "pink" : "green"}
            label={s.monthOver ? (s.gap > 0 ? "Missed the target by" : "Beat the target by") : (s.gap > 0 ? "Gap at this pace" : "Ahead at this pace")}
            value={`${compact(Math.abs(s.gap))} EUR`}
            note={s.monthOver
              ? `all ${s.workingDaysTotal} working days counted · ${compact(s.bookedSinceStart)} EUR of it from ${dm(meta.start)}`
              : `projection ${compact(s.projection)} EUR · ${eur(s.neededPerDayLeft)} EUR a day needed from here`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<AdsClickOutlinedIcon />} tint="green" label="On the target accounts" value={`${eur(s.bookedOnTargets)} EUR`}
            note={`${pctText(s.bookedOnTargets, s.toGet)} of the ${compact(s.toGet)} EUR asked · ${full(s.accountsOrdered)} of ${full(s.cards.length)} accounts ordered`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="amber" label="Tickets closed" value={`${full(s.ticketsClosed)} of ${full(s.tickets)}`}
            note={`${full(s.accountsDone)} accounts reached their ask · ${full(s.cards.length - s.tickets)} accounts had no ticket`} />
        </Grid>
      </Grid>
      <PeriodLine {...s.window} start={meta.start} end={meta.end} />

      <Box>
        <ReportTabs name="push" tab={tab} onSelect={selectTab} tabs={[
          { id: "score", label: "Scoreboard", count: null },
          { id: "accounts", label: "Target accounts", count: full(s.cards.length) },
        ]} />
      </Box>

      {tab === "score" && (
        <Box id="push-panel-score" role="tabpanel" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
          <GlassCard>
            <CardTitle icon={<BarChartOutlinedIcon />} title="Order intake, day by day"
              note={`Every order of ${new Date(`${meta.month_start}T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}, all customers - the push ran ${dm(meta.start)} to ${dm(meta.end)}`} />
            <StackedColumns data={daily} parts={[{ key: "before", label: "Before the push" }, { key: "push", label: "During the push" }]}
              format={(v) => compact(v)} xFormat={(x) => x.slice(8, 10)} height={240} />
            <Box sx={{ mt: 2 }}>
              <Meter label={`Month against the ${compact(s.target)} target`} value={s.bookedMonth} of={s.target}
                color={s.bookedMonth >= s.target ? GREEN : ACCENT} text={`${eur(s.bookedMonth)} of ${eur(s.target)} EUR · ${pctText(s.bookedMonth, s.target)}`} />
            </Box>
          </GlassCard>

          <GlassCard>
            <CardTitle icon={<PeopleOutlineIcon />} tint="purple" title="Per rep" note="Their target accounts, booked in the period - click a rep to see their accounts" />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Rep", "Accounts", "Ask EUR", "Booked EUR", "Of the ask", "Ordered", "Ask reached", "Tickets closed"].map((h, i) => (
                      <TableCell key={h} sx={headCell} align={i && i !== 4 ? "right" : "left"}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.reps.map((x) => (
                    <TableRow key={x.rep} hover sx={{ cursor: "pointer" }} onClick={() => { setRep(x.rep); selectTab("accounts"); }}>
                      <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{x.rep}</TableCell>
                      <TableCell sx={bodyCell} align="right">{full(x.targets)}</TableCell>
                      <TableCell sx={bodyCell} align="right">{eur(x.toGet)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontWeight: 700, color: x.booked > 0 ? GREEN : INK }} align="right">{eur(x.booked)}</TableCell>
                      <TableCell sx={bodyCell}><Bar pct={x.pct} /></TableCell>
                      <TableCell sx={bodyCell} align="right">{full(x.ordered)} <Typography component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pctText(x.ordered, x.targets)}</Typography></TableCell>
                      <TableCell sx={bodyCell} align="right">{full(x.done)}</TableCell>
                      <TableCell sx={bodyCell} align="right">{full(x.ticketsClosed)} / {full(x.tickets)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<ViewWeekOutlinedIcon />} tint="green" title="Per call wave" note="When the account was due to be called - or e-mail only" />
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Wave", "Accounts", "Ordered", "Ask EUR", "Booked EUR", "Of the ask"].map((h, i) => (
                          <TableCell key={h} sx={headCell} align={i && i !== 5 ? "right" : "left"}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.waves.map((w) => (
                        <TableRow key={w.wave} hover sx={{ cursor: "pointer" }} onClick={() => { setWave(w.wave); selectTab("accounts"); }}>
                          <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{w.wave}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(w.targets)}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(w.ordered)} <Typography component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pctText(w.ordered, w.targets)}</Typography></TableCell>
                          <TableCell sx={bodyCell} align="right">{eur(w.toGet)}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontWeight: 700, color: w.booked > 0 ? GREEN : INK }} align="right">{eur(w.booked)}</TableCell>
                          <TableCell sx={bodyCell}><Bar pct={(100 * w.booked) / Math.max(1, w.toGet)} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </GlassCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<FactCheckOutlinedIcon />} tint="amber" title="Closed tickets - what they say"
                  note={`${full(s.ticketsClosed)} of ${full(s.tickets)} SEPT PUSH tickets closed; the resolution the owner chose`} />
                <BarList rows={s.outcomes.map((o) => ({ label: o.label, value: o.count }))} format={(v) => full(v)} labelWidth={200}
                  emptyMessage="No ticket closed yet." />
              </GlassCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {tab === "accounts" && (
        <Box id="push-panel-accounts" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25, mb: 1.5 }}>
              <CardTitle icon={<StorefrontOutlinedIcon />} title={`Target accounts (${full(filtered.length)})`}
                note={`${eur(filtered.reduce((a, c) => a + c.to_get, 0))} EUR asked · ${eur(filtered.reduce((a, c) => a + c.booked, 0))} EUR booked in the period - biggest ask first`}
                right={<SearchBox value={q} onChange={setQ} placeholder="Company or customer number" />} />
              <FilterChips value={rep} onChange={setRep} options={[{ id: "all", label: "All reps" }, ...meta.reps.map((x) => ({ id: x, label: x }))]} />
              <FilterChips value={wave} onChange={setWave} tint="purple" options={[{ id: "all", label: "All waves" }, ...waves.map((w) => ({ id: w, label: w }))]} />
              <FilterChips value={status} onChange={setStatus} tint="green" options={[
                { id: "all", label: "Any result" },
                ...(["done", "partial", "open", "closed"] as PushStatus[]).map((x) => ({ id: x, label: PUSH_STATUS_LABEL[x] })),
              ]} />
            </Box>
            <AccountTable rows={filtered} />
          </GlassCard>
        </Box>
      )}

      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        Read from HubSpot {data.generated.replace("T", " ").slice(0, 16)} UTC · {full(data.daily.reduce((a, d) => a + d.orders, 0))} orders in the month · target list ({full(data.cards.length)} accounts, plan of {dmy(String((meta as unknown as { generated?: string }).generated ?? ""))}) imported {/^\d{4}-\d{2}-\d{2}/.test(data.targetsImported ?? "") ? dmy(data.targetsImported!.slice(0, 10)) : "—"}.
      </Typography>
    </>,
  );
}
