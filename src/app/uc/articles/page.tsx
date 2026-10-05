"use client";

// ARTICLES CY/LY - every article's revenue this year to date against the same
// days of last year. Moved from the APSOAssistant micro apps (05.10.2026); the
// report is built in the hub now (src/lib/integrations/articleReport.ts), once
// a day after the night's orders are in, or by an admin with Rebuild.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import EuroIcon from "@mui/icons-material/Euro";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import FiberNewOutlinedIcon from "@mui/icons-material/FiberNewOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { compact, full } from "@/app/charts/format";
import { CardTitle, GlassCard, GREEN, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, TRACK, bodyCell, clip, eur, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { FilterChips, SearchBox, dm } from "@/app/uc/oneshot/parts";
import type { ArticleRow, Kpis, SortKey } from "@/lib/articles/model";
import type { ArticleReport, BuildStatus } from "@/lib/integrations/articleReport";

type Summary = {
  status: BuildStatus;
  report: (Omit<ArticleReport, "rows"> & { filtered: Kpis | null; movers: { top: ArticleRow[]; flop: ArticleRow[] } }) | null;
};
type RowsPage = { total: number; offset: number; rows: ArticleRow[] };

type TabId = "movers" | "pc" | "all";
const TAB_HASH: Record<TabId, string> = { movers: "#movers", pc: "#profit-centres", all: "#articles" };
const PER = 50;

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${eur(Math.abs(n))}`;
const pctSigned = (p: number | null) => (p === null ? "new" : `${p > 0 ? "+" : ""}${p.toFixed(1)}%`);
/** Millions with two decimals - "14M" hides a 13.69M. */
const mio = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : compact(n));
const pcLabel = (pc: string) => (pc === "?" ? "No profit centre" : pc);

function MoverList({ rows, maxAbs, tone }: { rows: ArticleRow[]; maxAbs: number; tone: "up" | "down" }) {
  if (!rows.length) return <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing here for this selection.</Typography>;
  const color = tone === "up" ? GREEN : RED;
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      {rows.map((r, i) => (
        <Box key={r.article} sx={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr) 96px", gap: 1.25, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, ...clip(420) }} title={r.description}>
              {r.description || "—"}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
              {r.article} · {pcLabel(r.pc)} · {eur(r.revenueCy)} vs {eur(r.revenueLyYtd)} EUR · buyers {full(r.customersCy)} vs {full(r.customersLyYtd)}
            </Typography>
            <Box sx={{ mt: 0.5, height: 6, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
              <Box sx={{ width: `${Math.max(2, (100 * Math.abs(r.delta)) / Math.max(1, maxAbs))}%`, height: "100%", bgcolor: color, borderRadius: 99 }} />
            </Box>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{signed(r.delta)}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{pctSigned(r.deltaPct)}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function AllArticles({ pc, q, generated }: { pc: string | null; q: string; generated: string }) {
  const [order, setOrder] = useState<SortKey>("revenueCy");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<RowsPage | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(0), [pc, q, order]);
  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    const t = setTimeout(() => {
      const u = `/api/uc/articles/rows?offset=${page * PER}&limit=${PER}&order=${order}${pc ? `&pc=${encodeURIComponent(pc)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      fetch(u, { signal: ctrl.signal }).then((r) => r.json())
        .then((j) => { if (j?.ok) setData(j.data as RowsPage); })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, q ? 350 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [page, order, pc, q, generated]);

  const sort = (label: string, key: SortKey, alt?: SortKey, align: "left" | "right" = "right") => (
    <TableCell sx={headCell} align={align}>
      <TableSortLabel active={order === key || order === alt} direction={order === alt ? "asc" : "desc"}
        onClick={() => setOrder(order === key && alt ? alt : key)}>{label}</TableSortLabel>
    </TableCell>
  );
  return (
    <>
      <Box sx={{ overflowX: "auto", opacity: busy ? 0.6 : 1, transition: "opacity .15s" }}>
        <Table size="small" sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Article</TableCell>
              <TableCell sx={headCell}>PC</TableCell>
              {sort("This year", "revenueCy")}
              {sort("Last year, same days", "revenueLyYtd")}
              {sort("Change", "delta", "deltaAsc")}
              <TableCell sx={headCell} align="right">%</TableCell>
              {sort("Last year, all", "revenueLy")}
              {sort("Buyers", "customersCy")}
              {sort("Qty", "qtyCy")}
              <TableCell sx={headCell}>Countries</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.rows ?? []).map((r) => (
              <TableRow key={r.article} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, ...clip(360) }} title={r.description}>{r.description || "—"}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.article}{r.pseudo ? " · accounting line" : ""}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED }}>{r.pc === "?" ? "—" : r.pc}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }} align="right">{eur(r.revenueCy)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{eur(r.revenueLyYtd)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: r.delta > 0 ? GREEN : r.delta < 0 ? RED : MUTED }} align="right">{signed(r.delta)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", color: MUTED }} align="right">{pctSigned(r.deltaPct)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", color: MUTED }} align="right">{eur(r.revenueLy)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }} align="right">{full(r.customersCy)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", color: MUTED }} align="right">{full(Math.round(r.qtyCy))}</TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.76rem", ...clip(160) }} title={r.countries.replace(/\|/g, ", ")}>{r.countries.replace(/\|/g, ", ")}</TableCell>
              </TableRow>
            ))}
            {data && !data.rows.length && (
              <TableRow><TableCell colSpan={10} sx={{ ...bodyCell, color: MUTED }}>No article matches.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <TablePagination component="div" count={data?.total ?? 0} page={page} onPageChange={(_, p) => setPage(p)}
        rowsPerPage={PER} rowsPerPageOptions={[PER]} sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
    </>
  );
}

export default function ArticlesCyLy() {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "movers");
  const [pc, setPc] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [tick, setTick] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [buildNote, setBuildNote] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setRole(j?.role ?? null)).catch(() => {});
  }, []);
  const onSearch = (v: string) => {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setQLive(v), 350);
  };

  const url = `/api/uc/articles?n=${tick}${pc ? `&pc=${encodeURIComponent(pc)}` : ""}${qLive ? `&q=${encodeURIComponent(qLive)}` : ""}`;
  const held = useHeld<Summary>(url, [url]);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  const rep = data?.report ?? null;
  const st = data?.status;
  const running = st?.status === "running";

  // while a build runs, look again every few seconds
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [running, tick]);

  const rebuild = useCallback(async () => {
    setBuildNote(null);
    const j = await fetch("/api/uc/articles/build", { method: "POST" }).then((x) => x.json()).catch(() => null);
    setBuildNote(j?.ok ? j.data.note : j?.error ?? "The build could not be started.");
    setTick((n) => n + 1);
  }, []);

  const k = rep ? (rep.filtered ?? rep.kpis) : null;
  const pcs = useMemo(() => (rep?.kpis.byPc ?? []).filter((p) => p.cy > 0 || p.lyYtd > 0), [rep]);
  const maxAbs = useMemo(() => Math.max(1, ...(rep ? [...rep.movers.top, ...rep.movers.flop].map((x) => Math.abs(x.delta)) : [1])), [rep]);
  const asOf = rep ? dm(rep.today) : "";
  const exportQs = `${pc ? `&pc=${encodeURIComponent(pc)}` : ""}${qLive ? `&q=${encodeURIComponent(qLive)}` : ""}`;

  const header = (
    <PageHeader
      title="Articles CY/LY"
      subtitle="Every article's revenue this year to date against the same days of last year - each order counted once"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} disabled={!rep} onClick={(e) => setMenu(e.currentTarget)}>Export</Button>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem component="a" href={`/api/uc/articles/export?x=1${exportQs}`} onClick={() => setMenu(null)}>Excel - summary and every article</MenuItem>
            <MenuItem component="a" href={`/api/uc/articles/export?movers=1${exportQs}`} onClick={() => setMenu(null)}>Excel - top and flop 20</MenuItem>
            <MenuItem component="a" href={`/api/uc/articles/export?format=csv${exportQs}`} onClick={() => setMenu(null)}>CSV - every article</MenuItem>
          </Menu>
          {role === "admin" && (
            <Tooltip title="Rebuild from HubSpot now - it also rebuilds by itself every morning">
              <span>
                <Button size="small" variant="contained" disableElevation startIcon={<RefreshIcon />} disabled={running} onClick={rebuild}>
                  {running ? "Building…" : rep ? "Rebuild" : "Build"}
                </Button>
              </span>
            </Tooltip>
          )}
          {role !== "admin" && (
            <Tooltip title="Read again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          )}
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>{header}{children}</Box>
  );

  if (r === null) return shell(<LoadingPanel label="Reading the article report…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="Article report" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />);

  const progress = running && st ? (
    <GlassCard sx={{ py: 1.75 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 1 }}>
        Building the report - {st.step}{st.total ? ` (${full(st.done)} of ${full(st.total)})` : ""}
      </Typography>
      <LinearProgress variant={st.total ? "determinate" : "indeterminate"} value={st.total ? (100 * st.done) / st.total : undefined}
        sx={{ height: 8, borderRadius: 99, bgcolor: TRACK }} />
    </GlassCard>
  ) : null;

  if (!rep) {
    return shell(
      <>
        {progress}
        {st?.status === "error" && <Notice tone="bad">The last build failed: {st.error}</Notice>}
        {!running && (
          <GlassCard>
            <CardTitle icon={<ListAltIcon />} title="Not built yet"
              note={role === "admin" ? "Build it now, or it builds by itself after the next nightly order load." : "It builds by itself after the next nightly order load."} />
          </GlassCard>
        )}
      </>,
    );
  }

  const old = rep.documentsBasis;
  const overstated = old.totalCy - rep.kpis.totalCy;

  return shell(
    <>
      {progress}
      {st?.status === "error" && <Notice tone="bad">The last build failed, so this is the one before it: {st.error}</Notice>}
      {buildNote && <Notice tone="warn">{buildNote}</Notice>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EuroIcon />} label={`${rep.cy} to ${asOf}`} value={k ? `${mio(k.totalCy)} EUR` : "—"}
            note={k ? `against ${mio(k.totalLyYtd)} EUR on the same days of ${rep.ly} · ${mio(k.totalLy)} EUR in all of ${rep.ly}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={k && k.delta >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />} tint={k && k.delta >= 0 ? "green" : "pink"}
            label="Change, like for like" value={k ? `${signed(k.delta)} EUR` : "—"}
            note={k ? `${pctSigned(k.deltaPct)} · ${full(k.gainers)} articles growing, ${full(k.losers)} falling` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FiberNewOutlinedIcon />} tint="purple" label="New articles" value={k ? full(k.newArticles) : "—"}
            note={k ? `${compact(k.newRevenueCy)} EUR in ${rep.cy} on articles not sold at all in ${rep.ly}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<BedtimeOutlinedIcon />} tint="amber" label="Gone quiet" value={k ? full(k.lostArticles) : "—"}
            note={k ? `${compact(k.lostRevenueLyYtd)} EUR by ${asOf} last year, nothing yet this year` : undefined} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.5 }}>
        {full(rep.ordersRead)} order documents read {rep.generated.slice(0, 16).replace("T", " ")} UTC. Each order counts once - as placed, or as delivered where that is more; summed document by document, as the old report did, {rep.cy} would read {mio(old.totalCy)} EUR{overstated > 0 ? ` (${compact(overstated)} EUR counted twice)` : ""}.
        {pc || qLive ? ` Figures above: ${[pc ? `profit centre ${pc}` : "", qLive ? `"${qLive}"` : ""].filter(Boolean).join(", ")}.` : ""}
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <ReportTabs name="articles" tab={tab} onSelect={selectTab} tabs={[
          { id: "movers", label: "Movers", count: null },
          { id: "pc", label: "By profit centre", count: full(pcs.length) },
          { id: "all", label: "All articles", count: k ? full(k.articles) : null },
        ]} />
        <SearchBox value={q} onChange={onSearch} placeholder="Article number or description" />
      </Box>
      <FilterChips value={pc ?? "all"} onChange={(v) => setPc(v === "all" ? null : v)} tint="purple"
        options={[{ id: "all", label: "All profit centres" }, ...pcs.slice(0, 12).map((p) => ({ id: p.pc, label: pcLabel(p.pc) }))]} />

      {tab === "movers" && (
        <Grid container spacing={2} id="articles-panel-movers" role="tabpanel">
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassCard sx={{ height: "100%" }}>
              <CardTitle icon={<TrendingUpIcon />} tint="green" title="Growing most" note={`${rep.cy} against the same days of ${rep.ly} - accounting lines left out`} />
              <MoverList rows={rep.movers.top} maxAbs={maxAbs} tone="up" />
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <GlassCard sx={{ height: "100%" }}>
              <CardTitle icon={<TrendingDownIcon />} tint="pink" title="Falling most" note={`${rep.cy} against the same days of ${rep.ly} - accounting lines left out`} />
              <MoverList rows={rep.movers.flop} maxAbs={maxAbs} tone="down" />
            </GlassCard>
          </Grid>
        </Grid>
      )}

      {tab === "pc" && (
        <Box id="articles-panel-pc" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <GlassCard>
            <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="Profit centres, like for like" note={`${rep.cy} to ${asOf} beside the same days of ${rep.ly}`} />
            <GroupedColumns data={pcs.slice(0, 12).map((p) => ({ x: p.pc, current: Math.round(p.cy), prior: Math.round(p.lyYtd) }))}
              currentLabel={`${rep.cy}`} priorLabel={`${rep.ly}, same days`} format={(v) => compact(v)} />
          </GlassCard>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    {["Profit centre", "Articles", `${rep.cy} to ${asOf}`, `${rep.ly} same days`, "Change", "%", `${rep.ly} all`].map((h, i) => (
                      <TableCell key={h} sx={headCell} align={i ? "right" : "left"}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pcs.map((p) => (
                    <TableRow key={p.pc} hover sx={{ cursor: "pointer" }} onClick={() => { setPc(p.pc); selectTab("all"); }}>
                      <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{pcLabel(p.pc)}</TableCell>
                      <TableCell sx={bodyCell} align="right">{full(p.n)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontWeight: 600 }} align="right">{eur(p.cy)}</TableCell>
                      <TableCell sx={bodyCell} align="right">{eur(p.lyYtd)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontWeight: 700, color: p.delta >= 0 ? GREEN : RED }} align="right">{signed(p.delta)}</TableCell>
                      <TableCell sx={{ ...bodyCell, color: MUTED }} align="right">{p.lyYtd ? `${((100 * p.delta) / p.lyYtd).toFixed(1)}%` : "new"}</TableCell>
                      <TableCell sx={{ ...bodyCell, color: MUTED }} align="right">{eur(p.ly)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>
        </Box>
      )}

      {tab === "all" && (
        <Box id="articles-panel-all" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<ListAltIcon />} title="Every article" note="Sort by any figure; the profit centre and search above apply" />
            </Box>
            <AllArticles pc={pc} q={qLive} generated={rep.generated} />
          </GlassCard>
        </Box>
      )}
    </>,
  );
}
