"use client";

// PRICE CHECK TICKETS - a UC app of its own.
//
// Customers who priced articles in the shop and did not order, the rule that
// decides who gets called, the tickets raised for them - and, since the
// APSOAssistant micro app was retired (05.10.2026), what ESO and TSA did with
// those tickets, in the same report as Erosion. The signals tab reads the SAME
// signals and runs the SAME preview/create call as the Datatracker's Price
// checks tab (/api/datatracker/signals, /api/datatracker/price-checks/run), so
// the two cannot disagree about a row.

import { useCallback, useEffect, useMemo, useState } from "react";
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
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Link from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import EuroIcon from "@mui/icons-material/Euro";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { compact, decimal, full } from "@/app/charts/format";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { OutcomeReport, TeamsReport } from "@/app/uc/report/OutcomeReport";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import {
  CardTitle, GlassCard, HAIRLINE, HsLink, INK, KpiTile, MUTED, Notice, StageChip, TeamChip, bodyCell, clip as clipTo, eur, headCell,
} from "@/app/uc/report/ui";
import { isClosed, isWon } from "@/lib/erosion/model";
import { MIN_ARTICLES, VALUE_FLOOR_ACTIVE, priceCheckShortfall, shortPriority } from "@/lib/datatracker/rules";
import type { PriceCheckRow, ShopSignals } from "@/lib/integrations/shopSignals";
import type { RunReport } from "@/lib/integrations/priceCheckTickets";
import type { PriceCheckTicket, PriceCheckTickets } from "@/lib/integrations/priceCheckOutcomes";

const PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
const hsTicketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;

const cell = { fontSize: "0.8rem", py: 0.9, borderColor: HAIRLINE };
const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 260 };
const POLL_MS = 5 * 60_000;
/** The shop signals are read day by day; past three months the read gets slow and the rule stale. */
const SIGNAL_DAYS = 90;
const PAGE = 15;

type TabId = "signals" | "results" | "people" | "tickets";
const TAB_HASH: Record<TabId, string> = { signals: "#signals", results: "#win-rate", people: "#people", tickets: "#tickets" };

const rowKey = (r: PriceCheckRow) => `${r.companyId}-${r.day}`;
const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function Verdict({ r }: { r: PriceCheckRow }) {
  // The reason, never a bare no: a rule you cannot see the edge of is a rule nobody trusts.
  return (
    <Typography component="span" sx={{
      fontSize: "0.72rem", fontWeight: 700, px: 0.9, py: 0.3, borderRadius: 1, whiteSpace: "nowrap",
      bgcolor: r.excluded ? "#f3f0ff" : r.qualifies ? "#e6f4ec" : "#eef1f5",
      color: r.excluded ? "#5a3fa0" : r.qualifies ? "#0f7b4f" : MUTED,
    }}>
      {r.excluded ? r.excluded
        : r.qualifies ? (r.gateOpen ? "Qualifies" : "Qualifies · waiting")
        : priceCheckShortfall(r)}
    </Typography>
  );
}

