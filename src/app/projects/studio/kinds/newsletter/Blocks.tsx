"use client";
// THE NEWSLETTER'S BLOCKS (Content v3, 08.11.2026 - SARCLA: "newsletter also: editing is very confusing").
//   Outline     the e-mail's blocks on the left, drawn small, top to bottom: a click picks one (and shows it), drag or
//               the arrows to move, + to add; above them where to start from (one of our e-mails, a layout); under
//               them the way out (the checks, the HTML, the HubSpot draft behind its admin switch)
//   Gallery     the block types, each drawn as it looks in the e-mail
//   Layouts     three to start from, drawn small (the words already written are carried over)
//   BlockTools  what a picked block has besides its words, under its row: its picture, where its buttons go, the logo,
//               each product - each a pointer that opens THAT element's card on the e-mail (./ElementPop.tsx: its picture
//               made or uploaded, its link with "A page from the Page builder"), the one place it is edited (cv17); a
//               story's picture side, which is the block's own

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_HINT, BLOCK_LABEL, OUR_LOGO, TEMPLATES, blockOf, isOurLogo, newBlock,
  type Block, type BlockKind, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { linkNote } from "@/lib/content/studio/kinds/newsletter/pageLinks";
import { PINK, Pane, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { StateMark } from "../blog/Outline";
import { BLUE, Hint, toolBtn, useFitHeight } from "../blog/ui";
import { StateLine, type PageLinks } from "./PagePick";
import { BlockThumb, LayoutThumb } from "./thumbs";

const GALLERY: BlockKind[] = ["hero", "article", "text", "banner", "products", "facts", "cta", "divider", "header", "footer"];

/** The layouts to start from, drawn small. */
export function Layouts({ current, onPick }: { current?: string; onPick: (key: string) => void }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.25 }}>
      {TEMPLATES.map((t) => {
        const on = t.key === current;
        return (
          <Box key={t.key} component="button" type="button" onClick={() => onPick(t.key)} title={t.about} sx={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", p: 1, border: `1.5px solid ${on ? BLUE : HAIRLINE}`, borderRadius: "8px", bgcolor: on ? "rgba(36,89,209,.04)" : "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, "&:hover": { borderColor: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}` },
          }}>
            <Box sx={{ bgcolor: "#eef1f3", p: 0.75, width: "100%", display: "flex", justifyContent: "center", maxHeight: 150, overflow: "hidden" }}>
              <LayoutThumb blocks={t.blocks("EN")} w={72} />
            </Box>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, textAlign: "center", lineHeight: 1.25 }}>{t.name}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** The gallery of block types: each drawn as it looks in the e-mail. */
export function Gallery({ onPick }: { onPick: (k: BlockKind, layout?: "stacked" | "left" | "right") => void }) {
  type Item = { k: BlockKind; layout?: "stacked" | "left" | "right"; label: string; hint: string };
  const items: Item[] = GALLERY.flatMap((k): Item[] => k === "article"
    ? [{ k, layout: "stacked" as const, label: "Story", hint: "Picture above the text" }, { k, layout: "left" as const, label: "Story beside", hint: "Picture beside the text" }]
    : [{ k, label: BLOCK_LABEL[k], hint: BLOCK_HINT[k] }]);
  return (
    <Box sx={{ p: 1.5, width: 380 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Add a block here</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75 }}>
        {items.map((x) => (
          <Box key={`${x.k}-${x.layout ?? ""}`} component="button" type="button" onClick={() => onPick(x.k, x.layout)} title={x.hint} sx={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", p: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", display: "flex", flexDirection: "column", gap: 0.5,
            "&:hover": { borderColor: BLUE, bgcolor: "rgba(36,89,209,.03)" }, "&:focus-visible": { outline: `2px solid ${BLUE}` },
          }}>
            <Box sx={{ height: 62, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eef1f3", overflow: "hidden" }}><BlockThumb kind={x.k} layout={x.layout} w={92} /></Box>
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{x.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

const summary = (b: Block): string => {
  switch (b.kind) {
    case "hero": return b.headline || "No headline yet";
    case "article": return b.title || "No title yet";
    case "products": return b.title || `${b.items.filter((x) => x.name).length} products`;
    case "text": return b.text.replace(/\s+/g, " ").slice(0, 70) || "Empty";
    case "facts": return b.items.map((x) => x.big).filter(Boolean).join(" · ");
    case "cta": return b.button.label || b.text || "No button yet";
    case "banner": return b.imageUrl ? "A picture" : "No picture yet";
    case "header": return isOurLogo(b.logoUrl) ? "Our logo" : "Another logo";
    case "footer": return "Unsubscribe, masthead, privacy";
    default: return "";
  }
};
/** A block's state in the map: written, empty, or its picture missing. */
const stateOf = (b: Block): { state: "done" | "todo"; picture: boolean } => {
  const words = b.kind === "hero" ? !!b.headline.trim() : b.kind === "article" ? !!(b.title.trim() || b.text.trim()) : b.kind === "text" ? !!b.text.trim()
    : b.kind === "cta" ? !!b.button.label.trim() : b.kind === "products" ? b.items.some((x) => x.name.trim()) : true;
  const needsPic = b.kind === "hero" || b.kind === "article" || b.kind === "banner";
  const pic = needsPic && "imageUrl" in b && !b.imageUrl;
  return { state: words && !pic ? "done" : "todo", picture: pic && words };
};
const picOf = (b: Block) => ("imageUrl" in b && b.imageUrl ? b.imageUrl : b.kind === "products" ? b.items.find((x) => x.imageUrl)?.imageUrl ?? "" : "");

/** A new block of a kind, made in the newsletter's language (a story with its picture's side). */
export function made(d: NewsletterDoc, k: BlockKind, layout?: "stacked" | "left" | "right"): Block {
  const nb = newBlock(k, undefined, d.language);
  return nb.kind === "article" && layout ? { ...nb, layout } : nb;
}

export function Outline({ d, set, sel, onPick, canEdit, onAdd, onOurs, onLayout, out, fields, startCard, onWrite, busy, step: stepIn, onStep }: {
  d: NewsletterDoc; set: (d: NewsletterDoc) => void; sel: string | null; onPick: (id: string | null) => void; canEdit: boolean;
  /** opens the gallery at a place */
  onAdd: (el: HTMLElement, at: number) => void;
  onOurs?: () => void; onLayout: (key: string) => void;
  /** the way out: the last step's own view */
  out: React.ReactNode;
  /** the picked block's own fields (its picture, where its button goes, a story's side) - under its row */
  fields?: React.ReactNode;
  /** the start card, while nothing is written */
  startCard?: React.ReactNode;
  /** "Write it with AI" in "Start from…" (written already: it writes it all again) */
  onWrite?: () => void;
  /** the block the assistant is writing ("all": the whole e-mail) */
  busy?: string | null;
  /** cv16: the step shown, held by the studio (the last step is a publishing view - the assistant folds away) */
  step?: "blocks" | "out"; onStep?: (s: "blocks" | "out") => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [start, setStart] = useState<HTMLElement | null>(null);
  const [layouts, setLayouts] = useState<HTMLElement | null>(null);
  const [stepOwn, setStepOwn] = useState<"blocks" | "out">("blocks");
  const step = stepIn ?? stepOwn;
  const setStep = (s: "blocks" | "out") => { setStepOwn(s); onStep?.(s); };
  const addRef = useRef<HTMLButtonElement | null>(null);
  // the map scrolls inside the left pane and the last step stands at its foot, at any height
  const fit = useFitHeight(14, step);
  const hasHeader = d.blocks.some((b) => b.kind === "header");
  const on = blockOf(sel);
  const moveTo = (from: number, to: number) => {
    if (from === to || from + 1 === to) return;
    const blocks = [...d.blocks];
    const [b] = blocks.splice(from, 1);
    blocks.splice(to > from ? to - 1 : to, 0, b);
    set({ ...d, blocks });
  };
  /* ── the last step, as its own view ── */
  if (step === "out") {
    return (
      <Pane title="Build" pad={false}>
        <Box sx={{ p: 2 }}>
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />} onClick={() => setStep("blocks")} sx={{ ...btn, color: INK, px: 0.5, ml: -0.5, mb: 1.25 }}>The e-mail</Button>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PINK }}>Last step</Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mb: 0.25, letterSpacing: "-0.01em" }}>Send it out</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>One HubSpot draft per language - a person checks each and schedules it in HubSpot.</Typography>
          {out}
        </Box>
      </Pane>
    );
  }
  const linkBtn = { ...btn, minWidth: 0, px: 0.75, py: 0.1, fontSize: "0.76rem", color: PINK, "& .MuiButton-startIcon": { mr: 0.4 }, "& .MuiButton-endIcon": { ml: 0.25 } };
  const item = (icon: React.ReactNode, label: string, hint: string) => (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", py: 0.25 }}>
      <Box sx={{ color: PINK, display: "flex", mt: "2px" }}>{icon}</Box>
      <Box><Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK }}>{label}</Typography><Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{hint}</Typography></Box>
    </Box>
  );
  return (
    <Pane title="Build" right={canEdit ? (
      <Button size="small" onClick={(e) => setStart(e.currentTarget)} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: "17px !important" }} />} sx={linkBtn} aria-haspopup="menu">Start from…</Button>
    ) : undefined} pad={false}>
      <Menu anchorEl={start} open={!!start} onClose={() => setStart(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: "8px", width: 300 } } }}>
        {onWrite && <MenuItem sx={{ whiteSpace: "normal" }} disabled={!!busy} onClick={() => { setStart(null); onWrite(); }}>{item(<AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />, !startCard && d.blocks.some((b) => b.kind !== "header" && b.kind !== "footer" && stateOf(b).state === "done") ? "Write it all again" : "Write the whole newsletter with AI", "From the project's brief - Undo brings this one back")}</MenuItem>}
        {onOurs && <MenuItem sx={{ whiteSpace: "normal" }} onClick={() => { setStart(null); onOurs(); }}>{item(<MarkEmailReadOutlinedIcon sx={{ fontSize: 18 }} />, "One of our e-mails…", "Its stories, pictures and buttons, as it went out")}</MenuItem>}
        <MenuItem sx={{ whiteSpace: "normal" }} onClick={(e) => { setLayouts(start ?? e.currentTarget); setStart(null); }}>{item(<DashboardCustomizeOutlinedIcon sx={{ fontSize: 18 }} />, "A layout…", "The blocks of a layout - the words written stay")}</MenuItem>
      </Menu>
      <Popover open={!!layouts} anchorEl={layouts} onClose={() => setLayouts(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 360, borderRadius: "8px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>A layout - the words written stay</Typography>
        <Layouts current={d.layout} onPick={(k) => { setLayouts(null); onLayout(k); }} />
      </Popover>

      <Box ref={fit.ref} sx={{ height: fit.height ?? "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Box sx={{ p: 1.25 }} onDragOver={(e) => { if (drag !== null) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (drag !== null && dropAt !== null) moveTo(drag, dropAt); setDrag(null); setDropAt(null); }}>
        {startCard}
        {/* no logo on top (an e-mail of ours whose first picture carries it): our header, one click away */}
        {canEdit && !hasHeader && !startCard && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, mb: 1, borderRadius: "8px", border: `1px dashed ${HAIRLINE}`, bgcolor: "#fff" }}>
            <Box component="img" src={OUR_LOGO} alt="" sx={{ width: 64, height: 26, objectFit: "contain", flexShrink: 0 }} />
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.76rem", color: MUTED, lineHeight: 1.35 }}>No logo block on top of this e-mail.</Typography>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 15 }} />} onClick={() => { const h = made(d, "header"); set({ ...d, blocks: [h, ...d.blocks] }); onPick(h.id); }} sx={{ ...toolBtn, flexShrink: 0 }}>Our logo</Button>
          </Box>
        )}
        {d.blocks.map((b, i) => {
          const active = on === b.id;
          const pic = picOf(b);
          const st = stateOf(b);
          return (
            <Box key={b.id} sx={{ position: "relative" }}>
              {dropAt === i && drag !== null && <Box sx={{ position: "absolute", left: 6, right: 6, top: -2, height: 2, bgcolor: BLUE, borderRadius: 1 }} />}
              <Box role="button" tabIndex={0} aria-expanded={active} draggable={canEdit} onClick={() => onPick(active ? null : b.id)} onKeyDown={(e) => { if (e.key === "Enter") onPick(active ? null : b.id); }}
                onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); }}
                onDragEnd={() => { setDrag(null); setDropAt(null); }}
                onDragOver={(e) => { if (drag === null) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1); }}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, p: 0.75, pr: 0.5, mb: 0.5, borderRadius: "6px", cursor: "pointer", opacity: drag === i ? 0.4 : 1,
                  border: `1px solid ${active ? "rgba(194,44,110,.35)" : "transparent"}`, bgcolor: active ? "rgba(194,44,110,.06)" : "transparent",
                  "&:hover": { bgcolor: active ? "rgba(194,44,110,.08)" : "rgba(21,34,58,.04)" }, "&:hover .grip, &:hover .tools": { opacity: 1 },
                }}>
                {canEdit && <DragIndicatorIcon className="grip" sx={{ fontSize: 16, color: "#a7b0bb", opacity: 0.4, cursor: "grab", flexShrink: 0 }} />}
                <StateMark state={st.state} picture={st.picture} busy={busy === "all" || busy === b.id} />
                <Box sx={{ width: 52, height: 34, flexShrink: 0, bgcolor: "#eef1f3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
                  {pic ? <Box component="img" src={pic} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : b.kind === "header" ? <Box component="img" src={isOurLogo(b.logoUrl) ? OUR_LOGO : b.logoUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "contain", bgcolor: "#fff" }} />
                    : <BlockThumb kind={b.kind} layout={b.kind === "article" ? b.layout : undefined} w={48} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: active ? PINK : MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{BLOCK_LABEL[b.kind]}</Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary(b)}</Typography>
                </Box>
                {canEdit && (
                  <Tooltip title="Remove the block">
                    <IconButton className="tools" size="small" aria-label="Remove the block" sx={{ display: active ? "inline-flex" : "none", p: 0.25 }}
                      onClick={(e) => { e.stopPropagation(); set({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }); }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <KeyboardArrowDownIcon sx={{ fontSize: 18, color: active ? PINK : "#a7b0bb", flexShrink: 0, transform: active ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
              </Box>
              {/* the picked block's own fields, under its row (one open at a time) */}
              <Collapse in={active && !!fields} timeout={200} unmountOnExit>
                <Box sx={{ ml: 0.5, mr: 0.25, mt: 0.25, mb: 1.25, p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>{active ? fields : null}</Box>
              </Collapse>
            </Box>
          );
        })}
        {dropAt === d.blocks.length && drag !== null && <Box sx={{ height: 2, mx: 0.75, bgcolor: BLUE, borderRadius: 1 }} />}
        {canEdit && (
          <Button ref={addRef} size="small" fullWidth startIcon={<AddIcon />} sx={{ ...toolBtn, height: 34, mt: 0.5 }}
            onClick={(e) => { const f = d.blocks.findIndex((x) => x.kind === "footer"); onAdd(e.currentTarget, f >= 0 ? f : d.blocks.length); }}>Add a block</Button>
        )}
        <Hint mt={1}>Drag to move - here, or by the handle beside the block picked in the e-mail. Click its words there to edit them.</Hint>
      </Box>
      </Box>

      {/* the last step, always in view at the foot of the column */}
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.94)" }}>
        <Button fullWidth variant="contained" disableElevation onClick={() => setStep("out")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
          sx={{ ...btn, height: 40, borderRadius: "8px", bgcolor: "#15223a", color: "#fff", justifyContent: "space-between", px: 1.75, "&:hover": { bgcolor: "#24344f" } }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
            <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Last step</Box>
            Send it out
          </Box>
        </Button>
      </Box>
      </Box>
    </Pane>
  );
}

/** One thing the picked block has (its picture, where a button goes, a product), as the map shows it: a click opens THAT
 *  element's card on the e-mail - the one place it is edited (cv17). Read-only: what it is, nothing to open. */
function Pointer({ label, open, active, disabled, children }: { label: string; open: () => void; active: boolean; disabled: boolean; children: React.ReactNode }) {
  return (
    <Box component={disabled ? "div" : "button"} {...(disabled ? {} : { type: "button", onClick: open, "aria-label": `${label} - open its card on the e-mail` })}
      sx={{
        all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 1, width: "100%", p: 0.75, mb: 0.75, borderRadius: "7px",
        border: `1px solid ${active ? BLUE : HAIRLINE}`, bgcolor: active ? "rgba(36,89,209,.04)" : "#fff", cursor: disabled ? "default" : "pointer",
        "&:hover": disabled ? {} : { borderColor: BLUE, bgcolor: "rgba(36,89,209,.03)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 1 },
      }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: active ? BLUE : MUTED, lineHeight: 1.5 }}>{label}</Typography>
        {children}
      </Box>
      {!disabled && <ChevronRightIcon sx={{ fontSize: 18, color: active ? BLUE : "#a7b0bb", flexShrink: 0 }} />}
    </Box>
  );
}

const mono = { fontSize: "0.76rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

/** A picture as the map shows it: small, with what it shows - or the place still empty. */
function Thumb({ url, alt, contain = false }: { url: string; alt: string; contain?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
      <Box sx={{ width: 56, height: 38, flexShrink: 0, borderRadius: "4px", overflow: "hidden", border: url ? `1px solid ${HAIRLINE}` : "1px dashed #b9c3c9", bgcolor: url ? "#fff" : "#f7f9fa", display: "grid", placeItems: "center" }}>
        {url ? <Box component="img" src={url} alt="" sx={{ width: "100%", height: "100%", objectFit: contain ? "contain" : "cover", display: "block" }} /> : <ImageOutlinedIcon sx={{ fontSize: 17, color: "#a7b0bb" }} />}
      </Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", color: url ? (alt ? INK : "#b26a00") : "#b26a00", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {url ? alt || "No words for it yet - inboxes that block pictures show nothing" : "No picture yet - make or upload it in its card"}
      </Typography>
    </Box>
  );
}

/**
 * The picked block under its row: what it has besides its words - its picture, where its buttons go, the logo, each
 * product - each a pointer to that element's card on the e-mail (cv17, SARCLA 11.11.2026 "continue": the fields here
 * repeated the cards; now there is one place to edit). A story's picture side stays here: it is the block's, not an
 * element's. A link says what is wrong with it (another store view, an ACC address) as the card does.
 */
export function BlockTools({ b, set, disabled, picked, onOpen, pages, language = "EN" }: {
  b: Block; set: (b: Block) => void; disabled: boolean; picked: string | null;
  /** an element's card opened on the e-mail: "<block id>:image", ":button", ":link", ":item<n>Image", ":logo" */
  onOpen: (key: string) => void;
  /** the Page builder's pages, for what a link's note says (11.11.2026) */
  pages?: PageLinks;
  /** the newsletter's language - a page is linked in its store view (fr -> fr-CH) */
  language?: string;
}) {
  const key = (field: string) => `${b.id}:${field}`;
  const point = (field: string, label: string, body: React.ReactNode) => (
    <Pointer key={field} label={label} open={() => onOpen(key(field))} active={picked === key(field)} disabled={disabled}>{body}</Pointer>
  );
  const pic = (label = "Its picture") => ("imageUrl" in b ? point("image", label, <Thumb url={b.imageUrl} alt={b.imageAlt} />) : null);
  /** where a button (or a picture) leads, with what is said of it */
  const goes = (url: string, words?: string) => {
    const n = url ? linkNote(url, language, pages?.rows ?? null) : null;
    return (
      <>
        {words !== undefined && <Typography sx={{ fontSize: "0.8rem", fontWeight: 650, color: words ? INK : "#b26a00", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{words || "No button words - it does not show"}</Typography>}
        <Typography sx={{ ...mono, color: url ? "#2459d1" : "#b26a00" }}>{url ? url.replace(/^https?:\/\//, "") : "No address yet"}</Typography>
        {n && n.tone !== "ok" && <StateLine tone={n.tone} line={n.line} mt={0.25} />}
      </>
    );
  };
  const foot = <Hint mt={0.25}>{disabled ? "What it has - an editor changes it in its card on the e-mail." : "A click opens its card on the e-mail - its words, its picture, where it goes."}</Hint>;
  switch (b.kind) {
    case "header": {
      const ours = isOurLogo(b.logoUrl);
      return <>{point("logo", "The logo", <Thumb url={ours ? OUR_LOGO : b.logoUrl} alt={ours ? "Our logo, as the e-mails we send from HubSpot carry it" : "Another logo, from the hub's Logos"} contain />)}{foot}</>;
    }
    case "hero": return <>{pic()}{point("button", "Its button", goes(b.button.url, b.button.label))}{foot}</>;
    case "article": return <>
      <Box sx={{ mb: 1.25 }}>
        <SquareChoice label="Picture" value={b.layout ?? "stacked"} onChange={(layout) => { if (!disabled) set({ ...b, layout }); }}
          options={[{ key: "stacked", label: "Above" }, { key: "left", label: "Left" }, { key: "right", label: "Right" }]} />
      </Box>
      {pic()}
      {point("link", "Its button", goes(b.link.url, b.link.label))}
      {foot}
    </>;
    case "products": return <>
      {b.items.map((x, i) => point(`item${i + 1}Image`, `Product ${i + 1}${x.name ? ` · ${x.name}` : ""}`, <><Thumb url={x.imageUrl} alt={x.name} />{goes(x.url)}</>))}
      {foot}
    </>;
    case "banner": return <>{point("image", "Its picture and where it leads", <><Thumb url={b.imageUrl} alt={b.imageAlt} />{goes(b.url)}</>)}<Hint>600 px wide - a Banner to-do of this project can make it too.</Hint></>;
    case "text": return <Hint mt={0}>Its words are edited in the e-mail, as they look: pick words and B in the label over them (Ctrl+B) makes them bold; Enter starts a new paragraph.</Hint>;
    case "facts": return <Hint mt={0}>The shop&apos;s facts, from the brand brain. Change a word in the e-mail - never invent a figure.</Hint>;
    case "cta": return <>{point("button", "Its button", goes(b.button.url, b.button.label))}{foot}</>;
    case "divider": return <Hint mt={0}>A thin line between two blocks.</Hint>;
    case "footer": return <Hint mt={0}>Our footer, as our e-mails have it: support, LinkedIn, masthead, privacy and the unsubscribe link (HubSpot fills in the reader&apos;s address). Its first line is edited in the e-mail.</Hint>;
  }
}
