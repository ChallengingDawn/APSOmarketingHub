"use client";

// KALREZ 6221/6230 DISCONTINUED - the board of the one-shot call action (src/lib/oneshot/kalrez.ts).
// 36 Swiss customers, one call each before 22.11.2026, moving them to evolast PB794 / PN794 before
// the manufacturer's last order date (27.11.2026). Measured on what they order from the start on:
// an evolast line = switched, a Kalrez line = a last order of the old compound.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
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
import RefreshIcon from "@mui/icons-material/Refresh";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ShareBar } from "@/app/charts/ShareBar";
import { BarList } from "@/app/charts/BarList";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, GREEN, HsLink, INK, KpiTile, MUTED, Notice, TINT, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import {
  KZ, KZ_STATE_LABEL, REPLACEMENT, chf, compoundsOf, evolastChf, kzCallNext, kzContactDay, kzState, kzSummary,
  type KzCard, type KzData, type KzState,
} from "@/lib/oneshot/kalrez";
import type { KzPlanRow, KzRun } from "@/lib/integrations/kalrezSwitch";
import { CompanyLink, FilterChips, Meter, SearchBox, dm, dmy, pctText } from "./parts";

const POLL_MS = 5 * 60_000;
type TabId = "progress" | "next" | "all" | "tickets";
const TAB_HASH: Record<TabId, string> = { progress: "#progress", next: "#call-next", all: "#customers", tickets: "#tickets" };
type Plan = { rows: KzPlanRow[]; lastRun: KzRun | null; admin: boolean };

function StateChip({ s }: { s: KzState }) {
  const c = s === "switched" ? TINT.green : s === "lastbuy" ? TINT.amber : s === "contacted" ? TINT.blue : s === "closed" ? TINT.pink : TINT.slate;
  return <Chip size="small" label={KZ_STATE_LABEL[s]} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />;
}

function Offer({ c }: { c: Pick<KzCard, "chf6221" | "chf6230"> }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {compoundsOf(c).map((k) => (
        <Tooltip key={k} title={`Kalrez ${k}: ${chf(k === "6221" ? c.chf6221 : c.chf6230)} CHF since 2022`}>
          <Chip size="small" label={`${k} → ${REPLACEMENT[k]}`} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600, bgcolor: TINT.purple.bg, color: TINT.purple.fg }} />
        </Tooltip>
      ))}
    </Box>
  );
}

function CustomerTable({ rows, mode }: { rows: KzCard[]; mode: "next" | "all" }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headCell}>Customer</TableCell>
            <TableCell sx={headCell}>Who calls</TableCell>
            <TableCell sx={headCell} align="right">6221/6230 since 2022, CHF</TableCell>
            <TableCell sx={headCell}>Offer</TableCell>
            <TableCell sx={headCell}>Last Kalrez order</TableCell>
            {mode === "all" && <TableCell sx={headCell}>Where it stands</TableCell>}
            <TableCell sx={headCell}>Ticket</TableCell>
            <TableCell sx={headCell}>Last contact</TableCell>
            {mode === "all" && <TableCell sx={headCell} align="right">evolast ordered, CHF</TableCell>}
            <TableCell sx={headCell} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => {
            const last = kzContactDay(c);
            const ev = evolastChf(c);
            return (
              <TableRow key={c.un} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clip(260) }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{c.un}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{c.ownerName}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }} align="right">{chf(c.chf)}</TableCell>
                <TableCell sx={bodyCell}><Offer c={c} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{dmy(c.lastKalrez)}</TableCell>
                {mode === "all" && <TableCell sx={bodyCell}><StateChip s={kzState(c)} /></TableCell>}
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: c.ticket?.closed ? MUTED : INK }}>
                  {c.ticket ? `${c.ticket.stage}${c.ticket.closed && c.ticket.resolution ? ` · ${c.ticket.resolution}` : ""}` : "no ticket yet"}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: last ? INK : MUTED }}>{last ? dmy(last) : "not yet"}</TableCell>
                {mode === "all" && (
                  <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: ev > 0 ? 700 : 400, color: ev > 0 ? GREEN : INK }} align="right">
                    {ev ? chf(ev) : ""}
                  </TableCell>
                )}
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} align="right">
                  <CompanyLink id={c.companyId} />
                  {c.ticket && <HsLink id={c.ticket.id} />}
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && <TableRow><TableCell colSpan={10} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nobody here.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Box>
  );
}

