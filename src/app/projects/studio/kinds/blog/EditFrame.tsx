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

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { HAIRLINE } from "@/app/uc/report/ui";

export type Device = "desktop" | "mobile";
export type Rect = { left: number; top: number; width: number; height: number };

const STUDIO_CSS = `[data-ed],[data-pic],[data-sel]{cursor:pointer;transition:outline-color .12s,background-color .12s}
[data-ed]{cursor:text}
a[data-ed],a [data-ed],[data-ed] a{pointer-events:auto!important}
[data-x-hov]{outline:2px dashed rgba(36,89,209,.55)!important;outline-offset:3px}
[data-x-sel]{outline:2px solid #2459d1!important;outline-offset:3px}
[data-x-edit]{outline:2px solid #c22c6e!important;outline-offset:3px;background-color:rgba(194,44,110,.045)!important;cursor:text!important}
[data-x-busy]{animation:xbusy 1.3s ease-in-out infinite}
@keyframes xbusy{0%,100%{outline:2px solid rgba(194,44,110,.2);outline-offset:3px}50%{outline:2px solid rgba(194,44,110,.85);outline-offset:6px}}`;

const MARKED = "[data-ed],[data-pic],[data-sel]";
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
  /** the part the assistant is working on: its outline breathes */
  busy?: string | null;
  /** drawn over the page at the parts' places (pointer events on its own controls) */
  overlay?: (o: { rect: (selector: string) => Rect | null; zoom: number; tick: number }) => React.ReactNode;
  /** the frame's chrome: a phone's rounded edge and shadow */
  framed?: boolean;
};

export function EditFrame({ html, device, width, title, texts, oneLine, selected, onSelect, onCommit, readOnly, focus, editKey, busy, overlay, framed = true }: EditFrameProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState(html);
  const [avail, setAvail] = useState(800);
  const [height, setHeight] = useState(900);
  const [tick, setTick] = useState(0);
  const w = device === "mobile" ? 390 : width;

  // the latest of everything, for the listeners on the page (set once per document)
  const props = useRef({ texts, oneLine, onSelect, onCommit, readOnly, selected });
  props.current = { texts, oneLine, onSelect, onCommit, readOnly, selected };
  const want = useRef(html);
  const head = useRef(split(html).head);
  /** the document the listeners and the page are in (a reloaded frame is a new one) */
  const readyDoc = useRef<Document | null>(null);
  const lastBody = useRef<string | null>(null);
  const editing = useRef<{ el: HTMLElement; key: string; raw: string; html: string; swapped: boolean } | null>(null);
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
    if (busyRef.current) marked(d, busyRef.current).forEach((x) => x.setAttribute("data-x-busy", ""));
  }, []);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  /** Starts editing a part's words: the words as written in place of the drawn ones when they differ, the caret where
   *  the click was. */
  const begin = useCallback((el: HTMLElement, key: string, at?: { x: number; y: number }) => {
    const d = el.ownerDocument;
    const raw = props.current.texts(key);
    if (raw === null) return;
    const swapped = norm(raw) !== norm(el.innerText ?? "");
    const before = el.innerHTML;
    if (swapped) { el.textContent = raw; el.style.whiteSpace = "pre-wrap"; }
    el.removeAttribute("data-x-sel");
    el.removeAttribute("data-x-hov");
    el.setAttribute("data-x-edit", "");
    try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
    if (el.contentEditable !== "plaintext-only" && el.contentEditable !== "true") el.contentEditable = "true";
    el.spellcheck = true;
    editing.current = { el, key, raw, html: before, swapped };
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
    const text = (e.el.innerText ?? "").replace(/ /g, " ").replace(/\n+$/, "");
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
      if (e.swapped) e.el.innerHTML = e.html;
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
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey || props.current.oneLine?.(e.key))) { ev.preventDefault(); end(true); }
      }, true);
      // the focus left the page (a click in the studio around it): the words are kept
      d.addEventListener("focusout", (ev) => {
        const e = editing.current;
        if (!e || ev.target !== e.el) return;
        // (a frame that lost the focus to the studio around it keeps its own activeElement: ask the document too)
        setTimeout(() => { if (editing.current === e && (!d.hasFocus() || d.activeElement !== e.el)) end(true); }, 0);
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
        {overlay && <Box sx={{ position: "absolute", left: 0, top: 0, width: w * zoom, height: height * zoom, pointerEvents: "none" }}>{overlay({ rect, zoom, tick })}</Box>}
      </Box>
    </Box>
  );
}
