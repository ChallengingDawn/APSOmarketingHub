"use client";
// WHAT A BANNER GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be able
// to download"). Each size it is made in, as a PNG and as a WebP - sharp (2x), drawn by the same code that draws the stage
// (lib/content/studio/kinds/banner/render.ts stillMarkup, ./png.ts) - every size at once, and the shop's sizes as their
// paste block for Magento (HTML). The "Get it" step keeps its own buttons; this is the same output from the bar.

import { PRESET, normalizeBanner, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { htmlFile, pasteBlock, prefixFor, stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import { asWebp, fileStem, pause, saveFile, type DownloadItem, type DownloadsOf } from "../../frame";
import { brandFontCss, htmlToPng } from "./png";

type Kind = "png" | "webp";

async function picture(d: BannerDoc, k: PresetKey, prefix: string, stem: string, kind: Kind): Promise<string[]> {
  const p = PRESET[k];
  const s = stillMarkup(d, k, prefix);
  const { blob, missing } = await htmlToPng({ html: s.html, css: s.css, width: p.w, height: p.h ?? 400, scale: 2, fontCss: await brandFontCss() });
  const out = kind === "webp" ? await asWebp(blob) : blob;
  saveFile(out, `${stem}-${p.w}x${p.h ?? "auto"}@2x.${out.type === "image/webp" ? "webp" : "png"}`);
  return missing;
}

export const downloads: DownloadsOf = (api) => {
  const d = normalizeBanner(api.doc);
  const stem = fileStem(api.data.piece.title);
  const prefix = prefixFor(api.data.piece.id);
  const sizes = sizesOf(d);
  const say = (missing: string[]) => (missing.length ? "Saved - a picture could not be fetched, so it was drawn without it." : null);
  const items: DownloadItem[] = [];
  for (const kind of ["png", "webp"] as Kind[]) {
    const group = kind === "png" ? "PNG - sharp, every network" : "WebP - lighter, for the web";
    for (const k of sizes) {
      const p = PRESET[k];
      items.push({ key: `${kind}:${k}`, group, label: `${p.label} · ${p.w} × ${p.h ?? "auto"}`, sub: p.note, run: async () => say(await picture(d, k, prefix, stem, kind)) });
    }
    if (sizes.length > 1) {
      items.push({
        key: `${kind}:all`, group, label: `Every size · ${kind.toUpperCase()} (${sizes.length})`, sub: "One file each",
        run: async () => { const m: string[] = []; for (const k of sizes) { m.push(...await picture(d, k, prefix, stem, kind)); await pause(); } return say(m) ?? `${sizes.length} files saved.`; },
      });
    }
  }
  for (const k of sizes.filter((x) => PRESET[x].out === "html")) {
    const p = PRESET[k];
    items.push({
      key: `html:${k}`, group: "HTML for Magento", label: `${p.label} · HTML`, sub: "Its paste block, as a page you can open",
      run: async () => { saveFile(htmlFile(pasteBlock(d, k, prefix, api.data.piece.title, { origin: window.location.origin }), api.data.piece.title), `${stem}-${k}.html`); return null; },
    });
  }
  return items;
};
