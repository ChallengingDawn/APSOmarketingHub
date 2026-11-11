"use client";
// THE DESIGN OUT OF THE HUB (08.11.2026; SARCLA: "a clear Download/Export"). Nothing is posted to a network from the hub:
// each page as a PNG (or a JPG), a carousel as one PDF (LinkedIn shows a carousel as a document), every format the post
// goes out in. Drawn by the same Konva as the canvas (designRender.tsx), at the real size.
// cv17: a post whose pictures say what they show (their alt text) hands it over beside them - "<stem>-alt-text.txt" in the
// zip, a line per file (design.ts altSidecar); a post without any alt text is saved as before.

import { designBlob, renderDesign } from "@/app/editor/designRender";
import { altSidecar, pageFileName, pageIn, sizeOf, type FormatKey, type SocialDesign } from "@/lib/content/studio/kinds/social/design";
import { saveFile, saveFiles, type FileOut } from "../../frame";

/** The pages of one format drawn as files (not saved yet). */
async function pageFiles(d: SocialDesign, f: FormatKey, stem: string, mime: "image/png" | "image/jpeg", only?: number): Promise<FileOut[]> {
  const out: FileOut[] = [];
  for (const [i, p] of d.pages.entries()) {
    if (only !== undefined && i !== only) continue;
    const b = await designBlob(pageIn(d, p, f), mime);
    if (!b) continue;
    const s = sizeOf(f, d);
    out.push({ name: pageFileName(stem, f, s, i, d.pages.length, mime === "image/png" ? "png" : "jpg"), data: b, type: mime });
  }
  return out;
}

/** The alt texts beside the pictures, when they go out together in a zip (one picture alone stays a picture). */
function withAlts(files: FileOut[], d: SocialDesign, formats: FormatKey[], stem: string, mime: "image/png" | "image/jpeg", only?: number): FileOut[] {
  if (files.length < 2 || only !== undefined) return files;
  const text = altSidecar(d, formats, stem, mime === "image/png" ? "png" : "jpg");
  return text ? [...files, { name: `${stem}-alt-text.txt`, data: text, type: "text/plain" }] : files;
}

/** Every page of one format as pictures - one file, or a carousel's pages in ONE zip (Content v10, 10.11.2026: several
 * downloads at once are held back by the browser - SARCLA's "Download neither"). Returns how many were made. */
export async function exportPages(d: SocialDesign, f: FormatKey, stem: string, mime: "image/png" | "image/jpeg" = "image/png", only?: number): Promise<number> {
  const files = await pageFiles(d, f, stem, mime, only);
  await saveFiles(withAlts(files, d, [f], stem, mime, only), `${stem}-${f}-pages.zip`);
  return files.length;
}

/** The pages of one format as one PDF, a page per page at its size. */
export async function exportPdf(d: SocialDesign, f: FormatKey, stem: string): Promise<boolean> {
  const { jsPDF } = await import("jspdf");
  const s = sizeOf(f, d);
  const orientation = s.w >= s.h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [s.w, s.h], compress: true });
  for (const [i, p] of d.pages.entries()) {
    const url = await renderDesign(pageIn(d, p, f), { mime: "image/jpeg", quality: 0.92 });
    if (!url) return false;
    if (i > 0) pdf.addPage([s.w, s.h], orientation);
    pdf.addImage(url, "JPEG", 0, 0, s.w, s.h, undefined, "FAST");
  }
  // handed over as every other file is (the bar offers it again as a link)
  saveFile(pdf.output("blob"), `${stem}-${f}-carousel.pdf`, "application/pdf");
  return true;
}

/** Every format, every page - in one zip. */
export async function exportEverything(d: SocialDesign, formats: FormatKey[], stem: string): Promise<number> {
  const files: FileOut[] = [];
  for (const f of formats) files.push(...await pageFiles(d, f, stem, "image/png"));
  await saveFiles(withAlts(files, d, formats, stem, "image/png"), `${stem}-every-format.zip`);
  return files.length;
}
