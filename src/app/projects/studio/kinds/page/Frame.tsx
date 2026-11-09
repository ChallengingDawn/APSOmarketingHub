"use client";
// ONE PAGE IN A FRAME (08.11.2026): the HTML the server finished, at the device's real width, zoomed down to the space it
// has, as tall as its content (the pane scrolls, not the frame). No script runs in it (sandbox without allow-scripts);
// same-origin, so the studio itself works on the page from outside:
//
//   select   SARCLA 08.11.2026: "the page editor should allow element select for editing ... a real AI-assisted CMS".
//            Hovering outlines an element, a click selects it (the studio shows its properties and offers the AI for it
//            alone), a double-click edits its words right there (Enter or a click elsewhere keeps them, Esc drops them).
//            A new page's elements say which field they are (data-apx-f); an existing page's elements are found by a
//            selector, and those a change put in say which change (data-apx-c / data-apx-x) - so an edit lands there.
//   patch    a new page is drawn into the store's page as it is typed (#apx-root), without reloading the frame
//   marks    any placeholder left in the words is marked red (model.ts leftoversIn)
// Links do nothing here (a click selects). Shaped like the shared PreviewFrame, so the studios read as one product.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { HAIRLINE } from "@/app/uc/report/ui";
import { leftoversIn } from "@/lib/content/studio/kinds/page/model";
import { headKey, sectionLevels, type Located } from "@/lib/content/studio/kinds/page/shopParts";

export type Device = "desktop" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };

export type Picked = {
  /** "f:<field path>" (a new page's field) · "b:<part>" (a block) · "i:<insert id>" (a banner) · "e:<selector>" */
  key: string;
  path?: string; block?: string; insert?: string;
  selector: string; tag: string; text: string;
  /** its inner and outer HTML, cleaned of the studio's own marks */
  inner: string; outer: string;
  /** inside HTML a change put in (insert / replace): that change, its k-th top element, the way down to this one */
  frag: { change: number; k: number; path: number[] } | null;
  /** inside (or on) an element changes work on: their numbers, and the way down from it to this one */
  host: { changes: number[]; path: number[] } | null;
  src?: string; alt?: string; href?: string;
  editable: boolean;
  /** a page of the shop: the section it is in (its heading's words, "" = above the first heading) */
  section?: string;
};

export type SelectOpts = {
  mode: "field" | "element";
  selected: string | null;
  onPick: (p: Picked | null) => void;
  onEdit?: (p: Picked, v: { text: string; inner: string; outer: string }) => void;
  /** a request to start editing the selected element's words in place (the toolbar's "Edit words") */
  editNonce?: number;
  /** a selection made outside the page (the outline): the stage scrolls to it, smoothly */
  reveal?: number;
  /** a page of the shop: where the preview found each change, section by section (the outline's parts) */
  onMap?: (m: Located) => void;
  /** a section of a page of the shop opened in the outline: found here by its heading, selected and scrolled to */
  seek?: { nonce: number; heading: string } | null;
  /** a picture slot's own buttons in a new page ("Make it", "Upload"): its field and which */
  onAct?: (path: string, act: string) => void;
};

/** A page of the shop's section headings as the outline cuts it (headings a change put in are not sections). */
function sectionHeads(d: Document): Element[] {
  const root = d.getElementById("maincontent") ?? d.body;
  if (!root) return [];
  const all = [...root.querySelectorAll("h1,h2,h3")].filter((h) => !h.closest("[data-apx-c]") && (h.textContent ?? "").trim().length > 1);
  const levels = sectionLevels(all.map((h) => h.tagName.toLowerCase()));
  return all.filter((h) => levels.has(h.tagName.toLowerCase()));
}

