// Magento REST, read-only (OAuth 1.0a) - the shop orders behind the DoC app.
//
// Moved here from SARCLA C2S V1 with the signing it proved against the shop:
// a fresh nonce per call, Connection: close (Magento rejects keep-alive nonce
// replays), a retry only on 401, and node's https with insecureHTTPParser
// because apsoparts.com sends a chunked body the strict parser refuses.

import crypto from "node:crypto";
import { request as httpsRequest } from "node:https";
import { magentoKeys } from "./config";

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method: string, url: string): string {
  const k = magentoKeys();
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: k.consumerKey,
    oauth_token: k.accessToken,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };
  const params: Record<string, string> = { ...oauth };
  for (const [key, v] of u.searchParams) params[key] = v;
  const base = Object.keys(params).sort().map((key) => pct(key) + "=" + pct(params[key])).join("&");
  const baseStr = method.toUpperCase() + "&" + pct(u.origin + u.pathname) + "&" + pct(base);
  oauth.oauth_signature = crypto
    .createHmac("sha256", pct(k.consumerSecret) + "&" + pct(k.accessSecret))
    .update(baseStr)
    .digest("base64");
  return "OAuth " + Object.keys(oauth).map((key) => pct(key) + '="' + pct(oauth[key]) + '"').join(", ");
}

function getJsonOnce(url: string): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      resolve({ status: 0, json: null });
      return;
    }
    const req = httpsRequest(
      {
        method: "GET",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          Authorization: authHeader("GET", url),
          Accept: "application/json",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
        timeout: 25_000,
        insecureHTTPParser: true,
      },
      (resp) => {
        const chunks: Buffer[] = [];
        resp.on("data", (c: Buffer) => chunks.push(c));
        resp.on("end", () => {
          let json: unknown = null;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            /* not JSON */
          }
          resolve({ status: resp.statusCode ?? 0, json });
        });
        resp.on("error", () => resolve({ status: 0, json: null }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve({ status: 0, json: null }));
    req.end();
  });
}

async function getJson(url: string): Promise<unknown> {
  for (let i = 0; i < 3; i++) {
    const r = await getJsonOnce(url);
    if (r.status === 200) return r.json;
    if (r.status !== 401) return null;
    await new Promise((res) => setTimeout(res, 150 + i * 200));
  }
  return null;
}

type RawOrder = {
  increment_id: string;
  entity_id?: number;
  created_at?: string;
  customer_email?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  billing_address?: { company?: string; country_id?: string };
  items?: { sku?: string; name?: string; qty_ordered?: number; parent_item_id?: number | null }[];
};

type OrderPage = { items?: RawOrder[]; total_count?: number };

export type ShopOrderSkus = { incrementId: string; createdAt: string; skus: string[] };

/**
 * Shop orders created since `sinceUtc` ("YYYY-MM-DD HH:MM:SS", UTC) - number, date
 * and SKUs only, the cheap way to find the orders carrying one particular line.
 * Throws when the shop does not answer: a capture that saw nothing must not look
 * like a capture that found nothing.
 */
export async function orderSkusCreatedSince(sinceUtc: string, maxPages = 20): Promise<ShopOrderSkus[]> {
  const base = magentoKeys().base;
  const out: ShopOrderSkus[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = [
      "searchCriteria[filterGroups][0][filters][0][field]=created_at",
      `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(sinceUtc)}`,
      "searchCriteria[filterGroups][0][filters][0][conditionType]=gteq",
      "searchCriteria[pageSize]=100",
      `searchCriteria[currentPage]=${page}`,
      // encoded: with raw brackets in `fields` the shop drops the connection
      `fields=${encodeURIComponent("total_count,items[increment_id,created_at,items[sku]]")}`,
    ].join("&");
    // The shop resets this connection now and then; a few gentle retries, never a
    // burst - its WAF bans those.
    let j: OrderPage | null = null;
    for (const wait of [0, 2000, 5000]) {
      if (wait) await new Promise((res) => setTimeout(res, wait));
      j = (await getJson(`${base}/rest/V1/orders?${qs}`)) as OrderPage | null;
      if (j) break;
    }
    if (!j) throw new Error("Magento order window query failed");
    const items = j.items ?? [];
    for (const o of items) {
      out.push({
        incrementId: o.increment_id,
        createdAt: o.created_at ?? "",
        skus: (o.items ?? []).map((i) => String(i.sku ?? "").trim()),
      });
    }
    // Magento repeats the last page past the end - stop on a short page or the total
    if (items.length < 100 || out.length >= (j.total_count ?? 0)) break;
  }
  return out;
}

export type ShopOrder = {
  incrementId: string;
  createdAt: string;
  company: string;
  email: string;
  country: string;
  items: { sku: string; name: string; qty: number }[];
};

