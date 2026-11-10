"use client";

// Website > Journeys > MAIN JOURNEYS (SARCLA 08.11.2026: "you should be able to visually display journeys, analyse the
// main journeys"; 09.11.2026: "The main journeys are to complete"). How visitors go through the shop, COMPLETE: from the
// way in to the order, or to the page where they leave - the journeys that end in an order beside the ones that end
// lost, each a row of steps (a step is one kind of page, one page of it or more) with its visits and share. A journey is
// shown as its pages look, and opens as a funnel or in Page flow. Below: where they leave, where they come in, the flow
// drawn column by column, the most viewed pages of each kind. Store view (all 14), device and period kept in the
// address; the figures against the period before. Built from Google Analytics' page-to-page steps, chained - the pages
// say so; the visits, carts and orders of the tiles and the ways in are its own counts (src/lib/journeys/read.ts).

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, TRACK } from "@/app/uc/report/ui";
import { usePaged } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { journeysBase, useInConvert } from "@/app/website/ai-personalization/base";
import { FLOW_KINDS, KIND_COLOR, KIND_NAME, KIND_ON, journeyWords, type FlowKind, type JKind, type Journey } from "@/lib/journeys/model";
import type { JourneysData } from "@/lib/journeys/read";
import { JourneyFlowChart, KindLegend, KindTag, NextBar, pct } from "./parts";
import { ChoiceBar, jqs, useJQuery, type JQuery } from "./controls";

const linkSx = { color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
const btnSx = { borderRadius: "6px", textTransform: "none", fontWeight: 700, boxShadow: "none", whiteSpace: "nowrap" } as const;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** The shop's functions are drawn as tiles, the pages as they look. */
const FUNCTION_KINDS = new Set<JKind>(["search", "cart", "checkout", "order", "account", "other"]);

/** A journey's tokens as a funnel: the way in first when there is room. */
const funnelOf = (j: Journey) => (j.kinds.length < 6 ? ["in", ...j.kinds] : j.kinds.slice(0, 6));

/* ── the journeys ─────────────────────────────────────────────────────── */

function Steps({ j }: { j: Journey }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.6, rowGap: 0.5, minWidth: 0 }} aria-label={journeyWords(j)}>
      {j.kinds.map((k, i) => (
        <Box key={i} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
          {i > 0 && <Box component="span" aria-hidden sx={{ color: FAINT, fontSize: "0.8rem" }}>→</Box>}
          <KindTag kind={k} />
        </Box>
      ))}
      {j.end === "left" && (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
          <Box component="span" aria-hidden sx={{ color: FAINT, fontSize: "0.8rem" }}>→</Box>
          <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 800, color: RED, border: "1px solid rgba(197,34,31,.35)", bgcolor: "rgba(197,34,31,.06)", borderRadius: "3px", px: 0.6, lineHeight: 1.5 }}>LEFT</Box>
        </Box>
      )}
    </Box>
  );
}

