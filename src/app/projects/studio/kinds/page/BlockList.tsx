"use client";
// THE BUILD PANE'S LIST OF BLOCKS (Content v8, SARCLA 10.11.2026 points 1-4: "on the left side leave only the blocks",
// "consider pages' blocks as existing blocks and allow block settings", "a module should be counted as a block - a normal
// block with editing options there"). One row a block, numbered as on the page: its name, a line of what it says, its
// state; a module's row carries a small "Module" mark. A click selects the block in the page (and a click in the page
// selects its row); its settings open beside it in the page (the row's settings icon, or the bar over the block); "More"
// duplicates, moves, takes it out or asks the AI. Rows move by dragging; the "+" between two adds a block there. No
// field forms here any more: the words are changed on the page itself (a click on them), the look in the settings.

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { BlockRow } from "@/lib/content/studio/kinds/page/blocklist";
import { lineOf, moveTarget, slotAt } from "@/lib/content/studio/kinds/page/dropSlot";
import { PINK } from "../../parts";
import { SHEEN_BG, sheen } from "./Fields";

const GREEN = "#1b7a55";
const AMBER = "#b7791f";
const RED = "#c5221f";

/** One thing the row's "More" menu offers. */
export type RowAct = { key: string; label: string; icon?: React.ReactNode; run: () => void; disabled?: boolean; tip?: string; danger?: boolean };