/** The tickets: what a run makes, and - for admins - the button that makes the missing ones. */
function TicketsPanel({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  const held = useHeld<Plan>(`/api/uc/oneshot/kalrez?plan=1&n=${n}`, [n]);
  const [busy, setBusy] = useState<"preview" | "create" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const plan = held.result?.state === "ok" ? held.result.data : null;
  const missing = plan ? plan.rows.filter((r) => !r.ticketId).length : 0;

  const act = async (action: "preview" | "create") => {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/uc/oneshot/kalrez", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: KzRun; error?: string };
      if (!res.ok || !j.ok || !j.data) {
        setMsg({ tone: "bad", text: j.error ?? `HTTP ${res.status}` });
      } else {
        const r = j.data;
        setMsg({
          tone: r.failed.length ? "bad" : "ok",
          text: action === "preview"
            ? `A run now would make ${r.created} ticket${r.created === 1 ? "" : "s"}; ${r.skipped} customer${r.skipped === 1 ? " has" : "s have"} one already.`
            : `${r.created} ticket${r.created === 1 ? "" : "s"} made, ${r.skipped} already there${r.failed.length ? `, ${r.failed.length} failed: ${r.failed.map((f) => `${f.un} (${f.error})`).join("; ")}` : ""}.`
              + (r.propertiesCreated.length ? ` Properties made first: ${r.propertiesCreated.join(", ")}.` : "")
              + (r.warnings.length ? ` Links that did not work: ${r.warnings.length}.` : ""),
        });
        if (action === "create") { setN((x) => x + 1); onDone(); }
      }
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (held.result === null) return <LoadingPanel label="Reading the action's tickets…" />;
  if (held.result.state === "error") return <UpstreamPanel source="HubSpot (Kalrez tickets)" error={held.result.error} status={held.result.status} onRetry={() => setN((x) => x + 1)} />;
  if (!plan) return null;

  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25, mb: 1.5 }}>
        <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="purple" title={`Tickets (${full(plan.rows.length - missing)} of ${full(plan.rows.length)} made)`}
          note="One per customer: ESO pipeline for Jan Kalt and Jeremy Borey, TSA for the TSA people; company, up to 5 contacts and the Kalrez orders linked"
          right={plan.admin ? (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="outlined" disabled={!!busy} onClick={() => act("preview")}>
                {busy === "preview" ? "Checking…" : "Check"}
              </Button>
              <Button size="small" variant="contained" disableElevation disabled={!!busy || missing === 0} onClick={() => act("create")}>
                {busy === "create" ? "Making the tickets…" : missing ? `Make the ${missing} missing ticket${missing === 1 ? "" : "s"}` : "All tickets made"}
              </Button>
            </Box>
          ) : undefined} />
        {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.tone === "ok" ? GREEN : "#c5221f", fontWeight: 600 }}>{msg.text}</Typography>}
        {plan.lastRun && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
            Last run {plan.lastRun.at.replace("T", " ").slice(0, 16)} UTC by {plan.lastRun.by}: {plan.lastRun.created} made, {plan.lastRun.skipped} already there
            {plan.lastRun.failed.length ? `, ${plan.lastRun.failed.length} failed` : ""}.
          </Typography>
        )}
        {!plan.admin && missing > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>An admin makes the tickets from here.</Typography>}
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Title", "Owner", "Pipeline", "Orders linked", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {plan.rows.map((r) => (
              <TableRow key={r.un} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK, ...clip(520) }}>{r.subject}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{r.owner}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.team}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }} align="right">{r.orders}</TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                  {r.ticketId ? <HsLink id={r.ticketId} /> : <Typography component="span" sx={{ fontSize: "0.78rem", color: MUTED }}>not made yet</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

export function KalrezBoard() {
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);
  const url = forced ? `/api/uc/oneshot/kalrez?refresh=1&n=${forced}` : "/api/uc/oneshot/kalrez";
  const held = useHeld<KzData>(url, [url, tick]);
  const refresh = () => setForced((n) => n + 1);

  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "progress");
  const [state, setState] = useState<"all" | KzState>("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");

  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  const s = useMemo(() => (data ? kzSummary(data) : null), [data]);
  const next = useMemo(() => (data ? kzCallNext(data.cards) : []), [data]);
  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.cards
      .filter((c) => (state === "all" || kzState(c) === state) && (owner === "all" || c.ownerName === owner)
        && (!needle || c.name.toLowerCase().includes(needle) || c.un.includes(needle)))
      .sort((a, b) => evolastChf(b) - evolastChf(a) || b.chf - a.chf);
  }, [data, state, owner, q]);

  const header = (
    <PageHeader
      title={KZ.name}
      subtitle={`${KZ.line}. Calls by ${dmy(KZ.callBy)}; the manufacturer takes orders until ${dmy(KZ.lastOrder)}. 6221 → evolast PB794, 6230 → evolast PN794.`}
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
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

  if (r === null) return shell(<LoadingPanel label="Reading the Kalrez tickets and the customers' orders from HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (Kalrez 6221/6230)" error={r.error} status={r.status} onRetry={refresh} />);
  if (!data || !s) return shell(null);

  const owners = s.byOwner.map((o) => o.owner);
  return shell(
    <>
      {!data.contactSignal && (
        <Notice tone="warn">The customers&apos; companies could not be read, so &quot;called&quot; counts activity on the tickets only and will look low.</Notice>
      )}
      {data.ticketsFound === 0 && (
        <Notice tone="warn">No ticket made yet - the Tickets tab shows the {full(s.customers)} titles, and an admin makes them there.</Notice>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<PhoneInTalkOutlinedIcon />} label="Called" value={`${full(s.contacted)} of ${full(s.customers)}`}
            note={`${pctText(s.contacted, s.customers)} since ${dm(KZ.start)} · ${full(s.stillToCall)} still to call (${chf(s.stillToCallChf)} CHF of past 6221/6230)`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SwapHorizOutlinedIcon />} tint="green" label="Ordered evolast" value={full(s.switched)}
            note={s.switched ? `${chf(s.evolastChf)} CHF of PB794/PN794 since ${dm(KZ.start)}` : "nobody on the list has ordered evolast yet"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<HourglassBottomOutlinedIcon />} tint="amber" label="Last Kalrez orders" value={full(s.lastBuy)}
            note={s.lastBuy ? `${chf(s.kalrezChf)} CHF of 6221/6230 ordered since ${dm(KZ.start)}` : "no 6221/6230 ordered since the start"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EventOutlinedIcon />} tint="pink" label="Days left" value={`${s.daysToCallBy} to call`}
            note={`${s.daysToLastOrder} days to the last order date ${dmy(KZ.lastOrder)}`} />
        </Grid>
      </Grid>

      <Box>
        <ReportTabs name="kalrez" tab={tab} onSelect={selectTab} tabs={[
          { id: "progress", label: "Progress", count: null },
          { id: "next", label: "Call next", count: full(next.length) },
          { id: "all", label: "All customers", count: full(data.cards.length) },
          { id: "tickets", label: "Tickets", count: `${full(data.ticketsFound)}/${full(data.cards.length)}` },
        ]} />
      </Box>

      {tab === "progress" && (
        <Box id="kalrez-panel-progress" role="tabpanel" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
          <GlassCard>
            <CardTitle icon={<FlagOutlinedIcon />} title="The whole action" note={`Since ${dmy(KZ.start)}`} />
            <Box sx={{ display: "grid", gap: 2 }}>
              <Meter label="Customers called" value={s.contacted} of={s.customers} text={`${full(s.contacted)} of ${full(s.customers)} · ${pctText(s.contacted, s.customers)}`} />
              <Meter label="Customers who ordered evolast" color={GREEN} value={s.switched} of={s.customers}
                text={`${full(s.switched)} of ${full(s.customers)} · ${chf(s.evolastChf)} CHF`} />
              <Box>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, mb: 0.75 }}>Where the {full(s.customers)} stand</Typography>
                <ShareBar segments={s.byState.map((x) => ({ label: KZ_STATE_LABEL[x.state], value: x.customers }))} format={(v) => full(v)} keepOrder />
              </Box>
            </Box>
          </GlassCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <GlassCard sx={{ height: "100%" }}>
                <CardTitle icon={<PeopleOutlineIcon />} tint="purple" title="By person" note="Who calls (SARCLA: SAE Performis - the company owner for all 36)" />
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Person", "Customers", "6221/6230 since 2022, CHF", "Called", "Ordered evolast", "evolast CHF"].map((h, i) => (
                          <TableCell key={h} sx={headCell} align={i ? "right" : "left"}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.byOwner.map((o) => (
                        <TableRow key={o.owner} hover sx={{ cursor: "pointer" }} onClick={() => { setOwner(o.owner); selectTab("all"); }}>
                          <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{o.owner}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(o.customers)}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{chf(o.listChf)}</TableCell>
                          <TableCell sx={bodyCell} align="right">{full(o.contacted)} <Typography component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pctText(o.contacted, o.customers)}</Typography></TableCell>
                          <TableCell sx={bodyCell} align="right">{full(o.switched)}</TableCell>
                          <TableCell sx={{ ...bodyCell, color: o.evolastChf > 0 ? GREEN : INK, fontWeight: 600 }} align="right">{chf(o.evolastChf)}</TableCell>
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
                <BarList rows={s.outcomes.map((o) => ({ label: o.label, value: o.count }))} format={(v) => full(v)} labelWidth={200} emptyMessage="No ticket closed yet." />
              </GlassCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {tab === "next" && (
        <Box id="kalrez-panel-next" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<PhoneInTalkOutlinedIcon />} title="Call next" note="Not called yet, ticket open, nothing ordered since the start - biggest first" />
            </Box>
            <CustomerTable rows={next} mode="next" />
          </GlassCard>
        </Box>
      )}

      {tab === "all" && (
        <Box id="kalrez-panel-all" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25, mb: 1.5 }}>
              <CardTitle icon={<PeopleOutlineIcon />} title={`Customers (${full(filtered.length)})`} note="evolast ordered first, then by past 6221/6230"
                right={<SearchBox value={q} onChange={setQ} placeholder="Customer or number" />} />
              <FilterChips value={owner} onChange={setOwner} options={[{ id: "all", label: "Everyone" }, ...owners.map((o) => ({ id: o, label: o }))]} />
              <FilterChips value={state} onChange={setState} tint="green" options={[
                { id: "all", label: "Anywhere" },
                ...(["switched", "lastbuy", "contacted", "closed", "open"] as KzState[]).map((x) => ({ id: x, label: KZ_STATE_LABEL[x] })),
              ]} />
            </Box>
            <CustomerTable rows={filtered} mode="all" />
          </GlassCard>
        </Box>
      )}

      {tab === "tickets" && (
        <Box id="kalrez-panel-tickets" role="tabpanel" sx={{ minWidth: 0 }}>
          <TicketsPanel onDone={refresh} />
        </Box>
      )}

      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        Read from HubSpot {data.generated.replace("T", " ").slice(0, 16)} UTC · the list: APSO CH customers with more than 1,000 CHF of Kalrez 6221/6230
        since 2022, from our order lines (EUR lines × 0.94) · &quot;Called&quot; = activity on the ticket, or a call, e-mail or meeting logged on the
        company since {dmy(KZ.start)}.
      </Typography>
    </>,
  );
}