function Articles({ r }: { r: PriceCheckRow }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, mb: 1 }}>
        Priced and left behind · {r.contactIds.length > 0
          ? `${full(r.contactIds.length)} contact${r.contactIds.length > 1 ? "s" : ""} identified`
          : "contact not identified"}
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720, "& td, & th": cell, "& tbody tr:nth-of-type(odd)": { bgcolor: "#eef3f9" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: MUTED, width: 110 }}>Article</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED, width: 74 }}>PC</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 80 }}>Qty</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED, width: 124 }}>Unit · MOQ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 94 }}>{VALUE_FLOOR_ACTIVE ? "Price" : "List price*"}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 98 }}>{VALUE_FLOOR_ACTIVE ? "Value" : "List value*"}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {r.articles.map((a) => (
              <TableRow key={a.article}>
                <TableCell sx={{ fontWeight: 600, color: a.counted ? INK : MUTED, whiteSpace: "nowrap" }}>{a.article}</TableCell>
                <TableCell sx={{ color: MUTED, ...clip }} title={a.description ?? ""}>{a.description ?? "—"}</TableCell>
                <TableCell sx={{ color: a.counted ? INK : MUTED }}>{a.special ? "special" : a.profitCentre ?? "—"}</TableCell>
                <TableCell align="right" sx={{ color: INK }}>{a.qty == null ? "—" : full(a.qty)}</TableCell>
                {/* 20 of something sold per metre is not 20 pieces, and a request
                    under a MOQ is one the shop would have bumped. */}
                <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                  {[a.salesUnit ?? "unit ?", a.moq == null ? "MOQ unknown" : /^y/i.test(a.moq) ? `MOQ ${a.moqMinimum ?? "?"}` : "no MOQ"].join(" · ")}
                </TableCell>
                <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>{a.price == null ? "—" : `€${decimal(a.price, 2)}`}</TableCell>
                <TableCell align="right" sx={{ color: a.counted ? INK : MUTED, fontWeight: a.counted ? 700 : 400, whiteSpace: "nowrap" }}>
                  {a.value == null ? "—" : `€${compact(a.value)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

/** Today's signals, the rule's verdict on each, and the preview/create run - unchanged from the page before the tabs. */
function SignalsPanel({ signals, error, from, to, clipped }: {
  signals: ShopSignals | null; error: string | null; from: string; to: string; clipped: boolean;
}) {
  const [onlyQualifying, setOnlyQualifying] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [run, setRun] = useState<RunReport | null>(null);
  const [running, setRunning] = useState<"dry" | "live" | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // The preview and the real run are the SAME call with one flag, so what you
  // were shown cannot differ from what gets written.
  const runTickets = useCallback(async (dry: boolean) => {
    setRunning(dry ? "dry" : "live");
    setRunError(null);
    try {
      const j = await fetch(`/api/datatracker/price-checks/run?dry=${dry ? 1 : 0}`, { method: "POST" }).then((r) => r.json());
      if (j?.ok && j.data) setRun(j.data as RunReport);
      else setRunError(j?.error ?? j?.detail ?? "The run did not complete.");
    } catch (e) {
      setRunError(String(e));
    } finally {
      setRunning(null);
    }
  }, []);

  const all = signals?.priceChecks ?? [];
  const qualifying = all.filter((r) => r.qualifies && !r.excluded);
  const visible = onlyQualifying ? qualifying : all;
  const wouldCreate = run?.rows.filter((r) => r.outcome === "would create").length ?? 0;

  return (
    <GlassCard sx={{ p: 0, overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pt: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} title="Priced in the shop, not ordered"
          note={`Customer-days ${from} to ${to}${clipped ? ` - the last ${SIGNAL_DAYS} days of the period at most` : ""}; click a row for the articles`} />
      </Box>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
        <Chip size="small" label={`${full(qualifying.length)} qualify`} sx={{ bgcolor: "#e6f4ec", color: "#0f7b4f", fontWeight: 700 }} />
        <Chip size="small" label={`${full(signals ? all.length - qualifying.length : null)} below the rule`} sx={{ bgcolor: "#eef1f5", color: MUTED, fontWeight: 600 }} />
        <FormControlLabel
          control={<Switch size="small" checked={onlyQualifying} onChange={(e) => setOnlyQualifying(e.target.checked)} />}
          label={<Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Only the ones that qualify</Typography>}
        />
        <Box sx={{ flex: 1 }} />
        {/* Preview first, create second - and the preview is the default, so a
            mis-click costs a wait rather than forty tickets. */}
        <Button size="small" variant="outlined" disabled={running !== null} onClick={() => runTickets(true)}>
          {running === "dry" ? "Checking…" : "Preview tickets"}
        </Button>
        <Button size="small" variant="contained" disableElevation disabled={running !== null || !run || run.dry === false || wouldCreate === 0}
          onClick={() => { if (confirm(`Create ${wouldCreate} tickets in HubSpot?`)) runTickets(false); }}>
          {running === "live" ? "Creating…" : "Create tickets"}
        </Button>
      </Box>
      {error && <Typography sx={{ px: 2.75, pb: 1.5, fontSize: "0.8rem", color: "#9e1b18" }}>{error}</Typography>}
      {runError && <Typography sx={{ px: 2.75, pb: 1.5, fontSize: "0.8rem", color: "#9e1b18" }}>{runError}</Typography>}
      {/* "No ticket was raised" and "we could not look" must never read the same. */}
      {signals?.ticketLookupError && (
        <Typography sx={{ px: 2.75, pb: 1.5, fontSize: "0.8rem", color: "#7a5b00" }}>
          The Ticket column is blank because the tickets could not be read back: {signals.ticketLookupError}
        </Typography>
      )}

      {/* What the run actually did, line by line. "14 created" is a claim nobody can check. */}
      {run && (
        <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "rgba(247,249,252,.8)" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, mb: 1 }}>
            {run.dry ? "Preview" : "Run"} · {run.from} → {run.to} · {full(run.considered)} days considered
            {run.dry ? "" : ` · ${full(run.created)} created`}
            {run.articlesWithoutPrice > 0 ? ` · ${full(run.articlesWithoutPrice)} articles with no list price` : ""}
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 680, "& td, & th": { ...cell, px: 1 }, "& tbody tr:nth-of-type(odd)": { bgcolor: "#eef3f9" } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: MUTED, width: 98 }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED, width: 140 }}>Owner</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 70 }}>Art.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 96 }}>{VALUE_FLOOR_ACTIVE ? "Value" : "List value*"}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED, width: 180 }}>Outcome</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {run.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.day}</TableCell>
                    <TableCell sx={{ color: INK, fontWeight: 600, ...clip }} title={r.company ?? ""}>{r.company ?? "—"}</TableCell>
                    <TableCell sx={{ color: MUTED, ...clip }}>{r.owner || "—"}</TableCell>
                    <TableCell align="right" sx={{ color: INK }}>{full(r.articles.length)}</TableCell>
                    <TableCell align="right" sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap" }}>€{compact(r.value)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography component="span" sx={{
                        fontSize: "0.72rem", fontWeight: 700, px: 0.9, py: 0.3, borderRadius: 1,
                        bgcolor: r.outcome === "created" ? "#e6f4ec" : r.outcome === "would create" ? "#e3edf7" : r.outcome === "failed" ? "#fdecea" : "#eef1f5",
                        color: r.outcome === "created" ? "#0f7b4f" : r.outcome === "would create" ? "#1b4a80" : r.outcome === "failed" ? "#9e1b18" : MUTED,
                      }}>
                        {r.outcome}
                      </Typography>
                      {r.ticketId && (
                        <Link href={hsTicketUrl(r.ticketId)} target="_blank" rel="noopener" underline="hover" sx={{ ml: 1, fontSize: "0.72rem" }}>open</Link>
                      )}
                      {r.error && <Typography component="span" sx={{ ml: 1, fontSize: "0.72rem", color: "#9e1b18" }}>{r.error}</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
                {run.rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ color: MUTED, py: 2, textAlign: "center" }}>Nothing in the last three days to act on.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {signals === null && !error ? (
        <Box sx={{ p: 2 }}><LoadingPanel label="Reading the shop's price checks…" /></Box>
      ) : (
        <Box sx={{ overflowX: "auto", borderTop: `1px solid ${HAIRLINE}` }}>
          <Table size="small" sx={{ minWidth: 1000, "& td, & th": cell }}>
            <TableHead>
              <TableRow>
                {["Day", "Customer", "Mandant", "Owner", "Priority", "Articles", "Counted", VALUE_FLOOR_ACTIVE ? "Value" : "List value*", "Judged on", "Verdict", "Ticket"].map((h, i) => (
                  <TableCell key={h} align={i >= 5 && i <= 7 ? "right" : "left"} sx={{ ...headCell, fontSize: "0.68rem" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => [
                <TableRow key={rowKey(r)} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(open === rowKey(r) ? null : rowKey(r))}>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.day}</TableCell>
                  <TableCell sx={{ ...clip }} title={r.companyName ?? ""}>
                    <Link href={hsCompanyUrl(r.companyId)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} underline="hover"
                      sx={{ color: INK, fontWeight: 600 }}>{r.companyName ?? "—"}</Link>
                  </TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.mandant ?? "—"}</TableCell>
                  {/* An owner on neither roster gets no ticket at all - visible here,
                      or the screen promises a call nobody is going to make. */}
                  <TableCell sx={{ color: r.team ? MUTED : "#9e1b18", ...clip }} title={r.owner || ""}>
                    {r.owner || "no owner"}{r.team ? "" : " · off roster"}
                  </TableCell>
                  <TableCell sx={{ color: MUTED }}>{shortPriority(r.salesPriority)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{full(r.articles.length)}</TableCell>
                  <TableCell align="right" sx={{ color: r.counted ? INK : MUTED, fontWeight: 600 }}>{full(r.counted)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700, whiteSpace: "nowrap" }}>{r.value ? `€${compact(r.value)}` : "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.gateOpen ? r.dueOn : `due ${r.dueOn}`}</TableCell>
                  <TableCell><Verdict r={r} /></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {r.ticketId
                      ? <Link href={hsTicketUrl(r.ticketId)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} underline="hover"
                          sx={{ fontSize: "0.76rem", fontWeight: 600 }}>raised ↗</Link>
                      : r.qualifies && !r.excluded && r.gateOpen
                        ? <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>next run</Typography>
                        : <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>—</Typography>}
                  </TableCell>
                </TableRow>,
                open === rowKey(r) && (
                  <TableRow key={`${rowKey(r)}-d`}>
                    <TableCell colSpan={11} sx={{ p: 0, bgcolor: "#f7f9fc" }}><Articles r={r} /></TableCell>
                  </TableRow>
                ),
              ])}
              {signals && visible.length === 0 && (
                <TableRow><TableCell colSpan={11} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                  {onlyQualifying ? "No customer-day qualifies in this period." : "No price checks in this period."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {!VALUE_FLOOR_ACTIVE && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
              * Per ERP price unit. Products &amp; Pricing keeps list prices per 1, 100 or 1,000 pieces and not the unit,
              so a value can read 100 or 1,000 times too high. A day qualifies on {MIN_ARTICLES} or more KT/DT articles
              until the unit is in; the €500 floor is paused.
            </Typography>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

function AllTickets({ tickets, period }: { tickets: PriceCheckTicket[]; period: string }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [tickets]);
  const rows = tickets.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <GlassCard>
      <CardTitle icon={<ListAltIcon />} tint="slate" title="All price-check tickets"
        note={`${full(tickets.length)} raised · ${period} · newest first, status and owner live from HubSpot`} />
      {tickets.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No ticket was raised in this period.</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  {["Raised", "Customer", "Priced", "Articles", "Value EUR", "Team", "Owner", "Status", "Resolution", ""].map((h, i) => (
                    <TableCell key={i} sx={headCell} align={h === "Value EUR" || h === "Articles" ? "right" : "left"}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ ...bodyCell, color: MUTED, whiteSpace: "nowrap" }}>{t.created}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clipTo(240) }} title={t.company ?? t.subject}>{t.company ?? t.subject}</Typography>
                      {t.un && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{t.un}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, color: MUTED, whiteSpace: "nowrap" }}>{t.checkedOn ?? "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, ...clipTo(200) }} align="right" title={t.articles ?? ""}>
                      {full(t.articleCount)}{t.profitCenters ? <Typography component="span" sx={{ color: MUTED, fontSize: "0.74rem" }}> · {t.profitCenters}</Typography> : null}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{t.value ? eur(t.value) : "—"}</TableCell>
                    <TableCell sx={bodyCell}><TeamChip team={t.team} /></TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", fontSize: "0.82rem" }}>{t.owner}</TableCell>
                    <TableCell sx={bodyCell}><StageChip t={t} /></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: isWon(t) ? "#1b7a55" : MUTED, fontWeight: isWon(t) ? 700 : 400, ...clipTo(200) }}
                      title={t.resolutionDetail ?? ""}>{t.resolution ?? (isClosed(t) ? "not recorded" : "")}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} align="right"><HsLink id={t.id} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={tickets.length} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]} sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
        </>
      )}
    </GlassCard>
  );
}

export default function PriceCheckTickets() {
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);
  const refresh = () => setForced((n) => n + 1);

  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "signals");
  // The hub-wide period, the one every report uses. Tickets are picked by the day
  // they were RAISED; the shop signals are read for at most the last 90 days of it.
  const { window: win, label: periodLabel } = useReportingWindow();
  const sigFrom = win.from > shiftDay(win.to, -(SIGNAL_DAYS - 1)) ? win.from : shiftDay(win.to, -(SIGNAL_DAYS - 1));

  const [signals, setSignals] = useState<ShopSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setSignals(null);
    setError(null);
    fetch(`/api/datatracker/signals?from=${sigFrom}&to=${win.to}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setSignals(j.data as ShopSignals);
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer for the shop signals.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [sigFrom, win.to, forced]);

  const ticketsUrl = forced ? `/api/uc/price-checks/tickets?refresh=1&n=${forced}` : "/api/uc/price-checks/tickets";
  const held = useHeld<PriceCheckTickets>(ticketsUrl, [ticketsUrl, tick]);
  const tr = held.result;
  const tickets = useMemo(() => (tr?.state === "ok" ? tr.data.tickets : []), [tr]);
  const inPeriod = useMemo(() => tickets.filter((t) => t.created >= win.from && t.created <= win.to), [tickets, win.from, win.to]);

  const qualifying = (signals?.priceChecks ?? []).filter((r) => r.qualifies && !r.excluded);
  const closed = inPeriod.filter(isClosed);
  const won = inPeriod.filter(isWon);
  const ok = tr?.state === "ok";

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <Box>
        <PageHeader
          title="Price check tickets"
          subtitle="Customers who priced articles in the shop and did not order, the tickets raised to call them, and what came of them"
          rightSlot={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {((signals === null && !error) || tr === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
              <WindowPicker />
              <Tooltip title="Ask HubSpot again">
                <IconButton size="small" onClick={refresh} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
              </Tooltip>
            </Box>
          }
        />
        {tr?.state === "not-configured" && <NotConnectedPanel source="HubSpot" missing={tr.missing} />}
        {tr?.state === "error" && <UpstreamPanel source="HubSpot (price-check tickets)" error={tr.error} status={tr.status} onRetry={refresh} />}
        {ok && tickets.some((t) => t.subject.startsWith("Direct ESO request")) && (
          <Notice tone="warn">
            Some subjects were rewritten to &quot;Direct ESO request&quot; by the ESO workflow; their customer is shown from the ticket&apos;s company instead.
          </Notice>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SellOutlinedIcon />} label="Qualify" value={signals ? full(qualifying.length) : "—"}
            note={`customer-days ${sigFrom} to ${win.to} · ${!signals ? "reading…" : VALUE_FLOOR_ACTIVE ? `€${compact(qualifying.reduce((s, r) => s + (r.value || 0), 0))} priced and not ordered` : `${MIN_ARTICLES}+ KT/DT articles each`}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="amber" label="Tickets raised" value={ok ? full(inPeriod.length) : "—"}
            note={ok ? `${full(inPeriod.length - closed.length)} open · ${full(closed.length)} closed · ${periodLabel}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Ordered" value={ok ? full(won.length) : "—"}
            note={ok ? (closed.length ? `${Math.round((100 * won.length) / closed.length)}% of the closed tickets ended in an order` : "no ticket closed yet") : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EuroIcon />} tint="pink" label="Value on the tickets" value={ok && VALUE_FLOOR_ACTIVE ? `${eur(inPeriod.reduce((s, t) => s + t.value, 0))} EUR` : "—"}
            note={!VALUE_FLOOR_ACTIVE ? "not shown: list prices are per ERP price unit (1, 100 or 1,000 pieces) and the unit is not in Products & Pricing yet" : ok ? `${eur(won.reduce((s, t) => s + t.value, 0))} EUR of it on tickets closed as ordered` : undefined} />
        </Grid>
      </Grid>

      <Box>
        <ReportTabs name="price-checks" tab={tab} onSelect={selectTab} tabs={[
          { id: "signals", label: "Signals & run", count: signals ? full(qualifying.length) : null },
          { id: "results", label: "Win rate & resolution", count: ok && closed.length ? `${Math.round((100 * won.length) / closed.length)}%` : null },
          { id: "people", label: "Teams & people", count: null },
          { id: "tickets", label: "All tickets", count: ok ? full(inPeriod.length) : null },
        ]} />
      </Box>

      {tab === "signals" && (
        <Box id="price-checks-panel-signals" role="tabpanel" sx={{ minWidth: 0 }}>
          <SignalsPanel signals={signals} error={error} from={sigFrom} to={win.to} clipped={sigFrom !== win.from} />
        </Box>
      )}
      {tab !== "signals" && tr === null && <LoadingPanel label="Reading the price-check tickets from HubSpot…" />}
      {tab === "results" && ok && (
        <Box id="price-checks-panel-results" role="tabpanel" sx={{ minWidth: 0 }}>
          <OutcomeReport tickets={inPeriod} period={periodLabel} stale={held.stale} amountMeans="priced and not ordered" />
        </Box>
      )}
      {tab === "people" && ok && (
        <Box id="price-checks-panel-people" role="tabpanel" sx={{ minWidth: 0 }}>
          <TeamsReport tickets={inPeriod} period={periodLabel} stale={held.stale} />
        </Box>
      )}
      {tab === "tickets" && ok && (
        <Box id="price-checks-panel-tickets" role="tabpanel" sx={{ minWidth: 0 }}>
          <AllTickets tickets={inPeriod} period={periodLabel} />
        </Box>
      )}
    </Box>
  );
}
