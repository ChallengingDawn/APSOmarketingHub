"use client";
// WHAT A BLOG POST GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be
// able to download"): the post as HTML - the article with its own stylesheet, as the blog draws it (lib/content/studio/
// kinds/blog/render.ts) - and the post as the preview shows it, inside the shop's frame.

import { BLOG_CSS, postArticle, postDocument } from "@/lib/content/studio/kinds/blog/render";
import { blogDoc } from "@/lib/content/studio/kinds/blog/model";
import { fileStem, saveFile, type DownloadsOf } from "../../frame";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const downloads: DownloadsOf = (api) => {
  const d = blogDoc(api.doc, { language: api.data.piece.language, title: api.data.piece.title });
  const stem = fileStem(d.title || api.data.piece.title);
  const empty = !d.title.trim() && !d.sections?.length ? "Write the post first." : null;
  return [
    {
      key: "article", group: "", label: "The post · HTML", sub: "The article with its own styles - to paste or archive", disabled: empty,
      run: async () => {
        saveFile(`<!doctype html><html lang="${(d.language || "en").slice(0, 2).toLowerCase()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.metaTitle || d.title)}</title><style>${BLOG_CSS}</style></head><body>${postArticle(d)}</body></html>`, `${stem}.html`);
        return null;
      },
    },
    {
      key: "page", group: "", label: "The post as a page · HTML", sub: "As the preview shows it, in the shop's frame", disabled: empty,
      run: async () => { saveFile(postDocument(d), `${stem}-page.html`); return null; },
    },
  ];
};
