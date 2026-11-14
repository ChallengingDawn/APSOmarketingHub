"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import PersonIcon from "@mui/icons-material/Person";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import PageHeader from "../../PageHeader";
import { FilterBar, SearchFilter, SelectFilter, TextFilter, ClearFilters } from "../../Filters";
import { RowDetail, DetailModeToggle } from "../../RowDetail";
import { useSavedFilters, useDetailMode } from "@/lib/pricing/prefs";
import { API_URL, NAVY, MUTED, GOOD, fmtDateTime, fmtDate, personLabel } from "../MatchShared";

interface LogEntry {
  id: number; match_id: number | null; apso_article_number: string | null; apso_description: string | null; apso_product_type: string | null;
  competitor_code: string | null; competitor_name: string | null; competitor_ref: string | null; competitor_product_name: string | null;
  confidence_score: string | null; action: string; reason: string | null; user_email: string | null; user_name: string | null;
  actor: string; created_at: string; now_approved: boolean | null; now_confidence: string | null; now_approved_by: string | null; now_gone: boolean;
}
interface LogStats {
  total: number; first_at: string | null; last_at: string | null;
  by_action: { action: string; count: number }[];
  by_actor: { actor: string; name: string | null; count: number; approved: number; refused: number; last_at: string }[];
  by_competitor: { code: string; name: string | null; count: number }[];
  matches_now: { auto_approved: number; people_approved: number; pending: number };
}

const ACTIONS: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: "#e8f5e9", color: "#1b5e20", label: "Approved" },
  unapproved: { bg: "#fff3e0", color: "#b26a00", label: "Back to pending" },
  rejected: { bg: "#ffebee", color: "#c62828", label: "Rejected" },
  deleted: { bg: "#fbe9e7", color: "#8d1c1c", label: "Rejected (removed)" },
  disqualified: { bg: "#f3f0ff", color: "#6d28d9", label: "Disqualified" },
  manual: { bg: "#e3f2fd", color: "#1565c0", label: "Linked by hand" },
  updated: { bg: "#f1f3f4", color: "#5f6368", label: "Updated" },
};
const act = (a: string) => ACTIONS[a] || { bg: "#f1f3f4", color: MUTED, label: a };
const actorName = (actor: string, name?: string | null) => (actor === "system" ? "System" : name || personLabel(actor));
const DEFAULTS = { search: "", action: "", actor: "", competitor: "", from: "", to: "" };
const PER_PAGE = 50;

