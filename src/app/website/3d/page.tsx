"use client";

// 3D FILES - one page on the 3D service (SARCLA, 13.10.2026). The service runs on Railway (the
// shop's catalogue, the product-page button, the card's check, the request form) because those
// need a public address; this page reads it, and reads HubSpot for the form's submissions and
// the 3D-request tickets with their stages. Built with the UC apps' kit (glass cards, badges,
// KPI tiles, pill choices) so the Microservices read like the rest of the hub.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, GREEN, GlassCard, INK, KpiTile, MUTED, Notice, TRACK, bodyCell, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { ThreeD } from "@/lib/threeD/read";
import SettingsTab from "./SettingsTab";

type View = "overview" | "settings";
type PeriodKey = "30" | "90" | "year" | "all";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30", label: "30 days" }, { key: "90", label: "90 days" }, { key: "year", label: "This year" }, { key: "all", label: "All" },
];

function since(key: PeriodKey): number {
  if (key === "all") return 0;
  if (key === "year") return Date.UTC(new Date().getUTCFullYear(), 0, 1);
  return Date.now() - Number(key) * 86_400_000;
}

const sent = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const tally = (items: string[]) =>
  Object.entries(items.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}))
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n);

/** Rows of label, bar and figure - the UC apps' horizontal bars. */
function Bars({ rows, colour = ACCENT }: { rows: { label: string; n: number; colour?: string }[]; colour?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None in this period.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,2fr) 52px", alignItems: "center", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</Typography>
          <Box sx={{ height: 10, borderRadius: 5, bgcolor: TRACK }}>
            <Box sx={{ height: 10, borderRadius: 5, width: `${(r.n / max) * 100}%`, bgcolor: r.colour ?? colour }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.n)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function Lookup({ catalogueUrl }: { catalogueUrl: string }) {
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ article: string; stp: boolean; pdf: boolean; tds: boolean } | { error: string } | null>(null);
  const ask = async () => {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch(`/api/website/3d/check?article=${encodeURIComponent(article.trim())}`, { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; data?: { article: string; stp: boolean; pdf: boolean; tds: boolean }; error?: string };
      setRes(j.ok && j.data ? j.data : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) {
      setRes({ error: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={<SearchOutlinedIcon />} tint="purple" title="Look up an article" note="Asks AP-Link: 3D model, 2D drawing, technical data sheet" />
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!busy && article.trim()) void ask(); }}
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <TextField size="small" value={article} onChange={(e) => setArticle(e.target.value)} placeholder="10-digit article, e.g. 1150040144"
          inputProps={{ inputMode: "numeric", "aria-label": "Article number" }} sx={{ width: { xs: "100%", sm: 280 } }} />
        <Button type="submit" variant="contained" disableElevation disabled={busy || !article.trim()} sx={{ borderRadius: "999px", textTransform: "none", fontWeight: 600 }}>
          {busy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Check"}
        </Button>
      </Box>
      {res && "error" in res && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f", mt: 1.5 }}>{res.error}</Typography>}
      {res && !("error" in res) && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", mt: 1.5 }}>
          <Chip tint={res.stp ? "green" : "slate"}>3D model {res.stp ? "✓" : "–"}</Chip>
          <Chip tint={res.pdf ? "green" : "slate"}>Drawing {res.pdf ? "✓" : "–"}</Chip>
          <Chip tint={res.tds ? "green" : "slate"}>Data sheet {res.tds ? "✓" : "–"}</Chip>
          {res.stp && (
            <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={`${catalogueUrl}?article=${res.article}`} target="_blank" rel="noopener" sx={{ textTransform: "none", fontWeight: 600 }}>
              Open the live 3D model
            </Button>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

function Overview({ d, period, setPeriod }: { d: ThreeD; period: PeriodKey; setPeriod: (p: PeriodKey) => void }) {
  const v = useMemo(() => {
    const from = since(period);
    const inP = (iso: string) => Date.parse(iso) >= from;
    const subs = d.submissions.filter((s) => inP(s.at));
    const tickets = d.tickets.filter((t) => inP(t.at));
    const closedStage = new Set(tickets.filter((t) => t.closed).map((t) => t.stage));
    return {
      subs, tickets,
      open: tickets.filter((t) => !t.closed).length,
      closed: tickets.filter((t) => t.closed).length,
      byChannel: tally(tickets.map((t) => t.channel)),
      byStage: tally(tickets.map((t) => t.stage)).map((s) => ({ ...s, colour: closedStage.has(s.label) ? GREEN : ACCENT })),
    };
  }, [d, period]);
  const { slice, pager } = usePaged(v.subs, 15);
  const svc = d.service;

  return (
    <>
      {!svc.catalogue && <Notice tone="bad">The 3D service on Railway did not answer{svc.error ? `: ${svc.error}` : ""}. The shop&apos;s catalogue may be down.</Notice>}
      {d.submissionsError && <Notice tone="warn">The form&apos;s submissions could not be read: {d.submissionsError}</Notice>}

      <GlassCard>
        <CardTitle icon={<ViewInArOutlinedIcon />} tint="blue" title="The 3D service"
          note="On Railway: the shop's 3D catalogue, the 3D button on product pages and the request form"
          right={
            <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={d.catalogueUrl} target="_blank" rel="noopener" sx={{ textTransform: "none", fontWeight: 600 }}>
              Open the catalogue
            </Button>
          } />
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Chip tint={svc.catalogue ? "green" : "pink"}>{svc.catalogue ? "Catalogue online" : "Catalogue offline"}</Chip>
          <Chip tint={svc.aplink ? "green" : svc.aplink === null ? "slate" : "pink"}>{svc.aplink ? "AP-Link reachable" : "AP-Link not reachable"}</Chip>
          {svc.articles !== null && (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{full(svc.articles)} articles with a 3D model, in {svc.categories.length} categories</Typography>
          )}
        </Box>
      </GlassCard>

      <Choice value={period} onChange={setPeriod} options={PERIODS} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DescriptionOutlinedIcon />} tint="blue" label="Form submissions" value={full(v.subs.length)} note="the 3D catalogue's request form" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="purple" label="3D-request tickets" value={full(v.tickets.length)} note="every channel" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Still open" value={full(v.open)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Resolved or closed" value={full(v.closed)} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="Tickets by channel" note="How the 3D requests reached Back Office" />
            <Bars rows={v.byChannel} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TimelineOutlinedIcon />} tint="green" title="Tickets by stage" note="Where they are now" />
            <Bars rows={v.byStage} />
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<InboxOutlinedIcon />} tint="amber" title={`Form submissions · ${full(v.subs.length)}`}
            note="Each one with the ticket HubSpot raised for it (same email, within six hours), newest first" />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                {["Sent", "Name", "Company", "Email", "Articles", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.length === 0 && (
                <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No submissions in this period.</TableCell></TableRow>
              )}
              {slice.map((s, i) => (
                <TableRow key={`${s.at}-${i}`} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{sent(s.at)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{s.name || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{s.company || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{s.email || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{s.articles || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>
                    {s.ticket ? (
                      <Box component="a" href={hsTicket(s.ticket.id)} target="_blank" rel="noopener" title={s.ticket.stage} sx={{ textDecoration: "none" }}>
                        <Chip tint={s.ticket.closed ? "green" : "blue"}>{s.ticket.stage.split(" › ").pop()}</Chip>
                      </Box>
                    ) : (
                      <Tooltip title="No 3D-request ticket from this email within six hours of the submission" arrow>
                        <Typography component="span" sx={{ fontSize: "0.84rem", color: MUTED }}>no ticket found</Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}>{pager}</Box>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><Lookup catalogueUrl={d.catalogueUrl} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CategoryOutlinedIcon />} tint="slate" title="Articles with a 3D model" note="By the catalogue's categories" />
            <Bars rows={svc.categories.map((c) => ({ label: c.name, n: c.count }))} />
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

export default function ThreeDFiles() {
  const [forced, setForced] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("90");
  // Settings: the gateway's address and every place that names it (SARCLA, 13.10.2026)
  const [view, setView] = useState<View>("overview");
  const url = forced ? `/api/website/3d?refresh=1&n=${forced}` : "/api/website/3d";
  const held = useHeld<ThreeD>(url, [url]);
  const r = held.result;

  let body: React.ReactNode;
  if (view === "settings") body = <SettingsTab />;
  else if (r === null) body = <LoadingPanel label="Reading the 3D service and HubSpot…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="HubSpot" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="HubSpot (3D requests)" error={r.error} status={r.status} onRetry={() => setForced((n) => n + 1)} />;
  else body = <Overview d={r.data} period={period} setPeriod={setPeriod} />;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="3D files"
        subtitle="The shop's 3D catalogue, the requests its form sends, and the tickets they become"
        rightSlot={view === "overview" ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask Railway and HubSpot again">
              <IconButton size="small" onClick={() => setForced((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        ) : undefined}
      />
      <Choice value={view} onChange={setView} options={[{ key: "overview", label: "Overview" }, { key: "settings", label: "Settings" }]} />
      {body}
    </Box>
  );
}
