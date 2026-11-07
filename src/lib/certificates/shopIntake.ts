// CERTIFICATES - a ticket from the shop order (SARCLA 06.11.2026: "would it be possible to detect the certificate via
// the magento order and auto create the ticket?" - "go, but is the detection really working seamless").
//
// Checked 06.11.2026 in HubSpot, since 01.09: 100 ERP orders carried the shop's plastics declaration line (8001133004).
// The Back Office made a certificate ticket for 86 of them - 22 the same day, 35 the next, 28 later - and 85 of the 94
// certificate tickets of those weeks came from such an order; 7 orders were invoiced with no certificate ticket at all.
// Seals (8001228582) are the DoC app's (Website > Microservices > DoC), which mails the declaration itself.
//
// Every look (3 minutes): the shop's orders with the line, from the shop sync's own table (apsomh_mg_stage - no call
// to the shop) -> the ERP's order number: on the web order (stamped within about 15 minutes), on the ERP's own order
// that carries the web number (a web order merged into it), else asked of the shop itself (SARCLA 07.11.2026: "the ERP
// number is on the shop, we should see it here" - an order the shop had already sent to the ERP when the shop sync
// first saw it never gets a web order in HubSpot, so nothing else carries its number) -> a certificate ticket
// already there (the Back Office's)? -> which certificate: the shop's line options if they carry it, else the ERP's
// order comment (it comes with the next ERP file) -> the ticket, already started as the process starts one: stage
// Certificates, EC 1935/2004 = AVOR (owner = the requester, the next of the Back Office rotation), else the Back Office
// rotation; the company, the contact and the order linked; a note. Preview lists what it would create; Live creates -
// only for orders the shop sync first saw after Live was switched on (older ones stay the Back Office's).

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { erpNumberFromShop } from "@/lib/connectors/steps/files";
import { magentoGet } from "@/lib/doc/magento";
import { deliveriesOf, erpRequests } from "./erpData";
import { FEE_PLASTICS, FEE_SKUS, SHOP_DONE, articlesIn, baseOf, certsOf, pickDelivery, positionsText, typesInOptions, type ErpRequest, type ShopState } from "./erpRules";
import { ACT, BO_PIPELINE, CATEGORY, EC1935, HEAD, STAGE, certsText, dueShort } from "./rules";

type Obj = { id: string; properties: Record<string, string | null> };
const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const KV = { rows: "certificates:shop" };
/** a ticket's associations (as the DoC app creates its tickets), and the primary company */
const ASSOC = { orders: 526, contacts: 16, companies: 339 } as const;
const PRIMARY_COMPANY = 26;
const LOOK_BACK_DAYS = 14;
/** which certificate still unknown this long after the order: left to the Back Office */
const TYPE_WAIT_DAYS = 6;
const PER_LOOK = 8;
const RECHECK_MS = 20 * 60_000;
/** the shop asked for an A-number (about 23 questions each): a few orders per look, each at most every 20 minutes */
const SHOP_ASKS_PER_LOOK = 3;

export type ShopMode = "off" | "preview" | "live";
export type ShopRow = {
  entity: string; web: string; seenAt: string; orderedAt: string | null; customer: string | null; mandant: string | null;
  lines: string[]; state: ShopState; at: string;
  a?: string | null; company?: string | null; companyId?: string | null; contactId?: string | null; orderIds?: string[];
  certs?: string[]; other?: string | null; pos?: string | null; typeFrom?: "shop" | "erp" | "ticket" | null; due?: string | null;
  /** the shop's own line options, as read once (what they say, for the page); probeError = why they could not be read */
  shopOptions?: string[]; probed?: boolean; probeError?: string;
  /** where the A-number came from; when the shop was last asked for it; the web order in HubSpot, when it is there */
  numberFrom?: "web order" | "ERP order" | "shop"; askedAt?: string; webOrderId?: string | null;
  ticket?: { id: string; at: string; by: "hub" | "hand"; subject?: string | null };
  /** Preview: the ticket the hub would create */
  would?: { subject: string; owner: string | null; avor: boolean };
  /** when the hub first had the ticket ready (Preview) - against the Back Office's own ticket */
  wouldAt?: string;
  why?: string; error?: string;
};

