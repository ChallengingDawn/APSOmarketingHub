"use client";
// THE NEWSLETTER'S BUILD PANE (Content v2, 08.11.2026 - SARCLA: "much more improved"; "pictures are not being generated";
// "I should be able to push it into the content calendar").
//   the envelope   from, subject, preheader - and its send day, which IS the to-do's day on the content calendar
//   the layouts    three to start from, drawn small; the words already written are carried over
//   the blocks     drawn small, dragged to reorder, a + between any two opens the gallery of block types, duplicated,
//                  removed; the open block's fields below it - every picture made from words or uploaded in place

import { useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_HINT, BLOCK_LABEL, PREHEADER_MAX, SUBJECT_MAX, TEMPLATES, newBlock, pictureIdea, sendDay,
  type Block, type BlockKind, type Check, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { Field, Label, Pane, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { BLUE, PictureSlot, toolBtn } from "../blog/ui";
import { BlockThumb, LayoutThumb } from "./thumbs";

const GALLERY: BlockKind[] = ["hero", "article", "text", "banner", "products", "facts", "cta", "divider", "header", "footer"];

/** The send day: the to-do's day on the content calendar, set here or in the bar - the same day. */
function SendDay({ api }: { api: StudioApi }) {
  const p = api.data.piece;
  const [err, setErr] = useState<string | null>(null);
  const set = async (day: string | null) => { setErr(null); const r = await api.edit({ dueDate: day }); if (!r.ok) setErr(r.error ?? "Not moved."); };
  return (
    <Box sx={{ p: 1.25, border: `1px solid ${p.dueDate ? HAIRLINE : "#e9c46a"}`, borderRadius: "8px", bgcolor: p.dueDate ? "#fff" : "#fffaf0" }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Send day · its day on the content calendar</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 36, height: 36, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: p.dueDate ? "rgba(36,89,209,.08)" : "#fff1c9", borderRadius: "6px" }}>
          <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: p.dueDate ? BLUE : "#9a6b00" }} />
        </Box>
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: 650, color: INK, whiteSpace: "nowrap" }}>{p.dueDate ? sendDay(p.dueDate) : "Not planned yet"}</Typography>
        <TextField type="date" size="small" value={p.dueDate ?? ""} disabled={!api.data.access.canEdit} onChange={(e) => void set(e.target.value || null)}
          sx={{ ...field, width: 148, "& input": { py: "7px", fontSize: "0.82rem" } }} inputProps={{ "aria-label": "Send day" }} />
        <Tooltip title="Open the content calendar on that day">
          <IconButton size="small" component={Link} href={`/projects/calendar${p.dueDate ? `?day=${p.dueDate}` : ""}`} aria-label="Open the calendar"><CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
      </Box>
      {err && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f", mt: 0.5 }}>{err}</Typography>}
    </Box>
  );
}

