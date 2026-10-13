"use client";

// THE LIFECYCLE REPORTS - one look for the overview and every UC page: what
// the UC does and what "converted" means, the findings, a few tiles, the
// charts (each with its table), one list, and the emails. The figures are
// worked out on the server (src/lib/lifecycle/views.ts) for the hub-wide
// period; this file only draws them. The first read of a page takes a few
// minutes - the page says what it is reading and asks again until it is done.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ApartmentIcon from "@mui/icons-material/Apartment";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import EuroIcon from "@mui/icons-material/Euro";
import PercentIcon from "@mui/icons-material/Percent";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import TimelineIcon from "@mui/icons-material/Timeline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import BarChartIcon from "@mui/icons-material/BarChart";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";

import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { ChartTip } from "@/app/charts/ChartTip";
import { CHROME, FONT, SERIES } from "@/app/charts/palette";
import { compact, full, percent } from "@/app/charts/format";
import {
  ACCENT, AMBER, CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, glass, headCell, hsTicket,
} from "@/app/uc/report/ui";
import { ReportTabs, useHashTab, type TabDef } from "@/app/uc/report/Tabs";
import { HUB_UCS, PORTAL, UCS, stageLabel, type ViewKey } from "@/lib/lifecycle/config";
import type { ChartView, Col, EmailView, Fmt, IconKey, Row, View } from "@/lib/lifecycle/types";

/* ── the data ──────────────────────────────────────────────────────────── */

type ReadState = { computing: boolean; progress: string | null; computedAt: string | null; error: string | null };
type Resp = {
  ok: boolean; configured?: boolean; missing?: string[]; error?: string;
  view?: View | null; emails?: EmailView | null; state?: ReadState; emailState?: ReadState | null;
};

/** One page's view for the hub-wide period, asked again every 5 seconds while HubSpot is still being read. */
function useLifecycle(key: ViewKey): { resp: Resp | null; stale: boolean } {
  const { window: win } = useReportingWindow();
  const [resp, setResp] = useState<Resp | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setStale(true);
    const load = () =>
      fetch(`/api/uc/lifecycle/${key}?from=${win.from}&to=${win.to}`, { cache: "no-store" })
        .then(async (r) => {
          const text = await r.text();
          try {
            return JSON.parse(text) as Resp;
          } catch {
            // an expired session or the firewall answers in HTML, not JSON
            throw new Error(r.status === 401 || r.status === 403 ? "Your session has ended - reload the page to sign in again." : `The hub answered HTTP ${r.status}.`);
          }
        })
        .then((j) => {
          if (!alive) return;
          setResp(j);
          setStale(false);
          if (j.state?.computing || j.emailState?.computing) timer = setTimeout(load, 5000);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setResp({ ok: false, error: String((e as Error)?.message ?? e) });
          setStale(false);
        });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [key, win.from, win.to]);
  return { resp, stale };
}

/* ── numbers ───────────────────────────────────────────────────────────── */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : d);

function fmtValue(v: number | string | null | undefined, f: Fmt, short = false): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    if (f === "date") return day(v);
    if (f === "stage") return stageLabel(v);
    if (f === "yesno") return v === "yes" ? "Yes" : v === "no" ? "No" : v;
    return v;
  }
  if (f === "pct") return percent(v, 0);
  if (f === "eur") return `€${short ? compact(v) : full(v)}`;
  if (f === "days") return `${full(v)} d`;
  return short ? compact(v) : full(v);
}

const chartFmt = (f: Fmt) => (v: number | null) => fmtValue(v, f, true);

const ICON: Record<IconKey, React.ReactNode> = {
  companies: <ApartmentIcon />, ticket: <ConfirmationNumberOutlinedIcon />, task: <TaskAltIcon />, order: <ShoppingBagOutlinedIcon />,
  euro: <EuroIcon />, percent: <PercentIcon />, email: <MailOutlineIcon />, stage: <TimelineIcon />, time: <HourglassEmptyIcon />,
  cart: <ShoppingCartOutlinedIcon />, star: <StarOutlineIcon />, warning: <WarningAmberIcon />, up: <TrendingUpIcon />, down: <TrendingDownIcon />,
};

