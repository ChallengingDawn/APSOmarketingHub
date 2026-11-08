// What "Make" in Content's side panel makes (SARCLA 08.11.2026: "the Makes really don't work") - one entry per kind of
// studio: its content type, how a sentence names it, what its studio is for, an example of what one is about.
// Plain data: the server page checks the address against it, the screen reads it.

export type MakeKind = { key: string; noun: string; blurb: string; example: string };

export const MAKE_KINDS: MakeKind[] = [
  { key: "social-post", noun: "social post", blurb: "One post for LinkedIn, Instagram and Facebook - its text per network, its pictures.", example: "New FKM cords in stock" },
  { key: "landing-page", noun: "page", blurb: "A page of the shop, written and laid out with its live preview.", example: "Cut-to-size gaskets for food lines" },
  { key: "blog-article", noun: "blog article", blurb: "An article for the blog, written the way the reader will see it.", example: "How to choose an O-ring material" },
  { key: "newsletter", noun: "newsletter", blurb: "An e-mail built from blocks, sent to HubSpot as a draft.", example: "What is new in November" },
  { key: "banner", noun: "banner", blurb: "A banner in its sizes - the shop's bands, a newsletter header, a social card.", example: "DirectCut band for the shop" },
  { key: "video", noun: "video", blurb: "A motion-graphics film in our style, scene by scene.", example: "DirectCut in 30 seconds" },
];

export const makeHref = (kind: string) => `/projects/make/${kind}`;
