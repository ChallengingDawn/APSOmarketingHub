"use client";
// RETAIN & GROW - EROSION AT STAKE, AS SARCLA'S EROSION EXCEL (SARCLA 20.10.2026: "the graphs are bad, on the
// design and the logic - look at what has been done in the erosion Excel"). The Excel (ErosionArticle-2021-2025,
// February 2025) is a pivot - owner > customer > article: the best year, the years against it, the gap - with
// what was done about it beside each line (Resp. action, Action, Result, Order intake). Here, live:
//   the headline   what is at stake on the articles still bought less, or stopped recently (bought in the last
//                  two full years) - SARCLA chose 20.10; made to order (800x), one year only and lost before
//                  are shown apart, never hidden, and can join the pivot
//   one graph      at stake per owner, split still buying less / stopped recently - a click opens the owner
//   the pivot      owner > customer > article, as the Excel's SummaryView, with each customer's erosion tickets:
//                  when raised, open or closed, what came of it (won = closed as Ordered)
// The rules are in retainCube.ts; the read in retain.ts; the tickets come with it (the API route).

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import { Badge, CardTitle, FAINT, GlassCard, GREEN, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import {
  FLOOR, HEADLINE, actionsOf, byKind, keyCountry, keyOwner, keyPc, kindInfo, pivot, totalsBy, eroding,
  type Kind, type PivotOwner, type RFilters, type RetainAction, type RetainData,
} from "@/lib/marketingKpis/retainCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import type { MkState } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { Pager, n0, usePaged } from "./ExplorerKit";
import { Pick } from "./Lead";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

const eur = (n: number | null | undefined) => (n == null ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const ownerName = (d: RetainData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");
const customerName = (d: RetainData, u: string) => d.companies[u]?.n || `Customer ${u}`;
const yearsLabel = (d: RetainData) => `${d.years[0]}–${d.years[d.years.length - 1]}`;
const artText = (t: string | undefined) => (t ?? "").replace(/\s*-\s*$/, "");
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const HS_TICKET = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;
const dayLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const KIND_COLOUR: Record<Kind, string> = { less: SERIES[0], stopped: SERIES[1], gone: "#9aa7b8", oneoff: "#c4cbd5", made: DEEMPHASIS };

/* ── the read, shared by the page and the nutshell's cards ───────────────────────── */

type Read = { d: RetainData | null; actions: RetainAction[]; actionsError: string | null; computing: boolean; progress?: string; error?: string };
const shared: { r: Read; p: Promise<void> | null; subs: Set<() => void> } = { r: { d: null, actions: [], actionsError: null, computing: true }, p: null, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/retain").then((x) => x.json())
    .then((j) => {
      const v = j?.retain?.value as RetainData | undefined;
      shared.r = { d: v ?? shared.r.d, actions: j?.actions ?? shared.r.actions, actionsError: j?.actionsError ?? null, computing: !!j?.retain?.computing || !v, progress: j?.retain?.progress, error: j?.error ?? j?.retain?.error };
    })
    .catch((e) => { shared.r = { ...shared.r, error: String((e as Error)?.message ?? e) }; })
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.r.d || shared.r.computing) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000); });
}
function useRetain(): Read {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); shared.subs.add(f); if (!shared.r.d) loadShared(); return () => { shared.subs.delete(f); }; }, []);
  return shared.r;
}

/* ── the cards ───────────────────────────────────────────────────────────────── */

type Ctx = {
  d: RetainData; f: RFilters; kinds: Kind[]; actions: RetainAction[]; actionsError: string | null; right?: React.ReactNode;
  /** at half width in the nutshell: the compact form */
  half?: boolean;
  onOwner?: (o: string) => void; onKind?: (k: Kind) => void;
};

