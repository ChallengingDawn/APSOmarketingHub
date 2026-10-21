"use client";
// THE TILE'S "ACTIONS" TAB (SARCLA 18.10.2026: "icons way too big - a separator tab on the side,
// small, 'Actions', that changes colour when there is an action running"). One small tab on the
// card's right edge; it opens the tile's window: its tasks, each with its "From Scroll to Sale"
// tickets, who they are shared with, and whether the tile shows In a nutshell (promote / demote).
// Drop it into a card's header: <TileActions tile={{ key, page, tab, kpiId, title, summary, filters }} />.

import { useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import { FAINT, HAIRLINE, TINT } from "@/app/uc/report/ui";
import type { Placement, TileFormat, TileSpec } from "@/lib/reporting/kpiActions";
import { ActionsPanel } from "./ActionsPanel";
import { formatOf, formatsFor, placementOf, refreshActions, send, useActions } from "./store";

export type TileInfo = {
  /** "<page>:<tab>:<what>", e.g. "reach:seo:R05" or "visit::P02" - the same on the page and in the nutshell */
  key: string; page: string; tab?: string; kpiId?: string; title: string;
  /** one line of what it shows now, e.g. "1,234 this year so far, -28% vs last year" - goes into the ticket */
  summary?: string; filters?: Record<string, string[]>; from?: string; to?: string;
  /** where it lives; the page's address with its filters when left out */
  href?: string;
  kind?: "kpi" | "card";
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
  const [open, setOpen] = useState(false);
  const c = state?.counts[tile.key] ?? { open: 0, tasks: 0, tickets: 0 };
  const placed = placementOf(state, tile.key, start);
  const running = c.open > 0;

  const move = async (to: Placement, format?: TileFormat) => {
    const spec: TileSpec = {
      key: tile.key, page: tile.page, title: tile.title, kind: tile.kind ?? (tile.kpiId ? "kpi" : "card"),
      ...(tile.tab ? { tab: tile.tab } : {}), ...(tile.kpiId ? { kpiId: tile.kpiId } : {}),
      ...(tile.filters ? { filters: tile.filters } : {}), ...(tile.from ? { from: tile.from } : {}), ...(tile.to ? { to: tile.to } : {}),
      href: tile.href ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined),
    };
    await send("/api/reporting/kpi-actions/placement", "POST", { spec, placement: to, ...(format ? { format } : {}) });
    await refreshActions(tile.page);
  };

  return (
    <>
      {/* the tab hangs from its place without taking height: a two-line title stays two lines high, and the
          card's content starts right under it (SARCLA 19.10: "still stupid top padding everywhere") */}
      <Box sx={{ mr: neg(edge), flex: "0 0 auto", alignSelf: "flex-start", position: "relative", width: 20, height: 0 }}>
      <Tooltip placement="left" title={c.tasks ? `${c.open} open of ${c.tasks} task${c.tasks === 1 ? "" : "s"}${c.tickets ? ` · ${c.tickets} Scroll to Sale ticket${c.tickets === 1 ? "" : "s"}` : ""}${placed === "nutshell" ? " · BUC View" : ""}` : `Actions${placed === "nutshell" ? " · BUC View" : ""}`}>
        <Box component="button" type="button" aria-label={`Actions for ${tile.title}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}
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
      {open && <ActionsPanel tile={tile} open={open} onClose={() => setOpen(false)} placed={placed} format={formatOf(state, tile)} formats={formatsFor(tile)} onMove={move} canWrite={state?.canWrite ?? false} />}
    </>
  );
}
