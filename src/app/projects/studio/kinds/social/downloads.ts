"use client";
// WHAT A SOCIAL POST GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be
// able to download"). Each format it goes out in: every page as a PNG (one file a page - an Instagram carousel), a
// carousel as one PDF (LinkedIn shows a carousel as a document); every format at once. Drawn by the same Konva as the
// canvas (./exportDesign.ts), at the real size - the export at the foot of the map keeps its own buttons.

import { formatLabel } from "@/lib/content/studio/kinds/social/design";
import { formatsInUse, normalizeSocial } from "@/lib/content/studio/kinds/social/model";
import { fileStem, type DownloadItem, type DownloadsOf } from "../../frame";
import { exportEverything, exportPages, exportPdf } from "./exportDesign";

export const downloads: DownloadsOf = (api) => {
  const doc = normalizeSocial(api.doc);
  const d = doc.design;
  const stem = fileStem(api.data.piece.title);
  const pages = d.pages.length;
  const formats = [...new Set([...d.formats, ...formatsInUse(doc)])];
  if (!pages) return [];
  const items: DownloadItem[] = [];
  for (const f of formats) {
    const group = formatLabel(f, d);
    items.push({
      key: `png:${f}`, group, label: pages > 1 ? `Every page · PNG (${pages})` : "The post · PNG", sub: pages > 1 ? "One picture a page - an Instagram carousel" : "Sharp, for every network",
      run: async () => ((await exportPages(d, f, stem)) ? null : "Not saved - a picture did not load."),
    });
    if (pages > 1) items.push({ key: `pdf:${f}`, group, label: "The carousel · PDF", sub: "LinkedIn shows a carousel as a document", run: async () => ((await exportPdf(d, f, stem)) ? null : "The PDF could not be made.") });
  }
  if (formats.length > 1) {
    items.push({ key: "every", group: "Every format", label: `Every format · PNG (${formats.length})`, sub: formats.map((f) => formatLabel(f, d)).join(", "), run: async () => `${await exportEverything(d, formats, stem)} pictures saved.` });
  }
  return items;
};
