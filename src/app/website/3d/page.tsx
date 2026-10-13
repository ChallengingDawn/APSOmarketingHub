"use client";

// 3D FILES - one page on the 3D service (SARCLA, 13.10.2026). The service runs on Railway (the
// shop's catalogue, the product-page button, the card's check, the request form) because those
// need a public address; this page reads it, and reads HubSpot for the form's submissions and
// the 3D-request tickets with their stages.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, HAIRLINE, INK, LoadingPanel, MUTED, NotConnectedPanel, Section, UpstreamPanel } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { SERIES } from "@/app/charts/palette";
import { full } from "@/app/charts/format";
import type { ThreeD } from "@/lib/threeD/read";
import SettingsTab from "./SettingsTab";

const PORTAL = "26492587";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;
const BLUE = SERIES[0];
const GREEN = "#1e7e45";
const RED = "#c5221f";
const GREY = "#8a929c";

const PERIODS = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "year", label: "This year", days: null },
  { key: "all", label: "All", days: Infinity },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

function since(key: PeriodKey): number {
  const p = PERIODS.find((x) => x.key === key)!;
  if (p.days === Infinity) return 0;
  if (p.days === null) return Date.UTC(new Date().getUTCFullYear(), 0, 1);
  return Date.now() - p.days * 86_400_000;
}

const day = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Notice({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  const c = tone === "warn" ? { bg: "#fff7e6", bd: "#f0d199", fg: "#7a4b00" } : { bg: "#eef4fb", bd: "#c9dbef", fg: "#24507c" };
  return (
    <Box sx={{ mb: 2, px: 2, py: 1.25, borderRadius: 2, border: `1px solid ${c.bd}`, bgcolor: c.bg }}>
      <Typography sx={{ fontSize: "0.82rem", color: c.fg, lineHeight: 1.5 }}>{children}</Typography>
    </Box>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; n: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Section>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mb: 1.25 }}>{title}</Typography>
      {rows.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>None in this period.</Typography>}
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,2fr) 44px", alignItems: "center", gap: 1, mb: 0.75 }}>
          <Typography sx={{ fontSize: "0.8rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</Typography>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#eef1f4" }}>
            <Box sx={{ height: 8, borderRadius: 4, width: `${(r.n / max) * 100}%`, bgcolor: r.color ?? BLUE }} />
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.n)}</Typography>
        </Box>
      ))}
    </Section>
  );
}

