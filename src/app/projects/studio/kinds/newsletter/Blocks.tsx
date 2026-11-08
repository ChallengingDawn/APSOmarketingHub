"use client";
// THE NEWSLETTER'S BLOCKS (Content v3, 08.11.2026 - SARCLA: "newsletter also: editing is very confusing").
//   Outline     the e-mail's blocks on the left, drawn small, top to bottom: a click picks one (and shows it), drag or
//               the arrows to move, + to add; above them where to start from (one of our e-mails, a layout); under
//               them the way out (the checks, the HTML, the HubSpot draft behind its admin switch)
//   Gallery     the block types, each drawn as it looks in the e-mail
//   Layouts     three to start from, drawn small (the words already written are carried over)
//   BlockTools  what a picked block needs besides its words, on the right: its picture (made or uploaded), where its
//               button goes, a story's picture side, the logo - the words themselves are edited in the e-mail

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_HINT, BLOCK_LABEL, OUR_LOGO, TEMPLATES, blockOf, isOurLogo, newBlock, pictureIdea,
  type Block, type BlockKind, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { Field, Label, Pane } from "../../parts";
import { PicturePanel } from "../../pictures";
import type { StudioApi } from "../../useStudio";
import { BLUE, Hint, PictureSlot, toolBtn } from "../blog/ui";
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
const picOf = (b: Block) => ("imageUrl" in b && b.imageUrl ? b.imageUrl : b.kind === "products" ? b.items.find((x) => x.imageUrl)?.imageUrl ?? "" : "");

/** A new block of a kind, made in the newsletter's language (a story with its picture's side). */
export function made(d: NewsletterDoc, k: BlockKind, layout?: "stacked" | "left" | "right"): Block {
  const nb = newBlock(k, undefined, d.language);
  return nb.kind === "article" && layout ? { ...nb, layout } : nb;
}