function StateMark({ row, busy }: { row: BlockRow; busy: boolean }) {
  if (busy) return <CircularProgress size={14} thickness={5} sx={{ color: PINK }} />;
  const tip = (t: string, node: React.ReactNode) => <Tooltip title={t} placement="left"><Box component="span" sx={{ display: "inline-grid", placeItems: "center" }}>{node}</Box></Tooltip>;
  switch (row.state) {
    case "written": return tip("Written", <CheckCircleIcon sx={{ fontSize: 16, color: GREEN }} />);
    case "picture": return tip(row.note || "A picture is missing", <ImageOutlinedIcon sx={{ fontSize: 16, color: AMBER }} />);
    case "partly": return tip(row.note || "Partly written", <Box sx={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${AMBER}`, background: `linear-gradient(90deg, ${AMBER} 50%, transparent 50%)`, boxSizing: "border-box" }} />);
    case "empty": return tip("Not written yet", <Box sx={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid #b9c3cf", boxSizing: "border-box" }} />);
    case "changed": return tip("Changed here", <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: GREEN }} />);
    case "hidden": return tip("Hidden on the page", <VisibilityOffOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />);
    case "held": return tip(row.note || "Held back - not on the page", <ErrorOutlineIcon sx={{ fontSize: 16, color: RED }} />);
    default: return null;
  }
}

/** The "+" between two rows: "Add a block here" - shows on hover. */
function Gap({ onAdd, last }: { onAdd: (el: HTMLElement) => void; last?: boolean }) {
  return (
    <Box sx={{ position: "relative", height: 0, zIndex: 3, "&::before": { content: '""', position: "absolute", left: 0, right: 0, top: last ? -10 : -6, height: last ? 10 : 12 }, "&:hover .gap-add, &:hover .gap-line": { opacity: 1 } }}>
      <Box className="gap-line" sx={{ position: "absolute", left: 40, right: 12, top: -1, height: 2, bgcolor: PINK, opacity: 0, transition: "opacity .12s", pointerEvents: "none" }} />
      <Tooltip title="Add a block here" placement="left">
        <Box className="gap-add" component="button" type="button" aria-label="Add a block here" onClick={(e: React.MouseEvent<HTMLElement>) => onAdd(e.currentTarget)}
          sx={{ all: "unset", position: "absolute", left: 14, top: -10, width: 20, height: 20, borderRadius: "5px", bgcolor: PINK, color: "#fff", display: "grid", placeItems: "center",
            cursor: "pointer", opacity: 0, transition: "opacity .12s", boxShadow: "0 3px 10px rgba(194,44,110,.35)", "&:focus-visible": { opacity: 1, outline: "2px solid #2459d1" } }}>
          <AddIcon sx={{ fontSize: 15 }} />
        </Box>
      </Tooltip>
    </Box>
  );
}

export function BlockList({ rows, selected, busy, canEdit, onSelect, onSettings, menu, onMove, onAdd, empty }: {
  rows: BlockRow[];
  /** the row of what is selected in the page */
  selected: string | null;
  /** rows being written or filled now ("Writing…") */
  busy: Record<string, string>;
  canEdit: boolean;
  onSelect: (row: BlockRow) => void;
  onSettings: (row: BlockRow) => void;
  /** the row's "More" menu */
  menu: (row: BlockRow) => RowAct[];
  /** a row dragged to a place (`to`: its index once moved) - none when nothing moves */
  onMove?: (row: BlockRow, to: number) => void;
  /** the "+" after the row at `at` (0 = above the first) */
  onAdd?: (at: number, el: HTMLElement) => void;
  /** said while the list is empty */
  empty?: React.ReactNode;
}) {
  const [drag, setDrag] = useState<{ key: string; over: number | null } | null>(null);
  const [open, setOpen] = useState<{ row: BlockRow; el: HTMLElement } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Content v13 (SARCLA 11.11.2026: "sometimes drag and drop on modules don't put it up"): the WHOLE list answers a drag -
  // the strip between two rows too, where a drop was refused and lost - and the place comes from the pointer and the rows'
  // boxes (lib .../dropSlot.ts): the line shows it, the drop puts the block exactly there
  const slotOf = (y: number, key: string): number => {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>(":scope > [data-row]") ?? []);
    const boxes = els.map((el) => { const b = el.getBoundingClientRect(); return { top: b.top, height: b.height }; });
    const r = rows.find((x) => x.key === key);
    // nothing goes above the page's own first block that stays first (the hero) - but a module may
    const min = r && !r.module && rows[0] && !rows[0].movable ? 1 : 0;
    return slotAt(boxes, y, min);
  };
  const drop = (y: number) => {
    if (!drag || !onMove) return;
    const from = rows.findIndex((r) => r.key === drag.key);
    const to = moveTarget(from, slotOf(y, drag.key), rows.length);
    setDrag(null);
    if (to === null) return;
    onMove(rows[from], to);
  };
  // the line where the block would land - none where it would stay as it is
  const line = drag && drag.over !== null && moveTarget(rows.findIndex((r) => r.key === drag.key), drag.over, rows.length) !== null ? lineOf(drag.over, rows.length) : null;
  if (!rows.length) return <Box sx={{ p: 1.5, borderRadius: "10px", border: `1px dashed ${HAIRLINE}`, color: MUTED, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 1 }}>{empty}</Box>;
  const acts = open ? menu(open.row) : [];
  return (
    <Box ref={listRef} role="list" aria-label="The page's blocks" sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "visible", bgcolor: "#fff" }}
      onDragOver={drag ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; const o = slotOf(e.clientY, drag.key); if (o !== drag.over) setDrag({ ...drag, over: o }); } : undefined}
      onDrop={drag ? (e) => { e.preventDefault(); drop(e.clientY); } : undefined}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag((d) => (d ? { ...d, over: null } : d)); }}>
      {rows.map((r, i) => {
        const on = selected === r.key;
        const working = busy[r.key];
        const over = line && line.row === i ? (line.edge === "top" ? "above" : "below") : null;
        const row = (
          <Box key={r.key} role="listitem" data-row={r.key}
            sx={{ position: "relative", borderTop: i ? `1px solid ${HAIRLINE}` : "none",
              ...(i === 0 ? { borderTopLeftRadius: "10px", borderTopRightRadius: "10px" } : {}), ...(i === rows.length - 1 ? { borderBottomLeftRadius: "10px", borderBottomRightRadius: "10px" } : {}),
              ...(over ? { boxShadow: over === "above" ? `inset 0 2px 0 ${PINK}` : `inset 0 -2px 0 ${PINK}` } : {}) }}>
            <Box role="button" tabIndex={0} aria-pressed={on} onClick={() => onSelect(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r); } }}
              sx={{
                display: "flex", alignItems: "center", gap: 0.9, pl: 0.5, pr: 0.75, py: 0.85, cursor: "pointer", outline: "none", borderRadius: "inherit",
                bgcolor: on ? "rgba(194,44,110,.06)" : "transparent", boxShadow: on ? `inset 3px 0 0 ${PINK}` : "none", transition: "background-color .15s",
                "&:hover": { bgcolor: on ? "rgba(194,44,110,.08)" : "rgba(21,34,58,.03)" }, "&:hover .acts, &:hover .handle, &:focus-within .acts": { opacity: 1 },
                "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` },
                ...(working ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite` } : {}),
              }}>
              {canEdit && r.movable && onMove ? (
                <Box className="handle" draggable onClick={(e: React.MouseEvent) => e.stopPropagation()} title="Drag to move"
                  onDragStart={(e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.key); setDrag({ key: r.key, over: null }); }} onDragEnd={() => setDrag(null)}
                  sx={{ display: "grid", placeItems: "center", cursor: "grab", color: MUTED, opacity: { xs: 0.6, md: 0.22 }, transition: "opacity .12s", width: 16, flexShrink: 0 }}>
                  <DragIndicatorIcon sx={{ fontSize: 16 }} />
                </Box>
              ) : <Box sx={{ width: 16, flexShrink: 0 }} />}
              <Box component="span" sx={{ minWidth: 22, height: 22, px: 0.4, boxSizing: "border-box", borderRadius: "5px", display: "inline-grid", placeItems: "center", flexShrink: 0,
                bgcolor: on ? PINK : r.kind === "module" ? "rgba(194,44,110,.08)" : "#eef1f5", color: on ? "#fff" : r.kind === "module" ? PINK : "#5b6675",
                fontSize: "0.72rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", transition: "background-color .2s, color .2s" }}>{r.num}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: r.state === "hidden" ? MUTED : INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
                    textDecoration: r.state === "hidden" ? "line-through" : "none" }}>{r.name}</Typography>
                  {r.module && (
                    <Tooltip title="A module of the library - a block like the others">
                      <Box component="span" sx={{ flexShrink: 0, fontSize: "0.6rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: PINK, border: "1px solid rgba(194,44,110,.35)", borderRadius: "3px", px: 0.5, lineHeight: "15px" }}>Module</Box>
                    </Tooltip>
                  )}
                  {r.kind === "ours" && (
                    <Box component="span" sx={{ flexShrink: 0, fontSize: "0.6rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#2459d1", border: "1px solid rgba(36,89,209,.3)", borderRadius: "3px", px: 0.5, lineHeight: "15px" }}>New</Box>
                  )}
                </Box>
                <Typography component="div" sx={{ fontSize: "0.74rem", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: working ? PINK : MUTED, fontWeight: working ? 600 : 400 }}>
                  {working ? working : (
                    <>
                      {r.note && r.state !== "written" ? <Box component="span" sx={{ color: r.state === "held" ? RED : AMBER, fontWeight: 600 }}>{r.note}{r.line ? " · " : ""}</Box> : null}
                      {r.line}
                    </>
                  )}
                </Typography>
              </Box>
              <Box sx={{ width: 18, display: "grid", placeItems: "center", flexShrink: 0 }}><StateMark row={r} busy={!!working} /></Box>
              {/* Content v14 (SARCLA 11.11.2026: "On the block side bar I should be able to click and add another block"):
                  a "+" on every row, always there - a block after this one */}
              {canEdit && onAdd && (
                <Tooltip title={`Add a block after block ${r.num}`}>
                  <IconButton size="small" data-add-after={r.key} onClick={(e) => { e.stopPropagation(); onAdd(i + 1, e.currentTarget); }} aria-label={`Add a block after block ${r.num}`}
                    sx={{ p: 0.35, ml: -0.25, borderRadius: "6px", color: PINK, border: "1px solid rgba(194,44,110,.28)", bgcolor: "#fff", "&:hover": { bgcolor: "rgba(194,44,110,.08)", borderColor: PINK } }}>
                    <AddIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Box className="acts" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", alignItems: "center", opacity: { xs: 1, md: on ? 1 : 0 }, transition: "opacity .12s", ml: -0.25 }}>
                <Tooltip title="Settings"><IconButton size="small" onClick={() => onSettings(r)} aria-label={`Settings of block ${r.num}`} sx={{ p: 0.5, color: on ? PINK : MUTED, "&:hover": { color: INK } }}><TuneIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="More"><IconButton size="small" onClick={(e) => setOpen({ row: r, el: e.currentTarget })} aria-label={`More for block ${r.num}`} sx={{ p: 0.5, color: MUTED, "&:hover": { color: INK } }}><MoreHorizIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
              </Box>
            </Box>
          </Box>
        );
        return canEdit && onAdd ? [row, <Gap key={`gap-${r.key}`} onAdd={(el) => onAdd(i + 1, el)} last={i === rows.length - 1} />] : [row];
      })}
      {canEdit && onAdd && (
        <Box component="button" type="button" data-add-end="1" onClick={(e: React.MouseEvent<HTMLElement>) => onAdd(rows.length, e.currentTarget)}
          sx={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6, width: "100%", py: 0.9, borderTop: `1px dashed ${HAIRLINE}`,
            borderBottomLeftRadius: "10px", borderBottomRightRadius: "10px", color: PINK, fontSize: "0.82rem", fontWeight: 700, "&:hover": { bgcolor: "rgba(194,44,110,.05)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: -2 } }}>
          <AddIcon sx={{ fontSize: 17 }} />Add a block
        </Box>
      )}
      <Menu anchorEl={open?.el ?? null} open={!!open} onClose={() => setOpen(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 220, boxShadow: "0 12px 32px rgba(21,34,58,.16)" } } }}>
        {acts.map((a) => {
          const item = (
            <MenuItem key={a.key} dense disabled={a.disabled} onClick={() => { setOpen(null); a.run(); }} sx={{ fontSize: "0.86rem", color: a.danger ? RED : INK, gap: 0.25 }}>
              {a.icon && <ListItemIcon sx={{ minWidth: 28, color: a.danger ? RED : MUTED, "& svg": { fontSize: 18 } }}>{a.icon}</ListItemIcon>}
              {a.label}
            </MenuItem>
          );
          return a.tip && a.disabled ? <Tooltip key={a.key} title={a.tip} placement="left"><span>{item}</span></Tooltip> : item;
        })}
      </Menu>
    </Box>
  );
}