function JourneyList({ rows, side, sel, onSel, total, orders }: {
  rows: Journey[]; side: "won" | "lost"; sel: number | null; onSel: (i: number) => void; total: number; orders: number;
}) {
  const max = Math.max(1e-9, ...rows.map((r) => r.visits));
  const tone = side === "won" ? GREEN : RED;
  if (!rows.length) {
    return <Typography sx={{ fontSize: "0.86rem", color: MUTED, py: 1 }}>{side === "won" ? "No journey reached an order in this period." : "No way out of the shop has enough visits."}</Typography>;
  }
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {rows.map((j, i) => {
        const on = sel === i;
        return (
          <Box key={i} component="button" type="button" onClick={() => onSel(i)} aria-pressed={on} sx={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", columnGap: 1, rowGap: 0.75,
            px: 1.25, py: 1.1, borderRadius: "8px", border: `1px solid ${on ? tone : "transparent"}`, bgcolor: on ? (side === "won" ? "rgba(27,122,85,.06)" : "rgba(197,34,31,.05)") : "transparent",
            "&:hover": { bgcolor: side === "won" ? "rgba(27,122,85,.05)" : "rgba(197,34,31,.04)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
          }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: on ? tone : FAINT, fontVariantNumeric: "tabular-nums", pt: "2px" }}>{i + 1}</Typography>
            <Steps j={j} />
            <Box />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", minWidth: 0 }}>
              <Box sx={{ flex: "1 1 120px", maxWidth: 260, height: 8, borderRadius: "3px", bgcolor: TRACK, overflow: "hidden" }}>
                <Box sx={{ height: "100%", width: `${(j.visits / max) * 100}%`, bgcolor: tone, opacity: 0.75 }} />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                <Box component="span" sx={{ color: INK, fontWeight: 750 }}>{full(j.visits)}</Box> visits · {pct(j.visits / Math.max(1, total))} of all
                {side === "won" && orders > 0 && <> · <Box component="span" sx={{ color: GREEN, fontWeight: 700 }}>{pct(j.visits / orders)} of the orders</Box></>}
                {side === "lost" && j.cart > 0 && <> · <Box component="span" sx={{ color: "#e2672b", fontWeight: 700 }}>had been to the cart</Box></>}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** The chosen journey as visitors see it: each step's most viewed page of its kind, as it looks; the shop's functions as tiles. */
function JourneySeen({ j, pages, jb, q }: { j: Journey; pages: JourneysData["pages"]; jb: string; q: JQuery }) {
  const steps = j.kinds.map((k) => ({ kind: k, page: FUNCTION_KINDS.has(k) ? null : (pages[k] ?? [])[0] ?? null }));
  const firstPage = steps.find((s) => s.page)?.page ?? (pages[j.kinds[0]] ?? [])[0] ?? null;
  const tile = (k: FlowKind, label: string, sub: string) => (
    <Box sx={{ aspectRatio: "1.6", borderRadius: "10px", display: "grid", placeItems: "center", textAlign: "center", p: 1, bgcolor: `${KIND_COLOR[k]}18`, border: `1px solid ${KIND_COLOR[k]}55` }}>
      <Box><Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: INK }}>{label}</Typography><Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{sub}</Typography></Box>
    </Box>
  );
  // at least five columns: a short journey keeps its pictures at the same size as a long one
  const cols = Math.max(5, steps.length + 1);
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Box sx={{ display: "grid", gap: 1.25, alignItems: "start", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))", lg: `repeat(${cols}, minmax(0,1fr))` } }}>
        {steps.map((st, i) => (
          <Box key={i} sx={{ display: "grid", gap: 0.6, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT }}>{i === 0 ? "CAME IN" : `STEP ${i + 1}`}</Typography>
              <KindTag kind={st.kind} />
            </Box>
            {st.page
              ? <Box component={Link} href={previewHref("prod", st.page.path)} title={`${st.page.name} - open it in the Preview`} sx={{ display: "block", borderRadius: "10px", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
                  <PageShot env="prod" path={st.page.path} ratio={0.62} label={st.page.name} />
                </Box>
              : tile(st.kind, KIND_NAME[st.kind], st.kind === "order" ? "the order is placed" : "a shop function")}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, overflowWrap: "anywhere" }}>{st.page ? <>e.g. <Box component="span" sx={{ color: INK, fontWeight: 600 }}>{st.page.name}</Box></> : " "}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "grid", gap: 0.6, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT }}>THEN</Typography>
          {j.end === "left"
            ? tile("left", "They leave", `${full(j.visits)} visits end here`)
            : <Box sx={{ aspectRatio: "1.6", borderRadius: "10px", display: "grid", placeItems: "center", textAlign: "center", p: 1, bgcolor: "rgba(27,122,85,.10)", border: "1px solid rgba(27,122,85,.35)" }}>
                <Box><Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: GREEN }}>Ordered</Typography><Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{full(j.visits)} visits</Typography></Box>
              </Box>}
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Button size="small" variant="contained" disableElevation component={Link} href={`${jb}/funnel${jqs(q, { step: funnelOf(j) })}`} startIcon={<FilterAltOutlinedIcon />} sx={btnSx}>See it as a funnel</Button>
        {firstPage && <Button size="small" variant="outlined" component={Link} href={`${jb}/page${jqs(q, { path: firstPage.path })}`} startIcon={<CompareArrowsOutlinedIcon />} sx={btnSx}>Walk it in Page flow</Button>}
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Each step shows the most viewed page of its kind{q.store ? ` in ${q.store}` : ""}.</Typography>
      </Box>
    </Box>
  );
}