/** The figures top right: the headline, its two parts, and what was done (the erosion tickets). */
function Figures({ d, f, actions }: { d: RetainData; f: RFilters; actions: RetainAction[] }) {
  const k = byKind(d, f);
  const head = k.less.gap + k.stopped.gap;
  const custs = new Set(pivot(d, f).flatMap((o) => o.customers.map((c) => c.u)));
  const mine = actions.filter((a) => custs.has(a.un));
  const closed = mine.filter((a) => !a.open), won = closed.filter((a) => a.won);
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; sub: string }[] = [
    { label: "At stake", icon: <TrendingDownOutlinedIcon />, tint: "amber", v: eur(head), sub: `${n0(custs.size)} customers - still buying less, or stopped recently` },
    { label: "Still buying, less", icon: <TrendingDownOutlinedIcon />, tint: "blue", v: eur(k.less.gap), sub: `${n0(k.less.customers)} customers, ${n0(k.less.lines)} articles` },
    { label: "Stopped recently", icon: <BlockOutlinedIcon />, tint: "pink", v: eur(k.stopped.gap), sub: `${n0(k.stopped.customers)} customers, ${n0(k.stopped.lines)} articles` },
    { label: "Erosion tickets", icon: <AssignmentTurnedInOutlinedIcon />, tint: "green", v: n0(mine.length), sub: `on these customers - ${n0(won.length)} won back of ${n0(closed.length)} closed` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(130px, 190px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.v}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const legend = (items: { c: string; color: string }[]) => (
  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
    {items.map((x) => <Box key={x.c} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: MUTED }}><Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: x.color }} />{x.c}</Box>)}
  </Box>
);

/** The one graph: at stake per owner, split by kind - still buying less, stopped recently (and any kind added). */
function OwnerSplitCard({ d, f, kinds, right, half, onOwner }: Ctx) {
  const owners = pivot(d, { ...f, kinds });
  const info = kindInfo(d.years).filter((k) => kinds.includes(k.id));
  const paged = usePaged(owners, half ? 6 : 12);
  const max = Math.max(1, ...owners.map((o) => o.sums.gap));
  // each owner's gap by kind, for the bar's parts
  const parts = (o: PivotOwner) => info.map((k) => ({ k, n: o.customers.reduce((a, c) => a + c.lines.filter((l) => l.kind === k.id).reduce((x, l) => x + l.gap, 0), 0) }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="At stake by owner"
        note={`What each owner's customers buy below their best year ${yearsLabel(d)} - the customer's owner in HubSpot today${onOwner ? " · click an owner to open its customers below" : ""}`} right={right} />
      {legend(info.map((k) => ({ c: k.label, color: KIND_COLOUR[k.id] })))}
      <Box sx={{ display: "grid", gridTemplateColumns: half ? "minmax(100px, 1fr) minmax(80px, 1.6fr) 96px" : "minmax(160px, 1fr) minmax(200px, 3fr) 110px 120px", columnGap: 1.25, rowGap: 0.75, alignItems: "center" }}>
        {paged.shown.map((o) => (
          <Box key={o.owner || "none"} role={onOwner ? "button" : undefined} tabIndex={onOwner ? 0 : undefined} onClick={onOwner ? () => onOwner(o.owner) : undefined}
            onKeyDown={onOwner ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOwner(o.owner); } } : undefined}
            sx={{ display: "contents", cursor: onOwner ? "pointer" : "default", "&:hover > *": onOwner ? { color: TINT.blue.fg } : {} }}>
            <Typography noWrap title={ownerName(d, o.owner)} sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{ownerName(d, o.owner)}</Typography>
            <Box role="img" aria-label={`${ownerName(d, o.owner)}: ${parts(o).map((p) => `${p.k.label} ${eur(p.n)}`).join(", ")}`} sx={{ display: "flex", height: 18, width: `${Math.max(1, (100 * o.sums.gap) / max)}%`, borderRadius: "4px", overflow: "hidden", gap: "2px" }}>
              {parts(o).filter((p) => p.n > 0).map((p) => <Box key={p.k.id} title={`${p.k.label}: ${eur(p.n)}`} sx={{ flex: `${p.n} 0 0`, bgcolor: KIND_COLOUR[p.k.id] }} />)}
            </Box>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(o.sums.gap)}</Typography>
            {!half && <Typography sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "right" }}>{n0(o.sums.customers)} customers</Typography>}
          </Box>
        ))}
      </Box>
      <Pager p={paged} />
    </GlassCard>
  );
}

