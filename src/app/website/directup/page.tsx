"use client";

// DIRECTUP - the hub's page on the shop's order tool (SARCLA, 13.10.2026: DirectUP on its own Railway service,
// "DirectUp Gateway"; "the rest goes to the marketing under Website > Microservices", with usage, the activity
// log, the order lists, status & settings, and the footer, head and page HTML to install it). The tool runs on
// Railway because the shop frames it; this page reads the gateway's admin API.
// 14.10.2026: in the UC apps' kit like 3D files and DoC ("learn from UC's and reporting pages"): the UC tab
// strip with the tab in the #fragment, glass cards with badges, KPI tiles, pill choices, pages of rows, and the
// activity log in words.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, KpiTile, MUTED, Notice, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, isoDate, shiftIso, spanDays, useReportingWindow, type ReportingWindow } from "@/app/window/ReportingWindow";
import { Bars, CURRENT_BRIDGE, pct, post, when, type Overview } from "./shared";
import ListsTab from "./ListsTab";
import LogTab from "./LogTab";
import SettingsTab from "./SettingsTab";

type View = "overview" | "lists" | "activity" | "status" | "settings";
/** The open tab lives in the #fragment, as on the UC reports, so a link lands on it. */
const VIEW_HASH: Record<View, string> = { overview: "#overview", lists: "#lists", activity: "#activity", status: "#status", settings: "#settings" };
/** The tabs the hub-wide period applies to - it sits in the header, as on the UC reports (SARCLA 14.10.2026). */
const DATED: View[] = ["overview", "lists", "activity"];

/** A store view whose LATEST visit came through an older bridge - an earlier one does not count once the
 *  footer was replaced. A visit does not say whether it was ACC or production, so the notice says both. */
function olderBridges(bridges: Overview["status"]["bridges"]) {
  const latest = new Map<string, Overview["status"]["bridges"][number]>();
  for (const b of bridges) {
    const k = b.locale || "?", had = latest.get(k);
    if (!had || Date.parse(b.last) > Date.parse(had.last)) latest.set(k, b);
  }
  return [...latest.values()].filter((b) => b.bridge && b.bridge !== CURRENT_BRIDGE);
}

/** What needs doing, on every tab: a store view on an older bridge, a catalogue copy that failed. */
function Problems({ o }: { o: Overview }) {
  const old = olderBridges(o.status.bridges);
  return (
    <>
      {old.length > 0 && (
        <Notice tone="warn">
          The last visits from {old.map((b) => b.locale || "?").join(", ")} came through an older shop bridge ({[...new Set(old.map((b) => b.bridge))].join(", ")}), on ACC or production - a visit does not say which. Paste the footer from Settings there.
        </Notice>
      )}
      {o.status.catalogue.error && <Notice tone="bad">The last copy of the catalogue failed: {o.status.catalogue.error}</Notice>}
    </>
  );
}

/** Every day of the period, or every week when it is longer than 90 days - a day without lists is a gap, not a
 *  missing bar. Days are the gateway's (UTC) and the period's (local): a list made just after midnight can sit a
 *  day off, which a chart of lists per day can live with. */
function buckets(perDay: Overview["usage"]["perDay"], win: ReportingWindow) {
  const by = new Map(perDay.map((d) => [d.day, d]));
  const out: { label: string; lists: number; lines: number; notFound: number }[] = [];
  const weekly = spanDays(win.from, win.to) > 90;
  const dm = (iso: string) => iso.slice(5).split("-").reverse().join(".");
  for (let day = win.from; day <= win.to; day = shiftIso(day, 1)) {
    const row = by.get(day);
    const monday = shiftIso(day, -((new Date(`${day}T12:00:00`).getDay() + 6) % 7));
    const label = weekly ? `week of ${dm(monday < win.from ? win.from : monday)}` : dm(day);
    const last = out[out.length - 1];
    if (weekly && last && last.label === label) {
      last.lists += row?.lists ?? 0; last.lines += row?.lines ?? 0; last.notFound += row?.not_found ?? 0;
    } else out.push({ label, lists: row?.lists ?? 0, lines: row?.lines ?? 0, notFound: row?.not_found ?? 0 });
  }
  return out;
}

