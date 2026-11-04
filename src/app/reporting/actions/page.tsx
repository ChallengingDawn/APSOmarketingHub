"use client";
// A KPI'S ACTIONS - THE ACTION CREATION MODULE OF ADVANCED REPORTING (SARCLA 04.11.2026: "open the action page on the
// KPI, a wider window with different designs and sizes per graphic you can choose - half width and full width are
// kept, to not mess around with the current BUC View - and more versions: a mini editor in styles, same data of
// course. Then on the left create an action, like a collapsible, with the same table view as on the action plan, and
// allow to create from the KPI directly"; "also on the KPI itself you should set a target, and if it is shared to the
// KPIs of the action plan"; "this is the creation action module on Advanced reporting"). Opened by the Actions tab on
// any graph (TileActions -> handoff.ts). Three parts, the whole width:
//  - left, folds away: the action plan's own table and forms (PlanPanel) - only for whoever has the plan (admins);
//    anyone else gets the KPI's own task form there;
//  - centre: the graph, its size in the BUC View (Small tile / Half / Full, as before) and - for a KPI with its
//    figures - its style (tileStyles.ts), saved for everyone as it is picked;
//  - right: its target with "Action plan · KPIs", and what tracks it.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { Placement, TileFormat, TileSpec } from "@/lib/reporting/kpiActions";

