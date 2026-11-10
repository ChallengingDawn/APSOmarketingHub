// PAGE - THE SHOP'S PAGES READ FOR A MODULE (Content v6, 09.11.2026). Pure: tests/studio-page-modules.test.ts.
//
// SARCLA 09.11.2026: "fill the product of the bento or other by hierarchy like on the bento", "fill most viewed / most
// bought ... or by article or product number". Everything a module shows comes from the shop's own pages, read as the
// shop draws them (src/lib/convert/studio.ts shopPage):
//   - the CATEGORY TREE from any page's main menu (Produkte: technology > category > subcategory, with their addresses);
//   - a CATEGORY PAGE: its name, its count ("31 Produkte / 31.264 Artikel"), its subcategory tiles (name, photo, link) and
//     its product list (name, photo, link, "Dieses Produkt hat 702 Artikel.");
//   - a PRODUCT PAGE: its name and photo (og:title, og:image) and its address.
// Never a price, never stock, never availability: a module does not carry them (they change by customer and by hour).

import type { Card } from "./model";

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", trade: "™", copy: "©", ndash: "–", mdash: "—", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à" };

/** HTML text as plain text: entities read, tags out, spaces folded. */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n: string) => ENT[n] ?? all)
    .replace(/\s+/g, " ").trim();
}

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? textOf(m[2] ?? m[3] ?? "") : "";
};

/** An address on the shop, made absolute; null when it leaves the shop. */
export function shopUrlOf(href: string, base = "https://www.apsoparts.com"): string | null {
  try {
    const u = new URL(href.replace(/&amp;/g, "&"), base);
    if (!/^(www|acc)\.apsoparts\.com$/.test(u.hostname)) return null;
    return `https://${u.hostname}${u.pathname}`;
  } catch {
    return null;
  }
}

/** A picture on the shop, made absolute; "" when it is none of the shop's. */
function shopImgOf(src: string, base: string): string {
  try {
    const u = new URL(src.replace(/&amp;/g, "&"), base);
    return /^(www|acc)\.apsoparts\.com$/.test(u.hostname) && u.pathname.startsWith("/media/") ? `https://${u.hostname}${u.pathname}` : "";
  } catch {
    return "";
  }
}

/** A product's 8-digit number from its address ("/de-CH/11400101-hitecr-o-ring....html"). */
export const productOfUrl = (url: string) => /\/(\d{8})(?=-|\.html|$)/.exec(url)?.[1] ?? "";

/* ── the category tree (the shop's main menu) ─────────────────────────── */

export type TreeNode = { name: string; url: string; children: TreeNode[] };

/**
 * The shop's category tree out of a page's main menu: <li class="level0 ..."><a href><span>Name</span></a><ul>...
 * level0 = the technologies, level1 their categories, level2 the subcategories (deeper levels are left out - a module
 * goes three levels down at most).
 */
export function parseMenu(html: string, base = "https://www.apsoparts.com"): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: { level: number; node: TreeNode }[] = [];
  const re = /<li\b[^>]*class\s*=\s*"[^"]*\blevel(\d)\b[^"]*\bcategory-item\b[^"]*"[^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const level = Number(m[1]);
    if (level > 2) continue;
    const url = shopUrlOf(attr(`<a ${m[2]}>`, "href"), base);
    const name = textOf(m[3]);
    if (!url || !name) continue;
    const node: TreeNode = { name, url, children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (level === 0) roots.push(node);
    else if (stack.length && stack[stack.length - 1].level === level - 1) stack[stack.length - 1].node.children.push(node);
    else continue;
    stack.push({ level, node });
  }
  // the same menu can be in the page twice (desktop and phone): one each
  const seen = new Set<string>();
  return roots.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

/** A node of the tree by its address (any level). */
export function findNode(tree: TreeNode[], url: string): TreeNode | null {
  for (const n of tree) {
    if (n.url === url) return n;
    const k = findNode(n.children, url);
    if (k) return k;
  }
  return null;
}

/**
 * The photos a page puts on its links: Page Builder banners (<a href><div data-background-images='{"desktop_image":...}'>
 * or style="background-image: url(...)"), and plain <a href><img src>. The home page's technology tiles are where a
 * technology's photo is (its own page has none) - address -> photo, the first one each.
 */
