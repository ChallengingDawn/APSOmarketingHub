"use client";

// MARC / NANCY CH PUSH - one board, two reactivation batches.
//
// Moved from the APSOAssistant micro apps (05.10.2026). The figures are the
// connector's (checked customer for customer against /marcpush/status on the
// day of the move) with one change: "contacted" also counts a call, e-mail or
// meeting logged on the customer's company, not only activity on the ticket -
// most calls are logged on the contact, so the ticket alone saw 5 of Marc's 30.

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
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import EuroIcon from "@mui/icons-material/Euro";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { TrendChart } from "@/app/charts/TrendChart";
import { ShareBar } from "@/app/charts/ShareBar";
import { BarList } from "@/app/charts/BarList";
import { compact, full } from "@/app/charts/format";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { CardTitle, GlassCard, GREEN, HAIRLINE, HsLink, INK, KpiTile, MUTED, Notice, TINT, bodyCell, clip, eur, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import {
  CAMPAIGNS, GROUP_LABEL, STATE_LABEL, callNext, contactDay, groupOf, reactivationSummary, stateOf,
  type Group, type ReCard, type ReState, type ReactivationData,
} from "@/lib/oneshot/model";
import { CompanyLink, FilterChips, Meter, PeriodLine, SearchBox, dm, dmy, pctText } from "./parts";

const POLL_MS = 5 * 60_000;
type TabId = "progress" | "next" | "all";
const TAB_HASH: Record<TabId, string> = { progress: "#progress", next: "#call-next", all: "#customers" };

type Data = ReactivationData & { contactSignal: boolean };

function GroupChip({ reason }: { reason: string }) {
  const g = groupOf(reason);
  const c = g === "dormant" ? TINT.pink : g === "declining" ? TINT.amber : TINT.blue;
  return (
    <Tooltip title={reason || GROUP_LABEL[g]}>
      <Chip size="small" label={GROUP_LABEL[g]} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />
    </Tooltip>
  );
}

function StateChip({ s }: { s: ReState }) {
  const c = s === "won" ? TINT.green : s === "contacted" ? TINT.blue : s === "closed" ? TINT.amber : TINT.slate;
  return <Chip size="small" label={STATE_LABEL[s]} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />;
}

function CustomerTable({ rows, start, mode }: { rows: ReCard[]; start: string; mode: "next" | "all" }) {
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(25);
  useEffect(() => setPage(0), [rows, per]);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Customer</TableCell>
              <TableCell sx={headCell}>Why</TableCell>
              <TableCell sx={headCell} align="right">Value EUR</TableCell>
              <TableCell sx={headCell} align="right">Potential EUR</TableCell>
              {mode === "all" && <TableCell sx={headCell}>Where it stands</TableCell>}
              <TableCell sx={headCell}>Ticket</TableCell>
              <TableCell sx={headCell}>Last contact</TableCell>
              {mode === "all" && <TableCell sx={headCell} align="right">Orders</TableCell>}
              {mode === "all" && <TableCell sx={headCell} align="right">Won back EUR</TableCell>}
              <TableCell sx={headCell} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(page * per, page * per + per).map((c) => {
              const rev = c.orders.reduce((a, o) => a + o.rev, 0);
              const last = contactDay(c, start);
              return (
                <TableRow key={c.un} hover>
                  <TableCell sx={bodyCell}>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clip(260) }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{c.un}</Typography>
                  </TableCell>
                  <TableCell sx={bodyCell}><GroupChip reason={c.reason} /></TableCell>
                  <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{eur(c.value)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", color: MUTED }} align="right">{eur(c.potential)}</TableCell>
                  {mode === "all" && <TableCell sx={bodyCell}><StateChip s={stateOf(c, start)} /></TableCell>}
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: c.ticket?.closed ? MUTED : INK }}>
                    {c.ticket ? `${c.ticket.stage}${c.ticket.closed && c.ticket.resolution ? ` · ${c.ticket.resolution}` : ""}` : "no ticket"}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: last ? INK : MUTED }}>{last ? dmy(last) : "not yet"}</TableCell>
                  {mode === "all" && <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{c.orders.length || ""}</TableCell>}
                  {mode === "all" && (
                    <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: rev > 0 ? 700 : 400, color: rev > 0 ? GREEN : INK }} align="right">
                      {rev ? eur(rev) : ""}
                    </TableCell>
                  )}
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} align="right">
                    {c.companyId && <CompanyLink id={c.companyId} />}
                    {c.ticket && <HsLink id={c.ticket.id} />}
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow><TableCell colSpan={10} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nobody here.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <TablePagination component="div" count={rows.length} page={page} onPageChange={(_, p) => setPage(p)}
        rowsPerPage={per} onRowsPerPageChange={(e) => setPer(parseInt(e.target.value, 10))} rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Customers per page" sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
    </>
  );
}