export default function LogsPage() {
  const sf = useSavedFilters("matches-logs", DEFAULTS);
  const f = sf.f;
  const [detailMode, setDetailMode] = useDetailMode();
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const params = () => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
    return p;
  };
  const key = JSON.stringify(f);
  useEffect(() => {
    if (!sf.ready) return;
    let alive = true;
    setLoading(true);
    const p = params(); p.set("page", String(page + 1)); p.set("per_page", String(PER_PAGE));
    fetch(`${API_URL}/api/matches/logs?${p}`).then(r => r.json()).then(j => { if (alive) { setRows(j.data || []); setTotal(j.total || 0); } })
      .catch(() => alive && setRows([])).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [sf.ready, key, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sf.ready) return;
    fetch(`${API_URL}/api/matches/logs/stats?${params()}`).then(r => r.json()).then(setStats).catch(() => {});
  }, [sf.ready, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setF = (k: keyof typeof DEFAULTS, v: string) => { sf.set(k, v); setPage(0); };
  const count = (a: string) => stats?.by_action.find(x => x.action === a)?.count ?? 0;
  const systemCount = stats?.by_actor.find(x => x.actor === "system")?.count ?? 0;
  const v = (n: number | undefined) => (n == null ? "—" : n.toLocaleString("de-CH"));
  const kpis = [
    { label: "Actions logged", value: v(stats?.total), color: NAVY },
    { label: "Approved", value: v(count("approved")), color: GOOD, onClick: () => setF("action", f.action === "approved" ? "" : "approved") },
    { label: "Rejected", value: v(count("rejected") + count("deleted")), color: "#c62828", onClick: () => setF("action", f.action === "rejected,deleted" ? "" : "rejected,deleted") },
    { label: "Disqualified", value: v(count("disqualified")), color: "#6d28d9", onClick: () => setF("action", f.action === "disqualified" ? "" : "disqualified") },
    { label: "By people", value: v((stats?.total ?? 0) - systemCount), color: GOOD, onClick: () => setF("actor", f.actor === "people" ? "" : "people") },
    { label: "By the system", value: v(systemCount), color: "#1565c0", onClick: () => setF("actor", f.actor === "system" ? "" : "system") },
    { label: "Auto-approved by the matcher", value: v(stats?.matches_now.auto_approved), color: "#1565c0", sub: "live matches, never logged" },
  ];
  const actorOpts = [{ value: "people", label: "People (all)" }, { value: "system", label: "System" },
    ...(stats?.by_actor || []).filter(a => a.actor !== "system").map(a => ({ value: a.actor, label: `${actorName(a.actor, a.name)} (${a.count.toLocaleString("de-CH")})` }))];
  const idx = rows.findIndex(r => r.id === openId);
  const open = idx >= 0 ? rows[idx] : null;
  const head = { fontWeight: 700, fontSize: "0.66rem", color: "#5f6368", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, bgcolor: "#f8f9fa" };

  const detail = (l: LogEntry) => (
    <Box sx={{ p: 1.75, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}>
      {[
        ["What", [["Action", act(l.action).label], ["When", fmtDateTime(l.created_at)], ["By", actorName(l.actor, l.user_name)], ["E-mail", l.user_email || "—"], ["Reason", l.reason || "—"], ["Confidence then", l.confidence_score != null ? `${Math.round(Number(l.confidence_score))}%` : "—"]]],
        ["APSO article", [["Article", l.apso_article_number || "—"], ["Description", l.apso_description || "—"], ["Type", l.apso_product_type || "—"]]],
        ["Competitor", [["Competitor", l.competitor_name || l.competitor_code || "—"], ["Ref", l.competitor_ref || "—"], ["Product", l.competitor_product_name || "—"],
          ["Match now", l.now_gone ? "Removed" : l.now_approved ? `Approved${l.now_approved_by ? ` · ${personLabel(l.now_approved_by)}` : " · auto"}` : "Pending"],
          ["Confidence now", l.now_confidence != null ? `${Math.round(Number(l.now_confidence))}%` : "—"]]],
      ].map(([title, lines]) => (
        <Card key={title as string} variant="outlined" sx={{ borderRadius: 2, borderColor: "#e3e7eb" }}>
          <Box sx={{ px: 1.5, py: 0.8, bgcolor: "#eef2f6" }}><Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>{title as string}</Typography></Box>
          <Box sx={{ px: 1.5, py: 0.6 }}>
            {(lines as string[][]).map(([k, val]) => (
              <Box key={k} sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, py: 0.35, borderBottom: "1px solid #f2f4f6" }}>
                <Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>{k}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: "#1a1d21", fontWeight: 600, textAlign: "right" }}>{val}</Typography>
              </Box>
            ))}
          </Box>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box>
      <PageHeader icon="logs" eyebrow="Product Matching" title="Approval Logs" subtitle="Every decision on a match — who, when, why, and where the match stands now"
        rightSlot={<Box sx={{ display: "flex", gap: 1 }}>
          <Button component={Link} href="/pricing/matches/pending" variant="outlined" size="small" sx={{ textTransform: "none", fontWeight: 700, borderColor: NAVY, color: NAVY }}>Pending Review</Button>
          <Button component={Link} href="/pricing/matches" variant="outlined" size="small" sx={{ textTransform: "none", fontWeight: 700, borderColor: "#5f6368", color: "#5f6368" }}>Match Overview</Button>
        </Box>} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${kpis.length}, 1fr)` }, gap: 1.25, mb: 2 }}>
        {kpis.map(k => (
          <Card key={k.label} onClick={k.onClick} sx={{ border: "1px solid #ececec", borderTop: `3px solid ${k.color}`, borderRadius: 2, cursor: k.onClick ? "pointer" : "default", "&:hover": k.onClick ? { bgcolor: "#f6f8fa" } : {} }}>
            <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 }, textAlign: "center" }}>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, color: k.color }}>{k.value}</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "#5f6368", fontWeight: 700, textTransform: "uppercase" }}>{k.label}</Typography>
              {k.sub && <Typography sx={{ fontSize: "0.58rem", color: MUTED }}>{k.sub}</Typography>}
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Who decided — people and the system, for the current filter */}
      {stats && stats.by_actor.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          {stats.by_actor.slice(0, 10).map(a => {
            const sys = a.actor === "system";
            const on = f.actor === a.actor;
            return (
              <Card key={a.actor} onClick={() => setF("actor", on ? "" : a.actor)} sx={{ cursor: "pointer", border: `1px solid ${on ? NAVY : "#ececec"}`, borderRadius: 2, px: 1.25, py: 0.75, display: "flex", alignItems: "center", gap: 1, bgcolor: on ? "#f3f7fa" : "#fff" }}>
                {sys ? <SmartToyOutlinedIcon sx={{ fontSize: 18, color: "#1565c0" }} /> : <PersonIcon sx={{ fontSize: 18, color: GOOD }} />}
                <Box sx={{ lineHeight: 1.2 }}>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1a1d21" }}>{actorName(a.actor, a.name)} · {a.count.toLocaleString("de-CH")}</Typography>
                  <Typography sx={{ fontSize: "0.62rem", color: MUTED }}>{a.approved.toLocaleString("de-CH")} approved · {a.refused.toLocaleString("de-CH")} refused · last {fmtDate(a.last_at)}</Typography>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <FilterBar right={<Chip label={`${total.toLocaleString("de-CH")} entries`} size="small" sx={{ fontWeight: 700, bgcolor: "#e8f0f4", color: NAVY }} />}>
        <SearchFilter value={f.search} onChange={x => setF("search", x)} placeholder="Article, ref, reason, person…" />
        <TextFilter label="Action" value={f.action} onChange={x => setF("action", x)} options={Object.keys(ACTIONS)} width={190} />
        <SelectFilter label="By" width={190} value={f.actor} onChange={x => setF("actor", x)} options={actorOpts} />
        <TextFilter label="Competitor" value={f.competitor} onChange={x => setF("competitor", x)} options={(stats?.by_competitor || []).map(c => c.code).filter(Boolean)} width={170} />
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={f.from} onChange={e => setF("from", e.target.value)} sx={{ width: 150 }} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={f.to} onChange={e => setF("to", e.target.value)} sx={{ width: 150 }} />
        <ClearFilters show={sf.active} onClick={() => { sf.reset(); setPage(0); }} />
      </FilterBar>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}><DetailModeToggle mode={detailMode} onChange={setDetailMode} /></Box>

      <Card sx={{ border: "1px solid #ececec", borderRadius: 2 }}>
        {loading && <LinearProgress sx={{ height: 2, "& .MuiLinearProgress-bar": { bgcolor: NAVY } }} />}
        <TableContainer sx={{ maxHeight: "68vh" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={head}>When</TableCell>
                <TableCell sx={head}>Action</TableCell>
                <TableCell sx={head}>APSO article</TableCell>
                <TableCell sx={head}>Competitor product</TableCell>
                <TableCell sx={head} align="right">Conf.</TableCell>
                <TableCell sx={head}>By</TableCell>
                <TableCell sx={head}>Reason</TableCell>
                <TableCell sx={head}>Match now</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: MUTED }}>No entry in this filter.</TableCell></TableRow>}
              {rows.map(l => {
                const a = act(l.action);
                const sys = l.actor === "system";
                const isOpen = openId === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <TableRow hover selected={isOpen} onClick={() => setOpenId(isOpen ? null : l.id)} sx={{ cursor: "pointer", "& td": { py: 0.6 } }}>
                      <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.7rem", color: MUTED }}>{fmtDateTime(l.created_at)}</TableCell>
                      <TableCell><Chip label={a.label} size="small" sx={{ height: 20, fontSize: "0.6rem", fontWeight: 800, bgcolor: a.bg, color: a.color }} /></TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: NAVY }}>{l.apso_article_number || "—"}</Typography>
                        <Typography sx={{ fontSize: "0.66rem", color: "#3c4043", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.apso_description || ""}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                          <Chip label={l.competitor_name || l.competitor_code || "—"} size="small" sx={{ height: 18, fontSize: "0.58rem", fontWeight: 700, bgcolor: "#fef7e0", color: "#854d0e" }} />
                          <Typography sx={{ fontSize: "0.64rem", fontFamily: "monospace", color: MUTED }}>{l.competitor_ref}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: "0.66rem", color: "#3c4043", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.competitor_product_name || ""}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.7rem", fontFamily: "monospace", fontWeight: 700 }}>{l.confidence_score != null ? `${Math.round(Number(l.confidence_score))}%` : "—"}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {sys ? <SmartToyOutlinedIcon sx={{ fontSize: 15, color: "#1565c0" }} /> : <PersonIcon sx={{ fontSize: 15, color: GOOD }} />}
                          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: sys ? "#1565c0" : "#1a1d21", whiteSpace: "nowrap" }}>{actorName(l.actor, l.user_name)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}><Typography sx={{ fontSize: "0.68rem", color: l.reason ? "#1a1d21" : "#bdc1c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason || "—"}</Typography></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: l.now_gone ? "#9aa1ab" : l.now_approved ? GOOD : "#b26a00" }}>
                          {l.now_gone ? "Removed" : l.now_approved ? "Approved" : "Pending"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {detailMode === "inline" && <RowDetail mode="inline" open={isOpen} onClose={() => setOpenId(null)} colSpan={8}><Box sx={{ bgcolor: "#f8f9fb" }}>{detail(l)}</Box></RowDetail>}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={PER_PAGE} rowsPerPageOptions={[PER_PAGE]} />
      </Card>

      {detailMode === "popup" && open && (
        <RowDetail mode="popup" open onClose={() => setOpenId(null)} colSpan={8} maxWidth="lg"
          title={`${act(open.action).label} · ${open.apso_article_number || "—"} ↔ ${open.competitor_name || open.competitor_code || ""} ${open.competitor_ref || ""}`}
          subtitle={`${actorName(open.actor, open.user_name)} · ${fmtDateTime(open.created_at)}`}
          onPrev={idx > 0 ? () => setOpenId(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => setOpenId(rows[idx + 1].id) : undefined}>
          {detail(open)}
        </RowDetail>
      )}
    </Box>
  );
}
