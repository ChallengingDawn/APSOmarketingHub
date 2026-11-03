"use client";
// WHAT A ROW IS MEASURED BY, IN ITS KPI VIEW (SARCLA 03.11.2026: "a library of the reports available on Advanced
// reporting ... select multiple and here set up a target and measure the success per KPI, or ask the AI to read all the
// actions and bring proposed KPIs aligned with the sub-actions" - planKpiRules.ts). Its KPIs, each with where it stands
// against its target: a catalogue KPI the hub reads, live - its year so far, the very figure of its Digital Growth page
// (buildViews) - a report, or a KPI the hub does not read, by the figure typed. Picked from the library, searched by name
// or place in Advanced reporting, or proposed by the AI from the row and what is under it. A category shows, under its
// own, those of its actions.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { PlanItem } from "@/lib/reporting/actionPlanRules";
import { figureText, numberOf, progressOf, type LibNode } from "@/lib/reporting/planKpiRules";
import type { KpiProposal, PlanKpi } from "@/lib/reporting/planKpis";
import { fmtValue, type Fmt } from "@/lib/marketingKpis/measures";
import { buildViews, periodOf, useMarketingKpis, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import { AI_INK, AI_LINE, AI_SOFT, field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { label } from "./SubActions";

const card = { display: "grid", rowGap: 1.75, columnGap: 1.25, p: 2, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, alignContent: "start" } as const;
const section = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "6px", fontSize: "0.86rem" } as const;
const TAG = { flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px" } as const;
const kpiIdOf = (key: string) => (key.startsWith("kpi:") ? key.slice(4) : null);

/** A figure in the KPI's own form - a rate as a percentage - or as typed. */
const display = (fmt: Fmt | null, v: number | null) => (fmt ? fmtValue(fmt, v) : v == null ? "—" : v.toLocaleString("en", { maximumFractionDigits: 2 }));
/** What a box shows and reads: a rate typed in percent, kept as a fraction as the KPI's figures are. */
const boxOf = (fmt: Fmt | null, v: number | null) => (v == null ? "" : fmt === "pct" ? String(+(v * 100).toFixed(2)) : String(v));
const readBox = (fmt: Fmt | null, text: string) => { const n = numberOf(text); return n == null ? null : fmt === "pct" ? n / 100 : n; };
const STATE = { reached: GREEN, close: TINT.amber.fg, behind: RED, none: HAIRLINE } as const;
/** The cards, as many in a row as the window holds. */
const GRID = { display: "grid", gap: 1.25, gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" } as const;

/** A figure typed in place - a quiet box until it is used, handed up when it is left. */
function InlineNumber({ value, fmt, placeholder, canWrite, onSave, big = false }: {
  value: number | null; fmt: Fmt | null; placeholder: string; canWrite: boolean; onSave: (v: number | null) => void; big?: boolean;
}) {
  const [v, setV] = useState(boxOf(fmt, value));
  useEffect(() => { setV(boxOf(fmt, value)); }, [fmt, value]);
  return (
    <Box component="input" value={v} placeholder={placeholder} disabled={!canWrite} inputMode="decimal"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setV(e.target.value)}
      onBlur={() => { const n = readBox(fmt, v); if (n !== value) onSave(n); }}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      sx={{ all: "unset", boxSizing: "border-box", width: big ? "100%" : 110, px: 0.75, py: big ? 0.25 : 0.4, borderRadius: "6px", border: "1px solid transparent",
        font: "inherit", fontSize: big ? "1.7rem" : "0.86rem", fontWeight: big ? 800 : 700, color: INK, fontVariantNumeric: "tabular-nums",
        "&::placeholder": { color: FAINT, fontWeight: big ? 600 : 500, fontSize: big ? "0.95rem" : "0.82rem" },
        "&:hover": canWrite ? { borderColor: HAIRLINE } : {}, "&:focus": { borderColor: TINT.blue.fg, bgcolor: "#fff" } }} />
  );
}

/**
 * One KPI as a card (SARCLA 03.11.2026: "I really don't like the design like this" of the rows; "we should see the real
 * KPIs"): its name and place, its figure large - live, the year so far of its Digital Growth page; as its page last
 * showed it, the graph's own words under it; or typed where the hub reads nothing - its target in place, how far, and
 * which way is better. Read only on a category's view of its actions'.
 */
function KpiCard({ k, place, view, shown, parts, canWrite, onSet, onRemove }: {
  k: PlanKpi;
  /** where it is in Advanced reporting now - gone from it, its address as it was */
  place: string | null;
  view: KpiView | undefined;
  /** what its graph showed when its page was last drawn */
  shown: LibNode["shown"];
  /** a page or a report picked whole: what its graphs show */
  parts?: LibNode["parts"];
  canWrite: boolean; onSet: (p: { target?: number | null; goodUp?: boolean; current?: number | null }) => void; onRemove?: () => void;
}) {
  const live = !!view && view.ytd != null;
  const fromPage = !live && !!shown && shown.value != null;
  const fmt: Fmt | null = live ? view!.measure.fmt : null;
  const current = live ? view!.ytd : fromPage ? shown!.value : k.current;
  const p = progressOf(current, k.target, k.goodUp);
  const when = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ""}` : "");
  return (
    // one column the card's width: a long line is cut, never widening the card past its border
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.9, p: 1.75, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, borderTop: `3px solid ${STATE[p.state]}`, bgcolor: "#fff", alignContent: "start", minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box component="a" href={k.href} target="_blank" rel="noopener" title="Open it in Advanced reporting"
            sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: "0.92rem", fontWeight: 750, color: INK, lineHeight: 1.3, textDecoration: "none", "&:hover": { color: TINT.blue.fg, textDecoration: "underline" } }}>{k.label}</Box>
          <Typography noWrap title={place ?? k.href} sx={{ fontSize: "0.74rem", color: FAINT }}>{place ?? `no longer in Advanced reporting (${k.href})`}</Typography>
        </Box>
        <Box sx={{ ...TAG, mt: 0.25, bgcolor: live || fromPage ? TINT.green.bg : "#eef1f6", color: live || fromPage ? TINT.green.fg : MUTED }}>{live || fromPage ? "LIVE" : "TYPED"}</Box>
        {onRemove && canWrite && <IconButton size="small" aria-label={`Take “${k.label}” off`} onClick={onRemove} sx={{ p: 0.25, mt: -0.25 }}><CloseIcon sx={{ fontSize: 17, color: FAINT }} /></IconButton>}
      </Box>
      <Box sx={{ minHeight: 64 }}>
        {live || fromPage ? (
          <Typography sx={{ fontSize: "1.7rem", fontWeight: 800, color: INK, letterSpacing: "-0.01em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
            {/* as its graph writes it - "73.4%", "CHF 4'000" - when it comes from the page */}
            {fromPage ? figureText(shown!.text.slice(shown!.text.indexOf(": ") + 1)) ?? display(null, current) : display(fmt, current)}
          </Typography>
        ) : (
          <InlineNumber value={k.current} fmt={null} placeholder="Type where it stands" canWrite={canWrite} big onSave={(v) => onSet({ current: v })} />
        )}
        <Typography noWrap title={fromPage ? shown!.text : undefined} sx={{ fontSize: "0.76rem", color: MUTED }}>
          {live ? `${periodOf(view!)}${k.unit ? ` · ${k.unit}` : ""}`
            : fromPage ? `${shown!.text}${shown!.at ? ` · as its page showed it ${when(shown!.at)}` : ""}`
            : k.currentAt ? `typed · as of ${when(k.currentAt)}` : "the hub does not read it - typed"}
        </Typography>
      </Box>
      {/* a whole page: its other graphs' figures, each by name */}
      {fromPage && parts && parts.length > 1 && (
        <Box sx={{ display: "grid", gap: 0.25, pt: 0.5, borderTop: `1px dashed ${HAIRLINE}` }}>
          {parts.slice(1, 5).map((x) => (
            <Box key={x.name} sx={{ display: "flex", gap: 0.75, alignItems: "baseline", minWidth: 0 }}>
              <Typography noWrap sx={{ flex: 1, fontSize: "0.76rem", color: MUTED, minWidth: 0 }}>{x.name}</Typography>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{figureText(x.text) ?? display(null, x.value)}</Typography>
            </Box>
          ))}
          {parts.length > 5 && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>and {parts.length - 5} more on the page</Typography>}
        </Box>
      )}
      <Box sx={{ height: 6, borderRadius: "3px", bgcolor: "#eef1f6", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.min(1, p.share ?? 0) * 100}%`, bgcolor: STATE[p.state] }} />
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 750, color: STATE[p.state] }}>
          {p.share == null ? (k.target == null ? "No target yet" : "No figure yet") : `${Math.round(p.share * 100)} % of target`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Target</Typography>
        {canWrite
          ? <InlineNumber value={k.target} fmt={fmt} placeholder="set it" canWrite onSave={(v) => onSet({ target: v })} />
          : <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{k.target == null ? "—" : display(fmt, k.target)}</Typography>}
        {fmt === "pct" && <Typography sx={{ fontSize: "0.78rem", color: FAINT, ml: -0.5 }}>%</Typography>}
      </Box>
      {canWrite && (
        <Box component="button" type="button" onClick={() => onSet({ goodUp: !k.goodUp })} title="Click to turn it round"
          sx={{ all: "unset", cursor: "pointer", justifySelf: "start", fontSize: "0.74rem", color: FAINT, "&:hover": { color: TINT.blue.fg } }}>{k.goodUp ? "↑ higher is better" : "↓ lower is better"}</Box>
      )}
    </Box>
  );
}

