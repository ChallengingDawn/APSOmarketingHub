"use client";
// A NEW PAGE'S FIELDS, ONE PART AT A TIME (SARCLA 08.11.2026: "the new page should allow many more fields and allow
// filling fields with AI"; that evening: "The UX and the Build on the left: can we improve it to be more fluid,
// subdivided"). The outline (./Outline.tsx) opens one part; this is that part's fields - the hero's lines, the intro, each
// benefit, section, link and question - with the look of the field selected and the part's background tucked under
// them. A field in focus is the element selected in the preview, and a click in the preview brings its field here.
//
// Pictures: SARCLA "AI wrote the whole page ... It's not generating photos". The AI's idea for each picture is made into
// the picture by the studio itself (./Studio.tsx autoPictures); the slot shows it being made, then offers "Make another"
// and "Upload" - and says plainly when the hub cannot make pictures.

import { moveTarget } from "@/lib/content/studio/kinds/page/dropSlot";
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LIMIT, addItem, moveItem, moveItemTo, removeItem, setField, setLook,
  type BlockBg, type Btn, type Fields, type ListKey, type Look, type Pic, type TextAlign, type TextColor, type TextSize,
} from "@/lib/content/studio/kinds/page/fields";
import type { Part } from "@/lib/content/studio/kinds/page/fill";
import { urlKeyOf } from "@/lib/content/studio/kinds/page/model";
import { ITEM_NAME, blocksOf, itemOfPath, itemsOf } from "@/lib/content/studio/kinds/page/outline";
import type { PageRow } from "@/lib/content/studio/kinds/page/shop";
import { PicturePanel, uploadPicture, type PictureAspect } from "../../pictures";
import { Field, PINK, btn, field } from "../../parts";
import { PictureSlot as StandardSlot } from "../../standard";
import type { StudioApi } from "../../useStudio";
import { Choice, Hint } from "./ui";

export type FillRun = (part: Part, opts?: { id?: string; request?: string; mode?: "topic" | "better" | "ask" }) => Promise<string | null>;

/** A picture slot being made, or what went wrong (the studio keeps it by language and path). */
export type Making = { state: "making" | "error"; error?: string; label?: string; /** the words it is being made from (Content v13) */ idea?: string };
/** What the studio offers every picture slot: its state, "make it now", and whether the hub makes pictures at all. */
export type PictureCtl = {
  making: (path: string) => Making | null;
  make: (path: string, idea: string) => void;
  /** null while the hub has not said yet */
  imagesOn: boolean | null;
  /** "Gallery" asked over a picture in the page: that slot's gallery opens here */
  gallery?: { path: string; nonce: number } | null;
};

export const sheen = keyframes`from { background-position: 140% 0; } to { background-position: -140% 0; }`;
export const SHEEN_BG = "linear-gradient(100deg, rgba(255,255,255,0) 25%, rgba(194,44,110,.13) 42%, rgba(255,255,255,.75) 50%, rgba(36,89,209,.12) 58%, rgba(255,255,255,0) 75%)";

/** A field that says when it is in focus - the preview selects it - and shows it is the one selected. */
function F({ path, onFocusPath, focused, look, ...rest }: { path: string; onFocusPath: (p: string) => void; focused: boolean; look?: React.ReactNode } & Parameters<typeof Field>[0]) {
  return (
    <Box data-field={path} onFocus={() => onFocusPath(path)} sx={{ position: "relative", borderRadius: "8px", mx: -0.75, px: 0.75, pt: 0.75, mb: 0.25, transition: "background-color .2s", bgcolor: focused ? "rgba(194,44,110,.06)" : "transparent" }}>
      <Field {...rest} />
      {look}
    </Box>
  );
}