export function tilePhotos(html: string, base = "https://www.apsoparts.com"): Record<string, string> {
  const out: Record<string, string> = {};
  // a Page Builder banner's link holds its wrapper, overlay and words - a few thousand characters
  const re = /<a\b([^>]*\bhref\s*=\s*["'][^"']+["'][^>]*)>([\s\S]{0,4000}?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const u = shopUrlOf(attr(`<a ${m[1]}>`, "href"), base);
    if (!u || out[u]) continue;
    const inner = m[2];
    const src = /desktop_image\\?["']\s*:\s*\\?["']([^"'\\]+)/i.exec(inner)?.[1]
      ?? /background-image:\s*url\(\s*(?:'|&#039;|&quot;|")?([^'")&]+)/i.exec(inner)?.[1]
      ?? /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(inner)?.[1];
    const img = src ? shopImgOf(src, base) : "";
    if (img) out[u] = img;
  }
  return out;
}

/* ── a category page ──────────────────────────────────────────────────── */

export type CategoryPage = { name: string; url: string; count: string; subs: Card[]; products: Card[] };

/** "Dieses Produkt hat 702 Artikel." -> "702 Artikel"; "This product has 1,560 articles." -> "1,560 articles". */
export function countOf(sentence: string): string {
  const m = /(\d[\d'’.,]*)\s+([^\s.]+)/u.exec(textOf(sentence));
  return m ? `${m[1]} ${m[2]}` : "";
}

/** A category page's own words: its description (Magento's .category-description, at the foot of the main column - the
 * shop's text on the category, its figures and norms), plain, cut. Content v8: what a new page about it may say. */
export function categoryDescription(html: string, max = 3000): string {
  const s = String(html ?? "");
  const i = s.search(/class\s*=\s*"[^"]*\bcategory-description\b/i);
  if (i < 0) return "";
  const end = s.indexOf("</main>", i);
  const part = s.slice(s.indexOf(">", i) + 1, end > i ? Math.min(end, i + 40_000) : i + 40_000).replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const t = textOf(part);
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** A category page as a module reads it: its name and count, its subcategory tiles, its products (the first page). */
export function parseCategory(html: string, url: string): CategoryPage {
  const base = url;
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const name = h1 ? textOf(h1[1]) : "";
  const countRaw = /class\s*=\s*"filter-product-count[^"]*"[^>]*>([^<]*)</i.exec(html)?.[1] ?? "";
  const count = textOf(countRaw).split("/")[0].trim();
  // the subcategory tiles (Page Builder banners in .category-tiles): link, background photo, h3 name
  const subs: Card[] = [];
  const tiles = html.indexOf("category-tiles");
  if (tiles >= 0) {
    const part = html.slice(tiles, tiles + 200_000);
    const re = /<a\b([^>]*)>\s*<div\b[^>]*background-image:\s*url\(\s*(?:'|&#039;|&quot;|")?([^'")&]+)(?:'|&#039;|&quot;|")?\s*\)[^>]*>[\s\S]*?class\s*=\s*"subcategory-image-label"[^>]*>([\s\S]*?)<\/h3>/gi;
    for (const m of part.matchAll(re)) {
      const u = shopUrlOf(attr(`<a ${m[1]}>`, "href"), base);
      const img = shopImgOf(m[2], base);
      const n = textOf(m[3]);
      if (u && n && !subs.some((x) => x.url === u)) subs.push({ kind: "category", name: n, url: u, img, meta: "", number: "", children: [] });
    }
  }
  // the products listed
  const products: Card[] = [];
  const re2 = /<li\b[^>]*class\s*=\s*"[^"]*\bproduct-item\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(re2)) {
    const li = m[1];
    const link = /<a\b[^>]*class\s*=\s*"product-item-link"[^>]*>([\s\S]*?)<\/a>/i.exec(li);
    const href = link ? attr(link[0], "href") : "";
    const u = href ? shopUrlOf(href, base) : null;
    const imgTag = /<img\b[^>]*class\s*=\s*"[^"]*product-image-photo[^"]*"[^>]*>/i.exec(li)?.[0] ?? "";
    const img = imgTag ? shopImgOf(attr(imgTag, "src") || attr(imgTag, "data-src"), base) : "";
    const n = link ? textOf(link[1]) : "";
    const cnt = /class\s*=\s*"product-item-article-count"[^>]*>([^<]*)</i.exec(li)?.[1] ?? "";
    if (u && n && !products.some((x) => x.url === u)) products.push({ kind: "product", name: n, url: u, img, meta: countOf(cnt), number: productOfUrl(u), children: [] });
  }
  return { name, url, count, subs, products };
}

/* ── a product page ───────────────────────────────────────────────────── */

const meta = (html: string, prop: string) => {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${prop.replace(/:/g, "\\:")}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  return tag ? attr(tag, "content") : "";
};

/** A product page as a card: its name, photo and address as the page itself says them (og:title, og:image, og:url). */
export function parseProduct(html: string, url: string): Card | null {
  if (meta(html, "og:type") && meta(html, "og:type") !== "product") return null;
  const name = meta(html, "og:title") || textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "");
  const u = shopUrlOf(meta(html, "og:url") || url, url) ?? shopUrlOf(url);
  const img = shopImgOf(meta(html, "og:image"), url);
  if (!name || !u) return null;
  // its own article count is the headline of its articles' table ("702 Artikel") - the "product-item-article-count" lines
  // on the page are the related products'
  const cnt = /class\s*=\s*"articles"[^>]*>[\s\S]{0,400}?<h2\b[^>]*class\s*=\s*"product__section__headline[^"]*"[^>]*>([^<]*)</i.exec(html)?.[1] ?? "";
  return { kind: "product", name, url: u, img, meta: /^\s*\d/.test(cnt) ? countOf(cnt) : "", number: productOfUrl(u), children: [] };
}

