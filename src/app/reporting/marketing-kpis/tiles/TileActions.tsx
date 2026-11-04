"use client";
// THE TILE'S "ACTIONS" TAB (SARCLA 18.10.2026: "icons way too big - a separator tab on the side,
// small, 'Actions', that changes colour when there is an action running"). One small tab on the
// card's right edge; it opens the tile's Actions page in Advanced reporting (SARCLA 04.11.2026: "open the action page on
// the KPI ... a creation action module on Advanced reporting" - src/app/reporting/actions): the action plan to create
// from, the graph's size and style in the BUC View, its target, what tracks it.
// Drop it into a card's header: <TileActions tile={{ key, page, tab, kpiId, title, summary, filters }} />.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import { FAINT, HAIRLINE, TINT } from "@/app/uc/report/ui";
import type { Placement } from "@/lib/reporting/kpiActions";
import { placementOf, useActions } from "./store";
import { openActions } from "@/app/reporting/actions/handoff";
import { figureOf, figureText } from "@/lib/reporting/tileFigure";
import { viewOf } from "@/lib/reporting/planKpiTeams";
import { sayFigure, usePlanKpis } from "./planKpis";

/**
 * A target for a tile that has none of its own (SARCLA 04.11.2026, of the KPIs tab: "you should be able also to set a
 * target"): the figure its words open with is measured against it - a rate in %, euros or francs as they are written, a
 * count otherwise. Kept under the tile's key, as a chart's own. A chart with its own target keeps it.
 */
export function targetFor(tile: TileInfo): TileInfo["target"] {
  if (tile.target) return tile.target;
  const f = tile.summary ? figureText(tile.summary) : null;
  if (!f || figureOf(f) == null) return undefined;
  const unit = f.includes("%") ? "pct" : /€|EUR|CHF/i.test(f) ? "eur" : "n";
  return { key: tile.key, unit, label: `What it shows - “${tile.summary}” - is measured against it.` };
}
/** The tile's figure in its target's terms - a rate as a fraction - for how far it is. */
export const figureFor = (tile: TileInfo): number | null => {
  if (tile.target || !tile.summary) return null;
  const f = figureText(tile.summary);
  const n = f ? figureOf(f) : null;
  return n == null ? null : f!.includes("%") ? n / 100 : n;
};

export type TileInfo = {
  /** "<page>:<tab>:<what>", e.g. "reach:seo:R05" or "visit::P02" - the same on the page and in the nutshell */
  key: string; page: string; tab?: string; kpiId?: string; title: string;
  /** one line of what it shows now, e.g. "1,234 this year so far, -28% vs last year" - goes into the ticket */
  summary?: string; filters?: Record<string, string[]>; from?: string; to?: string;
  /** where it lives; the page's address with its filters when left out */
  href?: string;
  kind?: "kpi" | "card";
  /** a chart that can be measured against a target (SARCLA 25.10.2026: "a threshold so we can measure the rest of it"):
   *  the key it is kept under (a chart may keep one per team), what is typed - euros or a percent - and what it means */
  target?: { key: string; unit: "eur" | "pct" | "n"; label: string };
};

type Space = number | { xs?: number; md?: number };
const neg = (e: Space) => (typeof e === "number" ? -e : { xs: -(e.xs ?? 0), md: -(e.md ?? e.xs ?? 0) });

export function TileActions({ tile, start = "tab", where, edge = { xs: 2, md: 2.75 } }: {
  tile: TileInfo;
  /** where the tile is shown before anyone moves it: KPI tiles start in the nutshell, page cards on their tab */
  start?: Placement;
  /** kept for the pages that pass it; a tile's own filter lives on the card */
  onFilter?: () => void; filterOn?: boolean;
  /** the page it is drawn on */
  where?: "nutshell" | "tab";
  /** the card's padding (theme units), so the tab sits on its edge - GlassCard's by default */
  edge?: Space;
}) {
  const { state } = useActions(where === "nutshell" ? "nutshell" : tile.page);
  const router = useRouter();
  const c = state?.counts[tile.key] ?? { open: 0, tasks: 0, tickets: 0 };
  const placed = placementOf(state, tile.key, start);
  const running = c.open > 0;
  // on the action plan's KPIs: what it shows now goes there, when drawn in the view it was promoted in
  const plan = usePlanKpis();
  const onPlan = plan.state?.kpis.find((k) => k.key === tile.key);
  const view = viewOf(tile);
  useEffect(() => { if (onPlan && tile.summary) sayFigure(onPlan, tile.summary, view); }, [onPlan, tile.summary, view]);

  // its Actions page, with the tile as it is drawn here: where it starts, its target, what it shows now
  const open = (button: HTMLElement) => openActions({
    ...tile, target: targetFor(tile), current: figureFor(tile), start, where,
    href: tile.href ?? `${window.location.pathname}${window.location.search}`,
  }, button, (href) => router.push(href));

  return (
    <>
      {/* the tab hangs from its place without taking height: a two-line title stays two lines high, and the
          card's content starts right under it (SARCLA 19.10: "still stupid top padding everywhere") */}
      <Box sx={{ mr: neg(edge), flex: "0 0 auto", alignSelf: "flex-start", position: "relative", width: 20, height: 0 }}>
      <Tooltip placement="left" title={c.tasks ? `${c.open} open of ${c.tasks} task${c.tasks === 1 ? "" : "s"}${c.tickets ? ` · ${c.tickets} Scroll to Sale ticket${c.tickets === 1 ? "" : "s"}` : ""}${placed === "nutshell" ? " · BUC View" : ""}${onPlan ? " · Action plan KPI" : ""}` : `Actions${placed === "nutshell" ? " · BUC View" : ""}${onPlan ? " · Action plan KPI" : ""}`}>
        <Box component="button" type="button" aria-label={`Actions for ${tile.title}`} onClick={(e) => { e.stopPropagation(); open(e.currentTarget); }}
          sx={{
            // on the card's right edge, rounded on the inside only
            position: "absolute", top: 0, right: 0, zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 0.6, px: 0.35, py: 1, minHeight: 70,
            writingMode: "vertical-rl", transform: "rotate(180deg)",
            border: `1px solid ${running ? TINT.amber.fg : HAIRLINE}`, borderLeft: 0, borderRadius: "0 9px 9px 0",
            bgcolor: running ? TINT.amber.bg : "rgba(21,34,58,.035)", color: running ? TINT.amber.fg : FAINT,
            font: "inherit", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1,
            cursor: "pointer", transition: "background-color .15s, color .15s",
            "&:hover": { bgcolor: running ? TINT.amber.bg : "rgba(21,34,58,.08)", color: running ? TINT.amber.fg : "#15223a" },
          }}>
          {running && (
            <Box component="span" sx={{ transform: "rotate(180deg)", minWidth: 15, height: 15, px: 0.3, borderRadius: 99, bgcolor: TINT.amber.fg, color: "#fff", fontSize: "0.6rem", display: "grid", placeItems: "center", letterSpacing: 0 }}>
              {c.open}
            </Box>
          )}
          {placed === "nutshell" && where !== "nutshell" && <Box component="span" sx={{ width: 6, height: 6, borderRadius: 99, bgcolor: TINT.blue.fg }} />}
          Actions
        </Box>
      </Tooltip>
      </Box>
    </>
  );
}