/** A shop address: typed, or found among the shop's pages. */
export function LinkInput({ api, value, onChange, store, disabled, label = "Where it goes" }: {
  api: StudioApi; value: string; onChange: (v: string) => void; store: string; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PageRow[] | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const r = await api.act<{ rows: PageRow[] }>("pages", { q, store, page: 0 });
      setRows(r.ok ? r.result.rows.slice(0, 8) : []);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, store]);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
        <TextField fullWidth size="small" label={label} value={value} disabled={disabled} placeholder={`/${store}/…`} onChange={(e) => onChange(e.target.value)} sx={field} />
        <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ ...btn, color: INK, borderRadius: "6px", border: `1px solid ${HAIRLINE}`, height: 40, flexShrink: 0 }}>{open ? "Close" : "Find a page"}</Button>
      </Box>
      <Collapse in={open} timeout={180} unmountOnExit>
        <Box sx={{ mt: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", p: 1 }}>
          <TextField fullWidth size="small" autoFocus placeholder={`Search the shop's pages in ${store}`} value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, mb: 0.75 }} />
          {!rows && <CircularProgress size={14} />}
          {rows?.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No page matches.</Typography>}
          {rows?.map((r) => (
            <Box key={r.path} component="button" type="button" onClick={() => { onChange(r.path); setOpen(false); }} sx={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", cursor: "pointer", px: 1, py: 0.6, borderRadius: "6px", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textTransform: "capitalize" }}>{r.name}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.path}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * A picture of the page: what it shows, being made (its own animation), then "Make another", "Upload", "Choose" -
 * or, when the hub cannot make pictures, that said plainly with "Upload" beside it.
 */
export function PictureSlot({ api, pic, set, disabled, aspect = "3:2", path, ctl, onRefine }: {
  api: StudioApi; pic: Pic; set: (p: Pic) => void; disabled?: boolean; aspect?: PictureAspect; path?: string; ctl?: PictureCtl;
  /** "Fine-tune": the same picture with one change, asked in the assistant (Content v5) */
  onRefine?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const askedGallery = ctl?.gallery && ctl.gallery.path === path ? ctl.gallery.nonce : 0;
  useEffect(() => { if (askedGallery) setOpen(true); }, [askedGallery]);
  const [up, setUp] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const m0 = path && ctl ? ctl.making(path) : null;
  // a picture put in after a failed try: the failure is history
  const m = m0?.state === "error" && pic.url ? null : m0;
  const making = m?.state === "making";
  const canMake = !!ctl && !!path && !!pic.idea.trim() && ctl.imagesOn !== false;
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setUp(0);
    const r = await uploadPicture(f, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }, setUp);
    setUp(null);
    if (!r.ok) { setErr(r.error); return; }
    set({ ...pic, url: r.picture.url, alt: pic.alt || f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) });
  };
  // no picture and no idea yet: the studios' one slot (flow standard §3) - the idea typed right there ("What should the
  // picture show?"), "Make it" once it has words, "Upload". It stays that slot while the person types the idea (no jump
  // to the card below at the first letter); an idea the AI wrote keeps the card below, as before.
  // the words typed stay here (no letter lost to a redraw) and reach the page half a second after the last key
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { if (pic.url) setDraft(null); }, [pic.url]);
  useEffect(() => {
    if (draft === null || draft === pic.idea) return;
    const t = setTimeout(() => set({ ...pic, idea: draft }), 500);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = draft ?? pic.idea;
  if (ctl && path && !pic.url && !making && m?.state !== "error" && (!pic.idea.trim() || draft !== null)) {
    return (
      <Box sx={{ mb: 1.25 }}>
        <StandardSlot url={null} idea={typed} onIdea={setDraft} making={up !== null} uploading={up !== null}
          error={err} canEdit={!disabled} canMake={ctl.imagesOn !== false} makeDisabled={!typed.trim()} height={96}
          onMake={() => { const idea = typed.trim(); if (!idea) return; if (idea !== pic.idea) set({ ...pic, idea }); ctl.make(path, idea); }} onUpload={(f) => void upload(f)}
          onGallery={() => setOpen((x) => !x)} onRemove={() => set({ ...pic, url: "" })} />
        <Collapse in={open} timeout={200} unmountOnExit>
          <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff" }}>
            <PicturePanel projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect={aspect} suggestion={pic.idea} columns={3}
              tabs={["project", "mine", "make"]} start="project"
              onPick={(p) => { set({ ...pic, url: p.url, alt: p.alt || pic.alt || p.prompt?.slice(0, 120) || "" }); setOpen(false); }} />
          </Box>
        </Collapse>
      </Box>
    );
  }
  const lineColor = m?.state === "error" ? "#a96a12" : MUTED;
  const line = making ? (m?.label ? `${m.label} Up to 40 seconds - it lands here and in the page.` : "Up to 40 seconds - it lands here and in the page.")
    : m?.state === "error" ? m.error
    : !pic.url && ctl?.imagesOn === false && pic.idea ? "Pictures cannot be made on this hub - its image model is not set up. Upload one instead."
    : pic.idea ? `Idea: ${pic.idea}` : pic.url ? "" : "No idea for it yet - upload one, or choose one already made.";
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
        <Box sx={{
          position: "relative", width: 112, height: 75, borderRadius: "6px", overflow: "hidden", flexShrink: 0, bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center",
          ...(making ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.4s linear infinite` } : {}),
        }}>
          {pic.url ? <Box component="img" src={pic.url} alt={pic.alt} sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: making ? 0.5 : 1 }} />
            : making ? <AutoAwesomeOutlinedIcon sx={{ color: PINK, fontSize: 20 }} /> : <ImageOutlinedIcon sx={{ color: MUTED }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK }}>{making ? (m?.label?.startsWith("Fine") ? "Fine-tuning the picture" : "Making the picture") : pic.url ? "The picture" : "No picture yet"}</Typography>
          {line && <Typography sx={{ fontSize: "0.74rem", color: lineColor, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{line}</Typography>}
          {making && <LinearProgress sx={{ mt: 0.75, height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />}
          {!making && (
            // one tidy line (SARCLA's night list): the slot's main action in words, the other three as icons with their names
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mt: 0.25, flexWrap: "nowrap", mx: -0.75 }}>
              {pic.url && onRefine && ctl?.imagesOn !== false && (
                <Button size="small" disabled={disabled} onClick={onRefine} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.75, color: PINK, whiteSpace: "nowrap" }}>Fine-tune</Button>
              )}
              {canMake && (
                <Button size="small" disabled={disabled} onClick={() => ctl!.make(path!, pic.idea)} startIcon={pic.url && onRefine ? undefined : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.75, color: pic.url && onRefine ? INK : PINK, whiteSpace: "nowrap" }}>
                  {pic.url ? (onRefine ? "Another" : "Make another") : m?.state === "error" ? "Try again" : "Make it"}
                </Button>
              )}
              <Tooltip title="Upload a picture"><span><IconButton size="small" aria-label="Upload a picture" disabled={disabled || up !== null} onClick={() => file.current?.click()} sx={{ color: INK }}><FileUploadOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
              <Tooltip title={open ? "Close the gallery" : "Gallery - pictures already made"}><span><IconButton size="small" aria-label="Gallery" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ color: open ? PINK : INK }}><PhotoLibraryOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
              {pic.url && <Tooltip title="Take the picture out"><span><IconButton size="small" aria-label="Take the picture out" disabled={disabled} onClick={() => set({ ...pic, url: "" })} sx={{ color: MUTED }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>}
            </Box>
          )}
          {up !== null && <LinearProgress variant="determinate" value={up * 100} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />}
          {err && <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", mt: 0.25 }}>{err}</Typography>}
          <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </Box>
      </Box>
      <Collapse in={open} timeout={200} unmountOnExit>
        <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff" }}>
          <PicturePanel projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect={aspect} suggestion={pic.idea} columns={3}
            tabs={["project", "mine", "make"]} start="project"
            onPick={(p) => { set({ ...pic, url: p.url, alt: p.alt || pic.alt || p.prompt?.slice(0, 120) || "" }); setOpen(false); }} />
        </Box>
      </Collapse>
      {pic.url && !making && <Box sx={{ mt: 1 }}><Field label="What it shows (alt text)" value={pic.alt} max={LIMIT.alt} disabled={disabled} onChange={(v) => set({ ...pic, alt: v })} /></Box>}
    </Box>
  );
}

/* ── the look of the field selected, the background of a part ─────────── */

function TextLook({ look, set }: { look: Look; set: (p: Partial<Look>) => void }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75, pb: 1.25 }}>
      <Choice label="Size" value={look.size ?? "m"} onChange={(v: TextSize) => set({ size: v === "m" ? undefined : v })} options={[{ key: "s", label: "Small" }, { key: "m", label: "Normal" }, { key: "l", label: "Large" }]} />
      <Choice label="Align" value={look.align ?? "left"} onChange={(v: TextAlign) => set({ align: v === "left" ? undefined : v })} options={[{ key: "left", label: "Left" }, { key: "center", label: "Centre" }]} />
      <Choice label="Colour" value={look.color ?? "auto"} onChange={(v: TextColor | "auto") => set({ color: v === "auto" ? undefined : v })}
        options={[{ key: "auto", label: "Standard" }, { key: "petrol", label: "Petrol" }, { key: "ink", label: "Ink" }, { key: "red", label: "Red" }, { key: "muted", label: "Grey" }]} />
    </Box>
  );
}

/** "Look" under the field selected - tucked away until asked for. */
function LookToggle({ path, f, setF, disabled }: { path: string; f: Fields; setF: (next: Fields, label?: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const look = f.looks[path] ?? {};
  const set = Object.keys(look).length;
  return (
    <Box sx={{ mt: -0.75, mb: 0.5 }}>
      <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} startIcon={<TuneIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.5, minWidth: 0, fontSize: "0.76rem", color: set ? PINK : MUTED }}>
        {open ? "Close the look" : set ? "Look · changed" : "Look"}
      </Button>
      <Collapse in={open} timeout={180} unmountOnExit><TextLook look={look} set={(p) => setF(setLook(f, path, p), "Changed the look")} /></Collapse>
    </Box>
  );
}

function Background({ path, f, setF, disabled }: { path: string; f: Fields; setF: (next: Fields, label?: string) => void; disabled: boolean }) {
  const look = f.looks[path] ?? {};
  return (
    <Box sx={{ pt: 1, mt: 0.5 }}>
      <Choice label="Background" value={look.bg ?? "default"} onChange={(v: BlockBg | "default") => !disabled && setF(setLook(f, path, { bg: v === "default" ? undefined : v }), "Changed the background")}
        options={[{ key: "default", label: "Standard" }, { key: "white", label: "White" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }]} />
    </Box>
  );
}

/* ── a block's items as rows (Content v5) ─────────────────────────────── */
//
// SARCLA 09.11.2026: "block 4 should be subdivided". A block with items (the tiles, the questions, the links) opens into
// them: each its own row - a click selects it in the page and opens its fields here; it moves by dragging or up / down,
// it goes with the bin, and "+ Tile" adds one.

const rowBtn = { p: 0.4, color: MUTED, "&:hover": { color: INK } } as const;

function ItemRows({ list, f, set, openItem, onSelect, canEdit, children }: {
  list: ListKey; f: Fields; set: (next: Fields, label?: string) => void; openItem: string | null; onSelect: (sel: string | null) => void; canEdit: boolean;
  /** the open item's fields */
  children: (id: string) => React.ReactNode;
}) {
  const items = itemsOf(f, list);
  const [drag, setDrag] = useState<{ id: string; over: number | null } | null>(null);
  const name = ITEM_NAME[list] ?? "Item";
  const drop = (to: number) => {
    if (!drag) return;
    const from = items.findIndex((x) => x.id === drag.id);
    setDrag(null);
    // Content v13: the same place rule as the list of blocks (lib .../dropSlot.ts)
    const at = moveTarget(from, to, items.length);
    if (at === null) return;
    set(moveItemTo(f, list, drag.id, at), `Moved ${name.toLowerCase()} ${from + 1}`);
  };
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", overflow: "hidden", mb: 1 }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag((d) => (d ? { ...d, over: null } : d)); }}>
      {items.map((it, i) => {
        const open = openItem === it.key;
        return (
          <Box key={it.id} data-item={it.key} sx={{ borderTop: i ? `1px solid ${HAIRLINE}` : "none", position: "relative", bgcolor: open ? "rgba(194,44,110,.035)" : "transparent",
            ...(drag?.over === i ? { boxShadow: `inset 0 2px 0 ${PINK}` } : drag?.over === i + 1 && i === items.length - 1 ? { boxShadow: `inset 0 -2px 0 ${PINK}` } : {}) }}
            onDragOver={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const over = e.clientY < r.top + r.height / 2 ? i : i + 1; if (over !== drag.over) setDrag({ ...drag, over }); }}
            onDrop={(e) => { e.preventDefault(); if (drag?.over !== null && drag?.over !== undefined) drop(drag.over); }}>
            <Box role="button" tabIndex={0} aria-expanded={open} onClick={() => onSelect(open ? null : it.sel)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(open ? null : it.sel); } }}
              sx={{ display: "flex", alignItems: "center", gap: 0.75, pl: 0.5, pr: 0.5, py: 0.6, cursor: "pointer", outline: "none", "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:hover .acts": { opacity: 1 }, "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` }, ...(open ? { boxShadow: `inset 3px 0 0 ${PINK}` } : {}) }}>
              {canEdit ? (
                <Box className="acts" draggable onDragStart={(e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.key); setDrag({ id: it.id, over: null }); }}
                  onDragEnd={() => setDrag(null)} onClick={(e: React.MouseEvent) => e.stopPropagation()} title="Drag to move"
                  sx={{ display: "grid", placeItems: "center", cursor: "grab", color: MUTED, opacity: 0.35, transition: "opacity .12s" }}>
                  <DragIndicatorIcon sx={{ fontSize: 16 }} />
                </Box>
              ) : <Box sx={{ width: 16 }} />}
              <StateDot state={it.state} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: INK }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{it.name}</Box>
                  <Box component="span" sx={{ color: MUTED }}>{it.line ? ` · ${it.line}` : " · not written yet"}</Box>
                </Typography>
              </Box>
              {canEdit && (
                <Box className="acts" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", opacity: { xs: 1, md: open ? 1 : 0 }, transition: "opacity .12s" }}>
                  <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => set(moveItem(f, list, it.id, -1), `Moved ${it.name.toLowerCase()} up`)} sx={rowBtn}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                  <Tooltip title="Down"><span><IconButton size="small" disabled={i === items.length - 1} onClick={() => set(moveItem(f, list, it.id, 1), `Moved ${it.name.toLowerCase()} down`)} sx={rowBtn}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                  <Tooltip title={`Remove ${it.name.toLowerCase()}`}><IconButton size="small" onClick={() => { if (open) onSelect(null); set(removeItem(f, list, it.id), `Removed ${it.name.toLowerCase()}`); }} sx={rowBtn}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Box>
              )}
              <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </Box>
            <Collapse in={open} timeout={200} unmountOnExit>
              <Box sx={{ px: 1.25, pb: 1, pt: 0.25 }}>{children(it.id)}</Box>
            </Collapse>
          </Box>
        );
      })}
      {!items.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED, px: 1.25, py: 1 }}>No {name.toLowerCase()} yet.</Typography>}
    </Box>
  );
}