export function ReactivationBoard({ campaign }: { campaign: "marc" | "nancy" }) {
  const camp = CAMPAIGNS[campaign];
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);
  const url = forced ? `/api/uc/oneshot/${campaign}?refresh=1&n=${forced}` : `/api/uc/oneshot/${campaign}`;
  const held = useHeld<Data>(url, [url, tick]);
  const refresh = () => setForced((n) => n + 1);

  const { window: win } = useReportingWindow();
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "progress");
  const [group, setGroup] = useState<"all" | Group>("all");
  const [state, setState] = useState<"all" | ReState>("all");
  const [q, setQ] = useState("");

  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  const s = useMemo(() => (data ? reactivationSummary(camp, data, win.from, win.to) : null), [camp, data, win.from, win.to]);
  const next = useMemo(() => (data ? callNext(camp, data.cards) : []), [camp, data]);
  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.cards
      .filter((c) => (group === "all" || groupOf(c.reason) === group) && (state === "all" || stateOf(c, camp.start) === state)
        && (!needle || c.name.toLowerCase().includes(needle) || c.un.includes(needle)))
      .sort((a, b) => b.orders.reduce((x, o) => x + o.rev, 0) - a.orders.reduce((x, o) => x + o.rev, 0) || b.value - a.value);
  }, [data, group, state, q, camp.start]);

  const header = (
    <PageHeader
      title={camp.name}
      subtitle={`${camp.line}. ${camp.owner} on the ${camp.pipeline} pipeline, one ticket per customer, from ${dmy(camp.start)}.`}
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

  if (r === null) return shell(<LoadingPanel label={`Reading the ${camp.name} tickets and orders from HubSpot…`} />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source={`HubSpot (${camp.name})`} error={r.error} status={r.status} onRetry={refresh} />);
  if (!data || !s) return shell(null);

  const states = s.byState.map((x) => ({ label: STATE_LABEL[x.state], value: x.customers }));

  return shell(
    <>
      {!data.contactSignal && (
        <Notice tone="warn">
          The customers&apos; companies could not be read, so &quot;contacted&quot; counts activity on the tickets only and will look low.
        </Notice>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<PhoneInTalkOutlinedIcon />} label="Contacted" value={`${full(s.contacted)} of ${full(s.customers)}`}
            note={`${pctText(s.contacted, s.customers)} since ${dm(camp.start)} · ${full(s.calls)} with a logged call · ${full(s.ticketCalled)} with activity on the ticket`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Ordered again" value={full(s.reactivated)}
            note={`${pctText(s.reactivated, s.customers)} of the list · ${full(s.reactivatedAfterContact)} of them were contacted`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EuroIcon />} tint="pink" label="Won back" value={`${eur(s.wonBack)} EUR`}
            note={`${pctText(s.wonBack, s.valueInScope)} of the ${compact(s.valueInScope)} EUR to win back · ${full(s.orders)} orders`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<PendingActionsOutlinedIcon />} tint="amber" label="Still to contact" value={full(s.stillToContact)}
            note={`worth ${compact(s.valueNotContacted)} EUR in their best year · day ${s.daysRunning} of the action`} />
        </Grid>
      </Grid>
      <PeriodLine {...s.window} start={camp.start} end={camp.end} />

      <Box>
        <ReportTabs name="reactivation" tab={tab} onSelect={selectTab} tabs={[
          { id: "progress", label: "Progress", count: null },
          { id: "next", label: "Call next", count: full(next.length) },
          { id: "all", label: "All customers", count: full(data.cards.length) },
        ]} />
      </Box>

      {tab === "progress" && (
        <Box id="reactivation-panel-progress" role="tabpanel" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
          <GlassCard>
            <CardTitle icon={<FlagOutlinedIcon />} title="The whole action" note={`Since ${dmy(camp.start)}, whatever the period above`} />
            <Box sx={{ display: "grid", gap: 2 }}>
              <Meter label="Customers contacted" value={s.contacted} of={s.customers} text={`${full(s.contacted)} of ${full(s.customers)} · ${pctText(s.contacted, s.customers)}`} />
              <Meter label="Money back against the value to win back" color={GREEN}
                value={data.cards.reduce((a, c) => a + c.orders.reduce((x, o) => x + o.rev, 0), 0)} of={s.valueInScope}
                text={`${eur(data.cards.reduce((a, c) => a + c.orders.reduce((x, o) => x + o.rev, 0), 0))} of ${eur(s.valueInScope)} EUR`} />
              <Box>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, mb: 0.75 }}>Where the {full(s.customers)} stand</Typography>
                <ShareBar segments={states} format={(v) => full(v)} />
              </Box>
            </Box>
          </GlassCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<TimelineOutlinedIcon />} tint="green" title="Money back, day by day" note="Orders from the list's customers, added up since the start" />
                <TrendChart data={s.timeline.map((d) => ({ x: d.date, value: Math.round(d.cumRevenue) }))} seriesLabel="Won back, EUR" format={(v) => (v === null ? "—" : `${full(v)} EUR`)} tickFormat={(v) => compact(v)} height={230} />
              </GlassCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<PeopleOutlineIcon />} title="Customers contacted, day by day" note="Each customer counted once, on the day of their latest contact" />
                <TrendChart data={s.timeline.map((d) => ({ x: d.date, value: d.cumContacted }))} seriesLabel="Customers contacted" format={(v) => full(v)} height={230} />
              </GlassCard>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="By why they are on the list" note="Ordered again and won back in the period; contacted since the start" />
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Group", "Customers", "Contacted", "Ordered again", "Value EUR", "Won back EUR"].map((h, i) => (
                          <TableCell key={h} sx={headCell} align={i ? "right" : "left"}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.byGroup.map((g) => (
                        <TableRow key={g.group} hover sx={{ cursor: "pointer" }} onClick={() => { setGroup(g.group); selectTab("all"); }}>
                          <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{GROUP_LABEL[g.group]}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(g.customers)}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(g.contacted)} <Typography component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pctText(g.contacted, g.customers)}</Typography></TableCell>
                          <TableCell sx={bodyCell} align="right">{full(g.reactivated)} <Typography component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pctText(g.reactivated, g.customers)}</Typography></TableCell>
                          <TableCell sx={bodyCell} align="right">{eur(g.value)}</TableCell>
                          <TableCell sx={{ ...bodyCell, color: g.wonBack > 0 ? GREEN : INK, fontWeight: 600 }} align="right">{eur(g.wonBack)}</TableCell>
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
                  note={`${full(s.closed)} of ${full(s.tickets)} tickets closed; the resolution the owner chose`} />
                <BarList rows={s.outcomes.map((o) => ({ label: o.label, value: o.count }))} format={(v) => full(v)} labelWidth={200}
                  emptyMessage="No ticket closed yet." />
              </GlassCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {tab === "next" && (
        <Box id="reactivation-panel-next" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<PhoneInTalkOutlinedIcon />} title="Call next"
                note="Not contacted yet, ticket still open, no order back - the biggest best year first" />
            </Box>
            <CustomerTable rows={next} start={camp.start} mode="next" />
          </GlassCard>
        </Box>
      )}

      {tab === "all" && (
        <Box id="reactivation-panel-all" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25, mb: 1.5 }}>
              <CardTitle icon={<PeopleOutlineIcon />} title={`Customers (${full(filtered.length)})`}
                note="Everyone on the list - ordered again first, then by value"
                right={<SearchBox value={q} onChange={setQ} placeholder="Customer or number" />} />
              <FilterChips value={group} onChange={setGroup} options={[
                { id: "all", label: "All groups" },
                ...(["dormant", "declining", "defend"] as Group[]).map((g) => ({ id: g, label: GROUP_LABEL[g] })),
              ]} />
              <FilterChips value={state} onChange={setState} tint="green" options={[
                { id: "all", label: "Anywhere" },
                ...(["won", "contacted", "open", "closed"] as ReState[]).map((x) => ({ id: x, label: STATE_LABEL[x] })),
              ]} />
            </Box>
            <CustomerTable rows={filtered} start={camp.start} mode="all" />
          </GlassCard>
        </Box>
      )}

      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        Read from HubSpot {data.generated.replace("T", " ").slice(0, 16)} UTC · target list imported {/^\d{4}-\d{2}-\d{2}/.test(data.targetsImported ?? "") ? dmy(data.targetsImported!.slice(0, 10)) : "—"} · &quot;Contacted&quot; = activity on the ticket, or a call, e-mail or meeting logged on the customer&apos;s company since {dmy(camp.start)}.
      </Typography>
    </>,
  );
}
