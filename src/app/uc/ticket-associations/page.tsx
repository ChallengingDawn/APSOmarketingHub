"use client";

// TICKET ASSOCIATIONS - a HubSpot app (UC & HubSpot Apps > HubSpot apps). Back Office, ESO and
// TSA tickets linked to the orders and Products & Pricing articles they name, empty reference
// fields filled, cut-to-size flagged - every 3 minutes, by the hub, in place of the HubSpot
// workflow that ran on the Tickets app (SARCLA, 17.10.2026: "migrate the workflow here").
// Same kit as the other UC apps: the period on top, Overview and Settings as UC tabs.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { LastRun, Mode, Settings } from "@/lib/ticketAssoc/run";

type Row = {
  ticket_id: string; at: string; pipeline: string | null; why: string; subject: string | null; orders: string[]; articles: string[];
  offer_orders: string[]; new_orders: number; new_articles: number; filled: string[]; c2s: boolean; ok: boolean; error: string | null;
};
type Pipe = { pipeline: string | null; tickets: number; orders: number; articles: number; filled: number; c2s: number; failed: number };
type Data = {
  settings: Settings; mode: "preview" | "live"; byPipeline: Pipe[]; recent: Row[]; from: string; to: string;
  last: { preview: LastRun | null; live: LastRun | null }; everyMinutes: number; admin: boolean;
};
type View = "overview" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", settings: "#settings" };
const PIPE: Record<string, string> = { BO: "Back Office", ESO: "ESO", TSA: "TSA" };
const WHY: Record<string, string> = { new: "new", stage: "moved stage", retry: "asked again" };
const FIELD: Record<string, string> = { order_number: "order number", articles_on_the_ticket: "articles", c2s_ticket: "C2S" };

function ModeLine({ d }: { d: Data }) {
  const m = d.settings.mode;
  if (m === "off") return <Info>Off - the hub links no tickets. The HubSpot workflow, while it runs, still does.</Info>;
  if (m === "preview") {
    return (
      <Info>
        Preview - every {d.everyMinutes} minutes the hub reads the changed tickets and records what it <b>would</b> write, without writing.
        The HubSpot workflow still writes meanwhile, so a ticket it already handled shows nothing new here - that is the two agreeing.
        When this looks right: Settings &gt; Live, then switch the workflow off in HubSpot.
      </Info>
    );
  }
  return null;
}

