// THE TYPES OF CONTENT CHANGE an optimization proposes - Content's own types (src/lib/content/contentTypes.ts keys),
// so what APSOconvert shows is what Content makes (SARCLA 09.11.2026: "merge Insights and Problem pages, and only
// insights that propose different types of content change"; "it's displayed on the app, then a brief is sent to
// reproduce it on Content, and the content people can work it better"). Agreed with Content (session 3b, 09.11.2026):
// these five keys only; POST /api/content/projects takes the key as contentType.
//
// Pure (no "@/" imports), so it is tested.

export type ChangeType = "page-refresh" | "landing-page" | "banner" | "newsletter" | "blog-article";

export const CHANGE_TYPES: { key: ChangeType; label: string; about: string; soon?: boolean }[] = [
  { key: "page-refresh", label: "Page builder", about: "A change on a page of the shop as it is: its blocks, texts, order, emphasis" },
  { key: "landing-page", label: "SEO landing page", about: "A new page for what people search on Google and the shop does not answer" },
  { key: "banner", label: "Banner", about: "The home slider and the shop's banners" },
  { key: "newsletter", label: "Newsletter", about: "The newsletter band and its sign-up" },
  { key: "blog-article", label: "Blog", about: "Articles - to come on the shop", soon: true },
];

export const CHANGE_LABEL: Record<ChangeType, string> = Object.fromEntries(CHANGE_TYPES.map((t) => [t.key, t.label])) as Record<ChangeType, string>;

const KEYS = new Set<string>(CHANGE_TYPES.map((t) => t.key));
export const isChangeType = (x: unknown): x is ChangeType => typeof x === "string" && KEYS.has(x);

/** The type a block of the shop's optimizations are by nature: the slider is a banner, the newsletter band the
 *  newsletter, any other block a change of the page. */
export function typeOfBlock(block: string | null | undefined): ChangeType {
  return block === "newsletter" ? "newsletter" : block === "home-slider" ? "banner" : "page-refresh";
}

/** An optimization's type: the one the AI gave it, else its block's, else a change of the page (older optimizations). */
export function typeOfIdea(i: { contentType?: string | null; block?: string | null }): ChangeType {
  return isChangeType(i.contentType) ? i.contentType : typeOfBlock(i.block);
}

/** For the AI's answer: its type when one of ours (Blog is not offered yet), else the block's. */
export function cleanChangeType(x: unknown, block: string | null): ChangeType {
  return isChangeType(x) && x !== "blog-article" ? x : typeOfBlock(block);
}