const digits = (a: string) => a.slice(4);
const isCertTicket = (p: Record<string, string | null>) => !!(p.which_certificate__ || p.enquiry_category === CATEGORY || /certif|konformit/i.test(p.subject ?? ""));

/** The Back Office tickets naming this ERP order or the shop order. */
async function ticketsFor(a: string | null, web: string): Promise<Obj[]> {
  const groups = [
    ...(a ? [{ filters: [{ propertyName: "order_number", operator: "CONTAINS_TOKEN", value: `*${digits(a)}*` }] }, { filters: [{ propertyName: "subject", operator: "CONTAINS_TOKEN", value: `*${digits(a)}*` }] }] : []),
    { filters: [{ propertyName: "order_number", operator: "CONTAINS_TOKEN", value: `*${web}*` }] },
    { filters: [{ propertyName: "subject", operator: "CONTAINS_TOKEN", value: `*${web}*` }] },
  ];
  const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: groups, properties: ["subject", "order_number", "which_certificate__", "other_certificates", "enquiry_category", "createdate", "hs_pipeline"], limit: 50,
  });
  return (j.results ?? []).filter((t) => {
    const text = `${t.properties.order_number ?? ""} ${t.properties.subject ?? ""}`;
    return (a && text.includes(digits(a))) || text.includes(web);
  });
}

/** The shop's line options, read once: any value naming a certificate (a list value's own words when it is an id). */
async function shopOptions(entity: string): Promise<string[]> {
  const qs = [
    "searchCriteria[filterGroups][0][filters][0][field]=entity_id", `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(entity)}`,
    "searchCriteria[filterGroups][0][filters][0][conditionType]=eq", "searchCriteria[pageSize]=1",
    `fields=${encodeURIComponent("items[items[sku,product_option]]")}`,
  ].join("&");
  const r = await magentoGet(`/rest/V1/orders?${qs}`, 30_000);
  if (r.status !== 200) throw new Error(`the shop answered ${r.status || "nothing"}`);
  type Item = { sku?: string; product_option?: { extension_attributes?: { custom_options?: { option_id?: string; option_value?: string }[] } } };
  const items = ((r.json as { items?: { items?: Item[] }[] })?.items?.[0]?.items ?? []);
  const out: string[] = [];
  for (const it of items) {
    const opts = it.product_option?.extension_attributes?.custom_options ?? [];
    let titles: Map<string, string> | null = null;
    for (const o of opts) {
      const v = String(o.option_value ?? "").trim();
      if (!v) continue;
      // the cut option is a JSON text (baseSku, the sizes ...): its words, in case one names the certificate
      if (v.startsWith("{") || v.startsWith("[")) {
        try {
          const leaves: string[] = [];
          const walk = (x: unknown) => { if (typeof x === "string") leaves.push(x); else if (x && typeof x === "object") Object.values(x).forEach(walk); };
          walk(JSON.parse(v));
          out.push(...leaves.map((x) => x.trim()).filter((x) => x && x.length <= 120 && /[a-z]/i.test(x)));
        } catch { /* not JSON after all */ }
        continue;
      }
      if (/^\d+(,\d+)*$/.test(v) && it.sku) {
        // a list value: its id -> its words, from the product's options
        if (!titles) {
          titles = new Map();
          const p = await magentoGet(`/rest/V1/products/${encodeURIComponent(it.sku)}/options`, 30_000).catch(() => ({ status: 0, json: null }));
          for (const opt of (p.status === 200 ? (p.json as { values?: { option_type_id?: number; title?: string }[] }[]) : []) ?? []) for (const val of opt.values ?? []) if (val.option_type_id) titles.set(String(val.option_type_id), String(val.title ?? ""));
        }
        for (const id of v.split(",")) { const t = titles.get(id); if (t) out.push(t); }
      } else out.push(v.slice(0, 120));
    }
  }
  return [...new Set(out)];
}

async function assocIds(orderId: string, to: "companies" | "contacts"): Promise<string[]> {
  const j = await hs<{ results?: { toObjectId: string | number }[] }>(`/crm/v4/objects/orders/${orderId}/associations/${to}`).catch(() => ({ results: [] }));
  return (j.results ?? []).map((x) => String(x.toObjectId));
}

/**
 * One look. pick(): the next of the Back Office rotation (the engine moves it on only when the ticket was created).
 * create: Live, the certificates engine writing, and the order first seen after Live was switched on.
 */