const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;

/* ── charts ────────────────────────────────────────────────────────────── */

/** Three or four counts over the same months, as lines - when they are not parts of one whole. */
function MultiLine({ rows, parts, format }: { rows: Row[]; parts: { key: string; label: string }[]; format: (v: number | null) => string }) {
  const shown = parts.slice(0, SERIES.length);
  return (
    <Box>
      <Box sx={{ width: "100%", height: 260, fontFamily: FONT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHROME.grid} strokeWidth={1} />
            <XAxis dataKey="x" tick={{ fontSize: 12, fill: CHROME.label }} axisLine={{ stroke: CHROME.axis }} tickLine={false} tickMargin={8} />
            <YAxis tickFormatter={(v) => format(Number(v))} tick={{ fontSize: 12, fill: CHROME.label }} axisLine={false} tickLine={false} width={48} />
            <ReTooltip content={(p) => <ChartTip active={p.active} payload={p.payload as never} label={p.label} format={format} />} />
            {shown.map((p, i) => (
              <Line key={p.key} type="monotone" dataKey={p.key} name={p.label} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
        {shown.map((p, i) => (
          <Box key={p.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 14, height: 3, borderRadius: 1, bgcolor: SERIES[i] }} />
            <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted }}>{p.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function twinOf(c: Exclude<ChartView, { kind: "table" }>): TableTwin {
  const f = (v: number | string | null | undefined) => fmtValue(v as number | null, c.fmt);
  if (c.kind === "stack" || c.kind === "lines") {
    const withTotal = c.kind === "stack";
    return {
      columns: ["Month", ...c.parts.map((p) => p.label), ...(withTotal ? ["Total"] : [])],
      rows: c.rows.map((r) => [String(r.x), ...c.parts.map((p) => f(r[p.key])), ...(withTotal ? [f(c.parts.reduce((a, p) => a + (Number(r[p.key]) || 0), 0))] : [])]),
      numeric: c.parts.map((_, i) => i + 1).concat(withTotal ? [c.parts.length + 1] : []),
    };
  }
  if (c.kind === "grouped") return { columns: ["Month", c.current, c.prior], rows: c.rows.map((r) => [r.x, f(r.current), f(r.prior)]), numeric: [1, 2] };
  if (c.kind === "trend") {
    if (c.extra) return { columns: c.extra.columns, rows: c.extra.rows, numeric: c.extra.columns.map((_, i) => i).filter((i) => i > 0) };
    return { columns: ["Month", c.label], rows: c.points.map((p) => [p.x, f(p.value)]), numeric: [1] };
  }
  return { columns: ["", "Count", "Share"], rows: c.rows.map((r) => [r.label, f(r.value), r.secondary ?? ""]), numeric: [1, 2] };
}

/** A small table of counts, with a total row - "who qualified". */
function TableCard({ c }: { c: Extract<ChartView, { kind: "table" }> }) {
  const numeric = (col: Col) => col.fmt === "n" || col.fmt === "eur" || col.fmt === "pct" || col.fmt === "days";
  const total: Row = Object.fromEntries(c.cols.map((col, i) => [col.key, i === 0 ? "Total" : numeric(col) ? c.rows.reduce((a, r) => a + (Number(r[col.key]) || 0), 0) : ""]));
  return (
    <GlassCard>
      <CardTitle icon={<ListAltIcon />} tint="slate" title={c.title} note={c.note} />
      {c.rows.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing to show for this period.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: Math.min(1000, c.cols.length * 120) }}>
            <TableHead><TableRow>
              {c.cols.map((col) => <TableCell key={col.key} sx={{ ...headCell, textAlign: numeric(col) ? "right" : "left" }} title={col.hint}>{col.label}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {[...c.rows, total].map((r, i) => (
                <TableRow key={i} hover={i < c.rows.length}>
                  {c.cols.map((col) => (
                    <TableCell key={col.key}
                      sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: numeric(col) ? "right" : "left", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", ...(i === c.rows.length ? { fontWeight: 700, color: INK } : {}) }}>
                      {fmtValue(r[col.key], col.fmt)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {c.footnote && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1.25 }}>{c.footnote}</Typography>}
    </GlassCard>
  );
}

function Chart({ c, stale }: { c: Exclude<ChartView, { kind: "table" }>; stale: boolean }) {
  const format = chartFmt(c.fmt);
  const empty =
    (c.kind === "bars" && !c.rows.length) || (c.kind === "grouped" && !c.rows.length) ? "Nothing to show for this period." :
    (c.kind === "stack" || c.kind === "lines") && !c.rows.some((r) => c.parts.some((p) => Number(r[p.key]) > 0)) ? "Nothing to show yet." :
    c.kind === "trend" && !c.points.some((p) => p.value !== null) ? "Nothing to show yet." : null;
  return (
    <GlassCard>
      <CardTitle icon={c.kind === "bars" ? <ListAltIcon /> : <BarChartIcon />} tint={c.kind === "bars" ? "slate" : "blue"} title={c.title} note={c.note} />
      <ChartFrame table={twinOf(c)} stale={stale} empty={empty}>
        {c.kind === "stack" && <StackedColumns data={c.rows as never} parts={c.parts} format={format} />}
        {c.kind === "lines" && <MultiLine rows={c.rows} parts={c.parts} format={format} />}
        {c.kind === "grouped" && <GroupedColumns data={c.rows} currentLabel={c.current} priorLabel={c.prior} format={format} />}
        {c.kind === "trend" && <TrendChart data={c.points} seriesLabel={c.label} format={format} tickFormat={format} xFormat={(x) => x} />}
        {c.kind === "bars" && <BarList rows={c.rows} format={format} labelWidth={260} maxLabel={46} />}
      </ChartFrame>
      {c.footnote && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1.25 }}>{c.footnote}</Typography>}
    </GlassCard>
  );
}

/* ── the list ──────────────────────────────────────────────────────────── */

const PAGE = 20;

function List({ v }: { v: NonNullable<View["list"]> }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [v]);
  const rows = v.rows.slice(page * PAGE, page * PAGE + PAGE);
  const numeric = (c: Col) => c.fmt === "n" || c.fmt === "eur" || c.fmt === "pct" || c.fmt === "days";
  const href = (r: Row) => (r.id ? (v.link === "company" ? hsCompany(String(r.id)) : v.link === "ticket" ? hsTicket(String(r.id)) : null) : null);
  return (
    <GlassCard>
      <CardTitle icon={<ListAltIcon />} tint="slate" title={v.title}
        note={`${v.note} · ${full(v.total)}${v.total > v.rows.length ? `, the first ${full(v.rows.length)} shown` : ""}`} />
      {v.rows.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{v.empty}</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: Math.min(1100, v.cols.length * 130) }}>
              <TableHead><TableRow>
                {v.cols.map((c) => (
                  <TableCell key={c.key} sx={{ ...headCell, textAlign: numeric(c) ? "right" : "left" }} title={c.hint}>{c.label}</TableCell>
                ))}
                {v.link && <TableCell sx={headCell} />}
              </TableRow></TableHead>
              <TableBody>
                {rows.map((r, i) => {
                  const link = href(r);
                  return (
                    <TableRow key={`${r.id ?? ""}-${i}`} hover>
                      {v.cols.map((c, ci) => {
                        const text = fmtValue(r[c.key], c.fmt);
                        return (
                          <TableCell key={c.key} title={text}
                            sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: numeric(c) ? "right" : "left", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", ...(ci === 0 || c.fmt === "text" ? clip(c.key === "name" ? 260 : 220) : {}) }}>
                            {text}
                          </TableCell>
                        );
                      })}
                      {v.link && (
                        <TableCell sx={{ ...bodyCell, p: 0.25 }}>
                          {link && (
                            <Tooltip title="Open in HubSpot">
                              <IconButton size="small" href={link} target="_blank" rel="noreferrer" aria-label="Open in HubSpot">
                                <OpenInNewIcon sx={{ fontSize: 15, color: ACCENT }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          {v.rows.length > PAGE && (
            <TablePagination component="div" count={v.rows.length} page={page} rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]} onPageChange={(_, p) => setPage(p)} />
          )}
        </>
      )}
    </GlassCard>
  );
}

/* ── the emails ────────────────────────────────────────────────────────── */

function Emails({ e, st }: { e: EmailView | null; st: ReadState | null }) {
  if (!e) {
    return (
      <GlassCard>
        <CardTitle icon={<MailOutlineIcon />} tint="green" title="Emails" note="Sends per email, from every contact's email history" />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          {!st?.error && <CircularProgress size={16} />}
          <Typography sx={{ fontSize: "0.85rem", color: st?.error ? RED : MUTED }}>
            {st?.error ? `The email history could not be read: ${st.error}` : `Counting the sends - reading every contact's email history${st?.progress ? ` · ${st.progress}` : ""}.`}
          </Typography>
        </Box>
      </GlassCard>
    );
  }
  const stats = e.statsOn;
  const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" };
  const numHead = { ...headCell, textAlign: "right" as const };
  return (
    <GlassCard>
      <CardTitle icon={<MailOutlineIcon />} tint="green" title="Emails"
        note={`Sends per email, counted from each contact's "last marketing email" history since ${day(e.horizon)} · ${full(e.contactsRead)} contacts read`} />
      {e.unseen.length > 0 && (
        <Typography sx={{ fontSize: "0.82rem", color: AMBER, mb: 1.25 }}>
          Never sent: {e.unseen.join(", ")}.
        </Typography>
      )}
      {e.rows.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No email of this UC reached anyone since {day(e.horizon)}.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>Email</TableCell>
              <TableCell sx={headCell}>Version</TableCell>
              <TableCell sx={numHead} title="Language and country versions of the same email">Languages</TableCell>
              <TableCell sx={numHead}>Sent in the period</TableCell>
              <TableCell sx={numHead} title="Distinct companies of the contacts it reached">Companies reached</TableCell>
              <TableCell sx={numHead}>Sent since {day(e.horizon).slice(-8)}</TableCell>
              <TableCell sx={headCell}>Last sent</TableCell>
              {stats && <TableCell sx={numHead} title="All time, from HubSpot's email statistics">Opened</TableCell>}
              {stats && <TableCell sx={numHead} title="All time, from HubSpot's email statistics">Clicked</TableCell>}
            </TableRow></TableHead>
            <TableBody>
              {e.rows.map((r) => (
                <TableRow key={`${r.version}-${r.step}`} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK }}>{r.step}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{r.version}</TableCell>
                  <TableCell sx={num}>{r.variants}</TableCell>
                  <TableCell sx={{ ...num, fontWeight: 600 }}>{full(r.sendsWin)}</TableCell>
                  <TableCell sx={num}>{full(r.companiesWin)}</TableCell>
                  <TableCell sx={num}>{full(r.sendsAll)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{r.lastSent ? day(r.lastSent) : "—"}</TableCell>
                  {stats && <TableCell sx={num}>{r.stats ? `${full(r.stats.open)} (${r.stats.sent ? percent(r.stats.open / r.stats.sent, 0) : "—"})` : "—"}</TableCell>}
                  {stats && <TableCell sx={num}>{r.stats ? `${full(r.stats.click)} (${r.stats.sent ? percent(r.stats.click / r.stats.sent, 0) : "—"})` : "—"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1.25 }}>
        {stats ? (e.statsError ? `Opens and clicks could not be read: ${e.statsError}` : "Opens and clicks: HubSpot's email statistics, all time.") : "Opens and clicks need the email-statistics token."}
      </Typography>
    </GlassCard>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

function Findings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <Box sx={{ ...glass, borderRadius: "18px", borderLeft: `3px solid ${AMBER}`, p: { xs: 1.75, md: 2 }, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 18, color: AMBER }} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{items.length === 1 ? "Finding" : "Findings"}</Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 3.25, display: "grid", gap: 0.4 }}>
        {items.map((f) => <Typography component="li" key={f} sx={{ fontSize: "0.84rem", color: INK }}>{f}</Typography>)}
      </Box>
    </Box>
  );
}

/** The UC pages, as cards - on the overview: the lifecycle UCs, then the hub's own. */
function UcCards() {
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
      {[...UCS, ...HUB_UCS].map((u) => (
        <Box key={u.code} component={Link} href={u.href} sx={{
          ...glass, borderRadius: "18px", p: 2, textDecoration: "none", display: "grid", gap: 0.5,
          transition: "box-shadow .15s", "&:hover": { boxShadow: "0 2px 6px rgba(31,45,78,.08), 0 16px 36px rgba(31,45,78,.12)" },
        }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: TINT.amber.fg, letterSpacing: "0.06em" }}>{u.code}</Typography>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 600, color: INK }}>{u.title}</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>{u.does}</Typography>
        </Box>
      ))}
    </Box>
  );
}

type TabId = "cases" | "results" | "follow" | "list" | "emails";
const TAB_HASH: Record<TabId, string> = { cases: "#use-cases", results: "#results", follow: "#follow-up", list: "#list", emails: "#emails" };

/** What each page's list tab is called. */
const LIST_TAB: Record<ViewKey, string> = {
  overview: "Stage changes", uc2: "New MQLs", uc15: "Tickets", uc6: "Tickets", uc9: "New customers",
  uc10: "Past their reorder", uc13: "Churn entries", uc4: "Tickets", uc12: "Flagged companies",
};

/** Charts two to a row; a table, and a last chart left alone, take the whole row. */
function ChartGrid({ charts, stale }: { charts: ChartView[]; stale: boolean }) {
  if (!charts.length) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing to show here.</Typography></GlassCard>;
  const plain = charts.filter((x) => x.kind !== "table");
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" } }}>
      {charts.map((c, i) => {
        const wide = c.kind === "table" || (plain.length % 2 === 1 && c === plain[plain.length - 1]);
        return (
          <Box key={`${c.title}-${i}`} sx={{ minWidth: 0, gridColumn: wide ? "1 / -1" : undefined }}>
            {c.kind === "table" ? <TableCard c={c} /> : <Chart c={c} stale={stale} />}
          </Box>
        );
      })}
    </Box>
  );
}

export default function LifecycleReport({ view: key }: { view: ViewKey }) {
  const { resp, stale } = useLifecycle(key);
  const v = resp?.view ?? null;
  const st = resp?.state ?? null;
  const uc = UCS.find((u) => u.key === key);
  const overview = key === "overview";
  const title = v ? (overview ? v.title : `${v.code} ${v.title}`) : uc ? `${uc.code} ${uc.title}` : "Use Cases Overview";
  const does = v?.does ?? uc?.does ?? "Every use case, where every company stands in its lifecycle today, and how many moved stage each month.";
  const busy = !resp || stale || !!st?.computing || !!resp?.emailState?.computing;
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, overview ? "cases" : "results");
  const results = (v?.charts ?? []).filter((c) => (c.tab ?? "results") === "results");
  const follow = (v?.charts ?? []).filter((c) => c.tab === "follow");
  const tabs: TabDef<TabId>[] = overview
    ? [
        { id: "cases", label: "Use cases", count: String(UCS.length + HUB_UCS.length) },
        { id: "results", label: "Lifecycle stages", count: null },
        { id: "list", label: LIST_TAB.overview, count: null },
      ]
    : [
        { id: "results", label: "Results", count: null },
        { id: "follow", label: "Follow-up", count: null },
        { id: "list", label: LIST_TAB[key], count: v?.list ? full(v.list.total) : null },
        ...(key !== "uc12" ? [{ id: "emails" as const, label: "Emails", count: resp?.emails ? String(resp.emails.rows.length) : null }] : []),
      ];
  const shown: TabId = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const needsData = shown !== "cases";

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <Box>
        <PageHeader
          title={title}
          subtitle={does}
          rightSlot={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
              <WindowPicker />
            </Box>
          }
        />
        <Typography sx={{ fontSize: "0.88rem", color: INK, mt: -1.5 }}>{v?.converted ?? uc?.converted ?? ""}</Typography>
      </Box>

      {resp && !resp.ok && (
        <GlassCard>
          <Typography sx={{ fontSize: "0.9rem", color: RED }}>
            {resp.configured === false ? `HubSpot is not connected on this deployment (${(resp.missing ?? []).join(", ")}).` : `The report could not be read: ${resp.error ?? "unknown error"}`}
          </Typography>
        </GlassCard>
      )}

      {v && (
        <>
          <Findings items={v.findings} />
          {st?.computing && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Refreshing in the background - showing the last finished read.</Typography>}
          {st?.error && <Typography sx={{ fontSize: "0.8rem", color: RED }}>The last refresh failed ({st.error}) - showing the read before it.</Typography>}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: `repeat(${Math.min(v.tiles.length, 6) > 4 ? 3 : Math.max(2, v.tiles.length)}, 1fr)` } }}>
            {v.tiles.map((t) => (
              <KpiTile key={t.label} icon={ICON[t.icon]} tint={t.tint} label={t.label} value={fmtValue(t.value, t.fmt)} note={t.note} />
            ))}
          </Box>
        </>
      )}

      <Box>
        <ReportTabs name="lifecycle" tab={shown} onSelect={selectTab} tabs={tabs} />
      </Box>

      {shown === "cases" && <Box id="lifecycle-panel-cases" role="tabpanel"><UcCards /></Box>}

      {needsData && resp?.ok && !v && (
        <GlassCard>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {!st?.error && <CircularProgress size={18} />}
            <Typography sx={{ fontSize: "0.9rem", color: st?.error ? RED : MUTED }}>
              {st?.error ? `HubSpot could not be read: ${st.error}` : `Reading HubSpot - a few minutes the first time${st?.progress ? ` · ${st.progress}` : ""}.`}
            </Typography>
          </Box>
        </GlassCard>
      )}

      {v && shown === "results" && <Box id="lifecycle-panel-results" role="tabpanel" sx={{ minWidth: 0 }}><ChartGrid charts={results} stale={stale} /></Box>}
      {v && shown === "follow" && <Box id="lifecycle-panel-follow" role="tabpanel" sx={{ minWidth: 0 }}><ChartGrid charts={follow} stale={stale} /></Box>}
      {v && shown === "list" && (
        <Box id="lifecycle-panel-list" role="tabpanel" sx={{ minWidth: 0 }}>
          {v.list ? <List v={v.list} /> : <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing to show here.</Typography></GlassCard>}
        </Box>
      )}
      {shown === "emails" && resp?.ok && (
        <Box id="lifecycle-panel-emails" role="tabpanel" sx={{ minWidth: 0 }}><Emails e={resp.emails ?? null} st={resp.emailState ?? null} /></Box>
      )}

      {v && (
        <Box sx={{ display: "grid", gap: 0.5 }}>
          {v.notes.map((n) => <Typography key={n} sx={{ fontSize: "0.78rem", color: MUTED }}>{n}</Typography>)}
          <Typography sx={{ fontSize: "0.75rem", color: FAINT }}>
            Read from HubSpot {new Date(v.generatedAt).toLocaleString("en-GB")} · refreshed every 12 hours ·{" "}
            {v.sources.map((s) => `${full(s.n)} ${s.label}`).join(" · ")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
