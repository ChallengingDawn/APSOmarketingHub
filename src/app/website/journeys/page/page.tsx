"use client";

// Website > Journeys > PAGE FLOW, reviewed (SARCLA 09.11.2026: "Pages flow navigation is not clear, page flow need to
// be completely reviewed"). One way to use it: FIND a page (the search over APSOconvert's page index, the period's most
// viewed and problem pages offered first), see it in the MIDDLE - its picture and its numbers - with where its visitors
// CAME FROM on the left (the pages before, the other sites, no page before) and where they WENT NEXT on the right (the
// next pages, the cart, or they left the shop). A click on any page beside it MOVES there; the pages walked stay above as
// a trail with Back. The page in the middle opens in the Preview, to its optimizations, to its click map, or as a funnel
// step. From Google Analytics' page-to-page steps on that page alone (src/lib/journeys/read.ts buildPageFlow).
//
// LAID OUT AGAIN 13.11.2026 (SARCLA: "Page flow layout is pure shit - still wrong"): the choices in ONE compact row (the
// search, the store view as one list by language, the device); the three columns aligned at the top, their numbers in
// fixed columns that are never cut (a list's grid track grew to its longest name and pushed the counts out of the
// card); the page in the middle says its name, its four figures and its actions FIRST, its picture below at a limited
// height; every action a button of one style. A shop function (the cart, the check-out, sign-in, the order placed...)
// gets no picture, no Preview, no Find optimizations, no Click map - the Preview refuses it ("Preview did not answer
// (HTTP 400)", SARCLA 13.11.2026); it stays a page to walk from (src/lib/journeys/model.ts canPreview).

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WestOutlinedIcon from "@mui/icons-material/WestOutlined";
import EastOutlinedIcon from "@mui/icons-material/EastOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PageHeader from "@/app/PageHeader";
import { AiButton } from "@/app/website/ai-personalization/AiButton";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, TRACK } from "@/app/uc/report/ui";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { journeysBase, useInConvert } from "@/app/website/ai-personalization/base";
import {
  CART_KINDS, JKINDS, KIND_COLOR, KIND_NAME, canPreview, journeyKind, pageName, pathKey,
  type FlowSide, type JKind, type TopPage,
} from "@/lib/journeys/model";
import type { JourneysData, PageFlowData } from "@/lib/journeys/read";
import { KindTag, pct } from "../parts";
import { ChoiceBar, PageSearch, jqs, toPath, useJQuery, type JQuery, type PageHit } from "../controls";

/** Every action of the page: the hub's small button, square-cornered, its words as they are (AiButton for the AI's). */
const btnSx = { borderRadius: "6px", textTransform: "none", fontWeight: 700, boxShadow: "none", whiteSpace: "nowrap" } as const;
const SIDE_COLOR: Record<FlowSide["kind"], string> = { ...KIND_COLOR, site: "#7d8aa3", none: "#b5bdca" };
const MAX_TRAIL = 8;
/** A row beside the page: its colour, its name (cut with "…"), its share, its views, the arrow - the numbers in fixed
 *  columns, so a long name never pushes them out of the card. */
const ROW_COLS = "10px minmax(0,1fr) 44px 54px 16px";

type Problem = { path: string; name: string; views: number; missed: number; reasons: string[] };