/** The layouts to start from, drawn small. */
export function Layouts({ current, onPick, compact }: { current?: string; onPick: (key: string) => void; compact?: boolean }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.25 }}>
      {TEMPLATES.map((t) => {
        const on = t.key === current;
        return (
          <Box key={t.key} component="button" type="button" onClick={() => onPick(t.key)} sx={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", p: 1.25, border: `1.5px solid ${on ? BLUE : HAIRLINE}`, borderRadius: "8px", bgcolor: on ? "rgba(36,89,209,.04)" : "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1, "&:hover": { borderColor: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}` },
          }}>
            <Box sx={{ bgcolor: "#eef1f3", p: 1, width: "100%", display: "flex", justifyContent: "center", maxHeight: compact ? 150 : 210, overflow: "hidden" }}>
              <LayoutThumb blocks={t.blocks("EN")} w={compact ? 72 : 84} />
            </Box>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, textAlign: "center", lineHeight: 1.25 }}>{t.name}</Typography>
            {!compact && <Typography sx={{ fontSize: "0.72rem", color: MUTED, textAlign: "center", lineHeight: 1.35 }}>{t.about}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/** The gallery of block types: each drawn as it looks in the e-mail. */
function Gallery({ onPick }: { onPick: (k: BlockKind, layout?: "stacked" | "left" | "right") => void }) {
  type Item = { k: BlockKind; layout?: "stacked" | "left" | "right"; label: string; hint: string };
  const items: Item[] = GALLERY.flatMap((k): Item[] => k === "article"
    ? [{ k, layout: "stacked" as const, label: "Story", hint: "Picture above the text" }, { k, layout: "left" as const, label: "Story beside", hint: "Picture beside the text" }]
    : [{ k, label: BLOCK_LABEL[k], hint: BLOCK_HINT[k] }]);
  return (
    <Box sx={{ p: 1.5, width: 380 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Add a block</Typography>
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
    case "header": return b.tagline;
    case "footer": return "Unsubscribe and address";
    default: return "";
  }
};
const hasPicture = (b: Block) => ("imageUrl" in b && !!b.imageUrl) || (b.kind === "products" && b.items.some((x) => x.imageUrl));

type Where = { projectId: number; pieceId: number; me: string };

/** One block's fields; its pictures made or uploaded in place. */
function BlockFields({ b, set, disabled, where }: { b: Block; set: (b: Block) => void; disabled: boolean; where: Where }) {
  const f = (k: string) => (v: string) => set({ ...b, [k]: v } as Block);
  const pic = (aspect: "16:9" | "1:1" | "3:2", label?: string) => {
    if (!("imageUrl" in b)) return null;
    return (
      <Box sx={{ mb: 1.25 }}>
        {label && <Label mt={0}>{label}</Label>}
        <PictureSlot url={b.imageUrl} alt={b.imageAlt} aspect={aspect} suggestion={pictureIdea(b)} disabled={disabled} {...where}
          onPick={(p) => set({ ...b, imageUrl: p.url, imageAlt: b.imageAlt || (b.kind === "hero" ? b.headline : b.kind === "article" ? b.title : ""), imagePrompt: p.prompt ?? ("imagePrompt" in b ? b.imagePrompt : "") } as Block)}
          onAlt={(alt) => set({ ...b, imageAlt: alt } as Block)} onRemove={() => set({ ...b, imageUrl: "" } as Block)} />
      </Box>
    );
  };
  switch (b.kind) {
    case "header": return <>
      <Field label="Line beside the logo" value={b.tagline} onChange={f("tagline")} max={40} disabled={disabled} />
      <Label mt={0}>Logo</Label>
      <PictureSlot url={b.logoUrl} alt="APSOparts" aspect="3:2" fit="contain" startOpen={false} addLabel="Use a logo picture" tabs={["logos", "upload", "mine"]} disabled={disabled} {...where}
        onPick={(p) => set({ ...b, logoUrl: p.url })} onRemove={() => set({ ...b, logoUrl: "" })} />
      {!b.logoUrl && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, mb: 1 }}>Without one, the name shows as APSOparts in the brand&apos;s red.</Typography>}
    </>;
    case "hero": return <>
      {pic("16:9", "Its picture")}
      <Field label="Eyebrow" value={b.eyebrow} onChange={f("eyebrow")} max={30} disabled={disabled} />
      <Field label="Headline" value={b.headline} onChange={f("headline")} max={70} disabled={disabled} />
      <Field label="Text" value={b.text} onChange={f("text")} multiline rows={4} disabled={disabled} helper="**bold**, [link](https://…), a blank line for a new paragraph" />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Button" value={b.button.label} onChange={(v) => set({ ...b, button: { ...b.button, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.button.url} onChange={(v) => set({ ...b, button: { ...b.button, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "article": return <>
      <Box sx={{ mb: 1.25 }}>
        <SquareChoice label="Picture" value={b.layout ?? "stacked"} onChange={(layout) => set({ ...b, layout })}
          options={[{ key: "stacked", label: "Above" }, { key: "left", label: "Left" }, { key: "right", label: "Right" }]} />
      </Box>
      {pic(b.layout === "left" || b.layout === "right" ? "1:1" : "16:9")}
      <Field label="Title" value={b.title} onChange={f("title")} max={70} disabled={disabled} />
      <Field label="Text" value={b.text} onChange={f("text")} multiline rows={3} disabled={disabled} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Link label" value={b.link.label} onChange={(v) => set({ ...b, link: { ...b.link, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.link.url} onChange={(v) => set({ ...b, link: { ...b.link, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "products": return <>
      <Field label="Title" value={b.title} onChange={f("title")} max={60} disabled={disabled} />
      {b.items.map((x, i) => {
        const up = (p: Partial<typeof x>) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, ...p } : y)) });
        return (
          <Box key={i} sx={{ p: 1.25, mb: 1, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fbfcfd" }}>
            <Label mt={0}>Product {i + 1}</Label>
            <Box sx={{ mb: 1 }}>
              <PictureSlot url={x.imageUrl} alt={x.name} aspect="1:1" startOpen={false} suggestion={x.name ? `${x.name} - ${x.text}` : undefined} disabled={disabled} {...where}
                onPick={(p) => up({ imageUrl: p.url })} onRemove={() => up({ imageUrl: "" })} />
            </Box>
            <Field label="Name" value={x.name} onChange={(v) => up({ name: v })} disabled={disabled} />
            <Field label="One line" value={x.text} onChange={(v) => up({ text: v })} max={80} disabled={disabled} />
            <Field label="Its page on the shop" value={x.url} onChange={(v) => up({ url: v })} disabled={disabled} />
          </Box>
        );
      })}
    </>;
    case "banner": return <>
      {pic("16:9", "The banner")}
      <Field label="Its link" value={b.url} onChange={f("url")} disabled={disabled} helper="600 px wide - a Banner to-do of this project can make it too" />
    </>;
    case "text": return <Field label="Text" value={b.text} onChange={f("text")} multiline rows={5} disabled={disabled} helper="**bold**, [link](https://…), a blank line for a new paragraph" />;
    case "facts": return <>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.25 }}>The shop&apos;s facts, from the brand brain. Change a word - never invent a figure.</Typography>
      {b.items.map((x, i) => (
        <Box key={i} sx={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr", gap: 1 }}>
          <Field label="Figure" value={x.big} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, big: v } : y)) })} disabled={disabled} />
          <Field label="What it means" value={x.label} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, label: v } : y)) })} disabled={disabled} />
        </Box>
      ))}
    </>;
    case "cta": return <>
      <Field label="Line" value={b.text} onChange={f("text")} max={90} disabled={disabled} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Button" value={b.button.label} onChange={(v) => set({ ...b, button: { ...b.button, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.button.url} onChange={(v) => set({ ...b, button: { ...b.button, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "divider": return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>A thin line between blocks.</Typography>;
    case "footer": return <Field label="Footer text" value={b.text} onChange={f("text")} multiline rows={3} disabled={disabled} helper="The unsubscribe link is added by HubSpot" />;
  }
}

/** The thin place between two blocks: a + that opens the gallery, the drop line while dragging. */
function Between({ onAdd, drop, disabled }: { onAdd: (el: HTMLElement) => void; drop: boolean; disabled: boolean }) {
  return (
    <Box sx={{ position: "relative", height: 14, my: -0.25, "&:hover .plus": { opacity: 1 } }}>
      <Box sx={{ position: "absolute", left: 0, right: 0, top: 6, height: 2, bgcolor: drop ? BLUE : "transparent", borderRadius: 1 }} />
      {!disabled && (
        <Tooltip title="Add a block here" placement="left">
          <Box component="button" type="button" className="plus" onClick={(e) => onAdd(e.currentTarget)} aria-label="Add a block here" sx={{
            all: "unset", cursor: "pointer", position: "absolute", left: "50%", top: -2, ml: "-11px", width: 22, height: 18, display: "grid", placeItems: "center",
            border: `1px solid ${BLUE}`, color: BLUE, bgcolor: "#fff", borderRadius: "4px", opacity: 0, transition: "opacity .12s", zIndex: 2,
          }}><AddIcon sx={{ fontSize: 14 }} /></Box>
        </Tooltip>
      )}
    </Box>
  );
}

export function BuildPane({ api, d, set, open, onOpen, issues, onLayout, blank }: {
  api: StudioApi; d: NewsletterDoc; set: (next: NewsletterDoc) => void; open: string | null; onOpen: (id: string | null) => void; issues: Check[];
  /** A layout picked: the studio lays it over the newsletter (with Undo). */
  onLayout: (key: string) => void;
  /** Nothing written yet: the layouts show first. */
  blank?: boolean;
}) {
  const canEdit = api.data.access.canEdit;
  const where: Where = { projectId: api.data.piece.projectId, pieceId: api.data.piece.id, me: api.data.me };
  const [adder, setAdder] = useState<{ el: HTMLElement; at: number } | null>(null);
  const [layouts, setLayouts] = useState<HTMLElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  const setBlock = (b: Block) => set({ ...d, blocks: d.blocks.map((x) => (x.id === b.id ? b : x)) });
  const insert = (at: number, k: BlockKind, layout?: "stacked" | "left" | "right") => {
    const nb = newBlock(k, undefined, d.language);
    const b = nb.kind === "article" && layout ? { ...nb, layout } : nb;
    const blocks = [...d.blocks];
    blocks.splice(at, 0, b);
    set({ ...d, blocks });
    onOpen(b.id);
  };
  const duplicate = (i: number) => {
    const blocks = [...d.blocks];
    const c = { ...JSON.parse(JSON.stringify(d.blocks[i])), id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` } as Block;
    blocks.splice(i + 1, 0, c);
    set({ ...d, blocks });
    onOpen(c.id);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to || from + 1 === to) return;
    const blocks = [...d.blocks];
    const [b] = blocks.splice(from, 1);
    blocks.splice(to > from ? to - 1 : to, 0, b);
    set({ ...d, blocks });
  };

  return (
    <Pane title="Build" right={canEdit ? (
      <Button size="small" startIcon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: 16 }} />} onClick={(e) => setLayouts(e.currentTarget)} sx={toolBtn}>Layouts</Button>
    ) : undefined}>
      <Popover open={!!layouts} anchorEl={layouts} onClose={() => setLayouts(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 400, borderRadius: "8px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Start from a layout - your words stay</Typography>
        <Layouts current={d.layout} compact onPick={(k) => { setLayouts(null); onLayout(k); }} />
      </Popover>

      {issues.length > 0 && (
        <Box sx={{ mb: 2, p: 1.25, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f0d6a8" }}>
          {issues.map((c, i) => (
            <Box key={i} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", fontSize: "0.8rem", color: c.level === "bad" ? "#8f1d1b" : "#7f4f0b", py: 0.25 }}>
              <WarningAmberOutlinedIcon sx={{ fontSize: 16, mt: "1px" }} />{c.text}
            </Box>
          ))}
        </Box>
      )}
      {blank && canEdit && (
        <Box sx={{ mb: 2.5, pb: 2.25, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>Start from a layout</Label>
          <Layouts current={d.layout} onPick={onLayout} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>Or keep this one and let the assistant write it from the brief.</Typography>
        </Box>
      )}
      <Label mt={0}>The envelope</Label>
      <SendDay api={api} />
      <Box sx={{ mt: 1.5 }}>
        <Field label="From" value={d.fromName} onChange={(v) => set({ ...d, fromName: v })} max={40} disabled={!canEdit} />
        <Field label="Subject" value={d.subject} onChange={(v) => set({ ...d, subject: v })} max={SUBJECT_MAX} disabled={!canEdit} />
        <Field label="Preheader" value={d.preheader} onChange={(v) => set({ ...d, preheader: v })} max={PREHEADER_MAX} disabled={!canEdit} helper="The line the inbox shows after the subject" />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", mt: 1.5, mb: 0.75 }}>
        <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>The blocks · {d.blocks.length}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Drag to reorder · click one in the preview</Typography>
      </Box>
      <Popover open={!!adder} anchorEl={adder?.el} onClose={() => setAdder(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: "8px" } } }}>
        <Gallery onPick={(k, layout) => { if (adder) insert(adder.at, k, layout); setAdder(null); }} />
      </Popover>

      <Box onDragOver={(e) => { if (drag !== null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag !== null && dropAt !== null) moveTo(drag, dropAt); setDrag(null); setDropAt(null); }}>
        <Between onAdd={(el) => setAdder({ el, at: 0 })} drop={dropAt === 0 && drag !== null} disabled={!canEdit} />
        {d.blocks.map((b, i) => {
          const isOpen = open === b.id;
          return (
            <Box key={b.id}>
              <Box ref={(el: HTMLDivElement | null) => { cards.current[i] = el; }} id={`nl-block-${b.id}`}
                onDragOver={(e) => {
                  if (drag === null) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setDropAt(e.clientY < r.top + Math.min(r.height / 2, 40) ? i : i + 1);
                }}
                sx={{
                  borderRadius: "8px", border: `1px solid ${isOpen ? BLUE : HAIRLINE}`, bgcolor: "#fff", opacity: drag === i ? 0.45 : 1,
                  boxShadow: isOpen ? "0 0 0 3px rgba(36,89,209,.12), 0 8px 22px rgba(31,45,78,.08)" : "none", transition: "border-color .15s, box-shadow .15s",
                  "&:hover .tools": { opacity: 1 },
                }}>
                <Box onClick={() => onOpen(isOpen ? null : b.id)} sx={{ display: "flex", alignItems: "center", gap: 1, pl: 0.5, pr: 0.75, py: 0.75, cursor: "pointer" }}>
                  <Box draggable={canEdit} onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); }}
                    onDragEnd={() => { setDrag(null); setDropAt(null); }} onClick={(e) => e.stopPropagation()}
                    sx={{ cursor: canEdit ? "grab" : "default", color: "#a7b0bb", display: "flex", "&:active": { cursor: "grabbing" } }} aria-label="Drag to move">
                    <DragIndicatorIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ width: 54, height: 36, flexShrink: 0, bgcolor: "#eef1f3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}>
                    {hasPicture(b) && "imageUrl" in b
                      ? <Box component="img" src={b.imageUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <BlockThumb kind={b.kind} layout={b.kind === "article" ? b.layout : undefined} w={50} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: isOpen ? BLUE : MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{BLOCK_LABEL[b.kind]}</Typography>
                    <Typography sx={{ fontSize: "0.86rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary(b)}</Typography>
                  </Box>
                  {canEdit && (
                    <Box className="tools" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", opacity: isOpen ? 1 : 0.35, transition: "opacity .12s" }}>
                      <Tooltip title="Duplicate"><IconButton size="small" onClick={() => duplicate(i)} aria-label="Duplicate the block"><ContentCopyOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      <Tooltip title="Remove"><IconButton size="small" onClick={() => { set({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }); if (isOpen) onOpen(null); }} aria-label="Remove the block"><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                    </Box>
                  )}
                </Box>
                {isOpen && <Box sx={{ px: 1.5, pb: 1.25, pt: 0.5, borderTop: `1px solid ${HAIRLINE}` }}><Box sx={{ pt: 1.25 }}><BlockFields b={b} set={setBlock} disabled={!canEdit} where={where} /></Box></Box>}
              </Box>
              <Between onAdd={(el) => setAdder({ el, at: i + 1 })} drop={dropAt === i + 1 && drag !== null} disabled={!canEdit} />
            </Box>
          );
        })}
      </Box>
      {canEdit && <Button fullWidth startIcon={<AddIcon />} onClick={(e) => { const footer = d.blocks.findIndex((x) => x.kind === "footer"); setAdder({ el: e.currentTarget, at: footer >= 0 ? footer : d.blocks.length }); }} sx={{ ...toolBtn, height: 36, mt: 0.5 }}>Add a block</Button>}
    </Pane>
  );
}
