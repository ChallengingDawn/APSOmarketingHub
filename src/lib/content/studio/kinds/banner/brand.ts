// THE SHOP'S BRAND, FOR WHAT THE STUDIOS MAKE (08.11.2026). Pure, shared with the browser and with the social studio.
// What a banner or a slide is built from: the shop's colours and type (not the hub's), its own photos, its logo, safe
// addresses, and the two rules every piece follows - no discount value, never Chemours.

/** Where the shop's pictures live. A paste block carries full addresses: a server without the files answers a missing
 *  `{{media url}}` with the grey placeholder logo (seen on ACC, 05.11). */
export const SHOP_ORIGIN = "https://www.apsoparts.com";
export const MEDIA_BASE = `${SHOP_ORIGIN}/media/`;

export const BRAND = {
  petrol: "#274e64",
  red: "#d80901",
  redDark: "#b00700",
  ink: "#1d2326",
  mut: "#4a5257",
  pale: "#e6eef2",
  /** futura-pt is the shop's (Adobe Fonts, loaded by the shop); Jost is the free look-alike the hub embeds for previews and PNGs. */
  head: `"futura-pt", "Jost", "Century Gothic", Arial, sans-serif`,
  body: `Arial, system-ui, sans-serif`,
} as const;

export type ShopPhoto = { key: string; url: string; label: Record<string, string> };

/** The shop's own technology photos, in the menu's order (the newsletter band's six, and the O-ring picture). Real
 *  pictures from the shop - nothing generated. Labels are the menu's names in each store's language. */
export const SHOP_PHOTOS: ShopPhoto[] = [
  { key: "sealing", url: `${MEDIA_BASE}wysiwyg/1_Sealing_Technology_1.jpg`, label: { EN: "Sealing technology", DE: "Dichtungstechnik", FR: "Étanchéité", IT: "Tenute", NL: "Afdichtingstechniek", PL: "Technologia uszczelniania" } },
  { key: "plastics", url: `${MEDIA_BASE}wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg`, label: { EN: "Engineering plastics", DE: "Kunststofftechnik", FR: "Matières plastiques", IT: "Materie plastiche", NL: "Kunststoftechniek", PL: "Tworzywa sztuczne" } },
  { key: "fluid", url: `${MEDIA_BASE}wysiwyg/4_Fluid_Handling_Technology_1.jpg`, label: { EN: "Fluid handling", DE: "Fluidtechnik", FR: "Fluides", IT: "Fluidi", NL: "Industriële slangen", PL: "Technologia manipulowania płynami" } },
  { key: "drive", url: `${MEDIA_BASE}wysiwyg/5_Mechanical_Drive_Technology_1.jpg`, label: { EN: "Drive technology", DE: "Antriebstechnik", FR: "Transmission", IT: "Trasmissioni", NL: "Aandrijftechniek", PL: "Technologia napędowa" } },
  { key: "antivibration", url: `${MEDIA_BASE}wysiwyg/3_Antivibration_Technology_1.jpg`, label: { EN: "Antivibration", DE: "Schwingungstechnik", FR: "Antivibration", IT: "Antivibrazione", NL: "Trillingisolatie", PL: "Technologia przeciwdrganiowa" } },
  { key: "sensors", url: `${MEDIA_BASE}wysiwyg/6_Sensors_Power_1.jpg`, label: { EN: "Sensors & power", DE: "Sensoren & Power", FR: "Capteurs et énergie", IT: "Sensori e potenza", NL: "Sensoren en voeding", PL: "Czujniki i elementy zasilające" } },
  { key: "orings", url: `${MEDIA_BASE}wysiwyg/1_ORings_XRings_1.jpg`, label: { EN: "O-rings & X-rings", DE: "O-Ringe / X-Ringe", FR: "Joints toriques", IT: "O-ring e X-ring", NL: "O-ringen en X-ringen", PL: "O-ringi i X-ringi" } },
];

export const photoLabel = (p: ShopPhoto, lang: string | null | undefined) => p.label[(lang ?? "EN").toUpperCase()] ?? p.label.EN;
export const photoByKey = (key: string) => SHOP_PHOTOS.find((p) => p.key === key) ?? null;

