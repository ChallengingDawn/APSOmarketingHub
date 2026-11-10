"use client";
// THE POPUPS OF THE PAGE (Content v8, SARCLA 10.11.2026: "the text editor should come as a popup when clicking the text
// itself", "allow block settings", "text or changes should be done by clicking the element"). Editing happens ON the page,
// as in Webflow or Framer: a click on a text opens its small editor under it, a click on a picture its picture editor, a
// block's settings open beside the block (from the bar over it, or from its row in the Build list). The left pane keeps
// only the blocks.
//
//   PopCard          the popup's frame: what it is, a close, its body, its foot
//   TextPop          a text's words, its character guide, bold / italic / underline / list / link, its look (Content v10:
//                    colour - the shop's palette or one of its own, flagged when it cannot be read -, size, alignment),
//                    "Ask AI for this text" and Done; a link's page too
//   ButtonPop        a button (Content v10, point 3): its words, its page of the shop, its style, colour, size, arrow, tab
//   PicturePop       a picture: make it (from its idea), upload, the galleries, the shop's products, fine-tune, its alt text
//   BlockSettingsPop a new page's block: background, alignment, heading size, picture side, its button, its items
//   ShopBlockPop     a page of the shop's own block (look, hide it, replace it with a module, the AI) or one the hub put
// A module's settings are its own panel (./modules/Panel.tsx), in the same frame.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { linkInStores } from "@/lib/content/studio/kinds/page/links";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  SPLITS, addItem, getField, moveItem, removeItem, setField, setLook,
  type BlockBg, type Fields, type ListKey, type Look, type Pic, type TextAlign, type TextSize,
} from "@/lib/content/studio/kinds/page/fields";
import { buttonLookOfField, fieldButtonPatchOf, groundOfField, type ButtonLook as BtnLook, type TextLook } from "@/lib/content/studio/kinds/page/style";
import { bgPathOf, blockTexts, type BlockRow } from "@/lib/content/studio/kinds/page/blocklist";
import { ITEM_NAME, itemsOf } from "@/lib/content/studio/kinds/page/outline";
import { PICTURE_TUNES, PicturePanel, type Picture, type PictureAspect } from "../../pictures";
import { PINK, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { LinkInput, SHEEN_BG, sheen, type Making } from "./Fields";
import { Choice } from "./ui";
import { ButtonLookBox, MarkBtn, TextLookRow } from "./Look";
import { SwitchList } from "./Switch";
import type { SwitchOption } from "@/lib/content/studio/kinds/page/modules/switch";

const RED = "#c5221f";
const AMBER = "#a96a12";

/* ── the frame ────────────────────────────────────────────────────────── */

export function PopCard({ kicker, title, onClose, children, foot, maxBody = "min(62vh, 560px)", right }: {
  kicker?: React.ReactNode; title: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode;
  /** the body's height before it scrolls */
  maxBody?: string;
  right?: React.ReactNode;
}) {
  return (
    <Box role="dialog" aria-label={typeof title === "string" ? title : "Edit"} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      sx={{ bgcolor: "#fff", borderRadius: "12px", border: "1px solid rgba(21,34,58,.10)", boxShadow: "0 18px 48px rgba(21,34,58,.20), 0 2px 8px rgba(21,34,58,.08)", overflow: "hidden", color: INK }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, pl: 1.75, pr: 0.75, pt: 1.1, pb: 0.9, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {kicker && <Typography component="div" sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kicker}</Typography>}
          <Typography component="div" sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</Typography>
        </Box>
        {right}
        <Tooltip title="Close (Esc)"><IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: MUTED, mt: -0.25 }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      </Box>
      <Box sx={{ px: 1.75, py: 1.5, maxHeight: maxBody, overflowY: "auto" }}>{children}</Box>
      {foot && <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 1, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#fafbfc" }}>{foot}</Box>}
    </Box>
  );
}

/** One setting: its name above, its squared choice under it - every setting starting on the same line. */
function Setting<K extends string>({ label, value, onChange, options, mt = 1.25 }: { label: string; value: K; onChange: (k: K) => void; options: { key: K; label: string; disabled?: boolean }[]; mt?: number }) {
  return (
    <Box sx={{ mt }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 0.5 }}>{label}</Typography>
      <Choice value={value} onChange={onChange} options={options} />
    </Box>
  );
}

/** A small heading inside a popup. */
const Sub = ({ children, mt = 1.5 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mt, mb: 0.6 }}>{children}</Typography>
);

const quiet = { ...btn, color: INK, px: 1, borderRadius: "7px", fontSize: "0.8rem" } as const;
const doneBtn = { ...mainBtn, borderRadius: "7px", px: 2, py: 0.5, fontSize: "0.82rem", minWidth: 0 } as const;

/* ── "Ask AI for this text" ───────────────────────────────────────────── */

const ASKS: { label: string; ask: string }[] = [
  { label: "Shorter", ask: "Make it shorter, same meaning." },
  { label: "Clearer", ask: "Simpler words, shorter sentences, the same facts." },
  { label: "More convincing", ask: "Make it more convincing for a buyer - concrete benefits, no hype." },
];