/** The period's most viewed pages and the problem pages - what to start from. */
function useSuggestions(store: string | null, device: string | null) {
  const { window: win } = useReportingWindow();
  const jUrl = `/api/website/journeys?from=${win.from}&to=${win.to}${store ? `&store=${store}` : ""}${device ? `&device=${device}` : ""}`;
  const j = useHeld<JourneysData>(jUrl, [jUrl]);
  const pUrl = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}`;
  const p = useHeld<{ pages: Problem[] }>(pUrl, [pUrl]);
  const top = useMemo(() => {
    if (j.result?.state !== "ok") return [] as TopPage[];
    return JKINDS.flatMap((k) => j.result!.state === "ok" ? j.result!.data.pages[k] ?? [] : []).sort((a, b) => b.views - a.views).slice(0, 10);
  }, [j.result]);
  const problems = useMemo(() => {
    if (p.result?.state !== "ok") return [] as Problem[];
    return (p.result.data.pages ?? []).filter((x) => x.reasons?.length && (!store || x.path.startsWith(`/${store}/`)))
      .sort((a, b) => (b.missed ?? 0) - (a.missed ?? 0)).slice(0, 8);
  }, [p.result, store]);
  return { j, p, top, problems, stores: j.result?.state === "ok" ? j.result.data.stores : null };
}

function StartList({ title, icon, rows, onOpen, empty }: { title: string; icon: React.ReactNode; rows: { path: string; name: string; note: string }[]; onOpen: (p: string) => void; empty: string }) {
  return (
    <GlassCard sx={{ height: "100%", boxSizing: "border-box" }}>
      <CardTitle icon={icon} tint={title.startsWith("Problem") ? "pink" : "blue"} title={title} />
      {rows.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{empty}</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)" }}>
        {rows.map((x) => (
          <Box key={x.path} component="button" type="button" onClick={() => onOpen(x.path)} sx={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", display: "grid", gridTemplateColumns: "10px minmax(0,1fr) auto 18px", columnGap: 1.25,
            alignItems: "center", py: 1, px: 1, borderRadius: "8px", minWidth: 0,
            borderTop: `1px solid ${HAIRLINE}`, "&:hover": { bgcolor: "rgba(36,89,209,.06)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
          }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: KIND_COLOR[journeyKind(x.path)] }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }} title={x.name}>{x.name}</Typography>
              <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }} title={x.path}>{x.path}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{x.note}</Typography>
            <ChevronRightIcon sx={{ fontSize: 18, color: FAINT }} />
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

/** One page beside the page in the middle: its colour, name, share, views, a bar - a click moves there. */
function Neighbour({ it, total, onOpen }: { it: FlowSide; total: number; onOpen: (p: string) => void }) {
  const can = !!it.path;
  const share = it.views / Math.max(1, total);
  const inner = (
    <Box sx={{ display: "grid", gridTemplateColumns: ROW_COLS, columnGap: 0.75, rowGap: 0.5, alignItems: "center", minWidth: 0 }}>
      <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: SIDE_COLOR[it.kind] }} />
      <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 650, color: it.kind === "left" ? MUTED : INK, lineHeight: 1.35 }}>{it.label}</Typography>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right", lineHeight: 1.35 }}>{pct(share)}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontVariantNumeric: "tabular-nums", textAlign: "right", lineHeight: 1.35 }}>{full(it.views)}</Typography>
      {can ? <ChevronRightIcon sx={{ fontSize: 16, color: ACCENT }} /> : <Box />}
      <Box sx={{ gridColumn: "2 / 5", height: 4, borderRadius: "2px", bgcolor: TRACK, overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.min(1, share) * 100}%`, bgcolor: SIDE_COLOR[it.kind], opacity: 0.85 }} />
      </Box>
    </Box>
  );
  const box = { display: "block", width: "100%", minWidth: 0, boxSizing: "border-box", px: 1, py: 0.75, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)" } as const;
  return can
    ? <Box component="button" type="button" onClick={() => onOpen(it.path!)} title={`${it.label} - ${it.path} - click to move there`} sx={{ all: "unset", cursor: "pointer", ...box, "&:hover": { borderColor: ACCENT, bgcolor: "rgba(36,89,209,.05)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` } }}>{inner}</Box>
    : <Box title={it.label} sx={box}>{inner}</Box>;
}

// a side of the page: the first six of each group then all, and it folds (SARCLA 10.11.2026: "both left and right side
// much smaller, the page should be the start"; "review the button design and collapsible")
const FIRST = 6;
const HEAD_SX = { fontSize: "0.64rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".05em" } as const;
function Side({ title, icon, groups, total, onOpen, empty }: {
  title: string; icon: React.ReactNode; groups: { head: string; items: FlowSide[] }[]; total: number; onOpen: (p: string) => void; empty: string;
}) {
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const any = groups.some((g) => g.items.length);
  const more = groups.reduce((n, g) => n + Math.max(0, g.items.length - FIRST), 0);
  return (
    <GlassCard sx={{ boxSizing: "border-box", p: { xs: 1.5, md: 1.75 } }}>
      <Box component="button" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, width: "100%", boxSizing: "border-box", mb: open ? 1 : 0 }}>
        {icon}
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{title}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, ml: "auto", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{full(total)} views</Typography>
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Box>
      {open && (
        <>
          {!any && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{empty}</Typography>}
          {any && (
            <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: ROW_COLS, columnGap: 0.75, px: 1.125, pb: 0.25 }}>
              <Box /><Box />
              <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>Share</Typography>
              <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>Views</Typography>
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 1.25 }}>
            {groups.filter((g) => g.items.length).map((g) => (
              <Box key={g.head} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 0.5, minWidth: 0 }}>
                <Typography sx={HEAD_SX}>{g.head}</Typography>
                {(all ? g.items : g.items.slice(0, FIRST)).map((it) => <Neighbour key={it.key} it={it} total={total} onOpen={onOpen} />)}
              </Box>
            ))}
          </Box>
          {more > 0 && (
            <Button size="small" variant="outlined" onClick={() => setAll((a) => !a)} sx={{ ...btnSx, mt: 1.25 }}>{all ? "Show fewer" : `Show all · ${more} more`}</Button>
          )}
        </>
      )}
    </GlassCard>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 750, color: tone ?? INK, letterSpacing: "-0.02em", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {note && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>{note}</Typography>}
    </Box>
  );
}