/** Where each change landed: under the last section heading before it (or the first one it holds). */
function mapOf(d: Document): Located {
  const heads = sectionHeads(d);
  const out: Located = [{ heading: "", changes: [] }, ...heads.map((h) => ({ heading: (h.textContent ?? "").replace(/\s+/g, " ").trim(), changes: [] as number[] }))];
  const root = d.getElementById("maincontent") ?? d.body;
  for (const m of root?.querySelectorAll("[data-apx-c],[data-apx-x]") ?? []) {
    const ns = m.hasAttribute("data-apx-c") ? [Number(m.getAttribute("data-apx-c"))] : (m.getAttribute("data-apx-x") ?? "").split(/\s+/).map(Number);
    let k = heads.findIndex((h) => m === h || m.contains(h));
    if (k < 0) for (let j = 0; j < heads.length; j++) { if (heads[j].compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) k = j; else break; }
    for (const n of ns) if (Number.isInteger(n) && !out[k + 1].changes.includes(n)) out[k + 1].changes.push(n);
  }
  return out;
}

/** The section an element is in: the last section heading before it (or the one it holds) - "" above the first. */
function sectionOf(el: Element): string {
  const heads = sectionHeads(el.ownerDocument);
  let k = heads.findIndex((h) => el === h || el.contains(h));
  if (k < 0) for (let j = 0; j < heads.length; j++) { if (heads[j].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) k = j; else break; }
  return k < 0 ? "" : (heads[k].textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A section's block: its heading, widened to the biggest element around it that holds no other section heading. */
function sectionBlock(d: Document, heading: string): Element | null {
  const heads = sectionHeads(d);
  const key = headKey(heading);
  const h = heads.find((x) => headKey(x.textContent ?? "") === key) ?? heads.find((x) => key && headKey(x.textContent ?? "").startsWith(key.slice(0, 30)));
  if (!h) return null;
  let el: Element = h;
  const root = d.getElementById("maincontent") ?? d.body;
  while (el.parentElement && el.parentElement !== root && el.parentElement !== d.body && !heads.some((x) => x !== h && el.parentElement!.contains(x))) el = el.parentElement;
  return el;
}

/* ── the studio's own look inside the page ────────────────────────────── */

const SELECT_CSS = `[data-apx-hover]{outline:2px solid rgba(36,89,209,.9)!important;outline-offset:2px!important;cursor:pointer!important}
[data-apx-sel]{outline:2px solid #c22c6e!important;outline-offset:2px!important}
[data-apx-editing]{outline:2px solid #c22c6e!important;outline-offset:4px!important;cursor:text!important;background:rgba(194,44,110,.05)!important;-webkit-user-modify:read-write}
a,button,summary,label,[role=button],[data-apx-f],[data-apx-b]{pointer-events:auto!important}
mark[data-apx-left]{background:#ffe1dc!important;color:#b3261e!important;outline:2px solid #d80901;outline-offset:1px;border-radius:2px;padding:0 2px}`;

// the shop's body face (Open Sans) cannot come in from the shop either: the computer's own sans-serif stands in, never Times
// (one regular face each: the browser draws the bold itself - a face said to be bold would draw thin)
const SHOP_FONT_STANDINS = ["Open Sans", "futura-pt"].map((f) => `@font-face{font-family:"${f}";src:local("Segoe UI"),local("Helvetica Neue"),local("Arial")}`).join("\n");

let fontHeld: Promise<string> | null = null;
/** The brand's type (futura-pt's look-alike, as data: - the hub lets no font in from outside), once per window. */
function brandFont(): Promise<string> {
  fontHeld ??= fetch("/api/content/studio/banner/font").then((r) => (r.ok ? r.text() : ""))
    // the stand-ins first: a face declared later wins, so Jost (where the hub could load it) stands for futura-pt
    .then((css) => `${SHOP_FONT_STANDINS}\n${css ? `${css}\n${css.replace(/font-family:"Jost"/g, 'font-family:"futura-pt"')}` : ""}`)
    .catch(() => SHOP_FONT_STANDINS);
  return fontHeld;
}

/** The hub's own pictures with their full address - the frame's base is the shop's page, not the hub. */
export function hubAbsolute(html: string): string {
  if (typeof window === "undefined") return html;
  const o = window.location.origin;
  return html.replace(/(["'(])\/api\/content\/picture\//g, `$1${o}/api/content/picture/`);
}

const SINGLE_LINE = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "A", "BUTTON", "SUMMARY", "SPAN", "LI", "LABEL", "TD", "TH", "DT", "B", "STRONG", "SMALL"]);
const INLINE = new Set(["B", "STRONG", "EM", "I", "U", "SMALL", "SUP", "SUB", "BR", "FONT", "MARK", "ABBR", "CODE"]);
const SVG = new Set(["svg", "path", "use", "g", "circle", "rect", "line", "polyline", "polygon"]);

/** A selector the page's own elements are found by - ids first, then classes, then their place (as APSOconvert's). */
export function selectorOf(el: Element): string {
  const doc = el.ownerDocument;
  const okId = (id: string) => /^[A-Za-z][\w-]*$/.test(id) && !/^(ui-id-|ko_|apx-)/.test(id);
  if (el.id && okId(el.id)) return `#${el.id}`;
  const path: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur !== doc.body && cur !== doc.documentElement && depth < 6) {
    if (cur.id && okId(cur.id)) { path.unshift(`#${cur.id}`); break; }
    let part = cur.tagName.toLowerCase();
    const cls = [...cur.classList].filter((c) => /^[A-Za-z_-][\w-]*$/.test(c) && !/^(active|_active|selected|clearfix|hidden|visible|apx-)/.test(c)).slice(0, 2);
    if (cls.length) part += `.${cls.join(".")}`;
    const parent: Element | null = cur.parentElement;
    const same = parent ? [...parent.children].filter((x) => x.tagName === cur!.tagName) : [];
    if (same.length > 1 && (!cls.length || parent!.querySelectorAll(`:scope > ${part}`).length > 1)) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    path.unshift(part);
    try { if (doc.querySelectorAll(path.join(" > ")).length === 1) break; } catch { /* keep climbing */ }
    cur = parent;
    depth++;
  }
  return path.join(" > ");
}

/** The way down from an ancestor to an element, as element-child indexes. */
function pathFrom(top: Element, el: Element): number[] {
  const out: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== top) {
    const p: Element | null = cur.parentElement;
    if (!p) return [];
    out.unshift([...p.children].indexOf(cur));
    cur = p;
  }
  return out;
}

/** An element's copy without the studio's marks (hover, selection, editing, placeholders marked, change marks). */
export function cleanCopy(el: Element): Element {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll("mark[data-apx-left]").forEach((m) => m.replaceWith(...m.childNodes));
  for (const n of [c, ...c.querySelectorAll("*")]) {
    for (const a of [...n.attributes]) if (/^data-apx-|^data-apso-v$|^contenteditable$|^spellcheck$/.test(a.name)) n.removeAttribute(a.name);
  }
  return c;
}

function markLeftovers(root: Element | null) {
  if (!root) return;
  const doc = root.ownerDocument;
  root.querySelectorAll("mark[data-apx-left]").forEach((m) => m.replaceWith(...m.childNodes));
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = (n as Text).parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.tagName) || p.closest("[data-apx-editing]")) continue;
    if (leftoversIn((n as Text).data).length) nodes.push(n as Text);
  }
  for (const node of nodes.slice(0, 60)) {
    let rest: Text = node;
    for (const word of leftoversIn(node.data)) {
      const i = rest.data.indexOf(word);
      if (i < 0) continue;
      const hit = rest.splitText(i);
      rest = hit.splitText(word.length);
      const mark = doc.createElement("mark");
      mark.setAttribute("data-apx-left", "");
      hit.replaceWith(mark);
      mark.appendChild(hit);
    }
  }
}

