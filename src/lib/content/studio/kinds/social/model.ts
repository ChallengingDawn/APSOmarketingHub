// SOCIAL POST - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser.
// A first shape so the studio opens; its own session fills it out.

export type SocialDoc = { v: 1; notes: string };

export const emptySocial = (): SocialDoc => ({ v: 1, notes: "" });

export function socialText(doc: unknown): string {
  const d = (doc && typeof doc === "object" ? doc : {}) as Partial<SocialDoc>;
  return typeof d.notes === "string" ? d.notes : "";
}
