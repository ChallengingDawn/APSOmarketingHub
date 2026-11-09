// APSOconvert > Problem pages > BLOCKS - the shop's blocks shown on many pages, each optimized as one thing (SARCLA
// 09.11.2026: "block like newsletter block and so forth - start by learning with the other agent newsletter proposal").
// The newsletter band was redone that way: many clearly different proposals side by side, one picked, then refined
// (30 proposals; "Big photo card" chosen, background changed, e-mail field added). So a block's optimizations are
// different DIRECTIONS for the block, each with versions A, B... - and the block goes to Content as a project.
//
// Pure (tests/convert-blocks.test.ts). `selector` is what the AI and the version runtime aim at (any CSS);
// `focus` is the one element the still picture opens at (./preview.ts markFocus: tag.class, #id or a row by position).

export type BlockWhere = "every" | "home";
export type ShopBlock = {
  key: string;
  name: string;
  /** Where the shop shows it: on every page (the footer) or on the home page. */
  where: BlockWhere;
  /** The page it is looked at and optimized on. */
  page: string;
  selector: string;
  focus: string;
  about: string;
  /** What it is there for - what an optimization should move. */
  goal: string;
  /** How it is measured here: newsletter sign-ups (HubSpot's newsletter forms), else the views of its pages. */
  measure: "signups" | "views";
};

const row = (n: number) => `div[data-content-type="row"]:nth-of-type(${n})`;

export const SHOP_BLOCKS: ShopBlock[] = [
  {
    key: "newsletter", name: "Newsletter band", where: "every", page: "/de-CH/", selector: "div.footer__newsletter", focus: "div.footer__newsletter",
    about: "The newsletter sign-up band above the footer of every page: a CMS block per language (Content > Blocks) with the theme's button to the newsletter page, where the HubSpot form is.",
    goal: "newsletter sign-ups", measure: "signups",
  },
  {
    key: "home-slider", name: "Home slider", where: "home", page: "/de-CH/", selector: "div.pagebuilder-slider", focus: "div.pagebuilder-slider",
    about: "The five slides at the top of the home page (Page Builder slider).",
    goal: "clicks into the shop - categories and offers", measure: "views",
  },
  {
    key: "home-top", name: "Top products", where: "home", page: "/de-CH/", selector: `${row(3)}, ${row(4)}`, focus: row(3),
    about: "The home page's \"Top-Produkte\": a heading and a row of product picture tiles.",
    goal: "clicks to the products, add-to-carts after them", measure: "views",
  },
  {
    key: "home-tools", name: "Tools", where: "home", page: "/de-CH/", selector: `${row(5)}, ${row(6)}`, focus: row(5),
    about: "The home page's \"Tools\": a heading and three picture tiles for the shop's tools (configurators, finder, upload).",
    goal: "tool starts (configurators, product finder, order upload)", measure: "views",
  },
  {
    key: "home-more", name: "More products", where: "home", page: "/de-CH/", selector: `${row(7)}, ${row(8)}`, focus: row(7),
    about: "The home page's \"Weitere Produkte\": a heading and the technologies as picture tiles.",
    goal: "clicks into the technologies' categories", measure: "views",
  },
  {
    key: "home-text", name: "Home page text", where: "home", page: "/de-CH/", selector: `${row(9)}, ${row(10)}, ${row(11)}, ${row(12)}, ${row(13)}`, focus: row(9),
    about: "The text blocks at the bottom of the home page (what the shop is, its ranges) - read by people and by Google.",
    goal: "trust and search visibility; clicks into the ranges it names", measure: "views",
  },
];

export const blockByKey = (key: string): ShopBlock | null => SHOP_BLOCKS.find((b) => b.key === key) ?? null;

/** Sign-ups per thousand views - the newsletter band's own rate (null without views). */
export const perThousand = (n: number, views: number): number | null => (views > 0 ? (n / views) * 1000 : null);
