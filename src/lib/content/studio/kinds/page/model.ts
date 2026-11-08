// PAGE - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser.
// A first shape so the studio opens; its own session fills it out.

export type PageDoc = { v: 1; notes: string };

export const emptyPage = (): PageDoc => ({ v: 1, notes: "" });

export function pageText(doc: unknown): string {
  const d = (doc && typeof doc === "object" ? doc : {}) as Partial<PageDoc>;
  return typeof d.notes === "string" ? d.notes : "";
}