/** Ticket words: open since a day, or what came of it. */
function TicketCell({ list }: { list: RetainAction[] }) {
  if (!list.length) return <Box component="span" sx={{ color: FAINT }}>—</Box>;
  const latest = [...list].sort((a, b) => b.created.localeCompare(a.created))[0];
  const won = list.filter((x) => x.won).length, open = list.filter((x) => x.open).length;
  return (
    <Box component="a" href={HS_TICKET(latest.id)} target="_blank" rel="noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()}
      title={list.map((x) => `${dayLabel(x.created)} - ${x.open ? "open" : x.result}`).join("\n")}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, textDecoration: "none", color: INK, "&:hover": { textDecoration: "underline" } }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: won ? GREEN : open ? SERIES[3] : DEEMPHASIS, flex: "0 0 auto" }} />
      <Box component="span" sx={{ fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {latest.open ? `Open since ${dayLabel(latest.created)}` : latest.result}{list.length > 1 ? ` · ${list.length} tickets` : ""}
      </Box>
    </Box>
  );
}

/**
 * The Excel's pivot: owner > customer > article - best year, the last full year, the last 12 months with the open
 * orders, what is at stake - and the erosion tickets beside each (when, open, what came of it).
 */
function PivotCard({ d, f, kinds, actions, actionsError, right, half, onKind, openOwner }: Ctx & { openOwner?: string | null }) {
  const owners = useMemo(() => pivot(d, { ...f, kinds }), [d, f, kinds]); // eslint-disable-line react-hooks/exhaustive-deps
  const [openO, setOpenO] = useState<Record<string, boolean>>({});
  const [openC, setOpenC] = useState<Record<string, boolean>>({});
  const [shownC, setShownC] = useState<Record<string, number>>({});
  useEffect(() => { if (openOwner != null) setOpenO((x) => ({ ...x, [openOwner]: true })); }, [openOwner]);
  const info = kindInfo(d.years);
  const last = d.years[d.years.length - 1];
  const cols = half ? "minmax(150px, 2fr) 90px 100px" : "minmax(260px, 2.6fr) 84px 120px 104px 120px 116px minmax(150px, 1.2fr)";
  const head = half ? ["Owner > customer > article", "Customers", "At stake"] : ["Owner > customer > article", "Customers", `Best year ${yearsLabel(d)}`, String(last), "Last 12 months + open orders", "At stake", "Erosion ticket"];
  const cell = { py: 0.7, px: 0.75, borderBottom: `1px solid ${HAIRLINE}`, fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", minWidth: 0 } as const;
  const num = { ...cell, justifyContent: "flex-end", textAlign: "right" } as const;
  const tot = owners.reduce((a, o) => ({ c: a.c + o.sums.customers, best: a.best + o.sums.best, last: a.last + o.sums.last, now: a.now + o.sums.now, gap: a.gap + o.sums.gap }), { c: 0, best: 0, last: 0, now: 0, gap: 0 });
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<TableRowsOutlinedIcon />} tint="blue" title="Owner > customer > article - as the erosion Excel"
        note={`Each line a customer and an article whose best year ${yearsLabel(d)} reached €${FLOOR.toLocaleString("en")} · click an owner, then a customer, to open it`} right={right} />
      {onKind && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mr: 0.5 }}>Lines shown:</Typography>
          {info.map((k) => (
            <Chip key={k.id} size="small" label={k.label} title={k.note} onClick={() => onKind(k.id)} variant={kinds.includes(k.id) ? "filled" : "outlined"}
              icon={<Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: KIND_COLOUR[k.id], ml: "8px !important" }} />}
              sx={{ height: 28, fontSize: "0.78rem", fontWeight: 700, bgcolor: kinds.includes(k.id) ? TINT.blue.bg : "#fff", color: INK }} />
          ))}
        </Box>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: half ? 0 : 1000, display: "grid", gridTemplateColumns: cols }}>
          {head.map((h, i) => <Typography key={h} sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i && i < head.length - (half ? 0 : 1) ? "right" : "left", px: 0.75, pb: 0.75, borderBottom: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "flex-end", justifyContent: i && i < head.length - (half ? 0 : 1) ? "flex-end" : "flex-start" }}>{h}</Typography>)}
          {owners.map((o) => {
            const oKey = o.owner || "none", isOpen = !!openO[oKey];
            const oTickets = actions.filter((a) => o.customers.some((c) => c.u === a.un));
            const shown = shownC[oKey] ?? 10;
            return (
              <Fragment key={oKey}>
                <Box role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpenO((x) => ({ ...x, [oKey]: !isOpen }))}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenO((x) => ({ ...x, [oKey]: !isOpen })); } }}
                  sx={{ display: "contents", cursor: "pointer", "& > *": { bgcolor: isOpen ? "#f4f7fc" : "transparent", fontWeight: 700 }, "&:hover > *": { bgcolor: "#f1f5fb" } }}>
                  <Box sx={{ ...cell, gap: 0.5 }}>{isOpen ? <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: MUTED }} />}<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ownerName(d, o.owner)}</Box></Box>
                  <Box sx={num}>{n0(o.sums.customers)}</Box>
                  {!half && <><Box sx={num}>{eur(o.sums.best)}</Box><Box sx={num}>{eur(o.sums.last)}</Box><Box sx={num}>{eur(o.sums.now)}</Box></>}
                  <Box sx={{ ...num, color: RED }}>{eur(o.sums.gap)}</Box>
                  {!half && <Box sx={{ ...cell, fontWeight: 500, fontSize: "0.78rem", color: MUTED }}>{oTickets.length ? `${n0(oTickets.length)} ticket${oTickets.length === 1 ? "" : "s"} · ${n0(oTickets.filter((x) => x.won).length)} won back` : "—"}</Box>}
                </Box>
                {isOpen && o.customers.slice(0, shown).map((c) => {
                  const cKey = `${oKey}|${c.u}`, cOpen = !!openC[cKey], co = d.companies[c.u];
                  return (
                    <Fragment key={cKey}>
                      <Box role="button" tabIndex={0} aria-expanded={cOpen} onClick={() => setOpenC((x) => ({ ...x, [cKey]: !cOpen }))}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenC((x) => ({ ...x, [cKey]: !cOpen })); } }}
                        sx={{ display: "contents", cursor: "pointer", "&:hover > *": { bgcolor: "#f7f9fc" } }}>
                        <Box sx={{ ...cell, pl: 3.5, gap: 0.5 }}>
                          {cOpen ? <ExpandMoreIcon sx={{ fontSize: 16, color: MUTED }} /> : <ChevronRightIcon sx={{ fontSize: 16, color: MUTED }} />}
                          <Box sx={{ display: "grid", minWidth: 0 }}>
                            <Box component="span" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {co?.id ? <Box component="a" href={HS_COMPANY(co.id)} target="_blank" rel="noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{customerName(d, c.u)}</Box> : customerName(d, c.u)}
                            </Box>
                            <Box component="span" sx={{ fontSize: "0.72rem", color: FAINT }}>{c.u}{co?.k ? ` · ${co.k}` : ""} · {n0(c.lines.length)} article{c.lines.length === 1 ? "" : "s"}</Box>
                          </Box>
                        </Box>
                        <Box sx={num} />
                        {!half && <><Box sx={num}>{eur(c.sums.best)}</Box><Box sx={num}>{eur(c.sums.last)}</Box><Box sx={num}>{eur(c.sums.now)}</Box></>}
                        <Box sx={{ ...num, color: RED, fontWeight: 600 }}>{eur(c.sums.gap)}</Box>
                        {!half && <Box sx={cell}><TicketCell list={actionsOf(actions, c.u)} /></Box>}
                      </Box>
                      {cOpen && !half && c.lines.map((l) => {
                        const art = d.articles[l.a];
                        return (
                          <Box key={l.a} sx={{ display: "contents", "& > *": { bgcolor: "#fbfcfe" } }}>
                            <Box sx={{ ...cell, pl: 7, gap: 0.75 }}>
                              <Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: KIND_COLOUR[l.kind], flex: "0 0 auto" }} title={info.find((k) => k.id === l.kind)?.label} />
                              <Box sx={{ display: "grid", minWidth: 0 }}>
                                <Box component="span" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{l.a}{art?.p ? ` · ${art.p}` : ""}</Box>
                                <Box component="span" title={artText(art?.t)} sx={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.find((k) => k.id === l.kind)?.label} · {artText(art?.t) || "—"}</Box>
                              </Box>
                            </Box>
                            <Box sx={num} />
                            <Box sx={num}>{eur(l.best)} <Box component="span" sx={{ fontSize: "0.7rem", color: FAINT, ml: 0.5 }}>({l.bestYear})</Box></Box>
                            <Box sx={num}>{eur(l.y[l.y.length - 1])}</Box>
                            <Box sx={num}>{eur(l.now)}</Box>
                            <Box sx={{ ...num, color: RED }}>{eur(l.gap)}</Box>
                            <Box sx={cell}><TicketCell list={actionsOf(actions, l.u, l.a)} /></Box>
                          </Box>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {isOpen && o.customers.length > shown && (
                  <Box sx={{ gridColumn: "1 / -1", py: 0.75, pl: 3.5, borderBottom: `1px solid ${HAIRLINE}` }}>
                    <Button size="small" onClick={() => setShownC((x) => ({ ...x, [oKey]: shown + 10 }))} sx={{ textTransform: "none", fontWeight: 700 }}>
                      {o.customers.length - shown > 10 ? `10 more - ${n0(o.customers.length - shown)} left` : `The last ${n0(o.customers.length - shown)}`}
                    </Button>
                  </Box>
                )}
              </Fragment>
            );
          })}
          {!half && owners.length > 0 && (
            <Box sx={{ display: "contents", "& > *": { fontWeight: 800, bgcolor: "#f4f7fc" } }}>
              <Box sx={cell}>Total</Box><Box sx={num}>{n0(tot.c)}</Box><Box sx={num}>{eur(tot.best)}</Box><Box sx={num}>{eur(tot.last)}</Box><Box sx={num}>{eur(tot.now)}</Box><Box sx={{ ...num, color: RED }}>{eur(tot.gap)}</Box><Box sx={cell} />
            </Box>
          )}
        </Box>
      </Box>
      {!owners.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing at stake for this choice.</Typography>}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        At stake = the best year less the last 12 months and the open orders. Erosion ticket: raised by the hub&apos;s daily detector when a customer did not buy an article again within a year of the last purchase; won back = closed as Ordered.
        {actionsError ? <Box component="span" sx={{ color: RED }}> The tickets could not be read: {actionsError}</Box> : null}
      </Typography>
    </GlassCard>
  );
}