const tally = (items: string[]) =>
  Object.entries(items.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}))
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n);

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
  const has = (label: string, yes: boolean) => (
    <Chip size="small" label={`${label} ${yes ? "✓" : "–"}`} variant={yes ? "filled" : "outlined"}
      sx={{ fontWeight: 600, ...(yes ? { bgcolor: GREEN, color: "#fff" } : { color: MUTED, borderColor: HAIRLINE }) }} />
  );
  return (
    <Section>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mb: 1.25 }}>Look up an article on AP-Link</Typography>
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!busy) void ask(); }}
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <TextField size="small" value={article} onChange={(e) => setArticle(e.target.value)} placeholder="10-digit article, e.g. 1150040144"
          inputProps={{ inputMode: "numeric", "aria-label": "Article number" }} sx={{ width: { xs: "100%", sm: 280 } }} />
        <Button type="submit" variant="contained" disableElevation disabled={busy || !article.trim()}>
          {busy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Check"}
        </Button>
        {res && "error" in res && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{res.error}</Typography>}
        {res && !("error" in res) && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
            {has("3D model", res.stp)}{has("Drawing", res.pdf)}{has("Data sheet", res.tds)}
            {res.stp && (
              <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={`${catalogueUrl}?article=${res.article}`} target="_blank" rel="noopener">
                Open the live 3D model
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Section>
  );
}

export default function ThreeDFiles() {
  const [forced, setForced] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("90");
  // Settings: the gateway's address and every place that names it (SARCLA, 13.10.2026)
  const [tab, setTab] = useState<"overview" | "settings">("overview");
  const url = forced ? `/api/website/3d?refresh=1&n=${forced}` : "/api/website/3d";
  const held = useHeld<ThreeD>(url, [url]);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;

  const view = useMemo(() => {
    if (!data) return null;
    const from = since(period);
    const inP = (iso: string) => Date.parse(iso) >= from;
    const subs = data.submissions.filter((s) => inP(s.at));
    const tickets = data.tickets.filter((t) => inP(t.at));
    return {
      subs,
      tickets,
      open: tickets.filter((t) => !t.closed).length,
      closed: tickets.filter((t) => t.closed).length,
      byChannel: tally(tickets.map((t) => t.channel)),
      byStage: tally(tickets.map((t) => t.stage)).map((s) => ({ ...s, color: tickets.find((t) => t.stage === s.label)?.closed ? GREEN : BLUE })),
    };
  }, [data, period]);

  const header = (
    <PageHeader
      title="3D files"
      subtitle="The shop's 3D catalogue, the requests its form sends, and the tickets they become"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <Tooltip title="Ask Railway and HubSpot again">
            <IconButton size="small" onClick={() => setForced((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
          </Tooltip>
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      {header}
      <Tabs value={tab} onChange={(_, t: "overview" | "settings") => setTab(t)} sx={{ mb: 2.5, minHeight: 36, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Tab value="overview" label="Overview" sx={{ textTransform: "none", fontWeight: 600, minHeight: 36 }} />
        <Tab value="settings" label="Settings" sx={{ textTransform: "none", fontWeight: 600, minHeight: 36 }} />
      </Tabs>
      {children}
    </Box>
  );

  if (tab === "settings") return shell(<SettingsTab />);

  if (r === null) return shell(<LoadingPanel label="Reading the 3D service and HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (3D requests)" error={r.error} status={r.status} onRetry={() => setForced((n) => n + 1)} />);
  const d = r.data;
  const v = view!;
  const svc = d.service;

  return shell(
    <>
      {!svc.catalogue && <Notice tone="warn">The 3D service on Railway did not answer{svc.error ? `: ${svc.error}` : ""}. The shop&apos;s catalogue may be down.</Notice>}
      {d.submissionsError && <Notice tone="warn">The form&apos;s submissions could not be read: {d.submissionsError}</Notice>}

      <Section sx={{ mb: 2.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Chip size="small" label={svc.catalogue ? "Catalogue online" : "Catalogue offline"} sx={{ fontWeight: 700, color: "#fff", bgcolor: svc.catalogue ? GREEN : RED }} />
          <Chip size="small" label={svc.aplink ? "AP-Link reachable" : "AP-Link not reachable"} sx={{ fontWeight: 700, color: "#fff", bgcolor: svc.aplink ? GREEN : svc.aplink === null ? GREY : RED }} />
          {svc.articles !== null && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{full(svc.articles)} articles with a 3D model, in {svc.categories.length} categories</Typography>}
          <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={d.catalogueUrl} target="_blank" rel="noopener" sx={{ ml: "auto" }}>
            Open the catalogue
          </Button>
        </Box>
      </Section>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        {PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} onClick={() => setPeriod(p.key)} variant={period === p.key ? "filled" : "outlined"}
            sx={{ fontWeight: 600, ...(period === p.key ? { bgcolor: INK, color: "#fff" } : { color: MUTED, borderColor: HAIRLINE }) }} />
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
        <StatTile label="Form submissions" value={full(v.subs.length)} note="the 3D catalogue's request form" />
        <StatTile label="3D-request tickets" value={full(v.tickets.length)} note="every channel" />
        <StatTile label="Still open" value={full(v.open)} />
        <StatTile label="Resolved or closed" value={full(v.closed)} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2.5 }}>
        <Bars title="Tickets by channel" rows={v.byChannel} />
        <Bars title="Tickets by stage" rows={v.byStage} />
      </Box>

      <Section sx={{ mb: 2.5, p: 0, overflow: "hidden" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, px: 2, pt: 1.75, pb: 1 }}>
          Form submissions <span style={{ color: MUTED, fontWeight: 400 }}>· {full(v.subs.length)}, newest first</span>
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                {["Sent", "Name", "Company", "Email", "Articles", "Ticket"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {v.subs.length === 0 && (
                <TableRow><TableCell colSpan={6} sx={{ fontSize: "0.8rem", color: MUTED }}>No submissions in this period.</TableCell></TableRow>
              )}
              {v.subs.map((s, i) => (
                <TableRow key={`${s.at}-${i}`} hover>
                  <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{day(s.at)}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{s.name || "–"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{s.company || "–"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{s.email || "–"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>{s.articles || "–"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {s.ticket ? (
                      <Box component="a" href={ticketUrl(s.ticket.id)} target="_blank" rel="noopener" sx={{ textDecoration: "none" }}>
                        <Chip size="small" label={s.ticket.stage.split(" › ").pop()} title={s.ticket.stage}
                          sx={{ cursor: "pointer", fontWeight: 600, color: "#fff", bgcolor: s.ticket.closed ? GREEN : BLUE }} />
                      </Box>
                    ) : (
                      <Tooltip title="No ticket from this email within six hours of the submission" arrow>
                        <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>no ticket found</Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Lookup catalogueUrl={d.catalogueUrl} />
        <Bars title="Articles with a 3D model, by category" rows={svc.categories.map((c) => ({ label: c.name, n: c.count }))} />
      </Box>
    </>,
  );
}
