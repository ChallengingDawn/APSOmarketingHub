"use client";

// STOCK TO PARTNERS (SARCLA 18.10.2026) - a HubSpot app (UC & HubSpot Apps > HubSpot apps). Every morning at 07:00
// Zurich a partner gets its article list - its code and ours - with our stock, MOQ and status as an Excel file by
// e-mail. One tab per partner; first ITAFRAN. Same kit as the other UC apps.

import { useEffect, useState } from "react";
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
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import PinOutlinedIcon from "@mui/icons-material/PinOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { PartnerSettings, SendResult } from "@/lib/partnerStock/engine";
import type { Line, PartnerMode } from "@/lib/partnerStock/rules";

type LogRow = { at: string; kind: string; mode: string; recipients: string[]; articles: number; in_stock: number; ok: boolean; error: string | null };
type Data = {
  partners: { key: string; name: string }[]; partner: { key: string; name: string; codeHeader: string; sheet: string; contact: string };
  settings: PartnerSettings; testTo: string[]; lines: Line[];
  summary: { articles: number; inStock: number; moq: number; inactive: number; specials: number };
  last: SendResult | null; log: LogRow[]; next: string | null; mailReady: boolean; admin: boolean;
};
type View = "itafran";
const VIEW_HASH: Record<View, string> = { itafran: "#itafran" };
const STATUS_TINT: Record<string, "green" | "slate" | "amber" | "pink"> = { Active: "green", Inactive: "slate", Liquidation: "amber", Special: "pink" };

