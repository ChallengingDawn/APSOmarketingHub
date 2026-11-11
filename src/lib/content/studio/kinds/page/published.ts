// A PAGE ONCE IT IS IN MAGENTO: ITS ADDRESSES, AND ITS A/B TEST (Content v12, 10.11.2026). Pure: no "@/" imports - the
// last step (src/app/projects/studio/kinds/page/Publish.tsx), the server (./server.ts magentoPublish) and the tests.
//
// SARCLA 10.11.2026, 23:10, after his first publish to ACC: "if already created I should have the link". The last step said
// "en-INT: created (page #738) for en-INT, en-CH/eur, en-CH, ..." and nothing to click. Each store view written is a page
// of its own on that shop - its address the store view, then the page's URL key: https://acc.apsoparts.com/en-CH/eur/
// kalrez-6221-6230-discontinued on ACC, https://www.apsoparts.com/... on production. They are listed from the to-do's own
// records of what it wrote (the document's `magento`), so they are there again when the page is opened tomorrow.
//
// SARCLA 23:45: "on send to Magento you should add another button - set up A/B testing optimization". A page in Magento
// gets "Set up an A/B test": AI testing & personalization's preview of that page, its question box open, in a new tab -
// its PATH (agreed with the app's owner: never the whole address), one store view per button.

import { shopOrder } from "./storeViews";

export type ShopEnv = "acc" | "prod";

/** The shops a page is written into. */
export const SHOP_BASE: Record<ShopEnv, string> = { acc: "https://acc.apsoparts.com", prod: "https://www.apsoparts.com" };
export const SHOP_LABEL: Record<ShopEnv, string> = { acc: "ACC", prod: "production" };

/** A page's address on a shop: its store view ("en-CH/eur"), then its URL key. */
export function pageAddress(env: ShopEnv, store: string, identifier: string): string {
  const key = String(identifier ?? "").trim().replace(/^\/+/, "");
  const view = String(store ?? "").trim().replace(/^\/+|\/+$/g, "");
  return `${SHOP_BASE[env]}/${view}/${key}`;
}

/** An address's path ("https://acc.apsoparts.com/en-INT/x" -> "/en-INT/x"); a path stays a path. */
export function pathOf(url: string): string {
  const s = String(url ?? "").trim();
  const m = /^https?:\/\/[^/]+(\/[^?#]*)?/i.exec(s);
  const p = m ? m[1] ?? "/" : s.split(/[?#]/)[0];
  return p.startsWith("/") ? p : `/${p}`;
}

/** What the to-do wrote, as the document keeps it (model.ts MagentoRecord - only what is read here). */
export type WrittenRecord = { env: ShopEnv; store: string; pageId: string; identifier: string; action: "created" | "updated" | "restored" | "switched-off"; at: string; url: string };

/** A page of the to-do on a shop now: its store view, its address, Magento's page number, when it was written. */
export type LivePage = { store: string; url: string; path: string; pageId: string; at: string; action: WrittenRecord["action"] };

/**
 * The pages the to-do has on a shop now, one per store view - the newest record of each (records come newest first), the
 * ones switched off left out - in the shop's order of store views (Magento's Store View list).
 */
export function liveOn(records: readonly WrittenRecord[], env: ShopEnv): LivePage[] {
  const seen = new Set<string>();
  const out: LivePage[] = [];
  for (const r of records) {
    if (r.env !== env || seen.has(r.store)) continue;
    seen.add(r.store);
    if (r.action === "switched-off") continue;
    const url = r.identifier ? pageAddress(env, r.store, r.identifier) : r.url;
    if (!url) continue;
    out.push({ store: r.store, url, path: pathOf(url), pageId: r.pageId, at: r.at, action: r.action });
  }
  return out.sort((a, b) => shopOrder(a.store) - shopOrder(b.store) || a.store.localeCompare(b.store));
}

/** The newest write on a shop (null: never written there). */
export function lastWrite(records: readonly WrittenRecord[], env: ShopEnv): WrittenRecord | null {
  return records.find((r) => r.env === env) ?? null;
}

/**
 * AI testing & personalization's preview of a page with its question box open (`ask=1`), told it comes from this to-do -
 * the page's PATH only, encoded (the app's owner, hubspot-orders-cf, 10.11.2026).
 */
export function abTestHref(env: ShopEnv, path: string, pieceId: number | string): string {
  const p = pathOf(path);
  return `/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(p)}&ask=1&from=content&piece=${encodeURIComponent(String(pieceId))}`;
}

/** The store view an A/B test starts on: the one the person works on when the page is there, else the version's first
 * (its main store view - en-INT for English), else the first page there. */
export function abStore(pages: readonly LivePage[], prefer: readonly (string | null | undefined)[]): LivePage | null {
  for (const s of prefer) { const hit = s ? pages.find((p) => p.store === s) : null; if (hit) return hit; }
  return pages[0] ?? null;
}

/* ── changed since its publish (Content v12, SARCLA 10.11.2026: "also I should be able to update current pages after
 *    changes here") ── */

/** A version on a shop: when it was last written there, into how many store views, and whether the page has changed
 * since (what Magento would get now is not what it got then). */
export type Since = { at: string; pages: number; changed: boolean };

/** For each shop, the version's pages as written there (the to-do's backups: their content as Magento got it) against
 * what it would send now - null content: a page of the shop (its change list is laid into Magento's own content), not
 * compared. */
export function sinceOf(content: string | null, stores: readonly string[], written: readonly { env: ShopEnv; view: string; at: string; content: string }[]): Partial<Record<ShopEnv, Since>> {
  const out: Partial<Record<ShopEnv, Since>> = {};
  if (content === null) return out;
  for (const env of ["acc", "prod"] as ShopEnv[]) {
    const rows = written.filter((w) => w.env === env && stores.includes(w.view));
    if (!rows.length) continue;
    const at = rows.map((r) => r.at).sort().at(-1)!;
    out[env] = { at, pages: rows.length, changed: rows.some((r) => r.content !== content) };
  }
  return out;
}
