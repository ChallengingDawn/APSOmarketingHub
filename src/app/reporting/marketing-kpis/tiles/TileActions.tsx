"use client";
// THE TILE TOOLBAR (SARCLA 18.10.2026) - on every chart card of the Digital Growth KPIs, beside its figure:
//   Filter          this tile's own filter (the card says what it filters; absent where it has none)
//   Tasks           actions to correct the KPI, tracked here - the badge counts the open ones
//   Ticket          "From Scroll to Sale" tickets, new and prefilled or linked - the badge counts them
//   Promote/Demote  to "In a nutshell" and back to its tab, for everyone
// Drop it into a card's header: <TileActions tile={{ key, page, tab, kpiId, title, summary, filters }} />.

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TuneIcon from "@mui/icons-material/Tune";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";

import { FAINT, HAIRLINE, INK, TINT } from "@/app/uc/report/ui";
import type { Placement, TileSpec } from "@/lib/reporting/kpiActions";
import { ActionsPanel } from "./ActionsPanel";
import { placementOf, refreshActions, send, useActions } from "./store";

export type TileInfo = {
  /** "<page>:<tab>:<what>", e.g. "reach:seo:R05" or "visit::P02" - the same on the page and in the nutshell */
  key: string; page: string; tab?: string; kpiId?: string; title: string;
  /** one line of what it shows now, e.g. "1,234 this year so far, -28% vs last year" - goes into the ticket */
  summary?: string; filters?: Record<string, string[]>; from?: string; to?: string;
  /** where it lives; the page's address with its filters when left out */
  href?: string;
  kind?: "kpi" | "card";
};

const btn = (on = false) => ({
  width: 30, height: 30, borderRadius: "10px", border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`,
  bgcolor: on ? TINT.blue.bg : "rgba(255,255,255,.7)", color: on ? TINT.blue.fg : FAINT,
  "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.06)", color: INK },
});

function Count({ n, tint = "blue" }: { n: number; tint?: "blue" | "amber" }) {
  if (!n) return null;
  return (
    <Box component="span" sx={{ position: "absolute", top: -6, right: -6, minWidth: 17, height: 17, px: 0.4, borderRadius: 99, bgcolor: TINT[tint].fg, color: "#fff", fontSize: "0.64rem", fontWeight: 800, display: "grid", placeItems: "center", lineHeight: 1, pointerEvents: "none" }}>
      {n}
    </Box>
  );
}

export function TileActions({ tile, start = "tab", onFilter, filterOn = false, where }: {
  tile: TileInfo;
  /** where the tile is shown before anyone moves it: KPI tiles start in the nutshell, page cards on their tab */
  start?: Placement;
  /** opens the tile's own filter; no filter icon without it */
  onFilter?: () => void; filterOn?: boolean;
  /** the page it is drawn on - the nutshell offers Demote, a tab offers Promote */
  where?: "nutshell" | "tab";
}) {
  const { state } = useActions(where === "nutshell" ? "nutshell" : tile.page);
  const [panel, setPanel] = useState<null | "tasks" | "tickets">(null);
  const [busy, setBusy] = useState(false);
  const c = state?.counts[tile.key] ?? { open: 0, tasks: 0, tickets: 0 };
  const placed = placementOf(state, tile.key, start);
  const canWrite = state?.canWrite ?? false;

  const move = async (to: Placement) => {
    setBusy(true);
    const spec: TileSpec = {
      key: tile.key, page: tile.page, title: tile.title, kind: tile.kind ?? (tile.kpiId ? "kpi" : "card"),
      ...(tile.tab ? { tab: tile.tab } : {}), ...(tile.kpiId ? { kpiId: tile.kpiId } : {}),
      ...(tile.filters ? { filters: tile.filters } : {}), ...(tile.from ? { from: tile.from } : {}), ...(tile.to ? { to: tile.to } : {}),
      href: tile.href ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined),
    };
    try { await send("/api/reporting/kpi-actions/placement", "POST", { spec, placement: to }); await refreshActions(tile.page); }
    catch (e) { alert(`Could not move it: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: "inline-flex", gap: 0.6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      {onFilter && (
        <Tooltip title="Filter this tile"><IconButton aria-label="Filter this tile" onClick={onFilter} sx={btn(filterOn)}><TuneIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
      )}
      <Tooltip title={c.tasks ? `${c.open} open of ${c.tasks} tasks` : "Tasks to correct this KPI"}>
        <IconButton aria-label="Tasks" onClick={() => setPanel("tasks")} sx={{ ...btn(c.open > 0), position: "relative" }}>
          <TaskAltIcon sx={{ fontSize: 17 }} /><Count n={c.open} />
        </IconButton>
      </Tooltip>
      <Tooltip title={c.tickets ? `${c.tickets} Scroll to Sale ticket${c.tickets === 1 ? "" : "s"}` : "A Scroll to Sale ticket"}>
        <IconButton aria-label="Scroll to Sale tickets" onClick={() => setPanel("tickets")} sx={{ ...btn(c.tickets > 0), position: "relative" }}>
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 17 }} /><Count n={c.tickets} tint="amber" />
        </IconButton>
      </Tooltip>
      {canWrite && (placed === "nutshell" ? (
        <Tooltip title={where === "nutshell" ? "Demote - back to its tab only" : "In a nutshell - demote it to its tab only"}>
          <span><IconButton aria-label="Demote to its tab" disabled={busy} onClick={() => void move("tab")} sx={btn(true)}><VerticalAlignBottomIcon sx={{ fontSize: 17 }} /></IconButton></span>
        </Tooltip>
      ) : (
        <Tooltip title="Promote - show it In a nutshell">
          <span><IconButton aria-label="Promote to In a nutshell" disabled={busy} onClick={() => void move("nutshell")} sx={btn()}><VerticalAlignTopIcon sx={{ fontSize: 17 }} /></IconButton></span>
        </Tooltip>
      ))}
      {panel && <ActionsPanel tile={tile} open={!!panel} start={panel} onClose={() => setPanel(null)} />}
    </Box>
  );
}
