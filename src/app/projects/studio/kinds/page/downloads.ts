"use client";
// WHAT A PAGE GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be able to
// download"). Per store view the page has, its HTML for Magento, paste-ready: the content the last step's hand-over holds
// (the `paste` read - one HTML Code element for a new page or a CMS page; a product or category page is the theme's code,
// so its list for the developers). And the page as the middle shows it, as a PNG, drawn in the browser from the preview
// frame (html2canvas reads the laid-out page, so the shop's own stylesheets count); the shop's pictures come through the
// hub (a canvas refuses a picture of another site), and the studio's marks (the selection outline, the "+") are left out.

import { pageDoc, viewName, viewShort, viewsOf } from "@/lib/content/studio/kinds/page/model";
import type { PasteOut } from "@/lib/content/studio/kinds/page/shop";
import { fileStem, pause, saveFile, type DownloadItem, type DownloadsOf } from "../../frame";
import type { StudioApi } from "../../useStudio";

const slug = (v: string) => v.replace("/", "-").toLowerCase();

/** One store view's HTML for Magento, saved; what to say when it is not (or not only) the HTML. */
async function htmlOf(api: StudioApi, view: string, stem: string): Promise<string | null> {
  const r = await api.act<PasteOut>("paste", { lang: view });
  if (!r.ok) return r.error;
  if (!r.result.ok) return `${view}: ${r.result.error}`;
  const blocks = r.result.blocks;
  const content = blocks.find((b) => b.key === "content");
  const fields = blocks.find((b) => b.key === "fields" || b.key === "seo");
  if (content) {
    // the fields a new page's form takes (title, URL key, meta) ride along as a comment on top - one file to paste from
    const head = fields ? `<!-- ${viewName(view)}\n${fields.code.replace(/--/g, "- -")}\n-->\n` : `<!-- ${viewName(view)} -->\n`;
    saveFile(head + content.code, `${stem}-${slug(view)}.html`);
    return r.result.warnings.length ? `${view} saved - before it goes live: ${r.result.warnings[0]}` : null;
  }
  const spec = blocks.find((b) => b.key === "spec");
  if (spec) {
    saveFile(spec.code, `${stem}-${slug(view)}-for-developers.txt`, "text/plain;charset=utf-8");
    return `${view}: a product or category page is the theme's code - saved its list of changes for the developers.`;
  }
  if (fields) { saveFile(fields.code, `${stem}-${slug(view)}-search-fields.txt`, "text/plain;charset=utf-8"); return `${view}: only its search engine fields change - saved them.`; }
  return `${view}: nothing to hand over yet.`;
}

/* ── the page as a picture ───────────────────────────────────────────────────────────────────────────────────────── */

const FRAMES = ['iframe[title="The page with its changes"]', 'iframe[title="The new page"]', 'iframe[title="The page as it is"]'];

const asData = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(b); });
const seen = new Map<string, Promise<string | null>>();
/** A shop picture through the hub (the shop sends no CORS), as data: - null when it does not come. `base`: the page's own
 * address (the preview's <base> is the shop's page), so "/media/..." is the shop's picture, not the hub's. */
function viaHub(url: string, base: string): Promise<string | null> {
  let p = seen.get(`${base}|${url}`);
  if (!p) {
    p = (async () => {
      try {
        const u = new URL(url, base);
        const own = u.origin === location.origin;
        if (!own && !/(^|\.)apsoparts\.com$/i.test(u.hostname)) return null;
        const r = await fetch(own ? u.toString() : `/api/content/studio/banner/picture?u=${encodeURIComponent(u.toString())}`);
        return r.ok ? await asData(await r.blob()) : null;
      } catch { return null; }
    })();
    seen.set(`${base}|${url}`, p);
  }
  return p;
}
const URL_IN_CSS = /url\(["']?(https?:[^"')]+)["']?\)/g;

/** An SVG picture given the size it is shown at (an SVG without its own size is drawn cut, or not at all): its root gets
 * that width and height, and a viewBox from the size it had, so it scales into it. */
function sizedSvg(data: string, w: number, h: number): string {
  if (!w || !h) return data;
  try {
    const comma = data.indexOf(",");
    const head = data.slice(0, comma);
    const body = data.slice(comma + 1);
    const text = /;base64/i.test(head) ? new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0))) : decodeURIComponent(body);
    const fixed = text.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
      const num = (k: string) => Number((new RegExp(`\\b${k}=["']?([\\d.]+)`, "i").exec(attrs) ?? [])[1]);
      const vb = /\bviewBox=/i.test(attrs) ? "" : Number.isFinite(num("width")) && Number.isFinite(num("height")) ? ` viewBox="0 0 ${num("width")} ${num("height")}"` : "";
      return `<svg${attrs.replace(/\s(width|height)=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")} width="${w}" height="${h}"${vb}>`;
    });
    return `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(fixed)))}`;
  } catch { return data; }
}

