// BANNER - PUT IT ON A PAGE OF THE SHOP (Content v7, 10.11.2026). Pure: tests/studio-banner-topage.test.ts.
//
// SARCLA 10.11.2026 (point 11): "allow to push the banner directly on a page after editing". The banner's last step:
// pick a page of the shop (the page index, as the Page builder's picker) and a place on it - the home page's slider, the
// top of the page's content, or after one of its blocks - and the hub makes (or opens) that page's Page builder to-do
// with the banner placed there as a MODULE of the library: the campaign banner (builder B's registry, "banner"), drawn as
// ONE picture - the banner's 1920 x 600 and, on phones, its 1080 x 900, kept in the hub's picture store - with its link
// and its alt text (the shared interface of Content v6: a `PageChange` with `module: { type, settings }`). The page studio
// shows it in its preview at once; NOTHING is written to Magento here - the page goes out through the Page builder's own
// last step.
//
// The places on a page are found on the page as the shop serves it (./pagePlaces.ts reads them on the server, with a
// selector checked to find exactly that block); this file turns a place into the change and the module.

import { insertChange, type ModuleRef as PageModuleRef, type PageChange } from "../page/model";
import { newModule, normalizeModule, shopAddress } from "../page/modules/model";
import { renderModule } from "../page/modules/render";
import type { ModuleRef } from "../page/modules/types";
import { linkOf } from "./brand";

/** Where on the page: the home page's slider (as its first slide), the top of the content, or after a block. */
export type PageWhere = "slider" | "top" | "after";
export const WHERE_LABEL: Record<PageWhere, string> = { slider: "In the home slider, first", top: "At the top of the page", after: "After a block of the page" };

/** The slider of a page (Magento Page Builder's) - the home page's first. */
export const SLIDER_SELECTOR = '[data-content-type="slider"]';
/** The page's own content (a CMS page's column; the home page's too). */
export const MAIN_SELECTOR = "#maincontent .column.main";

/** The change's id and the module's: one banner stands once on a page - put again, it moves (and takes its new pictures). */
export const changeIdFor = (pieceId: number) => `banner-${pieceId}`;
export const moduleIdFor = (pieceId: number) => `bn${String(pieceId).replace(/\D/g, "").slice(0, 10) || "0"}`;

/** The banner's link as an address on the shop, in the page's store view: a shop path ("black-friday") goes to that
 * store view's page; a full address of the shop stays; anything else is no link (the module takes only the shop's). */
export function shopLinkFor(raw: string, store: string): string {
  const l = linkOf(raw);
  if (l.shopPath) {
    const path = l.shopPath.replace(/^\/+/, "");
    const view = /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?\//.test(path) ? path : `${store}/${path}`;
    return shopAddress(`https://www.apsoparts.com/${view}`);
  }
  return shopAddress(l.href);
}

export type BannerOnPage = {
  pieceId: number;
  /** the page's store view ("de-CH") */
  store: string;
  /** the hub's addresses of the banner's two pictures (/api/content/picture/...) */
  desktop: string; phone: string;
  alt: string;
  /** the banner's button's target (a shop path or address) - "" = the picture links nowhere */
  link: string;
  where: PageWhere;
};

/** The campaign banner module of the library, as the banner's one picture. */
export function bannerModule(b: BannerOnPage): ModuleRef {
  const base = newModule("banner", b.store, moduleIdFor(b.pieceId));
  const link = shopLinkFor(b.link, b.store);
  const alt = b.alt.replace(/\s+/g, " ").trim().slice(0, 140);
  const m = {
    ...base,
    settings: {
      ...base.settings,
      layout: "picture",
      title: alt,
      link: { label: "", url: link },
      feature: { kind: "category" as const, name: alt || "Banner", url: link || `https://www.apsoparts.com/${b.store}/`, img: b.desktop, meta: "", number: "", children: [] },
      extra: { phone: b.phone, alt, place: b.where === "slider" ? "slider" : "page", banner: String(b.pieceId) },
    },
  };
  // as the page studio will read it back (unknown values out, addresses checked)
  return normalizeModule(m) ?? m;
}

/** The change that stands the banner at its place on the page (its module beside it, so the page studio opens it again). */
export function bannerChange(b: BannerOnPage, place: { selector?: string; before?: boolean } = {}): PageChange {
  const m = bannerModule(b);
  const html = renderModule(m);
  const note = `Banner from the banner studio: ${m.settings.title.slice(0, 80) || "a picture"}`;
  const meta = { note, module: m as unknown as PageModuleRef, id: changeIdFor(b.pieceId) };
  if (b.where === "slider") return insertChange(SLIDER_SELECTOR, "prepend", html, meta);
  if (b.where === "after" && place.selector) return insertChange(place.selector, place.before ? "before" : "after", html, meta);
  return insertChange(MAIN_SELECTOR, "prepend", html, meta);
}

/** The page's change list with the banner in it: in place of its earlier change (it moves), else at the end. */
export function withBanner(changes: PageChange[], c: PageChange): PageChange[] {
  const i = changes.findIndex((x) => x.id === c.id);
  return i < 0 ? [...changes, c] : changes.map((x, k) => (k === i ? c : x));
}

/** Is this banner on a page's change list? */
export const bannerOn = (changes: unknown, pieceId: number): boolean =>
  Array.isArray(changes) && changes.some((c) => !!c && typeof c === "object" && (c as { id?: unknown }).id === changeIdFor(pieceId));

/** The hub's own pictures in a page's HTML as full addresses (a page drawn outside the hub reads them from the hub). */
export const hubPicturesAbsolute = (html: string, origin: string) =>
  html.replace(/(["'(\s])\/api\/content\/picture\//g, `$1${origin.replace(/\/+$/, "")}/api/content/picture/`);