function OverviewTab({ o, win, label }: { o: Overview; win: ReportingWindow; label: string }) {
  const u = o.usage;
  const t = useMemo(() => {
    const inWin = (d: { day: string }) => d.day >= win.from && d.day <= win.to;
    const perDay = u.perDay.filter(inWin), carts = u.carts.filter(inWin);
    const sum = (k: keyof Overview["usage"]["perDay"][number]) => perDay.reduce((a, d) => a + (Number(d[k]) || 0), 0);
    return {
      lists: sum("lists"), files: sum("files"), claude: sum("read_by_claude"), lines: sum("lines"),
      byNumber: sum("by_number"), byText: sum("by_text"), notFound: sum("not_found"), added: sum("added"),
      carts: carts.reduce((a, c) => a + c.carts, 0), cartLines: carts.reduce((a, c) => a + c.cart_lines, 0),
    };
  }, [u, win.from, win.to]);
  const series = useMemo(() => buckets(u.perDay, win), [u, win]);
  const max = Math.max(1, ...series.map((s) => s.lists));
  const opened = o.status.bridges.reduce<Record<string, number>>((m, b) => ({ ...m, [b.locale || "?"]: (m[b.locale || "?"] ?? 0) + b.n }), {});

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<UploadFileOutlinedIcon />} tint="blue" label="Order lists" value={full(t.lists)} note={`${full(t.files)} from a file · ${full(t.lists - t.files)} typed in`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ManageSearchOutlinedIcon />} tint="purple" label="Lines read" value={full(t.lines)} note={`${full(t.claude)} ${t.claude === 1 ? "list" : "lists"} read by Claude from a PDF or a photo`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="green" label="Found by their number" value={pct(t.byNumber, t.lines)} note={`${full(t.byNumber)} lines · ${full(t.byText)} more from the description`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartOutlinedIcon />} tint="amber" label="Lines put in a cart" value={full(t.cartLines)} note={`in ${full(t.carts)} ${t.carts === 1 ? "click" : "clicks"} on "Add to cart"`} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title={spanDays(win.from, win.to) > 90 ? "Order lists per week" : "Order lists per day"} note={`${label} · point at a bar for its lines and what was not found`} />
            {t.lists === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No order lists in {label.toLowerCase()}.</Typography>}
            {t.lists > 0 && (
              <>
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 150 }}>
                  {series.map((s) => (
                    <Tooltip key={s.label} arrow title={`${s.label}: ${s.lists} ${s.lists === 1 ? "list" : "lists"}, ${full(s.lines)} lines, ${full(s.notFound)} not found`}>
                      <Box sx={{ flex: "1 1 0", minWidth: 0, height: s.lists ? `${Math.max(4, (s.lists / max) * 100)}%` : "2px", bgcolor: s.lists ? ACCENT : "rgba(21,34,58,.10)", borderRadius: "4px 4px 0 0" }} />
                    </Tooltip>
                  ))}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{series[0]?.label}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{series[series.length - 1]?.label}</Typography>
                </Box>
              </>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TimelineOutlinedIcon />} tint="green" title="What became of the lines" note={`${full(t.lines)} lines read · ${label}`} />
            <Bars rows={[
              { label: "Found by their number", n: t.byNumber, note: "our number or the customer's own", colour: GREEN },
              { label: "Found from the description", n: t.byText, note: "a person checks these", colour: ACCENT },
              { label: "Not found", n: t.notFound, colour: RED },
              { label: "Put in a cart", n: t.added, note: "from the lists of this period", colour: "#6a46c9" },
            ]} />
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<StorefrontOutlinedIcon />} tint="amber" title="Where DirectUP was opened" note="Visits per store view, last 30 days" />
        <Bars rows={Object.entries(opened).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)} />
      </GlassCard>
    </>
  );
}

