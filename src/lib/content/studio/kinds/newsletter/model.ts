// NEWSLETTER - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser. Filled out in this session tonight.
export type NewsletterDoc = { v: 1; subject: string; preheader: string; blocks: unknown[] };
export const emptyNewsletter = (): NewsletterDoc => ({ v: 1, subject: "", preheader: "", blocks: [] });
export function newsletterText(doc: unknown): string {
  const d = (doc && typeof doc === "object" ? doc : {}) as Partial<NewsletterDoc>;
  return [d.subject, d.preheader].filter(Boolean).join("\n");
}
