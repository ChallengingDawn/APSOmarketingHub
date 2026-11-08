// THE POST'S PICTURES, MADE IN THE BROWSER (08.11.2026): a slide or the brand card as a PNG, every slide one after the
// other, and the carousel as a PDF - LinkedIn shows a carousel as a document, one page per slide. Same drawing as the
// banners' (../banner/png.ts); jsPDF is already the hub's (the editor's PDF), loaded only when asked for.

import { slideCss, slideHtml, type SlideOpts } from "@/lib/content/studio/kinds/social/slides";
import type { Slide } from "@/lib/content/studio/kinds/social/model";
import { blobData, download, fileName, htmlToPng } from "../banner/png";

export async function slidePicture(s: Slide, o: SlideOpts, font: string, type: "image/png" | "image/jpeg" = "image/png") {
  return htmlToPng({ html: slideHtml(s, o), css: slideCss(o.prefix), width: o.w, height: o.h, fontCss: font, type, background: "#ffffff" });
}

/** Each slide as its own PNG, downloaded in order. Returns how many pictures could not come from the shop. */
export async function downloadSlides(slides: Slide[], base: Omit<SlideOpts, "index" | "total">, font: string, title: string, only?: number): Promise<number> {
  let missed = 0;
  for (const [i, s] of slides.entries()) {
    if (only != null && i !== only) continue;
    const { blob, missing } = await slidePicture(s, { ...base, index: i, total: slides.length }, font);
    missed += missing.length;
    download(blob, fileName(title, slides.length > 1 ? `-slide-${String(i + 1).padStart(2, "0")}.png` : `-${base.w}x${base.h}.png`));
  }
  return missed;
}

/** The carousel as one PDF, a page per slide at the slide's size (JPEG pages keep it light). */
export async function downloadPdf(slides: Slide[], base: Omit<SlideOpts, "index" | "total">, font: string, title: string): Promise<number> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: base.w >= base.h ? "landscape" : "portrait", unit: "px", format: [base.w, base.h], compress: true });
  let missed = 0;
  for (const [i, s] of slides.entries()) {
    const { blob, missing } = await slidePicture(s, { ...base, index: i, total: slides.length }, font, "image/jpeg");
    missed += missing.length;
    if (i > 0) pdf.addPage([base.w, base.h], base.w >= base.h ? "landscape" : "portrait");
    pdf.addImage(await blobData(blob), "JPEG", 0, 0, base.w, base.h, undefined, "FAST");
  }
  pdf.save(fileName(title, "-carousel.pdf"));
  return missed;
}
