"use client";

// Website > Journeys > MAIN JOURNEYS (SARCLA 08.11.2026: "you should be able to visually display journeys, analyse the
// main journeys; this should be a stand-alone app"). How visitors move through the shop, by kind of page: where they come
// in, the next pages, the cart, the check-out, the order - or where they leave (src/lib/journeys/read.ts). The flow and
// the journeys are chained from Google Analytics' page-to-page steps and say so; the ways in are its own visit counts.
// A kind opens its most viewed pages, a page opens its own flow.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, Notice, TRACK, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { usePaged } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { FLOW_KINDS, KIND_COLOR, KIND_NAME, KIND_ON, journeyWords, type FlowKind, type JKind, type Journey } from "@/lib/journeys/model";
import type { JourneysData } from "@/lib/journeys/read";
import { JourneyFlowChart, KindLegend, KindTag, NextBar, pageFlowHref, pct } from "./parts";

const linkSx = { color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;

function JourneyLine({ j }: { j: Journey }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.75, rowGap: 0.5, minWidth: 0 }} aria-label={journeyWords(j)}>
      {j.kinds.map((k, i) => (
        <Box key={i} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          {i > 0 && <Box component="span" aria-hidden sx={{ color: FAINT, fontSize: "0.85rem" }}>→</Box>}
          <KindTag kind={k} />
        </Box>
      ))}
      {j.end === "left" && (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box component="span" aria-hidden sx={{ color: FAINT, fontSize: "0.85rem" }}>→</Box>
          <KindTag kind="left" label="Left" />
        </Box>
      )}
      {j.end === "on" && <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>→ …</Typography>}
    </Box>
  );
}