/** One shop order by its number (increment_id), or null when the shop has no such order. */
export async function orderByIncrementId(incrementId: string): Promise<ShopOrder | null> {
  const base = magentoKeys().base;
  const qs = [
    "searchCriteria[filterGroups][0][filters][0][field]=increment_id",
    `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(incrementId)}`,
    "searchCriteria[filterGroups][0][filters][0][conditionType]=eq",
    "searchCriteria[pageSize]=1",
  ].join("&");
  const j = (await getJson(`${base}/rest/V1/orders?${qs}`)) as { items?: RawOrder[] } | null;
  const o = j && Array.isArray(j.items) ? j.items[0] : null;
  if (!o) return null;
  return {
    incrementId: o.increment_id,
    createdAt: o.created_at ?? "",
    company:
      o.billing_address?.company ||
      [o.customer_firstname, o.customer_lastname].filter(Boolean).join(" ") ||
      "unknown company",
    email: o.customer_email ?? "",
    country: o.billing_address?.country_id ?? "",
    // parent-less simple items only (configurables duplicate their child rows)
    items: (o.items ?? [])
      .filter((it) => !it.parent_item_id)
      .map((it) => ({ sku: String(it.sku ?? "").trim(), name: dedupeName(it.name), qty: Number(it.qty_ordered) || 0 })),
  };
}

export type ShopOrderRef = { incrementId: string; createdAt: string; company: string; country: string };

/**
 * The most recent shop orders carrying one article line - newest first. Two
 * requests whatever the period: the order ITEMS are searched by sku, then their
 * orders by entity id. The id list MUST be encoded: a raw comma in the value
 * makes the shop drop the connection.
 */
export async function recentOrdersWithSku(sku: string, limit = 25): Promise<ShopOrderRef[]> {
  const base = magentoKeys().base;
  const itemsQs = [
    "searchCriteria[filterGroups][0][filters][0][field]=sku",
    `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(sku)}`,
    "searchCriteria[filterGroups][0][filters][0][conditionType]=eq",
    "searchCriteria[sortOrders][0][field]=created_at",
    "searchCriteria[sortOrders][0][direction]=DESC",
    `searchCriteria[pageSize]=${limit}`,
    `fields=${encodeURIComponent("items[order_id]")}`,
  ].join("&");
  const items = (await getJsonGently(`${base}/rest/V1/orders/items?${itemsQs}`)) as { items?: { order_id: number }[] } | null;
  if (!items) throw new Error("Magento order item search failed");
  const ids = [...new Set((items.items ?? []).map((i) => i.order_id))];
  if (!ids.length) return [];

  const ordersQs = [
    "searchCriteria[filterGroups][0][filters][0][field]=entity_id",
    `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(ids.join(","))}`,
    "searchCriteria[filterGroups][0][filters][0][conditionType]=in",
    `searchCriteria[pageSize]=${ids.length}`,
    `fields=${encodeURIComponent("items[increment_id,created_at,customer_firstname,customer_lastname,billing_address[company,country_id]]")}`,
  ].join("&");
  const orders = (await getJsonGently(`${base}/rest/V1/orders?${ordersQs}`)) as { items?: RawOrder[] } | null;
  if (!orders) throw new Error("Magento order lookup failed");
  return (orders.items ?? [])
    .map((o) => ({
      incrementId: o.increment_id,
      createdAt: o.created_at ?? "",
      company: o.billing_address?.company || [o.customer_firstname, o.customer_lastname].filter(Boolean).join(" ") || "",
      country: o.billing_address?.country_id ?? "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The shop resets connections now and then: a few spaced retries, never a burst. */
async function getJsonGently(url: string): Promise<unknown> {
  for (const wait of [0, 2000, 5000]) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    const j = await getJson(url);
    if (j) return j;
  }
  return null;
}

// Some shop lines carry the product name twice ("PMMA-GS Platte transparent klar
// PMMA -GS Platte transparent klar # 2200 x 800 x 3 mm"). Say it once: compare on
// letters and digits only, and dedupe the name ahead of any "# size" tail.
export function dedupeName(raw: string | null | undefined): string {
  const t = String(raw ?? "").replace(/\s+/g, " ").trim();
  const hash = t.indexOf("#");
  const head = (hash >= 0 ? t.slice(0, hash) : t).trim();
  const tail = hash >= 0 ? ` ${t.slice(hash).trim()}` : "";
  const key = head.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key.length < 2 || key.length % 2 !== 0) return t;
  const half = key.length / 2;
  if (key.slice(0, half) !== key.slice(half)) return t;
  let seen = 0;
  for (let i = 0; i < head.length; i++) {
    if (/[a-z0-9]/i.test(head[i])) seen++;
    if (seen === half) return head.slice(0, i + 1).trim() + tail;
  }
  return t;
}