import { TILE_STYLES, stylesFor, styleShown, type TileStyle } from "@/lib/reporting/tileStyles";
import { FORMAT_LABEL, formatOf, formatsFor, placementOf, refreshActions, send, styleOf, targetOf, useActions } from "@/app/reporting/marketing-kpis/tiles/store";
import { AddTask, TargetBox, useTileActions } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KpiStyled, KpiTileChart, shapeOf } from "@/app/reporting/marketing-kpis/tiles/KpiStyled";
import { LinkCard, rendererOf } from "@/app/reporting/marketing-kpis/tiles/registry";
import { usePlanKpis } from "@/app/reporting/marketing-kpis/tiles/planKpis";
import { KpiCard, StageGlyph, buildViews, stageTint, upToOf, useMarketingKpis, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { fullCardFor } from "@/app/reporting/marketing-kpis/FullCards";
import { S2S_CHOICES, STAGES } from "@/lib/reporting/actionPlanRules";
import type { PlanData } from "@/app/action-plan/planUi";
import { PlanPanel, trackingOf } from "./PlanPanel";
import { readTile, snapOf, type ActionsTile } from "./handoff";

const section = { fontSize: "0.74rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
// the plan's square choices (SubActions.square)
const opt = (on: boolean, off = false) => ({
  border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED,
  font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.2, py: 0.5, borderRadius: "4px", cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.4 : 1, whiteSpace: "nowrap" as const,
});
/** How wide the graph is drawn here, as in a BUC View: a tile, half of it, the whole of it (at least this wide). */
const WIDTH: Record<TileFormat, number> = { tile: 300, half: 720, card: 1000 };

/**
 * The graph at the width it has in the BUC View, made smaller as a whole where the room is narrower - squeezed into
 * the room instead, its words ran into each other (a card's name under its figure).
 */
function Fit({ format, children }: { format: TileFormat; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRoom(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = format === "card" ? Math.max(WIDTH.card, room) : WIDTH[format];
  const zoom = room ? Math.min(1, room / width) : 1;
  return (
    <Box ref={ref} sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {room > 0 && <Box sx={{ width, flex: "0 0 auto", zoom, pointerEvents: "none" }}>{children}</Box>}
    </Box>
  );
}

const specOf = (t: ActionsTile): TileSpec => ({
  key: t.key, page: t.page, title: t.title, kind: t.kind ?? (t.kpiId ? "kpi" : "card"),
  ...(t.tab ? { tab: t.tab } : {}), ...(t.kpiId ? { kpiId: t.kpiId } : {}),
  ...(t.filters ? { filters: t.filters } : {}), ...(t.from ? { from: t.from } : {}), ...(t.to ? { to: t.to } : {}),
  ...(t.href ? { href: t.href } : {}),
});

/** Where it sits in the BUC View, as a small map: the tiles, the half and whole rows, this one in blue. */
function WhereMap({ format }: { format: TileFormat }) {
  const spans = format === "tile" ? [3, 3, 3, 3, 6, 6] : format === "half" ? [3, 3, 6, 6, 6] : [3, 3, 3, 3, 12, 6, 6];
  const me = format === "tile" ? 1 : format === "half" ? 2 : 4;
  return (
    <Box title="Where it sits in the BUC View" sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "3px", width: 150, p: "5px", borderRadius: "6px", bgcolor: "#eef1f6" }}>
      {spans.map((n, k) => <Box key={k} sx={{ gridColumn: `span ${n}`, height: 11, borderRadius: "2px", bgcolor: k === me ? TINT.blue.fg : "rgba(21,34,58,.12)" }} />)}
    </Box>
  );
}

/** The graph as its page drew it, when no style of its own can be drawn here. */
function AsDrawn({ t }: { t: ActionsTile }) {
  const snap = snapOf(t.key);
  const draw = rendererOf(t.page);
  if (snap) return <Box sx={{ width: snap.width, maxWidth: "100%", pointerEvents: "none", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: snap.html }} />;
  if (draw) return <Box sx={{ width: "100%" }}>{draw(specOf(t))}</Box>;
  return <Box sx={{ width: 420, maxWidth: "100%" }}><LinkCard spec={specOf(t)} /></Box>;
}

/** A KPI of the Digital Growth KPIs: its figures, to draw it in any style. */
function useKpiView(kpiId: string | undefined): { v: KpiView | null; upTo: string; loading: boolean } {
  const [state] = useMarketingKpis();
  const year = new Date().getFullYear();
  const v = useMemo(() => {
    if (!kpiId || !state?.inputs) return null;
    return buildViews(state.inputs, state.live?.value, year)[kpiId] ?? null;
  }, [kpiId, state, year]);
  return { v, upTo: v && state ? upToOf(v, state, year) : "", loading: !state };
}

function KpiDesign({ t, format, style, target }: { t: ActionsTile; format: TileFormat; style: TileStyle | null; target: number | null }) {
  const { v, upTo, loading } = useKpiView(t.kpiId);
  if (loading) return <CircularProgress size={20} />;
  if (!v) return <AsDrawn t={t} />;
  const tint = stageTint(t.page);
  const shown = styleShown(style, format, shapeOf(v));
  const node = shown ? <KpiStyled v={v} style={shown} format={format} slug={t.page} tint={tint} upTo={upTo} target={target} title={t.title} />
    : format === "tile" ? <KpiTileChart v={v} slug={t.page} tint={tint} upTo={upTo} title={t.title} />
      : (t.kpiId && fullCardFor(t.page, t.kpiId, null)) || <KpiCard v={v} icon={<StageGlyph slug={t.page} />} tint={tint} upTo={upTo} title={t.title} />;
  return <Fit format={format}>{node}</Fit>;
}

/** Which styles the KPI can take - read from its figures, so the choices are only those it has. */
function StyleChoices({ t, format, style, canWrite, busy, pick }: { t: ActionsTile; format: TileFormat; style: TileStyle | null; canWrite: boolean; busy: boolean; pick: (s: TileStyle | null) => void }) {
  const { v, loading } = useKpiView(t.kpiId);
  if (loading) return <CircularProgress size={16} />;
  if (!v) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>This graph keeps its own look - styles are for the KPIs with their figures by month.</Typography>;
  const can = stylesFor(format, shapeOf(v));
  const shown = styleShown(style, format, shapeOf(v));
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      <Box component="button" type="button" disabled={!canWrite || busy} aria-pressed={!shown} onClick={() => pick(null)} sx={opt(!shown)}>As today</Box>
      {TILE_STYLES.map((s) => {
        const ok = can.includes(s.id);
        return (
          <Box key={s.id} component="button" type="button" disabled={!canWrite || busy || !ok} aria-pressed={shown === s.id}
            title={ok ? undefined : s.needs === "sum" && shapeOf(v).months ? "Only for a KPI that adds up month by month - not a rate" : format === "tile" ? "Too small for a small tile" : "This KPI has no months to draw"}
            onClick={() => pick(s.id)} sx={opt(shown === s.id, !ok)}>{s.label}</Box>
        );
      })}
    </Box>
  );
}

function ActionsPage() {
  const params = useSearchParams();
  const t = useMemo(() => readTile(params.get("tile")), [params]);
  if (!t) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, display: "grid", gap: 2 }}>
        <HomeBar />
        <GlassCard><Typography sx={{ color: MUTED }}>Open a graph&apos;s Actions tab in Advanced reporting - this page shows that graph&apos;s actions.</Typography></GlassCard>
      </Box>
    );
  }
  return <ForTile key={t.key} t={t} />;
}

