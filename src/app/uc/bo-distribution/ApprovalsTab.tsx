"use client";

// BACK OFFICE DISTRIBUTION - GQS > Approvals (SARCLA 04.11.2026: "move now SARCLA | GQS Ticket Created by Sales in a new
// tab Approvals"). The GQS requests Sales creates: which ones go to a line manager and why, which are approved by
// themselves, who decides and how long it takes; Approve / Refuse for the line manager (and admins); the rule's limits;
// the hub's own look at each new request, Paused next to the workflow's, Live in its place. Reads/writes
// /api/uc/gqs-approvals (src/lib/gqsApprovals).

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import AutoModeOutlinedIcon from "@mui/icons-material/AutoModeOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Info, usePaged, when } from "@/app/connectors/parts";
import type { Hist, Row, RunInfo, Settings } from "@/lib/gqsApprovals/engine";
import { STATUS, decide, reasonText, type Limits } from "@/lib/gqsApprovals/rules";

const API = "/api/uc/gqs-approvals";
type Data = {
  settings: Settings; last: RunInfo | null; rows: Row[]; history: { at: string; rows: Hist[]; owners: Record<string, string> } | null;
  log: { at: string; ticketId: string; what: string; by?: string }[]; names: Record<string, string>;
  workflowOn: boolean | null; writing: boolean; admin: boolean; decidesFor: string[] | "any";
};
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const hours = (ms: number) => (ms < 36 * 3600_000 ? `${Math.max(1, Math.round(ms / 3600_000))} h` : `${Math.round(ms / 86400_000)} days`);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const eur = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("de-CH")} €`);
const mpct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 1000) / 10}%`);

const BOX = { border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%", boxSizing: "border-box" } as const;
/** A setting as the platform shows one (Back Office distribution > Settings): what it does, its switch on the right. */
function SwitchRow({ title, text, checked, disabled, onChange, chips }: { title: string; text: React.ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; chips?: React.ReactNode }) {
  return (
    <Box sx={{ ...BOX, borderColor: checked ? "rgba(36,89,209,.35)" : HAIRLINE }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>{title}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {chips}
          <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { "aria-label": title } }} />
        </Box>
      </Box>
      <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.45 }}>{text}</Typography>
    </Box>
  );
}

function RequestCell({ id, subject, customer }: { id: string; subject: string; customer: string }) {
  return (
    <>
      <Box component="a" href={ticketUrl(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{subject || `Ticket ${id}`}</Box>
      {customer && <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(320) }}>{customer}</Box>}
    </>
  );
}

/** The rule's four lines, each with its limits - admins change them and save. */
function RuleCard({ d, inPeriod, onSaved }: { d: Data; inPeriod: Hist[]; onSaved: () => void }) {
  const [l, setL] = useState<Limits>(d.settings.limits);
  useEffect(() => { setL(d.settings.limits); }, [d.settings.limits]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = JSON.stringify(l) !== JSON.stringify(d.settings.limits);
  const count = (r: string) => inPeriod.filter((h) => { const v = decide(h.facts, d.settings.limits); return v.review && v.reason === r; }).length;
  const auto = inPeriod.filter((h) => !decide(h.facts, d.settings.limits).review).length;
  const box = (k: keyof Limits, unit: "€" | "%") => (
    <TextField size="small" type="number" value={unit === "%" ? Math.round(Number(l[k]) * 1000) / 10 : Number(l[k])} disabled={!d.admin}
      onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setL({ ...l, [k]: unit === "%" ? n / 100 : n }); }}
      slotProps={{ htmlInput: { "aria-label": k, min: 0, step: unit === "%" ? 1 : 500, style: { width: unit === "%" ? 52 : 86, padding: "4px 8px", fontSize: "0.84rem" } } }}
      sx={{ mx: 0.5 }} />
  );
  const line = (text: React.ReactNode, n: number) => (
    <TableRow>
      <TableCell sx={{ ...bodyCell, fontSize: "0.86rem" }}><Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>{text}</Box></TableCell>
      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{full(n)}</TableCell>
    </TableRow>
  );
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limits: l }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - the next requests are decided with it." : j.error ?? `HTTP ${r.status}`);
      if (j.ok) onSaved();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="The rule" note="Checked in this order, the first that fits sends the request to its line manager; a value Sales did not fill in never fits. The rest is approved by itself. The figures: the period's requests the workflow decided (since March 2026), by their values today"
        right={d.admin && dirty ? <Button size="small" variant="contained" disableElevation disabled={busy} onClick={() => void save()} sx={{ textTransform: "none" }}>Save</Button> : undefined} />
      <Table size="small">
        <TableHead><TableRow><TableCell sx={headCell}>Goes to the line manager when</TableCell><TableCell sx={{ ...headCell, textAlign: "right" }}>Requests</TableCell></TableRow></TableHead>
        <TableBody>
          {line(<>the order potential is {box("bigFrom", "€")} € or more</>, count("big"))}
          {line(<>the order is up to {box("smallUpTo", "€")} € and the margin up to {box("smallMargin", "%")} %</>, count("small"))}
          {line(<>the order is between {box("midFrom", "€")} and {box("midTo", "€")} € and the margin up to {box("midMargin", "%")} %</>, count("mid"))}
          {line(<>the article is in liquidation <Switch size="small" checked={l.liquidation} disabled={!d.admin} onChange={(e) => setL({ ...l, liquidation: e.target.checked })} slotProps={{ input: { "aria-label": "liquidation" } }} /></>, count("liquidation"))}
          {line(<Box component="span" sx={{ color: MUTED }}>none of these - approved by itself, straight to the Back Office</Box>, auto)}
        </TableBody>
      </Table>
      {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{msg}</Typography>}
    </GlassCard>
  );
}

