"use client";

// Website > A/B testing > PAGE TESTS (SARCLA 07.11.2026: "the approved idea goes to the A/B testing app"). A version of
// a shop page (APSOconvert's Preview) against the page as it is: a share of the visitors gets it - half and half, or
// more to the better one as results come in - and the add-to-carts decide (src/lib/convert/tests.ts, stats.ts). The
// tests with their figures. A test is made and started ONLY from Content's Page builder (SARCLA 14.11.2026: "Start test
// - don't allow from here, only from the content generator"): here they are watched, paused, stopped and decided.
// Webyn's tests as the shop sees them below (13.11.2026, ../xp/WebynTests.tsx).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago, usePaged } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { KIND_LABEL, type Env } from "@/lib/convert/model";
import { convertPost, previewHref } from "../../ai-personalization/Flow";
import WebynTests from "../xp/WebynTests";
import { testsBase, useInConvert } from "../../ai-personalization/base";
import { SquareChoice } from "../../ai-personalization/SquareChoice";
import {
  COLOR, GatewayNotice, StatusChip, VerdictChip, envChip, n, pct, recordHref, todoHref,
  type CandidateView, type GatewayView, type TestView,
} from "../../ai-personalization/TestParts";

const API = "/api/website/ab-testing/pages";
type Data = { tests: TestView[]; candidates: CandidateView[]; gateway: GatewayView; canEdit: boolean };
type Show = "live" | "draft" | "ended" | "all";
const since = (iso: string | null) => (iso ? ago(Date.parse(iso) / 1000) : "–");

export default function PageTests() {
  const router = useRouter();
  const base = testsBase(useInConvert());
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState<Show>("all");
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
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Not started yet" value={n(view.counts.draft)} note="started from Content's Page builder" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EmojiEventsOutlinedIcon />} tint="purple" label="The version won" value={n(view.decided + view.wins)} note={view.wins ? `${view.wins} to decide · ready in Winners` : "ready in Winners"} /></Grid>
        </Grid>

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
                A page test is made and started from Content&apos;s Page builder - a page&apos;s to-do, its A/B test section. An optimization
                gets there with Send to Content in the <Box component={Link} href="/website/ai-personalization/preview" sx={{ color: ACCENT, fontWeight: 600 }}>Preview</Box>.
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
                            {/* where it came from (13.11.2026: the loop as one product) - its Content to-do, else the AI's optimization */}
                            {t.origin?.todo
                              ? <Box component={Link} href={todoHref(t.origin.todo)} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ display: "inline-flex", mt: 0.5, textDecoration: "none" }}><Chip tint="purple">From Content · {t.origin.todo.title.slice(0, 48)}</Chip></Box>
                              : t.ideaId ? <Box sx={{ mt: 0.5 }}><Chip tint="blue">From an optimization</Chip></Box> : null}
                            <Box component={Link} href={recordHref(t.id)} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ display: "inline-flex", ml: 0.75, mt: 0.5, textDecoration: "none" }}><Chip tint="slate">Its record</Chip></Box>
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
