// PAGE - A NEW PAGE IN THE SHOP'S FRAME, THE HOME PAGE KIT'S WAY (10.11.2026). Pure: tests/studio-page-frame.test.ts.
//
// SARCLA 10.11.2026 on the first page the Page builder put on ACC ("Kalrez 6221 and 6230 discontinued"): "also on the page
// what the hell" - "can't you see the code we generated for the new homepage?". The page came out in Magento's default
// layout of ACC, three columns: its main column 58 % of the window, at the left - the hero from the window's edge to the
// middle, the modules centred in it with another width, nothing in line with the breadcrumb. The home page kit
// (C:\dev\_archive\apsoparts\shop-project\home-page-2026\home_kit.py) never had that: its page is ONE Page Builder row -
// Full Width, no padding - holding ONE HTML Code element, on a one-column page, so it lies in the theme's own content
// container (max 1170 px from 1200 px on, 10 px gutters: header, breadcrumb and footer use the same), and only a band's
// colour runs out to the window's edges. A new page is written that way now:
//   - the content Magento gets is that row and that element (framePage), as Page Builder itself stores them - opened in
//     Magento's editor it is the same row and element, not a page converted from loose HTML;
//   - the page's layout is "1column" (PAGE_LAYOUT, Magento's page_layout), as the shop's own pages; a page left in three
//     columns still takes the whole width (FRAME_CSS);
//   - the frame's rules repeat the theme's container, so the page sits in the shop's column at every width, whatever
//     the theme's own rules for rows do.
// The preview draws the same frame (./shop.ts, the studio's Stage), so what the studio shows is what the shop gets.

/** Magento's page_layout of a new page: the shop's own pages and the home page kit's are one column. */
export const PAGE_LAYOUT = "1column";

/** The row's own class (Page Builder keeps it as the row's "CSS Classes"). */
export const ROW_CLASS = "apx-np-row";

/** The shop's type, first - futura-pt (Adobe Fonts, loaded by the shop); Jost is the hub's own look-alike for its preview. */
export const SHOP_FONT = `"futura-pt","Futura PT",Futura,Jost,Arial,sans-serif`;

// a Full Width row and an HTML Code element exactly as Page Builder (Magento 2.4) stores them: the row's settings as its
// data attributes, no margin, no padding; the element's HTML as it is (data-decoded="true": nothing to decode)
const ROW_STYLE = "justify-content: flex-start; display: flex; flex-direction: column; background-position: left top; background-size: cover; background-repeat: no-repeat; background-attachment: scroll; border-style: none; border-width: 1px; border-radius: 0px; margin: 0px; padding: 0px;";
const HTML_STYLE = "border-style: none; border-width: 1px; border-radius: 0px; margin: 0px; padding: 0px;";
const ROW_OPEN = `<div class="${ROW_CLASS}" data-content-type="row" data-appearance="full-width" data-enable-parallax="0" data-parallax-speed="0.5" data-background-images="{}" data-background-type="image" data-video-loop="true" data-video-play-only-visible="true" data-video-lazy-load="true" data-video-fallback-src="" data-element="main" style="${ROW_STYLE}"><div class="row-full-width-inner" data-element="inner"><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true" style="${HTML_STYLE}">`;
const ROW_CLOSE = "</div></div></div>";

/**
 * The frame's rules - first in the page's stylesheet. The theme's container said again for the page's own row (the theme:
 * [data-content-type=row][data-appearance=full-width] > .row-full-width-inner, width 100 %, 10 px gutters, at most 1170 px
 * from 1200 px on), and the guard for a page whose layout is still two or three columns.
 */
export const FRAME_CSS = `.${ROW_CLASS}{box-sizing:border-box;width:100%;margin:0;padding:0}
.${ROW_CLASS}>.row-full-width-inner{box-sizing:border-box;width:100%;max-width:none;margin:0 auto;padding:0 10px}
@media (min-width:1200px){.${ROW_CLASS}>.row-full-width-inner{max-width:1170px}}
.${ROW_CLASS} [data-content-type=html]{margin:0;padding:0}
:is(.page-layout-3columns,.page-layout-2columns-left,.page-layout-2columns-right) .column.main:has(.${ROW_CLASS}){width:100%!important;float:none!important}`;

/** A store's page drawn in the new page's layout (the preview's frame): its <body> says page-layout-1column. */
export function oneColumn(html: string): string {
  return html.replace(/<body\b[^>]*>/i, (tag) => {
    const want = `page-layout-${PAGE_LAYOUT}`;
    if (!/\sclass\s*=/i.test(tag)) return tag.replace(/>$/, ` class="${want}">`);
    return tag.replace(/(\sclass\s*=\s*)(["'])([^"']*)\2/i, (_a, at: string, q: string, cls: string) => {
      const kept = cls.split(/\s+/).filter((c) => c && !/^page-layout-/.test(c));
      return `${at}${q}${[...kept, want].join(" ")}${q}`;
    });
  });
}

/** The page's content as Magento gets it: ONE Full Width row, no padding, holding ONE HTML Code element with `inner`
 * (its stylesheet and the page). */
export function framePage(inner: string): string {
  return `${ROW_OPEN}${inner}${ROW_CLOSE}`;
}

/** Is this content one of ours, framed (a write again replaces it whole)? */
export const isFramed = (html: string) => html.trimStart().startsWith(`<div class="${ROW_CLASS}" data-content-type="row" data-appearance="full-width"`) && html.trimEnd().endsWith(ROW_CLOSE);

/** The HTML Code element's own HTML, from framed content - what a person pastes into ONE HTML Code element by hand. */
export function unframe(html: string): string {
  return isFramed(html) ? html.trim().slice(ROW_OPEN.length, -ROW_CLOSE.length) : html;
}