function AskAi({ run, busy, placeholder = "Ask AI for this text…" }: { run: (ask: string) => void; busy: boolean; placeholder?: string }) {
  const [q, setQ] = useState("");
  const go = (ask: string) => { if (!ask.trim() || busy) return; run(ask.trim()); setQ(""); };
  return (
    <Box sx={{ mt: 1.25, p: 1, borderRadius: "9px", bgcolor: "rgba(194,44,110,.045)", border: "1px solid rgba(194,44,110,.16)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {busy ? <CircularProgress size={15} thickness={5} sx={{ color: PINK, flexShrink: 0 }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17, color: PINK, flexShrink: 0 }} />}
        <InputBase fullWidth value={q} disabled={busy} onChange={(e) => setQ(e.target.value)} placeholder={busy ? "Writing…" : placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(q); } }} sx={{ fontSize: "0.84rem", "& input::placeholder": { color: "#8a95a3", opacity: 1 } }} />
        <IconButton size="small" disabled={busy || !q.trim()} onClick={() => go(q)} aria-label="Ask" sx={{ color: PINK }}><SendRoundedIcon sx={{ fontSize: 17 }} /></IconButton>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
        {ASKS.map((a) => (
          <Box key={a.label} component="button" type="button" disabled={busy} onClick={() => go(a.ask)} sx={{
            all: "unset", cursor: busy ? "default" : "pointer", fontSize: "0.74rem", fontWeight: 650, color: busy ? "#b3bccb" : INK, px: 0.9, py: 0.3, borderRadius: "5px",
            border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", "&:hover": busy ? {} : { borderColor: PINK, color: PINK },
          }}>{a.label}</Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── a text ───────────────────────────────────────────────────────────── */

/** A colour or size set as a rule, named back ("#274e64" -> "petrol"). */
function keyOf(map: Record<string, string>, v: string | undefined): string | undefined { return Object.entries(map).find(([, x]) => x === v)?.[0]; }

/** What a text may carry: bold / italic, a list, a link (a new page's longer texts and a page of the shop's paragraphs). */
export type Marks = { bold: boolean; list: boolean; link: boolean };

/** The marks wrapped around what is selected in a box of words ("**", "*", "- " at each line's start, "[..](url)"). */
function wrapIn(el: HTMLTextAreaElement | HTMLInputElement, before: string, after: string, value: string): { value: string; caret: [number, number] } | null {
  const a = el.selectionStart ?? 0;
  const b = el.selectionEnd ?? 0;
  if (a === b) return null;
  const sel = value.slice(a, b);
  // already marked: unmarked
  if (value.slice(a - before.length, a) === before && value.slice(b, b + after.length) === after) {
    return { value: value.slice(0, a - before.length) + sel + value.slice(b + after.length), caret: [a - before.length, b - before.length] };
  }
  return { value: value.slice(0, a) + before + sel + after + value.slice(b), caret: [a + before.length, b + before.length] };
}
function listIn(el: HTMLTextAreaElement, value: string): { value: string; caret: [number, number] } {
  const a = value.lastIndexOf("\n", (el.selectionStart ?? 0) - 1) + 1;
  let b = value.indexOf("\n", el.selectionEnd ?? 0);
  if (b < 0) b = value.length;
  const lines = value.slice(a, b).split("\n");
  const on = lines.every((l) => /^[-•–]\s+/.test(l));
  const next = lines.map((l) => (on ? l.replace(/^[-•–]\s+/, "") : `- ${l}`)).join("\n");
  return { value: value.slice(0, a) + next + value.slice(b), caret: [a, a + next.length] };
}

/** A page of the shop's paragraph edited with its own marks (bold, italic, links): what may stay of the box's HTML. */
export function cleanRich(html: string): string {
  if (typeof document === "undefined") return html;
  const t = document.createElement("template");
  t.innerHTML = html;
  const keep = /^(B|STRONG|I|EM|A|BR|UL|OL|LI|P|SPAN|SMALL|SUP|SUB|U)$/;
  const walk = (n: Element) => {
    for (const c of [...n.children]) {
      walk(c);
      if (!keep.test(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) if (!(c.tagName === "A" && a.name === "href") && !(c.tagName === "SPAN" && a.name === "class")) c.removeAttribute(a.name);
      if (c.tagName === "A" && !/^(\/|https:\/\/(www|acc)\.apsoparts\.com)/i.test(c.getAttribute("href") ?? "")) c.replaceWith(...c.childNodes);
      if (c.tagName === "SPAN" && !c.attributes.length) c.replaceWith(...c.childNodes);
    }
  };
  walk(t.content as unknown as Element);
  return t.innerHTML.replace(/&nbsp;/g, " ").trim();
}

const SIZE_OPTS = [{ key: "s", label: "Small" }, { key: "m", label: "Normal" }, { key: "l", label: "Large" }, { key: "xl", label: "Extra large" }];

/** A text's look in the popup (Content v10): its value, what sets it, the ground it stands on (for the readability
 * guard: [] = a picture or not known) and whether it is large (a heading: 3:1 is enough). */
export type TextLookCtl = { value: TextLook; set: (next: TextLook, label: string) => void; grounds: string[]; large: boolean };

export type TextPopProps = {
  kicker: string; title: string;
  value: string;
  /** the limit it is written to (a new page's field) - the guide counts against it */
  max?: number | null;
  multiline: boolean;
  /** bold / italic / list / link, where the block allows them */
  marks?: Marks | null;
  /** a page of the shop's element with its own HTML: edited as it shows (bold, italic, links kept) */
  rich?: string | null;
  canEdit: boolean;
  /** live: each change drawn into the page as it is typed (a new page); else Done puts it there */
  live: boolean;
  onChange?: (v: string) => void;
  onDone: (v: string, html?: string, href?: string) => void;
  onClose: () => void;
  /** "Ask AI for this text": its answer (null = done, the words are in the box), or what went wrong */
  ai?: ((ask: string, now: string) => Promise<{ text?: string; error?: string }>) | null;
  /** Content v10: its look - colour, size, weight, italic, underline, alignment (a new page's field, a page of the shop's
   * element as its look change, a module's words in its settings) */
  textLook?: TextLookCtl | null;
  /** a page of the shop's element: hidden on the page (or shown again) */
  onHide?: (() => void) | null;
  /** a page of the shop's link: where it goes, put on the page with Done */
  href?: string | null;
  /** a button or a link: where it goes */
  link?: { api: StudioApi; store: string; value: string; onChange: (v: string) => void; label?: string } | null;
  /** a link of the links block: what the visitor finds there */
  note?: { value: string; onChange: (v: string) => void; max: number } | null;
  /** said under the box (where these words come from) */
  hint?: React.ReactNode;
};

export function TextPop({ kicker, title, value, max, multiline, marks, rich, canEdit, live, onChange, onDone, onClose, ai, textLook, onHide, href, link, note, hint }: TextPopProps) {
  const [hrefDraft, setHrefDraft] = useState(href ?? "");
  useEffect(() => { setHrefDraft(href ?? ""); }, [href]);
  const hrefOut = href !== null && href !== undefined && hrefDraft.trim() && hrefDraft.trim() !== href ? hrefDraft.trim() : undefined;
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const richBox = useRef<HTMLDivElement | null>(null);
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the words as the page has them now (the AI wrote them, an Undo) - while the person is not typing
  useEffect(() => { if (!typing.current) setDraft(value); }, [value]);
  useEffect(() => { if (rich !== undefined && rich !== null && richBox.current) richBox.current.innerHTML = rich; }, [rich]);
  useEffect(() => { const t = setTimeout(() => (rich ? richBox.current : box.current)?.focus(), 40); return () => clearTimeout(t); }, [rich]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const put = (v: string) => {
    setDraft(v);
    if (!live || !onChange) return;
    typing.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { typing.current = false; onChange(v); }, 300);
  };
  const flush = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } typing.current = false; };
  const done = () => {
    flush();
    if (rich !== undefined && rich !== null && richBox.current) {
      const html = cleanRich(richBox.current.innerHTML);
      const text = (richBox.current.innerText ?? "").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
      onDone(text, html, hrefOut);
      return;
    }
    onDone(draft, undefined, hrefOut);
  };
  const mark = (before: string, after = before) => {
    const el = box.current;
    if (!el) return;
    const r = wrapIn(el, before, after, draft);
    if (!r) { setMsg({ tone: "warn", text: "Select the words first." }); return; }
    setMsg(null);
    put(r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.caret[0], r.caret[1]); });
  };
  const richCmd = (cmd: "bold" | "italic" | "underline" | "insertUnorderedList") => { richBox.current?.focus(); try { document.execCommand(cmd); } catch { /* the browser has no such command */ } };
  /** words selected in the box (a mark goes on them) - else B / I / U set the whole text's look (Content v10) */
  const selected = (): boolean => {
    if (rich) { const s = window.getSelection(); return !!s && !s.isCollapsed && !!richBox.current && richBox.current.contains(s.anchorNode); }
    const el = box.current;
    return !!el && (el.selectionStart ?? 0) !== (el.selectionEnd ?? 0);
  };
  const tl = textLook?.value ?? {};
  const boldOn = tl.weight ? tl.weight === "bold" : !!textLook?.large;
  const styleBtn = (what: "bold" | "italic" | "underline") => {
    if (selected() && (rich || (marks?.bold && what !== "underline"))) {
      if (rich) richCmd(what); else mark(what === "bold" ? "**" : "*");
      return;
    }
    if (!textLook) { setMsg({ tone: "warn", text: "Select the words first." }); return; }
    setMsg(null);
    if (what === "bold") textLook.set({ ...tl, weight: boldOn ? (textLook.large ? "regular" : undefined) : (textLook.large ? undefined : "bold") }, boldOn ? "Made it regular" : "Made it bold");
    else if (what === "italic") textLook.set({ ...tl, italic: !tl.italic || undefined }, tl.italic ? "Took the italic off" : "Made it italic");
    else textLook.set({ ...tl, underline: !tl.underline || undefined }, tl.underline ? "Took the underline off" : "Underlined it");
  };
  const linkTo = (url: string) => {
    const u = url.trim();
    if (!/^(\/[^\s"'<>()]*|https:\/\/(www|acc)\.apsoparts\.com(\/[^\s"'<>()]*)?)$/i.test(u)) { setMsg({ tone: "warn", text: "A link goes to a page of the shop: /de-CH/... or https://www.apsoparts.com/..." }); return; }
    setLinking(null);
    if (rich) { richBox.current?.focus(); try { document.execCommand("createLink", false, u); } catch { /* none */ } return; }
    mark("[", `](${u})`);
  };
  const askAi = async (ask: string) => {
    if (!ai) return;
    setBusy(true); setMsg(null);
    const now = rich && richBox.current ? (richBox.current.innerText ?? "") : draft;
    const r = await ai(ask, now);
    setBusy(false);
    if (r.error) { setMsg({ tone: "warn", text: r.error }); return; }
    if (r.text !== undefined) {
      if (rich && richBox.current) richBox.current.innerText = r.text; else setDraft(r.text);
      setMsg({ tone: "ok", text: live ? "The AI wrote it - it is on the page." : "The AI's words are in the box - Done puts them on the page." });
    } else setMsg({ tone: "ok", text: "The AI wrote it - it is on the page." });
  };

  const count = rich ? null : draft.length;
  const over = max != null && count !== null && count > max;
  const iconBtn = { p: 0.45, borderRadius: "6px", color: INK, "&:hover": { bgcolor: "rgba(21,34,58,.06)" } } as const;
  const selMarks = !!(rich || marks?.bold);

  return (
    <PopCard kicker={kicker} title={title} onClose={() => { flush(); if (live && onChange && draft !== value) onChange(draft); onClose(); }}
      foot={canEdit ? (
        <>
          {onHide && <Tooltip title="Hide it on the page"><IconButton size="small" onClick={onHide} aria-label="Hide it on the page" sx={{ color: MUTED }}><VisibilityOffOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.7rem", color: MUTED, mr: 0.5, display: { xs: "none", sm: "block" } }}>{live ? "Shows in the page as you type" : "Ctrl+Enter"}</Typography>
          <Button size="small" variant="contained" disableElevation onClick={done} sx={doneBtn}>Done</Button>
        </>
      ) : undefined}>
      {canEdit && (marks || rich || textLook) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.75, mx: -0.5 }} onMouseDown={(e) => e.preventDefault()}>
          {(selMarks || textLook) && <>
            <MarkBtn on={!!textLook && boldOn} tip={selMarks ? (textLook ? "Bold - the words selected, or all of it" : "Bold") : boldOn ? "Regular" : "Bold"} onClick={() => styleBtn("bold")}><FormatBoldIcon sx={{ fontSize: 18 }} /></MarkBtn>
            <MarkBtn on={!!tl.italic} tip={selMarks ? (textLook ? "Italic - the words selected, or all of it" : "Italic") : "Italic"} onClick={() => styleBtn("italic")}><FormatItalicIcon sx={{ fontSize: 18 }} /></MarkBtn>
            {(rich || textLook) && <MarkBtn on={!!tl.underline} tip={rich ? "Underline - the words selected, or all of it" : "Underline all of it"} onClick={() => styleBtn("underline")}><FormatUnderlinedIcon sx={{ fontSize: 18 }} /></MarkBtn>}
          </>}
          {(rich || marks?.list) && <Tooltip title="A list"><IconButton size="small" onClick={() => { if (rich) { richCmd("insertUnorderedList"); return; } const el = box.current; if (!el) return; const r = listIn(el, draft); put(r.value); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.caret[0], r.caret[1]); }); }} aria-label="A list" sx={iconBtn}><FormatListBulletedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
          {(rich || marks?.link) && <Tooltip title="A link to a page of the shop"><IconButton size="small" onClick={() => setLinking((x) => (x === null ? "" : null))} aria-label="A link" sx={{ ...iconBtn, color: linking !== null ? PINK : INK }}><InsertLinkIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>}
          <Box sx={{ flex: 1 }} />
          {count !== null && <Typography sx={{ fontSize: "0.72rem", fontWeight: over ? 700 : 500, color: over ? RED : MUTED, fontVariantNumeric: "tabular-nums", pr: 0.5 }}>{over ? `${count - max!} too many` : max ? `${count} / ${max}` : `${count}`}</Typography>}
        </Box>
      )}
      {linking !== null && (
        <Box sx={{ display: "flex", gap: 0.75, mb: 1 }}>
          <TextField size="small" fullWidth autoFocus placeholder="/de-CH/… - a page of the shop" value={linking} onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); linkTo(linking); } }} sx={{ ...field, "& input": { fontSize: "0.82rem" } }} />
          <Button size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => linkTo(linking)} sx={{ ...quiet, border: `1px solid ${HAIRLINE}` }}>Link</Button>
        </Box>
      )}
      {rich ? (
        <Box ref={richBox} contentEditable={canEdit} suppressContentEditableWarning spellCheck
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); } }}
          sx={{ minHeight: 64, maxHeight: 260, overflowY: "auto", p: 1.1, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, fontSize: "0.9rem", lineHeight: 1.55, outline: "none",
            "&:focus": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" }, "& p": { m: 0, mb: 0.75 }, "& ul": { my: 0.5, pl: 2.5 }, "& a": { color: "#274e64" } }} />
      ) : (
        <TextField fullWidth multiline={multiline} minRows={multiline ? 3 : undefined} maxRows={multiline ? 12 : undefined} size="small" value={draft} disabled={!canEdit} inputRef={box}
          onChange={(e) => put(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && ((!multiline && !e.shiftKey) || e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); } }}
          sx={{ ...field, "& .MuiInputBase-root": { fontSize: "0.9rem", lineHeight: 1.5, alignItems: "flex-start" } }} />
      )}
      {!marks && !rich && !textLook && count !== null && max != null && (
        <Typography sx={{ fontSize: "0.72rem", fontWeight: over ? 700 : 500, color: over ? RED : MUTED, textAlign: "right", mt: 0.4, fontVariantNumeric: "tabular-nums" }}>{over ? `${count - max} too many` : `${count} / ${max}`}</Typography>
      )}
      {hint && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.6, lineHeight: 1.4 }}>{hint}</Typography>}
      {link && (
        <Box sx={{ mt: 1.25 }}>
          <LinkInput api={link.api} store={link.store} value={link.value} disabled={!canEdit} label={link.label ?? "Where it goes"} onChange={link.onChange} />
        </Box>
      )}
      {note && (
        <TextField fullWidth size="small" label="What the visitor finds there" value={note.value} disabled={!canEdit} onChange={(e) => note.onChange(e.target.value.slice(0, note.max))} sx={{ ...field, mt: 0.25 }} />
      )}
      {href !== null && href !== undefined && (
        <TextField fullWidth size="small" label="Where the link goes" value={hrefDraft} disabled={!canEdit} onChange={(e) => setHrefDraft(e.target.value)} sx={{ ...field, mt: 1.25 }} />
      )}
      {canEdit && textLook && <TextLookRow value={tl} onChange={(next, label) => textLook.set(next, label)} grounds={textLook.grounds} large={textLook.large} />}
      {msg && <Typography sx={{ fontSize: "0.78rem", color: msg.tone === "warn" ? AMBER : "#1b7a55", mt: 0.75, lineHeight: 1.4 }}>{msg.text}</Typography>}
      {canEdit && ai && <AskAi run={(a) => void askAi(a)} busy={busy} />}
    </PopCard>
  );
}

