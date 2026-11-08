// BANNER - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser.
// A first shape so the studio opens; its own session fills it out.

export type BannerDoc = { v: 1; notes: string };

export const emptyBanner = (): BannerDoc => ({ v: 1, notes: "" });

export function bannerText(doc: unknown): string {
  const d = (doc && typeof doc === "object" ? doc : {}) as Partial<BannerDoc>;
  return typeof d.notes === "string" ? d.notes : "";
}