/** The clone html2canvas draws from, made fit to be drawn: no studio marks, the shop's pictures as data:. */
async function prepare(doc: Document, base: string) {
  doc.querySelectorAll("[data-apx-addel]").forEach((el) => el.remove());
  doc.querySelectorAll("[data-apx-sel],[data-apx-hover],[data-apx-editing]").forEach((el) => { el.removeAttribute("data-apx-sel"); el.removeAttribute("data-apx-hover"); el.removeAttribute("data-apx-editing"); });
  doc.querySelectorAll("mark[data-apx-left]").forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
  const imgs = Array.from(doc.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute("data-src") || img.getAttribute("data-original") || img.currentSrc || img.getAttribute("src") || "";
    img.removeAttribute("srcset"); img.removeAttribute("loading");
    if (!src || src.startsWith("data:")) return;
    const d = await viaHub(src, base);
    if (!d) { img.style.visibility = "hidden"; return; }
    img.setAttribute("src", d.startsWith("data:image/svg") ? sizedSvg(d, img.clientWidth, img.clientHeight) : d);
  }));
  // background pictures written on the elements themselves (the shop's banners, our blocks)
  const win = doc.defaultView;
  const els = Array.from(doc.querySelectorAll<HTMLElement>("body *")).slice(0, 4000);
  await Promise.all(els.map(async (el) => {
    const bg = win?.getComputedStyle(el).backgroundImage ?? "";
    if (!bg || bg === "none" || !/url\(/.test(bg)) return;
    const urls = [...bg.matchAll(URL_IN_CSS)].map((m) => m[1]);
    if (!urls.length) return;
    let next = bg;
    for (const u of urls) { const d = await viaHub(u, base); next = next.replace(u, d ?? ""); }
    el.style.backgroundImage = next;
  }));
}

/** The page as the middle shows it now, as a PNG. */
async function pagePng(stem: string): Promise<string | null> {
  const frame = FRAMES.map((q) => document.querySelector<HTMLIFrameElement>(q)).find((f) => f?.contentDocument?.body);
  const doc = frame?.contentDocument;
  if (!frame || !doc?.body) return "Open the page in the middle first - the picture is made from it.";
  const width = Math.round(parseFloat(frame.style.width) || doc.documentElement.clientWidth || 1200);
  const height = Math.min(Math.round(doc.documentElement.scrollHeight), 16000);
  let html2canvas: typeof import("html2canvas").default;
  try { html2canvas = (await import("html2canvas")).default; } catch { return "The picture could not be made in this browser - the HTML is in the same menu."; }
  // the canvas is the PAGE's: its words are drawn in the shop's own fonts, which the page has loaded (a canvas of the hub's
  // own page would draw them in a fallback font, the words running into each other)
  const base = doc.createElement("canvas");
  base.width = width; base.height = height;
  base.style.width = `${width}px`; base.style.height = `${height}px`;
  await doc.fonts?.ready;
  const canvas = await html2canvas(doc.documentElement, {
    canvas: base, backgroundColor: "#ffffff", scale: 1, useCORS: false, allowTaint: false, logging: false, imageTimeout: 20000,
    width, height, windowWidth: width, windowHeight: height, x: 0, y: 0, scrollX: 0, scrollY: 0,
    onclone: (clone) => prepare(clone, doc.baseURI),
  });
  const blob = await new Promise<Blob | null>((ok) => { try { canvas.toBlob(ok, "image/png"); } catch { ok(null); } });
  if (!blob) return "The picture could not be made - a picture of another site was in the way. The HTML is in the same menu.";
  saveFile(blob, `${stem}-${width < 600 ? "phone" : "desktop"}.png`);
  return height >= 16000 ? "Saved - the page is very long: the picture stops after 16,000 pixels." : null;
}

export const downloads: DownloadsOf = (api) => {
  const doc = pageDoc(api.doc, api.data.piece.language);
  const stem = fileStem(api.data.piece.title);
  const views = viewsOf(doc);
  const canEdit = api.data.access.canEdit;
  const noPage = doc.source !== "new" && !doc.path ? "Pick the page first." : null;
  const off = noPage ?? (canEdit ? null : "For the project's editors.");
  const items: DownloadItem[] = views.map((v) => ({
    key: `html:${v}`, group: "HTML for Magento - paste-ready", label: `${viewShort(v)} · HTML`, sub: viewName(v), disabled: off,
    run: () => htmlOf(api, v, stem),
  }));
  if (views.length > 1) {
    items.push({
      key: "html:all", group: "HTML for Magento - paste-ready", label: `Every store view · HTML (${views.length})`, sub: "One file each", disabled: off,
      run: async () => {
        const said: string[] = [];
        for (const v of views) { const m = await htmlOf(api, v, stem); if (m) said.push(m); await pause(); }
        return said.length ? said.join(" ") : `${views.length} files saved.`;
      },
    });
  }
  items.push({
    key: "png", group: "Picture", label: "The page as shown · PNG", sub: "The store view and device the middle shows now - drawn in your browser", disabled: noPage,
    run: () => pagePng(stem),
  });
  return items;
};
