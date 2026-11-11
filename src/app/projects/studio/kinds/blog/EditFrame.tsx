"use client";
// THE THING BEING MADE, EDITED WHERE IT IS READ (Content v3, 08.11.2026). SARCLA: the blog's "editing is really not yet
// fully clear"; the newsletter's "editing is very confusing". The blog post and the newsletter are drawn as their reader
// sees them - in a frame at the device's real width, zoomed to the room it has, as tall as its content (the pane scrolls,
// not the frame) - and edited right there:
//
//   a click on words     edits them in place: the caret lands where the click was; the words as written (markdown, a
//                        list's marks) show while they are edited; Enter keeps a one-line part, Esc drops the change, a
//                        click elsewhere keeps it. The part is picked too: the assistant works on it.
//   a click on a picture or a part with no words of its own (data-pic, data-sel)   picks it
//   a click anywhere else picks nothing: the assistant works on the whole thing
//
// The marks come from the page's own HTML (data-ed / data-pic / data-sel, the preview only). No script runs in the
// frame (sandbox without allow-scripts); same-origin, so the studio works on the page from outside. A new document is
// laid into the frame without reloading it (its body is replaced; the frame is reloaded only when its head changes), so
// nothing blinks and the scroll stays. Overlay: controls drawn over the page at a part's place (the newsletter's block
// tools).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import LinkIcon from "@mui/icons-material/Link";
import { HAIRLINE } from "@/app/uc/report/ui";
import { htmlToMarks, type RichMode } from "@/lib/content/studio/kinds/blog/richEdit";
import { placeLabel, type Box as Area } from "@/lib/content/studio/kinds/social/place";

export type Device = "desktop" | "mobile";
export type Rect = { left: number; top: number; width: number; height: number };

const STUDIO_CSS = `[data-ed],[data-pic],[data-sel]{cursor:pointer;transition:outline-color .12s,background-color .12s}
[data-ed]{cursor:text}
a[data-ed],a [data-ed],[data-ed] a{pointer-events:auto!important}
[data-x-hov]{outline:2px dashed rgba(194,44,110,.45)!important;outline-offset:3px}
[data-x-sel]{outline:2px solid #c22c6e!important;outline-offset:3px}
[data-x-edit]{outline:2px solid #c22c6e!important;outline-offset:3px;background-color:rgba(194,44,110,.045)!important;cursor:text!important}
[data-x-busy]{animation:xbusy 1.3s ease-in-out infinite}
@keyframes xbusy{0%,100%{outline:2px solid rgba(194,44,110,.2);outline-offset:3px}50%{outline:2px solid rgba(194,44,110,.85);outline-offset:6px}}`;

const MARKED = "[data-ed],[data-pic],[data-sel]";
/** the label over the picked part: its height */
const LABEL_H = 28;
const keyOf = (el: Element) => el.getAttribute("data-ed") ?? el.getAttribute("data-pic") ?? el.getAttribute("data-sel");
const norm = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();

function split(html: string): { head: string; body: string } {
  const i = html.indexOf("<body");
  const j = i >= 0 ? html.indexOf(">", i) : -1;
  const k = html.lastIndexOf("</body>");
  if (i < 0 || j < 0 || k < 0) return { head: html, body: "" };
  return { head: html.slice(0, j + 1), body: html.slice(j + 1, k) };
}

/** Every element of the page marked with this key (a part can show in more than one place: a topic, the author). */
function marked(d: Document, key: string): HTMLElement[] {
  return [...d.querySelectorAll<HTMLElement>(MARKED)].filter((el) => keyOf(el) === key);
}