export function ApprovalsTab({ from, to }: { from: string; to: string }) {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const hist = useMemo(() => d?.history?.rows ?? [], [d]);
  const inPeriod = useMemo(() => hist.filter((h) => { const k = h.enteredAt.slice(0, 10); return k >= from && k <= to; }), [hist, from, to]);
  const waiting = useMemo(() => hist.filter((h) => h.status === STATUS.review && !h.decision && h.open && !done[h.id]).sort((a, b) => a.enteredAt.localeCompare(b.enteredAt)), [hist, done]);
  const wPaged = usePaged(waiting, 10);
  const rPaged = usePaged(d?.rows ?? [], 10);

  if (r === null) return <LoadingPanel label="Reading the GQS requests…" />;
  if (!d) return <UpstreamPanel source="GQS approvals" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const name = (id: string | null) => (id ? d.names[id] ?? d.history?.owners[id] ?? `Owner ${id}` : "—");
  const canDecide = (h: Hist) => d.decidesFor === "any" || (!!h.approver && d.decidesFor.includes(h.approver));
  const call = async (what: string, method: "PUT" | "POST", body: unknown, ok = "Done.") => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? ok : j.error ?? `HTTP ${res.status}`);
      if (j.ok) setN((x) => x + 1);
      return j.ok;
    } catch (e) { setMsg((e as Error).message); return false; } finally { setBusy(null); }
  };
  const decideOne = async (h: Hist, approve: boolean) => {
    if (!window.confirm(`${approve ? "Approve" : "Refuse"} “${h.subject}”?\n\n${approve ? "It goes to the Back Office (New for Back-Office) and the requester is told." : "The requester gets the refusal by mail and the request is closed as Refused."}`)) return;
    if (await call(`d${h.id}`, "POST", { action: "decide", ticketId: h.id, approve }, approve ? "Approved." : "Refused.")) setDone((x) => ({ ...x, [h.id]: approve ? "approved" : "refused" }));
  };

  const auto = inPeriod.filter((h) => h.path === "auto").length;
  const review = inPeriod.filter((h) => h.path === "review").length;
  // before mid-March 2026 the workflow did not write how it decided (211 requests of 09.2025-03.2026)
  const unknown = inPeriod.length - auto - review;
  // the line managers over the period: sent, approved, refused, still waiting, how long a decision takes
  const managers = [...new Set(inPeriod.filter((h) => h.path === "review").map((h) => h.approver ?? ""))].map((id) => {
    const xs = inPeriod.filter((h) => h.path === "review" && (h.approver ?? "") === id);
    const decided = xs.filter((h) => h.decision);
    return {
      id, sent: xs.length, approved: decided.filter((h) => h.decision!.status === STATUS.approved).length, refused: decided.filter((h) => h.decision!.status === STATUS.refused).length,
      waiting: xs.filter((h) => !h.decision && h.status === STATUS.review && h.open).length,
      took: median(decided.map((h) => Date.parse(h.decision!.at) - Date.parse(h.enteredAt))),
    };
  }).sort((a, b) => b.sent - a.sent);
  const mode = d.settings.mode;
  const agree = (x: Row) => !x.workflow?.status ? null : x.reentry ? x.workflow.status === STATUS.review : (x.review ? x.workflow.status === STATUS.review : x.workflow.status === STATUS.auto);

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - the workflow “SARCLA | GQS Ticket Created by Sales” still decides; the hub looks at every new request and puts its answer next to the workflow's. Approve / Refuse below already work (they set the status a line manager sets in HubSpot)." : "Off - the hub does not look at new requests."}</Info>
      ) : !d.writing ? (
        <Info><b>Live - waiting:</b> the HubSpot workflow “SARCLA | GQS Ticket Created by Sales” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub takes over within 2 minutes.</Info>
      ) : null}

      <Grid container spacing={2}>
        {[
          { label: "GQS requests", value: full(inPeriod.length), note: unknown > 0 ? `created by Sales in the period - ${full(unknown)} before March 2026, when how they were decided was not recorded` : `created by Sales in the period${d.history ? ` · read ${when(d.history.at)}` : ""}`, icon: <AssignmentTurnedInOutlinedIcon />, tint: "slate" as const },
          { label: "Approved by themselves", value: full(auto), note: `${pct(auto, inPeriod.length)} - none of the rule's cases, straight to the Back Office`, icon: <AutoModeOutlinedIcon />, tint: "green" as const },
          { label: "Sent to a line manager", value: full(review), note: `${pct(review, inPeriod.length)} - the rule sent them for approval`, icon: <SupervisorAccountOutlinedIcon />, tint: "purple" as const },
          { label: "Waiting now", value: full(waiting.length), note: waiting.length ? `the oldest for ${hours(Date.now() - Date.parse(waiting[0].enteredAt))}` : "nothing is waiting for a line manager", icon: <HourglassEmptyOutlinedIcon />, tint: "amber" as const },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HourglassEmptyOutlinedIcon />} tint="amber" title="Waiting for a line manager"
          note="Approve: the request goes to the Back Office and the requester is told. Refuse: the requester is told and it is closed as Refused - the same as setting the status in HubSpot. Its line manager decides; admins too" />
        {waiting.length ? (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Request", "Requester", "Line manager", "Why", "Waiting", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {wPaged.slice.map((h) => {
                    const v = decide(h.facts, d.settings.limits);
                    return (
                      <TableRow key={h.id}>
                        <TableCell sx={bodyCell}><RequestCell id={h.id} subject={h.subject} customer={h.customer} /></TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{name(h.requester)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 600 }}>{name(h.approver)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, maxWidth: 260 }}>
                          {v.review ? reasonText(v.reason, d.settings.limits) : "back after being further on"}
                          <Box sx={{ fontSize: "0.74rem", color: FAINT }}>{eur(h.facts.potential)} · margin {mpct(h.facts.margin)}</Box>
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{hours(Date.now() - Date.parse(h.enteredAt))}</TableCell>
                        <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                          {canDecide(h) ? (
                            <Box sx={{ display: "flex", gap: 0.75 }}>
                              <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={() => void decideOne(h, true)} sx={{ textTransform: "none" }}>Approve</Button>
                              <Button size="small" variant="outlined" disabled={!!busy} onClick={() => void decideOne(h, false)} sx={{ textTransform: "none", color: RED, borderColor: "rgba(197,34,31,.4)" }}>Refuse</Button>
                            </Box>
                          ) : <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>its line manager decides</Typography>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {wPaged.pager}
          </>
        ) : <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{d.history ? "Nothing is waiting for a line manager." : "The requests are read within minutes of the deploy."}</Typography>}
        {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{msg}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<SupervisorAccountOutlinedIcon />} tint="purple" title="Line managers" note="The period's requests sent for approval, per line manager - and how long a decision took (half of them were faster)" />
        {managers.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>{["Line manager", "Sent", "Approved", "Refused", "Waiting", "A decision took"].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {managers.map((m) => (
                  <TableRow key={m.id || "none"}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600 }}>{m.id ? name(m.id) : "none chosen"}</TableCell>
                    {[m.sent, m.approved, m.refused, m.waiting].map((x, i) => <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x)}</TableCell>)}
                    <TableCell sx={{ ...bodyCell, textAlign: "right" }}>{m.took === null ? "—" : hours(m.took)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No request went to a line manager in the period.</Typography>}
      </GlassCard>

      <RuleCard d={d} inPeriod={inPeriod.filter((h) => h.path !== "none")} onSaved={() => setN((x) => x + 1)} />

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="New requests the hub looked at"
          note={d.writing ? "What the hub wrote on each new request" : "Each new request, 2 minutes after it was created: what the hub would do, and what the workflow did"} />
        {d.rows.length ? (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Request", "Created", "The hub", d.writing || d.rows.some((x) => x.live) ? "Written" : "The workflow", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {rPaged.slice.map((x) => {
                    const a = agree(x);
                    return (
                      <TableRow key={x.key}>
                        <TableCell sx={bodyCell}><RequestCell id={x.ticketId} subject={x.subject} customer={x.customer} /></TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(x.enteredAt)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                          <Box sx={{ fontWeight: 600, color: INK }}>{x.reentry ? "back after being further on - review" : x.review ? `to ${name(x.approver)}` : "approved by itself"}</Box>
                          {x.reason && <Box sx={{ color: MUTED }}>{reasonText(x.reason, d.settings.limits)}</Box>}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, maxWidth: 300 }}>
                          {x.live ? (x.live.error ? <Box sx={{ color: RED }}>{x.live.error}</Box> : x.live.done.join(" · ")) : x.workflow?.status ?? "not yet"}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                          {x.live ? <Chip tint={x.live.error ? "pink" : "green"}>{x.live.error ? "not written" : "written"}</Chip> : a === null ? null : <Chip tint={a ? "green" : "pink"}>{a ? "same" : "differs"}</Chip>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {rPaged.pager}
          </>
        ) : <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{d.last ? "No new request since the hub started looking." : "The first look comes within minutes of the deploy."}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 }, borderColor: d.writing ? RED : undefined }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 2 minutes: the requests created by Sales at least 2 minutes before. Back: Live off, then the workflow on again" />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SwitchRow title="Look at every new request" checked={mode !== "off"} disabled={!d.admin || !!busy}
              onChange={(v) => { if (v || window.confirm("Stop looking at new GQS requests?")) void call("mode", "PUT", { mode: v ? "shadow" : "off" }, "Saved."); }}
              text="Off: the hub does nothing. On: every request Sales creates is decided by the hub's rule and shown here." />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <SwitchRow title="Live - write and mail" checked={mode === "live"} disabled={!d.admin || !!busy || mode === "off"}
              chips={d.writing ? <Chip tint="pink">LIVE</Chip> : mode === "live" ? <Chip tint="amber">waiting</Chip> : <Chip tint="slate">paused</Chip>}
              onChange={(v) => { if (!v || window.confirm("Switch GQS approvals LIVE?\n\nFrom the next request the hub writes the subject, the requester, the O-number (and the RFQ sheet), the Sales follow-up ticket, and sends it to its line manager or approves it - with the mails.\n\nIt writes nothing until the workflow SARCLA | GQS Ticket Created by Sales is switched off in HubSpot.")) void call("mode", "PUT", { mode: v ? "live" : "shadow" }, "Saved."); }}
              text={mode !== "live" ? "Paused: the workflow decides; the hub's answer is shown next to it." : d.writing ? `The hub decides every new request${d.settings.liveFrom ? ` - since ${when(d.settings.liveFrom)}` : ""}.` : "Chosen - the hub starts as soon as the workflow is switched off."} />
          </Grid>
        </Grid>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.5 }}>
          {d.last ? `Last look ${when(d.last.at)}: ${full(d.last.looked)} in “Created by Sales”, ${full(d.last.handled)} new${d.last.written ? `, ${full(d.last.written)} written` : ""}${d.last.error ? ` - ${d.last.error}` : ""}.` : "Not looked yet."}
        </Typography>
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
            <Button variant="outlined" size="small" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            <Button variant="outlined" size="small" disabled={!!busy} onClick={() => void call("history", "POST", { action: "history" }, "The year read again.")} sx={{ textTransform: "none" }}>Read the year again</Button>
            {busy && <CircularProgress size={14} />}
          </Box>
        )}
      </GlassCard>
    </>
  );
}
