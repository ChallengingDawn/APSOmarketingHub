"use client";

// PRICE CHECK TICKETS - a UC app of its own.
//
// Customers who priced articles in the shop and did not order, the rule that
// decides who gets called, and the tickets raised for them. Until now this
// address only forwarded to the Datatracker's Price checks tab, so opening the
// UC app dropped people out of it and into another app. The screen lives here
// now; it reads the SAME signals and runs the SAME preview/create call as that
// tab (/api/datatracker/signals, /api/datatracker/price-checks/run), so the two
// cannot disagree about a row.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import PageHeader from "@/app/PageHeader";
import { GUTTER, HAIRLINE, INK, LoadingPanel, MUTED, Section } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { compact, decimal, full } from "@/app/charts/format";
import { periodWindow, shortPriority } from "@/lib/datatracker/rules";
import type { PriceCheckRow, ShopSignals } from "@/lib/integrations/shopSignals";
import type { RunReport } from "@/lib/integrations/priceCheckTickets";

const PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
const hsTicketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;

const cell = { fontSize: "0.8rem", py: 0.9, borderColor: HAIRLINE };
const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 260 };

// A price check is judged on the next working day, so "today" alone is mostly
// rows still waiting - the last 7 days is the useful default here.
const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "This quarter" },
] as const;

const rowKey = (r: PriceCheckRow) => `${r.companyId}-${r.day}`;

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
        : r.counted === 0 ? "No KT/DT article"
        : "Under €500"}
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
              <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 94 }}>Price</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 98 }}>Value</TableCell>
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

export default function PriceCheckTickets() {
  const [period, setPeriod] = useState<string>("7d");
  const [signals, setSignals] = useState<ShopSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyQualifying, setOnlyQualifying] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [run, setRun] = useState<RunReport | null>(null);
  const [running, setRunning] = useState<"dry" | "live" | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const { from, to } = periodWindow(period, "", "");

  useEffect(() => {
    const ctrl = new AbortController();
    setSignals(null);
    setError(null);
    fetch(`/api/datatracker/signals?from=${from}&to=${to}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setSignals(j.data as ShopSignals);
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer for the shop signals.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [from, to]);

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
  const raised = qualifying.filter((r) => r.ticketId).length;
  const waiting = qualifying.filter((r) => !r.gateOpen).length;
  const value = qualifying.reduce((s, r) => s + (r.value || 0), 0);
  const wouldCreate = run?.rows.filter((r) => r.outcome === "would create").length ?? 0;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Price check tickets"
        subtitle="Customers who priced articles in the shop and did not order, and the tickets raised to call them"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {signals === null && !error && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Select size="small" value={period} onChange={(e) => setPeriod(String(e.target.value))} sx={{ fontSize: "0.82rem", minWidth: 150 }}
              inputProps={{ "aria-label": "Period" }}>
              {RANGES.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
            </Select>
          </Box>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Qualify" value={signals ? full(qualifying.length) : "—"} note={`customer-days ${from} → ${to}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Tickets raised" value={signals ? full(raised) : "—"} note="read back from HubSpot" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Waiting a working day" value={signals ? full(waiting) : "—"} note="judged the next working day - people buy the next morning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatTile label="Priced and not ordered" value={signals ? `€${compact(value)}` : "—"} note="list value of the qualifying days" />
        </Grid>
      </Grid>

      <Section sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
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
          <Button size="small" variant="contained" disabled={running !== null || !run || run.dry === false || wouldCreate === 0}
            onClick={() => { if (confirm(`Create ${wouldCreate} tickets in HubSpot?`)) runTickets(false); }}>
            {running === "live" ? "Creating…" : "Create tickets"}
          </Button>
        </Box>
        {error && <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.8rem", color: "#9e1b18" }}>{error}</Typography>}
        {runError && <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.8rem", color: "#9e1b18" }}>{runError}</Typography>}
        {/* "No ticket was raised" and "we could not look" must never read the same. */}
        {signals?.ticketLookupError && (
          <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.8rem", color: "#7a5b00" }}>
            The Ticket column is blank because the tickets could not be read back: {signals.ticketLookupError}
          </Typography>
        )}

        {/* What the run actually did, line by line. "14 created" is a claim nobody can check. */}
        {run && (
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#f7f9fc" }}>
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
                    <TableCell align="right" sx={{ fontWeight: 600, color: MUTED, width: 96 }}>Value</TableCell>
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
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1000, "& td, & th": cell }}>
              <TableHead>
                <TableRow>
                  {["Day", "Customer", "Mandant", "Owner", "Priority", "Articles", "Counted", "Value", "Judged on", "Verdict", "Ticket"].map((h, i) => (
                    <TableCell key={h} align={i >= 5 && i <= 7 ? "right" : "left"} sx={{ fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{h}</TableCell>
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
          </Box>
        )}
      </Section>
    </Box>
  );
}