/** The steps "As a funnel step" opens: the way in, this page, then the cart and the order - those it is not already. */
function funnelSteps(path: string, kind: JKind): string[] {
  const page = `page:${path}`;
  if (kind === "order") return ["in", page];
  if (CART_KINDS.includes(kind)) return ["in", page, "order"];
  return ["in", page, "cart", "order"];
}

/** Why a shop function has no picture and no Preview. */
const NO_PREVIEW: Partial<Record<JKind, string>> = {
  cart: "The cart is each customer's own",
  checkout: "The check-out is each customer's own",
  order: "The order confirmation is each customer's own",
  account: "Sign-in and the account pages are each customer's own",
  search: "The search results depend on what was typed",
  quickorder: "The quick order is each customer's own list",
};

function Middle({ path, data, jb, q }: { path: string; data: PageFlowData | null; jb: string; q: JQuery }) {
  const inConvert = useInConvert();
  const flow = data?.flow ?? null;
  const kind: JKind = flow?.kind ?? journeyKind(path);
  const name = flow?.name ?? pageName(path);
  const steps = flow ? Math.max(0, flow.views - flow.again) : 0;
  const went = flow ? flow.to.reduce((a, x) => a + x.views, 0) : 0;
  const funnel = `${jb}/funnel${jqs(q, { step: funnelSteps(path, kind) })}`;
  // only a public page of the shop opens in the Preview: the cart, sign-in and the other functions would answer 400
  const shown = canPreview(path);
  return (
    <GlassCard sx={{ boxSizing: "border-box", p: { xs: 2, md: 2.25 }, borderTop: `3px solid ${KIND_COLOR[kind]}` }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 1.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <KindTag kind={kind} />
            {flow?.store && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, fontWeight: 600 }}>{flow.store}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 750, color: INK, lineHeight: 1.25, mt: 0.5, overflowWrap: "anywhere" }}>{name}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }} title={path}>{path}</Typography>
        </Box>
        {data && flow && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(4, minmax(0,1fr))" }, gap: 1.5, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Stat label="Views" value={full(data.page?.views ?? flow.views)} note={data.page ? `${full(data.page.sessions)} visits · ${full(data.page.addToCarts)} put in the cart here` : undefined} />
            <Stat label="Came in here" value={full(data.landing.sessions)}
              note={data.landing.sessions ? `${pct(data.landing.carts / data.landing.sessions)} to the cart · ${pct(data.landing.orders / data.landing.sessions)} ordered` : "no visit started here"} />
            <Stat label="Went on in the shop" value={steps ? pct(Math.min(1, went / steps)) : "—"} tone={GREEN} note={`${full(went)} next pages`} />
            <Stat label="Left the shop here" value={steps ? pct(flow.left / steps) : "—"} tone={RED} note={`${full(flow.left)} views with no next page`} />
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1, rowGap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {shown && <Button size="small" variant="contained" disableElevation component={Link} href={previewHref("prod", path)} startIcon={<VisibilityOutlinedIcon />} sx={btnSx}>Preview</Button>}
          {shown && <AiButton size="small" href={`${previewHref("prod", path)}&ask=1`}>Find optimizations</AiButton>}
          {shown && <Button size="small" variant="outlined" component={Link} href={`${previewHref("prod", path)}&clicks=1`} startIcon={<AdsClickOutlinedIcon />} sx={btnSx}>Click map</Button>}
          <Button size="small" variant="outlined" component={Link} href={funnel} startIcon={<FilterAltOutlinedIcon />} sx={btnSx}>As a funnel step</Button>
        </Box>
        {shown
          ? (
            <>
              <Box component={Link} href={previewHref("prod", path)} title="Open it in the Preview" sx={{ display: "block", borderRadius: "10px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, maxHeight: 360 }}>
                <PageShot env="prod" path={path} ratio={0.5} label={name} />
              </Box>
              {!inConvert && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Preview, Find optimizations and Click map open in AI testing &amp; personalization.</Typography>}
            </>
          )
          : (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>
              {NO_PREVIEW[kind] ?? `${KIND_NAME[kind]} is a function of the shop`} - no picture and no Preview: the Preview shows the shop&apos;s public pages only. Walk on from the pages beside it.
            </Typography>
          )}
      </Box>
    </GlassCard>
  );
}

type Suggestions = ReturnType<typeof useSuggestions>;

function Flow({ path, via, sug }: { path: string; via: string[]; sug: Suggestions }) {
  const router = useRouter();
  const jb = journeysBase(useInConvert());
  const { q, set } = useJQuery();
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const url = `/api/website/journeys/page?path=${encodeURIComponent(path)}&from=${win.from}&to=${win.to}${q.device ? `&device=${q.device}` : ""}&n=${tick}`;
  const held = useHeld<PageFlowData>(url, [url]);
  const r = held.result;
  const go = (to: string, trail: string[]) => router.push(`${jb}/page${jqs(q, { path: to, via: trail.slice(-MAX_TRAIL) })}`, { scroll: false });
  const move = (to: string) => { if (pathKey(to) !== pathKey(path)) go(to, [...via, path]); };
  const suggest: PageHit[] = [
    ...sug.top.map((p) => ({ path: p.path, name: p.name, note: `${full(p.views)} views` })),
    ...sug.problems.map((p) => ({ path: p.path, name: p.name, note: "problem page" })),
  ];

  let status: React.ReactNode = null;
  if (r === null) status = <LoadingPanel label="Reading this page's steps from Google Analytics…" />;
  else if (r.state === "not-configured") status = <NotConnectedPanel source="Google Analytics" missing={r.missing} />;
  else if (r.state === "error") status = <UpstreamPanel source="Google Analytics" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  const d = r?.state === "ok" ? r.data : null;
  const flow = d?.flow ?? null;
  const steps = flow ? Math.max(0, flow.views - flow.again) : 0;
  const went = flow ? flow.to.reduce((a, x) => a + x.views, 0) : 0;
  const crumb = { display: "inline-flex", alignItems: "center", gap: 0.6, px: 0.9, py: 0.35, borderRadius: "4px", fontSize: "0.8rem", maxWidth: 240, minWidth: 0 } as const;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <PageHeader title="Page flow" subtitle="Where a page's visitors came from and went next - click a page beside it to move there"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        } />

      {/* the choices, one row: the search, the store view, the device */}
      <GlassCard sx={{ py: 1.5, px: { xs: 1.5, md: 2 } }}>
        <ChoiceBar q={q} set={set} stores={sug.stores}
          search={<PageSearch size="small" store={q.store} suggest={suggest} onPick={move} placeholder="Another page: a name, a product number, or paste its address" />} />
      </GlassCard>

      {/* the trail: the pages walked, Back */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", rowGap: 0.75, minWidth: 0 }}>
        <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} disabled={!via.length}
          onClick={() => go(via[via.length - 1], via.slice(0, -1))} sx={{ ...btnSx, bgcolor: "rgba(255,255,255,.8)" }}>Back</Button>
        <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mx: 0.5 }}>Your walk</Typography>
        {via.map((p, i) => (
          <Box key={`${i}:${p}`} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            <Box component="button" type="button" onClick={() => go(p, via.slice(0, i))} title={p} sx={{
              all: "unset", cursor: "pointer", ...crumb, border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)", fontWeight: 600, color: INK,
              "&:hover": { borderColor: ACCENT, color: ACCENT }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
            }}>
              <Box aria-hidden component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: KIND_COLOR[journeyKind(p)], flexShrink: 0 }} />
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageName(p)}</Box>
            </Box>
            <ChevronRightIcon sx={{ fontSize: 16, color: FAINT }} />
          </Box>
        ))}
        <Box component="span" title={path} sx={{ ...crumb, bgcolor: INK, color: "#fff", fontWeight: 700 }}>
          <Box aria-hidden component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: KIND_COLOR[journeyKind(path)], flexShrink: 0 }} />
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{flow?.name ?? pageName(path)}</Box>
        </Box>
      </Box>

      {d?.truncated && <Notice tone="warn">Google Analytics gave the most viewed steps only - the rarest ones are missing.</Notice>}
      {flow && flow.views === 0 && <Notice tone="warn">Google Analytics has no view of this page in this period{q.device ? " on this device" : ""} - check the address, or choose a longer period.</Notice>}
      {status}

      {/* the three columns, aligned at the top: where they came from, the page, where they went next */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)" } }}>
        <Box sx={{ order: { xs: 2, lg: 1 }, minWidth: 0 }}>
          {flow && (
            <Side title="Came from" icon={<WestOutlinedIcon sx={{ color: ACCENT }} />} total={steps} onOpen={move} empty="No view of this page in this period."
              groups={[
                { head: "The page before", items: flow.from.filter((x) => x.key.startsWith("page:")) },
                { head: "Came in from outside", items: flow.from.filter((x) => !x.key.startsWith("page:")) },
              ]} />
          )}
        </Box>
        <Box sx={{ order: { xs: 1, lg: 2 }, minWidth: 0 }}>
          <Middle path={path} data={d} jb={jb} q={q} />
        </Box>
        <Box sx={{ order: 3, minWidth: 0 }}>
          {flow && (
            <Side title="Went next" icon={<EastOutlinedIcon sx={{ color: GREEN }} />} total={Math.max(steps, went)} onOpen={move} empty="No next page recorded."
              groups={[
                { head: "The next page", items: flow.to },
                { head: "Or", items: flow.left > 0 ? [{ key: "left", label: "Left the shop", kind: "left" as const, path: null, views: flow.left }] : [] },
              ]} />
          )}
        </Box>
      </Box>

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Visitors who accepted statistics cookies. &quot;Left the shop&quot;: no next page followed - they closed the tab or went to another site.
      </Typography>
    </Box>
  );
}

