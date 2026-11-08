// BLOG POST - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser.
// A first shape so the studio opens; its own session fills it out.

export type BlogDoc = { v: 1; notes: string };

export const emptyBlog = (): BlogDoc => ({ v: 1, notes: "" });

export function blogText(doc: unknown): string {
  const d = (doc && typeof doc === "object" ? doc : {}) as Partial<BlogDoc>;
  return typeof d.notes === "string" ? d.notes : "";
}
