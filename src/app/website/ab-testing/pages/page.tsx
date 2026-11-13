"use client";

// Website > A/B testing > PAGE TESTS (SARCLA 07.11.2026: "the approved idea goes to the A/B testing app"). A version of
// a shop page (APSOconvert's Preview) against the page as it is: a share of the visitors gets it - half and half, or
// more to the better one as results come in - and the add-to-carts decide (src/lib/convert/tests.ts, stats.ts). The
// tests with their figures; "Start a test" from the approved versions still waiting for one. A test is made as a draft;
// starting it - on its own page - is the approval that puts the version on the shop. Webyn's tests as the shop sees them
// below (13.11.2026, ../xp/WebynTests.tsx).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago, usePaged } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { KIND_LABEL, type Env } from "@/lib/convert/model";
import { ANY_AUDIENCE } from "@/lib/convert/contract";
import { convertPost, previewHref } from "../../ai-personalization/Flow";
import WebynTests from "../xp/WebynTests";
import { testsBase, useInConvert } from "../../ai-personalization/base";
import { SquareChoice } from "../../ai-personalization/SquareChoice";
import {
  COLOR, GatewayNotice, PagePicker, StatusChip, VerdictChip, envChip, n, pct, splitOf,
  type CandidateView, type GatewayView, type SplitKey, type TestView,
} from "../../ai-personalization/TestParts";

const API = "/api/website/ab-testing/pages";
type Data = { tests: TestView[]; candidates: CandidateView[]; gateway: GatewayView; canEdit: boolean };
type Show = "live" | "draft" | "ended" | "all";
const since = (iso: string | null) => (iso ? ago(Date.parse(iso) / 1000) : "–");