function Journeys({ rows, depth }: { rows: Journey[]; depth: number }) {
  const max = Math.max(1e-9, ...rows.map((r) => r.share));
  if (!rows.length) return <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No way through the shop has enough visits in this period.</Typography>;
  const head = { fontSize: "0.68rem", fontWeight: 600, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
  const cols = { xs: "1fr", md: "minmax(0, 1fr) 96px 150px 104px 84px" };
  return (
    <Box sx={{ display: "grid" }}>
      <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, columnGap: 2, pb: 1, borderBottom: "1px solid rgba(21,34,58,.10)" }}>
        <Typography sx={head}>The way, up to {depth} pages</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>Visits</Typography>
        <Typography sx={head}>Of all visits</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>To the cart</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>Ordered</Typography>
      </Box>
      {rows.map((j, i) => (
        <Box key={i} sx={{ display: "grid", gridTemplateColumns: cols, columnGap: 2, rowGap: 0.75, alignItems: "center", py: 1.25, borderBottom: "1px solid rgba(21,34,58,.06)" }}>
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: FAINT, width: 18, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
            <JourneyLine j={j} />
          </Box>
          <Box sx={{ display: { xs: "flex", md: "contents" }, gap: 2, flexWrap: "wrap", pl: { xs: "30px", md: 0 }, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, textAlign: { md: "right" }, fontVariantNumeric: "tabular-nums" }}>
              {full(j.visits)}<Box component="span" sx={{ display: { md: "none" }, fontWeight: 500, color: MUTED }}> visits</Box>
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 110 }}>
              <Box sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: TRACK, overflow: "hidden", minWidth: 60 }}>
                <Box sx={{ height: "100%", width: `${(j.share / max) * 100}%`, bgcolor: KIND_COLOR[j.kinds[0]], borderRadius: 99 }} />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(j.share)}</Typography>
            </Box>
            <Typography sx={{ display: { xs: j.cart > 0 ? "block" : "none", md: "block" }, fontSize: "0.84rem", textAlign: { md: "right" }, color: j.cart > 0 ? INK : FAINT, fontVariantNumeric: "tabular-nums" }}>
              {j.cart > 0 ? pct(j.cart / j.visits) : "–"}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> to the cart</Box>
            </Typography>
            <Typography sx={{ display: { xs: j.order > 0 ? "block" : "none", md: "block" }, fontSize: "0.84rem", textAlign: { md: "right" }, color: j.order > 0 ? INK : FAINT, fontVariantNumeric: "tabular-nums" }}>
              {j.order > 0 ? pct(j.order / j.visits) : "–"}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> ordered</Box>
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function KindPages({ data, kind, setKind }: { data: JourneysData; kind: JKind; setKind: (k: JKind) => void }) {
  const rows = data.pages[kind] ?? [];
  const { slice, pager, setPage } = usePaged(rows, 10);
  useEffect(() => { setPage(0); }, [kind, setPage]);
  const options = (FLOW_KINDS.filter((k) => k !== "left") as JKind[]).filter((k) => (data.pages[k]?.length ?? 0) > 0).map((k) => ({ key: k, label: KIND_NAME[k] }));
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.5 }}>
        <CardTitle icon={<ListAltOutlinedIcon />} tint="slate" title={`The most viewed pages · ${KIND_NAME[kind]}`}
          note="Each page's views, the visits that came in on it, where its visitors went next and how many left - a page opens its own flow" />
        <SquareChoice<JKind> label="Kind" value={kind} onChange={setKind} options={options} />
      </Box>
      <Box sx={{ overflowX: "auto", mt: 1.5 }}>
        <Table size="small" sx={{ minWidth: 860 }}>
          <TableHead>
            <TableRow>{["Page", "Views", "Came in here", "Went next", "Left here", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {slice.length === 0 && <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No page of this kind in this period.</TableCell></TableRow>}
            {slice.map((p) => (
              <TableRow key={p.path} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                  <Box component={Link} href={pageFlowHref(p.path)} sx={{ ...clip(330), display: "block", color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { color: ACCENT } }} title={p.path}>{p.name}</Box>
                  <Typography sx={{ ...clip(330), fontSize: "0.74rem", color: MUTED }} title={p.path}>{p.path}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{full(p.views)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.entries ? full(p.entries) : "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, minWidth: 200 }}>
                  <NextBar next={p.next} left={p.left} />
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>
                    {p.next.length ? p.next.slice(0, 2).map((n) => `${pct(n.share)} ${KIND_NAME[n.kind].toLowerCase()}`).join(" · ") : "no next page recorded"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{pct(p.left)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  <Box component={Link} href={pageFlowHref(p.path)} sx={linkSx}>Page flow</Box>
                  <Box component="span" sx={{ color: FAINT }}> · </Box>
                  <Box component={Link} href={previewHref("prod", p.path)} sx={linkSx}>Preview</Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </GlassCard>
  );
}

export default function MainJourneys() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [store, setStore] = useState<string>("all");
  const [kind, setKind] = useState<JKind | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const url = `/api/website/journeys?from=${win.from}&to=${win.to}${store !== "all" ? `&store=${encodeURIComponent(store)}` : ""}&n=${tick}`;
  const held = useHeld<JourneysData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const shown = useMemo(() => {
    if (!d) return [] as FlowKind[];
    const present = new Set(d.flow.nodes.map((n) => n.kind));
    return FLOW_KINDS.filter((k) => present.has(k));
  }, [d]);
  // the kind whose pages show: the one picked, else the way in most visits take
  const drill: JKind | null = kind ?? d?.entries[0]?.kind ?? null;
  const pick = (k: JKind) => {
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
    const top = data.entries[0] ?? null;
    const stores = [{ key: "all", label: "All stores" }, ...data.stores.slice(0, 12).map((s) => ({ key: s.key, label: s.key }))];
    body = (
      <>
        <SquareChoice<string> label="Store view" value={store} onChange={setStore} options={stores} />
        {data.ga4.truncatedSteps && <Notice tone="warn">Google Analytics gave the {full(data.ga4.stepRows)} most viewed page-to-page steps only - the rarest steps are missing from the flow.</Notice>}
        {data.ga4.truncatedLanding && <Notice tone="warn">Google Analytics gave the most visited landing pages only - the rarest ways in are missing.</Notice>}
        {t.visits === 0 && <Notice tone="warn">Google Analytics has no visits for this period{data.store ? ` in ${data.store}` : ""}.</Notice>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="blue" label="Visits" value={full(t.visits)} note="visitors who accepted statistics cookies" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LoginOutlinedIcon />} tint="purple" label="Main way in" value={top ? KIND_NAME[top.kind] : "—"} note={top ? `${pct(top.sessions / Math.max(1, t.visits))} of the visits start ${KIND_ON[top.kind]}` : undefined} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="amber" label="Put something in the cart" value={t.visits ? pct(t.carts / t.visits) : "—"} note={`${full(t.carts)} of the visits`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingBagOutlinedIcon />} tint="green" label="Ordered" value={t.visits ? pct(t.orders / t.visits) : "—"} note={`${full(t.orders)} of the visits · ${full(t.transactions)} orders`} /></Grid>
        </Grid>

        {t.visits > 0 && (
          <GlassCard>
            <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="How visitors move"
              note="From the way in to the next four pages, by kind of page - built from page-to-page steps, not each visitor followed. A kind opens its pages." />
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <KindLegend kinds={shown} />
              <JourneyFlowChart flow={data.flow} selected={kind} onPick={pick} />
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, display: { xs: "block", md: "none" } }}>Swipe sideways to follow the steps.</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>
                A step is a page view and the page before it, when that page is one of the shop&apos;s. Another site or no page before is a way in;
                the same page again (a reload, a filter, the next page of a list) is not a step. The ways in are Google Analytics&apos; own visits;
                every column after them is the share of visits that went on from each kind of page.
              </Typography>
            </Box>
          </GlassCard>
        )}

        {t.visits > 0 && (
          <GlassCard>
            <CardTitle icon={<RouteOutlinedIcon />} tint="blue" title="The main journeys"
              note={`The most travelled ways through the shop, up to ${data.rules.journeyDepth} pages, with how many of them went to the cart and ordered - built from page-to-page steps`} />
            <Journeys rows={data.journeys} depth={data.rules.journeyDepth} />
          </GlassCard>
        )}

        {t.visits > 0 && (
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<LoginOutlinedIcon />} tint="green" title="Where they come in"
                note="The visits by the first page they saw, and what those visits did - Google Analytics' own count, not chained. A row opens its pages." />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>{["Came in on", "Visits", "Of all visits", "Put in the cart", "Ordered"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((e) => (
                    <TableRow key={e.kind} hover selected={e.kind === drill} onClick={() => pick(e.kind)} sx={{ cursor: "pointer" }}>
                      <TableCell sx={bodyCell}><KindTag kind={e.kind} /></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{full(e.sessions)}</TableCell>
                      <TableCell sx={{ ...bodyCell, minWidth: 160 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
                            <Box sx={{ height: "100%", width: `${(e.sessions / Math.max(1, t.visits)) * 100}%`, bgcolor: KIND_COLOR[e.kind], borderRadius: 99 }} />
                          </Box>
                          <Typography sx={{ fontSize: "0.8rem", color: MUTED, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(e.sessions / Math.max(1, t.visits))}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{pct(e.carts / Math.max(1, e.sessions))}<Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}> · {full(e.carts)}</Typography></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{pct(e.orders / Math.max(1, e.sessions))}<Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}> · {full(e.orders)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>
        )}

        {t.visits > 0 && drill && (
          <Box ref={pagesRef} sx={{ scrollMarginTop: 16 }}>
            <KindPages data={data} kind={drill} setKind={setKind} />
          </Box>
        )}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Main journeys"
        subtitle="How visitors move through the shop: where they come in, the pages after, the cart and the order - or where they leave"
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
      {body}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        Next: <Box component={Link} href="/website/journeys/funnel" sx={linkSx}>the funnel</Box> - the shop&apos;s steps and where most are lost
        {" · "}<Box component={Link} href="/website/journeys/page" sx={linkSx}>one page&apos;s flow</Box>
      </Typography>
    </Box>
  );
}