/** The APSOparts word mark (public/brand/apsoparts-logo.svg), cropped to its letters; drawn in the colour it is given. */
const LOGO_PATHS = [
  "M291.6 146.3a41 41 0 0 1-39.2-25.3 54 54 0 0 1-1.1-37.1c5.8-17.4 21.7-28.1 40-28s33.3 10.3 39.3 27.2a53 53 0 0 1-.8 38 40.5 40.5 0 0 1-38.2 25.2m24.1-40c1.3-8.2-.1-16.3-4.8-23.1a24 24 0 0 0-20.4-10.6c-16.8.3-26.7 16.7-24.1 33.7 2 13.2 10.2 23.3 24.3 23.5 14.4.1 22.8-9.9 25-23.4ZM94.4 125.9H64.7l-7 18.1H39.9l33.5-87.9h13.1l32.6 87.9h-18zm-4.7-13.8L79 81.1l-9.4 31.1zM360.1 173.8h-15.9V88.2H360l.4 4.4a22 22 0 0 1 22.1-5.3 25 25 0 0 1 14.4 12.1 35 35 0 0 1-1.6 36 24 24 0 0 1-23.2 10.1q-7-1-11.9-6.5v34.7Zm19.8-45.7c6.3-6.4 6.5-16.7.8-23.3a11.6 11.6 0 0 0-18 0c-5.8 6.7-5.5 17 .7 23.3a11.3 11.3 0 0 0 16.5 0M178.5 94.3c-1.9 9-8.6 14.9-17.4 16.8-5.7 1.2-11.3 1-17.3 1v32h-16.7V76.9l-.2-18.5h23.5q7.4-.1 14.2 2.2c14.3 4.9 16.8 20.4 13.9 33.8Zm-16.7-13.8c-1.6-8.9-11.2-8.2-18.1-8.4V98c3.9 0 7.4 0 11-.8 7.7-1.6 8.3-10.5 7.2-16.7ZM239.1 129c-6.2 17.6-27.8 21.2-40.3 13.6a36 36 0 0 1-12.4-13.1l10.8-10.6c2.2 5.7 6.1 10 11.6 11.9a11 11 0 0 0 14.5-8.2c1.6-6.2-1.3-11.9-7.4-14.5-9.4-4-21.5-7.5-25.1-18.3s-1.5-14.3 1.8-20.7 12.6-13.3 22-13.1 17.2 3.4 23.7 9.4l-8 11.8c-2.8-3.5-5.7-5.9-9.7-6.7s-9.6.6-12.1 4.6c-2.8 4.5-1.3 9.6 3.3 12.1s9.1 4.3 13.9 6.4a25 25 0 0 1 14 14.1 33 33 0 0 1-.6 21.2ZM448.6 144.1l-.2-5.1a21 21 0 0 1-17.7 6.8c-7.5-.7-14-4.8-18.1-11.3-6.7-10.6-7.1-24.4-1-35.4s9.1-10.7 16-12.2a22 22 0 0 1 20.6 5.9l.4-4.7h15.6v55.8zm-3.2-16.4c6.1-6.6 6.1-16.8 0-23.3s-12.5-5.3-17.3-.1a17.3 17.3 0 0 0 .2 23.7c4.8 5 12.1 5 17-.3ZM587.4 143.1a26 26 0 0 1-31.3-6.4l7.2-9.6c4 3.8 8.8 7.8 14.3 6 2.4-.8 3.7-3 3.9-5.1s-1.2-4.5-3.5-5.5l-9.9-4.3a14.4 14.4 0 0 1-9-14.9 17.5 17.5 0 0 1 19.2-16.9c6 .5 12 1.7 16.8 5.8l-6.9 9.3c-3.1-2.6-6.1-4.5-9.8-3.7a5 5 0 0 0-3.7 3.6c-.4 2.1.9 4.1 3 5l10.6 4.6c5.8 2.5 9.1 7.8 9.3 14s-3.2 14.5-10.3 18.1ZM543.4 144h-16.1v-42.2l-5.3-.1V88.2l5.3-.2V69.3l16-.1.1 18.9h9.8v13.6l-9.8.1zM494.6 144h-16.1V88.2h15.9l.4 5.4a16.4 16.4 0 0 1 20.5-5.8l-2 14.6c-5-2.8-10.9-2.8-14.8 1.2a16 16 0 0 0-3.8 10.9zM638.7 73.5a17.6 17.6 0 1 1-34.7-2.8 17.3 17.3 0 0 1 18.6-13.8c8.4.6 15.6 7.3 16.1 16.5Zm-4 1c0-8.5-6.9-14.2-14.7-13.6-7.5.5-13.2 7.1-12.5 14.9s6.8 12.6 13.9 12.4c7.3-.2 13.2-5.9 13.2-13.7Z",
  "m625 83.3-4-6.6a8 8 0 0 0-3.2-.5v7.2h-4V65.2h10.7c3.4 0 5.5 2.2 5.4 5.4s-1.2 5.2-4.8 5.8l4 6.7c-.4.5-3.5.9-4.1.1Zm-.9-10.4c.9 0 2-1.5 1.8-2.3s-1.2-1.8-2-1.8h-6.2l.1 4.3h6.3Z",
];
/** The logo as inline SVG (no file to upload, crisp at every size). Its box is 5:1 - set its height, the width follows. */
export function logoSvg(cls: string, color: string = BRAND.red): string {
  return `<svg class="${cls}" viewBox="36 52 606 126" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="APSOparts" focusable="false">${LOGO_PATHS.map((d) => `<path fill="${color}" d="${d}"/>`).join("")}</svg>`;
}

/** Text into HTML (content and attributes). */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A picture kept in the hub (made from words or uploaded - lib/content/assets.ts): its own path, public, no cookie. */
const HUB_PICTURE = /^\/api\/content\/picture\/\d{1,12}-[A-Za-z0-9_-]{4,40}$/;
export const isHubPicture = (raw: unknown) => HUB_PICTURE.test(String(raw ?? "").trim());