export function Outline({ d, set, sel, onPick, canEdit, onAdd, onOurs, onLayout, out }: {
  d: NewsletterDoc; set: (d: NewsletterDoc) => void; sel: string | null; onPick: (id: string) => void; canEdit: boolean;
  /** opens the gallery at a place */
  onAdd: (el: HTMLElement, at: number) => void;
  onOurs?: () => void; onLayout: (key: string) => void;
  /** the way out, under the blocks */
  out: React.ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [start, setStart] = useState<HTMLElement | null>(null);
  const [layouts, setLayouts] = useState<HTMLElement | null>(null);
  const [showOut, setShowOut] = useState(false);
  const addRef = useRef<HTMLButtonElement | null>(null);
  const on = blockOf(sel);
  const moveTo = (from: number, to: number) => {
    if (from === to || from + 1 === to) return;
    const blocks = [...d.blocks];
    const [b] = blocks.splice(from, 1);
    blocks.splice(to > from ? to - 1 : to, 0, b);
    set({ ...d, blocks });
  };
  return (
    <Pane title="Blocks" right={canEdit ? (
      <Button size="small" endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />} onClick={(e) => setStart(e.currentTarget)} sx={toolBtn}>Start from</Button>
    ) : undefined} pad={false}>
      <Menu anchorEl={start} open={!!start} onClose={() => setStart(null)} slotProps={{ paper: { sx: { borderRadius: "8px" } } }}>
        {onOurs && <MenuItem dense onClick={() => { setStart(null); onOurs(); }}>One of our e-mails…</MenuItem>}
        <MenuItem dense onClick={(e) => { setLayouts(start ?? e.currentTarget); setStart(null); }}>A layout…</MenuItem>
      </Menu>
      <Popover open={!!layouts} anchorEl={layouts} onClose={() => setLayouts(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 360, borderRadius: "8px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>A layout - the words written stay</Typography>
        <Layouts current={d.layout} onPick={(k) => { setLayouts(null); onLayout(k); }} />
      </Popover>

      <Box sx={{ p: 1.25 }} onDragOver={(e) => { if (drag !== null) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (drag !== null && dropAt !== null) moveTo(drag, dropAt); setDrag(null); setDropAt(null); }}>
        {d.blocks.map((b, i) => {
          const active = on === b.id;
          const pic = picOf(b);
          return (
            <Box key={b.id} sx={{ position: "relative" }}>
              {dropAt === i && drag !== null && <Box sx={{ position: "absolute", left: 6, right: 6, top: -2, height: 2, bgcolor: BLUE, borderRadius: 1 }} />}
              <Box role="button" tabIndex={0} draggable={canEdit} onClick={() => onPick(b.id)} onKeyDown={(e) => { if (e.key === "Enter") onPick(b.id); }}
                onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); }}
                onDragEnd={() => { setDrag(null); setDropAt(null); }}
                onDragOver={(e) => { if (drag === null) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1); }}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, p: 0.75, pr: 0.5, mb: 0.5, borderRadius: "6px", cursor: "pointer", opacity: drag === i ? 0.4 : 1,
                  border: `1px solid ${active ? BLUE : "transparent"}`, bgcolor: active ? "rgba(36,89,209,.06)" : "transparent",
                  "&:hover": { bgcolor: active ? "rgba(36,89,209,.08)" : "rgba(21,34,58,.04)" }, "&:hover .grip, &:hover .tools": { opacity: 1 },
                }}>
                {canEdit && <DragIndicatorIcon className="grip" sx={{ fontSize: 16, color: "#a7b0bb", opacity: 0.4, cursor: "grab", flexShrink: 0 }} />}
                <Box sx={{ width: 52, height: 34, flexShrink: 0, bgcolor: "#eef1f3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
                  {pic ? <Box component="img" src={pic} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : b.kind === "header" ? <Box component="img" src={isOurLogo(b.logoUrl) ? OUR_LOGO : b.logoUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "contain", bgcolor: "#fff" }} />
                    : <BlockThumb kind={b.kind} layout={b.kind === "article" ? b.layout : undefined} w={48} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: active ? BLUE : MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{BLOCK_LABEL[b.kind]}</Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary(b)}</Typography>
                </Box>
                {canEdit && (
                  <Tooltip title="Remove the block">
                    <IconButton className="tools" size="small" aria-label="Remove the block" sx={{ opacity: active ? 1 : 0 }}
                      onClick={(e) => { e.stopPropagation(); set({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }); }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
        {dropAt === d.blocks.length && drag !== null && <Box sx={{ height: 2, mx: 0.75, bgcolor: BLUE, borderRadius: 1 }} />}
        {canEdit && (
          <Button ref={addRef} size="small" fullWidth startIcon={<AddIcon />} sx={{ ...toolBtn, height: 34, mt: 0.5 }}
            onClick={(e) => { const f = d.blocks.findIndex((x) => x.kind === "footer"); onAdd(e.currentTarget, f >= 0 ? f : d.blocks.length); }}>Add a block</Button>
        )}
        <Hint mt={1}>Drag to move. In the e-mail: click a block to pick it, click its words to edit them.</Hint>
      </Box>

      {/* the way out stays at the foot of the column, however long the e-mail */}
      <Box sx={{ position: "sticky", bottom: 0, zIndex: 2, borderTop: `1px solid ${HAIRLINE}`, px: 1.25, py: 1, bgcolor: "rgba(250,251,252,.97)", backdropFilter: "blur(6px)" }}>
        {showOut && <Box sx={{ px: 0.75, pt: 0.5, pb: 1.25, maxHeight: "55vh", overflowY: "auto" }}>{out}</Box>}
        <Box role="button" tabIndex={0} onClick={() => setShowOut((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter") setShowOut((v) => !v); }}
          sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.75, py: 0.75, borderRadius: "6px", cursor: "pointer", "&:hover": { bgcolor: "rgba(21,34,58,.05)" } }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Send it out</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>The checks, the HTML, a HubSpot draft</Typography>
          </Box>
          <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transform: showOut ? "none" : "rotate(180deg)", transition: "transform .15s" }} />
        </Box>
      </Box>
    </Pane>
  );
}

type Where = { projectId: number; pieceId: number; me: string };

/** What the picked block needs besides its words: its picture, where its button goes, a story's side, the logo. */
export function BlockTools({ b, set, disabled, where, picked }: { b: Block; set: (b: Block) => void; disabled: boolean; where: Where; picked: string | null }) {
  const [otherLogo, setOtherLogo] = useState(false);
  const pic = (aspect: "16:9" | "1:1" | "3:2") => {
    if (!("imageUrl" in b)) return null;
    return (
      <Box sx={{ mb: 1.25 }}>
        <Label mt={0}>Its picture</Label>
        <PictureSlot url={b.imageUrl} alt={b.imageAlt} aspect={aspect} suggestion={pictureIdea(b)} disabled={disabled} startOpen={picked === `${b.id}:image` || !b.imageUrl} {...where}
          onPick={(p) => set({ ...b, imageUrl: p.url, imageAlt: b.imageAlt || (b.kind === "hero" ? b.headline : b.kind === "article" ? b.title : ""), imagePrompt: p.prompt ?? ("imagePrompt" in b ? b.imagePrompt : "") } as Block)}
          onAlt={(alt) => set({ ...b, imageAlt: alt } as Block)} onRemove={() => set({ ...b, imageUrl: "" } as Block)} altLabel="What it shows (inboxes that hide pictures show this)" />
      </Box>
    );
  };
  const link = (label: string, value: string, put: (v: string) => void) => <Field label={label} value={value} disabled={disabled} placeholder="https://www.apsoparts.com/…" onChange={(v) => put(v.trim())} />;
  switch (b.kind) {
    case "header": {
      const ours = isOurLogo(b.logoUrl);
      return (
        <Box>
          <Box sx={{ p: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", mb: 1 }}>
            <Box component="img" src={ours ? OUR_LOGO : b.logoUrl} alt="The logo" sx={{ display: "block", width: "100%", maxHeight: 80, objectFit: "contain" }} />
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>{ours ? "Our logo, as the e-mails we send from HubSpot carry it." : "Another logo, from the hub's Logos."}</Typography>
          {!disabled && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {!ours && <Button size="small" onClick={() => set({ ...b, logoUrl: "" })} sx={toolBtn}>Back to our logo</Button>}
              <Button size="small" onClick={() => setOtherLogo((v) => !v)} sx={toolBtn}>{otherLogo ? "Keep this one" : "Another logo…"}</Button>
            </Box>
          )}
          {otherLogo && !disabled && (
            <Box sx={{ mt: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.25, bgcolor: "#fbfcfd" }}>
              <PicturePanel tabs={["logos", "upload"]} start="logos" aspect="3:2" columns={3} {...where} onPick={(p) => { set({ ...b, logoUrl: p.url }); setOtherLogo(false); }} />
              <Hint>A PNG or JPG: Outlook and Gmail do not show SVG.</Hint>
            </Box>
          )}
        </Box>
      );
    }
    case "hero": return <>{pic("16:9")}{link("Where the button goes", b.button.url, (v) => set({ ...b, button: { ...b.button, url: v } }))}</>;
    case "article": return <>
      <Box sx={{ mb: 1.25 }}>
        <SquareChoice label="Picture" value={b.layout ?? "stacked"} onChange={(layout) => set({ ...b, layout })}
          options={[{ key: "stacked", label: "Above" }, { key: "left", label: "Left" }, { key: "right", label: "Right" }]} />
      </Box>
      {pic(b.layout === "left" || b.layout === "right" ? "1:1" : "16:9")}
      {link("Where its button goes", b.link.url, (v) => set({ ...b, link: { ...b.link, url: v } }))}
    </>;
    case "products": return <>
      {b.items.map((x, i) => {
        const up = (p: Partial<typeof x>) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, ...p } : y)) });
        const on = picked === `${b.id}:item${i + 1}Image`;
        return (
          <Box key={i} sx={{ p: 1.25, pb: 0.25, mb: 1, borderRadius: "8px", border: `1px solid ${on ? BLUE : HAIRLINE}`, bgcolor: "#fbfcfd" }}>
            <Label mt={0}>Product {i + 1}{x.name ? ` · ${x.name}` : ""}</Label>
            <Box sx={{ mb: 1 }}>
              <PictureSlot url={x.imageUrl} alt={x.name} aspect="1:1" startOpen={on} suggestion={x.name ? `${x.name} - ${x.text}` : undefined} disabled={disabled} {...where}
                onPick={(p) => up({ imageUrl: p.url })} onRemove={() => up({ imageUrl: "" })} />
            </Box>
            {link("Its page on the shop", x.url, (v) => up({ url: v }))}
          </Box>
        );
      })}
    </>;
    case "banner": return <>{pic("16:9")}{link("Where it leads", b.url, (v) => set({ ...b, url: v }))}<Hint>600 px wide - a Banner to-do of this project can make it too.</Hint></>;
    case "text": return <Hint mt={0}>Its words are edited in the e-mail: **bold**, [a link](https://…), a blank line for a new paragraph.</Hint>;
    case "facts": return <Hint mt={0}>The shop&apos;s facts, from the brand brain. Change a word in the e-mail - never invent a figure.</Hint>;
    case "cta": return link("Where the button goes", b.button.url, (v) => set({ ...b, button: { ...b.button, url: v } }));
    case "divider": return <Hint mt={0}>A thin line between two blocks.</Hint>;
    case "footer": return <Hint mt={0}>Our footer, as our e-mails have it: support, LinkedIn, masthead, privacy and the unsubscribe link (HubSpot fills in the reader&apos;s address). Its first line is edited in the e-mail.</Hint>;
  }
}