function StatusTab({ o, reload }: { o: Overview; reload: () => void }) {
  const s = o.status;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pull = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "sync" });
    setBusy(false);
    setMsg(r.ok ? "Copying the catalogue from PricingHub - it takes about a minute; refresh to see it." : r.error ?? "Did not work.");
  };
  const reach: { ok: boolean; yes: string; no: string }[] = [
    { ok: s.keys.hubspot, yes: "HubSpot: pictures, type, status", no: "No HubSpot token" },
    { ok: s.keys.claude, yes: "Claude: PDFs and photos", no: "No Claude key" },
    { ok: s.keys.sync, yes: "PricingHub: the catalogue copy", no: "No catalogue key" },
  ];
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DnsOutlinedIcon />} tint="blue" label="Gateway" value={s.version.replace(/^deploy-/, "")} note={`running for ${Math.round(s.uptimeS / 3600)} h · ${o.setting.url.replace(/^https:\/\//, "")}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<Inventory2OutlinedIcon />} tint="purple" label="Catalogue copy" value={full(s.catalogue.articles)} note={`articles and ${full(s.catalogue.crossrefs)} cross-references, without prices`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HistoryOutlinedIcon />} tint="green" label="Last copied" value={when(s.catalogue.syncedAt).slice(0, 10)} note={`${when(s.catalogue.syncedAt).slice(11)} · from PricingHub, every night at 02:30 UTC`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ListAltOutlinedIcon />} tint="amber" label="Order lists kept" value={full(s.jobs)} note={`the last on ${when(s.lastJobAt)}`} /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<KeyOutlinedIcon />} tint="slate" title="What the gateway can reach" note="Its keys, as set on Railway" />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
              {reach.map((k) => <Chip key={k.yes} tint={k.ok ? "green" : "pink"}>{k.ok ? k.yes : k.no}</Chip>)}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {o.isAdmin && (
                <Button size="small" variant="outlined" disabled={busy || s.catalogue.running} onClick={() => void pull()} sx={{ borderRadius: "999px", textTransform: "none", fontWeight: 600 }}>
                  {s.catalogue.running ? "Copying…" : "Copy the catalogue now"}
                </Button>
              )}
              <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={`${o.setting.url}/landing/tools/directup?embed=1`} target="_blank" rel="noopener" sx={{ textTransform: "none", fontWeight: 600 }}>
                Open the tool
              </Button>
              <Button size="small" onClick={reload} sx={{ textTransform: "none", fontWeight: 600 }}>Refresh</Button>
            </Box>
            {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{msg}</Typography>}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard sx={{ height: "100%", p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<StorefrontOutlinedIcon />} tint="amber" title="Shop bridge per store view"
                note={`The footer each store view runs, from its visits in the last 30 days. Current: ${CURRENT_BRIDGE}.`} />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 420 }}>
              <TableHead><TableRow>{["Store view", "Bridge", "Visits", "Last visit"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {s.bridges.length === 0 && <TableRow><TableCell colSpan={4} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No shop page has opened DirectUP yet.</TableCell></TableRow>}
                {s.bridges.map((b, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{b.locale || "–"}</TableCell>
                    <TableCell sx={bodyCell}><Chip tint={b.bridge === CURRENT_BRIDGE ? "green" : "amber"}>{b.bridge || "?"}{b.bridge === CURRENT_BRIDGE ? "" : " · older"}</Chip></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{full(b.n)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{when(b.last)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </Box>
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

export default function DirectUpPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  // the hub-wide period; the gateway counts back from today, so it is asked back to the period's first day
  const { window: win, label } = useReportingWindow();
  const back = Math.min(365, spanDays(win.from, isoDate(new Date())));
  const [forced, setForced] = useState(0);
  const url = `/api/website/directup?part=overview&days=${back}&n=${forced}`;
  const held = useHeld<Overview>(url, [url]);
  const r = held.result;
  const reload = () => setForced((n) => n + 1);
  const o = r?.state === "ok" ? r.data : null;

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the DirectUp Gateway…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="DirectUp Gateway" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="DirectUp Gateway" error={r.error} status={r.status} onRetry={reload} />;
  else {
    const d = r.data;
    const panel =
      view === "lists" ? <ListsTab total={d.status.jobs} />
      : view === "activity" ? <LogTab />
      : view === "status" ? <StatusTab o={d} reload={reload} />
      : view === "settings" ? <SettingsTab o={d} reload={reload} />
      : <OverviewTab o={d} win={win} label={label} />;
    body = (
      <Box id={`directup-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        <Problems o={d} />
        {panel}
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="DirectUP"
        subtitle="The shop's order tool: an order file in, every line checked, the whole list into one cart"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {DATED.includes(view) && <WindowPicker />}
            <Tooltip title="Ask the gateway again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="directup" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "lists", label: "Order lists", count: o ? full(o.status.jobs) : null },
          { id: "activity", label: "Activity", count: null },
          { id: "status", label: "Status", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {body}
    </Box>
  );
}
