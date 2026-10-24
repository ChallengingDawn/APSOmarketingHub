"use client";
// THE ESO BUC VIEW - the first page of the ESO reports, as Digital Growth's (SARCLA 21.10.2026: "the ESO reporting in
// the same structure as the digital growth"): a panel per page in the deck's order, its title the way in, its figures
// for all of ESO - and the charts sent here from the pages with Actions, each as drawn there, with the reps it was
// sent with; drag one to move it (one order for everyone). This address used to open Visits (the sub-apps, 12.10).

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GlassCard, INK, MUTED, TINT, glass } from "@/app/uc/report/ui";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import { EsoWaiting, ctxOf, pageHref, pageKey, type EsoPageDef } from "./EsoKit";
import { ESO_PAGES } from "./pages";
import { FiguresPanel } from "./Figures";
import { useEso, type EsoBenchmark } from "./shared";

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const HALF_SPAN = { gridColumn: { xs: "span 12", md: "span 6" } };
const FULL_SPAN = { gridColumn: "1 / -1" };

function PagePanel({ def, b, acts }: { def: EsoPageDef; b: EsoBenchmark; acts: ActionsState | null }) {
  const page = pageKey(def.slug);
  const c = ctxOf(b, []);
  const figures = def.figures(c);
  // the charts sent here from this page, each with the reps it was sent with
  const items: SortItem[] = (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === page).map(({ spec }) => {
    const [, tab, card] = spec.key.split(":");
    const ch = def.charts[`${tab}:${card}`];
    const tile = { key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind };
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={tile} />;
    const reps = (spec.filters?.rep ?? []).filter((id) => b.reps.some((r) => r.ownerId === id));
    const names = b.reps.filter((r) => reps.includes(r.ownerId)).map((r) => r.name);
    const node = ch ? (
      <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
        {ch.draw(ctxOf(b, reps, { half: fmt === "half", actions }))}
        {names.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: FAINT, px: 1 }}>{names.join(", ")}</Typography>}
      </Box>
    ) : (
      <GlassCard><CardTitle icon={def.icon} tint={def.tint} title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard>
    );
    return { key: spec.key, node, sx: fmt === "half" ? HALF_SPAN : FULL_SPAN, block: true };
  });
  const scope = `nutshell:${page}`;
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope, keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={def.icon} tint={def.tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={pageHref(def.slug)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[def.tint].fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{def.title}</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[def.tint].fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c.cy} against {c.py} · {def.line} · all of ESO</Typography>
        </Box>
      </Box>
      {/* the page's figures, for all of ESO */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${figures.length}, minmax(0, 1fr))` } }}>
        {figures.map((f) => (
          <Box key={f.label} component={Link} href={pageHref(def.slug)} sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 0.75, alignContent: "start", minWidth: 0, textDecoration: "none", "&:hover": { borderColor: TINT[f.tint].fg } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Badge icon={f.icon} tint={f.tint} size={32} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
              {f.d && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: f.d.color }}>{f.d.text}</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sub}</Typography>
          </Box>
        ))}
      </Box>
      {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.[scope]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
    </GlassCard>
  );
}

export default function EsoBucView() {
  const state = useEso();
  const { state: acts } = useActions("nutshell");
  const b = state?.value;
  return (
    // no title: the panels straight away, as in Digital Growth's BUC View
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {/* the figures first - revenue and order intake, ESO | TSA | Total (SARCLA 24.10.2026: "first on BUC View") - their own read */}
      <FiguresPanel acts={acts} />
      {!b ? <EsoWaiting state={state} /> : (
        <>
          {ESO_PAGES.map((p) => <PagePanel key={p.slug} def={p} b={b} acts={acts} />)}
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            Read from HubSpot {new Date(state?.computedAt ?? b.generatedAt).toLocaleString("en-GB")} · refreshed every 12 hours · the completed months of this year against the same months of last year · a chart joins its page&apos;s panel here with Actions on the page.
          </Typography>
        </>
      )}
    </Box>
  );
}