function Overview({ d }: { d: Data }) {
  const would = d.mode === "preview";
  const sum = (k: keyof Pipe) => d.byPipeline.reduce((a, p) => a + Number(p[k] ?? 0), 0);
  const { slice, pager } = usePaged(d.recent, 15);
  return (
    <>
      <ModeLine d={d} />
      <Grid container spacing={2}>
        {[
          { icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const, label: "Tickets handled", value: sum("tickets"), note: "new, or moved stage" },
          { icon: <ReceiptLongOutlinedIcon />, tint: "purple" as const, label: would ? "Order links to write" : "Order links written", value: sum("orders"), note: "the orders the ticket names" },
          { icon: <Inventory2OutlinedIcon />, tint: "green" as const, label: would ? "Article links to write" : "Article links written", value: sum("articles"), note: "checked against Products & Pricing" },
          { icon: <EditNoteOutlinedIcon />, tint: "amber" as const, label: would ? "Fields to fill" : "Fields filled", value: sum("filled"), note: "only when empty" },
          { icon: <ContentCutOutlinedIcon />, tint: "pink" as const, label: would ? "C2S to flag" : "C2S flagged", value: sum("c2s"), note: "cut-to-size order or text" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="By pipeline" note="Tickets the hub processed in the period" />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Pipeline", "Tickets", "Order links", "Article links", "Fields", "C2S", "Failed"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.byPipeline.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket processed in this period yet.</TableCell></TableRow>}
            {d.byPipeline.map((p) => (
              <TableRow key={p.pipeline ?? "-"} hover>
                <TableCell sx={{ ...bodyCell, fontWeight: 600 }}>{PIPE[p.pipeline ?? ""] ?? p.pipeline ?? "-"}</TableCell>
                {[p.tickets, p.orders, p.articles, p.filled, p.c2s].map((n, i) => <TableCell key={i} sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(n)}</TableCell>)}
                <TableCell sx={{ ...bodyCell, color: p.failed ? RED : MUTED, fontVariantNumeric: "tabular-nums" }}>{full(p.failed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Latest tickets" note={would ? "What the hub would write - nothing is written in preview" : "What the hub wrote"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Pipeline", "Why", "Orders", "Articles", "Filled", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.recent.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nothing yet in this period.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box component="a" href={hsTicket(r.ticket_id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>
                    {r.subject || `Ticket ${r.ticket_id}`}
                  </Box>
                  {!r.ok && <Typography sx={{ fontSize: "0.74rem", color: RED }}>{r.error ?? "failed - asked again next run"}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{WHY[r.why] ?? r.why}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.orders.length ? `${r.orders.join(", ")}${r.new_orders ? ` (+${r.new_orders})` : ""}` : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.articles.length ? `${r.articles.slice(0, 3).join(", ")}${r.articles.length > 3 ? ` +${r.articles.length - 3}` : ""}${r.new_articles ? ` (+${r.new_articles})` : ""}` : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{[...r.filled.map((f) => FIELD[f] ?? f), ...(r.c2s && !r.filled.includes("c2s_ticket") ? ["C2S"] : [])].join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

function LastRunLine({ label, r }: { label: string; r: LastRun | null }) {
  if (!r) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{label}: has not run yet.</Typography>;
  return (
    <Typography sx={{ fontSize: "0.84rem", color: r.error ? RED : INK }}>
      {label}: {when(r.at)} - {full(r.read)} changed tickets read, {full(r.processed)} processed ({full(r.skipped)} left alone), {full(r.newOrders)} order and {full(r.newArticles)} article links, {full(r.filled)} fields, {full(r.c2s)} C2S{r.failed ? `, ${full(r.failed)} failed` : ""} - {r.seconds} s
      {r.error ? ` - ${r.error}` : ""}
    </Typography>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<Record<string, unknown> | null>(null);

  const save = async (change: { mode?: Mode; extended?: boolean }) => {
    setBusy("save"); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-associations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: "Saved - the next run (within 3 minutes) works this way." } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      if (j.ok) onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const runNow = async () => {
    setBusy("run"); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run" }) });
      const j = (await r.json()) as { ok: boolean; data?: LastRun & { skipped?: string }; error?: string };
      setMsg(j.ok ? { ok: true, text: j.data?.skipped ? `Not run: ${j.data.skipped}.` : `Ran: ${j.data?.processed ?? 0} tickets processed.` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const r = await fetch(`/api/uc/ticket-associations?ticket=${encodeURIComponent(tid)}`);
      const j = (await r.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string };
      setCheck(j.ok ? j.data ?? {} : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setCheck({ error: String((e as Error).message) }); } finally { setBusy(null); }
  };

  return (
    <>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes, on Back Office, ESO and TSA tickets that are new or moved stage`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Mode</Typography>
            {d.admin ? (
              <Choice<Mode> value={d.settings.mode} onChange={(m) => void save({ mode: m })} options={[
                { key: "off", label: "Off" }, { key: "preview", label: "Preview - writes nothing" }, { key: "live", label: "Live - writes to HubSpot" },
              ]} />
            ) : <Chip tint={d.settings.mode === "live" ? "green" : "slate"}>{d.settings.mode}</Chip>}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Evidence</Typography>
            {d.admin ? (
              <Choice<"fields" | "extended"> value={d.settings.extended ? "extended" : "fields"} onChange={(v) => void save({ extended: v === "extended" })} options={[
                { key: "fields", label: "The ticket's fields - as the HubSpot workflow" },
                { key: "extended", label: "Also its e-mails, and ESO / TSA offers to the order that followed" },
              ]} />
            ) : <Chip tint="slate">{d.settings.extended ? "extended" : "the ticket's fields"}</Chip>}
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {d.settings.by ? `Set by ${d.settings.by}, ${when(d.settings.at)}.` : "Not set yet - preview, the ticket's fields."}
            {!d.admin && " Only an admin can change it."}
          </Typography>
          <LastRunLine label="Last live run" r={d.last.live} />
          <LastRunLine label="Last preview" r={d.last.preview} />
          {d.admin && (
            <Box>
              <Button variant="outlined" size="small" onClick={() => void runNow()} disabled={!!busy || d.settings.mode === "off"} sx={{ borderRadius: "999px", textTransform: "none" }}>
                {busy === "run" ? <CircularProgress size={14} /> : "Run now"}
              </Button>
            </Box>
          )}
          {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? INK : RED }}>{msg.text}</Typography>}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read and planned, never written - what the hub finds on it and would write now" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (tid.trim() && !busy) void doCheck(); }}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 412345678901" inputProps={{ "aria-label": "Ticket id" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!tid.trim() || !!busy} sx={{ borderRadius: "999px", textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
            {"error" in check && check.error ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>{String(check.error)}</Typography> : (
              <>
                {check.note ? <Typography sx={{ fontSize: "0.84rem" }}>{String(check.note)}</Typography> : null}
                {check.pipeline ? (
                  <>
                    <Typography sx={{ fontSize: "0.84rem" }}><b>{String(check.subject ?? "")}</b> ({PIPE[String(check.pipeline)] ?? String(check.pipeline)})</Typography>
                    <Typography sx={{ fontSize: "0.84rem" }}>Orders named: {(check.orders as string[]).join(", ") || "none"} - {String(check.newOrders)} not linked yet</Typography>
                    <Typography sx={{ fontSize: "0.84rem" }}>Articles confirmed: {(check.articles as string[]).join(", ") || "none"} - {String(check.newArticles)} not linked yet</Typography>
                    {(check.offerOrders as string[]).length ? <Typography sx={{ fontSize: "0.84rem" }}>Offer to order: {(check.offerOrders as string[]).join(", ")}</Typography> : null}
                    <Typography sx={{ fontSize: "0.84rem" }}>Would fill: {Object.keys(check.fill as object).map((f) => FIELD[f] ?? f).join(", ") || "nothing"}</Typography>
                    <Box component="a" href={hsTicket(String(check.ticket))} target="_blank" rel="noopener" sx={{ fontSize: "0.82rem" }}>Open in HubSpot</Box>
                  </>
                ) : null}
              </>
            )}
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketAssociations() {
  const { window: win } = useReportingWindow();
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const url = `/api/uc/ticket-associations?from=${win.from}&to=${win.to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tickets the hub linked…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ticket associations" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (view === "settings") body = <Box id="ticketassoc-panel-settings" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><SettingsTab d={r.data} onChanged={() => setN((x) => x + 1)} /></Box>;
  else body = <Box id="ticketassoc-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Overview d={r.data} /></Box>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket associations"
        subtitle="Tickets linked to the orders and articles they name - by the hub, every 3 minutes"
        rightSlot={view !== "settings" ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        ) : undefined}
      />
      <Box>
        <ReportTabs name="ticketassoc" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {body}
    </Box>
  );
}