/** No page chosen yet: the search, and the pages to start from. */
function Start({ sug }: { sug: Suggestions }) {
  const router = useRouter();
  const jb = journeysBase(useInConvert());
  const { q, set } = useJQuery();
  const open = (p: string) => router.push(`${jb}/page${jqs(q, { path: p })}`);
  const loading = sug.j.result === null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <PageHeader title="Page flow" subtitle="Pick a page: where its visitors came from, where they went next - then walk on from page to page" rightSlot={<WindowPicker />} />
      <GlassCard sx={{ display: "grid", gap: 1.25, py: { xs: 1.75, md: 2 }, px: { xs: 1.5, md: 2 } }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>Which page?</Typography>
        <ChoiceBar q={q} set={set} stores={sug.stores}
          search={<PageSearch autoFocus size="small" store={q.store} onPick={open}
            suggest={[...sug.top.map((p) => ({ path: p.path, name: p.name, note: `${full(p.views)} views` })), ...sug.problems.map((p) => ({ path: p.path, name: p.name, note: "problem page" }))]} />} />
      </GlassCard>
      {sug.j.result?.state === "not-configured" && <NotConnectedPanel source="Google Analytics" missing={sug.j.result.missing} />}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <StartList title="The most viewed pages" icon={<TrendingUpOutlinedIcon />} onOpen={open}
            rows={sug.top.map((p) => ({ path: p.path, name: p.name, note: `${full(p.views)} views` }))}
            empty={loading ? "Reading the most viewed pages…" : sug.j.result?.state === "error" ? `Google Analytics did not answer: ${sug.j.result.error}` : "No page was viewed in this period."} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <StartList title="Problem pages" icon={<ReportProblemOutlinedIcon />} onOpen={open}
            rows={sug.problems.map((p) => ({ path: p.path, name: p.name, note: `${full(p.views)} views` }))}
            empty={sug.p.result === null ? "Reading the problem pages…" : sug.p.result.state === "error" ? `The problem pages did not answer: ${sug.p.result.error}` : `No problem page in this period${q.store ? ` in ${q.store}` : ""}.`} />
        </Grid>
      </Grid>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Or start from the main journeys:</Typography>
        <Button size="small" variant="outlined" component={Link} href={`${jb}${jqs(q)}`} startIcon={<RouteOutlinedIcon />} sx={btnSx}>Main journeys</Button>
      </Box>
    </Box>
  );
}

function PageFlowInner() {
  const { sp, q } = useJQuery();
  // read once for the page, not again at every move
  const sug = useSuggestions(q.store, q.device);
  const path = toPath(sp.get("path") ?? "");
  const via = sp.getAll("via").map((v) => toPath(v)).filter((v): v is string => !!v).slice(-MAX_TRAIL);
  if (path) return <Flow key={path} path={path} via={via} sug={sug} />;
  return <Start sug={sug} />;
}

export default function PageFlowPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Opening the page flow…" />}>
      <PageFlowInner />
    </Suspense>
  );
}
