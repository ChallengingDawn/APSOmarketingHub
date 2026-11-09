"use client";
// THE PAGE'S OUTLINE ON THE LEFT (SARCLA 08.11.2026, evening: "The UX and the Build on the left: can we improve it to be
// more fluid, subdivided"). One short list of the page's parts - each with its state (written, empty, a picture missing,
// being written) and a line of what it says. A click opens that part alone (smoothly; the others close) and selects it in
// the preview, which scrolls to it; a click in the preview opens its part here. While the AI writes, the parts it works
// on shimmer here and in the page - the person sees it working the moment they click.
// Content v5 (SARCLA 09.11.2026: "each block should be a section", "add more elements by + next to sections"): a new
// page's map is its BLOCKS, one row each, numbered as on the page; a block with items opens into them (./Fields.tsx
// ItemRows); a "+" between two rows adds a block there (./AddBlock.tsx); rows move by dragging or up / down.

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { Change } from "@/lib/convert/versions";
import { moveBlock, moveBlockTo, removeBlock, type Fields } from "@/lib/content/studio/kinds/page/fields";
import { changeLine } from "@/lib/content/studio/kinds/page/model";
import { blocksOf, busyBlocks, type PartInfo } from "@/lib/content/studio/kinds/page/outline";
import type { ChangeHit } from "@/lib/content/studio/kinds/page/shop";
import type { ShopPart } from "@/lib/content/studio/kinds/page/shopParts";
import { PINK } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { BlockBody, SHEEN_BG, fillOfBlock, sheen, type FillRun, type PictureCtl } from "./Fields";

export type RowState = PartInfo["state"] | "busy" | "none";

const GREEN = "#1b7a55";
const AMBER = "#b7791f";

export function StateIcon({ state }: { state: RowState }) {
  if (state === "busy") return <CircularProgress size={15} thickness={5} sx={{ color: PINK, m: "1.5px" }} />;
  if (state === "written") return <CheckCircleIcon sx={{ fontSize: 18, color: GREEN }} />;
  if (state === "picture") return <ImageOutlinedIcon sx={{ fontSize: 18, color: AMBER }} />;
  if (state === "partly") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: `2px solid ${AMBER}`, background: `linear-gradient(90deg, ${AMBER} 50%, transparent 50%)`, boxSizing: "border-box" }} />;
  if (state === "empty") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: "1.5px solid #b9c3cf", boxSizing: "border-box" }} />;
  return <Box sx={{ width: 18 }} />;
}