function CreateDialog({ c, onClose }: { c: CandidateView | null; onClose: () => void }) {
  const router = useRouter();
  const base = testsBase(useInConvert());
  const [name, setName] = useState("");
  const [env, setEnv] = useState<Env>("acc");
  const [pages, setPages] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitKey>("half");
  const [floor, setFloor] = useState("10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = !!c;
  // a new version opened: start from its idea's title, on ACC
  useEffect(() => { if (c) { setName(c.title); setPages([]); setEnv("acc"); setErr(null); setSplit("half"); } }, [c]);
  const make = async () => {
    if (!c) return;
    setBusy(true); setErr(null);
    const r = await convertPost<{ id: string }>(API, { action: "create", versionId: c.versionId, env, pages, name, allocation: splitOf(split, Number(floor)), audience: ANY_AUDIENCE });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push(`${base}/${r.data.id}`);
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "18px", m: { xs: 1.5, sm: 4 }, width: { xs: "calc(100% - 24px)", sm: undefined } } } }}>
      {c && (
        <>
          <DialogTitle sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, pb: 0.5 }}>A test of this version</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 1.75, pt: "8px !important" }}>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
              It is made as a draft - nothing reaches the shop until somebody starts it on its own page. {c.summary}
            </Typography>
            <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 200 }} />
            <SquareChoice<Env> label="Where" value={env} onChange={(e) => { setEnv(e); setPages([]); }} options={[{ key: "acc", label: "ACC first" }, { key: "prod", label: "Production" }]} />
            <PagePicker api={API} versionId={c.versionId} env={env} value={pages} onChange={setPages} />
            <SquareChoice<SplitKey> label="Visitors" value={split} onChange={setSplit} options={[{ key: "half", label: "Half and half" }, { key: "30", label: "30% get it" }, { key: "bandit", label: "More to the better one" }]} />
            {split === "bandit" && (
              <SquareChoice label="Each keeps at least" value={floor} onChange={setFloor} options={[{ key: "5", label: "5%" }, { key: "10", label: "10%" }, { key: "20", label: "20%" }]} />
            )}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
              {split === "bandit"
                ? "Starts half and half; every ten minutes the shop's gateway gives more visitors to the one doing better, never less than the floor to either."
                : "A visitor keeps the variant they got. The goal is the add-to-cart on the page."}
            </Typography>
            {err && <Notice tone="bad">{err}</Notice>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="contained" disableElevation onClick={() => void make()} disabled={busy || !name.trim()}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>Make the draft</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

export default function PageTests() {
  const router = useRouter();
  const base = testsBase(useInConvert());
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState<Show>("all");
  const [making, setMaking] = useState<CandidateView | null>(null);
  const url = `${API}?n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const view = useMemo(() => {
    const all = d?.tests ?? [];
    const is = (t: TestView, s: Show) => s === "all" || (s === "live" ? t.status === "running" || t.status === "paused" : s === "draft" ? t.status === "draft" : t.status === "stopped" || t.status === "shipped");
    return {
      rows: all.filter((t) => is(t, show)),
      counts: { live: all.filter((t) => is(t, "live")).length, draft: all.filter((t) => is(t, "draft")).length, ended: all.filter((t) => is(t, "ended")).length, all: all.length },
      running: all.filter((t) => t.status === "running"),
      visitors: all.filter((t) => t.status === "running" || t.status === "paused").reduce((s, t) => s + (t.figures?.counted ? t.figures.a.visitors + t.figures.b.visitors : 0), 0),
      counted: all.some((t) => t.figures?.counted),
      decided: all.filter((t) => t.winner === "b" && t.status !== "shipped").length,
      wins: all.filter((t) => t.winner === null && t.figures?.verdict?.key === "b-wins").length,
    };
  }, [d, show]);
  const { slice, pager } = usePaged(view.rows, 20);
  // /website/ab-testing/pages?make=<versionId> opens the dialog for that version (the Preview's "Test it")
  const [asked, setAsked] = useState<string | null>(null);
  useEffect(() => { const m = new URLSearchParams(window.location.search).get("make"); if (m && /^\d+$/.test(m)) setAsked(m); }, []);
  useEffect(() => {
    if (!asked || !d) return;
    const c = d.candidates.find((x) => x.versionId === asked);
    if (c) setMaking(c);
    setAsked(null);
  }, [asked, d]);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tests…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Page tests" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  else {
    const data = r.data;
    body = (
      <>
        <GatewayNotice g={data.gateway} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PlayCircleOutlineIcon />} tint="green" label="Running now" value={n(view.running.length)} note={view.counts.live > view.running.length ? `${view.counts.live - view.running.length} paused` : "on the shop's pages"} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="blue" label="Visitors in them" value={data.gateway.configured && (view.counted || !view.counts.live) ? n(view.visitors) : "—"} note={!data.gateway.configured ? "the gateway is not connected" : view.counted || !view.counts.live ? "with statistics consent, this round" : "not read from the gateway"} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Waiting for a test" value={n(data.candidates.length)} note="approved versions without one" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EmojiEventsOutlinedIcon />} tint="purple" label="The version won" value={n(view.decided + view.wins)} note={view.wins ? `${view.wins} to decide · ready in Winners` : "ready in Winners"} /></Grid>
        </Grid>

        {data.candidates.length > 0 && (
          <GlassCard>
            <CardTitle icon={<AddCircleOutlineIcon />} tint="amber" title={`Start a test · ${data.candidates.length}`} note="Approved versions waiting for a test - each is made as a draft first" />
            <Box sx={{ display: "grid", gap: 0.75 }}>
              {data.candidates.slice(0, 12).map((c) => (
                <Box key={c.versionId} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) auto" }, gap: 1, alignItems: "center", px: 1.25, py: 1, borderRadius: "12px", bgcolor: "rgba(255,255,255,.6)", border: "1px solid rgba(21,34,58,.06)" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, ...clip(900) }}>{c.title}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", mt: 0.25, minWidth: 0 }}>
                      <Chip tint="slate">{KIND_LABEL[c.kind]}</Chip>
                      <Typography sx={{ fontSize: "0.76rem", color: MUTED, ...clip(520) }} title={c.path}>{c.path}</Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>rev {c.rev}{c.approvedBy ? ` · approved by ${c.approvedBy}` : ""} · {since(c.approvedAt)}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
                    <Button size="small" component={Link} href={previewHref(c.env, c.path, c.ideaId)}>See it</Button>
                    {data.canEdit && <Button size="small" variant="contained" disableElevation onClick={() => setMaking(c)}>Make a test</Button>}
                  </Box>
                </Box>
              ))}
              {data.candidates.length > 12 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>and {data.candidates.length - 12} more - every one on <Box component={Link} href="/website/ai-personalization/ideas" sx={{ color: "#2459d1", fontWeight: 600 }}>the optimizations board</Box> (column &quot;Ready to test&quot;).</Typography>}
            </Box>
          </GlassCard>
        )}

        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.5 }}>
            <CardTitle icon={<ScienceOutlinedIcon />} tint="pink" title={`Tests · ${n(view.rows.length)}`}
              note="Each figure: the page as it is · the version (in blue). Cart rate = visitors who put something in the cart on the page; version better = how likely it is the better one" />
            <SquareChoice<Show> label="Show" value={show} onChange={setShow} options={[
              { key: "all", label: "All", count: view.counts.all }, { key: "live", label: "Running or paused", count: view.counts.live },
              { key: "draft", label: "Not started", count: view.counts.draft }, { key: "ended", label: "Ended", count: view.counts.ended },
            ]} />
          </Box>
          {data.tests.length === 0 ? (
            <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2.5, pt: 1.5 }}>
              <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>No page test yet.</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
                {data.candidates.length
                  ? "Make one from an approved version above."
                  : <>A test starts from an approved version: open a page in the <Box component={Link} href="/website/ai-personalization/preview" sx={{ color: ACCENT, fontWeight: 600 }}>Preview</Box>, approve an idea, let the AI write its version and approve it.</>}
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ overflowX: "auto", mt: 1.5 }}>
                <Table size="small" sx={{ minWidth: 1040 }}>
                  <TableHead>
                    <TableRow>{["Status", "Test", "Version", "Visitors", "Cart rate", "Version better", "So far", "Days"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i >= 3 && i !== 6 ? "right" : "left" }}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {slice.length === 0 && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>None here.</TableCell></TableRow>}
                    {slice.map((t) => {
                      const f = t.figures?.counted ? t.figures : null;
                      const err = t.figures?.error ?? null;
                      return (
                        <TableRow key={t.id} hover onClick={() => router.push(`${base}/${t.id}`)} sx={{ cursor: "pointer" }}>
                          <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><StatusChip status={t.status} kind={t.kind} />{t.drift && <Box sx={{ mt: 0.5 }}><Chip tint="pink">{t.drift === "missing" ? "Not on the gateway" : "Gateway behind"}</Chip></Box>}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                            <Box sx={{ ...clip(320), fontWeight: 700, color: INK }} title={t.name}>{t.name}</Box>
                            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mt: 0.25 }}>
                              {envChip(t.env)}
                              <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(260) }} title={t.pages.join("\n")}>{t.pages[0]}{t.pages.length > 1 ? ` +${t.pages.length - 1}` : ""}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>rev {t.versionRev} · {t.changeCount} {t.changeCount === 1 ? "change" : "changes"}<br />{t.allocation.mode === "bandit" ? "more to the better" : t.allocation.split.b === 50 ? "half and half" : `${t.allocation.split.b}% get it`}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{f ? <>{n(f.a.visitors)} · <b style={{ color: COLOR.b }}>{n(f.b.visitors)}</b></> : "–"}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{f ? <>{pct(f.a.rate, 1)} / <b style={{ color: COLOR.b }}>{pct(f.b.rate, 1)}</b></> : "–"}</TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{f?.pB === null || f?.pB === undefined ? "–" : pct(f.pB, 0)}</TableCell>
                          <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                            {t.status === "draft" ? <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>Not started</Typography>
                              : t.winner ? <Chip tint={t.winner === "b" ? "green" : "slate"}>{t.winner === "b" ? "Decided: the version won" : t.winner === "a" ? "Decided: the original" : "Decided: no difference"}</Chip>
                              : <VerdictChip v={f?.verdict} />}
                            {err && <Tooltip title={err}><Typography component="span" sx={{ display: "block", fontSize: "0.7rem", color: MUTED, mt: 0.25 }}>{f?.at ? `as of ${since(f.at)}` : "not read"}</Typography></Tooltip>}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f ? n(f.days) : "–"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
              {pager}
            </>
          )}
        </GlassCard>
        <CreateDialog c={making} onClose={() => setMaking(null)} />
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title={base.startsWith("/website/ai-personalization") ? "Tests" : "Page tests"}
        subtitle="A version of a shop page against the page as it is: a share of the visitors gets it, the add-to-carts decide"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {base.startsWith("/website/ai-personalization") && (
              <Button variant="contained" disableElevation size="small" onClick={() => router.push("/website/ai-personalization/tests/new")} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Create an optimization</Button>
            )}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {body}
      <WebynTests />
    </Box>
  );
}