/* ── where they leave, where they come in ─────────────────────────────── */

function BarRow({ kind, label, value, share, note, onClick, on }: { kind: FlowKind; label?: string; value: string; share: number; note?: React.ReactNode; onClick?: () => void; on?: boolean }) {
  return (
    <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} sx={{
      all: "unset", cursor: onClick ? "pointer" : "default", boxSizing: "border-box", display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) auto", sm: "150px minmax(0,1fr) auto" },
      columnGap: 1.5, rowGap: 0.5, alignItems: "center", px: 1, py: 0.9, borderRadius: "8px", bgcolor: on ? "rgba(36,89,209,.07)" : "transparent",
      "&:hover": onClick ? { bgcolor: "rgba(36,89,209,.05)" } : {}, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
    }}>
      <KindTag kind={kind} label={label} />
      <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, gridRow: { xs: 2, sm: "auto" }, display: "grid", gap: 0.4, minWidth: 0 }}>
        <Box sx={{ height: 10, borderRadius: "3px", bgcolor: TRACK, overflow: "hidden" }}>
          <Box sx={{ height: "100%", width: `${Math.min(1, share) * 100}%`, bgcolor: KIND_COLOR[kind], opacity: 0.85 }} />
        </Box>
        {note && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{note}</Typography>}
      </Box>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{value}</Typography>
    </Box>
  );
}

/* ── the most viewed pages of a kind ──────────────────────────────────── */

function KindPages({ data, kind, setKind, jb, q }: { data: JourneysData; kind: JKind; setKind: (k: JKind) => void; jb: string; q: JQuery }) {
  const rows = data.pages[kind] ?? [];
  const { slice, pager, setPage } = usePaged(rows, 10);
  useEffect(() => { setPage(0); }, [kind, setPage]);
  const options = (FLOW_KINDS.filter((k) => k !== "left") as JKind[]).filter((k) => (data.pages[k]?.length ?? 0) > 0).map((k) => ({ key: k, label: KIND_NAME[k] }));
  return (
    <GlassCard>
      <CardTitle icon={<ListAltOutlinedIcon />} tint="slate" title={`The most viewed pages · ${KIND_NAME[kind]}`}
        note="Where each page's visitors went next and how many left - a page opens its flow" />
      <Box sx={{ mb: 1.5 }}><SquareChoice<JKind> label="Kind" value={kind} onChange={setKind} options={options} /></Box>
      {slice.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No page of this kind in this period.</Typography>}
      <Box sx={{ display: "grid" }}>
        {slice.length > 0 && (
          <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0,1fr) 90px 100px 240px 80px 150px", columnGap: 2, pb: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
            {["Page", "Views", "Came in here", "Went next", "Left here", ""].map((h, i) => (
              <Typography key={i} sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".05em", textAlign: i === 1 || i === 2 || i === 4 ? "right" : "left" }}>{h}</Typography>
            ))}
          </Box>
        )}
        {slice.map((p) => (
          <Box key={p.path} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) 90px 100px 240px 80px 150px" }, columnGap: 2, rowGap: 0.75, alignItems: "center", py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ minWidth: 0 }}>
              <Box component={Link} href={`${jb}/page${jqs(q, { path: p.path })}`} sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK, textDecoration: "none", overflowWrap: "anywhere", "&:hover": { color: ACCENT } }}>{p.name}</Box>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflowWrap: "anywhere" }}>{p.path}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.86rem", fontVariantNumeric: "tabular-nums", textAlign: { md: "right" }, color: INK }}>{full(p.views)}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> views</Box></Typography>
            <Typography sx={{ fontSize: "0.86rem", fontVariantNumeric: "tabular-nums", textAlign: { md: "right" }, color: p.entries ? INK : FAINT }}>{p.entries ? full(p.entries) : "–"}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> came in here</Box></Typography>
            <Box sx={{ minWidth: 0 }}>
              <NextBar next={p.next} left={p.left} />
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.4 }}>
                {p.next.length ? p.next.slice(0, 2).map((n) => `${pct(n.share)} ${KIND_NAME[n.kind].toLowerCase()}`).join(" · ") : "no next page recorded"}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "0.86rem", fontVariantNumeric: "tabular-nums", textAlign: { md: "right" }, color: INK }}>{pct(p.left)}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> left here</Box></Typography>
            <Box sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              <Box component={Link} href={`${jb}/page${jqs(q, { path: p.path })}`} sx={linkSx}>Page flow</Box>
              <Box component="span" sx={{ color: FAINT }}> · </Box>
              <Box component={Link} href={previewHref("prod", p.path)} sx={linkSx}>Preview</Box>
            </Box>
          </Box>
        ))}
      </Box>
      {pager}
    </GlassCard>
  );
}