/* ── a button (Content v10, point 3) ──────────────────────────────────── */

export type ButtonPopProps = {
  kicker: string; title?: string;
  /** its words, and what puts them on the page (as they are typed) */
  label: string; max: number; onLabel: (v: string) => void;
  /** its page of the shop (the shop's page search) - none for a tile's button: it leads to its tile's own page (`leads`) */
  url?: string; onUrl?: (v: string) => void;
  /** Content v12: where a button without a page of its own leads (a tile's "Alle anzeigen") */
  leads?: React.ReactNode;
  api: StudioApi; store: string;
  /** its look - none for a tile's button (it keeps the module's) */
  look?: BtnLook; onLook?: (next: BtnLook, label: string) => void;
  /** the ground it stands on ([] = not known), its colour while none is chosen, its arrow while not set */
  grounds: string[]; fallback: string; arrowDefault?: boolean;
  canEdit: boolean;
  ai?: ((ask: string, now: string) => Promise<{ text?: string; error?: string }>) | null;
  onClose: () => void;
  hint?: React.ReactNode;
  /** Content v11: every store view the page goes to - the link as each of them sends its visitor */
  stores?: string[];
};

/** A button, clicked on the page or opened from its block's settings: its words, its page, then its look. */
export function ButtonPop({ kicker, title = "Button", label, max, onLabel, url, onUrl, leads, api, store, look, onLook, grounds, fallback, arrowDefault = true, canEdit, ai, onClose, hint, stores }: ButtonPopProps) {
  const [draft, setDraft] = useState(label);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!typing.current) setDraft(label); }, [label]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const put = (v: string) => {
    setDraft(v);
    typing.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { typing.current = false; onLabel(v); }, 300);
  };
  const flush = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } typing.current = false; if (draft !== label) onLabel(draft); };
  const over = draft.length > max;
  const askAi = async (ask: string) => {
    if (!ai) return;
    setBusy(true); setMsg(null);
    const r = await ai(ask, draft);
    setBusy(false);
    if (r.error) setMsg(r.error);
    else if (r.text !== undefined) put(r.text);
  };
  return (
    <PopCard kicker={kicker} title={title} onClose={() => { flush(); onClose(); }} maxBody="min(66vh, 620px)"
      foot={canEdit ? (
        <>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.7rem", color: MUTED, mr: 0.5 }}>Shows in the page as you change it</Typography>
          <Button size="small" variant="contained" disableElevation onClick={() => { flush(); onClose(); }} sx={doneBtn}>Done</Button>
        </>
      ) : undefined}>
      <TextField fullWidth size="small" label="Its words" value={draft} disabled={!canEdit} onChange={(e) => put(e.target.value)} autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); flush(); } }}
        helperText={<Box component="span" sx={{ color: over ? RED : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${draft.length - max} too many` : `${draft.length} / ${max}`}</Box>}
        sx={{ ...field, "& .MuiInputBase-root": { fontSize: "0.9rem" } }} />
      {onUrl ? (
        <Box sx={{ mt: 1.75 }}>
          <LinkInput api={api} store={store} value={url ?? ""} disabled={!canEdit} label="Its page of the shop" onChange={onUrl} />
          {stores && stores.length > 1 && <StoreLinks url={url ?? ""} stores={stores} />}
        </Box>
      ) : leads ? <Typography component="div" sx={{ fontSize: "0.78rem", color: INK, mt: 1.25, mb: 1, lineHeight: 1.45 }}>{leads}</Typography> : null}
      {hint && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: -0.5, mb: 1, lineHeight: 1.4 }}>{hint}</Typography>}
      {canEdit && look && onLook && <ButtonLookBox value={look} onChange={onLook} grounds={grounds} fallback={fallback} arrowDefault={arrowDefault} />}
      {msg && <Typography sx={{ fontSize: "0.78rem", color: AMBER, mt: 0.75 }}>{msg}</Typography>}
      {canEdit && ai && <AskAi run={(a) => void askAi(a)} busy={busy} placeholder="Ask AI for the button's words…" />}
    </PopCard>
  );
}

/* ── a picture ────────────────────────────────────────────────────────── */

type PicTab = "picture" | "gallery" | "products" | "tune";

export type PicturePopProps = {
  kicker: string; title: string;
  api: StudioApi; store: string; aspect: PictureAspect;
  url: string; alt: string;
  /** what it should show (a new page's picture: "Make it" makes it from this) - null where there is none */
  idea: string | null;
  making: Making | null;
  canEdit: boolean;
  /** pictures can be made here (the AI, the image model) */
  canMake: boolean;
  onMake?: (idea: string) => void;
  onIdea?: (idea: string) => void;
  onUpload: () => void;
  onPick: (p: Picture) => void;
  onAlt: (alt: string) => void;
  onRemove?: () => void;
  /** a page of the shop's picture: hidden on the page */
  onHide?: (() => void) | null;
  /** the same picture with one thing changed - its answer: what went wrong, or null */
  onRefine?: ((ask: string) => Promise<string | null>) | null;
  onClose: () => void;
};

export function PicturePop({ kicker, title, api, store, aspect, url, alt, idea, making, canEdit, canMake, onMake, onIdea, onUpload, onPick, onAlt, onRemove, onHide, onRefine, onClose }: PicturePopProps) {
  const [tab, setTab] = useState<PicTab>("picture");
  const [ideaDraft, setIdeaDraft] = useState(idea ?? "");
  const [altDraft, setAltDraft] = useState(alt);
  const [ask, setAsk] = useState("");
  const [tuning, setTuning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setIdeaDraft(idea ?? ""); }, [idea]);
  useEffect(() => { setAltDraft(alt); }, [alt]);
  const isMaking = making?.state === "making";
  const tune = async (a: string) => {
    if (!onRefine || !a.trim()) return;
    setTuning(true); setMsg(null);
    const r = await onRefine(a.trim());
    setTuning(false);
    if (r) setMsg(r); else { setAsk(""); setTab("picture"); }
  };
  const tabs: { key: PicTab; label: string }[] = [
    { key: "picture", label: "This picture" }, { key: "gallery", label: "Gallery" }, { key: "products", label: "Products" },
    ...(onRefine && url ? [{ key: "tune" as PicTab, label: "Fine-tune" }] : []),
  ];
  return (
    <PopCard kicker={kicker} title={title} onClose={() => { if (onIdea && ideaDraft !== (idea ?? "")) onIdea(ideaDraft); if (altDraft !== alt) onAlt(altDraft); onClose(); }} maxBody="min(64vh, 600px)"
      foot={canEdit ? (
        <>
          {onRemove && url && <Button size="small" onClick={onRemove} startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: MUTED }}>Take it out</Button>}
          {onHide && <Button size="small" onClick={onHide} startIcon={<VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: MUTED }}>Hide it</Button>}
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" disableElevation onClick={() => { if (onIdea && ideaDraft !== (idea ?? "")) onIdea(ideaDraft); if (altDraft !== alt) onAlt(altDraft); onClose(); }} sx={doneBtn}>Done</Button>
        </>
      ) : undefined}>
      <Choice value={tab} onChange={(t: PicTab) => setTab(t)} options={tabs} />
      {tab === "picture" && (
        <Box sx={{ mt: 1.25 }}>
          <Box sx={{ position: "relative", borderRadius: "8px", overflow: "hidden", bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, height: 128, display: "grid", placeItems: "center",
            ...(isMaking ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.4s linear infinite` } : {}) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url ? <img src={url} alt={alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block", opacity: isMaking ? 0.5 : 1 }} />
              : isMaking ? <AutoAwesomeOutlinedIcon sx={{ color: PINK }} /> : <ImageOutlinedIcon sx={{ color: MUTED, fontSize: 30 }} />}
            {isMaking && (
              <Box sx={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
                <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: PINK, mb: 0.5, textAlign: "center" }}>{making?.label ?? "Making the picture…"} up to 40 seconds</Typography>
                <LinearProgress sx={{ height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
              </Box>
            )}
          </Box>
          {making?.state === "error" && <Typography sx={{ fontSize: "0.78rem", color: AMBER, mt: 0.75 }}>{making.error}</Typography>}
          {canEdit && (
            <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
              {onMake && (
                <Button size="small" variant="outlined" disabled={!canMake || isMaking || !ideaDraft.trim()} onClick={() => { if (onIdea && ideaDraft !== (idea ?? "")) onIdea(ideaDraft); onMake(ideaDraft.trim()); }}
                  startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: PINK, borderColor: "rgba(194,44,110,.35)" }}>{url ? "Make another" : "Make it"}</Button>
              )}
              <Button size="small" variant="outlined" disabled={isMaking} onClick={onUpload} startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, borderColor: HAIRLINE }}>Upload</Button>
              {onRefine && url && <Button size="small" variant="outlined" disabled={isMaking} onClick={() => setTab("tune")} sx={{ ...quiet, borderColor: HAIRLINE }}>Fine-tune</Button>}
            </Box>
          )}
          {onIdea && (
            <TextField fullWidth multiline minRows={2} maxRows={5} size="small" label="What should the picture show?" value={ideaDraft} disabled={!canEdit} onChange={(e) => setIdeaDraft(e.target.value)}
              helperText={!canMake ? "Pictures cannot be made on this hub - upload one, or choose one already made." : "Make it uses these words - a picture, not a text in it."} sx={{ ...field, mt: 2 }} />
          )}
          <TextField fullWidth size="small" label="What it shows (alt text)" value={altDraft} disabled={!canEdit} onChange={(e) => setAltDraft(e.target.value.slice(0, 140))} sx={{ ...field, mt: 2 }}
            helperText={`${altDraft.length} / 140 · read by search engines and screen readers`} />
        </Box>
      )}
      {(tab === "gallery" || tab === "products") && (
        <Box sx={{ mt: 1.25 }}>
          <PicturePanel key={tab} projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect={aspect} suggestion={ideaDraft} columns={3} store={store}
            tabs={tab === "products" ? ["products"] : ["project", "mine", "make", "upload"]} start={tab === "products" ? "products" : "project"}
            onPick={(p) => { onPick(p); setTab("picture"); }} />
        </Box>
      )}
      {tab === "tune" && onRefine && (
        <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>The same picture with one thing changed - the old one stays in the gallery.</Typography>
          <Box sx={{ display: "grid", gap: 0.6 }}>
            {PICTURE_TUNES.map((t) => (
              <Box key={t.label} component="button" type="button" disabled={tuning || isMaking} onClick={() => void tune(t.ask)} sx={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, px: 1.1, py: 0.75, borderRadius: "7px", border: `1px solid ${HAIRLINE}`, fontSize: "0.82rem", fontWeight: 600, color: INK,
                "&:hover": { borderColor: PINK, color: PINK }, "&:disabled": { color: "#b3bccb", cursor: "default" },
              }}><AutoAwesomeOutlinedIcon sx={{ fontSize: 15, color: PINK }} />{t.label}</Box>
            ))}
          </Box>
          {/* your own words, with a button to make it (SARCLA 10.11.2026: "on fine-tune there is nothing to click to generate") */}
          <Box sx={{ display: "flex", gap: 0.75, mt: 1, alignItems: "stretch" }}>
            <TextField fullWidth size="small" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Or say what should change…" disabled={tuning}
              onKeyDown={(e) => { if (e.key === "Enter" && ask.trim()) { e.preventDefault(); void tune(ask); } }} sx={field} />
            <Button size="small" variant="contained" disableElevation disabled={tuning || isMaking || !ask.trim()} onClick={() => void tune(ask)}
              startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: "7px", px: 1.5, bgcolor: PINK, "&:hover": { bgcolor: PINK, filter: "brightness(.92)" } }}>
              Make it
            </Button>
          </Box>
          {tuning && <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}><CircularProgress size={14} sx={{ color: PINK }} /><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Fine-tuning - up to 40 seconds, it lands in the page.</Typography></Box>}
        </Box>
      )}
      {msg && <Typography sx={{ fontSize: "0.78rem", color: AMBER, mt: 1 }}>{msg}</Typography>}
    </PopCard>
  );
}

