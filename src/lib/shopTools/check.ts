// Is a shop tool installed? Each store view's page for it, read live as a customer gets it (the shop's APIs cannot
// hand out the configured HTML - see src/lib/directup/check.ts). For each store view: the footer bridge's version
// (it gives the tool's frame its height - v10 knows the tools' own gateways) and the address the page frames:
// this gateway, PricingHub (where the tools lived until 14.10.2026), another, or none.
// The store views are the ones the first page declares (its hreflang links), on production or on ACC.

import { declared, readPage } from "../directup/check";

export type ShopHost = "www" | "acc";
export type ToolPageState = "this" | "pricinghub" | "other" | "missing";
export type ToolStoreCheck = {
  locale: string; url: string; error: string | null;
  footer: string | null; page: ToolPageState; pageOrigin: string | null;
};
export type ToolCheck = { checkedAt: string; host: ShopHost; path: string; gateway: string; stores: ToolStoreCheck[] };

const PRICINGHUB = "https://commercehubbackend-production.up.railway.app";
const STORE_VIEWS = ["de-CH", "fr-CH", "it-CH", "de-DE", "en-DE", "fr-FR", "it-IT", "nl-NL", "pl-PL", "en-INT", "de-INT", "fr-INT", "it-INT", "nl-INT"];

/** What one page says: the footer bridge's version, and where its frame for this tool points. Pure, tested. */
export function inspectTool(html: string, page: string, gateway: string): Pick<ToolStoreCheck, "footer" | "page" | "pageOrigin"> {
  const footer = /var\s+BRIDGE\s*=\s*'([^']+)'/.exec(html)?.[1] ?? /__directupBridge\s*=\s*'([^']+)'/.exec(html)?.[1] ?? null;
  // every frame on the page; the one for this tool is /landing/tools/<page>, maybe .html, then the query or the end
  const own = new RegExp(`/landing/tools/${page}(\\.html)?(\\?|$)`);
  let src: string | null = null;
  for (const m of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    if (own.test(m[1].replace(/&amp;/g, "&"))) { src = m[1]; break; }
  }
  let origin: string | null = null;
  try { origin = src ? new URL(src.replace(/&amp;/g, "&")).origin : null; } catch { origin = null; }
  const state: ToolPageState = !origin ? "missing" : origin === gateway.replace(/\/+$/, "") ? "this" : origin === PRICINGHUB ? "pricinghub" : "other";
  return { footer, page: state, pageOrigin: state === "other" ? origin : null };
}

const held = new Map<string, { at: number; data: ToolCheck }>();
const KEEP_MS = 10 * 60_000;

export async function checkTool(opts: { tool: string; page: string; gateway: string; host: ShopHost; path: string; fresh?: boolean }): Promise<ToolCheck> {
  const key = [opts.tool, opts.host, opts.path, opts.gateway].join("|");
  const had = held.get(key);
  if (had && (!opts.fresh ? Date.now() - had.at < KEEP_MS : Date.now() - had.at < 60_000)) return had.data;

  const shop = `https://${opts.host}.apsoparts.com`;
  // the page declares the store views it exists in; the first that answers tells
  let list: [string, string][] = [];
  for (const first of ["de-CH", "en-INT"]) {
    const r = await readPage(`${shop}/${first}/${opts.path}`).catch(() => null);
    if (r && r.status < 400) {
      const d = declared(r.body);
      if (d.size) list = [...d.entries()].map(([l, u]) => [l, u.replace(/^https:\/\/[^/]+/, shop)] as [string, string]);
      break;
    }
  }
  if (!list.length) list = STORE_VIEWS.map((l) => [l, `${shop}/${l}/${opts.path}`]);
  list.sort(([a], [b]) => a.localeCompare(b));

  const stores: ToolStoreCheck[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const k = next++;
      const [locale, url] = list[k];
      try {
        const r = await readPage(url);
        stores[k] = r.status >= 400
          ? { locale, url, error: r.status === 404 ? "no such page in this store view (404)" : `HTTP ${r.status}`, footer: null, page: "missing", pageOrigin: null }
          : { locale, url, error: null, ...inspectTool(r.body, opts.page, opts.gateway) };
      } catch (e) {
        stores[k] = { locale, url, error: String((e as Error)?.message ?? e), footer: null, page: "missing", pageOrigin: null };
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const data: ToolCheck = { checkedAt: new Date().toISOString(), host: opts.host, path: opts.path, gateway: opts.gateway, stores };
  held.set(key, { at: Date.now(), data });
  return data;
}
