"use client";

// APSOconvert > PAGES (Website > AI testing & personalization). Every page the shop publishes in its sitemaps, on
// production and on ACC side by side: what is on both, what ACC has that production does not yet, and what production
// still lists that ACC has dropped. Read once a day and on the button (src/lib/convert/pages.ts). The Problems page and
// the builder start from this list.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
import { ago, when } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ENVS, KIND_LABEL, PAGE_KINDS, type Env, type PageKind } from "@/lib/convert/model";
import type { PageRow, PagesList, PagesSummary, ReadResult, Where } from "@/lib/convert/pages";
import type { Idea } from "@/lib/convert/studio";
import { convertPost, previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";
import { HubPublished, HubPublishedLoading, type Published } from "./HubPublished";
import { PageShot } from "../PageShot";
import { AiButton } from "../AiButton";

type Reads = Record<Env, { last: ReadResult | null; lastComplete: string | null }>;
type Work = Record<string, { waiting: number; approved: number; blocks: number }>;
type Data = { reads: Reads; summary: PagesSummary; list: PagesList; work?: Work; canRead: boolean };
type OpenData = { page: { title: string; h1: string[]; status: number }; ideas: Idea[]; canEdit: boolean; ai: boolean };

const pathOf = (p: PageRow) => { try { return new URL((p.prod ?? p.acc)!.url).pathname; } catch { return ""; } };
const keyOf = (p: PageRow) => `${p.store}|${p.rest}`;

/**
 * A page opened in place (SARCLA 10.11.2026: "the pages app more interactive, the home page the start, open as before"):
 * the page's still picture, its optimizations (each its block and its state - a click opens it in the Preview), and the
 * AI's button to find them. Product pages say they come later.
 */
function PageOpen({ env, path, kind }: { env: Env; path: string; kind: PageKind }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/work?env=${env}&path=${encodeURIComponent(path)}&n=${tick}`;
  const held = useHeld<OpenData>(url, [url]);
  const d = held.result?.state === "ok" ? held.result.data : null;
  const live = (d?.ideas ?? []).filter((i) => i.status !== "dropped" && i.contentType !== "landing-page");
  const product = kind === "product";
  const find = async () => {
    setBusy(true); setErr(null);
    const res = await convertPost<unknown>("/api/website/ai-personalization/work", { action: "ideas", env, path, numbers: null });
    setBusy(false);
    if (!res.ok) setErr(res.error); else setTick((n) => n + 1);
  };
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "300px minmax(0,1fr)" }, py: 1.5 }}>
      <Box sx={{ borderRadius: "10px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", alignSelf: "start" }}>
        <PageShot env={env} path={path} ratio={1.1} label={path} focus={null} />
      </Box>
      <Box sx={{ display: "grid", gap: 1, alignContent: "start", minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a" }}>{d?.page.h1[0] || d?.page.title || path}</Typography>
        {product ? (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Product pages come later: dotSource codes them in the shop&apos;s theme, so the AI proposes no optimization here for now.</Typography>
        ) : !d ? (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading its optimizations…</Typography>
        ) : live.length ? (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {live.slice(0, 8).map((i) => (
              <Box key={i.id} component={Link} href={previewHref(env, path, i.id)} sx={{
                display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", p: 0.75, borderRadius: "8px", textDecoration: "none", color: "inherit",
                border: `1px solid ${HAIRLINE}`, "&:hover": { borderColor: "#2459d1", bgcolor: "rgba(36,89,209,.04)" },
              }}>
                {i.part && <Chip tint="blue">{i.part.split(" · ")[0]}</Chip>}
                <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: 600, color: "#15223a", flex: 1, minWidth: 0 }}>{i.title}</Typography>
                <Chip tint={i.status === "approved" ? "green" : "amber"}>{i.status === "approved" ? (i.sentAt ? "Sent to Content" : "Approved") : "Waiting"}</Chip>
              </Box>
            ))}
            {live.length > 8 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>and {live.length - 8} more in the Preview</Typography>}
          </Box>
        ) : (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No optimization on this page yet.</Typography>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="small" variant="contained" disableElevation component={Link} href={previewHref(env, path)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>Open in the Preview</Button>
          {!product && d?.canEdit && d.ai && <AiButton size="small" busy={busy} onClick={() => void find()}>{busy ? "The AI is reading its blocks…" : live.length ? "Find more optimizations" : "Find optimizations"}</AiButton>}
        </Box>
      </Box>
    </Box>
  );
}

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
  // the page opened in place - the home page at the start (SARCLA 10.11.2026: "the home page should be the start, open as before")
  const [open, setOpen] = useState<string | null>(null);
  const opened = useRef(false);
  // every page, or only the ones the hub itself published (SARCLA 11.11.2026: "own pages should also be a tab, to
  // measure only the pages that have been published via the hub")
  const [tab, setTab] = useState<"all" | "hub">("all");
  const pubUrl = `/api/website/ai-personalization/pages?published=1&n=${tick}`;
  const pubHeld = useHeld<Published>(pubUrl, [pubUrl]);
  const published = pubHeld.result?.state === "ok" ? pubHeld.result.data : null;

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
  useEffect(() => {
    if (opened.current || !d) return;
    opened.current = true;
    const home = d.list.rows.find((x) => x.kind === "home" && x.store === "de-CH") ?? d.list.rows.find((x) => x.kind === "home");
    if (home) setOpen(keyOf(home));
  }, [d]);

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
          {/* the filters and the search in one aligned row (SARCLA 13.11.2026: "filters and search bar more aligned on top,
              a better design here, and reduce the height") - the store view a list, the sitemap note behind an (i) */}
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <CardTitle icon={<ListAltOutlinedIcon />} tint="green" title={`Pages · ${full(list.total)}`}
                  note="Each page once, with the date its sitemap gives on production and on ACC" />
              </Box>
              {(totals.prodOnlyStores.length > 0 || totals.accOnlyStores.length > 0) && (
                <Tooltip title={`${totals.prodOnlyStores.length > 0 ? `ACC publishes no sitemap for ${totals.prodOnlyStores.join(", ")}. ` : ""}${totals.accOnlyStores.length > 0 ? `Production publishes no sitemap for ${totals.accOnlyStores.join(", ")}. ` : ""}Those store views are listed, not compared.`}>
                  <IconButton size="small" aria-label="Store views without a sitemap"><InfoOutlinedIcon sx={{ fontSize: 17, color: MUTED }} /></IconButton>
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, rowGap: 1, alignItems: "center" }}>
              <SquareChoice<PageKind | "all"> label="Kind" value={kind} onChange={(k) => { setKind(k); setPage(0); }} options={[
                { key: "all", label: "All" },
                ...PAGE_KINDS.filter((k) => k !== "system" && totals.byKind(k) > 0).map((k) => ({ key: k, label: KIND_LABEL[k], count: totals.byKind(k) })),
              ]} />
              <SquareChoice<Where> label="Where" value={where} onChange={(w) => { setWhere(w); setPage(0); }} options={[
                { key: "all", label: "Both shops" },
                { key: "both", label: "On both", count: totals.both },
                { key: "acc", label: "ACC only", count: totals.accOnly },
                { key: "prod", label: "Production only", count: totals.prodOnly },
              ]} />
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: { md: "auto" }, flexWrap: "wrap" }}>
                <TextField select size="small" value={store} onChange={(e) => { setStore(e.target.value); setPage(0); }}
                  inputProps={{ "aria-label": "Store view" }} sx={{ width: 170, "& .MuiInputBase-input": { fontSize: "0.84rem", py: "7px" } }}>
                  <MenuItem value="all">Every store view</MenuItem>
                  {totals.stores.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField size="small" value={qLive} onChange={(e) => setQLive(e.target.value)} placeholder="Address or product number"
                  inputProps={{ "aria-label": "Search the pages" }} sx={{ width: { xs: "100%", sm: 260 }, "& .MuiInputBase-input": { fontSize: "0.84rem", py: "7px" } }} />
              </Box>
            </Box>
          </Box>
          <Box sx={{ overflowX: "auto", mt: 1.5 }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  {["Page", "Kind", "Store view", "Optimizations", "Production", "ACC"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>
                    {totals.prod + totals.acc === 0 ? "No page read yet." : "No page matches these filters."}
                  </TableCell></TableRow>
                )}
                {list.rows.map((p) => {
                  const k = keyOf(p);
                  const isOpen = open === k;
                  const w = r.data.work?.[pathOf(p)];
                  return [
                    <TableRow key={k} hover onClick={() => setOpen(isOpen ? null : k)} sx={{ cursor: "pointer", ...(isOpen ? { bgcolor: "rgba(36,89,209,.05)" } : {}) }}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box component="span" aria-hidden sx={{ color: MUTED, fontSize: "0.8rem", width: 12, transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none" }}>▸</Box>
                          <Box component="span" sx={{ ...clip(500), display: "block", fontWeight: isOpen ? 700 : 400 }}>{p.rest || "(home page)"}</Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={KIND_TINT[p.kind]}>{KIND_LABEL[p.kind]}{p.product ? ` ${p.product}` : ""}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{p.store || "–"}</TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                        {w && (w.waiting || w.approved) ? (
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            {w.waiting > 0 && <Chip tint="amber">{w.waiting} waiting</Chip>}
                            {w.approved > 0 && <Chip tint="green">{w.approved} approved</Chip>}
                          </Box>
                        ) : <Typography component="span" sx={{ color: MUTED, fontSize: "0.84rem" }}>–</Typography>}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}><PageLink side={p.prod} /></TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}><PageLink side={p.acc} /></TableCell>
                    </TableRow>,
                    isOpen ? (
                      <TableRow key={`${k}|open`}>
                        <TableCell colSpan={6} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.03)" }}>
                          <PageOpen env={p.prod ? "prod" : "acc"} path={pathOf(p)} kind={p.kind} />
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ];
                })}
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
        subtitle={tab === "hub" ? "The pages the hub itself published, measured on the shop" : "Every page of the shop with its optimizations - click a page to open it; the home page first"}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      <SquareChoice<"all" | "hub"> value={tab} onChange={setTab} options={[
        { key: "all", label: "All pages" },
        { key: "hub", label: "Published by the hub", count: published ? published.pages.length : undefined },
      ]} />
      {tab === "hub"
        ? published ? <HubPublished data={published} /> : pubHeld.result && pubHeld.result.state !== "ok"
          ? <UpstreamPanel source="the hub's published pages" error={pubHeld.result.state === "error" ? pubHeld.result.error : "Not configured."} status={pubHeld.result.state === "error" ? pubHeld.result.status : null} onRetry={() => setTick((n) => n + 1)} />
          : <HubPublishedLoading />
        : body}
    </Box>
  );
}
