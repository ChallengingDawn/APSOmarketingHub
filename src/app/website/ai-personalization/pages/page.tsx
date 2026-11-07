"use client";

// APSOconvert > PAGES (Website > AI testing & personalization). Every page the shop publishes in its sitemaps, on
// production and on ACC side by side: what is on both, what ACC has that production does not yet, and what production
// still lists that ACC has dropped. Read once a day and on the button (src/lib/convert/pages.ts). The Problems page and
// the builder start from this list.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import FiberNewOutlinedIcon from "@mui/icons-material/FiberNewOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import Link from "next/link";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, KpiTile, MUTED, Notice, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, ago, when } from "@/app/connectors/parts";
import { ENVS, KIND_LABEL, PAGE_KINDS, type Env, type PageKind } from "@/lib/convert/model";
import type { PageRow, PagesList, PagesSummary, ReadResult, Where } from "@/lib/convert/pages";
import { previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";

type Reads = Record<Env, { last: ReadResult | null; lastComplete: string | null }>;
type Data = { reads: Reads; summary: PagesSummary; list: PagesList; canRead: boolean };

const KIND_TINT: Record<PageKind, "blue" | "green" | "amber" | "purple" | "slate"> = {
  home: "purple", category: "blue", product: "green", cms: "amber", system: "slate",
};
const day = (iso: string | null | undefined) => {
  if (!iso) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};
/** A read that has not finished within ten minutes did not finish (the process went away). */
const running = (r: ReadResult | null) => !!r && !r.finishedAt && Date.now() - Date.parse(r.startedAt) < 10 * 60_000;

function ReadCard({ env, r, canRead, onRead, busy }: { env: Env; r: Reads[Env]; canRead: boolean; onRead: (e: Env) => void; busy: boolean }) {
  const last = r.last;
  const isRunning = running(last) || busy;
  const failed = last?.sitemaps.filter((s) => s.status !== 200 || s.note === "robots.txt names it, but it is not a sitemap") ?? [];
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={env === "prod" ? <LanguageOutlinedIcon /> : <ScienceOutlinedIcon />} tint={env === "prod" ? "blue" : "purple"}
        title={ENVS[env].label} note={ENVS[env].base.replace("https://", "")}
        right={canRead ? (
          <Button size="small" disabled={isRunning} onClick={() => onRead(env)} startIcon={isRunning ? <CircularProgress size={13} /> : <SyncOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "999px" }}>
            {isRunning ? "Reading…" : "Read again"}
          </Button>
        ) : undefined} />
      {!last && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Not read yet - the first read runs a few minutes after the hub starts.</Typography>}
      {last && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
            {running(last) ? <Chip tint="blue">Reading now</Chip> : last.complete ? <Chip tint="green">Complete</Chip> : <Chip tint="amber">Incomplete</Chip>}
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              {running(last) ? `started ${ago(Date.parse(last.startedAt))}` : `${when(last.finishedAt ?? last.startedAt)} · ${full(last.urls)} addresses · ${full(last.added)} new · ${full(last.gone)} gone`}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {last.sitemaps.filter((s) => s.urls > 0).map((s) => (
              <Tooltip key={s.url} title={`${s.url} · ${full(s.urls)} addresses`}><span><Chip tint="slate">{s.name} · {full(s.urls)}</Chip></span></Tooltip>
            ))}
          </Box>
          {failed.length > 0 && (
            <Notice tone="warn">
              Not read: {failed.map((s) => `${s.name} (${s.note ?? s.status})`).join(", ")}. Pages are only marked gone after a complete read.
            </Notice>
          )}
          {last.error && <Notice tone="bad">{last.error}</Notice>}
          {!last.complete && r.lastComplete && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Last complete read {when(r.lastComplete)}</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

function PageLink({ side }: { side: PageRow["prod"] }) {
  if (!side) return <Typography component="span" sx={{ color: MUTED, fontSize: "0.84rem" }}>–</Typography>;
  return (
    <Box component="a" href={side.url} target="_blank" rel="noopener" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#1b7a55", fontSize: "0.84rem", fontWeight: 600, textDecoration: "none" }}>
      ✓ {side.lastmod ? day(side.lastmod) : "listed"} <OpenInNewIcon sx={{ fontSize: 13 }} />
    </Box>
  );
}

export default function ConvertPages() {
  const [tick, setTick] = useState(0);
  const [kind, setKind] = useState<PageKind | "all">("all");
  const [where, setWhere] = useState<Where>("all");
  const [store, setStore] = useState<string>("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [page, setPage] = useState(0);
  const [asked, setAsked] = useState<Partial<Record<Env, number>>>({});
  const [askError, setAskError] = useState<string | null>(null);

  // the search waits for a pause in typing
  useEffect(() => { const t = setTimeout(() => { setQ(qLive); setPage(0); }, 350); return () => clearTimeout(t); }, [qLive]);

  const params = new URLSearchParams({ where, page: String(page) });
  if (kind !== "all") params.set("kind", kind);
  if (store !== "all") params.set("store", store);
  if (q.trim()) params.set("q", q.trim());
  const url = `/api/website/ai-personalization/pages?${params.toString()}&n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  // while a read runs (or was just asked for), ask again every five seconds
  const anyRunning = !!d && (["prod", "acc"] as Env[]).some((e) => running(d.reads[e].last) || (asked[e] && Date.now() - asked[e]! < 15_000));
  useEffect(() => {
    if (!anyRunning) return;
    const t = setTimeout(() => setTick((n) => n + 1), 5_000);
    return () => clearTimeout(t);
  }, [anyRunning, tick]);

  const readAgain = async (env: Env) => {
    setAskError(null);
    setAsked((a) => ({ ...a, [env]: Date.now() }));
    try {
      const res = await fetch("/api/website/ai-personalization/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ env }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) setAskError(j.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setAskError(String((e as Error)?.message ?? e));
    }
    setTimeout(() => setTick((n) => n + 1), 1_500);
  };

  const totals = useMemo(() => {
    const cells = d?.summary.cells ?? [];
    const sum = (f: (c: PagesSummary["cells"][number]) => number, k?: PageKind) => cells.filter((c) => !k || c.kind === k).reduce((s, c) => s + f(c), 0);
    const stores = [...new Set(cells.map((c) => c.store).filter(Boolean))].sort();
    const has = (s: string, f: (c: PagesSummary["cells"][number]) => number) => cells.some((c) => c.store === s && f(c) > 0);
    return {
      // store views one environment publishes no sitemap for: listed, not compared
      prodOnlyStores: stores.filter((s) => has(s, (c) => c.prod) && !has(s, (c) => c.acc)),
      accOnlyStores: stores.filter((s) => has(s, (c) => c.acc) && !has(s, (c) => c.prod)),
      prod: sum((c) => c.prod), acc: sum((c) => c.acc), accOnly: sum((c) => c.accOnly), prodOnly: sum((c) => c.prodOnly),
      both: sum((c) => c.prod - c.prodOnly), stores,
      byKind: (k: PageKind) => cells.filter((c) => c.kind === k).reduce((s, c) => s + c.prod + c.accOnly, 0),
    };
  }, [d]);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the page index…" />;
  else if (r.state === "error") body = <UpstreamPanel source="the hub's page index" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state === "not-configured") body = <UpstreamPanel source="the hub's page index" error="Not configured." status={null} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const list = r.data.list;
    body = (
      <>
        {askError && <Notice tone="bad">{askError}</Notice>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LanguageOutlinedIcon />} tint="blue" label="Pages on production" value={full(totals.prod)} note={`${totals.stores.length} store views`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ScienceOutlinedIcon />} tint="purple" label="Pages on ACC" value={full(totals.acc)} note={`${full(totals.both)} on both`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FiberNewOutlinedIcon />} tint="green" label="On ACC only" value={full(totals.accOnly)} note="not on production yet" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<RemoveCircleOutlineIcon />} tint="amber" label="On production only" value={full(totals.prodOnly)} note="not on ACC" /></Grid>
        </Grid>

        <Grid container spacing={2}>
          {(["prod", "acc"] as Env[]).map((e) => (
            <Grid key={e} size={{ xs: 12, md: 6 }}>
              <ReadCard env={e} r={r.data.reads[e]} canRead={r.data.canRead} onRead={readAgain} busy={!!asked[e] && Date.now() - asked[e]! < 15_000} />
            </Grid>
          ))}
        </Grid>

        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.5 }}>
            <CardTitle icon={<ListAltOutlinedIcon />} tint="green" title={`Pages · ${full(list.total)}`}
              note="Each page once, with the date its sitemap gives on production and on ACC" />
            {(totals.prodOnlyStores.length > 0 || totals.accOnlyStores.length > 0) && (
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                {totals.prodOnlyStores.length > 0 && `ACC publishes no sitemap for ${totals.prodOnlyStores.join(", ")}. `}
                {totals.accOnlyStores.length > 0 && `Production publishes no sitemap for ${totals.accOnlyStores.join(", ")}. `}
                Those store views are listed, not compared.
              </Typography>
            )}
            <SquareChoice<PageKind | "all"> label="Kind" value={kind} onChange={(k) => { setKind(k); setPage(0); }} options={[
              { key: "all", label: "All" },
              ...PAGE_KINDS.filter((k) => k !== "system" && totals.byKind(k) > 0).map((k) => ({ key: k, label: KIND_LABEL[k], count: totals.byKind(k) })),
            ]} />
            <SquareChoice<Where> label="Where" value={where} onChange={(w) => { setWhere(w); setPage(0); }} options={[
              { key: "all", label: "Production or ACC" },
              { key: "both", label: "On both", count: totals.both },
              { key: "acc", label: "ACC only", count: totals.accOnly },
              { key: "prod", label: "Production only", count: totals.prodOnly },
            ]} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
              <SquareChoice<string> label="Store view" value={store} onChange={(s) => { setStore(s); setPage(0); }} options={[{ key: "all", label: "Every store view" }, ...totals.stores.map((s) => ({ key: s, label: s }))]} />
              <TextField size="small" value={qLive} onChange={(e) => setQLive(e.target.value)} placeholder="Address or product number"
                inputProps={{ "aria-label": "Search the pages" }} sx={{ width: { xs: "100%", sm: 280 }, ml: { sm: "auto" } }} />
            </Box>
          </Box>
          <Box sx={{ overflowX: "auto", mt: 1.5 }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  {["Page", "Kind", "Store view", "Production", "ACC"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>
                    {totals.prod + totals.acc === 0 ? "No page read yet." : "No page matches these filters."}
                  </TableCell></TableRow>
                )}
                {list.rows.map((p) => (
                  <TableRow key={`${p.store}|${p.rest}`} hover>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                      <Box component={Link} href={previewHref(p.prod ? "prod" : "acc", new URL((p.prod ?? p.acc)!.url).pathname)} title={`Open /${p.store}/${p.rest} in the preview`}
                        sx={{ ...clip(520), display: "block", color: "inherit", textDecoration: "none", "&:hover": { color: "#2459d1", textDecoration: "underline" } }}>{p.rest || "(home page)"}</Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={KIND_TINT[p.kind]}>{KIND_LABEL[p.kind]}{p.product ? ` ${p.product}` : ""}</Chip></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{p.store || "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><PageLink side={p.prod} /></TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><PageLink side={p.acc} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {list.total > list.perPage && (
            <TablePagination component="div" count={list.total} page={list.page} onPageChange={(_, n) => setPage(n)}
              rowsPerPage={list.perPage} rowsPerPageOptions={[list.perPage]} labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
              sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
          )}
        </GlassCard>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Pages"
        subtitle="Every page of the shop, on production and on ACC, from the shop's sitemaps"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
