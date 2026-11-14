"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Checkbox from "@mui/material/Checkbox";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import HistoryIcon from "@mui/icons-material/History";
import UndoIcon from "@mui/icons-material/Undo";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PageHeader from "../PageHeader";
import { FilterBar, SearchFilter, SelectFilter, HierFilter, TextFilter, ClearFilters, FW } from "../Filters";
import { RowDetail, DetailModeToggle } from "../RowDetail";
import { useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";
import {
  API_URL, NAVY, RED, MUTED, GOOD, BAD, type Match, type Competitor,
  ConfidenceCell, QualifiedCell, ArrivalChips, DiffChip, MatchDetail, FreshnessStrip, MatchingSettings, CompetitorFilter,
  apsoPriceFor, compTiers, priceDiff, fmtMoney, fmtDate, personLabel,
} from "./MatchShared";

type Mode = "overview" | "pending";
type Opt = { number: string; description: string };
interface Stats {
  total: number; approved: number; approved_human: number; approved_auto: number; pending: number;
  pending_new: number; pending_extra: number; exact: number; very_close: number; partial: number;
  articles: number; avg_confidence: number | null; new_days: number;
  approvers: { approved_by: string; n: number }[];
}
const PER_PAGE = 25;
const DEFAULTS = {
  search: "", tab: "", confidence: "", mandant: "", competitors: "", fresh: "", approvedBy: "",
  pc: "", ass: "", mg: "", sg: "", pg: "", sort: "confidence",
};
type F = typeof DEFAULTS;

function filterParams(f: F, mode: Mode, withTab: boolean): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (mode === "pending") p.set("approved", "false");
  else if (withTab && f.tab) p.set("qualified", f.tab);
  if (f.confidence === "exact") p.set("min_confidence", "100");
  else if (f.confidence === "close") { p.set("min_confidence", "90"); p.set("max_confidence", "99.99"); }
  else if (f.confidence === "partial") { p.set("min_confidence", "70"); p.set("max_confidence", "89.99"); }
  if (f.mandant) p.set("mandant", f.mandant);
  if (f.competitors) p.set("competitor_ids", f.competitors);
  if (f.fresh) p.set("fresh", f.fresh);
  if (f.approvedBy && mode === "overview") p.set("approved_by", f.approvedBy);
  if (f.pc) p.set("profit_center", f.pc);
  if (f.ass) p.set("assortment", f.ass);
  if (f.mg) p.set("main_group", f.mg);
  if (f.sg) p.set("sub_group", f.sg);
  if (f.pg) p.set("product_group", f.pg);
  return p;
}