function Sending({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const s = d.settings;
  const [to, setTo] = useState(s.to.join(", "));
  const [cc, setCc] = useState(s.cc.join(", "));
  const [testTo, setTestTo] = useState(s.testTo.join(", "));
  const [replyTo, setReplyTo] = useState(s.replyTo ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setTo(s.to.join(", ")); setCc(s.cc.join(", ")); setTestTo(s.testTo.join(", ")); setReplyTo(s.replyTo ?? ""); }, [s.to, s.cc, s.testTo, s.replyTo]);

  const put = async (change: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const r = await fetch("/api/uc/partner-stock", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner: d.partner.key, ...change }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: "Saved." } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      if (j.ok) onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const sendTest = async () => {
    setBusy("test"); setMsg(null);
    try {
      const r = await fetch("/api/uc/partner-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner: d.partner.key, action: "send-test" }) });
      const j = (await r.json()) as { ok: boolean; error?: string; data?: SendResult };
      setMsg(j.ok ? { ok: true, text: `Test sent to ${(j.data?.to ?? []).join(", ")}.` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };

  return (
    <GlassCard>
      <CardTitle icon={<ForwardToInboxOutlinedIcon />} tint="blue" title="Sending" note={`Every ${s.weekdaysOnly ? "working day" : "day"} at 07:00 Zurich time - the file with today's stock, MOQ and status`} />
      <Box sx={{ display: "grid", gap: 1.75 }}>
        {d.admin ? (
          <Choice<PartnerMode> value={s.mode} onChange={(v) => void put({ mode: v }, "mode")} options={[
            { key: "off", label: "Off" }, { key: "test", label: "Test - only to the test address" }, { key: "live", label: `Live - to ${d.partner.name}` },
          ]} />
        ) : <Chip tint="slate">{s.mode}</Chip>}
        <Typography sx={{ fontSize: "0.84rem", color: INK }}>
          {s.mode === "off" ? "Off - nothing is sent." : s.mode === "test"
            ? `Test - the file goes to ${d.testTo.join(", ") || "nobody yet (set a test address)"}, not to ${d.partner.name}.`
            : `Live - the file goes to ${s.to.join(", ")}${s.cc.length ? `, copy ${s.cc.join(", ")}` : ""}.`}
          {d.next ? ` Next: ${d.next}.` : ""}
          {!d.mailReady && " The hub's mail relay is not set up - nothing can be sent."}
        </Typography>
        {d.admin && (
          <>
            <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              <TextField size="small" label={`Send to (${d.partner.name})`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@itafran.com, ..." />
              <TextField size="small" label="Copy (cc)" value={cc} onChange={(e) => setCc(e.target.value)} />
              <TextField size="small" label="Test address" value={testTo} onChange={(e) => setTestTo(e.target.value)} helperText={s.testTo.length ? undefined : `Empty: ${d.testTo.join(", ") || "-"}`} />
              <TextField size="small" label="Replies go to" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} helperText={s.replyTo ? undefined : `Empty: ${d.partner.contact} - named in the mail for questions`} />
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={() => void put({ to, cc, testTo, replyTo }, "save")} sx={{ borderRadius: "999px", textTransform: "none" }}>
                {busy === "save" ? <CircularProgress size={14} /> : "Save addresses"}
              </Button>
              <Button size="small" variant="outlined" disabled={!!busy || !d.mailReady} onClick={() => void sendTest()} sx={{ borderRadius: "999px", textTransform: "none" }}>
                {busy === "test" ? <CircularProgress size={14} /> : "Send a test to me now"}
              </Button>
              <Button size="small" variant="text" href={`/api/uc/partner-stock?partner=${d.partner.key}&download=1`} sx={{ borderRadius: "999px", textTransform: "none" }}>Download today&apos;s file</Button>
              <Choice<"all" | "weekdays"> value={s.weekdaysOnly ? "weekdays" : "all"} onChange={(v) => void put({ weekdaysOnly: v === "weekdays" }, "days")} options={[
                { key: "all", label: "Every day" }, { key: "weekdays", label: "Monday to Friday" },
              ]} />
            </Box>
          </>
        )}
        {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? INK : RED }}>{msg.text}</Typography>}
        {s.by && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Set by {s.by}, {when(s.at)}.</Typography>}
      </Box>
    </GlassCard>
  );
}

function PartnerTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const { slice, pager } = usePaged(d.lines, 25);
  const t = d.summary;
  return (
    <>
      <Grid container spacing={2}>
        {[
          { icon: <ListAltOutlinedIcon />, tint: "blue" as const, label: "Articles", value: t.articles, note: `${d.partner.name}'s list` },
          { icon: <Inventory2OutlinedIcon />, tint: "green" as const, label: "In stock", value: t.inStock, note: "free stock right now" },
          { icon: <PinOutlinedIcon />, tint: "purple" as const, label: "With an MOQ", value: t.moq, note: `${full(t.inactive)} inactive or in liquidation` },
          { icon: <ReportProblemOutlinedIcon />, tint: "amber" as const, label: "Special articles", value: t.specials, note: "made to order - stock from our ERP" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <Sending d={d} onChanged={onChanged} />
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ListAltOutlinedIcon />} tint="green" title="Today's file" note={`What ${d.partner.name} gets now - stock, MOQ and status from Products & Pricing`} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{[d.partner.codeHeader, "Code APSO", "Description", "Stock", "Unit", "MOQ", "Min. order qty", "Status"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((l) => (
              <TableRow key={`${l.partnerCode}-${l.apso}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 600 }}>{l.partnerCode}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{l.apso}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: l.description ? INK : MUTED }}>{l.description || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: (l.stock ?? 0) > 0 ? INK : MUTED }}>{l.stock === null ? "-" : full(l.stock)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{l.unit || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{l.moq || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{l.moqQty === null ? "-" : full(l.moqQty)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><Chip tint={STATUS_TINT[l.status] ?? "slate"}>{l.status}</Chip></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Sent" note="The last 30 sends - mornings and tests" />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["When", "What", "To", "Articles", "In stock", "Result"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.log.length && <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nothing sent yet.</TableCell></TableRow>}
            {d.log.map((r) => (
              <TableRow key={r.at} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.kind === "test" ? "test, by hand" : r.mode === "test" ? "morning (test)" : "morning"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.recipients.join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{full(r.articles)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{full(r.in_stock)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.ok ? <Chip tint="green">sent</Chip> : <Typography sx={{ fontSize: "0.8rem", color: RED }}>{r.error ?? "failed"}</Typography>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </>
  );
}

export default function PartnerStock() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "itafran");
  const [n, setN] = useState(0);
  const url = `/api/uc/partner-stock?partner=${view}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the partner's articles…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Stock to partners" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else body = <Box id={`partnerstock-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><PartnerTab d={r.data} onChanged={() => setN((x) => x + 1)} /></Box>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Stock to partners"
        subtitle="Every morning at 07:00 a partner gets its article list with our stock, MOQ and status"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="partnerstock" tab={view} onSelect={setView} tabs={[{ id: "itafran", label: "ITAFRAN", count: r?.state === "ok" ? full(r.data.summary.articles) : null }]} />
      </Box>
      {body}
    </Box>
  );
}
