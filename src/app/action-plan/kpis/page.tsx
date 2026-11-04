"use client";
// THE KPIS, TEAM BY TEAM - a tab of the action plan beside From Scroll to Sale. Only the KPIs promoted to it (SARCLA
// 04.11.2026: "don't populate any KPI for now on each team's KPIs - they need to be promoted here with a defined target;
// then we should have a toggle Target complete | Still running | Late; the KPI inside is defined on the Advanced reporting
// action"): a KPI comes here from its tile's Actions window in Advanced reporting, once its target is saved there
// ("Action plan · KPIs"). Each is drawn as a KPI card of the reports - its name, its figure as its tile last drew it, its
// Actions tab - with its target, how far it is, and where it stands. A team with none says how one comes, in a BUC View's
// own placeholder.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GlassCard, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { GUTTER } from "@/app/analytics/Shell";
import { TileActions, type TileInfo } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { refreshPlanKpis, usePlanKpis } from "@/app/reporting/marketing-kpis/tiles/planKpis";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import { square } from "@/app/action-plan/SubActions";
import { categoryBySlug, categoryEntry } from "@/lib/reporting/categories";
import { PLAN_KPI_STATUSES, PLAN_KPI_TEAMS, type PlanKpi, type PlanKpiStatus } from "@/lib/reporting/planKpiTeams";
import { figureOf, figureText } from "@/lib/reporting/tileFigure";

type Team = (typeof PLAN_KPI_TEAMS)[number];
const STATUS_TONE: Record<PlanKpiStatus, { fg: string; bg: string }> = {
  complete: { fg: GREEN, bg: "rgba(27,122,85,.1)" },
  running: { fg: TINT.blue.fg, bg: TINT.blue.bg },
  late: { fg: RED, bg: "#fde7e7" },
};
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

/** The target as it is typed: a rate in %, euros, a count. */
function targetText(v: number, unit: PlanKpi["unit"]): string {
  if (unit === "pct") return `${(v * 100).toFixed(1)}%`;
  if (unit === "eur") return `€${Math.round(v).toLocaleString("en")}`;
  return Math.round(v).toLocaleString("en");
}