export function Frame({ html, device, title, maxWidth, select, patch, toolbar, fit = true }: {
  html: string; device: Device; title: string; maxWidth?: number;
  /** false = the page at its real size (100%), scrolled sideways; true = zoomed to fit the space */
  fit?: boolean;
  select?: SelectOpts;
  /** a new page's HTML, drawn into #apx-root without reloading */
  patch?: string;
  /** shown over the selected element */
  toolbar?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const deviceBox = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [avail, setAvail] = useState(800);
  const [height, setHeight] = useState(900);
  const [loaded, setLoaded] = useState(0);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [font, setFont] = useState("");
  const w = DEVICE_WIDTH[device];
  const sel = useRef(select);
  sel.current = select;
  const editing = useRef<{ el: HTMLElement; before: string; picked: Picked } | null>(null);
  const patchRef = useRef(patch);
  patchRef.current = patch;
  // the HTML shown is held while words are being edited - the frame never reloads under the caret
  const [shown, setShown] = useState(html);
  const htmlRef = useRef(html);
  htmlRef.current = html;
  useEffect(() => { if (!editing.current) setShown(html); }, [html]);

  useEffect(() => { void brandFont().then(setFont); }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const docOf = () => frame.current?.contentDocument ?? null;
  const measure = useCallback(() => {
    const d = docOf();
    if (!d?.documentElement) return;
    setHeight(Math.min(30_000, Math.max(400, d.documentElement.scrollHeight)));
  }, []);

  /** what a click on this target selects - a field, a block, a banner, or (an existing page) the element itself */
  const candidate = (t: EventTarget | null): Element | null => {
    let el = t as Element | null;
    if (!el || el.nodeType !== 1) el = (t as Node | null)?.parentElement ?? null;
    if (!el) return null;
    if (sel.current?.mode === "field") return el.closest("[data-apx-f]") ?? el.closest("[data-apx-insert]") ?? el.closest("[data-apx-b]");
    const ins = el.closest("[data-apx-insert]");
    if (ins) return ins;
    while (el && SVG.has(el.tagName.toLowerCase()) && el.parentElement) el = el.parentElement;
    while (el && INLINE.has(el.tagName) && el.parentElement) el = el.parentElement;
    if (!el || el === el.ownerDocument.body || el === el.ownerDocument.documentElement || el.id === "maincontent") return null;
    return el;
  };

  const pickedOf = (el: Element): Picked => {
    const f = el.getAttribute("data-apx-f");
    const b = el.getAttribute("data-apx-b");
    const ins = el.getAttribute("data-apx-insert");
    const selector = f || b || ins ? "" : selectorOf(el);
    const key = f ? `f:${f}` : ins ? `i:${ins}` : b ? `b:${b}` : `e:${selector}`;
    const clean = cleanCopy(el);
    const top = el.closest("[data-apx-c]");
    const hostEl = el.closest("[data-apx-x]");
    const isImg = el.tagName === "IMG";
    const text = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/ /g, " ").trim();
    return {
      key, path: f ?? undefined, block: b ?? undefined, insert: ins ?? undefined, selector, tag: el.tagName.toLowerCase(), text: text.slice(0, 4000),
      inner: clean.innerHTML.slice(0, 20_000), outer: clean.outerHTML.slice(0, 20_000),
      frag: top ? { change: Number(top.getAttribute("data-apx-c")), k: Number(top.getAttribute("data-apx-k")), path: pathFrom(top, el) } : null,
      host: hostEl && !top ? { changes: (hostEl.getAttribute("data-apx-x") ?? "").split(/\s+/).map(Number).filter((n) => Number.isInteger(n)), path: pathFrom(hostEl, el) } : null,
      src: isImg ? (el as HTMLImageElement).getAttribute("src") ?? undefined : undefined,
      alt: isImg ? (el as HTMLImageElement).getAttribute("alt") ?? "" : undefined,
      href: el.closest("a")?.getAttribute("href") ?? undefined,
      editable: !isImg && !ins && !b && !!text && !el.querySelector("img,video,iframe,table") && !(f && /picture$|\.button$|^links\./.test(f) && !f.endsWith(".label")),
      section: sel.current?.mode === "element" && !ins ? sectionOf(el) : undefined,
    };
  };

  /** the element the selected key names, in the page as it is now */
  const findSelected = (d: Document, key: string | null): Element | null => {
    if (!key) return null;
    const v = key.slice(2);
    try {
      if (key.startsWith("f:")) return d.querySelector(`[data-apx-f="${CSS.escape(v)}"]`);
      // a list part opened in the outline ("b:sections"): its first item when it has items
      if (key.startsWith("b:")) return d.querySelector(`[data-apx-b="${CSS.escape(v)}"]`) ?? (v.includes(".") ? null : d.querySelector(`[data-apx-b^="${CSS.escape(v)}."]`));
      if (key.startsWith("i:")) return d.querySelector(`[data-apx-insert="${CSS.escape(v)}"]`);
      return v ? d.querySelector(v) : null;
    } catch { return null; }
  };

  const markSelected = useCallback(() => {
    const d = docOf();
    if (!d?.body) return;
    d.querySelectorAll("[data-apx-sel]").forEach((x) => x.removeAttribute("data-apx-sel"));
    const el = findSelected(d, sel.current?.selected ?? null);
    if (!el) { setSelRect(null); return; }
    el.setAttribute("data-apx-sel", "");
    const r = el.getBoundingClientRect();
    const sy = d.documentElement.scrollTop || d.body.scrollTop || 0;
    setSelRect({ x: r.left, y: r.top + sy, w: r.width, h: r.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootOf = (d: Document) => d.getElementById("apx-root") ?? d.getElementById("maincontent") ?? d.body;

  const draw = useCallback(() => {
    const d = docOf();
    if (!d?.body) return;
    if (patchRef.current !== undefined && !editing.current) {
      const root = d.getElementById("apx-root") as (HTMLElement & { __apxDrawn?: string }) | null;
      if (root && root.__apxDrawn !== patchRef.current) {
        root.innerHTML = hubAbsolute(patchRef.current);
        root.__apxDrawn = patchRef.current;
      }
    }
    if (!editing.current) markLeftovers(rootOf(d));
    markSelected();
    measure();
  }, [markSelected, measure]);

  /* ── editing words in place ─────────────────────────────────────────── */

  const endEdit = (keep: boolean) => {
    const e = editing.current;
    if (!e) return;
    editing.current = null;
    const el = e.el;
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-apx-editing");
    el.ownerDocument.getSelection()?.removeAllRanges();
    if (!keep) { el.innerHTML = e.before; draw(); setShown(htmlRef.current); return; }
    const clean = cleanCopy(el);
    const text = (el.innerText ?? "").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text !== e.picked.text) sel.current?.onEdit?.(e.picked, { text, inner: clean.innerHTML, outer: clean.outerHTML });
    draw();
    setShown(htmlRef.current);
  };

  const startEdit = (el: Element) => {
    const s = sel.current;
    if (!s?.onEdit || editing.current) return;
    const p = pickedOf(el);
    if (!p.editable) return;
    const h = el as HTMLElement;
    h.querySelectorAll("mark[data-apx-left]").forEach((m) => m.replaceWith(...m.childNodes));
    editing.current = { el: h, before: h.innerHTML, picked: p };
    h.setAttribute("data-apx-editing", "");
    try { h.contentEditable = s.mode === "field" ? "plaintext-only" : "true"; } catch { h.contentEditable = "true"; }
    if (h.contentEditable !== "plaintext-only" && h.contentEditable !== "true") h.contentEditable = "true";
    h.spellcheck = true;
    h.focus();
  };

  // listeners on the page, once per loaded document (the latest props read through refs)
  const setup = useCallback(() => {
    const d = docOf();
    if (!d?.documentElement) return;
    if (!d.getElementById("apx-studio-css")) {
      const st = d.createElement("style");
      st.id = "apx-studio-css";
      st.textContent = `${SHOP_FONT_STANDINS}
${SELECT_CSS}`;
      (d.head ?? d.documentElement).insertBefore(st, (d.head ?? d.documentElement).firstChild);
    }
    // once per document (the first, empty about:blank one and the page share a window - the flag is the document's)
    const doc = d as Document & { __apx?: boolean };
    if (!doc.__apx) {
      doc.__apx = true;
      let hov: Element | null = null;
      const unhov = () => { hov?.removeAttribute("data-apx-hover"); hov = null; };
      d.addEventListener("mouseover", (e) => {
        if (!sel.current || editing.current) return;
        const c = candidate(e.target);
        if (c === hov) return;
        unhov();
        if (c && !c.hasAttribute("data-apx-sel")) { hov = c; c.setAttribute("data-apx-hover", ""); }
      }, true);
      d.addEventListener("mouseleave", unhov, true);
      d.documentElement.addEventListener("mouseleave", unhov);
      d.addEventListener("click", (e) => {
        // inside the words being edited a click places the caret - and never follows a link or opens a question
        if (editing.current && editing.current.el.contains(e.target as Node)) { if ((e.target as Element).closest?.("a,summary,label,button")) e.preventDefault(); return; }
        e.preventDefault();
        if (editing.current) endEdit(true);
        const s = sel.current;
        if (!s) return;
        e.stopPropagation();
        const c = candidate(e.target);
        unhov();
        s.onPick(c ? pickedOf(c) : null);
        // a picture slot's button: the slot is selected, and its action runs
        const act = (e.target as Element).closest?.("[data-apx-act]");
        const slot = act?.closest("[data-apx-f]");
        if (act && slot && s.onAct) s.onAct(slot.getAttribute("data-apx-f") ?? "", act.getAttribute("data-apx-act") ?? "");
      }, true);
      d.addEventListener("dblclick", (e) => {
        const s = sel.current;
        if (!s) return;
        const c = candidate(e.target);
        if (!c) return;
        e.preventDefault();
        startEdit(c);
      }, true);
      d.addEventListener("keydown", (e) => {
        if (!editing.current) return;
        if (e.key === "Escape") { e.preventDefault(); endEdit(false); return; }
        // "select all" selects this element's words, not the page
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          const r = d.createRange(); r.selectNodeContents(editing.current.el);
          const sl = d.getSelection(); sl?.removeAllRanges(); sl?.addRange(r);
          return;
        }
        if (e.key === "Enter" && ((!e.shiftKey && SINGLE_LINE.has(editing.current.el.tagName)) || e.ctrlKey || e.metaKey)) { e.preventDefault(); endEdit(true); }
      }, true);
      d.addEventListener("focusout", (e) => { if (editing.current && e.target === editing.current.el) endEdit(true); }, true);
      d.addEventListener("submit", (e) => e.preventDefault(), true);
      if (d.body) { const ro = new ResizeObserver(() => measure()); ro.observe(d.body); }
    }
    draw();
    // a page of the shop: where its changes landed, section by section (the outline's parts on the left)
    if (sel.current?.onMap && sel.current.mode === "element") { try { sel.current.onMap(mapOf(d)); } catch { /* the outline stays without */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, measure]);

  // the brand's type, inside the page
  useEffect(() => {
    const d = docOf();
    if (!d?.head || !font || d.getElementById("apx-font")) return;
    const st = d.createElement("style");
    st.id = "apx-font";
    st.textContent = font;
    d.head.appendChild(st);
  }, [font, loaded]);

  // the page is ready to work on once its own document (about:srcdoc) is parsed - a big shop page keeps loading its
  // pictures long after that, so "load" alone comes late (or, a picture hanging, never)
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // the page before this one stays until the new one replaces it: wait for the new one
    const prev = docOf() as (Document & { __apx?: boolean }) | null;
    const tick = (n: number) => {
      if (stop) return;
      const d = docOf() as (Document & { __apx?: boolean }) | null;
      if (d && (d !== prev || !d.__apx) && d.URL === "about:srcdoc" && d.readyState !== "loading" && d.body) {
        if (!d.__apx) { setup(); setLoaded((x) => x + 1); }
        if (d.readyState === "complete") { measure(); return; }
      }
      if (n < 400) timer = setTimeout(() => tick(n + 1), 120);
    };
    tick(0);
    const f = frame.current;
    const on = () => { setup(); setLoaded((x) => x + 1); measure(); };
    f?.addEventListener("load", on);
    return () => { stop = true; if (timer) clearTimeout(timer); f?.removeEventListener("load", on); };
  }, [shown, setup, measure]);

  useEffect(() => { draw(); }, [patch, draw]);
  useEffect(() => { markSelected(); }, [select?.selected, markSelected, device, avail]);
  useEffect(() => {
    if (!select?.editNonce) return;
    const d = docOf();
    const el = d ? findSelected(d, select.selected) : null;
    if (el) {
      startEdit(el);
      const r = d!.createRange(); r.selectNodeContents(el);
      const s = d!.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.editNonce]);

  const zoom = fit ? Math.min(1, (Math.min(avail, maxWidth ?? avail) - 8) / w) : 1;
  const mobile = device === "mobile";
  const border = mobile ? 8 : 1;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const borderRef = useRef(border);
  borderRef.current = border;

  /** the stage scrolled to an element of the page, smoothly - unless it is in view already */
  const revealEl = (el: Element | null) => {
    const dev = deviceBox.current;
    const host = box.current?.closest("[data-stage-scroll]") as HTMLElement | null;
    if (!el || !dev || !host) return;
    const r = el.getBoundingClientRect();
    const devTop = dev.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop;
    const top = devTop + borderRef.current + r.top * zoomRef.current;
    // already in view: no jump
    if (top >= host.scrollTop + 48 && top + Math.min(r.height * zoomRef.current, 160) <= host.scrollTop + host.clientHeight - 24) return;
    host.scrollTo({ top: Math.max(0, top - 64), behavior: "smooth" });
  };
  // a part opened in the outline: the stage scrolls to it (SARCLA 08.11.2026: "more fluid")
  useEffect(() => {
    if (!select?.reveal) return;
    const t = setTimeout(() => { const d = docOf(); revealEl(d ? findSelected(d, sel.current?.selected ?? null) : null); }, 90);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.reveal]);
  // a section of a page of the shop opened in the outline: found by its heading, selected, scrolled to (once per ask)
  const sought = useRef(0);
  useEffect(() => {
    const sk = select?.seek;
    if (!sk?.nonce || sought.current === sk.nonce) return;
    const d = docOf();
    const el = d?.body ? sectionBlock(d, sk.heading) : null;
    if (!el) return;
    sought.current = sk.nonce;
    sel.current?.onPick(pickedOf(el));
    setTimeout(() => revealEl(el), 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.seek?.nonce, loaded]);
  const dev = deviceBox.current;
  const tbLeft = dev && selRect ? dev.offsetLeft + border + selRect.x * zoom : 0;
  const tbTopRaw = dev && selRect ? dev.offsetTop + border + selRect.y * zoom - 44 : 0;
  const tbTop = selRect && tbTopRaw < 0 && dev ? dev.offsetTop + border + (selRect.y + selRect.h) * zoom + 8 : tbTopRaw;
  return (
    <Box ref={box} sx={{ position: "relative", width: "100%", minWidth: 0, overflowX: fit ? "visible" : "auto", pb: fit ? 0 : 1 }}>
      <Box ref={deviceBox} sx={{
        mx: "auto", position: "relative",
        width: w * zoom + border * 2, height: height * zoom + border * 2, flexShrink: 0, borderRadius: mobile ? "26px" : "10px", overflow: "hidden",
        boxShadow: "0 18px 50px rgba(31,45,78,.18)", border: mobile ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: "#fff", boxSizing: "border-box",
      }}>
        <iframe ref={frame} title={title} srcDoc={hubAbsolute(shown)} sandbox="allow-same-origin"
          style={{ width: w, height, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background: "#fff" }} />
      </Box>
      {toolbar && selRect && select?.selected && (
        <Box sx={{ position: "absolute", left: Math.max(0, fit ? Math.min(tbLeft, (box.current?.clientWidth ?? 800) - 340) : tbLeft), top: Math.max(0, tbTop), zIndex: 3 }}>{toolbar}</Box>
      )}
    </Box>
  );
}
