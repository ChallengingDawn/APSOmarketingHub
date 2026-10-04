"use client";

// DoC - DECLARATIONS OF CONFORMITY. Moved here from the APSOAssistant micro apps,
// and with it the work itself, out of SARCLA C2S V1 where it never belonged.
//
// Every web order whose customer added the Declaration of Conformity (8001228582)
// to a seal order, followed from the shop to the email: ordered -> ERP number ->
// invoiced -> emailed with the PDF attached. The board is read straight out of
// HubSpot, so it shows the truth whichever deployment is doing the sending.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, HAIRLINE, INK, LoadingPanel, MUTED, NotConnectedPanel, Section, UpstreamPanel } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { SERIES } from "@/app/charts/palette";
import { full } from "@/app/charts/format";
import type { BoardRow, Phase } from "@/lib/doc/board";

const PORTAL = "26492587";
const hsOrderUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-123/${id}`;
const POLL_MS = 5 * 60_000;

const BLUE = SERIES[0];
const GREEN = "#1e7e45";
const AMBER = "#b26a00";
const RED = "#c5221f";
const GREY = "#8a929c";

type Run = { at: string; error?: string; [k: string]: unknown } | null;
type DocData = {
  board: { at: string; total: number; counts: Partial<Record<Phase, number>>; rows: BoardRow[] };
  service: {
    captureOn: boolean; sendingOn: boolean; captureFrom: string | null;
    smtpConfigured: boolean; magentoConfigured: boolean; missingForDocuments: string[];
    captureEveryMin: number; sweepEveryMin: number; lastCapture: Run; lastSweep: Run;
    sentToday: number; maxPerDay: number; isAdmin: boolean; copyTo?: string[];
  };
};

const PHASE: Record<Phase, { label: string; color: string; hint: string }> = {
  "awaiting-erp": { label: "Waiting for ERP no.", color: GREY, hint: "Flagged in HubSpot; the A-number arrives with the nightly Magento export, usually 5-8 days later." },
  "awaiting-invoice": { label: "Waiting for invoice", color: BLUE, hint: "Linked to its ERP order; goes out the morning after Compass shows a delivery as invoiced." },
  due: { label: "Due - next sweep", color: AMBER, hint: "Invoiced. The hourly sweep emails it, as long as sending is switched on." },
  sending: { label: "Sending", color: AMBER, hint: "Claimed for sending. If it stays here, the send was interrupted: check before resending - it is never resent automatically." },
  sent: { label: "Sent", color: GREEN, hint: "Emailed with the PDF attached; the email is logged on the HubSpot order." },
  "back-office": { label: "Back Office", color: RED, hint: "No declaration was found in AP-Link for any position - a CERTIFICATES ticket was opened." },
  cancelled: { label: "Cancelled", color: GREY, hint: "Every record of the ERP order is cancelled." },
  expired: { label: "Expired", color: GREY, hint: "Never linked to an ERP order within 120 days." },
};

const FILTERS: { key: string; label: string; phases: Phase[] }[] = [
  { key: "all", label: "All", phases: [] },
  { key: "open", label: "Open", phases: ["awaiting-erp", "awaiting-invoice", "due", "sending"] },
  { key: "sent", label: "Sent", phases: ["sent"] },
  { key: "attention", label: "Needs attention", phases: ["back-office", "sending"] },
  { key: "closed", label: "Cancelled / expired", phases: ["cancelled", "expired"] },
];

/** HubSpot dates and our own run stamps ("2026-10-01T09:52Z" included) in Swiss form. */
function when(iso: string | null | undefined, time = false): string {
  if (!iso) return "—";
  const d = new Date(/T\d\d:\d\dZ$/.test(iso) ? iso.replace("Z", ":00Z") : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Notice({ tone, children }: { tone: "info" | "warn" | "bad"; children: React.ReactNode }) {
  const c = tone === "bad" ? { bg: "#fdf3f2", bd: "#f2c4c0", fg: RED } : tone === "warn" ? { bg: "#fffaf0", bd: "#f0d9a8", fg: "#7a5b00" } : { bg: "#f4f8fc", bd: "#d6e4f2", fg: "#33475b" };
  return (
    <Box sx={{ mb: 2.5, px: 2, py: 1.25, borderRadius: 2, border: `1px solid ${c.bd}`, bgcolor: c.bg }}>
      <Typography sx={{ fontSize: "0.82rem", color: c.fg, lineHeight: 1.5 }}>{children}</Typography>
    </Box>
  );
}

// ordered -> ERP number -> invoiced -> emailed
function Steps({ s, phase }: { s: BoardRow["steps"]; phase: Phase }) {
  const items: [string, boolean][] = [["Ordered", s.ordered], ["ERP no.", s.linked], ["Invoiced", s.invoiced], ["Emailed", s.emailed]];
  const end = phase === "back-office" ? RED : GREEN;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} aria-label={items.map(([l, d]) => `${l} ${d ? "done" : "not yet"}`).join(", ")}>
      {items.map(([label, done], i) => (
        <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={`${label}: ${done ? "done" : "not yet"}`} arrow>
            <Box sx={{ width: 11, height: 11, borderRadius: "50%", border: `2px solid ${done ? (i === 3 ? end : BLUE) : "#d0d5db"}`, bgcolor: done ? (i === 3 ? end : BLUE) : "transparent" }} />
          </Tooltip>
          {i < items.length - 1 && <Box sx={{ width: 14, height: 2, bgcolor: items[i + 1][1] ? BLUE : HAIRLINE }} />}
        </Box>
      ))}
    </Box>
  );
}

function RunLine({ label, run, every }: { label: string; run: Run; every: number }) {
  if (!run) return <>{label} every {every} min - no run recorded here yet</>;
  if (run.error) return <><b style={{ color: RED }}>{label} failed {when(run.at, true)}</b>: {run.error}</>;
  const extra = typeof run.scanned === "number" ? `, ${run.scanned} shop orders read` : typeof run.sent === "number" ? `, ${run.sent} sent` : "";
  return <>{label} every {every} min, last {when(run.at, true)}{extra}</>;
}

type Candidate = { incrementId: string; createdAt: string; company: string; country: string };
type CandidatesResult =
  | { configured: false; missing: string[] }
  | { configured: true; ok: true; data: { rows: Candidate[] } }
  | { configured: true; ok: false; error: string };

/* The latest shop orders with the declaration line, straight from Magento - to test with. */
function Candidates({ onUse, followed }: { onUse: (web: string) => void; followed: Set<string> }) {
  const [res, setRes] = useState<CandidatesResult | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/uc/doc/candidates", { cache: "no-store" })
      .then((r) => r.json() as Promise<CandidatesResult>)
      .then((j) => live && setRes(j))
      .catch((e) => live && setRes({ configured: true, ok: false, error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, []);

  if (res === null) return <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 2 }}>Reading the latest declaration orders from the shop…</Typography>;
  if (!res.configured) return <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 2 }}>The shop list needs {res.missing.join(", ")}.</Typography>;
  if (!res.ok) return <Typography sx={{ fontSize: "0.8rem", color: RED, mt: 2 }}>The shop did not answer: {res.error}</Typography>;
  const rows = res.data.rows;
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, mb: 0.75 }}>
        Latest shop orders with the declaration line ({rows.length}) - pick one to test with
      </Typography>
      <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: 2, maxHeight: 360, overflowY: "auto" }}>
        <Table size="small" stickyHeader sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              {["Ordered", "Shop order", "Customer", "Country", ""].map((h) => (
                <TableCell key={h} sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", bgcolor: "#fafbfc" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.incrementId} hover>
                <TableCell sx={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{when(c.createdAt.replace(" ", "T") + "Z")}</TableCell>
                <TableCell sx={{ fontSize: "0.78rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {c.incrementId}
                  {followed.has(c.incrementId) && <Chip size="small" label="on the board" sx={{ ml: 1, height: 18, fontSize: "0.62rem" }} />}
                </TableCell>
                <TableCell sx={{ fontSize: "0.78rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company || "—"}</TableCell>
                <TableCell sx={{ fontSize: "0.78rem" }}>{c.country || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Button size="small" onClick={() => onUse(c.incrementId)} sx={{ minWidth: 0, fontSize: "0.72rem" }}>Use</Button>
                  <Tooltip title="Preview the email (nothing is sent)" arrow>
                    <IconButton size="small" component="a" href={`/api/uc/doc/preview?web=${c.incrementId}`} target="_blank" rel="noopener" aria-label={`Preview the email for ${c.incrementId}`}>
                      <MailOutlineIcon sx={{ fontSize: 17, color: BLUE }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

/* Admin only: one order's real email, PDFs attached, to one internal address. */
function TestSend({ web, setWeb, open, setOpen, followed }: {
  web: string; setWeb: (w: string) => void; open: boolean; setOpen: (o: boolean) => void; followed: Set<string>;
}) {
  const [to, setTo] = useState("");
  const [lang, setLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const q = new URLSearchParams({ web, to, ...(lang ? { lang } : {}) });
      const r = await fetch(`/api/uc/doc/test?${q}`, { method: "POST" });
      const j = (await r.json()) as { ok: boolean; web?: string; sent?: boolean; error?: string; summary?: string; attached?: string[] };
      setResult(j.ok && j.sent
        ? { ok: true, text: `Sent to ${to}: ${j.summary}. Attached: ${(j.attached ?? []).join(", ")}` }
        : { ok: false, text: j.error ?? j.summary ?? "Not sent." });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box id="doc-test" component="details" open={open} onToggle={(e: React.SyntheticEvent<HTMLDetailsElement>) => setOpen(e.currentTarget.open)}
      sx={{ mt: 3, "& summary": { cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: INK } }}>
      <summary>Test the whole chain from this deployment</summary>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1, mb: 1.5, maxWidth: 720 }}>
        Sends one order&apos;s real email - PDFs from AP-Link attached, through HubSpot SMTP - to one internal address only. Nothing is stamped
        on the order and nothing is logged in HubSpot. Either number works: the shop&apos;s (6000291517) or the ERP&apos;s (A26.660715).
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <TextField size="small" label="Shop or ERP order number" value={web} onChange={(e) => setWeb(e.target.value)} sx={{ width: 220 }} />
        <TextField size="small" label="Send to" placeholder="name@apsoparts.com" value={to} onChange={(e) => setTo(e.target.value)} sx={{ width: 260 }} />
        <TextField size="small" select label="Language" value={lang} onChange={(e) => setLang(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">As the customer</MenuItem>
          {["en", "de", "fr", "it", "nl", "pl"].map((l) => <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>)}
        </TextField>
        <Button variant="outlined" disabled={busy || !web || !to} onClick={send} sx={{ minHeight: 40 }}>
          {busy ? <CircularProgress size={16} /> : "Send test"}
        </Button>
      </Box>
      {result && <Typography sx={{ fontSize: "0.8rem", mt: 1.25, color: result.ok ? GREEN : RED }}>{result.text}</Typography>}
      {open && <Candidates onUse={(w) => { setWeb(w); setResult(null); }} followed={followed} />}
    </Box>
  );
}

export default function DocApp() {
  const [tick, setTick] = useState(0);
  const [forced, setForced] = useState(0);
  const [filter, setFilter] = useState("all");
  const [testWeb, setTestWeb] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const testThis = (web: string) => {
    setTestWeb(web);
    setTestOpen(true);
    requestAnimationFrame(() => document.getElementById("doc-test")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);

  // A click on Refresh asks HubSpot again; the five-minute poll reads the two-minute cache.
  const url = forced ? `/api/uc/doc?refresh=1&n=${forced}` : "/api/uc/doc";
  const held = useHeld<DocData>(url, [url, tick]);
  const refresh = () => setForced((n) => n + 1);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    const all = data?.board.rows ?? [];
    return !f || !f.phases.length ? all : all.filter((row) => f.phases.includes(row.phase));
  }, [data, filter]);

  const header = (
    <PageHeader
      title="DoC"
      subtitle="Seal Declarations of Conformity, followed from the shop order to the email that carries the PDF"
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
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>{header}{children}</Box>
  );

  if (r === null) return shell(<LoadingPanel label="Reading the flagged orders from HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (DoC orders)" error={r.error} status={r.status} onRetry={refresh} />);

  const { board, service: svc } = r.data;
  const c = board.counts;
  const open = (c["awaiting-erp"] ?? 0) + (c["awaiting-invoice"] ?? 0) + (c.due ?? 0);
  const attention = (c["back-office"] ?? 0) + (c.sending ?? 0);
  const readOnly = !svc.captureOn && !svc.sendingOn;
  const canTest = svc.isAdmin && svc.smtpConfigured && svc.magentoConfigured;

  return shell(
    <>
      {readOnly && (
        <Notice tone="info">
          This deployment only reads. SARCLA C2S V1 still flags the orders and sends the emails; the board shows its work, because the state
          lives in HubSpot. It moves here when DOC_CAPTURE_FROM and DOC_SEND_EMAIL are set on this deployment and removed from C2S V1.
        </Notice>
      )}
      {svc.captureOn && !svc.sendingOn && (
        <Notice tone="warn">Sending is switched off: orders are still followed, and invoiced ones wait under &quot;Due&quot; until it is switched on.</Notice>
      )}
      {svc.missingForDocuments.length > 0 && (
        <Notice tone="warn">Previews and test sends need {svc.missingForDocuments.join(", ")}, which this deployment does not have.</Notice>
      )}

      <Section sx={{ mb: 2.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Chip size="small" label={svc.sendingOn ? "Sending ON" : "Sending OFF"} sx={{ fontWeight: 700, color: "#fff", bgcolor: svc.sendingOn ? GREEN : GREY }} />
          <Chip size="small" label={svc.captureOn ? "Capture ON" : "Capture OFF"} sx={{ fontWeight: 700, color: "#fff", bgcolor: svc.captureOn ? GREEN : GREY }} />
          <Chip size="small" variant="outlined" label={svc.smtpConfigured ? "SMTP configured" : "SMTP not configured"}
            sx={{ borderColor: svc.smtpConfigured ? GREEN : GREY, color: svc.smtpConfigured ? GREEN : MUTED }} />
          {svc.sendingOn && (
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{full(svc.sentToday)} of {full(svc.maxPerDay)} sent today (daily breaker)</Typography>
          )}
          {svc.sendingOn && !!svc.copyTo?.length && (
            <Tooltip title="Each declaration email is also sent, as a separate message after the customer's, to these addresses. The customer does not see it." arrow>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>· copy of every email to {svc.copyTo.join(", ")}</Typography>
            </Tooltip>
          )}
        </Box>
        {!readOnly && (
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.25, lineHeight: 1.6 }}>
            Orders followed from <b>{when(svc.captureFrom, true)}</b> · <RunLine label="capture" run={svc.lastCapture} every={svc.captureEveryMin} />
            {" · "}<RunLine label="sweep" run={svc.lastSweep} every={svc.sweepEveryMin} />
          </Typography>
        )}
      </Section>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><StatTile label="Followed" value={full(board.total)} note="web orders with the declaration line" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <StatTile label="Open" value={full(open)} note={`${full(c["awaiting-erp"] ?? 0)} wait for the ERP no. · ${full(c["awaiting-invoice"] ?? 0)} for the invoice`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><StatTile label="Due" value={full(c.due ?? 0)} note="invoiced, out with the next sweep" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><StatTile label="Sent" value={full(c.sent ?? 0)} note="emailed with the PDF attached" /></Grid>
        <Grid size={{ xs: 12, sm: 12, lg: 2.4 }}><StatTile label="Needs attention" value={full(attention)} note="Back Office ticket, or a send that was interrupted" /></Grid>
      </Grid>

      <Section sx={{ p: 0, opacity: held.stale ? 0.6 : 1, transition: "opacity 0.2s" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: INK, mr: 1 }}>Orders</Typography>
          {FILTERS.map((f) => {
            const n = f.phases.length ? f.phases.reduce((s, p) => s + (c[p] ?? 0), 0) : board.total;
            const on = filter === f.key;
            return (
              <Chip key={f.key} size="small" label={`${f.label} (${full(n)})`} onClick={() => setFilter(f.key)}
                sx={{ fontSize: "0.72rem", fontWeight: on ? 700 : 500, bgcolor: on ? BLUE : "#f1f3f5", color: on ? "#fff" : "#33475b", "&:hover": { bgcolor: on ? BLUE : "#e6e9ed" } }} />
            );
          })}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.7rem", color: GREY }}>as of {when(board.at, true)}</Typography>
        </Box>
        {rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
              {board.total ? "No order in this view." : "No order with a declaration yet - the next one appears here within 15 minutes of being placed."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  {["Ordered", "Shop order", "ERP order", "Customer", "ERP stage", "Process", "Status", ""].map((h) => (
                    <TableCell key={h} sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const ph = PHASE[row.phase] ?? PHASE["awaiting-erp"];
                  return (
                    <TableRow key={row.web} hover>
                      <TableCell sx={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{when(row.orderedAt)}</TableCell>
                      <TableCell sx={{ fontSize: "0.78rem", fontFamily: "monospace" }}>{row.web}</TableCell>
                      <TableCell sx={{ fontSize: "0.78rem", fontFamily: "monospace" }}>{row.aNumber ?? "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.78rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.company || "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>{row.erpStage ?? "—"}</TableCell>
                      <TableCell><Steps s={row.steps} phase={row.phase} /></TableCell>
                      <TableCell>
                        <Tooltip title={`${ph.hint}${row.status ? ` — ${row.status}` : ""}`} arrow>
                          <Chip size="small" label={row.phase === "sent" && row.sentAt ? `Sent ${when(row.sentAt, true)}` : ph.label}
                            sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#fff", bgcolor: ph.color }} />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Preview the email this customer gets (nothing is sent)" arrow>
                          <IconButton size="small" component="a" href={`/api/uc/doc/preview?web=${row.web}`} target="_blank" rel="noopener" aria-label={`Preview the email for ${row.web}`}>
                            <MailOutlineIcon sx={{ fontSize: 18, color: BLUE }} />
                          </IconButton>
                        </Tooltip>
                        {canTest && (
                          <Tooltip title="Send yourself this order's real email (test)" arrow>
                            <IconButton size="small" onClick={() => testThis(row.web)} aria-label={`Test ${row.web}`}>
                              <SendOutlinedIcon sx={{ fontSize: 17, color: BLUE }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.hubspotIds[0] && (
                          <Tooltip title="Open the order in HubSpot" arrow>
                            <IconButton size="small" component="a" href={hsOrderUrl(row.hubspotIds[0])} target="_blank" rel="noopener" aria-label={`Open ${row.web} in HubSpot`}>
                              <OpenInNewIcon sx={{ fontSize: 17, color: BLUE }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Section>

      {canTest && (
        <TestSend web={testWeb} setWeb={setTestWeb} open={testOpen} setOpen={setTestOpen} followed={new Set(board.rows.map((row) => row.web))} />
      )}
    </>,
  );
}