/** A hub picture's full address on `origin` (the hub's), for a page that lives elsewhere; any other address as it is. */
export const absoluteMedia = (url: string, origin: string | null | undefined) =>
  origin && isHubPicture(url) ? `${origin.replace(/\/+$/, "")}${url}` : url;

/**
 * A picture's full address, or "" when it cannot be one: a hub picture keeps its own path; the shop's media paths (`wysiwyg/...`, `/media/...`, a
 * `{{media url='...'}}` directive) become full shop addresses; any other https address stays; nothing else is kept
 * (no data: pictures in a paste block - they would weigh the page down and break Magento's editor).
 */
export function mediaUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (isHubPicture(s)) return s;
  const directive = /^\{\{\s*media\s+url=['"]([^'"]+)['"]\s*\}\}$/.exec(s);
  if (directive) return MEDIA_BASE + directive[1].replace(/^\/+/, "");
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^http:\/\/(www\.)?apsoparts\.com\//i.test(s)) return s.replace(/^http:/i, "https:");
  if (/^\/media\/[^\s"'<>]+$/.test(s)) return SHOP_ORIGIN + s;
  if (/^(wysiwyg|catalog)\/[^\s"'<>]+$/.test(s)) return MEDIA_BASE + s;
  return "";
}

export type Link = { href: string; shopPath: string | null };

/**
 * Where a button goes. A full address stays; "#..." stays; a shop path ("black-friday", "/dichtungstechnik.html") is
 * the shop's own page - in a paste block it becomes `{{store direct_url='...'}}` so each store view links to itself.
 */
export function linkOf(raw: unknown): Link {
  const s = String(raw ?? "").trim();
  if (!s) return { href: "", shopPath: null };
  if (/^https?:\/\/[^\s"'<>]+$/i.test(s)) return { href: s, shopPath: null };
  if (/^#[\w-]*$/.test(s)) return { href: s, shopPath: null };
  if (/^mailto:[^\s"'<>]+$/i.test(s)) return { href: s, shopPath: null };
  const path = s.replace(/^\/+/, "");
  if (/^[A-Za-z0-9][A-Za-z0-9/_.\-]*(\?[A-Za-z0-9=&_.\-]*)?$/.test(path)) return { href: `${SHOP_ORIGIN}/${path}`, shopPath: path };
  return { href: "", shopPath: null };
}

/** The address for a paste block: a shop path as the store's own link, else the address itself. */
export function pasteHref(raw: unknown): string {
  const l = linkOf(raw);
  // cv16: a page picked with "Find a page" carries its store view ("/de-CH/..."): that exact page, as a full address - a
  // store's own link would put the store view in twice
  if (l.shopPath && /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?\//.test(l.shopPath)) return l.href;
  return l.shopPath ? `{{store direct_url='${l.shopPath}'}}` : l.href;
}

const DISCOUNT_WORDS = "(off|rabatt|discount|sale|save|sparen|remise|réduction|reduction|sconto|korting|rabat|zniżk\\w*|promo)";
/**
 * The brand's two hard rules, read in a text: a discount value never appears (not even "up to 20%"), and Chemours is
 * never named. Each finding is a short sentence for the studio to show; [] = clean.
 */
/** A stock or delivery promise, in the shop's languages. */
export const STOCK_WORDS = /\b(ab lager|auf lager|lagernd|lagerhaltig|sofort lieferbar|in stock|en stock|disponible en stock|disponibile a magazzino|pronta consegna|op voorraad|na stanie)\b/i;

export function brandFlags(text: string): string[] {
  const t = String(text ?? "");
  const out: string[] = [];
  const pct = new RegExp(`(-\\s?\\d+\\s?%|\\d+\\s?%\\s*${DISCOUNT_WORDS}|${DISCOUNT_WORDS}\\s+(of\\s+|von\\s+|de\\s+)?(up\\s+to\\s+|bis\\s+zu\\s+|jusqu'à\\s+)?\\d+\\s?%|(up\\s+to|bis\\s+zu|jusqu'à|fino\\s+al|tot)\\s+-?\\d+\\s?%)`, "i");
  const m = pct.exec(t);
  if (m) out.push(`No discount values on our pieces - take out "${m[0].trim()}".`);
  else if (/\d+\s?%/.test(t) && new RegExp(DISCOUNT_WORDS, "i").test(t)) out.push("A percentage next to a discount word reads as a discount value - check it.");
  if (/chemours/i.test(t)) out.push("Never name Chemours.");
  // no stock or delivery promise either (SARCLA's rule: never stock or delivery times without real data; "ab Lager" came
  // back in a banner's sample words, 10.11.2026)
  const stock = STOCK_WORDS.exec(t);
  if (stock) out.push(`No stock or delivery promises on our pieces - take out "${stock[0].trim()}".`);
  return out;
}
