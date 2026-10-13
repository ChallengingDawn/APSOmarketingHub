// WHERE THE 3D GATEWAY'S ADDRESS IS WRITTEN, and how to read it back. Pure - no fetches - so it
// can be tested. SARCLA, 13.10.2026: moving the Railway service must be "change the address,
// paste the snippets", with a settings tab that shows which places still name the old one.
//
// Found on the live shop that day: every page's header carries
//   <script defer src="https://commercehubbackend-production.up.railway.app/pdp3d.js">
// and /{locale}/service/3d-cad-data (six store views) frames
//   <iframe src="https://commercehubbackend-production.up.railway.app/cad?v=anim2&lang=de" ...>
// pdp3d.js and cad.html themselves name the service too (var/const API = '...').

export const SHOP = "https://www.apsoparts.com";
/** The store views that have the "3D CAD data" page (their sitemaps list it). */
export const CAD_LOCALES = ["de-CH", "fr-FR", "it-IT", "nl-NL", "en-INT", "pl-PL"] as const;
export const cadPageUrl = (locale: string) => `${SHOP}/${locale}/service/3d-cad-data`;

/** What goes into Magento's HTML Head (Content > Design > Configuration), every store view. */
export const headerSnippet = (gateway: string) => `<script defer src="${gateway}/pdp3d.js"></script>`;
/** What goes into each store view's "3D CAD data" CMS page - the attributes as found on the live page. */
export const cadSnippet = (gateway: string, locale: string) =>
  `<iframe src="${gateway}/cad?v=anim2&lang=${locale.slice(0, 2)}" style="width:100%;height:1050px;border:0;display:block" title="Download 3D Models" loading="lazy"></iframe>`;

export function originOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).origin : null; } catch { return null; }
}

const unescape = (s: string) => s.replace(/&amp;/g, "&");

/** The address the shop's header loads pdp3d.js from. */
export function scriptOrigin(html: string): string | null {
  const m = /<script[^>]*\ssrc="([^"]*\/pdp3d\.js[^"]*)"/i.exec(html);
  return m ? originOf(unescape(m[1])) : null;
}

/** The address a page frames the catalogue (/cad) from. */
export function iframeOrigin(html: string): string | null {
  for (const m of html.matchAll(/<iframe[^>]*\ssrc="([^"]+)"/gi)) {
    try {
      const u = new URL(unescape(m[1]));
      if (u.pathname === "/cad") return u.origin;
    } catch { /* not an absolute address */ }
  }
  return null;
}

/** What a served file calls home: a written address, or "follows" when it takes its own origin. */
export function apiAddress(source: string): { origin: string | null; follows: boolean } {
  const m = /\b(?:var|const|let)\s+API\s*=\s*([^;\n]+)/.exec(source);
  if (!m) return { origin: null, follows: false };
  if (/currentScript|location\.origin/.test(m[1])) return { origin: null, follows: true };
  const q = /['"]([^'"]+)['"]/.exec(m[1]);
  return { origin: originOf(q?.[1]), follows: false };
}

export type PlaceState = "ok" | "old" | "missing" | "follows" | "error" | "manual";

export function judge(found: string | null, gateway: string): PlaceState {
  if (!found) return "missing";
  return originOf(found) === originOf(gateway) ? "ok" : "old";
}