export type EditFrameProps = {
  html: string;
  device: Device;
  /** the page's width on a computer (a phone is 390) */
  width: number;
  title: string;
  /** a part's words as they are written - what a click on it edits (null: not editable) */
  texts: (key: string) => string | null;
  /** one-line parts: Enter keeps them */
  oneLine?: (key: string) => boolean;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onCommit: (key: string, text: string) => void;
  readOnly?: boolean;
  /** a part to bring into view, and when it was asked */
  focus?: { key: string; at: number } | null;
  /** a part whose words to start editing (a section just added: its heading), and when it was asked */
  editKey?: { key: string; at: number } | null;
  /** the part the assistant is working on: its outline breathes ("*": the whole thing is being written - every part) */
  busy?: string | null;
  /** drawn over the page at the parts' places (pointer events on its own controls) */
  overlay?: (o: { rect: (selector: string) => Rect | null; zoom: number; tick: number }) => React.ReactNode;
  /** the frame's chrome: a phone's rounded edge and shadow */
  framed?: boolean;
  /** parts edited AS they look (bold bold, red red - Content v4): how their words are kept ("inline" or "blocks"); the
   *  others are edited as plain words */
  rich?: (key: string) => RichMode | null;
  /** the red key word (==...==) and slanted words exist here (the blog; a newsletter knows bold and links only) */
  redMarks?: boolean;
  /** the small dark label over the picked part: its name ("<Part> · Ask AI · x"); null: no label */
  label?: (key: string) => string | null;
  /** "Ask AI" in the label: the assistant's box, for the part picked */
  onAskAi?: () => void;
  /** shop pages offered while a link's address is typed (none: the address is typed) */
  linkSearch?: (q: string) => Promise<{ label: string; href: string }[]>;
  /** a shop path ("/de/...") made whole with this (an e-mail needs the full address) */
  linkBase?: string;
  /** cv16 (the blog): what the picked part can do besides its words - Move up / down, Duplicate, Take it out - in the
   *  label, after Ask AI (the Page builder's element popup order); null or all false: none shown */
  partActions?: (key: string) => { up: boolean; down: boolean; duplicate: boolean; remove: boolean; what: string } | null;
  onPartAction?: (key: string, act: "up" | "down" | "duplicate" | "remove") => void;
  /** cv16 (the blog): "Write again" in the label - the part's section written again by the AI, at once */
  onAgain?: (key: string) => void;
};