/* ── a new page's block: its settings ─────────────────────────────────── */

const BG_OPTS = [{ key: "default", label: "Standard" }, { key: "white", label: "White" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }];

function Items({ f, list, setF, canEdit, onOpen }: { f: Fields; list: ListKey; setF: (next: Fields, label?: string) => void; canEdit: boolean; onOpen: (path: string) => void }) {
  const items = itemsOf(f, list);
  const name = ITEM_NAME[list] ?? "Item";
  const max = list === "benefits" ? 8 : list === "links" ? 16 : 14;
  const rowBtn = { p: 0.35, color: MUTED, "&:hover": { color: INK } } as const;
  return (
    <>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", overflow: "hidden" }}>
        {items.map((it, i) => (
          <Box key={it.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.25, py: 0.35, borderTop: i ? `1px solid ${HAIRLINE}` : "none", "&:hover": { bgcolor: "rgba(21,34,58,.025)" } }}>
            <Box component="button" type="button" onClick={() => onOpen(list === "links" ? `links.${it.id}` : list === "faq" ? `faq.${it.id}.q` : `benefits.${it.id}.title`)}
              sx={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0, fontSize: "0.8rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", "&:hover": { color: PINK } }}>
              <b>{i + 1}</b> · {it.line || <span style={{ color: MUTED }}>not written yet</span>}
            </Box>
            {canEdit && <>
              <IconButton size="small" disabled={i === 0} onClick={() => setF(moveItem(f, list, it.id, -1), `Moved ${it.name.toLowerCase()} up`)} aria-label="Up" sx={rowBtn}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton>
              <IconButton size="small" disabled={i === items.length - 1} onClick={() => setF(moveItem(f, list, it.id, 1), `Moved ${it.name.toLowerCase()} down`)} aria-label="Down" sx={rowBtn}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton>
              <IconButton size="small" onClick={() => setF(removeItem(f, list, it.id), `Removed ${it.name.toLowerCase()}`)} aria-label={`Remove ${it.name.toLowerCase()}`} sx={rowBtn}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
            </>}
          </Box>
        ))}
        {!items.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED, px: 1, py: 0.75 }}>None yet.</Typography>}
      </Box>
      {canEdit && items.length < max && (
        <Button size="small" startIcon={<AddIcon />} onClick={() => { const r = addItem(f, list); setF(r.fields, `Added ${name.toLowerCase()}`); onOpen(list === "links" ? `links.${r.id}` : list === "faq" ? `faq.${r.id}.q` : `benefits.${r.id}.title`); }}
          sx={{ ...quiet, mt: 0.75, border: `1px dashed ${HAIRLINE}`, "&:hover": { borderColor: PINK, color: PINK } }}>{name}</Button>
      )}
    </>
  );
}