function StateDot({ state }: { state: string }) {
  const c = state === "written" ? "#1b7a55" : state === "partly" ? "#b7791f" : null;
  return <Box sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", bgcolor: c ?? "transparent", border: c ? "none" : "1.5px solid #b9c3cf", boxSizing: "border-box" }} />;
}

/** "+ Tile", "+ Question", "+ Link" - the item is added at the end, selected, its fields open. */
function AddItemBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="small" startIcon={<AddIcon />} disabled={disabled} onClick={onClick}
      sx={{ ...btn, color: INK, border: `1px dashed ${HAIRLINE}`, borderRadius: "6px", px: 1.25, "&:hover": { borderColor: PINK, color: PINK, bgcolor: "rgba(194,44,110,.04)" } }}>{label}</Button>
  );
}

/* ── a block's fields ─────────────────────────────────────────────────── */

/** The AI's run for a block: "sections.ab12" is that section alone, "sections" (the empty slot) writes a few. */
export function fillOfBlock(block: string): { part: Part; id?: string } | null {
  if (block.startsWith("sections.")) return { part: "section", id: block.slice(9) };
  const k = block === "intro-block" ? "intro" : block;
  return (["hero", "intro", "benefits", "sections", "links", "faq", "cta", "seo"] as string[]).includes(k) ? { part: k as Part } : null;
}