/** What is not in the headline: lost before, one year only, made to order - each can join the pivot. */
function ApartCard({ d, f, kinds, right, onKind }: Ctx) {
  const k = byKind(d, f);
  const apart = kindInfo(d.years).filter((x) => !HEADLINE.includes(x.id));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<InventoryOutlinedIcon />} tint="slate" title="Not in the headline - shown apart" note="Lines below their best year that are not a customer buying less now: one order, a project, or lost years ago" right={right} />
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" } }}>
        {apart.map((x) => {
          const on = kinds.includes(x.id);
          return (
            <Box key={x.id} sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, borderRadius: "14px", p: 1.5, display: "grid", gap: 0.5, bgcolor: on ? TINT.blue.bg : "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: KIND_COLOUR[x.id] }} />
                <Typography sx={{ flex: 1, fontSize: "0.88rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{eur(k[x.id].gap)}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{n0(k[x.id].customers)} customers, {n0(k[x.id].lines)} articles - {x.note}</Typography>
              {onKind && <Box><Button size="small" onClick={() => onKind(x.id)} sx={{ textTransform: "none", fontWeight: 700, px: 0 }}>{on ? "Take out of the pivot" : "Show in the pivot"}</Button></Box>}
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

/** Every card by its key "<tab>:<card>" - the page draws them, and so does the nutshell. */
const CARDS: Record<string, { title: string; draw: (c: Ctx) => React.ReactNode }> = {
  "owners:gap": { title: "At stake by owner", draw: (c) => <OwnerSplitCard {...c} /> },
  "owners:pivot": { title: "Owner > customer > article", draw: (c) => <PivotCard {...c} /> },
  "owners:apart": { title: "Not in the headline", draw: (c) => <ApartCard {...c} /> },
};

/** The card the nutshell's Retain & grow panel starts with (demotable). */
export const RETAIN_NUTSHELL_CARDS = [{ key: "retain:owners:gap", title: "At stake by owner" }];

/** A Retain & grow card promoted to the nutshell - the same card as on the page, with its filters. */
export function RetainPromoted({ spec, actions, half }: { spec: TileSpec; actions: React.ReactNode; half?: boolean }) {
  const r = useRetain();
  const [, tab, card] = spec.key.split(":");
  const c = CARDS[`${tab}:${card}`];
  if (!r.d || !c) {
    return <GlassCard><CardTitle icon={<TrendingDownOutlinedIcon />} tint="amber" title={c?.title ?? spec.title} note={r.d ? "This card is no longer on its page - Actions takes it off here." : "Reading the orders…"} right={actions} /></GlassCard>;
  }
  const ff = spec.filters ?? {};
  const kinds = (ff.kind?.length ? ff.kind : HEADLINE) as Kind[];
  return <>{c.draw({ d: r.d, f: { owner: ff.owner, country: ff.country, pc: ff.pc }, kinds, actions: r.actions, actionsError: r.actionsError, right: actions, half })}</>;
}

export function RetainExplorer({ state }: { state: MkState | null }) {
  void state;
  const params = useSearchParams();
  const r = useRetain();
  const d = r.d;
  const pick = (k: string) => params.getAll(k);
  const [owners, setOwners] = useState<string[]>(() => pick("owner"));
  const [countries, setCountries] = useState<string[]>(() => pick("country"));
  const [pcs, setPcs] = useState<string[]>(() => pick("pc"));
  const [kinds, setKinds] = useState<Kind[]>(() => { const k = pick("kind") as Kind[]; return k.length ? k : HEADLINE; });
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openOwner, setOpenOwner] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    for (const [k, xs] of [["owner", owners], ["country", countries], ["pc", pcs]] as const) for (const x of xs) q.append(k, x);
    if (kinds.join() !== HEADLINE.join()) for (const k of kinds) q.append("kind", k);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [owners, countries, pcs, kinds]);

  const f: RFilters = { owner: owners, country: countries, pc: pcs };
  const flip = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const options = useMemo(() => {
    if (!d) return null;
    const all = eroding(d, {});
    return { owners: totalsBy(all, keyOwner(d)).map(([k]) => k), countries: totalsBy(all, keyCountry(d)).map(([k]) => k), pcs: totalsBy(all, keyPc(d)).map(([k]) => k) };
  }, [d]);
  const chosenCount = owners.length + countries.length + pcs.length;
  const filters = Object.fromEntries(([["owner", owners], ["country", countries], ["pc", pcs], ["kind", kinds.join() === HEADLINE.join() ? [] : kinds]] as const).filter(([, xs]) => xs.length)) as Record<string, string[]>;
  const clearAll = () => { setOwners([]); setCountries([]); setPcs([]); };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start={RETAIN_NUTSHELL_CARDS.some((x) => x.key === `retain:owners:${key}`) ? "nutshell" : "tab"}
      tile={{ key: `retain:owners:${key}`, page: "retain", tab: "owners", title, filters, kind: "card" }} />
  );

  if (!d || !options) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!r.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: r.error ? RED : MUTED }}>{r.error ? `Could not load: ${r.error}` : `Reading the orders since ${new Date().getFullYear() - 5}… a quarter of an hour the first time${r.progress ? ` · ${r.progress}` : ""}`}</Typography>
      </Box></GlassCard>
    );
  }
  const ctx: Ctx = { d, f, kinds, actions: r.actions, actionsError: r.actionsError, onKind: (k) => setKinds((xs) => { const next = flip(xs, k); return next.length ? next : HEADLINE; }) };

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Retain &amp; grow
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>Erosion at stake</b> on {new Date(d.asOf).toLocaleDateString("en-GB")} · the articles a customer still buys below its best year {yearsLabel(d)}, or stopped buying since {d.years[d.years.length - 2]} - against the last 12 months and the open orders, as the erosion Excel{r.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {owners.map((x) => <Chip key={x} size="small" label={<span><b>Owner:</b> {ownerName(d, x)}</span>} onDelete={() => setOwners(flip(owners, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {countries.map((x) => <Chip key={x} size="small" label={<span><b>Country:</b> {x}</span>} onDelete={() => setCountries(flip(countries, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              {pcs.map((x) => <Chip key={x} size="small" label={<span><b>Profit centre:</b> {x}</span>} onDelete={() => setPcs(flip(pcs, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures d={d} f={f} actions={r.actions} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="retain" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="retain-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {CARDS["owners:gap"].draw({ ...ctx, right: act("gap", "At stake by owner"), onOwner: (o) => { setOpenOwner(o); document.getElementById("retain-pivot")?.scrollIntoView({ behavior: "smooth", block: "start" }); } })}
      <Box id="retain-pivot" sx={{ scrollMarginTop: "16px", minWidth: 0 }}><PivotCard {...ctx} right={act("pivot", "Owner > customer > article")} openOwner={openOwner} /></Box>
      {CARDS["owners:apart"].draw({ ...ctx, right: act("apart", "Not in the headline") })}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - {n0(d.orders)} order documents since January {d.years[0]}{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 24 hours. Money is what was invoiced (the order as placed and its invoiced deliveries are never both counted); credit notes are left out; a line&apos;s year is its invoice&apos;s. Open orders: ordered and not invoiced yet, for orders of the last two years. {n0(d.noCustomer)} documents without a customer number (web orders the ERP has not numbered yet) are not in it.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="retain-filters" open={panel} onClose={() => setPanel(false)} subtitle="The owner, the country, the profit centre" onClearAll={chosenCount ? clearAll : undefined}>
        <FilterSection id="rt-f-owner" index={0} title="Owner" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.owner} onFlip={() => setOpen((o) => ({ ...o, owner: !o.owner }))} summary={owners.length ? `${owners.length} chosen` : "All"} chosen={owners.length > 0}>
          {options.owners.map((o) => <Pick key={o || "none"} on={owners.includes(o)} label={ownerName(d, o)} onClick={() => setOwners(flip(owners, o))} />)}
        </FilterSection>
        <FilterSection id="rt-f-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {options.countries.map((k) => <Pick key={k} on={countries.includes(k)} label={k} onClick={() => setCountries(flip(countries, k))} />)}
        </FilterSection>
        <FilterSection id="rt-f-pc" index={2} title="Profit centre" icon={<WorkspacesOutlinedIcon />} tint="amber" open={!!open.pc} onFlip={() => setOpen((o) => ({ ...o, pc: !o.pc }))} summary={pcs.length ? pcs.join(", ") : "All"} chosen={pcs.length > 0}>
          {options.pcs.map((p) => <Pick key={p} on={pcs.includes(p)} label={p} onClick={() => setPcs(flip(pcs, p))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}