export function BlockSettingsPop({ api, row, f, setF, store, canEdit, canAi, busy, onWrite, onDuplicate, onRemove, onPicture, onText, onAddText, switchTo, onClose }: {
  api: StudioApi; row: BlockRow; f: Fields; setF: (next: Fields, label?: string) => void; store: string; canEdit: boolean; canAi: boolean;
  /** the AI writing this block now */
  busy: boolean;
  onWrite?: () => void; onDuplicate?: () => void; onRemove?: () => void;
  /** a picture of the block opened in its picture popup, a text in its text popup */
  onPicture: (path: string) => void; onText: (path: string) => void;
  /** the sections' empty slot: a text-and-picture block put there */
  onAddText?: () => void;
  /** Content v10 (point 4): the modules it can become, its content kept */
  switchTo?: { options: SwitchOption[]; keeps: string; run: (type: string) => void } | null;
  onClose: () => void;
}) {
  const key = row.key;
  const look = (p: string): Look => f.looks[p] ?? {};
  const bgPath = bgPathOf(key);
  const { heading, texts } = blockTexts(f, key);
  const align = (heading ? look(heading).align : texts[0] ? look(texts[0]).align : undefined) ?? "left";
  const setAll = (patch: Partial<Look>, label: string) => { let n = f; for (const p of texts) n = setLook(n, p, patch); setF(n, label); };
  const sec = key.startsWith("sections.") ? f.sections.find((s) => `sections.${s.id}` === key) : null;
  const btnPath = key === "hero" ? "hero.button" : key === "cta" ? "cta.button" : null;
  const picPath = key === "hero" ? "hero.picture" : sec ? `${key}.picture` : null;
  const pic = picPath ? (getField(f, picPath) as Pic | undefined) : undefined;
  const d = !canEdit;

  return (
    <PopCard kicker={`Block ${row.num} · settings`} title={row.name} onClose={onClose}
      foot={canEdit ? (
        <>
          {onWrite && <Button size="small" disabled={!canAi || busy} onClick={onWrite} startIcon={busy ? <CircularProgress size={13} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: PINK }}>{busy ? "Writing…" : row.state === "empty" ? "Write it with AI" : "Write it again"}</Button>}
          <Box sx={{ flex: 1 }} />
          {onDuplicate && <Tooltip title="Duplicate"><IconButton size="small" onClick={onDuplicate} aria-label="Duplicate"><ContentCopyOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
          {onRemove && <Tooltip title="Take this block out"><IconButton size="small" onClick={onRemove} aria-label="Take this block out" sx={{ color: RED }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
        </>
      ) : undefined}>
      {key === "sections" ? (
        <>
          <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.45 }}>Text with a picture beside it - each one an idea of its own. The AI writes two to four, or add one and write it on the page.</Typography>
          {canEdit && onAddText && <Button size="small" startIcon={<AddIcon />} onClick={onAddText} sx={{ ...quiet, mt: 1, border: `1px dashed ${HAIRLINE}` }}>Text and picture</Button>}
        </>
      ) : (
        <>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>Its words: click them in the page.</Typography>
          <Setting label="Background" value={look(bgPath).bg ?? "default"} onChange={(v: string) => !d && setF(setLook(f, bgPath, { bg: v === "default" ? undefined : (v as BlockBg) }), "Changed the background")} options={BG_OPTS} />
          {(texts.length > 0 || heading || sec) && (
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {texts.length > 0 && <Setting label="Words" value={align} onChange={(v: string) => !d && setAll({ align: v === "left" ? undefined : (v as TextAlign) }, "Changed the alignment")} options={[{ key: "left", label: "Left" }, { key: "center", label: "Centred" }, { key: "right", label: "Right" }]} />}
              {sec && <Setting label="Picture" value={sec.side} onChange={(side: string) => !d && setF(setField(f, `${key}.side`, side), "Moved the picture")} options={[{ key: "left", label: "Left" }, { key: "right", label: "Right" }]} />}
            </Box>
          )}
          {heading && <Setting label="Heading" value={look(heading).size ?? "m"} onChange={(v: string) => !d && setF(setLook(f, heading, { size: v === "m" ? undefined : (v as TextSize) }), "Changed the heading's size")} options={SIZE_OPTS} />}
          {picPath && pic?.url && (
            <Setting label="The picture's width" value={String(look(key).split ?? 50)} onChange={(v: string) => !d && setF(setLook(f, key, { split: v === "50" ? undefined : Number(v) }), `Made the picture ${v} % wide`)}
              options={SPLITS.map((n) => ({ key: String(n), label: `${n} %` }))} />
          )}
          {key === "faq" && (
            <Setting label="The questions" value={look("faq").open ? "open" : "closed"} onChange={(v: string) => !d && setF(setLook(f, "faq", { open: v === "open" || undefined }), v === "open" ? "Opened all the questions" : "Closed all the questions")}
              options={[{ key: "closed", label: "All closed (each opens on a click)" }, { key: "open", label: "All open" }]} />
          )}
          {picPath && pic && (
            <>
              <Sub>The picture</Sub>
              <Box component="button" type="button" onClick={() => onPicture(picPath)} sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25, width: "100%", boxSizing: "border-box", p: 0.75, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, "&:hover": { borderColor: PINK } }}>
                <Box sx={{ width: 64, height: 44, borderRadius: "5px", overflow: "hidden", bgcolor: "#eef1f6", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {pic.url ? <img src={pic.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <ImageOutlinedIcon sx={{ color: MUTED, fontSize: 20 }} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK }}>{pic.url ? "Change the picture" : "No picture yet"}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pic.alt || pic.idea || "Make, upload or choose one"}</Typography>
                </Box>
                <SwapHorizIcon sx={{ fontSize: 18, color: MUTED }} />
              </Box>
            </>
          )}
          {btnPath && (
            <>
              <Sub>The button</Sub>
              <TextField fullWidth size="small" label="Its words" value={(getField(f, `${btnPath}.label`) as string) ?? ""} disabled={d} onChange={(e) => setF(setField(f, `${btnPath}.label`, e.target.value.slice(0, 60)))}
                sx={{ ...field, mt: 0.75, mb: 1.25, "& input": { fontSize: "0.86rem" } }} />
              <LinkInput api={api} store={store} label="Its page of the shop" value={(getField(f, `${btnPath}.url`) as string) ?? ""} disabled={d} onChange={(v) => setF(setField(f, `${btnPath}.url`, v))} />
              {!d && <ButtonLookBox value={buttonLookOfField(look(btnPath))} grounds={groundOfField(f, btnPath)} fallback={key === "cta" ? "red" : "red"}
                onChange={(next, label) => setF(setLook(f, btnPath, fieldButtonPatchOf(next)), label)} />}
            </>
          )}
          {(key === "benefits" || key === "faq" || key === "links") && (
            <>
              <Sub>{key === "benefits" ? "Tiles" : key === "faq" ? "Questions" : "Links"}</Sub>
              <Items f={f} list={key} setF={setF} canEdit={canEdit} onOpen={onText} />
            </>
          )}
          {canEdit && switchTo && switchTo.options.length > 0 && (
            <>
              <Sub mt={2}>Change it into another module</Sub>
              <SwitchList options={switchTo.options} keeps={switchTo.keeps} onPick={switchTo.run} />
            </>
          )}
        </>
      )}
    </PopCard>
  );
}