export async function shopPass(opts: {
  mode: ShopMode; writing: boolean; from: string | null; pick: () => string | null; taken: () => void;
}): Promise<{ created: number; listed: number; error?: string }> {
  const out = { created: 0, listed: 0 } as { created: number; listed: number; error?: string };
  if (opts.mode === "off") return out;
  let staged: { entity_id: string; increment_id: string | null; magento_status: string | null; customer_name: string | null; customer_email: string | null; mandant: string | null; payload: Record<string, string | null> | null; hs_order_id: string | null; first_seen: string }[];
  try {
    staged = (await query<typeof staged[number]>(
      `SELECT entity_id::text AS entity_id, increment_id, magento_status, customer_name, customer_email, mandant, payload, hs_order_id, first_seen::text AS first_seen
         FROM apsomh_mg_stage WHERE $1 = ANY(skus) AND first_seen > now() - interval '${LOOK_BACK_DAYS} days' ORDER BY first_seen`, [FEE_PLASTICS])).rows;
  } catch (e) {
    out.error = `the shop orders could not be read: ${(e as Error).message.slice(0, 120)}`;
    return out;
  }
  const rows = (await kvGet<Record<string, ShopRow>>(KV.rows)) ?? {};
  const reqs = await erpRequests();
  const fromMs = opts.from ? Date.parse(opts.from) : NaN;
  let worked = 0, asked = 0;
  for (const s of staged) {
    const p = s.payload ?? {};
    const lines = Object.keys(p).filter((k) => /^order_line_\d{2}_article$/.test(k)).sort().map((k) => String(p[k] ?? "").trim()).filter((x) => x && !FEE_SKUS.has(x));
    const r: ShopRow = rows[s.entity_id] ?? {
      entity: s.entity_id, web: s.increment_id ?? s.entity_id, seenAt: new Date(s.first_seen).toISOString(),
      orderedAt: p.hs_external_created_date ? new Date(/^\d+$/.test(p.hs_external_created_date) ? Number(p.hs_external_created_date) : p.hs_external_created_date).toISOString() : null,
      customer: s.customer_name, mandant: s.mandant ? `M${String(s.mandant).replace(/^M/i, "")}` : p.order_mandant ? `M${p.order_mandant}` : null,
      lines, state: "waiting-number", at: new Date().toISOString(),
    };
    rows[s.entity_id] = r;
    // what waits for the ERP's number is looked at every look; the rest every 20 minutes (a ticket by hand may come)
    if (SHOP_DONE.has(r.state) || (r.state !== "waiting-number" && r.state !== "failed" && r.probed && Date.now() - Date.parse(r.at) < RECHECK_MS)) continue;
    if (worked >= PER_LOOK) continue;
    worked++;
    const set = (state: ShopState, extra: Partial<ShopRow> = {}) => { Object.assign(r, extra, { state, at: new Date().toISOString() }); };
    try {
      if (/^(canceled|cancelled|closed)$/i.test(s.magento_status ?? "")) { set("cancelled"); continue; }
      // the ERP's number: on the web order (Magento connector > ERP numbers stamps it) ...
      if (!r.a && s.hs_order_id) {
        const o = await hs<Obj>(`/crm/v3/objects/orders/${s.hs_order_id}?properties=order_order_number`).catch(() => null);
        r.webOrderId = o ? s.hs_order_id : null;
        r.a = baseOf(o?.properties.order_order_number);
        if (r.a) r.numberFrom = "web order";
      }
      // ... on the ERP's own order that carries the web number (a web order merged into it) ...
      if (!r.a) {
        const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/orders/search", "POST", {
          filterGroups: [{ filters: [{ propertyName: "hs_external_order_id", operator: "EQ", value: r.web }] }, { filters: [{ propertyName: "order_web_order_number", operator: "EQ", value: r.web }] }],
          properties: ["order_order_number"], limit: 10,
        }).catch(() => ({ results: [] as Obj[] }));
        r.a = (j.results ?? []).map((o) => baseOf(o.properties.order_order_number)).find((x): x is string => !!x) ?? null;
        if (r.a) r.numberFrom = "ERP order";
      }
      // ... else the shop itself: an order it had already sent to the ERP never got a web order in HubSpot
      let shopSays: string | null = null;
      if (!r.a && asked < SHOP_ASKS_PER_LOOK && (!r.askedAt || Date.now() - Date.parse(r.askedAt) >= RECHECK_MS)) {
        asked++;
        r.askedAt = new Date().toISOString();
        const f = await erpNumberFromShop(r.web).catch(() => ({ number: null, state: "no_answer" as const }));
        r.a = baseOf(f.number);
        if (r.a) r.numberFrom = "shop";
        else shopSays = f.state === "not_transferred" ? "the shop has not sent it to the ERP yet" : f.state === "no_answer" ? "the shop did not answer - asked again in 20 minutes" : "the shop's ERP number could not be read";
      }
      // a certificate ticket already there - the Back Office's
      const hand = (await ticketsFor(r.a ?? null, r.web)).filter((t) => isCertTicket(t.properties) && t.properties.hs_pipeline === BO_PIPELINE).sort((x, y) => String(x.properties.createdate).localeCompare(String(y.properties.createdate)))[0];
      if (hand) {
        const named = (hand.properties.which_certificate__ ?? "").split(";").map((x) => x.trim()).filter(Boolean);
        set("by-hand", {
          ticket: { id: String(hand.id), at: String(hand.properties.createdate), by: "hand", subject: hand.properties.subject },
          ...(named.length && !r.certs?.length ? { certs: named, other: hand.properties.other_certificates ?? null, typeFrom: "ticket" as const } : {}),
        });
        continue;
      }
      if (!r.a) {
        const old = Date.now() - Date.parse(r.orderedAt ?? r.seenAt) > TYPE_WAIT_DAYS * 86400_000;
        set(old ? "no-type" : "waiting-number", { why: old ? `no ERP order number after ${TYPE_WAIT_DAYS} days - left to the Back Office` : shopSays ?? (r.why && r.askedAt ? r.why : "the shop is asked for the ERP's number within minutes") });
        continue;
      }
      // which certificate: the shop's options (read once), else the ERP's comment
      if (!r.probed) {
        r.probed = true;
        r.shopOptions = await shopOptions(s.entity_id).catch((e) => { r.probeError = (e as Error).message.slice(0, 80); return []; });
      }
      let found: ErpRequest[] = reqs[r.a]?.reqs ?? [];
      let from: ShopRow["typeFrom"] = found.length ? "erp" : null;
      if (!found.length) { const own = typesInOptions(r.shopOptions ?? []); if (own.length) { found = own; from = "shop"; } }
      if (!found.length) {
        const old = Date.now() - Date.parse(r.orderedAt ?? r.seenAt) > TYPE_WAIT_DAYS * 86400_000;
        set(old ? "no-type" : "waiting-type", { why: old ? `no certificate named after ${TYPE_WAIT_DAYS} days - left to the Back Office` : "which certificate: the ERP's comment comes with the next ERP file" });
        continue;
      }
      const { certs, other } = certsOf(found);
      const pos = positionsText(found, r.lines) || null;
      // the order's records, its company and contact, the delivery date
      const ds = (await deliveriesOf([r.a])).get(r.a) ?? [];
      const due = pickDelivery(null, articlesIn(pos), ds).d?.ship ?? null;
      // the orders the ticket hangs on (SARCLA 07.11.2026: "associate it to the order"): the web order when HubSpot has it,
      // and every ERP record of the order - its .000 and each delivery - so the Certificates card shows on whichever is open
      const erpIds = ds.filter((x) => x.id).map((x) => x.id!);
      const web = r.webOrderId === undefined ? s.hs_order_id : r.webOrderId;
      const orderIds = [...new Set([...(web ? [web] : []), ...erpIds])];
      let companyId: string | null = null, contactId: string | null = null;
      for (const id of orderIds) {
        companyId ??= (await assocIds(id, "companies"))[0] ?? null;
        contactId ??= (await assocIds(id, "contacts"))[0] ?? null;
      }
      // the buyer by the shop's e-mail, when the ERP's order has no person
      if (!contactId && s.customer_email) {
        const c = await hs<{ results?: Obj[] }>("/crm/v3/objects/contacts/search", "POST", { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: s.customer_email.trim().toLowerCase() }] }], properties: ["email"], limit: 1 }).catch(() => ({ results: [] as Obj[] }));
        contactId = c.results?.[0]?.id ? String(c.results[0].id) : null;
      }
      let company = r.customer;
      if (companyId) {
        const c = await hs<Obj>(`/crm/v3/objects/companies/${companyId}?properties=company_name__unique_,name`).catch(() => null);
        company = c?.properties.company_name__unique_ || c?.properties.name || company;
      }
      const avor = certs.includes(EC1935);
      const subject = `${HEAD.std} | ${certsText({ certs, other })} | ${r.mandant ?? ""} | ${r.a} | ${dueShort(due)} | ${company ?? ""} |`.replace(/\s+/g, " ").trim();
      Object.assign(r, { certs, other, pos, typeFrom: from, due, company, companyId, contactId, orderIds });
      const create = opts.mode === "live" && opts.writing && !Number.isNaN(fromMs) && Date.parse(r.seenAt) >= fromMs;
      if (!create) {
        set("would", { would: { subject, owner: null, avor }, wouldAt: r.wouldAt ?? new Date().toISOString(), why: opts.mode === "live" ? (opts.writing ? "first seen before Live was switched on - the Back Office's" : "the certificates app is not writing") : undefined });
        out.listed++;
        continue;
      }
      const owner = opts.pick();
      const props: Record<string, string> = {
        subject, hs_pipeline: BO_PIPELINE, hs_pipeline_stage: STAGE.certificates, enquiry_category: CATEGORY,
        which_certificate__: certs.join(";"), order_number: r.a, source_type: "AUTOMATION", hs_ticket_priority: "HIGH",
        content: [
          `Requested in the shop: order ${r.web}${r.orderedAt ? ` of ${dueShort(r.orderedAt.slice(0, 10))}` : ""} - Declaration of Conformity (${FEE_PLASTICS}).`,
          `The certificates: ${found.map((x) => `${x.pos ? `Pos ${x.pos} ` : ""}${x.type}`).join("; ")} (${from === "erp" ? "the ERP order's comment" : "the shop's order"}).`,
          "Created by APSOhub - Certificates.",
        ].join("\n"),
        ...(other ? { other_certificates: other } : {}), ...(r.mandant ? { sarcla_pm_witch_mandant__: r.mandant } : {}),
        ...(pos ? { sarcla_article_number_order_pm: pos } : {}), ...(due ? { delivery_date_for_certificate: due } : {}),
        ...(owner ? { hubspot_owner_id: owner, back_office_ticket_requester: owner } : {}),
        // EC 1935/2004: a new article number first - AVOR, as the process starts it
        ...(avor ? { actions_for_certificates: ACT.avor } : {}),
      };
      const t = await hs<{ id: string }>("/crm/v3/objects/tickets", "POST", { properties: props });
      opts.taken();
      const links: [keyof typeof ASSOC, string][] = [...orderIds.map((id) => ["orders", id] as [keyof typeof ASSOC, string]), ...(contactId ? [["contacts", contactId] as [keyof typeof ASSOC, string]] : []), ...(companyId ? [["companies", companyId] as [keyof typeof ASSOC, string]] : [])];
      for (const [type, id] of links) {
        const types = [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC[type] }, ...(type === "companies" ? [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: PRIMARY_COMPANY }] : [])];
        await hs(`/crm/v4/objects/tickets/${t.id}/associations/${type}/${id}`, "PUT", types).catch((e) => console.warn(`[certificates] shop ticket ${t.id} -> ${type}: ${(e as Error).message}`));
      }
      set("created", { ticket: { id: String(t.id), at: new Date().toISOString(), by: "hub", subject }, would: { subject, owner, avor }, why: undefined, error: undefined });
      out.created++;
    } catch (e) {
      set("failed", { error: (e as Error).message.slice(0, 200) });
    }
  }
  // the last 30 days
  const keep = Date.now() - 30 * 86400_000;
  for (const [k, v] of Object.entries(rows)) if (!(Date.parse(v.seenAt) >= keep)) delete rows[k];
  await kvSet(KV.rows, rows);
  return out;
}

export async function shopRows(): Promise<ShopRow[]> {
  const rows = (await kvGet<Record<string, ShopRow>>(KV.rows)) ?? {};
  return Object.values(rows).sort((a, b) => b.seenAt.localeCompare(a.seenAt));
}