/* ── the page ─────────────────────────────────────────────────────────── */

function MainJourneysInner() {
  const jb = journeysBase(useInConvert());
  const { q, set } = useJQuery();
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [pick, setPick] = useState<{ side: "won" | "lost"; i: number } | null>(null);
  const [kind, setKind] = useState<JKind | null>(null);
  // three views, one at a time (SARCLA 10.11.2026: "main journeys needs to be split to bring more clarity, as the
  // current funnel which I really like")
  const [view, setView] = useState<"journeys" | "inout" | "flow">("journeys");
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const url = `/api/website/journeys?from=${win.from}&to=${win.to}${q.store ? `&store=${q.store}` : ""}${q.device ? `&device=${q.device}` : ""}&n=${tick}`;
  const held = useHeld<JourneysData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  useEffect(() => { setPick(null); }, [url]);

  const shown = useMemo(() => {
    if (!d) return [] as FlowKind[];
    const present = new Set(d.flow.nodes.map((n) => n.kind));
    return FLOW_KINDS.filter((k) => present.has(k));
  }, [d]);
  const drill: JKind | null = kind ?? d?.leaves[0]?.kind ?? d?.entries[0]?.kind ?? null;
  const openKind = (k: JKind) => {
    setKind(k);
    setTimeout(() => pagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the steps between the pages from Google Analytics…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="Google Analytics" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Google Analytics" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const data = r.data;
    const t = data.totals;
    const b = data.before?.totals ?? null;
    const versus = data.before ? `${day(data.before.from)} – ${day(data.before.to)}` : "";
    const ratio = (now: number, was: number) => (was > 0 ? now / was - 1 : null);
    const rate = (n: number, of: number) => (of > 0 ? n / of : 0);
    const top = data.entries[0] ?? null;
    const J = data.journeys;
    const sel = pick ?? (J.won.length ? { side: "won" as const, i: 0 } : J.lost.length ? { side: "lost" as const, i: 0 } : null);
    const chosen = sel ? (sel.side === "won" ? J.won : J.lost)[sel.i] ?? null : null;
    const leaving = data.leaves.reduce((a, x) => a + x.visits, 0);
    body = (
      <>
        {data.ga4.truncatedSteps && <Notice tone="warn">Google Analytics gave the {full(data.ga4.stepRows)} most viewed page-to-page steps only - the rarest are missing from the journeys.</Notice>}
        {data.ga4.truncatedLanding && <Notice tone="warn">Google Analytics gave the most visited landing pages only - the rarest ways in are missing.</Notice>}
        {t.visits === 0 && <Notice tone="warn">Google Analytics has no visits in this period{data.store ? ` in ${data.store}` : ""}{data.device ? " on this device" : ""}.</Notice>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="blue" label="Visits" value={full(t.visits)}
            delta={b ? { ratio: ratio(t.visits, b.visits), versus } : undefined} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LoginOutlinedIcon />} tint="purple" label="Main way in" value={top ? KIND_NAME[top.kind] : "—"}
            note={top ? `${pct(top.sessions / Math.max(1, t.visits))} of the visits start ${KIND_ON[top.kind]}` : undefined} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="amber" label="Put something in the cart" value={t.visits ? pct(rate(t.carts, t.visits)) : "—"}
            note={`${full(t.carts)} of the visits`} delta={b ? { ratio: ratio(rate(t.carts, t.visits), rate(b.carts, b.visits)), versus } : undefined} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingBagOutlinedIcon />} tint="green" label="Ordered" value={t.visits ? pct(rate(t.orders, t.visits)) : "—"}
            note={`${full(t.orders)} of the visits · ${full(t.transactions)} orders`} delta={b ? { ratio: ratio(rate(t.orders, t.visits), rate(b.orders, b.visits)), versus } : undefined} /></Grid>
        </Grid>

        {t.visits > 0 && (
          <SquareChoice<"journeys" | "inout" | "flow"> label="Show" value={view} onChange={setView} options={[
            { key: "journeys", label: `The journeys · ${J.won.length + J.lost.length}` },
            { key: "inout", label: "Ways in & out" },
            { key: "flow", label: "Page after page" },
          ]} />
        )}

        {t.visits > 0 && view === "journeys" && (
          <GlassCard>
            <CardTitle icon={<RouteOutlinedIcon />} tint="blue" title="The main journeys"
              note={`From the way in to the order, or to where they leave - up to ${J.depth} steps, a step being one kind of page. Built from page-to-page steps.`} />
            <Grid container spacing={{ xs: 2, lg: 3 }}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", columnGap: 1, rowGap: 0.25, flexWrap: "wrap", mb: 1, pb: 1, borderBottom: `2px solid ${GREEN}` }}>
                  <Typography sx={{ fontSize: "0.98rem", fontWeight: 750, color: GREEN }}>End in an order</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{pct(J.orders / Math.max(1, J.total))} of the visits · {full(J.orders)} orders by these steps</Typography>
                </Box>
                <JourneyList rows={J.won} side="won" sel={sel?.side === "won" ? sel.i : null} onSel={(i) => setPick({ side: "won", i })} total={J.total} orders={J.orders} />
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", columnGap: 1, rowGap: 0.25, flexWrap: "wrap", mb: 1, pb: 1, borderBottom: `2px solid ${RED}` }}>
                  <Typography sx={{ fontSize: "0.98rem", fontWeight: 750, color: RED }}>End lost</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{pct(1 - J.orders / Math.max(1, J.total))} of the visits leave without an order</Typography>
                </Box>
                <JourneyList rows={J.lost} side="lost" sel={sel?.side === "lost" ? sel.i : null} onSel={(i) => setPick({ side: "lost", i })} total={J.total} orders={J.orders} />
              </Grid>
            </Grid>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.5 }}>
              The journeys listed are {pct(J.covered)} of the visits; the rest go rarer ways. Click a journey to see it.
            </Typography>
          </GlassCard>
        )}

        {t.visits > 0 && view === "journeys" && chosen && (
          <GlassCard sx={{ borderTop: `3px solid ${chosen.end === "order" ? GREEN : RED}` }}>
            <CardTitle icon={<SlideshowOutlinedIcon />} tint={chosen.end === "order" ? "green" : "pink"}
              title={`${sel?.side === "won" ? "Ordered" : "Lost"} · journey ${(sel?.i ?? 0) + 1}: ${journeyWords(chosen)}`}
              note={`${full(chosen.visits)} visits, ${pct(chosen.share)} of all`} />
            <JourneySeen j={chosen} pages={data.pages} jb={jb} q={q} />
          </GlassCard>
        )}

        {t.visits > 0 && view === "inout" && (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<LogoutOutlinedIcon />} tint="pink" title="Where they leave"
                  note="The last page before they left the shop, by kind - a kind opens its pages" />
                <Box sx={{ display: "grid", gap: 0.25 }}>
                  {data.leaves.map((l) => (
                    <BarRow key={l.kind} kind={l.kind} value={pct(l.share)} share={l.share} on={kind === l.kind} onClick={() => openKind(l.kind)}
                      note={`${full(l.visits)} visits left from ${KIND_NAME[l.kind].toLowerCase()} pages`} />
                  ))}
                  {!data.leaves.length && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No visit left the shop in this period.</Typography>}
                </Box>
                {leaving > 0 && <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>Of {full(leaving)} leavings - a page view with no next page.</Typography>}
              </GlassCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
                <CardTitle icon={<LoginOutlinedIcon />} tint="green" title="Where they come in"
                  note="The first page of the visit, and what those visits did - Google Analytics' own count" />
                <Box sx={{ display: "grid", gap: 0.25 }}>
                  {data.entries.map((e) => (
                    <BarRow key={e.kind} kind={e.kind} value={full(e.sessions)} share={e.sessions / Math.max(1, t.visits)} on={kind === e.kind} onClick={() => openKind(e.kind)}
                      note={<>{pct(e.sessions / Math.max(1, t.visits))} of the visits · <Box component="span" sx={{ color: "#a0521a" }}>{pct(rate(e.carts, e.sessions))} to the cart</Box> · <Box component="span" sx={{ color: GREEN }}>{pct(rate(e.orders, e.sessions))} ordered</Box></>} />
                  ))}
                </Box>
              </GlassCard>
            </Grid>
          </Grid>
        )}

        {t.visits > 0 && view === "flow" && (
          <GlassCard>
            <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="How visitors move, page after page"
              note="The way in and the next four pages, by kind - built from page-to-page steps. A kind opens its pages." />
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <KindLegend kinds={shown} />
              <JourneyFlowChart flow={data.flow} selected={kind} onPick={openKind} />
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, display: { xs: "block", md: "none" } }}>Swipe sideways to follow the steps.</Typography>
            </Box>
          </GlassCard>
        )}

        {t.visits > 0 && view !== "journeys" && drill && (
          <Box ref={pagesRef} sx={{ scrollMarginTop: 16 }}>
            <KindPages data={data} kind={drill} setKind={setKind} jb={jb} q={q} />
          </Box>
        )}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Main journeys"
        subtitle="From the way in to the order - or to the page where they leave"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      <GlassCard sx={{ py: { xs: 1.75, md: 2 } }}>
        <ChoiceBar q={q} set={set} stores={d?.stores ?? null} />
      </GlassCard>
      {body}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Next:</Typography>
        <Box component={Link} href={`${jb}/funnel${jqs(q)}`} sx={{ ...linkSx, fontSize: "0.84rem", display: "inline-flex", alignItems: "center" }}>The funnel<ChevronRightIcon sx={{ fontSize: 18 }} /></Box>
        <Box component={Link} href={`${jb}/page${jqs(q)}`} sx={{ ...linkSx, fontSize: "0.84rem", display: "inline-flex", alignItems: "center" }}>Page flow<ChevronRightIcon sx={{ fontSize: 18 }} /></Box>
      </Box>
    </Box>
  );
}

export default function MainJourneys() {
  return <Suspense fallback={<LoadingPanel label="Opening the journeys…" />}><MainJourneysInner /></Suspense>;
}