/**
 * The library to browse, as Advanced reporting's side panel has it (SARCLA 03.11.2026: "I mean the individual reports
 * like a library, not like this - this should be hierarchy dynamic for picking up"): its categories on the left, the
 * chosen one's reports and their pages in the middle - under the side panel's headings - and on the right what the
 * page opened draws, graph by graph, its KPIs with their figure when the hub reads them. Anything ticked, at any level -
 * a whole page, a graph, a KPI; a search over the whole library keeps each one's place.
 */
function LibraryBrowser({ tree, views, taken, busy, onAdd, onCancel }: {
  tree: LibNode[]; views: Record<string, KpiView>; taken: Set<string>; busy: boolean; onAdd: (picks: LibNode[]) => void; onCancel: () => void;
}) {
  const [cat, setCat] = useState(tree[0]?.key ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<LibNode[]>([]);
  const all = useMemo(() => {
    const out: LibNode[] = [];
    const seen = new Set<string>();
    const walk = (n: LibNode) => { if (n.kind !== "category" && !seen.has(n.key)) { seen.add(n.key); out.push(n); } n.children.forEach(walk); };
    tree.forEach(walk);
    return out;
  }, [tree]);
  const category = tree.find((c) => c.key === cat) ?? tree[0];
  const inside = (n: LibNode) => n.children.filter((c) => c.kind === "graph" || c.kind === "kpi");
  const count = (n: LibNode): number => n.children.reduce((sum, c) => sum + (c.kind === "graph" || c.kind === "kpi" ? 1 : count(c)), 0);
  const shown = open ? all.find((n) => n.key === open) : undefined;
  const on = (n: LibNode) => pick.some((x) => x.key === n.key);
  const toggle = (n: LibNode) => setPick((p) => (p.some((x) => x.key === n.key) ? p.filter((x) => x.key !== n.key) : [...p, n]));
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? all.filter((n) => words.every((w) => `${n.name} ${n.path} ${n.definition ?? ""}`.toLowerCase().includes(w))).slice(0, 150) : [];
  const liveOf = (n: LibNode) => (n.kpiId ? views[n.kpiId] : undefined);
  const col = { minWidth: 0, overflowY: "auto", p: 0.75, display: "grid", alignContent: "start", gap: 0.25 } as const;

  // a row of the library: the box to tick, its name, what it is, and - when something is in it - the way in
  const row = (n: LibNode, opts: { depth?: number; showPath?: boolean } = {}) => {
    const had = taken.has(n.key);
    const v = liveOf(n);
    const into = n.kind === "report" || n.kind === "page";
    const active = open === n.key;
    const k = into ? count(n) : 0;
    return (
      <Box key={n.key} sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 0.5 + (opts.depth ?? 0) * 2, pr: 0.5, py: 0.25, borderRadius: "6px", bgcolor: active ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: active ? TINT.blue.bg : "#f3f6fb" } }}>
        <Checkbox size="small" checked={had || on(n)} disabled={had} onChange={() => toggle(n)} sx={{ p: 0.4 }} slotProps={{ input: { "aria-label": `Pick ${n.name}` } }} />
        <Box component={into ? "button" : "div"} type={into ? "button" : undefined} onClick={into ? () => setOpen(n.key) : undefined}
          sx={{ all: "unset", flex: 1, minWidth: 0, cursor: into ? "pointer" : "default", display: "grid", py: 0.25 }}>
          <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: "0.85rem", fontWeight: n.kind === "report" ? 750 : 600, color: had ? FAINT : INK, minWidth: 0 }}>{n.name}</Typography>
            {n.kind === "kpi" && <Box sx={{ ...TAG, bgcolor: v?.ytd != null ? TINT.green.bg : "#eef1f6", color: v?.ytd != null ? TINT.green.fg : MUTED }}>{v?.ytd != null ? `LIVE ${display(v.measure.fmt, v.ytd)}` : "KPI"}</Box>}
            {n.kind === "graph" && <Box sx={{ ...TAG, bgcolor: n.shown?.value != null ? TINT.green.bg : "#eef1f6", color: n.shown?.value != null ? TINT.green.fg : MUTED }}>{n.shown?.value != null ? `LIVE ${display(null, n.shown.value)}` : "GRAPH"}</Box>}
            {n.kind === "kpi" && v?.ytd == null && n.shown?.value != null && <Box sx={{ ...TAG, bgcolor: TINT.green.bg, color: TINT.green.fg }}>{`LIVE ${display(null, n.shown.value)}`}</Box>}
            {had && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>added</Typography>}
          </Box>
          {(opts.showPath || n.definition) && (
            <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT }}>{[opts.showPath ? n.path : "", n.definition ?? ""].filter(Boolean).join(" · ")}</Typography>
          )}
        </Box>
        {into && <Typography sx={{ fontSize: "0.72rem", color: FAINT, flexShrink: 0 }}>{k || ""}</Typography>}
        {into && <ChevronRightIcon sx={{ fontSize: 18, color: active ? TINT.blue.fg : FAINT, flexShrink: 0 }} />}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.5, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fbfcfe" }}>
      <TextField size="small" label="The library - Advanced reporting" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every report, page, graph and KPI - or browse below"
        sx={field} slotProps={{ inputLabel: { shrink: true }, input: { startAdornment: <SearchIcon sx={{ fontSize: 18, color: FAINT, mr: 0.75 }} /> } }} />
      {words.length > 0 ? (
        <Box sx={{ ...col, maxHeight: 400, bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: "8px" }}>
          {!hits.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT, p: 1 }}>Nothing in the library with these words.</Typography>}
          {hits.map((n) => row(n, { showPath: true }))}
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "230px minmax(0, 1fr) minmax(0, 1.3fr)" }, height: { md: 400 }, bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: "8px", overflow: "hidden" }}>
          {/* its categories */}
          <Box sx={{ ...col, borderRight: { md: `1px solid ${HAIRLINE}` } }}>
            {tree.map((c) => {
              const active = c.key === category?.key;
              return (
                <Box key={c.key} component="button" type="button" onClick={() => { setCat(c.key); setOpen(null); }}
                  sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, borderRadius: "6px", bgcolor: active ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: active ? TINT.blue.bg : "#f3f6fb" } }}>
                  <Typography sx={{ flex: 1, fontSize: "0.85rem", fontWeight: active ? 800 : 650, color: active ? TINT.blue.fg : INK }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{count(c) || ""}</Typography>
                </Box>
              );
            })}
          </Box>
          {/* the chosen category's reports and their pages, under the side panel's headings */}
          <Box sx={{ ...col, borderRight: { md: `1px solid ${HAIRLINE}` } }}>
            {!category?.children.length && <Typography sx={{ fontSize: "0.82rem", color: FAINT, p: 1 }}>No report in it yet.</Typography>}
            {category?.children.map((r) => {
              let last: string | undefined;
              return (
                <Box key={r.key} sx={{ display: "grid", gap: 0.25, mb: 0.5 }}>
                  {row(r)}
                  {r.children.filter((c) => c.kind === "page").map((pg) => {
                    const head = pg.group !== last ? pg.group : undefined;
                    last = pg.group;
                    return (
                      <Box key={pg.key}>
                        {head && <Typography sx={{ ...section, fontSize: "0.66rem", pl: 4.5, pt: 0.75, pb: 0.25 }}>{head}</Typography>}
                        {row(pg, { depth: 1 })}
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
          {/* what the page opened draws */}
          <Box sx={col}>
            {!shown ? (
              <Typography sx={{ fontSize: "0.82rem", color: FAINT, p: 1 }}>Open a report or a page to see its graphs and KPIs - or tick it whole.</Typography>
            ) : (
              <>
                <Typography sx={{ ...section, px: 1, pt: 0.5 }}>{shown.name}</Typography>
                {!inside(shown).length && (
                  <Typography sx={{ fontSize: "0.82rem", color: FAINT, px: 1, py: 0.5 }}>
                    {shown.kind === "report" && shown.children.length ? "Its pages are in the middle - open one." : "No graph of this page known yet - a page's graphs are listed once it has been opened. The page itself can be ticked."}
                  </Typography>
                )}
                {inside(shown).map((n) => row(n))}
              </>
            )}
          </Box>
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, display: "flex", gap: 0.5, flexWrap: "wrap", minWidth: 0 }}>
          {!pick.length && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Tick what measures it - a whole page, a graph or a KPI.</Typography>}
          {pick.map((n) => (
            <Box key={n.key} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, pl: 0.9, pr: 0.25, py: 0.15, borderRadius: "4px", border: `1px solid ${TINT.blue.fg}`, bgcolor: TINT.blue.bg }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: TINT.blue.fg }}>{n.name}</Typography>
              <IconButton size="small" aria-label={`Untick ${n.name}`} onClick={() => toggle(n)} sx={{ p: 0.2 }}><CloseIcon sx={{ fontSize: 14, color: TINT.blue.fg }} /></IconButton>
            </Box>
          ))}
        </Box>
        <Button onClick={onCancel} sx={{ ...cta, color: MUTED }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!pick.length || busy} onClick={() => onAdd(pick)} sx={cta}>{pick.length > 1 ? `Add these ${pick.length}` : "Add it"}</Button>
      </Box>
    </Box>
  );
}

export function PlanKpis({ item, items, canWrite, onOpen }: { item: PlanItem; items: PlanItem[]; canWrite: boolean; onOpen: (i: PlanItem) => void }) {
  // the library, read from the hub: Advanced reporting's tree, the graphs its pages have drawn in it
  const [tree, setTree] = useState<LibNode[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/action-plan/kpis?library=1").then((r) => r.json()).then((j) => { if (live && j.ok) setTree(j.tree as LibNode[]); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const { places, shownBy, partsBy } = useMemo(() => {
    const m = new Map<string, string>();
    const shown = new Map<string, LibNode["shown"]>();
    const walk = (n: LibNode) => {
      if (n.kind !== "category" && !m.has(n.key)) m.set(n.key, n.kind === "report" || n.kind === "page" ? `${n.path} › ${n.name}` : n.path);
      if (n.shown && !shown.has(n.key)) shown.set(n.key, n.shown);
      n.children.forEach(walk);
    };
    (tree ?? []).forEach(walk);
    const parts = new Map<string, NonNullable<LibNode["parts"]>>();
    const walkParts = (n: LibNode) => { if (n.parts && !parts.has(n.key)) parts.set(n.key, n.parts); n.children.forEach(walkParts); };
    (tree ?? []).forEach(walkParts);
    return { places: m, shownBy: shown, partsBy: parts };
  }, [tree]);
  const [mk] = useMarketingKpis();
  const live = mk?.live?.value;
  const views = useMemo<Record<string, KpiView>>(() => (mk?.inputs && live ? buildViews(mk.inputs, live, live.year) : {}), [mk?.inputs, live]);
  const [data, setData] = useState<{ kpis: PlanKpi[]; under: PlanKpi[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [ai, setAi] = useState<{ busy: boolean; list: (KpiProposal & { on: boolean })[]; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/action-plan/kpis?item=${item.id}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? `the hub answered ${r.status}`);
      setData({ kpis: j.kpis, under: j.under }); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [item.id]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try { const j = await send("/api/action-plan/kpis", "POST", body); await load(); return j; } catch (e) { setErr((e as Error).message); return null; } finally { setBusy(false); }
  };
  const picked = new Set((data?.kpis ?? []).map((k) => k.key));
  const viewOf = (k: PlanKpi) => { const id = kpiIdOf(k.key); return id ? views[id] : undefined; };
  const propose = async () => {
    setAi({ busy: true, list: [], note: "" });
    const j = await post({ action: "propose", item: item.id }) as { proposals?: KpiProposal[]; note?: string } | null;
    setAi(j ? { busy: false, list: (j.proposals ?? []).map((x) => ({ ...x, on: true })), note: j.note ?? "" } : null);
  };
  const byAction = useMemo(() => {
    const m = new Map<number, PlanKpi[]>();
    for (const k of data?.under ?? []) (m.get(k.item) ?? m.set(k.item, []).get(k.item)!).push(k);
    return [...m.entries()].map(([id, ks]) => ({ a: items.find((i) => i.id === id), ks })).filter((x): x is { a: PlanItem; ks: PlanKpi[] } => !!x.a);
  }, [data?.under, items]);
  const n = data?.kpis.length ?? 0;

  return (
    <Box sx={card}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <TrackChangesIcon sx={{ fontSize: 18, color: FAINT }} />
        <Typography sx={{ ...section, flex: 1 }}>Measured by{n ? ` · ${n} KPI${n === 1 ? "" : "s"}` : ""}</Typography>
        {canWrite && (
          <>
            <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 17 }} />} disabled={busy || ai?.busy} onClick={() => void propose()}
              sx={{ ...cta, color: AI_INK, "&:hover": { bgcolor: AI_SOFT } }}>Propose with AI</Button>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 18 }} />} onClick={() => setAdding((o) => !o)} sx={{ ...cta, color: TINT.blue.fg }}>Add KPIs</Button>
          </>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -1 }}>
        Picked from Advanced reporting - each shows its real figure: live from its Digital Growth page, or as its graph last showed it; typed only where the hub reads nothing.
      </Typography>
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}

      {adding && (tree ? (
        <LibraryBrowser tree={tree} views={views} taken={picked} busy={busy} onCancel={() => setAdding(false)}
          onAdd={(picks) => void post({ action: "add", item: item.id, picks: picks.map((x) => ({ key: x.key, goodUp: x.kpiId ? views[x.kpiId]?.measure.goodWhenUp !== false : true })) }).then(() => setAdding(false))} />
      ) : (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the library…</Typography></Box>
      ))}

      {ai && (
        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "10px", border: `1px solid ${AI_LINE}`, bgcolor: AI_SOFT }}>
          <Typography sx={{ ...section, color: AI_INK }}>The AI proposes{item.kind === "action" ? " - from its sub-actions" : " - from its actions"}</Typography>
          {ai.busy && <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the row and what is under it…</Typography></Box>}
          {!ai.busy && !ai.list.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{ai.note || "Nothing to propose."}</Typography>}
          {ai.list.map((x, i) => {
            const id = kpiIdOf(x.key);
            const fmt = id ? views[id]?.measure.fmt ?? null : null;
            return (
              <Box key={x.key} component="label" sx={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 0.5, alignItems: "start", cursor: "pointer" }}>
                <Checkbox size="small" checked={x.on} onChange={(e) => setAi((a) => a && { ...a, list: a.list.map((y, k) => (k === i ? { ...y, on: e.target.checked } : y)) })} sx={{ p: 0.25 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>
                    {x.name}{x.target != null ? <Box component="span" sx={{ fontWeight: 600, color: MUTED }}> · target {display(fmt, x.target)}{x.goodUp ? "" : " or less"}</Box> : null}
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{x.path} · {x.why}</Typography>
                </Box>
              </Box>
            );
          })}
          {!ai.busy && (
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button onClick={() => setAi(null)} sx={{ ...cta, color: MUTED }}>Discard</Button>
              {ai.list.length > 0 && (
                <Button variant="contained" disableElevation disabled={busy || !ai.list.some((x) => x.on)}
                  onClick={() => void post({ action: "add", item: item.id, picks: ai.list.filter((x) => x.on).map((x) => ({ key: x.key, target: x.target, goodUp: x.goodUp })) }).then(() => setAi(null))}
                  sx={{ ...cta, bgcolor: AI_INK, "&:hover": { bgcolor: "#5a3ab0" } }}>Add the {ai.list.filter((x) => x.on).length} ticked</Button>
              )}
            </Box>
          )}
        </Box>
      )}

      {!data && !err && <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Reading its KPIs…</Typography></Box>}
      {data && !n && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>None yet - add them from Advanced reporting, or let the AI propose them.</Typography>}
      {n > 0 && (
        <Box sx={GRID}>
          {data!.kpis.map((k) => (
            <KpiCard key={k.id} k={k} place={places.get(k.key) ?? null} view={viewOf(k)} shown={shownBy.get(k.key)} parts={partsBy.get(k.key)} canWrite={canWrite}
              onSet={(p) => void post({ action: "set", id: k.id, ...p })} onRemove={() => void post({ action: "remove", id: k.id })} />
          ))}
        </Box>
      )}

      {/* a category: its actions' KPIs too, each action a heading that opens it */}
      {byAction.length > 0 && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ ...label, mt: 0.5 }}>Its actions&apos; KPIs</Typography>
          {byAction.map(({ a, ks }) => (
            <Box key={a.id} sx={{ display: "grid", gap: 0.75 }}>
              <Box component="button" type="button" onClick={() => onOpen(a)}
                sx={{ all: "unset", cursor: "pointer", fontSize: "0.84rem", fontWeight: 700, color: TINT.blue.fg, "&:hover": { textDecoration: "underline" } }}>{a.title}</Box>
              <Box sx={GRID}>
                {ks.map((k) => <KpiCard key={k.id} k={k} place={places.get(k.key) ?? null} view={viewOf(k)} shown={shownBy.get(k.key)} parts={partsBy.get(k.key)} canWrite={false} onSet={() => undefined} />)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