export function EditFrame({ html, device, width, title, texts, oneLine, selected, onSelect, onCommit, readOnly, focus, editKey, busy, overlay, framed = true, rich, redMarks, label, onAskAi, linkSearch, linkBase, partActions, onPartAction, onAgain }: EditFrameProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState(html);
  const [avail, setAvail] = useState(800);
  const [height, setHeight] = useState(900);
  const [tick, setTick] = useState(0);
  const w = device === "mobile" ? 390 : width;
  /** the label over the picked part: its real width, for its place */
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [labelW, setLabelW] = useState(220);
  useLayoutEffect(() => {
    const lw = labelRef.current?.offsetWidth;
    if (lw && Math.abs(lw - labelW) > 2) setLabelW(lw);
  });

  // the latest of everything, for the listeners on the page (set once per document)
  const props = useRef({ texts, oneLine, onSelect, onCommit, readOnly, selected, rich, redMarks });
  props.current = { texts, oneLine, onSelect, onCommit, readOnly, selected, rich, redMarks };
  /** the part being edited, for the label's buttons */
  const [edKey, setEdKey] = useState<string | null>(null);
  /** a link being set on the words picked: the address, and whether the words are a link already */
  const [linking, setLinking] = useState<{ href: string; existing: boolean } | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const linkRange = useRef<Range | null>(null);
  /** the focus is in the link's field: the words stay in editing (the frame lost the focus on purpose) */
  const hold = useRef(false);
  const want = useRef(html);
  const head = useRef(split(html).head);
  /** the document the listeners and the page are in (a reloaded frame is a new one) */
  const readyDoc = useRef<Document | null>(null);
  const lastBody = useRef<string | null>(null);
  const editing = useRef<{ el: HTMLElement; key: string; raw: string; html: string; swapped: boolean; mode: RichMode | null } | null>(null);
  /** a change kept, its new page not laid in yet */
  const stale = useRef(false);
  /** the part to edit once the page is laid in, and where it was clicked */
  const next = useRef<{ key: string; x: number; y: number } | null>(null);

  const doc = () => frame.current?.contentDocument ?? null;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = useCallback(() => {
    const d = doc();
    if (!d?.documentElement) return;
    setHeight(Math.min(40_000, Math.max(300, d.documentElement.scrollHeight)));
    setTick((t) => t + 1);
  }, []);

  /** The selected part and the busy one marked on the page. */
  const mark = useCallback(() => {
    const d = doc();
    if (!d?.body) return;
    d.querySelectorAll("[data-x-sel]").forEach((x) => x.removeAttribute("data-x-sel"));
    d.querySelectorAll("[data-x-busy]").forEach((x) => x.removeAttribute("data-x-busy"));
    const s = props.current.selected;
    if (s) marked(d, s).forEach((x) => { if (!x.hasAttribute("data-x-edit")) x.setAttribute("data-x-sel", ""); });
    if (busyRef.current === "*") d.querySelectorAll("[data-ed],[data-pic]").forEach((x) => x.setAttribute("data-x-busy", ""));
    else if (busyRef.current) marked(d, busyRef.current).forEach((x) => x.setAttribute("data-x-busy", ""));
  }, []);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  /** Starts editing a part's words: the words as written in place of the drawn ones when they differ, the caret where
   *  the click was. */
  const begin = useCallback((el: HTMLElement, key: string, at?: { x: number; y: number }) => {
    const d = el.ownerDocument;
    const raw = props.current.texts(key);
    if (raw === null) return;
    // edited as it looks (bold bold, red red): the drawn words themselves; else the words as written
    const mode = props.current.rich?.(key) ?? null;
    const swapped = !mode && norm(raw) !== norm(el.innerText ?? "");
    const before = el.innerHTML;
    if (swapped) { el.textContent = raw; el.style.whiteSpace = "pre-wrap"; }
    el.removeAttribute("data-x-sel");
    el.removeAttribute("data-x-hov");
    el.setAttribute("data-x-edit", "");
    if (mode) el.contentEditable = "true";
    else {
      try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
      if (el.contentEditable !== "plaintext-only" && el.contentEditable !== "true") el.contentEditable = "true";
    }
    el.spellcheck = true;
    editing.current = { el, key, raw, html: before, swapped, mode };
    setEdKey(key);
    el.focus({ preventScroll: true });
    const sel = d.getSelection();
    if (!sel) return;
    let range: Range | null = null;
    const dd = d as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
    if (at && at.x >= 0) {
      if (dd.caretRangeFromPoint) range = dd.caretRangeFromPoint(at.x, at.y);
      else if (dd.caretPositionFromPoint) { const p = dd.caretPositionFromPoint(at.x, at.y); if (p) { range = d.createRange(); range.setStart(p.offsetNode, p.offset); } }
    }
    if (!range || !el.contains(range.startContainer)) { range = d.createRange(); range.selectNodeContents(el); range.collapse(false); }
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  /** The page laid into the frame (its body); then the part waiting to be edited, if any. */
  const lay = useCallback((force = false) => {
    const d = doc();
    if (!d?.body || readyDoc.current !== d || editing.current) return;
    const { body } = split(want.current);
    if (force || body !== lastBody.current) {
      d.body.innerHTML = body;
      lastBody.current = body;
    }
    stale.current = false;
    mark();
    measure();
    const n = next.current;
    if (n && !props.current.readOnly) {
      next.current = null;
      const el = marked(d, n.key).find((x) => x.hasAttribute("data-ed"));
      if (el) begin(el, n.key, n);
    }
  }, [begin, mark, measure]);

  /** Stops editing: the words kept (or dropped), the page drawn again from the document. */
  const end = useCallback((keep: boolean) => {
    const e = editing.current;
    if (!e) return;
    editing.current = null;
    setEdKey(null);
    // a part edited as it looks and left as it was: nothing to keep (its markdown is not written again)
    const same = !!e.mode && e.el.innerHTML === e.html;
    const text = same ? e.raw : e.mode ? htmlToMarks(e.el.innerHTML, e.mode) : (e.el.innerText ?? "").replace(/ /g, " ").replace(/\n+$/, "");
    e.el.removeAttribute("contenteditable");
    e.el.removeAttribute("data-x-edit");
    e.el.style.whiteSpace = "";
    e.el.ownerDocument.getSelection()?.removeAllRanges();
    if (keep && text.trim() !== e.raw.trim()) {
      stale.current = true;
      props.current.onCommit(e.key, text);
      // the new page comes with the next render; should the change make no difference to it, draw it again anyway
      setTimeout(() => { if (stale.current) lay(true); }, 450);
    } else {
      // dropped (Esc) or the same words: the part as it was drawn
      e.el.innerHTML = e.html;
      lay();
    }
  }, [lay]);

  // a new document: laid in (or, when its head changed, the frame loaded again)
  useEffect(() => {
    want.current = html;
    const h = split(html).head;
    if (h !== head.current) { head.current = h; readyDoc.current = null; setSrc(html); return; }
    if (readyDoc.current && readyDoc.current === doc() && !editing.current) lay();
  }, [html, lay]);

  useEffect(() => { mark(); }, [selected, busy, mark]);

  // the frame loaded: its listeners, the studio's look, the latest page
  const onLoad = useCallback(() => {
    const d = doc();
    if (!d?.documentElement || !d.body || d.readyState !== "complete" || readyDoc.current === d) return;
    readyDoc.current = d;
    lastBody.current = split(src).body;
    if (!d.getElementById("x-studio-css")) {
      const st = d.createElement("style");
      st.id = "x-studio-css";
      st.textContent = STUDIO_CSS;
      (d.head ?? d.documentElement).appendChild(st);
    }
    const dd = d as Document & { __x?: boolean };
    if (!dd.__x) {
      dd.__x = true;
      let hov: Element | null = null;
      const unhov = () => { hov?.removeAttribute("data-x-hov"); hov = null; };
      d.addEventListener("mouseover", (ev) => {
        const t = (ev.target as Element).closest?.(MARKED) ?? null;
        if (t === hov) return;
        unhov();
        if (t && !t.hasAttribute("data-x-edit") && !t.hasAttribute("data-x-sel")) { hov = t; t.setAttribute("data-x-hov", ""); }
      }, true);
      d.documentElement.addEventListener("mouseleave", unhov);
      d.addEventListener("mousedown", (ev) => {
        const t = ev.target as Element;
        const e = editing.current;
        if (hold.current) { hold.current = false; linkRange.current = null; setLinking(null); }
        if (e && e.el.contains(t)) return; // the caret moves inside the words being edited
        ev.preventDefault();
        unhov();
        const words = t.closest?.("[data-ed]") as HTMLElement | null;
        const other = t.closest?.(MARKED) as HTMLElement | null;
        if (e) end(true);
        const p = props.current;
        if (words && !p.readOnly && p.texts(words.getAttribute("data-ed")!) !== null) {
          const key = words.getAttribute("data-ed")!;
          p.onSelect(key);
          next.current = { key, x: ev.clientX, y: ev.clientY };
          if (!stale.current) lay();
          return;
        }
        p.onSelect(other ? keyOf(other) : null);
      }, true);
      // links lead nowhere here, a question does not fold
      d.addEventListener("click", (ev) => {
        const e = editing.current;
        if (e && e.el.contains(ev.target as Node) && !(ev.target as Element).closest?.("a,summary,label,button")) return;
        ev.preventDefault();
        ev.stopPropagation();
      }, true);
      d.addEventListener("keydown", (ev) => {
        const e = editing.current;
        if (!e) return;
        if (ev.key === "Escape") { ev.preventDefault(); end(false); return; }
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey || props.current.oneLine?.(e.key))) { ev.preventDefault(); end(true); return; }
        // words edited as they look: Ctrl+B bold, Ctrl+E a red key word (the blog), Ctrl+I slanted (the blog); nothing
        // the part cannot keep (underline)
        if (e.mode && (ev.ctrlKey || ev.metaKey) && !ev.altKey) {
          const k = ev.key.toLowerCase();
          if (k === "e") { ev.preventDefault(); if (props.current.redMarks) toggleRed(d); }
          else if (k === "u" || (k === "i" && !props.current.redMarks)) ev.preventDefault();
        }
      }, true);
      // a paste brings words, never another page's look
      d.addEventListener("paste", (ev) => {
        const e = editing.current;
        if (!e?.mode || !ev.clipboardData) return;
        ev.preventDefault();
        d.execCommand("insertText", false, ev.clipboardData.getData("text/plain"));
      }, true);
      // the focus left the page (a click in the studio around it): the words are kept
      d.addEventListener("focusout", (ev) => {
        const e = editing.current;
        if (!e || ev.target !== e.el || hold.current) return;
        // (a frame that lost the focus to the studio around it keeps its own activeElement: ask the document too)
        setTimeout(() => { if (!hold.current && editing.current === e && (!d.hasFocus() || d.activeElement !== e.el)) end(true); }, 0);
      }, true);
      const ro = new ResizeObserver(() => measure());
      if (d.body) ro.observe(d.body);
    }
    lay(true);
  }, [src, end, lay, measure]);

  // the frame's load event is not always seen (a srcdoc can finish before it is listened to): look for the page too
  useEffect(() => {
    const t = setInterval(() => {
      const d = doc();
      if (d && d.readyState === "complete" && d.body?.childElementCount && readyDoc.current !== d) onLoad();
    }, 250);
    return () => clearInterval(t);
  }, [onLoad]);

  // a part's words to edit now (the caret at their end) - once the page has it
  useEffect(() => {
    if (!editKey || readOnly) return;
    if (editing.current) end(true);
    next.current = { key: editKey.key, x: -1, y: -1 };
    const t = setTimeout(() => { if (!stale.current) lay(); }, 60);
    return () => clearTimeout(t);
  }, [editKey, readOnly, end, lay]);

  // a part brought into view (from the outline)
  useEffect(() => {
    if (!focus) return;
    const d = doc();
    const el = d ? marked(d, focus.key)[0] : null;
    const f = frame.current;
    if (!el || !f) return;
    let scroller: HTMLElement | null = f.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (!scroller) return;
    const zoom = f.getBoundingClientRect().width / (f.offsetWidth || 1);
    const top = scroller.scrollTop + f.getBoundingClientRect().top - scroller.getBoundingClientRect().top + el.getBoundingClientRect().top * zoom - 90;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [focus]);

  const zoom = Math.min(1, (avail - 8) / w);
  const mobile = device === "mobile";
  // the picked part's place, for its label (read again on every draw of the page: tick)
  const selEl = selected && label ? (() => { const dd = doc(); return dd ? marked(dd, selected)[0] ?? null : null; })() : null;
  const selName = selected && label ? label(selected) : null;
  const selBox = selEl && selName ? (() => { const r = selEl.getBoundingClientRect(); return { left: r.left * zoom, top: r.top * zoom, width: r.width * zoom }; })() : null;
  // the label's place by the social studio's rule (lib/content/studio/kinds/social/place.ts): above the part if that
  // covers nothing, else below, else inside its corner - never over the title, a heading or the block above (QA
  // 09.11.2026). What it must not cover is the other parts' WORDS, line by line (a title's short last line leaves room
  // beside it) and their pictures; a part holding others counts by them. Before going inside the part: its bottom-right
  // corner after a short last line, then above or below over the edge of a picture (never over words).
  const labelAt = selEl && selBox ? (() => {
    const dd = doc();
    if (!dd) return null;
    const box = (r: DOMRect): Area => ({ x: r.left * zoom, y: r.top * zoom, w: r.width * zoom, h: r.height * zoom });
    const near = (b: Area, s: Area) => b.w > 0 && b.h > 0 && b.y < s.y + s.h + 80 && b.y + b.h > s.y - 80;
    // the words line by line (each text's own boxes - not its paragraph's full width), and every picture whole
    const inkOf = (el: HTMLElement): Area[] => {
      if (el.hasAttribute("data-pic") || !(el.textContent ?? "").trim()) return [box(el.getBoundingClientRect())];
      const out: Area[] = [...el.querySelectorAll("img")].map((i) => box(i.getBoundingClientRect()));
      const walk = dd.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const r = dd.createRange();
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!(t.textContent ?? "").trim()) continue;
        r.selectNodeContents(t);
        out.push(...[...r.getClientRects()].map(box));
      }
      return out;
    };
    const sel = box(selEl.getBoundingClientRect());
    const others: Area[] = [];
    const words: Area[] = [];
    dd.querySelectorAll<HTMLElement>(MARKED).forEach((el) => {
      if (el === selEl || el.contains(selEl) || selEl.contains(el) || el.querySelector(MARKED)) return;
      if (!near(box(el.getBoundingClientRect()), sel)) return;
      const ink = inkOf(el).filter((b) => near(b, sel));
      others.push(...ink);
      if (!el.hasAttribute("data-pic")) words.push(...ink);
    });
    const outside = (a: { y: number }) => a.y >= sel.y + sel.h || a.y + LABEL_H <= sel.y;
    const at = placeLabel(sel, others, null, labelW, w * zoom, height * zoom, LABEL_H, 6);
    if (outside(at)) return at;
    const own = inkOf(selEl);
    const x = Math.max(4, Math.min(w * zoom - labelW - 4, sel.x + sel.w - labelW - 4));
    const y = sel.y + sel.h - LABEL_H - 4;
    const hit = (b: Area) => x < b.x + b.w && b.x < x + labelW && y < b.y + b.h && b.y < y + LABEL_H;
    if (y > sel.y && !own.some(hit) && !others.some(hit)) return { x, y };
    const overPicture = placeLabel(sel, words, null, labelW, w * zoom, height * zoom, LABEL_H, 6);
    return outside(overPicture) ? overPicture : at;
  })() : null;
  const richOn = !!edKey && !!editing.current?.mode;

  /** "Link" in the label: the words picked (or the link the caret is in) get an address, or lose theirs. */
  const anchorIn = (r: Range, root: HTMLElement): HTMLAnchorElement | null => {
    let n: Node | null = r.commonAncestorContainer;
    while (n && n !== root) { if (n.nodeType === 1 && (n as Element).tagName === "A") return n as HTMLAnchorElement; n = n.parentNode; }
    return null;
  };
  const startLink = () => {
    const d = doc();
    const e = editing.current;
    const s = d?.getSelection();
    if (!d || !e || !s || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    if (!e.el.contains(r.commonAncestorContainer)) return;
    const a = anchorIn(r, e.el);
    if (!a && r.collapsed) { setLinkNote("Pick the words for the link first."); setTimeout(() => setLinkNote(null), 2500); return; }
    linkRange.current = r.cloneRange();
    hold.current = true;
    setLinkNote(null);
    setLinking({ href: a?.getAttribute("href") ?? "", existing: !!a });
  };
  /** null: nothing changed; "": the link taken off; else the address set. The words stay in editing. */
  const finishLink = (href: string | null) => {
    const d = doc();
    const e = editing.current;
    const r = linkRange.current;
    hold.current = false;
    linkRange.current = null;
    setLinking(null);
    if (!d || !e || !r) return;
    const a = anchorIn(r, e.el);
    const url = href && linkBase && href.startsWith("/") ? `${linkBase.replace(/\/+$/, "")}${href}` : href;
    if (url !== null) {
      if (a) {
        if (url) a.setAttribute("href", url);
        else { const parent = a.parentNode; if (parent) { while (a.firstChild) parent.insertBefore(a.firstChild, a); parent.removeChild(a); } }
      } else if (url) {
        const el = d.createElement("a");
        el.setAttribute("href", url);
        el.appendChild(r.extractContents());
        r.insertNode(el);
      }
    }
    e.el.focus({ preventScroll: true });
    const s = d.getSelection();
    if (s) { const nr = d.createRange(); nr.selectNodeContents(e.el); nr.collapse(false); s.removeAllRanges(); s.addRange(nr); }
  };
  const rect = (selector: string): Rect | null => {
    const el = doc()?.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left * zoom, top: r.top * zoom, width: r.width * zoom, height: r.height * zoom };
  };

  return (
    <Box ref={box} sx={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
      <Box sx={{
        position: "relative", width: w * zoom + (mobile && framed ? 16 : 2), height: height * zoom + (mobile && framed ? 16 : 2), flexShrink: 0,
        borderRadius: mobile && framed ? "26px" : "6px", boxShadow: framed ? "0 18px 50px rgba(31,45,78,.16)" : "none",
        border: mobile && framed ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: "#fff", boxSizing: "border-box", transition: "width .25s ease",
      }}>
        <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: mobile && framed ? "18px" : "6px" }}>
          <iframe ref={frame} title={title} srcDoc={src} sandbox="allow-same-origin" onLoad={onLoad}
            style={{ width: w, height, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background: "#fff" }} />
        </Box>
        {overlay && <Box data-x-overlay="" sx={{ position: "absolute", left: 0, top: 0, width: w * zoom, height: height * zoom, pointerEvents: "none" }}>{overlay({ rect, zoom, tick })}</Box>}
        {selBox && selName && (
          <SelLabel boxRef={labelRef} name={selName} left={labelAt?.x ?? Math.max(0, Math.min(selBox.left, w * zoom - 430))} top={labelAt?.y ?? Math.max(-34, selBox.top - 34)}
            rich={richOn} red={!!redMarks} onBold={() => { doc()?.execCommand("bold"); }} onRed={() => { const dd = doc(); if (dd) toggleRed(dd); }}
            onLink={startLink} linkOn={!!linking}
            onAi={onAskAi} onClose={() => { if (hold.current) finishLink(null); if (editing.current) end(true); onSelect(null); }}
            acts={!readOnly && selected && onPartAction ? partActions?.(selected) ?? null : null} room={Math.max(200, w * zoom)}
            onAct={(act) => { if (!selected || !onPartAction) return; if (hold.current) finishLink(null); if (editing.current) end(true); onPartAction(selected, act); }}
            onAgain={!readOnly && selected && onAgain ? () => { if (editing.current) end(true); onAgain(selected); } : undefined} />
        )}
        {selBox && (linking || linkNote) && (
          <Box sx={{ position: "absolute", left: Math.max(0, Math.min(selBox.left, w * zoom - 340)), top: Math.max(-2, selBox.top - 2), zIndex: 5 }}>
            {linking ? <LinkBox start={linking.href} existing={linking.existing} search={linkSearch} onDone={finishLink} />
              : <Box sx={{ px: 1.25, py: 0.75, bgcolor: "#15223a", color: "#fff", fontSize: "0.76rem", borderRadius: "6px", boxShadow: "0 8px 22px rgba(21,34,58,.3)" }}>{linkNote}</Box>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** A red key word (==...==) on the words picked while editing - or, inside one, the red taken off. */
function toggleRed(d: Document) {
  const sel = d.getSelection();
  if (!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const c = r.commonAncestorContainer;
  const host = (c.nodeType === 1 ? (c as Element) : c.parentElement)?.closest("mark");
  if (host) {
    const parent = host.parentNode;
    if (!parent) return;
    while (host.firstChild) parent.insertBefore(host.firstChild, host);
    parent.removeChild(host);
    return;
  }
  if (r.collapsed) return;
  const m = d.createElement("mark");
  m.appendChild(r.extractContents());
  r.insertNode(m);
  sel.removeAllRanges();
  const nr = d.createRange();
  nr.selectNodeContents(m);
  sel.addRange(nr);
}

/** The small dark label over the picked part (the flow standard): its name, Ask AI, x - and while its words are edited
 *  as they look, Bold and Red. Mouse-down keeps the focus (and the words picked) in the page. */
function SelLabel({ boxRef, name, left, top, rich, red, onBold, onRed, onLink, linkOn, onAi, onClose, acts, onAct, onAgain, room }: {
  /** the frame's width on screen: a label with more tools scrolls inside itself, never the page sideways (a phone) */
  room?: number;
  boxRef?: React.Ref<HTMLDivElement>; name: string; left: number; top: number; rich: boolean; red: boolean; onBold: () => void; onRed: () => void; onLink: () => void; linkOn: boolean; onAi?: () => void; onClose: () => void;
  acts?: { up: boolean; down: boolean; duplicate: boolean; remove: boolean; what: string } | null; onAct?: (act: "up" | "down" | "duplicate" | "remove") => void; onAgain?: () => void;
}) {
  const b = { textTransform: "none" as const, fontWeight: 600, color: "#fff", minWidth: 0, px: 0.9, py: 0.2, fontSize: "0.74rem", borderRadius: "4px", lineHeight: 1.6, whiteSpace: "nowrap" as const, "&:hover": { bgcolor: "rgba(255,255,255,.14)" } };
  return (
    <Box ref={boxRef} onMouseDown={(e) => e.preventDefault()} sx={{
      position: "absolute", left, top, zIndex: 4, display: "inline-flex", alignItems: "center", gap: 0.25, height: LABEL_H, px: 0.5, width: "max-content",
      bgcolor: "#15223a", color: "#fff", borderRadius: "6px", boxShadow: "0 8px 22px rgba(21,34,58,.3)", pointerEvents: "auto", maxWidth: acts || onAgain ? Math.min(600, room ?? 600) : 430,
      ...(acts || onAgain ? { overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, "& > *": { flexShrink: 0 } } : {}),
    }}>
      <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, px: 0.75, color: "rgba(255,255,255,.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{name}</Box>
      {rich && (
        <>
          <Tooltip title="Bold (Ctrl+B)"><Button size="small" onClick={onBold} sx={b} aria-label="Bold"><FormatBoldIcon sx={{ fontSize: 16 }} /></Button></Tooltip>
          {red && <Tooltip title="A key word in red (Ctrl+E)"><Button size="small" onClick={onRed} sx={{ ...b, color: "#ff8a85", fontWeight: 800 }}>Red</Button></Tooltip>}
          <Tooltip title={linkOn ? "" : "A link on the words picked - or change or take off the link the caret is in"}><Button size="small" onClick={onLink} startIcon={<LinkIcon sx={{ fontSize: "15px !important" }} />} sx={{ ...b, bgcolor: linkOn ? "rgba(255,255,255,.16)" : "transparent", "& .MuiButton-startIcon": { mr: 0.3 } }}>Link</Button></Tooltip>
        </>
      )}
      {onAi && <Button size="small" onClick={onAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: "14px !important" }} />} sx={{ ...b, "& .MuiButton-startIcon": { mr: 0.4 } }}>Ask AI</Button>}
      {onAgain && <Tooltip title="The AI writes this section again at once - the box on the right says what should change (empty: from the post). Undo is in the history."><Button size="small" onClick={onAgain} sx={b}>Write again</Button></Tooltip>}
      {acts && (acts.up || acts.down || acts.duplicate || acts.remove) && (
        <>
          <Box component="span" sx={{ width: "1px", height: 16, bgcolor: "rgba(255,255,255,.2)", mx: 0.25, flexShrink: 0 }} />
          {(acts.up || acts.down) && <Tooltip title={`Move the ${acts.what} up`}><span><IconButton size="small" disabled={!acts.up} onClick={() => onAct?.("up")} aria-label={`Move the ${acts.what} up`} sx={{ color: "#fff", p: 0.4, "&.Mui-disabled": { color: "rgba(255,255,255,.3)" } }}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>}
          {(acts.up || acts.down) && <Tooltip title={`Move the ${acts.what} down`}><span><IconButton size="small" disabled={!acts.down} onClick={() => onAct?.("down")} aria-label={`Move the ${acts.what} down`} sx={{ color: "#fff", p: 0.4, "&.Mui-disabled": { color: "rgba(255,255,255,.3)" } }}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>}
          {acts.duplicate && <Tooltip title={`Duplicate the ${acts.what}`}><IconButton size="small" onClick={() => onAct?.("duplicate")} aria-label={`Duplicate the ${acts.what}`} sx={{ color: "#fff", p: 0.4 }}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
          {acts.remove && <Tooltip title={`Take the ${acts.what} out`}><IconButton size="small" onClick={() => onAct?.("remove")} aria-label={`Take the ${acts.what} out`} sx={{ color: "#ff8a85", p: 0.4 }}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>}
        </>
      )}
      <IconButton size="small" onClick={onClose} aria-label="Unselect" sx={{ color: "rgba(255,255,255,.7)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
    </Box>
  );
}

/** The address of a link: typed, or one of the shop's pages found as it is typed; Enter keeps it, Esc leaves it. */
function LinkBox({ start, existing, search, onDone }: {
  start: string; existing: boolean; search?: (q: string) => Promise<{ label: string; href: string }[]>; onDone: (href: string | null) => void;
}) {
  const [v, setV] = useState(start);
  const [found, setFound] = useState<{ label: string; href: string }[]>([]);
  const ok = /^(https?:\/\/[^\s]+|\/[^\s]*|#[\w-]+|mailto:[^\s]+)$/i.test(v.trim());
  useEffect(() => {
    const q = v.trim();
    if (!search || q.length < 2 || /^https?:/i.test(q)) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { void search(q).then((r) => { if (live) setFound(r.slice(0, 6)); }).catch(() => { if (live) setFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [v, search]);
  const b = { textTransform: "none" as const, fontWeight: 600, fontSize: "0.76rem", minWidth: 0, px: 1, py: 0.25, borderRadius: "4px" };
  return (
    <Box sx={{ width: 330, p: 1, bgcolor: "#fff", borderRadius: "8px", boxShadow: "0 12px 30px rgba(21,34,58,.25)", border: "1px solid #dde3ea" }}>
      <InputBase autoFocus fullWidth value={v} placeholder="A shop page (/de/...) or https://..." onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && ok) { e.preventDefault(); onDone(v.trim()); } if (e.key === "Escape") { e.preventDefault(); onDone(null); } }}
        inputProps={{ "aria-label": "The link's address" }}
        sx={{ fontSize: "0.84rem", px: 1, py: 0.5, border: `1px solid ${ok || !v ? "#cfd6dd" : "#e0a3a0"}`, borderRadius: "4px" }} />
      {found.length > 0 && (
        <Box sx={{ mt: 0.5, maxHeight: 170, overflowY: "auto" }}>
          {found.map((f) => (
            <Box key={f.href} component="button" type="button" onClick={() => onDone(f.href)} sx={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer", px: 1, py: 0.5, borderRadius: "4px", fontSize: "0.78rem", color: "#15223a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", "&:hover": { bgcolor: "#f3f5f8" } }}>
              {f.label}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, justifyContent: "flex-end" }}>
        {existing && <Button size="small" onClick={() => onDone("")} sx={{ ...b, color: "#8f1d1b", mr: "auto" }}>Remove link</Button>}
        <Button size="small" onClick={() => onDone(null)} sx={{ ...b, color: "#5f6a70" }}>Cancel</Button>
        <Button size="small" disabled={!ok} onClick={() => onDone(v.trim())} sx={{ ...b, bgcolor: "#c22c6e", color: "#fff", "&:hover": { bgcolor: "#a3245c" }, "&.Mui-disabled": { bgcolor: "#e9c4d5", color: "#fff" } }}>{existing ? "Save" : "Add link"}</Button>
      </Box>
    </Box>
  );
}