function ForTile({ t }: { t: ActionsTile }) {
  const page = t.where === "nutshell" ? "nutshell" : t.page;
  const { state } = useActions(page);
  const canWrite = state?.canWrite ?? false;
  const placed: Placement = placementOf(state, t.key, t.start);
  const formats = formatsFor(t);
  const saved = formatOf(state, t);
  // a size picked before it is in the BUC View goes there with it
  const [want, setWant] = useState<TileFormat>(saved);
  useEffect(() => { if (placed === "nutshell") setWant(saved); }, [placed, saved]);
  const format = placed === "nutshell" ? saved : want;
  const style = styleOf(state, t.key);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const place = async (to: Placement, extra: { format?: TileFormat; style?: TileStyle | null } = {}) => {
    setBusy(true); setErr(null);
    try { await send("/api/reporting/kpi-actions/placement", "POST", { spec: specOf(t), placement: to, ...extra }); await refreshActions(t.page); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  // the action plan: read once here, for the panel and for what tracks this KPI; null = not this person's
  const [plan, setPlan] = useState<PlanData | null | "denied">(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const loadPlan = useCallback(async () => {
    try {
      const r = await fetch("/api/action-plan");
      if (r.status === 401 || r.status === 403) { setPlan("denied"); return; }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setPlan({ canWrite: !!j.canWrite, items: j.items, subs: j.subs, own: j.own ?? {}, people: j.people ?? [], peopleError: j.peopleError ?? null, choices: j.choices ?? S2S_CHOICES });
      setPlanErr(null);
    } catch (e) { setPlanErr((e as Error).message); }
  }, []);
  useEffect(() => { void loadPlan(); }, [loadPlan]);
  const [panelOpen, setPanelOpen] = useState(true);
  // the plan's table open beside it: the graph gets the room left, its target and what tracks it go under it
  const stacked = panelOpen && plan !== null && plan !== "denied";
  const [adding, setAdding] = useState<Parameters<typeof PlanPanel>[0]["adding"]>(null);

  // on the plan's KPIs tab: what is made here tracks it (round 40: only those KPIs are tracked)
  const planKpis = usePlanKpis(true);
  const onPlan = !!planKpis.state?.kpis.some((k) => k.key === t.key);
  const kpi = { key: t.key, title: t.title };
  const tracking = trackingOf(plan && plan !== "denied" ? plan : null, t.key);

  // the KPI's own tasks (made on it before, or by someone without the plan)
  const acts = useTileActions(t, true);
  const reloadTasks = async () => { await Promise.all([acts.loadTasks(), acts.loadTickets()]); void refreshActions(t.page); };

  const target = targetOf(state, t.target?.key);
  const isKpi = (t.kind ?? (t.kpiId ? "kpi" : "card")) === "kpi" && !!t.kpiId;
  const backLabel = t.where === "nutshell" ? "Back to the BUC View" : "Back to the report";

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <HomeBar />
      {/* what it is, where it came from, whether it is in the BUC View */}
      <GlassCard sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", py: { xs: 1.75, md: 2 } }}>
        <Box component={Link} href={t.back ?? t.href ?? "/reporting"} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, fontSize: "0.86rem", fontWeight: 650, textDecoration: "none", "&:hover": { color: INK } }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />{backLabel}
        </Box>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Actions on a {isKpi ? "KPI" : "graph"}</Typography>
          <Typography component="h1" sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{t.title}</Typography>
          {t.summary && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>{t.summary}</Typography>}
        </Box>
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.75, borderRadius: "12px", border: `1px solid ${placed === "nutshell" ? TINT.blue.fg : HAIRLINE}`, bgcolor: placed === "nutshell" ? TINT.blue.bg : "#fff", cursor: canWrite ? "pointer" : "default" }}>
          <Box>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: placed === "nutshell" ? TINT.blue.fg : INK }}>BUC View</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{placed === "nutshell" ? "Shown there for everyone" : "Only on its page"}</Typography>
          </Box>
          <Switch checked={placed === "nutshell"} disabled={!canWrite || busy} slotProps={{ input: { "aria-label": "In the BUC View" } }}
            onChange={(e) => void place(e.target.checked ? "nutshell" : "tab", e.target.checked && formats.length > 1 ? { format: want } : {})} />
        </Box>
      </GlassCard>
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", minWidth: 0 }}>
        {/* left: the action plan to create from - or the KPI's own task form for whoever has no plan */}
        {plan === null ? (
          <Box sx={{ width: 44, display: "flex", justifyContent: "center", pt: 2 }}>{planErr ? <Typography sx={{ fontSize: "0.8rem", color: RED }}>!</Typography> : <CircularProgress size={18} />}</Box>
        ) : plan === "denied" ? (
          canWrite && (
            <Box sx={{ flex: "0 0 auto", width: "min(560px, 40%)", p: 2.5, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
              <AddTask tile={t} t={acts.t} tErr={acts.tErr} retry={acts.loadTickets} done={reloadTasks} plan={false} tickets />
            </Box>
          )
        ) : (
          <PlanPanel data={plan} kpi={kpi} onTracked={onPlan} reload={loadPlan} open={panelOpen} setOpen={setPanelOpen} adding={adding} setAdding={setAdding} />
        )}

        {/* centre and right */}
        <Box sx={{ flex: 1, minWidth: 0, display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: stacked ? "minmax(0, 1fr)" : { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 340px" } }}>
          <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: "grid", gap: 1.25, p: 2, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED, width: 130 }}>Size in the BUC View</Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {formats.map((f) => (
                    <Box key={f} component="button" type="button" disabled={!canWrite || busy} aria-pressed={format === f}
                      onClick={() => { setWant(f); if (placed === "nutshell") void place("nutshell", { format: f }); }} sx={opt(format === f)}>{FORMAT_LABEL[f]}</Box>
                  ))}
                </Box>
                <Box sx={{ flex: 1 }} />
                <WhereMap format={format} />
              </Box>
              {isKpi && (
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED, width: 130, pt: 0.5 }}>Style</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <StyleChoices t={t} format={format} style={style} canWrite={canWrite} busy={busy} pick={(s) => void place(placed, { style: s })} />
                  </Box>
                </Box>
              )}
              <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
                {placed === "nutshell" ? "Shown so in the BUC View for everyone - saved as you pick." : "Not in the BUC View: turn it on at the top to put it there so."}
                {isKpi ? " Same figures in every style - only how they are drawn changes; As today keeps the look it has now." : ""}
              </Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: "16px", bgcolor: "#eef1f6", display: "flex", justifyContent: "center", minHeight: 260, overflowX: "auto" }}>
              {isKpi ? <KpiDesign t={t} format={format} style={style} target={target} /> : <AsDrawn t={t} />}
            </Box>
          </Box>

          {/* right: the target, the plan's KPIs, what tracks it - under the graph, side by side, while the plan is open */}
          <Box sx={{ display: "grid", gap: 1.5, minWidth: 0, alignItems: "start", gridTemplateColumns: stacked ? { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" } : "minmax(0, 1fr)" }}>
            {t.target ? <TargetBox tile={t} value={target} canWrite={canWrite} current={t.current ?? null} />
              : <Box sx={{ p: 2, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>This graph has no single figure to measure against a target.</Typography></Box>}
            <Box sx={{ display: "grid", gap: 1.25, minWidth: 0, alignContent: "start" }}>
            <Typography sx={section}>Tracking this KPI · {tracking.items.length + tracking.subs.length}</Typography>
            {plan !== "denied" && !tracking.items.length && !tracking.subs.length && (
              <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{onPlan ? "Nothing yet - make an action or a sub-action on the left." : "Nothing - a KPI is tracked once it is on the Action plan's KPIs (its target, then the switch above)."}</Typography>
            )}
            {tracking.items.map((i) => <TrackLine key={`i${i.id}`} href={`/action-plan?item=${i.id}`} title={i.title} what="Action" stage={i.stage} who={i.owners.map((o) => o.name).join(", ")} start={i.start} />)}
            {tracking.subs.map((s) => {
              const a = plan && plan !== "denied" ? plan.items.find((i) => i.id === s.item) : undefined;
              return <TrackLine key={`s${s.id}`} href={`/action-plan?sub=${s.id}`} title={s.title} what={`Sub-action of ${a?.title ?? "an action"}`} stage={s.stage} who={s.ownerName} start={s.start} />;
            })}
            {(acts.tasks ?? []).length > 0 && (
              <>
                <Typography sx={{ ...section, mt: 1 }}>Its own tasks · {(acts.tasks ?? []).length}</Typography>
                {(acts.tasks ?? []).map((k) => (
                  <TrackLine key={`k${k.id}`} href={k.planItem != null ? `/action-plan?item=${k.planItem}` : undefined} title={k.title}
                    what={k.planItem != null ? "A task on this KPI, in the action plan" : "A task on this KPI"} stage={k.stage ?? null} status={k.status} who={k.ownerName} start={k.start ?? k.due ?? null} />
                ))}
              </>
            )}
            {acts.err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{acts.err}</Typography>}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** A row that tracks the KPI: its name, where it sits, its status, who, when - and the way to it on the plan. */
function TrackLine({ href, title, what, stage, status, who, start }: { href?: string; title: string; what: string; stage: string | null; status?: string; who: string; start: string | null }) {
  const label = stage ? STAGES.find((x) => x.id === stage)?.label ?? "No status" : status === "done" ? "Done" : status === "doing" ? "Doing" : "Open";
  const body = (
    <Box sx={{ display: "grid", gap: 0.35, p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", "&:hover": href ? { borderColor: TINT.blue.fg } : {} }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <FlagOutlinedIcon sx={{ fontSize: 16, color: TINT.blue.fg, mt: 0.2 }} />
        <Typography sx={{ flex: 1, fontSize: "0.88rem", fontWeight: 650, color: INK, lineHeight: 1.3 }}>{title}</Typography>
        <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, px: 0.75, py: 0.2, borderRadius: "3px", bgcolor: label === "Live" || label === "Done" ? "#e7f6ee" : TINT.blue.bg, color: label === "Live" || label === "Done" ? GREEN : TINT.blue.fg, whiteSpace: "nowrap" }}>{label}</Box>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, pl: 3 }}>{[what, who, start ? `planned ${start.slice(0, 10).split("-").reverse().join(".")}` : ""].filter(Boolean).join(" · ")}</Typography>
    </Box>
  );
  return href ? <Box component={Link} href={href} sx={{ textDecoration: "none" }}>{body}</Box> : body;
}

export default function KpiActionsPage() {
  // drawn in the browser only: everything on it is read there
  const [here, setHere] = useState(false);
  useEffect(() => { setHere(true); }, []);
  if (!here) return null;
  return (
    <Suspense fallback={null}>
      <ActionsPage />
    </Suspense>
  );
}
