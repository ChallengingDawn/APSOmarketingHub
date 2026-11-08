"use client";
// THE DESIGN OUT OF THE HUB (08.11.2026; SARCLA: "a clear Download/Export"). Nothing is posted to a network from the hub:
// each page as a PNG (or a JPG), a carousel as one PDF (LinkedIn shows a carousel as a document), every format the post
// goes out in. Drawn by the same Konva as the canvas (designRender.tsx), at the real size.

import { designBlob, renderDesign } from "@/app/editor/designRender";
import { pageIn, sizeOf, type FormatKey, type SocialDesign } from "@/lib/content/studio/kinds/social/design";
import { save } from "./actions";

const pad = (i: number) => String(i + 1).padStart(2, "0");

async function saveBlob(b: Blob, name: string) {
  const url = URL.createObjectURL(b);
  save(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Every page of one format as pictures, one file each. Returns how many were made. */
export async function exportPages(d: SocialDesign, f: FormatKey, stem: string, mime: "image/png" | "image/jpeg" = "image/png", only?: number): Promise<number> {
  let n = 0;
  for (const [i, p] of d.pages.entries()) {
    if (only !== undefined && i !== only) continue;
    const b = await designBlob(pageIn(d, p, f), mime);
    if (!b) continue;
    const s = sizeOf(f, d);
    await saveBlob(b, `${stem}-${f}-${s.w}x${s.h}${d.pages.length > 1 ? `-${pad(i)}` : ""}.${mime === "image/png" ? "png" : "jpg"}`);
    n += 1;
    // the browser lets a page start one download at a time
    await new Promise((r) => setTimeout(r, 250));
  }
  return n;
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
  pdf.save(`${stem}-${f}-carousel.pdf`);
  return true;
}

/** Every format, every page. */
export async function exportEverything(d: SocialDesign, formats: FormatKey[], stem: string): Promise<number> {
  let n = 0;
  for (const f of formats) n += await exportPages(d, f, stem);
  return n;
}
