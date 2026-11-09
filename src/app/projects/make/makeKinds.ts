// What "Make" in Content's side panel makes (SARCLA 08.11.2026: "the Makes really don't work") - one entry per kind of
// studio: its content type, how a sentence names it, what its studio is for, an example of what one is about.
// Plain data: the server page checks the address against it, the screen reads it.

export type MakeKind = {
  key: string; noun: string; blurb: string; example: string;
  /** the screen's title, when "New <noun>" does not say it; the question over the box; the name of one left unnamed */
  heading?: string; ask?: string; untitled?: string;
};

export const MAKE_KINDS: MakeKind[] = [
  { key: "social-post", noun: "social post", blurb: "One post for LinkedIn, Instagram and Facebook - its text per network, its pictures.", example: "New FKM cords in stock" },
  { key: "landing-page", noun: "SEO landing page", blurb: "A new page for the shop, built to own one search - written and laid out with its live preview.", example: "Cut-to-size gaskets for food lines" },
  // a page already on the webshop, changed (SARCLA 09.11.2026: "Page refresh becomes only Page builder")
  { key: "page-refresh", noun: "page of the shop", heading: "Page builder", ask: "Which page, and what should change?", untitled: "A page of the shop",
    blurb: "Change a page already on the webshop - pick it in the studio, change it with its live preview, test it, publish it.", example: "The O-ring category page - the table first" },
  { key: "blog-article", noun: "blog article", blurb: "An article for the blog, written the way the reader will see it.", example: "How to choose an O-ring material" },
  { key: "newsletter", noun: "newsletter", blurb: "An e-mail built from blocks, sent to HubSpot as a draft.", example: "What is new in November" },
  { key: "banner", noun: "banner", blurb: "A banner in its sizes - the shop's bands, a newsletter header, a social card.", example: "DirectCut band for the shop" },
  { key: "video", noun: "video", blurb: "A motion-graphics film in our style, scene by scene.", example: "DirectCut in 30 seconds" },
];

export const makeHref = (kind: string) => `/projects/make/${kind}`;
