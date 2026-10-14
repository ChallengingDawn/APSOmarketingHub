// DIRECTUP - is it installed on the shop? Read live, per store view (SARCLA, 14.10.2026: "can we also read the
// header and footer html via Magento API?" - not as the shop stands: its GraphQL, the one API that hands out
// head_includes and absolute_footer, answers 404 on production (500 earlier), and its REST API has no endpoint
// for Content > Design > Configuration). So the store views' DirectUP pages are read as a customer gets them,
// after the cache, and three things are looked for:
//   - the footer bridge (Footer > Miscellaneous HTML): its version, from `var BRIDGE = '...'` in the code;
//   - the head snippet (HTML Head > Scripts and Style Sheets): the preconnect to the gateway - optional;
//   - the page snippet (Content > Pages > DirectUP): the iframe and the address it frames.
// The store views are the ones the page itself declares (its hreflang links) plus any seen in DirectUP's visits.

import https from "node:https";
import zlib from "node:zlib";

export const SHOP = "https://www.apsoparts.com";
const UA = "Mozilla/5.0 (compatible; APSOhub DirectUP check)";

export type PageState = "this" | "other" | "missing";
export type StoreCheck = {
  locale: string;
  url: string;
  /** null when the page could not be read at all */
  error: string | null;
  /** the footer bridge's version, e.g. "v9-tools"; null = no bridge in the page */
  footer: string | null;
  /** the head snippet's preconnect to this gateway */
  head: boolean;
  page: PageState;
  /** the address the page's iframe frames, when it is another one */
  pageOrigin: string | null;
};
export type ShopCheck = { checkedAt: string; gateway: string; stores: StoreCheck[] };

/**
 * A page read with Node's LENIENT HTTP parser: the shop sends its large pages with a malformed chunk size,
 * which Node's fetch stops on ("terminated", HPE_INVALID_CHUNK_SIZE) - curl and browsers read them. Learnt on
 * the 3D page's settings check (src/lib/threeD/gateway.ts), 14.10.2026.
 */
export function readPage(url: string, timeoutMs = 20_000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { insecureHTTPParser: true, headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("error", reject);
      res.on("end", () => {
        let body = Buffer.concat(chunks);
        if (res.headers["content-encoding"] === "gzip") {
          try { body = zlib.gunzipSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch (e) { return reject(e as Error); }
        }
        resolve({ status: res.statusCode ?? 0, body: body.toString("utf8") });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`no answer in ${timeoutMs / 1000} s`)));
    req.on("error", reject);
  });
}

/** What one page says about the three snippets. Pure, so it is tested. */
export function inspect(html: string, gateway: string): Pick<StoreCheck, "footer" | "head" | "page" | "pageOrigin"> {
  const host = gateway.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const footer = /var\s+BRIDGE\s*=\s*'([^']+)'/.exec(html)?.[1] ?? /__directupBridge\s*=\s*'([^']+)'/.exec(html)?.[1] ?? null;
  const head = new RegExp(`<link[^>]+rel=["']preconnect["'][^>]+href=["']https://${host.replace(/\./g, "\\.")}`, "i").test(html);
  const src = /<iframe[^>]+src=["']([^"']*\/landing\/tools\/directup[^"']*)["']/i.exec(html)?.[1] ?? null;
  let origin: string | null = null;
  try { origin = src ? new URL(src.replace(/&amp;/g, "&")).origin : null; } catch { origin = null; }
  const page: PageState = !src ? "missing" : origin === `https://${host}` ? "this" : "other";
  return { footer, head, page, pageOrigin: page === "other" ? origin : null };
}

/** The store views the page declares in its hreflang links, as locale -> address (query dropped). */
export function declared(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*hreflang=["'][^"']+["']/gi)) {
    const href = m[1].split("?")[0];
    const loc = /^https:\/\/[^/]+\/([a-z]{2}-[A-Za-z]{2,3})\//.exec(href)?.[1];
    if (loc && !out.has(loc)) out.set(loc, href);
  }
  return out;
}

let held: { at: number; gateway: string; data: ShopCheck } | null = null;
const KEEP_MS = 10 * 60_000;

/** Every store view's DirectUP page, a few at a time; kept ten minutes unless asked again. */
export async function checkShop(gateway: string, seen: string[], fresh = false): Promise<ShopCheck> {
  if (!fresh && held && held.gateway === gateway && Date.now() - held.at < KEEP_MS) return held.data;
  // a recheck within a minute of the last one gets the last one: each check is a dozen shop page loads
  if (fresh && held && held.gateway === gateway && Date.now() - held.at < 60_000) return held.data;

  const first = await readPage(`${SHOP}/fr-CH/directup`).catch(() => null);
  const pages = first && first.status < 400 ? declared(first.body) : new Map<string, string>();
  const slug = /\/[a-z]{2}-[A-Za-z]{2,3}\/([^/?#]+)$/.exec([...pages.values()][0] ?? "")?.[1] ?? "directup";
  for (const loc of seen) if (/^[a-z]{2}-[A-Za-z]{2,3}$/.test(loc) && !pages.has(loc)) pages.set(loc, `${SHOP}/${loc}/${slug}`);
  if (!pages.size) pages.set("fr-CH", `${SHOP}/fr-CH/directup`);

  const list = [...pages.entries()].sort(([a], [b]) => a.localeCompare(b));
  const stores: StoreCheck[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const k = next++;
      const [locale, url] = list[k];
      try {
        const r = locale === "fr-CH" && first && first.status < 400 ? first : await readPage(url);
        if (r.status >= 400) stores[k] = { locale, url, error: r.status === 404 ? "no DirectUP page in this store view (404)" : `HTTP ${r.status}`, footer: null, head: false, page: "missing", pageOrigin: null };
        else stores[k] = { locale, url, error: null, ...inspect(r.body, gateway) };
      } catch (e) {
        stores[k] = { locale, url, error: String((e as Error)?.message ?? e), footer: null, head: false, page: "missing", pageOrigin: null };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const data: ShopCheck = { checkedAt: new Date().toISOString(), gateway, stores };
  held = { at: Date.now(), gateway, data };
  return data;
}