/* ── a page of the shop's block ───────────────────────────────────────── */

const SHOP_BG: Record<string, string> = { grey: "#f2f4f5", petrol: "#274e64", sand: "#f7f2ea", white: "#ffffff" };

export function ShopBlockPop({ row, look, onLook, hidden, onHide, onReplace, onAskAi, onRemove, onKeep, old, canEdit, canAi, onClose }: {
  row: BlockRow;
  /** its look as set here (one stylesheet for its element), and setting a rule of it */
  look?: Record<string, string>; onLook?: (rule: string, value: string | undefined) => void;
  hidden?: boolean; onHide?: (on: boolean) => void;
  onReplace?: () => void; onAskAi: () => void;
  onRemove?: () => void;
  /** held back by the check: shown anyway */
  onKeep?: () => void;
  /** a replace: "Show the old one" in the preview */
  old?: { shown: boolean; toggle: () => void } | null;
  canEdit: boolean; canAi: boolean;
  onClose: () => void;
}) {
  const own = row.kind === "page";
  return (
    <PopCard kicker={`Block ${row.num} · ${own ? "the shop's own" : "put on the page here"}`} title={row.name} onClose={onClose}
      foot={canEdit ? (
        <>
          <Button size="small" disabled={!canAi} onClick={onAskAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: PINK }}>Change it with AI</Button>
          <Box sx={{ flex: 1 }} />
          {onRemove && <Tooltip title="Take it out of the page"><IconButton size="small" onClick={onRemove} aria-label="Take it out" sx={{ color: RED }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
        </>
      ) : undefined}>
      {row.state === "held" && (
        <Box sx={{ mb: 1.25, p: 1, borderRadius: "8px", bgcolor: "#fff4f2", border: "1px solid #f3c4bd" }}>
          <Typography sx={{ fontSize: "0.8rem", color: RED, fontWeight: 600, lineHeight: 1.4 }}>{row.note || "Held back - not on the page."}</Typography>
          {onKeep && canEdit && <Button size="small" onClick={onKeep} sx={{ ...quiet, color: PINK, px: 0, mt: 0.25 }}>Show it anyway</Button>}
        </Box>
      )}
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45, mb: 1.25 }}>
        {own ? "Its words and pictures: click them in the page." : "Its words: click them in the page."}
      </Typography>
      {own && onLook && (
        <>
          <Setting mt={0} label="Background" value={keyOf(SHOP_BG, look?.background) ?? "auto"} onChange={(v: string) => onLook("background", v === "auto" ? undefined : SHOP_BG[v])}
            options={[{ key: "auto", label: "As it is" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }, { key: "white", label: "White" }]} />
          <Setting label="Words" value={look?.["text-align"] ?? "auto"} onChange={(v: string) => onLook("text-align", v === "auto" ? undefined : v)}
            options={[{ key: "auto", label: "As it is" }, { key: "left", label: "Left" }, { key: "center", label: "Centred" }]} />
        </>
      )}
      {old && <Button size="small" onClick={old.toggle} sx={{ ...quiet, color: PINK, px: 0, mt: 0.5 }}>{old.shown ? "Show the new block" : "Show the old one (the preview only)"}</Button>}
      {canEdit && (onHide || onReplace) && (
        <Box sx={{ display: "grid", gap: 0.6, mt: 1.5 }}>
          {onReplace && (
            <Button size="small" variant="outlined" onClick={onReplace} startIcon={<SwapHorizIcon sx={{ fontSize: 17 }} />} sx={{ ...quiet, justifyContent: "flex-start", borderColor: HAIRLINE }}>
              Replace it with a module
            </Button>
          )}
          {onHide && (
            <Button size="small" variant="outlined" onClick={() => onHide(!hidden)} startIcon={hidden ? <VisibilityOutlinedIcon sx={{ fontSize: 17 }} /> : <VisibilityOffOutlinedIcon sx={{ fontSize: 17 }} />}
              sx={{ ...quiet, justifyContent: "flex-start", borderColor: HAIRLINE, color: hidden ? INK : RED }}>
              {hidden ? "Show it again" : "Hide it on the page"}
            </Button>
          )}
        </Box>
      )}
    </PopCard>
  );
}

