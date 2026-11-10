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
import { lookOf, type Look } from "@/lib/content/studio/kinds/page/readable";
import { headKey, sectionLevels, type Located } from "@/lib/content/studio/kinds/page/shopParts";
import type { FoundBlock } from "@/lib/content/studio/kinds/page/blocklist";
import { drawPending, flashEl, shownWhy, stepElement, type Flash, type Pending } from "./plan/overlay";
import { ResizeLayer, type ResizeSpec } from "./Resize";

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
  /** how it looks on the page now - its ground, text colour, font, width (Content v6: what the AI is told) */
  look?: Look;
  /** a word or a line selected (inline): the block it stands in - what a replace takes the place of */
  box?: { selector: string; outer: string; tag: string; look: Look } | null;
  /** Content v8: a page of the shop - the content block it is in (the Build list's row): its selector, or the change
   * that put it there */
  inBlock?: { selector: string; change: number | null; changeId?: string } | null;
};

/** A place between two elements of a page of the shop, where the "+" adds one (Content v6, SARCLA point 9: "we should
 * really be able to add elements"): the element it goes before or after, the words around it, how it looks there, a
 * photo of the page near it, and where on the screen the "+" was. */
export type AddPlace = {
  selector: string; where: "before" | "after" | "prepend" | "append";
  /** "Between Top-Produkte and the footer" - for the person */
  label: string;
  /** the words around the place - for the AI */
  near: string;
  look: Look | null;
  img: { src: string; alt: string } | null;
  pos: { top: number; left: number };
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
  /** the "+" between two blocks of a new page (Content v5): the place in the order, and where on the screen it was */
  onAdd?: (at: number, pos: { top: number; left: number }) => void;
  /** "+ Tile" / "+ Question" / "+ Link" in a block with items */
  onAddItem?: (list: string) => void;
  /** a page of the shop: the "+" between its elements (Content v6) */
  onAddEl?: (place: AddPlace) => void;
  /** a page of the shop: the changes whose replaced element is shown again instead of their block ("Show the old one") */
  oldShown?: number[];
  /** Content v7: the AI plan's steps drawn in the page at once (a skeleton while it fills) until the server's picture has
   * them (./plan/overlay.ts); one of them, or a change drawn by the server, scrolled to and lit; and whether it shows */
  pending?: Pending[];
  flash?: Flash | null;
  onShown?: (f: { key?: string; index?: number }, why: string) => void;
  /** Content v8 (SARCLA 10.11.2026, points 1-4): a page of the shop's content blocks as the frame finds them, top to
   * bottom - the Build pane's list of blocks */
  onBlocks?: (list: FoundBlock[]) => void;
  /** a row of the list clicked: its block found here ("p:<selector>", "c:<change index>", "mod:<change id>"), selected and
   * scrolled to (once per ask) */
  seekRow?: { nonce: number; key: string } | null;
  /** the block the selection is in, outlined quietly (its key as the page selects it) */
  selectedBlock?: string | null;
  /** a double-click started editing words in place (the text popup gives way) */
  onEditStart?: () => void;
  /** Content v10 (SARCLA point 5): what a drag resizes where the selection is - its handle drawn over the page */
  resize?: ResizeSpec | null;
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
[data-apx-selblock]:not([data-apx-sel]){outline:1px dashed rgba(194,44,110,.55)!important;outline-offset:-1px!important}
[data-apx-editing]{outline:2px solid #c22c6e!important;outline-offset:4px!important;cursor:text!important;background:rgba(194,44,110,.05)!important;-webkit-user-modify:read-write}
a,button,summary,label,[role=button],[data-apx-f],[data-apx-b]{pointer-events:auto!important}
mark[data-apx-left]{background:#ffe1dc!important;color:#b3261e!important;outline:2px solid #d80901;outline-offset:1px;border-radius:2px;padding:0 2px}
[data-apx-addel]{position:absolute;left:0;right:0;height:36px;margin-top:-18px;z-index:2147483000;pointer-events:auto!important;cursor:pointer}
[data-apx-addel]::after{content:"";position:absolute;left:24px;right:24px;top:17px;height:2px;background:#c22c6e;opacity:0;transition:opacity .15s}
[data-apx-addel]>b{position:absolute;left:50%;top:1px;width:34px;height:34px;margin-left:-17px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:#c22c6e;color:#fff;font:600 26px/1 system-ui,"Segoe UI",sans-serif;box-shadow:0 6px 16px rgba(194,44,110,.35);opacity:0;transform:scale(.85);transition:opacity .15s,transform .15s;z-index:1}
[data-apx-addel]>i{position:absolute;left:50%;top:6px;margin-left:24px;padding:4px 9px;border-radius:5px;background:#15223a;color:#fff;font:600 13px/1.2 system-ui,"Segoe UI",sans-serif;font-style:normal;white-space:nowrap;opacity:0;transition:opacity .15s;z-index:2;box-shadow:0 0 0 3px #fff}
[data-apx-addel]:hover::after,[data-apx-addel]:hover>b,[data-apx-addel]:hover>i{opacity:1;transform:none}`;

/* ── a page of the shop: its elements, and the places between them (Content v6) ─────────────────────── */

const SKIP_TAGS = /^(SCRIPT|STYLE|LINK|INPUT|TEMPLATE|NOSCRIPT|META|BR)$/;
/** The page's content blocks, as a person sees them: the CMS content's rows (a wrapper holding one block is looked into). */
export function contentBlocks(d: Document): Element[] {
  const win = d.defaultView;
  if (!win) return [];
  const shown = (el: Element) => !SKIP_TAGS.test(el.tagName) && !el.hasAttribute("data-apx-hid") && win.getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height >= 24;
  let root: Element | null = d.querySelector("#maincontent .column.main") ?? d.getElementById("maincontent");
  if (!root) return [];
  let kids = Array.from(root.children).filter(shown);
  for (let n = 0; kids.length === 1 && n < 8; n++) { root = kids[0]; kids = Array.from(root.children).filter(shown); }
  return kids;
}
const isOurs = (el: Element) => el.hasAttribute("data-apx-c") || el.hasAttribute("data-apso-v");

/** The content blocks as the Build list shows them (Content v8): what shows, what a change hid (listed, "hidden"), and a
 * module drawn while it fills (the studio's <apx-pend>, looked into) - none of the studio's own marks. */
function listBlocks(d: Document): Element[] {
  const win = d.defaultView;
  if (!win) return [];
  const hiddenByChange = (el: Element) => el.hasAttribute("data-apx-x") && win.getComputedStyle(el).display === "none" && !el.hasAttribute("data-apx-hid");
  const shown = (el: Element) => {
    if (SKIP_TAGS.test(el.tagName) || el.hasAttribute("data-apx-addel") || el.hasAttribute("data-apx-hid")) return false;
    if (el.tagName === "APX-PEND") return !!el.firstElementChild;
    if (hiddenByChange(el)) return true;
    return win.getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height >= 24;
  };
  let root: Element | null = d.querySelector("#maincontent .column.main") ?? d.getElementById("maincontent");
  if (!root) return [];
  let kids = Array.from(root.children).filter(shown);
  for (let n = 0; kids.length === 1 && !isOurs(kids[0]) && kids[0].tagName !== "APX-PEND" && n < 8; n++) { root = kids[0]; kids = Array.from(root.children).filter(shown); }
  return kids;
}

const PB_SKIP = /^(row|column-group|column|column-line|text|html|heading|divider|buttons|button-item|slide|block)$/;
/** One block of the list, described for the Build pane (lib/content/studio/kinds/page/blocklist.ts shopRows). */
function foundOf(el: Element, win: Window & typeof globalThis): FoundBlock {
  const pend = el.tagName === "APX-PEND" ? (el.getAttribute("data-apx-pend") ?? "") : "";
  const top = pend ? el.firstElementChild ?? el : el;
  const change = top.hasAttribute("data-apx-c") ? Number(top.getAttribute("data-apx-c")) : null;
  const h = top.querySelector("h1,h2,h3,h4");
  const text = ((top as HTMLElement).innerText || top.textContent || "").replace(/\s+/g, " ").trim();
  const heading = h ? ((h as HTMLElement).innerText || h.textContent || "").replace(/\s+/g, " ").trim() : "";
  const pb = [top, ...top.querySelectorAll("[data-content-type]")].map((x) => x.getAttribute("data-content-type") ?? "").find((t) => t && !PB_SKIP.test(t)) ?? "";
  const touched = new Set<number>();
  for (const x of [top, ...top.querySelectorAll("[data-apx-x]")]) for (const n of (x.getAttribute("data-apx-x") ?? "").split(/\s+/)) if (n && Number.isInteger(Number(n))) touched.add(Number(n));
  const pictures = top.querySelectorAll("img:not(.pagebuilder-mobile-only)").length + top.querySelectorAll("[data-background-images]").length;
  return {
    selector: change !== null || pend ? "" : selectorOf(top), tag: top.tagName.toLowerCase(), heading: heading.slice(0, 120),
    text: (heading && text.startsWith(heading) ? text.slice(heading.length) : text).trim().slice(0, 160), pictures, pb,
    change: Number.isInteger(change) ? change : null, ...(pend.startsWith("mod:") ? { changeId: pend.slice(4) } : {}),
    touched: [...touched], hidden: win.getComputedStyle(top).display === "none",
  };
}
const shortText = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
const nameOf = (el: Element | null) => { if (!el) return ""; const h = el.querySelector("h1,h2,h3,h4"); const t = shortText(h ?? el); return t.length > 40 ? `${t.slice(0, 38)}…` : t; };
/** A photo of the page near a place (the shop's own, a real size) - for a "Text and picture" block. */
function photoNear(els: (Element | null)[]): { src: string; alt: string } | null {
  for (const el of els) {
    for (const img of Array.from(el?.querySelectorAll("img") ?? []) as HTMLImageElement[]) {
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (/^https:\/\/(www|acc)\.apsoparts\.com\/media\//.test(src) && !/\.svg(\?|$)/i.test(src)) return { src, alt: img.alt || nameOf(el) };
    }
  }
  // a Page Builder tile shows its photo as a background (data-background-images)
  for (const el of els) {
    for (const b of Array.from(el?.querySelectorAll("[data-background-images]") ?? [])) {
      try {
        const src = String((JSON.parse(b.getAttribute("data-background-images") ?? "{}") as { desktop_image?: string }).desktop_image ?? "").replace(/\\\//g, "/");
        if (/^https:\/\/(www|acc)\.apsoparts\.com\/media\//.test(src)) return { src, alt: nameOf(b) || nameOf(el) };
      } catch { /* not JSON */ }
    }
  }
  return null;
}

// the shop's body face (Open Sans) cannot come in from the shop either: the computer's own sans-serif stands in, never Times
// (one regular face each: the browser draws the bold itself - a face said to be bold would draw thin)
const SHOP_FONT_STANDINS = ["Open Sans", "futura-pt"].map((f) => `@font-face{font-family:"${f}";src:local("Segoe UI"),local("Helvetica Neue"),local("Arial")}`).join("\n");

let fontHeld: Promise<string> | null = null;
/** The brand's type (futura-pt's look-alike, as data: - the hub lets no font in from outside), once per window. */
export function brandFont(): Promise<string> {
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
const TEXTISH = /^(H[1-6]|P|A|SPAN|LI|BUTTON|SUMMARY|SMALL|STRONG|B|EM|I|LABEL|FIGCAPTION|DT|DD|TD|TH|BLOCKQUOTE)$/;

/** The text a click inside a module hit: the nearest element of words (a heading, a paragraph, a button) under `root` -
 * its bold or small words widened to the line they stand in; null on a picture or the module's ground. */
function textIn(el: Element, root: Element): Element | null {
  let cur: Element | null = el;
  while (cur && cur !== root && SVG.has(cur.tagName.toLowerCase())) cur = cur.parentElement;
  while (cur && cur !== root && INLINE.has(cur.tagName) && cur.parentElement && cur.parentElement !== root && TEXTISH.test(cur.parentElement.tagName)) cur = cur.parentElement;
  for (; cur && cur !== root; cur = cur.parentElement) {
    if (cur.querySelector("img,picture,video")) return null;
    if (TEXTISH.test(cur.tagName) && ((cur as HTMLElement).innerText ?? cur.textContent ?? "").trim()) return cur;
  }
  return null;
}

/** A selector the page's own elements are found by - ids first, then classes, then their place (as APSOconvert's). */
export function selectorOf(el: Element): string {
  const doc = el.ownerDocument;
  const okId = (id: string) => /^[A-Za-z][\w-]*$/.test(id) && !/^(ui-id-|ko_|apx-)/.test(id);
  if (el.id && okId(el.id)) return `#${el.id}`;
  const path: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  // a Page Builder element's own style key (one per element) does not move when a block is put before it (Content v7,
  // point 4: a place by position alone pointed elsewhere once another change stood before it)
  const pbKey = (x: Element) => { const k = x.getAttribute("data-pb-style"); if (!k || !/^[A-Z0-9]{4,12}$/i.test(k)) return null; const sel = `${x.tagName.toLowerCase()}[data-pb-style="${k}"]`; try { return doc.querySelectorAll(sel).length === 1 ? sel : null; } catch { return null; } };
  while (cur && cur !== doc.body && cur !== doc.documentElement && depth < 6) {
    if (cur.id && okId(cur.id)) { path.unshift(`#${cur.id}`); break; }
    const pb = pbKey(cur);
    if (pb) { path.unshift(pb); break; }
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

export function Frame({ html, device, title, maxWidth, select, patch, toolbar, fit = true, popup }: {
  html: string; device: Device; title: string; maxWidth?: number;
  /** false = the page at its real size (100%), scrolled sideways; true = zoomed to fit the space */
  fit?: boolean;
  select?: SelectOpts;
  /** a new page's HTML, drawn into #apx-root without reloading */
  patch?: string;
  /** shown over the selected element */
  toolbar?: React.ReactNode;
  /** Content v8: a popup at the selection - a text's or a picture's editor under it ("below"), a block's settings at its
   * top right ("side"); with nothing selected in the page, at the page's top right */
  popup?: { node: React.ReactNode; at: "below" | "side"; width?: number; id?: string } | null;
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
    if (sel.current?.mode === "field") {
      // a new page's module (Content v8, point 4): a click on one of its texts selects that text, elsewhere the module
      const mod = el.closest("[data-apx-mod]");
      if (mod) return textIn(el, mod) ?? mod;
      return el.closest("[data-apx-f]") ?? el.closest("[data-apx-insert]") ?? el.closest("[data-apx-b]");
    }
    const ins = el.closest("[data-apx-insert]");
    if (ins) return ins;
    while (el && SVG.has(el.tagName.toLowerCase()) && el.parentElement) el = el.parentElement;
    while (el && INLINE.has(el.tagName) && el.parentElement) el = el.parentElement;
    if (!el || el === el.ownerDocument.body || el === el.ownerDocument.documentElement || el.id === "maincontent") return null;
    return el;
  };

  const pickedOf = (el: Element): Picked => {
    // a text inside a new page's module: "nt:<module id>:<the way down to it>"
    const inMod = sel.current?.mode === "field" && !el.hasAttribute("data-apx-mod") ? el.closest("[data-apx-mod]") : null;
    if (inMod) {
      const text = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/ /g, " ").trim();
      const clean = cleanCopy(el);
      return {
        key: `nt:${inMod.getAttribute("data-apx-mod")}:${pathFrom(inMod, el).join(".")}`, selector: "", tag: el.tagName.toLowerCase(), text: text.slice(0, 4000),
        inner: clean.innerHTML.slice(0, 20_000), outer: clean.outerHTML.slice(0, 20_000), frag: null, host: null, editable: !!text && !el.querySelector("img,video,iframe,table"),
        href: el.closest("a")?.getAttribute("href") ?? undefined,
        // Content v10: the ground it stands on, for the text popup's colours
        ...(() => { try { const win = el.ownerDocument.defaultView as (Window & typeof globalThis) | null; return win ? { look: lookOf(el, win) } : {}; } catch { return {}; } })(),
      };
    }
    const f = el.getAttribute("data-apx-f");
    const b = el.getAttribute("data-apx-b");
    const ins = el.getAttribute("data-apx-insert");
    const mod = el.getAttribute("data-apx-mod");
    const selector = f || b || ins || mod ? "" : selectorOf(el);
    const key = f ? `f:${f}` : ins ? `i:${ins}` : mod ? `np:${mod}` : b ? `b:${b}` : `e:${selector}`;
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
      ...(sel.current?.mode === "element" && !ins ? lookAndBox(el) : {}),
      inBlock: sel.current?.mode === "element" && !ins ? blockAround(el) : null,
    };
  };

  /** a page of the shop: the content block an element is in - the row of the Build list it belongs to */
  const blockAround = (el: Element): Picked["inBlock"] => {
    const blocks = listBlocks(el.ownerDocument);
    const b = blocks.find((x) => x === el || x.contains(el));
    if (!b) return null;
    const top = b.tagName === "APX-PEND" ? b.firstElementChild ?? b : b;
    const pend = b.getAttribute("data-apx-pend") ?? "";
    const c = top.hasAttribute("data-apx-c") ? Number(top.getAttribute("data-apx-c")) : null;
    return { selector: c !== null || pend ? "" : selectorOf(top), change: c !== null && Number.isInteger(c) ? c : null, ...(pend.startsWith("mod:") ? { changeId: pend.slice(4) } : {}) };
  };

  /** an element of a page of the shop: how it looks, and - a word or a line - the block it stands in (what a replace
   * takes the place of: never a <div> inside a heading) */
  const lookAndBox = (el: Element): Pick<Picked, "look" | "box"> => {
    const win = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    if (!win) return {};
    try {
      const look = lookOf(el, win);
      let b: Element = el;
      const inline = (x: Element) => /^inline/.test(win.getComputedStyle(x).display) || /^(SPAN|A|B|STRONG|EM|I|SMALL|LABEL)$/.test(x.tagName);
      while (b.parentElement && b.parentElement !== el.ownerDocument.body && b.parentElement.id !== "maincontent"
        && (inline(b) || /^(H[1-6]|P|LI|DT|DD|FIGCAPTION|BUTTON|TD|TH)$/.test(b.parentElement.tagName) || /^(LI|TD|TH|DT|DD)$/.test(b.tagName))) b = b.parentElement;
      if (b === el) return { look, box: null };
      return { look, box: { selector: selectorOf(b), outer: cleanCopy(b).outerHTML.slice(0, 20_000), tag: b.tagName.toLowerCase(), look: lookOf(b, win) } };
    } catch { return {}; }
  };

  /** the "+" between the page's elements (a page of the shop, Content v6): drawn over the page, at each place */
  const drawAdds = (d: Document) => {
    d.querySelectorAll("[data-apx-addel]").forEach((x) => x.remove());
    const s = sel.current;
    if (!s?.onAddEl || s.mode !== "element" || editing.current || !d.body) return;
    const blocks = contentBlocks(d);
    if (!blocks.length) return;
    const sy = d.documentElement.scrollTop || d.body.scrollTop || 0;
    const top = (el: Element) => el.getBoundingClientRect().top + sy;
    const bottom = (el: Element) => el.getBoundingClientRect().bottom + sy;
    if (d.defaultView?.getComputedStyle(d.body).position === "static") d.body.style.position = "relative";
    const bodyTop = d.body.getBoundingClientRect().top + sy;
    for (let k = 0; k <= blocks.length; k++) {
      const prev = blocks[k - 1] ?? null, next = blocks[k] ?? null;
      const y = prev && next ? (bottom(prev) + top(next)) / 2 : prev ? bottom(prev) + 8 : top(next!) - 8;
      const plus = d.createElement("div");
      plus.setAttribute("data-apx-addel", String(k));
      plus.style.top = `${Math.round(y - bodyTop)}px`;
      plus.innerHTML = "<b>+</b><i>Add an element here</i>";
      (plus as HTMLElement & { __apx?: { prev: Element | null; next: Element | null } }).__apx = { prev, next };
      d.body.appendChild(plus);
    }
  };
  /** the place a "+" stands for, as a change can aim at it: before the next element of the page, else after the one before */
  const placeOf = (plus: Element): Omit<AddPlace, "pos"> | null => {
    const at = (plus as Element & { __apx?: { prev: Element | null; next: Element | null } }).__apx;
    if (!at) return null;
    const blocks = contentBlocks(plus.ownerDocument);
    const i = at.next ? blocks.indexOf(at.next) : blocks.length;
    const realAfter = blocks.slice(Math.max(0, i)).find((x) => !isOurs(x)) ?? null;
    const realBefore = [...blocks.slice(0, Math.max(0, i))].reverse().find((x) => !isOurs(x)) ?? null;
    // the next element of the page when it is the page's own; else the one before; else the nearest of the page's own
    const nextIsReal = !!at.next && !isOurs(at.next);
    const prevIsReal = !!at.prev && !isOurs(at.prev);
    const anchor = nextIsReal ? at.next! : prevIsReal ? at.prev! : realAfter ?? realBefore;
    if (!anchor) return null;
    const where: AddPlace["where"] = nextIsReal || (!prevIsReal && anchor === realAfter) ? "before" : "after";
    const win = plus.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const label = at.prev && at.next ? `Between “${nameOf(at.prev)}” and “${nameOf(at.next)}”` : at.prev ? `After “${nameOf(at.prev)}”` : `Before “${nameOf(at.next)}”`;
    return {
      selector: selectorOf(anchor), where, label,
      near: [at.prev ? `before it: ${shortText(at.prev)}` : "", at.next ? `after it: ${shortText(at.next)}` : ""].filter(Boolean).join(" | "),
      look: win && anchor.parentElement ? lookOf(anchor.parentElement, win) : null,
      img: photoNear([at.prev, at.next]),
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
      if (key.startsWith("np:")) return d.querySelector(`[data-apx-mod="${CSS.escape(key.slice(3))}"]`);
      if (key.startsWith("nt:")) {
        const [, id, way = ""] = key.split(":");
        let cur: Element | null = d.querySelector(`[data-apx-mod="${CSS.escape(id)}"]`);
        for (const i of way.split(".").filter(Boolean).map(Number)) cur = cur?.children[i] ?? null;
        return cur;
      }
      return v ? d.querySelector(v) : null;
    } catch { return null; }
  };

  const markSelected = useCallback(() => {
    const d = docOf();
    if (!d?.body) return;
    d.querySelectorAll("[data-apx-sel]").forEach((x) => x.removeAttribute("data-apx-sel"));
    d.querySelectorAll("[data-apx-selblock]").forEach((x) => x.removeAttribute("data-apx-selblock"));
    const blockKey = sel.current?.selectedBlock ?? null;
    if (blockKey && blockKey !== sel.current?.selected) { const be = findSelected(d, blockKey); be?.setAttribute("data-apx-selblock", ""); }
    const el = findSelected(d, sel.current?.selected ?? null);
    // Content v10 (point 4): questions all closed - the one selected opens, as a click opens it on the shop
    d.querySelectorAll("details[data-apx-opened]").forEach((x) => { if (!el || !x.contains(el)) { x.removeAttribute("open"); x.removeAttribute("data-apx-opened"); } });
    const det = el?.closest("details");
    if (det && !det.hasAttribute("open")) { det.setAttribute("open", ""); det.setAttribute("data-apx-opened", ""); }
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
    paintPending(d);
    showOld(d);
    markSelected();
    measure();
    drawAdds(d);
    reportBlocks(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSelected, measure]);

  /** the content blocks for the Build list (Content v8), told when they change */
  const blocksSent = useRef("");
  const reportBlocks = (d: Document) => {
    const s = sel.current;
    if (!s?.onBlocks || s.mode !== "element" || editing.current) return;
    const win = d.defaultView as (Window & typeof globalThis) | null;
    if (!win) return;
    try {
      const list = listBlocks(d).map((el) => foundOf(el, win));
      const sig = JSON.stringify(list);
      if (sig === blocksSent.current) return;
      blocksSent.current = sig;
      s.onBlocks(list);
    } catch { /* the list stays as it was */ }
  };

  /** the plan's steps in the page (Content v7): a place not found is said */
  const paintPending = (d: Document) => {
    const s = sel.current;
    if (!s || s.mode !== "element") return;
    for (const key of drawPending(d, s.pending ?? [])) s.onShown?.({ key }, "It is not in the page - its place was not found on the page as it is now.");
  };

  /** "Show the old one" (Content v6): a replace's hidden element shown again, its block hidden - in the preview only */
  const showOld = (d: Document) => {
    const on = new Set(sel.current?.oldShown ?? []);
    d.querySelectorAll<HTMLElement>("[data-apx-hid]").forEach((el) => {
      const ids = (el.getAttribute("data-apx-hid") ?? "").split(/\s+/).map(Number);
      if (ids.some((n) => on.has(n))) { if (!el.hasAttribute("data-apx-shown")) { el.setAttribute("data-apx-shown", ""); el.style.removeProperty("display"); } }
      else if (el.hasAttribute("data-apx-shown")) { el.removeAttribute("data-apx-shown"); el.style.setProperty("display", "none", "important"); }
    });
    d.querySelectorAll<HTMLElement>("[data-apx-c]").forEach((el) => {
      if (el.tagName === "STYLE") return;
      if (on.has(Number(el.getAttribute("data-apx-c")))) { el.setAttribute("data-apx-off", ""); el.style.setProperty("display", "none", "important"); }
      else if (el.hasAttribute("data-apx-off")) { el.removeAttribute("data-apx-off"); el.style.removeProperty("display"); }
    });
  };

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
        if ((e.target as Element).closest?.("[data-apx-addel]")) { unhov(); return; }
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
        // the studio's "+": a block added there, or an item to a block (Content v5) - nothing selected by the click
        const plus = (e.target as Element).closest?.("[data-apx-add]");
        if (plus && s.onAdd) {
          const r = plus.getBoundingClientRect();
          const fr = frame.current?.getBoundingClientRect();
          const z = zoomRef.current;
          unhov();
          s.onAdd(Number(plus.getAttribute("data-apx-add")) || 1, { top: (fr?.top ?? 0) + r.top * z + 18, left: (fr?.left ?? 0) + (r.left + r.width / 2) * z });
          return;
        }
        // the "+" between a shop page's elements (Content v6): what goes there is asked, nothing selected by the click
        const addEl = (e.target as Element).closest?.("[data-apx-addel]");
        if (addEl && s.onAddEl) {
          const place = placeOf(addEl);
          const r = addEl.getBoundingClientRect();
          const fr = frame.current?.getBoundingClientRect();
          const z = zoomRef.current;
          unhov();
          if (place) s.onAddEl({ ...place, pos: { top: (fr?.top ?? 0) + (r.top + r.height / 2) * z + 18, left: (fr?.left ?? 0) + (r.left + r.width / 2) * z } });
          return;
        }
        const more = (e.target as Element).closest?.("[data-apx-additem]");
        if (more && s.onAddItem) { unhov(); s.onAddItem(more.getAttribute("data-apx-additem") ?? ""); return; }
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
        if (editing.current) s.onEditStart?.();
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
      if (d.body) {
        let t: ReturnType<typeof setTimeout> | null = null;
        const ro = new ResizeObserver(() => { measure(); if (t) clearTimeout(t); t = setTimeout(() => drawAdds(d), 160); });
        ro.observe(d.body);
      }
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
  // "Show the old one" switched, the "+" offered or not: the page itself does not reload
  const pendKey = JSON.stringify((select?.pending ?? []).map((p) => [p.key, p.selector, p.where, p.change ?? -1, p.html.length, p.html.slice(-80)]));
  useEffect(() => {
    const d = docOf();
    if (!d?.body) return;
    paintPending(d); measure(); drawAdds(d); reportBlocks(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendKey, loaded]);
  // a step applied: scrolled to and lit - and if it does not show, said (once per ask, once its page is in the frame)
  const flashed = useRef(0);
  useEffect(() => {
    const f = select?.flash;
    if (!f?.nonce || flashed.current === f.nonce) return;
    const d = docOf();
    if (!d?.body) return;
    const el = stepElement(d, f);
    if (!el && f.key === undefined) return;
    flashed.current = f.nonce;
    const why = shownWhy(el);
    if (el && !why) setTimeout(() => { revealEl(el); flashEl(el); }, 60);
    sel.current?.onShown?.({ key: f.key, index: f.index }, why);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.flash?.nonce, loaded, pendKey]);
  const oldKey = (select?.oldShown ?? []).join(",");
  const addsOn = !!select?.onAddEl;
  useEffect(() => {
    const d = docOf();
    if (d?.body) { showOld(d); drawAdds(d); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldKey, addsOn]);
  useEffect(() => { markSelected(); }, [select?.selected, select?.selectedBlock, markSelected, device, avail]);
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
  // a row of the Build list clicked (Content v8): its block found, selected, scrolled to (once per ask)
  const soughtRow = useRef(0);
  useEffect(() => {
    const sk = select?.seekRow;
    if (!sk?.nonce || soughtRow.current === sk.nonce) return;
    const d = docOf();
    if (!d?.body) return;
    const k = sk.key;
    let el: Element | null = null;
    try {
      if (k.startsWith("p:")) el = Array.from(d.querySelectorAll(k.slice(2))).find((x) => !x.closest("[data-apso-v],[data-apx-pend]")) ?? null;
      else if (k.startsWith("c:")) el = Array.from(d.querySelectorAll(`[data-apx-c="${CSS.escape(k.slice(2))}"]`)).find((x) => x.tagName !== "STYLE") ?? null;
      else if (k.startsWith("mod:")) el = d.querySelector(`[data-apx-pend="${CSS.escape(k)}"]`)?.firstElementChild ?? null;
    } catch { el = null; }
    if (!el) return;
    soughtRow.current = sk.nonce;
    sel.current?.onPick(pickedOf(el));
    setTimeout(() => revealEl(el), 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.seekRow?.nonce, loaded]);

  // a popup opened: the stage scrolls so that it is in view, whole when it fits (Content v8)
  const popBox = useRef<HTMLDivElement | null>(null);
  const popId = popup ? popup.id ?? "pop" : "";
  useEffect(() => {
    if (!popId) return;
    const t = setTimeout(() => {
      const el = popBox.current;
      const host = box.current?.closest("[data-stage-scroll]") as HTMLElement | null;
      if (!el || !host) return;
      const r = el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      const tb = 52;
      if (r.bottom > h.bottom - 12) host.scrollBy({ top: Math.min(r.bottom - h.bottom + 16, r.top - h.top - tb), behavior: "smooth" });
      else if (r.top < h.top + 8) host.scrollBy({ top: r.top - h.top - tb, behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popId]);

  // the bar over the selection stays inside the stage, whatever it holds (a picture's four actions are wider)
  const tbBox = useRef<HTMLDivElement | null>(null);
  const [tbW, setTbW] = useState(340);
  useEffect(() => {
    const el = tbBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTbW(el.offsetWidth || 340));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!toolbar, !!selRect]);
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
      {select?.resize && selRect && select.selected && !mobile && dev && (
        <ResizeLayer spec={select.resize} doc={docOf()} frame={frame.current} zoom={zoom} origin={{ left: dev.offsetLeft + border, top: dev.offsetTop + border }}
          tick={`${selRect.x},${selRect.y},${selRect.w},${selRect.h},${height},${loaded},${avail}`} />
      )}
      {toolbar && selRect && select?.selected && (
        <Box ref={tbBox} sx={{ position: "absolute", left: Math.max(0, fit ? Math.min(tbLeft, (box.current?.clientWidth ?? 800) - tbW - 4) : tbLeft), top: Math.max(0, tbTop), zIndex: 3, whiteSpace: "nowrap" }}>{toolbar}</Box>
      )}
      {popup && (() => {
        const pw = popup.width ?? 380;
        const avail = box.current?.clientWidth ?? 800;
        const devLeft = dev ? dev.offsetLeft + border : 0;
        const devTop = dev ? dev.offsetTop + border : 0;
        let left: number;
        let top: number;
        if (selRect && select?.selected) {
          if (popup.at === "below") { left = devLeft + selRect.x * zoom; top = devTop + (selRect.y + selRect.h) * zoom + 10; }
          else { left = devLeft + (selRect.x + selRect.w) * zoom - pw - 12; top = devTop + selRect.y * zoom + 12; }
        } else { left = devLeft + w * zoom - pw - 12; top = devTop + 12; }
        left = Math.max(4, Math.min(left, avail - pw - 4));
        return <Box ref={popBox} data-apx-popup sx={{ position: "absolute", left, top: Math.max(0, top), width: pw, maxWidth: "calc(100% - 8px)", zIndex: 4 }}>{popup.node}</Box>;
      })()}
    </Box>
  );
}