export function BlockBody({ api, block, f, set, store, canEdit, canAi, fill, busy, focusPath, selKey, onFocusPath, onSelect, pictures, onAddText, onRefine }: {
  api: StudioApi; block: string; f: Fields; set: (next: Fields, label?: string) => void; store: string; canEdit: boolean; canAi: boolean;
  fill: FillRun; busy: string | null; focusPath: string | null;
  /** what is selected in the page ("b:benefits.x", "f:faq.y.q"...) - an item of this block opens its row */
  selKey: string | null;
  onFocusPath: (p: string) => void;
  /** an item row clicked: selected in the page (null = the block itself) */
  onSelect: (sel: string | null) => void;
  pictures: PictureCtl;
  /** the sections' empty slot: one text-and-picture block put in its place */
  onAddText?: () => void;
  /** a picture fine-tuned: selected, the assistant offers its asks */
  onRefine?: (path: string) => void;
}) {
  const top = useRef<HTMLDivElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const d = !canEdit;
  const up = (path: string, v: unknown) => set(setField(f, path, v));
  const run = async (p: Part, opts?: { id?: string; request?: string }) => { setMsg(null); const r = await fill(p, opts); if (r) setMsg(r); };
  const selPath = selKey ? selKey.slice(2) : null;
  const openItem = itemOfPath(selPath);

  // a field (or an item) selected in the preview comes into view here
  useEffect(() => {
    const key = focusPath ?? selPath;
    if (!key) return;
    const t = setTimeout(() => {
      const el = top.current?.querySelector(`[data-field="${CSS.escape(key)}"]`) ?? top.current?.querySelector(`[data-item="${CSS.escape(itemOfPath(key) ?? key)}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 240);
    return () => clearTimeout(t);
  }, [focusPath, selPath]);

  const look = (path: string) => (focusPath === path && canEdit ? <LookToggle path={path} f={f} setF={set} disabled={d} /> : undefined);
  const fp = (path: string) => ({ path, onFocusPath, focused: focusPath === path, look: look(path) });
  const add = (key: ListKey) => { const r = addItem(f, key); set(r.fields, `Added ${(ITEM_NAME[key] ?? "an item").toLowerCase()}`); onSelect(key === "links" ? `f:links.${r.id}` : `b:${key}.${r.id}`); };
  const btnFields = (path: string, b: Btn) => (
    <>
      <F {...fp(`${path}.label`)} label="Button words" value={b.label} max={LIMIT.button} disabled={d} onChange={(v) => up(`${path}.label`, v)} />
      <LinkInput api={api} store={store} value={b.url} disabled={d} onChange={(v) => up(`${path}.url`, v)} />
    </>
  );
  const pic = (path: string, p: Pic) => (
    <Box data-field={path} onFocus={() => onFocusPath(path)}>
      <PictureSlot api={api} pic={p} disabled={d} path={path} ctl={pictures} onRefine={onRefine ? () => onRefine(path) : undefined}
        set={(n) => set(setField(f, path, n), n.url !== p.url ? "Changed a picture" : undefined)} />
    </Box>
  );

  // "Write this block" - the AI writes this block alone (Content v5)
  const ai = fillOfBlock(block);
  const info = blocksOf(f).find((x) => x.key === block);
  const writing = busy === (ai?.part === "section" ? `section:${ai.id}` : ai?.part);
  const aiRow = ai && canEdit ? (
    <Button size="small" disabled={!canAi || !!busy} onClick={() => void run(ai.part, ai.id ? { id: ai.id } : undefined)}
      startIcon={writing ? <CircularProgress size={13} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
      sx={{ ...btn, color: PINK, px: 0.75, ml: -0.75, mb: 0.75 }}>
      {writing ? "Writing…" : block === "sections" ? "Write a few with AI" : block === "seo" ? "Write them with AI" : info && info.state !== "empty" ? "Write this block again with AI" : "Write this block with AI"}
    </Button>
  ) : null;

  let body: React.ReactNode = null;
  if (block === "hero") {
    body = (
      <>
        <F {...fp("hero.eyebrow")} label="Small line above the title" value={f.hero.eyebrow} max={LIMIT.eyebrow} disabled={d} onChange={(v) => up("hero.eyebrow", v)} />
        <F {...fp("hero.title")} label="Title (the page's H1)" value={f.hero.title} max={LIMIT.heroTitle} disabled={d} onChange={(v) => up("hero.title", v)} />
        <F {...fp("hero.sub")} label="Line under the title" value={f.hero.sub} max={LIMIT.heroSub} multiline rows={2} disabled={d} onChange={(v) => up("hero.sub", v)} />
        {btnFields("hero.button", f.hero.button)}
        {pic("hero.picture", f.hero.picture)}
        <Background path="hero" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block === "intro") {
    body = (
      <>
        <F {...fp("intro")} label="Intro paragraph" value={f.intro} max={LIMIT.intro} multiline rows={4} disabled={d} onChange={(v) => up("intro", v)} />
        <Background path="intro-block" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block === "benefits") {
    body = (
      <>
        <F {...fp("benefitsTitle")} label="Heading" value={f.benefitsTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("benefitsTitle", v)} />
        <ItemRows list="benefits" f={f} set={set} openItem={openItem} onSelect={onSelect} canEdit={canEdit}>
          {(id) => {
            const b = f.benefits.find((x) => x.id === id);
            return b ? (
              <>
                <F {...fp(`benefits.${id}.title`)} label="Title" value={b.title} max={LIMIT.benefitTitle} disabled={d} onChange={(v) => up(`benefits.${id}.title`, v)} />
                <F {...fp(`benefits.${id}.text`)} label="Text" value={b.text} max={LIMIT.benefitText} multiline rows={2} disabled={d} onChange={(v) => up(`benefits.${id}.text`, v)} />
              </>
            ) : null;
          }}
        </ItemRows>
        {f.benefits.length < 8 && canEdit && <AddItemBtn label="Tile" onClick={() => add("benefits")} />}
        <Background path="benefits" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block.startsWith("sections.")) {
    const s = f.sections.find((x) => `sections.${x.id}` === block);
    body = s ? (
      <>
        <F {...fp(`sections.${s.id}.title`)} label="Heading" value={s.title} max={LIMIT.sectionTitle} disabled={d} onChange={(v) => up(`sections.${s.id}.title`, v)} />
        <F {...fp(`sections.${s.id}.text`)} label="Text (a blank line = a new paragraph, - = a list)" value={s.text} max={LIMIT.sectionText} multiline rows={4} disabled={d} onChange={(v) => up(`sections.${s.id}.text`, v)} />
        {pic(`sections.${s.id}.picture`, s.picture)}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Choice label="Picture" value={s.side} onChange={(side) => !d && set(setField(f, `sections.${s.id}.side`, side), "Moved the picture")} options={[{ key: "left", label: "Left" }, { key: "right", label: "Right" }]} />
          <Background path={`sections.${s.id}`} f={f} setF={set} disabled={d} />
        </Box>
      </>
    ) : <Hint mt={0}>This block is gone.</Hint>;
  } else if (block === "sections") {
    body = (
      <>
        <Hint mt={0}>Text with a picture beside it - each one an idea of its own. The AI writes two to four, or add one and write it yourself.</Hint>
        {canEdit && onAddText && <Box sx={{ mt: 1 }}><AddItemBtn label="Text and picture" onClick={onAddText} /></Box>}
      </>
    );
  } else if (block === "links") {
    body = (
      <>
        <Hint mt={0}>Categories and products of {store}. The AI picks only among the shop&apos;s real pages.</Hint>
        <Box sx={{ mt: 0.5 }}><F {...fp("linksTitle")} label="Heading" value={f.linksTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("linksTitle", v)} /></Box>
        <ItemRows list="links" f={f} set={set} openItem={openItem} onSelect={onSelect} canEdit={canEdit}>
          {(id) => {
            const l = f.links.find((x) => x.id === id);
            return l ? (
              <Box data-field={`links.${id}`} onFocus={() => onFocusPath(`links.${id}`)}>
                <Field label="Words" value={l.label} max={LIMIT.linkLabel} disabled={d} onChange={(v) => up(`links.${id}.label`, v)} />
                <LinkInput api={api} store={store} value={l.url} disabled={d} label="The page" onChange={(v) => up(`links.${id}.url`, v)} />
                <Field label="What the visitor finds there" value={l.note} max={LIMIT.linkNote} disabled={d} onChange={(v) => up(`links.${id}.note`, v)} />
              </Box>
            ) : null;
          }}
        </ItemRows>
        {f.links.length < 16 && canEdit && <AddItemBtn label="Link" onClick={() => add("links")} />}
        <Background path="links" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block === "faq") {
    body = (
      <>
        <F {...fp("faqTitle")} label="Heading" value={f.faqTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("faqTitle", v)} />
        <ItemRows list="faq" f={f} set={set} openItem={openItem} onSelect={onSelect} canEdit={canEdit}>
          {(id) => {
            const q = f.faq.find((x) => x.id === id);
            return q ? (
              <>
                <F {...fp(`faq.${id}.q`)} label="Question" value={q.q} max={LIMIT.faqQ} disabled={d} onChange={(v) => up(`faq.${id}.q`, v)} />
                <F {...fp(`faq.${id}.a`)} label="Answer" value={q.a} max={LIMIT.faqA} multiline rows={3} disabled={d} onChange={(v) => up(`faq.${id}.a`, v)} />
              </>
            ) : null;
          }}
        </ItemRows>
        {f.faq.length < 14 && canEdit && <AddItemBtn label="Question" onClick={() => add("faq")} />}
        <Background path="faq" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block === "cta") {
    body = (
      <>
        <F {...fp("cta.title")} label="Title" value={f.cta.title} max={LIMIT.ctaTitle} disabled={d} onChange={(v) => up("cta.title", v)} />
        <F {...fp("cta.text")} label="Text" value={f.cta.text} max={LIMIT.ctaText} multiline rows={2} disabled={d} onChange={(v) => up("cta.text", v)} />
        {btnFields("cta.button", f.cta.button)}
        <Background path="cta" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (block === "seo") {
    body = (
      <>
        <Hint mt={0}>What Google shows - not on the page itself.</Hint>
        <Box sx={{ mt: 0.75 }}>
          <F {...fp("seo.title")} look={undefined} label="Meta title" value={f.seo.title} max={LIMIT.seoTitle} disabled={d} placeholder={f.hero.title} onChange={(v) => up("seo.title", v)} />
          <F {...fp("seo.description")} look={undefined} label="Meta description" value={f.seo.description} max={LIMIT.seoDescription} multiline rows={2} disabled={d} onChange={(v) => up("seo.description", v)} />
          <F {...fp("seo.urlKey")} look={undefined} label="URL key" value={f.seo.urlKey} disabled={d} helper={`/${store}/${f.seo.urlKey || urlKeyOf(f.hero.title) || "…"}`} onChange={(v) => up("seo.urlKey", v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9-]+/g, "-").slice(0, 80))} />
        </Box>
      </>
    );
  }
  return (
    <Box ref={top}>
      {aiRow}
      {msg && <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px", mb: 1 }}>{msg}</Typography>}
      {body}
    </Box>
  );
}