/**
 * A product page's categories, from the technology down (Content v12): its breadcrumb as the page itself states it - the
 * schema.org BreadcrumbList (<script type="application/ld+json">), else Magento's "categoryBreadcrumbs" - "Kunststofftechnik
 * > Platte > Polyoxymethylen (POM)", each with its address. A product's own address carries no category
 * ("/de-CH/02320001-pom-c-platte-natur-weiss.html"), so this is where a module learns what its products are (./follow.ts).
 */
export function breadcrumbOf(html: string, base = "https://www.apsoparts.com"): { name: string; url: string }[] {
  const s = String(html ?? "");
  const out: { name: string; url: string }[] = [];
  const add = (name: string, href: string) => {
    const u = shopUrlOf(href, base);
    const n = textOf(name);
    if (u && n && /\.html$/.test(u) && !out.some((x) => x.url === u)) out.push({ name: n, url: u });
  };
  for (const m of s.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!/BreadcrumbList/.test(m[1])) continue;
    try {
      const find = (v: unknown): unknown[] | null => {
        if (!v || typeof v !== "object") return null;
        const o = v as Record<string, unknown>;
        if (o["@type"] === "BreadcrumbList" && Array.isArray(o.itemListElement)) return o.itemListElement;
        for (const x of Object.values(o)) { const r = find(x); if (r) return r; }
        return null;
      };
      const list = (find(JSON.parse(m[1])) ?? []) as { position?: number; name?: unknown; item?: unknown }[];
      for (const it of [...list].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))) {
        const item = it.item && typeof it.item === "object" ? (it.item as Record<string, unknown>)["@id"] ?? (it.item as Record<string, unknown>).url : it.item;
        add(String(it.name ?? ""), String(item ?? ""));
      }
    } catch { /* a script that is no JSON: the next way */ }
    if (out.length) return out;
  }
  const cb = /"categoryBreadcrumbs"\s*:\s*(\[[^\]]*\])/.exec(s);
  if (cb) {
    try {
      for (const it of JSON.parse(cb[1]) as { label?: unknown; link?: unknown }[]) add(String(it.label ?? ""), String(it.link ?? ""));
    } catch { /* none */ }
  }
  return out;
}

/* ── clearance: never in an automatic fill ────────────────────────────── */

/**
 * The words the shop puts in a product's name (and so in its address) when it is on its way out or replaced - a product
 * an automatic fill (a category, most bought, most viewed, the AI's pick) never shows (Content v7, the lead 10.11.2026:
 * builder A's real runs filled a module with "(Nur solange der Vorrat reicht)", "(Nachfolge von ...)", "Liquidation"; the
 * home page kit left them out on purpose). German, French, Italian, English, Dutch, Polish. "Auslauf" alone is not one
 * (an Auslaufhahn is a tap).
 */
export const CLEARANCE = /nur\s+solange|solange\s+(der\s+)?vorrat|nachfolge|ersetzt\s+durch|auslaufend|auslaufartikel|auslaufmodell|liquidation|ausverkauf|abverkauf|only\s+while\s+stocks?|while\s+stocks?\s+last|successor\s+(of|to)|replaced\s+by|discontinued|[ée]puisement|dans\s+la\s+limite\s+des\s+stocks|successeur|remplac[ée]\s+par|esaurimento|successore|sostituito\s+da|liquidazione|zolang\s+de\s+voorraad|opvolger|vervangen\s+door|liquidatie|do\s+wyczerpania|nast[ęe]pca|wyprzeda[żz]/i;

/** Is the product on clearance or replaced - by its name or its address ("...-nur-solange-der-vorrat-reicht.html")? */
export function clearanceOf(name: string, url = ""): boolean {
  const slug = (/\/([^/]+?)(?:\.html)?$/.exec(url)?.[1] ?? "").replace(/[-_]+/g, " ");
  return CLEARANCE.test(name) || CLEARANCE.test(slug);
}

/** A product page's gallery: its pictures as the list shows them (the 279 px "img"), in order - the first is og:image. */
export function galleryOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/"img"\s*:\s*"(https:[^"]+)"/g)) {
    const u = m[1].split("\\/").join("/");
    if (/^https:\/\/(www|acc)\.apsoparts\.com\/media\/catalog\/product\//.test(u) && !out.includes(u)) out.push(u);
    if (out.length >= 8) break;
  }
  return out;
}

/* ── numbers pasted ───────────────────────────────────────────────────── */

/** The numbers in a pasted text: 8-digit products, 10-digit articles (a space or dot inside one is ignored), the rest. */
export function numbersIn(text: string): { products: string[]; articles: string[]; other: string[] } {
  const products: string[] = [];
  const articles: string[] = [];
  const other: string[] = [];
  for (const raw of text.split(/[\s,;|]+/).map((x) => x.trim()).filter(Boolean)) {
    const d = raw.replace(/[.'’-]/g, "");
    if (/^\d{8}$/.test(d)) { if (!products.includes(d)) products.push(d); }
    else if (/^\d{10}$/.test(d)) { if (!articles.includes(d)) articles.push(d); }
    else if (!other.includes(raw)) other.push(raw.slice(0, 30));
  }
  return { products: products.slice(0, 24), articles: articles.slice(0, 24), other: other.slice(0, 12) };
}