/* ── the bar over the selection ───────────────────────────────────────── */

/**
 * The small dark bar over what is selected in the page (Content v8): the block it is in - a click selects the whole block -
 * and the element itself; then what can be done here: its editor (a text, a picture), the block's settings, the AI.
 */
export function EditBar({ block, label, onBlock, edit, onSettings, onAi, onClose }: {
  block: { num: number; name: string; module: boolean } | null;
  /** the element inside the block ("Heading", "Picture") - none when the block itself is selected */
  label: string | null;
  onBlock?: () => void;
  edit?: { label: string; run: () => void } | null;
  onSettings?: () => void;
  onAi?: () => void;
  onClose: () => void;
}) {
  const b = { ...btn, color: "#fff", minWidth: 0, px: 0.9, py: 0.25, fontSize: "0.76rem", borderRadius: "5px", "&:hover": { bgcolor: "rgba(255,255,255,.12)" } } as const;
  return (
    <Box onMouseDown={(e) => e.preventDefault()} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: "#15223a", color: "#fff", borderRadius: "8px", px: 0.5, py: 0.4, boxShadow: "0 10px 26px rgba(21,34,58,.32)" }}>
      {block && (
        <Box component={onBlock ? "button" : "span"} type={onBlock ? "button" : undefined} onClick={onBlock} title={onBlock ? "Select the whole block" : undefined}
          sx={{ all: "unset", cursor: onBlock ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 0.6, px: 0.6, py: 0.3, borderRadius: "5px", maxWidth: 220,
            "&:hover": onBlock ? { bgcolor: "rgba(255,255,255,.12)" } : {} }}>
          <Box component="span" sx={{ minWidth: 18, height: 18, borderRadius: "4px", bgcolor: block.module ? PINK : "rgba(255,255,255,.18)", display: "inline-grid", placeItems: "center", fontSize: "0.66rem", fontWeight: 800 }}>{block.num}</Box>
          <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: label ? "rgba(255,255,255,.72)" : "#fff" }}>{block.name}</Box>
        </Box>
      )}
      {label && (
        <>
          {block && <Box component="span" sx={{ color: "rgba(255,255,255,.4)", fontSize: "0.8rem", mx: -0.25 }}>›</Box>}
          <Typography component="span" sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff", px: 0.6, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Typography>
        </>
      )}
      <Box sx={{ width: "1px", alignSelf: "stretch", my: 0.4, mx: 0.25, bgcolor: "rgba(255,255,255,.16)" }} />
      {edit && <Button size="small" onClick={edit.run} sx={b}>{edit.label}</Button>}
      {onSettings && <Tooltip title="The block's settings"><Button size="small" onClick={onSettings} startIcon={<TuneIcon sx={{ fontSize: 15 }} />} sx={b}>Settings</Button></Tooltip>}
      {onAi && <Button size="small" onClick={onAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Ask AI</Button>}
      <IconButton size="small" onClick={onClose} aria-label="Unselect" sx={{ color: "rgba(255,255,255,.7)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
    </Box>
  );
}

/* ── "Ask AI" on a block, right at it (Content v11) ───────────────────── */

/** What the AI did for a block - said in the popup, with the Undo of what it did. */
export type BlockAiAnswer = { ok: boolean; text: string; undo: (() => void) | null };

/**
 * "Ask AI" on a block, AT the block (SARCLA 10.11.2026: "ask the AI on block should display the inbox there like a pop and
 * really apply the change on block level"): a question box beside the block; the answer is applied to the block at once
 * (a module's settings, a block's words), it says what it did, and Undo takes it back. With no question it fills the
 * block from the page ("Fill it with AI" - the module's settings button runs the same).
 */
export function AskPop({ kicker, title, empty, quick, onAsk, onClose }: {
  kicker: React.ReactNode; title: string;
  /** the button's words with no question ("Fill it with AI", "Write it again with AI") */
  empty: string;
  /** one-click asks ("Make it shorter") */
  quick?: { label: string; ask: string }[];
  onAsk: (request: string) => Promise<BlockAiAnswer>;
  onClose: () => void;
}) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<BlockAiAnswer | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { const t = setTimeout(() => box.current?.focus(), 60); return () => clearTimeout(t); }, []);
  const run = async (text: string, label: string) => {
    if (busy) return;
    setBusy(label);
    setSaid(null);
    try { setSaid(await onAsk(text.trim())); setAsk(""); } finally { setBusy(null); }
  };
  return (
    <PopCard kicker={kicker} title={title} onClose={onClose} maxBody="min(60vh, 520px)">
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", px: 1.25, py: 0.75, "&:focus-within": { borderColor: PINK, boxShadow: "0 0 0 3px rgba(194,44,110,.12)" } }}>
        <InputBase inputRef={box} fullWidth multiline minRows={2} maxRows={6} value={ask} disabled={!!busy} placeholder="What should change in this block? Leave it empty to fill it from the page."
          onChange={(e) => setAsk(e.target.value.slice(0, 1500))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(ask, ask.trim() ? "Asking…" : empty); } }}
          sx={{ fontSize: "0.86rem", lineHeight: 1.45, color: INK }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
        <Button variant="contained" disableElevation disabled={!!busy} onClick={() => void run(ask, ask.trim() ? "Asking…" : empty)}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...mainBtn, bgcolor: PINK, borderRadius: "7px", px: 1.75, py: 0.5, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" }, "&.Mui-disabled": busy ? { bgcolor: PINK, color: "#fff", opacity: 0.85 } : {} }}>
          {busy ?? (ask.trim() ? "Ask" : empty)}
        </Button>
        {!busy && !ask.trim() && (quick ?? []).map((q) => (
          <Button key={q.label} size="small" onClick={() => void run(q.ask, `${q.label}…`)} sx={{ ...quiet, border: `1px solid ${HAIRLINE}` }}>{q.label}</Button>
        ))}
      </Box>
      {said && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 1.25, pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ flex: 1, fontSize: "0.8rem", lineHeight: 1.45, color: said.ok ? INK : "#a96a12" }}>{said.text}</Typography>
          {said.undo && <Button size="small" onClick={() => { said.undo?.(); setSaid({ ok: true, text: "Taken back - the block is as it was.", undo: null }); }} sx={{ ...quiet, color: PINK, border: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>Undo</Button>}
        </Box>
      )}
      <Typography sx={{ mt: 1, fontSize: "0.72rem", color: MUTED, lineHeight: 1.4 }}>Applied to this block only, at once. The assistant on the right works on the whole page.</Typography>
    </PopCard>
  );
}