/** A KPI on the plan, as a KPI card of the reports: name and Actions, its figure; its target and where it stands under. */
function KpiOnPlan({ k, target, onStatus, busy }: { k: PlanKpi; target: number | null; onStatus: (s: PlanKpiStatus) => void; busy: boolean }) {
  const fig = figureText(k.summary);
  const rest = fig ? k.summary.replace(fig, "").replace(/^[\s,·:-]+/, "").trim() : k.summary;
  // how far it is, when its words open with a figure in the target's terms
  const n = fig ? figureOf(fig) : null;
  const pct = !!fig && fig.includes("%");
  const current = n == null || pct !== (k.unit === "pct") ? null : pct ? n / 100 : n;
  const share = current != null && target != null && target > 0 ? current / target : null;
  const tone = share == null ? MUTED : share >= 1 ? GREEN : share >= 0.8 ? TINT.amber.fg : RED;
  // the tile itself, for its Actions window: tasks, the target, on or off the plan
  const tile: TileInfo = {
    key: k.key, page: k.page, title: k.title, summary: k.summary, href: k.href || undefined,
    ...(k.targetKey !== k.key ? { target: { key: k.targetKey, unit: k.unit, label: `What it shows - “${k.summary}” - is measured against it.` } } : {}),
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{k.title}</Typography>
          {k.href && (
            <Box component={Link} href={k.href} sx={{ fontSize: "0.78rem", fontWeight: 650, color: TINT.blue.fg, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Open in its report</Box>
          )}
        </Box>
        <Box sx={{ textAlign: "right", minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fig ?? "—"}</Typography>
          {rest && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{rest}</Typography>}
          {k.summaryAt && <Typography sx={{ fontSize: "0.7rem", color: FAINT, fontWeight: 600 }}>As drawn {day(k.summaryAt)}</Typography>}
        </Box>
        <Box sx={{ flex: "0 0 auto", alignSelf: "flex-start" }}><TileActions tile={tile} /></Box>
      </Box>

      {/* its target, and how far it is */}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>Target</Typography>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: target == null ? FAINT : INK, fontVariantNumeric: "tabular-nums" }}>{target == null ? "None - set it in its Actions" : targetText(target, k.unit)}</Typography>
          {share != null && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: tone, ml: "auto" }}>{Math.round(share * 100)} % of the target</Typography>}
        </Box>
        {share != null && (
          <Box sx={{ height: 6, borderRadius: "3px", bgcolor: "#eef1f6", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${Math.min(1, share) * 100}%`, bgcolor: tone }} />
          </Box>
        )}
      </Box>

      {/* where it stands - set by hand */}
      <Box role="radiogroup" aria-label={`Where ${k.title} stands`} sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {PLAN_KPI_STATUSES.map((s) => {
          const on = k.status === s.id;
          const t = STATUS_TONE[s.id];
          return (
            <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => !on && onStatus(s.id)}
              sx={{ ...square(on, t.fg, t.bg, !busy), ...(on ? { bgcolor: t.fg, color: "#fff", borderColor: t.fg } : {}) }}>
              {s.label}
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

/** A team with no KPI on the plan yet: a BUC View's own placeholder, and how one comes. */
function Placeholder({ t }: { t: Team }) {
  const c = categoryBySlug(t.slug);
  const reports = c?.name ?? `${t.name} Reports`;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>{t.name} KPIs</Typography>
      <Typography sx={{ fontSize: "0.95rem", color: INK }}>
        No KPI of {t.name} on the plan yet. One comes from its tile in {reports}: open its Actions, save its target, then turn on &quot;Action plan · KPIs&quot;.
      </Typography>
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
        {[0, 1, 2].map((n) => (
          <Box key={n} sx={{ height: 120, borderRadius: "14px", border: `1.5px dashed ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.5)", display: "grid", placeItems: "center" }}>
            <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>A KPI of {t.name}</Typography>
          </Box>
        ))}
      </Box>
      <Box component={Link} href={c ? categoryEntry(c) : "/reporting"} sx={{ justifySelf: "start", fontSize: "0.86rem", fontWeight: 650, color: TINT.blue.fg, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
        Open {reports}
      </Box>
    </GlassCard>
  );
}

export default function PlanKpisPage() {
  const { state, error } = usePlanKpis(true);
  const [team, setTeam] = useState<string>(PLAN_KPI_TEAMS[0].id);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // the team in the address, so a link opens on it
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("team");
    if (t && PLAN_KPI_TEAMS.some((x) => x.id === t)) setTeam(t);
  }, []);
  const pick = (id: string) => {
    setTeam(id);
    const u = new URL(window.location.href);
    u.searchParams.set("team", id);
    window.history.replaceState(null, "", u.toString());
  };
  const status = async (k: PlanKpi, s: PlanKpiStatus) => {
    setBusy(k.key); setErr(null);
    try { await send("/api/action-plan/kpis", "PATCH", { key: k.key, status: s }); await refreshPlanKpis(); }
    catch (e) { setErr(`${k.title}: ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const t = PLAN_KPI_TEAMS.find((x) => x.id === team) ?? PLAN_KPI_TEAMS[0];
  const kpis = (state?.kpis ?? []).filter((k) => k.team === t.id);
  const count = (id: string) => (state?.kpis ?? []).filter((k) => k.team === id).length;
  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
        <HomeBar on="KPIs" plan />
        <GlassCard sx={{ display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>KPIs</Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.35rem", md: "1.55rem" }, fontWeight: 650, letterSpacing: "-0.02em", color: INK, mt: 0.5, textWrap: "balance" }}>
              The KPIs promoted to the plan, team by team - each with its target and where it stands
            </Typography>
          </Box>
          {/* one team at a time, square choices as the plan's */}
          <Box role="tablist" aria-label="Team" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {PLAN_KPI_TEAMS.map((x) => {
              const on = x.id === t.id;
              const n = count(x.id);
              return (
                <Box key={x.id} component="button" type="button" role="tab" aria-selected={on} onClick={() => pick(x.id)}
                  sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED, font: "inherit",
                    fontSize: "0.88rem", fontWeight: on ? 800 : 650, px: 1.5, py: 0.6, borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {x.name}{n > 0 && <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{n}</Box>}
                </Box>
              );
            })}
          </Box>
        </GlassCard>
      </Box>
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2 }}>
        {(error || err) && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{err ?? `The plan's KPIs could not be read: ${error}`}</Typography>}
        {!state ? (
          !error && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Reading the plan&apos;s KPIs…</Typography>
        ) : kpis.length ? (
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, alignItems: "start" }}>
            {kpis.map((k) => <KpiOnPlan key={k.key} k={k} target={state.targets[k.targetKey] ?? null} busy={busy === k.key} onStatus={(s) => void status(k, s)} />)}
          </Box>
        ) : <Placeholder t={t} />}
      </Box>
    </Box>
  );
}