export default function MatchWorkspace({ mode }: { mode: Mode }) {
  const sf = useSavedFilters<F>(mode === "pending" ? "matches-pending" : "matches", { ...DEFAULTS, sort: mode === "pending" ? "newest" : "confidence" });
  const f = sf.f;
  const [detailMode, setDetailMode] = useDetailMode();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [opts, setOpts] = useState<{ profit_centers: string[]; assortments: Opt[]; main_groups: Opt[]; sub_groups: Opt[]; product_groups: Opt[] } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [me, setMe] = useState<{ email: string; name: string }>({ email: "", name: "" });
  const [reject, setReject] = useState<{ ids: number[]; reason: string } | null>(null);
  const [wholeAnchor, setWholeAnchor] = useState<HTMLElement | null>(null);
  const [whole, setWhole] = useState<{ action: "approve" | "reject" | "disqualify"; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  // A link with ?tab=pending|human|auto opens on that tab (once).
  useEffect(() => {
    if (mode !== "overview" || !sf.ready || typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    const map: Record<string, string> = { all: "", pending: "pending", approved: "human", human: "human", auto: "auto" };
    if (t && t in map && map[t] !== f.tab) sf.set("tab", map[t]);
  }, [sf.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/auth/me`).then(r => (r.ok ? r.json() : null)).then(d => d?.user && setMe({ email: d.user.email || "", name: d.user.full_name || d.user.username || "" })).catch(() => {});
    fetch(`${API_URL}/api/competitors`).then(r => r.json()).then(j => Array.isArray(j) && setCompetitors(j.filter((c: Competitor) => c.code !== "manual"))).catch(() => {});
  }, []);

  // Cascading hierarchy options (exclude-self), same as the APSO Products app.
  useEffect(() => {
    if (!sf.ready) return;
    const p = new URLSearchParams();
    if (f.mandant) p.set("mandant", f.mandant);
    if (f.pc) p.set("profit_center", f.pc);
    if (f.ass) p.set("assortment", f.ass);
    if (f.mg) p.set("main_group", f.mg);
    if (f.sg) p.set("sub_group", f.sg);
    if (f.pg) p.set("product_group", f.pg);
    fetch(`${API_URL}/api/products/filters?${p}`).then(r => r.json()).then(setOpts).catch(() => {});
  }, [sf.ready, f.mandant, f.pc, f.ass, f.mg, f.sg, f.pg]);

  const listKey = JSON.stringify(f);
  // The list.
  useEffect(() => {
    if (!sf.ready) return;
    let alive = true;
    setLoading(true);
    const p = filterParams(f, mode, true);
    p.set("page", String(page + 1)); p.set("per_page", String(PER_PAGE)); p.set("sort", f.sort);
    fetch(`${API_URL}/api/matches?${p}`).then(r => r.json()).then(j => { if (!alive) return; setRows(j.data || []); setTotal(j.total || 0); })
      .catch(() => alive && setRows([])).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [sf.ready, listKey, page, mode, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  // The KPI funnel: the same filters, except the tab (so every tab shows its count).
  useEffect(() => {
    if (!sf.ready) return;
    let alive = true;
    fetch(`${API_URL}/api/matching/stats?${filterParams(f, mode, false)}`).then(r => r.json()).then(j => alive && setStats(j)).catch(() => {});
    return () => { alive = false; };
  }, [sf.ready, JSON.stringify({ ...f, tab: "", sort: "" }), mode, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const setF = <K extends keyof F>(k: K, v: F[K]) => { sf.set(k, v); setPage(0); setSelected(new Set()); };
  const setHier = (patch: Partial<F>) => { sf.setMany(patch); setPage(0); setSelected(new Set()); };
  const refresh = () => { setReload(x => x + 1); setSelected(new Set()); };
  const say = (text: string, error = false) => setMsg({ text, error });

  // ── actions ──
  const actor = { approved_by: me.email || null, user_name: me.name || null };
  const patch = (id: number, approved: boolean) => fetch(`${API_URL}/api/matches/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, unapprove: !approved, ...actor }),
  });
  const del = (id: number, reason: string) => {
    const p = new URLSearchParams();
    if (me.email) p.set("user_email", me.email);
    if (me.name) p.set("user_name", me.name);
    if (reason) p.set("reason", reason);
    return fetch(`${API_URL}/api/matches/${id}?${p}`, { method: "DELETE" });
  };
  const idx = rows.findIndex(r => r.id === openId);
  const stepAfter = (ids: number[]) => {
    // In the pop-up, deciding a row moves on to the next one (review flow).
    if (openId != null && ids.includes(openId)) {
      const next = rows.slice(idx + 1).find(r => !ids.includes(r.id));
      setOpenId(next && detailMode === "popup" ? next.id : null);
    }
  };
  const approveIds = async (ids: number[], approved = true) => {
    setBusy(true);
    const res = await Promise.all(ids.map(id => patch(id, approved).catch(() => null)));
    const failed = res.filter(r => !r || !r.ok).length;
    setBusy(false);
    say(`${approved ? "Approved" : "Back to pending"}: ${ids.length - failed}${failed ? ` · ${failed} failed` : ""}`, failed > 0);
    stepAfter(ids); refresh();
  };
  const rejectIds = async () => {
    if (!reject) return;
    setBusy(true);
    const res = await Promise.all(reject.ids.map(id => del(id, reject.reason.trim()).catch(() => null)));
    const failed = res.filter(r => !r || !r.ok).length;
    setBusy(false);
    say(`Rejected: ${reject.ids.length - failed}${reject.reason.trim() ? ` — ${reject.reason.trim()}` : ""}${failed ? ` · ${failed} failed` : ""}`, failed > 0);
    stepAfter(reject.ids); setReject(null); refresh();
  };
  const runWhole = async () => {
    if (!whole) return;
    setBusy(true);
    const body: Record<string, string | null> = Object.fromEntries(filterParams(f, mode, false).entries());
    const r = await fetch(`${API_URL}/api/matches/approve-filtered`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action: whole.action, reason: whole.reason.trim() || null, user_email: me.email || null, user_name: me.name || null }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setWhole(null);
    say(r?.ok ? `${whole.action === "approve" ? "Accepted" : whole.action === "disqualify" ? "Disqualified" : "Declined"} ${Number(j.affected || 0).toLocaleString()} matches` : (j.error || "Failed"), !r?.ok);
    setPage(0); refresh();
  };

  const allSel = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(rows.map(r => r.id)));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selApproved = rows.filter(r => selected.has(r.id) && r.approved).length;

  type KpiCard = { label: string; value: string; color: string; onClick?: () => void; active?: boolean; sub?: string; small?: boolean };
  const cards = useMemo<KpiCard[]>(() => {
    const s = stats;
    const v = (n: number | undefined) => (n == null ? "—" : n.toLocaleString("de-CH"));
    if (mode === "pending") return [
      { label: "Pending review", value: v(s?.pending), color: "#c77700" },
      { label: `New · ${s?.new_days ?? 14} days`, value: v(s?.pending_new), color: RED, onClick: () => setF("fresh", f.fresh === "new" ? "" : "new"), active: f.fresh === "new" },
      { label: "Extra refs", value: v(s?.pending_extra), color: "#854d0e", onClick: () => setF("fresh", f.fresh === "extra" ? "" : "extra"), active: f.fresh === "extra" },
      { label: "Very close 90-99%", value: v(s?.very_close), color: "#e65100" },
      { label: "Partial 70-89%", value: v(s?.partial), color: "#f57f17" },
      { label: "Articles", value: v(s?.articles), color: NAVY },
    ];
    return [
      { label: "Matches", value: v(s?.total), color: NAVY },
      { label: "Articles", value: v(s?.articles), color: NAVY },
      { label: "Approved by people", value: v(s?.approved_human), color: GOOD, onClick: () => setF("tab", f.tab === "human" ? "" : "human"), active: f.tab === "human" },
      { label: "Auto-approved 100%", value: v(s?.approved_auto), color: "#1565c0", onClick: () => setF("tab", f.tab === "auto" ? "" : "auto"), active: f.tab === "auto" },
      { label: "Pending review", value: v(s?.pending), color: "#c77700", sub: s ? `${v(s.pending_new)} new · ${v(s.pending_extra)} extra refs` : "", onClick: () => setF("tab", f.tab === "pending" ? "" : "pending"), active: f.tab === "pending" },
      { label: "Exact · close · partial", value: s ? `${v(s.exact)} · ${v(s.very_close)} · ${v(s.partial)}` : "—", color: MUTED, small: true },
      { label: "Avg machine score", value: s?.avg_confidence != null ? `${s.avg_confidence}%` : "—", color: MUTED },
    ];
  }, [stats, mode, f.fresh, f.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = rows.find(r => r.id === openId) || null;
  const head = { fontWeight: 700, fontSize: "0.66rem", color: "#5d6b85", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, bgcolor: "#f5f7fb" };
  const COLS = 11;

  return (
    <Box>
      <PageHeader icon={mode === "pending" ? "pending" : "matches"} eyebrow="Product Matching"
        title={mode === "pending" ? "Pending Review" : "Match Overview"}
        subtitle={mode === "pending" ? "Matches under 100% waiting for a person — approve or reject with a reason" : "Every APSO ↔ competitor match, how it was qualified and by whom"}
        rightSlot={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button component={Link} href={mode === "pending" ? "/pricing/matches" : "/pricing/matches/pending"} variant="outlined" size="small"
              sx={{ textTransform: "none", fontWeight: 700, borderColor: NAVY, color: NAVY }}>{mode === "pending" ? "Match Overview" : "Pending Review"}</Button>
            <Button component={Link} href="/pricing/matches/logs" variant="outlined" size="small" startIcon={<HistoryIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: "#5d6b85", color: "#5d6b85" }}>Approval Logs</Button>
            <MatchingSettings competitors={competitors} onChanged={(t, e) => { say(t, e); refresh(); }} />
          </Box>
        } />

      {msg && <Alert severity={msg.error ? "error" : "success"} onClose={() => setMsg(null)} sx={{ mb: 2 }}>{msg.text}</Alert>}

      <FreshnessStrip competitorIds={f.competitors ? f.competitors.split(",") : undefined} />

      {/* KPI funnel — follows every filter below */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${cards.length}, 1fr)` }, gap: 1.25, mb: 2 }}>
        {cards.map(c => (
          <Card key={c.label} onClick={c.onClick} sx={{ border: "1px solid #e4e9f1", borderTop: `3px solid ${c.color}`, borderRadius: 2, cursor: c.onClick ? "pointer" : "default",
            bgcolor: c.active ? "#f3f7fa" : "#fff", outline: c.active ? `2px solid ${c.color}` : "none", transition: "background 0.15s", "&:hover": c.onClick ? { bgcolor: "#f6f8fa" } : {} }}>
            <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 }, textAlign: "center" }}>
              <Typography sx={{ fontSize: c.small ? "0.95rem" : "1.25rem", fontWeight: 800, color: c.color, lineHeight: 1.3 }}>{c.value}</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "#5d6b85", fontWeight: 700, textTransform: "uppercase" }}>{c.label}</Typography>
              {c.sub && <Typography sx={{ fontSize: "0.6rem", color: MUTED, mt: 0.2 }}>{c.sub}</Typography>}
            </CardContent>
          </Card>
        ))}
      </Box>

      {mode === "overview" && (
        <Card sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 2 }}>
          <Tabs value={f.tab} onChange={(_, v) => setF("tab", v)}
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: "0.78rem", fontWeight: 700, textTransform: "none" } }}
            TabIndicatorProps={{ sx: { bgcolor: NAVY, height: 3 } }}>
            <Tab value="" label={`All (${stats?.total?.toLocaleString("de-CH") ?? "—"})`} />
            <Tab value="human" label={`Approved by people (${stats?.approved_human?.toLocaleString("de-CH") ?? "—"})`} />
            <Tab value="auto" label={`Auto-approved (${stats?.approved_auto?.toLocaleString("de-CH") ?? "—"})`} />
            <Tab value="pending" label={`Pending (${stats?.pending?.toLocaleString("de-CH") ?? "—"})`} />
          </Tabs>
        </Card>
      )}

      <FilterBar right={<Chip label={`${total.toLocaleString("de-CH")} ${mode === "pending" ? "pending" : "matches"}`} size="small" sx={{ fontWeight: 700, bgcolor: "#e8f0f4", color: NAVY }} />}>
        <SearchFilter value={f.search} onChange={v => setF("search", v)} placeholder="Article, description, competitor ref…" />
        <SelectFilter label="Confidence" width={150} value={f.confidence} onChange={v => setF("confidence", v)}
          options={[...(mode === "overview" ? [{ value: "exact", label: "Exact (100%)" }] : []), { value: "close", label: "Very close (90-99%)" }, { value: "partial", label: "Partial (70-89%)" }]} />
        <SelectFilter label="New / extra" width={150} value={f.fresh} onChange={v => setF("fresh", v)}
          options={[{ value: "new", label: `New — last ${stats?.new_days ?? 14} days` }, { value: "extra", label: "Extra ref (article already approved)" }, { value: "new_or_extra", label: "New or extra ref" }]} />
        {mode === "overview" && (
          <SelectFilter label="Approved by" width={160} value={f.approvedBy} onChange={v => setF("approvedBy", v)}
            options={(stats?.approvers || []).map(a => ({ value: a.approved_by, label: `${personLabel(a.approved_by)} (${a.n.toLocaleString("de-CH")})` }))} />
        )}
        <SelectFilter label="Mandant" width={FW.mandant} value={f.mandant} onChange={v => setHier({ mandant: v, pc: "", ass: "", mg: "", sg: "", pg: "" })}
          options={[{ value: "M100", label: "M100" }, { value: "M110", label: "M110" }]} />
        <CompetitorFilter value={f.competitors} onChange={v => setF("competitors", v)} competitors={competitors} />
        {opts && (
          <>
            <TextFilter label="Profit Center" value={f.pc} options={opts.profit_centers || []} onChange={v => setHier({ pc: v, ass: "", mg: "", sg: "", pg: "" })} />
            <HierFilter label="Assortment" value={f.ass} options={opts.assortments || []} onChange={v => setHier({ ass: v, mg: "", sg: "", pg: "" })} />
            <HierFilter label="Main Group" value={f.mg} options={opts.main_groups || []} onChange={v => setHier({ mg: v, sg: "", pg: "" })} />
            <HierFilter label="Sub Group" value={f.sg} options={opts.sub_groups || []} onChange={v => setHier({ sg: v, pg: "" })} />
            <HierFilter label="Product Group" value={f.pg} options={opts.product_groups || []} onChange={v => setHier({ pg: v })} />
          </>
        )}
        <SelectFilter label="Sort" width={140} noAll value={f.sort} onChange={v => setF("sort", v)}
          options={[{ value: "confidence", label: "Confidence" }, { value: "newest", label: "Newest first" }, { value: "article", label: "Article" }, ...(mode === "overview" ? [{ value: "reviewed", label: "Last approved" }] : [])]} />
        <ClearFilters show={sf.active} onClick={() => { sf.reset(); setPage(0); setSelected(new Set()); }} />
      </FilterBar>

      {/* Selection / whole-filter actions */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, minHeight: 34, flexWrap: "wrap" }}>
        {selected.size > 0 ? (
          <>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: NAVY }}>{selected.size} selected</Typography>
            {selected.size - selApproved > 0 && <Button size="small" variant="contained" disableElevation disabled={busy} startIcon={<CheckCircleIcon />} onClick={() => approveIds([...selected].filter(id => !rows.find(r => r.id === id)?.approved))}
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: GOOD, "&:hover": { bgcolor: "#155d33" } }}>Approve {selected.size - selApproved}</Button>}
            {selApproved > 0 && <Button size="small" variant="outlined" disabled={busy} startIcon={<UndoIcon />} onClick={() => approveIds([...selected].filter(id => rows.find(r => r.id === id)?.approved), false)}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: "#c77700", color: "#c77700" }}>Back to pending {selApproved}</Button>}
            <Button size="small" variant="outlined" disabled={busy} startIcon={<DeleteIcon />} onClick={() => setReject({ ids: [...selected], reason: "" })}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: BAD, color: BAD }}>Reject {selected.size}</Button>
            <Button size="small" onClick={() => setSelected(new Set())} sx={{ textTransform: "none", color: MUTED }}>Clear selection</Button>
          </>
        ) : (
          <Typography sx={{ fontSize: "0.7rem", color: "#8b97ac" }}>Click a row for its detail · tick rows to decide several at once</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {mode === "pending" && (
          <>
            <Tooltip title={sf.active ? "" : "Set a filter first — these act on every pending match in the filter"} arrow>
              <span><Button size="small" variant="outlined" disabled={!sf.active || total === 0} startIcon={<FilterAltIcon />} onClick={e => setWholeAnchor(e.currentTarget)}
                sx={{ textTransform: "none", fontWeight: 700, borderColor: NAVY, color: NAVY }}>Whole filter ({total.toLocaleString("de-CH")})</Button></span>
            </Tooltip>
            <Menu anchorEl={wholeAnchor} open={!!wholeAnchor} onClose={() => setWholeAnchor(null)}>
              <MenuItem onClick={() => { setWholeAnchor(null); setWhole({ action: "approve", reason: "" }); }}><ListItemIcon><DoneAllIcon fontSize="small" sx={{ color: GOOD }} /></ListItemIcon><ListItemText primary={`Accept all ${total.toLocaleString("de-CH")}`} /></MenuItem>
              <MenuItem onClick={() => { setWholeAnchor(null); setWhole({ action: "reject", reason: "" }); }}><ListItemIcon><DeleteIcon fontSize="small" sx={{ color: BAD }} /></ListItemIcon><ListItemText primary={`Decline all ${total.toLocaleString("de-CH")}`} /></MenuItem>
              <MenuItem onClick={() => { setWholeAnchor(null); setWhole({ action: "disqualify", reason: "" }); }}><ListItemIcon><BlockIcon fontSize="small" sx={{ color: "#6d28d9" }} /></ListItemIcon><ListItemText primary="Disqualify — never suggest again" secondary="Product group × competitor" /></MenuItem>
            </Menu>
          </>
        )}
        <DetailModeToggle mode={detailMode} onChange={setDetailMode} />
      </Box>

      <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2 }}>
        {loading && <LinearProgress sx={{ height: 2, "& .MuiLinearProgress-bar": { bgcolor: NAVY } }} />}
        <TableContainer sx={{ maxHeight: "70vh" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={head}><Checkbox size="small" checked={allSel} indeterminate={selected.size > 0 && !allSel} onChange={toggleAll} /></TableCell>
                <TableCell sx={head}>Confidence</TableCell>
                <TableCell sx={head}>APSO article</TableCell>
                <TableCell sx={head}>Material / size</TableCell>
                <TableCell sx={head}>Competitor product</TableCell>
                <TableCell sx={head} align="right">APSO</TableCell>
                <TableCell sx={head} align="right">Competitor</TableCell>
                <TableCell sx={head} align="right">Diff</TableCell>
                <TableCell sx={head}>New / extra</TableCell>
                <TableCell sx={head}>{mode === "pending" ? "First seen" : "Qualified"}</TableCell>
                <TableCell sx={head} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={COLS} align="center" sx={{ py: 6, color: MUTED }}>{sf.active ? "No match in this filter." : "No matches yet."}</TableCell></TableRow>
              )}
              {rows.map(m => {
                const ap = apsoPriceFor(m);
                const ct = compTiers(m);
                const c1 = ct.tiers.find(t => t.qty <= 1)?.price ?? ct.tiers[0]?.price ?? null;
                const isOpen = openId === m.id;
                const a = m.apso_product;
                const size = a.diameter ? `Ø ${+Number(a.diameter).toFixed(2)}` : a.thickness ? `${+Number(a.thickness).toFixed(2)} mm` : "";
                return (
                  <React.Fragment key={m.id}>
                    <TableRow hover selected={selected.has(m.id) || isOpen} onClick={() => setOpenId(isOpen ? null : m.id)} sx={{ cursor: "pointer", "& td": { py: 0.6 } }}>
                      <TableCell padding="checkbox" onClick={e => e.stopPropagation()}><Checkbox size="small" checked={selected.has(m.id)} onChange={() => toggle(m.id)} /></TableCell>
                      <TableCell><ConfidenceCell m={m} /></TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: NAVY }}>{a.article_number}</Typography>
                        <Typography sx={{ fontSize: "0.68rem", color: "#4a5a70", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={(a.material || "—").toUpperCase().replace(/_/g, "-")} size="small" sx={{ fontSize: "0.58rem", height: 18, fontWeight: 700 }} />
                        {size && <Typography sx={{ fontSize: "0.66rem", color: MUTED, mt: 0.2 }}>{size}</Typography>}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Chip label={m.competitor_name} size="small" sx={{ fontSize: "0.58rem", height: 18, fontWeight: 700, bgcolor: "#fef7e0", color: "#854d0e" }} />
                          <Typography sx={{ fontSize: "0.64rem", fontFamily: "monospace", color: MUTED }}>{m.competitor_product.external_ref}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: "0.68rem", color: "#4a5a70", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.competitor_product.product_name}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700 }}>{ap?.perPiece != null ? fmtMoney(ap.perPiece) : "—"}</Typography>
                        {ap && <Typography sx={{ fontSize: "0.56rem", fontWeight: 800, whiteSpace: "nowrap", color: ap.fallback ? "#c77700" : "#8b97ac" }}>{ap.mandant} · {ap.ccy}/{ap.unit}</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: NAVY }}>{c1 != null ? fmtMoney(c1) : "—"}</Typography>
                        {c1 != null && <Typography sx={{ fontSize: "0.56rem", fontWeight: 800, whiteSpace: "nowrap", color: ct.converted ? "#8b97ac" : "#c77700" }}>{m.competitor_currency}/{ct.converted ? ap?.unit || "unit" : ct.unitRaw || "own unit"}</Typography>}
                      </TableCell>
                      <TableCell align="right"><DiffChip d={priceDiff(m)} /></TableCell>
                      <TableCell><ArrivalChips m={m} /></TableCell>
                      <TableCell>{mode === "pending" ? <Typography sx={{ fontSize: "0.68rem", color: MUTED, whiteSpace: "nowrap" }}>{fmtDate(m.created_at)}</Typography> : <QualifiedCell m={m} />}</TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        <Box sx={{ display: "flex", gap: 0.25, justifyContent: "center" }}>
                          {!m.approved
                            ? <Tooltip title="Approve" arrow><IconButton size="small" disabled={busy} onClick={() => approveIds([m.id])} sx={{ color: GOOD }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                            : <Tooltip title="Back to pending" arrow><IconButton size="small" disabled={busy} onClick={() => approveIds([m.id], false)} sx={{ color: "#c77700" }}><CancelIcon fontSize="small" /></IconButton></Tooltip>}
                          <Tooltip title="Reject with a reason" arrow><IconButton size="small" disabled={busy} onClick={() => setReject({ ids: [m.id], reason: "" })} sx={{ color: BAD }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {detailMode === "inline" && (
                      <RowDetail mode="inline" open={isOpen} onClose={() => setOpenId(null)} colSpan={COLS}>
                        <Box sx={{ bgcolor: "#f8f9fb" }}><MatchDetail m={m} /></Box>
                      </RowDetail>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => { setPage(p); setSelected(new Set()); }} rowsPerPage={PER_PAGE} rowsPerPageOptions={[PER_PAGE]} />
      </Card>

      {detailMode === "popup" && open && (
        <RowDetail mode="popup" open onClose={() => setOpenId(null)} colSpan={COLS}
          title={<>{open.apso_product.article_number} ↔ {open.competitor_name} {open.competitor_product.external_ref}</>}
          subtitle={`${open.apso_product.description} · ${open.competitor_product.product_name}`}
          onPrev={idx > 0 ? () => setOpenId(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => setOpenId(rows[idx + 1].id) : undefined}
          actions={
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {!open.approved
                ? <Button size="small" variant="contained" disableElevation disabled={busy} startIcon={<CheckCircleIcon />} onClick={() => approveIds([open.id])} sx={{ textTransform: "none", fontWeight: 700, bgcolor: GOOD, "&:hover": { bgcolor: "#155d33" } }}>Approve</Button>
                : <Button size="small" variant="contained" disableElevation disabled={busy} startIcon={<UndoIcon />} onClick={() => approveIds([open.id], false)} sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#c77700", "&:hover": { bgcolor: "#a86400" } }}>Back to pending</Button>}
              <Button size="small" variant="contained" disableElevation disabled={busy} startIcon={<DeleteIcon />} onClick={() => setReject({ ids: [open.id], reason: "" })} sx={{ textTransform: "none", fontWeight: 700, bgcolor: BAD, "&:hover": { bgcolor: "#a31515" } }}>Reject</Button>
            </Box>
          }>
          <MatchDetail m={open} />
        </RowDetail>
      )}

      {/* Reject with reason */}
      <Dialog open={!!reject} onClose={() => !busy && setReject(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: BAD, px: 2.5, py: 1.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, color: "#fff" }}>Reject {reject?.ids.length === 1 ? "match" : `${reject?.ids.length} matches`}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)" }}>Recorded as {me.name || me.email || "current user"}</Typography>
        </Box>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField autoFocus fullWidth multiline minRows={2} size="small" label="Why is it wrong? (optional)" placeholder="e.g. cast vs extruded, other hardness, wrong length…"
            value={reject?.reason || ""} onChange={e => setReject(r => (r ? { ...r, reason: e.target.value } : r))}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) rejectIds(); }} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setReject(null)} disabled={busy} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={busy} onClick={rejectIds} sx={{ textTransform: "none", fontWeight: 700, bgcolor: BAD, "&:hover": { bgcolor: "#a31515" } }}>Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Whole filter */}
      <Dialog open={!!whole} onClose={() => !busy && setWhole(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}>
        <Box sx={{ bgcolor: whole?.action === "approve" ? GOOD : whole?.action === "disqualify" ? "#6d28d9" : BAD, px: 2.5, py: 1.5 }}>
          <Typography sx={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, color: "#fff" }}>
            {whole?.action === "approve" ? "Accept" : whole?.action === "disqualify" ? "Disqualify" : "Decline"} all {total.toLocaleString("de-CH")} pending matches in this filter
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.85)" }}>Recorded as {me.name || me.email || "current user"}</Typography>
        </Box>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField fullWidth multiline minRows={2} size="small" label={whole?.action === "approve" ? "Note (optional)" : "Reason (optional)"}
            value={whole?.reason || ""} onChange={e => setWhole(w => (w ? { ...w, reason: e.target.value } : w))} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setWhole(null)} disabled={busy} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={busy} onClick={runWhole} sx={{ textTransform: "none", fontWeight: 700, bgcolor: NAVY }}>{busy ? "Working…" : "Confirm"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


