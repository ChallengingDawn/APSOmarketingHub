"use client";
// A TILE'S SIZE AND STYLE, SWITCHED ON THE TILE ITSELF (SARCLA 05.11.2026: "we should be able also to switch view and
// design on the KPI itself"). A second small tab under "Actions", on the graphs of the BUC View - where the change shows -
// for whoever may change it: the sizes and the styles of its Actions page, saved for everyone as they are clicked. A
// dropdown on the tile, not a window; the rest (its plan, its target) stays on its Actions page.

import { useState } from "react";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import { FAINT, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import type { TileFormat } from "@/lib/reporting/kpiActions";
import type { TileStyle } from "@/lib/reporting/tileStyles";
import { specOf } from "@/app/reporting/actions/handoff";
import { formatOf, formatsFor, refreshActions, send, styleOf, type ActionsState } from "./store";
import { SizeChoices, StyleChoices } from "./DesignChoices";
import type { TileInfo } from "./TileActions";

/** The tab's look, the Actions tab's. */
export const sideTab = {
  display: "inline-flex", alignItems: "center", gap: 0.6, px: 0.35, py: 1,
  writingMode: "vertical-rl", transform: "rotate(180deg)", borderLeft: 0, borderRadius: "0 9px 9px 0",
  font: "inherit", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1,
  cursor: "pointer", transition: "background-color .15s, color .15s",
} as const;

export function DesignTab({ tile, state, more }: { tile: TileInfo; state: ActionsState; more: (button: HTMLElement) => void }) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formats = formatsFor(tile);
  const format = formatOf(state, tile);
  const style = styleOf(state, tile.key);
  const isKpi = (tile.kind ?? (tile.kpiId ? "kpi" : "card")) === "kpi" && !!tile.kpiId;
  const save = async (extra: { format?: TileFormat; style?: TileStyle | null }) => {
    setBusy(true); setErr(null);
    try { await send("/api/reporting/kpi-actions/placement", "POST", { spec: specOf(tile), placement: "nutshell", ...extra }); await refreshActions(tile.page); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const label = { fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" } as const;
  return (
    <>
      <Box component="button" type="button" aria-label={`Size and style of ${tile.title}`} aria-haspopup="dialog" aria-expanded={!!at} title="Size and style in the BUC View"
        onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); setAt(e.currentTarget); }}
        sx={{ ...sideTab, minHeight: 56, border: `1px solid ${at ? "#2459d1" : HAIRLINE}`, borderLeft: 0, bgcolor: at ? "#e8effd" : "rgba(21,34,58,.035)", color: at ? "#2459d1" : FAINT,
          "&:hover": { bgcolor: "rgba(21,34,58,.08)", color: "#15223a" } }}>
        Design
      </Box>
      <Popover open={!!at} anchorEl={at} onClose={() => setAt(null)} onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: "min(460px, calc(100vw - 32px))", p: 2, borderRadius: "14px", display: "grid", gap: 1.5, boxShadow: "0 14px 36px rgba(31,45,78,.16)" } } }}>
        <Box>
          <Typography sx={label}>In the BUC View · for everyone</Typography>
          <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}>{tile.title}</Typography>
        </Box>
        {formats.length > 1 && (
          <Box sx={{ display: "grid", gap: 0.6 }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED }}>Size</Typography>
            <SizeChoices formats={formats} format={format} disabled={busy} pick={(f) => void save({ format: f })} />
          </Box>
        )}
        {isKpi && (
          <Box sx={{ display: "grid", gap: 0.6 }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED }}>Style - same figures, drawn another way</Typography>
            <StyleChoices kpiId={tile.kpiId} format={format} style={style} disabled={busy} pick={(s) => void save({ style: s })} />
          </Box>
        )}
        {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, borderTop: `1px solid ${HAIRLINE}`, pt: 1.25 }}>
          <Typography sx={{ flex: 1, fontSize: "0.76rem", color: FAINT }}>Saved as you click.</Typography>
          {/* from the tab, not from here: the page copies the card the tab sits on */}
          <Button size="small" onClick={() => { const b = at; setAt(null); if (b) more(b); }} sx={{ textTransform: "none", fontWeight: 650 }}>Its Actions page</Button>
        </Box>
      </Popover>
    </>
  );
}