/** One row of the outline: its state, name and a line of what it says; open, its body below - one open at a time. */
export function Row({ id, title, count, summary, state, open, onToggle, onAi, aiLabel, canAi, busyLabel, children, accent, num, actions, handle, drop, dragProps }: {
  id: string; title: string; count?: number | null; summary?: React.ReactNode; state: RowState; open: boolean; onToggle: () => void;
  onAi?: () => void; aiLabel?: string; canAi?: boolean;
  /** shown in place of the summary while the AI works on it */
  busyLabel?: string;
  children?: React.ReactNode;
  /** a row that is not a part of the page (the element selected, the languages) */
  accent?: "pink" | "blue";
  /** a block's number on the page (Content v5: "numbered as on the page") */
  num?: number | null;
  /** small buttons shown on hover, at the right (move, remove) */
  actions?: React.ReactNode;
  /** a drag handle, shown on hover at the left */
  handle?: React.ReactNode;
  /** while a row is dragged over this one: where it would land */
  drop?: "above" | "below" | null;
  /** the row's own drag-over / drop handlers */
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const busy = state === "busy";
  return (
    <Box data-row={id} {...dragProps} sx={{ position: "relative", borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" }, bgcolor: open ? "#fff" : "transparent", transition: "background-color .2s",
      ...(drop ? { boxShadow: drop === "above" ? `inset 0 2px 0 ${PINK}` : `inset 0 -2px 0 ${PINK}` } : {}) }}>
      <Box role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1.1, px: 1.5, py: 1.05, cursor: "pointer", position: "relative", outline: "none",
          ...(handle ? { pl: 0.5 } : {}),
          "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` },
          "&:hover .ai, &:hover .acts, &:hover .handle": { opacity: 1 },
          ...(open ? { boxShadow: `inset 3px 0 0 ${accent === "blue" ? "#2459d1" : PINK}` } : {}),
          ...(busy ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite` } : {}),
        }}>
        {handle}
        <StateIcon state={state} />
        {num ? (
          <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.4, boxSizing: "border-box", borderRadius: "4px", display: "inline-grid", placeItems: "center", flexShrink: 0, bgcolor: open ? PINK : "#eef1f5", color: open ? "#fff" : "#5b6675", fontSize: "0.7rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", transition: "background-color .2s, color .2s" }}>{num}</Box>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}{count ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {count}</Box> : null}
          </Typography>
          {(busy && busyLabel) ? <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 600, lineHeight: 1.35 }}>{busyLabel}</Typography>
            : summary ? <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</Typography> : null}
        </Box>
        {actions && <Box className="acts" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", alignItems: "center", opacity: { xs: 1, md: 0 }, transition: "opacity .12s" }}>{actions}</Box>}
        {onAi && (
          <Tooltip title={aiLabel ?? "Write it with AI"}>
            <span>
              <IconButton className="ai" size="small" disabled={!canAi || busy} onClick={(e) => { e.stopPropagation(); onAi(); }} aria-label={aiLabel ?? "Write it with AI"}
                sx={{ color: PINK, opacity: { xs: 1, md: open ? 1 : 0.55 }, transition: "opacity .15s" }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .22s ease" }} />
      </Box>
      <Collapse in={open} timeout={240} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.75, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** The rows in one quiet card. */
export function RowList({ children }: { children: React.ReactNode }) {
  return <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden", bgcolor: "rgba(250,251,253,.9)" }}>{children}</Box>;
}

/** The summary under a block: what it says, or what it still needs. */
function summaryOf(p: { state: string; missing: number; line: string; key: string }, making: number): React.ReactNode {
  if (making) return <Box component="span" sx={{ color: PINK, fontWeight: 600 }}>Making {making === 1 ? "the picture" : `${making} pictures`}…</Box>;
  if (p.key === "sections") return "Text with a picture beside it - not written yet";
  if (p.state === "empty") return "Not written yet";
  const miss = p.missing ? <Box component="span" sx={{ color: AMBER, fontWeight: 600 }}>{p.missing === 1 ? "picture missing" : `${p.missing} pictures missing`}{p.line ? " · " : ""}</Box> : null;
  return <>{miss}{p.line}</>;
}

const AI_LABEL: Record<string, string> = {
  hero: "Write the hero with AI", intro: "Write the intro with AI", benefits: "Write the tiles with AI", sections: "Write a few with AI",
  links: "Find the shop's pages with AI", faq: "Write the questions with AI", cta: "Write the call to action with AI", seo: "Write the search engine fields with AI",
};

/** The "+" between two rows: "Add a block here" (Content v5) - shows on hover, opens the squared menu. */
function AddGap({ at, onAdd, last }: { at: number; onAdd: (at: number, el: HTMLElement) => void; last?: boolean }) {
  return (
    <Box sx={{ position: "relative", height: 0, zIndex: 3, "&::before": { content: '""', position: "absolute", left: 0, right: 0, top: last ? -12 : -7, height: last ? 12 : 14 }, "&:hover .gap-add, &:hover .gap-line": { opacity: 1 } }}>
      <Box className="gap-line" sx={{ position: "absolute", left: 14, right: 14, top: -1, height: 2, bgcolor: PINK, opacity: 0, transition: "opacity .12s", pointerEvents: "none" }} />
      <Tooltip title="Add a block here" placement="left">
        <Box className="gap-add" component="button" type="button" aria-label="Add a block here" onClick={(e: React.MouseEvent<HTMLElement>) => onAdd(at, e.currentTarget)}
          sx={{ all: "unset", position: "absolute", left: "50%", top: -11, ml: "-11px", width: 22, height: 22, borderRadius: "5px", bgcolor: PINK, color: "#fff", display: "grid", placeItems: "center",
            cursor: "pointer", opacity: 0, transition: "opacity .12s", boxShadow: "0 3px 10px rgba(194,44,110,.35)", "&:focus-visible": { opacity: 1, outline: "2px solid #2459d1" } }}>
          <AddIcon sx={{ fontSize: 17 }} />
        </Box>
      </Tooltip>
    </Box>
  );
}

const actBtn = { p: 0.45, color: MUTED, "&:hover": { color: INK } } as const;

/**
 * A new page's blocks, one row each, in their order and numbered as on the page (Content v5, SARCLA 09.11.2026: "each
 * block should be a section"), then the search engine fields. A click opens that block alone and selects it in the page;
 * a block with items opens into them. Between two rows a "+" adds a block there; a row moves by dragging or up / down
 * and goes with the bin (the hero stays first).
 */
export function BlocksOutline({ api, f, set, store, canEdit, canAi, fill, busy, open, onOpen, focusPath, selKey, onFocusPath, onSelect, pictures, makingIn, onAdd, onAddText, onRefine }: {
  api: StudioApi; f: Fields; set: (next: Fields, label?: string) => void; store: string; canEdit: boolean; canAi: boolean; fill: FillRun; busy: string | null;
  open: string | null; onOpen: (block: string | null) => void; focusPath: string | null; selKey: string | null; onFocusPath: (p: string) => void;
  /** an item row clicked: selected in the page (null = its block) */
  onSelect: (sel: string | null) => void;
  pictures: PictureCtl;
  /** how many pictures of a block are being made */
  makingIn: (block: string) => number;
  /** the "+" asked at a place of the order: the menu opens at that element */
  onAdd: (at: number, el: HTMLElement) => void;
  /** a text-and-picture block put in the sections' empty slot */
  onAddText: (at: number) => void;
  onRefine?: (path: string) => void;
}) {
  const blocks = blocksOf(f);
  const writing = busyBlocks(busy, f);
  const order = blocks.filter((b) => b.num).map((b) => b.key);
  const [drag, setDrag] = useState<{ key: string; over: number | null } | null>(null);
  const dropAt = (to: number) => {
    if (!drag) return;
    const from = order.indexOf(drag.key);
    setDrag(null);
    if (from < 1 || to < 1 || to === from || to === from + 1) return;
    set(moveBlockTo(f, drag.key, to > from ? to - 1 : to), "Moved a block");
  };
  return (
    <RowList>
      {blocks.map((b, i) => {
        const isBusy = writing.includes(b.key);
        const pics = makingIn(b.key);
        const run = fillOfBlock(b.key);
        const movable = canEdit && !!b.num && b.key !== "hero";
        const over = drag && drag.over !== null && b.num ? (drag.over === i ? "above" : drag.over === i + 1 && i === order.length - 1 ? "below" : null) : null;
        const actions = movable ? (
          <>
            <Tooltip title="Move up"><span><IconButton size="small" disabled={i <= 1} onClick={() => set(moveBlock(f, b.key, -1), `Moved ${b.name.toLowerCase()} up`)} sx={actBtn}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
            <Tooltip title="Move down"><span><IconButton size="small" disabled={i >= order.length - 1} onClick={() => set(moveBlock(f, b.key, 1), `Moved ${b.name.toLowerCase()} down`)} sx={actBtn}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
            <Tooltip title="Take this block out of the page"><IconButton size="small" onClick={() => { if (open === b.key) onOpen(null); set(removeBlock(f, b.key), `Took ${b.name.toLowerCase()} (block ${b.num}) out`); }} sx={actBtn}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          </>
        ) : undefined;
        const handle = movable ? (
          <Box className="handle" draggable onClick={(e: React.MouseEvent) => e.stopPropagation()} title="Drag to move"
            onDragStart={(e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.key); setDrag({ key: b.key, over: null }); }} onDragEnd={() => setDrag(null)}
            sx={{ display: "grid", placeItems: "center", cursor: "grab", color: MUTED, opacity: { xs: 0.6, md: 0.25 }, transition: "opacity .12s", mr: -0.5 }}>
            <DragIndicatorIcon sx={{ fontSize: 17 }} />
          </Box>
        ) : canEdit ? <Box sx={{ width: 17, mr: -0.5, flexShrink: 0 }} /> : undefined;
        const row = (
          <Row key={b.key} id={b.key} num={b.num} title={b.name} count={b.count} state={isBusy || pics ? "busy" : b.state} summary={summaryOf(b, pics)}
            busyLabel={isBusy ? "Writing…" : `Making ${pics === 1 ? "the picture" : `${pics} pictures`}…`} open={open === b.key} onToggle={() => onOpen(open === b.key ? null : b.key)}
            onAi={canEdit && run ? () => void fill(run.part, run.id ? { id: run.id } : undefined) : undefined} aiLabel={b.key.startsWith("sections.") ? "Write this block with AI" : AI_LABEL[b.key]} canAi={canAi && !busy}
            actions={actions} handle={handle} drop={over}
            dragProps={b.num && drag ? {
              onDragOver: (e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const o = Math.max(1, e.clientY < r.top + r.height / 2 ? i : i + 1); if (o !== drag.over) setDrag({ ...drag, over: o }); },
              onDrop: (e) => { e.preventDefault(); if (drag.over !== null) dropAt(drag.over); },
            } : undefined}>
            <BlockBody api={api} block={b.key} f={f} set={set} store={store} canEdit={canEdit} canAi={canAi} fill={fill} busy={busy}
              focusPath={focusPath} selKey={selKey} onFocusPath={onFocusPath} onSelect={onSelect} pictures={pictures}
              onAddText={b.key === "sections" ? () => onAddText(i + 1) : undefined} onRefine={onRefine} />
          </Row>
        );
        // the "+" after every block of the page (not after the search engine fields)
        return b.num && canEdit ? [row, <AddGap key={`add-${b.key}`} at={i + 1} onAdd={onAdd} last={i === order.length - 1} />] : [row];
      })}
    </RowList>
  );
}

/* ── a page of the shop: its own sections ─────────────────────────────── */

/** One change, as a line under its part: its number, what it does, whether the preview found it, and Remove. */
function ChangeItem({ i, c, hit, canEdit, onRemove }: { i: number; c: Change; hit: ChangeHit | undefined; canEdit: boolean; onRemove: (i: number) => void }) {
  const lost = hit?.state === "missing";
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.75, borderTop: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, width: 16, pt: 0.15, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.35, wordBreak: "break-word" }}>{changeLine(c)}</Typography>
        {lost && <Typography sx={{ fontSize: "0.72rem", color: AMBER, fontWeight: 600 }}>Not found on the page</Typography>}
      </Box>
      {canEdit && (
        <Tooltip title="Take this change out">
          <IconButton size="small" onClick={() => onRemove(i)} aria-label={`Take change ${i + 1} out`} sx={{ mt: -0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * A page of the shop as its parts (SARCLA's night list, 09.11.2026: "shop pages get a parts outline too, not only the
 * change list"): its sections as the server read them, each with its state (changed / not changed / being changed by the
 * AI), a line of what it says and its changes. A click opens one and selects it in the page, which scrolls there; a click
 * in the page opens the part it is in, with the element selected at its top.
 */
export function ShopPartsOutline({ parts, whole, elsewhere, changes, hits, open, onOpen, busyPart, canEdit, canAi, onAsk, onRemove, selected }: {
  parts: ShopPart[]; whole: number[]; elsewhere: number[]; changes: Change[]; hits: ChangeHit[] | null;
  open: string | null; onOpen: (p: ShopPart | null) => void;
  /** the part the AI is changing ("page": all of them) */
  busyPart: string | null;
  canEdit: boolean; canAi: boolean;
  onAsk: (p: ShopPart) => void; onRemove: (i: number) => void;
  /** the element selected in the page, shown at the top of the part it is in */
  selected: { part: string | null; node: React.ReactNode } | null;
}) {
  const hitOf = (i: number) => hits?.find((h) => h.index === i);
  const across = [...whole, ...elsewhere];
  const rowOf = (p: ShopPart) => {
    const id = `part:${p.id}`;
    const isOpen = open === id;
    const busy = busyPart === p.id || busyPart === "page";
    const lost = p.changes.filter((i) => hitOf(i)?.state === "missing").length;
    const n = p.changes.length;
    const summary = n ? <><Box component="span" sx={{ color: GREEN, fontWeight: 600 }}>{n} change{n === 1 ? "" : "s"}</Box>{p.summary ? ` · ${p.summary}` : ""}</> : (p.summary || "Not changed");
    const here = selected && selected.part === p.id ? selected.node : null;
    return (
      <Row key={p.id} id={id} title={p.name} state={busy ? "busy" : n ? (lost ? "partly" : "written") : "empty"} summary={summary} busyLabel="The AI is changing it…"
        open={isOpen} onToggle={() => onOpen(isOpen ? null : p)} onAi={canEdit ? () => onAsk(p) : undefined} aiLabel="Change this part with AI" canAi={canAi && !busyPart}>
        {here && <Box sx={{ mb: 1.25, p: 1.25, borderRadius: "8px", border: "1px solid rgba(194,44,110,.25)", bgcolor: "rgba(194,44,110,.04)" }}>{here}</Box>}
        {p.summary && !here && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1, lineHeight: 1.4 }}>{p.tag !== "top" ? `${p.tag.toUpperCase()} · ` : ""}{p.summary}</Typography>}
        {n > 0 ? p.changes.map((i) => <ChangeItem key={i} i={i} c={changes[i]} hit={hitOf(i)} canEdit={canEdit} onRemove={onRemove} />)
          : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No change here yet. Ask the AI on the right - it works on this part alone - or double-click its words in the page.</Typography>}
        {canEdit && (
          <Box component="button" type="button" disabled={!canAi || !!busyPart} onClick={() => onAsk(p)} sx={{
            all: "unset", boxSizing: "border-box", mt: 1.25, display: "flex", alignItems: "center", gap: 0.75, width: "100%", px: 1.25, py: 0.8, borderRadius: "7px", cursor: canAi && !busyPart ? "pointer" : "default",
            border: "1px solid rgba(194,44,110,.3)", color: canAi && !busyPart ? PINK : "#b3bccb", fontSize: "0.82rem", fontWeight: 650, "&:hover": canAi && !busyPart ? { bgcolor: "rgba(194,44,110,.06)" } : {},
          }}>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />Change this part with AI
          </Box>
        )}
      </Row>
    );
  };
  return (
    <RowList>
      {parts.map(rowOf)}
      {across.length > 0 && (
        <Row id="part:across" title="Across the page" count={across.length} state={busyPart === "page" ? "busy" : "written"} summary={whole.length ? "Its look (styles), and changes not in one part" : "Changes not in one part"}
          open={open === "part:across"} onToggle={() => onOpen(open === "part:across" ? null : { id: "across", name: "Across the page", tag: "top", selector: "", heading: "", summary: "", size: 0, changes: across })}>
          {across.map((i) => <ChangeItem key={i} i={i} c={changes[i]} hit={hitOf(i)} canEdit={canEdit} onRemove={onRemove} />)}
        </Row>
      )}
    </RowList>
  );
}
