// The pure part of an automatic fill's cleaning (Content v7): no database, no network - the tests import this file.
// ./source.ts wraps cleanCards with the photo check and the shop read.
import type { Card } from "./model";
import { clearanceOf } from "./parse";
import { sharpImg } from "./kit";

/** A product page's other photos, known once read (by a fill, or a test). */
export const GALLERY = new Map<string, string[]>();

export type Cleaned = { cards: Card[]; clearance: number; photo: number };

/** " 2 left out: 1 on clearance or replaced, 1 whose photo ..." - "" when none. */
export function cleanedNote(c: { clearance: number; photo: number }): string {
  const n = c.clearance + c.photo;
  if (!n) return "";
  const parts = [c.clearance ? `${c.clearance} on clearance or replaced` : "", c.photo ? `${c.photo} whose photo has a sticker, a coloured card or is a drawing` : ""].filter(Boolean);
  return ` ${n} left out: ${parts.join(", ")}.`;
}

/**
 * Products as an automatic fill shows them, in their order, at most `count`: none on clearance or replaced; a photo with a
 * sticker (NEW!, LIQUIDATION), a coloured card or a drawing swapped for another of its own page's photos, else the product
 * left out. Categories pass as they are.
 */
export async function cleanCards(cards: Card[], count: number, check: (img: string) => Promise<boolean>, readGallery: (url: string) => Promise<string[]> = async () => []): Promise<Cleaned> {
  const out: Card[] = [];
  let clearance = 0, photo = 0, pageReads = 0;
  for (const c of cards) {
    if (out.length >= count) break;
    if (c.kind !== "product") { out.push(c); continue; }
    if (clearanceOf(c.name, c.url)) { clearance++; continue; }
    if (await check(c.img)) { out.push(c); continue; }
    // another photo of its own page
    let alt: string[] = GALLERY.get(c.url) ?? [];
    if (!GALLERY.has(c.url) && pageReads < 3) {
      pageReads++;
      alt = await readGallery(c.url).catch(() => []);
      GALLERY.set(c.url, alt);
    }
    let better = "";
    for (const a of alt.filter((x) => sharpImg(x) !== sharpImg(c.img))) { if (await check(a)) { better = a; break; } }
    if (better) out.push({ ...c, img: better });
    else photo++;
  }
  return { cards: out, clearance, photo };
}

/** A product page's other photos, known before (a test, or a page read for another reason). */
export const knowGallery = (url: string, imgs: string[]) => { GALLERY.set(url, imgs); };
