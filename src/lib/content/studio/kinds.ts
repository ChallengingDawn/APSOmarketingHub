// WHICH STUDIO A TO-DO OPENS IN (SARCLA 08.11.2026: "each type of content should be different"). Pure.
//
//   page        a page of the shop - from AI testing & personalization, or new; live preview, versions, A/B, Magento
//   blog        a blog post, under the blog's home page
//   social      a post for LinkedIn, Instagram, Facebook - text per network, its pictures, a carousel
//   newsletter  an e-mail built from blocks, rendered as e-mail HTML, sent to HubSpot as a draft
//   banner      a banner in its sizes - the shop's bands, a newsletter header, a social card
//   video       a motion-graphics film in our style, scene by scene, played live; rendered on a render machine

export const STUDIO_KINDS = ["page", "blog", "social", "newsletter", "banner", "video"] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];

/** The content type a to-do has -> its studio; null = the general studio (/create). */
export function studioKindOf(contentType: string | null | undefined): StudioKind | null {
  switch (contentType) {
    case "landing-page": case "product-page": case "page-refresh": case "page": return "page";
    case "blog-article": return "blog";
    case "linkedin-post": case "social-post": return "social";
    case "newsletter": return "newsletter";
    case "banner": return "banner";
    case "video": return "video";
    default: return null;
  }
}

export const STUDIO_LABEL: Record<StudioKind, string> = {
  page: "Page", blog: "Blog article", social: "Social post", newsletter: "Newsletter", banner: "Banner", video: "Video",
};