/* ── a link in every store view the page goes to (Content v11) ────────── */

/**
 * The link as each store view the page goes to sends its visitor (SARCLA 10.11.2026: "this should also get all the links
 * from all the locales in a dropdown"): folded under the link, "In every store view (9)"; each row its store view and its
 * address there - opened on the shop by a click - or, in another language, said: that language's page sets its own.
 */
export function StoreLinks({ url, stores }: { url: string; stores: string[] }) {
  const [open, setOpen] = useState(false);
  const rows = linkInStores(url, stores);
  if (!url.trim() || rows.length < 2) return null;
  const moved = rows.filter((r) => r.moved).length;
  return (
    <Box sx={{ mt: -0.25, mb: 1 }}>
      <Button size="small" onClick={() => setOpen((x) => !x)} endIcon={<ExpandMoreIcon sx={{ fontSize: 17, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
        sx={{ ...btn, px: 0.5, fontSize: "0.78rem", color: open ? PINK : MUTED }}>
        In every store view ({rows.length}){moved < rows.length ? ` · ${rows.length - moved} in another language` : ""}
      </Button>
      {open && (
        <Box role="list" sx={{ mt: 0.5, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
          {rows.map((r, i) => (
            <Box key={r.store} role="listitem" sx={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr) 22px", alignItems: "center", gap: 1, px: 1, py: 0.55, borderTop: i ? `1px solid ${HAIRLINE}` : "none", bgcolor: "#fff" }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{r.store}</Typography>
              {r.moved ? (
                <Typography component="a" href={`https://www.apsoparts.com${r.path.startsWith("/") ? r.path : `/${r.path}`}`} target="_blank" rel="noreferrer" title={`Open ${r.path} on the shop`}
                  sx={{ minWidth: 0, fontSize: "0.72rem", color: MUTED, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "none", "&:hover": { color: PINK } }}>
                  {r.path}
                </Typography>
              ) : (
                <Typography sx={{ minWidth: 0, fontSize: "0.72rem", color: "#a96a12" }}>Another language - its own page sets this link (translate the page)</Typography>
              )}
              {r.moved ? <OpenInNewIcon sx={{ fontSize: 13, color: MUTED }} /> : <span />}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
